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
demo/         R3 交互演示与可复现验证
test/         自动化测试
```

## 快速开始

```bash
npm install        # 当前模块为纯 JS，无需外部依赖即可测试
npm test           # 运行自动化测试（Node 内置 test runner）
npm run verify     # R3 可复现操作验证（逐项输出 PASS/FAIL）
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

## 说明

- 本分支为 worker test7-4 的 R3 交付（Issue MUL-36）。R1/R2/R4+ 由其他成员在各自分支实现，由集成 Issue（MUL-43）统一合并、部署、CI 与 20 条标准证据报告。
- 许可证：见 `LICENSE`（MIT）。素材与纹理遵循原创/授权兼容要求。
