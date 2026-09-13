/** Config-driven block/item catalogue shared by interaction and inventory. */

const definitions = [
  ['stone', 1.5], ['dirt', 0.5], ['grass', 0.6], ['sand', 0.5],
  ['sandstone', 0.8], ['gravel', 0.6], ['oak_log', 2], ['oak_planks', 2],
  ['oak_leaves', 0.2], ['cobblestone', 2], ['bricks', 2], ['snow', 0.3],
  ['glass', 0.3], ['coal_ore', 3], ['iron_ore', 3], ['gold_ore', 3],
  ['diamond_ore', 3], ['clay', 0.6], ['white_wool', 0.8], ['red_wool', 0.8],
  ['bookshelf', 1.5], ['crafting_table', 2.5], ['furnace', 3.5], ['chest', 2.5],
  ['torch', 0.1], ['ladder', 0.4], ['cactus', 0.4], ['obsidian', 8],
  ['ice', 0.5], ['coral_block', 1.5], ['prismarine', 2], ['sea_lantern', 0.8],
];

export const AIR = 'air';

export const BLOCKS = Object.freeze(Object.fromEntries(definitions.map(([id, hardness]) => [
  id,
  Object.freeze({ id, itemId: id, drop: id, hardness, maxStack: 64, placeable: true, solid: true }),
])));

export const BLOCK_IDS = Object.freeze(Object.keys(BLOCKS));

export function getBlockDefinition(id) {
  if (id === AIR) return { id: AIR, hardness: 0, placeable: false, solid: false, replaceable: true };
  return BLOCKS[id] ?? null;
}

export function requireBlockDefinition(id) {
  const definition = getBlockDefinition(id);
  if (!definition) throw new Error(`Unknown block: ${id}`);
  return definition;
}

