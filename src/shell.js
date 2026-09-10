/* ============================================================
 * Y.Mine Validation Hub · 统一工作台外壳 (Shell)
 * ------------------------------------------------------------
 * 解决两个问题：
 *   1. 五个实验页彼此孤立，跳进去就不知道自己在整条链路的哪一步
 *   2. 命名抽象（Y-Exp / MindSpeak / 归1），外人看不懂在干什么
 *
 * 设计：
 *   - 每个页面只需一行 <script src="src/shell.js" data-stage="experiment">
 *     即可获得顶部常驻阶段导航条，自动高亮当前所处阶段
 *   - 零依赖、非 module，不阻断业务；DOM 未就绪时自动等待
 *   - 命名统一在此集中登记，改一处全站生效
 *
 * 四阶段：状态感知 → 决策实验 → 收敛验证 → 记忆沉淀
 * ============================================================ */

var YShell = (function () {
    'use strict';

    /* ---- 决策生命周期四阶段 ---- */
    var STAGES = [
        { id: 'perceive',   icon: '👁', label: '状态感知', file: 'entropy-model.html',
          desc: '判定系统当前处于收敛态还是发散态' },
        { id: 'experiment', icon: '🧪', label: '决策实验', file: 'ab-test.html',
          desc: '分流、追踪、统计检验，判定方案优劣' },
        { id: 'converge',   icon: '📈', label: '收敛验证', file: 'oscillator.html',
          desc: '验证系统能否归一收敛到目标区间' },
        { id: 'memory',     icon: '🧠', label: '记忆沉淀', file: 'ms-lab.html',
          desc: '把结论沉淀为可复用的结构化记忆' }
    ];

    /* ---- 命名统一：抽象原名 → 人话新名 ---- */
    var NAMES = {
        'entropy-model.html': { name: '状态判定实验台', origin: 'entropy-model',
                                prev: '熵值模型 · 状态判定引擎' },
        'ab-test.html':       { name: 'A/B 实验评估台', origin: 'ab-test',
                                prev: 'Y-Exp · 实验评估框架' },
        'oscillator.html':    { name: '归一收敛模拟器', origin: 'oscillator',
                                prev: '归1振荡模拟器' },
        'ms-lab.html':        { name: '向量检索实验室', origin: 'ms-lab',
                                prev: 'MindSpeak Embedding Lab' },
        'MemoryBase/index.html': { name: '记忆基座 MemoryBase', origin: 'MemoryBase',
                                prev: 'MemoryBase · 公共底层记忆基座' },
        'index.html':         { name: '实验集群总控台', origin: 'hub', prev: '' },
        'manual.html':        { name: '产品说明与实验手册', origin: 'manual', prev: '' }
    };

    var CSS = [
        '.yshell{position:sticky;top:0;z-index:9999;background:rgba(6,10,31,.94);',
        'backdrop-filter:blur(14px);border-bottom:1px solid var(--border);',
        'font-family:inherit;-webkit-backdrop-filter:blur(14px)}',
        '.yshell-inner{max-width:1400px;margin:0 auto;padding:8px 16px;',
        'display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.yshell-brand{display:flex;align-items:center;gap:7px;font-size:13px;',
        'font-weight:600;color:var(--text-primary);text-decoration:none;',
        'padding:5px 12px 5px 6px;border-right:1px solid var(--border);margin-right:4px}',
        '.yshell-brand:hover{color:var(--accent-blue)}',
        '.yshell-stages{display:flex;gap:5px;flex-wrap:wrap;flex:1}',
        '.ystage{display:flex;align-items:center;gap:5px;padding:5px 11px;',
        'border-radius:8px;font-size:12px;text-decoration:none;',
        'color:var(--text-sec);border:1px solid transparent;transition:all .16s;white-space:nowrap}',
        '.ystage:hover{background:rgba(129,140,248,.12);color:var(--text-primary)}',
        '.ystage.on{background:rgba(129,140,248,.22);color:var(--text-primary);',
        'border-color:var(--accent-purple);font-weight:600}',
        '.ystage .ynum{font-size:10px;opacity:.65;font-variant-numeric:tabular-nums}',
        '.yshell-right{display:flex;gap:5px;align-items:center}',
        '.yshell-link{padding:5px 10px;border-radius:8px;font-size:12px;',
        'text-decoration:none;color:var(--text-dim);border:1px solid var(--border)}',
        '.yshell-link:hover{color:var(--text-primary);background:rgba(129,140,248,.1)}',
        '.yshell-cur{font-size:11px;color:var(--text-dim);padding:4px 10px;',
        'border-left:1px solid var(--border);margin-left:auto}',
        '@media(max-width:760px){.yshell-cur{display:none}.ystage .ynum{display:none}}'
    ].join('');

    function currentFile() {
        var seg = location.pathname.split('/').filter(function (s) { return s; });
        var last = (seg[seg.length - 1] || 'index.html');
        if (/^(index|hub)\.html?$/i.test(last)) {
            return seg.length >= 2 && /MemoryBase/i.test(seg[seg.length - 2])
                ? 'MemoryBase/index.html' : last;
        }
        return last;
    }

    /* 子目录页面（如 MemoryBase/）需要把路径提升一级 */
    function prefix() {
        var seg = location.pathname.split('/').filter(function (s) { return s; });
        return seg.length >= 2 && /\.html?$/i.test(seg[seg.length - 1]) ? '../' : '';
    }

    function build() {
        if (document.getElementById('yshell')) return;

        var s = document.createElement('style');
        s.textContent = CSS;
        document.head.appendChild(s);

        var file = currentFile();
        var meta = NAMES[file] || {};
        var stage = meta.stage || document.currentScript && document.currentScript.getAttribute('data-stage') || '';
        /* 从 NAMES 反查阶段：ms-lab 与 MemoryBase 同属 memory */
        if (!stage) {
            for (var k in NAMES) {
                if (k === file) { stage = NAMES[k].stage || ''; break; }
            }
        }
        if (!stage) {
            if (file === 'entropy-model.html') stage = 'perceive';
            else if (file === 'ab-test.html') stage = 'experiment';
            else if (file === 'oscillator.html') stage = 'converge';
            else if (file === 'ms-lab.html' || file === 'MemoryBase/index.html') stage = 'memory';
        }

        var pf = prefix();
        var bar = document.createElement('div');
        bar.className = 'yshell';
        bar.id = 'yshell';

        var html = '<div class="yshell-inner">';
        html += '<a class="yshell-brand" href="' + pf + 'index.html" title="返回总控台">🔬 Y.Mine</a>';
        html += '<div class="yshell-stages">';
        STAGES.forEach(function (st, i) {
            var on = (st.id === stage) ? ' on' : '';
            html += '<a class="ystage' + on + '" href="' + pf + st.file + '" title="' + st.desc + '">' +
                    '<span class="ynum">' + (i + 1) + '</span>' +
                    '<span>' + st.icon + ' ' + st.label + '</span></a>';
        });
        html += '</div>';
        html += '<div class="yshell-right">';
        html += '<a class="yshell-link" href="' + pf + 'manual.html">📖 说明</a>';
        html += '</div>';
        if (meta.name && file !== 'index.html') {
            html += '<span class="yshell-cur">当前：' + meta.name + '</span>';
        }
        html += '</div>';
        bar.innerHTML = html;

        document.body.insertBefore(bar, document.body.firstChild);
    }

    /* DOM 就绪后注入；已就绪则立即执行 */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', build);
        } else {
            build();
        }
    }

    return { init: init, build: build, STAGES: STAGES, NAMES: NAMES };
})();

YShell.init();
