# M2 Crafting and Toolchain

Zero-dependency game-domain modules for configurable crafting, tool progression, mining drops, durability, and furnace smelting.

- `src/game/crafting`: 2x2/3x3 shaped and shapeless matching, mirrored patterns, recipe-book filters, item/recipe registries.
- `src/game/tools`: wood/stone/iron tiers, mining speed/durability, required-tool and ore-drop rules.
- `src/game/furnace`: configurable recipes/fuels and deterministic tick simulation.

Run `npm test`. The end-to-end test proves the wood pickaxe → cobblestone → stone pickaxe → iron ore → furnace → iron pickaxe → diamond progression.
