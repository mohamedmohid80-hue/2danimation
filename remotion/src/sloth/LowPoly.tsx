// Low-poly look: every curved mesh (sphere / tube / cylinder / cone) is resampled on a much
// coarser grid FROM ITS CURRENT (possibly sculpted) VERTICES, so shapes keep their silhouette
// but turn into big flat facets. Cached per source geometry.
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const cache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const done = new WeakSet<THREE.BufferGeometry>();

type Grid = { cols: number; rows: number; tCols: number; tRows: number };
const gridOf = (g: THREE.BufferGeometry): Grid | null => {
  const p = (g as unknown as { parameters?: Record<string, number> }).parameters ?? {};
  switch (g.type) {
    case "SphereGeometry":
      return { cols: p.widthSegments, rows: p.heightSegments, tCols: 8, tRows: 6 };
    case "TubeGeometry":
      return { cols: p.radialSegments, rows: p.tubularSegments, tCols: 6, tRows: Math.min(p.tubularSegments, 7) };
    case "CylinderGeometry":
    case "ConeGeometry": {
      const tall = p.height > 10; // tree trunks keep more rings so the bark still reads
      return { cols: p.radialSegments, rows: p.heightSegments, tCols: tall ? 14 : 7, tRows: tall ? Math.min(p.heightSegments, 16) : Math.min(p.heightSegments, 2) };
    }
    default:
      return null;
  }
};

const pick = (n: number, t: number) => {
  const k = Math.max(1, Math.min(n, t));
  return Array.from({ length: k + 1 }, (_, i) => Math.round((i * n) / k));
};

const lowPolyOf = (g: THREE.BufferGeometry) => {
  const hit = cache.get(g);
  if (hit) return hit;
  let out: THREE.BufferGeometry = g;
  const gr = gridOf(g);
  if (gr && gr.cols > 0 && gr.rows > 0) {
    const pos = g.attributes.position;
    const W = gr.cols + 1;
    // Tube: index = row*(radial+1)+col with row=tubular; Sphere/Cylinder: row*(width+1)+col
    const cs = pick(gr.cols, gr.tCols), rs = pick(gr.rows, gr.tRows);
    const v = (r: number, c: number) => new THREE.Vector3().fromBufferAttribute(pos, r * W + c);
    const tri: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      if (a.distanceToSquared(b) < 1e-12 || b.distanceToSquared(c) < 1e-12 || a.distanceToSquared(c) < 1e-12) return;
      tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };
    for (let i = 0; i < rs.length - 1; i++)
      for (let j = 0; j < cs.length - 1; j++) {
        const a = v(rs[i], cs[j]), b = v(rs[i], cs[j + 1]), c = v(rs[i + 1], cs[j + 1]), d = v(rs[i + 1], cs[j]);
        // same winding as three's grid builders
        if (g.type === "TubeGeometry") { push(a, d, b); push(d, c, b); }
        else { push(a, d, b); push(b, d, c); }
      }
    if (tri.length >= 9) {
      out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
      out.computeVertexNormals();
    }
  } else if (g.type === "CapsuleGeometry") {
    const p = (g as unknown as { parameters: { radius: number; height?: number; length?: number } }).parameters;
    out = new THREE.CapsuleGeometry(p.radius, p.height ?? p.length ?? 1, 2, 6);
  } else if (g.type === "IcosahedronGeometry") {
    const p = (g as unknown as { parameters: { radius: number; detail: number } }).parameters;
    if (p.detail > 0) out = new THREE.IcosahedronGeometry(p.radius, 0);
  }
  cache.set(g, out);
  done.add(out);
  return out;
};

/** Mount inside the ThreeCanvas after the scene content. */
export const LowPoly: React.FC = () => {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if (!done.has(m.geometry)) m.geometry = lowPolyOf(m.geometry);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const s = mat as THREE.MeshStandardMaterial;
        if ("flatShading" in s && !s.flatShading) {
          s.flatShading = true;
          s.needsUpdate = true;
        }
        // resampled geometry carries no vertex colours: fall back to the material colour
        if (s.vertexColors && !m.geometry.attributes.color) {
          s.vertexColors = false;
          s.needsUpdate = true;
        }
      }
    });
  });
  return null;
};
