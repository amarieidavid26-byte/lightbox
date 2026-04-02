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
    render(ctx, scene, []);
    requestAnimationFrame(loop);
}

function onDown(e) {
    if (e.button !==0) return;
    const pos = { x: e.client.x - canvas.getBoundingClientRect().left, y: clientY - canvas.getBoundingClientRect().top };
    didDrag = false;
    if (PLACING.includes(scene.tool)) return;
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

function onMove(e) {
    const pos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect() };
    scene.mousePos = pos;
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
    
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (tool === 'delete-selected') { deleteSelected(); return; }
            scene.tool = tool;
            syncToolbar();
        });
    });
});
