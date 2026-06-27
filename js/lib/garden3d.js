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
//   • surface  — grass (default) | road | rail | crossing | fence | runway | water(pond) | stone(fountain)
//   • occupant — one of: plant | vehicle(car/bus/train/privatejet) | structure | animal | (none)
// A car/bus needs a road surface, a train needs rail, and a jet needs runway. One occupant per
// block, so a plant must be moved before its block can become a road/rail.
//
// createGarden(canvas, opts) → controller
//   opts.words     [{ id, word, review_level }]
//   opts.dueIds    Set of word ids needing water
//   opts.plantPos  Map<wordId,{col,row}>  stored plant positions (may be partial)
//   opts.placed    [{ id, code, col, row, rotation }]  placed items (positions set)
//   opts.items     [item_code, …]  free decorations (sky critters / gnome) —
//                  duplicates allowed, they stack
//   opts.night / opts.warm  bool theme flags
//   opts.onPlantClick(wordId)               tap a plant (normal mode → review)
//   opts.onAssignHomes([{wordId,col,row}])  words that had no stored position
//   opts.onItemMoved(id,col,row,rotation)   a placed item was dropped/rotated
//   opts.onItemRemoved(id)                  a placed item was removed
//   opts.onPlantMoved(wordId,col,row)       a plant was dragged to a new block
//   opts.onSelectItem(id|null)              a placed item was selected/deselected
//   opts.onInvalidDrop(reason)              a drop was rejected (show a hint)

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/+esm";

import { masteryEmoji } from "./srs.js";
import { SHOP } from "./coins.js";
import { creatureSound, vehicleSound } from "./audio.js";

const PHRASES = ["Great!", "Yay!", "Nice!", "Wow!", "Bloom! 🌸", "Keep going!", "Lovely!", "Hello! 👋", "So pretty!"];
const STRUCTURE_CODES = ["pond", "fountain", "cottage"];
const PAD = 2; // always keep 2 empty rings around the content
const SP = 1.0; // blocks sit flush, Minecraft-style
const TOP = 0.5; // block top surface y
const cellKey = (c, r) => `${c}:${r}`;

export function createGarden(canvas, opts = {}) {
    const words = opts.words || [];
    const dueIds = opts.dueIds || new Set();
    const onClick = opts.onPlantClick || (() => {});
    const cb = {
        assignHomes: opts.onAssignHomes || (() => {}),
        itemMoved: opts.onItemMoved || (() => {}),
        itemRemoved: opts.onItemRemoved || (() => {}),
        plantMoved: opts.onPlantMoved || (() => {}),
        selectItem: opts.onSelectItem || (() => {}),
        invalidDrop: opts.onInvalidDrop || (() => {}),
        setCenterMode: opts.onSetCenterModeChange || (() => {}),
    };
    let isNight = !!opts.night;
    let isWarm = !!opts.warm;
    let arrange = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
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
        ambientLight.intensity = isNight ? 0.55 : isWarm ? 0.95 : 0.82;
        sunLight.color.set(isWarm && !isNight ? 0xfff0c0 : 0xffffff);
        sunLight.intensity = isNight ? 0.5 : 0.9;
        updateWalkerSleep();
        updateNightGlow();
    }

    // ── Materials & shared geometry ────────────────────────────────────────────
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1, flatShading: true });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5fae3a, roughness: 1, flatShading: true });
    const grassMatAlt = new THREE.MeshStandardMaterial({ color: 0x69b943, roughness: 1, flatShading: true });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f8fe8, roughness: 0.7, flatShading: true });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 1, flatShading: true });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4f, roughness: 1, flatShading: true });
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x363a3f, roughness: 1, flatShading: true });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2c84b, roughness: 1, flatShading: true });
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1, flatShading: true });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.6, flatShading: true });
    const okMat = new THREE.MeshStandardMaterial({ color: 0x35c759, transparent: true, opacity: 0.45 });
    const badMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, transparent: true, opacity: 0.45 });
    // BoxGeometry material order: +x,-x,+y(top),-y,+z,-z
    const blockMats = (top) => [dirtMat, dirtMat, top, dirtMat, dirtMat, dirtMat];
    const solidMats = (mat) => [mat, mat, mat, mat, mat, mat];
    const blockGeo = new THREE.BoxGeometry(SP, 1, SP);
    const slabGeo = new THREE.BoxGeometry(SP, 0.1, SP);

    // ── Voxel models (flat-colour boxes, no external assets) ────────────────────
    // Shared materials so rebuilds never dispose them (disposeGroup frees only the
    // per-box geometries). Models face +x and sit with their base on y = 0; the
    // caller positions the group on the block top. Windows tagged userData.glow
    // are swapped to a bright material at night (updateNightGlow).
    const flat = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true, ...extra });
    const PAL = {
        carBody: flat(0xe23b3b),
        carRoof: flat(0xb52d2d),
        busBody: flat(0x2574d8),
        busRoof: flat(0x1954a6),
        jetBody: flat(0xf4f6f8),
        jetStripe: flat(0x2f8fe8),
        tyre: flat(0x23282f),
        glass: flat(0x9fd8ff),
        headlight: flat(0xfff2a8),
        taillight: flat(0x8a1414),
        trainBody: flat(0x2f8f4e),
        trainRoof: flat(0x256b3c),
        trainTrim: flat(0xf2c84b),
        stack: flat(0x333a40),
        wall: flat(0xf3e6c4),
        roof: flat(0xc0432f),
        door: flat(0x6b4423),
        chimney: flat(0x8a5a2b),
        win: flat(0x9fd8ff),
        winGlow: flat(0xffd24a, { emissive: 0xffb300, emissiveIntensity: 0.9 }),
        stone: flat(0xc2c8d0),
        fwater: flat(0x3aa0f0, { transparent: true, opacity: 0.92 }),
        pole: flat(0x3a3f45),
        lampRed: flat(0xff3b30, { emissive: 0xd42018, emissiveIntensity: 0.95 }),
        lampYellow: flat(0xffcc00, { emissive: 0xe0a800, emissiveIntensity: 0.95 }),
        lampGreen: flat(0x35c759, { emissive: 0x1ea64a, emissiveIntensity: 0.95 }),
        lampOff: flat(0x202428),
        // Plants — leaves, stems, blooms, trunks (6 growth stages map to mastery).
        // Foliage is teal-leaning + bloom dots are vivid so plants pop off the grass.
        soil: flat(0x6b4a2b),
        sprout: flat(0x9be15d),
        leaf: flat(0x2f9e6b),
        leafDk: flat(0x1f7f54),
        bloom: flat(0xff5fa2),
        bloomY: flat(0xffd24a),
        bloomR: flat(0xff4d4d),
        bloomP: flat(0xb06cff),
        bloomW: flat(0xfff0f5),
        bloomO: flat(0xff9a3d),
        berry: flat(0xff5252),
        trunk: flat(0x8a5a2b),
        gold: flat(0xffcf3f, { emissive: 0xc99a00, emissiveIntensity: 0.5 }),
        fencePost: flat(0x8a5a2b),
        fenceRail: flat(0xc89552),
        fenceCap: flat(0xe5b86b),
        // Animals.
        cat: flat(0xf0a23b),
        dog: flat(0xb07a45),
        rabbit: flat(0xeeeeee),
        chicken: flat(0xfafafa),
        pig: flat(0xf3a6c0),
        cow: flat(0xf2efe9),
        cowSpot: flat(0x2a2a2a),
        beak: flat(0xf2a23b),
        deer: flat(0xb47a3c),
        deerChest: flat(0xe8c596),
        antler: flat(0xdfc48a),
        bear: flat(0x6b4423),
        comb: flat(0xe23b3b),
        snout: flat(0xe07a98),
        hoof: flat(0x3a2f28),
        dark: flat(0x2a2a2a),
        pink: flat(0xf6c0cc),
        // Critters.
        bee: flat(0xf2c020),
        beeDk: flat(0x2a2a2a),
        wing: flat(0xeaf6ff, { transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false }),
        wingVein: new THREE.LineBasicMaterial({ color: 0x82aeca, transparent: true, opacity: 0.42, depthWrite: false }),
        bfA: flat(0xff7fb0, { transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
        bfB: flat(0x7fb6ff, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
        bfEdge: flat(0x2f2250, { side: THREE.DoubleSide }),
        bfSpot: flat(0xfff2a8, { side: THREE.DoubleSide }),
        birdBody: flat(0x6fb0e8),
        birdWing: flat(0x4a86c8),
        birdWingFace: flat(0x4a86c8, { side: THREE.DoubleSide }),
        birdChest: flat(0xeaf6ff),
        birdTail: flat(0x2f5f8f),
        // Gnome.
        gHat: flat(0xd33b3b),
        gBody: flat(0x3a6fd0),
        gFace: flat(0xf2c8a0),
        gBeard: flat(0xf2f2f2),
        // Station + signs.
        stnPlat: flat(0xb8bec8),
        stnPost: flat(0x6b4423),
        stnRoof: flat(0xc0432f),
        stnBoard: flat(0x2f8f4e),
        signRed: flat(0xd11f1f),
        signWhite: flat(0xf5f5f5),
        signRedFace: flat(0xd11f1f, { side: THREE.DoubleSide }),
        signWhiteFace: flat(0xf5f5f5, { side: THREE.DoubleSide }),
        gateW: flat(0xf5f5f5),
        gateR: flat(0xd11f1f),
        runwayLine: flat(0xf5f5f5),
        runwayLight: flat(0x80d8ff, { emissive: 0x4fc3ff, emissiveIntensity: 0.9 }),
    };
    function vbox(group, w, h, d, x, y, z, mat, glow) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        if (glow) m.userData.glow = true;
        group.add(m);
        return m;
    }
    function vellipsoid(group, rx, ry, rz, x, y, z, mat, glow = false) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
        m.scale.set(rx, ry, rz);
        m.position.set(x, y, z);
        if (glow) m.userData.glow = true;
        group.add(m);
        return m;
    }
    function orientAxis(mesh, axis) {
        if (axis === "x") mesh.rotation.z = Math.PI / 2;
        else if (axis === "z") mesh.rotation.x = Math.PI / 2;
    }
    function vcyl(group, radius, depth, x, y, z, mat, axis = "y", segments = 14, glow = false) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), mat);
        orientAxis(m, axis);
        m.position.set(x, y, z);
        if (glow) m.userData.glow = true;
        group.add(m);
        return m;
    }
    function vcone(group, radius, height, x, y, z, mat, axis = "y", segments = 14) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), mat);
        orientAxis(m, axis);
        m.position.set(x, y, z);
        group.add(m);
        return m;
    }
    function vshape(group, points, x, y, z, mat, { scale = 1, rotX = -Math.PI / 2, rotY = 0, rotZ = 0 } = {}) {
        const s = new THREE.Shape();
        points.forEach(([px, py], i) => {
            if (i === 0) s.moveTo(px, py);
            else s.lineTo(px, py);
        });
        s.closePath();
        if (mat.side !== THREE.DoubleSide) {
            mat.side = THREE.DoubleSide;
            mat.needsUpdate = true;
        }
        const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
        m.position.set(x, y, z);
        m.rotation.set(rotX, rotY, rotZ);
        m.scale.set(scale, scale, scale);
        group.add(m);
        return m;
    }
    function vleaf(group, w, d, x, y, z, mat, rotY = 0, rotZ = 0) {
        return vshape(
            group,
            [
                [0, d * 0.5],
                [w * 0.42, d * 0.08],
                [w * 0.22, -d * 0.38],
                [0, -d * 0.5],
                [-w * 0.22, -d * 0.38],
                [-w * 0.42, d * 0.08],
            ],
            x,
            y,
            z,
            mat,
            { rotY, rotZ },
        );
    }
    function vpetal(group, w, h, x, y, z, mat, rotZ = 0) {
        const p = vshape(
            group,
            [
                [0, h * 0.5],
                [w * 0.38, h * 0.12],
                [w * 0.24, -h * 0.28],
                [0, -h * 0.42],
                [-w * 0.24, -h * 0.28],
                [-w * 0.38, h * 0.12],
            ],
            x,
            y,
            z,
            mat,
            { rotX: 0, rotZ },
        );
        return p;
    }
    function wingShape(type) {
        const s = new THREE.Shape();
        if (type === "beeHind") {
            s.moveTo(-0.04, 0);
            s.bezierCurveTo(-0.12, 0.04, -0.13, 0.16, -0.03, 0.2);
            s.bezierCurveTo(0.06, 0.18, 0.08, 0.05, 0.01, 0);
        } else if (type === "butterFore") {
            s.moveTo(0.02, 0);
            s.bezierCurveTo(0.2, 0.04, 0.25, 0.24, 0.11, 0.38);
            s.bezierCurveTo(-0.04, 0.43, -0.08, 0.16, 0.02, 0);
        } else if (type === "butterHind") {
            s.moveTo(-0.02, 0);
            s.bezierCurveTo(-0.18, 0.04, -0.23, 0.22, -0.09, 0.32);
            s.bezierCurveTo(0.06, 0.28, 0.08, 0.08, -0.02, 0);
        } else if (type === "birdWing") {
            s.moveTo(-0.12, 0);
            s.bezierCurveTo(0.02, 0.02, 0.2, 0.12, 0.23, 0.25);
            s.bezierCurveTo(0.1, 0.31, -0.09, 0.22, -0.16, 0.08);
            s.bezierCurveTo(-0.18, 0.04, -0.16, 0.01, -0.12, 0);
        } else {
            s.moveTo(-0.02, 0);
            s.bezierCurveTo(-0.12, 0.04, -0.14, 0.2, -0.02, 0.26);
            s.bezierCurveTo(0.12, 0.24, 0.16, 0.07, 0.03, 0);
        }
        return s;
    }
    function orientWingSurface(obj, side) {
        obj.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    function wingMembrane(type, mat, side, scale = 1) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(wingShape(type), 10), mat);
        orientWingSurface(mesh, side);
        mesh.scale.set(scale, scale, scale);
        return mesh;
    }
    function wingVeins(side, segments, scale = 1) {
        const pts = [];
        segments.forEach(([a, b]) => {
            pts.push(new THREE.Vector3(a[0], a[1], 0), new THREE.Vector3(b[0], b[1], 0));
        });
        const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), PAL.wingVein);
        orientWingSurface(line, side);
        line.scale.set(scale, scale, scale);
        return line;
    }
    function wingDot(parent, side, x, span, r, mat) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat);
        dot.position.set(x, 0.003, side * span);
        orientWingSurface(dot, side);
        parent.add(dot);
        return dot;
    }
    function wingPivot(side, x, y, z, base, flapScale = 1) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        pivot.userData.wing = side;
        pivot.userData.wingBase = base;
        pivot.userData.flapScale = flapScale;
        pivot.rotation.x = base;
        return pivot;
    }
    function vwheel(group, radius, width, x, y, z, mat = PAL.tyre, hub = PAL.stone) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), mat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, y, z);
        group.add(wheel);
        const outward = Math.sign(z) || 1;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.012, 12), hub);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(x, y, z + outward * (width * 0.5 + 0.008));
        group.add(cap);
        return wheel;
    }
    function octagonGeometry(radius) {
        const k = radius * 0.41421356;
        const s = new THREE.Shape();
        s.moveTo(-k, -radius);
        s.lineTo(k, -radius);
        s.lineTo(radius, -k);
        s.lineTo(radius, k);
        s.lineTo(k, radius);
        s.lineTo(-k, radius);
        s.lineTo(-radius, k);
        s.lineTo(-radius, -k);
        s.closePath();
        return new THREE.ShapeGeometry(s);
    }
    function makeStopTextMaterial() {
        const cnv = document.createElement("canvas");
        cnv.width = 256;
        cnv.height = 96;
        const ctx = cnv.getContext("2d");
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.fillStyle = "#fff";
        ctx.font = "900 58px Arial, Helvetica, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("STOP", cnv.width / 2, cnv.height / 2 + 3);
        const tex = new THREE.CanvasTexture(cnv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    }
    const stopTextMat = makeStopTextMaterial();
    function buildCar() {
        const g = new THREE.Group();
        vellipsoid(g, 0.4, 0.11, 0.23, 0, 0.18, 0, PAL.carBody); // rounded chassis
        vellipsoid(g, 0.23, 0.12, 0.21, -0.04, 0.34, 0, PAL.glass); // cabin glass
        vbox(g, 0.34, 0.07, 0.36, -0.04, 0.45, 0, PAL.carRoof); // roof
        vbox(g, 0.12, 0.1, 0.36, 0.23, 0.34, 0, PAL.glass); // windshield
        vbox(g, 0.12, 0.08, 0.34, -0.27, 0.32, 0, PAL.glass); // rear window
        vellipsoid(g, 0.16, 0.045, 0.18, 0.25, 0.27, 0, PAL.carBody); // hood
        vellipsoid(g, 0.12, 0.04, 0.17, -0.31, 0.26, 0, PAL.carRoof); // trunk
        vbox(g, 0.05, 0.05, 0.3, 0.42, 0.18, 0, PAL.dark); // grille
        vbox(g, 0.05, 0.035, 0.18, 0.47, 0.17, 0, PAL.signWhite); // plate
        for (const sz of [0.13, -0.13]) vellipsoid(g, 0.035, 0.028, 0.03, 0.39, 0.18, sz, PAL.headlight);
        for (const sz of [0.13, -0.13]) vellipsoid(g, 0.025, 0.026, 0.026, -0.39, 0.18, sz, PAL.taillight);
        vcyl(g, 0.018, 0.08, 0.15, 0.31, 0.25, PAL.dark, "z", 8); // side mirrors
        vcyl(g, 0.018, 0.08, 0.15, 0.31, -0.25, PAL.dark, "z", 8);
        for (const sz of [0.235, -0.235]) {
            vbox(g, 0.03, 0.13, 0.025, 0.02, 0.25, sz, PAL.carRoof); // door pillar
            vbox(g, 0.18, 0.035, 0.025, -0.05, 0.2, sz, PAL.carRoof); // door line
        }
        vbox(g, 0.08, 0.04, 0.34, -0.43, 0.12, 0, PAL.tyre); // rear bumper
        for (const sx of [0.22, -0.22])
            for (const sz of [0.24, -0.24]) vwheel(g, 0.085, 0.075, sx, 0.08, sz);
        return g;
    }
    function buildBus() {
        const g = new THREE.Group();
        vbox(g, 0.94, 0.28, 0.44, 0, 0.22, 0, PAL.busBody); // long blue body
        vellipsoid(g, 0.43, 0.07, 0.23, -0.02, 0.4, 0, PAL.busRoof);
        for (const sx of [-0.26, -0.06, 0.14]) {
            vbox(g, 0.12, 0.11, 0.04, sx, 0.33, 0.24, PAL.glass);
            vbox(g, 0.12, 0.11, 0.04, sx, 0.33, -0.24, PAL.glass);
        }
        vbox(g, 0.12, 0.18, 0.04, 0.35, 0.25, 0.24, PAL.glass); // front door/window
        vbox(g, 0.12, 0.18, 0.04, 0.35, 0.25, -0.24, PAL.glass);
        vbox(g, 0.04, 0.2, 0.04, 0.23, 0.23, 0.25, PAL.dark); // door split
        vbox(g, 0.04, 0.2, 0.04, 0.23, 0.23, -0.25, PAL.dark);
        vbox(g, 0.04, 0.08, 0.3, 0.49, 0.28, 0, PAL.glass); // front windshield
        vbox(g, 0.18, 0.05, 0.26, 0.49, 0.39, 0, PAL.trainTrim); // route sign
        for (const sz of [0.13, -0.13]) vellipsoid(g, 0.028, 0.028, 0.03, 0.49, 0.22, sz, PAL.headlight);
        for (const sz of [0.13, -0.13]) vellipsoid(g, 0.024, 0.025, 0.028, -0.49, 0.2, sz, PAL.taillight);
        vbox(g, 0.2, 0.05, 0.46, 0.02, 0.11, 0, PAL.busRoof);
        vcyl(g, 0.025, 0.42, -0.18, 0.47, 0, PAL.busRoof, "z", 10);
        vcyl(g, 0.025, 0.42, 0.18, 0.47, 0, PAL.busRoof, "z", 10);
        vbox(g, 0.72, 0.035, 0.035, -0.05, 0.18, 0.255, PAL.headlight);
        vbox(g, 0.72, 0.035, 0.035, -0.05, 0.18, -0.255, PAL.headlight);
        for (const sx of [0.3, -0.3]) for (const sz of [0.25, -0.25]) vwheel(g, 0.09, 0.08, sx, 0.08, sz);
        return g;
    }
    function buildTrain() {
        const g = new THREE.Group();
        vcyl(g, 0.2, 0.72, 0.02, 0.28, 0, PAL.trainBody, "x", 16); // boiler
        vbox(g, 0.78, 0.08, 0.44, 0.02, 0.11, 0, PAL.trainBody); // running board
        vbox(g, 0.28, 0.24, 0.42, -0.26, 0.48, 0, PAL.trainBody); // cab
        vbox(g, 0.3, 0.06, 0.44, -0.26, 0.62, 0, PAL.trainRoof); // cab roof
        vbox(g, 0.06, 0.1, 0.3, -0.12, 0.5, 0, PAL.glass); // cab window
        vbox(g, 0.07, 0.22, 0.44, 0.4, 0.22, 0, PAL.trainTrim); // front buffer (+x)
        vcyl(g, 0.055, 0.22, 0.22, 0.5, 0, PAL.stack, "y", 14); // smokestack
        vcyl(g, 0.08, 0.04, 0.22, 0.63, 0, PAL.stack, "y", 14);
        vellipsoid(g, 0.08, 0.055, 0.08, 0.02, 0.5, 0, PAL.trainTrim); // steam dome
        vbox(g, 0.58, 0.06, 0.04, 0.03, 0.37, 0.24, PAL.trainTrim); // side stripe
        vbox(g, 0.58, 0.06, 0.04, 0.03, 0.37, -0.24, PAL.trainTrim);
        vellipsoid(g, 0.07, 0.06, 0.055, 0.45, 0.36, 0, PAL.headlight); // front lamp
        vbox(g, 0.12, 0.1, 0.34, 0.47, 0.18, 0, PAL.stack); // cowcatcher/bumper
        vbox(g, 0.18, 0.04, 0.5, -0.43, 0.56, 0, PAL.trainRoof); // cab eave
        vbox(g, 0.04, 0.12, 0.34, -0.4, 0.46, 0, PAL.glass); // rear cab window
        vbox(g, 0.16, 0.06, 0.5, 0.45, 0.16, 0, PAL.trainTrim); // pilot face
        for (const sz of [0.26, -0.26]) {
            vbox(g, 0.18, 0.04, 0.035, 0.22, 0.43, sz, PAL.stack); // side handrail
            vbox(g, 0.18, 0.04, 0.035, -0.18, 0.43, sz, PAL.stack);
        }
        for (const sx of [-0.3, -0.08, 0.16, 0.34])
            for (const sz of [0.25, -0.25]) vwheel(g, 0.07, 0.065, sx, 0.07, sz);
        for (const sz of [0.285, -0.285]) vbox(g, 0.62, 0.025, 0.025, 0.02, 0.09, sz, PAL.trainTrim); // wheel rod
        return g;
    }
    function buildPrivateJet() {
        const g = new THREE.Group();
        vcyl(g, 0.1, 0.82, 0, 0.22, 0, PAL.jetBody, "x", 16); // fuselage faces +x
        vellipsoid(g, 0.16, 0.09, 0.09, 0.38, 0.25, 0, PAL.glass); // cockpit
        vellipsoid(g, 0.13, 0.095, 0.095, 0.48, 0.22, 0, PAL.jetBody); // rounded nose
        const leftWing = vshape(g, [[0.28, 0], [-0.18, 0.42], [-0.3, 0.36], [-0.04, 0]], -0.02, 0.18, 0.05, PAL.jetBody);
        leftWing.rotation.z = -Math.PI / 2;
        const rightWing = vshape(g, [[0.28, 0], [-0.18, -0.42], [-0.3, -0.36], [-0.04, 0]], -0.02, 0.18, -0.05, PAL.jetBody);
        rightWing.rotation.z = -Math.PI / 2;
        vcone(g, 0.055, 0.13, -0.06, 0.25, 0.49, PAL.jetBody, "y", 3); // winglets
        vcone(g, 0.055, 0.13, -0.06, 0.25, -0.49, PAL.jetBody, "y", 3);
        vcyl(g, 0.055, 0.14, -0.04, 0.12, 0.38, PAL.stack, "x", 12); // engine pods
        vcyl(g, 0.055, 0.14, -0.04, 0.12, -0.38, PAL.stack, "x", 12);
        vcone(g, 0.16, 0.28, -0.44, 0.36, 0, PAL.jetBody, "y", 3); // tail fin
        vbox(g, 0.08, 0.16, 0.06, -0.52, 0.45, 0, PAL.jetStripe); // tail colour
        vshape(g, [[0.08, 0], [-0.16, 0.25], [-0.23, 0.21], [-0.03, 0]], -0.42, 0.29, 0.06, PAL.jetBody);
        vshape(g, [[0.08, 0], [-0.16, -0.25], [-0.23, -0.21], [-0.03, 0]], -0.42, 0.29, -0.06, PAL.jetBody);
        vcyl(g, 0.018, 0.64, -0.06, 0.34, 0, PAL.jetStripe, "x", 10); // side stripe
        for (const sx of [0.2, 0.04, -0.12, -0.28]) vbox(g, 0.045, 0.035, 0.035, sx, 0.29, 0.095, PAL.glass);
        for (const sx of [0.2, 0.04, -0.12, -0.28]) vbox(g, 0.045, 0.035, 0.035, sx, 0.29, -0.095, PAL.glass);
        vbox(g, 0.12, 0.05, 0.12, 0.5, 0.22, 0, PAL.headlight); // nose light
        vbox(g, 0.025, 0.08, 0.025, 0.31, 0.08, 0, PAL.pole);
        vwheel(g, 0.04, 0.045, 0.31, 0.035, 0);
        for (const sz of [0.17, -0.17]) {
            vbox(g, 0.025, 0.07, 0.025, -0.12, 0.08, sz, PAL.pole);
            vwheel(g, 0.045, 0.045, -0.12, 0.035, sz);
        }
        return g;
    }
    function buildHouse() {
        const g = new THREE.Group();
        vbox(g, 0.72, 0.52, 0.62, 0, 0.26, 0, PAL.wall); // walls
        const roof = vcone(g, 0.62, 0.36, 0, 0.7, 0, PAL.roof, "y", 4);
        roof.rotation.y = Math.PI / 4;
        vcyl(g, 0.055, 0.3, 0.24, 0.74, -0.1, PAL.chimney, "y", 12); // chimney
        vcyl(g, 0.075, 0.04, 0.24, 0.9, -0.1, PAL.chimney, "y", 12);
        vbox(g, 0.18, 0.28, 0.05, 0, 0.16, 0.31, PAL.door); // door (front +z)
        vellipsoid(g, 0.025, 0.025, 0.018, 0.07, 0.27, 0.35, PAL.signRed); // doorknob
        vbox(g, 0.34, 0.06, 0.16, 0, 0.04, 0.4, PAL.stone); // front step
        vbox(g, 0.48, 0.04, 0.06, 0, 0.34, 0.37, PAL.roof); // tiny awning
        vbox(g, 0.36, 0.07, 0.07, 0, 0.2, 0.36, PAL.leaf); // flowerbox
        vellipsoid(g, 0.045, 0.045, 0.04, -0.12, 0.26, 0.39, PAL.bloom);
        vellipsoid(g, 0.045, 0.045, 0.04, 0.13, 0.26, 0.39, PAL.bloomY);
        vbox(g, 0.16, 0.16, 0.05, 0.22, 0.34, 0.31, PAL.win, true); // glowing windows
        vbox(g, 0.16, 0.16, 0.05, -0.22, 0.34, 0.31, PAL.win, true);
        vbox(g, 0.05, 0.16, 0.16, 0.36, 0.34, 0, PAL.win, true);
        return g;
    }
    function buildFountain() {
        const g = new THREE.Group();
        vcyl(g, 0.42, 0.14, 0, 0.07, 0, PAL.stone, "y", 16); // base
        vcyl(g, 0.34, 0.06, 0, 0.16, 0, PAL.fwater, "y", 16); // lower pool
        vcyl(g, 0.42, 0.055, 0, 0.19, 0, PAL.stone, "y", 16);
        vcyl(g, 0.08, 0.42, 0, 0.36, 0, PAL.stone, "y", 14); // pillar
        vcyl(g, 0.22, 0.08, 0, 0.58, 0, PAL.stone, "y", 16); // upper basin
        vcyl(g, 0.17, 0.045, 0, 0.63, 0, PAL.fwater, "y", 16); // upper water
        vcone(g, 0.035, 0.34, 0, 0.82, 0, PAL.fwater, "y", 12); // water jet
        for (const [x, z] of [
            [0.14, 0],
            [-0.14, 0],
            [0, 0.14],
            [0, -0.14],
        ])
            vellipsoid(g, 0.025, 0.045, 0.025, x, 0.78, z, PAL.fwater);
        for (const [x, z] of [
            [0.26, 0.26],
            [-0.26, 0.26],
            [0.26, -0.26],
            [-0.26, -0.26],
        ])
            vellipsoid(g, 0.055, 0.04, 0.055, x, 0.24, z, PAL.stone);
        return g;
    }
    function buildControlTower() {
        const g = new THREE.Group();
        vbox(g, 0.46, 0.16, 0.46, 0, 0.08, 0, PAL.stone); // base pad
        vcyl(g, 0.14, 1.2, 0, 0.72, 0, PAL.stnPlat, "y", 14); // tall shaft
        for (const [x, z] of [
            [0.17, 0],
            [-0.17, 0],
            [0, 0.17],
            [0, -0.17],
        ])
            vcyl(g, 0.024, 1.02, x, 0.68, z, PAL.pole, "y", 10);
        vbox(g, 0.66, 0.26, 0.66, 0, 1.36, 0, PAL.wall); // glass cabin
        vbox(g, 0.58, 0.16, 0.06, 0, 1.38, 0.34, PAL.win, true);
        vbox(g, 0.58, 0.16, 0.06, 0, 1.38, -0.34, PAL.win, true);
        vbox(g, 0.06, 0.16, 0.58, 0.34, 1.38, 0, PAL.win, true);
        vbox(g, 0.06, 0.16, 0.58, -0.34, 1.38, 0, PAL.win, true);
        vbox(g, 0.78, 0.1, 0.78, 0, 1.56, 0, PAL.stnRoof);
        vcyl(g, 0.035, 0.28, 0, 1.74, 0, PAL.pole, "y", 10);
        vellipsoid(g, 0.09, 0.06, 0.09, 0, 1.9, 0, PAL.runwayLight, true);
        return g;
    }
    function buildPond() {
        const g = new THREE.Group();
        vleaf(g, 0.34, 0.3, 0.1, 0.035, -0.1, PAL.leaf, 0.3);
        dot(g, 0.1, 0.08, -0.1, 0.09, PAL.bloom);
        vleaf(g, 0.26, 0.22, -0.16, 0.035, 0.14, PAL.leafDk, -0.4);
        dot(g, -0.16, 0.07, 0.14, 0.08, PAL.bloomY);
        vellipsoid(g, 0.08, 0.04, 0.05, 0.22, 0.04, 0.18, PAL.leafDk);
        for (const [x, z] of [
            [0.28, 0.1],
            [-0.28, -0.08],
            [0.02, 0.28],
        ])
            vellipsoid(g, 0.06, 0.03, 0.045, x, 0.03, z, PAL.stone);
        return g;
    }
    const buildStructure = (code) =>
        code === "cottage"
            ? buildHouse()
            : code === "pond"
              ? buildPond()
              : code === "controltower"
                ? buildControlTower()
                : buildFountain();

    // Plants — 6 voxel growth stages mapped to mastery (review_level 0–5). Each
    // stage carries vivid bloom dots / colourful leaves so it stands out on grass.
    const BLOOMS = [PAL.bloom, PAL.bloomY, PAL.bloomR, PAL.bloomP, PAL.bloomO, PAL.bloomW];
    function dot(g, x, y, z, s, col) {
        vellipsoid(g, s * 0.55, s * 0.55, s * 0.55, x, y, z, col);
    }
    function buildPlant(level) {
        const g = new THREE.Group();
        const lv = Math.max(0, Math.min(5, level | 0));
        if (lv === 0) {
            vellipsoid(g, 0.26, 0.07, 0.24, 0, 0.07, 0, PAL.soil);
            for (const [dx, dz] of [
                [0.16, 0.12],
                [-0.14, -0.1],
                [0.02, -0.18],
            ])
                vellipsoid(g, 0.045, 0.025, 0.045, dx, 0.15, dz, PAL.trunk);
            vcyl(g, 0.032, 0.2, 0, 0.22, 0, PAL.sprout, "y", 10);
            vleaf(g, 0.18, 0.12, 0.1, 0.29, 0, PAL.leaf, 0, -0.35);
            vleaf(g, 0.14, 0.1, -0.07, 0.25, -0.02, PAL.leafDk, 0.35, 0.45);
            dot(g, 0, 0.34, 0, 0.1, PAL.bloomY);
        } else if (lv === 1) {
            vcyl(g, 0.035, 0.34, 0, 0.17, 0, PAL.sprout, "y", 10);
            vleaf(g, 0.22, 0.12, 0.11, 0.29, 0, PAL.leaf, 0, -0.35);
            vleaf(g, 0.2, 0.12, -0.1, 0.25, 0, PAL.leaf, 0.15, 0.45);
            vleaf(g, 0.14, 0.22, 0, 0.33, 0.09, PAL.leafDk, 0.15, 0.12);
            dot(g, 0.16, 0.3, 0, 0.1, PAL.bloomR);
            dot(g, -0.16, 0.26, 0, 0.1, PAL.bloom);
            dot(g, 0, 0.36, 0, 0.1, PAL.bloomY);
        } else if (lv === 2) {
            vcyl(g, 0.04, 0.24, 0, 0.12, 0, PAL.trunk, "y", 10);
            vellipsoid(g, 0.24, 0.18, 0.23, 0, 0.36, 0, PAL.leaf);
            vellipsoid(g, 0.18, 0.11, 0.16, 0.04, 0.53, 0.03, PAL.leafDk);
            for (const [dx, dz] of [
                [0.24, 0],
                [-0.22, 0.06],
                [0.02, -0.24],
            ])
                vleaf(g, 0.18, 0.14, dx, 0.35, dz, PAL.leafDk, Math.atan2(dx, dz), dx > 0 ? -0.4 : 0.4);
            const spots = [
                [0.16, 0.46, 0.12],
                [-0.15, 0.42, -0.1],
                [0.05, 0.6, 0.05],
                [-0.1, 0.5, 0.16],
                [0.14, 0.52, -0.13],
            ];
            spots.forEach((p, k) => dot(g, p[0], p[1], p[2], 0.12, BLOOMS[k % BLOOMS.length]));
        } else if (lv === 3) {
            vcyl(g, 0.03, 0.42, 0, 0.21, 0, PAL.sprout, "y", 10);
            vleaf(g, 0.2, 0.12, 0.12, 0.32, 0, PAL.leaf, 0, -0.35);
            vleaf(g, 0.18, 0.12, -0.12, 0.27, 0, PAL.leaf, 0.25, 0.45);
            vleaf(g, 0.14, 0.22, 0.02, 0.38, 0.1, PAL.leafDk, 0.25, 0.1);
            dot(g, 0, 0.5, 0, 0.2, PAL.bloomY);
            for (const [dx, dz, col, rz] of [
                [0.17, 0, PAL.bloomR, -Math.PI / 2],
                [-0.17, 0, PAL.bloomP, Math.PI / 2],
                [0, 0.17, PAL.bloom, 0],
                [0, -0.17, PAL.bloomO, Math.PI],
                [0.12, 0.12, PAL.bloomW, -Math.PI / 4],
                [-0.12, -0.12, PAL.bloom, (Math.PI * 3) / 4],
            ])
                vpetal(g, 0.13, 0.2, dx, 0.5, dz, col, rz);
        } else if (lv === 4) {
            vcyl(g, 0.075, 0.48, 0, 0.24, 0, PAL.trunk, "y", 12);
            vcyl(g, 0.055, 0.26, 0.08, 0.48, 0, PAL.trunk, "x", 10);
            vcyl(g, 0.05, 0.24, -0.1, 0.54, 0.02, PAL.trunk, "z", 10);
            vellipsoid(g, 0.32, 0.22, 0.31, 0, 0.58, 0, PAL.leaf);
            vellipsoid(g, 0.24, 0.16, 0.23, 0, 0.82, 0, PAL.leafDk);
            vellipsoid(g, 0.15, 0.11, 0.14, 0.28, 0.74, -0.05, PAL.leaf);
            vellipsoid(g, 0.14, 0.1, 0.13, -0.26, 0.7, 0.06, PAL.leafDk);
            const spots = [
                [0.22, 0.6, 0.1],
                [-0.2, 0.56, -0.14],
                [0.1, 0.86, 0.12],
                [-0.12, 0.8, 0.1],
                [0.18, 0.7, -0.18],
                [0, 0.96, 0],
            ];
            spots.forEach((p, k) => dot(g, p[0], p[1], p[2], 0.13, BLOOMS[k % BLOOMS.length]));
        } else {
            vcyl(g, 0.08, 0.52, 0, 0.26, 0, PAL.trunk, "y", 12);
            vcyl(g, 0.052, 0.26, 0.1, 0.5, 0, PAL.trunk, "x", 10);
            vcyl(g, 0.05, 0.26, -0.12, 0.56, 0.04, PAL.trunk, "z", 10);
            vellipsoid(g, 0.34, 0.23, 0.34, 0, 0.64, 0, PAL.gold);
            vellipsoid(g, 0.25, 0.17, 0.24, 0, 0.92, 0, PAL.gold);
            vellipsoid(g, 0.15, 0.1, 0.14, 0.3, 0.76, 0.04, PAL.gold);
            vellipsoid(g, 0.14, 0.095, 0.13, -0.28, 0.78, -0.06, PAL.gold);
            dot(g, 0, 1.14, 0, 0.14, PAL.bloomR);
            for (const [dx, dz] of [
                [0.24, 0.1],
                [-0.22, -0.12],
                [0.12, -0.22],
            ])
                dot(g, dx, 0.72, dz, 0.12, PAL.bloomW);
        }
        return g;
    }

    // Ground animals — smooth low-poly bodies, all facing +x (like vehicles).
    function buildAnimal(kind) {
        const g = new THREE.Group();
        const C =
            {
                cat: PAL.cat,
                dog: PAL.dog,
                rabbit: PAL.rabbit,
                chicken: PAL.chicken,
                pig: PAL.pig,
                cow: PAL.cow,
                deer: PAL.deer,
                bear: PAL.bear,
            }[kind] || PAL.cat;
        const legs = [];
        const leg = (x, z, h = 0.16, mat = C) => {
            const l = vcyl(g, 0.033, h, x, h * 0.5, z, mat, "y", 10);
            l.userData.walkLeg = z > 0 ? 1 : -1;
            legs.push(l);
            vellipsoid(g, 0.052, 0.022, 0.04, x + 0.015, 0.012, z, kind === "cow" || kind === "deer" ? PAL.hoof : PAL.dark);
            return l;
        };
        const eye = (x, y, z) => vellipsoid(g, 0.018, 0.018, 0.018, x, y, z, PAL.dark);
        const ear = (x, y, z, mat = C, inner = null) => {
            const e = vellipsoid(g, 0.035, 0.07, 0.025, x, y, z, mat);
            e.rotation.z = -0.25;
            if (inner) vellipsoid(g, 0.016, 0.04, 0.011, x + 0.005, y, z, inner);
            return e;
        };
        if (kind === "chicken") {
            vellipsoid(g, 0.16, 0.14, 0.12, -0.02, 0.22, 0, C);
            vellipsoid(g, 0.085, 0.09, 0.075, 0.13, 0.38, 0, C);
            vcone(g, 0.045, 0.09, 0.22, 0.38, 0, PAL.beak, "x", 12);
            eye(0.18, 0.42, 0.045);
            eye(0.18, 0.42, -0.045);
            for (const dx of [-0.025, 0.015, 0.055]) vcone(g, 0.025, 0.085, 0.11 + dx, 0.49, 0, PAL.comb, "y", 10);
            vellipsoid(g, 0.03, 0.04, 0.03, 0.19, 0.31, 0, PAL.comb);
            for (const sz of [0.07, -0.07]) {
                const wing = vshape(
                    g,
                    [
                        [-0.1, 0],
                        [0.08, 0.04],
                        [0.1, 0.14],
                        [-0.1, 0.1],
                    ],
                    -0.03,
                    0.29,
                    sz,
                    PAL.signWhite,
                    { rotX: sz > 0 ? Math.PI / 2 : -Math.PI / 2, rotZ: -0.15 },
                );
                wing.userData.walkLeg = sz > 0 ? 1 : -1;
            }
            for (const sz of [-0.06, 0, 0.06]) {
                const tail = vpetal(g, 0.08, 0.16, -0.17, 0.3, sz, PAL.signWhite, -0.45);
                tail.rotation.y = Math.PI / 2;
            }
            for (const sz of [0.06, -0.06]) {
                const l = vcyl(g, 0.014, 0.11, 0.02, 0.055, sz, PAL.beak, "y", 8);
                l.userData.walkLeg = sz > 0 ? 1 : -1;
                legs.push(l);
                vellipsoid(g, 0.045, 0.012, 0.018, 0.06, 0.004, sz, PAL.beak);
            }
            g.userData.walkLegs = legs;
            return g;
        }
        const bw = kind === "bear" ? 0.62 : kind === "deer" ? 0.54 : kind === "cow" ? 0.5 : kind === "pig" ? 0.46 : 0.4;
        const bh = kind === "bear" ? 0.28 : 0.22;
        const bodyY = kind === "bear" ? 0.25 : 0.23;
        vellipsoid(g, bw * 0.5, bh * 0.62, 0.15, -0.02, bodyY, 0, C);
        vellipsoid(g, bw * 0.34, 0.035, 0.16, -0.03, bodyY + bh * 0.55, 0, kind === "deer" ? PAL.deerChest : C);
        vellipsoid(g, kind === "bear" ? 0.14 : 0.12, kind === "bear" ? 0.12 : 0.105, 0.11, bw / 2 - 0.015, 0.34 + (bh - 0.22), 0, C);
        if (kind === "rabbit")
            for (const sz of [0.06, -0.06]) {
                const e = vellipsoid(g, 0.028, 0.12, 0.018, bw / 2 - 0.035, 0.55, sz, C);
                e.rotation.z = -0.1;
                vellipsoid(g, 0.012, 0.08, 0.008, bw / 2 - 0.025, 0.56, sz, PAL.pink);
            }
        else if (kind === "cat")
            for (const sz of [0.07, -0.07]) {
                vcone(g, 0.045, 0.09, bw / 2 - 0.02, 0.48, sz, C, "y", 3);
                vellipsoid(g, 0.012, 0.026, 0.01, bw / 2 - 0.01, 0.475, sz, PAL.pink);
            }
        else if (kind === "dog")
            for (const sz of [0.1, -0.1]) ear(bw / 2 - 0.03, 0.42, sz, PAL.dark);
        else if (kind === "cow") {
            for (const sz of [0.09, -0.09]) ear(bw / 2 - 0.01, 0.47, sz, PAL.cowSpot);
            for (const sz of [0.08, -0.08]) {
                const horn = vcone(g, 0.025, 0.1, bw / 2 + 0.055, 0.49, sz, PAL.antler, "x", 10);
                horn.rotation.z = 0.5;
            }
            vellipsoid(g, 0.065, 0.055, 0.085, bw / 2 + 0.075, 0.31, 0, PAL.pink);
            vellipsoid(g, 0.075, 0.05, 0.08, -0.05, 0.14, 0, PAL.pink);
        } else if (kind === "pig") {
            vellipsoid(g, 0.045, 0.045, 0.065, bw / 2 + 0.08, 0.31, 0, PAL.snout);
            eye(bw / 2 + 0.115, 0.32, 0.03);
            eye(bw / 2 + 0.115, 0.32, -0.03);
            for (const sz of [0.07, -0.07]) vcone(g, 0.04, 0.07, bw / 2 - 0.035, 0.45, sz, C, "y", 3);
        } else if (kind === "deer") {
            for (const sz of [0.08, -0.08]) {
                ear(bw / 2 - 0.03, 0.48, sz, C);
                vcyl(g, 0.015, 0.2, bw / 2 + 0.02, 0.6, sz, PAL.antler, "y", 8);
                vcyl(g, 0.014, 0.12, bw / 2 + 0.05, 0.7, sz, PAL.antler, "x", 8);
                vcyl(g, 0.012, 0.08, bw / 2 + 0.08, 0.64, sz, PAL.antler, "x", 8);
            }
            vellipsoid(g, 0.055, 0.045, 0.07, bw / 2 + 0.08, 0.32, 0, PAL.dark);
            for (const sx of [-0.15, 0.05])
                for (const sz of [0.11, -0.11]) vellipsoid(g, 0.035, 0.02, 0.025, sx, 0.42, sz, PAL.deerChest);
        } else if (kind === "bear") {
            for (const sz of [0.08, -0.08]) vellipsoid(g, 0.05, 0.05, 0.035, bw / 2 - 0.03, 0.48, sz, C);
            vellipsoid(g, 0.07, 0.055, 0.075, bw / 2 + 0.1, 0.31, 0, PAL.snout);
            vellipsoid(g, 0.17, 0.03, 0.09, -0.02, 0.41, 0, PAL.dark);
            vellipsoid(g, 0.16, 0.085, 0.11, 0.05, 0.22, 0, PAL.deerChest);
        }
        eye(bw / 2 + 0.09, 0.39, 0.07);
        eye(bw / 2 + 0.09, 0.39, -0.07);
        if (kind === "cat" || kind === "dog") {
            vellipsoid(g, 0.055, 0.04, 0.055, bw / 2 + 0.09, 0.3, 0, PAL.dark);
            vcyl(g, 0.013, 0.26, bw / 2 - 0.06, 0.32, 0, kind === "dog" ? PAL.signRed : PAL.pink, "z", 10);
        }
        if (kind === "cat") {
            vbox(g, 0.012, 0.012, 0.22, bw / 2 + 0.12, 0.36, 0, PAL.dark);
            vbox(g, 0.012, 0.012, 0.18, bw / 2 + 0.12, 0.33, 0, PAL.dark);
        }
        for (const sx of [bw / 2 - 0.06, -(bw / 2 - 0.06)])
            for (const sz of [0.08, -0.08]) {
                leg(sx, sz, kind === "bear" ? 0.17 : 0.145, kind === "cow" ? PAL.hoof : C);
            }
        if (kind === "pig")
            vcyl(g, 0.018, 0.05, -bw / 2 - 0.03, 0.31, 0, PAL.pink, "z", 10);
        else if (kind === "rabbit") vellipsoid(g, 0.06, 0.06, 0.06, -bw / 2 - 0.04, 0.3, 0, PAL.signWhite);
        else if (kind === "deer") vellipsoid(g, 0.035, 0.035, 0.09, -bw / 2 - 0.04, 0.34, 0, PAL.deerChest);
        else if (kind === "bear") vellipsoid(g, 0.05, 0.04, 0.065, -bw / 2 - 0.03, 0.3, 0, C);
        else {
            const tail = vcyl(g, 0.025, 0.16, -bw / 2 - 0.04, 0.31, 0, kind === "cow" ? PAL.cowSpot : C, "z", 10);
            if (kind === "cat" || kind === "dog") tail.rotation.z = kind === "cat" ? 0.65 : -0.45;
        }
        if (kind === "cow") {
            vellipsoid(g, 0.07, 0.02, 0.06, -0.06, 0.35, 0.05, PAL.cowSpot);
            vellipsoid(g, 0.055, 0.018, 0.05, 0.1, 0.35, -0.07, PAL.cowSpot);
            vellipsoid(g, 0.065, 0.018, 0.07, -0.2, 0.27, -0.08, PAL.cowSpot);
        }
        g.userData.walkLegs = legs;
        return g;
    }

    // Sky critters — wings tagged userData.wing (±1) so tick() can flap them.
    function buildCritter(kind) {
        const g = new THREE.Group();
        if (kind === "bee") {
            vellipsoid(g, 0.14, 0.07, 0.07, -0.03, 0, 0, PAL.bee);
            vellipsoid(g, 0.07, 0.065, 0.065, 0.1, 0.004, 0, PAL.beeDk);
            vbox(g, 0.025, 0.13, 0.13, -0.09, 0, 0, PAL.beeDk);
            vbox(g, 0.025, 0.13, 0.13, -0.015, 0, 0, PAL.beeDk);
            vbox(g, 0.035, 0.025, 0.025, -0.175, 0, 0, PAL.beeDk); // stinger
            for (const sz of [0.035, -0.035]) {
                vbox(g, 0.018, 0.018, 0.018, 0.155, 0.025, sz, PAL.dark);
                vbox(g, 0.075, 0.01, 0.01, 0.165, 0.075, sz * 1.9, PAL.beeDk).rotation.z = -0.62;
            }
            for (const side of [1, -1]) {
                const front = wingPivot(side, 0.02, 0.065, side * 0.035, -side * 0.46, 0.82);
                front.add(wingMembrane("beeFore", PAL.wing, side, 0.9));
                front.add(
                    wingVeins(
                        side,
                        [
                            [
                                [0, 0],
                                [0.03, 0.21],
                            ],
                            [
                                [0, 0.05],
                                [0.08, 0.16],
                            ],
                        ],
                        0.9,
                    ),
                );
                g.add(front);

                const hind = wingPivot(side, -0.04, 0.055, side * 0.03, -side * 0.35, 0.68);
                hind.add(wingMembrane("beeHind", PAL.wing, side, 0.72));
                hind.add(
                    wingVeins(
                        side,
                        [
                            [
                                [-0.02, 0],
                                [-0.02, 0.15],
                            ],
                            [
                                [-0.02, 0.04],
                                [0.04, 0.12],
                            ],
                        ],
                        0.72,
                    ),
                );
                g.add(hind);
            }
            return g;
        }
        if (kind === "bird") {
            vellipsoid(g, 0.16, 0.09, 0.08, -0.02, 0, 0, PAL.birdBody);
            vellipsoid(g, 0.07, 0.07, 0.065, 0.13, 0.045, 0, PAL.birdBody);
            vellipsoid(g, 0.08, 0.035, 0.055, 0.02, -0.025, 0, PAL.birdChest);
            vbox(g, 0.075, 0.035, 0.035, 0.205, 0.045, 0, PAL.beak);
            vbox(g, 0.018, 0.018, 0.018, 0.17, 0.075, 0.042, PAL.dark);
            vbox(g, 0.018, 0.018, 0.018, 0.17, 0.075, -0.042, PAL.dark);
            for (const side of [1, -1]) {
                const wing = wingPivot(side, -0.05, 0.02, side * 0.06, -side * 0.38, 0.92);
                wing.add(wingMembrane("birdWing", PAL.birdWingFace, side, 1.08));
                vbox(wing, 0.16, 0.012, 0.025, 0.04, 0.16, side * 0.01, PAL.birdTail).rotation.z = -0.2;
                g.add(wing);
            }
            for (const sz of [-0.06, 0, 0.06]) {
                const tail = vbox(g, 0.13, 0.025, 0.04, -0.18, 0.02, sz, PAL.birdTail);
                tail.rotation.z = -0.35;
            }
            return g;
        }
        vellipsoid(g, 0.045, 0.12, 0.035, -0.01, 0.005, 0, PAL.beeDk);
        vellipsoid(g, 0.04, 0.04, 0.035, 0.065, 0.08, 0, PAL.beeDk);
        vbox(g, 0.11, 0.012, 0.012, 0.09, 0.13, 0.045, PAL.beeDk).rotation.z = 0.55;
        vbox(g, 0.11, 0.012, 0.012, 0.09, 0.13, -0.045, PAL.beeDk).rotation.z = 0.55;
        for (const side of [1, -1]) {
            const wing = wingPivot(side, -0.005, 0.035, side * 0.026, -side * 0.72, 1.15);
            wing.add(wingMembrane("butterFore", side > 0 ? PAL.bfA : PAL.bfB, side));
            wing.add(wingMembrane("butterHind", side > 0 ? PAL.bfB : PAL.bfA, side, 0.95));
            wing.add(
                wingVeins(side, [
                    [
                        [0.02, 0],
                        [0.1, 0.34],
                    ],
                    [
                        [-0.02, 0],
                        [-0.08, 0.28],
                    ],
                    [
                        [0, 0.08],
                        [0.12, 0.22],
                    ],
                    [
                        [0, 0.08],
                        [-0.12, 0.2],
                    ],
                ]),
            );
            wingDot(wing, side, 0.1, 0.25, 0.028, PAL.bfSpot);
            wingDot(wing, side, -0.09, 0.18, 0.023, PAL.bfEdge);
            g.add(wing);
        }
        return g;
    }

    function buildGnome() {
        const g = new THREE.Group();
        vcone(g, 0.16, 0.34, 0, 0.18, 0, PAL.gBody, "y", 14); // robe
        vcyl(g, 0.13, 0.035, 0, 0.22, 0, PAL.dark, "y", 12); // belt
        vellipsoid(g, 0.05, 0.025, 0.06, 0.08, 0.05, 0.08, PAL.dark); // boots
        vellipsoid(g, 0.05, 0.025, 0.06, 0.08, 0.05, -0.08, PAL.dark);
        vellipsoid(g, 0.13, 0.06, 0.1, 0.02, 0.31, 0, PAL.gBeard); // beard
        vellipsoid(g, 0.11, 0.09, 0.095, 0.02, 0.4, 0, PAL.gFace); // face
        vellipsoid(g, 0.035, 0.028, 0.028, 0.12, 0.39, 0, PAL.snout); // nose
        vellipsoid(g, 0.014, 0.014, 0.014, 0.09, 0.43, 0.055, PAL.dark);
        vellipsoid(g, 0.014, 0.014, 0.014, 0.09, 0.43, -0.055, PAL.dark);
        vcyl(g, 0.14, 0.055, 0, 0.49, 0, PAL.gHat, "y", 14); // hat brim
        vcone(g, 0.11, 0.34, 0, 0.62, 0, PAL.gHat, "y", 14); // hat
        return g;
    }

    function buildStation() {
        const g = new THREE.Group();
        vbox(g, 0.92, 0.1, 0.5, 0, 0.05, 0, PAL.stnPlat); // platform
        for (const sx of [-0.36, 0, 0.36]) vcyl(g, 0.03, 0.34, sx, 0.27, -0.14, PAL.stnPost, "y", 10); // posts
        vbox(g, 0.98, 0.08, 0.36, 0, 0.46, -0.05, PAL.stnRoof); // roof
        vcyl(g, 0.04, 0.98, 0, 0.51, -0.05, PAL.stnRoof, "x", 12);
        vbox(g, 0.52, 0.16, 0.04, 0, 0.34, -0.2, PAL.stnBoard); // name board
        vbox(g, 0.18, 0.05, 0.05, -0.16, 0.34, -0.23, PAL.signWhite);
        vbox(g, 0.18, 0.05, 0.05, 0.16, 0.34, -0.23, PAL.signWhite);
        vbox(g, 0.16, 0.12, 0.04, -0.28, 0.34, -0.24, PAL.busBody); // bus/train badges on sign
        vbox(g, 0.16, 0.12, 0.04, 0.28, 0.34, -0.24, PAL.trainBody);
        vcyl(g, 0.03, 0.12, -0.34, 0.14, 0.18, PAL.stnPost, "y", 10); // bench legs
        vcyl(g, 0.03, 0.12, 0.34, 0.14, 0.18, PAL.stnPost, "y", 10);
        vbox(g, 0.78, 0.06, 0.08, 0, 0.24, 0.18, PAL.stnPost);
        vbox(g, 0.18, 0.2, 0.04, 0.3, 0.22, 0.23, PAL.win, true); // glowing window
        return g;
    }

    function signalHead(group, x, y, z, faceZ) {
        vbox(group, faceZ ? 0.16 : 0.1, 0.46, faceZ ? 0.1 : 0.16, x, y, z, PAL.dark);
        const dx = faceZ ? 0 : 0.06,
            dz = faceZ ? 0.06 : 0;
        return {
            r: vellipsoid(group, 0.052, 0.052, 0.04, x + dx, y + 0.14, z + dz, PAL.lampOff),
            y: vellipsoid(group, 0.052, 0.052, 0.04, x + dx, y, z + dz, PAL.lampOff),
            g: vellipsoid(group, 0.052, 0.052, 0.04, x + dx, y - 0.14, z + dz, PAL.lampOff),
        };
    }
    const faceRotation = (dir) => Math.atan2(dir.dc, dir.dr); // local +z faces dir
    const rightSide = (dir) => ({ dc: -dir.dr, dr: dir.dc }); // right side for traffic driving toward the junction
    const opposite = (dir) => ({ dc: -dir.dc, dr: -dir.dr });
    const roadCornerOffset = (a, b) => ({ dc: a.dc * 0.5 + b.dc * 0.5, dr: a.dr * 0.5 + b.dr * 0.5 });
    function vdirBox(group, len, h, thick, dir, x, y, z, mat) {
        const alongX = dir.dc !== 0;
        return vbox(group, alongX ? len : thick, h, alongX ? thick : len, x, y, z, mat);
    }

    // Canada-style signal: one pole/head per road approach. The four heads share
    // a two-axis cycle (N/S together, E/W together), like a simple real junction.
    function buildTrafficLight(arms) {
        const g = new THREE.Group();
        const headsNS = [],
            headsEW = [];
        for (const arm of arms) {
            const dir = { dc: arm.dc, dr: arm.dr };
            const travel = opposite(dir);
            const driverRight = rightSide(travel);
            const farSide = opposite(dir);
            const driverLeft = opposite(driverRight);
            const corner = roadCornerOffset(farSide, driverRight);
            const armLen = 0.36;
            const pole = new THREE.Group();
            vcyl(pole, 0.038, 0.94, 0, 0.47, 0, PAL.pole, "y", 10);
            vdirBox(
                pole,
                armLen,
                0.08,
                0.08,
                driverLeft,
                driverLeft.dc * armLen * 0.5,
                0.88,
                driverLeft.dr * armLen * 0.5,
                PAL.pole,
            );
            const headGroup = new THREE.Group();
            const head = signalHead(headGroup, 0, 0, 0, true);
            headGroup.position.set(driverLeft.dc * armLen, 0.78, driverLeft.dr * armLen);
            headGroup.rotation.y = faceRotation(dir);
            pole.add(headGroup);
            pole.position.set(corner.dc, 0, corner.dr);
            g.add(pole);
            (dir.dr !== 0 ? headsNS : headsEW).push(head);
        }
        return { group: g, headsNS, headsEW };
    }
    function setTrafficLight(lt, states) {
        for (const h of lt.headsNS || []) setHead(h, states.ns);
        for (const h of lt.headsEW || []) setHead(h, states.ew);
        if (lt.headV) {
            setHead(lt.headV, states.ns);
            setHead(lt.headH, states.ew);
        }
    }

    function buildStopSign(faceDir = { dc: 0, dr: 1 }) {
        const g = new THREE.Group();
        vbox(g, 0.06, 0.6, 0.06, 0, 0.3, 0, PAL.pole);
        const border = new THREE.Mesh(octagonGeometry(0.22), PAL.signWhiteFace);
        border.position.set(0, 0.63, 0.026);
        g.add(border);
        const face = new THREE.Mesh(octagonGeometry(0.188), PAL.signRedFace);
        face.position.set(0, 0.63, 0.03);
        g.add(face);
        const letters = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.112), stopTextMat);
        letters.position.set(0, 0.63, 0.034);
        g.add(letters);
        vbox(g, 0.08, 0.04, 0.04, 0, 0.52, 0.015, PAL.pole); // bracket
        g.rotation.y = Math.atan2(faceDir.dc, faceDir.dr);
        return g;
    }

    function addStopSigns(c, r, arms) {
        for (const arm of arms) {
            const dir = { dc: arm.c - c, dr: arm.r - r };
            const right = rightSide(opposite(dir));
            const corner = roadCornerOffset(dir, right);
            const sign = buildStopSign(dir);
            sign.position.set(worldX(c) + corner.dc, TOP, worldZ(r) + corner.dr);
            ground.add(sign);
        }
    }
    function setHead(head, state) {
        head.r.material = state === "red" ? PAL.lampRed : PAL.lampOff;
        head.y.material = state === "yellow" ? PAL.lampYellow : PAL.lampOff;
        head.g.material = state === "green" ? PAL.lampGreen : PAL.lampOff;
    }

    // Level-crossing signal: one warning face per road approach, placed on the
    // right side for right-hand traffic and facing incoming cars/buses. Gates
    // independently pivot from that roadside position across the road.
    function buildCrossingSignal(arms) {
        const g = new THREE.Group();
        const gates = [],
            lamps = [];
        for (const arm of arms) {
            const dir = { dc: arm.c, dr: arm.r };
            const driverRight = rightSide(opposite(dir));
            const corner = roadCornerOffset(dir, driverRight);
            const pole = new THREE.Group();
            vcyl(pole, 0.034, 0.62, 0, 0.31, 0, PAL.pole, "y", 10); // post
            const face = new THREE.Group();
            vbox(face, 0.3, 0.07, 0.04, 0, 0.56, 0, PAL.signWhite); // crossbuck faces road traffic
            vbox(face, 0.07, 0.3, 0.04, 0, 0.56, 0, PAL.signWhite);
            lamps.push(vellipsoid(face, 0.04, 0.04, 0.025, -0.1, 0.44, 0.04, PAL.lampOff));
            lamps.push(vellipsoid(face, 0.04, 0.04, 0.025, 0.1, 0.44, 0.04, PAL.lampOff));
            face.rotation.y = faceRotation(dir);
            pole.add(face);
            const gatePivot = new THREE.Group();
            gatePivot.position.set(0, 0.36, 0); // hinge at the roadside
            gatePivot.rotation.y = faceRotation(driverRight); // aim across the road
            const gate = new THREE.Group(); // child boom only pivots up/down
            vcyl(gate, 0.026, 0.9, 0, 0, -0.45, PAL.gateW, "z", 10); // arm reaches across road (-z)
            vbox(gate, 0.06, 0.06, 0.16, 0, 0, -0.16, PAL.gateR); // red stripes
            vbox(gate, 0.06, 0.06, 0.16, 0, 0, -0.5, PAL.gateR);
            vbox(gate, 0.06, 0.06, 0.16, 0, 0, -0.84, PAL.gateR);
            gate.userData.openX = Math.PI / 2;
            gate.userData.closedX = 0;
            gate.rotation.x = gate.userData.openX; // up (open) by default; closedX = down/blocking
            gatePivot.add(gate);
            pole.add(gatePivot);
            pole.position.set(corner.dc, 0, corner.dr);
            g.add(pole);
            gates.push(gate);
        }
        return { group: g, lamps, gates };
    }
    function updateNightGlow() {
        props.traverse((o) => {
            if (o.userData?.glow) o.material = isNight ? PAL.winGlow : PAL.win;
        });
    }

    // ── The model: authoritative, stored layout ────────────────────────────────
    // placedItems holds every positioned ground item: road/rail/runway (surface),
    // car/bus/train/jet (vehicle), AND structures. All remember
    // col/grid_row in garden_items, so nothing jumps around between visits.
    const plantsModel = new Map(); // wordId → { col, row, level, due }
    let placedItems = (opts.placed || []).map((p) => ({ ...p })); // { id, code, col, row, rotation }
    const isStructure = (code) => STRUCTURE_CODES.includes(code);
    const isAnimal = (code) => !!SHOP[code]?.animal;
    const isStation = (code) => !!SHOP[code]?.station;
    const isTower = (code) => !!SHOP[code]?.tower;
    const structureSurface = (code) => (code === "pond" ? "water" : code === "fountain" ? "stone" : "grass");

    const plantPos = opts.plantPos || new Map();
    words.forEach((w) => {
        const p = plantPos.get(w.id);
        plantsModel.set(w.id, {
            col: p ? p.col : null,
            row: p ? p.row : null,
            level: w.review_level ?? 0,
            due: dueIds.has(w.id),
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
            else if (isStructure(it.code))
                set(it.col, it.row, { surface: structureSurface(it.code), occupant: "structure", code: it.code });
            else if (isStation(it.code) || isTower(it.code))
                set(it.col, it.row, { occupant: "structure", code: it.code });
            else if (isAnimal(it.code)) set(it.col, it.row, { occupant: "animal", code: it.code, ref: it.id });
        }
        for (const it of placedItems) {
            if (it === skipRef || it.id === skipRef) continue;
            if (it.col == null || it.row == null) continue;
            const info = SHOP[it.code];
            if (info?.vehicle) set(it.col, it.row, { occupant: "vehicle", code: it.code, ref: it.id });
        }
        for (const [wid, p] of plantsModel) {
            if (wid === skipRef) continue;
            if (p.col == null || p.row == null) continue;
            set(p.col, p.row, { occupant: "plant", ref: wid });
        }
        return cells;
    }

    // Find the free cell nearest a preferred origin (expanding-ring scan).
    const HARD = ["road", "rail", "crossing", "fence", "runway", "water", "stone"];
    function nearestFreeCell(prefC, prefR, cells) {
        if (!cells.get(cellKey(prefC, prefR))?.occupant && !HARD.includes(cells.get(cellKey(prefC, prefR))?.surface)) {
            return { col: prefC, row: prefR };
        }
        for (let rad = 1; rad < 200; rad++) {
            for (let dc = -rad; dc <= rad; dc++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                    const c = prefC + dc,
                        r = prefR + dr;
                    const cell = cells.get(cellKey(c, r));
                    if (!cell) return { col: c, row: r };
                    if (!cell.occupant && !HARD.includes(cell.surface)) {
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
        const need = placedItems.filter((it) => isStructure(it.code) && it.col == null);
        if (!need.length) return;
        const cells = computeCells();
        for (const it of need) {
            const spot = nearestFreeCell(0, 0, cells);
            it.col = spot.col;
            it.row = spot.row;
            it.rotation = it.rotation || 0;
            cells.set(cellKey(spot.col, spot.row), {
                surface: structureSurface(it.code),
                occupant: "structure",
                code: it.code,
            });
            cb.itemMoved(it.id, it.col, it.row, 0);
        }
    }

    // Give bought ground animals a fixed home cell. Their live walking position
    // is runtime-only; the home cell controls their fenced roaming region.
    function assignAnimalHomes() {
        const need = placedItems.filter((it) => isAnimal(it.code) && it.col == null);
        if (!need.length) return;
        const cells = computeCells();
        for (const it of need) {
            const spot = nearestFreeCell(0, 0, cells);
            it.col = spot.col;
            it.row = spot.row;
            it.rotation = it.rotation || 0;
            cells.set(cellKey(spot.col, spot.row), { occupant: "animal", code: it.code, ref: it.id });
            cb.itemMoved(it.id, it.col, it.row, 0);
        }
    }

    function animalHomeBlocked(it) {
        if (!isAnimal(it.code) || it.col == null || it.row == null) return false;
        const cell = computeCells(it.id).get(cellKey(it.col, it.row));
        return !!cell && (cell.occupant || HARD.includes(cell.surface));
    }

    function rehomeBlockedAnimals() {
        for (const it of placedItems) {
            if (!animalHomeBlocked(it)) continue;
            const cells = computeCells(it.id);
            const spot = nearestFreeCell(it.col, it.row, cells);
            it.col = spot.col;
            it.row = spot.row;
            it.rotation = it.rotation || 0;
            cb.itemMoved(it.id, it.col, it.row, it.rotation || 0);
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
            p.col = spot.col;
            p.row = spot.row;
            cells.set(cellKey(spot.col, spot.row), { occupant: "plant", ref: wid });
            newHomes.push({ wordId: wid, col: spot.col, row: spot.row });
        }
        cb.assignHomes(newHomes);
    }

    assignStructureHomes();
    assignAnimalHomes();
    assignPlantHomes();
    rehomeBlockedAnimals();

    // ── Field bounds (content bounding box + PAD rings) ─────────────────────────
    let B = { minC: 0, maxC: 0, minR: 0, maxR: 0 };
    let cols = 1,
        rows = 1,
        centerC = 0,
        centerR = 0,
        plotR = 3;
    function computeBounds() {
        const all = [];
        for (const [, p] of plantsModel) if (p.col != null) all.push([p.col, p.row]);
        for (const it of placedItems) if (it.col != null) all.push([it.col, it.row]);
        if (!all.length) {
            B = { minC: 0, maxC: 0, minR: 0, maxR: 0 };
        } else {
            B = {
                minC: Math.min(...all.map((a) => a[0])),
                maxC: Math.max(...all.map((a) => a[0])),
                minR: Math.min(...all.map((a) => a[1])),
                maxR: Math.max(...all.map((a) => a[1])),
            };
        }
        centerC = (B.minC + B.maxC) / 2;
        centerR = (B.minR + B.maxR) / 2;
        cols = B.maxC + PAD - (B.minC - PAD) + 1;
        rows = B.maxR + PAD - (B.minR - PAD) + 1;
        plotR = Math.max(cols, rows) * SP * 0.6 + 1;
    }
    const worldX = (col) => (col - centerC) * SP;
    const worldZ = (row) => (row - centerR) * SP;

    // ── Sprite/texture helpers ──────────────────────────────────────────────────
    const texCache = new Map();
    function emojiTexture(emoji, dim = false) {
        const key = emoji + (dim ? ":dim" : "");
        if (texCache.has(key)) return texCache.get(key);
        const cv = document.createElement("canvas");
        cv.width = cv.height = 128;
        const ctx = cv.getContext("2d");
        ctx.font = "96px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
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
    let ground = new THREE.Group(); // blocks + road/rail meshes
    let props = new THREE.Group(); // plant + vehicle sprites
    scene.add(ground);
    scene.add(props);
    const blockCells = []; // { mesh, col, row } for raycast → cell
    let plantSprites = []; // plant: { group, baseY, phase, wordId, due, pop?, dropEntry? } | drop: { sprite, baseY, phase, drop:true }
    let vehicleSprites = []; // { group, id, code, phase } — 3D voxel models
    let plantTops = []; // creature landing spots
    let cottageSpot = null;
    let trafficLights = []; // { headV, headH } — 3-lamp heads, refreshed each build
    let lightCells = new Set(); // cellKeys of 4-way light-controlled road junctions
    let stopCells = new Set(); // cellKeys of 3-arm stop-sign junctions
    let crossingSignals = []; // { l1, l2, gate, key } at level-crossing cells
    let runwayLights = []; // blinking blue runway edge lights
    let stationRailCells = new Set(); // rail cells next to a station (trains dwell here)
    let stationRoadCells = new Set(); // road cells next to a station (buses dwell here)
    // Vehicles drive the connected track network. State persists across rebuilds
    // (keyed by item id) so editing elsewhere doesn't reset them. ein/eout are the
    // cell-step directions {dc,dr} entering/leaving the current cell; p is 0..1
    // progress across it; hx/hz is the last heading (for facing while parked).
    let currentCells = new Map(); // latest occupancy map (for neighbour lookups)
    const vehicleState = new Map(); // id → { c, r, ein, eout, p, sound, hx, hz, dwell, stopAt }
    const VSPEED = 1.25; // cells per second
    const LANE = 0.16; // keep-right lateral offset (cars only)
    const stopLineP = (code) => (code === "bus" ? 0.52 : 0.6); // keep vehicle noses behind junctions
    // Canada-style signal cycle per axis: green → yellow → all-red, then the other.
    const SIG_G = 6,
        SIG_Y = 2,
        SIG_R = 1,
        SIG_CYCLE = 2 * (SIG_G + SIG_Y + SIG_R);
    let lastSig = ""; // last applied {ns,ew} state (skip redundant swaps)
    function axisStates(t) {
        const p = ((t % SIG_CYCLE) + SIG_CYCLE) % SIG_CYCLE;
        if (p < SIG_G) return { ns: "green", ew: "red" };
        if (p < SIG_G + SIG_Y) return { ns: "yellow", ew: "red" };
        if (p < SIG_G + SIG_Y + SIG_R) return { ns: "red", ew: "red" };
        const q = p - (SIG_G + SIG_Y + SIG_R);
        if (q < SIG_G) return { ns: "red", ew: "green" };
        if (q < SIG_G + SIG_Y) return { ns: "red", ew: "yellow" };
        return { ns: "red", ew: "red" };
    }
    const canGo = (states, d) => (d.dr !== 0 ? states.ns : states.ew) === "green";
    const dirKey = (d) => `${d.dc},${d.dr}`;
    const vehicleSurface = (code) => SHOP[code]?.vehicle || null; // 'road' | 'rail' | 'runway'
    const vehicleRideY = (code) => (code === "train" ? TOP + 0.16 : code === "privatejet" ? TOP + 0.12 : TOP + 0.115);
    // A car drives road OR crossing; a train drives rail OR crossing (the Level
    // Crossing tile belongs to both networks — Decision #10 stays one-surface).
    // Runways are separate airport surfaces and only jets use them.
    const carries = (surface, vehSurf) =>
        surface === vehSurf || ((vehSurf === "road" || vehSurf === "rail") && surface === "crossing");
    function trackNeighbours(c, r, vehSurf) {
        const out = [];
        for (const [dc, dr] of [
            [0, -1],
            [0, 1],
            [1, 0],
            [-1, 0],
        ]) {
            if (carries(currentCells.get(cellKey(c + dc, r + dr))?.surface, vehSurf))
                out.push({ c: c + dc, r: r + dr });
        }
        return out;
    }
    const runwayAt = (cells, c, r) => cells.get(cellKey(c, r))?.surface === "runway";
    function runwaySpan(c, r, cells, axis) {
        if (!runwayAt(cells, c, r)) return { len: 0, index: 0, startC: c, startR: r, endC: c, endR: r, axis };
        const dc = axis === "x" ? 1 : 0,
            dr = axis === "z" ? 1 : 0;
        let startC = c,
            startR = r,
            endC = c,
            endR = r;
        while (runwayAt(cells, startC - dc, startR - dr)) {
            startC -= dc;
            startR -= dr;
        }
        while (runwayAt(cells, endC + dc, endR + dr)) {
            endC += dc;
            endR += dr;
        }
        const len = Math.max(Math.abs(endC - startC), Math.abs(endR - startR)) + 1;
        const index = Math.max(Math.abs(c - startC), Math.abs(r - startR));
        return { axis, len, index, startC, startR, endC, endR, key: `${axis}:${startC}:${startR}:${endC}:${endR}` };
    }
    function runwayInfo(c, r, cells = currentCells) {
        const x = runwaySpan(c, r, cells, "x");
        const z = runwaySpan(c, r, cells, "z");
        const best = x.len >= z.len ? x : z;
        return { ...best, active: best.len >= 10 };
    }
    function runwayTakeoffAnchor(seg, nearC, nearR) {
        const dStart = Math.abs(seg.startC - nearC) + Math.abs(seg.startR - nearR);
        const dEnd = Math.abs(seg.endC - nearC) + Math.abs(seg.endR - nearR);
        return dStart <= dEnd ? { c: seg.startC, r: seg.startR, dir: 1 } : { c: seg.endC, r: seg.endR, dir: -1 };
    }
    function nearestValidRunway(c, r, cells = currentCells) {
        let best = null;
        for (const [key, cell] of cells) {
            if (cell.surface !== "runway") continue;
            const [cc, rr] = key.split(":").map(Number);
            const seg = runwayInfo(cc, rr, cells);
            if (!seg.active) continue;
            const anchor = runwayTakeoffAnchor(seg, c, r);
            const dist = Math.abs(anchor.c - c) + Math.abs(anchor.r - r);
            if (!best || dist < best.dist) best = { ...anchor, seg, dist };
        }
        return best;
    }
    function validRunwaySegments(cells = currentCells) {
        const out = [];
        const seen = new Set();
        for (const [key, cell] of cells) {
            if (cell.surface !== "runway") continue;
            const [c, r] = key.split(":").map(Number);
            const seg = runwayInfo(c, r, cells);
            if (!seg.active || seen.has(seg.key)) continue;
            seen.add(seg.key);
            out.push(seg);
        }
        return out;
    }
    function runwayEndpoint(seg, dir = 1) {
        const fromStart = dir >= 0;
        const sc = fromStart ? seg.startC : seg.endC;
        const sr = fromStart ? seg.startR : seg.endR;
        const ec = fromStart ? seg.endC : seg.startC;
        const er = fromStart ? seg.endR : seg.startR;
        const sx = worldX(sc), sz = worldZ(sr), ex = worldX(ec), ez = worldZ(er);
        const d = Math.hypot(ex - sx, ez - sz) || 1;
        return { seg, dir, sc, sr, ec, er, sx, sz, ex, ez, fx: (ex - sx) / d, fz: (ez - sz) / d, len: d };
    }
    function chooseJetRoute(fromC, fromR) {
        const segs = validRunwaySegments(currentCells);
        const dep = nearestValidRunway(fromC, fromR, currentCells);
        if (!dep || !segs.length) return null;
        const arrSeg = segs[Math.floor(Math.random() * segs.length)];
        const arrDir = Math.random() < 0.5 ? 1 : -1;
        const takeoff = runwayEndpoint(dep.seg, dep.dir);
        const landing = runwayEndpoint(arrSeg, arrDir);
        const span = Math.hypot(landing.sx - takeoff.ex, landing.sz - takeoff.ez);
        const approach = Math.max(2.2, Math.min(5.5, landing.len * 0.45));
        const ctrl = Math.max(3.0, Math.min(8.0, span * 0.45 + 2.0));
        const cruiseY = TOP + 4.6 + Math.min(2.0, span * 0.12);
        const liftY = TOP + 2.5;
        const approachY = TOP + 2.0;
        const p0 = { x: takeoff.ex, y: liftY, z: takeoff.ez };
        const p3 = { x: landing.sx - landing.fx * approach, y: approachY, z: landing.sz - landing.fz * approach };
        return {
            key: `${takeoff.seg.key}:${takeoff.dir}->${landing.seg.key}:${landing.dir}:${Math.random().toString(36).slice(2)}`,
            takeoff,
            landing,
            approach,
            p0,
            p1: { x: p0.x + takeoff.fx * ctrl, y: cruiseY, z: p0.z + takeoff.fz * ctrl },
            p2: { x: p3.x - landing.fx * ctrl, y: cruiseY, z: p3.z - landing.fz * ctrl },
            p3,
        };
    }
    function jetRouteStillValid(route) {
        if (!route) return false;
        const keys = new Set(validRunwaySegments(currentCells).map((seg) => seg.key));
        return keys.has(route.takeoff.seg.key) && keys.has(route.landing.seg.key);
    }
    const smooth01 = (x) => {
        const t = Math.max(0, Math.min(1, x));
        return t * t * (3 - 2 * t);
    };
    function cubicPoint(a, b, c, d, t) {
        const u = 1 - t;
        return {
            x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
            y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
            z: u * u * u * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t * t * t * d.z,
        };
    }
    function cubicTangent(a, b, c, d, t) {
        const u = 1 - t;
        return {
            x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
            y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
            z: 3 * u * u * (b.z - a.z) + 6 * u * t * (c.z - b.z) + 3 * t * t * (d.z - c.z),
        };
    }
    // Anchor/repair a vehicle's motion state onto valid track (re-route on edits).
    function reconcileVehicle(it) {
        const surf = vehicleSurface(it.code);
        const onTrack = (c, r) => carries(currentCells.get(cellKey(c, r))?.surface, surf);
        const st = vehicleState.get(it.id);
        if (it.code === "privatejet") {
            const current = st && runwayInfo(st.c, st.r, currentCells);
            if (current?.active) return;
            const home = { c: st?.c ?? it.col, r: st?.r ?? it.row };
            const anchor = nearestValidRunway(home.c, home.r, currentCells);
            if (anchor) {
                vehicleState.set(it.id, {
                    c: anchor.c,
                    r: anchor.r,
                    ein: { dc: 0, dr: 0 },
                    eout: { dc: 0, dr: 0 },
                    p: 0.5,
                    sound: Math.random() * 4,
                    hx: anchor.seg.axis === "x" ? anchor.dir : 0,
                    hz: anchor.seg.axis === "z" ? anchor.dir : 0,
                    jet: null, // tick will initialize via chooseJetRoute on first frame
                });
                return;
            }
        }
        if (st && onTrack(st.c, st.r)) return;
        let anchor = { c: it.col, r: it.row };
        if (!onTrack(anchor.c, anchor.r)) {
            // nearest track cell of the right type (small expanding scan)
            outer: for (let rad = 0; rad < 60; rad++) {
                for (let dc = -rad; dc <= rad; dc++)
                    for (let dr = -rad; dr <= rad; dr++) {
                        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                        if (onTrack(it.col + dc, it.row + dr)) {
                            anchor = { c: it.col + dc, r: it.row + dr };
                            break outer;
                        }
                    }
            }
        }
        vehicleState.set(it.id, {
            c: anchor.c,
            r: anchor.r,
            ein: { dc: 0, dr: 0 },
            eout: { dc: 0, dr: 0 }, // parked until it finds a neighbour
            p: 0.5,
            sound: Math.random() * 4,
            hx: 1,
            hz: 0,
        });
    }

    function adjacentTrack(c, r, surface, cells) {
        const m = (s) => s === surface || s === "crossing"; // crossings join both networks
        return {
            n: m(cells.get(cellKey(c, r - 1))?.surface),
            s: m(cells.get(cellKey(c, r + 1))?.surface),
            e: m(cells.get(cellKey(c + 1, r))?.surface),
            w: m(cells.get(cellKey(c - 1, r))?.surface),
        };
    }
    function adjacentTransit(c, r, cells) {
        return {
            rail: [
                [0, -1],
                [0, 1],
                [1, 0],
                [-1, 0],
            ]
                .map(([dc, dr]) => ({ dc, dr, cell: cells.get(cellKey(c + dc, r + dr)) }))
                .filter((n) => ["rail", "crossing"].includes(n.cell?.surface)),
            road: [
                [0, -1],
                [0, 1],
                [1, 0],
                [-1, 0],
            ]
                .map(([dc, dr]) => ({ dc, dr, cell: cells.get(cellKey(c + dc, r + dr)) }))
                .filter((n) => ["road", "crossing"].includes(n.cell?.surface)),
        };
    }
    function stationFacing(c, r, cells) {
        const adj = adjacentTransit(c, r, cells);
        const n = adj.rail[0] || adj.road[0];
        return n ? Math.atan2(n.dc, n.dr) : 0;
    }
    function adjacentFence(c, r, cells) {
        const m = (s) => s === "fence";
        return {
            n: m(cells.get(cellKey(c, r - 1))?.surface),
            s: m(cells.get(cellKey(c, r + 1))?.surface),
            e: m(cells.get(cellKey(c + 1, r))?.surface),
            w: m(cells.get(cellKey(c - 1, r))?.surface),
        };
    }

    function addRoadTile(x, z, adj) {
        const slab = new THREE.Mesh(slabGeo, solidMats(roadMat));
        slab.position.set(x, TOP + 0.06, z);
        ground.add(slab);
        // Yellow centre markings reach toward connected neighbours (auto-connect).
        const ns = adj.n || adj.s,
            ew = adj.e || adj.w,
            iso = !ns && !ew;
        const markY = TOP + 0.12;
        if (ns || iso) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, SP), solidMats(lineMat));
            m.position.set(x, markY, z);
            ground.add(m);
        }
        if (ew) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(SP, 0.04, 0.08), solidMats(lineMat));
            m.position.set(x, markY, z);
            ground.add(m);
        }
        const curbs = [
            ["n", 0, -0.46, SP * 0.86, 0.04],
            ["s", 0, 0.46, SP * 0.86, 0.04],
            ["w", -0.46, 0, 0.04, SP * 0.86],
            ["e", 0.46, 0, 0.04, SP * 0.86],
        ];
        for (const [dir, ox, oz, w, d] of curbs) {
            if (adj[dir]) continue;
            const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d), solidMats(stoneMat));
            curb.position.set(x + ox, TOP + 0.13, z + oz);
            ground.add(curb);
        }
    }

    function addRailTile(x, z, adj, skipTies = false) {
        const ns = adj.n || adj.s,
            ew = adj.e || adj.w,
            iso = !ns && !ew;
        if (!skipTies) {
            const tieY = TOP + 0.075;
            const addTie = (w, d, ox, oz) => {
                const tie = new THREE.Mesh(new THREE.BoxGeometry(w, 0.065, d), solidMats(tieMat));
                tie.position.set(x + ox, tieY, z + oz);
                ground.add(tie);
            };
            if (ns || iso) for (const oz of [-0.36, -0.18, 0, 0.18, 0.36]) addTie(0.72, 0.075, 0, oz);
            if (ew) for (const ox of [-0.36, -0.18, 0, 0.18, 0.36]) addTie(0.075, 0.72, ox, 0);
        }
        const railY = TOP + 0.13;
        const addPair = (along) => {
            for (const off of [-0.22, 0.22]) {
                const geo =
                    along === "z"
                        ? new THREE.BoxGeometry(0.06, 0.06, SP)
                        : new THREE.BoxGeometry(SP, 0.06, 0.06);
                const m = new THREE.Mesh(geo, solidMats(railMat));
                m.position.set(along === "z" ? x + off : x, railY, along === "z" ? z : z + off);
                ground.add(m);
            }
        };
        if (ns || iso) addPair("z");
        if (ew) addPair("x");
    }

    function addRunwayTile(x, z, adj, info) {
        const slab = new THREE.Mesh(slabGeo, solidMats(runwayMat));
        slab.position.set(x, TOP + 0.065, z);
        ground.add(slab);
        const ns = adj.n || adj.s,
            ew = adj.e || adj.w,
            iso = !ns && !ew;
        const axis = info.active ? info.axis : ns && !ew ? "z" : "x";
        const markY = TOP + 0.13;
        const addMark = (w, d, ox, oz) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d), solidMats(PAL.runwayLine));
            m.position.set(x + ox, markY, z + oz);
            ground.add(m);
        };
        if (info.active) {
            if (axis === "x") {
                addMark(0.3, 0.06, 0, 0);
                if (info.index <= 1 || info.index >= info.len - 2)
                    for (const oz of [-0.16, 0, 0.16]) addMark(0.08, 0.18, 0, oz);
            } else {
                addMark(0.06, 0.3, 0, 0);
                if (info.index <= 1 || info.index >= info.len - 2)
                    for (const ox of [-0.16, 0, 0.16]) addMark(0.18, 0.08, ox, 0);
            }
        } else {
            if (ns || iso) addMark(0.05, 0.7, 0, 0);
            if (ew) addMark(0.7, 0.05, 0, 0);
        }
        const addLight = (ox, oz, phase) => {
            const lamp = vellipsoid(ground, 0.045, 0.026, 0.045, x + ox, TOP + 0.16, z + oz, PAL.lampOff);
            runwayLights.push({ lamp, phase });
        };
        if (info.active) {
            if (axis === "x") {
                addLight(0, -0.42, info.index * 0.35);
                addLight(0, 0.42, info.index * 0.35 + 0.8);
            } else {
                addLight(-0.42, 0, info.index * 0.35);
                addLight(0.42, 0, info.index * 0.35 + 0.8);
            }
        }
    }

    function addFenceTile(x, z, adj) {
        const dirs = [
            ["n", 0, -0.26, 0.1, 0.1, 0.54],
            ["s", 0, 0.26, 0.1, 0.1, 0.54],
            ["e", 0.26, 0, 0.54, 0.1, 0.1],
            ["w", -0.26, 0, 0.54, 0.1, 0.1],
        ];
        const iso = !adj.n && !adj.s && !adj.e && !adj.w;
        const add = (w, h, d, ox, oy, oz, mat) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.set(x + ox, TOP + oy, z + oz);
            ground.add(mesh);
        };
        vcyl(ground, 0.07, 0.62, x, TOP + 0.34, z, PAL.fencePost, "y", 12);
        vcyl(ground, 0.09, 0.07, x, TOP + 0.67, z, PAL.fenceCap, "y", 12);
        for (const [dir, ox, oz, w, h, d] of dirs) {
            if (!iso && !adj[dir]) continue;
            add(w, h, d, ox, 0.34, oz, PAL.fenceRail);
            add(w, h, d, ox, 0.54, oz, PAL.fenceRail);
            vcyl(ground, 0.055, 0.5, x + ox * 1.8, TOP + 0.3, z + oz * 1.8, PAL.fencePost, "y", 10);
        }
    }

    function buildLayout() {
        resetAnimalWalkers();
        // dispose old dynamic meshes
        disposeGroup(ground);
        disposeGroup(props);
        ground = new THREE.Group();
        props = new THREE.Group();
        scene.add(ground);
        scene.add(props);
        blockCells.length = 0;
        plantSprites = [];
        vehicleSprites = [];
        plantTops = [];
        runwayLights = [];
        cottageSpot = null;

        computeBounds();
        const cells = computeCells();
        currentCells = cells;

        // Blocks for the whole padded rectangle.
        for (let r = B.minR - PAD; r <= B.maxR + PAD; r++) {
            for (let c = B.minC - PAD; c <= B.maxC + PAD; c++) {
                const cell = cells.get(cellKey(c, r));
                const x = worldX(c),
                    z = worldZ(r);
                let mats;
                if (cell?.surface === "water") mats = solidMats(waterMat);
                else if (cell?.surface === "stone") mats = blockMats(stoneMat);
                else mats = blockMats((r + c) & 1 ? grassMat : grassMatAlt); // flat checker
                const b = new THREE.Mesh(blockGeo, mats);
                b.position.set(x, 0, z);
                b.userData = { col: c, row: r };
                ground.add(b);
                blockCells.push({ mesh: b, col: c, row: r });

                if (cell?.surface === "road") addRoadTile(x, z, adjacentTrack(c, r, "road", cells));
                if (cell?.surface === "rail") addRailTile(x, z, adjacentTrack(c, r, "rail", cells));
                if (cell?.surface === "runway")
                    addRunwayTile(x, z, adjacentTrack(c, r, "runway", cells), runwayInfo(c, r, cells));
                if (cell?.surface === "fence") addFenceTile(x, z, adjacentFence(c, r, cells));
                if (cell?.surface === "crossing") {
                    // level crossing — both networks
                    addRoadTile(x, z, adjacentTrack(c, r, "road", cells));
                    addRailTile(x, z, adjacentTrack(c, r, "rail", cells), true);
                }
            }
        }

        // Plants — voxel growth-stage models (group tagged with wordId for taps).
        let i = 0;
        for (const [wid, p] of plantsModel) {
            if (p.col == null) continue;
            const x = worldX(p.col),
                z = worldZ(p.row);
            const lvl = Math.min(p.level, 5);
            const g = buildPlant(lvl);
            g.position.set(x, TOP, z);
            g.userData = { wordId: wid };
            if (p.due) g.rotation.z = 0.28; // droop
            props.add(g);
            const topY = TOP + 0.55 + lvl * 0.12;
            const entry = { group: g, baseY: TOP, phase: i * 0.7, wordId: wid, due: p.due };
            plantSprites.push(entry);
            plantTops.push({ x, z, top: topY, wordId: wid });
            if (p.due) {
                const drop = makeSprite("💧", 0.45);
                drop.position.set(x, topY + 0.25, z);
                props.add(drop);
                const dropEntry = { sprite: drop, baseY: drop.position.y, phase: i, drop: true };
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
            const g =
                it.code === "train"
                    ? buildTrain()
                    : it.code === "bus"
                      ? buildBus()
                      : it.code === "privatejet"
                        ? buildPrivateJet()
                        : buildCar();
            const st = vehicleState.get(it.id);
            g.position.set(worldX(st?.c ?? it.col), vehicleRideY(it.code), worldZ(st?.r ?? it.row));
            g.userData = { itemId: it.id };
            props.add(g);
            vehicleSprites.push({ group: g, id: it.id, code: it.code, phase: Math.random() * 6 });
        }
        for (const id of [...vehicleState.keys()]) if (!liveIds.has(id)) vehicleState.delete(id);

        // Structures + stations as voxel models. Tappable to move/remove.
        for (const it of placedItems) {
            if (it.col == null || !(isStructure(it.code) || isStation(it.code) || isTower(it.code))) continue;
            const x = worldX(it.col),
                z = worldZ(it.row);
            const g = isStation(it.code) ? buildStation() : buildStructure(it.code);
            g.position.set(x, TOP, z);
            if (isStation(it.code)) g.rotation.y = stationFacing(it.col, it.row, currentCells);
            g.userData = { itemId: it.id };
            props.add(g);
            if (it.code === "cottage") cottageSpot = new THREE.Vector3(x, TOP + 0.6, z);
        }

        // Persisted ground animals. They are walkers, but their saved home cell
        // is selectable/movable and defines the fenced region they may roam.
        for (const it of placedItems) {
            if (it.col == null || !isAnimal(it.code)) continue;
            addWalker(it.code, it);
        }

        // Traffic control. At each road cell count road-network arms (road + crossing):
        // 4-way → traffic light; 3-way (T) → stop sign. Crossings get a train-triggered
        // signal; a station marks neighbouring rail cells as train dwell stops.
        trafficLights = [];
        lightCells = new Set();
        stopCells = new Set();
        crossingSignals = [];
        stationRailCells = new Set();
        stationRoadCells = new Set();
        for (const [key, cell] of currentCells) {
            const [c, r] = key.split(":").map(Number);
            if (cell.surface === "road") {
                const arms = trackNeighbours(c, r, "road");
                if (arms.length >= 4) {
                    lightCells.add(key);
                    const lt = buildTrafficLight(arms.map((a) => ({ dc: a.c - c, dr: a.r - r })));
                    lt.group.position.set(worldX(c), TOP, worldZ(r));
                    ground.add(lt.group);
                    trafficLights.push(lt);
                } else if (arms.length === 3) {
                    stopCells.add(key);
                    addStopSigns(c, r, arms);
                }
            } else if (cell.surface === "crossing") {
                const cs = buildCrossingSignal(trackNeighbours(c, r, "road").map((a) => ({ c: a.c - c, r: a.r - r })));
                cs.group.position.set(worldX(c), TOP, worldZ(r));
                ground.add(cs.group);
                crossingSignals.push({ ...cs, key, c, r });
            } else if (cell.code === "station") {
                for (const [dc, dr] of [
                    [0, -1],
                    [0, 1],
                    [1, 0],
                    [-1, 0],
                ]) {
                    const nk = cellKey(c + dc, r + dr);
                    const s = currentCells.get(nk)?.surface;
                    if (s === "rail" || s === "crossing") stationRailCells.add(nk);
                    if (s === "road" || s === "crossing") stationRoadCells.add(nk);
                }
            }
        }
        lastSig = ""; // force a lamp refresh next tick
        updateNightGlow();
        if (arrange) parkMoversForArrange();
        if (!userChangedView) {
            dist = defaultViewDistance();
            applyCamera();
        }
    }

    // ── Re-grow / water a plant in place (no rebuild → keeps the pop animation) ─
    function growPlant(wordId, level) {
        const p = plantsModel.get(wordId);
        if (p) {
            p.level = level;
            p.due = false;
        }
        const e = plantSprites.find((o) => o.wordId === wordId);
        if (!e) return;
        const lvl = Math.min(level, 5);
        // Swap in a fresh voxel growth-stage model at the same cell, with a pop.
        const old = e.group;
        const g = buildPlant(lvl);
        g.position.copy(old.position);
        g.userData = { wordId };
        props.add(g);
        disposeOne(old);
        e.group = g;
        e.due = false;
        e.pop = 1;
        if (e.dropEntry) {
            props.remove(e.dropEntry.sprite);
            const idx = plantSprites.indexOf(e.dropEntry);
            if (idx >= 0) plantSprites.splice(idx, 1);
            e.dropEntry = null;
        }
        const top = plantTops.find((t) => t.wordId === wordId);
        if (top) top.top = TOP + 0.55 + lvl * 0.12;
    }
    function waterPlant(wordId) {
        const p = plantSprites.find((o) => o.wordId === wordId);
        if (p) p.pop = 1;
    }
    // Dispose one group's per-instance geometries (shared mats/geos are kept).
    function disposeOne(group) {
        group.traverse((o) => {
            if (o.geometry && o.geometry !== blockGeo && o.geometry !== slabGeo) o.geometry.dispose();
            if (o.material?.isSpriteMaterial) o.material.dispose();
        });
        group.removeFromParent?.();
    }

    // ── Validation ──────────────────────────────────────────────────────────────
    const isHardSurface = (s) => HARD.includes(s);
    const railNeighbour = (cell) => ["rail", "crossing"].includes(cell?.surface);
    const roadNeighbour = (cell) => ["road", "crossing"].includes(cell?.surface);
    const occupantBlocks = (cell, kind) => {
        if (!cell?.occupant) return false;
        return !(cell.occupant === "animal" && kind !== "animal");
    };
    function validPlacement(kind, c, r, skipRef) {
        const cells = computeCells(skipRef);
        const cell = cells.get(cellKey(c, r));
        if (kind === "plant" || kind === "track" || kind === "animal") {
            if (cell && (occupantBlocks(cell, kind) || isHardSurface(cell.surface))) {
                return {
                    ok: false,
                    reason:
                        cell.occupant === "plant"
                            ? "Move the plant on that block first."
                            : cell.occupant === "animal"
                              ? "Move the animal on that block first."
                              : "That block is taken.",
                };
            }
            return { ok: true };
        }
        if (kind === "station") {
            if (cell && (occupantBlocks(cell, kind) || isHardSurface(cell.surface)))
                return { ok: false, reason: "That block is taken." };
            const nextToTransit = [
                [0, -1],
                [0, 1],
                [1, 0],
                [-1, 0],
            ].some(([dc, dr]) => {
                const next = cells.get(cellKey(c + dc, r + dr));
                return railNeighbour(next) || roadNeighbour(next);
            });
            if (!nextToTransit)
                return { ok: false, reason: "A station goes beside a road or rail. Lay one next to it first." };
            return { ok: true };
        }
        if (kind === "tower") {
            if (cell && (occupantBlocks(cell, kind) || isHardSurface(cell.surface)))
                return { ok: false, reason: "The control tower needs an empty grass block." };
            return { ok: true };
        }
        if (kind === "car") {
            if (!carries(cell?.surface, "road"))
                return { ok: false, reason: "A car needs a road. Place a road there first." };
            if (occupantBlocks(cell, kind)) return { ok: false, reason: "That road already has something on it." };
            return { ok: true };
        }
        if (kind === "train") {
            if (!carries(cell?.surface, "rail"))
                return { ok: false, reason: "A train needs a rail. Place a rail there first." };
            if (occupantBlocks(cell, kind)) return { ok: false, reason: "That rail already has something on it." };
            return { ok: true };
        }
        if (kind === "jet") {
            if (!carries(cell?.surface, "runway")) return { ok: false, reason: "A private jet needs runway blocks." };
            if (!runwayInfo(c, r, cells).active)
                return { ok: false, reason: "Build a straight runway of at least 10 connected blocks first." };
            if (occupantBlocks(cell, kind)) return { ok: false, reason: "That runway already has something on it." };
            return { ok: true };
        }
        return { ok: false, reason: "Cannot place that here." };
    }
    function kindOf(code) {
        const info = SHOP[code];
        if (info?.animal) return "animal";
        if (info?.station) return "station";
        if (info?.tower) return "tower";
        if (info?.surface) return "track";
        if (code === "bus") return "car";
        if (info?.vehicle === "road") return "car";
        if (info?.vehicle === "rail") return "train";
        if (info?.vehicle === "runway") return "jet";
        return "track";
    }

    // ── Decorations & creatures (sky critters + the free-roaming gnome) ─────────
    const creatures = []; // wandering sky critters (voxel models)
    const walkers = []; // ground wanderers — gnome free-roams; animals obey fences
    let groupTarget = null;

    function addDecoration(code) {
        const info = SHOP[code];
        if (!info || info.layer === "theme" || info.type === "hint") return;
        if (info.placeable || STRUCTURE_CODES.includes(code) || info.station || info.animal) return; // placed/structure/animals handled in layout
        if (code === "gnome" || info.walk) return addWalker(code);
        if (info.layer === "sky") {
            const kind = code === "bees" ? "bee" : code === "bird" ? "bird" : "butterfly";
            const obj = buildCritter(kind);
            const c = {
                obj,
                kind,
                pos: new THREE.Vector3(
                    (Math.random() - 0.5) * plotR,
                    3 + Math.random() * 2,
                    (Math.random() - 0.5) * plotR,
                ),
                target: new THREE.Vector3(),
                state: "fly",
                timer: 0,
                speed: 0.9 + Math.random() * 0.5,
                flap: Math.random() * 6,
                soundCd: 2 + Math.random() * 5,
            };
            obj.position.copy(c.pos);
            scene.add(obj);
            creatures.push(c);
            pickBehavior(c);
        }
    }

    function randomFieldPoint() {
        return new THREE.Vector3(
            (Math.random() - 0.5) * Math.max(1, cols - 1) * SP,
            TOP,
            (Math.random() - 0.5) * Math.max(1, rows - 1) * SP,
        );
    }
    const colFromWorld = (x) => Math.round(x / SP + centerC);
    const rowFromWorld = (z) => Math.round(z / SP + centerR);
    function randomPointInCell(c, r) {
        return new THREE.Vector3(
            worldX(c) + (Math.random() - 0.5) * 0.56,
            TOP,
            worldZ(r) + (Math.random() - 0.5) * 0.56,
        );
    }

    function reachableAnimalCells(home) {
        if (!home) return null;
        const minC = B.minC - PAD,
            maxC = B.maxC + PAD,
            minR = B.minR - PAD,
            maxR = B.maxR + PAD;
        const start = cellKey(home.c, home.r);
        if (currentCells.get(start)?.surface === "fence") return new Set();
        const seen = new Set([start]);
        const q = [{ c: home.c, r: home.r }];
        for (let i = 0; i < q.length; i++) {
            const cur = q[i];
            for (const [dc, dr] of [
                [0, -1],
                [0, 1],
                [1, 0],
                [-1, 0],
            ]) {
                const c = cur.c + dc,
                    r = cur.r + dr;
                if (c < minC || c > maxC || r < minR || r > maxR) continue;
                const k = cellKey(c, r);
                if (seen.has(k) || currentCells.get(k)?.surface === "fence") continue;
                seen.add(k);
                q.push({ c, r });
            }
        }
        return seen;
    }

    function randomAnimalPoint(w) {
        if (!w.home) return randomFieldPoint();
        w.region = reachableAnimalCells(w.home);
        const keys = [...w.region];
        if (!keys.length) return randomPointInCell(w.home.c, w.home.r);
        const [c, r] = keys[Math.floor(Math.random() * keys.length)].split(":").map(Number);
        return randomPointInCell(c, r);
    }

    function resetAnimalWalkers() {
        for (let i = walkers.length - 1; i >= 0; i--) {
            const w = walkers[i];
            if (!w.isAnimal) continue;
            if (w.sleepBubble) scene.remove(w.sleepBubble);
            disposeOne(w.obj);
            walkers.splice(i, 1);
        }
    }

    // Ground walkers: the gnome (sleeps at night by the cottage) + roaming animals.
    function addWalker(code, item = null) {
        const isGnome = code === "gnome";
        const home = item ? { c: item.col, r: item.row } : null;
        const obj = isGnome ? buildGnome() : buildAnimal(code);
        if (item) obj.userData = { ...obj.userData, itemId: item.id };
        const pos = home
            ? arrange
                ? new THREE.Vector3(worldX(home.c), TOP, worldZ(home.r))
                : randomPointInCell(home.c, home.r)
            : randomFieldPoint();
        const w = {
            obj,
            kind: code,
            isGnome,
            isAnimal: !!item,
            id: item?.id || null,
            home,
            region: null,
            pos,
            target: pos.clone(),
            timer: 0,
            phase: Math.random() * 6,
            speed: isGnome ? 0.5 : 0.16 + Math.random() * 0.14,
            soundCd: 4 + Math.random() * 6,
            sleepBubble: null,
            hx: 1,
            hz: 0,
        };
        obj.position.copy(pos);
        scene.add(obj);
        walkers.push(w);
        pickWalkerTarget(w);
        if (isGnome) updateWalkerSleep();
    }
    function vehicleHomeHeading(it) {
        if (it.code === "privatejet") {
            const runway = runwayInfo(it.col, it.row, currentCells);
            if (runway?.axis === "z") return { hx: 0, hz: 1 };
            return { hx: 1, hz: 0 };
        }
        const nb = trackNeighbours(it.col, it.row, vehicleSurface(it.code));
        if (nb.length) return { hx: nb[0].c - it.col, hz: nb[0].r - it.row };
        return { hx: 1, hz: 0 };
    }
    function parkVehicleAtHome(v) {
        const it = placedItems.find((p) => p.id === v.id);
        if (!it || it.col == null || it.row == null) return;
        const h = vehicleHomeHeading(it);
        let st = vehicleState.get(v.id);
        if (!st) {
            st = {};
            vehicleState.set(v.id, st);
        }
        Object.assign(st, {
            c: it.col,
            r: it.row,
            ein: { dc: 0, dr: 0 },
            eout: { dc: 0, dr: 0 },
            p: 0.5,
            hx: h.hx,
            hz: h.hz,
            dwell: 0,
            sound: st.sound ?? Math.random() * 4,
            stopAt: null,
            signDwell: null,
            jet: null,
        });
        v.group.position.set(worldX(it.col), vehicleRideY(v.code), worldZ(it.row));
        v.group.rotation.set(0, Math.atan2(-h.hz, h.hx), 0);
    }
    function parkMoversForArrange() {
        for (const v of vehicleSprites) parkVehicleAtHome(v);
        for (const w of walkers) {
            if (!w.isAnimal || !w.home) continue;
            w.pos.set(worldX(w.home.c), TOP, worldZ(w.home.r));
            w.target.copy(w.pos);
            w.hx = 1;
            w.hz = 0;
            w.timer = 0;
            w.obj.position.copy(w.pos);
            w.obj.rotation.y = Math.atan2(-w.hz, w.hx);
        }
    }
    function pickWalkerTarget(w) {
        if (w.isGnome && isNight) return;
        if (w.isGnome && cottageSpot && Math.random() < 0.28) w.target.copy(cottageSpot);
        else if (w.isAnimal) w.target.copy(randomAnimalPoint(w));
        else w.target.copy(randomFieldPoint());
        w.timer = w.isAnimal ? 5 + Math.random() * 7 : 4 + Math.random() * 5;
    }
    function updateWalkerSleep() {
        for (const w of walkers) {
            if (!w.isGnome) continue;
            if (isNight) {
                w.target.copy(cottageSpot || w.pos);
                if (!w.sleepBubble) {
                    w.sleepBubble = makeSprite("💤", 0.5, true);
                    scene.add(w.sleepBubble);
                }
            } else if (w.sleepBubble) {
                scene.remove(w.sleepBubble);
                w.sleepBubble = null;
                pickWalkerTarget(w);
            }
        }
    }
    function pickBehavior(c) {
        const roll = Math.random();
        if (roll < 0.4 && plantTops.length) {
            const t = plantTops[Math.floor(Math.random() * plantTops.length)];
            c.target.set(t.x, t.top, t.z);
            c.state = "land";
            c.timer = 2.5 + Math.random() * 3;
        } else if (roll < 0.6 && creatures.length > 1) {
            if (!groupTarget || Math.random() < 0.3)
                groupTarget = new THREE.Vector3(
                    (Math.random() - 0.5) * plotR,
                    2.5 + Math.random() * 2,
                    (Math.random() - 0.5) * plotR,
                );
            c.target
                .copy(groupTarget)
                .add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 1.5,
                        (Math.random() - 0.5) * 1,
                        (Math.random() - 0.5) * 1.5,
                    ),
                );
            c.state = "group";
            c.timer = 3 + Math.random() * 3;
        } else {
            c.target.set(
                (Math.random() - 0.5) * plotR * 1.6,
                2.5 + Math.random() * 3,
                (Math.random() - 0.5) * plotR * 1.6,
            );
            c.state = "fly";
            c.timer = 3 + Math.random() * 4;
        }
    }

    // ── Speech bubbles (DOM projected to screen) ────────────────────────────────
    const layer = document.createElement("div");
    layer.className = "garden-bubbles";
    canvas.parentElement.appendChild(layer);
    const bubbles = [];
    function speak(c) {
        const el = document.createElement("div");
        el.className = "garden-bubble";
        el.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        layer.appendChild(el);
        bubbles.push({ el, src: c.obj, until: clock.getElapsedTime() + 2.4 });
        creatureSound(c.kind);
    }
    function projectBubbles(now) {
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            if (now > b.until) {
                b.el.remove();
                bubbles.splice(i, 1);
                continue;
            }
            const v = b.src.position
                .clone()
                .add(new THREE.Vector3(0, 0.6, 0))
                .project(camera);
            const w = canvas.clientWidth,
                h = canvas.clientHeight;
            b.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
            b.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
            b.el.style.opacity = v.z < 1 ? "1" : "0";
        }
    }

    // ── Drag-to-place / arrange ─────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const highlight = new THREE.Mesh(slabGeo, okMat);
    highlight.visible = false;
    scene.add(highlight);
    let ghost = null;
    let drag = null; // { mode:'new'|'move', code, kind, id?, wordId?, cell, moved }
    let selectedId = null;

    function cellAt(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(blockCells.map((b) => b.mesh));
        return hits.length ? hits[0].object.userData : null;
    }
    function entityAt(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const targets = [
            ...props.children.filter((o) => o.userData?.wordId || o.userData?.itemId),
            ...walkers.filter((w) => w.isAnimal).map((w) => w.obj),
        ];
        const hits = ray.intersectObjects(targets, true); // recurse into voxel groups
        if (!hits.length) return null;
        let o = hits[0].object; // walk up to the tagged group
        while (o && !(o.userData?.wordId || o.userData?.itemId)) o = o.parent;
        return o?.userData || null;
    }
    // What sits on a block — used as a reliable fallback when the small sprite
    // raycast misses. Skips vehicles (they roam away from their home cell).
    function occupantAt(col, row) {
        for (const [wid, p] of plantsModel) if (p.col === col && p.row === row) return { kind: "plant", wordId: wid };
        for (const it of placedItems) {
            if (it.col === col && it.row === row && !SHOP[it.code]?.vehicle && !isAnimal(it.code))
                return { kind: "item", it };
        }
        for (const w of walkers) {
            if (!w.isAnimal) continue;
            if (colFromWorld(w.pos.x) !== col || rowFromWorld(w.pos.z) !== row) continue;
            const it = placedItems.find((p) => p.id === w.id);
            if (it) return { kind: "item", it };
        }
        return null;
    }

    function startDrag(state, icon) {
        drag = state;
        ghost = makeSprite(icon, 1.1, true);
        ghost.position.set(0, TOP + 1.2, 0);
        ghost.visible = false; // shown once the pointer moves over a cell
        scene.add(ghost);
        highlight.visible = false;
    }
    function dragTo(clientX, clientY) {
        if (!drag) return;
        const c = cellAt(clientX, clientY);
        drag.cell = c;
        if (!c) {
            highlight.visible = false;
            if (ghost) ghost.visible = false;
            return;
        }
        const x = worldX(c.col),
            z = worldZ(c.row);
        if (ghost) {
            ghost.visible = true;
            ghost.position.set(x, TOP + 1.0, z);
        }
        const skip = drag.mode === "move" ? drag.wordId || drag.id : null;
        const v = validPlacement(drag.kind, c.col, c.row, skip);
        highlight.visible = true;
        highlight.material = v.ok ? okMat : badMat;
        highlight.position.set(x, TOP + 0.08, z);
    }
    function endDrag(commit) {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (ghost) {
            scene.remove(ghost);
            ghost.material.map = null;
            ghost.material.dispose();
            ghost = null;
        }
        highlight.visible = false;
        if (!commit || !d.cell) return;
        const skip = d.mode === "move" ? d.wordId || d.id : null;
        const v = validPlacement(d.kind, d.cell.col, d.cell.row, skip);
        if (!v.ok) {
            cb.invalidDrop(v.reason);
            return;
        }
        if (d.kind === "plant" || d.wordId) {
            const p = plantsModel.get(d.wordId);
            p.col = d.cell.col;
            p.row = d.cell.row;
            cb.plantMoved(d.wordId, d.cell.col, d.cell.row);
        } else if (d.mode === "new") {
            placedItems.push({ id: d.id, code: d.code, col: d.cell.col, row: d.cell.row, rotation: 0 });
            cb.itemMoved(d.id, d.cell.col, d.cell.row, 0);
        } else {
            const it = placedItems.find((p) => p.id === d.id);
            if (it) {
                it.col = d.cell.col;
                it.row = d.cell.row;
                vehicleState.delete(it.id); // restart driving from the new spot
                cb.itemMoved(it.id, it.col, it.row, it.rotation || 0);
            }
        }
        rehomeBlockedAnimals();
        buildLayout();
    }

    // Tray → place a freshly-bought (or any unplaced) item. Page calls this on
    // pointerdown of a tray chip; we follow the pointer via window listeners.
    function beginPlaceFromTray(code, id, ev) {
        if (!arrange) return;
        startDrag({ mode: "new", code, kind: kindOf(code), id, cell: null, moved: true }, SHOP[code]?.icon || "❓");
        const move = (e) => dragTo(e.clientX, e.clientY);
        const up = (e) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            endDrag(true);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        if (ev) dragTo(ev.clientX, ev.clientY);
    }

    function setArrangeMode(on) {
        arrange = !!on;
        if (arrange) cancelSetCenterMode();
        if (arrange) parkMoversForArrange();
        if (!arrange) {
            endDrag(false);
            selectedId = null;
            cb.selectItem(null);
        }
    }
    function removeSelected() {
        const id = selectedId;
        if (!id) return;
        placedItems = placedItems.filter((p) => p.id !== id);
        selectedId = null;
        cb.selectItem(null);
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
    function addAnimal(id, code) {
        placedItems.push({ id, code, col: null, row: null, rotation: 0 });
        assignAnimalHomes();
        buildLayout();
    }

    // ── Camera controls (pointer: 1 = rotate, 2 = pinch, tap = select) ──────────
    let azim = 0.6,
        polar = 1.02,
        dist = 14;
    const target = new THREE.Vector3(0, 0.72, 0);
    let idle = 0,
        moved = false,
        pinchD = 0,
        userChangedView = false,
        setCenterMode = false;
    const pointers = new Map();

    function defaultViewDistance() {
        const w = canvas.clientWidth || canvas.parentElement.clientWidth || 1;
        const h = canvas.clientHeight || canvas.parentElement.clientHeight || 1;
        const footprint = Math.max(cols, rows);
        const aspect = w / Math.max(1, h);
        return Math.max(7, footprint * (aspect > 1.25 ? 1.45 : 1.85) + 4.5);
    }
    function cameraBounds() {
        return {
            minX: worldX(B.minC - PAD),
            maxX: worldX(B.maxC + PAD),
            minZ: worldZ(B.minR - PAD),
            maxZ: worldZ(B.maxR + PAD),
        };
    }
    function clampTarget() {
        const b = cameraBounds();
        target.x = Math.max(b.minX, Math.min(b.maxX, target.x));
        target.z = Math.max(b.minZ, Math.min(b.maxZ, target.z));
        target.y = 0.72;
    }
    function applyCamera() {
        polar = Math.max(0.45, Math.min(1.45, polar));
        dist = Math.max(7, Math.min(60, dist));
        clampTarget();
        camera.position.set(
            target.x + dist * Math.sin(polar) * Math.sin(azim),
            target.y + dist * Math.cos(polar),
            target.z + dist * Math.sin(polar) * Math.cos(azim),
        );
        camera.lookAt(target);
    }
    const pinchDist = () => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const pointerMid = () => {
        const ps = [...pointers.values()];
        return {
            x: ps.reduce((sum, p) => sum + p.x, 0) / Math.max(1, ps.length),
            y: ps.reduce((sum, p) => sum + p.y, 0) / Math.max(1, ps.length),
        };
    };
    function groundPointAt(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
        const hit = new THREE.Vector3();
        return ray.ray.intersectPlane(plane, hit) ? hit : null;
    }
    function zoomAt(clientX, clientY, factor) {
        const before = groundPointAt(clientX, clientY);
        dist *= factor;
        applyCamera();
        const after = before ? groundPointAt(clientX, clientY) : null;
        if (before && after) {
            target.x += before.x - after.x;
            target.z += before.z - after.z;
            applyCamera();
        }
    }
    function setCenterPicking(on) {
        setCenterMode = !!on;
        cb.setCenterMode(setCenterMode);
    }
    function zoomView(direction) {
        const r = canvas.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, direction === "in" ? 0.88 : 1.12);
        userChangedView = true;
        idle = 0;
    }
    function panView(dx = 0, dz = 0) {
        const step = Math.max(0.6, dist * 0.08);
        const rightX = Math.cos(azim),
            rightZ = -Math.sin(azim);
        const forwardX = -Math.sin(azim),
            forwardZ = -Math.cos(azim);
        target.x += (rightX * dx + forwardX * dz) * step;
        target.z += (rightZ * dx + forwardZ * dz) * step;
        userChangedView = true;
        idle = 0;
        applyCamera();
    }
    function recenterView() {
        target.x = 0;
        target.z = 0;
        userChangedView = true;
        idle = 0;
        applyCamera();
    }
    function fitGardenView() {
        target.x = 0;
        target.z = 0;
        dist = defaultViewDistance();
        userChangedView = false;
        idle = 0;
        applyCamera();
    }
    function beginSetCenterMode() {
        if (arrange) return;
        setCenterPicking(true);
    }
    function cancelSetCenterMode() {
        if (setCenterMode) setCenterPicking(false);
    }
    function pickViewCenter(clientX, clientY) {
        const cell = cellAt(clientX, clientY);
        if (cell) {
            target.x = worldX(cell.col);
            target.z = worldZ(cell.row);
        } else {
            const pt = groundPointAt(clientX, clientY);
            if (!pt) return false;
            target.x = pt.x;
            target.z = pt.z;
        }
        userChangedView = true;
        idle = 0;
        setCenterPicking(false);
        applyCamera();
        return true;
    }

    function onDown(e) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved = false;
        idle = 0;
        if (pointers.size === 2) pinchD = pinchDist();
        // In arrange mode, grabbing an entity starts a move (and suppresses orbit).
        // Try the sprite first (good for roaming vehicles), then fall back to the
        // block cell under the finger — a big, reliable target — so plants and
        // structures (incl. the pond, which has no sprite) are easy to grab.
        if (arrange && pointers.size === 1 && !drag) {
            const ent = entityAt(e.clientX, e.clientY);
            let grab = null;
            if (ent?.wordId) grab = { kind: "plant", wordId: ent.wordId };
            else if (ent?.itemId) {
                const it = placedItems.find((p) => p.id === ent.itemId);
                if (it) grab = { kind: "item", it };
            }
            if (!grab) {
                const cell = cellAt(e.clientX, e.clientY);
                if (cell) grab = occupantAt(cell.col, cell.row);
            }
            if (grab?.kind === "plant") {
                startDrag(
                    { mode: "move", kind: "plant", wordId: grab.wordId, cell: null, moved: false },
                    masteryEmoji(plantsModel.get(grab.wordId)?.level || 0),
                );
            } else if (grab?.kind === "item") {
                startDrag(
                    { mode: "move", kind: kindOf(grab.it.code), id: grab.it.id, cell: null, moved: false },
                    SHOP[grab.it.code]?.icon || "❓",
                );
            }
        }
        canvas.setPointerCapture?.(e.pointerId);
    }
    function onMove(e) {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x,
            dy = e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        idle = 0;
        if (drag) {
            drag.moved = true;
            dragTo(e.clientX, e.clientY);
            return;
        }
        if (pointers.size >= 2) {
            const d = pinchDist();
            if (pinchD) {
                const mid = pointerMid();
                zoomAt(mid.x, mid.y, pinchD / d);
                userChangedView = true;
            }
            pinchD = d;
            moved = true;
            return;
        }
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        azim -= dx * 0.008;
        polar -= dy * 0.006;
        userChangedView = true;
        applyCamera();
    }
    function onUp(e) {
        const wasSingle = pointers.size === 1;
        pointers.delete(e.pointerId);
        pinchD = 0;
        if (drag) {
            if (drag.moved) endDrag(true);
            else {
                // a tap (no move) on an item selects it; on a plant in arrange does nothing
                const d = drag;
                endDrag(false);
                if (d.id) {
                    selectedId = d.id;
                    cb.selectItem(d.id);
                }
            }
            return;
        }
        if (wasSingle && !moved) {
            if (setCenterMode) {
                pickViewCenter(e.clientX, e.clientY);
                return;
            }
            if (arrange) {
                selectedId = null;
                cb.selectItem(null);
            } else {
                const ent = entityAt(e.clientX, e.clientY);
                if (ent?.wordId) onClick(ent.wordId);
            }
        }
    }
    function onWheel(e) {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, 1 + Math.sign(e.deltaY) * 0.1);
        userChangedView = true;
        idle = 0;
    }

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ── Resize ───────────────────────────────────────────────────────────────
    function resize() {
        const w = canvas.clientWidth || canvas.parentElement.clientWidth;
        const h = canvas.clientHeight || canvas.parentElement.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        if (!userChangedView) {
            dist = defaultViewDistance();
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
        const t = clock.getElapsedTime();

        // Plants — voxel groups sway/tilt; the floating 💧 (sprite) bobs.
        for (const p of plantSprites) {
            if (p.drop) {
                p.sprite.position.y = p.baseY + Math.sin(t * 3 + p.phase) * 0.05;
                p.sprite.material.rotation = Math.sin(t * 1.1 + p.phase) * 0.04;
                continue;
            }
            const g = p.group;
            g.position.y = p.baseY + Math.sin(t * 1.4 + p.phase) * 0.04;
            g.rotation.z = (p.due ? 0.28 : 0) + Math.sin(t * 1.1 + p.phase) * 0.03;
            if (p.pop > 0) {
                p.pop = Math.max(0, p.pop - 0.04);
                const k = 1 + p.pop * 0.4;
                g.scale.set(k, k, k);
            } else if (g.scale.x !== 1) g.scale.set(1, 1, 1);
        }

        // Sky critters — fly, face travel, flap wings (userData.wing meshes).
        for (const c of creatures) {
            c.timer -= dt;
            c.soundCd -= dt;
            if (c.soundCd <= 0) {
                c.soundCd = 5 + Math.random() * 7;
                if (c.kind !== "butterfly" && Math.random() < 0.6) creatureSound(c.kind);
            }
            const step = c.speed * dt;
            c.pos.x += (c.target.x - c.pos.x) * Math.min(1, step);
            c.pos.y += (c.target.y - c.pos.y) * Math.min(1, step);
            c.pos.z += (c.target.z - c.pos.z) * Math.min(1, step);
            const landed = c.state === "land" && c.pos.distanceTo(c.target) < 0.3;
            c.obj.position.set(c.pos.x, c.pos.y + (landed ? 0 : Math.sin(t * 4 + c.flap) * 0.12), c.pos.z);
            const dx = c.target.x - c.pos.x,
                dz = c.target.z - c.pos.z;
            if (Math.abs(dx) + Math.abs(dz) > 0.02) c.obj.rotation.y = Math.atan2(-dz, dx);
            const flap =
                c.kind === "bee"
                    ? landed
                        ? 0.08
                        : Math.sin(t * 44 + c.flap) * 0.42
                    : c.kind === "butterfly"
                      ? landed
                          ? 0.12
                          : Math.sin(t * 9 + c.flap) * 0.72
                      : landed
                        ? 0.1
                        : Math.sin(t * 16 + c.flap) * 0.5;
            c.obj.traverse((o) => {
                if (o.userData?.wing) {
                    const base = o.userData.wingBase || 0;
                    const scale = o.userData.flapScale || 1;
                    o.rotation.x = base + flap * o.userData.wing * scale;
                }
            });
            if (landed && Math.random() < 0.004) speak(c);
            if (c.timer <= 0) pickBehavior(c);
        }

        // Ground walkers — gnome + animals roam the land, facing travel direction.
        for (const w of walkers) {
            if (arrange && w.isAnimal && w.home) {
                w.pos.set(worldX(w.home.c), TOP, worldZ(w.home.r));
                w.target.copy(w.pos);
                w.obj.position.copy(w.pos);
                w.obj.rotation.y = Math.atan2(-w.hz, w.hx);
                continue;
            }
            const night = w.isGnome && isNight;
            const step = (night ? 0.3 : w.speed) * dt;
            const k = Math.min(1, step);
            const nx = w.pos.x + (w.target.x - w.pos.x) * k;
            const nz = w.pos.z + (w.target.z - w.pos.z) * k;
            if (w.isAnimal) {
                if (!w.region) w.region = reachableAnimalCells(w.home);
                const nk = cellKey(colFromWorld(nx), rowFromWorld(nz));
                if (currentCells.get(nk)?.surface === "fence" || !w.region?.has(nk)) {
                    w.target.copy(randomAnimalPoint(w));
                    w.timer = 2 + Math.random() * 3;
                } else {
                    w.pos.x = nx;
                    w.pos.z = nz;
                }
            } else {
                w.pos.x = nx;
                w.pos.z = nz;
            }
            w.pos.y = TOP;
            const dx = w.target.x - w.pos.x,
                dz = w.target.z - w.pos.z;
            const arrived = Math.hypot(dx, dz) < 0.12;
            if (!arrived) {
                w.hx = dx;
                w.hz = dz;
            }
            const bob = night || arrived ? 0 : Math.abs(Math.sin(t * 6 + w.phase)) * 0.05;
            const swing = night || arrived ? 0 : Math.sin(t * 6 + w.phase) * 0.32;
            for (const leg of w.obj.userData.walkLegs || []) leg.rotation.x = swing * (leg.userData.walkLeg || 1);
            w.obj.position.set(w.pos.x, w.pos.y + bob, w.pos.z);
            w.obj.rotation.y = Math.atan2(-w.hz, w.hx);
            if (w.sleepBubble) w.sleepBubble.position.set(w.pos.x + 0.25, w.pos.y + 0.9, w.pos.z);
            w.timer -= dt;
            if (!night && (w.timer <= 0 || arrived)) pickWalkerTarget(w);
        }

        // Signals: compute the per-axis state, refresh the 3-lamp heads on change.
        const sig = axisStates(t);
        const sigKey = sig.ns + sig.ew;
        if (sigKey !== lastSig) {
            lastSig = sigKey;
            for (const lt of trafficLights) setTrafficLight(lt, sig);
        }
        // Snapshot the cell each vehicle holds + direction (queueing), and which
        // crossings have a train on/entering them (cars hold for the train).
        const occ = new Map();
        const trainAtCrossing = new Set();
        for (const v of vehicleSprites) {
            const s = vehicleState.get(v.id);
            if (!s) continue;
            occ.set(cellKey(s.c, s.r), dirKey(s.eout));
            if (v.code === "train") {
                if (currentCells.get(cellKey(s.c, s.r))?.surface === "crossing") trainAtCrossing.add(cellKey(s.c, s.r));
                const nk = cellKey(s.c + s.eout.dc, s.r + s.eout.dr);
                if (currentCells.get(nk)?.surface === "crossing") trainAtCrossing.add(nk);
            }
        }
        // Crossing signals: flash the lamps + lower both boom gates when a train is near.
        for (const cs of crossingSignals) {
            const active = trainAtCrossing.has(cs.key);
            const flash = Math.sin(t * 8) > 0;
            cs.lamps.forEach((l, k) => {
                l.material = active && (k % 2 === 0 ? flash : !flash) ? PAL.lampRed : PAL.lampOff;
            });
            for (const gate of cs.gates) {
                const targetA = active ? (gate.userData.closedX ?? 0) : (gate.userData.openX ?? Math.PI / 2);
                gate.rotation.x += (targetA - gate.rotation.x) * Math.min(1, dt * 4);
            }
        }
        for (const l of runwayLights) {
            l.lamp.material = isNight && Math.sin(t * 5 + l.phase) > 0 ? PAL.runwayLight : PAL.lampOff;
        }

        // Vehicles drive the connected network: turn to face travel, arc through
        // corners, slow for curves, keep right (cars), stop at red lights and queue
        // behind a same-direction vehicle. Vehicles freeze while arranging. Each cell is
        // traversed edge→edge (straight=line, corner=arc, dead end=in-and-out); at a
        // junction the exit is random, never an immediate reverse unless it's a dead end.
        for (const v of vehicleSprites) {
            const st = vehicleState.get(v.id);
            if (!st) continue;
            const surf = vehicleSurface(v.code);
            if (arrange) {
                parkVehicleAtHome(v);
                continue;
            }
            if (v.code === "privatejet") {
                const home = placedItems.find((p) => p.id === v.id);
                const anchor = nearestValidRunway(home?.col ?? st.c, home?.row ?? st.r, currentCells);
                if (!anchor) {
                    const park = runwayInfo(st.c, st.r, currentCells);
                    const parkAxis = park.axis === "z" ? { hx: 0, hz: 1 } : { hx: 1, hz: 0 };
                    v.group.position.set(worldX(home?.col ?? st.c), vehicleRideY(v.code), worldZ(home?.row ?? st.r));
                    v.group.rotation.set(0, Math.atan2(-parkAxis.hz, parkAxis.hx), 0);
                    continue;
                }
                if (!jetRouteStillValid(st.jet?.route)) {
                    const route = chooseJetRoute(home?.col ?? st.c, home?.row ?? st.r);
                    if (!route) continue;
                    st.jet = { route, phase: "takeoff", u: 0, pause: 0.6 };
                }
                const jet = st.jet;
                if (jet.pause > 0) {
                    jet.pause -= dt;
                } else {
                    jet.u += dt * (jet.phase === "fly" ? 0.075 : jet.phase === "land" ? 0.16 : 0.20);
                    if (jet.u >= 1) {
                        if (jet.phase === "takeoff") {
                            jet.phase = "fly";
                            jet.u = 0;
                        } else if (jet.phase === "fly") {
                            jet.phase = "land";
                            jet.u = 0;
                        } else {
                            st.c = jet.route.landing.ec;
                            st.r = jet.route.landing.er;
                            const route = chooseJetRoute(st.c, st.r);
                            st.jet = route ? { route, phase: "takeoff", u: 0, pause: 1.1 } : null;
                            continue;
                        }
                    }
                }

                const route = jet.route;
                const takeoff = route.takeoff;
                const landing = route.landing;
                const u = Math.max(0, Math.min(1, jet.u));
                let wx, wy, wz, hx, hz, bank = 0;
                const groundY = vehicleRideY(v.code);
                if (jet.phase === "takeoff") {
                    const lift = smooth01((u - 0.55) / 0.45);
                    wx = takeoff.sx + (takeoff.ex - takeoff.sx) * u;
                    wz = takeoff.sz + (takeoff.ez - takeoff.sz) * u;
                    wy = groundY + lift * (route.p0.y - groundY);
                    hx = takeoff.fx;
                    hz = takeoff.fz;
                } else if (jet.phase === "fly") {
                    const p = cubicPoint(route.p0, route.p1, route.p2, route.p3, smooth01(u));
                    const h = cubicTangent(route.p0, route.p1, route.p2, route.p3, smooth01(u));
                    wx = p.x;
                    wy = p.y;
                    wz = p.z;
                    hx = h.x;
                    hz = h.z;
                    const cross = hx * landing.fz - hz * landing.fx;
                    bank = Math.max(-0.32, Math.min(0.32, cross * 0.08));
                } else {
                    const flareEnd = 0.42;
                    if (u < flareEnd) {
                        const t = smooth01(u / flareEnd);
                        wx = route.p3.x + (landing.sx - route.p3.x) * t;
                        wz = route.p3.z + (landing.sz - route.p3.z) * t;
                        wy = route.p3.y + (groundY - route.p3.y) * t;
                    } else {
                        const t = (u - flareEnd) / (1 - flareEnd);
                        wx = landing.sx + (landing.ex - landing.sx) * t;
                        wz = landing.sz + (landing.ez - landing.sz) * t;
                        wy = groundY;
                    }
                    hx = landing.fx;
                    hz = landing.fz;
                }
                st.c = Math.round(wx / SP + centerC);
                st.r = Math.round(wz / SP + centerR);
                v.group.position.set(wx, wy, wz);
                v.group.rotation.set(0, Math.atan2(-hz, hx), bank);
                continue;
            }
            const stopped = st.eout.dc === 0 && st.eout.dr === 0;
            if (st.dwell > 0) {
                // train dwelling at a station
                st.dwell -= dt;
            } else if (stopped) {
                const nb = trackNeighbours(st.c, st.r, surf);
                if (nb.length) {
                    const n = nb[Math.floor(Math.random() * nb.length)];
                    st.ein = { dc: n.c - st.c, dr: n.r - st.r };
                    st.eout = { ...st.ein };
                    st.p = 0.5; // start at the cell centre, drive out
                }
            } else {
                const arcing =
                    !(st.ein.dc === st.eout.dc && st.ein.dr === st.eout.dr) &&
                    !(st.ein.dc === -st.eout.dc && st.ein.dr === -st.eout.dr);
                const uturn = st.ein.dc === -st.eout.dc && st.ein.dr === -st.eout.dr;
                st.p += dt * VSPEED * (uturn ? 0.28 : arcing ? 0.6 : 1); // ease off for curves and turnarounds
                const nc = st.c + st.eout.dc,
                    nr = st.r + st.eout.dr;
                const nk = cellKey(nc, nr);
                const isRoad = surf === "road";
                const redLight = isRoad && lightCells.has(nk) && !canGo(sig, st.eout);
                const queued = occ.get(nk) === dirKey(st.eout); // a car ahead, same way
                const trainHold = isRoad && trainAtCrossing.has(nk); // wait for the train
                const lineP = stopLineP(v.code);
                // Stop sign: roll up to the line, then make one brief mandatory halt.
                let signHold = false;
                if (isRoad && stopCells.has(nk) && st.stopAt !== nk) {
                    signHold = true;
                    if (st.p >= lineP) {
                        st.signDwell = (st.signDwell ?? 0.8) - dt;
                        if (st.signDwell <= 0) {
                            st.signDwell = null;
                            st.stopAt = nk;
                            signHold = false;
                        }
                    }
                }
                if ((redLight || queued || trainHold || signHold) && st.p >= lineP) {
                    st.p = lineP; // hold before the intersection
                } else if (st.p >= 1) {
                    const ein = { ...st.eout };
                    const nb = trackNeighbours(nc, nr, surf);
                    const fwd = nb.filter((n) => !(n.c === nc - ein.dc && n.r === nr - ein.dr));
                    let eout;
                    if (fwd.length) {
                        const n = fwd[Math.floor(Math.random() * fwd.length)];
                        eout = { dc: n.c - nc, dr: n.r - nr };
                    } else if (nb.length)
                        eout = { dc: -ein.dc, dr: -ein.dr }; // dead end → turn back
                    else eout = { dc: 0, dr: 0 }; // track vanished → stop
                    st.c = nc;
                    st.r = nr;
                    st.ein = ein;
                    st.eout = eout;
                    st.p = Math.max(0, st.p - 1);
                    occ.set(nk, dirKey(eout)); // claim the cell this frame
                    if (st.stopAt && st.stopAt !== nk) st.stopAt = null; // left the stop sign behind
                    if (v.code === "train" && stationRailCells.has(nk)) st.dwell = 2.5; // pull into the station
                    if (v.code === "bus" && stationRoadCells.has(nk)) st.dwell = 2.0; // pull into the station
                }
            }

            // Position + heading for the current cell traversal.
            const cx = worldX(st.c),
                cz = worldZ(st.r);
            const inb = st.ein,
                out = st.eout;
            let px = cx,
                pz = cz,
                hx = st.hx ?? 1,
                hz = st.hz ?? 0;
            if (out.dc === 0 && out.dr === 0) {
                // parked — hold position and last heading
            } else if (inb.dc === out.dc && inb.dr === out.dr) {
                // straight
                const ex = cx - inb.dc * 0.5,
                    ez = cz - inb.dr * 0.5;
                px = ex + out.dc * st.p;
                pz = ez + out.dr * st.p;
                hx = out.dc;
                hz = out.dr;
            } else if (inb.dc === -out.dc && inb.dr === -out.dr) {
                // dead-end U-turn
                const ex = cx - inb.dc * 0.5,
                    ez = cz - inb.dr * 0.5;
                const k = 1 - Math.abs(2 * st.p - 1);
                px = ex + (cx - ex) * k;
                pz = ez + (cz - ez) * k;
                hx = st.p < 0.5 ? inb.dc : out.dc;
                hz = st.p < 0.5 ? inb.dr : out.dr;
            } else {
                // quarter-circle arc
                const ex = cx - inb.dc * 0.5,
                    ez = cz - inb.dr * 0.5;
                const fx = cx + out.dc * 0.5,
                    fz = cz + out.dr * 0.5;
                const pvx = cx - inb.dc * 0.5 + out.dc * 0.5,
                    pvz = cz - inb.dr * 0.5 + out.dr * 0.5;
                const a0 = Math.atan2(ez - pvz, ex - pvx);
                const a1 = Math.atan2(fz - pvz, fx - pvx);
                let da = a1 - a0;
                if (da > Math.PI) da -= 2 * Math.PI;
                if (da < -Math.PI) da += 2 * Math.PI;
                const a = a0 + da * st.p,
                    sgn = Math.sign(da) || 1;
                px = pvx + 0.5 * Math.cos(a);
                pz = pvz + 0.5 * Math.sin(a);
                hx = -Math.sin(a) * sgn;
                hz = Math.cos(a) * sgn;
            }
            st.hx = hx;
            st.hz = hz;
            if (surf === "road") {
                px += -hz * LANE;
                pz += hx * LANE;
            } // cars keep right
            v.group.position.set(px, vehicleRideY(v.code), pz);
            v.group.rotation.y = Math.atan2(-hz, hx);

            st.sound -= dt;
            if (st.sound <= 0) {
                st.sound = 5 + Math.random() * 6;
                if (!stopped && Math.random() < 0.5) vehicleSound(v.code === "train" ? "train" : "car");
            }
        }

        projectBubbles(t);

        idle += dt;
        if (idle > 5 && pointers.size === 0 && !drag) {
            azim += 0.0012;
            applyCamera();
        }

        renderer.render(scene, camera);
    }
    tick();

    // Free only per-instance resources on rebuild: the unique marking/rail box
    // geometries and the per-sprite SpriteMaterials. Shared mesh materials
    // (roadMat, grassMat, …), blockGeo/slabGeo, and cached emoji textures are
    // reused across rebuilds and must NOT be disposed here.
    function disposeGroup(group) {
        group.traverse((o) => {
            if (o.geometry && o.geometry !== blockGeo && o.geometry !== slabGeo) o.geometry.dispose();
            if (o.material?.isSpriteMaterial) o.material.dispose(); // leave .map (texCache)
        });
        group.removeFromParent?.();
        group.clear?.();
    }

    function dispose() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        layer.remove();
        scene.traverse((o) => {
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m) => {
                    m.map?.dispose?.();
                    m.dispose?.();
                });
            }
            o.geometry?.dispose?.();
        });
        texCache.forEach((tx) => tx.dispose());
        renderer.dispose();
    }

    return {
        dispose,
        addDecoration,
        waterPlant,
        growPlant,
        setTheme,
        setArrangeMode,
        beginPlaceFromTray,
        removeSelected,
        addStructure,
        addAnimal,
        zoomView,
        panView,
        recenterView,
        fitGardenView,
        beginSetCenterMode,
        cancelSetCenterMode,
    };
}
