const INTERVALS = [1, 3, 7, 14, 30, 60];

export function nextLevel(level, correct) {
    return correct ? Math.min(level + 1, 5) : 0;
}

export function nextReviewDate(level) {
    const days = INTERVALS[Math.min(level, 5)];
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

export function intervalDays(level) {
    return INTERVALS[Math.min(level, 5)];
}

export function isMastered(level) {
    return level >= 4;
}

export function srsLabel(level) {
    return ['New', 'Learning', 'Familiar', 'Reviewing', 'Mastered', 'Expert'][Math.min(level, 5)];
}

export function srsBadgeClass(level) {
    return ['srs-new', 'srs-learning', 'srs-familiar', 'srs-reviewing', 'srs-mastered', 'srs-expert'][Math.min(level, 5)];
}
