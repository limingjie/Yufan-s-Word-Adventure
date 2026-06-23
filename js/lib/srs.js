const INTERVALS = [1, 3, 7, 14, 30, 60];

export function nextLevel(level, correct) {
    return correct ? Math.min(level + 1, 5) : 0;
}

export function nextReviewDate(level) {
    const days = INTERVALS[Math.min(level, 5)];
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function intervalDays(level) {
    return INTERVALS[Math.min(level, 5)];
}

export function isMastered(level) {
    return level >= 4;
}

const MASTERY = [
    { label: '🌱 Seed',         emoji: '🌱', badgeClass: 'srs-seed'    },
    { label: '🌿 Sprout',       emoji: '🌿', badgeClass: 'srs-sprout'  },
    { label: '🌷 Flower',       emoji: '🌷', badgeClass: 'srs-flower'  },
    { label: '🌳 Tree',         emoji: '🌳', badgeClass: 'srs-tree'    },
    { label: '🏆 Golden Tree',  emoji: '🏆', badgeClass: 'srs-golden'  },
    { label: '🏆 Golden Tree',  emoji: '🏆', badgeClass: 'srs-golden'  },
];

export function srsLabel(level) {
    return MASTERY[Math.min(level, 5)].label;
}

export function srsBadgeClass(level) {
    return MASTERY[Math.min(level, 5)].badgeClass;
}

export function masteryEmoji(level) {
    return MASTERY[Math.min(level, 5)].emoji;
}
