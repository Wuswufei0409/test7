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
import { placementPosition } from './game/interaction/Raycast.js';
import { SelectionHighlight } from './game/interaction/SelectionHighlight.js';
import { Inventory } from './game/inventory/Inventory.js';
import { MutableWorld } from './game/world/MutableWorld.js';
import { DropManager, MiningController, placeSelectedBlock } from './game/interaction/Interaction.js';
import { createGameState, loadFromStorage, saveToStorage } from './game/save/SaveGame.js';
import { Block } from './world/Blocks.js';
import { SurvivalSystem } from './game/survival/SurvivalSystem.js';
import { DayNightSystem } from './game/survival/DayNightSystem.js';
import { FarmingSystem } from './game/farming/FarmingSystem.js';
import './style.css';

const SEED = 20260913;
const VIEW_DIST = 36; // fog far plane
const CHUNK = 16;

export function start(opts = {}) {
  const fallbackInventory = new Inventory();
  fallbackInventory.slots[27] = { itemId: 'bread', count: 3 };
  fallbackInventory.slots[28] = { itemId: 'wheat_seeds', count: 8 };
  fallbackInventory.slots[29] = { itemId: 'carrot', count: 4 };
  fallbackInventory.slots[30] = { itemId: 'potato', count: 4 };
  fallbackInventory.slots[31] = { itemId: 'wooden_hoe', count: 1 };
  fallbackInventory.slots[32] = { itemId: 'bed', count: 1 };
  const fallbackState = {
    version: 1,
    seed: opts.seed ?? SEED,
    player: { position: null, health: 20, hunger: 20 },
    inventory: fallbackInventory.serialize(),
    time: 0,
    changedBlocks: [],
    containers: { chests: {}, furnaces: {} },
    entities: [],
    survival: { health: 20, hunger: 20, saturation: 5, difficulty: opts.difficulty ?? 'normal' },
    dayNight: { time: 1000, day: 1, hostiles: [], nextMobId: 1 },
    farming: { plots: [] },
  };
  const loadResult = loadFromStorage(localStorage, () => structuredClone(fallbackState));
  const restored = loadResult.state;
  const seed = restored.seed;

  const container = document.getElementById('app');
  const scene = new THREE.Scene();

  const { renderer, camera, resize } = createRenderer({ container, scene });
  scene.add(camera);
  const hud = new HUD();
  const atlas = createAtlas(seed);
  const baseWorld = new DemoWorld(seed);
  const renderToItem = new Map([
    [Block.AIR, 'air'], [Block.GRASS, 'grass'], [Block.DIRT, 'dirt'], [Block.STONE, 'stone'],
    [Block.SAND, 'sand'], [Block.WATER, 'air'], [Block.LOG, 'oak_log'], [Block.PLANKS, 'oak_planks'],
    [Block.LEAVES, 'oak_leaves'], [Block.COBBLE, 'cobblestone'], [Block.BRICKS, 'bricks'],
    [Block.SNOW, 'snow'], [Block.BEDROCK, 'stone'], [Block.GRAVEL, 'gravel'], [Block.GLASS, 'glass'],
    [Block.SANDSTONE, 'sandstone'], [Block.COAL_ORE, 'coal_ore'], [Block.IRON_ORE, 'iron_ore'],
    [Block.GOLD_ORE, 'gold_ore'], [Block.DIAMOND_ORE, 'diamond_ore'], [Block.CLAY, 'clay'],
    [Block.WOOL, 'white_wool'], [Block.CACTUS, 'cactus'], [Block.OBSIDIAN, 'obsidian'],
    [Block.ICE, 'ice'], [Block.CORAL, 'coral_block'],
  ]);
  const itemToRender = new Map([...renderToItem].map(([id, item]) => [item, id]));
  // Duplicate interaction aliases must resolve to their ordinary visible form,
  // not the later WATER/BEDROCK entries inserted into the inverse map.
  itemToRender.set('air', Block.AIR);
  itemToRender.set('stone', Block.STONE);
  itemToRender.set('red_wool', Block.WOOL);
  itemToRender.set('crafting_table', Block.PLANKS);
  itemToRender.set('furnace', Block.STONE);
  itemToRender.set('chest', Block.PLANKS);
  itemToRender.set('torch', Block.RED_MUSHROOM);
  itemToRender.set('ladder', Block.PLANKS);
  itemToRender.set('prismarine', Block.CORAL);
  itemToRender.set('sea_lantern', Block.GLASS);
  itemToRender.set('bookshelf', Block.PLANKS);
  const world = new MutableWorld({ blockAt: (x, y, z) => renderToItem.get(baseWorld.blockAt(x, y, z)) ?? 'stone' });
  world.applyChanges(restored.changedBlocks);
  const inventory = Inventory.deserialize(restored.inventory);
  const drops = new DropManager();
  drops.entities = restored.entities.map((entity) => structuredClone(entity));
  drops.nextId = Math.max(0, ...drops.entities.map((entity) => entity.id ?? 0)) + 1;
  const mining = new MiningController();
  let gameTime = restored.time;
  const survival = new SurvivalSystem(restored.survival ?? {
    health: restored.player.health ?? 20,
    hunger: restored.player.hunger ?? 20,
    difficulty: opts.difficulty ?? 'normal',
  });
  const dayNight = new DayNightSystem(restored.dayNight ?? { time: restored.time || 1000 });
  const farming = new FarmingSystem(restored.farming);
  const containers = restored.containers;
  const sky = new Sky(scene, VIEW_DIST);
  const cam = new FirstPersonCamera(camera, renderer.domElement);
  cam.spawnY = baseWorld.heightAt(cam.spawnX, cam.spawnZ) + 2.62;
  const hand = new FirstPersonHand(camera, atlas);
  const highlight = new SelectionHighlight(scene);
  const dropGroup = new THREE.Group();
  dropGroup.name = 'item-drops';
  scene.add(dropGroup);
  const dropMeshes = new Map();
  const cropGroup = new THREE.Group();
  cropGroup.name = 'crops';
  scene.add(cropGroup);
  const cropMeshes = new Map();
  const hostileGroup = new THREE.Group();
  hostileGroup.name = 'night-hostiles';
  scene.add(hostileGroup);
  const hostileMeshes = new Map();
  const lookDirection = new THREE.Vector3();
  let selectedBlock = null;
  let lastPlacedPosition = null;

  // ---- build visible voxel world ----
  const opaqueMeshes = [];
  const transparentMeshes = [];
  const texture = atlas.texture;

  let worldObj = null;
  const buildRegion = () => {
    if (worldObj) {
      scene.remove(worldObj);
      worldObj.traverse((node) => {
        node.geometry?.dispose();
        node.material?.dispose();
      });
      opaqueMeshes.length = 0;
      transparentMeshes.length = 0;
    }
    worldObj = new THREE.Object3D();
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

    const getBlock = (x, y, z) => itemToRender.get(world.getBlock(x, y, z)) ?? Block.STONE;

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
  if (Array.isArray(restored.player.position)) camera.position.fromArray(restored.player.position);
  hud.updateSurvival(survival, dayNight, farming);
  hud.updateInventory(inventory);
  if (!loadResult.ok) hud.setSaveStatus(`存档损坏：${loadResult.error.message}；已安全新建世界`, true);

  const playerBounds = () => ({
    min: [camera.position.x - 0.3, camera.position.y - 1.62, camera.position.z - 0.3],
    max: [camera.position.x + 0.3, camera.position.y + 0.18, camera.position.z + 0.3],
  });
  const makeState = () => createGameState({
    seed,
    player: { position: camera.position.toArray(), health: survival.health, hunger: survival.hunger },
    inventory,
    time: gameTime,
    world,
    containers,
    entities: drops.serialize(),
    survival: survival.serialize(),
    dayNight: dayNight.serialize(),
    farming: farming.serialize(),
  });
  const persist = () => {
    saveToStorage(localStorage, makeState());
    hud.setSaveStatus('世界已保存');
  };
  const syncDropMeshes = () => {
    const live = new Set(drops.entities.map((entity) => entity.id));
    for (const [id, mesh] of dropMeshes) {
      if (live.has(id)) continue;
      dropGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      dropMeshes.delete(id);
    }
    for (const entity of drops.entities) {
      let mesh = dropMeshes.get(entity.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.38, 0.38),
          new THREE.MeshBasicMaterial({ color: 0xffdf55 }),
        );
        mesh.userData.baseY = entity.position[1] + 0.65;
        dropMeshes.set(entity.id, mesh);
        dropGroup.add(mesh);
      }
      mesh.position.fromArray(entity.position);
    }
  };
  const syncSurvivalMeshes = () => {
    const liveCrops = new Set();
    for (const [key, plot] of farming.plots) {
      if (!plot.crop) continue;
      liveCrops.add(key);
      let mesh = cropMeshes.get(key);
      if (!mesh) {
        const color = plot.crop === 'wheat' ? 0xd9bb48 : plot.crop === 'carrots' ? 0x55a832 : 0x77a545;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1, 0.32), new THREE.MeshLambertMaterial({ color }));
        cropMeshes.set(key, mesh);
        cropGroup.add(mesh);
      }
      const height = 0.12 + plot.stage * 0.1;
      mesh.scale.y = height;
      mesh.position.set(plot.position[0] + 0.5, plot.position[1] + height / 2 + 0.51, plot.position[2] + 0.5);
    }
    for (const [key, mesh] of cropMeshes) if (!liveCrops.has(key)) { cropGroup.remove(mesh); cropMeshes.delete(key); }

    const liveMobs = new Set(dayNight.hostiles.map((mob) => mob.id));
    for (const mob of dayNight.hostiles) {
      let mesh = hostileMeshes.get(mob.id);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.55), new THREE.MeshLambertMaterial({ color: 0x4e8d50 }));
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
        forward.normalize();
        mesh.position.copy(camera.position).addScaledVector(forward, 5 + mob.id * 0.35);
        mesh.position.x += (mob.id % 3 - 1) * 1.2;
        mesh.position.y -= 0.72;
        hostileMeshes.set(mob.id, mesh);
        hostileGroup.add(mesh);
      }
      mesh.material.color.setHex(mob.burning ? 0xff6d22 : 0x4e8d50);
    }
    for (const [id, mesh] of hostileMeshes) if (!liveMobs.has(id)) { hostileGroup.remove(mesh); hostileMeshes.delete(id); }
  };
  syncDropMeshes();
  syncSurvivalMeshes();

  const refreshSelection = () => {
    camera.getWorldDirection(lookDirection);
    selectedBlock = raycastVoxel(world, camera.position.toArray(), lookDirection.toArray(), 8);
    if (selectedBlock) highlight.show(selectedBlock.position);
    else highlight.hide();
    return selectedBlock;
  };

  const mineSelected = (seconds = 0.12) => {
    if (!selectedBlock) return { broken: false, progress: 0 };
    const result = mining.update(world, selectedBlock.position, seconds, drops);
    hud.setActionStatus(result.broken ? `已采集 ${selectedBlock.blockId}，按 F 拾取` : `采集中 ${Math.round(result.progress * 100)}%`);
    if (result.broken) {
      buildRegion();
      syncDropMeshes();
      refreshSelection();
      persist();
    }
    return result;
  };
  const collectDrops = (radius = 10) => {
    const count = drops.pickupNearby(inventory, camera.position.toArray(), radius);
    syncDropMeshes();
    hud.updateInventory(inventory);
    hud.setActionStatus(count ? `拾取 ${count} 个方块` : '附近没有可拾取掉落');
    if (count) persist();
    return count;
  };
  const placeCurrent = () => {
    const target = placementPosition(selectedBlock);
    const placed = !!target && placeSelectedBlock(inventory, world, target, playerBounds());
    lastPlacedPosition = placed ? [...target] : null;
    hud.setActionStatus(placed ? `已放置 ${world.getBlock(...target)}` : '此处无法放置');
    if (placed) {
      buildRegion();
      hud.updateInventory(inventory);
      refreshSelection();
      persist();
    }
    return placed;
  };
  const die = () => {
    survival.damage(survival.maxHealth, survival.lastDamage?.source ?? 'command');
    const spawned = inventory.dropAll(camera.position.toArray());
    for (const drop of spawned) drops.spawn(drop.itemId, drop.count, drop.position);
    syncDropMeshes();
    hud.updateInventory(inventory);
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(`死亡掉落 ${spawned.length} 组物品`);
    persist();
    return spawned.length;
  };
  const respawn = () => {
    if (!survival.dead) return false;
    camera.position.fromArray(survival.respawn([cam.spawnX, cam.spawnY, cam.spawnZ]));
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(`已在${survival.spawnPoint ? '床边' : '世界出生点'}重生`);
    persist();
    return true;
  };
  const applyDamage = (source = 'hostile', amount = 3) => {
    const applied = source === 'fall' ? survival.fall(amount)
      : source === 'drowning' ? survival.drown(amount)
        : source === 'melee' ? survival.melee(amount)
          : survival.hostileHit(amount);
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(`${source} 伤害 ${applied.toFixed(1)}${survival.dead ? ' · 你死了，按 P 重生' : ''}`);
    if (survival.dead) die();
    return applied;
  };
  const eatSelected = () => {
    const ate = survival.eat(inventory);
    hud.updateInventory(inventory);
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(ate ? '食物恢复了饥饿与饱和度' : '当前物品不能吃，或饥饿值已满');
    if (ate) persist();
    return ate;
  };
  const selectedGround = () => selectedBlock?.position ?? [Math.floor(camera.position.x), Math.floor(camera.position.y - 2), Math.floor(camera.position.z)];
  const tillSelected = () => {
    const position = selectedGround();
    const tilled = farming.till(world, position);
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(tilled ? `已开垦耕地 ${position.join(',')}` : '只能开垦草方块或泥土');
    if (tilled) { buildRegion(); syncSurvivalMeshes(); persist(); }
    return tilled;
  };
  const plantOrHarvest = () => {
    const position = selectedGround();
    const plot = farming.get(position);
    let result = null;
    if (plot?.crop && plot.stage >= 7) result = farming.harvest(position, inventory);
    else result = farming.plant(position, inventory) ? { planted: true } : null;
    hud.updateInventory(inventory);
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(result?.planted ? '已播种；光照 ≥ 9 时随时间生长' : result ? `收获 ${result.produce} ×${result.produceCount}` : '请选择种子/胡萝卜/马铃薯并对准耕地');
    if (result) { syncSurvivalMeshes(); persist(); }
    return result;
  };
  const advanceWorld = (ticks = 1200) => {
    dayNight.advance(ticks, survival.difficulty);
    farming.tick(ticks, Math.round(dayNight.brightness * 15));
    survival.tick(ticks / 20);
    sky.setBrightness(dayNight.brightness);
    hud.updateSurvival(survival, dayNight, farming);
    syncSurvivalMeshes();
    return { dayNight: dayNight.snapshot(), crops: farming.serialize(), survival: survival.serialize() };
  };
  const sleep = () => {
    const slept = dayNight.sleep(camera.position.toArray(), survival);
    sky.setBrightness(dayNight.brightness);
    hud.updateSurvival(survival, dayNight, farming);
    syncSurvivalMeshes();
    hud.setActionStatus(slept ? '已睡过夜晚，并设置重生点' : '只能在夜晚睡觉');
    if (slept) persist();
    return slept;
  };
  const cycleDifficulty = () => {
    const levels = ['peaceful', 'easy', 'normal', 'hard'];
    survival.setDifficulty(levels[(levels.indexOf(survival.difficulty) + 1) % levels.length]);
    if (survival.difficulty === 'peaceful') dayNight.hostiles.length = 0;
    syncSurvivalMeshes();
    hud.updateSurvival(survival, dayNight, farming);
    hud.setActionStatus(`难度已切换为 ${survival.difficulty}`);
    persist();
    return survival.difficulty;
  };

  // ---- pointer lock awareness ----
  document.addEventListener('pointerlockchange', () => hud.setLocked(!!document.pointerLockElement));
  hud.setLocked(false);

  let miningHeld = false;
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (!cam.locked) return;
    if (event.button === 0) miningHeld = true;
    if (event.button === 2) placeCurrent();
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) { miningHeld = false; mining.reset(); }
  });
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  let inventoryOpen = false;
  let swapSource = null;
  document.addEventListener('keydown', (event) => {
    if (/^Digit[1-9]$/.test(event.code)) {
      inventory.select(Number(event.code.slice(5)) - 1);
      hud.updateInventory(inventory);
      persist();
    } else if (event.code === 'KeyF') collectDrops();
    else if (event.code === 'KeyK') die();
    else if (event.code === 'KeyP') respawn();
    else if (event.code === 'KeyH') eatSelected();
    else if (event.code === 'KeyJ') applyDamage('hostile', 3);
    else if (event.code === 'KeyB') sleep();
    else if (event.code === 'KeyT') tillSelected();
    else if (event.code === 'KeyG') plantOrHarvest();
    else if (event.code === 'KeyR') advanceWorld(1200);
    else if (event.code === 'KeyN') advanceWorld(12000);
    else if (event.code === 'KeyD') cycleDifficulty();
    else if (event.code === 'KeyE') {
      inventoryOpen = !inventoryOpen;
      if (inventoryOpen && document.pointerLockElement) document.exitPointerLock();
      hud.setInventoryOpen(inventoryOpen);
    }
  });
  hud.inventoryGrid.addEventListener('click', (event) => {
    const index = Number(event.target.closest('[data-index]')?.dataset.index);
    if (!Number.isInteger(index)) return;
    if (swapSource === null) swapSource = index;
    else { inventory.swap(swapSource, index); swapSource = null; persist(); }
    if (index < 9) inventory.select(index);
    hud.updateInventory(inventory);
  });
  hud.inventoryGrid.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const index = Number(event.target.closest('[data-index]')?.dataset.index);
    const target = inventory.slots.findIndex((stack) => stack === null);
    if (Number.isInteger(index) && target >= 0 && inventory.split(index, null, target)) persist();
    hud.updateInventory(inventory);
  });

  // ---- resize handling (R1 criterion: window scaling keeps layout usable) ----
  window.addEventListener('resize', () => {
    resize();
  });

  // ---- render loop ----
  const clock = new THREE.Clock();
  let survivalVisualClock = 0;
  const autosaveId = window.setInterval(persist, 5000);
  function render() {
    requestAnimationFrame(render);
    const dt = Math.min(clock.getDelta(), 0.1);
    cam.update(dt);
    gameTime += dt;
    dayNight.advance(dt * 20, survival.difficulty);
    survival.tick(dt);
    farming.tick(dt * 20, Math.round(dayNight.brightness * 15));
    survivalVisualClock += dt;
    if (survivalVisualClock >= 0.5) { syncSurvivalMeshes(); survivalVisualClock = 0; }
    sky.setBrightness(dayNight.brightness);
    hud.updateSurvival(survival, dayNight, farming);
    sky.update(camera);
    refreshSelection();
    if (miningHeld) mineSelected(dt);
    for (const mesh of dropMeshes.values()) {
      mesh.rotation.y += dt * 1.8;
      mesh.position.y = mesh.userData.baseY + Math.sin(gameTime * 3 + mesh.id) * 0.08;
    }
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
    inventory,
    drops,
    dropGroup,
    mining,
    survival,
    dayNight,
    farming,
    cropGroup,
    hostileGroup,
    loadResult,
    get gameTime() { return gameTime; },
    autosaveId,
    actions: { mineSelected, collectDrops, placeCurrent, die, respawn, applyDamage, eatSelected, tillSelected, plantOrHarvest, advanceWorld, sleep, cycleDifficulty, persist, refreshSelection },
    get selectedBlock() { return selectedBlock; },
    get lastPlacedPosition() { return lastPlacedPosition; },
    resize,
    chunk: { opaque: opaqueMeshes, transparent: transparentMeshes },
  };

  return window.__voxel;
}

// Auto-start in browser module context.
if (typeof window !== 'undefined' && window.__voxel === undefined) {
  start();
}
