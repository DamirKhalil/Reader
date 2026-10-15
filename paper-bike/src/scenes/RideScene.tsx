import React from "react";
import { random } from "remotion";
import { RiderOnBike } from "../paper/Bike";
import { DISPLAY, HAND, PAL, Stage, STEP, backOut, clamp01, cutPolygon, jitter, tornEdge, usePaperFrame } from "../paper/paper";

const SPEED = 9; // ground speed in design px per frame

/** Repeats a band of scenery across the frame and scrolls it. */
const Scroll: React.FC<{ f: number; speed: number; length: number; children: React.ReactNode }> = ({ f, speed, length, children }) => {
  const off = -((f * speed) % length);
  return (
    <g>
      <g transform={`translate(${off} 0)`}>{children}</g>
      <g transform={`translate(${off + length} 0)`}>{children}</g>
    </g>
  );
};

const Mountains: React.FC = () => (
  <g filter="url(#paper)">
    {Array.from({ length: 6 }).map((_, i) => {
      const x = i * 400 + random(`mx${i}`) * 80;
      const h = 260 + random(`mh${i}`) * 160;
      const base = 720;
      const w = 300 + random(`mw${i}`) * 140;
      const peak = { x: x + w * 0.5, y: base - h };
      return (
        <g key={i}>
          <polygon points={`${x - w * 0.2},${base} ${peak.x},${peak.y} ${x + w * 1.2},${base}`} fill={i % 2 ? PAL.violet : PAL.violetDark} />
          <polygon
            points={`${peak.x - h * 0.18},${peak.y + h * 0.22} ${peak.x},${peak.y} ${peak.x + h * 0.2},${peak.y + h * 0.24} ${peak.x + h * 0.08},${peak.y + h * 0.18} ${peak.x - 4},${peak.y + h * 0.27}`}
            fill={PAL.white}
          />
        </g>
      );
    })}
  </g>
);

const Hills: React.FC<{ seed: string; base: number; color: string; len: number; n: number; rMin: number; rMax: number }> = ({
  seed,
  base,
  color,
  len,
  n,
  rMin,
  rMax,
}) => (
  <g filter="url(#paper)">
    {Array.from({ length: n }).map((_, i) => {
      const r = rMin + random(`${seed}r${i}`) * (rMax - rMin);
      const cx = (i / n) * len + random(`${seed}x${i}`) * 60;
      return <ellipse key={i} cx={cx} cy={base} rx={r * 1.6} ry={r} fill={color} />;
    })}
    <rect x={-20} y={base} width={len + 40} height={400} fill={color} />
  </g>
);

const Trees: React.FC<{ seed: string; base: number; len: number; n: number; scale: number }> = ({ seed, base, len, n, scale }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => {
      const x = (i / n) * len + random(`${seed}x${i}`) * 90;
      const s = scale * (0.8 + random(`${seed}s${i}`) * 0.4);
      const pine = random(`${seed}k${i}`) > 0.45;
      return (
        <g key={i} transform={`translate(${x} ${base}) scale(${s})`} filter="url(#paper)">
          <rect x={-7} y={-40} width={14} height={44} fill={PAL.kraftDark} />
          {pine ? (
            <>
              <polygon points="-60,-30 0,-120 60,-30" fill={PAL.greenDark} />
              <polygon points="-48,-80 0,-170 48,-80" fill={PAL.green} />
              <polygon points="-34,-130 0,-210 34,-130" fill={PAL.greenDark} />
            </>
          ) : (
            <>
              <polygon points={cutPolygon(0, -110, 70, 11, `${seed}t${i}`, 0.12)} fill={PAL.green} />
              <polygon points={cutPolygon(-14, -122, 34, 8, `${seed}u${i}`, 0.15)} fill={PAL.sage} />
            </>
          )}
        </g>
      );
    })}
  </g>
);

const Cloud: React.FC<{ x: number; y: number; s: number; f: number; i: number }> = ({ x, y, s, f, i }) => {
  const sway = Math.sin(f / 40 + i) * 3;
  return (
    <g transform={`translate(${x} ${y + jitter(`cl${i}`, f, 1.5)}) rotate(${sway}) scale(${s})`}>
      <line x1={-60} y1={-40} x2={-60} y2={-900} stroke={PAL.ink} strokeWidth={1.5} opacity={0.5} />
      <line x1={70} y1={-40} x2={70} y2={-900} stroke={PAL.ink} strokeWidth={1.5} opacity={0.5} />
      <g filter="url(#lift)">
        <path d="M -150 30 Q -160 -30 -100 -30 Q -90 -90 -20 -80 Q 30 -130 90 -80 Q 160 -80 150 -20 Q 190 10 150 30 Z" fill={PAL.white} />
        <path d="M -120 30 Q -110 0 -60 6 Q 0 -20 60 4 Q 120 -6 130 30 Z" fill="#e6eef0" />
      </g>
    </g>
  );
};

const Bird: React.FC<{ x: number; y: number; f: number; i: number }> = ({ x, y, f, i }) => {
  const up = Math.floor(f / (STEP * 2) + i) % 2 === 0;
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#paper)">
      <polygon points={up ? "-26,-16 0,4 26,-16 0,-2" : "-26,10 0,0 26,10 0,8"} fill={PAL.ink} />
    </g>
  );
};

export const RideScene: React.FC = () => {
  const f = usePaperFrame();

  // camera: a gentle push-out at the top of the shot
  const zoom = 1.12 - 0.12 * backOut(f / 90, 0.6);

  const S = 1.25;
  const bikeX = 620;
  const roadY = 880;
  const axleY = roadY - 108 * S;
  const wheelAngle = ((f * SPEED) / (108 * S)) * (180 / Math.PI);
  const crankAngle = wheelAngle / 2.6;
  const bob = Math.sin((crankAngle * Math.PI) / 90) * 4;

  const bannerT = (f - 110) / 50;
  const bannerDrop = -420 * (1 - backOut(bannerT, 1.4));
  const bannerSwing = bannerT > 0 ? Math.sin(bannerT * 4.5) * 4 * Math.exp(-bannerT * 1.2) : 0;

  return (
    <Stage bg={PAL.sky}>
      <g transform={`translate(960 540) scale(${zoom}) translate(-960 -540)`}>
        {/* sky bands */}
        <rect x={-200} y={420} width={2400} height={400} fill={PAL.skyDeep} opacity={0.5} />

        {/* sun on a stick with turning rays */}
        <g transform={`translate(1560 230)`}>
          <g transform={`rotate(${f * 0.4})`} filter="url(#paper)">
            {Array.from({ length: 12 }).map((_, i) => (
              <polygon key={i} points="-18,-120 18,-120 0,-175" fill={PAL.mustardDark} transform={`rotate(${i * 30})`} />
            ))}
          </g>
          <g filter="url(#lift)">
            <polygon points={cutPolygon(0, 0, 110, 30, "sun", 0.03)} fill={PAL.mustard} />
            <circle cx={-30} cy={-24} r={40} fill="#f7cc6b" />
          </g>
        </g>

        <Scroll f={f} speed={0.5} length={2400}>
          <Cloud x={300} y={170} s={0.9} f={f} i={0} />
          <Cloud x={1150} y={250} s={0.7} f={f} i={1} />
          <Cloud x={1900} y={150} s={1.0} f={f} i={2} />
        </Scroll>

        {/* birds cross slowly the other way */}
        {[0, 1, 2].map((i) => (
          <Bird key={i} x={200 + f * 1.2 + i * 70} y={330 + i * 22 + Math.sin(f / 30 + i) * 6} f={f} i={i} />
        ))}

        <Scroll f={f} speed={0.9} length={2400}>
          <Mountains />
        </Scroll>
        <Scroll f={f} speed={1.8} length={2400}>
          <Hills seed="h1" base={760} color={PAL.sage} len={2400} n={7} rMin={80} rMax={130} />
          <Trees seed="t1" base={740} len={2400} n={9} scale={0.55} />
        </Scroll>
        <Scroll f={f} speed={3.6} length={2400}>
          <Hills seed="h2" base={830} color={PAL.green} len={2400} n={6} rMin={60} rMax={90} />
          <Trees seed="t2" base={810} len={2400} n={6} scale={0.9} />
        </Scroll>

        {/* road: a torn strip of charcoal card */}
        <g filter="url(#paper)">
          <polygon points={tornEdge(-200, 2120, 860, 1100, "road", 60, 6)} fill={PAL.charcoal} />
        </g>
        <Scroll f={f} speed={SPEED} length={2400}>
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={`l${i}`} x={i * 240} y={960} width={120} height={12} fill={PAL.white} transform={`rotate(${(random(`ln${i}`) - 0.5) * 2} ${i * 240} 960)`} />
          ))}
        </Scroll>

        {/* bike + rider */}
        <g transform={`translate(${bikeX + jitter("bx", f, 1.2)} ${axleY + jitter("by", f, 0.8)}) scale(${S})`}>
          <ellipse cx={155} cy={112} rx={240} ry={10} fill={PAL.ink} opacity={0.35} />
          <RiderOnBike wheelAngle={wheelAngle} crankAngle={crankAngle} bob={bob} />
        </g>

        {/* speed scraps flying off the back wheel */}
        {Array.from({ length: 6 }).map((_, i) => {
          const life = ((f / STEP + i * 3) % 18) / 18;
          return (
            <polygon
              key={i}
              points={cutPolygon(bikeX - 40 - life * 380, roadY - 14 - life * 60 - i * 6, 10 * (1 - life) + 3, 5, `sp${i}`, 0.3)}
              fill={i % 2 ? PAL.kraft : PAL.cream}
              filter="url(#paper)"
            />
          );
        })}

        {/* foreground grass whips past */}
        <Scroll f={f} speed={SPEED * 1.6} length={2400}>
          <g filter="url(#paper)">
            <polygon points={tornEdge(-10, 2410, 1030, 1100, "grass", 120, 26)} fill={PAL.greenDark} />
            {Array.from({ length: 14 }).map((_, i) => {
              const x = i * 172 + random(`fl${i}`) * 60;
              return (
                <g key={i} transform={`translate(${x} ${1000 + random(`fy${i}`) * 30})`}>
                  <rect x={-3} y={0} width={6} height={60} fill={PAL.green} />
                  <polygon points={cutPolygon(0, 0, 18, 6, `fp${i}`, 0.25)} fill={[PAL.coral, PAL.mustard, PAL.pink, PAL.white][i % 4]} />
                  <circle r={6} fill={PAL.mustardDark} />
                </g>
              );
            })}
          </g>
        </Scroll>
      </g>

      {/* hanging banner */}
      {bannerT > 0 ? (
        <g transform={`translate(960 ${150 + bannerDrop}) rotate(${bannerSwing})`}>
          <line x1={-430} y1={-60} x2={-430} y2={-700} stroke={PAL.ink} strokeWidth={2} opacity={0.6} />
          <line x1={430} y1={-60} x2={430} y2={-700} stroke={PAL.ink} strokeWidth={2} opacity={0.6} />
          <g filter="url(#lift)">
            <polygon points="-560,-70 560,-70 520,0 560,70 -560,70 -520,0" fill={PAL.coral} />
            <polygon points="-540,-56 540,-56 506,0 540,56 -540,56 -506,0" fill={PAL.white} />
          </g>
          <text x={0} y={22} fontFamily={DISPLAY} fontSize={62} fill={PAL.ink} textAnchor="middle">
            MADE FOR THE LONG WAY
          </text>
          <g opacity={clamp01((f - 200) / 10)} transform="translate(300 118) rotate(-4)">
            <text fontFamily={HAND} fontSize={54} fill={PAL.ink} textAnchor="middle">
              …round.
            </text>
          </g>
        </g>
      ) : null}
    </Stage>
  );
};
