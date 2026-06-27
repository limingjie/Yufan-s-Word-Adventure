import { getCurrentProfile, isAuthenticated, getUserRole, onAuthStateChanged, logout } from './auth.js';

let currentRoute = null;

const LEARNER_ROUTES = new Set([
    '/learner/home', '/learner/add-word', '/learner/words',
    '/learner/review', '/learner/quiz', '/learner/curve-drill', '/learner/garden',
    '/learner/achievements', '/learner/leaderboard', '/learner/settings',
]);

const PARENT_ROUTES = new Set(['/parent/dashboard', '/parent/words', '/parent/activity']);

// Thunks so bundler-free dynamic import with static strings works in all browsers
const ROUTES = {
    '/login':                () => import('../pages/login.js'),
    '/learner/home':         () => import('../pages/learner-home.js'),
    '/learner/add-word':     () => import('../pages/word-list.js'),
    '/learner/words':        () => import('../pages/word-list.js'),
    '/learner/review':       () => import('../pages/review.js'),
    '/learner/quiz':         () => import('../pages/quiz.js'),
    '/learner/curve-drill':  () => import('../pages/curve-drill.js'),
    '/learner/garden':       () => import('../pages/garden.js'),
    '/learner/achievements': () => import('../pages/achievements.js'),
    '/learner/leaderboard':  () => import('../pages/leaderboard.js'),
    '/learner/settings':     () => import('../pages/settings.js'),
    '/parent/dashboard':     () => import('../pages/parent-dashboard.js'),
    '/parent/words':         () => import('../pages/parent-words.js'),
    '/parent/activity':      () => import('../pages/parent-activity.js'),
};

// ============================================================================
// Routing helpers
// ============================================================================

function routeFromHash() {
    const h = globalThis.location.hash;
    return h && h !== '#' ? h.slice(1) : null;
}

function go(path) {
    globalThis.location.hash = '#' + path;
}

async function defaultRoute() {
    const role = await getUserRole();
    return role === 'parent' ? '/parent/dashboard' : '/learner/home';
}

// Returns a redirect path if the route is forbidden, null if allowed
async function authGuard(route) {
    const authenticated = await isAuthenticated();

    if (route === '/login') {
        return authenticated ? await defaultRoute() : null;
    }

    if (!authenticated) return '/login';

    const role = await getUserRole();
    if (LEARNER_ROUTES.has(route) && role !== 'learner') return await defaultRoute();
    if (PARENT_ROUTES.has(route) && role !== 'parent')   return await defaultRoute();

    return null;
}

// ============================================================================
// Page renderer
// ============================================================================

async function renderPage(route) {
    const content = document.getElementById('content');
    const navbar  = document.getElementById('navbar');

    if (!route) route = await defaultRoute();

    const redirect = await authGuard(route);
    if (redirect) { go(redirect); return; }

    currentRoute = route;
    document.body.classList.toggle('login-page', route === '/login');
    document.body.classList.toggle('garden-page', route === '/learner/garden');

    try {
        if (route === '/login') {
            navbar.innerHTML = '';
        } else {
            renderNavbar(await getCurrentProfile());
        }

        // Dynamic segment: /learner/compare/:id
        if (route.startsWith('/learner/compare/')) {
            const otherId = route.split('/')[3];
            const { render } = await import('../pages/compare.js');
            await render(content, otherId);
            return;
        }

        const loader = ROUTES[route];
        if (loader) {
            const { render } = await loader();
            await render(content);
        } else {
            go(await defaultRoute());
        }
    } catch (err) {
        console.error('Page error:', err);
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p>${err.message}</p>
                <a href="#/learner/home" class="btn btn-primary" style="margin-top:1rem">Go Home</a>
            </div>`;
    }
}

// ============================================================================
// Navbar
// ============================================================================

function renderNavbar(profile) {
    const navbar = document.getElementById('navbar');
    if (!profile) return;

    // Review and Awards have no nav tab on purpose: reviews are reached from the
    // Home missions / Garden, and Awards from the Home header medal chip.
    const links = profile.role === 'parent'
        ? [{ href: '/parent/dashboard', label: 'Dashboard' }, { href: '/parent/words', label: 'Word Lists' }, { href: '/parent/activity', label: 'Activity' }]
        : [
            { href: '/learner/home',        label: 'Home' },
            { href: '/learner/words',       label: 'My Words' },
            { href: '/learner/garden',      label: 'Garden' },
            { href: '/learner/leaderboard', label: 'Leaderboard' },
          ];

    const navLinks = links.map(l =>
        `<a href="#${l.href}" class="nav-link${currentRoute === l.href ? ' active' : ''}">${l.label}</a>`
    ).join('');

    const initial = (profile.display_name || '?')[0].toUpperCase();
    const avatarFace = profile.avatar_emoji || initial;
    const color   = profile.avatar_color || '#007BFF';
    const home    = profile.role === 'parent' ? '/parent/dashboard' : '/learner/home';

    navbar.innerHTML = `
        <div class="navbar-container">
            <div class="navbar-brand">
                <a href="#${home}" class="brand-logo" aria-label="Word Adventure home">
                    <img src="assets/logo-word-adventure.svg" alt="Word Adventure" />
                </a>
            </div>
            <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">☰</button>
            <nav class="navbar-menu" id="navMenu">${navLinks}</nav>
            <div class="navbar-user">
                <div class="avatar${profile.avatar_emoji ? ' avatar-emoji' : ''}" style="background:${color};width:32px;height:32px;font-size:0.85rem">${avatarFace}</div>
                <span class="username">${profile.display_name}</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            </div>
        </div>`;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
        go('/login');
    });

    document.getElementById('navToggle').addEventListener('click', () => {
        document.getElementById('navMenu').classList.toggle('open');
    });
}

// ============================================================================
// Boot
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged((event) => {
        if (event === 'SIGNED_OUT') go('/login');
    });

    await renderPage(routeFromHash());

    globalThis.addEventListener('hashchange', () => {
        document.getElementById('navMenu')?.classList.remove('open');
        renderPage(routeFromHash());
    });

    // Re-render the navbar when the profile changes (e.g. avatar edited on Home)
    // so the navbar avatar updates immediately without a page reload.
    globalThis.addEventListener('profile-updated', async () => {
        if (currentRoute !== '/login') renderNavbar(await getCurrentProfile());
    });
});
