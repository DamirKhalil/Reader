import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";

export const Smoke: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} style={{ background: "#111" }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[2, 2, 3]} intensity={30} color="#FFB46B" />
      <mesh rotation={[frame * 0.05, frame * 0.07, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#8a5a3a" />
      </mesh>
    </ThreeCanvas>
  );
};
