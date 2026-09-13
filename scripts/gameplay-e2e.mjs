import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'evidence');
const PORT = 4201;
const URL = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
mkdirSync(OUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const probe = () => {
      const request = http.get(url, (response) => { response.resume(); resolve(); });
      request.on('error', () => Date.now() - started > timeout
        ? reject(new Error('preview server timeout'))
        : setTimeout(probe, 200));
    };
    probe();
  });
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
try {
  await waitFor(URL);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const browserErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(String(error)));

  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const restarted = await page.evaluate(() => !!window.__voxel);
  if (!restarted) throw new Error(`app did not restart after saved reload: ${browserErrors.join(' | ')}`);

  const mined = await page.evaluate(() => {
    const game = window.__voxel;
    game.hud.setLocked(true);
    const target = [...game.selectedBlock.position];
    const itemId = game.selectedBlock.blockId;
    const result = game.actions.mineSelected(20);
    return {
      target,
      itemId,
      broken: result.broken,
      blockAfter: game.world.getBlock(...target),
      dropCount: game.drops.entities.length,
    };
  });
  assert(mined.broken && mined.blockAfter === 'air' && mined.dropCount === 1, `browser mining did not mutate/render world: ${JSON.stringify(mined)}`);
  assert(await page.evaluate(() => window.__voxel.dropGroup.children.length === 1), 'mined item drop is not visible in the browser scene');
  await page.screenshot({ path: path.join(OUT, 'm1_drop_spawned.png') });

  await page.keyboard.press('KeyF');
  const picked = await page.evaluate(({ itemId }) => ({
    count: window.__voxel.inventory.count(itemId),
    drops: window.__voxel.drops.entities.length,
    hudCount: document.querySelector('.slot-box').textContent,
  }), mined);
  assert(picked.count === 1 && picked.drops === 0 && picked.hudCount === '1', `drop pickup did not reach live HUD: ${JSON.stringify(picked)}`);
  await page.screenshot({ path: path.join(OUT, 'm1_mined_picked.png') });

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const savedRestarted = await page.evaluate(() => !!window.__voxel);
  if (!savedRestarted) throw new Error(`app did not restart after saved reload: ${browserErrors.join(' | ')}`);
  const restored = await page.evaluate(({ target, itemId }) => ({
    source: window.__voxel.loadResult.source,
    count: window.__voxel.inventory.count(itemId),
    changedBlock: window.__voxel.world.getBlock(...target),
    seed: window.__voxel.seed,
  }), mined);
  assert(restored.source === 'saved' && restored.count === 1 && restored.changedBlock === 'air', `reload did not restore browser state: ${JSON.stringify(restored)}`);

  const placed = await page.evaluate(() => {
    const game = window.__voxel;
    if (!game.selectedBlock) {
      game.cam.pitch = -0.65;
      game.cam.update(0);
      game.actions.refreshSelection();
    }
    return game.actions.placeCurrent();
  });
  assert(placed, 'live placement action rejected the mined block position');
  const placementState = await page.evaluate(({ itemId }) => ({
    position: window.__voxel.lastPlacedPosition,
    block: window.__voxel.world.getBlock(...window.__voxel.lastPlacedPosition),
    count: window.__voxel.inventory.count(itemId),
  }), mined);
  assert(placementState.block === mined.itemId && placementState.count === 0, `placement did not consume inventory: ${JSON.stringify(placementState)}`);
  await page.screenshot({ path: path.join(OUT, 'm1_placed.png') });

  // Exercise the actual inventory DOM bindings: E opens the panel, right-click
  // splits a stack into the first empty slot, two left clicks swap stacks.
  await page.evaluate(() => {
    window.__voxel.inventory.add('stone', 65);
    window.__voxel.hud.updateInventory(window.__voxel.inventory);
    window.__voxel.actions.persist();
  });
  await page.keyboard.press('KeyE');
  assert(await page.locator('.inventory-panel').isVisible(), 'E did not open the live inventory panel');
  await page.locator('.inventory-slot[data-index="0"]').click({ button: 'right' });
  await page.locator('.inventory-slot[data-index="1"]').click();
  await page.locator('.inventory-slot[data-index="2"]').click();
  const inventoryUi = await page.evaluate(() => ({
    slots: window.__voxel.inventory.slots.slice(0, 3),
    selected: window.__voxel.inventory.selected,
    panelVisible: !document.querySelector('.inventory-panel').classList.contains('hidden'),
  }));
  assert(inventoryUi.slots[0].count === 32 && inventoryUi.slots[1].count === 32 && inventoryUi.slots[2].count === 1 && inventoryUi.selected === 2,
    `inventory split/swap/selection bindings failed: ${JSON.stringify(inventoryUi)}`);
  await page.screenshot({ path: path.join(OUT, 'm1_inventory.png') });
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyK');
  const death = await page.evaluate(() => ({
    empty: window.__voxel.inventory.slots.every((slot) => slot === null),
    droppedStacks: window.__voxel.drops.entities.length,
    status: document.querySelector('.action-status').textContent,
  }));
  assert(death.empty && death.droppedStacks === 3 && death.status.includes('死亡掉落'), `browser death drops failed: ${JSON.stringify(death)}`);

  await page.evaluate(() => localStorage.setItem('bedrock-web.world.v1', '{broken'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__voxel);
  const corrupt = await page.evaluate(() => ({
    ok: window.__voxel.loadResult.ok,
    code: window.__voxel.loadResult.error?.code,
    visible: !document.querySelector('.save-status').classList.contains('hidden'),
    text: document.querySelector('.save-status').textContent,
  }));
  assert(!corrupt.ok && corrupt.code === 'CORRUPT_SAVE' && corrupt.visible && corrupt.text.includes('安全新建世界'), `corrupt save fallback not visible: ${JSON.stringify(corrupt)}`);
  await page.screenshot({ path: path.join(OUT, 'm1_corrupt_save_fallback.png') });

  assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);
  const report = { mined, picked, restored, placementState, inventoryUi, death, corrupt, browserErrors };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path.join(OUT, 'm1_gameplay.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
