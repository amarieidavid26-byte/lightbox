let canvas, ctx, dpr;

function loop() {
    const lw = canvas.clientWidth, lh = canvas.clientHeight;
    if (canvas.width !== Math.round(lw * dpr) || canvas.height !== Math.round(lh * dpr)) {
        canvas.width = Math.round(lw * dpr);
        canvas.height = Math.round(lh * dpr);
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
    render(ctx, { elements: [], lights: [], showGrid: true }, []);
    requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('canvas');
    dpr = window.devicePixelRatio || 1;

    function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);
    loop();
});
