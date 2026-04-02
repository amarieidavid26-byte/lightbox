function render(ctx, scene, segs) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);
    if (scene.showGrid) drawGrid(ctx, w, h);
    const all = [...scene.elements, ...scene.lights];
    for (const el of all) drawElement(ctx, el, el.id === scene.selectedId);
}

function drawElement(ctx, el, selected) {
    ctx.save();
    switch (el.type) {
        case 'flat-mirror': drawFlatMirror(ctx, el, selected); break;
        case 'curved-mirror': drawCurvedMirror(ctx, el, selected); break;
        case 'lens': drawLens(ctx, el, selected); break;
        case 'prism': drawPrism(ctx, el, selected); break;
        case 'point-source': drawPointSource(ctx, el, selected); break;
        case 'laser-beam': drawLaserBeam(ctx, el, selected); break;
    }
    ctx.restore();
}

function drawFlatMirror(ctx, el, selected) {
    const half = el.length / 2;
    const cos = Math.cos(el.rotation), sin = Math.sin(el.rotation);
    const p1 = { x: el.x - cos * half, y: el.y - sin * half };
    const p2 = { x: el.x + cos * half, y: el.y + sin * half };

    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? '#4491e8' : '#aaaacc';
    ctx.shadowBlur = selected ? 6 : 0;
    ctx.shadowColor = '#4491e8';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const nx = -sin, ny = cos;
    const numTicks = Math.floor(el.length / 12);
    ctx.strokeStyle = selected ? 'rgba(68,145,232,0.5)' : 'rgba(136,136,170,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numTicks; i++) {
        const t = -half + (el.length / numTicks) * i;
        const tx = el.x + cos * t, ty = el.y + sin * t;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + nx * 6, ty + ny * 6);
        ctx.stroke();
    }
}

function drawCurvedMirror(ctx, el, selected) {
    const fx = Math.cos(el.rotation), fy = Math.sin(el.rotation);
    const cx = el.concave ? el.x + fx * el.radius : el.x - fx * el.radius;
    const cy = el.concave ? el.y + fy * el.radius : el.y - fy * el.radius;
    const mid = Math.atan2(el.y - cy, el.x - cx);
    const start = mid - el.arcAngle / 2;
    const end = mid + el.arcAngle / 2;

    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? '#4491e8' : '#aaaacc';
    ctx.shadowBlur = selected ? 6 : 0;
    ctx.shadowColor = '#4491e8';
    ctx.beginPath();
    ctx.arc(cx, cy, el.radius, start, end);
    ctx.stroke();

    ctx.strokeStyle = selected ? 'rgba(68,145,232,0.4)' : 'rgba(136,136,170,0.35)';
    ctx.lineWidth = 1;
    for (i = 0; i <= 8; i++) {
        const a = start + (el.arcAngle / 8) * i;
        const px = cx + el.radius * Math.cos(a);
        const py = cy + el.radius * Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(a) * 7, py - Math.sin(a) * 7);
        ctx.stroke();
    }
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

function drawLens(ctx, el, selected) {
    const R = Math.abs(2 * el.focalLength * (el.refractiveIndex - 1));
    const sign = el.focalLength > 0 ? 1 : -1;
    const half = el.height / 2;

    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate(el.rotation);

    ctx.strokeStyle = selected ? '#4491e8' : '#88aadd';
    ctx.fillStyle = selected ? 'rgba(68,145,232,0.1)' : 'rgba(100,150,220,0.10)';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.shadowBlur = selected ? 8 : 3;
    ctx.shadowColor = selected ? '#4491e8' : 'rgba(100,150,220,0.6)';

    const arcHalf = Math.asin(Math.min(0.99, half / R));
    const sag = R * (1 - Math.cos(arcHalf));

    ctx.beginPath();
    if (sign > 0) {
        ctx.arc(-(R - sag), 0, R, -arcHalf, arcHalf);
        ctx.arc(R - sag, 0, R, Math.PI - arcHalf, Math.PI + arcHalf, false);
    } else {
        ctx.arc(R - sag, 0, R, Math.PI - arcHalf, Math.PI + arcHalf, false);
        ctx.arc(-(R - sag), 0, R, -arcHalf, arcHalf);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawPrism(ctx, el, selected) {
    const verts = prismVertices(el);
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.strokeStyle = selected ? '#4491e8' : '#88aacc';
    ctx.fillStyle = selected ? 'rgba(68,145,232,0.08)' : 'rgba(120,160,220,0.08)';
    ctx.shadowBlur = selected ? 8 : 3;
    ctx.shadowColor = selected ? '#4491e8' : 'rgba(120,160,220,0.4)';
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawPointSource(ctx, el, selected) {
    ctx.strokeStyle = selected ? '#4491e8' : '#ffe066';
    ctx.fillStyle = selected ? 'rgba(68,145,232,0.2)' : 'rgba(255,224,102,0.15)';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = selected ? '#4491e8' : '#ffe066';
    ctx.beginPath();
    ctx.arc(el.x, el.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (let i=0; i < 8; i++) {
        const angle = (2 * Math.PI * i) / 8;
        ctx.beginPath();
        ctx.moveTo(el.x + Math.cos(angle) * 13, el.y + Math.sin(angle) * 13);
        ctx.lineTo(el.x + Math.cos(angle) * 19, el.y + Math.sin(angle) * 19);
        ctx.stroke();
    }
}

function drawLaserBeam(ctx, el, selected) {
    ctx.strokeStyle = selected ? '#4491e8' : '#ffe066';
    ctx.fillStyle = selected ? 'rgba(68,145,232,0.2)' : 'rgba(255,224,102,0.15)';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = selected ? '#4491e8' : '#ffe066';

    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate(el.rotation);

    ctx.beginPath();
    ctx.roundRect(-14, -14 / 2.5, 14 * 1.5, 14 / 1.25, 3);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14 * 1.5, 0);
    ctx.lineTo(14 * 0.8, -7);
    ctx.lineTo(14 * 0.8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
