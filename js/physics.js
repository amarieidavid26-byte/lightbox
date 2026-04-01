const normalize = (v) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len < 1e-10) return { x: 0, y: 1};
    return { x: v.x / len, y: v.y / len };
};

const dot = (a, b) => a.x * b.x + a.y * b.y;

function wavelenghtToColor(nm){
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

