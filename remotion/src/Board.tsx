import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
// Font is bundled locally (public/fonts) so renders work without Google Fonts access.
const fontFamily = "MontserratBlack";
const fontHandle = delayRender("Loading Montserrat");
new FontFace(fontFamily, `url(${staticFile("fonts/Montserrat-900.woff2")}) format("woff2")`, { weight: "900" })
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(fontHandle);
  })
  .catch((e) => {
    console.error(e);
    continueRender(fontHandle);
  });

type V3 = [number, number, number];

// ---------- palette ----------
const C = {
  sky: "#cfe6f5",
  fog: "#d6e7ef",
  bark: "#8a6a4e",
  barkDark: "#5c4330",
  feather: "#202027",
  wing: "#34343e",
  white: "#f4f1ea",
  crest: "#e0262b",
  beak: "#6f7276",
  keratin: "#ffd23f",
  brain: "#ff8fb1",
  tongue: "#ff7a1a",
  xray: "#9fd3ff",
  chip: "#c8a47c",
};

// ---------- camera ----------
const Cam: React.FC<{ pos: V3; target: V3; fov: number }> = ({ pos, target, fov }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...pos);
    cam.fov = fov;
    cam.lookAt(...target);
    cam.updateProjectionMatrix();
  }, [camera, pos, target, fov]);
  return null;
};

// ---------- tree trunk with vertical bark ridges ----------
const Trunk: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1.08, 24, 160, 80, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k =
        1 +
        0.035 * Math.sin(a * 26 + Math.sin(y * 0.7) * 1.5) +
        0.018 * Math.sin(a * 61 + y * 2.1) +
        0.01 * Math.sin(y * 9 + a * 13);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow castShadow>
        <meshStandardMaterial color={C.bark} roughness={0.95} />
      </mesh>
      {/* peck hole */}
      <mesh position={[0.985, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.1, 0.06, 24]} />
        <meshStandardMaterial color="#2a1c12" roughness={1} />
      </mesh>
    </group>
  );
};

// ---------- distant forest ----------
const Forest: React.FC = () => {
  const trees = useMemo(() => {
    const out: { p: V3; r: number; c: string }[] = [];
    for (let i = 0; i < 26; i++) {
      const s = Math.sin(i * 12.9898) * 43758.5453;
      const f = s - Math.floor(s);
      const s2 = Math.sin(i * 78.233) * 12345.678;
      const f2 = s2 - Math.floor(s2);
      out.push({
        p: [(f - 0.5) * 60, 0, -10 - f2 * 30],
        r: 0.5 + f * 0.9,
        c: f2 > 0.5 ? "#6d8a7a" : "#7f9c8a",
      });
    }
    return out;
  }, []);
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

// ---------- woodpecker ----------
type BirdProps = {
  peck?: number; // 0 = head back, 1 = beak in the wood
  xray?: boolean;
  tongue?: boolean;
  brainArrows?: boolean;
  membrane?: boolean;
  wink?: boolean;
  keratin?: boolean;
  lookAtCamera?: boolean;
  ghost?: boolean; // see-through body to reveal feet/tail
};

const Ellipsoid: React.FC<{
  pos: V3; r: V3; color: string; rot?: V3; opacity?: number; emissive?: string;
}> = ({ pos, r, color, rot = [0, 0, 0], opacity = 1, emissive }) => (
  <mesh position={pos} scale={r} rotation={rot} castShadow={opacity === 1}>
    <sphereGeometry args={[1, 40, 28]} />
    <meshStandardMaterial
      color={color}
      roughness={0.6}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity === 1}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissive ? 0.6 : 0}
    />
  </mesh>
);

const Tongue: React.FC = () => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      [
        [-1.0, 0.86, 0.0],
        [-0.6, 0.86, 0.0],
        [-0.3, 0.8, 0.02],
        [-0.1, 0.66, 0.06],
        [0.18, 0.68, 0.08],
        [0.34, 0.92, 0.07],
        [0.22, 1.17, 0.05],
        [-0.06, 1.22, 0.03],
        [-0.28, 1.08, 0.01],
      ].map((v) => new THREE.Vector3(...(v as V3))),
    );
    return new THREE.TubeGeometry(curve, 160, 0.026, 12, false);
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.55} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.98 + i * 0.06, 0.89, 0]} rotation={[0, 0, -2.4]}>
          <coneGeometry args={[0.018, 0.07, 8]} />
          <meshStandardMaterial color={C.tongue} emissive={C.tongue} emissiveIntensity={0.55} />
        </mesh>
      ))}
    </group>
  );
};

const Woodpecker: React.FC<BirdProps> = ({
  peck = 0, xray, tongue, brainArrows, membrane, wink, keratin, lookAtCamera, ghost,
}) => {
  const bodyOp = ghost ? 0.3 : 1;
  const headTilt = -0.55 * (1 - peck); // rotate head back away from trunk
  const headOpacity = xray ? 0.16 : 1;
  const headColor = xray ? C.xray : C.feather;
  return (
    <group position={[1.55, 0, 0]}>
      {/* body */}
      <Ellipsoid pos={[0, 0, 0]} r={[0.38, 0.75, 0.38]} color={ghost ? C.xray : C.feather} opacity={bodyOp} />
      {/* white flank stripe */}
      <Ellipsoid pos={[-0.12, 0.3, 0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
      <Ellipsoid pos={[-0.12, 0.3, -0.27]} r={[0.07, 0.38, 0.1]} color={C.white} rot={[0, 0, 0.25]} />
      {/* wings */}
      {!ghost && <Ellipsoid pos={[0.1, 0.0, 0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />}
      {!ghost && <Ellipsoid pos={[0.1, 0.0, -0.3]} r={[0.3, 0.62, 0.11]} color={C.wing} rot={[0, 0, -0.12]} />}
      {/* stiff tail (pivot at base) */}
      <group position={[0.05, -0.65, 0]} rotation={[0, 0, -0.55]}>
        {[-0.09, 0, 0.09].map((z, i) => (
          <mesh key={i} position={[0, -0.52, z]} castShadow>
            <boxGeometry args={[0.07, 1.05, 0.13]} />
            <meshStandardMaterial color="#141418" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* feet: two toes forward, two back */}
      {[0.15, -0.15].map((z) => (
        <group key={z} position={[-0.42, -0.45, z]}>
          {[0.6, 0.2, -2.2, -2.6].map((a, i) => (
            <mesh key={i} rotation={[0, 0, a]} position={[0, 0, (i % 2) * 0.04 - 0.02]}>
              <capsuleGeometry args={[0.022, 0.16, 4, 8]} />
              <meshStandardMaterial color="#3b3d42" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      {/* head group pivots at the neck */}
      <group position={[0, 0.6, 0]} rotation={[0, lookAtCamera ? 1.2 : 0, headTilt]}>
        <group position={[0, -0.6, 0]}>
          {/* neck */}
          <Ellipsoid pos={[-0.05, 0.62, 0]} r={[0.22, 0.25, 0.22]} color={headColor} opacity={headOpacity} />
          {/* head */}
          <Ellipsoid pos={[0, 0.92, 0]} r={[0.31, 0.29, 0.27]} color={headColor} opacity={headOpacity} />
          {/* red crest */}
          {!xray && (
            <>
              <Ellipsoid pos={[0.05, 1.12, 0]} r={[0.26, 0.14, 0.2]} color={C.crest} />
              <mesh position={[0.24, 1.2, 0]} rotation={[0, 0, -1.05]} castShadow>
                <coneGeometry args={[0.15, 0.42, 20]} />
                <meshStandardMaterial color={C.crest} roughness={0.55} />
              </mesh>
              {/* white face stripe */}
              <Ellipsoid pos={[0.02, 0.82, 0.22]} r={[0.28, 0.05, 0.06]} color={C.white} rot={[0, 0, -0.35]} />
              <Ellipsoid pos={[0.02, 0.82, -0.22]} r={[0.28, 0.05, 0.06]} color={C.white} rot={[0, 0, -0.35]} />
            </>
          )}
          {/* skull + brain in x-ray mode */}
          {xray && (
            <>
              <mesh position={[0, 0.94, 0]} scale={[0.25, 0.23, 0.21]}>
                <sphereGeometry args={[1, 24, 16]} />
                <meshBasicMaterial color="#e8f6ff" wireframe transparent opacity={0.35} />
              </mesh>
              <Ellipsoid pos={[0.06, 0.97, 0]} r={[0.075, 0.062, 0.068]} color={C.brain} emissive={C.brain} />
            </>
          )}
          {brainArrows &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              const r = 0.2;
              return (
                <mesh
                  key={i}
                  position={[0.04 + Math.cos(a) * r, 0.96 + Math.sin(a) * r, 0.2]}
                  rotation={[0, 0, a + Math.PI / 2]}
                >
                  <coneGeometry args={[0.035, 0.09, 12]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              );
            })}
          {tongue && <Tongue />}
          {/* eyes */}
          {!xray && [1, -1].map((s) => (
            <group key={s} position={[-0.13, 0.96, 0.235 * s]} scale={[1, wink && s === 1 ? 0.12 : 1, 1]}>
              <mesh>
                <sphereGeometry args={[0.07, 24, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
              </mesh>
              <mesh position={[-0.01, 0, 0.045 * s]}>
                <sphereGeometry args={[0.042, 20, 14]} />
                <meshStandardMaterial color="#0c0c10" roughness={0.1} />
              </mesh>
              {membrane && s === 1 && (
                <mesh position={[0, 0, 0.075]}>
                  <circleGeometry args={[0.078, 32, Math.PI * 0.5, Math.PI * 1.1]} />
                  <meshStandardMaterial color="#eef4ff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          ))}
          {/* beak: bone core + keratin sheath */}
          <mesh position={[-0.52, 0.86, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <coneGeometry args={[0.085, 0.44, 4]} />
            <meshStandardMaterial color={C.beak} roughness={0.35} metalness={0.1} />
          </mesh>
          {keratin && (
            <mesh position={[-0.52, 0.86, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.105, 0.48, 4]} />
              <meshStandardMaterial
                color={C.keratin}
                emissive={C.keratin}
                emissiveIntensity={0.5}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

// ---------- effects ----------
const Chips: React.FC<{ spread?: number; towardCam?: boolean }> = ({ spread = 1, towardCam }) => {
  const chips = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const r = (n: number) => {
          const s = Math.sin(i * 91.7 + n * 13.3) * 9999.1;
          return s - Math.floor(s);
        };
        return {
          p: [1.0 + r(1) * 0.9 * spread, 0.88 + (r(2) - 0.4) * 0.9 * spread, (r(3) - 0.2) * (towardCam ? 1.6 : 0.8) * spread] as V3,
          rot: [r(4) * 6, r(5) * 6, r(6) * 6] as V3,
          s: 0.03 + r(7) * 0.045,
        };
      }),
    [spread, towardCam],
  );
  return (
    <group>
      {chips.map((c, i) => (
        <mesh key={i} position={c.p} rotation={c.rot} castShadow>
          <boxGeometry args={[c.s * 1.6, c.s, c.s * 0.35]} />
          <meshStandardMaterial color={C.chip} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

const ImpactFlash: React.FC = () => (
  <group position={[1.0, 0.86, 0.15]}>
    <mesh>
      <sphereGeometry args={[0.09, 20, 14]} />
      <meshBasicMaterial color="#fff6cf" />
    </mesh>
    {[0.2, 0.32].map((r, i) => (
      <mesh key={i}>
        <ringGeometry args={[r, r + 0.025, 48]} />
        <meshBasicMaterial color="#ffe08a" transparent opacity={0.8 - i * 0.35} side={THREE.DoubleSide} />
      </mesh>
    ))}
  </group>
);

const Line3: React.FC<{ a: V3; b: V3 }> = ({ a, b }) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const len = va.distanceTo(vb);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    vb.clone().sub(va).normalize(),
  );
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.018, 0.018, len, 8]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
};

const Tripod: React.FC = () => {
  const pts: V3[] = [
    [1.13, -0.45, 0.17],
    [1.13, -0.45, -0.17],
    [1.12, -1.58, 0],
  ];
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <Line3 a={pts[0]} b={pts[1]} />
      <Line3 a={pts[1]} b={pts[2]} />
      <Line3 a={pts[2]} b={pts[0]} />
    </group>
  );
};

// ---------- 2D overlays ----------
const COLORS = ["#3ee05a", "#ff3b3b", "#ff5fc8", "#ffe14d", "#3fe6ff"];

const Caption: React.FC<{ w1: string; w2?: string; color: number; y?: number }> = ({
  w1, w2, color, y = 0.6,
}) => {
  const shadow = "0 6px 14px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.6)";
  const style: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    fontSize: 64,
    letterSpacing: 2,
    textShadow: shadow,
    WebkitTextStroke: "2px rgba(0,0,0,0.35)",
  };
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", top: `${y * 100}%` }}>
      <div style={{ display: "flex", gap: 20, transform: "translateY(-50%)" }}>
        <span style={{ ...style, color: w2 ? "#ffffff" : COLORS[color] }}>{w1}</span>
        {w2 && <span style={{ ...style, color: COLORS[color] }}>{w2}</span>}
      </div>
    </AbsoluteFill>
  );
};

const BigLabel: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => (
  <AbsoluteFill style={{ alignItems: "flex-end", padding: "250px 70px 0 0" }}>
    <div
      style={{
        fontFamily,
        fontWeight: 900,
        fontSize: 150,
        color: "#ffffff",
        WebkitTextStroke: "10px #1d2f6f",
        paintOrder: "stroke fill",
        textShadow: "0 10px 0 #12204f, 0 18px 30px rgba(0,0,0,0.35)",
        transform: "rotate(-4deg)",
      }}
    >
      {text}
    </div>
    {sub && (
      <div
        style={{
          marginTop: 30,
          fontFamily,
          fontWeight: 800,
          fontSize: 44,
          color: "#ffffff",
          background: "rgba(18,32,79,0.85)",
          padding: "12px 26px",
          borderRadius: 18,
        }}
      >
        {sub}
      </div>
    )}
  </AbsoluteFill>
);

// ---------- scenes ----------
type Scene = {
  cam: { pos: V3; target: V3; fov: number };
  bird: BirdProps;
  chips?: boolean;
  chipsTowardCam?: boolean;
  flash?: boolean;
  tripod?: boolean;
  caption: { w1: string; w2?: string; color: number; y?: number };
  label?: { text: string; sub?: string };
};

export const SCENES: Record<number, Scene> = {
  1: {
    cam: { pos: [2.4, 0.4, 7.2], target: [1.2, 0.1, 0], fov: 34 },
    bird: { peck: 1 },
    chips: true,
    caption: { w1: "IF", w2: "YOU", color: 0 },
  },
  2: {
    cam: { pos: [1.45, 1.0, 2.1], target: [1.05, 0.88, 0], fov: 34 },
    bird: { peck: 1 },
    chips: true,
    chipsTowardCam: true,
    flash: true,
    caption: { w1: "HUNDREDS", w2: "OF G", color: 1 },
    label: { text: "400 g", sub: "concussion ≈ 100 g" },
  },
  3: {
    cam: { pos: [1.8, 1.12, 1.55], target: [1.18, 0.88, 0], fov: 30 },
    bird: { peck: 1, keratin: true },
    caption: { w1: "IN", w2: "KERATIN", color: 3 },
  },
  4: {
    cam: { pos: [1.65, 1.05, 2.0], target: [1.55, 0.95, 0], fov: 32 },
    bird: { peck: 1, xray: true, brainArrows: true },
    caption: { w1: "SHRINK", w2: "IT", color: 2 },
  },
  5: {
    cam: { pos: [1.6, 1.05, 1.45], target: [1.3, 0.93, 0.15], fov: 32 },
    bird: { peck: 0.9, membrane: true },
    chips: true,
    chipsTowardCam: true,
    caption: { w1: "THIRD", w2: "EYELID", color: 4 },
  },
  6: {
    cam: { pos: [3.2, -0.7, 2.6], target: [1.2, -0.95, 0], fov: 32 },
    bird: { peck: 1, ghost: true },
    tripod: true,
    caption: { w1: "LIKE", w2: "A TRIPOD", color: 0, y: 0.72 },
  },
  7: {
    cam: { pos: [1.45, 1.0, 2.25], target: [1.4, 0.95, 0], fov: 34 },
    bird: { peck: 1, xray: true, tongue: true },
    caption: { w1: "AROUND", w2: "YOUR SKULL", color: 1 },
  },
  8: {
    cam: { pos: [1.9, 0.95, 2.4], target: [1.25, 0.85, 0], fov: 34 },
    bird: { peck: 1 },
    flash: true,
    chips: true,
    caption: { w1: "IT'S A", w2: "HAMMER", color: 3 },
  },
  9: {
    cam: { pos: [2.3, 1.0, 2.9], target: [1.45, 0.75, 0], fov: 34 },
    bird: { peck: 1, lookAtCamera: true, wink: true },
    caption: { w1: "CONGRATULATIONS", color: 2 },
  },
};

export const Board: React.FC<{ scene: number }> = ({ scene }) => {
  const s = SCENES[scene] ?? SCENES[1];
  return (
    <AbsoluteFill style={{ background: C.sky }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true }}>
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fog, 9, 38]} />
        <Cam {...s.cam} />
        <hemisphereLight args={["#eaf6ff", "#6b5a44", 0.9]} />
        <directionalLight
          position={[6, 8, 7]}
          intensity={2.4}
          color="#fff1dc"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-5, 2, -4]} intensity={0.6} color="#bfdcff" />
        <directionalLight position={[2, 4, -7]} intensity={2.2} color="#ffffff" />
        <Forest />
        <Trunk />
        <Woodpecker {...s.bird} />
        {s.chips && <Chips towardCam={s.chipsTowardCam} />}
        {s.flash && <ImpactFlash />}
        {s.tripod && <Tripod />}
      </ThreeCanvas>
      {s.label && <BigLabel {...s.label} />}
      <Caption {...s.caption} />
    </AbsoluteFill>
  );
};
