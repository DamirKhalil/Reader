import { Composition, Folder } from "remotion";
import { PaperBikeCommercial, SCENES, TOTAL } from "./PaperBikeCommercial";
import { BuildScene } from "./scenes/BuildScene";
import { RideScene } from "./scenes/RideScene";
import { DetailsScene } from "./scenes/DetailsScene";
import { FinaleScene } from "./scenes/FinaleScene";

const W = 3840;
const H = 2160;
const FPS = 60;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="PaperBikeCommercial" component={PaperBikeCommercial} width={W} height={H} fps={FPS} durationInFrames={TOTAL} />
      <Folder name="Scenes">
        <Composition id="TheBuild" component={BuildScene} width={W} height={H} fps={FPS} durationInFrames={SCENES.build} />
        <Composition id="TheRide" component={RideScene} width={W} height={H} fps={FPS} durationInFrames={SCENES.ride} />
        <Composition id="TheDetails" component={DetailsScene} width={W} height={H} fps={FPS} durationInFrames={SCENES.details} />
        <Composition id="GetOutAndRide" component={FinaleScene} width={W} height={H} fps={FPS} durationInFrames={SCENES.finale} />
      </Folder>
    </>
  );
};
