/* ============================================================
 * Y.Mine Validation Hub · 星空背景引擎
 * ------------------------------------------------------------
 * 此前 draw()/resize() 这对函数在 5 个 HTML 里逐字重复 5 遍。
 * 现在统一到一处：传入 canvas 元素即可，自动接管尺寸与动画循环。
 *
 * 用法（非 module 页面）：
 *   <canvas id="stars"></canvas>
 *   <script src="src/starfield.js"></script>
 *   <script>Starfield.mount('#stars');</script>
 *
 * 可选参数：Starfield.mount('#stars', { count: 180, radiusMax: 1.6 })
 * ============================================================ */

var Starfield = (function () {
    'use strict';

    var DEFAULTS = {
        count: 180,
        colors: ['#ffffff', '#c7d2fe', '#93c5fd', '#c4b5fd'],
        radiusMin: 0.2,
        radiusMax: 1.6,
        speedMin: 0.005,
        speedMax: 0.025,
        alphaFloor: 0.1   /* 避免星点完全消失导致闪烁 */
    };

    function mount(target, opts) {
        var cfg = Object.assign({}, DEFAULTS, opts || {});
        var canvas = typeof target === 'string' ? document.querySelector(target) : target;
        if (!canvas) return null;

        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var stars = [];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function seed() {
            stars = [];
            for (var i = 0; i < cfg.count; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: Math.random() * (cfg.radiusMax - cfg.radiusMin) + cfg.radiusMin,
                    a: Math.random(),
                    s: Math.random() * (cfg.speedMax - cfg.speedMin) + cfg.speedMin,
                    c: cfg.colors[Math.floor(Math.random() * cfg.colors.length)]
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach(function (s) {
                s.a += s.s;
                if (s.a > 1 || s.a < 0) s.s = -s.s;          /* 呼吸式明暗 */
                ctx.globalAlpha = Math.max(cfg.alphaFloor, s.a);
                ctx.fillStyle = s.c;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }

        resize();
        seed();
        draw();

        window.addEventListener('resize', function () {
            resize();
            seed();   /* 尺寸变化后重新播撒，避免星点挤在一角 */
        });

        return { canvas: canvas, restart: seed };
    }

    return { mount: mount, DEFAULTS: DEFAULTS };
})();
