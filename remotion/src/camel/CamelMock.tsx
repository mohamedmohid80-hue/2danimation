// Mock-up: the detailed Blender camel (public/camel.glb) rendered in the Remotion/three.js scene.
import React, { useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CamelHead, Desert } from "./model";

const Cam: React.FC = () => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    // Blender (x, y, z) -> three (x, z, -y): same framing as the Blender hero shot
    c.position.set(6.6, 1.5, 7.4);
    c.fov = 30;
    c.lookAt(0.7, 1.5, 0);
    c.updateProjectionMatrix();
  }, [camera]);
  return null;
};

/** Height gradient (dark back/hump -> light legs) + blotchy noise, baked into vertex colours. */
const furMaterial = (geo: THREE.BufferGeometry) => {
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const low = new THREE.Color("#cc9a5e"), high = new THREE.Color("#94592b"), blotch = new THREE.Color("#8a5a2c");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = Math.max(0, Math.min(1, (y - 0.65) / 1.8));
    const n = 0.5 + 0.5 * Math.sin(x * 4.1 + Math.sin(z * 5.3) * 2) * Math.sin(y * 3.7 + x * 1.3);
    c.copy(low).lerp(high, k).lerp(blotch, n * 0.18);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
};

const useCamel = () => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [handle] = useState(() => delayRender("Loading camel.glb"));
  useMemo(() => {
    new GLTFLoader().load(
      staticFile("camel.glb"),
      (g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat.name === "fur") m.material = furMaterial(m.geometry);
          }
        });
        setScene(g.scene);
        continueRender(handle);
      },
      undefined,
      (e) => {
        console.error(e);
        continueRender(handle);
      },
    );
  }, [handle]);
  return scene;
};

export const CamelMock: React.FC = () => {
  const camel = useCamel();
  return (
    <AbsoluteFill style={{ background: "#bfe3f7" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true }}>
        <color attach="background" args={["#bfe3f7"]} />
        <fog attach="fog" args={["#f3dcb0", 25, 90]} />
        <Cam />
        <hemisphereLight args={["#fff4dc", "#c99a5b", 0.8]} />
        <directionalLight position={[-6, 9, 5]} intensity={2.8} color="#fff1d6" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0005} />
        <directionalLight position={[5, 3, -6]} intensity={0.8} color="#ffe6c2" />
        <Desert night={0} />
        {camel && <primitive object={camel} />}
        {/* friendly head on the end of the neck (neck tip ≈ (1.66, 2.6, 0)) */}
        <group position={[1.86, 2.7, 0]} rotation={[0, 0, -0.15]} scale={1.15}>
          <CamelHead color="#9a5e2e" dark="#7a4520" />
        </group>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
