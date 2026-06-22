const STAGES = [
    { max: 9,        type: 'seed',   symbol: '●', color: '#8B6914', desc: 'Seeds are planted...' },
    { max: 49,       type: 'sprout', symbol: '▲', color: '#52B788', desc: 'Sprouts are growing!' },
    { max: 99,       type: 'flower', symbol: '✿', color: '#FF85A1', desc: 'Flowers are blooming!' },
    { max: 499,      type: 'tree',   symbol: '♧', color: '#2D6A4F', desc: 'A grove of knowledge!' },
    { max: Infinity, type: 'forest', symbol: '♧', color: '#1B4332', desc: 'A magnificent forest!' },
];

export function getStage(masteredCount) {
    return STAGES.find(s => masteredCount <= s.max);
}

export function renderGarden(masteredCount) {
    const stage = getStage(masteredCount);
    const displayCount = Math.min(masteredCount, 100);

    if (displayCount === 0) {
        return `
            <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg"
                 style="width:100%;max-width:500px;background:#F0F7EE;border-radius:12px;">
                <rect width="400" height="280" fill="#F0F7EE" rx="8"/>
                <text x="200" y="130" text-anchor="middle" font-size="14" fill="#888">
                    Add words and master them to grow your garden!
                </text>
                <text x="200" y="160" text-anchor="middle" font-size="40">🌱</text>
            </svg>`;
    }

    const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(displayCount))));
    const svgW = 400;
    const svgH = 280;
    const cellW = svgW / cols;
    const rows = Math.ceil(displayCount / cols);
    const cellH = Math.max(24, Math.min(40, (svgH - 40) / rows));
    const fontSize = stage.type === 'seed' ? 9 : stage.type === 'sprout' ? 13 : stage.type === 'flower' ? 17 : 21;

    const cells = Array.from({ length: displayCount }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const jitter = ((i * 7) % 13) - 6;
        const cx = col * cellW + cellW / 2 + jitter;
        const cy = svgH - 16 - row * cellH;
        return `<text x="${cx}" y="${cy}" font-size="${fontSize}" fill="${stage.color}" text-anchor="middle" opacity="0.85">${stage.symbol}</text>`;
    }).join('\n');

    return `
        <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;max-width:500px;background:#F0F7EE;border-radius:12px;">
            <rect width="${svgW}" height="${svgH}" fill="#F0F7EE" rx="8"/>
            <text x="${svgW / 2}" y="20" text-anchor="middle" font-size="12" fill="#666">${stage.desc}</text>
            ${cells}
        </svg>`;
}
