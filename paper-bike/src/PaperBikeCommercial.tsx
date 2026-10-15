import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { BuildScene } from "./scenes/BuildScene";
import { RideScene } from "./scenes/RideScene";
import { DetailsScene } from "./scenes/DetailsScene";
import { FinaleScene } from "./scenes/FinaleScene";
import { random } from "remotion";
import { PAL, PaperDefs, STEP, VH, VW, easeInOut, usePaperFrame } from "./paper/paper";

/** A 2300px-wide sheet with torn left and right edges. */
const sheet = (seed: string, inset = 0) => {
  const n = 30;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const y = -40 + (i / n) * 1160;
    left.push(`${(inset + (random(`${seed}l${i}`) - 0.5) * 44).toFixed(1)},${y.toFixed(1)}`);
    right.unshift(`${(2300 - inset + (random(`${seed}r${i}`) - 0.5) * 44).toFixed(1)},${y.toFixed(1)}`);
  }
  return [...left, ...right].join(" ");
};

export const SCENES = { build: 300, ride: 360, details: 300, finale: 240 };
export const TOTAL = SCENES.build + SCENES.ride + SCENES.details + SCENES.finale;

const CUTS = [
  { at: SCENES.build, color: PAL.teal },
  { at: SCENES.build + SCENES.ride, color: PAL.mustard },
  { at: SCENES.build + SCENES.ride + SCENES.details, color: PAL.coral },
];
const WIPE = STEP * 8;

/** A torn sheet of card swept across the lens to hide each cut. */
const PaperWipes: React.FC = () => {
  const f = usePaperFrame();
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <PaperDefs />
      {CUTS.map((c, i) => {
        const t = (f - (c.at - WIPE / 2)) / WIPE;
        if (t < 0 || t > 1) return null;
        const left = 1980 - easeInOut(t) * 4320;
        return (
          <g key={i} transform={`translate(${left} 0)`} filter="url(#lift)">
            <polygon points={sheet(`wipe${i}`)} fill={c.color} />
            <polygon points={sheet(`wipe-in${i}`, 60)} fill={PAL.cream} opacity={0.12} />
          </g>
        );
      })}
    </svg>
  );
};

export const PaperBikeCommercial: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: PAL.cream }}>
    <Series>
      <Series.Sequence name="1 · The Build" durationInFrames={300}>
        <BuildScene />
      </Series.Sequence>
      <Series.Sequence name="2 · The Ride" durationInFrames={360}>
        <RideScene />
      </Series.Sequence>
      <Series.Sequence name="3 · The Details" durationInFrames={300}>
        <DetailsScene />
      </Series.Sequence>
      <Series.Sequence name="4 · Get Out and Ride" durationInFrames={240}>
        <FinaleScene />
      </Series.Sequence>
    </Series>
    <PaperWipes />
  </AbsoluteFill>
);
