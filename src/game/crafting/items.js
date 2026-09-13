const item = (id, name, stackSize = 64, extra = {}) =>
  Object.freeze({ id, name, stackSize, ...extra });

/** Shared, data-only item registry. Rendering and inventory code can consume it directly. */
const registry = {
  oak_log: item("oak_log", "Oak Log"),
  oak_planks: item("oak_planks", "Oak Planks"),
  stick: item("stick", "Stick"),
  cobblestone: item("cobblestone", "Cobblestone"),
  coal: item("coal", "Coal"),
  iron_ore: item("iron_ore", "Iron Ore"),
  iron_ingot: item("iron_ingot", "Iron Ingot"),
  diamond: item("diamond", "Diamond"),
  sand: item("sand", "Sand"),
  glass: item("glass", "Glass"),
  wheat: item("wheat", "Wheat"),
  bread: item("bread", "Bread", 64, { food: 5 }),
  raw_cod: item("raw_cod", "Raw Cod"),
  cooked_cod: item("cooked_cod", "Cooked Cod", 64, { food: 5 }),
  prismarine_shard: item("prismarine_shard", "Prismarine Shard"),
  prismarine_crystals: item("prismarine_crystals", "Prismarine Crystals"),
  sea_lantern: item("sea_lantern", "Sea Lantern"),
  crafting_table: item("crafting_table", "Crafting Table"),
  torch: item("torch", "Torch"),
  chest: item("chest", "Chest"),
  furnace: item("furnace", "Furnace"),
  oak_boat: item("oak_boat", "Oak Boat", 1),
  bucket: item("bucket", "Bucket", 16),
};

for (const [tier, label] of [["wood", "Wooden"], ["stone", "Stone"], ["iron", "Iron"]]) {
  for (const [kind, name] of [["pickaxe", "Pickaxe"], ["axe", "Axe"], ["shovel", "Shovel"], ["sword", "Sword"]]) {
    registry[`${tier}_${kind}`] = item(`${tier}_${kind}`, `${label} ${name}`, 1, { tool: true });
  }
}

export const ITEMS = Object.freeze(registry);

export function assertKnownItem(id) {
  if (!ITEMS[id]) throw new RangeError(`Unknown item: ${id}`);
  return id;
}
