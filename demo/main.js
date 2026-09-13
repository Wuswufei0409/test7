/**
 * R3 玩家控制 — interactive demo (visual/manual verification).
 *
 * Renders a small voxel scene with a software perspective renderer (no
 * external engine, so it stays self-contained and independent of the R1/R2
 * renderer work). The real PlayerPhysics + PlayerController drive the avatar.
 * Controls: click to lock pointer; WASD move; Space jump/swim-up; Shift sprint;
 * Ctrl sneak; mouse look.
 *
 * Run: npm run demo  → http://localhost:4174
 */
import { VoxelWorld } from '../src/game/world/World.js';
import { Player } from '../src/game/player/Player.js';
import { PlayerPhysics } from '../src/game/player/Physics.js';
import { PlayerController } from '../src/game/player/PlayerController.js';

// ---------- build a small deterministic scene ----------
const world = new VoxelWorld({ seed: 1 });
// ground platform (grass top)
world.fillBox(-14, 0, -14, 14, 0, 14, { id: 1, solid: true, opaque: true, r: 96, g: 148, b: 70 });
// a few protruding blocks (grass)
for (const [x, z] of [[3, 3], [-4, -3], [-5, 4], [6, -5], [2, 8]]) {
  world.setBlock(x, 1, z, { id: 2, solid: true, opaque: true, r: 122, g: 96, b: 50 });
}
// vertical wall (collision test)
world.fillBox(7, 1, -6, 7, 3, -2, { id: 3, solid: true, opaque: true, r: 130, g: 130, b: 140 });
// slab/step for auto-step (top y=1.5)
world.setBlock(-8, 1, 0, { id: 20, solid: true, opaque: true, solidHeight: 0.5, r: 180, g: 168, b: 120 });
world.setBlock(-7, 1, 0, { id: 20, solid: true, opaque: true, solidHeight: 0.5, r: 180, g: 168, b: 120 });
// water pool for swimming
world.fillBox(-2, 0, -2, 2, 0, 2, { id: 1, solid: true, opaque: true, r: 70, g: 90, b: 70 }); // pool floor
world.fillBox(-2, 1, -2, 2, 1, 2, { water: true, r: 40, g: 120, b: 220 }); // water level 1
world.fillBox(-2, 2, -2, 2, 2, 2, { water: true, r: 30, g: 110, b: 210 });

const player = new Player({ x: 0, y: 1, z: 9, yaw: Math.PI, pitch: -0.1 });
const physics = new PlayerPhysics(player, world);
const controller = new PlayerController(player, physics, { sensitivity: 0.0022 });

// ---------- canvas & renderer ----------
const canvas = document.getElementById('gl');
const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(window.innerWidth * DPR);
  H = Math.floor(window.innerHeight * DPR);
  canvas.width = W; canvas.height = H;
}
resize();
window.addEventListener('resize', resize);

const SOLID_COLORS = new Map(); // per block id default
const FACES = [
  { axis: 'x', sign: 1 }, { axis: 'x', sign: -1 },
  { axis: 'y', sign: 1 }, { axis: 'y', sign: -1 },
  { axis: 'z', sign: 1 }, { axis: 'z', sign: -1 },
];

// ---------- perspective renderer (software) ----------
function render(scene) {
  const eye = { x: player.x, y: player.y + (player.sneaking ? 1.3 : 1.6), z: player.z };
  const yaw = player.yaw, pitch = player.pitch;

  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, H);
  // sky/ground gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#22324a'); g.addColorStop(0.5, '#7fb3d8'); g.addColorStop(0.52, '#8a7a5d'); g.addColorStop(1, '#5b5138');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sun
  ctx.fillStyle = '#ffe9a8';

  const cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);
  const cosP = Math.cos(-pitch), sinP = Math.sin(-pitch);
  const fov = 1.15; // half-tan
  const aspect = W / H;

  function view(v) {
    // translate
    let x = v.x - eye.x, y = v.y - eye.y, z = v.z - eye.z;
    return rotate({ x, y, z });
  }
  function rotate(v) {
    // rotate Y then X
    let x = v.x * cosY - v.z * sinY;
    let z = v.x * sinY + v.z * cosY;
    let y = v.y * cosP - z * sinP;
    z = v.y * sinP + z * cosP;
    return { x, y, z };
  }
  function project(v) {
    const s = v.z > 0.001 ? v.z : 0.001;
    const px = (v.x / (s * fov * aspect)) * W + W / 2;
    const py = -(v.y / (s * fov)) * H + H / 2;
    return { px, py, depth: s };
  }

  // collect solid + water faces around camera
  const faces = [];
  const R = 18;
  const cx = Math.floor(eye.x), cz = Math.floor(eye.z);
  for (let bx = cx - R; bx <= cx + R; bx++) {
    for (let by = -4; by <= 10; by++) {
      for (let bz = cz - R; bz <= cz + R; bz++) {
        const blk = scene.getBlock(bx, by, bz);
        const isSolid = blk.solid;
        const isWater = blk.water;
        if (!isSolid && !isWater) continue;
        const sh = blk.solidHeight ?? 1;
        const top = by + sh;
        for (const f of FACES) {
          // neighbor for culling shared faces
          let nb;
          if (f.axis === 'x') nb = scene.getBlock(bx + f.sign, by, bz);
          else if (f.axis === 'y') nb = scene.getBlock(bx, by + f.sign, bz);
          else nb = scene.getBlock(bx, by, bz + f.sign);
          const nbSolid = nb.solid;
          if (isSolid && nbSolid) continue; // interior face
          if (isWater && nb.water) continue; // water internal
          // build face corners (a,b,c,d) quad
          const lo = { x: bx, y: by, z: bz };
          const hi = { x: bx + 1, y: top, z: bz + 1 };
          let corners;
          if (f.axis === 'x') {
            const X = f.sign > 0 ? hi.x : lo.x;
            corners = [ {x:X,y:hi.y,z:lo.z}, {x:X,y:lo.y,z:lo.z}, {x:X,y:lo.y,z:hi.z}, {x:X,y:hi.y,z:hi.z} ];
          } else if (f.axis === 'y') {
            const Y = f.sign > 0 ? hi.y : lo.y;
            corners = [ {x:lo.x,y:Y,z:lo.z}, {x:lo.x,y:Y,z:hi.z}, {x:hi.x,y:Y,z:hi.z}, {x:hi.x,y:Y,z:lo.z} ];
          } else {
            const Z = f.sign > 0 ? hi.z : lo.z;
            corners = [ {x:lo.x,y:hi.y,z:Z}, {x:lo.x,y:lo.y,z:Z}, {x:hi.x,y:lo.y,z:Z}, {x:hi.x,y:hi.y,z:Z} ];
          }
          const vs = corners.map(view);
          // backface cull via the face's world-space outward normal
          const nrm = f.axis === 'x' ? { x: f.sign, y: 0, z: 0 }
            : f.axis === 'y' ? { x: 0, y: f.sign, z: 0 }
            : { x: 0, y: 0, z: f.sign };
          if (rotate(nrm).z <= 0) continue; // facing away from camera
          const pts = vs.map(project);
          const depth = (pts[0].depth + pts[1].depth + pts[2].depth + pts[3].depth) / 4;
          let color = isWater ? '40,140,230' : (blk.r + ',' + blk.g + ',' + blk.b);
          // shade by orientation + distance
          const distShade = Math.max(0.28, Math.min(1, 1.4 / (depth + 0.3)));
          faces.push({ pts, depth, color, water: isWater, distShade });
        }
      }
    }
  }

  // painter's sort (far -> near)
  faces.sort((p, q) => q.depth - p.depth);
  for (const f of faces) {
    const alpha = f.water ? 0.62 : 1;
    ctx.fillStyle = `rgba(${f.color},${alpha * Math.min(1, 0.55 + 0.45 * f.distShade)})`;
    ctx.beginPath();
    ctx.moveTo(f.pts[0].px, f.pts[0].py);
    for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].px, f.pts[i].py);
    ctx.closePath();
    ctx.fill();
    if (!f.water) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(W * 0.7, H * 0.18, 26, 0, Math.PI * 2); ctx.fill();
  drawHud();
}

function drawHud() {
  const sp = player.sprinting ? '疾跑' : (player.sneaking ? '下蹲' : '行走');
  const sw = player.swimming ? '游泳' : (player.feetWater ? '涉水' : '陆地');
  hud.innerHTML =
    `位置 x=${player.x.toFixed(1)} y=${player.y.toFixed(2)} z=${player.z.toFixed(1)}<br>` +
    `状态 <b>${sp}</b> | <b>${sw}</b> ` +
    `<span class="badge ${player.onGround ? 'on' : 'off'}">落地</span>` +
    `<span class="badge ${player.pointerLocked ? 'on' : 'off'}">视角锁定</span><br>` +
    `${(1 / (controller.lastDt || 1 / 60)).toFixed(0)} FPS · 指针锁定后移动鼠标看四周`;
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  controller.update(dt);
  render(world);
  requestAnimationFrame(frame);
}

// ---------- input wiring ----------
overlay.addEventListener('click', () => {
  controller.requestPointerLock(document, canvas);
});
document.addEventListener('pointerlockchange', () => {
  controller.onPointerLockChange(document);
  overlay.style.display = controller.pointerLocked ? 'none' : 'flex';
});
document.addEventListener('mousemove', (ev) => {
  controller.onMouseMove(ev.movementX || 0, ev.movementY || 0);
});
document.addEventListener('keydown', (ev) => controller.onKeyDown(ev.code));
document.addEventListener('keyup', (ev) => controller.onKeyUp(ev.code));

requestAnimationFrame(frame);
