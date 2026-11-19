// Animated 3D pieces for the woodpecker video (three.js via @react-three/fiber).
// Coordinates: x right, y up, z toward camera. Trunk surface is at x≈1.
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
};

const rnd = (i: number, n: number) => {
  const s = Math.sin(i * 91.7 + n * 13.3) * 9999.1;
  return s - Math.floor(s);
};

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
  const op = 1 - ghost * 0.78;
  return (
    <group>
      <mesh geometry={geo} receiveShadow castShadow={ghost < 0.5}>
        <meshStandardMaterial key={ghost > 0 ? "ghost" : "solid"} color={C.bark} roughness={0.95} transparent={ghost > 0} opacity={op} depthWrite={ghost === 0} side={ghost > 0 ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
      {/* peck hole */}
      <mesh position={[0.985, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.1, 0.06, 24]} />
        <meshStandardMaterial key={ghost > 0 ? "ghost" : "solid"} color="#2a1c12" roughness={1} transparent={ghost > 0} opacity={op} />
      </mesh>
      {/* tunnel behind the hole, visible when the bark is ghosted */}
      {ghost > 0 && (
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
      Array.from({ length: 26 }, (_, i) => {
        const f = rnd(i, 1), f2 = rnd(i, 2);
        return { p: [(f - 0.5) * 60, 0, -10 - f2 * 30] as V3, r: 0.5 + f * 0.9, c: f2 > 0.5 ? "#6d8a7a" : "#7f9c8a" };
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
      // keyed so switching opaque <-> see-through builds a fresh material
      // (three.js won't recompile a reused material when `transparent` flips)
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

// tongue: root behind the eye, around the skull, out through the beak
const TONGUE_PTS: V3[] = [
  [-0.28, 1.08, 0.01], [-0.06, 1.22, 0.03], [0.22, 1.17, 0.05], [0.34, 0.92, 0.07], [0.18, 0.68, 0.08],
  [-0.1, 0.66, 0.06], [-0.3, 0.8, 0.02], [-0.6, 0.86, 0.0], [-0.85, 0.87, 0.0], [-1.08, 0.88, 0.0],
];
const Tongue: React.FC<{ progress: number }> = ({ progress }) => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(TONGUE_PTS.map((v) => new THREE.Vector3(...v)));
    return new THREE.TubeGeometry(curve, 200, 0.026, 12, false);
  }, []);
  const idx = geo.index!.count;
  geo.setDrawRange(0, Math.floor((idx * Math.min(1, progress)) / 6) * 6);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.55} />
      </mesh>
      {progress >= 0.97 &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[-1.05 + i * 0.06, 0.91, 0]} rotation={[0, 0, -2.4]}>
            <coneGeometry args={[0.018, 0.07, 8]} />
            <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.55} />
          </mesh>
        ))}
    </group>
  );
};

// ---------------------------------------------------------------- woodpecker
export type BirdState = {
  peck: number; // 0 head back, 1 beak in the wood
  shift?: number; // body pushed away from trunk (bounce)
  xray?: boolean;
  ghost?: boolean;
  brainScale?: number; // 1 = tiny real size
  brainForward?: number; // brain lurch toward the beak
  brainHurt?: number; // 0..1 red tint
  brainGlow?: number;
  arrows?: number; // 0 hidden .. 1 visible
  arrowsIn?: number; // 0 far .. 1 squeezed in
  tongue?: number; // 0..1 draw progress
  keratin?: number; // sheath opacity 0..1
  membrane?: number; // 0 open .. 1 closed
  helmet?: number; // spongy-bone shell opacity
  look?: number; // 0 side profile .. 1 turned to camera
  wink?: boolean;
};

export const Woodpecker: React.FC<BirdState> = ({
  peck, shift = 0, xray, ghost, brainScale = 1, brainForward = 0, brainHurt = 0, brainGlow = 0, arrows = 0,
  tongue = 0, keratin = 0, membrane = 0, helmet = 0, look = 0, wink, arrowsIn = 0,
}) => {
  const headTilt = -0.55 * (1 - peck);
  const headOpacity = xray ? 0.16 : 1;
  const headColor = xray ? C.xray : C.feather;
  const bodyOp = ghost ? 0.3 : 1;
  const brainColor = new THREE.Color(C.brain).lerp(new THREE.Color(C.brainHurt), brainHurt).getStyle();
  const arrowR = 0.32 - 0.12 * arrowsIn;
  return (
    <group position={[1.55 + shift, 0, 0]}>
      <Ellipsoid pos={[0, 0, 0]} r={[0.38, 0.75, 0.38]} color={ghost ? C.xray : C.feather} opacity={bodyOp} />
      {!ghost && (
        <>
          <Ellipsoid pos={[-0.12, 0.3, 0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
          <Ellipsoid pos={[-0.12, 0.3, -0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
          <Ellipsoid pos={[0.1, 0.0, 0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />
          <Ellipsoid pos={[0.1, 0.0, -0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />
        </>
      )}
      <group position={[0.05, -0.65, 0]} rotation={[0, 0, -0.55]}>
        {[-0.09, 0, 0.09].map((z, i) => (
          <mesh key={i} position={[0, -0.52, z]} castShadow>
            <boxGeometry args={[0.07, 1.05, 0.13]} />
            <meshStandardMaterial color="#141418" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {[0.15, -0.15].map((z) => (
        <group key={z} position={[-0.42 - shift, -0.45, z]}>
          {[0.6, 0.2, -2.2, -2.6].map((a, i) => (
            <mesh key={i} rotation={[0, 0, a]} position={[0, 0, (i % 2) * 0.04 - 0.02]}>
              <capsuleGeometry args={[0.022, 0.16, 4, 8]} />
              <meshStandardMaterial color="#3b3d42" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      {/* head pivots at the neck */}
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
              <Ellipsoid
                pos={[0.06 - brainForward, 0.97, 0]}
                r={[0.075 * brainScale, 0.062 * brainScale, 0.068 * brainScale]}
                color={brainColor}
                emissive={brainColor}
                emissiveIntensity={0.6 + brainGlow}
              />
              {helmet > 0 && (
                <>
                  <mesh position={[0, 0.94, 0]} scale={[0.275, 0.255, 0.235]}>
                    <sphereGeometry args={[1, 32, 24]} />
                    <meshStandardMaterial color="#fff3d6" transparent opacity={0.45 * helmet} depthWrite={false} />
                  </mesh>
                  <mesh position={[0, 0.94, 0]} scale={[0.28, 0.26, 0.24]}>
                    <icosahedronGeometry args={[1, 3]} />
                    <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.6 * helmet} />
                  </mesh>
                </>
              )}
            </>
          )}
          {arrows > 0 &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
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
                  <mesh position={[0, 0, 0.075]}>
                    <circleGeometry args={[0.08, 32, Math.PI * 0.5, Math.PI * 2 * Math.min(1, membrane)]} />
                    <meshStandardMaterial color="#eef4ff" transparent opacity={0.82} side={THREE.DoubleSide} />
                  </mesh>
                )}
              </group>
            ))}
          <mesh position={[-0.52, 0.86, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <coneGeometry args={[0.085, 0.44, 4]} />
            <meshStandardMaterial color={C.beak} roughness={0.35} metalness={0.1} />
          </mesh>
          {keratin > 0 && (
            <mesh position={[-0.52, 0.86, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.105, 0.48, 4]} />
              <meshStandardMaterial color={C.keratin} emissive={C.keratin} emissiveIntensity={0.5} transparent opacity={0.5 * keratin} depthWrite={false} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- effects
/** Wood chips flying from the impact point; `age` = seconds since the hit. */
export const ChipBurst: React.FC<{ age: number; seed: number; toward?: boolean; origin?: V3; color?: string; count?: number }> = ({
  age, seed, toward, origin = [1.0, 0.88, 0.05], color = C.chip, count = 16,
}) => {
  if (age < 0 || age > 0.7) return null;
  const shrink = age > 0.45 ? 1 - (age - 0.45) / 0.25 : 1;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => rnd(seed * 31 + i, n);
        const v: V3 = [0.6 + r(1) * 1.4, -0.1 + r(2) * 1.4, (r(3) - 0.25) * (toward ? 2.6 : 1.1)];
        const p: V3 = [origin[0] + v[0] * age, origin[1] + v[1] * age - 2.8 * age * age, origin[2] + v[2] * age];
        const s = (0.03 + r(7) * 0.045) * shrink;
        return (
          <mesh key={i} position={p} rotation={[r(4) * 6 + age * 9 * r(8), r(5) * 6 + age * 7, r(6) * 6]} castShadow>
            <boxGeometry args={[s * 1.6, s, s * 0.35]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Expanding impact ring; `age` = seconds since the hit. */
export const ImpactFlash: React.FC<{ age: number; pos?: V3; size?: number }> = ({ age, pos = [1.0, 0.86, 0.15], size = 1 }) => {
  if (age < 0 || age > 0.28) return null;
  const k = age / 0.28;
  return (
    <group position={pos} scale={size}>
      <mesh scale={1 - k * 0.6}>
        <sphereGeometry args={[0.09, 20, 14]} />
        <meshBasicMaterial color="#fff6cf" transparent opacity={1 - k} />
      </mesh>
      {[0.16, 0.28].map((r, i) => (
        <mesh key={i} scale={1 + k * 1.4}>
          <ringGeometry args={[r, r + 0.025, 48]} />
          <meshBasicMaterial color="#ffe08a" transparent opacity={(0.9 - i * 0.3) * (1 - k)} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

const Line3: React.FC<{ a: V3; b: V3; progress?: number }> = ({ a, b, progress = 1 }) => {
  if (progress <= 0) return null;
  const va = new THREE.Vector3(...a);
  const vb = va.clone().lerp(new THREE.Vector3(...b), Math.min(1, progress));
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

/** Feet + tail contact triangle. feet/tail/lines are 0..1 reveal amounts. */
export const Tripod: React.FC<{ feet: number; tail: number; lines: number }> = ({ feet, tail, lines }) => {
  const pts: V3[] = [[1.13, -0.45, 0.17], [1.13, -0.45, -0.17], [1.12, -1.58, 0]];
  const dot = (p: V3, k: number, key: number) =>
    k > 0 ? (
      <mesh key={key} position={p} scale={Math.min(1, k) * (1 + 0.4 * Math.max(0, 1 - k * 2))}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
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

/** A grub hiding in the tunnel behind the peck hole. */
export const Grub: React.FC<{ t: number; speared?: boolean }> = ({ t, speared }) => (
  <group position={[0.48, 0.88, 0]}>
    {Array.from({ length: 6 }, (_, i) => (
      <mesh key={i} position={[-i * 0.058, Math.sin(t * 9 + i * 0.9) * (speared ? 0.004 : 0.012), 0]} scale={1 - i * 0.07}>
        <sphereGeometry args={[0.058, 16, 12]} />
        <meshStandardMaterial color={C.grub} emissive={C.grub} emissiveIntensity={0.45} roughness={0.5} />
      </mesh>
    ))}
  </group>
);
