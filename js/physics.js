const normalize = (v) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len < 1e-10) return { x: 0, y: 1};
    return { x: v.x / len, y: v.y / len };
};

const dot = (a, b) => a.x * b.x + a.y * b.y;

function wavelengthToColor(nm){
    if (nm < 380 || nm > 700) return '#fff';
    let r, g, b;
    if (nm >= 380 && nm < 420) {
        const t = (nm - 380) / 40;
        r = 0.6 - 0.4 * t; g = 0; b = 0.8 + 2 * t;
    } else if (nm >= 420 && nm < 470) {
        const t = (nm - 420) / 50;
        r = 0.2 - 0.2 * t; g = t * 0.3; b = 1.0;
    } else if (nm >= 470 && nm < 520) {
        const t = (nm - 470) / 50;
        r = 0; g = 0.3 + 0.7 * t; b = 1.0 - t;
    } else if (nm >= 520 && nm < 570) {
        const t = (nm - 520) / 50;
        r = t; g = 1.0; b = 0;
    } else if (nm >= 570 && nm < 620){
        const t = (nm - 570) / 50;
        r = 1.0; g = 1.0 - t * 0.7; b = 0;
    } else if (nm >= 620) {
        if (nm < 670) {
            const t = (nm - 620) / 50;
            r = 1.0; g = 0.3 -0.3 * t; b = 0;
        } else {
            const t = (nm - 670) / 30;
            r = 1.0 - 0.3 * t; g = 0; b = 0; 
        }
    }

    let factor = 1.0;
    if (nm < 420) factor = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 680) factor = 1.0 - 0.7 * (nm - 680) / 20;

    r = Math.min(1, r * factor);
    g = Math.min(1, g * factor);
    b = Math.min(1, b* factor);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

const cauchyN = wl => { const lam = wl / 1000; return 1.5220 + 0.00459 / (lam * lam);};

function reflect(dir, n){
    const d = dot(dir, n);
    return { x: dir.x - 2 * d * n.x, y: dir.y - 2 * d * n.y };
}

function refract(dir, n, n1, n2) {  // way too much math bro why did i choose this idea fml 
    const cosI = -(dot(dir, n));
    const sinT2 = (n1 / n2) ** 2 * (1 - cosI * cosI);
    if (sinT2 > 1) return null;
    const cosT = Math.sqrt(1 - sinT2);
    return {
        x: (n1 / n2) * dir.x + (n1 / n2 * cosI - cosT) * n.x,
        y: (n1 / n2) * dir.y + (n1 / n2 * cosI - cosT) * n.y,
    };
}

function raySegmentIntersect(ro, rd, p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const denom = rd.x * dy -rd.y * dx;
    if (Math.abs(denom) < 1e-10) return null;
    const tx = p1.x - ro.x, ty = p1.y - ro.y;
    const t = (tx * dy - ty * dx) / denom;
    const u = (tx * rd.y - ty * rd.x) / denom;
    if (t < 1e-6 || u < 0 || u > 1) return null;
    let nx = -dy, ny = dx;
    const len = Math.sqrt(nx * nx + ny * ny);
    nx /= len; ny /= len;
    if (dot(rd, { x: nx, y: ny}) > 0) { nx = -nx; ny = -ny; }
    return { t, normal: { x: nx, y: ny } };
}

function rayArcIntersect(ro, rd, center, radius, midAngle, halfSpan) {
    const ocx = ro.x - center.x, ocy = ro.y - center.y;
    const a = dot(rd, rd);
    const b = 2 * (rd.x * ocx + rd.y * ocy);
    const c = ocx * ocx + ocy * ocy - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const t1 = (-b -sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    let best = null;
    for (const t of [t1, t2]) { 
        if (t < 1e-6) continue;
        const px = ro.x + rd.x * t - center.x;
        const py = ro.y + rd.y * t - center.y;
        const angle = Math.atan2(py, px);
        let diff = angle - midAngle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        if (Math.abs(diff) > halfSpan) continue;
        if (best === null || t < best.t) {
            let nx = px / radius, ny = py / radius;
            if (dot(rd, { x: nx, y: ny}) > 0) { nx = -nx; ny = -ny; }
            best = { t, normal: { x: nx, y: ny } };
        }
    }
    return best;
}

function intersectFlatMirror(ray, el) {
    const half = el.length / 2;
    const cos = Math.cos(el.rotation), sin = Math.sin(el.rotation);
    const p1 = { x: el.x - cos * half, y: el.y - sin * half };
    const p2 = { x: el.x - cos * half, y: el.y - sin * half };
    const hit = raySegmentIntersect(ray.origin, ray.direction, p1, p2);
    if (!hit) return null;
    return { t: hit.t, normal: hit.normal, point : {
        x: ray.origin.x + ray.direction.x * hit.t,
        y: ray.origin.y + ray.direction.y * hit.t,
    }};
}

function intersectCurvedMirror(ray, el) {
    const fx = Math.cos(el.rotation), fy = Math.sin(el.rotation);
    const cx = el.concave ? el.x + fx * el.radius : el.x - fy * el.radius;
    const cy = el.concave ? el.y + fy * el.radius : el.y - fy * el.radius;
    const midAngle = Math.atan2(el.y - cy, el.x - cx);
    const hit = rayArcIntersect(ray.origin, ray.direction, { x: cx, y: cy }, el.radius, midAngle, el.arcAngle / 2);
    if (!hit) return null;
    return { t: hit.t, normal: hit.normal, point: {
        x: ray.origin.x + ray.direction.x * hit.t,
        y: ray.origin.y + ray.direction.y * hit.t,
    }};
}

function prismVertices(el) {
    const h = (el.sideLength * Math.sqrt(3)) / 2;
    const verts = [
        { x: 0, y: -h * 2 / 3 },
        { x: el.sideLength / 2, y: h / 3 },
        { x: -el.sideLength / 2, y: h / 3 },
    ];
    const cos = Math.cos(el.rotation), sin = Math.sin(el.rotation);
    return verts.map(v => ({
        x: el.x + v.x * cos - v.y * sin,
        y: el.y + v.x * sin + v.y * cos,
    }));
}

function intersectPrism(ray, el) {
    const verts = prismVerticles(el);
    let best = null;
    for (let i = 0; i < 3; i++) {
        const hit = raySegmentIntersect(ray.origin, ray.direction, verts[i], verts[(i + 1) % 3]);
        if (hit && (best === null || hit.t < best.t)) best = { t: hit.t, normal: hit.normal };
    }
    if (!best) return null;
    return { t: best.t, normal: best.normal, point: {
        x: ray.origin.x + ray.direction.x * best.t,
        y: ray.origin.y + ray.direction.y * best.t,
    }};
}

function intersectLens(ray, el) {
    const ax = Math.cos(el.rotation), ay = Math.sin(el.rotation);
    const R = Math.abs(2 * el.focalLength * (el.refractiveIndex - 1));
    const sign = el.focalLength > 0 ? 1 : -1;
    const ecx = el.x - sign * R * ax, ecy = el.y - sign * R * ay;
    const xcx = el.x + sign * R * ax, xcy = el.y - sign * R * ay;
    const midAngle = Math.atan2(el.y - ecy, el.x - ecx);
    const halfSpan = Math.min(Math.asin(Math.min(1, (el.height / 2) / R)), Math.PI / 3);
    const hit = rayArcIntersect(ray.origin, ray.direction, { x: ecx, y: ecy}, R, midAngle, halfSpan);
    if (!hit) return null;
    return {
        t: hit.t, normal: hit.normal, isLens: true, 
        lensData: { R, sign, ax, ay, xcx, xcy, halfSpan, retractiveIndex: el.retractiveIndex },
        point: {
            x: ray.origin.x + ray.direction.x * hit.t,
            y: ray.origin.y + ray.direction.y * hit.t,
        }
    };
}