export const SMELTING_RECIPES = Object.freeze({
  iron_ore: Object.freeze({ output: "iron_ingot", count: 1, cookTime: 10 }),
  sand: Object.freeze({ output: "glass", count: 1, cookTime: 10 }),
  raw_cod: Object.freeze({ output: "cooked_cod", count: 1, cookTime: 10 }),
});

export const FUELS = Object.freeze({ coal: 80, oak_log: 15, oak_planks: 15, stick: 5 });

const stack = (item, count) => count > 0 ? { item, count } : null;

export class Furnace {
  constructor({ recipes = SMELTING_RECIPES, fuels = FUELS } = {}) {
    this.recipes = recipes;
    this.fuels = fuels;
    this.input = null;
    this.fuel = null;
    this.output = null;
    this.burnRemaining = 0;
    this.progress = 0;
  }

  setInput(item, count = 1) {
    if (!this.recipes[item]) throw new RangeError(`Not smeltable: ${item}`);
    this.input = stack(item, count);
    this.progress = 0;
  }

  setFuel(item, count = 1) {
    if (!this.fuels[item]) throw new RangeError(`Not a fuel: ${item}`);
    this.fuel = stack(item, count);
  }

  canOutput(recipe) {
    return !this.output || this.output.item === recipe.output;
  }

  ignite() {
    if (this.burnRemaining > 0 || !this.fuel || !this.input) return;
    this.burnRemaining = this.fuels[this.fuel.item];
    this.fuel = stack(this.fuel.item, this.fuel.count - 1);
  }

  tick(ticks = 1) {
    if (!Number.isInteger(ticks) || ticks < 0) throw new RangeError("ticks must be a non-negative integer");
    for (let tick = 0; tick < ticks; tick++) {
      if (!this.input) break;
      const recipe = this.recipes[this.input.item];
      if (!this.canOutput(recipe)) break;
      this.ignite();
      if (this.burnRemaining <= 0) break;
      this.burnRemaining--;
      this.progress++;
      if (this.progress >= recipe.cookTime) {
        this.output = stack(recipe.output, (this.output?.count ?? 0) + recipe.count);
        this.input = stack(this.input.item, this.input.count - 1);
        this.progress = 0;
      }
    }
    return this.snapshot();
  }

  takeOutput(count = this.output?.count ?? 0) {
    if (!Number.isInteger(count) || count < 0 || count > (this.output?.count ?? 0)) throw new RangeError("Invalid output count");
    const taken = stack(this.output?.item, count);
    this.output = this.output ? stack(this.output.item, this.output.count - count) : null;
    return taken;
  }

  snapshot() {
    return structuredClone({ input: this.input, fuel: this.fuel, output: this.output, burnRemaining: this.burnRemaining, progress: this.progress });
  }
}

export function smeltFromInventory(inventory, inputItem, fuelItem = "coal") {
  const recipe = SMELTING_RECIPES[inputItem];
  if (!recipe) return { ok: false, reason: "not_smeltable" };
  if (inventory.count(inputItem) < 1 || inventory.count(fuelItem) < 1) {
    return { ok: false, reason: "missing_input_or_fuel" };
  }
  const snapshot = inventory.serialize();
  inventory.removeItem(inputItem, 1);
  inventory.removeItem(fuelItem, 1);
  if (inventory.add(recipe.output, recipe.count)) {
    const restored = inventory.constructor.deserialize(snapshot);
    inventory.slots = restored.slots;
    inventory.selected = restored.selected;
    return { ok: false, reason: "inventory_full" };
  }
  return { ok: true, input: inputItem, fuel: fuelItem, result: { item: recipe.output, count: recipe.count } };
}
