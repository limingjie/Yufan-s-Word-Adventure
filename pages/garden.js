import { getMasteredCount } from '../js/db.js';
import { renderGarden, getStage } from '../js/lib/garden.js';

const MILESTONES = [10, 50, 100, 500];

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>Growing your garden…</p></div>`;

    const mastered = await getMasteredCount();
    const stage    = getStage(mastered);
    const next     = MILESTONES.find(m => m > mastered);

    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;text-align:center">
            <h2 style="margin-bottom:0.25rem">Word Garden</h2>
            <p style="color:#666;margin-bottom:1.5rem">
                Each shape represents a mastered word
            </p>

            <div style="margin-bottom:1.5rem">
                ${renderGarden(mastered)}
            </div>

            <div class="card" style="display:inline-block;padding:1rem 2rem;margin-bottom:1rem">
                <div style="font-size:2.25rem;font-weight:bold;color:#2D6A4F">${mastered}</div>
                <div style="font-size:0.8rem;color:#666;text-transform:uppercase;letter-spacing:0.05em">Words Mastered</div>
            </div>

            ${next ? `
            <p style="color:#666;font-size:0.9rem">
                ${next - mastered} more to reach the next stage (${next} mastered)
            </p>` : `
            <p style="color:#2D6A4F;font-weight:600">You've reached the maximum garden stage! 🌲</p>`}

            <div style="margin-top:2rem;display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
                <a href="#/learner/review"   class="btn btn-primary">Review Words</a>
                <a href="#/learner/add-word" class="btn btn-secondary">Add Words</a>
            </div>
        </div>`;
}
