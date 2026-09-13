# R2 世界生成与分块 (World Generation & Chunking)

Issue: MUL-35 — 可复现 seed 世界生成与分块加载/卸载；至少含平原/森林/沙漠/山地及
冷/暖/深浅海洋，同 seed 关键地形一致。对应完成标准 **03**。

## 范围 (Scope)

本模块提供**确定性、可复现种子**的程序化地形生成与分块管理，仅依赖整数世界坐标与
seed，与渲染/交互解耦。这是多 Agent 消融实验中 worker `test7-3` 的交付模块。

核心技术契约：
- 一切地形值是 `(x, z, seed)` 的纯函数；任意顺序、任意时刻重建同一分块都得到完全一致
  的方块数据。
- 分块（chunk）为 16×16 列 × WORLD_HEIGHT(64) 高，内部以 Uint8 紧凑存储。
- 支持分块按预算加载/卸载（`maxLoadedChunks`），可对卸载快照做持久化。

## 文件

```
src/world/
  random.js    确定性 PRNG（mulberry32）、梯度/值噪声、fBm（纯函数）
  biomes.js    生物群系枚举与命名（plain/forest/desert/mountains + 冷/暖/深浅海洋）
  blocks.js    原创方块 id 注册表（AIR/STONE/DIRT/GRASS/SAND/WATER/LOG/LEAVES/BEDROCK...）
  generator.js 气候字段、landHeight、classifyBiome、generateColumn（核心确定性逻辑）
  chunk.js     Chunk 数据结构（Uint8 方块存储、biome/高度图）
  world.js     WorldChunkManager：chunk 加载/卸载、预算、世界坐标方块访问、确定性装饰（树）
  index.js     统一导出
test/
  world.test.js 固定 seed 一致性等 9 项自动化测试
```

## 关键 API

```js
import { WorldChunkManager, classifyBiome, landHeight, generateColumn } from './src/world/index.js';

const world = new WorldChunkManager(20260913);            // seed
const chunk = world.loadChunk(0, 0);                       // 加载分块
const block = world.getBlock(3, 40, 5);                    // 世界坐标取块
const biome = world.getBiomeAt(3, 5);                      // 世界坐标生物群系
const surfaceY = world.getSurfaceY(3, 5);                  // 地表高度
world.unload(0, 0);                                        // 卸载（返回快照）
```

## 已覆盖：完成标准 03 子项

- 可复现 seed：同 seed 两实例指纹一致；不同 seed 不一致；生成顺序无关 —— 均有测试。
- 生物群系：平原/森林/沙漠/山地 + 冷/暖/深浅海洋均可复现出现（自动化断言）。
- 分块加载/卸载：预算约束、卸载快照、卸载后重载方块完全一致 —— 有测试。
- 固定 seed 地形一致性自动化验证：`test/world.test.js` 通过（9/9）。

## 自动化测试

```bash
npm test        # 或 node --test test/**/*.test.js
```

## 已知限制 / 待交接

- 本分支为模块级交付，未包含浏览器渲染主循环 / 部署；由群管集成 Issue 合并与发布。
- 方块 id 集后续由 M1（交互/背包）扩展硬度/工具/堆叠语义，`blocks.js` 保持为唯一注册表。
- 树/装饰为确定性生成，但分块边缘装饰跨 chunk 时以本 chunk 数据为准（本版本仅原位装饰，
  跨块叶子可能被相邻块覆盖；如需完美跨块树，需在渲染层做相邻块合并，见集成 Issue）。
