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
    c.lookAt(0, 0.35, 0);
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


// ---------- 4: simple diorama: grass-topped earth cube cut open, little tree on top
const Dirt: React.FC = () => {
  const layers: [number, number, string][] = [
    // [bottom y, height, colour]
    [-1.0, 0.35, "#3d9be9"], // groundwater
    [-0.65, 0.4, "#9c8f80"], // gravel
    [-0.25, 0.45, "#a9693b"], // clay
    [0.2, 0.55, "#6b4227"], // soil
  ];
  return (
    <group rotation={[0, 0, 0]}>
      {layers.map(([y, h, c], i) => (
        <mesh key={i} position={[0, y + h / 2, 0]}>
          <boxGeometry args={[2, h, 2]} />
          <meshStandardMaterial color={c} roughness={0.85} transparent={i === 0} opacity={i === 0 ? 0.92 : 1} />
        </mesh>
      ))}
      {/* pebbles on the cut faces */}
      {Array.from({ length: 26 }, (_, i) => {
        const r = (k: number) => { const v = Math.sin(i * 91.7 + k * 13.3) * 9999.1; return v - Math.floor(v); };
        const front = i % 2 === 0;
        const u = (r(1) - 0.5) * 1.8, y = -0.6 + r(2) * 0.3;
        return (
          <mesh key={i} position={front ? [u, y, 1.0] : [1.0, y, u]} scale={[1, 0.75, 1]}>
            <sphereGeometry args={[0.045 + r(3) * 0.04, 12, 10]} />
            <meshStandardMaterial color={["#d2cbc1", "#7d756d", "#b6ac9f"][i % 3]} roughness={0.7} />
          </mesh>
        );
      })}
      {/* grass slab */}
      <mesh position={[0, 0.84, 0]}>
        <boxGeometry args={[2.08, 0.18, 2.08]} />
        <meshStandardMaterial color="#56b947" roughness={0.8} />
      </mesh>
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.932, 0]}>
          <boxGeometry args={[0.3, 0.004, 2.08]} />
          <meshStandardMaterial color="#68cc58" roughness={0.8} />
        </mesh>
      ))}
      {/* little tree */}
      <mesh position={[-0.35, 1.25, -0.3]}>
        <cylinderGeometry args={[0.07, 0.09, 0.65, 16]} />
        <meshStandardMaterial color="#7a5032" roughness={0.85} />
      </mesh>
      {[[-0.35, 1.7, -0.3, 0.36], [-0.15, 1.58, -0.2, 0.26], [-0.55, 1.6, -0.38, 0.26], [-0.33, 1.95, -0.32, 0.24]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 2]} />
          <meshStandardMaterial color="#2f9e44" roughness={0.75} />
        </mesh>
      ))}
      {/* a root running down the cut face */}
      <mesh position={[-0.35, 0.55, 1.005]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.02, 0.012, 0.6, 8]} />
        <meshStandardMaterial color="#8a5a36" />
      </mesh>
    </group>
  );
};

const VARIANTS: Record<string, { bg: string; el: React.ReactNode; cam: V3; f: number }> = {
  cutaway: { bg: "#ff6b1a", el: <Cutaway />, cam: [4.9, 4.1, 4.9], f: 30 },
  exploded: { bg: "#1e5bff", el: <Exploded />, cam: [5.6, 4.0, 5.6], f: 30 },
  xray: { bg: "#141a2e", el: <XrayGear />, cam: [0, 0, 6.6], f: 34 },
  dirt: { bg: "#ffc531", el: <Dirt />, cam: [5.2, 4.2, 5.2], f: 30 },
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
