/**
 * main.js
 * R1 (MUL-34) — Application bootstrap for the first-person voxel render core.
 *
 * Wires together: atlas + blocks -> demo world -> voxel mesh -> sky/fog ->
 * first-person camera -> HUD -> render loop. Exposes a global `window.voxel`
 * handle so the screenshot evidence harness and later integration issues can
 * introspect the running app.
 */

import * as THREE from 'three';
import { createAtlas } from './textures/Atlas.js';
import { DemoWorld } from './demo/DemoWorld.js';
import { buildChunkGeometry } from './render/ChunkMesher.js';
import { createRenderer } from './render/Renderer.js';
import { Sky } from './render/Sky.js';
import { FirstPersonCamera } from './render/FirstPersonCamera.js';
import { HUD } from './ui/HUD.js';
import { FirstPersonHand } from './ui/FirstPersonHand.js';
import { raycastVoxel } from './game/interaction/Raycast.js';
import { SelectionHighlight } from './game/interaction/SelectionHighlight.js';
import './style.css';

const SEED = 20260913;
const VIEW_DIST = 36; // fog far plane
const CHUNK = 16;

export function start(opts = {}) {
  const seed = opts.seed ?? SEED;

  const container = document.getElementById('app');
  const scene = new THREE.Scene();

  const { renderer, camera, resize } = createRenderer({ container, scene });
  scene.add(camera);
  const hud = new HUD();
  const atlas = createAtlas(seed);
  const world = new DemoWorld(seed);
  const sky = new Sky(scene, VIEW_DIST);
  const cam = new FirstPersonCamera(camera, renderer.domElement);
  cam.spawnY = world.heightAt(cam.spawnX, cam.spawnZ) + 2.62;
  const hand = new FirstPersonHand(camera, atlas);
  const highlight = new SelectionHighlight(scene);
  const lookDirection = new THREE.Vector3();
  let selectedBlock = null;

  // ---- build visible voxel world ----
  const opaqueMeshes = [];
  const transparentMeshes = [];
  const texture = atlas.texture;

  const buildRegion = () => {
    const worldObj = new THREE.Object3D();
    worldObj.name = 'world';
    scene.add(worldObj);

    const cx = Math.floor(cam.spawnX / CHUNK);
    const cz = Math.floor(cam.spawnZ / CHUNK);
    const R = 2; // 5x5 chunks around spawn (~80 blocks) => visible & performant
    const chunks = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cxo = (cx + dx) * CHUNK;
        const czo = (cz + dz) * CHUNK;
        chunks.push({ xo: cxo, zo: czo });
      }
    }

    const getBlock = (x, y, z) => world.blockAt(x, y, z);

    for (const c of chunks) {
      const region = {
        minX: c.xo, maxX: c.xo + CHUNK - 1,
        minY: 1, maxY: 70,
        minZ: c.zo, maxZ: c.zo + CHUNK - 1,
      };
      const geo = buildChunkGeometry({ getBlock, region, tileRect: atlas.tileRect });
      if (geo.opaque) {
        const m = new THREE.Mesh(geo.opaque, new THREE.MeshLambertMaterial({ map: texture }));
        opaqueMeshes.push(m);
        worldObj.add(m);
      }
      if (geo.transparent) {
        const m = new THREE.Mesh(
          geo.transparent,
          new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.7, depthWrite: false })
        );
        transparentMeshes.push(m);
        worldObj.add(m);
      }
    }
    return worldObj;
  };

  buildRegion();
  cam.spawn();

  // ---- pointer lock awareness ----
  document.addEventListener('pointerlockchange', () => hud.setLocked(!!document.pointerLockElement));
  hud.setLocked(false);

  // ---- resize handling (R1 criterion: window scaling keeps layout usable) ----
  window.addEventListener('resize', () => {
    resize();
  });

  // ---- render loop ----
  const clock = new THREE.Clock();
  function render() {
    requestAnimationFrame(render);
    const dt = Math.min(clock.getDelta(), 0.1);
    cam.update(dt);
    sky.update(camera);
    camera.getWorldDirection(lookDirection);
    selectedBlock = raycastVoxel(
      { getBlock: (x, y, z) => world.blockAt(x, y, z) },
      camera.position.toArray(),
      lookDirection.toArray(),
      8,
    );
    if (selectedBlock) highlight.show(selectedBlock.position);
    else highlight.hide();
    // keep first-person hand attached to camera (already parented)
    renderer.render(scene, camera);
  }
  render();

  // Expose for evidence / integration.
  window.__voxel = {
    seed,
    world,
    atlas,
    camera,
    cam,
    renderer,
    scene,
    hud,
    hand,
    highlight,
    get selectedBlock() { return selectedBlock; },
    resize,
    chunk: { opaque: opaqueMeshes, transparent: transparentMeshes },
  };

  return window.__voxel;
}

// Auto-start in browser module context.
if (typeof window !== 'undefined' && window.__voxel === undefined) {
  start();
}
