// Channel profile image for Sohow 3D: one simple 3D "how it works inside" object
// on a solid colour. YouTube crops to a circle, so the object stays centred.
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type V3 = [number, number, number];

const Cam: React.FC<{ p: V3; f: number }> = ({ p, f }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...p);
    c.fov = f;
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
  }, [camera, p, f]);
  return null;
};

/** Extruded gear with square-ish teeth and a centre hole. */
const useGearGeometry = (teeth = 10, rOuter = 1, rInner = 0.8, hole = 0.3, depth = 0.35) =>
  useMemo(() => {
    const s = new THREE.Shape();
    const n = teeth * 4;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 4 === 1 || i % 4 === 2 ? rOuter : rInner;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
    g.center();
    return g;
  }, [teeth, rOuter, rInner, hole, depth]);

const Lights: React.FC = () => (
  <>
    <hemisphereLight args={["#ffffff", "#444444", 1.0]} />
    <directionalLight position={[4, 6, 5]} intensity={2.4} />
    <directionalLight position={[-5, 2, -3]} intensity={0.7} />
  </>
);

// ---------- 1: cutaway cube revealing a gear inside
const Cutaway: React.FC = () => {
  const gear = useGearGeometry(9, 0.62, 0.48, 0.16, 0.22);
  const blocks: V3[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) if (!(x > 0 && y > 0 && z > 0)) blocks.push([x, y, z]);
  return (
    <group rotation={[0, 0, 0]}>
      {blocks.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.45} />
        </mesh>
      ))}
      {/* inner cut faces in a contrasting tone */}
      <mesh position={[0.5, 0.0015, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.998, 0.998]} />
        <meshStandardMaterial color="#1b2a4a" roughness={0.7} />
      </mesh>
      <mesh position={[0.0015, 0.5, 0.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.998, 0.998]} />
        <meshStandardMaterial color="#22345c" roughness={0.7} />
      </mesh>
      <mesh position={[0.5, 0.5, 0.0015]}>
        <planeGeometry args={[0.998, 0.998]} />
        <meshStandardMaterial color="#2a4070" roughness={0.7} />
      </mesh>
      {/* gear sitting in the opened corner */}
      <mesh geometry={gear} position={[0.52, 0.5, 0.52]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <meshStandardMaterial color="#ffb21f" metalness={0.35} roughness={0.35} emissive="#ff8a00" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
};

// ---------- 2: exploded cube with a glowing core
const Exploded: React.FC = () => {
  const pieces: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) if (!(x > 0 && y > 0 && z > 0)) pieces.push([x * 0.78, y * 0.78, z * 0.78]);
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.92, 0.92, 0.92]} />
          <meshStandardMaterial color="#ffffff" roughness={0.45} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.42, 48, 32]} />
        <meshStandardMaterial color="#ffe14d" emissive="#ffb21f" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
};

// ---------- 3: gear, half solid / half x-ray blueprint
const XrayGear: React.FC = () => {
  const gear = useGearGeometry(10, 1.15, 0.9, 0.34, 0.4);
  const edges = useMemo(() => new THREE.EdgesGeometry(gear, 25), [gear]);
  const clipL = useMemo(() => [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)], []);
  const clipR = useMemo(() => [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)], []);
  return (
    <group rotation={[0.35, -0.45, 0.12]}>
      <mesh geometry={gear}>
        <meshStandardMaterial color="#ffb21f" roughness={0.35} metalness={0.3} emissive="#ff8a00" emissiveIntensity={0.18} clippingPlanes={clipL} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gear}>
        <meshStandardMaterial color="#5fc8ff" transparent opacity={0.22} depthWrite={false} clippingPlanes={clipR} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#bfefff" clippingPlanes={clipR} />
      </lineSegments>
    </group>
  );
};

const VARIANTS: Record<string, { bg: string; el: React.ReactNode; cam: V3; f: number }> = {
  cutaway: { bg: "#ff6b1a", el: <Cutaway />, cam: [4.9, 4.1, 4.9], f: 30 },
  exploded: { bg: "#1e5bff", el: <Exploded />, cam: [5.6, 4.0, 5.6], f: 30 },
  xray: { bg: "#141a2e", el: <XrayGear />, cam: [0, 0, 6.6], f: 34 },
};

const Clipping: React.FC = () => {
  const { gl } = useThree();
  useLayoutEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
};

export const Avatar: React.FC<{ variant: string }> = ({ variant }) => {
  const v = VARIANTS[variant] ?? VARIANTS.cutaway;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${v.bg}ee 0%, ${v.bg} 70%)` }}>
      <ThreeCanvas width={800} height={800} gl={{ antialias: true, alpha: true }}>
        <Clipping />
        <Cam p={v.cam} f={v.f} />
        <Lights />
        {v.el}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
