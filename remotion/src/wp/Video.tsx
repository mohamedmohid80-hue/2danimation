import React, { useLayoutEffect } from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import rawWords from "../data/words.json";
import {
  Arrow3D, BIRD_X, BirdState, C, ChipBurst, ForceArrows, Forest, GhostHammer, Grub, ImpactFlash, TONGUE_CURVE, Trunk, Tripod, V3, Woodpecker, rnd,
} from "./model";
import { Captions, fontFamily } from "./captions";

export const FPS = 30;
export const AUDIO_SECONDS = 76.07;
export const DURATION_FRAMES = Math.ceil((AUDIO_SECONDS + 0.6) * FPS);

// ---------------------------------------------------------------- words & cues
export type Word = { w: string; s: number; e: number };
export const WORDS: Word[] = (rawWords as Word[]).reduce<Word[]>((acc, w) => {
  if (w.w.startsWith("-") && acc.length) acc[acc.length - 1] = { ...acc[acc.length - 1], w: acc[acc.length - 1].w + w.w, e: w.e };
  else acc.push(w);
  return acc;
}, []);
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9']/g, "");
/** Start time (s) of the first occurrence of `phrase` at or after `after`. */
export const T = (phrase: string, after = 0): number => {
  const p = phrase.split(" ").map(norm);
  for (let i = 0; i < WORDS.length; i++) {
    if (WORDS[i].s < after) continue;
    if (p.every((tok, k) => WORDS[i + k] && norm(WORDS[i + k].w) === tok)) return WORDS[i].s;
  }
  throw new Error(`cue not found: ${phrase}`);
};

// ---------------------------------------------------------------- math
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const ramp = (t: number, start: number, dur: number) => easeInOut(clamp01((t - start) / dur));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Quick attack, slow decay bump for punch-ins. */
const bump = (dt: number) => (dt < 0 ? 0 : dt < 0.08 ? dt / 0.08 : Math.max(0, 1 - (dt - 0.08) / 0.5));

// ---------------------------------------------------------------- camera specs (orbit around a target)
type Spec = { tg: V3; d: number; yaw: number; pitch: number; f: number };
const S = (tg: V3, d: number, yaw: number, pitch: number, f = 34): Spec => ({ tg, d, yaw, pitch, f });
const lerpSpec = (a: Spec, b: Spec, k: number): Spec => ({
  tg: lerp3(a.tg, b.tg, k), d: lerp(a.d, b.d, k), yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k), f: lerp(a.f, b.f, k),
});
const specPos = (s: Spec): V3 => {
  const y = (s.yaw * Math.PI) / 180, p = (s.pitch * Math.PI) / 180;
  return [s.tg[0] + s.d * Math.sin(y) * Math.cos(p), s.tg[1] + s.d * Math.sin(p), s.tg[2] + s.d * Math.cos(y) * Math.cos(p)];
};

// focus points
const HEAD: V3 = [1.45, 0.92, 0];
const IMP: V3 = [1.0, 0.88, 0];
const BEAKT: V3 = [1.05, 0.98, 0];
const EYE: V3 = [1.42, 0.96, 0.24];
const BODY: V3 = [1.4, 0.1, 0];
const FEET: V3 = [1.15, -0.55, 0];
const TAILT: V3 = [1.2, -1.15, 0];
const TRIC: V3 = [1.15, -1.0, 0];
const BRAIN: V3 = [1.61, 0.97, 0];
const HOLE: V3 = [0.72, 0.88, 0];

// ---------------------------------------------------------------- pecking
type Peck = { rate: number; amp?: number; chips?: boolean; dir?: V3; flash?: boolean; slow?: boolean; shake?: boolean; chipColor?: string };
type PeckInfo = { peck: number; age: number; hitIdx: number; period: number };
const peckAt = (t: number, start: number, rate: number, amp = 1): PeckInfo => {
  const t0 = start + 0.12;
  const x = (t - t0) * rate;
  const k = Math.floor(x);
  const p = x - k;
  const raw = p < 0.4 ? 1 - easeOut(p / 0.4) : Math.pow((p - 0.4) / 0.6, 2);
  const hitTime = t0 + k / rate;
  return { peck: 1 - amp * (1 - raw), age: hitTime >= start ? t - hitTime : -1, hitIdx: k, period: 1 / rate };
};
const pulse = (pk: PeckInfo | null, len = 0.15) => (pk && pk.age >= 0 ? clamp01(1 - pk.age / len) : 0);

/** Third eyelid timing for a chip volley launched `age` seconds ago: shuts just before the chips land. */
const EYE_FLIGHT = 0.2;
function eyelidAt(age: number) {
  if (age < 0) return 0;
  const close = clamp01((age - (EYE_FLIGHT - 0.12)) / 0.07);
  const open = clamp01((age - (EYE_FLIGHT + 0.14)) / 0.1);
  return close * (1 - open);
}

/** A volley of wood chips flying from the impact into the eye; deflected off the third eyelid if `deflect`. */
const EYE_W: V3 = [BIRD_X - 0.15, 0.965, 0.31];
const IMPACT_W: V3 = [1.0, 0.88, 0.05];
const EyeChips: React.FC<{ age: number; seed: number; deflect: boolean }> = ({ age, seed, deflect }) => {
  if (age < 0 || age > 0.9) return null;
  const n = 10;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const r = (k: number) => rnd(seed * 17 + i, k);
        const a = age - r(1) * 0.05; // slight stagger
        if (a < 0) return null;
        const target: V3 = [EYE_W[0] + (r(2) - 0.5) * 0.05, EYE_W[1] + (r(3) - 0.5) * 0.05, EYE_W[2] + 0.01];
        const u = a / EYE_FLIGHT;
        let p: V3;
        let s = 0.04 + r(4) * 0.028;
        if (u <= 1) {
          p = lerp3(IMPACT_W, target, u);
          p = [p[0], p[1] + 0.07 * Math.sin(Math.PI * u), p[2]];
        } else {
          const b = a - EYE_FLIGHT;
          if (deflect) {
            // bounce off the eyelid: back out toward the camera/beak side, spinning
            const v: V3 = [-0.45 - r(5) * 0.55, 0.45 + r(6) * 0.85, 0.12 + r(7) * 0.3];
            p = [target[0] + v[0] * b, target[1] + v[1] * b - 2.6 * b * b, target[2] + v[2] * b];
          } else {
            // hit the eye and drop away
            p = [target[0] + (r(5) - 0.5) * 0.1 * b, target[1] - 1.6 * b * b, target[2] + 0.1 * b];
            s *= Math.max(0, 1 - b * 1.6);
          }
        }
        return (
          <mesh key={i} position={p} rotation={[r(8) * 6 + a * 14, r(9) * 6 + a * 11, r(10) * 6]}>
            <boxGeometry args={[s * 1.6, s, s * 0.4]} />
            <meshStandardMaterial color={C.chip} roughness={0.9} />
          </mesh>
        );
      })}
      {/* impact on the eye (ouch) or a "tink" off the eyelid */}
      <ImpactFlash age={(age - EYE_FLIGHT) * 1.4} pos={[EYE_W[0], EYE_W[1], EYE_W[2] + 0.02]} size={deflect ? 0.45 : 0.35} color={deflect ? "#ffffff" : "#ff5a5a"} />
    </group>
  );
};

// ---------------------------------------------------------------- shots
type Ctx = { t: number; lt: number; pk: PeckInfo | null };
type Shot = {
  name: string;
  t: number; // start time
  a: Spec; // framing at shot start
  b: Spec; // framing at shot end (camera keeps moving between them)
  glide?: number; // seconds to travel in from the previous shot's framing (else hard cut)
  punch?: number[]; // punch-in zoom times
  track?: (c: Ctx) => V3 | null; // override camera target (follow an object)
  peck?: Peck;
  ghostTrunk?: (c: Ctx) => number;
  vignette?: number;
  bird: (c: Ctx) => BirdState;
  extra?: (c: Ctx) => React.ReactNode;
  overlay?: (c: Ctx) => React.ReactNode;
};

const tipWorld = (progress: number): V3 => {
  const p = TONGUE_CURVE.getPointAt(clamp01(Math.max(0.001, progress)));
  return [p.x + BIRD_X, p.y, p.z];
};
const cue = {
  into: T("into a tree"), twenty: T("20"), yourBrain: T("your brain"), soup: T("soup"),
  every: T("every hit stops"), hundreds: T("hundreds"), football: T("even football"), concussions: T("concussions"),
  beak: T("so you grow a beak"), beakW: T("beak"), chisel: T("chisel"), bare: T("but bare"), chip: T("chip"),
  coat: T("so you coat"), keratin: T("keratin"), fingernails: T("like your fingernails"), growing: T("keeps growing"), sharpens: T("sharpens"),
  brain: T("but your brain"), front: T("front of your skull"), shrink: T("so you shrink"), shrinkW: T("shrink"), pack: T("and pack"), slosh: T("slosh"),
  woodChips: T("but now wood"), straight: T("straight at"), eyelid: T("so a third"), snaps: T("snaps"), split: T("a split"),
  bounce: T("but every hit"), grab: T("so you grab"), grabW: T("grab"), twoToes: T("two toes"), twoBack: T("two back"), jam: T("jam"), tail: T("tail"), tripod: T("like a tripod"),
  bugs: T("but the bugs"), deep: T("deep inside"), tongue: T("so you grow a tongue"), wraps: T("wraps"), skull2: T("skull", T("wraps")), barbs: T("barbs"), spear: T("spear"), them: T("them", T("spear")),
  safe: T("and just to be safe"), line: T("you line"), spongy: T("spongy"), helmet: T("like a helmet"),
  nobody: T("and here is"), helmetDoes: T("the helmet does"), nothing: T("almost nothing"), high: T("highspeed cameras"), soften: T("soften"),
  hammer: T("it's a hammer"), hammerW: T("hammer", T("it's a")), sci: T("scientists"), tiny: T("tiny"), light: T("it's just too light"),
  congrats: T("congratulations"), wood: T("woodpecker"),
};

const SHOTS: Shot[] = [
  // ---------- HOOK: crane in from wide to the impact, 6 pecks a second
  { name: "hook wide→head", t: 0, a: S(BODY, 6.5, 15, 4), b: S(HEAD, 2.3, 28, 6),
    peck: { rate: 6, chips: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }) },
  { name: "into a tree", t: cue.into, a: S(HEAD, 2.3, 28, 6), b: S(IMP, 1.5, 42, 8), glide: 0.25,
    peck: { rate: 6, chips: true, flash: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }) },
  { name: "20 times a second", t: cue.twenty, a: S(IMP, 1.5, 42, 8), b: S(IMP, 1.3, 65, 3), punch: [cue.twenty],
    peck: { rate: 6, chips: true, flash: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => <BigLabel text="20×" sub="EVERY SECOND" appear={cue.twenty} t={t} /> },
  { name: "brain → soup (x-ray)", t: cue.yourBrain, a: S(BRAIN, 1.7, -5, 6), b: S(BRAIN, 1.15, 12, 0), punch: [cue.soup],
    peck: { rate: 6, amp: 0.3, shake: true },
    bird: ({ t, pk }) => ({ peck: pk!.peck, xray: true, t, brainScale: 1.5, fluid: 1, brainForward: 0.06 * pulse(pk, 0.12),
      brainWobble: 0.4 + 0.6 * ramp(t, cue.soup - 0.2, 0.3), brainHurt: 0.3 + 0.7 * ramp(t, cue.soup - 0.3, 0.4) }) },

  // ---------- HUNDREDS OF G
  { name: "every hit (low front)", t: cue.every, a: S([1.15, 0.9, 0], 1.45, 6, -16), b: S([1.15, 0.9, 0], 1.2, 22, -8),
    peck: { rate: 6, chips: true, dir: [0.2, 0.3, 1], flash: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }) },
  { name: "hundreds of g", t: cue.hundreds, a: S(IMP, 1.7, 15, 4), b: S(IMP, 1.45, 38, 2), glide: 0.3, punch: [cue.hundreds],
    peck: { rate: 6, chips: true, flash: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => <BigLabel text="400 g" appear={cue.hundreds} t={t} /> },
  { name: "football comparison", t: cue.football, a: S(HEAD, 2.7, 50, 10), b: S(HEAD, 2.3, 78, 5),
    peck: { rate: 6, chips: true, shake: false }, bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => <GChart t={t} start={cue.football} wood={cue.concussions + 0.4} /> },

  // ---------- BEAK
  { name: "beak grows (orbit)", t: cue.beak, a: S([1.12, 0.98, 0], 1.35, -24, 8), b: S([1.12, 0.98, 0], 1.15, 30, 4),
    bird: ({ t }) => ({ peck: 0.55, beakLen: 0.12 + 0.88 * ramp(t, cue.beakW - 0.1, 0.6) }),
    extra: ({ t }) => <Arrow3D a={[0.62, 1.35, 0.25]} b={[0.86, 1.07, 0.03]} progress={ramp(t, cue.chisel - 0.1, 0.35)} color="#ffe14d" /> },
  { name: "bare bone chips", t: cue.bare, a: S([1.25, 0.95, 0], 1.75, 14, -4), b: S([1.25, 0.95, 0], 1.45, -10, 0),
    peck: { rate: 3, amp: 0.45, flash: false }, punch: [cue.chip],
    bird: ({ t, pk }) => ({ peck: pk!.peck, beakWear: ramp(t, cue.chip, 0.6) }),
    extra: ({ t }) => (
      <>
        <ChipBurst age={(t - cue.chip) * 0.8} seed={77} origin={[0.9, 1.0, 0.02]} color="#8e9196" count={12} dir={[-0.3, 0.5, 0.6]} />
        <ChipBurst age={(t - cue.chip - 0.33) * 0.8} seed={78} origin={[0.9, 1.0, 0.02]} color="#8e9196" count={8} dir={[-0.3, 0.5, 0.6]} />
      </>
    ) },

  // ---------- KERATIN
  { name: "keratin sweeps on", t: cue.coat, a: S([1.15, 0.97, 0], 1.25, -10, 0), b: S([1.15, 0.97, 0], 1.05, 42, 10), glide: 0.3,
    bird: ({ t }) => ({ peck: 0.55, keratin: 1, keratinGrow: ramp(t, cue.keratin - 0.1, 0.7), beakWear: 1 - ramp(t, cue.keratin, 0.7) }) },
  { name: "fingernails / keeps growing", t: cue.fingernails, a: S(BEAKT, 0.9, 42, 10), b: S(BEAKT, 0.72, 62, 14),
    bird: ({ t }) => ({ peck: 0.55, keratin: 1, keratinGrow: 1 + 0.06 * Math.sin(t * 6) * ramp(t, cue.growing, 0.3) }),
    extra: ({ t }) => <ConveyorArrows t={t} on={ramp(t, cue.growing - 0.1, 0.3)} /> },
  { name: "sharpens itself", t: cue.sharpens, a: S([1.2, 0.9, 0], 1.6, 22, 0), b: S([1.2, 0.9, 0], 1.35, 36, 0), punch: [cue.sharpens + 0.3],
    peck: { rate: 3, chips: true, flash: true, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck, keratin: 1 }) },

  // ---------- BRAIN SLAMS
  { name: "brain slams (push into x-ray)", t: cue.brain, a: S(BRAIN, 2.5, 28, 5), b: S(BRAIN, 1.45, 10, 5),
    peck: { rate: 2.6, amp: 0.35, shake: true },
    bird: ({ t, pk }) => {
      const p = pulse(pk, 0.2);
      return { peck: pk!.peck, xray: true, t, brainScale: 1.6, fluid: 1, brainForward: 0.03 + 0.11 * p, brainWobble: 0.5 * p, brainHurt: 0.25 + 0.75 * p };
    },
    extra: ({ pk }) => <ImpactFlash age={pk!.age} pos={[BIRD_X - 0.24, 0.97, 0.15]} size={0.8} color="#ff4d5e" /> },
  { name: "front of skull (high angle)", t: cue.front, a: S(BRAIN, 1.45, 10, 5), b: S(BRAIN, 1.3, -25, 32), glide: 0.3,
    peck: { rate: 2.6, amp: 0.35, shake: true },
    bird: ({ t, pk }) => {
      const p = pulse(pk, 0.2);
      return { peck: pk!.peck, xray: true, t, brainScale: 1.6, fluid: 1, brainForward: 0.03 + 0.11 * p, brainWobble: 0.5 * p, brainHurt: 0.25 + 0.75 * p };
    },
    extra: ({ pk }) => <ImpactFlash age={pk!.age} pos={[BIRD_X - 0.24, 0.97, 0.15]} size={0.8} color="#ff4d5e" /> },

  // ---------- SHRINK
  { name: "shrink it", t: cue.shrink, a: S(BRAIN, 1.3, -25, 32), b: S(BRAIN, 1.12, -45, 10), glide: 0.3, punch: [cue.shrinkW],
    bird: ({ t }) => {
      const k = ramp(t, cue.shrinkW, 0.7);
      return { peck: 1, xray: true, t, brainScale: lerp(1.6, 1, k), fluid: 1, brainHurt: 0.25 * (1 - k), arrows: ramp(t, cue.shrinkW - 0.15, 0.2), arrowsIn: k };
    } },
  { name: "pack it tight / can't slosh", t: cue.pack, a: S(BRAIN, 1.1, 30, 5), b: S(BRAIN, 0.85, 14, 0),
    peck: { rate: 3, amp: 0.3 },
    bird: ({ t, pk }) => ({ peck: t > cue.slosh - 0.4 ? pk!.peck : 1, xray: true, t, brainScale: 1, fluid: 1 - 0.9 * ramp(t, cue.pack + 0.2, 0.9), arrows: 1, arrowsIn: 1 }) },

  // ---------- EYES: chips fly from the impact into the eye; later the third eyelid deflects them
  { name: "wood chips at you", t: cue.woodChips, a: S([1.22, 0.93, 0.15], 1.65, -10, 4), b: S([1.25, 0.94, 0.18], 1.4, -2, 4),
    peck: { rate: 2.6, amp: 0.3, shake: true }, bird: ({ pk }) => ({ peck: pk!.peck }),
    extra: ({ t, pk }) => (
      <>
        <EyeChips age={pk!.age} seed={pk!.hitIdx + 700} deflect={false} />
        <Arrow3D a={[1.02, 1.02, 0.08]} b={[EYE_W[0] - 0.04, EYE_W[1] + 0.06, EYE_W[2]]} progress={ramp(t, T("chips") - 0.1, 0.3)} color="#ff4d5e" width={0.014} />
      </>
    ) },
  { name: "straight at your eyes (push)", t: cue.straight, a: S(EYE, 1.0, -28, 2), b: S(EYE, 0.72, -18, 0), glide: 0.3,
    peck: { rate: 2.6, amp: 0.3 }, bird: ({ pk }) => ({ peck: pk!.peck }),
    extra: ({ pk }) => <EyeChips age={pk!.age} seed={pk!.hitIdx + 800} deflect={false} /> },
  { name: "third eyelid", t: cue.eyelid, a: S(EYE, 0.72, -18, 0), b: S(EYE, 0.64, 12, 3), glide: 0.2, punch: [cue.snaps],
    peck: { rate: 1.6, amp: 0.25 },
    bird: ({ t, pk }) => ({ peck: pk!.peck, membrane: t < cue.snaps ? 0 : eyelidAt(pk!.age) }),
    extra: ({ t, pk }) => <EyeChips age={pk!.age} seed={pk!.hitIdx + 900} deflect={t - Math.max(pk!.age, 0) >= cue.snaps - 0.25} /> },
  { name: "split second (slow-mo)", t: cue.split, a: S(EYE, 0.78, 12, 3), b: S(EYE, 0.78, 45, 8),
    peck: { rate: 0.8, amp: 0.25, slow: true },
    bird: ({ pk }) => ({ peck: pk!.peck, membrane: eyelidAt(pk!.age * 0.35) }),
    extra: ({ pk }) => <EyeChips age={pk!.age * 0.35} seed={pk!.hitIdx + 1000} deflect /> },

  // ---------- BOUNCE
  { name: "bounces off the tree", t: cue.bounce, a: S(BODY, 4.0, 70, 8), b: S(BODY, 3.5, 48, 4),
    peck: { rate: 2.4, chips: true, shake: true },
    bird: ({ pk }) => {
      const a = pk!.age;
      return { peck: pk!.peck, shift: a >= 0 && a < 0.38 ? 0.45 * Math.sin((Math.PI * a) / 0.38) : 0 };
    },
    extra: ({ pk }) => <Arrow3D a={[1.75, 0.2, 0.5]} b={[2.35, 0.2, 0.5]} progress={pk!.age >= 0 && pk!.age < 0.35 ? pk!.age / 0.2 : 0} color="#ff4d5e" width={0.03} /> },

  // ---------- GRIP + TRIPOD
  { name: "grab on (toes clamp)", t: cue.grab, a: S(FEET, 1.35, -8, -34), b: S(FEET, 1.15, 14, -24), punch: [cue.grabW],
    bird: ({ t }) => ({ peck: 1, toeGrip: ramp(t, cue.grabW - 0.1, 0.35) }) },
  { name: "two toes forward, two back", t: cue.twoToes, a: S(FEET, 1.15, 14, -24), b: S(FEET, 1.05, -16, -14), glide: 0.25,
    bird: ({ t }) => ({ peck: 1, toeGlow: 0.5 + 0.5 * Math.sin(t * 9) * (t > cue.twoToes ? 1 : 0) }) },
  { name: "jam your stiff tail", t: cue.jam, a: S([1.3, -0.95, 0], 2.7, 28, 4), b: S([1.3, -1.05, 0], 2.3, 44, 0), punch: [cue.tail],
    bird: ({ t }) => ({ peck: 1, tailAngle: lerp(-0.1, -0.55, ramp(t, cue.jam, cue.tail + 0.2 - cue.jam)) }),
    extra: ({ t }) => <ImpactFlash age={t - cue.tail - 0.2} pos={[1.12, -1.58, 0.12]} size={0.8} color="#ffffff" /> },
  { name: "like a tripod (orbit reveal)", t: cue.tripod, a: S(TRIC, 2.8, 35, 8), b: S(TRIC, 2.6, 78, 12), glide: 0.45,
    bird: () => ({ peck: 1, ghost: true }),
    extra: ({ t }) => <Tripod t={t} feet={ramp(t, cue.tripod - 0.1, 0.25)} tail={ramp(t, cue.tripod + 0.1, 0.25)} lines={ramp(t, cue.tripod + 0.2, 0.7)} /> },

  // ---------- BUGS + TONGUE
  { name: "bugs deep inside (dive into trunk)", t: cue.bugs, a: S(HOLE, 2.4, 32, 10), b: S([0.5, 0.88, 0], 1.05, 14, 4),
    ghostTrunk: ({ t }) => ramp(t, cue.bugs + 0.3, 0.6), bird: () => ({ peck: 0.75 }),
    extra: ({ t }) => (
      <>
        <Grub t={t} />
        <Arrow3D a={[0.2, 1.3, 0.2]} b={[0.38, 0.98, 0.05]} progress={ramp(t, cue.deep, 0.35)} color="#ffe14d" />
      </>
    ) },
  { name: "tongue wraps the skull (camera follows tip)", t: cue.tongue, a: S(HEAD, 1.2, 18, 8), b: S(HEAD, 1.05, 30, 10),
    track: ({ t }) => (t > cue.wraps - 0.3 ? tipWorld(tongueProgress(t)) : null),
    ghostTrunk: () => 1, bird: ({ t }) => ({ peck: 1, xray: true, t, tongue: tongueProgress(t) }),
    extra: ({ t }) => <Grub t={t} /> },
  { name: "barbs spear the grub", t: cue.barbs, a: S(HOLE, 1.1, 20, 6), b: S(HOLE, 0.9, 5, 4), glide: 0.35, punch: [cue.spear + 0.2],
    ghostTrunk: () => 1, bird: ({ t }) => ({ peck: 1, xray: true, t, tongue: tongueProgress(t) }),
    extra: ({ t }) => <Grub t={t} pull={0.85 * ramp(t, cue.them, 0.5)} /> },

  // ---------- HELMET
  { name: "spongy bone plates fly in", t: cue.safe, a: S(BRAIN, 1.95, 42, 10), b: S(BRAIN, 1.7, 18, 6),
    bird: ({ t }) => ({ peck: 1, xray: true, t, helmet: ramp(t, cue.line, cue.helmet + 0.3 - cue.line) }) },
  { name: "like a helmet (orbit)", t: cue.helmet, a: S(BRAIN, 1.7, 18, 6), b: S(BRAIN, 1.6, -38, 16), glide: 0.25,
    bird: ({ t }) => ({ peck: 1, xray: true, t, helmet: 1 }) },

  // ---------- TWIST
  { name: "here is what nobody tells you", t: cue.nobody, a: S(HEAD, 3.1, 35, -16), b: S(HEAD, 2.1, 22, -10), vignette: 0.55,
    peck: { rate: 1.2, amp: 0.4 }, bird: ({ pk }) => ({ peck: pk!.peck }) },
  { name: "helmet does almost nothing (crumbles)", t: cue.helmetDoes, a: S(BRAIN, 1.45, 0, 5), b: S(BRAIN, 1.25, 16, 5), punch: [cue.nothing],
    bird: ({ t }) => ({ peck: 1, xray: true, t, helmet: 1, helmetFall: ramp(t, cue.nothing, 0.9) }) },
  { name: "high-speed cameras (bullet time)", t: cue.high, a: S(IMP, 1.6, 62, 5), b: S(IMP, 1.6, -28, 6),
    peck: { rate: 0.9, chips: true, flash: true, slow: true }, bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => <RecOverlay t={t} start={cue.high} /> },
  { name: "it's a hammer", t: cue.hammer, a: S(HEAD, 2.2, 36, 5), b: S(HEAD, 1.9, 46, 5),
    bird: ({ t }) => ({ peck: t < cue.hammerW ? 1 - 0.9 * ramp(t, cue.hammer, 0.2) : 1 }),
    extra: ({ t }) => {
      const swing = t < cue.hammerW ? 1 - ramp(t, cue.hammer, 0.2) : 1;
      return (
        <>
          <GhostHammer swing={swing} opacity={0.75 * ramp(t, cue.hammer, 0.15)} />
          <ImpactFlash age={(t - cue.hammerW) * 0.7} size={1.6} />
          <ChipBurst age={t - cue.hammerW} seed={991} dir={[0.6, 0.5, 0.9]} />
        </>
      );
    }, punch: [cue.hammerW] },

  // ---------- TINY BRAIN
  { name: "scientists think (push into brain)", t: cue.sci, a: S(BRAIN, 2.3, 30, 8), b: S(BRAIN, 0.8, 15, 4),
    bird: ({ t }) => ({ peck: 1, xray: true, t }) },
  { name: "tiny brain", t: cue.tiny, a: S(BRAIN, 0.8, 15, 4), b: S(BRAIN, 0.68, -10, 6), glide: 0.2, punch: [cue.tiny],
    bird: ({ t }) => ({ peck: 1, xray: true, t, brainGlow: 0.6 + 0.4 * Math.sin(t * 8), arrows: 1, arrowsIn: 1 }) },
  { name: "too light to get hurt", t: cue.light, a: S(BRAIN, 1.25, 40, 5), b: S(BRAIN, 1.1, 18, 5),
    peck: { rate: 3, amp: 0.3, flash: true }, bird: ({ t, pk }) => ({ peck: pk!.peck, xray: true, t, brainGlow: 0.5 }),
    extra: ({ t }) => <ForceArrows t={t} amount={ramp(t, cue.light, 0.3)} /> },

  // ---------- ENDING
  { name: "congratulations (swoop to front)", t: cue.congrats, a: S(HEAD, 4.2, 75, 10), b: S(HEAD, 2.6, -24, 6),
    bird: ({ t }) => ({ peck: 1, look: ramp(t, cue.congrats + 0.4, 0.6), wink: t > cue.wood + 0.25 && t < cue.wood + 0.75 }),
    extra: ({ t }) => <ChipBurst age={(t - cue.congrats) * 0.7} seed={5150} count={28} dir={[0.2, 1.2, 0.6]} origin={[1.2, 1.3, 0.2]} color="#ffe14d" /> },
];

function tongueProgress(t: number) {
  const wrap = 0.78 * ramp(t, cue.tongue + 0.7, cue.skull2 + 0.35 - cue.tongue - 0.7);
  const shoot = 0.22 * ramp(t, cue.barbs - 0.1, cue.spear + 0.3 - cue.barbs + 0.1);
  const retract = 0.22 * ramp(t, cue.them, 0.5);
  return wrap + shoot - retract;
}

const shotEnd = (i: number) => (i + 1 < SHOTS.length ? SHOTS[i + 1].t : DURATION_FRAMES / FPS);

const HITS: { t: number; slow: boolean; vol: number }[] = SHOTS.flatMap((s, i) => {
  if (!s.peck) return [];
  const out: { t: number; slow: boolean; vol: number }[] = [];
  for (let k = 0; ; k++) {
    const t = s.t + 0.12 + k / s.peck.rate;
    if (t >= shotEnd(i)) break;
    out.push({ t, slow: !!s.peck.slow, vol: (s.peck.amp ?? 1) < 0.5 ? 0.18 : 0.32 });
  }
  return out;
}).concat([{ t: cue.hammerW, slow: false, vol: 0.6 }, { t: cue.chip, slow: false, vol: 0.4 }]);

// ---------------------------------------------------------------- overlays
const BigLabel: React.FC<{ text: string; sub?: string; appear: number; t: number }> = ({ text, sub, appear }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear * fps, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
      <div style={{
        fontFamily, fontWeight: 900, fontSize: 160, color: "#ffffff", WebkitTextStroke: "10px #1d2f6f", paintOrder: "stroke fill",
        textShadow: "0 10px 0 #12204f, 0 18px 30px rgba(0,0,0,0.35)", transform: `rotate(-4deg) scale(${0.3 + 0.7 * s})`, opacity: Math.min(1, s * 2), transformOrigin: "right center",
      }}>{text}</div>
      {sub && (
        <div style={{
          marginTop: 30, fontFamily, fontWeight: 900, fontSize: 44, color: "#ffffff", background: "rgba(18,32,79,0.88)", padding: "12px 26px", borderRadius: 18,
          transform: `scale(${0.4 + 0.6 * s})`, opacity: Math.min(1, s * 2), transformOrigin: "right center",
        }}>{sub}</div>
      )}
    </AbsoluteFill>
  );
};

/** Animated bar comparison: football concussion (~100 g) vs woodpecker (~400 g). */
const GChart: React.FC<{ t: number; start: number; wood: number }> = ({ t, start, wood }) => {
  const a = easeOut(clamp01((t - start) / 0.5));
  const b = easeOut(clamp01((t - wood) / 0.6));
  const bar = (label: string, value: string, w: number, color: string, k: number) => (
    <div style={{ marginBottom: 28, opacity: Math.min(1, k * 3) }}>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 40, color: "#fff", textShadow: "0 3px 8px rgba(0,0,0,0.5)", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: w * k, height: 64, background: color, borderRadius: 14, boxShadow: "0 8px 20px rgba(0,0,0,0.3)" }} />
        <div style={{ fontFamily, fontWeight: 900, fontSize: 56, color: "#fff", WebkitTextStroke: "4px #1d2f6f", paintOrder: "stroke fill", opacity: k }}>{value}</div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ padding: "260px 0 0 70px" }}>
      {bar("FOOTBALL CONCUSSION", "~100 g", 170, "#3fe6ff", a)}
      {bar("WOODPECKER, EVERY PECK", "400 g", 680, "#ff3b3b", b)}
    </AbsoluteFill>
  );
};

const RecOverlay: React.FC<{ t: number; start: number }> = ({ t, start }) => (
  <AbsoluteFill style={{ padding: "150px 0 0 70px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: "monospace", fontWeight: 700, fontSize: 46, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
      <div style={{ width: 30, height: 30, borderRadius: 15, background: "#ff2d2d", opacity: Math.floor(t * 2) % 2 ? 0.25 : 1 }} />
      REC · 1000 FPS
    </div>
    <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 38, color: "#fff", marginTop: 12, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
      FRAME {String(Math.floor((t - start) * 1000)).padStart(5, "0")}
    </div>
  </AbsoluteFill>
);

/** Little chevrons travelling along the beak toward the tip ("keeps growing"). */
const ConveyorArrows: React.FC<{ t: number; on: number }> = ({ t, on }) => {
  if (on <= 0) return null;
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const ph = (t * 1.2 + i / 3) % 1;
        const x = 1.2 - ph * 0.32;
        const y = 1.02 + ph * 0.05;
        return <Arrow3D key={i} a={[x, y + 0.12, 0.08]} b={[x - 0.1, y + 0.1, 0.08]} color="#ffe14d" width={0.012} opacity={on * Math.sin(ph * Math.PI)} />;
      })}
    </group>
  );
};

// ---------------------------------------------------------------- camera
type CamOut = { p: V3; t: V3; f: number };
const shotSpecAt = (i: number, t: number, ctx: Ctx): Spec => {
  const s = SHOTS[i];
  const k = easeInOut(clamp01((t - s.t) / (shotEnd(i) - s.t)));
  let spec = lerpSpec(s.a, s.b, k);
  const tr = s.track?.(ctx);
  if (tr) spec = { ...spec, tg: lerp3(spec.tg, tr, 0.85) };
  return spec;
};
const cameraAt = (i: number, t: number, ctx: Ctx): CamOut => {
  const s = SHOTS[i];
  let spec = shotSpecAt(i, t, ctx);
  if (s.glide && i > 0) {
    const g = clamp01((t - s.t) / s.glide);
    if (g < 1) spec = lerpSpec(SHOTS[i - 1].b, spec, easeInOut(g));
  }
  // handheld drift: never perfectly still
  spec = { ...spec, yaw: spec.yaw + 1.4 * Math.sin(t * 0.6) + 0.6 * Math.sin(t * 1.3 + 2), pitch: spec.pitch + 0.7 * Math.sin(t * 0.8 + 1) };
  // punch-in zooms
  const pb = (s.punch ?? []).reduce((m, pt) => Math.max(m, bump(t - pt)), 0);
  spec = { ...spec, f: spec.f * (1 - 0.16 * pb) };
  let tg = spec.tg;
  // impact shake
  if (s.peck?.shake && ctx.pk) {
    const p = pulse(ctx.pk, 0.12);
    tg = add3(tg, [(rnd(ctx.pk.hitIdx, 1) - 0.5) * 0.05 * p, (rnd(ctx.pk.hitIdx, 2) - 0.5) * 0.05 * p, 0]);
  }
  return { p: specPos({ ...spec, tg: spec.tg }), t: tg, f: spec.f };
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

// ---------------------------------------------------------------- composition
export const shotIndexAt = (t: number) => {
  let i = SHOTS.length - 1;
  while (i > 0 && t < SHOTS[i].t) i--;
  return i;
};
export const SHOT_LIST = SHOTS.map((s, i) => ({ name: s.name, t: s.t, end: shotEnd(i), glide: !!s.glide }));

export const WoodpeckerVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  const i = shotIndexAt(t);
  const sc = SHOTS[i];
  const lt = clamp01((t - sc.t) / (shotEnd(i) - sc.t));
  const pk = sc.peck ? peckAt(t, sc.t, sc.peck.rate, sc.peck.amp ?? 1) : null;
  const ctx: Ctx = { t, lt, pk };
  const cam = cameraAt(i, t, ctx);
  const bird = sc.bird(ctx);
  const slow = sc.peck?.slow ? 0.35 : 1;

  return (
    <AbsoluteFill style={{ background: C.sky }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true }}>
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fog, 9, 38]} />
        <CameraRig cam={cam} />
        <hemisphereLight args={["#eaf6ff", "#6b5a44", 0.9]} />
        <directionalLight position={[6, 8, 7]} intensity={2.4} color="#fff1dc" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0005} />
        <directionalLight position={[-5, 2, -4]} intensity={0.6} color="#bfdcff" />
        <directionalLight position={[2, 4, -7]} intensity={2.2} color="#ffffff" />
        <Forest />
        <Trunk ghost={sc.ghostTrunk ? sc.ghostTrunk(ctx) : 0} />
        <Woodpecker t={t} {...bird} />
        {pk && sc.peck?.chips && <ChipBurst age={pk.age * slow} seed={pk.hitIdx + i * 100} dir={sc.peck.dir} color={sc.peck.chipColor} />}
        {pk && sc.peck?.flash && <ImpactFlash age={pk.age * slow} />}
        {sc.extra?.(ctx)}
      </ThreeCanvas>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${55 - (sc.vignette ?? 0) * 25}%, rgba(0,0,0,${0.22 + (sc.vignette ?? 0) * 0.5}) 100%)` }} />
      {sc.overlay?.(ctx)}
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("voiceover.wav")} />
      {HITS.map((h, n) => (
        <Sequence key={n} from={Math.round(h.t * FPS)} durationInFrames={8} layout="none">
          <Audio src={staticFile("knock.wav")} volume={h.slow ? 0.55 : h.vol} playbackRate={h.slow ? 0.6 : 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
