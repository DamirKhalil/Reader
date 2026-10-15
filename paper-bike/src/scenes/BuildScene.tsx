import React from "react";
import { random } from "remotion";
import { Bike, PartName, PartPose } from "../paper/Bike";
import { ChipText, HAND, PAL, Stage, STEP, backOut, clamp01, cutPolygon, jitter, usePaperFrame } from "../paper/paper";

// Order the pieces land in, when (frame), and where each one flies in from.
const PIECES: { name: PartName; at: number; from: [number, number]; rot: number }[] = [
  { name: "rearWheel", at: 16, from: [-900, 0], rot: -540 },
  { name: "frontWheel", at: 36, from: [900, 0], rot: 540 },
  { name: "frame", at: 60, from: [40, -700], rot: -24 },
  { name: "stays", at: 80, from: [-320, -520], rot: 30 },
  { name: "fork", at: 98, from: [380, -560], rot: 28 },
  { name: "crank", at: 116, from: [0, 520], rot: -200 },
  { name: "chain", at: 132, from: [-420, 420], rot: -14 },
  { name: "saddle", at: 148, from: [-240, -620], rot: -40 },
  { name: "bars", at: 162, from: [420, -560], rot: 36 },
];

const LAND = STEP * 6; // each piece takes six held poses to settle

const Scrap: React.FC<{ i: number; f: number }> = ({ i, f }) => {
  const x = random(`scrap-x-${i}`) * 1920;
  const y = random(`scrap-y-${i}`) > 0.5 ? 60 + random(`scrap-yy-${i}`) * 140 : 900 + random(`scrap-yy-${i}`) * 140;
  const colors = [PAL.coral, PAL.mustard, PAL.teal, PAL.sage, PAL.pink, PAL.white];
  return (
    <g transform={`translate(${x + jitter(`s${i}`, f, 1.2)} ${y}) rotate(${random(`scrap-r-${i}`) * 360})`} filter="url(#paper)">
      <polygon points={cutPolygon(0, 0, 18 + random(`scrap-s-${i}`) * 30, 5, `scrap-${i}`, 0.35)} fill={colors[i % colors.length]} />
    </g>
  );
};

export const BuildScene: React.FC = () => {
  const f = usePaperFrame();

  const parts: Partial<Record<PartName, PartPose>> = {};
  for (const p of PIECES) {
    const t = (f - p.at) / LAND;
    if (t < 0) {
      parts[p.name] = { dx: 0, dy: 0, rot: 0, scale: 1, lifted: false, hidden: true };
      continue;
    }
    const e = backOut(t, 1.3);
    const settled = t >= 1;
    parts[p.name] = {
      dx: p.from[0] * (1 - e) + (settled ? 0 : jitter(`${p.name}x`, f, 2)),
      dy: p.from[1] * (1 - e),
      rot: p.rot * (1 - e),
      scale: settled ? 1 : 1.06 - 0.06 * clamp01(t),
      lifted: !settled,
    };
  }

  // the finished bike gives a little celebratory hop
  const done = PIECES[PIECES.length - 1].at + LAND;
  const hopT = (f - done - 8) / (STEP * 5);
  const hop = hopT > 0 && hopT < 1 ? -Math.sin(hopT * Math.PI) * 36 : 0;
  const rollT = clamp01((f - done - 60) / 120);
  const roll = rollT * rollT * 220; // nudges forward as the scene hands off to the ride
  const wheelAngle = (roll / 108) * (180 / Math.PI);

  const S = 1.95;
  const bx = 960 - 155 * S + roll;
  const by = 640 + hop;

  // shadow on the board under the bike
  const shadowW = 560 * (1 - Math.abs(hop) / 200);

  return (
    <Stage bg={PAL.cream}>
      {/* cutting-board backdrop: a kraft sheet with taped corners */}
      <g filter="url(#paper)">
        <polygon points="120,90 1800,70 1820,1000 100,1012" fill={PAL.kraft} />
      </g>
      {/* grid lines drawn on the mat */}
      <g opacity={0.25} stroke={PAL.kraftDark} strokeWidth={2}>
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`v${i}`} x1={200 + i * 100} y1={110} x2={200 + i * 100} y2={990} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1={130} y1={160 + i * 100} x2={1800} y2={160 + i * 100} />
        ))}
      </g>
      {[
        [130, 92, -38],
        [1790, 74, 34],
        [110, 1006, 40],
        [1812, 994, -42],
      ].map(([x, y, r], i) => (
        <rect key={i} x={-50} y={-16} width={100} height={32} fill="#efe2b8" opacity={0.85} transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}

      {/* a big mustard sun-disc behind the build */}
      <g filter="url(#paper)" transform={`translate(960 520) rotate(${f * 0.05})`}>
        <polygon points={cutPolygon(0, 0, 360, 40, "disc", 0.025)} fill={PAL.mustard} />
        <polygon points={cutPolygon(0, 0, 300, 36, "disc2", 0.03)} fill="#f6c862" />
      </g>

      {Array.from({ length: 14 }).map((_, i) => (
        <Scrap key={i} i={i} f={f} />
      ))}

      {/* contact shadow cut from grey tissue */}
      <ellipse cx={bx + 155 * S} cy={640 + 112 * S} rx={shadowW} ry={22} fill={PAL.kraftDark} opacity={parts.frontWheel?.hidden ? 0 : 0.55} />

      <g transform={`translate(${bx} ${by}) scale(${S})`}>
        <Bike
          wheelAngle={wheelAngle}
          crankAngle={-30 + roll * 0.8}
          parts={parts}
        />
      </g>

      {/* handwritten pencil notes */}
      <g opacity={clamp01((f - 40) / 12)} transform={`translate(170 330) rotate(-6)`}>
        <text fontFamily={HAND} fontSize={46} fill={PAL.ink}>
          no. 01 — cut, fold, glue
        </text>
      </g>
      <ChipText text="PIECE BY PIECE" x={960} y={170} size={74} start={192} f={f} colors={[PAL.white, PAL.coral, PAL.teal]} seed="pbp" every={STEP} />
      <g opacity={clamp01((f - 250) / 12)} transform={`translate(960 975)`}>
        <text fontFamily={HAND} fontSize={52} fill={PAL.ink} textAnchor="middle">
          every bike starts as a flat sheet.
        </text>
      </g>
    </Stage>
  );
};
