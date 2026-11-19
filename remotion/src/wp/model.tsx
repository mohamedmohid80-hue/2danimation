// Animated 3D pieces for the woodpecker video (three.js via @react-three/fiber).
// Coordinates: x right, y up, z toward camera. Trunk surface is at x≈1.
// NOTE: materials that switch between opaque and see-through are keyed on
// that mode, because three.js won't recompile a reused material when
// `transparent` flips during a continuous render.
import React, { useMemo } from "react";
import * as THREE from "three";

export type V3 = [number, number, number];

export const C = {
  sky: "#cfe6f5",
  fog: "#d6e7ef",
  bark: "#8a6a4e",
  feather: "#202027",
  wing: "#34343e",
  white: "#f4f1ea",
  crest: "#e0262b",
  beak: "#6f7276",
  keratin: "#ffd23f",
  brain: "#ff8fb1",
  brainHurt: "#ff3b52",
  tongue: "#ff7a1a",
  xray: "#9fd3ff",
  chip: "#c8a47c",
  grub: "#f3e2b3",
  bone: "#fff0cf",
};

export const BIRD_X = 1.55;
export const rnd = (i: number, n: number) => {
  const s = Math.sin(i * 91.7 + n * 13.3) * 9999.1;
  return s - Math.floor(s);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------- environment
export const Trunk: React.FC<{ ghost?: number }> = ({ ghost = 0 }) => {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1.08, 24, 160, 80, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.035 * Math.sin(a * 26 + Math.sin(y * 0.7) * 1.5) + 0.018 * Math.sin(a * 61 + y * 2.1) + 0.01 * Math.sin(y * 9 + a * 13);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const see = ghost > 0;
  const op = 1 - ghost * 0.8;
  return (
    <group>
      <mesh geometry={geo} receiveShadow castShadow={!see}>
        <meshStandardMaterial key={see ? "g" : "s"} color={C.bark} roughness={0.95} transparent={see} opacity={op} depthWrite={!see} side={see ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
      <mesh position={[0.985, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.1, 0.06, 24]} />
        <meshStandardMaterial key={see ? "g" : "s"} color="#2a1c12" roughness={1} transparent={see} opacity={op} />
      </mesh>
      {see && (
        <mesh position={[0.62, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.75, 20, 1, true]} />
          <meshStandardMaterial color="#4a3020" transparent opacity={0.25 * ghost} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

export const Forest: React.FC = () => {
  const trees = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const f = rnd(i, 1), f2 = rnd(i, 2);
        const ang = f * Math.PI * 2;
        const r = 12 + f2 * 26;
        return { p: [Math.cos(ang) * r, 0, Math.sin(ang) * r] as V3, r: 0.5 + f * 0.9, c: f2 > 0.5 ? "#6d8a7a" : "#7f9c8a" };
      }),
    [],
  );
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={t.p}>
          <mesh>
            <cylinderGeometry args={[t.r, t.r * 1.1, 40, 12]} />
            <meshStandardMaterial color={t.c} roughness={1} />
          </mesh>
          <mesh position={[0, 6 + (i % 5), 0]} scale={[3.5, 3, 3.5]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#8fb37e" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- helpers
const Ellipsoid: React.FC<{ pos: V3; r: V3; color: string; rot?: V3; opacity?: number; emissive?: string; emissiveIntensity?: number }> = ({
  pos, r, color, rot = [0, 0, 0], opacity = 1, emissive, emissiveIntensity = 0.6,
}) => (
  <mesh position={pos} scale={r} rotation={rot} castShadow={opacity === 1}>
    <sphereGeometry args={[1, 40, 28]} />
    <meshStandardMaterial
      key={opacity < 1 ? "see-through" : "opaque"}
      color={color}
      roughness={0.6}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity === 1}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissive ? emissiveIntensity : 0}
    />
  </mesh>
);

/** 3D arrow from a toward b, revealed by `progress` (0..1). */
export const Arrow3D: React.FC<{ a: V3; b: V3; progress?: number; color?: string; width?: number; opacity?: number }> = ({
  a, b, progress = 1, color = "#ffffff", width = 0.022, opacity = 1,
}) => {
  if (progress <= 0.01) return null;
  const va = new THREE.Vector3(...a);
  const full = new THREE.Vector3(...b).sub(va);
  const head = Math.min(full.length() * 0.35, width * 5);
  const len = full.length() * clamp01(progress);
  const dir = full.clone().normalize();
  const shaftLen = Math.max(0.001, len - head);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const shaftMid = va.clone().add(dir.clone().multiplyScalar(shaftLen / 2));
  const headPos = va.clone().add(dir.clone().multiplyScalar(shaftLen + head / 2));
  const mat = <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />;
  return (
    <group>
      <mesh position={shaftMid} quaternion={q}>
        <cylinderGeometry args={[width, width, shaftLen, 10]} />
        {mat}
      </mesh>
      <mesh position={headPos} quaternion={q}>
        <coneGeometry args={[width * 2.6, head, 14]} />
        {mat}
      </mesh>
    </group>
  );
};

// tongue: root behind the eye, around the skull, out through the beak
export const TONGUE_PTS: V3[] = [
  [-0.28, 1.08, 0.01], [-0.06, 1.22, 0.03], [0.22, 1.17, 0.05], [0.34, 0.92, 0.07], [0.18, 0.68, 0.08],
  [-0.1, 0.66, 0.06], [-0.3, 0.8, 0.02], [-0.6, 0.86, 0.0], [-0.85, 0.87, 0.0], [-1.08, 0.88, 0.0],
];
export const TONGUE_CURVE = new THREE.CatmullRomCurve3(TONGUE_PTS.map((v) => new THREE.Vector3(...v)));
const Tongue: React.FC<{ progress: number }> = ({ progress }) => {
  const geo = useMemo(() => new THREE.TubeGeometry(TONGUE_CURVE, 220, 0.026, 12, false), []);
  geo.setDrawRange(0, Math.floor((geo.index!.count * clamp01(progress)) / 6) * 6);
  const tip = TONGUE_CURVE.getPointAt(Math.max(0.001, clamp01(progress)));
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.6} />
      </mesh>
      {/* glowing tip so the eye can follow it */}
      <mesh position={tip}>
        <sphereGeometry args={[0.04, 16, 12]} />
        <meshBasicMaterial color="#ffd0a0" />
      </mesh>
      {progress >= 0.97 &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[-1.05 + i * 0.06, 0.91, 0]} rotation={[0, 0, -2.4]}>
            <coneGeometry args={[0.02, 0.08, 8]} />
            <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.6} />
          </mesh>
        ))}
    </group>
  );
};

/** Spongy-bone plates that fly in to form a helmet, then can crumble away. */
const HELMET_TILES = Array.from({ length: 46 }, (_, i) => {
  const y = 1 - (i / 45) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = i * 2.399963;
  return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
});
const Helmet: React.FC<{ build: number; fall: number; t: number }> = ({ build, fall, t }) => {
  if (build <= 0) return null;
  const R: V3 = [0.29, 0.27, 0.25];
  return (
    <group position={[0, 0.94, 0]}>
      {HELMET_TILES.map((d, i) => {
        const delay = rnd(i, 4) * 0.55;
        const k = clamp01((build - delay) / 0.45);
        if (k <= 0) return null;
        const e = 1 - Math.pow(1 - k, 3);
        const out = 1 + (1 - e) * 2.2;
        const fd = clamp01((fall - rnd(i, 6) * 0.4) / 0.6);
        const pos: V3 = [d.x * R[0] * out + fd * (rnd(i, 7) - 0.5) * 0.6, d.y * R[1] * out - fd * fd * 1.6, d.z * R[2] * out + fd * rnd(i, 8) * 0.4];
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone());
        const spin = new THREE.Euler(fd * 6 * rnd(i, 9), fd * 5, (1 - e) * 3);
        return (
          <group key={i} position={pos} quaternion={q}>
            <mesh rotation={spin}>
              <boxGeometry args={[0.085, 0.085, 0.02]} />
              <meshStandardMaterial color={C.bone} emissive={C.bone} emissiveIntensity={0.25} roughness={0.8} transparent opacity={0.85 * (1 - fd * 0.6)} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- woodpecker
export type BirdState = {
  peck: number; // 0 head back, 1 beak in the wood
  shift?: number; // body pushed away from trunk (bounce)
  xray?: boolean;
  ghost?: boolean;
  brainScale?: number;
  brainForward?: number;
  brainHurt?: number;
  brainGlow?: number;
  brainWobble?: number; // jelly wobble amount
  fluid?: number; // 0 none .. 1 big sloshy fluid gap around the brain
  arrows?: number;
  arrowsIn?: number;
  tongue?: number;
  beakLen?: number; // 0..1 beak grows out
  beakWear?: number; // 0..1 tip worn down
  keratin?: number; // sheath opacity
  keratinGrow?: number; // 0..1 sheath sweeps base -> tip
  membrane?: number; // 0 open .. 1 slid across the eye
  helmet?: number; // 0..1 plates assembled
  helmetFall?: number; // 0..1 plates crumble away
  toeGrip?: number; // 0 open .. 1 clamped
  toeGlow?: number; // highlight toes
  tailAngle?: number; // tail rotation (default -0.55 = braced on bark)
  look?: number;
  wink?: boolean;
  t?: number;
};

export const Woodpecker: React.FC<BirdState> = ({
  peck, shift = 0, xray, ghost, brainScale = 1, brainForward = 0, brainHurt = 0, brainGlow = 0, brainWobble = 0, fluid = 0,
  arrows = 0, arrowsIn = 0, tongue = 0, beakLen = 1, beakWear = 0, keratin = 0, keratinGrow = 1, membrane = 0,
  helmet = 0, helmetFall = 0, toeGrip = 1, toeGlow = 0, tailAngle = -0.55, look = 0, wink, t = 0,
}) => {
  const headTilt = -0.55 * (1 - peck);
  const headOpacity = xray ? 0.16 : 1;
  const headColor = xray ? C.xray : C.feather;
  const brainColor = new THREE.Color(C.brain).lerp(new THREE.Color(C.brainHurt), clamp01(brainHurt)).getStyle();
  const arrowR = 0.32 - 0.12 * arrowsIn;
  const wob = brainWobble * Math.sin(t * 22);
  const bs = brainScale;
  const beakL = Math.max(0.02, beakLen) * (1 - 0.18 * beakWear);
  const toeColor = new THREE.Color("#3b3d42").lerp(new THREE.Color("#ffffff"), toeGlow).getStyle();
  return (
    <group position={[BIRD_X + shift, 0, 0]}>
      <Ellipsoid pos={[0, 0, 0]} r={[0.38, 0.75, 0.38]} color={ghost ? C.xray : C.feather} opacity={ghost ? 0.3 : 1} />
      {!ghost && (
        <>
          <Ellipsoid pos={[-0.12, 0.3, 0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
          <Ellipsoid pos={[-0.12, 0.3, -0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
          <Ellipsoid pos={[0.1, 0.0, 0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />
          <Ellipsoid pos={[0.1, 0.0, -0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />
        </>
      )}
      <group position={[0.05, -0.65, 0]} rotation={[0, 0, tailAngle]}>
        {[-0.09, 0, 0.09].map((z, i) => (
          <mesh key={i} position={[0, -0.52, z]} castShadow>
            <boxGeometry args={[0.07, 1.05, 0.13]} />
            <meshStandardMaterial color="#141418" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {[0.15, -0.15].map((z) => (
        <group key={z} position={[-0.42 - shift, -0.45, z]}>
          {[0.6, 0.2, -2.2, -2.6].map((a, i) => {
            const open = (1 - toeGrip) * (a > 0 ? 0.7 : -0.7);
            return (
              <mesh key={i} rotation={[0, 0, a + open]} position={[0, 0, (i % 2) * 0.04 - 0.02]}>
                <capsuleGeometry args={[0.024, 0.17, 4, 8]} />
                <meshStandardMaterial color={toeColor} emissive={toeGlow > 0 ? "#ffffff" : "#000000"} emissiveIntensity={toeGlow * 0.6} roughness={0.6} />
              </mesh>
            );
          })}
        </group>
      ))}
      <group position={[0, 0.6, 0]} rotation={[0, look * 1.2, headTilt]}>
        <group position={[0, -0.6, 0]}>
          <Ellipsoid pos={[-0.05, 0.62, 0]} r={[0.22, 0.25, 0.22]} color={headColor} opacity={headOpacity} />
          <Ellipsoid pos={[0, 0.92, 0]} r={[0.31, 0.29, 0.27]} color={headColor} opacity={headOpacity} />
          {!xray && (
            <>
              <Ellipsoid pos={[0.05, 1.12, 0]} r={[0.26, 0.14, 0.2]} color={C.crest} />
              <mesh position={[0.24, 1.2, 0]} rotation={[0, 0, -1.05]} castShadow>
                <coneGeometry args={[0.15, 0.42, 20]} />
                <meshStandardMaterial color={C.crest} roughness={0.55} />
              </mesh>
              <Ellipsoid pos={[0.02, 0.82, 0.22]} r={[0.28, 0.05, 0.06]} color={C.white} rot={[0, 0, -0.35]} />
              <Ellipsoid pos={[0.02, 0.82, -0.22]} r={[0.28, 0.05, 0.06]} color={C.white} rot={[0, 0, -0.35]} />
            </>
          )}
          {xray && (
            <>
              <mesh position={[0, 0.94, 0]} scale={[0.25, 0.23, 0.21]}>
                <sphereGeometry args={[1, 24, 16]} />
                <meshBasicMaterial color="#e8f6ff" wireframe transparent opacity={0.35} />
              </mesh>
              {fluid > 0 && (
                <mesh position={[0.06 - brainForward * 0.4, 0.97, 0]} scale={[0.075 * bs * (1 + fluid * 0.9), 0.062 * bs * (1 + fluid * 0.9), 0.068 * bs * (1 + fluid * 0.9)]}>
                  <sphereGeometry args={[1, 28, 20]} />
                  <meshStandardMaterial color="#6fc3ff" emissive="#3aa0ff" emissiveIntensity={0.4} transparent opacity={0.35} depthWrite={false} />
                </mesh>
              )}
              <Ellipsoid
                pos={[0.06 - brainForward, 0.97, 0]}
                r={[0.075 * bs * (1 + wob * 0.18), 0.062 * bs * (1 - wob * 0.15), 0.068 * bs]}
                color={brainColor}
                emissive={brainColor}
                emissiveIntensity={0.6 + brainGlow}
              />
              <Helmet build={helmet} fall={helmetFall} t={t} />
            </>
          )}
          {arrows > 0 &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + t * 0.6;
              return (
                <mesh key={i} scale={Math.min(1, arrows)} position={[0.06 + Math.cos(a) * arrowR, 0.97 + Math.sin(a) * arrowR, 0.2]} rotation={[0, 0, a + Math.PI / 2]}>
                  <coneGeometry args={[0.035, 0.09, 12]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              );
            })}
          {tongue > 0 && <Tongue progress={tongue} />}
          {!xray &&
            [1, -1].map((s) => (
              <group key={s} position={[-0.13, 0.96, 0.235 * s]} scale={[1, wink && s === 1 ? 0.12 : 1, 1]}>
                <mesh>
                  <sphereGeometry args={[0.07, 24, 16]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
                <mesh position={[-0.01, 0, 0.045 * s]}>
                  <sphereGeometry args={[0.042, 20, 14]} />
                  <meshStandardMaterial color="#0c0c10" roughness={0.1} />
                </mesh>
                {membrane > 0.02 && s === 1 && (
                  // third eyelid slides across from the beak side
                  <group position={[-0.085, 0, 0.074]}>
                    <mesh position={[0.085 * clamp01(membrane), 0, 0]} scale={[clamp01(membrane), 1, 1]}>
                      <circleGeometry args={[0.085, 32]} />
                      <meshStandardMaterial color="#e8f0ff" transparent opacity={0.85} side={THREE.DoubleSide} />
                    </mesh>
                  </group>
                )}
              </group>
            ))}
          {/* beak grows out from its base at x=-0.30 */}
          <group position={[-0.3, 0.86, 0]} scale={[beakL, 1, 1]}>
            <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <coneGeometry args={[0.085, 0.44, 4]} />
              <meshStandardMaterial color={C.beak} roughness={0.35} metalness={0.1} />
            </mesh>
            {keratin > 0 && keratinGrow > 0.01 && (
              <group scale={[keratinGrow, 1, 1]}>
                <mesh position={[-0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <coneGeometry args={[0.105, 0.48, 4]} />
                  <meshStandardMaterial color={C.keratin} emissive={C.keratin} emissiveIntensity={0.55} transparent opacity={0.55 * keratin} depthWrite={false} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- effects
export const ChipBurst: React.FC<{ age: number; seed: number; dir?: V3; origin?: V3; color?: string; count?: number; speed?: number }> = ({
  age, seed, dir = [1, 0.4, 0.3], origin = [1.0, 0.88, 0.05], color = C.chip, count = 16, speed = 1,
}) => {
  if (age < 0 || age > 0.8) return null;
  const shrink = age > 0.5 ? 1 - (age - 0.5) / 0.3 : 1;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => rnd(seed * 31 + i, n);
        const v: V3 = [
          (dir[0] * (0.6 + r(1) * 1.2) + (r(2) - 0.5) * 0.8) * speed,
          (dir[1] * (0.6 + r(3)) + (r(4) - 0.3) * 1.0) * speed,
          (dir[2] * (0.6 + r(5) * 1.4) + (r(6) - 0.5) * 0.6) * speed,
        ];
        const p: V3 = [origin[0] + v[0] * age, origin[1] + v[1] * age - 2.8 * age * age, origin[2] + v[2] * age];
        const s = (0.03 + r(7) * 0.045) * shrink;
        return (
          <mesh key={i} position={p} rotation={[r(8) * 6 + age * 9, r(9) * 6 + age * 7, r(10) * 6]} castShadow>
            <boxGeometry args={[s * 1.6, s, s * 0.35]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

export const ImpactFlash: React.FC<{ age: number; pos?: V3; size?: number; color?: string }> = ({ age, pos = [1.0, 0.86, 0.15], size = 1, color = "#ffe08a" }) => {
  if (age < 0 || age > 0.3) return null;
  const k = age / 0.3;
  return (
    <group position={pos} scale={size}>
      <mesh scale={1 - k * 0.6}>
        <sphereGeometry args={[0.09, 20, 14]} />
        <meshBasicMaterial color="#fff6cf" transparent opacity={1 - k} />
      </mesh>
      {[0.16, 0.28].map((r, i) => (
        <mesh key={i} scale={1 + k * 1.6}>
          <ringGeometry args={[r, r + 0.025, 48]} />
          <meshBasicMaterial color={color} transparent opacity={(0.9 - i * 0.3) * (1 - k)} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

const Line3: React.FC<{ a: V3; b: V3; progress?: number }> = ({ a, b, progress = 1 }) => {
  if (progress <= 0) return null;
  const va = new THREE.Vector3(...a);
  const vb = va.clone().lerp(new THREE.Vector3(...b), clamp01(progress));
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const len = Math.max(0.001, va.distanceTo(vb));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.018, 0.018, len, 8]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
};

export const Tripod: React.FC<{ feet: number; tail: number; lines: number; t: number }> = ({ feet, tail, lines, t }) => {
  const pts: V3[] = [[1.13, -0.45, 0.17], [1.13, -0.45, -0.17], [1.12, -1.58, 0]];
  const dot = (p: V3, k: number, key: number) =>
    k > 0 ? (
      <group key={key} position={p}>
        <mesh scale={clamp01(k) * (1 + 0.15 * Math.sin(t * 8 + key))}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh scale={1 + ((t * 1.5 + key * 0.3) % 1) * 2}>
          <ringGeometry args={[0.06, 0.075, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={(1 - ((t * 1.5 + key * 0.3) % 1)) * clamp01(k)} side={THREE.DoubleSide} />
        </mesh>
      </group>
    ) : null;
  return (
    <group>
      {dot(pts[0], feet, 0)}
      {dot(pts[1], feet, 1)}
      {dot(pts[2], tail, 2)}
      <Line3 a={pts[0]} b={pts[1]} progress={lines * 3} />
      <Line3 a={pts[1]} b={pts[2]} progress={lines * 3 - 1} />
      <Line3 a={pts[2]} b={pts[0]} progress={lines * 3 - 2} />
    </group>
  );
};

export const Grub: React.FC<{ t: number; pull?: number }> = ({ t, pull = 0 }) => (
  <group position={[0.48 + pull * 0.55, 0.88, 0]}>
    {Array.from({ length: 6 }, (_, i) => (
      <mesh key={i} position={[-i * 0.058, Math.sin(t * 9 + i * 0.9) * 0.014, Math.cos(t * 7 + i) * 0.006]} scale={1 - i * 0.07}>
        <sphereGeometry args={[0.058, 16, 12]} />
        <meshStandardMaterial color={C.grub} emissive={C.grub} emissiveIntensity={0.45} roughness={0.5} />
      </mesh>
    ))}
  </group>
);

/** Ghost hammer that swings in sync with the head ("it's a hammer"). */
export const GhostHammer: React.FC<{ swing: number; opacity: number }> = ({ swing, opacity }) => {
  if (opacity <= 0.01) return null;
  // pivot near the neck, swings down into the trunk like the head does
  return (
    <group position={[BIRD_X + 0.05, 0.6, 0.55]} rotation={[0, 0, -0.9 * (1 - swing)]}>
      <mesh position={[-0.35, 0.28, 0]} rotation={[0, 0, -0.65]}>
        <cylinderGeometry args={[0.03, 0.035, 0.9, 12]} />
        <meshStandardMaterial key="h1" color="#b07a45" transparent opacity={opacity} />
      </mesh>
      <mesh position={[-0.62, 0.5, 0]} rotation={[0, 0, -0.65]}>
        <boxGeometry args={[0.36, 0.14, 0.14]} />
        <meshStandardMaterial key="h2" color="#9aa3ad" metalness={0.6} roughness={0.3} transparent opacity={opacity} />
      </mesh>
    </group>
  );
};

/** Red force arrows that pass around a tiny brain without hurting it. */
export const ForceArrows: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0) return null;
  return (
    <group position={[BIRD_X + 0.06, 0.97, 0.1]}>
      {[0, 1, 2].map((i) => {
        const ph = (t * 1.6 + i / 3) % 1;
        const y = (i - 1) * 0.1;
        return <Arrow3D key={i} a={[-0.42 + ph * 0.5, y, 0]} b={[-0.05 + ph * 0.5, y, 0]} color="#ff4d5e" width={0.012} opacity={amount * (1 - ph)} />;
      })}
    </group>
  );
};
