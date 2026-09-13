/**
 * Player — mutable gameplay state for the first-person avatar.
 *
 * Position is the feet-center of an AABB (width 0.6). Orientation is yaw
 * (radians, 0 = -Z "north") and pitch (radians, positive = looking up).
 */

export class Player {
  constructor({ x = 0, y = 1, z = 0, yaw = 0, pitch = 0 } = {}) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;   // radians, horizontal
    this.pitch = pitch; // radians, vertical (-: down, +: up)
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.onGround = false;
    this.sprinting = false;
    this.sneaking = false;
    this.swimming = false;
    this.feetWater = false;
    this.moving = false;
  }

  /** World-space forward vector (from yaw). */
  forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  /** World-space left vector. */
  left() {
    return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) };
  }
}
