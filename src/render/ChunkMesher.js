/**
 * ChunkMesher.js
 * R1 (MUL-34) — Render-level voxel mesher.
 *
 * Converts a dense 3D block grid into a THREE.BufferGeometry with correct
 * UV per face, culling faces hidden between opaque neighbours and splitting
 * transparent blocks so glass/water/leaves render through the opaque pass.
 *
 * This is the rendering half of "3D voxel rendering" — it does not own world
 * generation or chunk management (that is R2). It consumes a plain
 * blockGrid(blockX, blockY, blockZ) -> blockId accessor.
 */

import * as THREE from 'three';
import { isOpaque, isTransparent, faceTiles } from '../world/Blocks.js';

// Unit cube corner data per face. For each face we emit 4 vertices (two
// triangles) with correct winding so normals point outward.
const FACES = [
  // +X (east)
  { dir: [1, 0, 0], corners: [[1,1,1],[1,0,1],[1,0,0],[1,1,0]], uv: [[1,1],[1,0],[0,0],[0,1]] },
  // -X (west)
  { dir: [-1, 0, 0], corners: [[0,1,0],[0,0,0],[0,0,1],[0,1,1]], uv: [[1,1],[1,0],[0,0],[0,1]] },
  // +Y (top)
  { dir: [0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], uv: [[0,0],[0,1],[1,1],[1,0]] },
  // -Y (bottom)
  { dir: [0,-1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]], uv: [[0,1],[0,0],[1,0],[1,1]] },
  // +Z (south)
  { dir: [0, 0, 1], corners: [[0,1,1],[0,0,1],[1,0,1],[1,1,1]], uv: [[0,1],[0,0],[1,0],[1,1]] },
  // -Z (north)
  { dir: [0, 0,-1], corners: [[1,1,0],[1,0,0],[0,0,0],[0,1,0]], uv: [[0,1],[0,0],[1,0],[1,1]] },
];

const INDICES = [0, 1, 2, 0, 2, 3];

/**
 * @param {object} opts
 * @param {(x:number,y:number,z:number)=>number} opts.getBlock
 * @param {{minX,maxX,minY,maxY,minZ,maxZ}} opts.region
 * @param {(tile:number)=>[u0,v0,u1,v1]} opts.tileRect
 * @returns {THREE.BufferGeometry}
 */
export function buildChunkGeometry({ getBlock, region, tileRect }) {
  const { minX, maxX, minY, maxY, minZ, maxZ } = region;

  const opaque = { positions: [], uvs: [], normals: [], indices: [] };
  const transparent = { positions: [], uvs: [], normals: [], indices: [] };

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const id = getBlock(x, y, z);
        if (id === 0) continue; // air
        const tiles = faceTiles(id);
        const isTrans = isTransparent(id);

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const neighbour = getBlock(x + dx, y + dy, z + dz);
          // skip hidden faces: opaque-block faces are culled by opaque neighbours;
          // transparent blocks only cull against fully opaque neighbours.
          if (neighbour !== 0 && isOpaque(neighbour)) continue;

          // pick tile per face
          const tile =
            dy === 1 ? tiles.top :
            dy === -1 ? tiles.bottom :
            tiles.side;

          const target = isTrans ? transparent : opaque;
          const base = target.positions.length / 3;
          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz] = face.corners[c];
            target.positions.push(x + cx, y + cy, z + cz);
            const [u, v] = face.uv[c];
            const { u0, v0, u1, v1 } = tileRect(tile);
            target.uvs.push(u0 + (u1 - u0) * u, v0 + (v1 - v0) * v);
            target.normals.push(dx, dy, dz);
          }
          for (let i = 0; i < 6; i++) {
            target.indices.push(base + INDICES[i]);
          }
        }
      }
    }
  }

  const make = (data) => {
    if (data.positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    g.setIndex(data.indices);
    g.computeBoundingSphere();
    return g;
  };

  return { opaque: make(opaque), transparent: make(transparent) };
}
