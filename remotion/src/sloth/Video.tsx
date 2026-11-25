import React, { useLayoutEffect } from "react";
import { AbsoluteFill, Audio, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import rawWords from "../data/sloth_words.json";
import { Captions, fontFamily } from "../wp/captions";
import { LowPoly } from "./LowPoly";
import {
  DirtSpray, Eagle, FurMacro, Hole, Jaguar, MACRO, Moth, MothLife, Poop, Rainforest, Sloth, SlothPose, TRUNK_R, V3, clamp01, onTrunk, rnd, slothZ, trunkGrip,
} from "./model";

export const FPS = 30;
export const AUDIO_SECONDS = 65.53;
const GAG_SECONDS = 1.7;
export const DURATION_FRAMES = Math.ceil((AUDIO_SECONDS + GAG_SECONDS) * FPS);

type Word = { w: string; s: number; e: number };
const WORDS: Word[] = rawWords as Word[];
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9']/g, "");
const T = (phrase: string, after = 0): number => {
  const p = phrase.split(" ").map(norm);
  for (let i = 0; i < WORDS.length; i++) {
    if (WORDS[i].s < after) continue;
    if (p.every((tok, k) => WORDS[i + k] && norm(WORDS[i + k].w) === tok)) return WORDS[i].s;
  }
  throw new Error(`cue not found: ${phrase}`);
};
const END = WORDS[WORDS.length - 1].e;

const cue = {
  week: T("week"), thisSloth: T("this sloth"), risks: T("risks"), toilet: T("toilet"),
  upTrees: T("up in the trees"), catch1: T("catch"), moves: T("it moves"), slowly1: T("slowly"), jaguars: T("jaguars"), eagles: T("eagles"),
  fur: T("and its fur"), green: T("green"), partOf: T("part of"),
  thatGreen: T("that green"), algae: T("algae"), living: T("and living"), moths: T("moths"), dozens: T("dozens"),
  diet: T("but a diet"), leaves: T("leaves"), takes: T("takes weeks"), holds: T("so the sloth holds"), seven: T("7"),
  then: T("then it does"), strange: T("strange"), instead: T("instead"), branch: T("branch"), climbs: T("climbs"), ground: T("ground"),
  slowlyA: T("slowly", T("ground")), very: T("very"),
  bottom: T("at the bottom"), digs: T("digs"), tail: T("tail"), dance: T("does a wiggly"), drops: T("and drops"), third: T("third"),
  danger: T("this is the most"), dangerous: T("dangerous"), downHere: T("down here"), jaguar2: T("jaguar", T("down here")),
  why: T("so why"), scientists: T("scientists"), hop: T("they hop"), eggs: T("eggs"), babies: T("and their babies"), fly: T("and fly"),
  there: T("there they"), feed: T("feed"), snacks: T("and the sloth snacks"), gross: T("pretty gross"), genius: T("pretty genius"),
};
const GAG = END + 0.05;

// ---------------------------------------------------------------- math + camera specs
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const ramp = (t: number, s: number, d: number) => easeInOut(clamp01((t - s) / d));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const bump = (dt: number) => (dt < 0 ? 0 : dt < 0.08 ? dt / 0.08 : Math.max(0, 1 - (dt - 0.08) / 0.5));
type Spec = { tg: V3; d: number; yaw: number; pitch: number; f: number };
const S = (tg: V3, d: number, yaw: number, pitch: number, f = 34): Spec => ({ tg, d, yaw, pitch, f });
const lerpSpec = (a: Spec, b: Spec, k: number): Spec => ({ tg: lerp3(a.tg, b.tg, k), d: lerp(a.d, b.d, k), yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k), f: lerp(a.f, b.f, k) });
const specPos = (s: Spec): V3 => {
  const y = (s.yaw * Math.PI) / 180, p = (s.pitch * Math.PI) / 180;
  return [s.tg[0] + s.d * Math.sin(y) * Math.cos(p), s.tg[1] + s.d * Math.sin(p), s.tg[2] + s.d * Math.cos(y) * Math.cos(p)];
};

// sloth focus points for a body height y
const TOP = 9.0;
const BOT = 0.55;
const BODY = (y: number): V3 => [0, y + 0.1, slothZ(y)];
const FACE = (y: number): V3 => [0, y + 0.55, slothZ(y) + 0.08];
const clawAt = (y: number): V3 => { const r = trunkGripR(y + 0.72); return [Math.sin(0.72) * r, y + 0.72, Math.cos(0.72) * r]; };
const trunkGripR = (y: number) => slothZ(y) - 0.3 + 0.035;
const HOLE: V3 = [0, 0, slothZ(0.55) + 0.1];
const BELLY = (y: number): V3 => [0, y, slothZ(y)];

// ---------------------------------------------------------------- sloth pose helpers
type Extra = Partial<SlothPose>;
const blinkAt = (t: number) => (t % 4.1 < 0.14 ? 1 : 0);
const pose = (t: number, y: number, d: number, extra: Extra = {}): SlothPose => {
  const { pos, rot } = onTrunk(y);
  const g = trunkGrip(y, d);
  return { pos, rot, hands: g.hands, feet: g.feet, t, blink: blinkAt(t), algae: 0.22, moths: 14, look: 0.7, ...extra };
};
/** idle cling: limbs barely shift */
const idle = (t: number, y: number, extra: Extra = {}) => pose(t, y, 0.05 * Math.sin(t * 0.7), extra);
/** hand brought to the mouth (eating) */
const eating = (t: number, y: number, k: number, extra: Extra = {}) => {
  const p = idle(t, y, extra);
  const mouth: V3 = [0.12, y + 0.48, slothZ(y) + 0.3];
  p.hands = [p.hands[0], lerp3(p.hands[1], mouth, k)];
  return p;
};

// ---------------------------------------------------------------- shots
type World = { sloth?: SlothPose; macro?: { algae: number; moths: number; feed?: number }; extra?: React.ReactNode; dark?: number };
type Ctx = { t: number };
type Shot = { name: string; t: number; a: Spec; b: Spec; glide?: number; punch?: number[]; shake?: number; track?: (c: Ctx) => V3 | null; world: (c: Ctx) => World; overlay?: (c: Ctx) => React.ReactNode };

const flyingMoth = (t: number, from: V3, to: V3, s: number, d: number, n = 6) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const k = clamp01((t - s - rnd(i, 1) * 0.4) / d);
      const p = lerp3(from, to, easeInOut(k));
      return <Moth key={i} pos={[p[0] + Math.sin(t * 4 + i) * 0.25, p[1] + Math.sin(t * 6 + i * 2) * 0.12 + (rnd(i, 2) - 0.5) * 0.6, p[2] + (rnd(i, 3) - 0.5) * 0.5]} scale={1.3} flap={(t * 8 + i * 0.3) % 1} heading={Math.atan2(to[2] - from[2], to[0] - from[0])} />;
    })}
  </>
);

const SHOTS: Shot[] = [
  // ---------- HOOK
  { name: "crane down through the canopy to the sloth", t: 0, a: S(BODY(TOP), 11, 40, -16, 40), b: S(BODY(TOP), 3.6, 18, 8),
    world: ({ t }) => ({ sloth: idle(t, TOP) }), overlay: ({ t }) => t > cue.week - 0.1 && <BigLabel text="1× A WEEK" appear={cue.week - 0.1} /> },
  { name: "this sloth risks its life (push to face)", t: cue.thisSloth, a: S(FACE(TOP), 2.2, 30, 6), b: S(FACE(TOP), 1.3, 8, 3), glide: 0.25, punch: [cue.risks],
    world: ({ t }) => ({ sloth: idle(t, TOP, { look: ramp(t, cue.thisSloth, 0.4) }) }) },
  { name: "just to go to the toilet (plunge down the trunk)", t: cue.toilet - 0.45, a: S(FACE(TOP), 1.6, 15, 0), b: S(HOLE, 2.2, 20, 35),
    world: ({ t }) => ({ sloth: idle(t, TOP), extra: <Hole pos={HOLE} k={1} /> }),
    overlay: ({ t }) => <ToiletIcon t={t} appear={cue.toilet} /> },

  // ---------- SAFE IN THE TREES
  { name: "up in the trees: orbit the sloth", t: cue.upTrees, a: S(BODY(TOP), 5.5, -40, 10), b: S(BODY(TOP), 4.4, 30, 4),
    world: ({ t }) => ({ sloth: idle(t, TOP) }) },
  { name: "impossible to catch: claws grip tight (macro)", t: cue.catch1 - 0.5, a: S(clawAt(TOP), 1.1, 55, 10), b: S(clawAt(TOP), 0.85, 85, 16), punch: [cue.catch1],
    world: ({ t }) => ({ sloth: idle(t, TOP) }) },
  { name: "it moves so slowly: one arm reaches in slow motion", t: cue.moves, a: S(BODY(TOP), 3.2, 50, 4), b: S(BODY(TOP), 2.8, 70, 6),
    world: ({ t }) => ({ sloth: pose(t, TOP, 0.12 * ramp(t, cue.moves, 2.0)) }),
    overlay: ({ t }) => <SpeedGauge t={t} appear={cue.slowly1 - 0.2} /> },
  { name: "jaguars prowl below, never look up", t: cue.jaguars - 0.15, a: S([1.8, 0.5, 2.4], 3.4, 65, 5), b: S([1.2, 0.5, 2.4], 2.9, 30, 3),
    track: ({ t }) => [lerp(3.6, 0.6, ramp(t, cue.jaguars - 0.15, 1.6)), 0.5, 2.4],
    world: ({ t }) => ({ sloth: idle(t, TOP), extra: <Jaguar pos={[lerp(3.6, 0.6, ramp(t, cue.jaguars - 0.15, 1.6)), 0, 2.4]} heading={Math.PI} walk={t * 5} /> }) },
  { name: "eagles fly past the canopy", t: cue.eagles - 0.1, a: S(BODY(TOP), 6.5, -30, -4), b: S(BODY(TOP), 6.0, 20, -2),
    world: ({ t }) => ({ sloth: idle(t, TOP), extra: <Eagle pos={[lerp(-6, 6, ramp(t, cue.eagles - 0.1, 1.4)), TOP + 1.8, 1.8]} heading={0} flap={(t * 1.8) % 1} bank={0.2} /> }) },
  { name: "fur so green it looks like the tree (pull back, blend)", t: cue.fur, a: S(BODY(TOP), 3.0, 30, 6), b: S(BODY(TOP), 7.5, 65, 12),
    world: ({ t }) => ({ sloth: idle(t, TOP, { algae: lerp(0.22, 0.6, ramp(t, cue.green, 0.8)), look: 0.3 }) }) },

  // ---------- ALGAE + MOTHS (macro)
  { name: "that green is algae: dive into the fur", t: cue.thatGreen, a: S(BODY(TOP), 1.8, 20, 6), b: S(BODY(TOP), 0.9, 10, 4),
    world: ({ t }) => ({ sloth: idle(t, TOP, { algae: 0.6 }) }) },
  { name: "algae growing on every hair (fur macro)", t: cue.algae - 0.1, a: S(add3(MACRO, [0, 1.0, 0]), 3.2, 20, 18), b: S(add3(MACRO, [0.3, 1.0, 0]), 2.4, 55, 12), punch: [cue.algae],
    world: ({ t }) => ({ macro: { algae: ramp(t, cue.algae - 0.1, 1.2), moths: 0 } }) },
  { name: "tiny moths living in there", t: cue.living, a: S(add3(MACRO, [0.3, 1.1, 0]), 2.4, 55, 12), b: S(add3(MACRO, [0, 1.2, 0]), 1.6, 100, 10), glide: 0.25,
    world: ({ t }) => ({ macro: { algae: 1, moths: Math.round(6 * ramp(t, cue.moths - 0.3, 0.6)) } }) },
  { name: "dozens of them: pull out, moths all over", t: cue.dozens, a: S(BODY(TOP), 1.6, 20, 6), b: S(BODY(TOP), 3.4, -30, 8), punch: [cue.dozens],
    world: ({ t }) => ({ sloth: idle(t, TOP, { algae: 0.5, moths: Math.round(lerp(6, 40, ramp(t, cue.dozens, 0.8))) }) }),
    overlay: ({ t }) => t > cue.dozens && <BigLabel text="×40" appear={cue.dozens} /> },

  // ---------- DIGESTION
  { name: "a diet of leaves: sloth munches a leaf", t: cue.diet, a: S(FACE(TOP), 1.9, -25, 4), b: S(FACE(TOP), 1.3, 15, 2),
    world: ({ t }) => ({ sloth: eating(t, TOP, ramp(t, cue.diet, 0.6), { mouth: Math.abs(Math.sin(t * 9)) * ramp(t, cue.leaves, 0.2), look: 0.8 }),
      extra: <Leaf pos={[0.12, TOP + 0.5, slothZ(TOP) + 0.36]} t={t} bite={ramp(t, cue.leaves, 1.0)} /> }) },
  { name: "takes weeks to digest (x-ray stomach churning)", t: cue.takes, a: S(BELLY(TOP), 2.6, 30, 4), b: S(BELLY(TOP), 1.8, -10, 4), glide: 0.25,
    world: ({ t }) => ({ sloth: idle(t, TOP, { xray: true, stomach: 0.3 }) }) },
  { name: "holds it in for 7 days (day counter, stomach swells)", t: cue.holds, a: S(BELLY(TOP), 2.2, -20, 6), b: S(BELLY(TOP), 1.7, 45, 8), punch: [cue.seven],
    world: ({ t }) => ({ sloth: idle(t, TOP, { xray: true, stomach: lerp(0.3, 1, ramp(t, cue.holds, cue.seven + 0.5 - cue.holds)) }) }),
    overlay: ({ t }) => <DayCounter t={t} start={cue.holds} end={cue.seven + 0.3} /> },

  // ---------- THE CLIMB DOWN
  { name: "then it does something strange (snap zoom, vignette)", t: cue.then, a: S(FACE(TOP), 3.0, 0, 4), b: S(FACE(TOP), 1.1, 0, 2), punch: [cue.strange],
    world: ({ t }) => ({ sloth: idle(t, TOP, { look: 1, mouth: 0.5 }), dark: 0.5 }) },
  { name: "instead of going from the branch: vertigo look straight down", t: cue.instead, a: S([0, 3, 1.4], 6.6, 0, 72), b: S([0, 2.5, 1.4], 6.0, 20, 80),
    world: ({ t }) => ({ sloth: idle(t, TOP), extra: <DropLine t={t} start={cue.instead} cross={cue.branch} /> }) },
  { name: "climbs all the way down (crane follows)", t: cue.climbs - 0.25, a: S(BODY(TOP), 4.2, 40, 8), b: S(BODY(TOP - 1.4), 3.6, 75, -6),
    track: ({ t }) => BODY(climbY(t)),
    world: ({ t }) => ({ sloth: pose(t, climbY(t), TOP - climbY(t)) }),
    overlay: ({ t }) => <HeightMeter t={t} m={lerp(30, 24, ramp(t, cue.climbs, cue.slowlyA - cue.climbs))} /> },
  { name: "slowly (claw macro, one careful step)", t: cue.slowlyA, a: S(BODY(5.0), 2.1, 45, 6), b: S(BODY(5.0), 1.6, 72, 4),
    world: ({ t }) => ({ sloth: pose(t, 5.0, 0.18 * ramp(t, cue.slowlyA, 1.0)) }),
    overlay: () => <HeightMeter t={0} m={15} /> },
  { name: "very slowly (camera whips around, sloth barely moves)", t: cue.very, a: S(BODY(3.0), 4.4, -60, 8), b: S(BODY(3.0), 4.4, 80, 4),
    world: ({ t }) => ({ sloth: pose(t, 3.0 - 0.05 * ramp(t, cue.very, 1.0), 0.1 * ramp(t, cue.very, 1.0)) }),
    overlay: ({ t }) => <HeightMeter t={t} m={lerp(8, 7.9, ramp(t, cue.very, 1))} /> },

  // ---------- AT THE BOTTOM
  { name: "at the bottom: digs a hole with its tail", t: cue.bottom, a: S([0, 0.2, 0.9], 2.5, 70, 6), b: S([0, 0.2, 0.9], 1.9, 98, 10), punch: [cue.tail],
    world: ({ t }) => ({ sloth: idle(t, BOT, { wiggle: 0.3 * ramp(t, cue.digs, 0.3) }), extra: <><Hole pos={HOLE} k={ramp(t, cue.digs, 1.2)} /><DirtSpray pos={HOLE} t={t} amount={ramp(t, cue.digs, 0.3)} /></> }) },
  { name: "wiggly poop dance (orbit)", t: cue.dance, a: S(BODY(BOT), 3.2, -40, 6), b: S(BODY(BOT), 2.8, 40, 10),
    world: ({ t }) => ({ sloth: idle(t, BOT, { wiggle: 1, mouth: 0.3 }), extra: <Hole pos={HOLE} k={1} /> }),
    overlay: ({ t }) => <Notes t={t} start={cue.dance} /> },
  { name: "drops a third of its body weight", t: cue.drops, a: S(HOLE, 2.2, 20, 22), b: S(HOLE, 1.6, -25, 16), punch: [cue.third],
    world: ({ t }) => ({ sloth: idle(t, BOT, { squish: ramp(t, cue.drops + 0.3, 1.6) }), extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={ramp(t, cue.drops + 0.1, 1.8)} /></> }),
    overlay: ({ t }) => t > cue.third - 0.1 && <BigLabel text="⅓ BODY WEIGHT" appear={cue.third - 0.1} size={110} /> },

  // ---------- DANGER
  { name: "most dangerous moment: low angle, dark vignette", t: cue.danger, a: S(BODY(BOT), 4.6, 10, -6), b: S(BODY(BOT), 3.2, -15, -2), punch: [cue.dangerous],
    world: ({ t }) => ({ sloth: idle(t, BOT, { squish: 1, look: 1 }), dark: 0.6, extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} /></> }) },
  { name: "down here a jaguar can catch it: eyes in the bushes, it stalks", t: cue.downHere, a: S([-1.0, 0.6, 1.6], 5.4, 40, 8), b: S([-0.8, 0.6, 1.5], 4.4, 25, 5), shake: 0.3,
    world: ({ t }) => ({ sloth: idle(t, BOT, { squish: 1, look: 1 }), dark: 0.5,
      extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} />
        <Jaguar pos={[lerp(-3.2, -1.7, ramp(t, cue.jaguar2, 1.2)), 0, lerp(2.6, 1.9, ramp(t, cue.jaguar2, 1.2))]} heading={0.4} walk={t * 4} crouch={1} eyesOnly={t < cue.jaguar2 ? 1 : 0} /></> }) },

  // ---------- WHY: THE MOTHS
  { name: "so why risk it? (sloth looks at camera, moths stir)", t: cue.why, a: S(FACE(BOT), 1.8, 25, 4), b: S(FACE(BOT), 1.3, -10, 4),
    world: ({ t }) => ({ sloth: idle(t, BOT, { squish: 1, look: 1 }), extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} /></> }),
    overlay: ({ t }) => <QMark t={t} appear={cue.why + 0.3} /> },
  { name: "scientists think it's for the moths: moths lift off the fur", t: cue.scientists, a: S(BODY(BOT), 2.2, 40, 8), b: S(BODY(BOT), 3.0, 80, 14),
    world: ({ t }) => ({ sloth: idle(t, lerp(BOT, 1.4, ramp(t, cue.scientists, 1.4)), { squish: 1, moths: 20, mothsLift: ramp(t, cue.scientists + 0.6, 1.2) }), extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} /></> }) },
  { name: "they hop off and lay eggs in the poop (macro at the pile)", t: cue.hop, a: S(HOLE, 1.1, 30, 30), b: S(HOLE, 0.8, 80, 40), punch: [cue.eggs],
    world: ({ t }) => ({ sloth: idle(t, 1.5, { squish: 1, moths: 4 }), extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} />
      {flyingMoth(t, [0.1, 0.9, 1.0], add3(HOLE, [0, 0.12, 0]), cue.hop, 0.6, 5)}<MothLife pos={HOLE} t={t} stage={ramp(t, cue.eggs, 0.5)} /></> }) },
  { name: "babies grow up (time-lapse: caterpillars, then moths)", t: cue.babies, a: S(HOLE, 0.9, 70, 40), b: S(HOLE, 1.2, 15, 30),
    world: ({ t }) => ({ sloth: idle(t, 1.6, { squish: 1 }), extra: <><Hole pos={HOLE} k={1} /><Poop pos={HOLE} k={1} /><MothLife pos={HOLE} t={t} stage={lerp(1, 2.9, ramp(t, cue.babies, cue.fly - cue.babies))} /></> }) },
  { name: "fly back into the sloth's fur (camera rises with them)", t: cue.fly, a: S(add3(HOLE, [0, 0.4, 0]), 2.0, 30, 10), b: S(BODY(3.5), 3.0, 50, 0),
    track: ({ t }) => [0, lerp(0.4, 3.6, ramp(t, cue.fly, cue.there - cue.fly)), 1.4],
    world: ({ t }) => ({ sloth: idle(t, 3.5, { moths: Math.round(lerp(0, 14, ramp(t, cue.there - 0.6, 0.6))) }), extra: <MothLife pos={HOLE} t={t} stage={3} flyUp={ramp(t, cue.fly, cue.there - cue.fly) * 0.6} /> }) },
  { name: "they feed the algae (fur macro, algae glows + grows)", t: cue.there, a: S(add3(MACRO, [0, 1.1, 0]), 2.6, -20, 14), b: S(add3(MACRO, [0, 1.1, 0]), 1.9, 40, 10), punch: [cue.feed],
    world: ({ t }) => ({ macro: { algae: 1, moths: 6, feed: ramp(t, cue.feed, 0.6) } }) },
  { name: "the sloth snacks on the algae (licks its arm)", t: cue.snacks, a: S(FACE(3.5), 1.6, 30, 4), b: S(FACE(3.5), 1.2, -5, 2), punch: [cue.snacks + 0.5],
    world: ({ t }) => ({ sloth: eating(t, 3.5, ramp(t, cue.snacks, 0.4), { mouth: Math.abs(Math.sin(t * 9)), look: 0.9, algae: 0.5 }) }) },
  { name: "pretty gross (pull back)", t: cue.gross, a: S(BODY(3.5), 2.0, -5, 4), b: S(BODY(3.5), 3.6, 30, 10),
    world: ({ t }) => ({ sloth: idle(t, 3.5, { look: 1, mouth: 0.6 }) }) },
  { name: "pretty genius: the full cycle diagram", t: cue.genius - 0.15, a: S(BODY(3.5), 3.6, 30, 10), b: S([0, 3.95, 0.82], 2.4, 10, 2),
    world: ({ t }) => ({ sloth: idle(t, 3.5, { look: 1 }), extra: <Moth pos={lerp3([0.3, 3.9, 1.2], add3(specPos(S(BODY(3.5), 2.0, 10, 4)), [0, 0, 0]), ramp(t, GAG - 0.5, 0.5))} scale={1.6} flap={(t * 9) % 1} /> }),
    overlay: ({ t }) => <><Cycle t={t} appear={cue.genius - 0.1} /><ScreenMoth t={t} land={GAG} /></> },
];

function climbY(t: number) {
  return lerp(TOP, TOP - 2.6, ramp(t, cue.climbs - 0.1, cue.slowlyA - cue.climbs + 0.1));
}

// shots must be in time order (a cue matching an earlier word would silently break the cut list)
SHOTS.forEach((s, i) => {
  if (i > 0 && !(s.t > SHOTS[i - 1].t)) throw new Error(`shot ${i} "${s.name}" starts before the previous shot`);
});

const shotEnd = (i: number) => (i + 1 < SHOTS.length ? SHOTS[i + 1].t : DURATION_FRAMES / FPS);

// ---------------------------------------------------------------- 3D extras
const Leaf: React.FC<{ pos: V3; t: number; bite: number }> = ({ pos, t, bite }) => (
  <mesh position={pos} rotation={[0.3, 0.5 + Math.sin(t * 2) * 0.1, 0.4]} scale={[0.09 * (1 - bite * 0.8), 0.05, 0.004]}>
    <sphereGeometry args={[1, 14, 8]} />
    <meshStandardMaterial color="#4fae3c" roughness={0.6} />
  </mesh>
);
const DropLine: React.FC<{ t: number; start: number; cross: number }> = ({ t, start, cross }) => {
  const k = ramp(t, start, 0.6);
  const n = Math.round(14 * k);
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[0, TOP - 0.6 - i * 0.6, TRUNK_R + 0.9]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {t > cross + 0.1 &&
        [1, -1].map((s) => (
          <mesh key={s} position={[0, 5, TRUNK_R + 0.9]} rotation={[Math.PI / 2, 0, s * Math.PI / 4]} scale={ramp(t, cross + 0.1, 0.2)}>
            <boxGeometry args={[2.4, 0.25, 0.05]} />
            <meshBasicMaterial color="#ff3b3b" />
          </mesh>
        ))}
    </group>
  );
};

// ---------------------------------------------------------------- 2D overlays
const Title: React.CSSProperties = { fontFamily, fontWeight: 900, color: "#fff", WebkitTextStroke: "10px #1d2f6f", paintOrder: "stroke fill", textShadow: "0 10px 0 #12204f, 0 18px 30px rgba(0,0,0,0.35)" };
const BigLabel: React.FC<{ text: string; appear: number; size?: number }> = ({ text, appear, size = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear * fps, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
      <div style={{ ...Title, fontSize: size, transform: `rotate(-4deg) scale(${0.3 + 0.7 * s})`, opacity: Math.min(1, s * 2), transformOrigin: "right center" }}>{text}</div>
    </AbsoluteFill>
  );
};
const pop = (t: number, appear: number) => easeOut(clamp01((t - appear) / 0.25));
const ToiletIcon: React.FC<{ t: number; appear: number }> = ({ t, appear }) => {
  const k = pop(t, appear);
  return (
    <AbsoluteFill style={{ alignItems: "center", padding: "260px 0 0 0", opacity: k }}>
      <svg width="260" height="300" viewBox="0 0 100 115" style={{ transform: `scale(${0.4 + 0.6 * k}) rotate(${(1 - k) * -20}deg)` }}>
        <rect x="18" y="4" width="64" height="34" rx="8" fill="#fff" stroke="#1d2f6f" strokeWidth="6" />
        <path d="M10 44 H90 C90 70 72 82 50 82 C28 82 10 70 10 44 Z" fill="#fff" stroke="#1d2f6f" strokeWidth="6" />
        <path d="M34 82 L30 108 H70 L66 82" fill="#fff" stroke="#1d2f6f" strokeWidth="6" strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};
const SpeedGauge: React.FC<{ t: number; appear: number }> = ({ t, appear }) => {
  const k = pop(t, appear);
  const needle = -80 + 6 + Math.sin(t * 3) * 1.5;
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0", opacity: k }}>
      <div style={{ transform: `scale(${0.5 + 0.5 * k})`, transformOrigin: "right top", textAlign: "center" }}>
        <svg width="300" height="180" viewBox="0 0 200 120">
          <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="#fff" strokeWidth="22" />
          <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="#1d2f6f" strokeWidth="6" />
          <line x1="100" y1="110" x2={100 + 70 * Math.sin((needle * Math.PI) / 180)} y2={110 - 70 * Math.cos((needle * Math.PI) / 180)} stroke="#ff3b3b" strokeWidth="8" strokeLinecap="round" />
          <circle cx="100" cy="110" r="10" fill="#1d2f6f" />
        </svg>
        <div style={{ ...Title, fontSize: 70, WebkitTextStroke: "7px #1d2f6f" }}>0.2 km/h</div>
      </div>
    </AbsoluteFill>
  );
};
const DayCounter: React.FC<{ t: number; start: number; end: number }> = ({ t, start, end }) => {
  const day = Math.max(1, Math.min(7, 1 + Math.floor(6 * clamp01((t - start) / (end - start)))));
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
      <div style={{ ...Title, fontSize: 120 }}>DAY {day}</div>
    </AbsoluteFill>
  );
};
const HeightMeter: React.FC<{ t: number; m: number }> = ({ m }) => (
  <AbsoluteFill style={{ padding: "250px 0 0 70px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="60" height="300" viewBox="0 0 20 100">
        <rect x="6" y="2" width="8" height="96" rx="4" fill="#fff" stroke="#1d2f6f" strokeWidth="2" />
        <circle cx="10" cy={98 - (m / 30) * 92} r="7" fill="#ff3b3b" stroke="#1d2f6f" strokeWidth="2" />
      </svg>
      <div style={{ ...Title, fontSize: 96 }}>{Math.round(m)} m</div>
    </div>
  </AbsoluteFill>
);
const Notes: React.FC<{ t: number; start: number }> = ({ t, start }) => (
  <AbsoluteFill>
    {[0, 1, 2].map((i) => {
      const ph = ((t - start) * 0.9 + i / 3) % 1;
      return (
        <div key={i} style={{ position: "absolute", left: `${30 + i * 18}%`, top: `${38 - ph * 18}%`, opacity: t > start ? Math.sin(ph * Math.PI) : 0, ...Title, fontSize: 110, WebkitTextStroke: "6px #1d2f6f" }}>♪</div>
      );
    })}
  </AbsoluteFill>
);
const QMark: React.FC<{ t: number; appear: number }> = ({ t, appear }) => {
  const k = pop(t, appear);
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "230px 110px 0 0" }}>
      <div style={{ ...Title, fontSize: 260, opacity: k, transform: `scale(${0.3 + 0.7 * k}) rotate(${Math.sin(t * 6) * 6}deg)` }}>?</div>
    </AbsoluteFill>
  );
};
/** Sloth -> poop -> moths -> algae -> sloth, arrows draw around a circle. */
const Cycle: React.FC<{ t: number; appear: number }> = ({ t, appear }) => {
  const k = clamp01((t - appear) / 0.8);
  const items = ["🦥", "💩", "🦋", "🌿"];
  const labels = ["SLOTH", "POOP", "MOTHS", "ALGAE"];
  return (
    <AbsoluteFill style={{ alignItems: "center", padding: "120px 0 0 0" }}>
      <div style={{ position: "relative", width: 560, height: 560, transform: "scale(0.78)", transformOrigin: "center top" }}>
        <svg width="560" height="560" viewBox="0 0 560 560" style={{ position: "absolute" }}>
          <circle cx="280" cy="280" r="200" fill="none" stroke="#fff" strokeWidth="18" strokeDasharray={`${1257 * k} 1257`} transform="rotate(-90 280 280)" strokeLinecap="round" />
        </svg>
        {labels.map((l, i) => {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const on = clamp01((k - i / 4) * 5);
          return (
            <div key={l} style={{ position: "absolute", left: 280 + Math.cos(a) * 200 - 90, top: 280 + Math.sin(a) * 200 - 45, width: 180, textAlign: "center", opacity: on, transform: `scale(${0.4 + 0.6 * on})` }}>
              <div style={{ ...Title, fontSize: 52, WebkitTextStroke: "6px #1d2f6f", background: "#ffd23f", borderRadius: 18, padding: "6px 0", color: "#1d2f6f", textShadow: "none" }}>{l}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "none" }}>{items.join("")}</div>
    </AbsoluteFill>
  );
};
/** Life-size moth that lands on the viewer's screen. */
const ScreenMoth: React.FC<{ t: number; land: number }> = ({ t, land }) => {
  if (t < land - 0.25) return null;
  const k = easeOut(clamp01((t - land + 0.25) / 0.25));
  const tw = t > land ? Math.sin((t - land) * 30) * 0.12 * (Math.sin((t - land) * 3) > 0 ? 1 : 0.2) : 0;
  const crawl = clamp01((t - land - 0.5) / 1) * 30;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translate(${crawl}px, ${-crawl * 0.6}px) scale(${3 - 2 * k}) rotate(-18deg)`, filter: `drop-shadow(12px 18px 10px rgba(0,0,0,${0.45 * k}))`, opacity: k }}>
        <svg width="420" height="360" viewBox="0 0 140 120">
          {[1, -1].map((s) => (
            <g key={s} transform={`translate(70 60) scale(${s * (1 - Math.abs(tw))} 1)`}>
              <path d="M2 -6 C24 -40 64 -42 66 -14 C68 6 40 10 4 2 Z" fill="#8a765c" stroke="#4a3c2c" strokeWidth="1.6" />
              <path d="M2 2 C30 10 52 22 44 42 C36 56 14 40 2 10 Z" fill="#7a6650" stroke="#4a3c2c" strokeWidth="1.6" />
              <circle cx="38" cy="-18" r="5" fill="#5a4a38" />
              <path d="M20 -24 C34 -30 48 -30 56 -22" stroke="#a8967a" strokeWidth="1.4" fill="none" />
            </g>
          ))}
          <ellipse cx="70" cy="62" rx="5" ry="22" fill="#4a3c2c" />
          <path d="M68 42 C62 30 56 24 50 20 M72 42 C78 30 84 24 90 20" stroke="#4a3c2c" strokeWidth="1.6" fill="none" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- camera + composition
type CamOut = { p: V3; t: V3; f: number };
const cameraAt = (i: number, t: number, ctx: Ctx): CamOut => {
  const s = SHOTS[i];
  const k = easeInOut(clamp01((t - s.t) / (shotEnd(i) - s.t)));
  let spec = lerpSpec(s.a, s.b, k);
  const tr = s.track?.(ctx);
  if (tr) spec = { ...spec, tg: tr };
  if (s.glide && i > 0) {
    const g = clamp01((t - s.t) / s.glide);
    if (g < 1) spec = lerpSpec(SHOTS[i - 1].b, spec, easeInOut(g));
  }
  spec = { ...spec, yaw: spec.yaw + 2.4 * Math.sin(t * 0.7) + 1.0 * Math.sin(t * 1.6 + 2), pitch: spec.pitch + 1.3 * Math.sin(t * 0.9 + 1) };
  const pb = (s.punch ?? []).reduce((m, pt) => Math.max(m, bump(t - pt)), 0);
  spec = { ...spec, f: spec.f * (1 - 0.16 * pb) };
  let tg = spec.tg;
  if (s.shake) tg = add3(tg, [Math.sin(t * 37) * 0.02 * s.shake, Math.sin(t * 29 + 1) * 0.02 * s.shake, 0]);
  return { p: specPos(spec), t: tg, f: spec.f };
};
const CameraRig: React.FC<{ cam: CamOut }> = ({ cam }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...cam.p);
    c.fov = cam.f;
    c.lookAt(...cam.t);
    c.updateProjectionMatrix();
  }, [camera, cam]);
  return null;
};

export const SLOTH_SHOTS = SHOTS.map((s, i) => ({ name: s.name, t: s.t, end: shotEnd(i) }));

export const SlothVideo: React.FC<{ lowPoly?: boolean }> = ({ lowPoly = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  let i = SHOTS.length - 1;
  while (i > 0 && t < SHOTS[i].t) i--;
  const sc = SHOTS[i];
  const ctx: Ctx = { t };
  const w = sc.world(ctx);
  const cam = cameraAt(i, t, ctx);
  const sky = "#cfe9d4";
  return (
    <AbsoluteFill style={{ background: sky }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true }}>
        <color attach="background" args={[w.macro ? "#2a3a22" : sky]} />
        {!w.macro && <fog attach="fog" args={["#bfe0c4", 8, 45]} />}
        <CameraRig cam={cam} />
        <hemisphereLight args={["#f2fff0", "#4a3a22", 0.8]} />
        <directionalLight position={[5, 16, 8]} intensity={2.4} color="#fff4dc" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={14} shadow-camera-bottom={-2} shadow-bias={-0.0005} />
        <directionalLight position={[-5, 6, -4]} intensity={0.7} color="#d8ffe0" />
        {w.macro ? (
          <>
            <pointLight position={add3(MACRO, [1, 3, 2])} intensity={8} distance={12} color="#fff6dc" />
            <FurMacro t={t} {...w.macro} />
          </>
        ) : (
          <>
            <Rainforest t={t} />
            {w.sloth && <Sloth {...w.sloth} tufts={!lowPoly} />}
            {w.extra}
          </>
        )}
        {lowPoly && <LowPoly />}
      </ThreeCanvas>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${55 - (w.dark ?? 0) * 25}%, rgba(0,0,0,${0.22 + (w.dark ?? 0) * 0.5}) 100%)` }} />
      {sc.overlay?.(ctx)}
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("sloth_voiceover.wav")} />
    </AbsoluteFill>
  );
};
