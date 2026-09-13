import { AIR } from '../blocks/catalog.js';

/** Amanatides-Woo voxel traversal from the centre crosshair ray. */
export function raycastVoxel(world, origin, direction, maxDistance = 6) {
  const length = Math.hypot(...direction);
  if (!length) return null;
  const dir = direction.map((value) => value / length);
  let cell = origin.map(Math.floor);
  const step = dir.map((value) => Math.sign(value));
  const delta = dir.map((value) => value === 0 ? Infinity : Math.abs(1 / value));
  const side = dir.map((value, axis) => {
    if (value === 0) return Infinity;
    const edge = value > 0 ? cell[axis] + 1 : cell[axis];
    return (edge - origin[axis]) / value;
  });
  let distance = 0;
  let normal = [0, 0, 0];

  while (distance <= maxDistance) {
    const blockId = world.getBlock(...cell);
    if (blockId !== AIR && blockId !== 0) {
      return { position: [...cell], blockId, normal, distance };
    }
    let axis = 0;
    if (side[1] < side[axis]) axis = 1;
    if (side[2] < side[axis]) axis = 2;
    distance = side[axis];
    cell[axis] += step[axis];
    side[axis] += delta[axis];
    normal = [0, 0, 0];
    normal[axis] = -step[axis];
  }
  return null;
}

export function placementPosition(hit) {
  return hit ? hit.position.map((value, axis) => value + hit.normal[axis]) : null;
}

