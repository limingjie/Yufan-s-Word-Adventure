// ============================================================================
// Coins — the spendable garden currency
// ============================================================================
// Earned coins are DERIVED from countable history (never stored as a running
// total); only purchases live in the `garden_items` table. balance computed in
// db.getUserCoins() = earned − Σ(item costs). Keeps the same no-drift
// philosophy as Sunlight (growth.js).
//
//   +1 🪙 per word added
//   +1 🪙 per answer attempted (review or quiz)
//   +1 🪙 bonus per correct answer
//   +5 🪙 per badge earned
export function computeCoins({ wordsAdded = 0, testsTaken = 0, testsCorrect = 0, badgeCount = 0 } = {}) {
    return wordsAdded * 1 + testsTaken * 1 + testsCorrect * 1 + badgeCount * 5;
}

// ============================================================================
// Garden Shop catalog
// ============================================================================
// layer: where a decoration renders in the 3D scene ('sky' | 'ground' | 'theme').
// type:  'decoration' (a 3D prop) or 'booster' (cosmetic-only — NO SRS/level effect).
// cat:   shop-grid grouping ('decor' | 'animals' | 'playset' | 'structures' | 'themes').
// walk:  true → a ground animal walker (voxel model, stacks).
// animal:true → a ground animal with a persisted home cell; fences constrain roam.
// placeable: true → the learner drags it from the tray onto a specific block and
//   it remembers its position (col/grid_row/rotation in garden_items). Surface
//   tiles (road/rail/crossing/fence/runway) sit on a grass block; vehicles (car/bus/train/privatejet) ride a track/runway.
export const SHOP = {
    // --- Decorations (sky critters) ---
    butterflies: { name: 'Butterflies', icon: '🦋', cost: 15,  layer: 'sky',    type: 'decoration', cat: 'decor' },
    bees:        { name: 'Bees',        icon: '🐝', cost: 25,  layer: 'sky',    type: 'decoration', cat: 'decor' },
    bird:        { name: 'Bird',        icon: '🕊️', cost: 30,  layer: 'sky',    type: 'decoration', cat: 'decor' },
    gnome:       { name: 'Garden Gnome', icon: '🧙', cost: 70, layer: 'ground', type: 'decoration', cat: 'decor', oneOff: true },

    // --- Ground animals (voxel models that walk freely on the land; stack) ---
    cat:         { name: 'Cat',     icon: '🐱', cost: 25, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Wanders the grass' },
    dog:         { name: 'Dog',     icon: '🐶', cost: 30, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Roams and barks now and then' },
    rabbit:      { name: 'Rabbit',  icon: '🐰', cost: 20, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Hops around the field' },
    chicken:     { name: 'Chicken', icon: '🐔', cost: 20, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Pecks around the grass' },
    pig:         { name: 'Pig',     icon: '🐷', cost: 35, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Snuffles across the land' },
    cow:         { name: 'Cow',     icon: '🐄', cost: 45, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Grazes slowly on the grass' },
    deer:        { name: 'Deer',    icon: '🦌', cost: 50, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Steps lightly in fenced meadows' },
    bear:        { name: 'Bear',    icon: '🐻', cost: 65, layer: 'ground', type: 'decoration', cat: 'animals', walk: true, animal: true,
                   desc: 'Lumbers through its enclosure' },

    // --- Structures (voxel models with persisted positions; buy as many as you like) ---
    pond:        { name: 'Pond',        icon: '🟦', cost: 50,  layer: 'ground', type: 'decoration', cat: 'structures' },
    fountain:    { name: 'Fountain',    icon: '⛲', cost: 80,  layer: 'ground', type: 'decoration', cat: 'structures' },
    cottage:     { name: 'Cottage',     icon: '🏡', cost: 150, layer: 'ground', type: 'decoration', cat: 'structures' },

    // --- Placeable playset: buy many, drag onto blocks, rearrange any time ---
    // Cheap tracks, pricier vehicles. Cars/buses need roads; trains need rails; jets need long runways.
    road:        { name: 'Road',  icon: '🛣️', cost: 5,  layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, surface: 'road',
                   desc: 'A path tile — roads auto-connect' },
    rail:        { name: 'Rail',  icon: '🛤️', cost: 5,  layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, surface: 'rail',
                   desc: 'A track tile — rails auto-connect' },
    crossing:    { name: 'Level Crossing', icon: '🚸', cost: 8, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, surface: 'crossing',
                   desc: 'Road + rail cross here — cars and trains share it' },
    fence:       { name: 'Fence', icon: '🪵', cost: 1, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, surface: 'fence',
                   desc: 'Fence tile — fences auto-connect' },
    runway:      { name: 'Runway Block', icon: '🛫', cost: 6, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, surface: 'runway',
                   desc: 'Airport runway tile — connect 10 straight blocks for takeoff' },
    station:     { name: 'Transit Station', icon: '🚉', cost: 90, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, station: true,
                   desc: 'Place beside a rail or road — trains and buses stop here' },
    controltower:{ name: 'Control Tower', icon: '🗼', cost: 240, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, tower: true,
                   desc: 'Tall airport tower with night lights' },
    car:         { name: 'Car',   icon: '🚗', cost: 40, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, vehicle: 'road',
                   desc: 'Drives along your roads' },
    bus:         { name: 'Bus',   icon: '🚌', cost: 55, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, vehicle: 'road',
                   desc: 'Blue bus — drives roads and stops at stations' },
    train:       { name: 'Train', icon: '🚂', cost: 60, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, vehicle: 'rail',
                   desc: 'Runs along your rails' },
    privatejet:  { name: 'Private Jet', icon: '🛩️', cost: 180, layer: 'ground', type: 'decoration', cat: 'playset', placeable: true, vehicle: 'runway',
                   desc: 'Takes off and lands on a straight 10-block runway' },

    // --- Themes and boosters (cosmetic only — deliberately do NOT touch SRS/mastery) ---
    sunnyday:    { name: 'Sunny Day',    icon: '☀️', cost: 20,  layer: 'theme', type: 'theme', cat: 'themes', oneOff: true,
                   desc: 'Warmer daytime light' },
    night:       { name: 'Night Theme',  icon: '🌙', cost: 120, layer: 'theme', type: 'theme', cat: 'themes', oneOff: true,
                   desc: 'Moonlight and sleeping gnomes' },
    goldencan:   { name: 'Golden Can',   icon: '🪣', cost: 90,  layer: 'theme', type: 'booster', cat: 'themes', oneOff: true,
                   desc: 'Fancier watering animation' },

    // --- Quiz hints (spent during quizzes, not sold in the shop) ---
    // type 'hint' is NOT one-off, so every purchase is counted again in
    // getUserCoins() — i.e. each hint really costs a coin. hidden:true keeps
    // them out of the Garden Shop list.
    hint5050:        { name: '50/50',        icon: '➗', cost: 1, type: 'hint', hidden: true },
    hintMeaningChi:  { name: 'Chinese hint', icon: '🇨🇳', cost: 1, type: 'hint', hidden: true },
    hintSpelling:    { name: 'Letter hint',  icon: '💡', cost: 1, type: 'hint', hidden: true },
};

export function itemCost(itemCode) {
    return SHOP[itemCode]?.cost ?? 0;
}

export function shopList() {
    return Object.entries(SHOP)
        .filter(([, info]) => !info.hidden)
        .map(([code, info]) => ({ code, ...info }));
}

export function isOneOffItem(itemCode) {
    const info = SHOP[itemCode];
    return !!info && (info.oneOff || info.type === 'theme' || info.type === 'booster');
}

// Placeable items are dragged onto a chosen block and remember col/grid_row.
export function isPlaceable(itemCode) {
    return !!SHOP[itemCode]?.placeable;
}
