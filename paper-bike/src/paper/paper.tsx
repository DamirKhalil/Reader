import React from "react";
import { random, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/fonts";

// Fonts are bundled in public/fonts (SIL OFL) so renders never need the network.
export const DISPLAY = "Archivo Black";
export const HAND = "Patrick Hand";
loadFont({ family: DISPLAY, url: staticFile("fonts/ArchivoBlack-Regular.ttf") });
loadFont({ family: HAND, url: staticFile("fonts/PatrickHand-Regular.ttf") });

// Every scene draws in a 1920x1080 design space; the SVG is scaled to 4K.
export const VW = 1920;
export const VH = 1080;

// Stop-motion: hold each pose for STEP frames (60 fps / 4 = 15 poses a second).
export const STEP = 4;

export const PAL = {
  cream: "#f3ead8",
  kraft: "#d7b98c",
  kraftDark: "#b8946a",
  ink: "#2b2a33",
  charcoal: "#3c3b45",
  coral: "#ef6f5e",
  coralDark: "#c9523f",
  mustard: "#f2b43c",
  mustardDark: "#d39422",
  teal: "#2f8f8b",
  tealDark: "#1f6d6a",
  sky: "#bfe2e3",
  skyDeep: "#9fd0d4",
  sage: "#9cbf8e",
  green: "#5f9d5c",
  greenDark: "#3f7a49",
  violet: "#8f86b5",
  violetDark: "#6f6799",
  white: "#fffaf0",
  steel: "#c9ccd1",
  pink: "#f5a8a0",
};

/** Quantised frame for the stop-motion cadence. */
export const usePaperFrame = () => {
  const frame = useCurrentFrame();
  return Math.floor(frame / STEP) * STEP;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Hand-placement wobble: changes once per held pose, never smoothly. */
export const jitter = (seed: string | number, f: number, amount = 1) => {
  const step = Math.floor(f / STEP);
  return (random(`${seed}-${step}`) - 0.5) * 2 * amount;
};

/** Ease-out with a little overshoot, like a piece pressed into place. */
export const backOut = (t: number, s = 1.6) => {
  const x = clamp01(t) - 1;
  return x * x * ((s + 1) * x + s) + 1;
};

export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * Shared SVG filters. `paper` gives a scissor-cut edge plus a soft contact
 * shadow; `lift` is a deeper shadow for pieces floating above the set.
 */
export const PaperDefs: React.FC = () => (
  <defs>
    <filter id="cut" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="paper" x="-15%" y="-15%" width="135%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" result="cut" />
      <feGaussianBlur in="cut" stdDeviation={3} result="b" />
      <feOffset in="b" dx={3} dy={5} result="o" />
      <feColorMatrix in="o" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.06  0 0 0 0.38 0" result="s" />
      <feMerge>
        <feMergeNode in="s" />
        <feMergeNode in="cut" />
      </feMerge>
    </filter>
    <filter id="lift" x="-25%" y="-25%" width="160%" height="170%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" result="cut" />
      <feGaussianBlur in="cut" stdDeviation={9} result="b" />
      <feOffset in="b" dx={8} dy={16} result="o" />
      <feColorMatrix in="o" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.06  0 0 0 0.32 0" result="s" />
      <feMerge>
        <feMergeNode in="s" />
        <feMergeNode in="cut" />
      </feMerge>
    </filter>
    {/* Paper fibre + tooth, multiplied over the whole frame */}
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} seed={3} result="fine" />
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves={3} seed={11} result="fibre" />
      <feBlend in="fine" in2="fibre" mode="multiply" result="mix" />
      <feColorMatrix
        in="mix"
        type="matrix"
        values="0 0 0 0 0.62  0 0 0 0 0.56  0 0 0 0 0.48  -0.9 -0.9 0 0 1.05"
      />
    </filter>
  </defs>
);

/** Full-frame paper texture and the gentle exposure flicker of stop-motion. */
export const PaperFinish: React.FC = () => {
  const f = usePaperFrame();
  const flicker = 0.035 + jitter("flick", f, 0.012);
  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={VW} height={VH} filter="url(#grain)" opacity={0.55} style={{ mixBlendMode: "multiply" }} />
      <rect x={0} y={0} width={VW} height={VH} fill="#fff6e0" opacity={flicker} />
      {/* Soft vignette like a desk lamp on the set */}
      <radialGradient id="vig" cx="50%" cy="45%" r="75%">
        <stop offset="60%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#1a1208" stopOpacity={0.28} />
      </radialGradient>
      <rect x={0} y={0} width={VW} height={VH} fill="url(#vig)" />
    </g>
  );
};

/** The 4K stage every scene draws into. */
export const Stage: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <svg
    viewBox={`0 0 ${VW} ${VH}`}
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0, display: "block", background: bg }}
  >
    <PaperDefs />
    <rect x={0} y={0} width={VW} height={VH} fill={bg} />
    {children}
    <PaperFinish />
  </svg>
);

/** A straight strip of paper between two points (a bike tube, a limb). */
export const Strip: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  fill: string;
  cap?: boolean;
}> = ({ x1, y1, x2, y2, w, fill, cap }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const pts = [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ];
  return (
    <g>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={fill} />
      {cap ? (
        <>
          <circle cx={x1} cy={y1} r={w / 2} fill={fill} />
          <circle cx={x2} cy={y2} r={w / 2} fill={fill} />
        </>
      ) : null}
    </g>
  );
};

/** Irregular blob/polygon with hand-cut facets. */
export const cutPolygon = (cx: number, cy: number, r: number, n: number, seed: string, rough = 0.12) => {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (random(`${seed}-${i}`) - 0.5) * 2 * rough);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(" ");
};

/** Torn/zig-zag edge along the x axis, from x0..x1 at height y, closing downward to yEnd. */
export const tornEdge = (x0: number, x1: number, y: number, yEnd: number, seed: string, teeth = 40, amp = 14) => {
  const pts: string[] = [`${x0},${yEnd}`];
  for (let i = 0; i <= teeth; i++) {
    const x = x0 + ((x1 - x0) * i) / teeth;
    const yy = y + (random(`${seed}-${i}`) - 0.5) * 2 * amp;
    pts.push(`${x.toFixed(1)},${yy.toFixed(1)}`);
  }
  pts.push(`${x1},${yEnd}`);
  return pts.join(" ");
};

/** A word spelled in individual paper chips that pop on one at a time. */
export const ChipText: React.FC<{
  text: string;
  x: number;
  y: number;
  size: number;
  start: number;
  f: number;
  colors: string[];
  ink?: string;
  every?: number;
  seed: string;
  anchor?: "start" | "middle";
}> = ({ text, x, y, size, start, f, colors, ink = PAL.ink, every = 4, seed, anchor = "middle" }) => {
  const adv = size * 0.98;
  const widths = text.split("").map((ch) => (ch === " " ? size * 0.42 : adv));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = anchor === "middle" ? x - total / 2 : x;
  let visible = 0;
  return (
    <g>
      {text.split("").map((ch, i) => {
        const w = widths[i];
        const left = cx;
        cx += w;
        if (ch === " ") return null;
        const t0 = start + visible * every;
        visible++;
        if (f < t0) return null;
        const p = backOut((f - t0) / (STEP * 3), 2.2);
        const rot = (random(`${seed}-r-${i}`) - 0.5) * 12 + jitter(`${seed}-j-${i}`, f, 0.6);
        const dy = (random(`${seed}-y-${i}`) - 0.5) * size * 0.12;
        const col = colors[i % colors.length];
        const midX = left + w / 2;
        return (
          <g
            key={i}
            transform={`translate(${midX} ${y + dy}) rotate(${rot}) scale(${0.4 + 0.6 * p})`}
            filter="url(#paper)"
          >
            <polygon points={cutPolygon(0, 0, size * 0.62, 7, `${seed}-c-${i}`, 0.1)} fill={col} />
            <text
              x={0}
              y={size * 0.34}
              fontFamily={DISPLAY}
              fontSize={size}
              textAnchor="middle"
              fill={ink}
            >
              {ch}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** A hanging paper price-tag style label. */
export const Tag: React.FC<{
  x: number;
  y: number;
  w: number;
  title: string;
  sub: string;
  fill: string;
  rot: number;
  show: number;
}> = ({ x, y, w, title, sub, fill, rot, show }) => {
  const h = w * 0.34;
  const p = backOut(show, 1.8);
  if (show <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot * p}) scale(${p})`} filter="url(#lift)">
      <polygon
        points={`${-w / 2 + 40},${-h / 2} ${w / 2},${-h / 2} ${w / 2},${h / 2} ${-w / 2 + 40},${h / 2} ${-w / 2},0`}
        fill={fill}
      />
      <circle cx={-w / 2 + 34} cy={0} r={11} fill={PAL.cream} />
      <text x={-w / 2 + 70} y={-h / 2 + 76} fontFamily={DISPLAY} fontSize={50} fill={PAL.ink}>
        {title}
      </text>
      <text x={-w / 2 + 72} y={-h / 2 + 130} fontFamily={HAND} fontSize={42} fill={PAL.ink}>
        {sub}
      </text>
    </g>
  );
};
