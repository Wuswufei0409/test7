/**
 * evidence-screenshot.mjs
 * R1 (MUL-34) — Reproducible screenshot & runtime-health evidence for a
 * desktop Chromium. Starts `vite preview`, opens headless Chromium, checks for
 * blocking console errors, captures screenshots at four window sizes, and
 * reports renderer stats. Run: node scripts/evidence-screenshot.mjs
 *
 * Requires an existing local Chromium (see execPath below).
 */

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'evidence');
mkdirSync(OUT, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ||
  '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';

// Wait for the preview server to be ready.
function waitFor(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        onSuccess();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('server timeout'));
        setTimeout(probe, 250);
      });
      function onSuccess() { resolve(); }
    };
    probe();
  });
}

// Launch preview server.
function launchPreview(port) {
  const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return child;
}

const PORT = 4199;
const base = `http://127.0.0.1:${PORT}`;

(async () => {
  const server = launchPreview(PORT);
  try {
    await waitFor(base);

    const browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--disable-gpu-sandbox',
        '--mute-audio',
      ],
    });

    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    // Wait for WebGL renderer + first frames.
    await page.waitForTimeout(4000);

    // Evidence captures the unobstructed in-game view. Pointer lock cannot be
    // held reliably in headless Chromium, so switch only the HUD presentation;
    // the renderer and camera keep running exactly as in the interactive app.
    await page.evaluate(() => window.__voxel.hud.setLocked(true));
    await page.waitForTimeout(250);

    // Give the app a flag to allow pointer-lock-free interaction via a synthetic
    // unlock so HUD stays visible without a human click.
    const stats = await page.evaluate(() => {
      const v = window.__voxel;
      const cross = document.querySelector('.crosshair').getBoundingClientRect();
      const hotbar = document.querySelector('.hotbar').getBoundingClientRect();
      const health = document.querySelector('.stats').getBoundingClientRect();
      return {
        hasWebGL: !!v && !!v.renderer,
        canvasWidth: v && v.renderer.domElement.width,
        canvasHeight: v && v.renderer.domElement.height,
        seed: v && v.seed,
        opaqueMeshes: v ? v.chunk.opaque.length : 0,
        transparentMeshes: v ? v.chunk.transparent.length : 0,
        selectedBlock: v?.selectedBlock?.position ?? null,
        highlightVisible: v?.highlight?.mesh?.visible === true,
        crosshairCenter: [cross.left + cross.width / 2, cross.top + cross.height / 2],
        hotbarRect: [hotbar.left, hotbar.top, hotbar.right, hotbar.bottom],
        statsRect: [health.left, health.top, health.right, health.bottom],
      };
    });

    await page.screenshot({ path: path.join(OUT, 'r1_1600x900.png') });

    // Resize test: narrower window must keep layout usable (R1 criterion).
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'r1_1024x640.png') });

    await page.setViewportSize({ width: 640, height: 480 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'r1_640x480.png') });
    const compactStats = await page.evaluate(() => {
      const v = window.__voxel;
      const cross = document.querySelector('.crosshair').getBoundingClientRect();
      const hotbar = document.querySelector('.hotbar').getBoundingClientRect();
      const health = document.querySelector('.stats').getBoundingClientRect();
      return {
        canvasWidth: v.renderer.domElement.width,
        canvasHeight: v.renderer.domElement.height,
        crosshairCenter: [cross.left + cross.width / 2, cross.top + cross.height / 2],
        hotbarRect: [hotbar.left, hotbar.top, hotbar.right, hotbar.bottom],
        statsRect: [health.left, health.top, health.right, health.bottom],
      };
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'r1_1280x800.png') });

    const resizeStats = await page.evaluate(() => {
      const v = window.__voxel;
      const cross = document.querySelector('.crosshair').getBoundingClientRect();
      const hotbar = document.querySelector('.hotbar').getBoundingClientRect();
      return {
        canvasWidth: v.renderer.domElement.width,
        canvasHeight: v.renderer.domElement.height,
        clientWidth: v.renderer.domElement.clientWidth,
        clientHeight: v.renderer.domElement.clientHeight,
        crosshairCenter: [cross.left + cross.width / 2, cross.top + cross.height / 2],
        hotbarRect: [hotbar.left, hotbar.top, hotbar.right, hotbar.bottom],
      };
    });

    if (!stats.hasWebGL || stats.opaqueMeshes === 0) throw new Error('voxel scene did not initialize');
    if (!stats.selectedBlock || !stats.highlightVisible) throw new Error('crosshair selection highlight is not visible');
    if (consoleErrors.length || pageErrors.length) {
      throw new Error(`blocking browser errors: ${[...consoleErrors, ...pageErrors].join(' | ')}`);
    }
    if (resizeStats.canvasWidth !== 1280 || resizeStats.canvasHeight !== 800) {
      throw new Error(`renderer did not resize: ${JSON.stringify(resizeStats)}`);
    }
    if (compactStats.canvasWidth !== 640 || compactStats.canvasHeight !== 480 ||
        compactStats.hotbarRect[0] < 0 || compactStats.hotbarRect[2] > 640 ||
        compactStats.statsRect[3] > compactStats.hotbarRect[1]) {
      throw new Error(`compact HUD overflowed: ${JSON.stringify(compactStats)}`);
    }

    await browser.close();

    const report = {
      url: base,
      chrome: CHROME,
      blockingConsoleErrors: consoleErrors,
      pageErrors,
      stats,
      compactStats,
      resizeStats,
      screenshots: ['r1_1600x900.png', 'r1_1024x640.png', 'r1_640x480.png', 'r1_1280x800.png'],
    };
    const fs = await import('node:fs');
    fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    server.kill('SIGTERM');
  }
})().catch((e) => {
  console.error('EVIDENCE FAILED:', e);
  process.exit(1);
});
