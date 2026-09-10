/* ============================================================
 * Y.Mine Validation Hub · 可视化引擎 (Charts)
 * ------------------------------------------------------------
 * 全部手写 SVG，零依赖，不引入任何图表库。
 *
 * 为什么不用 three.js：
 *   · three.min.js 655KB，比本仓库全部代码（373KB）还大 1.75 倍
 *   · 本仓库真实数据量是几百条级别（A/B 默认 80 用户、证据链上限 500 条），
 *     3D 可视化是为大规模/高维数据准备的，这里用不上
 *   · 24 维向量硬塞进 3D 会丢掉 20 个维度的信息，
 *     高维数据的正解是平行坐标图或雷达图——都是 2D，且更易读
 *   · WebGL 在虚拟机、旧设备、部分企业环境跑不起来，会破坏"离线可跑"
 *
 * 图表清单：
 *   conversionCompare  转化率对比 + 95% 置信区间误差棒
 *   posteriorDist      Beta 后验分布曲线（A/B 两组叠加）
 *   traceTimeline      证据链时间轴（按四阶段着色）
 *   stageFlow          四阶段流转桑基图
 * ============================================================ */

var YViz = (function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    function el(tag, attrs) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
        }
        return e;
    }

    function svg(w, h) {
        var s = el('svg', {
            viewBox: '0 0 ' + w + ' ' + h,
            width: '100%',
            preserveAspectRatio: 'xMidYMid meet',
            style: 'display:block;max-width:100%;height:auto'
        });
        return s;
    }

    function txt(s, x, y, str, opt) {
        opt = opt || {};
        var t = el('text', {
            x: x, y: y,
            fill: opt.fill || 'var(--text-sec)',
            'font-size': opt.size || 11,
            'text-anchor': opt.anchor || 'start',
            'font-family': 'inherit',
            'font-weight': opt.weight || 400
        });
        t.textContent = str;
        s.appendChild(t);
        return t;
    }

    /* ---------- 1. 转化率对比 + 置信区间 ---------- */
    function conversionCompare(host, data) {
        var host_ = typeof host === 'string' ? document.querySelector(host) : host;
        if (!host_) return;
        host_.innerHTML = '';

        var W = 420, H = 210, pad = { l: 46, r: 16, t: 22, b: 44 };
        var s = svg(W, H);

        var maxV = Math.max(data.ciA.upper, data.ciB.upper, 0.01) * 1.25;
        var plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
        var yOf = function (v) { return pad.t + plotH - (v / maxV) * plotH; };

        /* Y 轴网格 */
        for (var i = 0; i <= 4; i++) {
            var v = maxV * i / 4, y = yOf(v);
            s.appendChild(el('line', {
                x1: pad.l, y1: y, x2: W - pad.r, y2: y,
                stroke: 'var(--border)', 'stroke-width': 1
            }));
            txt(s, pad.l - 7, y + 3.5, (v * 100).toFixed(1) + '%', { anchor: 'end', size: 10 });
        }

        /* 柱子 + 误差棒 */
        var groups = [
            { name: 'A 组', rate: data.rateA, ci: data.ciA, color: 'var(--accent-blue)' },
            { name: 'B 组', rate: data.rateB, ci: data.ciB, color: 'var(--accent-green)' }
        ];
        var barW = 62, gap = plotW / 2;
        groups.forEach(function (g, i) {
            var cx = pad.l + gap * (i + 0.5);
            var yTop = yOf(g.rate), yBase = yOf(0);

            s.appendChild(el('rect', {
                x: cx - barW / 2, y: yTop, width: barW, height: Math.max(1, yBase - yTop),
                fill: g.color, opacity: 0.28, rx: 4
            }));
            s.appendChild(el('line', {
                x1: cx - barW / 2, y1: yTop, x2: cx + barW / 2, y2: yTop,
                stroke: g.color, 'stroke-width': 2.5
            }));

            /* 95% 置信区间误差棒 */
            var yLo = yOf(g.ci.lower), yHi = yOf(g.ci.upper);
            s.appendChild(el('line', { x1: cx, y1: yLo, x2: cx, y2: yHi,
                                       stroke: g.color, 'stroke-width': 1.6, opacity: .85 }));
            [yLo, yHi].forEach(function (y) {
                s.appendChild(el('line', { x1: cx - 9, y1: y, x2: cx + 9, y2: y,
                                           stroke: g.color, 'stroke-width': 1.6, opacity: .85 }));
            });

            txt(s, cx, yTop - 9, (g.rate * 100).toFixed(2) + '%',
                { anchor: 'middle', size: 12, weight: 600, fill: 'var(--text-primary)' });
            txt(s, cx, H - 22, g.name, { anchor: 'middle', size: 11.5, fill: g.color });
            txt(s, cx, H - 8, 'CI [' + (g.ci.lower * 100).toFixed(1) + ', ' + (g.ci.upper * 100).toFixed(1) + ']%',
                { anchor: 'middle', size: 9.5 });
        });

        txt(s, pad.l, 13, '转化率对比（误差棒为 95% 置信区间）',
            { size: 11.5, fill: 'var(--text-primary)', weight: 600 });
        host_.appendChild(s);
    }

    /* ---------- 2. Beta 后验分布 ---------- */
    function posteriorDist(host, data) {
        var host_ = typeof host === 'string' ? document.querySelector(host) : host;
        if (!host_) return;
        host_.innerHTML = '';

        var W = 420, H = 210, pad = { l: 22, r: 16, t: 22, b: 38 };
        var s = svg(W, H);
        var plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;

        /* Beta 密度（对数 gamma 防溢出） */
        function logGamma(x) {
            var c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                     -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
            var y = x, tmp = x + 5.5;
            tmp -= (x + 0.5) * Math.log(tmp);
            var ser = 1.000000000190015;
            for (var j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
            return -tmp + Math.log(2.5066282746310005 * ser / x);
        }
        function betaPdf(x, a, b) {
            if (x <= 0 || x >= 1) return 0;
            return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)
                            - logGamma(a) - logGamma(b) + logGamma(a + b));
        }

        var aA = data.cA + 1, bA = data.nA - data.cA + 1;
        var aB = data.cB + 1, bB = data.nB - data.cB + 1;
        var mA = aA / (aA + bA), mB = aB / (aB + bB);
        var sA = Math.sqrt(aA * bA / (Math.pow(aA + bA, 2) * (aA + bA + 1)));
        var sB = Math.sqrt(aB * bB / (Math.pow(aB + bB, 2) * (aB + bB + 1)));
        var lo = Math.max(0, Math.min(mA - 4.5 * sA, mB - 4.5 * sB));
        var hi = Math.min(1, Math.max(mA + 4.5 * sA, mB + 4.5 * sB));
        if (hi - lo < 1e-6) { lo = Math.max(0, lo - .01); hi = Math.min(1, hi + .01); }

        var N = 160, valsA = [], valsB = [], maxD = 0;
        for (var i = 0; i <= N; i++) {
            var x = lo + (hi - lo) * i / N;
            var dA = betaPdf(x, aA, bA), dB = betaPdf(x, aB, bB);
            valsA.push(dA); valsB.push(dB);
            if (dA > maxD) maxD = dA;
            if (dB > maxD) maxD = dB;
        }
        var xOf = function (x) { return pad.l + (x - lo) / (hi - lo) * plotW; };
        var yOf = function (d) { return pad.t + plotH - (d / maxD) * plotH; };

        function path(vals) {
            var d = '';
            vals.forEach(function (v, i) {
                var x = pad.l + (i / N) * plotW, y = yOf(v);
                d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
            });
            return d;
        }

        /* 填充 + 描边 */
        var base = pad.t + plotH;
        [['A', valsA, 'var(--accent-blue)'], ['B', valsB, 'var(--accent-green)']].forEach(function (g) {
            var d = path(g[1]);
            d += 'L' + (pad.l + plotW).toFixed(2) + ' ' + base + 'L' + pad.l + ' ' + base + 'Z';
            s.appendChild(el('path', { d: d, fill: g[2], opacity: .17 }));
            s.appendChild(el('path', { d: path(g[1]), fill: 'none', stroke: g[2], 'stroke-width': 2 }));
        });

        /* 均值参考线 */
        [[mA, 'var(--accent-blue)'], [mB, 'var(--accent-green)']].forEach(function (m) {
            s.appendChild(el('line', {
                x1: xOf(m[0]), y1: pad.t, x2: xOf(m[0]), y2: base,
                stroke: m[1], 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: .6
            }));
        });

        txt(s, pad.l, 13, '后验分布（Beta 模型）', { size: 11.5, fill: 'var(--text-primary)', weight: 600 });
        txt(s, pad.l, H - 8, (lo * 100).toFixed(2) + '%', { size: 10 });
        txt(s, W - pad.r, H - 8, (hi * 100).toFixed(2) + '%', { anchor: 'end', size: 10 });
        /* 注意：必须同时判空值。typeof null === 'object'，
         * 只写 typeof !== 'undefined' 会在 YStats 为 null 时崩溃 */
        if (typeof YStats !== 'undefined' && YStats && YStats.probBBeatsA) {
            try {
                var p = YStats.probBBeatsA(aA, bA, aB, bB);
                txt(s, W - pad.r, 13, 'P(B>A) = ' + (p * 100).toFixed(1) + '%',
                    { anchor: 'end', size: 11, fill: 'var(--accent-amber)', weight: 600 });
            } catch (e) { /* 算不出就不显示，不阻断图表 */ }
        }
        host_.appendChild(s);
    }

    /* ---------- 3. 证据链时间轴 ---------- */
    function traceTimeline(host, records) {
        var host_ = typeof host === 'string' ? document.querySelector(host) : host;
        if (!host_) return;
        host_.innerHTML = '';
        if (!records || !records.length) {
            host_.innerHTML = '<p style="color:var(--text-dim);font-size:12.5px;text-align:center;' +
                              'padding:18px">暂无证据记录</p>';
            return;
        }

        var STAGES = (typeof YTrace !== 'undefined') ? YTrace.STAGES : {
            perceive: { label: '状态感知', color: 'var(--accent-cyan)' },
            experiment: { label: '决策实验', color: 'var(--accent-amber)' },
            converge: { label: '收敛验证', color: 'var(--accent-green)' },
            memory: { label: '记忆沉淀', color: 'var(--accent-purple)' }
        };

        var W = 640, rowH = 26, pad = { l: 118, r: 60, t: 30, b: 22 };
        var H = pad.t + records.length * rowH + pad.b;
        var s = svg(W, H);
        var plotW = W - pad.l - pad.r;

        var t0 = records[0].ts, t1 = records[records.length - 1].ts;
        var span = Math.max(1, t1 - t0);
        var xOf = function (ts) { return pad.l + (ts - t0) / span * plotW; };

        /* 时间刻度 */
        for (var k = 0; k <= 4; k++) {
            var x = pad.l + plotW * k / 4;
            s.appendChild(el('line', { x1: x, y1: pad.t - 6, x2: x, y2: H - pad.b + 2,
                                       stroke: 'var(--border)', 'stroke-width': 1 }));
            var mins = (span * k / 4) / 60000;
            txt(s, x, H - pad.b + 14, (mins < 1 ? (span * k / 4 / 1000).toFixed(0) + 's'
                                              : mins.toFixed(0) + 'm'),
                { anchor: 'middle', size: 9.5 });
        }

        records.forEach(function (r, i) {
            var y = pad.t + i * rowH + rowH / 2;
            var st = STAGES[r.stage] || { label: r.stage, color: 'var(--text-sec)' };
            var x = xOf(r.ts);

            /* 左侧来源名 */
            txt(s, pad.l - 10, y + 3.5, r.originName || r.origin,
                { anchor: 'end', size: 10.5, fill: 'var(--text-sec)' });
            /* 连接线 */
            s.appendChild(el('line', { x1: pad.l, y1: y, x2: x, y2: y,
                                       stroke: 'var(--border)', 'stroke-width': 1, opacity: .5 }));
            /* 节点 */
            s.appendChild(el('circle', { cx: x, cy: y, r: 5, fill: st.color,
                                         stroke: 'var(--bg-deep)', 'stroke-width': 1.5 }));
            /* 动作 + 结论 */
            var label = r.action + (r.verdict ? ' → ' + r.verdict : '');
            txt(s, x + 10, y + 3.5, label,
                { size: 10.5, fill: r.verdict ? 'var(--text-primary)' : 'var(--text-dim)' });
        });

        txt(s, pad.l, 13, '证据链时间轴（' + records.length + ' 条）',
            { size: 11.5, fill: 'var(--text-primary)', weight: 600 });
        host_.appendChild(s);
    }

    /* ---------- 4. 四阶段流转 ---------- */
    function stageFlow(host, stats) {
        var host_ = typeof host === 'string' ? document.querySelector(host) : host;
        if (!host_) return;
        host_.innerHTML = '';

        var stages = [
            { id: 'perceive',   icon: '👁', label: '状态感知' },
            { id: 'experiment', icon: '🧪', label: '决策实验' },
            { id: 'converge',   icon: '📈', label: '收敛验证' },
            { id: 'memory',     icon: '🧠', label: '记忆沉淀' }
        ];
        var colors = ['var(--accent-cyan)', 'var(--accent-amber)',
                      'var(--accent-green)', 'var(--accent-purple)'];

        var W = 640, H = 128, pad = { l: 20, t: 34, b: 22 };
        var s = svg(W, H);
        var n = stages.length;
        var nodeW = (W - pad.l * 2) / n;

        var maxV = 1;
        stages.forEach(function (st) {
            var v = (stats && stats.byStage && stats.byStage[st.id]) || 0;
            if (v > maxV) maxV = v;
        });

        var prevX = null, prevY = null;
        stages.forEach(function (st, i) {
            var v = (stats && stats.byStage && stats.byStage[st.id]) || 0;
            var cx = pad.l + nodeW * (i + 0.5);
            var cy = pad.t + 30;
            var r = 8 + (v / maxV) * 17;

            s.appendChild(el('circle', { cx: cx, cy: cy, r: r,
                                         fill: colors[i], opacity: .22 }));
            s.appendChild(el('circle', { cx: cx, cy: cy, r: r,
                                         fill: 'none', stroke: colors[i], 'stroke-width': 2 }));
            txt(s, cx, cy + 4, String(v), { anchor: 'middle', size: 12,
                                            fill: 'var(--text-primary)', weight: 700 });

            /* 连线（带宽反映流量） */
            if (prevX !== null) {
                s.appendChild(el('line', {
                    x1: prevX + r, y1: prevY, x2: cx - r, y2: cy,
                    stroke: 'var(--border)', 'stroke-width': 2, opacity: .7
                }));
            }
            prevX = cx; prevY = cy;

            txt(s, cx, cy + r + 15, st.icon + ' ' + st.label,
                { anchor: 'middle', size: 10.5, fill: colors[i] });
        });

        txt(s, pad.l, 13, '四阶段证据分布', { size: 11.5, fill: 'var(--text-primary)', weight: 600 });
        host_.appendChild(s);
    }

    return {
        conversionCompare: conversionCompare,
        posteriorDist: posteriorDist,
        traceTimeline: traceTimeline,
        stageFlow: stageFlow
    };
})();
