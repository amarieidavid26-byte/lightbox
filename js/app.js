class Ray {
    constructor(origin, direction, wavelength = null, intensity = 1.0) {
        this.origin = { ...origin };
        this.direction = normalize(direction);
        this.wavelength = wavelength;
        this.intensity = intensity;
        this.maxBounces = 50;
        this.color = wavelength ? wavelengthToColor(wavelength) : '#ffe066';
    }
}

const scene = {
    elements: [],
    lights: [],
    selectedId: null,
    dragging: null,
    rotating: false,
    tool: 'select',
    showGrid: true,
    mousePos: { x: 0, y: 0 },
};

let canvas, ctx, dpr;

const PLACING = ['point-source', 'laser-beam', 'flat-mirror', 'curved-mirror', 'lens', 'prism'];

let _id = 0;

let dragStart = null, dragOrig = null, didDrag = false; 

function placeEl(type, pos){
    const id = 'e' + _id++;
    let el;
    switch (type) {
        case 'point-source':
        case 'laser-beam':
            el = { type, id, x: pos.x, y: pos.y, rotation: 0,
                ...(type === 'point-source' ? { rayCount: 64 } : {}),
                wavelength:null, intensity: 1.0 };
            scene.lights.push(el);
            break;
        case 'flat-mirror':
            scene.elements.push({ type, id, x: pos.x, y: pos.y, rotation: 0, length: 120, reflectivity: 1.0 });
            scene.selectedId = id;
            scene.tool = 'select';
            syncToolbar();
            return;
        case 'curved-mirror':
            el = { type, id, x: pos.x, y: pos.y, rotation: 0, radius: 200, arcAngle: Math.PI / 3, concave: true, reflectivity: 1.0 };
            scene.elements.push(el);
            break;
        case 'lens':
            el = { type, id, x: pos.x, y: pos.y, rotation: 0, height: 100, focalLength: 150, refractiveIndex: 1.5 };
            scene.elements.push(el);
            break;
        case 'prism':
            el = { type , id, x: pos.x, y: pos.y, rotation: 0, sideLength: 80, refractiveIndex: 1.52, dispersive: true };
            scene.elements.push(el);
            break;
    }
    if (el) {
        scene.selectedId = el.id;
        scene.tool = 'select';
        syncToolbar();
    }
}

function hitTest(pos, el) {
    const dx = pos.x - el.x, dy = pos.y - el.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    switch (el.type) {
        case 'point-source': return dist < 18;
        case 'laser-beam': return dist < 18;
        case 'flat-mirror': {
            const along = dx * Math.cos(el.rotation) + dy * Math.sin(el.rotation);
            const perp = Math.abs(-dx * Math.sin(el.rotation) + dy * Math.cos(el.rotation));
            return perp < 12 && Math.abs(along) <= el.length / 2 + 5;
        }
        case 'curved-mirror': return dist < 32;
        case 'lens': return dist < 22;
        case 'prism': return dist < el.sideLength * 0.65;
        default: return dist < 20;
    }
}

function intersect(ray, el) {
    switch (el.type) {
        case 'flat-mirror': return intersectFlatMirror(ray, el);
        case 'curved-mirror': return intersectCurvedMirror(ray, el);
        case 'prism': return intersectPrism(ray, el);
        case 'lens': return intersectLens(ray, el);
        default: return null;
    }
}

function handleLens(ray, hit, endpoint, elements, depth, eps) {
    const el = hit.element;
    const { R, xcx, xcy, halfSpan, refractiveIndex } = hit.lensData;
    const segs = [];
    
    const r1 = refract(ray.direction, hit.normal, 1.0, refractiveIndex);
    if (!r1) return segs;

    const d1 = normalize(r1);
    const io = { x: endpoint.x + d1.x * eps, y: endpoint.y + d1.y * eps };

    const ox = io.x, oy = io.y;
    const dx = d1.x, dy = d1.y;
    const ocx = ox - xcx, ocy = oy - xcy;
    const qa = dx * dx + dy * dy;
    const qb = 2 * (dx * ocx + dy * ocy);
    const qc = ocx * ocx + ocy * ocy - R * R;
    const disc = qb * qb - 4 * qa * qc;

    if (disc < 0) {
        segs.push({ from: io, to: { x: io.x + d1.x * 200, y: io.y + d1.y * 200 }, color: ray.color, intensity: ray.intensity * 0.5 });
        segs.push(...castRay(new Ray({ ...io }, d1, ray.wavelength, ray.intensity * 0.9), elements, depth + 1, el.id));
        return segs; 
    }

    const sq = Math.sqrt(disc);
    const exitMid = Math.atan2(el.y - xcy, el.x - xcx);

    let exitT = null, exitN = null;
    for (const t of [(-qb - sq) / (2 * qa), (-qb + sq) / (2* qa)]) {
        if (t < 0.01) continue;
        const px = ox + dx * t - xcx;
        const py = oy + dy * t - xcy;
        const angle = Math.atan2(py, px);
        let diff = angle - exitMid;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        if (Math.abs(diff) > halfSpan) continue;
        let nx = px / R, ny = py / R;
        if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; }
        exitT = t; exitN = { x: nx, y: ny };
        break;
    }
    if (exitT === null) {
        segs.push(...castRay(new Ray({ ...io }, d1, ray.wavelength, ray.intensity * 0.9), elements, depth + 1, el.id));
        return segs;
    }

    const ep = { x: ox + dx * exitT, y: oy + dy * exitT };
    segs.push({ from: io, to: ep, color: ray.color, intensity: ray.intensity * 0.75 });

    const r2 = refract(d1, exitN, refractiveIndex, 1.0);
    if (!r2) {
        const rd = normalize(reflect(d1, exitN));
        segs.push(...castRay(
            new Ray({ x: ep.x + rd.x * eps, y: ep.y + rd.y * eps }, rd, ray.wavelength, ray.intensity * 0.9),
            elements, depth + 1, el.id
        ));
        return segs;
    }

    const fd = normalize(r2);
    segs.push(...castRay(
        new Ray({ x: ep.x + fd.x * eps, y: ep.y + fd.y * eps }, fd, ray.wavelength, ray.intensity * 0.95),
        elements, depth + 1, el.id
    ));
    return segs;
}

function castRay(ray, elements, depth, sourceId) {
    if (depth >= ray.maxBounces || ray.intensity < 0.03) return [];

    let nearest = null, nearestT = Infinity;
    for (const el of elements) {
        if (el.id === sourceId) continue;
        const hit = intersect(ray, el);
        if (hit && hit.t > 0.01 && hit.t < nearestT) {
            nearest = { ...hit, element: el };
            nearestT = hit.t;
        }
    }
    
    const endpoint = nearest
    ? { x: ray.origin.x + ray.direction.x * nearestT, y: ray.origin.y + ray.direction.y * nearestT }
    : { x: ray.origin.x + ray.direction.x * 5000, y: ray.origin.y + ray.direction.y * 5000 };

    const segs = [{ from: { ...ray.origin }, to: { ...endpoint }, color: ray.color, intensity: ray.intensity }];
    if (!nearest) return segs;

    const el = nearest.element;
    const normal = nearest.normal;
    const eps = 0.8;

    if (el.type === 'flat-mirror' || el.type === 'curved-mirror') {
        const rd = normalize(reflect(ray.direction, normal));
        const child = new Ray(
            { x: endpoint.x + rd.x * eps, y: endpoint.y + rd.y * eps },
            rd, ray.wavelength, ray.intensity * (el.reflectivity || 1.0)
        );
        segs.push(...castRay(child, elements, depth + 1, el.id));
        return segs;
    }
    
    if (el.type === 'prism') {
        const inside = insidePrism(ray.origin, el);

        if (!inside && ray.wavelength === null && el.dispersive) {
           for (const wl of SPECTRUM) {
                const refracted = refract(ray.direction, normal, 1.0, cauchyN(wl));
                if (refracted) {
                const rd = normalize(refracted);
                const child = new Ray(
                    { x: endpoint.x + rd.x * eps, y: endpoint.y + rd.y * eps },
                    rd, wl, ray.intensity / SPECTRUM.length
                );
                segs.push(...castRay(child, elements, depth + 1, el.id));
                }
           }
           return segs;
        }
        const n1 = inside ? (ray.wavelength ? cauchyN(ray.wavelength) : el.refractiveIndex) : 1.0;
        const n2 = inside ? 1.0 : (ray.wavelength ? cauchyN(ray.wavelength) : el.refractiveIndex);
        const refracted = refract(ray.direction, normal, n1, n2);
        if (refracted) {
            const rd = normalize(refracted);
            segs.push(...castRay(
                new Ray({ x: endpoint.x + rd.x * eps, y: endpoint.y + rd.y * eps }, rd, ray.wavelength, ray.intensity * 0.97),
                elements, depth + 1, el.id
            ));
        } else {
            const rd = normalize(reflect(ray.direction, normal));
            segs.push(...castRay(
                new Ray ({ x: endpoint.x + rd.x * eps, y: endpoint.y + rd.y * eps }, rd, ray.wavelength, ray.intensity * 0.99),
                elements, depth + 1, el.id
            ));
        }
        return segs;
    }

    if (el.type === 'lens') {
        if (!nearest.lensData) return segs;
        segs.push(...handleLens(ray, nearest, endpoint, elements, depth, eps));
        return segs;
    }

    return segs;
}

function insidePrism(point, el) {
    const verts = prismVertices(el);
    let sign = null;
    for (let i = 0; i < 3; i++) {
        const p1 = verts[i], p2 = verts[(i + 1) % 3];
        const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
        const s = cross > 0;
        if (sign === null) sign = s;
        else if (s !== sign) return false; 
    }
    return true;
}

const SPECTRUM = [380, 430, 470, 510, 550, 590, 630, 670];

function computeRays() {
    const segs = [];
    for (const light of scene.lights) {
        if (light.type === 'point-source') {
            const count = light.rayCount || 64;
            for (let i = 0; i < count; i++) {
                const angle = (2 * Math.PI * i) / count;
                segs.push(...castRay(
                    new Ray({ x: light.x, y: light.y }, { x: Math.cos(angle), y: Math.sin(angle) }, light.wavelength, light.intensity),
                    scene.elements, 0, light.id
                ));
            }
        } else if (light.type === 'laser-beam') {
            segs.push(...castRay(
                new Ray({ x: light.x, y: light.y }, { x: Math.cos(light.rotation), y: Math.sin(light.rotation) }, light.wavelength, light.intensity),
                scene.elements, 0, light.id
            ));
        }
    }
    return segs;
}

function elementAt(pos) {
    const all = [...scene.lights, ...scene.elements];
    for (let i = all.length - 1; i >= 0; i--) {
        if (hitTest(pos, all[i])) return all[i];
    }
    return null;
}

function findById(id) {
   return [...scene.elements, ...scene.lights].find(e => e.id === id) || null;
}

function deleteSelected() {
    if (!scene.selectedId) return;
    scene.elements = scene.elements.filter(e => e.id !== scene.selectedId);
    scene.lights = scene.lights.filter(e => e.id !== scene.selectedId);
    scene.selectedId = null
}

function syncToolbar() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === scene.tool);
    });
}

function loop() {
    const lw = canvas.clientWidth, lh = canvas.clientHeight;
    if (canvas.width !== Math.round(lw * dpr) || canvas.height !== Math.round(lh * dpr)) {
        canvas.width = Math.round(lw * dpr);
        canvas.height = Math.round(lh * dpr);
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
    render(ctx, scene, computeRays());
    requestAnimationFrame(loop);
}

function onDown(e) {
    if (e.button !==0) return;
    const pos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
    didDrag = false;

    if (PLACING.includes(scene.tool)) return;

    if (scene.selectedId) {
        const el = findById(scene.selectedId);
        if(el) {
            const h = getRotationHandlePos(el);
            if (Math.hypot(pos.x - h.x, pos.y - h.y) < 14) {
                scene.rotating = true;
                return;
            }
        }
    }
    const el = elementAt(pos);
    if (el) {
        scene.selectedId = el.id;
        scene.dragging = el.id;
        dragStart = pos;
        dragOrig = { x: el.x, y: el.y };
    } else {
        scene.selectedId = null;
        scene.dragging = null;
    }
}

function onDbl(e) {
    if (!scene.selectedId) return;
    const el = findById(scene.selectedId);
    if (!el) return;
    if (el.type === 'curved-mirror') el.concave = !el.concave;
    else if (el.type === 'lens') el.focalLength = -el.focalLength;
}

function onMove(e) {
    const pos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
    scene.mousePos = pos;

    if (scene.rotating && scene.selectedId) {
        const el = findById(scene.selectedId);
        if (el) {
            el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x);
            if (el.type !== 'laser-beam') el.rotation += Math.PI / 2;
            if (e.shiftKey) {
                const snap = Math.PI / 12;
                el.rotation = Math.round(el.rotation / snap) * snap;
            }
            didDrag = true;
        }
        return;
    }
    if (scene.dragging) {
        const el = findById(scene.dragging);
        if (el && dragStart) {
            const ddx = pos.x - dragStart.x, ddy = pos.y - dragStart.y;
            if (Math.hypot(ddx, ddy) > 2) didDrag = true;
            el.x = dragOrig.x + ddx;
            el.y = dragOrig.y + ddy;
        }
    }
}


function onUp(e) {
    if (e.button !==0) return;
    const pos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };

    if (scene.rotating) { scene.rotating = false; return; }

    if (PLACING.includes(scene.tool)) {
        placeEl(scene.tool, pos);
        return;
    }

    scene.dragging = null;
    dragStart = null;
    dragOrig = null;
}

function onKey(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input')) {
        deleteSelected();
    }
    if (e.key === 'Escape') {
        scene.tool = 'select';
        scene.selectedId = null;
        syncToolbar();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('canvas');
    dpr = window.devicePixelRatio || 1;

    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);

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

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('dblclick', onDbl);
    
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (tool === 'delete-selected') { deleteSelected(); return; }
            scene.tool = tool;
            syncToolbar();
        });
    });
});
