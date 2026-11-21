// The detailed camel (public/camel.glb, sculpted in Blender) with the friendly head,
// deformed per frame on the CPU: walking legs, two-joint neck bend (drinking), hump size,
// belly swell, pad spread, heat tint and x-ray mode. Same layout as the simple Camel:
// faces +x, hips at y≈1.45, legs at x=±0.62, z=±0.2.
import React, { useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CamelHead, CamelState, COL } from "./model";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Rig = {
  body: THREE.Mesh;
  orig: Float32Array;
  leg: Int8Array; // -1 or 0..3
  legW: Float32Array;
  neckW: Float32Array;
  midW: Float32Array;
  humpW: Float32Array;
  bellyW: Float32Array;
  pads: { mesh: THREE.Mesh; pos: THREE.Vector3; scale: THREE.Vector3; leg: number }[];
  solid: THREE.MeshStandardMaterial;
  xray: THREE.MeshStandardMaterial;
  padSolid: THREE.Material;
  root: THREE.Group;
};

const LEGS = [
  { x: 0.62, z: 0.2, ph: 0 }, { x: 0.62, z: -0.2, ph: Math.PI }, { x: -0.62, z: 0.2, ph: Math.PI }, { x: -0.62, z: -0.2, ph: 0 },
];
const legOf = (x: number, z: number) => (x > 0 ? (z > 0 ? 0 : 1) : z > 0 ? 2 : 3);
const HIP_Y = 1.45;
const NECK_BASE = new THREE.Vector2(0.9, 1.85);
const NECK_MID = new THREE.Vector2(1.42, 1.92);
const HEAD_ANCHOR = new THREE.Vector2(1.86, 2.7);

const buildRig = (scene: THREE.Group): Rig => {
  let body: THREE.Mesh | null = null;
  const padMeshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if ((m.material as THREE.Material).name === "fur") body = m;
    else padMeshes.push(m);
  });
  const b = body as unknown as THREE.Mesh;
  b.updateMatrixWorld(true);
  const geo = b.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const orig = new Float32Array(pos.array as ArrayLike<number>);
  const leg = new Int8Array(n), legW = new Float32Array(n), neckW = new Float32Array(n), midW = new Float32Array(n);
  const humpW = new Float32Array(n), bellyW = new Float32Array(n);
  const cols = new Float32Array(n * 3);
  const low = new THREE.Color("#cc9a5e"), high = new THREE.Color("#94592b"), blotch = new THREE.Color("#8a5a2c"), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
    const isLeg = y < HIP_Y + 0.1 && Math.abs(Math.abs(x) - 0.62) < 0.32 && x > -1.0;
    leg[i] = isLeg ? legOf(x, z) : -1;
    legW[i] = isLeg ? smooth(HIP_Y + 0.1, HIP_Y - 0.25, y) : 0;
    const neck = x > 0.8 && y > 1.6;
    neckW[i] = neck ? smooth(0.85, 1.05, x) : 0;
    midW[i] = neck ? smooth(1.35, 1.5, x) : 0;
    humpW[i] = smooth(1.9, 2.05, y) * smooth(0.6, 0.4, Math.abs(x + 0.05));
    bellyW[i] = leg[i] < 0 && !neck ? smooth(1.75, 1.55, y) * smooth(1.25, 1.35, y) * smooth(0.8, 0.5, Math.abs(x)) : 0;
    const k = clamp01((y - 0.65) / 1.8);
    const nz = 0.5 + 0.5 * Math.sin(x * 4.1 + Math.sin(z * 5.3) * 2) * Math.sin(y * 3.7 + x * 1.3);
    c.copy(low).lerp(high, k).lerp(blotch, nz * 0.18);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const xray = new THREE.MeshStandardMaterial({ color: "#bfe6ff", transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.5 });
  b.material = solid;
  const pads = padMeshes.map((m) => ({ mesh: m, pos: m.position.clone(), scale: m.scale.clone(), leg: legOf(m.position.x, m.position.z) }));
  return { body: b, orig, leg, legW, neckW, midW, humpW, bellyW, pads, solid, xray, padSolid: padMeshes[0]?.material as THREE.Material, root: scene };
};

let rigPromise: Promise<Rig> | null = null;
const loadRig = () =>
  (rigPromise ??= new Promise<Rig>((resolve, reject) => {
    new GLTFLoader().load(staticFile("camel.glb"), (g) => resolve(buildRig(g.scene)), undefined, reject);
  }));

const rot2 = (px: number, py: number, cx: number, cy: number, a: number): [number, number] => {
  const s = Math.sin(a), co = Math.cos(a), dx = px - cx, dy = py - cy;
  return [cx + dx * co - dy * s, cy + dx * s + dy * co];
};

/** Load the rig from the DOM side of the composition (Remotion only waits on delayRender there). */
export const useCamelRig = () => {
  const [rig, setRig] = useState<Rig | null>(null);
  const [handle] = useState(() => delayRender("Loading detailed camel"));
  useMemo(() => {
    loadRig().then((r) => { setRig(r); continueRender(handle); }).catch((e) => { console.error(e); continueRender(handle); });
  }, [handle]);
  return rig;
};
export type { Rig };

export const DetailedCamel: React.FC<CamelState & { rig: Rig | null }> = ({ rig,
  pos = [0, 0, 0], rotY = 0, grow = 1, walk = 0, walkAmt = 0, sink = 0, padSpread = 0, nostrils = 1, lashGlow = 0, heat = 0,
  xray, kidneySqueeze = 0, kidneyGlow = 0, hump: humpBase = 1, fat = 0, belly = 0, headDown = 0, look: lookBase = 0, blink = 0,
  t = 0, shake = 0, humpWobble = 0,
}) => {
  // idle life: the camel is never frozen
  const hump = humpBase + humpWobble * 0.12 * Math.sin(t * 19);
  const look = lookBase + 0.08 * Math.sin(t * 0.9) * (1 - lookBase);
  const sway = 0.05 * Math.sin(t * 1.7) + 0.05 * Math.sin(walk * 2) * walkAmt;
  const breathe = 1 + 0.012 * Math.sin(t * 2.3);
  if (!rig || grow <= 0.01) return null;

  // ---- pose the mesh
  const swing = LEGS.map((l) => Math.sin(walk + l.ph) * 0.35 * walkAmt);
  const aBase = (-70 * Math.PI / 180) * headDown;
  const aMid = (-70 * Math.PI / 180) * headDown;
  const [mx, my] = rot2(NECK_MID.x, NECK_MID.y, NECK_BASE.x, NECK_BASE.y, aBase);
  const posAttr = rig.body.geometry.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const o = rig.orig;
  for (let i = 0; i < posAttr.count; i++) {
    let x = o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2];
    const L = rig.leg[i];
    if (L >= 0 && rig.legW[i] > 0) {
      const [rx, ry] = rot2(x, y, LEGS[L].x, HIP_Y, swing[L] * rig.legW[i]);
      x = rx; y = ry;
    }
    if (hump !== 1 && rig.humpW[i] > 0) {
      const w = rig.humpW[i];
      y = y + (y - 1.95) * (hump - 1) * w;
      x = x + (x + 0.05) * (hump - 1) * 0.5 * w;
      z = z + z * (hump - 1) * 0.5 * w;
    }
    if (belly > 0 && rig.bellyW[i] > 0) {
      const w = rig.bellyW[i] * belly;
      z = z * (1 + 0.35 * w);
      y = y - 0.12 * w;
    }
    if (headDown > 0 && rig.neckW[i] > 0) {
      const [bx, by] = rot2(x, y, NECK_BASE.x, NECK_BASE.y, aBase * rig.neckW[i]);
      let fx = bx, fy = by;
      if (rig.midW[i] > 0) [fx, fy] = rot2(bx, by, mx, my, aMid * rig.midW[i]);
      x = fx; y = fy;
    }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }
  posAttr.needsUpdate = true;
  rig.body.geometry.computeVertexNormals();
  rig.body.geometry.computeBoundingSphere();

  // pads follow their leg + spread
  for (const p of rig.pads) {
    const [rx, ry] = rot2(p.pos.x, p.pos.y, LEGS[p.leg].x, HIP_Y, swing[p.leg]);
    const lift = Math.max(0, Math.sin(walk + LEGS[p.leg].ph)) * 0.12 * walkAmt;
    p.mesh.position.set(rx, ry + lift, p.pos.z * (1 + padSpread * 0.25));
    p.mesh.scale.set(p.scale.x * (1 + padSpread * 0.9), p.scale.y, p.scale.z * (1 + padSpread * 0.9));
    (p.mesh as THREE.Mesh).material = xray ? rig.xray : rig.padSolid;
  }

  // materials: x-ray swap + heat tint
  rig.body.material = xray ? rig.xray : rig.solid;
  const tint = heat >= 0 ? new THREE.Color(COL.hot) : new THREE.Color(COL.cool);
  rig.solid.emissive.copy(tint);
  rig.solid.emissiveIntensity = Math.abs(heat) * 0.55;
  rig.solid.color.setRGB(1 - Math.abs(heat) * 0.35, 1 - Math.abs(heat) * 0.35, 1 - Math.abs(heat) * 0.35);

  // head follows the neck tip
  const [h1x, h1y] = rot2(HEAD_ANCHOR.x, HEAD_ANCHOR.y, NECK_BASE.x, NECK_BASE.y, aBase);
  const [hx, hy] = rot2(h1x, h1y, mx, my, aMid);
  const headRot = -0.15 + aBase + aMid + sway;

  const g = 1 - Math.pow(1 - grow, 3);
  const bob = Math.sin(walk * 2) * 0.04 * walkAmt;
  const dip = -0.22 * headDown; // front settles a little while drinking
  const furHead = heat >= 0 ? new THREE.Color("#9a5e2e").lerp(new THREE.Color(COL.hot), heat * 0.6) : new THREE.Color("#9a5e2e").lerp(new THREE.Color(COL.cool), -heat * 0.6);
  return (
    <group position={[pos[0], pos[1] + (1 - g) * -2.6 - 0.32 * sink + bob + dip, pos[2]]} rotation={[shake * 0.07 * Math.sin(t * 30), rotY + shake * 0.05 * Math.sin(t * 23), 0]} scale={[1, (0.3 + 0.7 * g) * breathe, breathe]}>
      <primitive object={rig.root} />
      <group position={[hx, hy, 0]} rotation={[0, look * 0.9, headRot]} scale={1.15}>
        <CamelHead color={xray ? "#bfe6ff" : furHead.getStyle()} dark="#7a4520" opacity={xray ? 0.22 : 1} nostrils={nostrils} lashGlow={lashGlow} blink={blink} />
      </group>
      {xray && fat > 0 && (
        <mesh position={[-0.05, 2.18 + 0.15 * (hump - 1), 0]} scale={[0.3 * hump * fat, 0.24 * hump * fat, 0.2 * hump * fat]}>
          <sphereGeometry args={[1, 32, 20]} />
          <meshStandardMaterial color={COL.fat} emissive={COL.fat} emissiveIntensity={0.5} />
        </mesh>
      )}
      {xray &&
        [0.13, -0.13].map((zz) => (
          <mesh key={zz} position={[-0.32, 1.72, zz]} rotation={[0, 0, 0.4]} scale={[0.14 * (1 - kidneySqueeze * 0.3), 0.09 * (1 - kidneySqueeze * 0.3), 0.07]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color={COL.kidney} emissive={COL.kidney} emissiveIntensity={0.3 + kidneyGlow} />
          </mesh>
        ))}
    </group>
  );
};
