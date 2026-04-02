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
}

function deleteSelected() {}

function onUp(e) {
    if (e.button !==0) return;
    const pos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
    if (PLACING.includes(scene.tool)) {
        placeEl(scene.tool, pos);
    }
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
