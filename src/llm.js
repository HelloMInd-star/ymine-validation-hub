/* ============================================================
 * Y.Mine Validation Hub · AI 解释层 (LLM Bridge)
 * ------------------------------------------------------------
 * 设计原则（参考业界 local-first + BYOK 实践）：
 *
 *   1. 本地计算是权威，AI 只做解释
 *      所有数值（p 值、P(B>A)、样本量）都由 src/stats.js 本地算出。
 *      AI 拿到的只是已算好的结果，绝不允许它自己算——LLM 会编数字。
 *
 *   2. API key 只存 localStorage，请求从浏览器直发
 *      不经任何中间服务器。key 不会离开你的浏览器。
 *
 *   3. 发送前必须可预览
 *      用户能看到"即将发出去的是什么"，没有黑箱。
 *
 *   4. 完全可选、默认关闭
 *      不填 key 就完全不启用，全站零依赖离线的定位不受影响。
 *
 * 用法：
 *   <script src="src/llm.js"></script>
 *   YLLM.explain(statsResult, function (text) { ... });
 * ============================================================ */

var YLLM = (function () {
    'use strict';

    var KEY_STORE = 'yllm_config_v1';

    /* ---- 支持的服务商：OpenAI 兼容协议为主，便于接本地 Ollama ---- */
    var PROVIDERS = {
        openai: {
            label: 'OpenAI',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
            defaultModel: 'gpt-4o-mini'
        },
        deepseek: {
            label: 'DeepSeek',
            endpoint: 'https://api.deepseek.com/v1/chat/completions',
            models: ['deepseek-chat', 'deepseek-reasoner'],
            defaultModel: 'deepseek-chat'
        },
        moonshot: {
            label: 'Moonshot / Kimi',
            endpoint: 'https://api.moonshot.cn/v1/chat/completions',
            models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
            defaultModel: 'moonshot-v1-8k'
        },
        custom: {
            label: '自定义 / 本地 (Ollama 等)',
            endpoint: '',
            models: [],
            defaultModel: ''
        }
    };

    /* ---- 配置读写 ---- */
    function getConfig() {
        try {
            var raw = localStorage.getItem(KEY_STORE);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function setConfig(cfg) {
        try { localStorage.setItem(KEY_STORE, JSON.stringify(cfg)); }
        catch (e) { /* 配额满，忽略 */ }
    }
    function isEnabled() {
        var c = getConfig();
        return !!(c.apiKey && c.endpoint);
    }

    /* ---------- 系统提示词 ----------
     * 参考"混合提示策略"：显式约束 + 推理脚手架 + 格式约束。
     * 研究显示这比零样本提示在推断性统计任务上准确得多。
     */
    var SYSTEM_PROMPT = [
        '你是一个 A/B 实验结果的解释助手。',
        '',
        '## 硬性约束（违反即为失败）',
        '- 所有统计数值已经由本地程序算好并附在下面，你【只能引用这些给定的数字】。',
        '- 【严禁自己计算】任何统计量，严禁推算、外推、补充未给出的数字。',
        '- 【严禁编造】业务背景、行业基准、历史数据。不知道就说"数据不足无法判断"。',
        '- 如果给定的数据不足以支撑某个结论，明确说"无法判断"，不要用常识填补。',
        '',
        '## 你的任务',
        '用业务人员能听懂的话解释这些数字意味着什么，以及该怎么做。',
        '',
        '## 输出格式（严格遵守）',
        '1. 一句话结论：选 A、选 B，还是继续观察',
        '2. 依据：逐条列出你引用的数字（必须是上面给出的）',
        '3. 风险提示：这个结论在什么情况下不成立',
        '4. 下一步建议：具体可执行的动作',
        '',
        '## 语气',
        '直接、克制。不要用"恭喜""太棒了"这类情绪化表达。有疑虑就直接说疑虑。'
    ].join('\n');

    /* 字段兼容：ab-test 的 calculateStats 用 usersA/convA，
     * stats.js 的 twoProportionZTest 用 nA/cA。两种都要能读。 */
    function pick(r, aliases, dflt) {
        for (var i = 0; i < aliases.length; i++) {
            var v = r[aliases[i]];
            if (v !== null && v !== undefined && !isNaN(v)) return v;
        }
        return dflt;
    }

    /* 把本地算好的结果序列化成给 AI 看的纯文本 */
    function buildContext(r) {
        if (!r) return '';

        var nA = pick(r, ['usersA', 'nA'], 0);
        var nB = pick(r, ['usersB', 'nB'], 0);
        var cA = pick(r, ['convA', 'cA'], 0);
        var cB = pick(r, ['convB', 'cB'], 0);
        var rA = pick(r, ['rateA'], nA > 0 ? cA / nA : 0);
        var rB = pick(r, ['rateB'], nB > 0 ? cB / nB : 0);

        /* 贝叶斯字段缺失时本地补算，保证上下文完整 */
        var pB = pick(r, ['probBBeatsA'], null);
        var loss = pick(r, ['expectedLoss'], null);
        if ((pB === null || loss === null) && typeof YStats !== 'undefined' && nA > 0 && nB > 0) {
            try {
                var by = YStats.bayesianAB(nA, cA, nB, cB);
                if (pB === null) pB = by.probBBeatsA;
                if (loss === null) loss = by.expectedLossChooseB;
            } catch (e) { /* 补算失败就留空，不阻断 */ }
        }

        var L = [];
        L.push('# 实验数据（本地计算，权威）');
        L.push('');
        L.push('## 样本');
        L.push('- A 组：' + nA + ' 人，转化 ' + cA + ' 人，转化率 ' + (rA * 100).toFixed(2) + '%');
        L.push('- B 组：' + nB + ' 人，转化 ' + cB + ' 人，转化率 ' + (rB * 100).toFixed(2) + '%');
        L.push('');
        L.push('## 频率派检验');
        L.push('- 相对提升：' + (pick(r, ['lift'], 0) * 100).toFixed(2) + '%');
        L.push('- z 值：' + (pick(r, ['z'], null) !== null ? pick(r, ['z'], 0).toFixed(4) : '无法计算（样本不足）'));
        L.push('- p 值：' + (pick(r, ['pValue'], null) !== null ? pick(r, ['pValue'], 0).toFixed(5) : '无法计算'));
        L.push('- 是否统计显著（α=0.05）：' + (r.significant ? '是' : '否'));
        if (pick(r, ['ciLower'], null) !== null) {
            L.push('- 95% 置信区间：[' + (pick(r, ['ciLower'], 0) * 100).toFixed(2) + '%, ' +
                   (pick(r, ['ciUpper'], 0) * 100).toFixed(2) + '%]');
        }
        if (pick(r, ['power'], null) !== null) {
            L.push('- 已实现功效：' + (pick(r, ['power'], 0) * 100).toFixed(1) + '%');
        }
        L.push('');
        L.push('## 贝叶斯推断');
        if (pB !== null && pB !== undefined) {
            L.push('- P(B > A)：' + (pB * 100).toFixed(2) + '%');
            L.push('- 选 B 的期望损失：' + Number(loss).toExponential(2));
        } else {
            L.push('- 无法计算（样本不足）');
        }
        L.push('');
        L.push('# 请基于以上数据作答。不要重新计算任何数值。');
        return L.join('\n');
    }

    /* ---- 发起请求（浏览器直连，不经服务器）---- */
    function call(messages, cb) {
        var cfg = getConfig();
        if (!cfg.apiKey || !cfg.endpoint) {
            cb({ ok: false, error: '未配置 API Key，AI 解释功能未启用。' });
            return;
        }

        var body = {
            model: cfg.model || 'gpt-4o-mini',
            messages: messages,
            temperature: 0.2,      /* 统计解释要稳定，不要发挥 */
            max_tokens: 900
        };

        fetch(cfg.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + cfg.apiKey
            },
            body: JSON.stringify(body)
        })
        .then(function (res) {
            if (!res.ok) {
                return res.text().then(function (t) {
                    throw new Error('HTTP ' + res.status + '：' + t.slice(0, 180));
                });
            }
            return res.json();
        })
        .then(function (data) {
            var txt = data &&
                      data.choices && data.choices[0] &&
                      data.choices[0].message && data.choices[0].message.content;
            if (!txt) throw new Error('返回内容为空或格式不符');
            cb({ ok: true, text: txt });
        })
        .catch(function (e) {
            cb({ ok: false, error: e.message || String(e) });
        });
    }

    /* ---- 对外：解释一次实验结果 ---- */
    function explain(r, cb) {
        if (!isEnabled()) {
            cb({ ok: false, error: 'AI 解释未启用（未配置 API Key）' });
            return;
        }
        var ctx = buildContext(r);
        call([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: ctx }
        ], cb);
    }

    /* ---- 预览：让用户看到即将发出去的内容 ---- */
    function preview(r) { return buildContext(r); }

    /* ---- 设置面板 UI ---- */
    function renderSettings(hostSel) {
        var host = typeof hostSel === 'string' ? document.querySelector(hostSel) : hostSel;
        if (!host) return;
        var cfg = getConfig() || {};
        var prov = cfg.provider || 'openai';

        var opts = Object.keys(PROVIDERS).map(function (k) {
            return '<option value="' + k + '"' + (k === prov ? ' selected' : '') + '>' +
                   PROVIDERS[k].label + '</option>';
        }).join('');

        host.innerHTML =
            '<div style="background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin:14px 0">' +
            '<h4 style="margin:0 0 4px;color:var(--accent-blue)">🤖 AI 解释（可选）</h4>' +
            '<p style="font-size:12.5px;color:var(--text-dim);margin:0 0 14px">' +
            '填 Key 后可用 AI 解释实验结果。<b>Key 只存在你浏览器的 localStorage，请求从浏览器直发，不经任何中间服务器。</b>' +
            '不填则完全不启用，全站保持零依赖离线可用。</p>' +

            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
            '<label style="font-size:12.5px;color:var(--text-sec);min-width:56px">服务商</label>' +
            '<select id="yllmProv" style="flex:1;min-width:150px;padding:7px 10px;border-radius:7px;' +
            'background:rgba(0,0,0,.25);color:var(--text-primary);border:1px solid var(--border);font-family:inherit;font-size:13px">' +
            opts + '</select>' +
            '</div>' +

            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
            '<label style="font-size:12.5px;color:var(--text-sec);min-width:56px">接口地址</label>' +
            '<input id="yllmEndpoint" type="text" placeholder="https://api.openai.com/v1/chat/completions" ' +
            'value="' + (cfg.endpoint || '') + '" style="flex:1;min-width:200px;padding:7px 10px;border-radius:7px;' +
            'background:rgba(0,0,0,.25);color:var(--text-primary);border:1px solid var(--border);font-family:inherit;font-size:13px">' +
            '</div>' +

            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
            '<label style="font-size:12.5px;color:var(--text-sec);min-width:56px">模型</label>' +
            '<input id="yllmModel" type="text" placeholder="gpt-4o-mini" value="' + (cfg.model || '') + '" ' +
            'style="flex:1;min-width:140px;padding:7px 10px;border-radius:7px;' +
            'background:rgba(0,0,0,.25);color:var(--text-primary);border:1px solid var(--border);font-family:inherit;font-size:13px">' +
            '</div>' +

            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">' +
            '<label style="font-size:12.5px;color:var(--text-sec);min-width:56px">API Key</label>' +
            '<input id="yllmKey" type="password" placeholder="sk-..." value="' + (cfg.apiKey || '') + '" ' +
            'style="flex:1;min-width:200px;padding:7px 10px;border-radius:7px;' +
            'background:rgba(0,0,0,.25);color:var(--text-primary);border:1px solid var(--border);font-family:inherit;font-size:13px">' +
            '</div>' +

            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button id="yllmSave" style="padding:7px 16px;border-radius:7px;cursor:pointer;font-family:inherit;font-size:13px;' +
            'background:rgba(129,140,248,.22);color:var(--text-primary);border:1px solid var(--accent-purple)">保存</button>' +
            '<button id="yllmClear" style="padding:7px 16px;border-radius:7px;cursor:pointer;font-family:inherit;font-size:13px;' +
            'background:transparent;color:var(--accent-red);border:1px solid var(--border)">清除 Key</button>' +
            '<span id="yllmStatus" style="font-size:12.5px;color:var(--text-dim);align-self:center;margin-left:6px"></span>' +
            '</div>' +
            '</div>';

        var provSel = host.querySelector('#yllmProv');
        var epInput = host.querySelector('#yllmEndpoint');
        var mdInput = host.querySelector('#yllmModel');

        /* 切换服务商时自动填入该服务商的默认地址与模型 */
        provSel.addEventListener('change', function () {
            var p = PROVIDERS[provSel.value];
            if (p && p.endpoint) epInput.value = p.endpoint;
            if (p && p.defaultModel) mdInput.value = p.defaultModel;
        });

        host.querySelector('#yllmSave').addEventListener('click', function () {
            setConfig({
                provider: provSel.value,
                endpoint: epInput.value.trim(),
                model: mdInput.value.trim(),
                apiKey: host.querySelector('#yllmKey').value.trim()
            });
            host.querySelector('#yllmStatus').textContent = '✅ 已保存到本浏览器';
        });

        host.querySelector('#yllmClear').addEventListener('click', function () {
            try { localStorage.removeItem(KEY_STORE); } catch (e) {}
            epInput.value = ''; mdInput.value = '';
            host.querySelector('#yllmKey').value = '';
            host.querySelector('#yllmStatus').textContent = '已清除，AI 功能已停用';
        });
    }

    return {
        explain: explain,
        preview: preview,
        renderSettings: renderSettings,
        getConfig: getConfig,
        isEnabled: isEnabled,
        PROVIDERS: PROVIDERS,
        SYSTEM_PROMPT: SYSTEM_PROMPT
    };
})();
