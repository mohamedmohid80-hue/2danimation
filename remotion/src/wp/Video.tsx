import React, { useLayoutEffect } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import rawWords from "../data/words.json";
import { BirdState, C, ChipBurst, Forest, Grub, ImpactFlash, Trunk, Tripod, V3, Woodpecker } from "./model";
import { Captions, fontFamily } from "./captions";

export const FPS = 30;
export const AUDIO_SECONDS = 76.07;
export const DURATION_FRAMES = Math.ceil((AUDIO_SECONDS + 0.6) * FPS);

// ---------------------------------------------------------------- words & cue lookup
export type Word = { w: string; s: number; e: number };
export const WORDS: Word[] = (rawWords as Word[]).reduce<Word[]>((acc, w) => {
  // whisper splits "High-speed" into "High" + "-speed"
  if (w.w.startsWith("-") && acc.length) acc[acc.length - 1] = { ...acc[acc.length - 1], w: acc[acc.length - 1].w + w.w, e: w.e };
  else acc.push(w);
  return acc;
}, []);
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9']/g, "");
/** Start time (s) of the first occurrence of `phrase` at or after `after`. */
const T = (phrase: string, after = 0): number => {
  const p = phrase.split(" ").map(norm);
  for (let i = 0; i < WORDS.length; i++) {
    if (WORDS[i].s < after) continue;
    if (p.every((tok, k) => WORDS[i + k] && norm(WORDS[i + k].w) === tok)) return WORDS[i].s;
  }
  throw new Error(`cue not found: ${phrase}`);
};

const cue = {
  twenty: T("20"),
  every: T("every hit stops"),
  hundreds: T("hundreds"),
  football: T("even football"),
  beak: T("so you grow a beak"),
  chip: T("chip"),
  coat: T("so you coat"),
  keratin: T("keratin"),
  sharpens: T("sharpens"),
  brain: T("but your brain"),
  shrink: T("so you shrink"),
  shrinkW: T("shrink"),
  woodChips: T("but now wood"),
  eyelid: T("so a third"),
  snaps: T("snaps"),
  bounce: T("but every hit"),
  grab: T("so you grab"),
  toes: T("toes"),
  tail: T("tail"),
  tripod: T("tripod"),
  bugs: T("but the bugs"),
  tongue: T("so you grow a tongue"),
  skull: T("skull", T("so you grow a tongue")),
  barbs: T("barbs"),
  spear: T("spear"),
  safe: T("and just to be safe"),
  spongy: T("spongy"),
  nobody: T("and here is"),
  nothing: T("almost nothing"),
  high: T("highspeed cameras"),
  hammer: T("it's a hammer"),
  sci: T("scientists"),
  light: T("it's just too light"),
  congrats: T("congratulations"),
  wood: T("woodpecker"),
};

// ---------------------------------------------------------------- math helpers
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** 0→1 ramp starting at `start` over `dur` seconds, eased. */
const ramp = (t: number, start: number, dur: number) => easeInOut(clamp01((t - start) / dur));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

type Cam = { p: V3; t: V3; f: number };
const push = (c: Cam, amt: number): Cam => ({ ...c, p: lerp3(c.p, c.t, amt) });
const CAM = {
  wide: { p: [2.4, 0.4, 7.2], t: [1.2, 0.15, 0], f: 34 } as Cam,
  medium: { p: [2.3, 0.75, 4.0], t: [1.25, 0.45, 0], f: 34 } as Cam,
  impact: { p: [1.45, 1.0, 2.1], t: [1.05, 0.88, 0], f: 34 } as Cam,
  beak: { p: [1.8, 1.12, 1.55], t: [1.18, 0.9, 0], f: 30 } as Cam,
  xray: { p: [1.65, 1.05, 2.0], t: [1.55, 0.95, 0], f: 32 } as Cam,
  eye: { p: [1.6, 1.05, 1.45], t: [1.3, 0.93, 0.15], f: 32 } as Cam,
  tripod: { p: [3.2, -0.7, 2.6], t: [1.2, -0.95, 0], f: 32 } as Cam,
  bugs: { p: [1.0, 1.08, 1.7], t: [0.72, 0.88, 0], f: 32 } as Cam,
  tongue: { p: [1.15, 1.05, 4.3], t: [1.15, 0.92, 0], f: 34 } as Cam,
  end: { p: [2.3, 1.0, 2.9], t: [1.45, 0.75, 0], f: 34 } as Cam,
};

// ---------------------------------------------------------------- pecking
type Peck = { rate: number; chips?: boolean; toward?: boolean; flash?: boolean; slow?: boolean; amp?: number };
type PeckInfo = { peck: number; age: number; hitIdx: number; period: number };
const peckAt = (t: number, start: number, rate: number): PeckInfo => {
  const t0 = start + 0.15;
  const x = (t - t0) * rate;
  const k = Math.floor(x);
  const p = x - k;
  const peck = p < 0.4 ? 1 - easeOut(p / 0.4) : Math.pow((p - 0.4) / 0.6, 2);
  const hitTime = t0 + k / rate;
  return { peck, age: hitTime >= start ? t - hitTime : -1, hitIdx: k, period: 1 / rate };
};

// ---------------------------------------------------------------- scenes
type Ctx = { t: number; lt: number; pk: PeckInfo | null };
type SceneDef = {
  start: number;
  cams: [Cam, Cam];
  peck?: Peck;
  trunkGhost?: (c: Ctx) => number;
  bird: (c: Ctx) => BirdState;
  extra?: (c: Ctx) => React.ReactNode;
  overlay?: (c: Ctx) => React.ReactNode;
};

const pulse = (pk: PeckInfo | null, len = 0.15) => (pk && pk.age >= 0 ? clamp01(1 - pk.age / len) : 0);

const SCENES: SceneDef[] = [
  { // hook
    start: 0,
    cams: [CAM.wide, push(CAM.wide, 0.5)],
    peck: { rate: 6, chips: true },
    bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => t >= cue.twenty && <BigLabel text="20×" sub="EVERY SECOND" appear={cue.twenty} />,
  },
  { // hundreds of g
    start: cue.every,
    cams: [CAM.impact, push(CAM.impact, 0.18)],
    peck: { rate: 6, chips: true, toward: true, flash: true },
    bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) =>
      t >= cue.hundreds && <BigLabel text="400 g" sub={t >= cue.football ? "concussion < 100 g" : undefined} appear={cue.hundreds} subAppear={cue.football} />,
  },
  { // chisel beak; bare bone chips
    start: cue.beak,
    cams: [CAM.beak, push(CAM.beak, 0.12)],
    bird: () => ({ peck: 0.6 }),
    extra: ({ t }) => <ChipBurst age={(t - cue.chip) * 0.8} seed={77} origin={[0.885, 1.0, 0.02]} color="#8e9196" count={10} />,
  },
  { // keratin
    start: cue.coat,
    cams: [push(CAM.beak, 0.12), push(CAM.beak, 0.24)],
    bird: ({ t }) => ({ peck: 0.6, keratin: ramp(t, cue.keratin - 0.1, 0.5) }),
    extra: ({ t }) => <ImpactFlash age={t - cue.sharpens - 0.25} pos={[0.87, 1.02, 0.08]} size={0.7} />,
  },
  { // brain slams
    start: cue.brain,
    cams: [CAM.xray, push(CAM.xray, 0.12)],
    peck: { rate: 2.6, flash: true, amp: 0.35 },
    bird: ({ pk }) => {
      const p = pulse(pk, 0.2);
      return { peck: pk!.peck, xray: true, brainScale: 1.6, brainForward: 0.05 * p, brainHurt: 0.25 + 0.75 * p };
    },
  },
  { // shrink it
    start: cue.shrink,
    cams: [push(CAM.xray, 0.12), push(CAM.xray, 0.3)],
    bird: ({ t }) => {
      const k = ramp(t, cue.shrinkW, 0.7);
      return { peck: 1, xray: true, brainScale: lerp(1.6, 1, k), brainHurt: 0.25 * (1 - k), arrows: ramp(t, cue.shrinkW - 0.15, 0.2), arrowsIn: k };
    },
  },
  { // wood chips at your eyes
    start: cue.woodChips,
    cams: [CAM.eye, push(CAM.eye, 0.12)],
    peck: { rate: 5, chips: true, toward: true, amp: 0.3 },
    bird: ({ pk }) => ({ peck: pk!.peck }),
  },
  { // third eyelid
    start: cue.eyelid,
    cams: [push(CAM.eye, 0.1), push(CAM.eye, 0.22)],
    peck: { rate: 2.2, chips: true, toward: true, amp: 0.3 },
    bird: ({ t, pk }) => {
      const d = Math.min(Math.max(pk!.age, 0), pk!.period - Math.max(pk!.age, 0));
      const m = t < cue.snaps ? 0 : clamp01(1 - d / 0.2);
      return { peck: pk!.peck, membrane: m };
    },
  },
  { // bounce off the tree
    start: cue.bounce,
    cams: [CAM.medium, push(CAM.medium, 0.1)],
    peck: { rate: 2.4, chips: true },
    bird: ({ pk }) => {
      const a = pk!.age;
      const shift = a >= 0 && a < 0.38 ? 0.45 * Math.sin((Math.PI * a) / 0.38) : 0;
      return { peck: pk!.peck, shift };
    },
  },
  { // tripod grip
    start: cue.grab,
    cams: [CAM.tripod, push(CAM.tripod, 0.12)],
    bird: () => ({ peck: 1, ghost: true }),
    extra: ({ t }) => <Tripod feet={ramp(t, cue.toes, 0.25)} tail={ramp(t, cue.tail, 0.25)} lines={ramp(t, cue.tripod - 0.25, 0.6)} />,
  },
  { // bugs hiding in the wood
    start: cue.bugs,
    cams: [CAM.bugs, push(CAM.bugs, 0.15)],
    trunkGhost: ({ t }) => ramp(t, cue.bugs + 0.2, 0.5),
    bird: () => ({ peck: 0.75 }),
    extra: ({ t }) => <Grub t={t} />,
  },
  { // tongue wraps around the skull and spears the grub
    start: cue.tongue,
    cams: [CAM.tongue, push(CAM.tongue, 0.08)],
    trunkGhost: () => 1,
    bird: ({ t }) => ({
      peck: 1,
      xray: true,
      tongue: 0.78 * ramp(t, cue.tongue + 0.6, cue.skull + 0.3 - cue.tongue - 0.6) + 0.22 * ramp(t, cue.barbs - 0.1, cue.spear + 0.3 - cue.barbs + 0.1),
    }),
    extra: ({ t }) => <Grub t={t} speared={t > cue.spear + 0.2} />,
  },
  { // spongy-bone helmet
    start: cue.safe,
    cams: [CAM.xray, push(CAM.xray, 0.1)],
    bird: ({ t }) => ({ peck: 1, xray: true, helmet: ramp(t, cue.spongy - 0.1, 0.5) }),
  },
  { // what nobody tells you: helmet does almost nothing
    start: cue.nobody,
    cams: [push(CAM.xray, 0.1), push(CAM.xray, 0.32)],
    bird: ({ t }) => ({ peck: 1, xray: true, helmet: 1 - ramp(t, cue.nothing, 0.6) }),
  },
  { // high-speed footage
    start: cue.high,
    cams: [CAM.medium, push(CAM.medium, 0.15)],
    peck: { rate: 0.9, chips: true, flash: true, slow: true },
    bird: ({ pk }) => ({ peck: pk!.peck }),
    overlay: ({ t }) => <RecOverlay t={t} />,
  },
  { // it's a hammer
    start: cue.hammer,
    cams: [push(CAM.impact, 0.15), push(CAM.impact, 0.3)],
    bird: () => ({ peck: 1 }),
    extra: ({ t }) => (
      <>
        <ImpactFlash age={(t - cue.hammer - 0.15) * 0.7} size={1.5} />
        <ChipBurst age={t - cue.hammer - 0.15} seed={991} toward />
      </>
    ),
  },
  { // scientists think: tiny brain
    start: cue.sci,
    cams: [push(CAM.xray, 0.15), push(CAM.xray, 0.45)],
    bird: ({ t }) => ({ peck: 1, xray: true, brainGlow: ramp(t, T("tiny"), 0.4) * (0.6 + 0.4 * Math.sin(t * 8)) }),
  },
  { // too light to get hurt
    start: cue.light,
    cams: [push(CAM.xray, 0.45), push(CAM.xray, 0.3)],
    peck: { rate: 3, flash: true, amp: 0.35 },
    bird: ({ pk }) => ({ peck: pk!.peck, xray: true, brainGlow: 0.5 }),
  },
  { // congratulations
    start: cue.congrats,
    cams: [CAM.end, push(CAM.end, 0.12)],
    bird: ({ t }) => ({ peck: 1, look: ramp(t, cue.congrats + 0.1, 0.5), wink: t > cue.wood + 0.25 && t < cue.wood + 0.75 }),
  },
];

const sceneEnd = (i: number) => (i + 1 < SCENES.length ? SCENES[i + 1].start : DURATION_FRAMES / FPS);

/** Every beak strike, for knock sounds. */
const HITS: { t: number; slow: boolean }[] = SCENES.flatMap((s, i) => {
  if (!s.peck) return [];
  const out: { t: number; slow: boolean }[] = [];
  for (let k = 0; ; k++) {
    const t = s.start + 0.15 + k / s.peck.rate;
    if (t >= sceneEnd(i)) break;
    out.push({ t, slow: !!s.peck.slow });
  }
  return out;
}).concat([{ t: cue.hammer + 0.15, slow: false }]);

// ---------------------------------------------------------------- overlays
const BigLabel: React.FC<{ text: string; sub?: string; appear: number; subAppear?: number }> = ({ text, sub, appear, subAppear }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear * fps, fps, config: { damping: 11, stiffness: 180 } });
  const s2 = spring({ frame: frame - (subAppear ?? appear) * fps, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
      <div
        style={{
          fontFamily, fontWeight: 900, fontSize: 150, color: "#ffffff",
          WebkitTextStroke: "10px #1d2f6f", paintOrder: "stroke fill",
          textShadow: "0 10px 0 #12204f, 0 18px 30px rgba(0,0,0,0.35)",
          transform: `rotate(-4deg) scale(${0.4 + 0.6 * s})`, opacity: Math.min(1, s * 2), transformOrigin: "right center",
        }}
      >
        {text}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 30, fontFamily, fontWeight: 900, fontSize: 44, color: "#ffffff",
            background: "rgba(18,32,79,0.88)", padding: "12px 26px", borderRadius: 18,
            transform: `scale(${0.5 + 0.5 * s2})`, opacity: Math.min(1, s2 * 2), transformOrigin: "right center",
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

const RecOverlay: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ padding: "150px 0 0 70px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: "monospace", fontWeight: 700, fontSize: 46, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
      <div style={{ width: 30, height: 30, borderRadius: 15, background: "#ff2d2d", opacity: Math.floor(t * 2) % 2 ? 0.25 : 1 }} />
      REC · 1000 FPS
    </div>
  </AbsoluteFill>
);

// ---------------------------------------------------------------- 3D camera
const CameraRig: React.FC<{ cam: Cam }> = ({ cam }) => {
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
export const WoodpeckerVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  let i = SCENES.length - 1;
  while (i > 0 && t < SCENES[i].start) i--;
  const sc = SCENES[i];
  const end = sceneEnd(i);
  const lt = clamp01((t - sc.start) / (end - sc.start));
  const raw = sc.peck ? peckAt(t, sc.start, sc.peck.rate) : null;
  // amp < 1 keeps the head closer to the trunk (for tight framings)
  const pk = raw && sc.peck ? { ...raw, peck: 1 - (sc.peck.amp ?? 1) * (1 - raw.peck) } : null;
  const ctx: Ctx = { t, lt, pk };
  const k = easeInOut(lt);
  const cam: Cam = { p: lerp3(sc.cams[0].p, sc.cams[1].p, k), t: lerp3(sc.cams[0].t, sc.cams[1].t, k), f: lerp(sc.cams[0].f, sc.cams[1].f, k) };
  const bird = sc.bird(ctx);

  return (
    <AbsoluteFill style={{ background: C.sky }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true }}>
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fog, 9, 38]} />
        <CameraRig cam={cam} />
        <hemisphereLight args={["#eaf6ff", "#6b5a44", 0.9]} />
        <directionalLight
          position={[6, 8, 7]} intensity={2.4} color="#fff1dc" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0005}
        />
        <directionalLight position={[-5, 2, -4]} intensity={0.6} color="#bfdcff" />
        <directionalLight position={[2, 4, -7]} intensity={2.2} color="#ffffff" />
        <Forest />
        <Trunk ghost={sc.trunkGhost ? sc.trunkGhost(ctx) : 0} />
        <Woodpecker {...bird} />
        {pk && sc.peck?.chips && <ChipBurst age={pk.age * (sc.peck.slow ? 0.35 : 1)} seed={pk.hitIdx + i * 100} toward={sc.peck.toward} />}
        {pk && sc.peck?.flash && <ImpactFlash age={pk.age * (sc.peck.slow ? 0.35 : 1)} />}
        {sc.extra?.(ctx)}
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)" }} />
      {sc.overlay?.(ctx)}
      <Captions words={WORDS} t={t} />
      <Audio src={staticFile("voiceover.wav")} />
      {HITS.map((h, n) => (
        <Sequence key={n} from={Math.round(h.t * FPS)} durationInFrames={8} layout="none">
          <Audio src={staticFile("knock.wav")} volume={h.slow ? 0.55 : 0.32} playbackRate={h.slow ? 0.6 : 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const _debug = { cue, SCENES: SCENES.map((s) => s.start) };
// silence unused-import lint in some editors
void interpolate;
