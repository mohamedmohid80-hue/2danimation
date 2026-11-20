import React, { useLayoutEffect } from "react";
import { AbsoluteFill, Audio, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import rawWords from "../data/camel_words.json";
import { Captions, fontFamily } from "../wp/captions";
import { DetailedCamel, useCamelRig } from "./DetailedCamel";
import {
  Arrow3D, Bottle, COL, CamelState, Desert, Drops, Fish, HeatArrows, OASIS, Oasis, SandRing, Sandstorm, Stars, Sun, V3, VESSEL, Vessel, rnd, sunPos,
} from "./model";

export const FPS = 30;
export const AUDIO_SECONDS = 64.43;
const GAG_SECONDS = 3.4;
export const DURATION_FRAMES = Math.ceil((AUDIO_SECONDS + GAG_SECONDS) * FPS);

// ---------------------------------------------------------------- words & cues
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
const lastWordEnd = WORDS[WORDS.length - 1].e;

const cue = {
  sahara: T("sahara"), bottle: T("bottle"), lunchLine: T("you're done"), lunch: T("lunch"),
  grow: T("so you grow a body"), growW: T("grow"), wind: T("but the wind"), blasts: T("blasts"), straight: T("straight up"),
  nostrils: T("so your nostrils"), snap: T("snap"), lashes: T("and a double"), eyelashes: T("eyelashes"),
  step: T("but every step"), sinks: T("sinks"), feet: T("so you grow wide"), padded: T("padded"), spread: T("spread out"), snowshoes: T("snowshoes"),
  sun: T("but the sun"), sweating: T("and sweating"), instead: T("so instead"), heatUp: T("heat up"), six: T("6"), cool: T("and cool"), night: T("night"),
  pee: T("but every time"), kidneys: T("so your kidneys"), squeeze: T("squeeze"), back: T("back into"),
  food: T("but there's no food"), weeks: T("weeks"), pack: T("so you pack"), packW: T("pack"), kilos: T("35"), hump: T("hump"),
  notWater: T("not water"), water: T("water", T("not")), fat: T("fat", T("not")), keeping: T("keeping"), coolOff: T("cool off"),
  days: T("but after days"), blood: T("your blood starts"), thicken: T("thicken"), cells: T("so your blood cells"), oval: T("oval"),
  swell: T("and they can swell"), swellW: T("swell"), finally: T("when you finally"), hundred: T("100"),
  congrats: T("congratulations"), camelW: T("camel", T("congratulations")),
};
const GAG = lastWordEnd + 0.35; // slurp starts

// ---------------------------------------------------------------- math
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const ramp = (t: number, start: number, dur: number) => easeInOut(clamp01((t - start) / dur));
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

// focus points on the camel (standing at origin, facing +x)
const BOTTLE: V3 = [0, 0.5, 0];
const BODY: V3 = [0.3, 1.6, 0];
const HEAD: V3 = [1.95, 2.72, 0];
const NOSE: V3 = [2.27, 2.63, 0];
const EYE: V3 = [1.93, 2.79, 0.15];
const FOOT: V3 = [0.7, 0.12, 0.2];
const HUMP: V3 = [-0.05, 2.2, 0];
const KIDNEY: V3 = [-0.32, 1.78, 0];

// ---------------------------------------------------------------- world state per shot
type World = {
  camel?: CamelState;
  bottle?: { level: number; tip: number; visible: number };
  sunK?: number;
  night?: number;
  storm?: { amount: number; focus: V3; deflect?: boolean };
  vessel?: { oval: number; thick: number; water: number; swell: number };
  oasisWater?: number;
  fish?: { flop: number; look: number; blink: number };
  extra?: React.ReactNode;
};
type Ctx = { t: number };
type Shot = {
  name: string;
  t: number;
  a: Spec;
  b: Spec;
  glide?: number;
  punch?: number[];
  shake?: (c: Ctx) => number;
  track?: (c: Ctx) => V3 | null;
  world: (c: Ctx) => World;
  overlay?: (c: Ctx) => React.ReactNode;
};

const standing = (t: number, extra: Partial<CamelState> = {}): CamelState => ({ t, blink: blinkAt(t), ...extra });
const blinkAt = (t: number) => (t % 3.7 < 0.12 ? 1 : 0);

const SHOTS: Shot[] = [
  // ---------- HOOK
  { name: "crane down to a lone bottle", t: 0, a: S([0, 0.5, 0], 14, 25, 22), b: S(BOTTLE, 3.0, 20, 8),
    world: () => ({ sunK: 0.18, bottle: { level: 1, tip: 0, visible: 1 } }),
    overlay: ({ t }) => t > cue.sahara && <BigLabel text="50°C" appear={cue.sahara} /> },
  { name: "one bottle of water", t: cue.bottle - 0.2, a: S(BOTTLE, 2.2, 35, 6), b: S(BOTTLE, 1.85, 58, 4), glide: 0.3, punch: [cue.bottle],
    world: () => ({ sunK: 0.2, bottle: { level: 1, tip: 0, visible: 1 } }),
    overlay: () => <BigLabel text="50°C" appear={cue.sahara} /> },
  { name: "done by lunch: sun races overhead, bottle drains + topples", t: cue.lunchLine, a: S(BOTTLE, 3.6, 62, 12), b: S(BOTTLE, 3.1, 100, 16),
    world: ({ t }) => ({ sunK: lerp(0.2, 0.5, ramp(t, cue.lunchLine, 0.9)), bottle: { level: 1 - ramp(t, cue.lunchLine, 0.75), tip: clamp01((t - cue.lunch - 0.15) / 0.5), visible: 1 } }) },

  // ---------- A BODY THAT WASTES NOTHING
  { name: "camel rises out of the sand (hero orbit)", t: cue.grow, a: S(BODY, 13, 42, 4), b: S(BODY, 10.5, 18, 8),
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { grow: ramp(t, cue.growW, 1.2) }),
      extra: <SandBurst age={t - cue.growW} /> }) },

  // ---------- SAND
  { name: "wind blasts sand", t: cue.wind, a: S([1.1, 2.2, 0], 5.2, 30, 6), b: S([1.3, 2.3, 0], 4.4, 14, 4), shake: () => 0.6,
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t), storm: { amount: ramp(t, cue.wind, 0.4), focus: NOSE } }) },
  { name: "straight up your nose (push)", t: cue.straight, a: S(NOSE, 2.0, 42, 4), b: S(NOSE, 1.6, 30, 2), glide: 0.3, shake: () => 0.4,
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t), storm: { amount: 1, focus: NOSE } }),
    overlay: () => null },
  { name: "nostrils snap shut", t: cue.nostrils, a: S(NOSE, 1.6, 30, 2), b: S(NOSE, 1.45, 58, 5), punch: [cue.snap],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { nostrils: 1 - ramp(t, cue.snap, 0.15) }), storm: { amount: 1, focus: NOSE, deflect: t > cue.snap + 0.1 } }) },
  { name: "double row of eyelashes", t: cue.lashes, a: S(EYE, 1.0, 22, 6), b: S(EYE, 0.8, 48, 8), glide: 0.3, punch: [cue.eyelashes],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { nostrils: 0, lashGlow: ramp(t, cue.eyelashes - 0.1, 0.3) * (0.6 + 0.4 * Math.sin(t * 9)) }), storm: { amount: 1, focus: EYE, deflect: true } }) },

  // ---------- FEET
  { name: "every step sinks (walking, low side)", t: cue.step, a: S([0.3, 1.1, 0], 10.5, 25, 2), b: S([0.4, 0.9, 0], 8.8, 42, -2),
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { walk: t * 4, walkAmt: 1, sink: ramp(t, cue.sinks, 0.5) }) }) },
  { name: "wide padded feet grow (foot macro)", t: cue.feet, a: S([0.72, 0.08, 0.2], 1.7, 35, 24), b: S([0.72, 0.08, 0.2], 1.45, 62, 28), punch: [cue.padded],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { sink: 1 - ramp(t, cue.padded, 0.5), padSpread: ramp(t, cue.padded - 0.1, 0.5) }) }) },
  { name: "spread out like snowshoes (ground level)", t: cue.spread, a: S([0.75, 0.15, 0.2], 2.0, 18, 10), b: S([0.75, 0.15, 0.2], 1.7, 44, 12),
    world: ({ t }) => {
      const k = (t - cue.spread) % 0.9;
      return { sunK: 0.45, camel: standing(t, { padSpread: 1 }), extra: (
        <>
          <SandRing pos={[0.75, 0, 0.2]} k={k / 0.6} />
          {[[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].map((d, i) => (
            <Arrow3D key={i} a={[0.75 + d[0] * 0.28, 0.05, 0.2 + d[2] * 0.25]} b={[0.75 + d[0] * 0.6, 0.05, 0.2 + d[2] * 0.55]} progress={ramp(t, cue.snowshoes - 0.2, 0.3)} color="#ffffff" width={0.018} />
          ))}
        </>
      ) };
    } },

  // ---------- HEAT
  { name: "the sun cooks you (low angle, heat map)", t: cue.sun, a: S([0.4, 1.9, 0], 9.5, -34, -10), b: S([0.4, 1.9, 0], 8.2, -14, -5),
    world: ({ t }) => ({ sunK: 0.5, camel: standing(t, { heat: 0.75 * ramp(t, cue.sun + 0.3, 0.6) }), extra: <HeatArrows t={t} center={[0.2, 2.6, 0.2]} amount={ramp(t, cue.sun + 0.3, 0.4)} /> }) },
  { name: "sweating pours water away", t: cue.sweating, a: S([0.1, 2.0, 0], 3.5, 30, 8), b: S([0.1, 2.0, 0], 3.0, 52, 6), glide: 0.25,
    world: ({ t }) => ({ sunK: 0.5, camel: standing(t, { heat: 0.75 }), extra: <Drops t={t} from={[0.1, 2.15, 0.3]} dir={[0, 1.4, 0.3]} amount={1} /> }) },
  { name: "so instead of sweating (thermometer)", t: cue.instead, a: S(BODY, 9.0, 10, 5), b: S(BODY, 8.2, 25, 5),
    world: ({ t }) => ({ sunK: 0.5, camel: standing(t, { heat: 0.2 }) }),
    overlay: ({ t }) => <Thermo t={t} appear={cue.instead} value={34} /> },
  { name: "heat up by 6 degrees in the day", t: cue.heatUp, a: S(BODY, 8.2, 25, 5), b: S(BODY, 7.6, 42, 6), glide: 0.2, punch: [cue.six],
    world: ({ t }) => ({ sunK: 0.5, camel: standing(t, { heat: lerp(0.2, 0.95, ramp(t, cue.heatUp, 1.2)) }), extra: <HeatArrows t={t} center={[0.2, 2.6, 0.2]} amount={0.8} /> }),
    overlay: ({ t }) => <Thermo t={t} appear={cue.instead} value={lerp(34, 40, ramp(t, cue.heatUp, 1.2))} badge={t > cue.six ? "+6°" : undefined} /> },
  { name: "cool back down at night (day→night orbit)", t: cue.cool, a: S(BODY, 7.6, 42, 6), b: S(BODY, 9.0, 82, 12),
    world: ({ t }) => {
      const n = ramp(t, cue.cool, 1.0);
      return { sunK: lerp(0.5, 1.0, n), night: n, camel: standing(t, { heat: lerp(0.95, -0.8, n) }) };
    },
    overlay: ({ t }) => <Thermo t={t} appear={cue.instead} value={lerp(40, 34, ramp(t, cue.cool, 1.0))} /> },

  // ---------- WATER LOSS + KIDNEYS
  { name: "every time you pee (x-ray, water drips out)", t: cue.pee, a: S([0.1, 1.6, 0], 7.0, 10, 4), b: S([-0.1, 1.6, 0], 5.8, 26, 2),
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { xray: true }), extra: <Drops t={t} from={[-0.55, 1.3, 0]} dir={[-0.25, -1.2, 0]} amount={ramp(t, cue.pee + 0.4, 0.3)} /> }) },
  { name: "kidneys squeeze water back", t: cue.kidneys, a: S(KIDNEY, 2.2, 15, 6), b: S(KIDNEY, 1.8, 36, 8), punch: [cue.squeeze],
    world: ({ t }) => {
      const sq = t > cue.squeeze ? 0.5 + 0.5 * Math.sin((t - cue.squeeze) * 12) : 0;
      return { sunK: 0.45, camel: standing(t, { xray: true, kidneySqueeze: sq, kidneyGlow: sq * 0.8 }), extra: (
        <group>
          {[0, 1, 2, 3, 4].map((i) => {
            const ph = (t * 1.2 + i / 5) % 1;
            const a = (i / 5) * Math.PI * 2;
            const from: V3 = [KIDNEY[0], KIDNEY[1], 0.15];
            const to: V3 = [KIDNEY[0] + Math.cos(a) * 0.7, KIDNEY[1] + Math.sin(a) * 0.45, 0.15];
            return <Arrow3D key={i} a={lerp3(from, to, ph * 0.5)} b={lerp3(from, to, 0.3 + ph * 0.7)} color={COL.water} width={0.016} opacity={ramp(t, cue.back - 0.2, 0.3) * Math.sin(ph * Math.PI)} />;
          })}
        </group>
      ) };
    } },

  // ---------- FOOD + HUMP
  { name: "no food for weeks (time-lapse days)", t: cue.food, a: S(BODY, 16, 30, 10), b: S(BODY, 12.5, 48, 12),
    world: ({ t }) => {
      const k = ((t - cue.food) * 0.9) % 1;
      return { sunK: k, night: clamp01(Math.abs(k - 0.5) * 2.4 - 0.9), camel: standing(t) };
    },
    overlay: ({ t }) => <DayCounter t={t} start={cue.food} /> },
  { name: "35 kilos of fat in the hump (x-ray)", t: cue.pack, a: S(HUMP, 4.0, 25, 10), b: S(HUMP, 3.3, 46, 14), punch: [cue.kilos],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { xray: true, hump: lerp(1, 1.35, ramp(t, cue.packW, 0.8)), fat: ramp(t, cue.packW, 1.0) }) }),
    overlay: ({ t }) => t > cue.kilos && <BigLabel text="35 kg" appear={cue.kilos} /> },
  { name: "not water, fat", t: cue.notWater, a: S([-0.05, 2.3, 0], 3.2, 10, 8), b: S([-0.05, 2.3, 0], 2.8, -15, 8), punch: [cue.fat],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { xray: true, hump: 1.35, fat: 1 }) }),
    overlay: ({ t }) => <NotWater t={t} water={cue.water} fat={cue.fat} /> },
  { name: "rest of the body cools off (heat leaves)", t: cue.keeping, a: S(BODY, 8.6, 40, 12), b: S(BODY, 7.4, 70, 14),
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { hump: 1.35, heat: -0.65 * ramp(t, cue.coolOff - 0.6, 0.8) }),
      extra: <HeatArrows t={t} center={[0.3, 2.0, 0.45]} amount={ramp(t, cue.keeping + 0.3, 0.4)} color="#ffb03a" spread={1.8} /> }) },

  // ---------- BLOOD
  { name: "days with nothing to drink (droopy, harsh sun)", t: cue.days, a: S(HEAD, 5.0, 30, 4), b: S(BODY, 8.5, 20, 6),
    world: ({ t }) => ({ sunK: 0.5, camel: standing(t, { hump: 1.15, headDown: 0.18 + 0.05 * Math.sin(t * 2), heat: 0.4 }) }) },
  { name: "blood thickens (inside a vessel)", t: cue.blood, a: S(VESSEL, 3.0, -78, 6), b: S(VESSEL, 2.6, -70, 4),
    world: () => ({ vessel: { oval: 0, thick: 1, water: 0, swell: 0 } }) },
  { name: "oval cells keep flowing (camera rides along)", t: cue.cells, a: S(VESSEL, 2.6, -70, 4), b: S(add3(VESSEL, [2, 0, 0]), 2.4, -60, 2), glide: 0.2,
    track: ({ t }) => add3(VESSEL, [(t - cue.cells) * 0.6, 0, 0]),
    world: ({ t }) => ({ vessel: { oval: ramp(t, cue.oval - 0.1, 0.5), thick: 1 - ramp(t, cue.oval, 0.6), water: 0, swell: 0 } }) },
  { name: "swell without bursting (water floods in)", t: cue.swell, a: S(VESSEL, 2.4, -60, 2), b: S(VESSEL, 1.8, -50, 4), punch: [cue.swellW],
    world: ({ t }) => ({ vessel: { oval: 1, thick: 0, water: ramp(t, cue.swell, 0.5), swell: ramp(t, cue.swellW, 0.6) } }) },
  { name: "drink 100 litres in minutes (belly fills)", t: cue.finally, a: S(BODY, 7.2, 20, 6), b: S(BODY, 6.0, 36, 6), punch: [cue.hundred],
    world: ({ t }) => ({ sunK: 0.45, camel: standing(t, { xray: true, belly: ramp(t, cue.finally + 0.3, 1.6), hump: 1.2, fat: 1 }) }),
    overlay: ({ t }) => <LitreCounter t={t} start={cue.finally + 0.3} /> },

  // ---------- ENDING + OASIS GAG
  { name: "congratulations: walk to the oasis", t: cue.congrats, a: S([2.4, 1.5, -0.3], 12, 36, 8), b: S([3.4, 1.2, -0.4], 9.0, 14, 6),
    world: ({ t }) => {
      const k = ramp(t, cue.congrats, Math.max(0.6, GAG - 0.4 - cue.congrats));
      return { sunK: 0.42, oasisWater: 1, camel: standing(t, { pos: [lerp(0, 2.55, k), 0, lerp(0, -0.6, k)], walk: t * 4, walkAmt: k < 0.98 ? 1 : 0, headDown: ramp(t, GAG - 0.45, 0.4), look: t < cue.camelW ? ramp(t, cue.congrats, 0.3) : 1 - ramp(t, cue.camelW, 0.3) }) };
    } },
  { name: "oasis gag: SLURP, pond drains, fish looks at camera", t: GAG, a: S([4.0, 0.9, -0.5], 7.5, 18, 12), b: S([4.5, 0.35, -0.3], 4.0, 10, 10),
    world: ({ t }) => {
      const drain = ramp(t, GAG + 0.05, 1.0);
      const g = t - GAG;
      return { sunK: 0.42, oasisWater: 1 - drain, camel: standing(t, { pos: [2.55, 0, -0.6], headDown: 1 - ramp(t, GAG + 1.15, 0.35), belly: 0.4 + 0.9 * drain }),
        fish: { flop: g > 1.2 && g < 2.1 ? 1 : 0, look: ramp(t, GAG + 2.15, 0.25), blink: g > 2.75 && g < 2.9 ? 1 : 0 } };
    } },
];

const shotEnd = (i: number) => (i + 1 < SHOTS.length ? SHOTS[i + 1].t : DURATION_FRAMES / FPS);

// ---------------------------------------------------------------- overlays
const BigLabel: React.FC<{ text: string; appear: number }> = ({ text, appear }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear * fps, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 160, color: "#fff", WebkitTextStroke: "10px #1d2f6f", paintOrder: "stroke fill",
        textShadow: "0 10px 0 #12204f, 0 18px 30px rgba(0,0,0,0.35)", transform: `rotate(-4deg) scale(${0.3 + 0.7 * s})`, opacity: Math.min(1, s * 2), transformOrigin: "right center" }}>{text}</div>
    </AbsoluteFill>
  );
};

const Thermo: React.FC<{ t: number; appear: number; value: number; badge?: string }> = ({ t, appear, value, badge }) => {
  const k = easeOut(clamp01((t - appear) / 0.3));
  const fill = clamp01((value - 30) / 14);
  const hot = clamp01((value - 34) / 6);
  const color = new THREE.Color("#3d8bff").lerp(new THREE.Color("#ff3b2e"), hot).getStyle();
  return (
    <AbsoluteFill style={{ padding: "230px 0 0 80px", opacity: k }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 26, transform: `scale(${0.6 + 0.4 * k})`, transformOrigin: "left top" }}>
        <div style={{ position: "relative", width: 70, height: 360 }}>
          <div style={{ position: "absolute", left: 15, top: 0, width: 40, height: 320, borderRadius: 20, background: "rgba(255,255,255,0.9)", border: "6px solid #1d2f6f" }} />
          <div style={{ position: "absolute", left: 27, bottom: 50, width: 16, height: 260 * fill, borderRadius: 8, background: color }} />
          <div style={{ position: "absolute", left: 0, bottom: 0, width: 70, height: 70, borderRadius: 35, background: color, border: "6px solid #1d2f6f" }} />
        </div>
        <div>
          <div style={{ fontFamily, fontWeight: 900, fontSize: 110, color: "#fff", WebkitTextStroke: "8px #1d2f6f", paintOrder: "stroke fill" }}>{value.toFixed(0)}°C</div>
          {badge && <div style={{ fontFamily, fontWeight: 900, fontSize: 60, color: "#fff", background: "#ff3b2e", borderRadius: 16, padding: "6px 22px", display: "inline-block" }}>{badge}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DayCounter: React.FC<{ t: number; start: number }> = ({ t, start }) => {
  const day = Math.min(21, 1 + Math.floor((t - start) * 0.9 * 1.0 * 4));
  return (
    <AbsoluteFill style={{ padding: "230px 80px 0 0", alignItems: "flex-end" }}>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 96, color: "#fff", WebkitTextStroke: "8px #1d2f6f", paintOrder: "stroke fill" }}>DAY {day}</div>
    </AbsoluteFill>
  );
};

const NotWater: React.FC<{ t: number; water: number; fat: number }> = ({ t, water, fat }) => {
  const a = easeOut(clamp01((t - water + 0.05) / 0.25));
  const x = easeOut(clamp01((t - water - 0.25) / 0.2));
  const f = easeOut(clamp01((t - fat) / 0.25));
  return (
    <AbsoluteFill style={{ padding: "240px 0 0 0", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ position: "relative", width: 200, height: 240, opacity: a, transform: `scale(${0.5 + 0.5 * a})` }}>
          <svg width="200" height="240" viewBox="0 0 100 120">
            <path d="M50 6 C50 6 14 52 14 76 A36 36 0 0 0 86 76 C86 52 50 6 50 6 Z" fill="#3fa9f5" stroke="#1d2f6f" strokeWidth="6" />
            {x > 0 && (
              <g stroke="#ff2d2d" strokeWidth={12 * x} strokeLinecap="round">
                <line x1="12" y1="30" x2="88" y2="110" />
                <line x1="88" y1="30" x2="12" y2="110" />
              </g>
            )}
          </svg>
        </div>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 130, color: "#1d2f6f", background: "#ffd23f", borderRadius: 30, padding: "10px 40px", border: "8px solid #1d2f6f",
          opacity: f, transform: `scale(${0.4 + 0.6 * f}) rotate(-4deg)` }}>FAT</div>
      </div>
    </AbsoluteFill>
  );
};

const LitreCounter: React.FC<{ t: number; start: number }> = ({ t, start }) => {
  const v = Math.round(100 * easeOut(clamp01((t - start) / 1.8)));
  return (
    <AbsoluteFill style={{ padding: "240px 80px 0 0", alignItems: "flex-end" }}>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 150, color: "#fff", WebkitTextStroke: "10px #1d2f6f", paintOrder: "stroke fill", opacity: t > start - 0.1 ? 1 : 0 }}>{v} L</div>
    </AbsoluteFill>
  );
};

/** Sand puffing out as the camel rises. */
const SandBurst: React.FC<{ age: number }> = ({ age }) => {
  if (age < 0 || age > 1.4) return null;
  return (
    <group>
      {Array.from({ length: 40 }, (_, i) => {
        const a = rnd(i, 1) * Math.PI * 2, sp = 1 + rnd(i, 2) * 2.5;
        const p: V3 = [Math.cos(a) * sp * age * 1.2, (1.5 + rnd(i, 3) * 2) * age - 2.5 * age * age, Math.sin(a) * sp * age];
        return (
          <mesh key={i} position={p} scale={0.06 + rnd(i, 4) * 0.08}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#f0d39b" transparent opacity={1 - age / 1.4} />
          </mesh>
        );
      })}
    </group>
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
  spec = { ...spec, yaw: spec.yaw + 1.4 * Math.sin(t * 0.6) + 0.6 * Math.sin(t * 1.3 + 2), pitch: spec.pitch + 0.7 * Math.sin(t * 0.8 + 1) };
  const pb = (s.punch ?? []).reduce((m, pt) => Math.max(m, bump(t - pt)), 0);
  spec = { ...spec, f: spec.f * (1 - 0.16 * pb) };
  let tg = spec.tg;
  const sh = s.shake?.(ctx) ?? 0;
  if (sh > 0) tg = add3(tg, [Math.sin(t * 37) * 0.02 * sh, Math.sin(t * 29 + 1) * 0.02 * sh, 0]);
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

export const CAMEL_SHOTS = SHOTS.map((s, i) => ({ name: s.name, t: s.t, end: shotEnd(i) }));

export const CamelVideo: React.FC = () => {
  const rig = useCamelRig();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  let i = SHOTS.length - 1;
  while (i > 0 && t < SHOTS[i].t) i--;
  const sc = SHOTS[i];
  const ctx: Ctx = { t };
  const w = sc.world(ctx);
  const cam = cameraAt(i, t, ctx);
  const night = w.night ?? 0;
  const sunK = w.sunK ?? 0.45;
  const sp = sunPos(sunK);
  const sky = new THREE.Color(COL.skyDay).lerp(new THREE.Color(COL.skyNight), night).getStyle();
  const inVessel = !!w.vessel;

  return (
    <AbsoluteFill style={{ background: inVessel ? "#3a0610" : sky }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true }}>
        <color attach="background" args={[inVessel ? "#3a0610" : sky]} />
        {!inVessel && <fog attach="fog" args={[new THREE.Color("#f3dcb0").lerp(new THREE.Color(COL.skyNight), night).getStyle(), 25, 90]} />}
        <CameraRig cam={cam} />
        <hemisphereLight args={[night > 0.5 ? "#8fa4ee" : "#fff4dc", "#c99a5b", 0.75 - night * 0.05]} />
        <directionalLight position={[sp[0] * 0.3, Math.max(2, sp[1] * 0.3), 8]} intensity={(2.6 - night * 1.5) * (inVessel ? 0.6 : 1)} color={night > 0.5 ? "#9fb4ff" : "#fff1d6"} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0005} />
        <directionalLight position={[-4, 3, -6]} intensity={0.7} color="#ffe6c2" />
        {inVessel ? (
          <>
            <pointLight position={add3(VESSEL, [0, 0.5, 0.5])} intensity={6} distance={12} color="#ff9aa8" />
            <Vessel t={t} {...w.vessel!} />
          </>
        ) : (
          <>
            <Desert night={night} />
            <Sun k={sunK} night={night} />
            <Stars night={night} />
            <Oasis water={w.oasisWater ?? 1} t={t} />
            {w.bottle && <Bottle {...w.bottle} />}
            {w.camel && <DetailedCamel rig={rig} {...w.camel} />}
            {w.storm && <Sandstorm t={t} {...w.storm} />}
            <Fish t={t} visible={!!w.fish && (w.oasisWater ?? 1) < 0.15} flop={w.fish?.flop ?? 0} look={w.fish?.look ?? 0} blink={w.fish?.blink ?? 0} />
            {w.extra}
          </>
        )}
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)" }} />
      {sc.overlay?.(ctx)}
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("camel_voiceover.wav")} />
    </AbsoluteFill>
  );
};

void OASIS;
