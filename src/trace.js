/* ============================================================
 * Y.Mine Validation Hub · 统一证据链总线 (Trace Bus)
 * ------------------------------------------------------------
 * 解决的核心问题：
 *   重构前 6 个实验里只有 ab-test 留了记录，且 logAction 是单行覆盖；
 *   entropy / MemoryBase 的日志只写 DOM、刷新即蒸发；
 *   ms-lab / oscillator 完全没有日志。README 主打的「可审计」是空的。
 *
 * 设计原则：
 *   - 零依赖、非 module，任何页面 <script src> 即可用
 *   - 环形缓冲：默认上限 500 条，超出丢弃最旧，避免撑爆 localStorage(5MB)
 *   - 降级容错：localStorage 不可用时退化为内存存储，绝不抛错阻断业务
 *   - 只记录「发生了什么 + 结论是什么」，不记录算法内部状态
 *
 * 用法：
 *   <script src="src/trace.js"></script>
 *   YTrace.log({ stage:'experiment', action:'统计判定', detail:'...', verdict:'A 胜出' });
 *   YTrace.query({ stage:'memory', limit:20 });
 *   YTrace.renderPanel('#traceHost');     // 在总控台渲染全站证据链
 * ============================================================ */

var YTrace = (function () {
    'use strict';

    var KEY = 'ytrace_v1';
    var MAX = 500;            /* 环形缓冲上限 */
    var memFallback = null;   /* localStorage 不可用时的内存兜底 */

    /* ---- 决策生命周期：四阶段 ---- */
    var STAGES = {
        perceive:  { label: '状态感知', icon: '👁', color: 'var(--accent-cyan)'   },
        experiment:{ label: '决策实验', icon: '🧪', color: 'var(--accent-amber)'  },
        converge:  { label: '收敛验证', icon: '📈', color: 'var(--accent-green)'  },
        memory:    { label: '记忆沉淀', icon: '🧠', color: 'var(--accent-purple)' }
    };

    /* 各实验页 → 所属阶段（新增页面在此登记即可自动归类） */
    var ORIGINS = {
        'entropy-model': { stage: 'perceive',   name: '熵值模型'   },
        'ab-test':       { stage: 'experiment', name: 'A/B 实验'   },
        'oscillator':    { stage: 'converge',   name: '振荡模拟'   },
        'ms-lab':        { stage: 'memory',     name: 'MindSpeak'  },
        'MemoryBase':    { stage: 'memory',     name: 'MemoryBase' }
    };

    /* ---- 读写 ---- */
    function readAll() {
        if (memFallback) return memFallback;
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            /* localStorage 被禁用 / JSON 损坏 -> 退化为内存，不阻断业务 */
            memFallback = [];
            return memFallback;
        }
    }

    function writeAll(arr) {
        if (memFallback) { memFallback = arr; return; }
        try {
            localStorage.setItem(KEY, JSON.stringify(arr));
        } catch (e) {
            /* 配额超限 -> 砍半重试一次，仍失败则退内存 */
            try {
                localStorage.setItem(KEY, JSON.stringify(arr.slice(Math.floor(arr.length / 2))));
            } catch (e2) {
                memFallback = arr;
            }
        }
    }

    var seq = 0;

    /* ---- 核心：记一条 ---- */
    function log(opt) {
        if (!opt || typeof opt !== 'object') return null;
        var origin = opt.origin || guessOrigin();
        var meta = ORIGINS[origin] || {};
        var stage = opt.stage || meta.stage || 'perceive';

        var rec = {
            id: 't' + Date.now().toString(36) + '_' + (seq++).toString(36),
            ts: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            stage: stage,
            origin: origin,
            originName: meta.name || origin,
            action: opt.action || '未命名动作',
            detail: opt.detail || '',
            verdict: opt.verdict || '',      /* 结论：通过/熔断/胜出… 可空 */
            level: opt.level || 'info'       /* info | warn | danger | ok */
        };

        var arr = readAll();
        arr.push(rec);
        if (arr.length > MAX) arr = arr.slice(arr.length - MAX);   /* 环形：丢最旧 */
        writeAll(arr);
        return rec;
    }

    /* 从 URL 反推实验名：
     *   /ab-test.html          -> ab-test
     *   /MemoryBase/index.html -> MemoryBase   （子目录页取目录名，否则与总控台撞名）
     *   /index.html            -> hub
     */
    function guessOrigin() {
        try {
            var seg = location.pathname.split('/').filter(function (s) { return s; });
            var last = (seg[seg.length - 1] || 'index.html').replace(/\.html?$/i, '');
            if (last === 'index' || last === 'hub' || last === '') {
                /* 末段是 index -> 往上找目录名；找不到才是总控台 */
                var dir = seg[seg.length - 2];
                return (dir && ORIGINS[dir]) ? dir : 'hub';
            }
            return last;
        } catch (e) { return 'unknown'; }
    }

    /* ---- 查询 ---- */
    function query(opt) {
        opt = opt || {};
        var arr = readAll();
        if (opt.stage)  arr = arr.filter(function (r) { return r.stage === opt.stage; });
        if (opt.origin) arr = arr.filter(function (r) { return r.origin === opt.origin; });
        if (opt.since)  arr = arr.filter(function (r) { return r.ts >= opt.since; });
        if (opt.level)  arr = arr.filter(function (r) { return r.level === opt.level; });
        if (opt.verdictOnly) arr = arr.filter(function (r) { return !!r.verdict; });
        return (opt.limit && arr.length > opt.limit) ? arr.slice(-opt.limit) : arr;
    }

    /* ---- 统计：总控台用 ---- */
    function stats() {
        var arr = readAll();
        var byStage = {}, byOrigin = {}, verdicts = 0;
        arr.forEach(function (r) {
            byStage[r.stage] = (byStage[r.stage] || 0) + 1;
            byOrigin[r.originName || r.origin] = (byOrigin[r.originName || r.origin] || 0) + 1;
            if (r.verdict) verdicts++;
        });
        return {
            total: arr.length,
            byStage: byStage,
            byOrigin: byOrigin,
            verdicts: verdicts,
            last: arr.length ? arr[arr.length - 1] : null,
            first: arr.length ? arr[0] : null
        };
    }

    function clear() {
        memFallback = [];
        try { localStorage.removeItem(KEY); } catch (e) {}
    }

    /* ---- 导出：可审计的落点 ---- */
    function exportData(fmt) {
        var arr = readAll();
        if (fmt === 'csv') {
            var head = '时间,阶段,来源,动作,详情,结论\n';
            var body = arr.map(function (r) {
                return [r.time, (STAGES[r.stage] || {}).label || r.stage, r.originName,
                        r.action, r.detail, r.verdict]
                    .map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; })
                    .join(',');
            }).join('\n');
            return head + body;
        }
        return JSON.stringify({ exportedAt: new Date().toISOString(), count: arr.length, records: arr }, null, 2);
    }

    /* ---- 面板渲染：总控台拉全站证据链 ---- */
    function renderPanel(hostSel, opt) {
        opt = opt || {};
        var host = typeof hostSel === 'string' ? document.querySelector(hostSel) : hostSel;
        if (!host) return;

        var arr = query({ stage: opt.stage, origin: opt.origin, limit: opt.limit || 40 });
        if (!arr.length) {
            host.innerHTML = '<p class="hint">暂无证据记录。去任一实验跑一次，这里会自动累积。</p>';
            return;
        }

        var html = '';
        arr.slice().reverse().forEach(function (r) {
            var st = STAGES[r.stage] || { label: r.stage, icon: '•', color: 'var(--text-sec)' };
            html += '<div class="trace-row" style="display:flex;gap:10px;padding:8px 10px;' +
                    'border-left:3px solid ' + st.color + ';margin-bottom:6px;' +
                    'background:var(--panel);border-radius:0 6px 6px 0;font-size:12.5px">';
            html += '<span style="color:var(--text-dim);font-variant-numeric:tabular-nums">' + r.time + '</span>';
            html += '<span style="color:' + st.color + ';white-space:nowrap">' + st.icon + ' ' + st.label + '</span>';
            html += '<span style="color:var(--text-sec)">' + esc(r.originName) + '</span>';
            html += '<span style="color:var(--text-primary);font-weight:600">' + esc(r.action) + '</span>';
            if (r.detail)  html += '<span style="color:var(--text-dim)">' + esc(r.detail) + '</span>';
            if (r.verdict) html += '<span style="margin-left:auto;color:var(--accent-amber);white-space:nowrap">→ ' + esc(r.verdict) + '</span>';
            html += '</div>';
        });
        host.innerHTML = html;
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    return {
        log: log, query: query, stats: stats, clear: clear,
        exportData: exportData, renderPanel: renderPanel,
        STAGES: STAGES, ORIGINS: ORIGINS, KEY: KEY, MAX: MAX
    };
})();
