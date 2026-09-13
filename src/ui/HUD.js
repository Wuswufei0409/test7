/**
 * HUD.js
 * R1 (MUL-34) — Near-Bedrock 1.4.0 style heads-up display overlay.
 *
 * Pure DOM/CSS, separate from the WebGL canvas, drawn above it. Includes:
 *  - central crosshair
 *  - bottom 9-slot hotbar with a selected-slot highlight
 *  - health (hearts) and hunger (shanks) on lower-left
 *  - oxygen bar that only appears underwater situations (R4 will drive it)
 *  - held-item name chip above the hotbar
 *  - a "Click to play" veil until pointer lock is acquired
 *
 * Layout is responsive: it re-centers on window resize and works from a wide
 * desktop window down to narrow/mobile-ish widths with no blocking errors.
 */

const HEARTS = 20; // half-hearts
const HUNGER = 20; // half-shanks

export class HUD {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.className = 'hud';
    this.locked = false;
    document.body.appendChild(this.el);

    this.health = HEARTS;
    this.hunger = HUNGER;
    this.oxygen = 10; // full = 10 units
    this.underwater = false;

    this.build();
    this.setHealth(this.health);
    this.setHunger(this.hunger);
    this.setOxygen(this.oxygen, false);
  }

  build() {
    // ---- crosshair ----
    this.cross = document.createElement('div');
    this.cross.className = 'crosshair';
    this.cross.innerHTML = `<div class="ch-b"></div><div class="ch-l"></div><div class="ch-t"></div><div class="ch-r"></div>`;
    this.el.appendChild(this.cross);

    // ---- health & hunger (lower-left) ----
    this.stats = document.createElement('div');
    this.stats.className = 'stats';

    this.healthRow = document.createElement('div');
    this.healthRow.className = 'stat-row';
    this.stats.appendChild(this.healthRow);

    this.hungerRow = document.createElement('div');
    this.hungerRow.className = 'stat-row';
    this.stats.appendChild(this.hungerRow);

    this.oxygenBar = document.createElement('div');
    this.oxygenBar.className = 'oxygen hidden';
    this.oxygenBar.innerHTML = `<svg viewBox="0 0 120 16" width="120" height="16"><rect x="0" y="4" width="120" height="8" class="oxy-bg"/><rect id="oxy-fill" x="0" y="4" width="120" height="8" class="oxy-fill"/></svg>`;
    this.stats.appendChild(this.oxygenBar);
    this.el.appendChild(this.stats);

    // ---- hotbar (bottom center) ----
    this.hotbar = document.createElement('div');
    this.hotbar.className = 'hotbar';
    this.slots = [];
    this.slotNames = ['Pickaxe', 'Sword', 'Dirt', 'Stone', 'Planks', 'Torch', 'Bread', 'Boat', 'Empty'];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === 0 ? ' selected' : '');
      slot.innerHTML = `<span class="slot-num">${i + 1}</span><span class="slot-box"></span><span class="slot-name">${this.slotNames[i]}</span>`;
      this.hotbar.appendChild(slot);
      this.slots.push(slot);
    }
    this.el.appendChild(this.hotbar);

    // ---- held item chip ----
    this.heldChip = document.createElement('div');
    this.heldChip.className = 'held-chip';
    this.heldChip.textContent = this.slotNames[0];
    this.el.appendChild(this.heldChip);

    // ---- "click to play" veil ----
    this.veil = document.createElement('div');
    this.veil.className = 'veil';
    this.veil.innerHTML = `<div class="veil-inner"><div class="veil-title">Bedrock Web</div><div class="veil-sub">第一人称 3D 体素沙盒 · 演示</div><div class="veil-cta">点击进入游戏 (需要鼠标权限)</div></div>`;
    this.el.appendChild(this.veil);
  }

  setLocked(locked) {
    this.locked = locked;
    this.veil.classList.toggle('hidden', !!locked);
    this.cross.classList.toggle('dim', !locked);
  }

  setHealth(halfHearts) {
    this.health = Math.max(0, Math.min(HEARTS, halfHearts));
    let html = '';
    for (let i = 0; i < HEARTS / 2; i++) {
      const filled = this.health >= (i + 1) * 2;
      const half = !filled && this.health === (i * 2 + 1);
      html += `<span class="heart ${half ? 'heart-half' : filled ? '' : 'heart-empty'}">${filled || half ? '♥' : '♡'}</span>`;
    }
    this.healthRow.innerHTML = html;
  }

  setHunger(halfShanks) {
    this.hunger = Math.max(0, Math.min(HUNGER, halfShanks));
    let html = '';
    for (let i = 0; i < HUNGER / 2; i++) {
      const filled = this.hunger >= (i + 1) * 2;
      const half = !filled && this.hunger === (i * 2 + 1);
      html += `<span class="shank ${filled ? '' : half ? 'shank-half' : 'shank-empty'}">${filled || half ? '✂' : '○'}</span>`;
    }
    this.hungerRow.innerHTML = html;
  }

  setOxygen(units, underwater) {
    this.oxygen = Math.max(0, Math.min(10, units));
    this.underwater = underwater;
    this.oxygenBar.classList.toggle('hidden', !underwater);
    const fill = this.oxygenBar.querySelector('#oxy-fill');
    if (fill) fill.setAttribute('width', String((this.oxygen / 10) * 120));
  }

  selectSlot(i) {
    this.slots.forEach((s, idx) => s.classList.toggle('selected', idx === i));
    this.heldChip.textContent = this.slotNames[i];
  }
}

