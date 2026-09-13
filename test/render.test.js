import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChunkGeometry } from '../src/render/ChunkMesher.js';
import { Block, BLOCK_NAME, faceTiles } from '../src/world/Blocks.js';

const tileRect = () => ({ u0: 0, v0: 0, u1: 1, v1: 1 });

test('single voxel emits six outward-facing quads including a visible top', () => {
  const geometry = buildChunkGeometry({
    getBlock: (x, y, z) => x === 0 && y === 0 && z === 0 ? Block.GRASS : Block.AIR,
    region: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
    tileRect,
  }).opaque;

  assert.ok(geometry);
  assert.equal(geometry.getAttribute('position').count, 24);
  assert.equal(geometry.index.count, 36);

  const pos = geometry.getAttribute('position');
  const idx = geometry.index.array;
  // The top quad is face #2, indices 12..17. Its triangle winding must point +Y
  // so Three.js front-face culling actually renders terrain surfaces.
  const ia = idx[12], ib = idx[13], ic = idx[14];
  const a = [pos.getX(ia), pos.getY(ia), pos.getZ(ia)];
  const b = [pos.getX(ib), pos.getY(ib), pos.getZ(ib)];
  const c = [pos.getX(ic), pos.getY(ic), pos.getZ(ic)];
  const ab = b.map((v, i) => v - a[i]);
  const ac = c.map((v, i) => v - a[i]);
  const crossY = ab[2] * ac[0] - ab[0] * ac[2];
  assert.ok(crossY > 0, `top triangle faces upward (${crossY})`);
});

test('render registry exposes thirty original procedural block appearances', () => {
  const ids = Object.values(Block).filter((id) => id !== Block.AIR);
  assert.equal(ids.length, 30);
  for (const id of ids) {
    assert.ok(BLOCK_NAME[id], `block ${id} has a display name`);
    const faces = faceTiles(id);
    assert.ok(Number.isInteger(faces.top) && Number.isInteger(faces.side));
  }
});
