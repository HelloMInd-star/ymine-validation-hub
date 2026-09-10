/* ============================================================
 * Y.Mine Validation Hub · 数据导入导出层 (Data I/O)
 * ------------------------------------------------------------
 * 解决的核心问题：
 *   重构前全站 0 个文件上传控件，5 个页面里 3 个无法导出结果。
 *   数据是随机生成的假数据——这是个"演示品"，不是"工具"。
 *   真工具和演示品的分界线，就是能不能吃进你自己的数据。
 *
 * 支持三种导入格式（自动识别，无需用户选类型）：
 *   1. 用户级明细 CSV：每行一个用户  uid,group,converted
 *   2. 汇总级 CSV    ：每行一组      group,visitors,conversions
 *   3. 完整 JSON     ：本仓库导出的 data 结构
 *
 * 设计原则：
 *   - 零依赖、纯前端，文件不上传服务器，浏览器内解析
 *   - 表头智能匹配：中英文、大小写、别名都能认
 *   - 导入前必须预览，确认后再落地（避免误覆盖已有数据）
 *   - 严格校验 + 逐行报错，坏数据不会静默污染结果
 *   - 所有导入动作写入证据链
 * ============================================================ */

var YData = (function () {
    'use strict';

    /* ---------- CSV 解析（RFC 4180，支持引号内逗号与换行）---------- */
    function parseCSV(text) {
        text = String(text).replace(/^\uFEFF/, '');   /* 去 BOM */
        var rows = [], row = [], cur = '', inQ = false;
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (inQ) {
                if (c === '"') {
                    if (text[i + 1] === '"') { cur += '"'; i++; }
                    else inQ = false;
                } else cur += c;
            } else {
                if (c === '"') inQ = true;
                else if (c === ',') { row.push(cur); cur = ''; }
                else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
                else if (c === '\r') { /* 忽略 */ }
                else cur += c;
            }
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows.filter(function (r) {
            /* 过滤全空行 */
            return r.some(function (c) { return String(c).trim() !== ''; });
        });
    }

    /* ---------- 表头识别 ---------- */
    var FIELD_ALIASES = {
        uid:       ['uid', 'user', 'userid', 'user_id', 'id', '用户', '用户id', '用户id', '编号'],
        group:     ['group', 'variant', 'bucket', 'arm', 'ab', '分组', '组别', '实验组', '变体'],
        converted: ['converted', 'conversion', 'convert', 'is_converted', 'success',
                    'outcome', '转化', '是否转化', '已转化', '结果'],
        visitors:  ['visitors', 'users', 'n', 'sample', 'count', 'total',
                    '样本', '样本量', '人数', '访问数', '用户数'],
        conversions:['conversions', 'conv', 'converted_count', 'successes',
                    '转化数', '转化量', '成功数']
    };

    function norm(s) {
        return String(s).toLowerCase()
            .replace(/[\s_\-()（）]/g, '')
            .replace(/[：:]/g, '');
    }

    function detectField(header) {
        var h = norm(header);
        for (var key in FIELD_ALIASES) {
            if (FIELD_ALIASES[key].indexOf(h) > -1) return key;
        }
        return null;
    }

    function detectFormat(rows) {
        if (!rows || rows.length < 2) return null;
        var head = rows[0].map(detectField);
        var has = function (f) { return head.indexOf(f) > -1; };

        if (has('group') && has('converted') && (has('uid') || head.length >= 2)) return 'detail';
        if (has('group') && has('visitors') && has('conversions')) return 'summary';
        /* 兜底：两列且像 分组/是否转化 */
        if (rows[0].length === 2 && has('group')) return 'detail';
        return null;
    }

    /* ---------- 值解析 ---------- */
    function toBool(v) {
        var s = String(v).trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 't', '是', '已转化', '成功', 'converted'].indexOf(s) > -1) return true;
        if (['0', 'false', 'no', 'n', 'f', '否', '未转化', '失败', ''].indexOf(s) > -1) return false;
        return null;
    }
    function toInt(v) {
        var n = parseInt(String(v).replace(/[,\s%]/g, ''), 10);
        return isNaN(n) ? null : n;
    }
    function normGroup(v) {
        var s = String(v).trim().toUpperCase();
        if (s === 'A' || s === '0' || s === 'CONTROL' || s === '对照组' || s === '控制组') return 'A';
        if (s === 'B' || s === '1' || s === 'TREATMENT' || s === '实验组' || s === '处理组') return 'B';
        return null;
    }

    /* ---------- 解析为统一结构 ---------- */
    function parse(text, opt) {
        opt = opt || {};
        var out = { ok: false, format: null, errors: [], warnings: [], data: null, rowCount: 0 };

        var trimmed = String(text).trim();
        if (!trimmed) { out.errors.push('内容为空'); return out; }

        /* JSON 分支 */
        if (trimmed[0] === '{' || trimmed[0] === '[') {
            try {
                var j = JSON.parse(trimmed);
                var d = normalizeJSON(j);
                if (d) {
                    out.ok = true; out.format = 'json'; out.data = d;
                    out.rowCount = d.users.length;
                    return out;
                }
                out.errors.push('JSON 结构不符：需要至少包含 users/groups/conversions 或 A/B 两组汇总');
            } catch (e) {
                out.errors.push('JSON 解析失败：' + e.message);
            }
            return out;
        }

        /* CSV 分支 */
        var rows = parseCSV(trimmed);
        if (rows.length < 2) { out.errors.push('CSV 至少需要表头 + 1 行数据'); return out; }

        var fmt = detectFormat(rows);
        if (!fmt) {
            out.errors.push('无法识别表头。支持的列名：' +
                'uid/用户, group/分组, converted/是否转化, visitors/样本量, conversions/转化数');
            return out;
        }
        out.format = fmt;

        var head = rows[0].map(detectField);
        var users = [], groups = {}, conversions = {}, bad = 0;

        if (fmt === 'detail') {
            var iUid = head.indexOf('uid');
            var iGrp = head.indexOf('group');
            var iCvt = head.indexOf('converted');
            /* 无 uid 列时自动编号 */
            if (iUid < 0) { iUid = -1; }

            for (var r = 1; r < rows.length; r++) {
                var row = rows[r];
                if (row.length < 2) { bad++; continue; }
                var g = normGroup(row[iGrp]);
                if (!g) { out.warnings.push('第 ' + (r + 1) + ' 行：分组值无法识别，已跳过'); bad++; continue; }
                var uid = iUid >= 0 && row[iUid] ? String(row[iUid]).trim() : ('u' + (r));
                if (groups[uid] !== undefined) {
                    /* 同 uid 重复出现：后者覆盖，但提示 */
                    out.warnings.push('第 ' + (r + 1) + ' 行：用户 ' + uid + ' 重复，已覆盖');
                } else {
                    users.push(uid);
                }
                groups[uid] = g;
                var cv = iCvt >= 0 ? toBool(row[iCvt]) : false;
                if (cv === null) {
                    out.warnings.push('第 ' + (r + 1) + ' 行：转化值无法识别，按未转化处理');
                    cv = false;
                }
                conversions[uid] = cv;
            }
        } else {
            /* summary：每组一行 */
            var iG2 = head.indexOf('group'), iV = head.indexOf('visitors'), iC = head.indexOf('conversions');
            var seen = {}, n = 0;
            for (var r2 = 1; r2 < rows.length; r2++) {
                var row2 = rows[r2];
                var g2 = normGroup(row2[iG2]);
                if (!g2) { out.warnings.push('第 ' + (r2 + 1) + ' 行：分组值无法识别，已跳过'); bad++; continue; }
                var v = toInt(row2[iV]), c = toInt(row2[iC]);
                if (v === null || c === null) { out.warnings.push('第 ' + (r2 + 1) + ' 行：数值无法解析，已跳过'); bad++; continue; }
                if (c > v) { out.warnings.push('第 ' + (r2 + 1) + ' 行：转化数大于样本数，已调换'); var t = c; c = v; v = t; }
                if (v < 0 || c < 0) { out.warnings.push('第 ' + (r2 + 1) + ' 行：出现负数，已跳过'); bad++; continue; }
                seen[g2] = { v: v, c: c };
            }
            ['A', 'B'].forEach(function (g) {
                var s = seen[g];
                if (!s) return;
                for (var k = 0; k < s.v; k++) {
                    n++;
                    var uid = 'u' + n;
                    users.push(uid);
                    groups[uid] = g;
                    conversions[uid] = (k < s.c);
                }
            });
            if (!seen.A || !seen.B) {
                out.warnings.push('汇总数据建议同时提供 A、B 两组；缺失组将视为 0 样本');
            }
        }

        if (!users.length) {
            out.errors.push('没有解析出任何有效数据行' + (bad ? ('（跳过 ' + bad + ' 行）') : ''));
            return out;
        }

        out.ok = true;
        out.rowCount = users.length;
        out.data = {
            users: users,
            groups: groups,
            conversions: conversions,
            userIdCounter: users.length,
            experimentName: opt.experimentName || '导入的数据',
            metricName: opt.metricName || '转化率',
            trafficA: 50, trafficB: 50,
            history: [],
            startTime: Date.now(),
            msContext: null
        };
        if (bad) out.warnings.unshift('共跳过 ' + bad + ' 行异常数据');
        return out;
    }

    /* 兼容多种 JSON 结构 */
    function normalizeJSON(j) {
        if (!j || typeof j !== 'object') return null;

        /* 本仓库完整 data 结构 */
        if (j.users && j.groups && j.conversions) {
            return {
                users: j.users.slice(),
                groups: Object.assign({}, j.groups),
                conversions: Object.assign({}, j.conversions),
                userIdCounter: j.userIdCounter || j.users.length,
                experimentName: j.experimentName || '导入的数据',
                metricName: j.metricName || '转化率',
                trafficA: j.trafficA || 50, trafficB: j.trafficB || 50,
                history: Array.isArray(j.history) ? j.history : [],
                startTime: j.startTime || Date.now(),
                msContext: j.msContext || null
            };
        }

        /* 数组：用户级明细 */
        if (Array.isArray(j)) {
            var users = [], groups = {}, conv = {}, n = 0;
            j.forEach(function (it, i) {
                var g = normGroup(it.group || it.variant || it.g);
                if (!g) return;
                n++;
                var uid = String(it.uid || it.user || it.id || ('u' + (i + 1)));
                users.push(uid); groups[uid] = g;
                var cv = it.converted !== undefined ? it.converted : it.conversion;
                conv[uid] = !!(cv === true || cv === 1 || cv === '1' || cv === 'true');
            });
            if (!users.length) return null;
            return {
                users: users, groups: groups, conversions: conv, userIdCounter: n,
                experimentName: '导入的数据', metricName: '转化率',
                trafficA: 50, trafficB: 50, history: [], startTime: Date.now(), msContext: null
            };
        }

        /* 汇总对象：{A:{visitors,conversions}, B:{...}} */
        var mk = function (a, b) {
            if (!a || !b) return null;
            var vA = toInt(a.visitors !== undefined ? a.visitors : a.n);
            var cA = toInt(a.conversions !== undefined ? a.conversions : a.conv);
            var vB = toInt(b.visitors !== undefined ? b.visitors : b.n);
            var cB = toInt(b.conversions !== undefined ? b.conversions : b.conv);
            if ([vA, cA, vB, cB].some(function (x) { return x === null; })) return null;
            if (cA > vA) cA = vA; if (cB > vB) cB = vB;
            var users = [], groups = {}, conv = {}, n = 0;
            [['A', vA, cA], ['B', vB, cB]].forEach(function (t) {
                for (var k = 0; k < t[1]; k++) {
                    n++; var uid = 'u' + n;
                    users.push(uid); groups[uid] = t[0]; conv[uid] = (k < t[2]);
                }
            });
            return {
                users: users, groups: groups, conversions: conv, userIdCounter: n,
                experimentName: (j.experimentName || '导入的数据'),
                metricName: (j.metricName || '转化率'),
                trafficA: 50, trafficB: 50, history: [], startTime: Date.now(), msContext: null
            };
        };
        var d = mk(j.A, j.B) || mk(j.a, j.b) || mk(j.control, j.treatment);
        return d;
    }

    /* ---------- 导出 ---------- */
    function toCSV(data, opt) {
        opt = opt || {};
        var L = ['uid,group,converted'];
        (data.users || []).forEach(function (uid) {
            L.push(uid + ',' + (data.groups[uid] || '') + ',' + (data.conversions[uid] ? 1 : 0));
        });
        return L.join('\n');
    }

    function toSummaryCSV(data) {
        var s = { A: { v: 0, c: 0 }, B: { v: 0, c: 0 } };
        (data.users || []).forEach(function (uid) {
            var g = data.groups[uid];
            if (s[g]) { s[g].v++; if (data.conversions[uid]) s[g].c++; }
        });
        var L = ['group,visitors,conversions,rate'];
        ['A', 'B'].forEach(function (g) {
            var r = s[g].v ? (s[g].c / s[g].v * 100).toFixed(2) : '0.00';
            L.push(g + ',' + s[g].v + ',' + s[g].c + ',' + r);
        });
        return L.join('\n');
    }

    function download(filename, content, mime) {
        try {
            var blob = new Blob([mime === 'text/csv' ? '\uFEFF' + content : content],
                                { type: (mime || 'text/plain') + ';charset=utf-8' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
            return true;
        } catch (e) { return false; }
    }

    /* ---------- 文件读取 ---------- */
    function readFile(file, cb) {
        if (!file) { cb({ ok: false, error: '未选择文件' }); return; }
        var fr = new FileReader();
        fr.onload = function (e) { cb({ ok: true, text: e.target.result, name: file.name }); };
        fr.onerror = function () { cb({ ok: false, error: '文件读取失败' }); };
        fr.readAsText(file, 'UTF-8');
    }

    /* ---------- 生成模板 ---------- */
    function template(fmt) {
        if (fmt === 'summary') {
            return 'group,visitors,conversions\nA,2000,100\nB,2000,125';
        }
        return 'uid,group,converted\nu1,A,1\nu2,A,0\nu3,B,1\nu4,B,0';
    }

    return {
        parse: parse,
        parseCSV: parseCSV,
        detectFormat: detectFormat,
        toCSV: toCSV,
        toSummaryCSV: toSummaryCSV,
        download: download,
        readFile: readFile,
        template: template
    };
})();
