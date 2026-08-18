# Y.Mine Validation Hub · 决策系统验证中心

> 让 AI 决策「可审计、可熔断、可跨域迁移」—— 这里是对这句话的全部实验验证现场

## 🧪 [Live Demo → hellomind-star.github.io/ymine-validation-hub](https://hellomind-star.github.io/ymine-validation-hub/)

**建议访问动线**：`index`（个人叙事）→ `hub`（实验集群总控台）→ 任意实验页动手玩 → 文末 PDF 看学术与设计深度

---

## 这是什么

Game-OS 决策引擎的**可交互验证集群**。不是 PPT 里的架构图，是每个模块都能点开、能跑、能出数据的活体实验：

| 页面 | 验证对象 | 核心机制 |
|---|---|---|
| 🏠 **index** | 个人架构叙事 | 审计 → 工程 → MBA：一套决策操作系统的由来 |
| 🧪 **hub** | 实验集群总控台 | 五大实验模块的统一入口与状态总览 |
| 📊 **ab-test** | Y-Exp 实验评估框架 | A/B 分流 · 转化追踪 · z-test + 贝叶斯因子 · 置信区间 · 样本量规划 |
| 🧠 **ms-lab** | MindSpeak 嵌入实验室 | 四级向量仓储 · AES-256-GCM 加密 · KMP 骨架检索 · RBAC 三级权限隔离 |
| ⚙️ **entropy-model** | 熵值模型 · 状态判定引擎 | 0.5/0.68 阈值 · 正态分布 · 1/e 参考线 · 收敛/发散态切换 |
| 📈 **oscillator** | 归1振荡模拟器 | 系统归一收敛行为的可视化验证 |

**工程巧思**：全站纯静态前端，但通过 `mock-api.js` 模拟真实后端异步交互（loading / 延迟 / 错误注入 / 状态追踪），零依赖跑出完整产品体验。

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
| [poker-egg-fullstack](https://github.com/HelloMInd-star/poker-egg-fullstack) | 决策引擎 × 扑克博弈：人格化 AI 对手 + Kelly 真胜率面板（前端 + Railway 后端） |
| [personality-wine-mixing](https://github.com/HelloMInd-star/personality-wine-mixing) | 决策引擎 × 调酒消费：六维人格向量统一契约，46 个纯函数引擎，637 测试用例 |
| **ymine-validation-hub**（本仓库） | 决策引擎的实验验证与方法论沉淀 |

---

## 技术说明

纯静态站点（原生 HTML/CSS/JS），无构建步骤，GitHub Pages 直接部署。
本地预览：`python3 -m http.server 8000` 后访问 `http://localhost:8000`。

---

*罗煜 · 决策系统架构 · 全栈产品孵化*
