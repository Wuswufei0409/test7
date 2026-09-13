const shaped = (id, pattern, key, result, category) => {
  const parsed = pattern.map((row) => [...row].map((symbol) => symbol === " " ? null : key[symbol]));
  const occupied = parsed.flatMap((row, y) => row.flatMap((value, x) => value ? [[x, y]] : []));
  const xs = occupied.map(([x]) => x), ys = occupied.map(([, y]) => y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const trimmed = parsed.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
  return Object.freeze({
    id, type: "shaped", width: trimmed[0].length, height: trimmed.length,
    pattern: trimmed, result: Object.freeze(result), category,
  });
};
const shapeless = (id, ingredients, result, category) => Object.freeze({
  id, type: "shapeless", ingredients: Object.freeze([...ingredients]),
  result: Object.freeze(result), category,
});

const toolRecipes = [];
for (const [tier, material] of [["wood", "oak_planks"], ["stone", "cobblestone"], ["iron", "iron_ingot"]]) {
  toolRecipes.push(
    shaped(`${tier}_pickaxe`, ["MMM", " S ", " S "], { M: material, S: "stick" }, { item: `${tier}_pickaxe`, count: 1 }, "tools"),
    shaped(`${tier}_axe`, ["MM ", "MS ", " S "], { M: material, S: "stick" }, { item: `${tier}_axe`, count: 1 }, "tools"),
    shaped(`${tier}_shovel`, [" M ", " S ", " S "], { M: material, S: "stick" }, { item: `${tier}_shovel`, count: 1 }, "tools"),
    shaped(`${tier}_sword`, [" M ", " M ", " S "], { M: material, S: "stick" }, { item: `${tier}_sword`, count: 1 }, "combat"),
  );
}

/** All recipes are configuration objects; the matcher contains no item-specific branches. */
export const RECIPES = Object.freeze([
  shapeless("oak_planks", ["oak_log"], { item: "oak_planks", count: 4 }, "building"),
  shaped("sticks", ["P", "P"], { P: "oak_planks" }, { item: "stick", count: 4 }, "materials"),
  shaped("crafting_table", ["PP", "PP"], { P: "oak_planks" }, { item: "crafting_table", count: 1 }, "stations"),
  ...toolRecipes,
  shaped("torch", ["C", "S"], { C: "coal", S: "stick" }, { item: "torch", count: 4 }, "utility"),
  shaped("chest", ["PPP", "P P", "PPP"], { P: "oak_planks" }, { item: "chest", count: 1 }, "storage"),
  shaped("furnace", ["CCC", "C C", "CCC"], { C: "cobblestone" }, { item: "furnace", count: 1 }, "stations"),
  // Bedrock 1.4-era boat recipe includes a wooden shovel.
  shaped("oak_boat", ["PAP", "PPP"], { P: "oak_planks", A: "wood_shovel" }, { item: "oak_boat", count: 1 }, "transport"),
  shaped("bucket", ["I I", " I "], { I: "iron_ingot" }, { item: "bucket", count: 1 }, "utility"),
  shaped("bread", ["WWW"], { W: "wheat" }, { item: "bread", count: 1 }, "food"),
  shaped("sea_lantern", ["CSC", "SCS", "CSC"], { C: "prismarine_crystals", S: "prismarine_shard" }, { item: "sea_lantern", count: 1 }, "aquatic"),
]);
