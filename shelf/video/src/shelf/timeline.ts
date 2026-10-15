// Frame -> state of the light and other global parameters. Pure functions of the frame.
import { Easing } from "remotion";
import { ASPECT, LIGHT, TIMELINE } from "./config";
import { clamp01, lerp, smoothstep, V3 } from "./math";

const arcEase = Easing.bezier(0.45, 0.05, 0.35, 1);

export function lightAt(frame: number) {
  const [a, b] = TIMELINE.e1Light;
  const t = clamp01((frame - a) / (b - a));
  const e = arcEase(t);
  // E1: a warm point light sweeps left -> right on an arc in front of the shelf
  const x0 = -0.62 * ASPECT;
  const x1 = 0.36 * ASPECT;
  let pos: V3 = [lerp(x0, x1, e), -0.12 + 0.36 * Math.sin(Math.PI * Math.min(1, e * 1.05)), LIGHT.arcZ];
  // after E1 the light keeps drifting very slowly so nothing looks frozen
  if (frame > b) {
    const k = (frame - b) / 900;
    pos = [x1 - 0.12 * Math.sin(k * Math.PI), pos[1] + 0.05 * Math.sin(k * 2.1), LIGHT.arcZ + 0.08 * k];
  }
  const fadeIn = smoothstep(0, 18, frame);
  const intensity = LIGHT.intensity * fadeIn * lerp(1, 0.82, smoothstep(b - 20, b + 40, frame));
  // ambient is specified perceptually (0.05 = almost black); shaders work in linear light
  const ambientPerceptual = lerp(LIGHT.ambientStart, LIGHT.ambientEnd, smoothstep(a + 25, b, frame));
  const ambient = Math.pow(ambientPerceptual, 2.2);
  // the spot opens up after the sweep so the whole shelf stays readable for the next episodes
  const radius = lerp(LIGHT.radius, LIGHT.radiusAfter, smoothstep(b - 30, b + 60, frame));
  return { pos, intensity, ambient, radius };
}
