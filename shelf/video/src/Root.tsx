import { Composition } from "remotion";
import { Smoke } from "./Smoke";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Smoke" component={Smoke} durationInFrames={30} fps={30} width={640} height={360} />
    </>
  );
};
