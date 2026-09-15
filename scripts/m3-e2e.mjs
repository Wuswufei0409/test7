import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'evidence');
const PORT = 4203;
const URL = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
mkdirSync(OUT, { recursive: true });

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = (url, timeout = 20000) => new Promise((resolve, reject) => {
  const started = Date.now();
  const probe = () => {
    const request = http.get(url, (response) => { response.resume(); resolve(); });
    request.on('error', () => Date.now() - started > timeout ? reject(new Error('preview server timeout')) : setTimeout(probe, 200));
  };
  probe();
});

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
try {
  await waitFor(URL);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__voxel?.survival);
  await page.waitForTimeout(1000);

  const survival = await page.evaluate(() => {
    const game = window.__voxel;
    game.hud.setLocked(true);
    game.survival.hunger = 10;
    game.inventory.swap(27, 0);
    game.inventory.select(0);
    const sources = {
      fall: game.actions.applyDamage('fall', 8),
      drowning: game.actions.applyDamage('drowning', 2),
      melee: game.actions.applyDamage('melee', 1),
      hostile: game.actions.applyDamage('hostile', 3),
    };
    const ate = game.actions.eatSelected();
    return { sources, ate, health: game.survival.health, hunger: game.survival.hunger, bread: game.inventory.count('bread'), difficulty: game.survival.difficulty };
  });
  assert(Object.values(survival.sources).every((value) => value > 0), `damage sources missing: ${JSON.stringify(survival)}`);
  assert(survival.ate && survival.hunger === 15, `food did not restore hunger: ${JSON.stringify(survival)}`);
  await page.screenshot({ path: path.join(OUT, 'm3_survival_damage_food.png') });

  const deathRespawn = await page.evaluate(() => {
    const game = window.__voxel;
    const bed = [game.camera.position.x + 1, game.camera.position.y, game.camera.position.z + 1];
    game.survival.setSpawnPoint(bed);
    const droppedStacks = game.actions.die();
    const dead = game.survival.dead;
    const respawned = game.actions.respawn();
    return { droppedStacks, dead, respawned, position: game.camera.position.toArray(), bed, health: game.survival.health };
  });
  assert(deathRespawn.dead && deathRespawn.respawned && deathRespawn.health === 20, `death/respawn failed: ${JSON.stringify(deathRespawn)}`);
  assert(deathRespawn.position.every((value, i) => Math.abs(value - deathRespawn.bed[i]) < 0.001), 'bed respawn point was not used');

  const night = await page.evaluate(() => {
    const game = window.__voxel;
    const difficulty = game.actions.cycleDifficulty();
    game.dayNight.time = 12500;
    const state = game.actions.advanceWorld(1000).dayNight;
    return { difficulty, time: state.time, night: state.isNight, brightness: state.brightness, hostiles: state.hostiles, visibleMobs: game.hostileGroup.children.length };
  });
  assert(night.difficulty === 'hard' && night.night && night.brightness < 0.5 && night.hostiles[0]?.health === 30 && night.hostiles[0]?.damage === 4.5 && night.visibleMobs > 0, `night spawn/difficulty not observable: ${JSON.stringify(night)}`);
  await page.screenshot({ path: path.join(OUT, 'm3_night_hostile.png') });

  const slept = await page.evaluate(() => {
    const game = window.__voxel;
    const ok = game.actions.sleep();
    return { ok, time: game.dayNight.time, night: game.dayNight.isNight, spawnPoint: game.survival.spawnPoint, burning: game.dayNight.hostiles.some((mob) => mob.burning) };
  });
  assert(slept.ok && slept.time === 0 && !slept.night && slept.spawnPoint && slept.burning, `sleep/daylight burn failed: ${JSON.stringify(slept)}`);
  await page.screenshot({ path: path.join(OUT, 'm3_sleep_daylight_burn.png') });

  const farm = await page.evaluate(() => {
    const game = window.__voxel;
    const position = [...game.selectedBlock.position];
    game.world.setBlock(...position, 'dirt');
    game.inventory.add('wheat_seeds', 1);
    game.inventory.select(game.inventory.slots.findIndex((stack) => stack?.itemId === 'wheat_seeds'));
    const tilled = game.actions.tillSelected();
    const planted = game.actions.plantOrHarvest();
    for (let i = 0; i < 7; i++) game.farming.tick(1200, 15);
    game.actions.advanceWorld(0);
    const mature = game.farming.get(position);
    return { position, tilled, planted, mature, visibleCrops: game.cropGroup.children.length };
  });
  assert(farm.tilled && farm.planted?.planted && farm.mature.stage === 7 && farm.visibleCrops === 1, `crop growth failed: ${JSON.stringify(farm)}`);
  await page.screenshot({ path: path.join(OUT, 'm3_farm_mature.png') });
  const harvest = await page.evaluate(() => {
    const game = window.__voxel;
    const result = game.actions.plantOrHarvest();
    return { result, wheat: game.inventory.count('wheat'), seeds: game.inventory.count('wheat_seeds'), crops: game.cropGroup.children.length };
  });
  assert(harvest.result?.produce === 'wheat' && harvest.wheat === 3 && harvest.seeds >= 2 && harvest.crops === 0, `harvest failed: ${JSON.stringify(harvest)}`);

  assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);
  const report = { survival, deathRespawn, night, slept, farm, harvest, browserErrors };
  writeFileSync(path.join(OUT, 'm3_gameplay.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
