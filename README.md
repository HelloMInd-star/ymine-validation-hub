# Y.Mine Validation Hub · 决策系统验证中心

> 让 AI 决策「可审计、可熔断、可跨域迁移」—— 这里是对这句话的全部实验验证现场

## 🧪 [Live Demo → hellomind-star.github.io/ymine-validation-hub](https://hellomind-star.github.io/ymine-validation-hub/)

**建议访问动线**：[`Profile`](https://github.com/HelloMInd-star/Profile)（个人叙事）→ `index`（实验集群总控台）→ 任意实验页动手玩 → 文末 PDF 看学术与设计深度

> 📌 **结构说明**：`index.html` 现为「Y.Mine · 实验集群总控台」着陆页；`hub.html` 保留同内容以兼容旧书签。个人叙事主页已抽离至独立仓库 [Profile](https://github.com/HelloMInd-star/Profile)（Pages：[hellomind-star.github.io/Profile](https://hellomind-star.github.io/Profile/) 已上线）。

---

## 这是什么

Game-OS 决策引擎的**可交互验证集群**。不是 PPT 里的架构图，是每个模块都能点开、能跑、能出数据的活体实验：

| 页面 | 验证对象 | 核心机制 |
|---|---|---|
| 🏠 **index** | 实验集群总控台（着陆页） | 五大实验模块的统一入口与状态总览 |
| 🧪 **hub** | 总控台（旧书签兼容） | 与 index 同内容，保留兼容旧链接；页内「返回首页」指向 Profile |
| 📊 **ab-test** | Y-Exp 实验评估框架 | 确定性哈希分流 · 转化追踪 · z-test + 贝叶斯因子 BF₁₀ · 95% 置信区间 · 样本量规划 · 预期收益估算 |
| 🧠 **ms-lab** | MindSpeak 嵌入实验室 | 四级向量仓储 · AES-256-GCM 加密 · KMP 骨架检索 · RBAC 三级权限隔离 |
| ⚙️ **entropy-model** | 熵值模型 · 状态判定引擎 | 0.5/0.68 阈值 · 正态分布 · 1/e 参考线 · 收敛/发散态切换 |
| 📈 **oscillator** | 归1振荡模拟器 | 系统归一收敛行为的可视化验证 |

**工程巧思**：全站纯静态前端，但通过 `mock-api.js` 模拟真实后端异步交互（loading / 延迟 / 错误注入 / 状态追踪），零依赖跑出完整产品体验。

---

## 旗舰实验：Y-Exp · 实验评估框架

`ab-test.html`（926 行）是一套可在浏览器里完整跑通的 A/B 实验评估流水线：

- **分流**：确定性哈希分流，同一访客始终落入同一组，结果可复现
- **转化追踪**：支持模拟点击与批量注入，实时累积各组转化数据
- **统计判定**：z-test + 贝叶斯因子 BF₁₀ 双轨判读，95% 置信区间
- **实验设计**：最小样本量估算（α=0.05, β=0.20 双侧）与预期收益估算，开跑前先算清代价
- **数据层**：`localStorage`（`yexp_data`）本地持久化 + MockAPI 模拟后端
- **默认实验**：内置「检索策略对比 v1.2」，打开页面即可动手跑完整流程

页面同时挂载本仓库两份深度 PDF（见下节），实验数据与学术/设计资产同场呈现。

---

## 核心数据

- 幻觉率从行业平均 **15% 压至 0.5%**（七层熔断 + 三模型冗余校验 + 11 条底层公理）
- **148** 项单元测试 100% 通过
- **41** 个跨域实验 · **25,424** 次实验运行
- 同一份引擎已迁移至 **扑克博弈**（Poker Egg）与 **调酒消费**（Y.Mine）两个极端场景

---

## 深度资产

- 📄 **[Fibonacci-Chromosome Isomorphism](./Fibonacci-Chromosome_Isomorphism.pdf)** —— 斐波那契数列与染色体结构的同构映射研究（黄金比例 φ、黄金角 137.5°、基因表达/端粒/带型同构），Game-OS 跨域同构方法论的学术底座
- 🎨 **[Midnight Tavern · UI Portfolio](./Midnight-Tavern-Portfolio.pdf)** —— MIDNIGHT TAVERN 全产品 UI 设计集（18 页 / 14 章）：世界观叙事、设计语言、游戏大厅、MBTI 调酒台、牌桌对决、人格护照、数据观测台等完整界面体系

---

## 关联仓库

| 仓库 | 定位 |
|---|---|
| [Profile](https://github.com/HelloMInd-star/Profile) | 个人叙事主页：审计 → 工程 → MBA，一套决策操作系统的由来（独立 Pages 部署） |
| [poker-egg-fullstack](https://github.com/HelloMInd-star/poker-egg-fullstack) | 决策引擎 × 扑克博弈：人格化 AI 对手 + Kelly 真胜率面板（前端 + Railway 后端） |
| [personality-wine-mixing](https://github.com/HelloMInd-star/personality-wine-mixing) | 决策引擎 × 调酒消费：六维人格向量统一契约，46 个纯函数引擎，637 测试用例 |
| **ymine-validation-hub**（本仓库） | 决策引擎的实验验证与方法论沉淀 |

---

## Y.Mine 生态矩阵

同一套决策方法论驱动的在线站点集群（均 GitHub Pages 部署）：

| 站点 | 入口 |
|---|---|
| Y.Mine 主站 | [hellomind-star.github.io/ymine](https://hellomind-star.github.io/ymine/) |
| Dimension-Chess | [hellomind-star.github.io/Dimension-Chess](https://hellomind-star.github.io/Dimension-Chess/) |
| Dimemsion-Chess-Latent | [hellomind-star.github.io/Dimemsion-Chess-Latent](https://hellomind-star.github.io/Dimemsion-Chess-Latent/) |
| short-drama-mbti | [hellomind-star.github.io/short-drama-mbti](https://hellomind-star.github.io/short-drama-mbti/) |
| agent-studio-board | [hellomind-star.github.io/agent-studio-board](https://hellomind-star.github.io/agent-studio-board/) |
| ymine-demos | [hellomind-star.github.io/ymine-demos](https://hellomind-star.github.io/ymine-demos/) |

---

## 技术说明

纯静态站点（原生 HTML/CSS/JS），无构建步骤，GitHub Pages 直接部署。
本地预览：`python3 -m http.server 8000` 后访问 `http://localhost:8000`。

---

*罗煜 · 决策系统架构 · 全栈产品孵化*
