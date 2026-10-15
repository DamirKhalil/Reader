import React from "react";
import { random } from "remotion";
import { RiderOnBike, Wheel } from "../paper/Bike";
import { ChipText, DISPLAY, HAND, PAL, Stage, STEP, backOut, clamp01, cutPolygon, jitter, tornEdge, usePaperFrame } from "../paper/paper";

const Sunburst: React.FC<{ f: number }> = ({ f }) => (
  <g transform={`translate(560 760) rotate(${f * 0.08})`}>
    {Array.from({ length: 24 }).map((_, i) => (
      <polygon key={i} points="0,0 -170,-2400 170,-2400" fill={i % 2 ? PAL.cream : "#f7dfc4"} transform={`rotate(${i * 15})`} />
    ))}
  </g>
);

const Confetti: React.FC<{ f: number }> = ({ f }) => {
  const colors = [PAL.coral, PAL.mustard, PAL.teal, PAL.pink, PAL.sage, PAL.violet];
  return (
    <g>
      {Array.from({ length: 46 }).map((_, i) => {
        const start = 40 + random(`cf-s${i}`) * 100;
        const t = f - start;
        if (t < 0) return null;
        const x = random(`cf-x${i}`) * 1920 + Math.sin(t / 18 + i) * 26;
        const y = -40 + t * (3 + random(`cf-v${i}`) * 3);
        if (y > 1140) return null;
        const flip = Math.abs(Math.cos(t / 10 + i)); // card turning edge-on
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${t * 3 + i * 40}) scale(1 ${0.25 + 0.75 * flip})`} filter="url(#paper)">
            <rect x={-12} y={-7} width={24} height={14} fill={colors[i % colors.length]} />
          </g>
        );
      })}
    </g>
  );
};

export const FinaleScene: React.FC = () => {
  const f = usePaperFrame();

  // ride in from the left and brake
  const arrive = clamp01(f / 56);
  const ease = 1 - Math.pow(1 - arrive, 3);
  const S = 1.3;
  const stopX = 250;
  const bx = -700 + (stopX + 700) * ease;
  const dist = (bx + 700) / S;
  const wheelAngle = (dist / 108) * (180 / Math.PI);
  const crankAngle = wheelAngle / 2.6;
  const groundY = 900;
  const lean = arrive < 1 ? 0 : -Math.sin(clamp01((f - 56) / (STEP * 4)) * Math.PI) * 3; // little brake nod

  const logoT = (f - 150) / 24;

  return (
    <Stage bg={PAL.cream}>
      <Sunburst f={f} />

      <g filter="url(#paper)">
        <polygon points={tornEdge(-20, 1940, groundY, 1100, "fground", 50, 10)} fill={PAL.teal} />
        <polygon points={tornEdge(-20, 1940, groundY + 70, 1100, "fground2", 40, 12)} fill={PAL.tealDark} />
      </g>

      <g transform={`translate(${bx + jitter("fbx", f, 1)} ${groundY - 108 * S}) rotate(${lean} 155 108) scale(${S})`}>
        <ellipse cx={155} cy={112} rx={250} ry={10} fill={PAL.ink} opacity={0.3} />
        <RiderOnBike wheelAngle={wheelAngle} crankAngle={crankAngle} bob={0} look={{ shirt: PAL.coral, pants: PAL.violetDark, helmet: PAL.mustard, skin: "#8d5a3b", hair: "#1e1512", shoe: PAL.teal }} frameColor={PAL.teal} accent={PAL.coral} />
      </g>

      <ChipText text="GET OUT" x={1360} y={300} size={120} start={60} f={f} colors={[PAL.mustard, PAL.white, PAL.coral]} seed="go" every={STEP} />
      <ChipText text="AND RIDE." x={1360} y={460} size={120} start={60 + 7 * STEP} f={f} colors={[PAL.teal, PAL.white, PAL.mustard]} seed="ar" every={STEP} ink={PAL.ink} />

      {/* brand lockup */}
      {logoT > 0 ? (
        <g transform={`translate(1360 680) scale(${backOut(logoT, 1.8)}) rotate(${-2 + jitter("logo", f, 0.4)})`}>
          <g filter="url(#lift)">
            <polygon points="-380,-80 380,-84 392,78 -372,84" fill={PAL.ink} />
          </g>
          <g transform="translate(-300 0) scale(0.6)" filter="url(#paper)">
            <Wheel cx={0} cy={0} r={108} angle={f * 2} accent={PAL.coral} />
          </g>
          <text x={-210} y={26} fontFamily={DISPLAY} fontSize={78} fill={PAL.cream}>
            FOLDWORKS
          </text>
        </g>
      ) : null}
      <g opacity={clamp01((f - 180) / 10)} transform="translate(1360 820) rotate(-3)">
        <text fontFamily={HAND} fontSize={54} fill={PAL.ink} textAnchor="middle">
          bicycles, cut by hand.
        </text>
      </g>

      {/* a few large leftover scraps in the corners keep the set feeling handmade */}
      {[
        [80, 80, PAL.mustard],
        [1840, 1010, PAL.coral],
        [1860, 70, PAL.teal],
      ].map(([x, y, c], i) => (
        <polygon key={i} points={cutPolygon(x as number, y as number, 70, 6, `corner${i}`, 0.3)} fill={c as string} filter="url(#paper)" />
      ))}

      <Confetti f={f} />
    </Stage>
  );
};
