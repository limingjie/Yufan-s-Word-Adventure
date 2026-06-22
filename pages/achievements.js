import { supabase } from '../js/supabase.js';
import { getCurrentUser } from '../js/auth.js';
import { ACHIEVEMENTS } from '../js/lib/achievements.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const user = await getCurrentUser();
    const { data: earned } = await supabase
        .from('achievements')
        .select('achievement_code, earned_at')
        .eq('user_id', user.id);

    const earnedMap = new Map((earned || []).map(a => [a.achievement_code, a.earned_at]));

    const badgesHTML = Object.entries(ACHIEVEMENTS).map(([code, info]) => {
        const isEarned = earnedMap.has(code);
        const dateStr  = isEarned
            ? new Date(earnedMap.get(code)).toLocaleDateString()
            : null;

        return `
            <div class="achievement-badge ${isEarned ? 'earned' : 'locked'}">
                <span class="badge-icon">${info.icon}</span>
                <div class="badge-label">${info.label}</div>
                <div class="badge-desc">${info.desc}</div>
                ${dateStr ? `<div style="font-size:0.65rem;color:#888;margin-top:4px">${dateStr}</div>` : ''}
            </div>`;
    }).join('');

    const earnedCount = earnedMap.size;
    const total       = Object.keys(ACHIEVEMENTS).length;

    container.innerHTML = `
        <div style="max-width:700px;margin:0 auto">
            <div style="display:flex;align-items:baseline;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
                <h2 style="margin:0">Medals & Badges</h2>
                <span style="color:#666;font-size:0.9rem">${earnedCount} / ${total} earned</span>
            </div>

            ${earnedCount === 0 ? `
            <div class="alert alert-info" style="margin-bottom:1.5rem">
                Keep adding words and reviewing to unlock your first badge!
            </div>` : ''}

            <div class="achievement-grid">${badgesHTML}</div>
        </div>`;
}
