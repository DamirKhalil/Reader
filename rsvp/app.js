'use strict';
/* Темп — RSVP-читалка. Без сборки и зависимостей (кроме JSZip для EPUB). */

const $ = (s, r = document) => r.querySelector(s);

/* ================= Настройки ================= */
const DEFAULTS = { wpm: 300, chunk: 1, size: 44, font: 'sans', theme: 'dark', accent: '#ff5a4e', pauses: true, ramp: true, guides: true };
const S = Object.assign({}, DEFAULTS, readLS('tempo.settings') || {});
function readLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function saveSettings() { try { localStorage.setItem('tempo.settings', JSON.stringify(S)); } catch {} }

const FONTS = { sans: 'var(--sans)', serif: 'var(--serif)', mono: 'var(--mono)' };
const THEME_BG = { dark: '#0f0f10', light: '#fafaf8', sepia: '#f3ead8' };
function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = S.theme;
  root.style.setProperty('--word-size', S.size + 'px');
  root.style.setProperty('--word-font', FONTS[S.font] || FONTS.sans);
  root.style.setProperty('--accent', S.accent === 'ink' ? 'var(--ink)' : S.accent);
  $('meta[name=theme-color]').content = THEME_BG[S.theme];
  $('#reader').classList.toggle('no-guides', !S.guides);
  $('#wpmVal').textContent = S.wpm;
}

/* ================= Хранилище (IndexedDB) ================= */
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('tempo', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('meta', { keyPath: 'id' }); d.createObjectStore('text'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function run(stores, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(stores, mode);
    const req = fn(t);
    t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const Store = {
  list: () => run('meta', 'readonly', t => t.objectStore('meta').getAll()),
  text: id => run('text', 'readonly', t => t.objectStore('text').get(id)),
  put: (meta, text) => run(['meta', 'text'], 'readwrite', t => { t.objectStore('meta').put(meta); t.objectStore('text').put(text, meta.id); }),
  meta: meta => run('meta', 'readwrite', t => { t.objectStore('meta').put(meta); }),
  del: id => run(['meta', 'text'], 'readwrite', t => { t.objectStore('meta').delete(id); t.objectStore('text').delete(id); }),
};

/* ================= Текст → абзацы → токены ================= */
function toParagraphs(raw) {
  raw = raw.replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ').replace(/­/g, '');
  const lines = (raw.match(/\n/g) || []).length;
  const blanks = (raw.match(/\n[ \t]*\n/g) || []).length;
  // Если абзацы разделены пустыми строками — внутри абзаца переносы считаем мягкими.
  const parts = blanks > 0 && blanks >= lines * 0.15 ? raw.split(/\n[ \t]*\n/) : raw.split('\n');
  return parts.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const LEAD = /^[^\p{L}\p{N}]*/u, TAIL = /[^\p{L}\p{N}]*$/u;
const CLOSE = `["'»”’)\\]]*$`;
const RE_SENT = new RegExp(`[.!?…]${CLOSE}`), RE_COMMA = new RegExp(`[,;:—–]${CLOSE}`);
const MAX_PIECE = 13;

function splitLong(w) {
  const core = w.replace(LEAD, '').replace(TAIL, '');
  if (core.length <= MAX_PIECE || /[/@]/.test(w)) return [w];
  // Сначала режем по дефисам внутри слова, потом длинные части — по слогам
  const out = [];
  for (const part of w.split(/(?<=-)/)) out.push(...hyphenate(part));
  return out.map((p, i) => (i < out.length - 1 && !/-$/.test(p) ? p + '-' : p));
}
const VOWEL = /[аеёиоуыэюяaeiouy]/i, NO_START = /[ьъй]/i;
function hyphenate(w) {
  if (w.replace(TAIL, '').length <= MAX_PIECE) return [w];
  const n = Math.ceil(w.length / 10), target = Math.ceil(w.length / n), out = [];
  let rest = w;
  while (rest.length > MAX_PIECE) {
    let cut = -1;
    // Ищем ближайший к цели разрыв «гласная | согласная», оставляя минимум по 3 буквы
    for (let d = 0; d <= 4 && cut < 0; d++) {
      for (const i of [target - d, target + d]) {
        if (i < 3 || i > rest.length - 3) continue;
        if (VOWEL.test(rest[i - 1]) && !VOWEL.test(rest[i]) && !NO_START.test(rest[i]) && !NO_START.test(rest[i + 1] || "")) { cut = i; break; }
      }
    }
    if (cut < 0) cut = Math.min(target, rest.length - 3);
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  out.push(rest);
  return out;
}

// Токен: w — текст, p — номер абзаца, s — начало предложения, k — пунктуация (0/1 запятая/2 точка), e — конец абзаца, n — длина ядра, d — число
function tokenize(text) {
  const paras = text.split('\n'), toks = [];
  let sent = true;
  paras.forEach((para, pi) => {
    const words = para.split(' ').filter(Boolean);
    let carry = '';
    words.forEach((w, wi) => {
      // Одинокое тире или кавычку приклеиваем к следующему слову: «— Привет»
      if (/^[—–\-«“"(]+$/.test(w) && wi < words.length - 1) { carry += w + ' '; return; }
      const pieces = splitLong(carry + w); carry = '';
      pieces.forEach((piece, j) => {
        const last = j === pieces.length - 1;
        const core = piece.replace(LEAD, '').replace(TAIL, '');
        toks.push({ w: piece, p: pi, s: sent, k: last ? (RE_SENT.test(piece) ? 2 : RE_COMMA.test(piece) ? 1 : 0) : 0, e: false, n: core.length, d: /\d/.test(core) });
        sent = false;
      });
      if (RE_SENT.test(w)) sent = true;
    });
    if (toks.length) toks[toks.length - 1].e = true;
    sent = true;
  });
  return toks;
}

// Опорная точка распознавания: чуть левее середины слова
function orpIndex(w) {
  const lead = (w.match(LEAD) || [''])[0].length;
  const core = w.slice(lead).replace(TAIL, '').length;
  if (!core) return Math.floor((w.length - 1) / 2);
  const o = core <= 1 ? 0 : core <= 5 ? 1 : core <= 9 ? 2 : core <= 13 ? 3 : 4;
  return lead + o;
}

function factor(t) {
  let f = 1;
  if (t.n > 6) f += Math.min(0.7, (t.n - 6) * 0.08);
  if (t.d) f += 0.3;
  if (S.pauses) {
    if (t.k === 2) f += 1.1; else if (t.k === 1) f += 0.5;
    if (t.e) f = Math.max(f + 0.6, 2.4);
  }
  return f;
}
function avgFactor(toks) {
  if (!toks.length) return 1;
  let sum = 0;
  for (const t of toks) sum += factor(t);
  return sum / toks.length;
}

/* ================= Чтение файлов ================= */
function decodeBytes(buf, enc) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  if (enc) { try { return new TextDecoder(enc).decode(buf); } catch {} }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1251').decode(buf); } // старые русские txt
}

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'dt', 'dd', 'td', 'th', 'figcaption', 'div', 'section', 'article', 'aside', 'header', 'footer', 'tr']);
function htmlParagraphs(doc) {
  const body = doc.body || doc.documentElement;
  if (!body) return [];
  body.querySelectorAll('script,style,rt,rp,nav[*|type="toc"]').forEach(n => n.remove());
  body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  const out = [];
  (function walk(el) {
    let buf = '';
    const flush = () => { buf.split('\n').forEach(s => { s = s.replace(/\s+/g, ' ').trim(); if (s) out.push(s); }); buf = ''; };
    for (const n of el.childNodes) {
      if (n.nodeType === 3) buf += n.nodeValue;
      else if (n.nodeType === 1) {
        if (BLOCKS.has(n.localName.toLowerCase())) { flush(); walk(n); }
        else buf += n.textContent;
      }
    }
    flush();
  })(body);
  return out;
}
function parseXml(str, type) {
  let doc = new DOMParser().parseFromString(str, type);
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(str, 'text/html');
  return doc;
}

function parseFb2(buf) {
  const head = new TextDecoder('latin1').decode(new Uint8Array(buf).slice(0, 300));
  const enc = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  const doc = parseXml(decodeBytes(buf, enc), 'application/xml');
  const title = (doc.getElementsByTagName('book-title')[0] || {}).textContent || '';
  const keep = new Set(['p', 'v', 'subtitle', 'text-author']);
  const paras = [];
  for (const body of doc.getElementsByTagName('body')) {
    if (/notes|comments/i.test(body.getAttribute('name') || '')) continue;
    for (const el of body.getElementsByTagName('*')) {
      if (keep.has(el.localName)) { const s = el.textContent.replace(/\s+/g, ' ').trim(); if (s) paras.push(s); }
    }
  }
  return { title: title.trim(), paras };
}

let jszipLoading;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return jszipLoading || (jszipLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/jszip.min.js';
    s.onload = () => res(window.JSZip);
    s.onerror = () => { jszipLoading = null; rej(new Error('Не удалось загрузить модуль EPUB')); };
    document.head.appendChild(s);
  }));
}
function resolvePath(base, href) {
  const parts = (base + href.split('#')[0]).split('/'), out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); }
  return out.join('/');
}
async function parseEpub(buf) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(buf);
  const container = parseXml(await zip.file('META-INF/container.xml').async('string'), 'application/xml');
  const opfPath = container.getElementsByTagName('rootfile')[0].getAttribute('full-path');
  const opf = parseXml(await zip.file(opfPath).async('string'), 'application/xml');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = ([...opf.getElementsByTagName('*')].find(e => e.localName === 'title') || {}).textContent || '';
  const items = {};
  for (const it of opf.getElementsByTagName('item')) items[it.getAttribute('id')] = it.getAttribute('href');
  const paras = [];
  for (const ref of opf.getElementsByTagName('itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const href = items[ref.getAttribute('idref')];
    if (!href) continue;
    const path = resolvePath(base, decodeURIComponent(href));
    const f = zip.file(path);
    if (!f) continue;
    paras.push(...htmlParagraphs(parseXml(await f.async('string'), 'application/xhtml+xml')));
  }
  return { title: title.trim(), paras };
}

function stripMarkdown(s) {
  return s.replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|`|~~)/g, '');
}

async function importFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = (file.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';
  const buf = await file.arrayBuffer();
  if (ext === 'epub') { const r = await parseEpub(buf); return { title: r.title || name, paras: r.paras }; }
  if (ext === 'fb2') { const r = parseFb2(buf); return { title: r.title || name, paras: r.paras }; }
  const text = decodeBytes(buf);
  if (ext === 'html' || ext === 'htm' || /^\s*<(!doctype|html)/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return { title: doc.title || name, paras: htmlParagraphs(doc) };
  }
  if (ext === 'md' || ext === 'markdown') return { title: name, paras: toParagraphs(stripMarkdown(text)) };
  return { title: name, paras: toParagraphs(text) };
}

/* ================= Библиотека ================= */
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const m = n % 10; return n > 10 && n < 20 ? c : m > 1 && m < 5 ? b : m === 1 ? a : c; };
function fmtMin(min) {
  if (min < 1) return 'меньше минуты';
  if (min < 60) return `${Math.round(min)} мин`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
function minutesLeft(meta, pos) {
  return (meta.total - pos) * (meta.avg || 1.2) / S.wpm;
}

async function renderLibrary() {
  const list = $('#books');
  let books = [];
  try { books = await Store.list(); } catch (e) { toast('Хранилище недоступно: книги не сохранятся'); }
  books.sort((a, b) => b.opened - a.opened);
  list.replaceChildren();
  $('#empty').hidden = books.length > 0;
  for (const b of books) {
    const pct = b.total ? Math.round((b.pos / Math.max(1, b.total - 1)) * 100) : 0;
    const li = document.createElement('li');
    li.className = 'book';
    const open = document.createElement('button');
    open.className = 'book-open'; open.type = 'button';
    const t = document.createElement('span'); t.className = 'book-title'; t.textContent = b.title;
    const m = document.createElement('span'); m.className = 'book-meta';
    m.textContent = b.done ? `Прочитано · ${b.words} ${plural(b.words, 'слово', 'слова', 'слов')}`
      : `${pct}% · осталось ${fmtMin(minutesLeft(b, b.pos))}`;
    const bar = document.createElement('span'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = (b.done ? 100 : pct) + '%'; bar.append(fill);
    open.append(t, m, bar);
    open.onclick = () => openBook(b.id);
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.type = 'button'; del.setAttribute('aria-label', 'Удалить');
    del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.onclick = async () => { if (confirm(`Удалить «${b.title}»?`)) { await Store.del(b.id); renderLibrary(); } };
    li.append(open, del);
    list.append(li);
  }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

async function addBook(title, paras) {
  const text = paras.join('\n');
  const toks = tokenize(text);
  if (!toks.length) { toast('Не нашлось текста для чтения'); return; }
  const words = text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  const meta = { id: uid(), title: (title || paras[0]).trim().slice(0, 120), pos: 0, total: toks.length, words, avg: avgFactor(toks), added: Date.now(), opened: Date.now(), done: false };
  try { await Store.put(meta, text); } catch { toast('Не удалось сохранить, но почитать можно'); }
  startReader(meta, toks);
}

/* ================= Плеер ================= */
const R = { meta: null, toks: [], i: 0, playing: false, timer: 0, ramp: 0, lastSave: 0, wake: null };
const el = {};

function groupAt(i) {
  const g = [R.toks[i]];
  for (let j = i + 1; g.length < S.chunk && j < R.toks.length; j++) {
    const prev = R.toks[j - 1], t = R.toks[j];
    if (t.p !== prev.p || prev.k === 2 || t.s) break;
    g.push(t);
  }
  return g;
}

function render(g) {
  const w = g.map(t => t.w).join(' ');
  const o = g.length === 1 ? orpIndex(w) : Math.floor((w.length - 1) / 2.3);
  el.l.textContent = w.slice(0, o);
  el.c.textContent = w.charAt(o);
  el.r.textContent = w.slice(o + 1);
  fitWord();
}
function fitWord() {
  // Если слово не влезает по ширине — уменьшаем шрифт только для него
  el.word.style.fontSize = '';
  const over = Math.max(el.l.scrollWidth / (el.l.clientWidth || 1), el.r.scrollWidth / (el.r.clientWidth || 1));
  if (over > 1.001) el.word.style.fontSize = (S.size / over * 0.97) + 'px';
}

function tick() {
  const g = groupAt(R.i);
  render(g);
  updateProgress();
  let d = 0;
  for (const t of g) d += factor(t);
  d *= 60000 / S.wpm;
  if (R.ramp > 0) { d *= 1 + R.ramp * 0.12; R.ramp--; }
  R.timer = setTimeout(() => {
    R.i += g.length;
    if (R.i >= R.toks.length) return finish();
    tick();
  }, d);
  if (Date.now() - R.lastSave > 4000) savePos();
}

function play() {
  if (!R.toks.length) return;
  if (R.i >= R.toks.length - 1 && R.meta.done) R.i = 0;
  R.playing = true;
  R.ramp = S.ramp ? 5 : 0;
  el.reader.classList.add('playing');
  el.reader.classList.remove('paused');
  el.context.hidden = true;
  lockScreen(true);
  clearTimeout(R.timer);
  tick();
}
function pause() {
  clearTimeout(R.timer);
  R.playing = false;
  el.reader.classList.remove('playing');
  el.reader.classList.add('paused');
  el.hint.textContent = 'Нажмите на слово ниже, чтобы перейти к нему';
  showCurrent();
  showContext();
  lockScreen(false);
  savePos();
}
function toggle() { R.playing ? pause() : play(); }

function finish() {
  R.i = R.toks.length - 1;
  R.meta.done = true;
  pause();
  el.hint.textContent = 'Конец. Нажмите, чтобы начать заново';
}

function showCurrent() { if (R.toks.length) { render(groupAt(R.i)); updateProgress(); } }

function jump(to) {
  R.i = Math.max(0, Math.min(R.toks.length - 1, to));
  if (R.meta.done && R.i < R.toks.length - 1) R.meta.done = false;
  if (R.playing) { clearTimeout(R.timer); R.ramp = S.ramp ? 3 : 0; tick(); }
  else { showCurrent(); showContext(); savePos(); }
}
function sentenceStart(i) { while (i > 0 && !R.toks[i].s) i--; return i; }
function prevSentence() {
  let s = sentenceStart(R.i);
  if (R.i - s < 3 && s > 0) s = sentenceStart(s - 1);
  jump(s);
}
function nextSentence() {
  let j = R.i + 1;
  while (j < R.toks.length && !R.toks[j].s) j++;
  if (j < R.toks.length) jump(j);
}

function setWpm(v) {
  S.wpm = Math.max(100, Math.min(1000, Math.round(v / 25) * 25));
  saveSettings();
  el.wpmVal.textContent = S.wpm;
  updateProgress();
}

function updateProgress() {
  const n = R.toks.length;
  el.scrub.max = Math.max(0, n - 1);
  el.scrub.value = R.i;
  el.pct.textContent = Math.round((R.i / Math.max(1, n - 1)) * 100) + '%';
  el.left.textContent = 'осталось ' + fmtMin(minutesLeft(R.meta, R.i));
}

function showContext() {
  const t = R.toks[R.i];
  if (!t) return;
  const box = el.context;
  box.replaceChildren();
  // Текущий абзац и соседние — чтобы вспомнить, где остановились
  let a = R.i, b = R.i;
  const pFrom = t.p - 1, pTo = t.p + 1;
  while (a > 0 && R.toks[a - 1].p >= pFrom) a--;
  while (b < R.toks.length - 1 && R.toks[b + 1].p <= pTo) b++;
  const note = document.createElement('div'); note.className = 'ctx-note'; note.textContent = 'Контекст';
  box.append(note);
  let p = null, curEl = null;
  for (let i = a; i <= b; i++) {
    const tk = R.toks[i];
    if (!p || tk.p !== R.toks[i - 1].p) { p = document.createElement('p'); box.append(p); }
    const s = document.createElement('span');
    s.textContent = tk.w; s.dataset.i = i;
    if (i === R.i) { s.className = 'cur'; curEl = s; }
    p.append(s, ' ');
  }
  box.hidden = false;
  el.reader.classList.add('has-context');
  if (curEl) requestAnimationFrame(() => { box.scrollTop = curEl.offsetTop - box.offsetTop - box.clientHeight / 3; });
}

async function savePos() {
  if (!R.meta) return;
  R.lastSave = Date.now();
  R.meta.pos = R.i;
  R.meta.opened = Date.now();
  try { await Store.meta(R.meta); } catch {}
}

async function lockScreen(on) {
  try {
    if (on && 'wakeLock' in navigator && !R.wake) {
      R.wake = await navigator.wakeLock.request('screen');
      R.wake.addEventListener('release', () => { R.wake = null; });
    } else if (!on && R.wake) { await R.wake.release(); R.wake = null; }
  } catch {}
}

async function openBook(id) {
  const metas = await Store.list();
  const meta = metas.find(m => m.id === id);
  const text = await Store.text(id);
  if (!meta || text == null) { toast('Книга не найдена'); return renderLibrary(); }
  startReader(meta, tokenize(text));
}

function startReader(meta, toks) {
  R.meta = meta; R.toks = toks;
  R.meta.total = toks.length;
  R.meta.avg = avgFactor(toks);
  R.i = Math.min(meta.done ? 0 : meta.pos || 0, toks.length - 1);
  if (meta.done) meta.done = false;
  el.title.textContent = meta.title;
  $('#library').hidden = true;
  el.reader.hidden = false;
  el.reader.classList.remove('playing', 'has-context');
  el.reader.classList.add('paused');
  el.context.hidden = true;
  el.hint.textContent = R.i > 0 ? 'Коснитесь, чтобы продолжить' : 'Коснитесь, чтобы начать · свайп ← → по предложениям, ↑ ↓ скорость';
  showCurrent();
  if (R.i > 0) showContext();
  if (location.hash !== '#read') history.pushState({ read: 1 }, '', '#read');
}

function closeReader(fromPop) {
  if (R.playing) pause(); else savePos();
  lockScreen(false);
  el.reader.hidden = true;
  $('#library').hidden = false;
  R.meta = null; R.toks = [];
  renderLibrary();
  if (!fromPop && location.hash === '#read') history.back();
}

/* ================= Жесты и клавиши ================= */
function bindGestures() {
  let sx = 0, sy = 0, st = 0, active = false;
  el.stage.addEventListener('pointerdown', e => { active = true; sx = e.clientX; sy = e.clientY; st = Date.now(); });
  el.stage.addEventListener('pointercancel', () => { active = false; });
  el.stage.addEventListener('pointerup', e => {
    if (!active) return; active = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 45 && ax > ay) { dx < 0 ? nextSentence() : prevSentence(); }
    else if (ay > 45) { setWpm(S.wpm + (dy < 0 ? 25 : -25)); toast(`${S.wpm} слов в минуту`, 900); }
    else if (Date.now() - st < 600) toggle();
  });
  document.addEventListener('keydown', e => {
    if (el.reader.hidden || document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowLeft') prevSentence();
    else if (k === 'ArrowRight') nextSentence();
    else if (k === 'ArrowUp') { e.preventDefault(); setWpm(S.wpm + 25); }
    else if (k === 'ArrowDown') { e.preventDefault(); setWpm(S.wpm - 25); }
    else if (k === 'Escape') closeReader();
  });
}

/* ================= Диалоги ================= */
function bindSettings() {
  const dlg = $('#setDlg');
  const seg = (id, key, cast = v => v) => {
    const box = $(id);
    const mark = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(S[key]) === b.dataset.v));
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S[key] = cast(b.dataset.v); mark(); changed(); });
    return mark;
  };
  const marks = [seg('#sChunk', 'chunk', Number), seg('#sFont', 'font'), seg('#sTheme', 'theme'), seg('#sAccent', 'accent')];
  const wpm = $('#sWpm'), size = $('#sSize');
  const toggles = { '#sPauses': 'pauses', '#sRamp': 'ramp', '#sGuides': 'guides' };
  wpm.oninput = () => { setWpm(+wpm.value); $('#oWpm').textContent = S.wpm; };
  size.oninput = () => { S.size = +size.value; $('#oSize').textContent = S.size; changed(); };
  for (const [sel, key] of Object.entries(toggles)) $(sel).onchange = e => { S[key] = e.target.checked; changed(); };
  function changed() {
    saveSettings(); applySettings();
    if (R.meta) { R.meta.avg = avgFactor(R.toks); if (!R.playing) showCurrent(); else updateProgress(); }
  }
  function open() {
    if (R.playing) pause();
    wpm.value = S.wpm; $('#oWpm').textContent = S.wpm;
    size.value = S.size; $('#oSize').textContent = S.size;
    for (const [sel, key] of Object.entries(toggles)) $(sel).checked = S[key];
    marks.forEach(m => m());
    dlg.showModal();
  }
  $('#rSettings').onclick = open;
  $('#libSettings').onclick = open;
  dlg.addEventListener('close', () => { if (R.meta) showCurrent(); else renderLibrary(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
}

function bindPaste() {
  const dlg = $('#pasteDlg');
  $('#pasteBtn').onclick = () => { $('#pasteTitle').value = ''; $('#pasteText').value = ''; dlg.showModal(); };
  $('#clipBtn').onclick = async () => {
    try { $('#pasteText').value = await navigator.clipboard.readText(); }
    catch { toast('Нет доступа к буферу — вставьте вручную'); }
  };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close('cancel'); });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const paras = toParagraphs($('#pasteText').value);
    if (!paras.length) return toast('Текст пустой');
    addBook($('#pasteTitle').value, paras);
  });
}

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

const DEMO = `Как читать в этом приложении

Слова появляются по одному в одной и той же точке экрана. Глазу не нужно бегать по строке: он смотрит в центр, а текст приходит к нему сам.

Красная буква — опорная. Она стоит чуть левее середины слова, там, где мозг узнаёт его быстрее всего. Держите взгляд на ней и не пытайтесь проговаривать слова про себя.

Коснитесь экрана, чтобы поставить паузу. Под словом появится абзац, в котором вы находитесь: нажмите на любое слово, и чтение продолжится с него.

Свайп влево перематывает к следующему предложению, вправо — возвращает к предыдущему. Свайп вверх ускоряет, вниз замедляет.

Начните с трёхсот слов в минуту. Когда станет легко, прибавляйте по двадцать пять. На запятых и точках приложение задерживается чуть дольше, чтобы смысл успевал сложиться.

Вставьте свой текст или откройте книгу в форматах TXT, FB2 или EPUB. Место, где вы остановились, сохранится.`;

/* ================= Старт ================= */
function init() {
  Object.assign(el, {
    reader: $('#reader'), stage: $('#stage'), word: $('#word'), context: $('#context'), hint: $('#hint'),
    l: $('#word .l'), c: $('#word .c'), r: $('#word .r'), title: $('#rTitle'),
    scrub: $('#scrub'), pct: $('#pct'), left: $('#left'), wpmVal: $('#wpmVal'),
  });
  applySettings();
  bindGestures();
  bindSettings();
  bindPaste();

  $('#playBtn').onclick = toggle;
  $('#prevSent').onclick = prevSentence;
  $('#nextSent').onclick = nextSentence;
  $('#slower').onclick = () => setWpm(S.wpm - 25);
  $('#faster').onclick = () => setWpm(S.wpm + 25);
  $('#backBtn').onclick = () => closeReader();
  $('#demoBtn').onclick = () => addBook('Как читать в этом приложении', toParagraphs(DEMO).slice(1));
  el.scrub.addEventListener('input', () => { if (R.playing) pause(); R.i = +el.scrub.value; showCurrent(); });
  el.scrub.addEventListener('change', () => jump(sentenceStart(+el.scrub.value)));
  el.context.addEventListener('click', e => { const s = e.target.closest('span[data-i]'); if (s) { jump(+s.dataset.i); play(); } });

  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    toast('Открываю…', 10000);
    try { const r = await importFile(f); $('#toast').hidden = true; await addBook(r.title, r.paras); }
    catch (err) { console.error(err); toast('Не удалось открыть файл: ' + (err.message || 'неизвестный формат')); }
  });

  window.addEventListener('popstate', () => { if (!el.reader.hidden) closeReader(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && R.playing) pause();
    else if (!document.hidden && R.playing) lockScreen(true);
  });
  window.addEventListener('resize', () => { if (R.meta) fitWord(); });

  // Текст, присланный через «Поделиться» (Android)
  const q = new URLSearchParams(location.search);
  const shared = [q.get('text'), q.get('url')].filter(Boolean).join('\n\n');
  history.replaceState(null, '', location.pathname);
  renderLibrary();
  if (shared.trim()) addBook(q.get('title') || '', toParagraphs(shared));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined') module.exports = { toParagraphs, tokenize, orpIndex, splitLong, factor, stripMarkdown };
