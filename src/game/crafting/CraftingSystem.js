import { assertKnownItem } from "./items.js";
import { RECIPES } from "./recipes.js";

const cellItem = (cell) => cell == null ? null : typeof cell === "string" ? cell : cell.item;

function normalizeGrid(grid, size) {
  if (![2, 3].includes(size)) throw new RangeError("Crafting grids must be 2x2 or 3x3");
  if (!Array.isArray(grid) || grid.length !== size || grid.some((row) => !Array.isArray(row) || row.length !== size)) {
    throw new TypeError(`Expected a ${size}x${size} grid`);
  }
  return grid.map((row) => row.map(cellItem));
}

function bounds(grid) {
  const occupied = [];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid.length; x++) {
    if (grid[y][x]) occupied.push([x, y]);
  }
  if (!occupied.length) return null;
  const xs = occupied.map(([x]) => x), ys = occupied.map(([, y]) => y);
  const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
  return grid.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
}

function shapedMatches(recipe, grid) {
  const candidate = bounds(grid);
  if (!candidate || candidate.length !== recipe.height || candidate[0].length !== recipe.width) return false;
  const exact = candidate.every((row, y) => row.every((value, x) => value === recipe.pattern[y][x]));
  const mirrored = candidate.every((row, y) => row.every((value, x) => value === recipe.pattern[y][recipe.width - x - 1]));
  return exact || mirrored;
}

function shapelessMatches(recipe, grid) {
  const actual = grid.flat().filter(Boolean).sort();
  return actual.length === recipe.ingredients.length &&
    actual.every((value, index) => value === [...recipe.ingredients].sort()[index]);
}

export class CraftingSystem {
  constructor(recipes = RECIPES) {
    this.recipes = [...recipes];
  }

  findRecipe(grid, size = grid?.length) {
    const normalized = normalizeGrid(grid, size);
    return this.recipes.find((recipe) => recipe.type === "shaped"
      ? recipe.width <= size && recipe.height <= size && shapedMatches(recipe, normalized)
      : recipe.ingredients.length <= size * size && shapelessMatches(recipe, normalized)) ?? null;
  }

  craft(grid, size = grid?.length) {
    const recipe = this.findRecipe(grid, size);
    return recipe ? { ...recipe.result, recipeId: recipe.id } : null;
  }

  recipeBook({ gridSize = 3, category = null, unlocked = null } = {}) {
    if (![2, 3].includes(gridSize)) throw new RangeError("Recipe book gridSize must be 2 or 3");
    const unlockedSet = unlocked ? new Set(unlocked) : null;
    return this.recipes.filter((recipe) => recipe.type === "shaped"
      ? recipe.width <= gridSize && recipe.height <= gridSize
      : recipe.ingredients.length <= gridSize * gridSize)
      .filter((recipe) => !category || recipe.category === category)
      .filter((recipe) => !unlockedSet || unlockedSet.has(recipe.id))
      .map((recipe) => ({ ...recipe, result: { ...recipe.result } }));
  }

  validate() {
    const ids = new Set();
    for (const recipe of this.recipes) {
      if (ids.has(recipe.id)) throw new Error(`Duplicate recipe id: ${recipe.id}`);
      ids.add(recipe.id);
      assertKnownItem(recipe.result.item);
      const ingredients = recipe.type === "shaped" ? recipe.pattern.flat().filter(Boolean) : recipe.ingredients;
      ingredients.forEach(assertKnownItem);
    }
    return true;
  }
}
