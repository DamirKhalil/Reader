# Темп — RSVP-читалка

A mobile web app (PWA) that shows text one word at a time. Each word's anchor letter (ORP) always sits at the same point on the screen. It installs to the home screen like a regular app and works offline.

## Features
- **Sources:** pasted text, TXT (UTF-8 or Windows-1251), FB2, EPUB, HTML, Markdown; on Android, also text sent through «Поделиться» (Share).
- **Reading:** speed from 100 to 1000 words per minute, 1–3 words at a time, longer pauses on punctuation and at paragraph ends, a gradual speed-up after each pause, and long words split by syllable.
- **Paused view:** shows the surrounding paragraphs; tap any word to continue from it.
- **Gestures:** tap = pause; swipe ← → = previous/next sentence; swipe ↑ ↓ = speed. On a computer: space, the arrow keys, Esc.
- **Library:** keeps your place in each book in IndexedDB and shows reading progress and time left.
- **Look:** three themes (dark, light, sepia), three fonts, and a choice of anchor-letter color.
- **Screen:** stays on while you read (Wake Lock).

## Running it
No build step. The folder is a static site:

```bash
cd rsvp && python3 -m http.server 8000
```

Installing on a phone needs HTTPS. The simplest option is GitHub Pages (Settings → Pages → Deploy from branch). The app will then be at `https://<user>.github.io/Reader/rsvp/`.
- **iPhone:** Safari → «Поделиться» (Share) → «На экран „Домой“» (Add to Home Screen).
- **Android:** Chrome → menu → «Установить приложение» (Install app).

After changing any files, bump `VERSION` in `sw.js` so phones pick up the update.

## Files
- `index.html`, `style.css`, `app.js` — the app itself
- `sw.js` — offline cache
- `manifest.webmanifest` — install settings and the Share target
- `vendor/jszip.min.js` — EPUB unpacking (JSZip 3.10.1, MIT)
