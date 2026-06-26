// ============================================================================
// garden3d.js — full-screen 3D Word Garden (Three.js, voxel blocks)
// ============================================================================
// Loaded as an ES module from CDN (no build step — same mechanism as Supabase).
// The garden is a grid of Minecraft-style dirt+grass blocks; each word's plant
// (an emoji billboard sprite) stands on its own block. Flat solid colours, no
// gradients. Shop creatures wander with slow, varied behaviour.
//
// LAYOUT IS STORED, NOT DERIVED. Every plant and every placeable item remembers
// a fixed integer (col, grid_row). The rendered field is the bounding box of all
// entities + a 2-cell padding ring on each side (so there's always room to drag
// things around); dropping near an edge auto-grows the field next rebuild.
//
// Two layers per block:
//   • surface  — grass (default) | road | rail | water(pond) | stone(fountain)
//   • occupant — one of: plant | vehicle(car/train) | structure | (none)
// A car needs a road surface under it; a train needs a rail. One occupant per
// block, so a plant must be moved before its block can become a road/rail.
//
// createGarden(canvas, opts) → controller
//   opts.words     [{ id, word, review_level }]
//   opts.dueIds    Set of word ids needing water
//   opts.plantPos  Map<wordId,{col,row}>  stored plant positions (may be partial)
//   opts.placed    [{ id, code, col, row, rotation }]  placed items (positions set)
//   opts.items     [item_code, …]  legacy decorations (sky critters / gnome /
//                  pond / fountain / cottage) — duplicates allowed, they stack
//   opts.night / opts.warm  bool theme flags
//   opts.onPlantClick(wordId)               tap a plant (normal mode → review)
//   opts.onAssignHomes([{wordId,col,row}])  words that had no stored position
//   opts.onItemMoved(id,col,row,rotation)   a placed item was dropped/rotated
//   opts.onItemRemoved(id)                  a placed item was removed
//   opts.onPlantMoved(wordId,col,row)       a plant was dragged to a new block
//   opts.onSelectItem(id|null)              a placed item was selected/deselected
//   opts.onInvalidDrop(reason)              a drop was rejected (show a hint)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

import { masteryEmoji } from './srs.js';
import { SHOP } from './coins.js';
import { creatureSound, vehicleSound } from './audio.js';

const PHRASES = ['Great!', 'Yay!', 'Nice!', 'Wow!', 'Bloom! 🌸', 'Keep going!', 'Lovely!', 'Hello! 👋', 'So pretty!'];
const STRUCTURE_CODES = ['pond', 'fountain', 'cottage'];
const PAD = 2;                 // always keep 2 empty rings around the content
const SP  = 1.0;               // blocks sit flush, Minecraft-style
const TOP = 0.5;               // block top surface y
const cellKey = (c, r) => `${c}:${r}`;

export function createGarden(canvas, opts = {}) {
    const words   = opts.words || [];
    const dueIds  = opts.dueIds || new Set();
    const onClick = opts.onPlantClick || (() => {});
    const cb = {
        assignHomes: opts.onAssignHomes || (() => {}),
        itemMoved:   opts.onItemMoved   || (() => {}),
        itemRemoved: opts.onItemRemoved || (() => {}),
        plantMoved:  opts.onPlantMoved  || (() => {}),
        selectItem:  opts.onSelectItem  || (() => {}),
        invalidDrop: opts.onInvalidDrop || (() => {}),
    };
    let isNight = !!opts.night;
    let isWarm  = !!opts.warm;
    let arrange = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    // Flat lighting (no gradients). Warmer if "Sunny Day"; dimmer at night.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.82);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(6, 14, 8);
    scene.add(sunLight);
    function setTheme({ night = isNight, warm = isWarm } = {}) {
        isNight = !!night;
        isWarm = !!warm;
        ambientLight.intensity = isNight ? 0.55 : (isWarm ? 0.95 : 0.82);
        sunLight.color.set(isWarm && !isNight ? 0xfff0c0 : 0xffffff);
        sunLight.intensity = isNight ? 0.5 : 0.9;
        updateGnomeSleep();
        updateNightGlow();
    }

    // ── Materials & shared geometry ────────────────────────────────────────────
    const dirtMat     = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1, flatShading: true });
    const grassMat    = new THREE.MeshStandardMaterial({ color: 0x5fae3a, roughness: 1, flatShading: true });
    const grassMatAlt = new THREE.MeshStandardMaterial({ color: 0x69b943, roughness: 1, flatShading: true });
    const waterMat    = new THREE.MeshStandardMaterial({ color: 0x2f8fe8, roughness: 0.7, flatShading: true });
    const stoneMat    = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 1, flatShading: true });
    const roadMat     = new THREE.MeshStandardMaterial({ color: 0x4a4a4f, roughness: 1, flatShading: true });
    const lineMat     = new THREE.MeshStandardMaterial({ color: 0xf2c84b, roughness: 1, flatShading: true });
    const tieMat      = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1, flatShading: true });
    const railMat     = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.6, flatShading: true });
    const okMat       = new THREE.MeshStandardMaterial({ color: 0x35c759, transparent: true, opacity: 0.45 });
    const badMat      = new THREE.MeshStandardMaterial({ color: 0xff3b30, transparent: true, opacity: 0.45 });
    // BoxGeometry material order: +x,-x,+y(top),-y,+z,-z
    const blockMats = (top) => [dirtMat, dirtMat, top, dirtMat, dirtMat, dirtMat];
    const solidMats = (mat) => [mat, mat, mat, mat, mat, mat];
    const blockGeo  = new THREE.BoxGeometry(SP, 1, SP);
    const slabGeo   = new THREE.BoxGeometry(SP * 0.96, 0.1, SP * 0.96);

    // ── Voxel models (flat-colour boxes, no external assets) ────────────────────
    // Shared materials so rebuilds never dispose them (disposeGroup frees only the
    // per-box geometries). Models face +x and sit with their base on y = 0; the
    // caller positions the group on the block top. Windows tagged userData.glow
    // are swapped to a bright material at night (updateNightGlow).
    const flat = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true, ...extra });
    const PAL = {
        carBody: flat(0xe23b3b), carRoof: flat(0xb52d2d), tyre: flat(0x23282f), glass: flat(0x9fd8ff),
        headlight: flat(0xfff2a8), taillight: flat(0x8a1414),
        trainBody: flat(0x2f8f4e), trainRoof: flat(0x256b3c), trainTrim: flat(0xf2c84b), stack: flat(0x333a40),
        wall: flat(0xf3e6c4), roof: flat(0xc0432f), door: flat(0x6b4423), chimney: flat(0x8a5a2b),
        win: flat(0x9fd8ff), winGlow: flat(0xffd24a, { emissive: 0xffb300, emissiveIntensity: 0.9 }),
        stone: flat(0xc2c8d0), fwater: flat(0x3aa0f0, { transparent: true, opacity: 0.92 }),
        pole: flat(0x3a3f45),
        lampRed:   flat(0xff3b30, { emissive: 0xd42018, emissiveIntensity: 0.95 }),
        lampGreen: flat(0x35c759, { emissive: 0x1ea64a, emissiveIntensity: 0.95 }),
    };
    function vbox(group, w, h, d, x, y, z, mat, glow) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        if (glow) m.userData.glow = true;
        group.add(m);
        return m;
    }
    function buildCar() {
        const g = new THREE.Group();
        vbox(g, 0.74, 0.18, 0.42, 0, 0.17, 0, PAL.carBody);          // chassis
        vbox(g, 0.40, 0.16, 0.40, -0.04, 0.34, 0, PAL.glass);        // cabin glass
        vbox(g, 0.34, 0.07, 0.36, -0.04, 0.45, 0, PAL.carRoof);      // roof
        vbox(g, 0.10, 0.05, 0.44, 0.36, 0.18, 0, PAL.headlight);     // front lights (+x)
        vbox(g, 0.06, 0.05, 0.44, -0.37, 0.18, 0, PAL.taillight);    // rear lights
        for (const sx of [0.22, -0.22]) for (const sz of [0.23, -0.23]) vbox(g, 0.16, 0.16, 0.10, sx, 0.08, sz, PAL.tyre);
        return g;
    }
    function buildTrain() {
        const g = new THREE.Group();
        vbox(g, 0.80, 0.28, 0.44, -0.02, 0.24, 0, PAL.trainBody);    // boiler
        vbox(g, 0.28, 0.24, 0.42, -0.26, 0.48, 0, PAL.trainBody);    // cab
        vbox(g, 0.30, 0.06, 0.44, -0.26, 0.62, 0, PAL.trainRoof);    // cab roof
        vbox(g, 0.06, 0.10, 0.30, -0.12, 0.50, 0, PAL.glass);        // cab window
        vbox(g, 0.07, 0.22, 0.44, 0.40, 0.22, 0, PAL.trainTrim);     // front buffer (+x)
        vbox(g, 0.12, 0.18, 0.12, 0.22, 0.50, 0, PAL.stack);         // smokestack
        for (const sx of [-0.30, -0.08, 0.16, 0.34]) for (const sz of [0.24, -0.24]) vbox(g, 0.13, 0.13, 0.08, sx, 0.07, sz, PAL.tyre);
        return g;
    }
    function buildHouse() {
        const g = new THREE.Group();
        vbox(g, 0.72, 0.52, 0.62, 0, 0.26, 0, PAL.wall);             // walls
        vbox(g, 0.84, 0.12, 0.74, 0, 0.58, 0, PAL.roof);             // stepped roof
        vbox(g, 0.60, 0.12, 0.52, 0, 0.68, 0, PAL.roof);
        vbox(g, 0.34, 0.12, 0.30, 0, 0.78, 0, PAL.roof);
        vbox(g, 0.12, 0.30, 0.12, 0.24, 0.74, -0.10, PAL.chimney);   // chimney
        vbox(g, 0.18, 0.28, 0.05, 0, 0.16, 0.31, PAL.door);          // door (front +z)
        vbox(g, 0.16, 0.16, 0.05, 0.22, 0.34, 0.31, PAL.win, true);  // glowing windows
        vbox(g, 0.16, 0.16, 0.05, -0.22, 0.34, 0.31, PAL.win, true);
        vbox(g, 0.05, 0.16, 0.16, 0.36, 0.34, 0, PAL.win, true);
        return g;
    }
    function buildFountain() {
        const g = new THREE.Group();
        vbox(g, 0.72, 0.14, 0.72, 0, 0.07, 0, PAL.stone);            // base
        vbox(g, 0.60, 0.07, 0.60, 0, 0.16, 0, PAL.fwater);           // lower pool
        vbox(g, 0.16, 0.42, 0.16, 0, 0.36, 0, PAL.stone);            // pillar
        vbox(g, 0.34, 0.08, 0.34, 0, 0.58, 0, PAL.stone);            // upper basin
        vbox(g, 0.26, 0.05, 0.26, 0, 0.63, 0, PAL.fwater);           // upper water
        return g;
    }
    const buildStructure = (code) => (code === 'cottage' ? buildHouse() : buildFountain());
    function buildTrafficLight() {
        const g = new THREE.Group();
        vbox(g, 0.08, 0.72, 0.08, 0, 0.36, 0, PAL.pole);             // pole
        vbox(g, 0.16, 0.34, 0.12, 0, 0.78, 0, PAL.pole);             // housing
        const lampV = vbox(g, 0.13, 0.13, 0.06, 0, 0.86, 0.06, PAL.lampRed);   // controls N–S traffic
        const lampH = vbox(g, 0.13, 0.13, 0.06, 0, 0.70, 0.06, PAL.lampRed);   // controls E–W traffic
        return { group: g, lampV, lampH };
    }
    function updateNightGlow() {
        props.traverse(o => { if (o.userData?.glow) o.material = isNight ? PAL.winGlow : PAL.win; });
    }

    // ── The model: authoritative, stored layout ────────────────────────────────
    // placedItems holds every positioned ground item: road/rail (surface),
    // car/train (vehicle), AND pond/fountain/cottage (structure). All remember
    // col/grid_row in garden_items, so nothing jumps around between visits.
    const plantsModel = new Map();    // wordId → { col, row, level, due }
    let   placedItems = (opts.placed || []).map(p => ({ ...p }));   // { id, code, col, row, rotation }
    const isStructure = (code) => STRUCTURE_CODES.includes(code);
    const structureSurface = (code) => (code === 'pond' ? 'water' : (code === 'fountain' ? 'stone' : 'grass'));

    const plantPos = opts.plantPos || new Map();
    words.forEach(w => {
        const p = plantPos.get(w.id);
        plantsModel.set(w.id, {
            col: p ? p.col : null, row: p ? p.row : null,
            level: w.review_level ?? 0, due: dueIds.has(w.id),
        });
    });

    // Occupancy ignoring one entity (the one being moved), for validation/render.
    function computeCells(skipRef = null) {
        const cells = new Map();
        const set = (c, r, patch) => {
            const k = cellKey(c, r);
            cells.set(k, { ...(cells.get(k) || {}), ...patch });
        };
        for (const it of placedItems) {
            if (it === skipRef || it.id === skipRef) continue;
            if (it.col == null || it.row == null) continue;
            const info = SHOP[it.code];
            if (info?.surface) set(it.col, it.row, { surface: info.surface, code: it.code });
            else if (isStructure(it.code)) set(it.col, it.row, { surface: structureSurface(it.code), occupant: 'structure', code: it.code });
        }
        for (const it of placedItems) {
            if (it === skipRef || it.id === skipRef) continue;
            if (it.col == null || it.row == null) continue;
            const info = SHOP[it.code];
            if (info?.vehicle) set(it.col, it.row, { occupant: 'vehicle', code: it.code, ref: it.id });
        }
        for (const [wid, p] of plantsModel) {
            if (wid === skipRef) continue;
            if (p.col == null || p.row == null) continue;
            set(p.col, p.row, { occupant: 'plant', ref: wid });
        }
        return cells;
    }

    // Find the free cell nearest a preferred origin (expanding-ring scan).
    function nearestFreeCell(prefC, prefR, cells) {
        if (!cells.get(cellKey(prefC, prefR))?.occupant &&
            !['road', 'rail', 'water', 'stone'].includes(cells.get(cellKey(prefC, prefR))?.surface)) {
            return { col: prefC, row: prefR };
        }
        for (let rad = 1; rad < 200; rad++) {
            for (let dc = -rad; dc <= rad; dc++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                    const c = prefC + dc, r = prefR + dr;
                    const cell = cells.get(cellKey(c, r));
                    if (!cell) return { col: c, row: r };
                    if (!cell.occupant && !['road', 'rail', 'water', 'stone'].includes(cell.surface)) {
                        return { col: c, row: r };
                    }
                }
            }
        }
        return { col: prefC, row: prefR };
    }

    // Give every structure (pond/fountain/cottage) a fixed home, persisting any
    // that lack one. Runs before plant homes so structures sit centrally.
    function assignStructureHomes() {
        const need = placedItems.filter(it => isStructure(it.code) && it.col == null);
        if (!need.length) return;
        const cells = computeCells();
        for (const it of need) {
            const spot = nearestFreeCell(0, 0, cells);
            it.col = spot.col; it.row = spot.row; it.rotation = it.rotation || 0;
            cells.set(cellKey(spot.col, spot.row), { surface: structureSurface(it.code), occupant: 'structure', code: it.code });
            cb.itemMoved(it.id, it.col, it.row, 0);
        }
    }

    // Assign homes to words with no stored position; persist the new ones.
    function assignPlantHomes() {
        const need = [...plantsModel.entries()].filter(([, p]) => p.col == null);
        if (!need.length) return;
        const cells = computeCells();
        const newHomes = [];
        for (const [wid, p] of need) {
            const spot = nearestFreeCell(0, 0, cells);
            p.col = spot.col; p.row = spot.row;
            cells.set(cellKey(spot.col, spot.row), { occupant: 'plant', ref: wid });
            newHomes.push({ wordId: wid, col: spot.col, row: spot.row });
        }
        cb.assignHomes(newHomes);
    }

    assignStructureHomes();
    assignPlantHomes();

    // ── Field bounds (content bounding box + PAD rings) ─────────────────────────
    let B = { minC: 0, maxC: 0, minR: 0, maxR: 0 };
    let cols = 1, rows = 1, centerC = 0, centerR = 0, plotR = 3;
    function computeBounds() {
        const all = [];
        for (const [, p] of plantsModel) if (p.col != null) all.push([p.col, p.row]);
        for (const it of placedItems) if (it.col != null) all.push([it.col, it.row]);
        if (!all.length) { B = { minC: 0, maxC: 0, minR: 0, maxR: 0 }; }
        else {
            B = {
                minC: Math.min(...all.map(a => a[0])), maxC: Math.max(...all.map(a => a[0])),
                minR: Math.min(...all.map(a => a[1])), maxR: Math.max(...all.map(a => a[1])),
            };
        }
        centerC = (B.minC + B.maxC) / 2;
        centerR = (B.minR + B.maxR) / 2;
        cols = (B.maxC + PAD) - (B.minC - PAD) + 1;
        rows = (B.maxR + PAD) - (B.minR - PAD) + 1;
        plotR = Math.max(cols, rows) * SP * 0.6 + 1;
    }
    const worldX = (col) => (col - centerC) * SP;
    const worldZ = (row) => (row - centerR) * SP;

    // ── Sprite/texture helpers ──────────────────────────────────────────────────
    const texCache = new Map();
    function emojiTexture(emoji, dim = false) {
        const key = emoji + (dim ? ':dim' : '');
        if (texCache.has(key)) return texCache.get(key);
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.font = '96px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (dim) ctx.globalAlpha = 0.5;
        ctx.fillText(emoji, 64, 72);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        texCache.set(key, tex);
        return tex;
    }
    function makeSprite(emoji, scale, dim = false) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji, dim), transparent: true }));
        s.scale.set(scale, scale, 1);
        return s;
    }

    // ── Dynamic layer: blocks, tracks, plants, vehicles (rebuilt on edits) ──────
    let ground = new THREE.Group();    // blocks + road/rail meshes
    let props  = new THREE.Group();    // plant + vehicle sprites
    scene.add(ground); scene.add(props);
    const blockCells = [];             // { mesh, col, row } for raycast → cell
    let plantSprites = [];             // { sprite, baseY, baseScale, phase, wordId, drop? , dropEntry? }
    let vehicleSprites = [];           // { group, id, code, phase } — 3D voxel models
    let plantTops = [];                // creature landing spots
    let cottageSpot = null;
    let trafficLights = [];            // { lampV, lampH } refreshed each build
    let lightCells = new Set();        // cellKeys of light-controlled road junctions
    // Vehicles drive the connected track network. State persists across rebuilds
    // (keyed by item id) so editing elsewhere doesn't reset them. ein/eout are the
    // cell-step directions {dc,dr} entering/leaving the current cell; p is 0..1
    // progress across it; hx/hz is the last heading (for facing while parked).
    let currentCells = new Map();      // latest occupancy map (for neighbour lookups)
    const vehicleState = new Map();    // id → { c, r, ein, eout, p, sound, hx, hz }
    const VSPEED = 1.25;               // cells per second
    const LANE   = 0.16;               // keep-right lateral offset (cars only)
    const PHASE_DUR = 5;               // seconds each traffic-light phase holds
    let lightPhase = 0;                // 0 = N–S green, 1 = E–W green
    const dirKey = (d) => `${d.dc},${d.dr}`;
    const greenFor = (d) => (d.dr !== 0 ? lightPhase === 0 : lightPhase === 1);
    const vehicleSurface = (code) => SHOP[code]?.vehicle || null;   // 'road' | 'rail'
    function trackNeighbours(c, r, surf) {
        const out = [];
        for (const [dc, dr] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
            if (currentCells.get(cellKey(c + dc, r + dr))?.surface === surf) out.push({ c: c + dc, r: r + dr });
        }
        return out;
    }
    // Anchor/repair a vehicle's motion state onto valid track (re-route on edits).
    function reconcileVehicle(it) {
        const surf = vehicleSurface(it.code);
        const onTrack = (c, r) => currentCells.get(cellKey(c, r))?.surface === surf;
        const st = vehicleState.get(it.id);
        if (st && onTrack(st.c, st.r)) return;
        let anchor = { c: it.col, r: it.row };
        if (!onTrack(anchor.c, anchor.r)) {
            // nearest track cell of the right type (small expanding scan)
            outer: for (let rad = 0; rad < 60; rad++) {
                for (let dc = -rad; dc <= rad; dc++) for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                    if (onTrack(it.col + dc, it.row + dr)) { anchor = { c: it.col + dc, r: it.row + dr }; break outer; }
                }
            }
        }
        vehicleState.set(it.id, {
            c: anchor.c, r: anchor.r,
            ein: { dc: 0, dr: 0 }, eout: { dc: 0, dr: 0 },   // parked until it finds a neighbour
            p: 0.5, sound: Math.random() * 4, hx: 1, hz: 0,
        });
    }

    function adjacentTrack(c, r, surface, cells) {
        return {
            n: cells.get(cellKey(c, r - 1))?.surface === surface,
            s: cells.get(cellKey(c, r + 1))?.surface === surface,
            e: cells.get(cellKey(c + 1, r))?.surface === surface,
            w: cells.get(cellKey(c - 1, r))?.surface === surface,
        };
    }

    function addRoadTile(x, z, adj) {
        const slab = new THREE.Mesh(slabGeo, solidMats(roadMat));
        slab.position.set(x, TOP + 0.06, z);
        ground.add(slab);
        // Yellow centre markings reach toward connected neighbours (auto-connect).
        const ns = adj.n || adj.s, ew = adj.e || adj.w, iso = !ns && !ew;
        const markY = TOP + 0.12;
        if (ns || iso) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, SP * 0.9), solidMats(lineMat));
            m.position.set(x, markY, z); ground.add(m);
        }
        if (ew) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(SP * 0.9, 0.04, 0.08), solidMats(lineMat));
            m.position.set(x, markY, z); ground.add(m);
        }
    }

    function addRailTile(x, z, adj) {
        const ties = new THREE.Mesh(slabGeo, solidMats(tieMat));
        ties.position.set(x, TOP + 0.06, z);
        ground.add(ties);
        const ns = adj.n || adj.s, ew = adj.e || adj.w, iso = !ns && !ew;
        const railY = TOP + 0.13;
        const addPair = (along) => {
            for (const off of [-0.22, 0.22]) {
                const geo = along === 'z'
                    ? new THREE.BoxGeometry(0.06, 0.06, SP * 0.96)
                    : new THREE.BoxGeometry(SP * 0.96, 0.06, 0.06);
                const m = new THREE.Mesh(geo, solidMats(railMat));
                m.position.set(along === 'z' ? x + off : x, railY, along === 'z' ? z : z + off);
                ground.add(m);
            }
        };
        if (ns || iso) addPair('z');
        if (ew) addPair('x');
    }

    function buildLayout() {
        // dispose old dynamic meshes
        disposeGroup(ground); disposeGroup(props);
        ground = new THREE.Group(); props = new THREE.Group();
        scene.add(ground); scene.add(props);
        blockCells.length = 0; plantSprites = []; vehicleSprites = []; plantTops = []; cottageSpot = null;

        computeBounds();
        const cells = computeCells();
        currentCells = cells;

        // Blocks for the whole padded rectangle.
        for (let r = B.minR - PAD; r <= B.maxR + PAD; r++) {
            for (let c = B.minC - PAD; c <= B.maxC + PAD; c++) {
                const cell = cells.get(cellKey(c, r));
                const x = worldX(c), z = worldZ(r);
                let mats;
                if (cell?.surface === 'water')      mats = solidMats(waterMat);
                else if (cell?.surface === 'stone') mats = blockMats(stoneMat);
                else mats = blockMats(((r + c) & 1) ? grassMat : grassMatAlt);   // flat checker
                const b = new THREE.Mesh(blockGeo, mats);
                b.position.set(x, 0, z);
                b.userData = { col: c, row: r };
                ground.add(b);
                blockCells.push({ mesh: b, col: c, row: r });

                if (cell?.surface === 'road') addRoadTile(x, z, adjacentTrack(c, r, 'road', cells));
                if (cell?.surface === 'rail') addRailTile(x, z, adjacentTrack(c, r, 'rail', cells));
            }
        }

        // Plants.
        let i = 0;
        for (const [wid, p] of plantsModel) {
            if (p.col == null) continue;
            const x = worldX(p.col), z = worldZ(p.row);
            const scale = 1.0 + Math.min(p.level, 5) * 0.16;
            const baseY = TOP + scale / 2 - (p.due ? 0.18 : 0);
            const sprite = makeSprite(masteryEmoji(p.level), scale, p.due);
            sprite.position.set(x, baseY, z);
            sprite.userData = { wordId: wid };
            props.add(sprite);
            const entry = { sprite, baseY, baseScale: scale, phase: i * 0.7, wordId: wid };
            plantSprites.push(entry);
            plantTops.push({ x, z, top: baseY + scale * 0.6, wordId: wid });
            if (p.due) {
                const drop = makeSprite('💧', 0.45);
                drop.position.set(x, baseY + scale * 0.8, z);
                props.add(drop);
                const dropEntry = { sprite: drop, baseY: drop.position.y, baseScale: 0.45, phase: i, drop: true };
                plantSprites.push(dropEntry);
                entry.dropEntry = dropEntry;
            }
            i++;
        }

        // Vehicles (ride + drive along their track network). Motion is animated
        // in tick(); state persists across rebuilds and is repaired here.
        const liveIds = new Set();
        for (const it of placedItems) {
            const info = SHOP[it.code];
            if (!info?.vehicle || it.col == null) continue;
            liveIds.add(it.id);
            reconcileVehicle(it);
            const g = it.code === 'train' ? buildTrain() : buildCar();
            g.position.set(worldX(it.col), TOP + 0.05, worldZ(it.row));
            g.userData = { itemId: it.id };
            props.add(g);
            vehicleSprites.push({ group: g, id: it.id, code: it.code, phase: Math.random() * 6 });
        }
        for (const id of [...vehicleState.keys()]) if (!liveIds.has(id)) vehicleState.delete(id);

        // Structures as voxel models (pond stays a water block). Tappable to move.
        for (const it of placedItems) {
            if (!isStructure(it.code) || it.col == null || it.code === 'pond') continue;
            const x = worldX(it.col), z = worldZ(it.row);
            const g = buildStructure(it.code);
            g.position.set(x, TOP, z);
            g.userData = { itemId: it.id };
            props.add(g);
            if (it.code === 'cottage') cottageSpot = new THREE.Vector3(x, TOP + 0.6, z);
        }

        // Traffic lights: auto-placed where a road junction has ≥3 road arms.
        trafficLights = []; lightCells = new Set();
        for (const [key, cell] of currentCells) {
            if (cell.surface !== 'road') continue;
            const [c, r] = key.split(':').map(Number);
            if (trackNeighbours(c, r, 'road').length < 3) continue;
            lightCells.add(key);
            const lt = buildTrafficLight();
            lt.group.position.set(worldX(c) + 0.4, TOP, worldZ(r) + 0.4);
            ground.add(lt.group);
            trafficLights.push(lt);
        }
        lightPhase = -1;        // force a lamp refresh next tick
        updateNightGlow();
    }

    // ── Re-grow / water a plant in place (no rebuild → keeps the pop animation) ─
    function growPlant(wordId, level) {
        const p = plantsModel.get(wordId);
        if (p) { p.level = level; p.due = false; }
        const e = plantSprites.find(o => o.wordId === wordId);
        if (!e) return;
        const scale = 1.0 + Math.min(level, 5) * 0.16;
        e.baseScale = scale;
        e.baseY = TOP + scale / 2;
        e.sprite.scale.set(scale, scale, 1);
        e.sprite.material.map = emojiTexture(masteryEmoji(level), false);
        e.sprite.material.needsUpdate = true;
        e.pop = 1;
        if (e.dropEntry) {
            props.remove(e.dropEntry.sprite);
            const idx = plantSprites.indexOf(e.dropEntry);
            if (idx >= 0) plantSprites.splice(idx, 1);
            e.dropEntry = null;
        }
        const top = plantTops.find(t => t.wordId === wordId);
        if (top) top.top = e.baseY + scale * 0.6;
    }
    function waterPlant(wordId) {
        const p = plantSprites.find(o => o.wordId === wordId);
        if (p) p.pop = 1;
    }

    // ── Validation ──────────────────────────────────────────────────────────────
    const isHardSurface = (s) => ['road', 'rail', 'water', 'stone'].includes(s);
    function validPlacement(kind, c, r, skipRef) {
        const cell = computeCells(skipRef).get(cellKey(c, r));
        if (kind === 'plant' || kind === 'track') {
            if (cell && (cell.occupant || isHardSurface(cell.surface))) {
                return { ok: false, reason: cell.occupant === 'plant'
                    ? 'Move the plant on that block first.'
                    : 'That block is taken.' };
            }
            return { ok: true };
        }
        if (kind === 'car') {
            if (cell?.surface !== 'road') return { ok: false, reason: 'A car needs a road. Place a road there first.' };
            if (cell.occupant) return { ok: false, reason: 'That road already has something on it.' };
            return { ok: true };
        }
        if (kind === 'train') {
            if (cell?.surface !== 'rail') return { ok: false, reason: 'A train needs a rail. Place a rail there first.' };
            if (cell.occupant) return { ok: false, reason: 'That rail already has something on it.' };
            return { ok: true };
        }
        return { ok: false, reason: 'Cannot place that here.' };
    }
    function kindOf(code) {
        const info = SHOP[code];
        if (info?.surface) return 'track';
        if (info?.vehicle === 'road') return 'car';
        if (info?.vehicle === 'rail') return 'train';
        return 'track';
    }

    // ── Decorations & creatures (sky critters + the free-roaming gnome) ─────────
    const creatures = [];      // wandering sky critters
    const gnomes = [];         // ground wanderers (roam anywhere, ignore blocks)
    let groupTarget = null;

    function addDecoration(code) {
        const info = SHOP[code];
        if (!info || info.layer === 'theme' || info.type === 'hint') return;
        if (info.placeable || STRUCTURE_CODES.includes(code)) return;   // placed/structure handled in layout
        if (code === 'gnome') return addGnome();
        if (info.layer === 'sky') {
            const s = makeSprite(info.icon, 0.8);
            const kind = code === 'bees' ? 'bee' : (code === 'bird' ? 'bird' : 'butterfly');
            const c = {
                sprite: s, emoji: info.icon, kind,
                pos: new THREE.Vector3((Math.random() - 0.5) * plotR, 3 + Math.random() * 2, (Math.random() - 0.5) * plotR),
                target: new THREE.Vector3(), state: 'fly', timer: 0, speed: 0.9 + Math.random() * 0.5,
                flap: Math.random() * 6, soundCd: 2 + Math.random() * 5,
            };
            s.position.copy(c.pos);
            scene.add(s);
            creatures.push(c);
            pickBehavior(c);
        }
    }

    function randomFieldPoint() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * Math.max(1, cols - 1) * SP,
            TOP + 0.55,
            (Math.random() - 0.5) * Math.max(1, rows - 1) * SP,
        );
    }

    function addGnome() {
        const s = makeSprite('🧙', 1.15);
        const pos = randomFieldPoint();
        const g = { sprite: s, pos, target: pos.clone(), timer: 0, phase: Math.random() * 6, sleepBubble: null };
        s.position.copy(pos);
        scene.add(s);
        gnomes.push(g);
        pickGnomeTarget(g);
        updateGnomeSleep();
    }
    function pickGnomeTarget(g) {
        if (isNight) return;
        if (cottageSpot && Math.random() < 0.28) g.target.copy(cottageSpot);
        else g.target.copy(randomFieldPoint());
        g.timer = 4 + Math.random() * 5;
    }
    function updateGnomeSleep() {
        for (const g of gnomes) {
            if (isNight) {
                const bed = cottageSpot || g.pos;
                g.target.copy(bed);
                if (!g.sleepBubble) { g.sleepBubble = makeSprite('💤', 0.5, true); scene.add(g.sleepBubble); }
            } else if (g.sleepBubble) {
                scene.remove(g.sleepBubble); g.sleepBubble = null; pickGnomeTarget(g);
            }
        }
    }
    function pickBehavior(c) {
        const roll = Math.random();
        if (roll < 0.4 && plantTops.length) {
            const t = plantTops[Math.floor(Math.random() * plantTops.length)];
            c.target.set(t.x, t.top, t.z); c.state = 'land'; c.timer = 2.5 + Math.random() * 3;
        } else if (roll < 0.6 && creatures.length > 1) {
            if (!groupTarget || Math.random() < 0.3) groupTarget = new THREE.Vector3((Math.random() - 0.5) * plotR, 2.5 + Math.random() * 2, (Math.random() - 0.5) * plotR);
            c.target.copy(groupTarget).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1.5));
            c.state = 'group'; c.timer = 3 + Math.random() * 3;
        } else {
            c.target.set((Math.random() - 0.5) * plotR * 1.6, 2.5 + Math.random() * 3, (Math.random() - 0.5) * plotR * 1.6);
            c.state = 'fly'; c.timer = 3 + Math.random() * 4;
        }
    }

    // ── Speech bubbles (DOM projected to screen) ────────────────────────────────
    const layer = document.createElement('div');
    layer.className = 'garden-bubbles';
    canvas.parentElement.appendChild(layer);
    const bubbles = [];
    function speak(c) {
        const el = document.createElement('div');
        el.className = 'garden-bubble';
        el.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        layer.appendChild(el);
        bubbles.push({ el, src: c.sprite, until: clock.getElapsedTime() + 2.4 });
        creatureSound(c.kind);
    }
    function projectBubbles(now) {
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            if (now > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
            const v = b.src.position.clone().add(new THREE.Vector3(0, 0.6, 0)).project(camera);
            const w = canvas.clientWidth, h = canvas.clientHeight;
            b.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
            b.el.style.top  = `${(-v.y * 0.5 + 0.5) * h}px`;
            b.el.style.opacity = v.z < 1 ? '1' : '0';
        }
    }

    // ── Drag-to-place / arrange ─────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const highlight = new THREE.Mesh(slabGeo, okMat);
    highlight.visible = false;
    scene.add(highlight);
    let ghost = null;
    let drag = null;       // { mode:'new'|'move', code, kind, id?, wordId?, cell, moved }
    let selectedId = null;

    function cellAt(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(blockCells.map(b => b.mesh));
        return hits.length ? hits[0].object.userData : null;
    }
    function entityAt(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const targets = props.children.filter(o => o.userData?.wordId || o.userData?.itemId);
        const hits = ray.intersectObjects(targets, true);   // recurse into voxel groups
        if (!hits.length) return null;
        let o = hits[0].object;                              // walk up to the tagged group
        while (o && !(o.userData?.wordId || o.userData?.itemId)) o = o.parent;
        return o?.userData || null;
    }
    // What sits on a block — used as a reliable fallback when the small sprite
    // raycast misses. Skips vehicles (they roam away from their home cell).
    function occupantAt(col, row) {
        for (const [wid, p] of plantsModel) if (p.col === col && p.row === row) return { kind: 'plant', wordId: wid };
        for (const it of placedItems) if (it.col === col && it.row === row && !SHOP[it.code]?.vehicle) return { kind: 'item', it };
        return null;
    }

    function startDrag(state, icon) {
        drag = state;
        ghost = makeSprite(icon, 1.1, true);
        ghost.position.set(0, TOP + 1.2, 0);
        ghost.visible = false;        // shown once the pointer moves over a cell
        scene.add(ghost);
        highlight.visible = false;
    }
    function dragTo(clientX, clientY) {
        if (!drag) return;
        const c = cellAt(clientX, clientY);
        drag.cell = c;
        if (!c) { highlight.visible = false; if (ghost) ghost.visible = false; return; }
        const x = worldX(c.col), z = worldZ(c.row);
        if (ghost) { ghost.visible = true; ghost.position.set(x, TOP + 1.0, z); }
        const skip = drag.mode === 'move' ? (drag.wordId || drag.id) : null;
        const v = validPlacement(drag.kind, c.col, c.row, skip);
        highlight.visible = true;
        highlight.material = v.ok ? okMat : badMat;
        highlight.position.set(x, TOP + 0.08, z);
    }
    function endDrag(commit) {
        if (!drag) return;
        const d = drag; drag = null;
        if (ghost) { scene.remove(ghost); ghost.material.map = null; ghost.material.dispose(); ghost = null; }
        highlight.visible = false;
        if (!commit || !d.cell) return;
        const skip = d.mode === 'move' ? (d.wordId || d.id) : null;
        const v = validPlacement(d.kind, d.cell.col, d.cell.row, skip);
        if (!v.ok) { cb.invalidDrop(v.reason); return; }
        if (d.kind === 'plant' || d.wordId) {
            const p = plantsModel.get(d.wordId);
            p.col = d.cell.col; p.row = d.cell.row;
            cb.plantMoved(d.wordId, d.cell.col, d.cell.row);
        } else if (d.mode === 'new') {
            placedItems.push({ id: d.id, code: d.code, col: d.cell.col, row: d.cell.row, rotation: 0 });
            cb.itemMoved(d.id, d.cell.col, d.cell.row, 0);
        } else {
            const it = placedItems.find(p => p.id === d.id);
            if (it) {
                it.col = d.cell.col; it.row = d.cell.row;
                vehicleState.delete(it.id);    // restart driving from the new spot
                cb.itemMoved(it.id, it.col, it.row, it.rotation || 0);
            }
        }
        buildLayout();
    }

    // Tray → place a freshly-bought (or any unplaced) item. Page calls this on
    // pointerdown of a tray chip; we follow the pointer via window listeners.
    function beginPlaceFromTray(code, id, ev) {
        if (!arrange) return;
        startDrag({ mode: 'new', code, kind: kindOf(code), id, cell: null, moved: true }, SHOP[code]?.icon || '❓');
        const move = (e) => dragTo(e.clientX, e.clientY);
        const up = (e) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            endDrag(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        if (ev) dragTo(ev.clientX, ev.clientY);
    }

    function setArrangeMode(on) {
        arrange = !!on;
        if (!arrange) { endDrag(false); selectedId = null; cb.selectItem(null); }
    }
    function removeSelected() {
        const id = selectedId;
        if (!id) return;
        placedItems = placedItems.filter(p => p.id !== id);
        selectedId = null; cb.selectItem(null);
        cb.itemRemoved(id);
        buildLayout();
    }
    // A freshly-bought structure (pond/fountain/cottage) gets an auto-assigned,
    // persisted home and appears live — no full page reload, so the shop stays open.
    function addStructure(id, code) {
        placedItems.push({ id, code, col: null, row: null, rotation: 0 });
        assignStructureHomes();
        buildLayout();
    }

    // ── Camera controls (pointer: 1 = rotate, 2 = pinch, tap = select) ──────────
    let azim = 0.6, polar = 1.02, dist = 14;
    const target = new THREE.Vector3(0, 0.72, 0);
    let idle = 0, moved = false, pinchD = 0, userChangedView = false;
    const pointers = new Map();

    function applyCamera() {
        polar = Math.max(0.45, Math.min(1.45, polar));
        dist  = Math.max(7, Math.min(60, dist));
        camera.position.set(
            target.x + dist * Math.sin(polar) * Math.sin(azim),
            target.y + dist * Math.cos(polar),
            target.z + dist * Math.sin(polar) * Math.cos(azim),
        );
        camera.lookAt(target);
    }
    const pinchDist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    function onDown(e) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved = false; idle = 0;
        if (pointers.size === 2) pinchD = pinchDist();
        // In arrange mode, grabbing an entity starts a move (and suppresses orbit).
        // Try the sprite first (good for roaming vehicles), then fall back to the
        // block cell under the finger — a big, reliable target — so plants and
        // structures (incl. the pond, which has no sprite) are easy to grab.
        if (arrange && pointers.size === 1 && !drag) {
            const ent = entityAt(e.clientX, e.clientY);
            let grab = null;
            if (ent?.wordId) grab = { kind: 'plant', wordId: ent.wordId };
            else if (ent?.itemId) { const it = placedItems.find(p => p.id === ent.itemId); if (it) grab = { kind: 'item', it }; }
            if (!grab) { const cell = cellAt(e.clientX, e.clientY); if (cell) grab = occupantAt(cell.col, cell.row); }
            if (grab?.kind === 'plant') {
                startDrag({ mode: 'move', kind: 'plant', wordId: grab.wordId, cell: null, moved: false }, masteryEmoji(plantsModel.get(grab.wordId)?.level || 0));
            } else if (grab?.kind === 'item') {
                startDrag({ mode: 'move', kind: kindOf(grab.it.code), id: grab.it.id, cell: null, moved: false }, SHOP[grab.it.code]?.icon || '❓');
            }
        }
        canvas.setPointerCapture?.(e.pointerId);
    }
    function onMove(e) {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        idle = 0;
        if (drag) { drag.moved = true; dragTo(e.clientX, e.clientY); return; }
        if (pointers.size >= 2) { const d = pinchDist(); if (pinchD) { dist *= pinchD / d; userChangedView = true; applyCamera(); } pinchD = d; moved = true; return; }
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        azim -= dx * 0.008; polar -= dy * 0.006; applyCamera();
    }
    function onUp(e) {
        const wasSingle = pointers.size === 1;
        pointers.delete(e.pointerId); pinchD = 0;
        if (drag) {
            if (drag.moved) endDrag(true);
            else {
                // a tap (no move) on an item selects it; on a plant in arrange does nothing
                const d = drag; endDrag(false);
                if (d.id) { selectedId = d.id; cb.selectItem(d.id); }
            }
            return;
        }
        if (wasSingle && !moved) {
            if (arrange) { selectedId = null; cb.selectItem(null); }
            else {
                const ent = entityAt(e.clientX, e.clientY);
                if (ent?.wordId) onClick(ent.wordId);
            }
        }
    }
    function onWheel(e) { e.preventDefault(); dist *= 1 + Math.sign(e.deltaY) * 0.1; userChangedView = true; applyCamera(); idle = 0; }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ── Resize ───────────────────────────────────────────────────────────────
    function resize() {
        const w = canvas.clientWidth || canvas.parentElement.clientWidth;
        const h = canvas.clientHeight || canvas.parentElement.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        if (!userChangedView) {
            const footprint = Math.max(cols, rows);
            const aspect = w / Math.max(1, h);
            dist = Math.max(7, footprint * (aspect > 1.25 ? 1.45 : 1.85) + 4.5);
        }
        applyCamera();
    }

    // ── Initial build ───────────────────────────────────────────────────────────
    buildLayout();
    (opts.items || []).forEach(addDecoration);
    setTheme({ night: isNight, warm: isWarm });
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    resize();

    // ── Render loop ────────────────────────────────────────────────────────────
    let raf = 0;
    const clock = new THREE.Clock();
    function tick() {
        raf = requestAnimationFrame(tick);
        if (document.hidden) return;
        const dt = Math.min(0.05, clock.getDelta());
        const t  = clock.getElapsedTime();

        for (const p of plantSprites) {
            const sway = Math.sin(t * 1.4 + p.phase) * 0.05;
            p.sprite.position.y = p.baseY + sway + (p.drop ? Math.sin(t * 3 + p.phase) * 0.05 : 0);
            p.sprite.material.rotation = Math.sin(t * 1.1 + p.phase) * 0.04;
            if (p.pop > 0) { p.pop = Math.max(0, p.pop - 0.04); const k = p.baseScale * (1 + p.pop * 0.6); p.sprite.scale.set(k, k, 1); }
        }

        for (const c of creatures) {
            c.timer -= dt;
            c.soundCd -= dt;
            if (c.soundCd <= 0) {
                c.soundCd = 5 + Math.random() * 7;
                if (c.kind !== 'butterfly' && Math.random() < 0.6) creatureSound(c.kind);
            }
            const step = c.speed * dt;
            c.pos.x += (c.target.x - c.pos.x) * Math.min(1, step);
            c.pos.y += (c.target.y - c.pos.y) * Math.min(1, step);
            c.pos.z += (c.target.z - c.pos.z) * Math.min(1, step);
            const landed = c.state === 'land' && c.pos.distanceTo(c.target) < 0.3;
            c.sprite.position.set(c.pos.x, c.pos.y + (landed ? 0 : Math.sin(t * 4 + c.flap) * 0.12), c.pos.z);
            c.sprite.material.rotation = landed ? 0 : Math.sin(t * 8 + c.flap) * 0.18;
            if (landed && Math.random() < 0.004) speak(c);
            if (c.timer <= 0) pickBehavior(c);
        }

        for (const g of gnomes) {
            const speed = isNight ? 0.35 : 0.55;
            const step = speed * dt;
            g.pos.x += (g.target.x - g.pos.x) * Math.min(1, step);
            g.pos.z += (g.target.z - g.pos.z) * Math.min(1, step);
            g.pos.y = TOP + 0.55;
            const arrived = g.pos.distanceTo(g.target) < 0.12;
            const bob = isNight || arrived ? 0 : Math.sin(t * 5 + g.phase) * 0.04;
            g.sprite.position.set(g.pos.x, g.pos.y + bob, g.pos.z);
            g.sprite.material.rotation = isNight ? -0.1 : Math.sin(t * 2 + g.phase) * 0.08;
            if (g.sleepBubble) g.sleepBubble.position.set(g.pos.x + 0.25, g.pos.y + 0.8, g.pos.z);
            g.timer -= dt;
            if (!isNight && (g.timer <= 0 || arrived)) pickGnomeTarget(g);
        }

        // Traffic-light phase (auto-timed); refresh lamp colours when it flips.
        const phase = Math.floor(t / PHASE_DUR) % 2;
        if (phase !== lightPhase) {
            lightPhase = phase;
            for (const lt of trafficLights) {
                lt.lampV.material = lightPhase === 0 ? PAL.lampGreen : PAL.lampRed;   // N–S
                lt.lampH.material = lightPhase === 1 ? PAL.lampGreen : PAL.lampRed;   // E–W
            }
        }
        // Snapshot the cell each vehicle holds + its direction (for queueing).
        const occ = new Map();
        for (const v of vehicleSprites) { const s = vehicleState.get(v.id); if (s) occ.set(cellKey(s.c, s.r), dirKey(s.eout)); }

        // Vehicles drive the connected network: turn to face travel, arc through
        // corners, slow for curves, keep right (cars), stop at red lights and queue
        // behind a same-direction vehicle (frozen while arranging). Each cell is
        // traversed edge→edge (straight=line, corner=arc, dead end=in-and-out); at a
        // junction the exit is random, never an immediate reverse unless it's a dead end.
        if (!arrange) for (const v of vehicleSprites) {
            const st = vehicleState.get(v.id);
            if (!st) continue;
            const surf = vehicleSurface(v.code);
            const stopped = st.eout.dc === 0 && st.eout.dr === 0;
            if (stopped) {
                const nb = trackNeighbours(st.c, st.r, surf);
                if (nb.length) {
                    const n = nb[Math.floor(Math.random() * nb.length)];
                    st.ein = { dc: n.c - st.c, dr: n.r - st.r };
                    st.eout = { ...st.ein };
                    st.p = 0.5;                       // start at the cell centre, drive out
                }
            } else {
                const arcing = !(st.ein.dc === st.eout.dc && st.ein.dr === st.eout.dr)
                            && !(st.ein.dc === -st.eout.dc && st.ein.dr === -st.eout.dr);
                st.p += dt * VSPEED * (arcing ? 0.6 : 1);                       // ease off for curves
                if (st.p >= 1) {
                    const nc = st.c + st.eout.dc, nr = st.r + st.eout.dr;
                    const nk = cellKey(nc, nr);
                    const redLight = surf === 'road' && lightCells.has(nk) && !greenFor(st.eout);
                    const queued   = occ.get(nk) === dirKey(st.eout);          // a car ahead, same way
                    if (redLight || queued) {
                        st.p = 1;                                               // hold at the stop line
                    } else {
                        const ein = { ...st.eout };
                        const nb = trackNeighbours(nc, nr, surf);
                        const fwd = nb.filter(n => !(n.c === nc - ein.dc && n.r === nr - ein.dr));
                        let eout;
                        if (fwd.length) { const n = fwd[Math.floor(Math.random() * fwd.length)]; eout = { dc: n.c - nc, dr: n.r - nr }; }
                        else if (nb.length) eout = { dc: -ein.dc, dr: -ein.dr };   // dead end → turn back
                        else eout = { dc: 0, dr: 0 };                              // track vanished → stop
                        st.c = nc; st.r = nr; st.ein = ein; st.eout = eout; st.p = Math.max(0, st.p - 1);
                        occ.set(nk, dirKey(eout));                              // claim the cell this frame
                    }
                }
            }

            // Position + heading for the current cell traversal.
            const cx = worldX(st.c), cz = worldZ(st.r);
            const inb = st.ein, out = st.eout;
            let px = cx, pz = cz, hx = st.hx ?? 1, hz = st.hz ?? 0;
            if (out.dc === 0 && out.dr === 0) {
                // parked — hold position and last heading
            } else if (inb.dc === out.dc && inb.dr === out.dr) {       // straight
                const ex = cx - inb.dc * 0.5, ez = cz - inb.dr * 0.5;
                px = ex + out.dc * st.p; pz = ez + out.dr * st.p;
                hx = out.dc; hz = out.dr;
            } else if (inb.dc === -out.dc && inb.dr === -out.dr) {     // dead-end U-turn
                const ex = cx - inb.dc * 0.5, ez = cz - inb.dr * 0.5;
                const k = 1 - Math.abs(2 * st.p - 1);
                px = ex + (cx - ex) * k; pz = ez + (cz - ez) * k;
                hx = st.p < 0.5 ? inb.dc : out.dc; hz = st.p < 0.5 ? inb.dr : out.dr;
            } else {                                                   // quarter-circle arc
                const ex = cx - inb.dc * 0.5, ez = cz - inb.dr * 0.5;
                const fx = cx + out.dc * 0.5, fz = cz + out.dr * 0.5;
                const pvx = cx - inb.dc * 0.5 + out.dc * 0.5, pvz = cz - inb.dr * 0.5 + out.dr * 0.5;
                const a0 = Math.atan2(ez - pvz, ex - pvx);
                const a1 = Math.atan2(fz - pvz, fx - pvx);
                let da = a1 - a0;
                if (da > Math.PI) da -= 2 * Math.PI;
                if (da < -Math.PI) da += 2 * Math.PI;
                const a = a0 + da * st.p, sgn = Math.sign(da) || 1;
                px = pvx + 0.5 * Math.cos(a); pz = pvz + 0.5 * Math.sin(a);
                hx = -Math.sin(a) * sgn; hz = Math.cos(a) * sgn;
            }
            st.hx = hx; st.hz = hz;
            if (surf === 'road') { px += -hz * LANE; pz += hx * LANE; }   // cars keep right
            v.group.position.set(px, TOP + 0.05, pz);
            v.group.rotation.y = Math.atan2(-hz, hx);

            st.sound -= dt;
            if (st.sound <= 0) {
                st.sound = 5 + Math.random() * 6;
                if (!stopped && Math.random() < 0.5) vehicleSound(v.code === 'train' ? 'train' : 'car');
            }
        }

        projectBubbles(t);

        idle += dt;
        if (idle > 5 && pointers.size === 0 && !drag) { azim += 0.0012; applyCamera(); }

        renderer.render(scene, camera);
    }
    tick();

    // Free only per-instance resources on rebuild: the unique marking/rail box
    // geometries and the per-sprite SpriteMaterials. Shared mesh materials
    // (roadMat, grassMat, …), blockGeo/slabGeo, and cached emoji textures are
    // reused across rebuilds and must NOT be disposed here.
    function disposeGroup(group) {
        group.traverse(o => {
            if (o.geometry && o.geometry !== blockGeo && o.geometry !== slabGeo) o.geometry.dispose();
            if (o.material?.isSpriteMaterial) o.material.dispose();   // leave .map (texCache)
        });
        group.removeFromParent?.();
        group.clear?.();
    }

    function dispose() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel);
        layer.remove();
        scene.traverse(o => {
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => { m.map?.dispose?.(); m.dispose?.(); });
            }
            o.geometry?.dispose?.();
        });
        texCache.forEach(tx => tx.dispose());
        renderer.dispose();
    }

    return {
        dispose, addDecoration, waterPlant, growPlant, setTheme,
        setArrangeMode, beginPlaceFromTray, removeSelected, addStructure,
    };
}
