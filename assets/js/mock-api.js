/**
 * ============================================================
 *  Mock API · 模拟后端服务
 *  用途：为纯前端 Demo 增加真实的异步交互体验
 *  特点：支持 loading 状态、延迟响应、错误模拟、状态追踪
 * ============================================================
 */

const MockAPI = (function() {
    'use strict';

    // ============================================================
    //  配置
    // ============================================================
    const CONFIG = {
        // 默认延迟时间（毫秒）
        defaultDelay: 1500,
        // 是否随机模拟失败（用于测试错误处理，默认关闭）
        randomFailRate: 0,
        // 日志开关
        debug: true
    };

    // ============================================================
    //  状态追踪
    // ============================================================
    const _pendingRequests = new Map();
    let _requestId = 0;

    // ============================================================
    //  工具函数
    // ============================================================
    function _log(msg, type = 'info') {
        if (!CONFIG.debug) return;
        const prefix = '[MockAPI]';
        const styles = {
            info: 'color: #60a5fa;',
            success: 'color: #34d399; font-weight: bold;',
            error: 'color: #f87171; font-weight: bold;',
            warn: 'color: #fbbf24;'
        };
        console.log(`%c${prefix} ${msg}`, styles[type] || styles.info);
    }

    function _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function _generateId() {
        return 'req_' + (++_requestId) + '_' + Date.now().toString(36);
    }

    // ============================================================
    //  核心 API 方法
    // ============================================================

    /**
     * 模拟 POST 请求 - 重置实验
     * 功能：清空实验数据，重置状态
     * 响应：返回重置后的状态摘要
     */
    async function resetExperiment(payload = {}) {
        const requestId = _generateId();
        const delay = payload.delay || CONFIG.defaultDelay;

        _log(`📤 [${requestId}] 发送重置实验请求...`, 'info');

        // 模拟随机失败（用于测试错误处理）
        if (Math.random() < CONFIG.randomFailRate) {
            _log(`❌ [${requestId}] 请求失败 (随机模拟)`, 'error');
            throw new Error('模拟服务器错误：请求超时或服务不可用');
        }

        // 模拟网络延迟
        await _sleep(delay);

        // 模拟成功响应
        const response = {
            success: true,
            code: 200,
            message: '实验已成功重置',
            timestamp: new Date().toISOString(),
            requestId: requestId,
            data: {
                status: 'reset',
                usersCleared: true,
                historySaved: true,
                timestamp: Date.now()
            }
        };

        _log(`✅ [${requestId}] 重置成功 (耗时 ${delay}ms)`, 'success');
        return response;
    }

    /**
     * 模拟 GET 请求 - 获取实验状态
     * 用途：轮询或刷新当前实验信息
     */
    async function getExperimentStatus(payload = {}) {
        const requestId = _generateId();
        const delay = payload.delay || 600;

        _log(`📤 [${requestId}] 获取实验状态...`, 'info');
        await _sleep(delay);

        return {
            success: true,
            code: 200,
            requestId: requestId,
            data: {
                status: 'active',
                users: 0,
                conversions: 0,
                lastUpdated: new Date().toISOString()
            }
        };
    }

    /**
     * 模拟 POST 请求 - 导出报告
     * 用途：生成并返回实验报告数据
     */
    async function exportReport(payload = {}) {
        const requestId = _generateId();
        const delay = payload.delay || 2000;

        _log(`📤 [${requestId}] 导出报告...`, 'info');
        await _sleep(delay);

        return {
            success: true,
            code: 200,
            requestId: requestId,
            data: {
                reportUrl: '/reports/experiment_' + Date.now() + '.md',
                format: 'markdown',
                size: '12.4 KB'
            }
        };
    }

    /**
     * 模拟 GET 请求 - 健康检查
     * 用途：验证后端服务是否可用
     */
    async function healthCheck(payload = {}) {
        const delay = payload.delay || 300;
        await _sleep(delay);

        return {
            success: true,
            code: 200,
            status: 'healthy',
            version: '2.0.0',
            uptime: '72h'
        };
    }

    // ============================================================
    //  配置方法
    // ============================================================

    /**
     * 设置随机失败率 (0 ~ 1)
     * 用于测试错误处理逻辑
     */
    function setRandomFailRate(rate) {
        if (rate < 0 || rate > 1) {
            _log('⚠️ 失败率必须在 0 ~ 1 之间', 'warn');
            return;
        }
        CONFIG.randomFailRate = rate;
        _log(`🔧 随机失败率已设置为 ${(rate * 100).toFixed(0)}%`, 'warn');
    }

    /**
     * 开启/关闭调试日志
     */
    function setDebug(enabled) {
        CONFIG.debug = enabled;
        _log(`🔧 调试日志 ${enabled ? '已开启' : '已关闭'}`, 'info');
    }

    // ============================================================
    //  对外暴露
    // ============================================================

    return {
        // 核心 API
        resetExperiment,
        getExperimentStatus,
        exportReport,
        healthCheck,

        // 配置
        setRandomFailRate,
        setDebug,

        // 工具（外部可直接使用）
        sleep: _sleep,

        // 版本信息
        version: '1.0.0'
    };

})();

// ============================================================
//  如果环境支持模块导出，则导出（用于 Node/打包工具）
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockAPI;
}

// ============================================================
//  全局挂载（浏览器环境）
// ============================================================
if (typeof window !== 'undefined') {
    window.MockAPI = MockAPI;
    console.log('%c🧪 MockAPI 已加载，版本 ' + MockAPI.version, 'color: #60a5fa; font-weight: bold;');
    console.log('%c💡 使用示例: await MockAPI.resetExperiment()', 'color: #94a3b8;');
}
