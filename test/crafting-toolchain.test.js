import test from "node:test";
import assert from "node:assert/strict";
import { CraftingSystem } from "../src/game/crafting/index.js";
import { createTool, inspectMining, mineBlock, TOOL_TIERS } from "../src/game/tools/index.js";
import { Furnace } from "../src/game/furnace/index.js";

const blank = (size) => Array.from({ length: size }, () => Array(size).fill(null));

test("recipe configuration validates and recipe book covers required categories", () => {
  const crafting = new CraftingSystem();
  assert.equal(crafting.validate(), true);
  const ids = new Set(crafting.recipeBook().map((recipe) => recipe.id));
  for (const required of ["crafting_table", "wood_pickaxe", "stone_pickaxe", "iron_pickaxe", "torch", "chest", "furnace", "oak_boat", "bucket", "bread", "sea_lantern"]) {
    assert.ok(ids.has(required), `missing ${required}`);
  }
  assert.ok(!new Set(crafting.recipeBook({ gridSize: 2 }).map((recipe) => recipe.id)).has("iron_pickaxe"));
});

test("2x2 recipes match at any offset and consume the exact shape", () => {
  const crafting = new CraftingSystem();
  assert.deepEqual(crafting.craft([["oak_planks", "oak_planks"], ["oak_planks", "oak_planks"]]),
    { item: "crafting_table", count: 1, recipeId: "crafting_table" });
  assert.deepEqual(crafting.craft([[null, "oak_log"], [null, null]]),
    { item: "oak_planks", count: 4, recipeId: "oak_planks" });
  assert.equal(crafting.craft([["oak_planks", "oak_planks"], ["oak_planks", null]]), null);
});

test("3x3 shaped recipes support offsets and horizontal mirror", () => {
  const crafting = new CraftingSystem();
  const axe = [[null, "oak_planks", "oak_planks"], [null, "stick", "oak_planks"], [null, "stick", null]];
  assert.equal(crafting.craft(axe).item, "wood_axe");
  const bucket = blank(3);
  bucket[0] = ["iron_ingot", null, "iron_ingot"];
  bucket[1][1] = "iron_ingot";
  assert.equal(crafting.craft(bucket).item, "bucket");
});

test("Bedrock-era utility, food, and aquatic recipes are craftable", () => {
  const crafting = new CraftingSystem();
  assert.equal(crafting.craft([["coal", null], ["stick", null]]).item, "torch");
  assert.equal(crafting.craft([
    ["oak_planks", "wood_shovel", "oak_planks"],
    ["oak_planks", "oak_planks", "oak_planks"],
    [null, null, null],
  ]).item, "oak_boat");
  assert.equal(crafting.craft([
    ["wheat", "wheat", "wheat"],
    [null, null, null],
    [null, null, null],
  ]).item, "bread");
  assert.equal(crafting.craft([
    ["prismarine_crystals", "prismarine_shard", "prismarine_crystals"],
    ["prismarine_shard", "prismarine_crystals", "prismarine_shard"],
    ["prismarine_crystals", "prismarine_shard", "prismarine_crystals"],
  ]).item, "sea_lantern");
});

test("tool tiers expose increasing speed and durability", () => {
  assert.ok(TOOL_TIERS.wood.speed < TOOL_TIERS.stone.speed);
  assert.ok(TOOL_TIERS.stone.speed < TOOL_TIERS.iron.speed);
  assert.ok(TOOL_TIERS.wood.durability < TOOL_TIERS.stone.durability);
  assert.ok(TOOL_TIERS.stone.durability < TOOL_TIERS.iron.durability);
});

test("wrong tools are slower and cannot harvest gated ores", () => {
  const woodPickaxe = createTool("wood", "pickaxe");
  const woodAxe = createTool("wood", "axe");
  assert.equal(inspectMining("iron_ore", woodPickaxe).canHarvest, false);
  assert.deepEqual(inspectMining("iron_ore", woodPickaxe).drops, []);
  assert.equal(inspectMining("stone", woodAxe).canHarvest, false);
  assert.ok(inspectMining("stone", woodAxe).breakSeconds > inspectMining("stone", woodPickaxe).breakSeconds);
});

test("mining consumes durability and reports a broken tool", () => {
  const tool = { ...createTool("wood", "pickaxe"), durability: 1 };
  const result = mineBlock("stone", tool);
  assert.equal(result.tool.durability, 0);
  assert.equal(result.toolBroke, true);
  assert.throws(() => mineBlock("stone", result.tool), /broken/);
});

test("furnace burns configured fuel and smelts stack inputs", () => {
  const furnace = new Furnace();
  furnace.setInput("iron_ore", 3);
  furnace.setFuel("coal", 1);
  furnace.tick(30);
  assert.deepEqual(furnace.snapshot().output, { item: "iron_ingot", count: 3 });
  assert.deepEqual(furnace.takeOutput(2), { item: "iron_ingot", count: 2 });
  assert.deepEqual(furnace.snapshot().output, { item: "iron_ingot", count: 1 });
});

test("complete wood-to-stone-to-iron progression is executable", () => {
  const crafting = new CraftingSystem();
  const woodPickaxeGrid = [["oak_planks", "oak_planks", "oak_planks"], [null, "stick", null], [null, "stick", null]];
  assert.equal(crafting.craft(woodPickaxeGrid).item, "wood_pickaxe");
  const woodMining = mineBlock("stone", createTool("wood", "pickaxe"));
  assert.deepEqual(woodMining.drops, ["cobblestone"]);

  const stonePickaxeGrid = [["cobblestone", "cobblestone", "cobblestone"], [null, "stick", null], [null, "stick", null]];
  assert.equal(crafting.craft(stonePickaxeGrid).item, "stone_pickaxe");
  const stoneMining = mineBlock("iron_ore", createTool("stone", "pickaxe"));
  assert.deepEqual(stoneMining.drops, ["iron_ore"]);

  const furnace = new Furnace();
  furnace.setInput(stoneMining.drops[0], 3);
  furnace.setFuel("coal");
  assert.equal(furnace.tick(30).output.count, 3);
  const ironPickaxeGrid = [["iron_ingot", "iron_ingot", "iron_ingot"], [null, "stick", null], [null, "stick", null]];
  assert.equal(crafting.craft(ironPickaxeGrid).item, "iron_pickaxe");
  assert.deepEqual(mineBlock("diamond_ore", createTool("iron", "pickaxe")).drops, ["diamond"]);
});
