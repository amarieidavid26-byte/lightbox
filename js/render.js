function render(ctx, scene, segs) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);
    if (scene.showGrid) drawGrid(ctx, w, h);
}

function drawGrid(ctx, w, h) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let x = 30; x < w; x += 30) {
        for (let y = 30; y < h; y += 30) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
