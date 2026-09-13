export const TOOL_TIERS = Object.freeze({
  wood: Object.freeze({ level: 1, speed: 2, durability: 59 }),
  stone: Object.freeze({ level: 2, speed: 4, durability: 131 }),
  iron: Object.freeze({ level: 3, speed: 6, durability: 250 }),
});

export const TOOL_KINDS = Object.freeze(["pickaxe", "axe", "shovel", "sword"]);

export const BLOCK_RULES = Object.freeze({
  stone: Object.freeze({ hardness: 1.5, preferredTool: "pickaxe", minTier: 1, drop: "cobblestone" }),
  coal_ore: Object.freeze({ hardness: 3, preferredTool: "pickaxe", minTier: 1, drop: "coal" }),
  iron_ore: Object.freeze({ hardness: 3, preferredTool: "pickaxe", minTier: 2, drop: "iron_ore" }),
  diamond_ore: Object.freeze({ hardness: 3, preferredTool: "pickaxe", minTier: 3, drop: "diamond" }),
  obsidian: Object.freeze({ hardness: 50, preferredTool: "pickaxe", minTier: 4, drop: "obsidian" }),
  oak_log: Object.freeze({ hardness: 2, preferredTool: "axe", minTier: 0, drop: "oak_log" }),
  dirt: Object.freeze({ hardness: 0.5, preferredTool: "shovel", minTier: 0, drop: "dirt" }),
});
