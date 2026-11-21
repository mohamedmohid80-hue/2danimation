// Extra animated props for the camel video (v2): scrolling desert dressing + footprints,
// vultures, rolling bottle, x-ray water flow, fat chunks, gulps.
import React from "react";
import * as THREE from "three";
import { Bottle, COL, V3, rnd } from "./model";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Rocks + dry shrubs scattered over the desert so a scrolling ground reads as travel. Shift = -travel along x. */
export const Dressing: React.FC<{ shift: number }> = ({ shift }) => (
  <group position={[shift, 0, 0]}>
    {Array.from({ length: 140 }, (_, i) => {
      const x = -30 + rnd(i, 1) * 140;
      const z = (rnd(i, 2) - 0.5) * 30;
      if (Math.abs(z) < 1.2 && x > -3 && x < 6) return null; // keep the camel's path clear near the start
      const shrub = rnd(i, 3) > 0.55;
      const s = 0.12 + rnd(i, 4) * 0.35;
      return shrub ? (
        <group key={i} position={[x, 0, z]}>
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2 + rnd(i, 5);
            return (
              <mesh key={k} position={[Math.cos(a) * s * 0.3, s * 0.4, Math.sin(a) * s * 0.3]} rotation={[Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6]}>
                <cylinderGeometry args={[0.008, 0.015, s * 0.9, 4]} />
                <meshStandardMaterial color="#8a7046" roughness={1} />
              </mesh>
            );
          })}
        </group>
      ) : (
        <mesh key={i} position={[x, s * 0.25, z]} scale={[s, s * 0.6, s * 0.8]} rotation={[0, rnd(i, 6) * 3, 0]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={rnd(i, 7) > 0.5 ? "#b49a7a" : "#9c8364"} flatShading roughness={1} />
        </mesh>
      );
    })}
  </group>
);

/** Camel footprints left behind (world x < 0.3) as the ground scrolls. */
export const Footprints: React.FC<{ travel: number; z?: number }> = ({ travel, z = 0 }) => {
  const step = 0.55;
  const first = Math.floor((travel - 12) / step);
  const out: React.ReactNode[] = [];
  for (let k = first; k < first + 30; k++) {
    const x = k * step - travel;
    if (x > 0.3 || x < -12) continue;
    for (const side of [0.2, -0.2]) {
      out.push(
        <mesh key={`${k}${side}`} position={[x + (side > 0 ? 0 : step / 2), 0.015, z + side]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.3, 1, 1]}>
          <circleGeometry args={[0.1, 16]} />
          <meshBasicMaterial color="#c9a161" transparent opacity={0.65 * clamp01(1 + x / 12)} />
        </mesh>,
      );
    }
  }
  return <group>{out}</group>;
};

/** A cartoon vulture; flap 0..1 wing phase, folded 0..1. */
export const Vulture: React.FC<{ pos: V3; heading: number; flap: number; folded?: number; scale?: number }> = ({ pos, heading, flap, folded = 0, scale = 1 }) => {
  const wing = (1 - folded) * Math.sin(flap * Math.PI * 2) * 0.6;
  return (
    <group position={pos} rotation={[0, heading, 0]} scale={scale}>
      <mesh scale={[0.32, 0.16, 0.16]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#2b2522" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, 0.1, 0]} scale={[0.09, 0.09, 0.09]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#d9a08a" roughness={0.7} />
      </mesh>
      <mesh position={[0.4, 0.08, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.03, 0.09, 8]} />
        <meshStandardMaterial color="#e8c56a" />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0.05, 0.1 * s]} rotation={[s * (wing + folded * 1.2), 0, 0]}>
          <mesh position={[0, 0, 0.45 * s * (1 - folded * 0.6)]} scale={[0.22, 0.03, 0.45 * (1 - folded * 0.6)]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1f1a17" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {folded > 0.5 &&
        [0.08, -0.08].map((z) => (
          <mesh key={z} position={[0, -0.22, z]}>
            <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
            <meshStandardMaterial color="#d9a08a" />
          </mesh>
        ))}
    </group>
  );
};

/** Empty bottle rolling across the ground (callback to the hook). */
export const RollingBottle: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 0.2, z]} rotation={[0, 0, 0]}>
    <group rotation={[0, 0, Math.PI / 2]}>
      <group rotation={[-x / 0.2, 0, 0]}>
        <group position={[0, -0.5, 0]}>
          <Bottle level={0} tip={0} visible={1} />
        </group>
      </group>
    </group>
  </group>
);

// --------------------------------------------------------------- x-ray water flow
const LOOP = new THREE.CatmullRomCurve3(
  ([[0.7, 1.75, 0.12], [0.2, 1.95, 0.1], [-0.45, 1.9, 0.1], [-0.6, 1.6, 0.05], [-0.1, 1.45, -0.05], [0.5, 1.5, -0.1], [0.85, 1.8, 0]] as V3[]).map((p) => new THREE.Vector3(...p)),
  true,
);
/** Blue water dots circulating through the body; `leak` 0..1 sends some out the back/bottom. */
export const WaterFlow: React.FC<{ t: number; amount: number; leak?: number; toKidney?: number; speed?: number }> = ({ t, amount, leak = 0, toKidney = 0, speed = 0.35 }) => {
  if (amount <= 0.01) return null;
  const K = new THREE.Vector3(-0.32, 1.72, 0);
  return (
    <group>
      {Array.from({ length: 36 }, (_, i) => {
        const u = (t * speed + i / 36) % 1;
        const p = LOOP.getPointAt(u).clone();
        // pull toward the kidneys
        if (toKidney > 0) {
          const k = toKidney * Math.max(0, 1 - p.distanceTo(K) / 0.9);
          p.lerp(K.clone().add(new THREE.Vector3(Math.cos(u * 40) * 0.12, Math.sin(u * 40) * 0.08, 0.15)), k);
        }
        // leaking dots fall out underneath the rear
        const leaking = leak > 0 && rnd(i, 3) < leak * 0.5 && u > 0.35 && u < 0.6;
        if (leaking) {
          const f = (u - 0.35) / 0.25;
          p.set(-0.6 - f * 0.05, 1.5 - f * f * 1.4, 0);
        }
        return (
          <mesh key={i} position={p} scale={[1, leaking ? 1.5 : 1, 1]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color={COL.water} emissive={COL.water} emissiveIntensity={0.8} transparent opacity={amount} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Yellow fat chunks flying from around the body into the hump. progress 0..1. */
export const FatChunks: React.FC<{ progress: number; humpY: number }> = ({ progress, humpY }) => {
  if (progress <= 0 || progress >= 1.2) return null;
  return (
    <group>
      {Array.from({ length: 18 }, (_, i) => {
        const delay = rnd(i, 1) * 0.6;
        const k = clamp01((progress - delay) / 0.4);
        if (k <= 0 || k >= 1) return null;
        const from = new THREE.Vector3(-0.8 + rnd(i, 2) * 1.8, 1.3 + rnd(i, 3) * 0.5, (rnd(i, 4) - 0.5) * 0.7);
        const to = new THREE.Vector3(-0.05 + (rnd(i, 5) - 0.5) * 0.2, humpY, (rnd(i, 6) - 0.5) * 0.15);
        const p = from.clone().lerp(to, k);
        p.y += Math.sin(k * Math.PI) * 0.35;
        return (
          <mesh key={i} position={p} scale={0.05 + rnd(i, 7) * 0.04}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={COL.fat} emissive={COL.fat} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};

const NECK_PATH = new THREE.CatmullRomCurve3(([[2.1, 2.62, 0], [1.6, 2.42, 0], [1.42, 1.95, 0], [1.0, 1.8, 0], [0.4, 1.55, 0], [0.05, 1.45, 0]] as V3[]).map((p) => new THREE.Vector3(...p)));
/** Blue gulps travelling down the neck into the belly, plus the water level growing in the belly. */
export const Gulps: React.FC<{ t: number; on: number; fill: number }> = ({ t, on, fill }) => (
  <group>
    {on > 0 &&
      Array.from({ length: 4 }, (_, i) => {
        const u = (t * 1.1 + i / 4) % 1;
        return (
          <mesh key={i} position={NECK_PATH.getPointAt(u)} scale={0.09}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={COL.water} emissive={COL.water} emissiveIntensity={0.8} transparent opacity={on} />
          </mesh>
        );
      })}
    {fill > 0.01 && (
      <mesh position={[0.05, 1.42 + 0.08 * fill, 0]} scale={[0.55 * fill + 0.05, 0.22 * fill + 0.02, 0.32 * fill + 0.03]}>
        <sphereGeometry args={[1, 28, 18]} />
        <meshStandardMaterial color={COL.water} emissive={"#1e74c4"} emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
    )}
  </group>
);
