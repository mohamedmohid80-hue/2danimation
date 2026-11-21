// 3D pieces for the camel video. Coordinates: x right (camel faces +x), y up, z toward camera.
// Ground is y = 0. Materials that switch opaque <-> see-through are keyed on that mode
// (three.js won't recompile a reused material when `transparent` flips).
import React, { useMemo } from "react";
import * as THREE from "three";

export type V3 = [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const rnd = (i: number, n: number) => {
  const s = Math.sin(i * 91.7 + n * 13.3) * 9999.1;
  return s - Math.floor(s);
};
const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(k)).getStyle();

export const COL = {
  sand: "#e9c27f",
  sandDark: "#d7a85e",
  skyDay: "#bfe3f7",
  skyNight: "#1b2550",
  fur: "#c9965a",
  furDark: "#a8743c",
  pad: "#6b4a2e",
  hot: "#ff4a2e",
  cool: "#3d8bff",
  fat: "#ffd23f",
  kidney: "#b8423a",
  water: "#3fa9f5",
  blood: "#b3122b",
};

// ---------------------------------------------------------------- desert
export const Desert: React.FC<{ night: number }> = ({ night }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(160, 160, 200, 200);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      const flat = clamp01((r - 7) / 10); // keep the stage flat, dunes further out
      const h = (Math.sin(x * 0.18 + Math.sin(z * 0.1) * 2) * 1.6 + Math.sin(z * 0.23 + x * 0.05) * 1.1 + Math.sin(x * 0.07 - z * 0.11) * 2.2) * flat;
      p.setY(i, Math.max(-0.2, h) + Math.sin(x * 1.3 + z * 0.4) * 0.03);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={mix(COL.sand, "#4a4f7a", night * 0.8)} roughness={1} />
    </mesh>
  );
};

/** Sun position on its arc: k=0 sunrise (east, low), 0.5 overhead, 1 sunset. */
export const sunPos = (k: number): V3 => {
  const a = Math.PI * clamp01(k);
  return [Math.cos(a) * -40, Math.sin(a) * 34 + 2, -30];
};
export const Sun: React.FC<{ k: number; night: number }> = ({ k, night }) => (
  <group position={sunPos(k)}>
    <mesh>
      <sphereGeometry args={[2.6, 32, 24]} />
      <meshBasicMaterial color="#fff3c2" transparent opacity={1 - night} />
    </mesh>
    <mesh>
      <sphereGeometry args={[4.4, 32, 24]} />
      <meshBasicMaterial color="#ffd88a" transparent opacity={0.25 * (1 - night)} depthWrite={false} />
    </mesh>
  </group>
);

export const Stars: React.FC<{ night: number }> = ({ night }) => {
  const pts = useMemo(
    () => Array.from({ length: 160 }, (_, i) => {
      const th = rnd(i, 1) * Math.PI * 2, ph = 0.15 + rnd(i, 2) * 1.2;
      return [Math.cos(th) * Math.cos(ph) * 70, Math.sin(ph) * 70, Math.sin(th) * Math.cos(ph) * 70] as V3;
    }),
    [],
  );
  if (night < 0.05) return null;
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.12 + rnd(i, 3) * 0.12, 6, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={night * (0.5 + 0.5 * rnd(i, 4))} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- generic shapes
const Ell: React.FC<{ pos: V3; r: V3; color: string; rot?: V3; opacity?: number; emissive?: string; ei?: number; rough?: number }> = ({
  pos, r, color, rot = [0, 0, 0], opacity = 1, emissive, ei = 0.5, rough = 0.75,
}) => (
  <mesh position={pos} scale={r} rotation={rot} castShadow={opacity === 1}>
    <sphereGeometry args={[1, 36, 24]} />
    <meshStandardMaterial key={opacity < 1 ? "t" : "o"} color={color} roughness={rough} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
      emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? ei : 0} />
  </mesh>
);
const Seg: React.FC<{ a: V3; b: V3; r: number; color: string; opacity?: number }> = ({ a, b, r, color, opacity = 1 }) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return (
    <mesh position={va.clone().add(vb).multiplyScalar(0.5)} quaternion={q} castShadow={opacity === 1}>
      <capsuleGeometry args={[r, Math.max(0.001, va.distanceTo(vb)), 6, 12]} />
      <meshStandardMaterial key={opacity < 1 ? "t" : "o"} color={color} roughness={0.8} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
};

export const Arrow3D: React.FC<{ a: V3; b: V3; progress?: number; color?: string; width?: number; opacity?: number }> = ({
  a, b, progress = 1, color = "#ffffff", width = 0.03, opacity = 1,
}) => {
  if (progress <= 0.01) return null;
  const va = new THREE.Vector3(...a);
  const full = new THREE.Vector3(...b).sub(va);
  const head = Math.min(full.length() * 0.35, width * 5);
  const dir = full.clone().normalize();
  const len = full.length() * clamp01(progress);
  const shaftLen = Math.max(0.001, len - head);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />;
  return (
    <group>
      <mesh position={va.clone().add(dir.clone().multiplyScalar(shaftLen / 2))} quaternion={q}>
        <cylinderGeometry args={[width, width, shaftLen, 10]} />{m}
      </mesh>
      <mesh position={va.clone().add(dir.clone().multiplyScalar(shaftLen + head / 2))} quaternion={q}>
        <coneGeometry args={[width * 2.6, head, 14]} />{m}
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- camel
export type CamelState = {
  pos?: V3;
  rotY?: number;
  grow?: number; // 0..1 rises out of the sand
  walk?: number; // walk-cycle phase (radians); legs swing when walkAmt>0
  walkAmt?: number;
  sink?: number; // 0..1 feet sink into sand
  padSpread?: number; // 0..1 feet spread wide
  nostrils?: number; // 1 open .. 0 shut
  lashGlow?: number;
  heat?: number; // -1 cool blue .. 0 normal .. 1 hot red (heat-map tint)
  xray?: boolean;
  kidneySqueeze?: number;
  kidneyGlow?: number;
  hump?: number; // hump size multiplier
  fat?: number; // 0..1 yellow fat visible inside the hump (x-ray)
  belly?: number; // belly swell
  headDown?: number; // 0..1 lower head to drink
  look?: number; // 0..1 head turns to camera
  blink?: number; // 0 open .. 1 closed
  shake?: number; // 0..1 shake sand off (body wiggle)
  humpWobble?: number; // 0..1 fat jiggle
  t?: number;
};

export const Camel: React.FC<CamelState> = ({
  pos = [0, 0, 0], rotY = 0, grow = 1, walk = 0, walkAmt = 0, sink = 0, padSpread = 0, nostrils = 1, lashGlow = 0, heat = 0,
  xray, kidneySqueeze = 0, kidneyGlow = 0, hump = 1, fat = 0, belly = 0, headDown = 0, look = 0, blink = 0, t = 0,
}) => {
  if (grow <= 0.01) return null;
  const base = heat >= 0 ? mix(COL.fur, COL.hot, heat * 0.85) : mix(COL.fur, COL.cool, -heat * 0.85);
  const dark = heat >= 0 ? mix(COL.furDark, "#c2301e", heat * 0.8) : mix(COL.furDark, "#2a5fc0", -heat * 0.8);
  const op = xray ? 0.22 : 1;
  const furC = xray ? "#bfe6ff" : base;
  const bob = Math.sin(walk * 2) * 0.04 * walkAmt;
  const legs: { x: number; z: number; ph: number }[] = [
    { x: 0.62, z: 0.2, ph: 0 }, { x: 0.62, z: -0.2, ph: Math.PI }, { x: -0.62, z: 0.2, ph: Math.PI }, { x: -0.62, z: -0.2, ph: 0 },
  ];
  const sinkY = -0.32 * sink;
  const g = 1 - Math.pow(1 - grow, 3);
  // head/neck: lower for drinking, turn to camera at the end
  const neckPts: V3[] = [[0.82, 1.9, 0], [1.15, 1.78, 0], [1.42, 1.98 - 0.4 * headDown, 0], [1.56, 2.32 - 1.0 * headDown, 0], [1.62, 2.58 - 1.5 * headDown, 0]];
  const headPos: V3 = [1.86 + 0.15 * headDown, 2.68 - 1.75 * headDown, 0];
  return (
    <group position={[pos[0], pos[1] + (1 - g) * -2.6 + sinkY + bob, pos[2]]} rotation={[0, rotY, 0]} scale={[1, 0.3 + 0.7 * g, 1]}>
      {/* legs: thigh + shin + padded foot */}
      {legs.map((l, i) => {
        const sw = Math.sin(walk + l.ph) * 0.35 * walkAmt;
        const hip: V3 = [l.x, 1.45, l.z];
        const knee: V3 = [l.x + Math.sin(sw) * 0.55, 0.85, l.z];
        const ankle: V3 = [l.x + Math.sin(sw) * 0.75, 0.16 + Math.max(0, Math.sin(walk + l.ph)) * 0.12 * walkAmt, l.z];
        const spread = 1 + padSpread * 0.9;
        return (
          <group key={i}>
            <Seg a={hip} b={knee} r={0.11} color={furC} opacity={op} />
            <Seg a={knee} b={ankle} r={0.075} color={furC} opacity={op} />
            <Ell pos={knee} r={[0.1, 0.1, 0.1]} color={dark} opacity={op} />
            <Ell pos={[ankle[0] + 0.05, 0.07, ankle[2]]} r={[0.17 * spread, 0.07, 0.15 * spread]} color={COL.pad} emissive={padSpread > 0.05 ? "#ffcf6b" : undefined} ei={padSpread * 0.25} />
          </group>
        );
      })}
      {/* body + belly */}
      <Ell pos={[0, 1.72, 0]} r={[0.95, 0.46 + belly * 0.12, 0.42 + belly * 0.14]} color={furC} opacity={op} />
      {/* hump */}
      <Ell pos={[-0.05, 2.12 + 0.12 * (hump - 1), 0]} r={[0.46 * hump, 0.44 * hump, 0.34 * hump]} color={xray ? "#bfe6ff" : dark} opacity={op} />
      {xray && fat > 0 && (
        <Ell pos={[-0.05, 2.12 + 0.12 * (hump - 1), 0]} r={[0.4 * hump * fat, 0.38 * hump * fat, 0.28 * hump * fat]} color={COL.fat} emissive={COL.fat} ei={0.5} />
      )}
      {xray && (
        <>
          {[0.13, -0.13].map((z) => (
            <Ell key={z} pos={[-0.32, 1.78, z]} r={[0.14 * (1 - kidneySqueeze * 0.3), 0.09 * (1 - kidneySqueeze * 0.3), 0.07]} rot={[0, 0, 0.4]} color={COL.kidney} emissive={COL.kidney} ei={0.3 + kidneyGlow} />
          ))}
        </>
      )}
      {/* tail */}
      <Seg a={[-0.92, 1.8, 0]} b={[-1.02, 1.35, 0]} r={0.035} color={dark} opacity={op} />
      {/* neck */}
      <Neck pts={[...neckPts, [headPos[0] - 0.18, headPos[1] - 0.02, 0]]} color={furC} opacity={op} />
      {/* head group */}
      <group position={headPos} rotation={[0, look * 0.9, -0.15 - headDown * 0.9]}>
        <CamelHead color={furC} dark={dark} opacity={op} nostrils={nostrils} lashGlow={lashGlow} blink={blink} />
      </group>
    </group>
  );
};

/** The friendly camel head (rounded skull + muzzle, big dark eyes, double lashes, slit nostrils). */
export const CamelHead: React.FC<{ color: string; dark: string; opacity?: number; nostrils?: number; lashGlow?: number; blink?: number }> = ({
  color, dark, opacity = 1, nostrils = 1, lashGlow = 0, blink = 0,
}) => (
  <group>
    <Ell pos={[0, 0, 0]} r={[0.3, 0.17, 0.15]} color={color} opacity={opacity} />
    <Ell pos={[0.22, -0.04, 0]} r={[0.16, 0.12, 0.12]} color={color} opacity={opacity} />
    {[0.08, -0.08].map((z) => (
      <Ell key={z} pos={[-0.18, 0.14, z]} r={[0.04, 0.07, 0.03]} color={dark} opacity={opacity} />
    ))}
    {[0.05, -0.05].map((z) => (
      <Ell key={z} pos={[0.37, 0.0, z]} r={[0.012, 0.022 * Math.max(0.08, nostrils), 0.01]} color="#2a1a10" />
    ))}
    {[1, -1].map((s) => (
      <Eye key={s} side={s} dark={dark} lashGlow={lashGlow} blink={blink} />
    ))}
  </group>
);

/** One lash: two thin tapered segments, the tip curling up and outward. */
const Lash: React.FC<{ base: THREE.Vector3; dir: THREE.Vector3; len: number; w: number; color: string; glow: number; curl?: THREE.Vector3 }> = ({ base, dir, len, w, color, glow, curl }) => {
  const d1 = dir.clone().normalize();
  const d2 = d1.clone().add((curl ?? new THREE.Vector3(0, 1, 0)).clone().multiplyScalar(0.9)).normalize();
  const l1 = len * 0.55, l2 = len * 0.5;
  const mid = base.clone().add(d1.clone().multiplyScalar(l1));
  const seg = (from: THREE.Vector3, d: THREE.Vector3, l: number, r0: number, r1: number, key: string) => (
    <mesh key={key} position={from.clone().add(d.clone().multiplyScalar(l / 2))} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)}>
      <cylinderGeometry args={[r1, r0, l, 5]} />
      <meshStandardMaterial color={color} roughness={0.55} emissive={glow > 0 ? "#ffcf6b" : "#000"} emissiveIntensity={glow * 0.35} />
    </mesh>
  );
  return <group>{seg(base, d1, l1, w, w * 0.7, "a")}{seg(mid, d2, l2, w * 0.7, w * 0.25, "b")}</group>;
};

/**
 * Camel eye on the side of the head: glossy dark eye with a catch-light, a heavy upper lid,
 * a DOUBLE row of long lashes fanned along the upper lid and short lashes on the lower lid.
 * Lashes fan outward from the lid rim (side = +1 / -1 for the head's two sides).
 */
const Eye: React.FC<{ side: number; dark: string; lashGlow: number; blink: number }> = ({ side: s, dark, lashGlow, blink }) => {
  const R = 0.044;
  const lashCol = lashGlow > 0 ? mix("#2a180c", "#6b4420", lashGlow * 0.6) : "#2a180c";
  const out = new THREE.Vector3(0, 0, s); // outward from the head side
  const lashes: React.ReactNode[] = [];
  // upper lid: two rows (outer longer, inner shorter), angles run from the front corner (toward the nose, +x) to the back
  [{ n: 13, r: 1.06, len: 0.062, w: 0.0028, lift: 0.55 }, { n: 11, r: 0.97, len: 0.046, w: 0.0024, lift: 0.9 }].forEach((row, ri) => {
    for (let k = 0; k < row.n; k++) {
      const a = (-70 + (140 * k) / (row.n - 1)) * (Math.PI / 180) + ri * 0.06;
      const rim = new THREE.Vector3(Math.sin(a) * R * row.r, Math.cos(a) * R * row.r, R * 0.45 * s);
      const radial = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
      const dir = radial.multiplyScalar(0.9).add(out.clone().multiplyScalar(row.lift)).add(new THREE.Vector3(0, 0.35, 0));
      const len = row.len * (0.75 + 0.25 * Math.cos(a)); // longest in the middle of the lid
      lashes.push(<Lash key={`u${ri}-${k}`} base={rim} dir={dir} len={len} w={row.w} color={lashCol} glow={lashGlow} curl={new THREE.Vector3(0, 0.8, 0.4 * s)} />);
    }
  });
  // lower lid: short sparse lashes pointing down/out
  for (let k = 0; k < 7; k++) {
    const a = (180 - 50 + (100 * k) / 6) * (Math.PI / 180);
    const rim = new THREE.Vector3(Math.sin(a) * R, Math.cos(a) * R, R * 0.45 * s);
    const dir = new THREE.Vector3(Math.sin(a), Math.cos(a), 0).add(out.clone().multiplyScalar(0.7));
    lashes.push(<Lash key={`l${k}`} base={rim} dir={dir} len={0.024} w={0.0022} color={lashCol} glow={lashGlow} curl={new THREE.Vector3(0, -0.6, 0.4 * s)} />);
  }
  const lid = Math.max(0.12, 1 - blink);
  return (
    <group position={[0.06, 0.07, 0.13 * s]}>
      {/* glossy eye + catch-light */}
      <mesh scale={[1, lid, 1]}>
        <sphereGeometry args={[R, 24, 18]} />
        <meshStandardMaterial color="#120c08" roughness={0.08} />
      </mesh>
      <mesh position={[0.012, 0.016 * lid, R * 0.92 * s]}>
        <sphereGeometry args={[0.0055, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* heavy upper eyelid (top cap of a slightly bigger sphere), drops when blinking */}
      <mesh rotation={[0, 0, 0]} position={[0, 0.004 - blink * 0.03, 0]} scale={[1.12, 1.12, 1.12]}>
        <sphereGeometry args={[R, 24, 12, 0, Math.PI * 2, 0, Math.PI * (0.32 + 0.3 * blink)]} />
        <meshStandardMaterial color={dark} roughness={0.8} />
      </mesh>
      <group position={[0, -blink * 0.03, 0]}>{lashes}</group>
    </group>
  );
};

/** Smooth tapered neck: tube along a spline, thicker at the shoulders. */
const Neck: React.FC<{ pts: V3[]; color: string; opacity: number }> = ({ pts, color, opacity }) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 48, 1, 16, false);
  // taper: scale each ring's radius from 0.19 (shoulder) to 0.11 (head)
  const pos = geo.attributes.position;
  const rings = 49, seg = 17;
  for (let r = 0; r < rings; r++) {
    const u = r / (rings - 1);
    const c = curve.getPointAt(u);
    const rad = 0.2 - 0.09 * u;
    for (let k = 0; k < seg; k++) {
      const idx = r * seg + k;
      const v = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(c).multiplyScalar(rad).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return (
    <mesh geometry={geo} castShadow={opacity === 1}>
      <meshStandardMaterial key={opacity < 1 ? "t" : "o"} color={color} roughness={0.8} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
};

// ---------------------------------------------------------------- props
/** Water bottle standing in the sand; level 0..1, tip 0..1 falls over. */
export const Bottle: React.FC<{ level: number; tip: number; visible: number }> = ({ level, tip, visible }) => {
  if (visible <= 0.01) return null;
  return (
    <group position={[0, 0, 0]} rotation={[0, 0, (Math.PI / 2) * easeOutBounce(tip)]} scale={visible}>
      <group position={[0, 0.0, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.84, 32]} />
          <meshStandardMaterial key="glass" color="#d9f1ff" transparent opacity={0.35} roughness={0.05} depthWrite={false} />
        </mesh>
        {level > 0.01 && (
          <mesh position={[0, 0.03 + 0.38 * level, 0]}>
            <cylinderGeometry args={[0.185, 0.185, 0.76 * level, 32]} />
            <meshStandardMaterial color={COL.water} emissive={COL.water} emissiveIntensity={0.25} transparent opacity={0.85} />
          </mesh>
        )}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.09, 0.2, 0.14, 32]} />
          <meshStandardMaterial color="#d9f1ff" transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.09, 24]} />
          <meshStandardMaterial color="#1f6fd1" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.205, 0.205, 0.22, 32, 1, true]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
function easeOutBounce(x: number) {
  const n1 = 7.5625, d1 = 2.75;
  x = clamp01(x);
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** Wind-driven sand streaks blowing along +x... toward the camel's face (from +x side). */
export const Sandstorm: React.FC<{ t: number; amount: number; focus: V3; deflect?: boolean }> = ({ t, amount, focus, deflect }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {Array.from({ length: 140 }, (_, i) => {
        const speed = 3 + rnd(i, 1) * 3;
        const ph = (t * speed / 6 + rnd(i, 2)) % 1;
        const y = focus[1] + (rnd(i, 3) - 0.5) * 2.2;
        const z = focus[2] + (rnd(i, 4) - 0.5) * 2.4;
        let x = focus[0] + 3 - ph * 6; // travels from +x toward -x (into the face)
        let yy = y, zz = z;
        if (deflect && x < focus[0] + 0.25 && Math.abs(y - focus[1]) < 0.35 && Math.abs(z - focus[2]) < 0.4) {
          const b = focus[0] + 0.25 - x;
          x = focus[0] + 0.25 + b * 0.6;
          yy = y + b * 0.8;
          zz = z + (rnd(i, 5) - 0.5) * b;
        }
        return (
          <mesh key={i} position={[x, yy, zz]} scale={[1 + speed * 0.4, 1, 1]}>
            <sphereGeometry args={[0.018 + rnd(i, 6) * 0.02, 6, 4]} />
            <meshBasicMaterial color="#f3d9a4" transparent opacity={amount * 0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Ring of sand pushed out around a planted foot. */
export const SandRing: React.FC<{ pos: V3; k: number }> = ({ pos, k }) => {
  if (k <= 0 || k >= 1) return null;
  return (
    <mesh position={[pos[0], 0.02, pos[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={0.3 + k * 1.2}>
      <ringGeometry args={[0.22, 0.32, 40]} />
      <meshBasicMaterial color="#f6dcaa" transparent opacity={1 - k} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** Little blue water drops leaving the body (or arrows returning). */
export const Drops: React.FC<{ t: number; from: V3; dir: V3; amount: number; color?: string }> = ({ t, from, dir, amount, color = COL.water }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => {
        const ph = (t * 1.4 + i / 12) % 1;
        const p: V3 = [from[0] + dir[0] * ph + (rnd(i, 1) - 0.5) * 0.3, from[1] + dir[1] * ph - ph * ph * 0.3, from[2] + dir[2] * ph + (rnd(i, 2) - 0.5) * 0.3];
        return (
          <mesh key={i} position={p} scale={[1, 1.4, 1]}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={amount * (1 - ph)} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Heat shimmer arrows rising off a body. */
export const HeatArrows: React.FC<{ t: number; center: V3; amount: number; color?: string; spread?: number }> = ({ t, center, amount, color = "#ff7a3a", spread = 1.6 }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => {
        const ph = (t * 0.9 + i / 6) % 1;
        const x = center[0] + (i / 5 - 0.5) * spread;
        const y = center[1] + ph * 1.0;
        return <Arrow3D key={i} a={[x, y, center[2]]} b={[x, y + 0.35, center[2]]} color={color} width={0.022} opacity={amount * Math.sin(ph * Math.PI)} />;
      })}
    </group>
  );
};

// ---------------------------------------------------------------- blood vessel world (placed far away at x=100)
export const VESSEL: V3 = [100, 0, 0];
export const Vessel: React.FC<{ t: number; oval: number; thick: number; water: number; swell: number }> = ({ t, oval, thick, water, swell }) => {
  const speed = 0.25 + oval * 1.4 - thick * 0.15;
  return (
    <group position={VESSEL}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 30, 48, 1, true]} />
        <meshStandardMaterial color={mix("#c02a3a", "#7fc6ff", water * 0.6)} side={THREE.BackSide} roughness={0.6} emissive="#5a0010" emissiveIntensity={0.25} />
      </mesh>
      {/* plasma fog */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.15, 1.15, 30, 32, 1, true]} />
        <meshBasicMaterial color={mix("#5a0a14", "#3fa9f5", water)} transparent opacity={0.12 + thick * 0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: 70 }, (_, i) => {
        const lane = rnd(i, 1) * Math.PI * 2, rr = rnd(i, 2) * 0.85;
        const x = ((rnd(i, 3) * 30 + t * speed * (0.8 + rnd(i, 4) * 0.4)) % 30) - 15;
        // thick blood: cells clump into stacks
        const clump = thick * (Math.round(x * 1.5) / 1.5 - x);
        const sx = (1 + oval * 0.9) * (1 + swell * 0.45);
        const sy = (1 - oval * 0.35) * (1 + swell * 0.45);
        return (
          <mesh key={i} position={[x + clump, Math.cos(lane) * rr, Math.sin(lane) * rr]} rotation={[rnd(i, 5) * 3, rnd(i, 6) * 3 + t * 0.6, 0]} scale={[0.22 * sx, 0.22 * sy, 0.08 * (1 + swell * 0.6)]}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color={mix(COL.blood, "#ff5470", swell * 0.4)} roughness={0.4} emissive="#600010" emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- oasis + fish (for the ending gag)
export const OASIS: V3 = [4.6, 0, -0.6];
export const Oasis: React.FC<{ water: number; t: number }> = ({ water, t }) => (
  <group position={OASIS}>
    {/* wet mud bed */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <circleGeometry args={[1.5, 48]} />
      <meshStandardMaterial color={water > 0.05 ? "#8a6a43" : "#b08a58"} roughness={1} />
    </mesh>
    {/* cracks appear when dry */}
    {water < 0.2 &&
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6, 0.02, Math.sin(a) * 0.6]} rotation={[-Math.PI / 2, 0, -a]}>
            <planeGeometry args={[0.9, 0.025]} />
            <meshBasicMaterial color="#6b4e2c" transparent opacity={1 - water * 5} />
          </mesh>
        );
      })}
    {water > 0.01 && (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03 + 0.06 * water, 0]} scale={0.25 + 0.75 * water}>
        <circleGeometry args={[1.45, 64]} />
        <meshStandardMaterial color="#2f9be8" emissive="#1e74c4" emissiveIntensity={0.35 + 0.08 * Math.sin(t * 4)} roughness={0.08} metalness={0.2} transparent opacity={0.92} />
      </mesh>
    )}
    {/* rocks + palms */}
    {[[1.6, 0.3], [-1.5, 0.6], [0.6, -1.5], [-0.9, -1.3]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.12, z]} scale={[0.35, 0.22, 0.3]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#b9a58a" flatShading roughness={1} />
      </mesh>
    ))}
    <Palm pos={[-1.7, 0, -0.9]} h={3.2} lean={-0.15} t={t} />
    <Palm pos={[1.4, 0, -1.6]} h={2.6} lean={0.2} t={t} />
  </group>
);
const Palm: React.FC<{ pos: V3; h: number; lean: number; t: number }> = ({ pos, h, lean, t }) => (
  <group position={pos} rotation={[0, 0, lean]}>
    {Array.from({ length: 8 }, (_, i) => (
      <mesh key={i} position={[0, (i + 0.5) * (h / 8), 0]}>
        <cylinderGeometry args={[0.1 - i * 0.004, 0.12 - i * 0.004, h / 8, 10]} />
        <meshStandardMaterial color={i % 2 ? "#8b6440" : "#9c7148"} roughness={0.9} />
      </mesh>
    ))}
    {Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2;
      const sway = Math.sin(t * 1.5 + i) * 0.05;
      return (
        <group key={i} position={[0, h, 0]} rotation={[0, a, -0.55 + sway]}>
          <mesh position={[0.7, 0, 0]} scale={[0.75, 0.04, 0.2]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color="#3e9c4a" roughness={0.8} />
          </mesh>
        </group>
      );
    })}
  </group>
);

/** Little orange fish: flops, then looks at the camera and blinks. */
export const Fish: React.FC<{ t: number; visible: boolean; flop: number; look: number; blink: number }> = ({ t, visible, flop, look, blink }) => {
  if (!visible) return null;
  const f = Math.sin(t * 22) * flop;
  return (
    <group position={[OASIS[0], 0.1 + Math.abs(f) * 0.12, OASIS[2] + 0.3]} rotation={[Math.PI / 2 * (1 - look) * 0.9 + f * 0.4, look * -0.6, f * 0.3]}>
      <mesh scale={[0.22, 0.12, 0.06]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#ff8a2a" roughness={0.35} />
      </mesh>
      <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.1, 0.14, 3]} />
        <meshStandardMaterial color="#ff6a1a" />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0.12, 0.03, 0.05 * s]}>
          <mesh>
            <sphereGeometry args={[0.032, 14, 10]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.005, 0, 0.02 * s]} scale={[1, Math.max(0.1, 1 - blink), 1]}>
            <sphereGeometry args={[0.018, 12, 10]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
