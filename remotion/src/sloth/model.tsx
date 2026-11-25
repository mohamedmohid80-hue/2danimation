// 3D pieces for the sloth video. x right, y up, z toward camera. Rainforest trunk axis = y at x=z=0.
// Materials that flip opaque <-> see-through are keyed on that mode.
import React, { useMemo } from "react";
import * as THREE from "three";

export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const rnd = (i: number, n: number) => {
  const s = Math.sin(i * 91.7 + n * 13.3) * 9999.1;
  return s - Math.floor(s);
};
const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(k)).getStyle();
export const TRUNK_R = 0.5;

export const COLS = {
  fur: "#b39470",
  furDark: "#6e5636",
  algae: "#6f9a3a",
  face: "#efe2c8",
  mask: "#3a2a1a",
  claw: "#d9cdb4",
  bark: "#6b5138",
  leaf: "#3f8f3a",
  ground: "#5a4128",
  poop: "#4a3420",
};

// ------------------------------------------------------------------ helpers
const Ell: React.FC<{ pos: V3; r: V3; color: string; rot?: V3; opacity?: number; emissive?: string; ei?: number; rough?: number }> = ({
  pos, r, color, rot = [0, 0, 0], opacity = 1, emissive, ei = 0.5, rough = 0.8,
}) => (
  <mesh position={pos} scale={r} rotation={rot} castShadow={opacity === 1}>
    <sphereGeometry args={[1, 32, 22]} />
    <meshStandardMaterial key={opacity < 1 ? "t" : "o"} color={color} roughness={rough} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
      emissive={emissive ?? "#000"} emissiveIntensity={emissive ? ei : 0} />
  </mesh>
);

/** Tapered tube between points (smooth limb). */
const Limb: React.FC<{ pts: THREE.Vector3[]; r0: number; r1: number; color: string; opacity?: number }> = ({ pts, r0, r1, color, opacity = 1 }) => {
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = 20, rad = 10;
  const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const pos = geo.attributes.position;
  for (let r = 0; r <= seg; r++) {
    const u = r / seg;
    const c = curve.getPointAt(u);
    const k = r0 + (r1 - r0) * u + 0.012 * Math.sin(u * 30); // slight shagginess
    for (let j = 0; j <= rad; j++) {
      const idx = r * (rad + 1) + j;
      const v = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return (
    <mesh geometry={geo} castShadow={opacity === 1}>
      <meshStandardMaterial key={opacity < 1 ? "t" : "o"} color={color} roughness={0.95} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
};

/** Shaggy displaced sphere (fur blob) with grey variation baked in vertex colours. */
const useShaggy = (seed: number, amp = 0.09) =>
  useMemo(() => {
    const g = new THREE.SphereGeometry(1, 64, 48);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const n = Math.sin(v.x * 9 + seed) * Math.sin(v.y * 11 + seed * 2) * Math.sin(v.z * 10 + seed * 3);
      const n2 = Math.sin(v.y * 31 + v.x * 7) * 0.5;
      const k = 1 + amp * (n * 0.7 + n2 * 0.3) + (v.y < 0 ? amp * 0.4 * Math.sin(v.x * 40) : 0);
      v.multiplyScalar(k);
      p.setXYZ(i, v.x, v.y, v.z);
      const g2 = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(v.x * 17 + v.y * 13 + seed));
      cols.set([g2, g2, g2], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }, [seed, amp]);

// ------------------------------------------------------------------ sloth
export type SlothPose = {
  pos: V3; // body centre (world)
  rot: V3; // body euler (world). Default facing the trunk = rot [0, PI, 0] with body on +z side
  hands: [V3, V3]; // world targets (left, right)
  feet: [V3, V3];
  look?: number; // head turn toward camera 0..1
  headTilt?: number;
  algae?: number; // 0 brown .. 1 green fur
  xray?: boolean;
  stomach?: number; // 0..1 stomach fullness (x-ray)
  t?: number;
  blink?: number;
  mouth?: number; // 0 smile .. 1 open (chewing/straining)
  wiggle?: number; // poop dance
  squish?: number; // 0..1 body thinner after the drop
  moths?: number; // how many moths visible on the fur (0..40)
  mothsLift?: number; // 0..1 moths taking off
  tufts?: boolean; // spiky fur tufts (off for the low-poly look)
};

const SHOULDERS: V3[] = [[0.27, 0.3, 0.06], [-0.27, 0.3, 0.06]];
const HIPS: V3[] = [[0.2, -0.32, 0.06], [-0.2, -0.32, 0.06]];

/** 2-bone IK: returns elbow position. */
const ik = (s: THREE.Vector3, t: THREE.Vector3, a: number, b: number, pole: THREE.Vector3) => {
  const d = Math.min(s.distanceTo(t), a + b - 1e-3);
  const dir = t.clone().sub(s).normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const pp = pole.clone().sub(s);
  const perp = pp.sub(dir.clone().multiplyScalar(pp.dot(dir))).normalize();
  return s.clone().add(dir.multiplyScalar(x)).add(perp.multiplyScalar(h));
};

const Claws: React.FC<{ at: THREE.Vector3; dir: THREE.Vector3; color: string; len?: number }> = ({ at, dir, color, len = 0.13 }) => {
  const d = dir.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  return (
    <group>
      {[-1, 0, 1].map((k) => {
        const base = at.clone().add(side.clone().multiplyScalar(k * 0.035));
        const tipDir = d.clone().add(new THREE.Vector3(0, -0.5, 0)).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
        return (
          <mesh key={k} position={base.clone().add(tipDir.clone().multiplyScalar(len / 2))} quaternion={q}>
            <coneGeometry args={[0.014, len, 8]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Sloth: React.FC<SlothPose> = ({
  pos, rot, hands, feet, look = 0, headTilt = 0, algae = 0.3, xray, stomach = 0, t = 0, blink = 0, mouth = 0, wiggle = 0, squish = 0, moths = 0, mothsLift = 0, tufts = true,
}) => {
  const bodyGeo = useShaggy(1.3, 0.1);
  const headGeo = useShaggy(4.1, 0.06);
  const fur = mix(COLS.fur, COLS.algae, algae);
  const furDark = mix(COLS.furDark, "#4c6a2a", algae);
  const op = xray ? 0.2 : 1;
  const wig = wiggle * Math.sin(t * 14);
  const breathe = 1 + 0.015 * Math.sin(t * 2);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0] + wig * 0.05, pos[1] + Math.abs(wig) * 0.03, pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2] + wig * 0.18)),
    new THREE.Vector3(1 - squish * 0.12, 1, 1 - squish * 0.12),
  );
  const toW = (p: V3) => new THREE.Vector3(...p).applyMatrix4(m);
  const outward = new THREE.Vector3(0, 0, -1).transformDirection(m); // away from trunk (local -z)
  const limbs = [
    ...SHOULDERS.map((s, i) => ({ s: toW(s), t: new THREE.Vector3(...hands[i]), a: 0.4, b: 0.4, r0: 0.085, r1: 0.05, side: i === 0 ? 1 : -1 })),
    ...HIPS.map((s, i) => ({ s: toW(s), t: new THREE.Vector3(...feet[i]), a: 0.3, b: 0.3, r0: 0.09, r1: 0.055, side: i === 0 ? 1 : -1 })),
  ];
  return (
    <group>
      {/* body + head in local frame */}
      <group matrixAutoUpdate={false} matrix={m}>
        <mesh geometry={bodyGeo} scale={[0.33 * breathe, 0.46, 0.27 * breathe]} castShadow={!xray}>
          <meshStandardMaterial key={xray ? "t" : "o"} vertexColors color={xray ? "#bfe6ff" : fur} roughness={1} transparent={!!xray} opacity={op} depthWrite={!xray} />
        </mesh>
        {/* shaggy tufts on the back */}
        {!xray && tufts &&
          Array.from({ length: 46 }, (_, i) => {
            const th = rnd(i, 1) * Math.PI * 2, y = (rnd(i, 2) - 0.5) * 0.8;
            const r = Math.sqrt(Math.max(0, 1 - (y / 0.46) ** 2));
            const p: V3 = [Math.cos(th) * 0.33 * r, y, Math.sin(th) * 0.27 * r];
            return (
              <mesh key={i} position={p} rotation={[0.4 + Math.sin(th) * 0.5, 0, -Math.cos(th) * 0.5 + 0.3]} scale={[1, 1 + rnd(i, 3), 1]}>
                <coneGeometry args={[0.032, 0.075, 6]} />
                <meshStandardMaterial color={rnd(i, 4) > 0.5 ? fur : furDark} roughness={1} />
              </mesh>
            );
          })}
        {xray && stomach > 0 && (
          <group position={[0, -0.02, 0]}>
            <Ell pos={[0, 0, 0]} r={[0.17 + 0.07 * stomach, 0.15 + 0.07 * stomach, 0.13 + 0.05 * stomach]} color="#7a8a3a" emissive="#5d7a20" ei={0.3} />
            {Array.from({ length: 10 }, (_, i) => {
              const a = t * (0.6 + rnd(i, 1)) + i;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.1 * (0.6 + stomach), Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.08 + 0.12]} rotation={[a, a * 0.7, 0]} scale={[0.05, 0.02, 0.003]}>
                  <sphereGeometry args={[1, 10, 6]} />
                  <meshStandardMaterial color="#5fb84a" emissive="#3c8a2a" emissiveIntensity={0.5} />
                </mesh>
              );
            })}
          </group>
        )}
        {/* moths resting in the fur */}
        {Array.from({ length: Math.round(moths) }, (_, i) => {
          const th = Math.PI * (0.6 + rnd(i, 7) * 0.8) + Math.PI, y = (rnd(i, 8) - 0.45) * 0.75;
          const r = Math.sqrt(Math.max(0, 1 - (y / 0.5) ** 2));
          const lift = clamp01((mothsLift - rnd(i, 9) * 0.5) / 0.5);
          const base: V3 = [Math.cos(th) * 0.36 * r, y, Math.sin(th) * 0.3 * r];
          const p: V3 = [base[0] * (1 + lift * 3) + Math.sin(t * 5 + i) * 0.1 * lift, base[1] + lift * (0.6 + rnd(i, 10)), base[2] * (1 + lift * 3) - lift * 0.4];
          return <Moth key={i} pos={p} scale={0.6} flap={lift > 0 ? (t * 7 + i * 0.3) % 1 : 0.15 + 0.1 * Math.sin(t * 3 + i)} />;
        })}
        {/* stubby tail */}
        <Ell pos={[0, -0.47, 0.02]} r={[0.07, 0.06, 0.06]} color={furDark} opacity={op} />
        {/* head (turns toward camera = local -z) */}
        <group position={[0, 0.56, -0.02]} rotation={[headTilt, Math.PI * 0.15 * (1 - look) + 0.02 * Math.sin(t * 1.3), 0.06 * Math.sin(t * 0.9)]}>
          <mesh geometry={headGeo} scale={[0.2, 0.19, 0.19]} castShadow={!xray}>
            <meshStandardMaterial key={xray ? "t" : "o"} vertexColors color={xray ? "#bfe6ff" : fur} roughness={1} transparent={!!xray} opacity={op} depthWrite={!xray} />
          </mesh>
          {!xray && (
            <group position={[0, -0.01, -0.13]}>
              {/* pale face */}
              <Ell pos={[0, 0, 0]} r={[0.15, 0.12, 0.07]} color={COLS.face} rough={0.9} />
              {/* dark eye-mask stripes */}
              {[1, -1].map((s) => (
                <group key={s}>
                  <Ell pos={[0.065 * s, 0.015, -0.045]} r={[0.065, 0.028, 0.02]} rot={[0, 0, -0.35 * s]} color={COLS.mask} />
                  <mesh position={[0.06 * s, 0.022, -0.07]} scale={[1, Math.max(0.1, 1 - blink), 1]}>
                    <sphereGeometry args={[0.017, 14, 10]} />
                    <meshStandardMaterial color="#0a0705" roughness={0.1} />
                  </mesh>
                  <mesh position={[0.065 * s, 0.03, -0.085]}>
                    <sphereGeometry args={[0.005, 8, 6]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                </group>
              ))}
              {/* nose + smile */}
              <Ell pos={[0, -0.03, -0.07]} r={[0.03, 0.022, 0.02]} color="#2a1a10" rough={0.3} />
              <mesh position={[0, -0.065 - mouth * 0.01, -0.06]} rotation={[0, 0, Math.PI]} scale={[1, 1 + mouth * 1.5, 1]}>
                <torusGeometry args={[0.028, 0.006, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#2a1a10" />
              </mesh>
            </group>
          )}
        </group>
      </group>
      {/* limbs (world space, IK to grip targets) */}
      {limbs.map((l, i) => {
        const pole = l.s.clone().add(outward.clone().multiplyScalar(0.6)).add(new THREE.Vector3(0, i < 2 ? -0.3 : 0.3, 0));
        const e = ik(l.s, l.t, l.a, l.b, pole);
        const dir = l.t.clone().sub(e);
        return (
          <group key={i}>
            <Limb pts={[l.s, l.s.clone().lerp(e, 0.5).add(outward.clone().multiplyScalar(0.02)), e, e.clone().lerp(l.t, 0.5), l.t]} r0={l.r0} r1={l.r1} color={xray ? "#bfe6ff" : fur} opacity={op} />
            {/* rounded paw at the end of the limb */}
            <mesh position={l.t} scale={[0.065, 0.055, 0.065]}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial key={xray ? "t" : "o"} color={xray ? "#bfe6ff" : furDark} roughness={1} transparent={!!xray} opacity={op} />
            </mesh>
            {/* claws hook over the bark: inward toward the trunk and down */}
            <Claws at={l.t.clone().add(new THREE.Vector3(l.t.x, 0, l.t.z).normalize().multiplyScalar(0.03))} dir={new THREE.Vector3(-l.t.x, 0, -l.t.z).normalize().multiplyScalar(0.35).add(new THREE.Vector3(0, -0.6, 0)).add(new THREE.Vector3(l.t.z, 0, -l.t.x).normalize().multiplyScalar(0.25 * Math.sign(l.t.x || 1)))} color={COLS.claw} len={i < 2 ? 0.14 : 0.11} />
          </group>
        );
      })}
    </group>
  );
};

/** Grip targets on the trunk at a body height; climbing phase d (metres descended). */
/** Outer radius of the trunk mesh at world height y (taper + bark bumps + root flare), so limbs sit ON the bark. */
export const trunkR = (y: number) => {
  const taper = TRUNK_R * (1.35 - 0.35 * (y / 30));
  return taper * (1.07 + Math.max(0, 1.2 - y) * 0.35);
};
/** Distance of the sloth's body centre from the trunk axis. */
export const slothZ = (y: number) => trunkR(y) + 0.3;

export const trunkGrip = (bodyY: number, d: number, side = 1): { hands: [V3, V3]; feet: [V3, V3] } => {
  const stride = 0.34;
  const L = stride / 0.7;
  const limb = (base: number, ang: number, off: number): V3 => {
    const p = (((d / L + off) % 1) + 1) % 1;
    let rel: number, lift = 0;
    if (p < 0.7) rel = stride * (p / 0.7 - 0.5);
    else {
      const q = (p - 0.7) / 0.3;
      rel = stride * (0.5 - q);
      lift = Math.sin(q * Math.PI) * 0.12;
    }
    const y = bodyY + base + rel;
    const r = trunkR(y) + 0.035 + lift;
    return [Math.sin(ang) * r * side, y, Math.cos(ang) * r];
  };
  return {
    hands: [limb(0.72, 0.72, 0), limb(0.72, -0.72, 0.5)],
    feet: [limb(-0.5, 0.7, 0.5), limb(-0.5, -0.7, 0)],
  };
};
/** Body placement for a sloth hugging the trunk (+z side) at height y. */
export const onTrunk = (y: number): { pos: V3; rot: V3 } => ({ pos: [0, y, slothZ(y)], rot: [0, Math.PI, 0] });

// ------------------------------------------------------------------ moth
export const Moth: React.FC<{ pos: V3; flap: number; scale?: number; heading?: number }> = ({ pos, flap, scale = 1, heading = 0 }) => {
  const w = Math.sin(flap * Math.PI * 2) * 0.9;
  return (
    <group position={pos} scale={scale} rotation={[0, heading, 0]}>
      <mesh scale={[0.012, 0.012, 0.04]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#5a4a38" roughness={0.9} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} rotation={[0, 0, s * w]}>
          <mesh position={[0.03 * s, 0, 0]} scale={[0.035, 0.002, 0.03]}>
            <sphereGeometry args={[1, 12, 6]} />
            <meshStandardMaterial color="#8c7a62" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ------------------------------------------------------------------ rainforest
export const Rainforest: React.FC<{ t: number }> = ({ t }) => {
  const trunk = useMemo(() => {
    const g = new THREE.CylinderGeometry(TRUNK_R, TRUNK_R * 1.35, 30, 96, 80, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.05 * Math.sin(a * 13 + Math.sin(y * 0.8) * 2) + 0.02 * Math.sin(a * 37 + y * 3) + (y < -13.8 ? (-13.8 - y) * 0.35 * (0.5 + 0.5 * Math.sin(a * 5)) : 0);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.translate(0, 15, 0);
    g.computeVertexNormals();
    return g;
  }, []);
  const trees = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const a = rnd(i, 1) * Math.PI * 2, r = 5 + rnd(i, 2) * 25;
    return { p: [Math.cos(a) * r, 0, Math.sin(a) * r] as V3, r: 0.25 + rnd(i, 3) * 0.6, h: 14 + rnd(i, 4) * 12 };
  }), []);
  const plants = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const a = rnd(i, 5) * Math.PI * 2, r = 1.2 + rnd(i, 6) * 9;
    return { p: [Math.cos(a) * r, 0, Math.sin(a) * r] as V3, s: 0.3 + rnd(i, 7) * 0.7, k: rnd(i, 8) };
  }).filter((pl) => !(pl.p[2] > -0.5 && Math.hypot(pl.p[0], pl.p[2]) < 7)), []); // keep the camera side of the trunk base clear
  return (
    <group>
      {/* ground: leaf litter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={COLS.ground} roughness={1} />
      </mesh>
      {Array.from({ length: 160 }, (_, i) => {
        const a = rnd(i, 11) * Math.PI * 2, r = 0.7 + rnd(i, 12) * 5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.01 + rnd(i, 13) * 0.01, Math.sin(a) * r]} rotation={[-Math.PI / 2, 0, rnd(i, 14) * 6]} scale={[0.09, 0.05, 1]}>
            <circleGeometry args={[1, 10]} />
            <meshStandardMaterial color={["#7a5a2a", "#8c6a34", "#5e4a22", "#9a7a3a"][i % 4]} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {/* main trunk + branches */}
      <mesh geometry={trunk} castShadow receiveShadow>
        <meshStandardMaterial color={COLS.bark} roughness={0.95} />
      </mesh>
      {[[8.6, 0.6, 1.2], [10.5, -2.2, 0.9], [12, 1.6, 0.8], [13.5, -0.5, 0.7]].map(([y, a, len], i) => (
        <group key={i} position={[0, y, 0]} rotation={[0, a, 0.9]}>
          <mesh position={[0, len * 1.4, 0]}>
            <cylinderGeometry args={[0.12, 0.22, len * 2.8, 12]} />
            <meshStandardMaterial color={COLS.bark} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* canopy leaf clumps */}
      {Array.from({ length: 26 }, (_, i) => {
        const a = rnd(i, 21) * Math.PI * 2, r = 1 + rnd(i, 22) * 5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 11 + rnd(i, 23) * 5, Math.sin(a) * r - 1]} scale={[1.6 + rnd(i, 24), 1 + rnd(i, 25) * 0.6, 1.6]} rotation={[0, a, 0]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={i % 3 ? COLS.leaf : "#2f7a34"} flatShading roughness={0.9} />
          </mesh>
        );
      })}
      {/* hanging vines */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = (rnd(i, 31) - 0.5) * 8, z = -1 - rnd(i, 32) * 4, top = 13 + rnd(i, 33) * 3, len = 4 + rnd(i, 34) * 6;
        const sway = Math.sin(t * 0.8 + i) * 0.15;
        return (
          <mesh key={i} position={[x + sway, top - len / 2, z]} rotation={[0, 0, sway * 0.1]}>
            <cylinderGeometry args={[0.025, 0.03, len, 6]} />
            <meshStandardMaterial color="#3e6a2c" roughness={1} />
          </mesh>
        );
      })}
      {/* background trees */}
      {trees.map((tr, i) => (
        <group key={i} position={tr.p}>
          <mesh position={[0, tr.h / 2, 0]}>
            <cylinderGeometry args={[tr.r * 0.8, tr.r, tr.h, 10]} />
            <meshStandardMaterial color={i % 2 ? "#5a4632" : "#4a3a2a"} roughness={1} />
          </mesh>
          <mesh position={[0, tr.h, 0]} scale={[3, 2.2, 3]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={i % 3 ? "#357a36" : "#2a6a30"} flatShading roughness={1} />
          </mesh>
        </group>
      ))}
      {/* ferns + bushes on the floor */}
      {plants.map((pl, i) =>
        pl.k > 0.5 ? (
          <group key={i} position={pl.p} scale={pl.s}>
            {Array.from({ length: 7 }, (_, k) => {
              const a = (k / 7) * Math.PI * 2 + i;
              return (
                <mesh key={k} position={[Math.cos(a) * 0.35, 0.3, Math.sin(a) * 0.35]} rotation={[Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9]} scale={[0.12, 0.6, 0.02]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color={k % 2 ? "#4f9e3e" : "#3e8a34"} roughness={0.9} />
                </mesh>
              );
            })}
          </group>
        ) : (
          <mesh key={i} position={[pl.p[0], 0.35 * pl.s, pl.p[2]]} scale={[0.7 * pl.s, 0.5 * pl.s, 0.7 * pl.s]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={i % 2 ? "#2f7a34" : "#3a8a3c"} flatShading roughness={1} />
          </mesh>
        ),
      )}
    </group>
  );
};

// ------------------------------------------------------------------ predators
export const Jaguar: React.FC<{ pos: V3; heading: number; walk: number; crouch?: number; eyesOnly?: number }> = ({ pos, heading, walk, crouch = 0, eyesOnly = 0 }) => {
  const c = "#d9a043";
  // rosettes on the ellipsoid body surface (radii 0.65, 0.24, 0.22 centred at y 0.55), oriented along the surface normal
  const spots = useMemo(() => Array.from({ length: 46 }, (_, i) => {
    const u = (rnd(i, 1) - 0.5) * 1.7; // along the body
    const ph = (rnd(i, 2) - 0.5) * Math.PI * 1.5 + (rnd(i, 3) > 0.5 ? 0 : Math.PI); // around it (skip the belly)
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const p = new THREE.Vector3(0.65 * u, 0.55 + 0.24 * Math.cos(ph) * s, 0.22 * Math.sin(ph) * s);
    const n = new THREE.Vector3(u / 0.65, (Math.cos(ph) * s) / 0.24, (Math.sin(ph) * s) / 0.22).normalize();
    return { p: p.add(n.clone().multiplyScalar(0.004)), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), r: 0.035 + rnd(i, 4) * 0.025 };
  }).filter((sp) => sp.p.y > 0.42), []);
  if (eyesOnly > 0.5) {
    return (
      <group position={pos} rotation={[0, heading, 0]}>
        {[0.07, -0.07].map((z) => (
          <mesh key={z} position={[0.55, 0.62, z]}>
            <sphereGeometry args={[0.035, 12, 10]} />
            <meshBasicMaterial color="#ffe14d" />
          </mesh>
        ))}
      </group>
    );
  }
  const legs = [[0.45, 0.17, 0], [0.45, -0.17, Math.PI], [-0.45, 0.17, Math.PI], [-0.45, -0.17, 0]];
  return (
    <group position={[pos[0], pos[1] - crouch * 0.15, pos[2]]} rotation={[0, heading, 0]}>
      <Ell pos={[0, 0.55, 0]} r={[0.65, 0.24, 0.22]} color={c} />
      {spots.map((sp, i) => (
        <mesh key={i} position={sp.p} quaternion={sp.q}>
          <circleGeometry args={[sp.r, 14]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.9} />
        </mesh>
      ))}
      {/* neck joining head and body */}
      <Ell pos={[0.5, 0.64 - crouch * 0.05, 0]} r={[0.22, 0.17, 0.16]} rot={[0, 0, -0.4]} color={c} />
      {/* head */}
      <group position={[0.68, 0.68 - crouch * 0.1, 0]}>
        <Ell pos={[0, 0, 0]} r={[0.2, 0.17, 0.18]} color={c} />
        <Ell pos={[0.15, -0.05, 0]} r={[0.09, 0.07, 0.09]} color="#f0d9a8" />
        {[0.1, -0.1].map((z) => (
          <group key={z}>
            <Ell pos={[-0.05, 0.15, z]} r={[0.05, 0.05, 0.03]} color={c} />
            <mesh position={[0.15, 0.05, z * 0.7]}>
              <sphereGeometry args={[0.025, 12, 10]} />
              <meshStandardMaterial color="#ffd23f" emissive="#ffb21f" emissiveIntensity={0.6} />
            </mesh>
          </group>
        ))}
        <Ell pos={[0.24, -0.03, 0]} r={[0.025, 0.02, 0.03]} color="#2a1a10" />
      </group>
      {legs.map(([x, z, ph], i) => {
        const sw = Math.sin(walk + ph) * 0.35;
        return (
          <mesh key={i} position={[x + Math.sin(sw) * 0.15, 0.25, z]} rotation={[0, 0, sw]}>
            <capsuleGeometry args={[0.07, 0.36, 6, 10]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
        );
      })}
      {/* tail */}
      <mesh position={[-0.85, 0.6, 0]} rotation={[0, 0, 1.1 + Math.sin(walk * 0.5) * 0.2]}>
        <capsuleGeometry args={[0.04, 0.6, 6, 8]} />
        <meshStandardMaterial color={c} />
      </mesh>
    </group>
  );
};

export const Eagle: React.FC<{ pos: V3; heading: number; flap: number; bank?: number }> = ({ pos, heading, flap, bank = 0 }) => {
  const w = Math.sin(flap * Math.PI * 2) * 0.5;
  return (
    <group position={pos} rotation={[bank, heading, 0]} scale={1.4}>
      <Ell pos={[0, 0, 0]} r={[0.36, 0.16, 0.16]} color="#6f6f72" />
      <Ell pos={[0.34, 0.08, 0]} r={[0.13, 0.12, 0.12]} color="#cfcfcf" />
      <mesh position={[0.48, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.12, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0.06, 0.1 * s]} rotation={[s * w, 0, 0]}>
          <mesh position={[0, 0, 0.6 * s]} scale={[0.32, 0.03, 0.6]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#4a4a4e" />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.42, 0, 0]} scale={[0.22, 0.03, 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
};

// ------------------------------------------------------------------ ground action
export const Hole: React.FC<{ pos: V3; k: number }> = ({ pos, k }) =>
  k > 0.01 ? (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} scale={0.3 + 0.7 * k}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color="#2a1c10" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.3 + 0.7 * k}>
        <ringGeometry args={[0.2, 0.3, 24]} />
        <meshStandardMaterial color="#6a4a2c" side={THREE.DoubleSide} />
      </mesh>
    </group>
  ) : null;

export const DirtSpray: React.FC<{ pos: V3; t: number; amount: number }> = ({ pos, t, amount }) =>
  amount > 0.01 ? (
    <group position={pos}>
      {Array.from({ length: 16 }, (_, i) => {
        const ph = (t * 2.2 + i / 16) % 1;
        const a = rnd(i, 1) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * ph * 0.5, ph * 0.6 - ph * ph * 0.8, Math.sin(a) * ph * 0.5]} scale={0.02 + rnd(i, 2) * 0.02}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#5a3e24" transparent opacity={amount * (1 - ph)} />
          </mesh>
        );
      })}
    </group>
  ) : null;

/** Poop pellets: n pellets dropped by time k (0..1), piling in the hole. */
export const Poop: React.FC<{ pos: V3; k: number }> = ({ pos, k }) => (
  <group position={pos}>
    {Array.from({ length: 24 }, (_, i) => {
      const at = i / 24;
      if (k < at) return null;
      const f = clamp01((k - at) * 6);
      const y0 = 0.45, rest = 0.03 + Math.floor(i / 8) * 0.035;
      const y = y0 + (rest - y0) * f * f;
      return (
        <mesh key={i} position={[(rnd(i, 1) - 0.5) * 0.18, y, (rnd(i, 2) - 0.5) * 0.18]} rotation={[rnd(i, 3) * 3, rnd(i, 4) * 3, 0]} scale={[0.03, 0.02, 0.02]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={COLS.poop} roughness={0.6} />
        </mesh>
      );
    })}
  </group>
);

// ------------------------------------------------------------------ fur macro world (placed far away)
export const MACRO: V3 = [200, 0, 0];
export const FurMacro: React.FC<{ t: number; algae: number; moths: number; feed?: number }> = ({ t, algae, moths, feed = 0 }) => (
  <group position={MACRO}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[6, 32]} />
      <meshStandardMaterial color="#5a4630" roughness={1} />
    </mesh>
    {Array.from({ length: 160 }, (_, i) => {
      const x = (rnd(i, 1) - 0.5) * 4, z = (rnd(i, 2) - 0.5) * 3;
      const h = 0.9 + rnd(i, 3) * 0.8;
      const sway = Math.sin(t * 1.2 + i) * 0.06;
      return (
        <group key={i} position={[x, 0, z]} rotation={[sway, 0, 0.25 + sway]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.035, h, 6]} />
            <meshStandardMaterial color={mix(COLS.fur, "#8a9a4a", algae * 0.6)} roughness={0.9} />
          </mesh>
          {/* algae cells growing on the hair */}
          {algae > 0.05 &&
            [0.3, 0.5, 0.7].map((u, k) => (
              <mesh key={k} position={[0.03, h * u, 0]} scale={0.035 * algae * (0.6 + rnd(i * 3 + k, 4)) * (1 + feed * 0.6)}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#6fd14a" emissive="#3a9a2a" emissiveIntensity={0.4 + feed} />
              </mesh>
            ))}
        </group>
      );
    })}
    {Array.from({ length: Math.round(moths) }, (_, i) => {
      const x = (rnd(i, 21) - 0.5) * 2.5 + Math.sin(t * 0.7 + i) * 0.15, z = (rnd(i, 22) - 0.5) * 1.5;
      return <Moth key={i} pos={[x, 0.9 + rnd(i, 23) * 0.6, z]} scale={6} flap={0.15 + 0.12 * Math.sin(t * 4 + i)} heading={rnd(i, 24) * 6} />;
    })}
  </group>
);

/** Moth life cycle at the poop pile: eggs -> caterpillars -> adults flying up. stage 0..3 */
export const MothLife: React.FC<{ pos: V3; t: number; stage: number; flyUp?: number }> = ({ pos, t, stage, flyUp = 0 }) => (
  <group position={pos}>
    {stage > 0 && stage < 2 &&
      Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[(rnd(i, 1) - 0.5) * 0.25, 0.09 + rnd(i, 2) * 0.03, (rnd(i, 3) - 0.5) * 0.25]} scale={0.012 * clamp01((stage - rnd(i, 4) * 0.5) * 3)}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#f4f0e0" emissive="#fff6d0" emissiveIntensity={0.3} />
        </mesh>
      ))}
    {stage >= 1.6 && stage < 2.8 &&
      Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[(rnd(i, 5) - 0.5) * 0.3, 0.08, (rnd(i, 6) - 0.5) * 0.3]} rotation={[0, rnd(i, 7) * 6, 0]}>
          {Array.from({ length: 5 }, (_, k) => (
            <mesh key={k} position={[k * 0.018, Math.abs(Math.sin(t * 6 + k + i)) * 0.012, 0]} scale={0.012}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color="#c9d98a" />
            </mesh>
          ))}
        </group>
      ))}
    {stage >= 2.6 &&
      Array.from({ length: 8 }, (_, i) => {
        const up = clamp01(flyUp - rnd(i, 8) * 0.3);
        const p: V3 = [(rnd(i, 9) - 0.5) * 0.4 * (1 - up) + Math.sin(t * 3 + i) * 0.08, 0.12 + up * (6 + rnd(i, 10) * 2), (rnd(i, 11) - 0.5) * 0.4 + up * 0.6];
        return <Moth key={i} pos={p} scale={1.2} flap={(t * 8 + i * 0.37) % 1} heading={rnd(i, 12) * 6} />;
      })}
  </group>
);
