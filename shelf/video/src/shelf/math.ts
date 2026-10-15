import { CamKey } from "./config";

export type V3 = [number, number, number];

// Cubic Hermite through keyframes with Catmull-Rom tangents on a non-uniform time axis.
// C1-continuous: no velocity jumps at the joints between camera segments; ends ease in/out.
export function hermite(keys: { f: number; v: number[] }[], frame: number): number[] {
  const n = keys.length;
  if (frame <= keys[0].f) return keys[0].v.slice();
  if (frame >= keys[n - 1].f) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && frame > keys[i + 1].f) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const dt = k1.f - k0.f;
  const tangent = (j: number) => {
    if (j === 0 || j === n - 1) return keys[j].v.map(() => 0);
    const a = keys[j - 1];
    const b = keys[j + 1];
    return keys[j].v.map((_, c) => (b.v[c] - a.v[c]) / (b.f - a.f));
  };
  const m0 = tangent(i);
  const m1 = tangent(i + 1);
  const t = (frame - k0.f) / dt;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return k0.v.map((v0, c) => h00 * v0 + h10 * dt * m0[c] + h01 * k1.v[c] + h11 * dt * m1[c]);
}

export function cameraAt(keys: CamKey[], frame: number) {
  const ks = keys.map((k) => ({
    f: k.f,
    v: [...k.pos, ...k.target, k.fov ?? 30, k.roll ?? 0],
  }));
  const v = hermite(ks, frame);
  return {
    pos: [v[0], v[1], v[2]] as V3,
    target: [v[3], v[4], v[5]] as V3,
    fov: v[6],
    roll: v[7],
  };
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Deterministic PRNG (mulberry32)
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
