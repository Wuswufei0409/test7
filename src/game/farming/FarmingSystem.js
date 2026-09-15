const CROPS = Object.freeze({
  wheat: { seed: 'wheat_seeds', produce: 'wheat', stages: 7 },
  carrots: { seed: 'carrot', produce: 'carrot', stages: 7 },
  potatoes: { seed: 'potato', produce: 'potato', stages: 7 },
});

const keyOf = (position) => position.map(Math.floor).join(',');

export class FarmingSystem {
  constructor(state = {}) {
    this.plots = new Map((state.plots ?? []).map(([key, plot]) => [key, { ...plot, position: [...plot.position] }]));
  }

  till(world, position) {
    const key = keyOf(position);
    const block = world.getBlock(...position);
    if (!['dirt', 'grass'].includes(block) || this.plots.has(key)) return false;
    world.setBlock(...position, 'dirt');
    this.plots.set(key, { position: position.map(Math.floor), hydrated: true, crop: null, stage: 0, progress: 0 });
    return true;
  }

  plant(position, inventory, slot = inventory.selected) {
    const plot = this.plots.get(keyOf(position));
    const stack = inventory.slots[slot];
    const crop = Object.entries(CROPS).find(([, config]) => config.seed === stack?.itemId)?.[0];
    if (!plot || plot.crop || !crop) return false;
    inventory.remove(slot, 1);
    Object.assign(plot, { crop, stage: 0, progress: 0 });
    return true;
  }

  tick(ticks, light = 15) {
    let growthEvents = 0;
    if (light < 9) return growthEvents;
    for (const plot of this.plots.values()) {
      if (!plot.crop || plot.stage >= CROPS[plot.crop].stages) continue;
      plot.progress += ticks * (plot.hydrated ? 1 : 0.5) * (light / 15);
      while (plot.progress >= 1200 && plot.stage < CROPS[plot.crop].stages) {
        plot.progress -= 1200;
        plot.stage += 1;
        growthEvents += 1;
      }
    }
    return growthEvents;
  }

  harvest(position, inventory) {
    const plot = this.plots.get(keyOf(position));
    if (!plot?.crop || plot.stage < CROPS[plot.crop].stages) return null;
    const config = CROPS[plot.crop];
    const result = { produce: config.produce, produceCount: 3, seed: config.seed, seedCount: plot.crop === 'wheat' ? 2 : 0 };
    inventory.add(result.produce, result.produceCount);
    if (result.seedCount) inventory.add(result.seed, result.seedCount);
    Object.assign(plot, { crop: null, stage: 0, progress: 0 });
    return result;
  }

  get(position) { const plot = this.plots.get(keyOf(position)); return plot ? { ...plot, position: [...plot.position] } : null; }
  serialize() { return { plots: [...this.plots.entries()].map(([key, plot]) => [key, { ...plot, position: [...plot.position] }]) }; }
}

export { CROPS };
