import { Composition } from "remotion";
import { Board } from "./Board";
import { DURATION_FRAMES, FPS, WoodpeckerVideo } from "./wp/Video";
import { Avatar } from "./brand/Avatar";
import { Icon } from "./brand/Icons";

export const Root = () => (
  <>
    <Composition id="Icon" component={Icon} width={800} height={800} fps={30} durationInFrames={1} defaultProps={{ kind: "bulb" }} />
    <Composition id="Avatar" component={Avatar} width={800} height={800} fps={30} durationInFrames={1} defaultProps={{ variant: "cutaway" }} />
    <Composition
      id="Woodpecker"
      component={WoodpeckerVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={DURATION_FRAMES}
    />
    <Composition
      id="Board"
      component={Board}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      defaultProps={{ scene: 1 }}
    />
  </>
);
