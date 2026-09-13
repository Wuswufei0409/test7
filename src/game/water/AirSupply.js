/**
 * AirSupply — underwater oxygen bar, drowning, and air-pocket refill.
 *
 * MC bedrock 标准 14 的一部分：
 *   - 氧气条：head 泡在水里时 air 递减（默认 15 s），出水面/气穴时回满。
 *   - 溺水：air 归零后按 drownDamageRate 对 player 造成伤害（takeDamage 由生
 *     存/血条模块 M3 接入；此处通过可选回调解耦）。
 *   - 气穴：head 处在非水的气泡格中即可呼吸（为“无错误空气洞”/水下洞穴留接口）。
 *
 * 纯函数式 + 无外部依赖，可被 demo 与自动测试复用。
 */

const STANDING_HEIGHT = 1.8;
const SNEAK_HEIGHT = 1.5;

export class AirSupply {
  constructor(player, opts = {}) {
    this.player = player;
    this.maxAir = opts.maxAir ?? 15; // seconds
    this.air = opts.startAir ?? this.maxAir;
    this.drownDamageRate = opts.drownDamageRate ?? 2; // hp per second at 0 air
    this.refillRate = opts.refillRate ?? 3; // seconds of air per second out of water
    this._drownAccum = 0;
  }

  /** Height at the player's head cell (uses posture of the running physics). */
  headY() {
    const p = this.player;
    const h = p.sneaking ? SNEAK_HEIGHT : STANDING_HEIGHT;
    return p.y + h * 0.85;
  }

  headInWater(world) {
    const p = this.player;
    const hy = this.headY();
    return world.isWater(Math.floor(p.x), Math.floor(hy), Math.floor(p.z));
  }

  /**
   * Advance oxygen by dt seconds.
   * Returns { underwater, air, drowning, damage }.
   */
  update(world, dt = 1 / 60) {
    const p = this.player;
    const underwater = this.headInWater(world);
    p.underwater = underwater;
    this.underwater = underwater;
    let damage = 0;

    if (underwater) {
      this.air = Math.max(0, this.air - dt);
      this.drowning = this.air <= 0;
      if (this.air <= 0) {
        this._drownAccum += dt * this.drownDamageRate;
        const dealt = Math.floor(this._drownAccum);
        if (dealt > 0) {
          this._drownAccum -= dealt;
          damage += dealt;
          if (typeof p.takeDamage === 'function') p.takeDamage(dealt);
        }
      } else {
        this._drownAccum = 0;
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * this.refillRate);
      this._drownAccum = 0;
      this.drowning = false;
    }

    return {
      underwater,
      air: this.air,
      drowning: this.drowning,
      damage,
    };
  }
}
