const label = (id) => id.replaceAll("_", " ");

export class CraftingPanel {
  constructor({ crafting, inventory, onCraft, onSmelt }) {
    this.crafting = crafting;
    this.inventory = inventory;
    this.onCraft = onCraft;
    this.onSmelt = onSmelt;
    this.gridSize = 2;
    this.mode = "crafting";
    this.opened = false;

    this.el = document.createElement("section");
    this.el.className = "crafting-panel hidden";
    this.el.innerHTML = `
      <header><strong>合成与熔炼</strong><span>C 关闭</span></header>
      <nav>
        <button data-mode="crafting" class="active">合成台</button>
        <button data-mode="furnace">熔炉</button>
        <button data-grid="2" class="active">2×2</button>
        <button data-grid="3">3×3</button>
      </nav>
      <div class="crafting-content">
        <div><div class="crafting-grid"></div><div class="crafting-output">选择右侧配方</div></div>
        <div class="recipe-book"><div class="recipe-heading">配方册</div><div class="recipe-list"></div></div>
      </div>`;
    document.body.appendChild(this.el);
    this.grid = this.el.querySelector(".crafting-grid");
    this.output = this.el.querySelector(".crafting-output");
    this.list = this.el.querySelector(".recipe-list");
    this.el.addEventListener("click", (event) => this.handleClick(event));
    this.render();
  }

  setOpen(open) {
    this.opened = open;
    this.el.classList.toggle("hidden", !open);
    if (open) this.render();
  }

  handleClick(event) {
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      this.mode = modeButton.dataset.mode;
      this.render();
      return;
    }
    const gridButton = event.target.closest("[data-grid]");
    if (gridButton) {
      this.gridSize = Number(gridButton.dataset.grid);
      this.mode = "crafting";
      this.render();
      return;
    }
    const recipeButton = event.target.closest("[data-recipe]");
    if (recipeButton) {
      const result = this.onCraft(recipeButton.dataset.recipe, this.gridSize);
      this.renderList();
      this.output.textContent = result.ok ? `获得 ${label(result.result.item)} ×${result.result.count}` : `无法合成：${result.reason}`;
      return;
    }
    const smeltButton = event.target.closest("[data-smelt]");
    if (smeltButton) {
      const result = this.onSmelt(smeltButton.dataset.smelt);
      this.renderList();
      this.output.textContent = result.ok ? `熔炼完成：${label(result.result.item)}` : `无法熔炼：${result.reason}`;
    }
  }

  render() {
    this.el.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === this.mode));
    this.el.querySelectorAll("[data-grid]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.grid) === this.gridSize);
      button.disabled = this.mode === "furnace";
    });
    this.grid.style.setProperty("--craft-grid", this.mode === "furnace" ? 3 : this.gridSize);
    this.grid.innerHTML = "";
    const cells = this.mode === "furnace" ? ["输入", "🔥 燃料", "→ 输出"] : Array(this.gridSize ** 2).fill("");
    cells.forEach((text) => {
      const cell = document.createElement("div");
      cell.textContent = text;
      this.grid.appendChild(cell);
    });
    this.output.textContent = this.mode === "furnace" ? "每次消耗 1 个煤" : `${this.gridSize}×${this.gridSize} 配方模式`;
    this.renderList();
  }

  renderList() {
    this.list.innerHTML = "";
    if (this.mode === "furnace") {
      for (const [input, output] of [["iron_ore", "iron_ingot"], ["sand", "glass"], ["raw_cod", "cooked_cod"]]) {
        const enabled = this.inventory.count(input) > 0 && this.inventory.count("coal") > 0;
        const button = document.createElement("button");
        button.dataset.smelt = input;
        button.disabled = !enabled;
        button.innerHTML = `<b>${label(input)} + coal</b><span>→ ${label(output)}</span>`;
        this.list.appendChild(button);
      }
      return;
    }
    for (const recipe of this.crafting.recipeBook({ gridSize: this.gridSize })) {
      const ingredients = this.crafting.ingredientsFor(recipe);
      const enabled = ingredients.every(({ itemId, count }) => this.inventory.count(itemId) >= count);
      const button = document.createElement("button");
      button.dataset.recipe = recipe.id;
      button.disabled = !enabled;
      button.innerHTML = `<b>${label(recipe.result.item)} ×${recipe.result.count}</b><span>${ingredients.map(({ itemId, count }) => `${label(itemId)}×${count}`).join(" · ")}</span>`;
      this.list.appendChild(button);
    }
  }
}
