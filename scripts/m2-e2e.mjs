import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "evidence");
const PORT = 4202;
const URL = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || "/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
mkdirSync(OUT, { recursive: true });

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = (url, timeout = 20000) => new Promise((resolve, reject) => {
  const started = Date.now();
  const probe = () => {
    const request = http.get(url, (response) => { response.resume(); resolve(); });
    request.on("error", () => Date.now() - started > timeout ? reject(new Error("preview server timeout")) : setTimeout(probe, 200));
  };
  probe();
});

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
try {
  await waitFor(URL);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.__voxel);

  await page.evaluate(() => {
    window.__voxel.inventory.add("oak_log", 4);
    window.__voxel.hud.updateInventory(window.__voxel.inventory);
  });
  await page.keyboard.press("KeyC");
  assert(await page.locator(".crafting-panel").isVisible(), "C did not open crafting UI");
  for (let i = 0; i < 4; i++) await page.locator('[data-recipe="oak_planks"]').click();
  await page.locator('[data-recipe="crafting_table"]').click();
  await page.locator('[data-recipe="sticks"]').click();
  await page.locator('[data-recipe="sticks"]').click();
  await page.locator('[data-grid="3"]').click();
  await page.locator('[data-recipe="wood_pickaxe"]').click();
  await page.screenshot({ path: path.join(OUT, "m2_crafting_recipe_book.png") });

  await page.evaluate(() => {
    const inventory = window.__voxel.inventory;
    inventory.add("cobblestone", 3);
    inventory.add("iron_ore", 3);
    inventory.add("coal", 4);
    window.__voxel.hud.updateInventory(inventory);
    window.__voxel.craftingPanel.render();
  });
  await page.locator('[data-recipe="stone_pickaxe"]').click();
  await page.locator('[data-mode="furnace"]').click();
  for (let i = 0; i < 3; i++) await page.locator('[data-smelt="iron_ore"]').click();
  await page.locator('[data-mode="crafting"]').click();
  await page.locator('[data-grid="3"]').click();
  await page.locator('[data-recipe="iron_pickaxe"]').click();
  await page.screenshot({ path: path.join(OUT, "m2_furnace_toolchain.png") });

  const beforeReload = await page.evaluate(() => ({
    craftingTable: window.__voxel.inventory.count("crafting_table"),
    wood: window.__voxel.inventory.count("wood_pickaxe"),
    stone: window.__voxel.inventory.count("stone_pickaxe"),
    iron: window.__voxel.inventory.count("iron_pickaxe"),
    ingots: window.__voxel.inventory.count("iron_ingot"),
    furnace: window.__voxel.actions.smeltItem("iron_ore"),
    savedFurnace: window.__voxel.loadResult.state.containers?.furnaces,
  }));
  assert(beforeReload.craftingTable === 1 && beforeReload.wood === 1 && beforeReload.stone === 1 && beforeReload.iron === 1,
    `browser progression incomplete: ${JSON.stringify(beforeReload)}`);

  await page.evaluate(() => window.__voxel.actions.persist());
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.__voxel?.loadResult?.source === "saved");
  const restored = await page.evaluate(() => ({
    wood: window.__voxel.inventory.count("wood_pickaxe"),
    stone: window.__voxel.inventory.count("stone_pickaxe"),
    iron: window.__voxel.inventory.count("iron_pickaxe"),
    furnace: window.__voxel.loadResult.state.containers.furnaces.default,
  }));
  assert(restored.wood === 1 && restored.stone === 1 && restored.iron === 1, `crafted tools not restored: ${JSON.stringify(restored)}`);
  assert(restored.furnace?.completed === 3, `furnace state not restored: ${JSON.stringify(restored)}`);
  assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(" | ")}`);

  const report = { beforeReload, restored, browserErrors };
  writeFileSync(path.join(OUT, "m2_gameplay.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
