import React from "react";
import { PAL, Strip } from "./paper";

// Side-view geometry in bike units (rear axle at the origin, facing right).
export const G = {
  R: { x: 0, y: 0 },
  F: { x: 310, y: 0 },
  wheel: 108,
  BB: { x: 120, y: 12 },
  stTop: { x: 98, y: -150 },
  htTop: { x: 262, y: -150 },
  htBot: { x: 272, y: -102 },
  crank: 42,
  hip: { x: 95, y: -192 },
  shoulder: { x: 205, y: -292 },
  hands: { x: 292, y: -182 },
};

export type PartName =
  | "rearWheel"
  | "frontWheel"
  | "stays"
  | "frame"
  | "fork"
  | "crank"
  | "chain"
  | "saddle"
  | "bars";

export type PartPose = { dx: number; dy: number; rot: number; scale: number; lifted: boolean; hidden?: boolean };

export type BikeProps = {
  wheelAngle: number;
  crankAngle: number;
  frameColor?: string;
  accent?: string;
  parts?: Partial<Record<PartName, PartPose>>;
};

const pivots: Record<PartName, { x: number; y: number }> = {
  rearWheel: G.R,
  frontWheel: G.F,
  stays: { x: 60, y: -60 },
  frame: { x: 180, y: -80 },
  fork: { x: 290, y: -60 },
  crank: G.BB,
  chain: { x: 60, y: 6 },
  saddle: { x: 90, y: -186 },
  bars: { x: 275, y: -175 },
};

const Part: React.FC<{ name: PartName; pose?: PartPose; children: React.ReactNode }> = ({ name, pose, children }) => {
  if (pose?.hidden) return null;
  const p = pivots[name];
  const t = pose
    ? `translate(${pose.dx} ${pose.dy}) translate(${p.x} ${p.y}) rotate(${pose.rot}) scale(${pose.scale}) translate(${-p.x} ${-p.y})`
    : undefined;
  return (
    <g transform={t} filter={pose?.lifted ? "url(#lift)" : "url(#paper)"}>
      {children}
    </g>
  );
};

export const Wheel: React.FC<{ cx: number; cy: number; r: number; angle: number; accent: string; spokes?: number }> = ({
  cx,
  cy,
  r,
  angle,
  accent,
  spokes = 8,
}) => {
  const inner = r * 0.85;
  const rim = r * 0.79;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* tyre: an annulus cut from black card */}
      <path
        d={`M ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z M ${-inner} 0 a ${inner} ${inner} 0 1 1 ${2 * inner} 0 a ${inner} ${inner} 0 1 1 ${-2 * inner} 0 Z`}
        fill={PAL.ink}
        fillRule="evenodd"
      />
      <g transform={`rotate(${angle})`}>
        {/* tread notches */}
        {Array.from({ length: 24 }).map((_, i) => (
          <rect
            key={i}
            x={-3}
            y={-r - 1}
            width={6}
            height={8}
            fill={PAL.charcoal}
            transform={`rotate(${(i * 360) / 24})`}
          />
        ))}
        <path
          d={`M ${-inner} 0 a ${inner} ${inner} 0 1 0 ${2 * inner} 0 a ${inner} ${inner} 0 1 0 ${-2 * inner} 0 Z M ${-rim} 0 a ${rim} ${rim} 0 1 1 ${2 * rim} 0 a ${rim} ${rim} 0 1 1 ${-2 * rim} 0 Z`}
          fill={PAL.steel}
          fillRule="evenodd"
        />
        {/* one coloured rim segment so the spin reads frame to frame */}
        <path
          d={`M ${inner} 0 A ${inner} ${inner} 0 0 1 ${inner * Math.cos(0.7)} ${inner * Math.sin(0.7)} L ${rim * Math.cos(0.7)} ${rim * Math.sin(0.7)} A ${rim} ${rim} 0 0 0 ${rim} 0 Z`}
          fill={accent}
        />
        {Array.from({ length: spokes }).map((_, i) => {
          const a = (i / spokes) * Math.PI * 2;
          return (
            <Strip
              key={i}
              x1={Math.cos(a) * r * 0.1}
              y1={Math.sin(a) * r * 0.1}
              x2={Math.cos(a) * rim}
              y2={Math.sin(a) * rim}
              w={Math.max(3, r * 0.035)}
              fill={PAL.white}
            />
          );
        })}
        <circle r={r * 0.14} fill={PAL.charcoal} />
        <circle r={r * 0.06} fill={accent} />
      </g>
    </g>
  );
};

export const Chainring: React.FC<{ cx: number; cy: number; r: number; angle: number; color?: string }> = ({
  cx,
  cy,
  r,
  angle,
  color = PAL.steel,
}) => {
  const teeth = 28;
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.88;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g transform={`rotate(${angle})`}>
        <polygon points={pts.join(" ")} fill={color} />
        {/* cut-out windows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <circle
            key={i}
            cx={Math.cos((i / 5) * Math.PI * 2) * r * 0.55}
            cy={Math.sin((i / 5) * Math.PI * 2) * r * 0.55}
            r={r * 0.2}
            fill={PAL.charcoal}
          />
        ))}
        <circle r={r * 0.28} fill={PAL.charcoal} />
      </g>
    </g>
  );
};

const crankEnd = (angleDeg: number, flip: number) => {
  const a = ((angleDeg + flip) * Math.PI) / 180;
  return { x: G.BB.x + Math.cos(a) * G.crank, y: G.BB.y + Math.sin(a) * G.crank };
};

export const pedalPositions = (crankAngle: number) => ({
  near: crankEnd(crankAngle, 0),
  far: crankEnd(crankAngle, 180),
});

export const Bike: React.FC<BikeProps> = ({ wheelAngle, crankAngle, frameColor = PAL.coral, accent = PAL.mustard, parts = {} }) => {
  const { near, far } = pedalPositions(crankAngle);
  return (
    <g>
      <Part name="rearWheel" pose={parts.rearWheel}>
        <Wheel cx={G.R.x} cy={G.R.y} r={G.wheel} angle={wheelAngle} accent={accent} />
      </Part>
      <Part name="frontWheel" pose={parts.frontWheel}>
        <Wheel cx={G.F.x} cy={G.F.y} r={G.wheel} angle={wheelAngle} accent={accent} />
      </Part>
      <Part name="chain" pose={parts.chain}>
        <Strip x1={G.R.x} y1={G.R.y - 16} x2={G.BB.x} y2={G.BB.y - 30} w={5} fill={PAL.charcoal} />
        <Strip x1={G.R.x} y1={G.R.y + 16} x2={G.BB.x} y2={G.BB.y + 30} w={5} fill={PAL.charcoal} />
        <circle cx={G.R.x} cy={G.R.y} r={18} fill={PAL.steel} />
      </Part>
      <Part name="stays" pose={parts.stays}>
        <Strip x1={G.stTop.x + 2} y1={G.stTop.y + 14} x2={G.R.x} y2={G.R.y} w={11} fill={frameColor} />
        <Strip x1={G.BB.x} y1={G.BB.y} x2={G.R.x} y2={G.R.y} w={12} fill={frameColor} />
        <circle cx={G.R.x} cy={G.R.y} r={9} fill={PAL.charcoal} />
      </Part>
      {/* far crank arm sits behind the frame */}
      <Part name="crank" pose={parts.crank}>
        <Strip x1={G.BB.x} y1={G.BB.y} x2={far.x} y2={far.y} w={9} fill={PAL.charcoal} />
        <rect x={far.x - 14} y={far.y - 4} width={28} height={8} fill={PAL.charcoal} />
      </Part>
      <Part name="frame" pose={parts.frame}>
        <Strip x1={G.BB.x} y1={G.BB.y} x2={G.stTop.x - 4} y2={G.stTop.y - 30} w={15} fill={frameColor} />
        <Strip x1={G.stTop.x} y1={G.stTop.y} x2={G.htTop.x} y2={G.htTop.y} w={15} fill={frameColor} />
        <Strip x1={G.BB.x} y1={G.BB.y} x2={G.htBot.x} y2={G.htBot.y} w={19} fill={frameColor} />
        <Strip x1={G.htTop.x - 2} y1={G.htTop.y - 6} x2={G.htBot.x + 2} y2={G.htBot.y + 6} w={22} fill={accent} />
        {/* decal on the down tube */}
        <g transform={`translate(${(G.BB.x + G.htBot.x) / 2} ${(G.BB.y + G.htBot.y) / 2}) rotate(${(Math.atan2(G.htBot.y - G.BB.y, G.htBot.x - G.BB.x) * 180) / Math.PI})`}>
          <rect x={-34} y={-5} width={68} height={10} fill={PAL.white} />
          <rect x={-34} y={-5} width={14} height={10} fill={accent} />
        </g>
        <circle cx={G.BB.x} cy={G.BB.y} r={13} fill={PAL.charcoal} />
      </Part>
      <Part name="fork" pose={parts.fork}>
        <path
          d={`M ${G.htBot.x - 6} ${G.htBot.y} Q ${G.htBot.x + 14} ${-40} ${G.F.x - 6} ${G.F.y} L ${G.F.x + 6} ${G.F.y} Q ${G.htBot.x + 28} ${-44} ${G.htBot.x + 8} ${G.htBot.y} Z`}
          fill={frameColor}
        />
        <circle cx={G.F.x} cy={G.F.y} r={9} fill={PAL.charcoal} />
      </Part>
      <Part name="saddle" pose={parts.saddle}>
        <Strip x1={G.stTop.x - 4} y1={G.stTop.y - 26} x2={G.stTop.x - 9} y2={-178} w={9} fill={PAL.steel} />
        <polygon points="52,-192 118,-196 132,-186 122,-178 70,-176 50,-182" fill={PAL.charcoal} />
        <polyline points="62,-186 120,-189" stroke={PAL.mustard} strokeWidth={2} strokeDasharray="5 4" fill="none" />
      </Part>
      <Part name="bars" pose={parts.bars}>
        <Strip x1={G.htTop.x} y1={G.htTop.y} x2={G.htTop.x - 4} y2={-174} w={11} fill={PAL.steel} />
        <path d="M 254 -180 L 296 -184 Q 318 -184 314 -164 L 306 -150 L 300 -153 L 304 -166 Q 306 -175 294 -175 L 256 -172 Z" fill={PAL.charcoal} />
        <rect x={286} y={-188} width={16} height={12} fill={accent} />
      </Part>
      {/* near crank + chainring in front of everything on the bike */}
      <Part name="crank" pose={parts.crank}>
        <Chainring cx={G.BB.x} cy={G.BB.y} r={32} angle={crankAngle} />
        <Strip x1={G.BB.x} y1={G.BB.y} x2={near.x} y2={near.y} w={10} fill={PAL.charcoal} />
        <circle cx={G.BB.x} cy={G.BB.y} r={7} fill={accent} />
        <rect x={near.x - 15} y={near.y - 5} width={30} height={10} fill={PAL.ink} />
      </Part>
    </g>
  );
};

// ---------- Rider ----------

const ik = (a: { x: number; y: number }, b: { x: number; y: number }, l1: number, l2: number, bendSign = 1) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5);
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const t = base - bendSign * ang;
  return { x: a.x + Math.cos(t) * l1, y: a.y + Math.sin(t) * l1 };
};

const Leg: React.FC<{ pedal: { x: number; y: number }; pants: string; shoe: string; skin: string }> = ({ pedal, pants, shoe }) => {
  const knee = ik(G.hip, pedal, 128, 124, 1);
  return (
    <g filter="url(#paper)">
      <Strip x1={G.hip.x} y1={G.hip.y} x2={knee.x} y2={knee.y} w={34} fill={pants} cap />
      <Strip x1={knee.x} y1={knee.y} x2={pedal.x} y2={pedal.y - 8} w={26} fill={pants} cap />
      <polygon
        points={`${pedal.x - 18},${pedal.y - 16} ${pedal.x + 30},${pedal.y - 12} ${pedal.x + 32},${pedal.y - 1} ${pedal.x - 20},${pedal.y - 1}`}
        fill={shoe}
      />
      <rect x={pedal.x - 20} y={pedal.y - 4} width={52} height={5} fill={PAL.white} />
    </g>
  );
};

const Arm: React.FC<{ sleeve: string; skin: string; dy: number }> = ({ sleeve, skin, dy }) => {
  const sh = { x: G.shoulder.x, y: G.shoulder.y + dy };
  const elbow = ik(sh, G.hands, 70, 72, -1);
  return (
    <g filter="url(#paper)">
      <Strip x1={sh.x} y1={sh.y} x2={elbow.x} y2={elbow.y} w={26} fill={sleeve} cap />
      <Strip x1={elbow.x} y1={elbow.y} x2={G.hands.x} y2={G.hands.y} w={20} fill={skin} cap />
      <circle cx={G.hands.x} cy={G.hands.y} r={13} fill={skin} />
    </g>
  );
};

export type RiderLook = { shirt: string; pants: string; helmet: string; skin: string; hair: string; shoe: string };

export const DEFAULT_LOOK: RiderLook = {
  shirt: PAL.mustard,
  pants: PAL.tealDark,
  helmet: PAL.teal,
  skin: "#c98b62",
  hair: "#3a2a22",
  shoe: PAL.coral,
};

export const RiderBack: React.FC<{ crankAngle: number; look?: RiderLook }> = ({ crankAngle, look = DEFAULT_LOOK }) => {
  const { far } = pedalPositions(crankAngle);
  // far limbs are a shade darker: they're a layer deeper in the set
  return (
    <g opacity={1}>
      <Leg pedal={far} pants={PAL.ink} shoe={PAL.coralDark} skin={look.skin} />
    </g>
  );
};

export const RiderFront: React.FC<{ crankAngle: number; bob: number; look?: RiderLook }> = ({ crankAngle, bob, look = DEFAULT_LOOK }) => {
  const { near } = pedalPositions(crankAngle);
  const sh = { x: G.shoulder.x, y: G.shoulder.y + bob };
  const head = { x: sh.x + 34, y: sh.y - 54 };
  return (
    <g>
      {/* torso */}
      <g filter="url(#paper)">
        <path
          d={`M ${G.hip.x - 26} ${G.hip.y + 10} L ${G.hip.x + 24} ${G.hip.y + 14} L ${sh.x + 22} ${sh.y + 18} Q ${sh.x + 10} ${sh.y - 26} ${sh.x - 24} ${sh.y - 12} Z`}
          fill={look.shirt}
        />
        {/* jersey stripe */}
        <path d={`M ${G.hip.x - 10} ${G.hip.y + 4} L ${sh.x - 6} ${sh.y - 6} L ${sh.x + 6} ${sh.y + 2} L ${G.hip.x + 6} ${G.hip.y + 8} Z`} fill={PAL.white} opacity={0.9} />
      </g>
      {/* head */}
      <g filter="url(#paper)">
        <Strip x1={sh.x + 6} y1={sh.y - 10} x2={head.x - 4} y2={head.y + 18} w={20} fill={look.skin} />
        <circle cx={head.x} cy={head.y} r={30} fill={look.skin} />
        <path d={`M ${head.x - 34} ${head.y + 2} Q ${head.x - 30} ${head.y - 44} ${head.x + 10} ${head.y - 40} Q ${head.x + 40} ${head.y - 34} ${head.x + 40} ${head.y - 6} Z`} fill={look.helmet} />
        <rect x={head.x - 20} y={head.y - 34} width={8} height={26} fill={PAL.white} transform={`rotate(-20 ${head.x} ${head.y})`} />
        <path d={`M ${head.x - 32} ${head.y} Q ${head.x - 36} ${head.y + 16} ${head.x - 22} ${head.y + 22} L ${head.x - 18} ${head.y + 2} Z`} fill={look.hair} />
        <circle cx={head.x + 16} cy={head.y + 2} r={4} fill={PAL.ink} />
        <path d={`M ${head.x + 12} ${head.y + 16} Q ${head.x + 20} ${head.y + 20} ${head.x + 26} ${head.y + 14}`} stroke={PAL.ink} strokeWidth={3} fill="none" />
        <circle cx={head.x + 6} cy={head.y + 12} r={6} fill={PAL.coral} opacity={0.45} />
      </g>
      <Leg pedal={near} pants={look.pants} shoe={look.shoe} skin={look.skin} />
      <Arm sleeve={look.shirt} skin={look.skin} dy={bob} />
    </g>
  );
};

/** Bike plus rider, layered back-to-front like a stack of cut sheets. */
export const RiderOnBike: React.FC<{
  wheelAngle: number;
  crankAngle: number;
  bob: number;
  look?: RiderLook;
  frameColor?: string;
  accent?: string;
}> = ({ wheelAngle, crankAngle, bob, look, frameColor, accent }) => (
  <g>
    <RiderBack crankAngle={crankAngle} look={look} />
    <Bike wheelAngle={wheelAngle} crankAngle={crankAngle} frameColor={frameColor} accent={accent} />
    <RiderFront crankAngle={crankAngle} bob={bob} look={look} />
  </g>
);
