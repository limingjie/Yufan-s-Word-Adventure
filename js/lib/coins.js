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
export const SHOP = {
    // --- Decorations (one-time unlock, become 3D props) ---
    butterflies: { name: 'Butterflies', icon: '🦋', cost: 15,  layer: 'sky',    type: 'decoration' },
    bees:        { name: 'Bees',        icon: '🐝', cost: 25,  layer: 'sky',    type: 'decoration' },
    bird:        { name: 'Bird',        icon: '🐦', cost: 30,  layer: 'sky',    type: 'decoration' },
    pots:        { name: 'Flower Pots', icon: '🪴', cost: 40,  layer: 'ground', type: 'decoration' },
    pond:        { name: 'Pond',        icon: '🟦', cost: 50,  layer: 'ground', type: 'decoration' },
    rainbow:     { name: 'Rainbow',     icon: '🌈', cost: 60,  layer: 'sky',    type: 'decoration' },
    gnome:       { name: 'Garden Gnome', icon: '🧙', cost: 70, layer: 'ground', type: 'decoration' },
    fountain:    { name: 'Fountain',    icon: '⛲', cost: 80,  layer: 'ground', type: 'decoration' },
    night:       { name: 'Night Theme', icon: '🌙', cost: 120, layer: 'theme',  type: 'decoration' },
    cottage:     { name: 'Cottage',     icon: '🏡', cost: 150, layer: 'ground', type: 'decoration' },

    // --- Boosters (cosmetic only — deliberately do NOT touch SRS/mastery) ---
    sunnyday:    { name: 'Sunny Day',    icon: '☀️', cost: 20, layer: 'theme', type: 'booster',
                   desc: 'All plants sparkle' },
    goldencan:   { name: 'Golden Can',   icon: '🪣', cost: 90, layer: 'theme', type: 'booster',
                   desc: 'Fancier watering animation' },
};

export function itemCost(itemCode) {
    return SHOP[itemCode]?.cost ?? 0;
}

export function shopList() {
    return Object.entries(SHOP).map(([code, info]) => ({ code, ...info }));
}
