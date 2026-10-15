// Everything tweakable lives here: timeline, camera paths, light, wave, look.
// World units: the shelf photo is a plane 1.0 high and ASPECT wide, centred at the origin, facing +Z.

export const FPS = 30;
export const ASPECT = 2560 / 1732;

export const TIMELINE = {
  e1Light: [0, 120],
  e2Parallax: [120, 300],
  e3Wave: [300, 480],
  e4King: [480, 570],
  e4Kafka: [570, 630],
  e4BustKerouac: [630, 720],
  e5Droste: [720, 960],
  e6Final: [960, 1050],
} as const;
export const DURATION = 1050;

export type CamKey = {
  f: number; // frame
  pos: [number, number, number];
  target: [number, number, number];
  fov?: number; // vertical, degrees
  roll?: number; // degrees
};

// Distance at which the full shelf width fills a 16:9 frame with fov 30.
const FOV = 30;
const fitDist = (frameAspect: number, widthFrac: number) =>
  (ASPECT * widthFrac) / (2 * Math.tan(((FOV / 2) * Math.PI) / 180) * frameAspect);
export const D16 = fitDist(16 / 9, 0.97);
export const D9 = fitDist(9 / 16, 0.62); // vertical: about 60% of the width visible

export const CAMERA_16x9: CamKey[] = [
  { f: 0, pos: [-0.015, 0.01, D16 * 1.015], target: [-0.01, 0.01, 0], fov: FOV },
  { f: 120, pos: [0.0, 0.01, D16], target: [0.0, 0.01, 0], fov: FOV },
  // E2: dolly ~8%, slight x travel, 2.5 deg roll
  { f: 300, pos: [0.06, -0.012, D16 * 0.92], target: [0.05, -0.008, 0], fov: FOV, roll: 2.5 },
  { f: 480, pos: [0.04, -0.01, D16 * 0.93], target: [0.04, -0.01, 0], fov: FOV, roll: 0.5 },
];

export const CAMERA_9x16: CamKey[] = [
  { f: 0, pos: [-0.12, 0.18, D9 * 1.02], target: [-0.12, 0.17, 0], fov: FOV },
  { f: 120, pos: [-0.05, 0.12, D9], target: [-0.05, 0.11, 0], fov: FOV },
  { f: 300, pos: [0.06, -0.08, D9 * 0.92], target: [0.06, -0.08, 0], fov: FOV, roll: 2.0 },
  { f: 480, pos: [0.08, -0.12, D9 * 0.93], target: [0.08, -0.12, 0], fov: FOV },
];

export const LOOK = {
  depthScale: 0.045, // world-z of depth = 1 (frame front); keep small, it stretches textures
  normalStrength: 0.85,
  warm: [1.0, 0.706, 0.42] as [number, number, number], // #FFB46B ~2700K
  ambientColor: [0.92, 0.9, 0.95] as [number, number, number],
  specPower: 48,
  spec: 0.55,
  bloom: 0.6,
  vignette: 0.55,
  grain: 0.035,
  exposure: 1.0,
};

export const LIGHT = {
  ambientStart: 0.05,
  ambientEnd: 0.35,
  intensity: 2.1, // key light at its brightest
  radius: 0.36, // attenuation distance during the sweep
  radiusAfter: 0.62,
  arcZ: 0.3, // distance of the light in front of the shelf
};

export const WAVE = {
  start: TIMELINE.e3Wave[0] + 6,
  amplitude: 0.012, // world units (~1-1.5% of a cell's depth range after scaling)
  pulse: 26, // frames for one spine to go out and back
  sweep: 70, // frames for the wave to cross the shelf left -> right
  rowDelay: 22, // extra delay per row (top row first)
  brighten: 0.35,
};

export const DUST = {
  count: 480,
  seed: 7,
  box: [-0.8, -0.5, 0.04, 0.8, 0.5, 0.55] as const,
  size: 2.6,
};
