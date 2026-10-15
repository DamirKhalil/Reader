import { Composition } from "remotion";
import { CAMERA_16x9, CAMERA_9x16, DURATION, FPS } from "./shelf/config";
import { ShelfScene } from "./shelf/ShelfScene";

const Shelf16x9: React.FC = () => <ShelfScene camera={CAMERA_16x9} />;
const Shelf9x16: React.FC = () => <ShelfScene camera={CAMERA_9x16} />;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Shelf16x9" component={Shelf16x9} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
      <Composition id="Shelf9x16" component={Shelf9x16} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    </>
  );
};
