import React from "react";
import { Bike, Chainring, G, Wheel } from "../paper/Bike";
import { HAND, PAL, Stage, STEP, Tag, backOut, clamp01, cutPolygon, jitter, usePaperFrame } from "../paper/paper";

const SHOT = 100; // three close-ups, 100 frames each
const SLIDE = STEP * 4;

const ShotNumber: React.FC<{ n: string; f: number }> = ({ n, f }) => (
  <g transform="translate(120 140) rotate(-5)" opacity={clamp01(f / 8)}>
    <text fontFamily={HAND} fontSize={64} fill={PAL.ink}>
      {n}
    </text>
  </g>
);

/** Shot A: the drivetrain, chain links marching round a giant chainring. */
const DrivetrainShot: React.FC<{ f: number }> = ({ f }) => {
  const cx = 640;
  const cy = 560;
  const R = 330;
  const ringAngle = f * 1.2;
  const pathR = R * 0.95;
  const straight = 1500;
  const arc = Math.PI * pathR;
  const loop = straight * 2 + arc;
  const pitch = 60;
  const shift = ((ringAngle * Math.PI) / 180) * pathR;
  const links = Math.ceil(loop / pitch);
  const pos = (s: number) => {
    const u = ((s % loop) + loop) % loop;
    if (u < straight) return { x: cx + u, y: cy - pathR, a: 0 };
    if (u < straight * 2) return { x: cx + straight - (u - straight), y: cy + pathR, a: 180 };
    const t = (u - straight * 2) / pathR; // radians round the back of the ring
    const ang = Math.PI / 2 + t;
    return { x: cx + Math.cos(ang) * pathR, y: cy + Math.sin(ang) * pathR, a: (ang * 180) / Math.PI + 90 };
  };
  return (
    <g>
      <rect x={0} y={0} width={1920} height={1080} fill={PAL.coral} />
      <g filter="url(#paper)">
        <polygon points={cutPolygon(cx, cy, 470, 48, "ringbg", 0.02)} fill={PAL.coralDark} />
      </g>
      <g filter="url(#lift)">
        <Chainring cx={cx} cy={cy} r={R} angle={ringAngle} />
      </g>
      <g filter="url(#paper)">
        {Array.from({ length: links }).map((_, i) => {
          const p = pos(i * pitch + shift);
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}>
              <rect x={-33} y={-17} width={66} height={34} rx={17} fill={i % 2 ? PAL.charcoal : PAL.ink} />
              <circle cx={-16} r={7} fill={PAL.steel} />
              <circle cx={16} r={7} fill={PAL.steel} />
            </g>
          );
        })}
      </g>
      <ShotNumber n="detail 01" f={f} />
      <Tag x={1380} y={560} w={620} title="12 SPEEDS" sub="shifts like turning a page." fill={PAL.white} rot={-5} show={(f - 16) / 20} />
    </g>
  );
};

/** Shot B: a wheel so close it fills the frame. */
const WheelShot: React.FC<{ f: number }> = ({ f }) => {
  const s = 900 / 108;
  return (
    <g>
      <rect x={0} y={0} width={1920} height={1080} fill={PAL.teal} />
      <g filter="url(#paper)">
        {Array.from({ length: 7 }).map((_, i) => (
          <rect key={i} x={-100} y={140 + i * 130} width={2200} height={34} fill={PAL.tealDark} transform={`rotate(-8 960 540) translate(${-((f * 6 + i * 90) % 400)} 0)`} />
        ))}
      </g>
      <g transform={`translate(1380 1180) scale(${s})`} filter="url(#lift)">
        <Wheel cx={0} cy={0} r={108} angle={f * 0.9} accent={PAL.mustard} spokes={16} />
      </g>
      <ShotNumber n="detail 02" f={f} />
      <Tag x={560} y={380} w={640} title="GRIPPY TREAD" sub="rain, gravel, cobbles." fill={PAL.mustard} rot={4} show={(f - 16) / 20} />
    </g>
  );
};

/** Shot C: a slow pan along the frame — saddle stitching to the head badge. */
const FrameShot: React.FC<{ f: number }> = ({ f }) => {
  const S = 3.8;
  const pan = 1 - Math.pow(1 - clamp01(f / SHOT), 2);
  const fx = 70 + pan * 180; // bike-space x the camera looks at
  const fy = -150;
  return (
    <g>
      <rect x={0} y={0} width={1920} height={1080} fill={PAL.sky} />
      <g filter="url(#paper)">
        <polygon points={cutPolygon(1300, 620, 520, 40, "fbg", 0.03)} fill={PAL.skyDeep} />
      </g>
      <g transform={`translate(${960 - fx * S + jitter("fp", f, 1)} ${620 - fy * S}) scale(${S})`}>
        <Bike wheelAngle={f * 0.6} crankAngle={f * 0.3} />
        {/* brazing sparks: tiny paper stars flicker at the joints */}
        {[G.stTop, G.htTop, G.htBot, G.stTop, G.htTop].map((j, i) => {
          const on = Math.floor(f / (STEP * 2) + i) % 3 === 0;
          const a = (i * 137 * Math.PI) / 180;
          return on ? (
            <polygon
              key={i}
              points={cutPolygon(0, 0, 4, 8, `spk${i}`, 0.6)}
              fill={PAL.white}
              transform={`translate(${j.x + Math.cos(a) * 18} ${j.y + Math.sin(a) * 18}) rotate(${i * 40})`}
              filter="url(#paper)"
            />
          ) : null;
        })}
      </g>
      <ShotNumber n="detail 03" f={f} />
      <Tag x={1400} y={250} w={700} title="HAND-BRAZED" sub="steel, light as a folded sheet." fill={PAL.white} rot={-3} show={(f - 16) / 20} />
    </g>
  );
};

const SHOTS = [DrivetrainShot, WheelShot, FrameShot];

export const DetailsScene: React.FC = () => {
  const f = usePaperFrame();
  const current = Math.min(SHOTS.length - 1, Math.floor(f / SHOT));
  return (
    <Stage bg={PAL.coral}>
      {SHOTS.map((Shot, i) => {
        if (i > current || i < current - 1) return null;
        const local = f - i * SHOT;
        const slide = i === 0 ? 1 : backOut(local / SLIDE, 1.1);
        if (i === current - 1 && local - SHOT >= SLIDE) return null;
        return (
          <g key={i} transform={`translate(${(1 - slide) * 1980} 0) rotate(${(1 - slide) * 4} 960 540)`} filter={slide < 1 ? "url(#lift)" : undefined}>
            <Shot f={local} />
          </g>
        );
      })}
    </Stage>
  );
};
