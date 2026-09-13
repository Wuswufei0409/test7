/**
 * PlayerPhysics — deterministic voxel player movement.
 *
 * Implements the intercepts required by completion standard 04:
 *   gravity, axis-separated AABB collision, landing, step-up over
 *   slabs/stairs, sprint, sneak, and swimming.
 *
 * Key design points:
 *   - Position is the *feet-center* of an AABB of width 0.6.
 *   - Horizontal and vertical movement are separated and each sub-stepped
 *     so a fast player cannot tunnel through a solid block.
 *   - Step-up: when grounded and a horizontal move is blocked, the player is
 *     raised onto a step up to `maxStepHeight` if headroom allows, then the
 *     move is reattempted.
 *   - Swimming applies buoyancy + drag instead of gravity when submerged.
 *
 * The module is pure JS with no runtime dependencies; it is exercised by the
 * automated tests under test/ and by the interactive demo under demo/.
 */

const EPS = 1e-4;
const MAX_SUBSTEP = 0.5; // movement segments larger than a block are split

export class PlayerPhysics {
  constructor(player, world, opts = {}) {
    this.player = player;
    this.world = world;
    this.gravity = opts.gravity ?? 28; // blocks/s^2 (downward, positive)
    this.maxSpeed = opts.maxSpeed ?? 4.317; // walk speed (blocks/s)
    this.sprintFactor = opts.sprintFactor ?? 1.3;
    this.sneakFactor = opts.sneakFactor ?? 0.3;
    this.swimFactor = opts.swimFactor ?? 0.5;
    this.jumpVelocity = opts.jumpVelocity ?? 8.4; // initial up speed
    this.maxStepHeight = opts.maxStepHeight ?? 0.55;
    this.half = opts.half ?? 0.3;
    this.standingHeight = opts.standingHeight ?? 1.8;
    this.sneakHeight = opts.sneakHeight ?? 1.5;
    this.waterAccel = opts.waterAccel ?? 12; // up thrust while swimming
    this.waterDrag = opts.waterDrag ?? 2.5;
    this.airControl = opts.airControl ?? 0.6; // 0..1 in-air horizontal gain
  }

  // ----- geometry helpers -----

  height() {
    return this.player.sneaking ? this.sneakHeight : this.standingHeight;
  }

  collides(x, y, z, opt = {}) {
    const half = opt.half ?? this.half;
    const h = opt.height ?? this.height();
    const x0 = x - half, x1 = x + half;
    const y0 = y, y1 = y + h;
    const z0 = z - half, z1 = z + half;
    const bx0 = Math.floor(x0), bx1 = Math.floor(x1);
    const by0 = Math.floor(y0), by1 = Math.floor(y1 - EPS);
    const bz0 = Math.floor(z0), bz1 = Math.floor(z1);
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        for (let bz = bz0; bz <= bz1; bz++) {
          const blk = this.world.getBlock(bx, by, bz);
          if (!blk.solid) continue;
          // respect non-cubic solids (slabs/stairs step height)
          const sh = blk.solidHeight ?? 1;
          if (y0 < by + sh && y1 > by) return true;
        }
      }
    }
    return false;
  }

  submerged() {
    const p = this.player;
    const checkY = p.y + this.height() * 0.85;
    return this.world.isWater(
      Math.floor(p.x), Math.floor(checkY), Math.floor(p.z));
  }

  feetInWater() {
    const p = this.player;
    return this.world.isWater(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  }

  // ----- main step -----

  /**
   * Advance the player by dt seconds.
   * input: { x (strafe, -1..1), z (forward, -1..1, +1 = forward),
   *          jump (bool), sprint (bool), sneak (bool) }
   */
  step(dt, input = {}) {
    const p = this.player;
    // Normalize input so callers may omit unused keys (defaults to 0 / false).
    input = {
      x: input.x ?? 0,
      z: input.z ?? 0,
      jump: !!input.jump,
      sprint: !!input.sprint,
      sneak: !!input.sneak,
    };
    const swimming = this.submerged();
    p.swimming = swimming;

    // 1) Horizontal target speed -------------------------------------------
    let speed = this.maxSpeed;
    if (input.sprint && !input.sneak && input.z > 0) {
      p.sprinting = true;
      speed *= this.sprintFactor;
    } else {
      p.sprinting = false;
    }
    if (input.sneak) {
      p.sneaking = true;
      speed *= this.sneakFactor;
    } else {
      p.sneaking = false;
    }
    if (swimming) speed *= this.swimFactor;

    // Movement is relative to the player's yaw: forward = -sin(yaw), left = -cos(yaw)
    const fwd = input.z; // +1 forward
    const strafe = input.x; // +1 left
    const yaw = p.yaw;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    // forward direction: ( -sinY * fwd , -cosY * fwd )
    // left direction:    ( -cosY * strafe,  sinY * strafe )
    let mvX = (-sinY * fwd) + (-cosY * strafe);
    let mvZ = (-cosY * fwd) + (sinY * strafe);
    const mag = Math.hypot(mvX, mvZ);
    if (mag > 0) {
      mvX = (mvX / mag) * speed;
      mvZ = (mvZ / mag) * speed;
    }

    // 2) Vertical velocity ------------------------------------------------
    let vy = p.vy;
    if (swimming) {
      // buoyancy: damped; you float toward the surface, jump thrusts up.
      vy -= vy * this.waterDrag * dt;
      const thrust = input.jump ? this.waterAccel : this.waterAccel * 0.25;
      vy += thrust * dt;
      vy = Math.max(vy, -this.maxSpeed * 0.4);
      vy = Math.min(vy, this.maxSpeed * 0.8);
      p.onGround = false;
    } else {
      if (p.onGround) {
        vy = Math.max(vy, 0);
        if (input.jump) {
          vy = this.jumpVelocity;
          p.onGround = false;
        }
      } else {
        vy -= this.gravity * dt;
      }
    }
    p.vy = vy;

    // 3) Horizontal movement with collision + step-up ---------------------
    let movedBlocked = false;
    const airFactor = p.onGround ? 1 : this.airControl;
    let hx = mvX * airFactor * dt;
    let hz = mvZ * airFactor * dt;
    const blocked = this.moveWithCollision(hx, hz);
    if (blocked.collided) movedBlocked = true;

    // 4) Vertical movement with landing -----------------------------------
    this.moveVertical(vy * dt);

    // 5) Step-up: if grounded, horizontal was blocked, and a low step fits --
    if (p.onGround && blocked.collided && !swimming) {
      this.tryStepUp(hx, hz);
    }

    p.onGround = this.computeGrounded();

    // water state bookkeeping for animation/submersion
    p.feetWater = this.feetInWater();
    return p;
  }

  /** Move by (dx,dz), resolving collisions per-axis, sub-stepping to avoid tunneling. */
  moveWithCollision(dx, dz) {
    let collided = false;
    // sub-step so fast motion cannot tunnel through a solid
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / MAX_SUBSTEP));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      collided = this.moveAxis('x', sx) || collided;
      collided = this.moveAxis('z', sz) || collided;
    }
    return { collided };
  }

  /** Move along one axis, clamping so the AABB never intersects a solid. */
  moveAxis(axis, delta) {
    const p = this.player;
    if (delta === 0) return false;
    const prop = axis === 'x' ? 'x' : 'z';
    const next = p[prop] + delta;
    if (!this.collides(axis === 'x' ? next : p.x,
                       p.y,
                       axis === 'z' ? next : p.z,
                       { height: this.height() })) {
      p[prop] = next;
      return false;
    }
    // sliding: find the largest free coordinate in the direction of motion
    const dir = delta > 0 ? 1 : -1;
    const sign = Math.sign(delta);
    // scan incrementally (coarse then snap)
    const coarse = this.clampAxis(axis, prop, next, dir);
    p[prop] = coarse;
    return true;
  }

  clampAxis(axis, prop, next, dir) {
    const p = this.player;
    const start = p[prop];
    // binary-free: walk in unit increments toward blocked location
    const stepDir = dir;
    // move in 0.05 steps from start toward next, testing collision
    let cursor = start;
    const target = next;
    // To keep it cheap yet accurate, step in small increments of the original delta
    const total = Math.abs(target - start);
    const n = Math.max(1, Math.ceil(total / 0.05));
    const inc = (target - start) / n;
    for (let i = 0; i < n; i++) {
      const trial = cursor + inc;
      if (!this.collides(axis === 'x' ? trial : p.x,
                         p.y,
                         axis === 'z' ? trial : p.z,
                         { height: this.height() })) {
        cursor = trial;
      } else {
        break;
      }
    }
    // nudge back slightly to stay out of the wall
    const sign = inc >= 0 ? 1 : -1;
    return cursor - sign * 1e-3;
  }

  /** Move vertically by dy, stopping on landing (grounded) or ceiling. */
  moveVertical(dy) {
    const p = this.player;
    if (dy === 0) return;
    const h = this.height();
    const next = p.y + dy;
    if (!this.collides(p.x, next, p.z, { height: h })) {
      p.y = next;
      return;
    }
    if (dy < 0) {
      // descending collision → land: walk down from the current (free) feet
      // position to find the last free y, then snap onto the support top.
      let y = p.y; // currently free, no call ever leaves the player colliding
      const n = Math.max(1, Math.ceil(Math.abs(dy) / 0.002));
      const inc = dy / n;
      for (let i = 0; i < n; i++) {
        const t = y + inc;
        if (!this.collides(p.x, t, p.z, { height: h })) y = t;
        else break;
      }
      p.y = this.supportTop(p.x, p.z, y);
      p.vy = 0;
      p.onGround = true;
    } else {
      // ascending collision → ceiling
      let y = p.y;
      const n = Math.max(1, Math.ceil(Math.abs(dy) / 0.002));
      const inc = dy / n;
      for (let i = 0; i < n; i++) {
        const t = y + inc;
        if (!this.collides(p.x, t, p.z, { height: h })) y = t;
        else break;
      }
      p.y = y;
      p.vy = 0;
    }
  }

  /** Top (y) of the highest solid support under the feet, incl. slabs. */
  supportTop(x, z, belowY) {
    const half = this.half;
    const x0 = Math.floor(x - half), x1 = Math.floor(x + half);
    const z0 = Math.floor(z - half), z1 = Math.floor(z + half);
    let top = -64;
    const yLo = Math.floor(belowY) - 4;
    for (let bx = x0; bx <= x1; bx++) {
      for (let bz = z0; bz <= z1; bz++) {
        for (let by = Math.floor(belowY + 0.5); by >= yLo; by--) {
          const blk = this.world.getBlock(bx, by, bz);
          if (blk.solid) top = Math.max(top, by + (blk.solidHeight ?? 1));
        }
      }
    }
    return top;
  }

  computeGrounded() {
    return this.collides(this.player.x, this.player.y - 1e-3, this.player.z,
                         { height: this.height() + 1e-3 });
  }

  /** Attempt to auto-step onto a low block when a horizontal move is blocked. */
  tryStepUp(dx, dz) {
    const p = this.player;
    let raised = 0;
    // step in increments of 0.0625 (1/16) up to maxStepHeight
    const inc = 0.0625;
    // first find if at the raised position the horizontal move fits
    let candidateY = p.y;
    for (let h = inc; h <= this.maxStepHeight + 1e-6; h += inc) {
      const ty = p.y + h;
      // headroom check: tall enough and not colliding at the raised height
      if (this.collides(p.x, ty, p.z, { height: this.height() })) break;
      candidateY = ty;
      raised = h;
      // does horizontal move fit from here?
      const testX = p.x + dx;
      const testZ = p.z + dz;
      if (!this.collides(testX, ty, testZ, { height: this.height() })) {
        p.y = ty; // climb the step
        // horizontal slide resolves the remaining move
        this.moveWithCollision(dx, dz);
        p.vy = 0;
        p.onGround = true;
        return true;
      }
    }
    return false;
  }
}
