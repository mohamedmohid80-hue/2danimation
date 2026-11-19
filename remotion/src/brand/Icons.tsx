// Sohow 3D profile image options: lightbulb with gears inside / magnifying glass revealing gears.
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type V3 = [number, number, number];

const Cam: React.FC<{ p: V3; t: V3; f: number }> = ({ p, t, f }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...p);
    c.fov = f;
    c.lookAt(...t);
    c.updateProjectionMatrix();
  }, [camera, p, t, f]);
  return null;
};

const gearGeo = (teeth: number, rOuter: number, rInner: number, hole: number, depth: number) => {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 4 === 1 || i % 4 === 2 ? rOuter : rInner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 8 });
  g.center();
  return g;
};

const Gear: React.FC<{ teeth: number; r: number; pos: V3; rot?: number; color?: string; depth?: number; glow?: number }> = ({ teeth, r, pos, rot = 0, color = "#ffb21f", depth = 0.12, glow = 0.25 }) => {
  const g = useMemo(() => gearGeo(teeth, r, r * 0.8, r * 0.28, depth), [teeth, r, depth]);
  return (
    <mesh geometry={g} position={pos} rotation={[0, 0, rot]}>
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.3} emissive="#ff8a00" emissiveIntensity={glow} />
    </mesh>
  );
};

// ---------------- lightbulb
const Bulb: React.FC = () => {
  // glass: lathe profile (round bulb narrowing into a neck)
  const glass = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI / 2 + (i / 40) * (Math.PI * 1.32);
      pts.push(new THREE.Vector2(Math.cos(a) * 1.0, Math.sin(a) * 1.0 + 0.0).multiplyScalar(1));
    }
    // flip so the round part is on top, neck at the bottom
    const prof = pts.map((p) => new THREE.Vector2(Math.max(0.001, p.x), -p.y));
    prof.push(new THREE.Vector2(0.42, -0.95), new THREE.Vector2(0.4, -1.25));
    return new THREE.LatheGeometry(prof.reverse(), 64);
  }, []);
  return (
    <group position={[0, 0.25, 0]} rotation={[0, 0, -0.12]}>
      {/* warm inner glow */}
      <mesh>
        <sphereGeometry args={[0.55, 32, 24]} />
        <meshBasicMaterial color="#ffe9a8" transparent opacity={0.22} />
      </mesh>
      <Gear teeth={10} r={0.42} pos={[-0.2, 0.12, 0]} rot={0.2} />
      <Gear teeth={7} r={0.29} pos={[0.37, -0.22, 0]} rot={0.5} color="#ffd23f" />
      {/* glass bulb */}
      <mesh geometry={glass}>
        <meshStandardMaterial color="#eaf6ff" transparent opacity={0.28} roughness={0.05} metalness={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* glossy highlight */}
      <mesh position={[-0.5, 0.5, 0.6]} rotation={[0, 0, 0.6]} scale={[0.12, 0.3, 0.05]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
      {/* screw base */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, -1.32 - i * 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38 - i * 0.015, 0.06, 14, 40]} />
          <meshStandardMaterial color="#b9c0cc" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.36, 0.34, 0.5, 40]} />
        <meshStandardMaterial color="#9aa3b2" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -1.82, 0]}>
        <cylinderGeometry args={[0.2, 0.12, 0.16, 32]} />
        <meshStandardMaterial color="#2b2f38" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
};

// ---------------- magnifying glass revealing gears
const Magnifier: React.FC = () => (
  <group rotation={[0.25, -0.35, 0.55]} position={[-0.1, 0.25, 0]}>
    {/* handle */}
    <mesh position={[0, -1.55, 0]}>
      <cylinderGeometry args={[0.16, 0.19, 1.4, 32]} />
      <meshStandardMaterial color="#1f2a44" roughness={0.45} />
    </mesh>
    <mesh position={[0, -0.82, 0]}>
      <cylinderGeometry args={[0.13, 0.15, 0.22, 32]} />
      <meshStandardMaterial color="#c3cad6" metalness={0.8} roughness={0.25} />
    </mesh>
    {/* rim */}
    <mesh position={[0, 0.25, 0]}>
      <torusGeometry args={[0.95, 0.12, 24, 80]} />
      <meshStandardMaterial color="#1f2a44" roughness={0.4} metalness={0.2} />
    </mesh>
    {/* inside the lens: dark backdrop + gears = "the inside" */}
    <mesh position={[0, 0.25, -0.06]}>
      <circleGeometry args={[0.9, 64]} />
      <meshStandardMaterial color="#1b2a4a" roughness={0.8} />
    </mesh>
    <group position={[0, 0.25, 0]}>
      <Gear teeth={11} r={0.5} pos={[-0.22, 0.12, 0]} rot={0.15} depth={0.1} />
      <Gear teeth={8} r={0.34} pos={[0.45, -0.3, 0]} rot={0.4} color="#ffd23f" depth={0.1} />
      <Gear teeth={6} r={0.22} pos={[0.32, 0.5, 0]} rot={0.1} color="#ff7a1a" depth={0.1} />
    </group>
    {/* glass surface + highlight */}
    <mesh position={[0, 0.25, 0.1]}>
      <circleGeometry args={[0.9, 64]} />
      <meshStandardMaterial color="#d8f1ff" transparent opacity={0.18} roughness={0.02} depthWrite={false} />
    </mesh>
    <mesh position={[-0.42, 0.68, 0.12]} rotation={[0, 0, 0.75]} scale={[0.1, 0.32, 0.02]}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
    </mesh>
  </group>
);

const OPTIONS: Record<string, { bg: string; el: React.ReactNode; cam: V3; t: V3 }> = {
  bulb: { bg: "#1f4fd8", el: <Bulb />, cam: [0.8, 0.6, 7.4], t: [0.05, -0.45, 0] },
  magnifier: { bg: "#ff7a1a", el: <Magnifier />, cam: [0, 0, 8.4], t: [0.12, -0.28, 0] },
};

export const Icon: React.FC<{ kind: string }> = ({ kind }) => {
  const o = OPTIONS[kind] ?? OPTIONS.bulb;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${o.bg}cc 0%, ${o.bg} 72%)` }}>
      <ThreeCanvas width={800} height={800} gl={{ antialias: true, alpha: true }}>
        <Cam p={o.cam} t={o.t} f={30} />
        <hemisphereLight args={["#ffffff", "#40506a", 1.1]} />
        <directionalLight position={[3, 5, 5]} intensity={2.4} color="#fff6ea" />
        <directionalLight position={[-4, 2, -3]} intensity={1.0} color="#d8f3ff" />
        {o.el}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
