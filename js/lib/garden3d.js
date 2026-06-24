// ============================================================================
// garden3d.js — full-screen 3D Word Garden (Three.js, voxel blocks)
// ============================================================================
// Loaded as an ES module from CDN (no build step — same mechanism as Supabase).
// The garden is a grid of Minecraft-style dirt+grass blocks; each word's plant
// (an emoji billboard sprite) stands on its own block. Flat solid colours, no
// gradients. Shop creatures wander with slow, varied behaviour (fly / land /
// group) and occasionally pause to say something cheerful (+ a chiptune chirp).
//
// createGarden(canvas, opts) → controller { dispose, addDecoration, waterPlant }
//   opts.words   [{ id, word, review_level }]
//   opts.dueIds  Set of word ids needing water
//   opts.items   [item_code, …]  (DUPLICATES allowed — items stack)
//   opts.night   bool (dim lighting for the night theme)
//   opts.warm    bool ("Sunny Day" booster — warmer light)
//   opts.onPlantClick (wordId) => void

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

import { masteryEmoji } from './srs.js';
import { SHOP } from './coins.js';
import { creatureSound } from './audio.js';

const PLANT_CAP = 80;
const PHRASES = ['Great!', 'Yay!', 'Nice!', 'Wow!', 'Bloom! 🌸', 'Keep going!', 'Lovely!', 'Hello! 👋', 'So pretty!'];
const STRUCTURES = {
    pond:     { w: 2, h: 2 },
    cottage:  { w: 2, h: 2 },
    fountain: { w: 1, h: 1 },
};

export function createGarden(canvas, opts = {}) {
    const words   = (opts.words || []).slice(0, PLANT_CAP);
    const dueIds  = opts.dueIds || new Set();
    const onClick = opts.onPlantClick || (() => {});
    const ownedItems = opts.items || [];
    const hasItem = (code) => ownedItems.includes(code);
    let isNight = !!opts.night;
    let isWarm  = !!opts.warm;

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
    }

    // ── Voxel ground: a grid of dirt blocks with grass tops ───────────────────
    const structureCodes = Object.keys(STRUCTURES).filter(hasItem);
    const reservedArea = structureCodes.reduce((sum, code) => sum + STRUCTURES[code].w * STRUCTURES[code].h, 0);
    const cellCount = Math.max(1, words.length + reservedArea);
    const cols    = Math.max(2, Math.ceil(Math.sqrt(cellCount)));
    const rows    = Math.max(2, Math.ceil(cellCount / cols));
    const SP       = 1.0;                       // blocks sit flush, Minecraft-style
    const offX     = ((cols - 1) * SP) / 2;
    const offZ     = ((rows - 1) * SP) / 2;
    const TOP      = 0.5;                        // block top surface y
    const cellKey  = (c, r) => `${c}:${r}`;

    const reserved = new Map();
    const structurePlacements = [];
    function findStructureSpot(w, h) {
        const centerC = (cols - w) / 2;
        const centerR = (rows - h) / 2;
        const spots = [];
        for (let r = 0; r <= rows - h; r++) {
            for (let c = 0; c <= cols - w; c++) {
                let open = true;
                for (let rr = r; rr < r + h; rr++) {
                    for (let cc = c; cc < c + w; cc++) {
                        if (reserved.has(cellKey(cc, rr))) open = false;
                    }
                }
                if (open) spots.push({ c, r, score: Math.hypot(c - centerC, r - centerR) });
            }
        }
        spots.sort((a, b) => a.score - b.score);
        return spots[0] || { c: 0, r: 0 };
    }
    for (const code of structureCodes) {
        const spec = STRUCTURES[code];
        const spot = findStructureSpot(spec.w, spec.h);
        for (let r = spot.r; r < spot.r + spec.h; r++) {
            for (let c = spot.c; c < spot.c + spec.w; c++) {
                reserved.set(cellKey(c, r), { code, primary: c === spot.c && r === spot.r });
            }
        }
        structurePlacements.push({
            code,
            x: (spot.c + (spec.w - 1) / 2) * SP - offX,
            z: (spot.r + (spec.h - 1) / 2) * SP - offZ,
            w: spec.w,
            h: spec.h,
        });
    }
    const plantCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!reserved.has(cellKey(c, r))) plantCells.push({ c, r });
        }
    }

    const dirtMat  = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1, flatShading: true });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5fae3a, roughness: 1, flatShading: true });
    const grassMatAlt = new THREE.MeshStandardMaterial({ color: 0x69b943, roughness: 1, flatShading: true });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f8fe8, roughness: 0.7, flatShading: true });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 1, flatShading: true });
    // BoxGeometry material order: +x,-x,+y(top),-y,+z,-z
    const blockMats   = (top) => [dirtMat, dirtMat, top, dirtMat, dirtMat, dirtMat];
    const solidMats   = (mat) => [mat, mat, mat, mat, mat, mat];
    const blockGeo    = new THREE.BoxGeometry(SP, 1, SP);

    const blocks = new THREE.Group();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const reservedCell = reserved.get(cellKey(c, r));
            const top = reservedCell?.code === 'fountain'
                ? stoneMat
                : ((r + c) % 2 ? grassMat : grassMatAlt);     // subtle checker, still flat
            const mats = reservedCell?.code === 'pond' ? solidMats(waterMat) : blockMats(top);
            const b = new THREE.Mesh(blockGeo, mats);
            b.position.set(c * SP - offX, 0, r * SP - offZ);
            blocks.add(b);
        }
    }
    scene.add(blocks);

    // ── Plants (billboard sprites on blocks) ───────────────────────────────────
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

    const plantSprites = [];   // { sprite, baseY, baseScale, phase, wordId, pos:{x,z} }
    const plantTops    = [];   // {x,z,top} landing spots for creatures
    words.forEach((w, i) => {
        const level = w.review_level ?? 0;
        const due   = dueIds.has(w.id);
        const cell = plantCells[i] || { c: i % cols, r: Math.floor(i / cols) };
        const x = cell.c * SP - offX;
        const z = cell.r * SP - offZ;
        const scale = 1.0 + Math.min(level, 5) * 0.16;
        const baseY = TOP + scale / 2 - (due ? 0.18 : 0);
        const sprite = makeSprite(masteryEmoji(level), scale, due);
        sprite.position.set(x, baseY, z);
        sprite.userData.wordId = w.id;
        scene.add(sprite);
        const entry = { sprite, baseY, baseScale: scale, phase: i * 0.7, wordId: w.id, x, z };
        plantSprites.push(entry);
        plantTops.push({ x, z, top: baseY + scale * 0.6, wordId: w.id });

        if (due) {
            const drop = makeSprite('💧', 0.45);
            drop.position.set(x, baseY + scale * 0.8, z);
            scene.add(drop);
            const dropEntry = { sprite: drop, baseY: drop.position.y, baseScale: 0.45, phase: i, wordId: null, drop: true };
            plantSprites.push(dropEntry);
            entry.dropEntry = dropEntry;          // linked so growPlant can remove it
        }
    });

    let cottageSpot = null;
    for (const p of structurePlacements) {
        if (p.code === 'pond') continue;
        const emoji = p.code === 'cottage' ? '🏡' : '⛲';
        const scale = p.code === 'cottage' ? 2.4 : 1.35;
        const s = makeSprite(emoji, scale);
        s.position.set(p.x, TOP + scale / 2 - 0.05, p.z);
        scene.add(s);
        if (p.code === 'cottage') cottageSpot = new THREE.Vector3(p.x, TOP + 0.65, p.z);
    }

    // Re-grow a plant in place after an in-garden review (no page reload).
    function growPlant(wordId, level) {
        const e = plantSprites.find(p => p.wordId === wordId);
        if (!e) return;
        const scale = 1.0 + Math.min(level, 5) * 0.16;
        e.baseScale = scale;
        e.baseY = TOP + scale / 2;
        e.sprite.scale.set(scale, scale, 1);
        e.sprite.material.map = emojiTexture(masteryEmoji(level), false);
        e.sprite.material.needsUpdate = true;
        e.pop = 1;                                 // water-splash punch
        if (e.dropEntry) {
            scene.remove(e.dropEntry.sprite);
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

    // ── Decorations & creatures (each addDecoration adds ONE instance) ─────────
    const creatures = [];      // wandering sky critters
    const gnomes = [];         // ground wanderers
    const plotR = Math.max(cols, rows) * SP * 0.6 + 1;
    let groundSlot = 0;

    function addDecoration(code) {
        const info = SHOP[code];
        if (!info || info.layer === 'theme') return;   // boosters/night handled elsewhere
        if (STRUCTURES[code]) {
            return;
        }
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
            return;
        }
        // ground props arrange around the plot rim
        const s = makeSprite(info.icon, 2.2);
        const ang = (groundSlot++) * 1.1;
        s.position.set(Math.cos(ang) * (plotR + 2.5), TOP + 1.1, Math.sin(ang) * (plotR + 2.5));
        scene.add(s);
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
        const g = {
            sprite: s,
            pos,
            target: pos.clone(),
            timer: 0,
            phase: Math.random() * 6,
            sleepBubble: null,
        };
        s.position.copy(pos);
        scene.add(s);
        gnomes.push(g);
        pickGnomeTarget(g);
        updateGnomeSleep();
    }

    function pickGnomeTarget(g) {
        if (isNight) return;
        if (cottageSpot && Math.random() < 0.28) {
            g.target.copy(cottageSpot);
        } else {
            g.target.copy(randomFieldPoint());
        }
        g.timer = 4 + Math.random() * 5;
    }

    function updateGnomeSleep() {
        if (!gnomes) return;
        for (const g of gnomes) {
            if (isNight) {
                const bed = cottageSpot || g.pos;
                g.target.copy(bed);
                if (!g.sleepBubble) {
                    g.sleepBubble = makeSprite('💤', 0.5, true);
                    scene.add(g.sleepBubble);
                }
            } else if (g.sleepBubble) {
                scene.remove(g.sleepBubble);
                g.sleepBubble = null;
                pickGnomeTarget(g);
            }
        }
    }

    function pickBehavior(c) {
        const roll = Math.random();
        if (roll < 0.4 && plantTops.length) {            // land on a plant
            const t = plantTops[Math.floor(Math.random() * plantTops.length)];
            c.target.set(t.x, t.top, t.z);
            c.state = 'land';
            c.timer = 2.5 + Math.random() * 3;
        } else if (roll < 0.6 && creatures.length > 1) {  // group up near a shared point
            if (!groupTarget || Math.random() < 0.3) groupTarget = new THREE.Vector3((Math.random() - 0.5) * plotR, 2.5 + Math.random() * 2, (Math.random() - 0.5) * plotR);
            c.target.copy(groupTarget).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1.5));
            c.state = 'group';
            c.timer = 3 + Math.random() * 3;
        } else {                                          // free flight to a random spot
            c.target.set((Math.random() - 0.5) * plotR * 1.6, 2.5 + Math.random() * 3, (Math.random() - 0.5) * plotR * 1.6);
            c.state = 'fly';
            c.timer = 3 + Math.random() * 4;
        }
    }
    let groupTarget = null;

    // ── Speech bubbles (DOM projected to screen) ────────────────────────────────
    const layer = document.createElement('div');
    layer.className = 'garden-bubbles';
    canvas.parentElement.appendChild(layer);
    const bubbles = [];        // { el, obj:{position}, until }

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

    // ── Camera controls (pointer: 1 = rotate, 2 = pinch, tap = raycast) ─────────
    let azim = 0.6, polar = 1.02, dist = Math.max(8, Math.max(cols, rows) * 1.8 + 4);
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
        canvas.setPointerCapture?.(e.pointerId);
    }
    function onMove(e) {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        idle = 0;
        if (pointers.size >= 2) { const d = pinchDist(); if (pinchD) { dist *= pinchD / d; userChangedView = true; applyCamera(); } pinchD = d; moved = true; return; }
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        azim -= dx * 0.008; polar -= dy * 0.006; applyCamera();
    }
    function onUp(e) {
        const wasSingle = pointers.size === 1;
        pointers.delete(e.pointerId); pinchD = 0;
        if (wasSingle && !moved) raycastClick(e);
    }
    function onWheel(e) { e.preventDefault(); dist *= 1 + Math.sign(e.deltaY) * 0.1; userChangedView = true; applyCamera(); idle = 0; }

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function raycastClick(e) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(plantSprites.filter(p => p.wordId).map(p => p.sprite));
        if (hits.length) onClick(hits[0].object.userData.wordId);
    }

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
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    resize();

    // ── Seed initial decorations (stacked: one call per owned row) ─────────────
    (opts.items || []).forEach(addDecoration);
    setTheme({ night: isNight, warm: isWarm });

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
            // ambient natural sound (bees buzz, birds tweet) on a per-critter cooldown
            c.soundCd -= dt;
            if (c.soundCd <= 0) {
                c.soundCd = 5 + Math.random() * 7;
                if (c.kind !== 'butterfly' && Math.random() < 0.6) creatureSound(c.kind);
            }
            // move slowly toward target
            const step = c.speed * dt;
            c.pos.x += (c.target.x - c.pos.x) * Math.min(1, step);
            c.pos.y += (c.target.y - c.pos.y) * Math.min(1, step);
            c.pos.z += (c.target.z - c.pos.z) * Math.min(1, step);
            // gentle bob unless landed & idle
            const landed = c.state === 'land' && c.pos.distanceTo(c.target) < 0.3;
            c.sprite.position.set(c.pos.x, c.pos.y + (landed ? 0 : Math.sin(t * 4 + c.flap) * 0.12), c.pos.z);
            c.sprite.material.rotation = landed ? 0 : Math.sin(t * 8 + c.flap) * 0.18;
            if (landed && Math.random() < 0.004) speak(c);          // occasionally say hi
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

        projectBubbles(t);

        idle += dt;
        if (idle > 5 && pointers.size === 0) { azim += 0.0012; applyCamera(); }

        renderer.render(scene, camera);
    }
    tick();

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

    return { dispose, addDecoration, waterPlant, growPlant, setTheme };
}
