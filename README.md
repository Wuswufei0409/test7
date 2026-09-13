# 网页端 Minecraft Bedrock 1.4.2 高还原度复刻（多 Agent）

多 Agent 消融实验：用 Web 技术（Three.js / Babylon.js 等渲染库，禁用 Unity/Unreal/Godot 等游戏引擎）在浏览器中实现一个无需安装、点开公开链接即可游玩的第一人称 3D 体素沙盒生存游戏，尽量还原 Minecraft Bedrock Edition 1.4.2（Update Aquatic 第一阶段）。

- 目标仓库：<https://github.com/Wuswufei0409/test7.git>
- 协作真相源：共享 Issue / Goal / 代码 / 测试 / 证据。
- **禁止**：从 Minecraft 安装包或商业素材包复制代码/纹理/模型/音频/商标；所有素材为原创或授权兼容的像素素材。

## 目录结构

各功能模块以独立子模块交付，由集成 Issue 合并为可运行主干：

```
src/game/
  world/      World 契约 + 体素存储（R2/R3 共用）
  player/     R3 玩家控制：物理 + 输入控制器
  water/      M4 水体核心：氧气/溺水/能见度/掉落物上浮/水下放置
  （R4+ 各模块由对应成员维护，集成于主干）
demo/         R3/M4 交互演示与可复现验证
test/         自动化测试
```

## 快速开始

```bash
npm install        # 当前模块为纯 JS，无需外部依赖即可测试
npm test           # 运行自动化测试（Node 内置 test runner）
npm run verify     # R3 可复现操作验证（逐项输出 PASS/FAIL）
npm run verify-water # M4 水体核心可复现操作验证
npm run demo       # 打开 http://localhost:4174 交互演示（需浏览器）
```

## R3 — 玩家控制（完成标准 04）

模块位置：`src/game/player/`，自动化测试 `test/player-controls.test.js`。

覆盖能力：
- 鼠标视角锁定（Pointer Lock）与俯仰/偏航，俯仰限位防翻转；
- WASD 相对视角方向移动、疾跑（Shift）、下蹲（Ctrl，降低身高并减速）；
- 跳跃、重力、落地判定；
- AABB 体素碰撞（按轴分离 + 分步推进，防止高速穿墙），不能穿过实体方块；
- 半格台阶/楼梯自动跨越（`maxStepHeight` 内免跳），完整方块需跳跃；
- 游泳/水中上浮与阻力（为 M4 水下玩法留接口）。

可复现证据：
```bash
node --test test/player-controls.test.js   # 13 项断言
node demo/verify.js                         # 9 项操作验证
```

## M4 — 水体核心（完成标准 14）

模块位置：`src/game/water/`，自动化测试 `test/water-core.test.js`。

覆盖能力：
- 氧气条：头部浸水时 air 递减（默认 15s），出水面/气穴回满；
- 溺水：air 归零后按速率造成伤害（`takeDamage` 由 M3 血条接入）；
- 水下能见度：随深度缩减的雾效可见距离（供 R1 渲染消费）；
- 疾跑游泳：冲刺时水中速度更快；游泳姿势 hitbox 0.6，可潜入 1×1 水道（潜水入门，见下）；
- 1×1 水道通过：潜水姿态可通过单格宽/单格高的水下通道；
- 掉落物上浮：水中掉落物浮至水面并停稳；
- 水下放置无错误空气洞：放置实心方块只替换该格，邻格水保留，`findErroneousAirHoles` 校验无错误空气洞。

可复现证据：
```bash
node --test test/water-core.test.js   # 7 项断言
node demo/verify-water.js              # 6 项操作验证
```

## 说明

- 本分支（`agent/5a412bfb/issue-40`）为 worker test7-4 的 M4 交付（Issue MUL-40），基于 R3 交付（PR #1）之上。R1/R2 由其他成员在各自分支实现，由集成 Issue（MUL-43）统一合并、部署、CI 与 20 条标准证据报告。
- 许可证：见 `LICENSE`（MIT）。素材与纹理遵循原创/授权兼容要求。

## M5 — 海洋世界与水生生物（完成标准 15+16）

模块位置：`src/game/ocean/`，自动化测试 `test/ocean.test.js`（14 项断言），
可复现操作验证 `demo/verify-ocean.js`（5 项 PASS）。

覆盖能力：
- 海洋生成（`OceanFeatures.js`）：
  - 珊瑚礁（`addCoralReef`）、海带/海草（`addKelpForest` / `addSeagrassField`）、
    冰山（`addIceberg`）、沉船（`addShipwreck`）、水下遗迹（`addUnderwaterRuins`）、
    埋藏宝藏（`addBuriedTreasure`）；同 seed 确定性生成（`buildOcean`）。
- 藏宝图 / 线索（`Treasure.js`）：`createTreasureMap` 依据方位角+距离生成多步线索，
  `followClue`/`furthestClueReached` 引导玩家，`digTreasure` 挖开覆盖沙暴露宝箱并
  一次性发放奖励（心之海洋之心等），二次挖掘无效。
- 水生生物（`AquaticLife.js`）：海豚（`Dolphin`，基础游动 + 接近玩家时友好跟随）、
  鳕鱼/鲑鱼/热带鱼/河豚（`Fish`，在水中游动且不进入实体）；河豚在玩家接近时鼓气
  （`puffed` + 膨胀动画量），接触时按秒造成伤害（接入 `takeDamage`）。
- 桶捕放（`FishBucket.js`）：`catchFishIntoBucket` 捕获四种鱼入桶、`releaseFishFromBucket`
  释放回水中（仅限水域格子）；海豚为哺乳动物不可入桶。

可复现证据：
```bash
node --test test/ocean.test.js   # 14 项断言
node demo/verify-ocean.js        # 5 项操作验证
npm test                         # 全量 34 项（R3 13 + M4 7 + M5 14）
```

依赖：基于 R2 世界生成与 M4 水体核心之上，`buildOcean` 复用 `VoxelWorld` 稀疏区块契约；
水生生物游动/河豚伤害通过各子模块纯函数消费，未耦合浏览器渲染。
