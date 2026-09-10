<div align="center">

# 🧪 Y.Mine Validation Hub

### Interactive verification suite for decision systems — auditable, interruptible, cross-domain

[![EN](https://img.shields.io/badge/English-README--EN-blue?style=for-the-badge)](README-EN.md)
[![CN](https://img.shields.io/badge/中文-README-brightgreen?style=for-the-badge)](README.md)

[![Live Demo](https://img.shields.io/badge/Live_Demo-Validation_Hub-8a5a3b?style=for-the-badge)](https://hellomind-star.github.io/ymine-validation-hub)
[![License](https://img.shields.io/badge/License-MIT-b7a692?style=for-the-badge)](LICENSE)

**Suggested tour:** Profile → index → any experiment → PDFs for academic depth

</div>

---

## ✨ What is this?

An interactive verification suite for AI decision systems. Not architecture diagrams in a slide deck — every module **runs, produces data, and can be audited**.

The five experiments are not a flat list. They form **four stages of a decision lifecycle**. Each page is independently shareable by URL, yet they all feed the same evidence chain.

| Stage | Page | What it verifies |
| :--- | :--- | :--- |
| — | 🏠 **index** | Control panel + **full-site evidence chain** |
| — | 🧪 **hub** | Legacy bookmark → redirects to index |
| 👁 **Perceive** | ⚙️ **entropy-model** | State judgment: 0.5 / 0.68 thresholds, convergence vs divergence |
| 🧪 **Experiment** | 📊 **ab-test** | Two-proportion z-test, Bayesian P(B>A), sample-size planning |
| 📈 **Converge** | 📈 **oscillator** | Whether systems normalize into a target band, cross-domain |
| 🧠 **Memory** | 🧠 **ms-lab** | Vector storage, AES-256-GCM, KMP retrieval, RBAC |
| 🧠 **Memory** | 🧠 **MemoryBase** | Raw memory → structured knowledge pipeline |

> Engineering note: a fully static front end. `mock-api.js` simulates real backend async behaviour (loading, latency, error injection, state tracking) with zero dependencies.

---

## 📊 Flagship experiment: A/B test evaluation

| Capability | Detail |
| :--- | :--- |
| Deterministic hash assignment | A user ID always lands in the same group |
| Sample-size planning | Given baseline rate + MDE, outputs required n per variant |
| Frequentist test | Two-proportion z-test (pooled), p-value, 95% CI, achieved power |
| Bayesian test | Beta-Binomial P(B>A), expected loss, credible interval |
| Evidence chain | Every action logged, filterable by stage, exportable as CSV |

**Read two numbers before deciding:**

- **p < 0.05** — the difference is unlikely to be random noise
- **P(B>A) > 95% and expected loss < 0.0005** — picking B carries acceptable risk

---

## 📂 Structure

```
ymine-validation-hub/
├── index.html              Control panel (evidence chain + charts)
├── manual.html             Product guide + experiment manual + glossary
├── ab-test.html            A/B evaluation      (stage: experiment)
├── entropy-model.html      State judgment      (stage: perceive)
├── oscillator.html         Convergence sim     (stage: converge)
├── ms-lab.html             Vector retrieval    (stage: memory)
├── hub.html                Redirect → index
├── MemoryBase/index.html   Memory base         (stage: memory)
├── assets/js/mock-api.js   Simulated backend
└── src/
    ├── theme.css           Design tokens (single source of truth)
    ├── stats.js            Statistical core
    ├── trace.js            Evidence chain bus
    ├── shell.js            Workbench shell + naming registry
    ├── starfield.js        Canvas starfield
    ├── viz.js              Hand-written SVG charts
    └── llm.js              Optional AI explanation layer (BYOK)
```

---

## 🛠️ Technical notes

Fully static (vanilla HTML/CSS/JS). No build step — deploy straight to GitHub Pages.

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

### Shared modules (`src/`)

| Module | Purpose |
| :--- | :--- |
| `theme.css` | Design tokens — 13 colour variables + 3 decision thresholds |
| `stats.js` | Statistical core: z-test, Bayesian, sample size, power |
| `trace.js` | Cross-experiment audit bus, 500-entry ring buffer |
| `shell.js` | Top nav bar + central naming registry |
| `starfield.js` | Canvas starfield engine |
| `viz.js` | Hand-written SVG charts (no chart library) |
| `llm.js` | Optional AI explanation, Bring-Your-Own-Key |

### 🔗 Evidence chain (Trace)

"Auditable" was an empty claim before — only `ab-test` logged anything, and it overwrote the previous line. Now all experiments share one bus:

- **Write:** `YTrace.log({ action, detail, verdict, level })` — stage and origin inferred from URL
- **Persist:** `localStorage['ytrace_v1']`, 500-entry ring buffer
- **Aggregate:** control panel filters by the four stages
- **Export:** one-click CSV (with BOM, opens correctly in Excel)
- **Degrade:** falls back to in-memory storage if localStorage is unavailable — never breaks the page

### Statistics: corrected

Two real defects were found and fixed:

**1. p-values were wrong.** `normalCDF` misused the Abramowitz & Stegun 7.1.26 coefficients — the coefficient set pairs with `exp(-x²)`, but the code used `exp(-x²/2)`, and the erf → Φ conversion was missing. Result: Φ(0) returned 0 instead of 0.5.

| z | Correct Φ(z) | Old output |
| :--- | :--- | :--- |
| 0 | 0.50000 | 0.00000 |
| 1.96 | 0.97500 | 0.96195 |

**Impact:** for z ∈ [1.96, 2.13] — true p between 0.033 and 0.05 — genuinely significant results were reported as "not significant". That is exactly the band where A/B decisions get made.

**2. The Bayes factor was not a Bayes factor.** It was an ad-hoc heuristic clamped by `Math.min(..., 100)`, returning the same value whether n was 1,500 or 5,000 — contradicting the basic property that evidence accumulates with data. Replaced with the industry-standard Beta-Binomial **P(B>A)** plus expected loss.

**Verified correct:** the sample-size formula. Cross-checked against three independent sources (this implementation, Evan Miller's full formula, and the textbook form) across six parameter sets — all within 4 subjects.

### Why no 3D / three.js

- `three.min.js` is 655 KB — 1.75× the size of this entire repository (373 KB)
- Real data volume here is a few hundred records; 3D addresses large-scale/high-dimensional data
- A 24-dimensional vector flattened into 3D loses 20 dimensions — parallel coordinates or radar charts (both 2D) are the correct tool
- WebGL fails on VMs, older hardware, and some locked-down environments, breaking "runs offline"

All charts are hand-written SVG in `src/viz.js` — zero dependencies.

### Known inconsistency

`oscillator.html` is the **only** page relying on an external CDN (Chart.js + Font Awesome). Everything else is fully offline-capable.

---

## 👤 Author

**HelloMInd** — Y.Mine ecosystem
