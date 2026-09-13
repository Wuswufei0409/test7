# M2 Crafting and Toolchain

Configurable crafting, tool progression, mining drops, durability, and furnace smelting, integrated into the live browser game.

- `src/game/crafting`: 2x2/3x3 shaped and shapeless matching, mirrored patterns, recipe-book filters, item/recipe registries.
- `src/game/tools`: wood/stone/iron tiers, mining speed/durability, required-tool and ore-drop rules.
- `src/game/furnace`: configurable recipes/fuels and deterministic tick simulation.
- Press `C` in the browser to open the recipe book. Switch between 2x2, 3x3 and furnace views; enabled recipes consume the real saved inventory and place their result back into it.
- The live mining action uses the selected wood/stone/iron tool for harvest restrictions and speed, consumes durability, and applies configured ore drops.

Run `npm test` for logic and integration tests. Run `npm run evidence-m2` for the Chromium flow that crafts a table and wooden/stone/iron pickaxes through the visible UI, smelts iron, reloads the save, and checks for browser errors. Screenshots and the JSON report are written to `evidence/`.
