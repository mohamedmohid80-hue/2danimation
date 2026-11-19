import { Composition } from "remotion";
import { Board } from "./Board";

export const Root = () => (
  <Composition
    id="Board"
    component={Board}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={{ scene: 1 }}
  />
);
