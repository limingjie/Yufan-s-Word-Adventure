/**
 * Main Application Module
 * Initializes the app, sets up routing, and manages navigation
 */

import { verifyConnection } from "./supabase.js";
import { getCurrentUser, getCurrentProfile, isAuthenticated, getUserRole, onAuthStateChanged, logout } from "./auth.js";

// Import page modules
import { renderLoginPage } from "../pages/login.js";
import { renderHomePage } from "../pages/home.js";
import { renderAddWordPage } from "../pages/add-word.js";
import { renderReviewPage } from "../pages/review.js";
import { renderLeaderboardPage } from "../pages/leaderboard.js";
import { renderSettingsPage } from "../pages/settings.js";

// ============================================================================
// Global State
// ============================================================================

let currentRoute = null;
let isInitialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log("🚀 Initializing Word Adventure...");

    // Check Supabase connection
    const connected = await verifyConnection();
    if (!connected) {
        showError("Cannot connect to Supabase. Please check your configuration.");
        return;
    }

    // Set up auth state listener
    onAuthStateChanged((event, session) => {
        console.log("Auth state changed:", event);
        if (session) {
            navigateTo(getCurrentRouteFromHash());
        } else {
            navigateTo("/login");
        }
    });

    // Check current auth status
    const isAuth = await isAuthenticated();
    if (isAuth) {
        navigateTo(getCurrentRouteFromHash() || "/home");
    } else {
        navigateTo("/login");
    }

    // Set up hash change listener for routing
    window.addEventListener("hashchange", () => {
        const route = getCurrentRouteFromHash();
        navigateTo(route);
    });

    isInitialized = true;
    console.log("✅ App initialized");
}

// ============================================================================
// Routing
// ============================================================================

/**
 * Get current route from URL hash
 */
function getCurrentRouteFromHash() {
    const hash = window.location.hash.slice(1) || "";
    return "/" + hash;
}

/**
 * Navigate to a route
 */
export async function navigateTo(route) {
    console.log("📍 Navigating to:", route);

    // Check authentication for protected routes
    const isAuth = await isAuthenticated();
    const isProtectedRoute = !["/login", "/"].includes(route);

    if (isProtectedRoute && !isAuth) {
        window.location.hash = "#login";
        return;
    }

    // Render the appropriate page
    const contentEl = document.getElementById("content");
    const navbarEl = document.getElementById("navbar");

    try {
        if (route === "/login" || route === "/") {
            // Don't show navbar on login
            navbarEl.innerHTML = "";
            await renderLoginPage();
        } else if (route === "/home") {
            await renderNavbar();
            await renderHomePage();
        } else if (route === "/add-word") {
            await renderNavbar();
            await renderAddWordPage();
        } else if (route === "/review") {
            await renderNavbar();
            await renderReviewPage();
        } else if (route === "/leaderboard") {
            await renderNavbar();
            await renderLeaderboardPage();
        } else if (route === "/settings") {
            await renderNavbar();
            await renderSettingsPage();
        } else {
            // Default to home
            window.location.hash = "#home";
        }

        currentRoute = route;
    } catch (err) {
        console.error("Error rendering page:", err);
        showError(`Error loading page: ${err.message}`);
    }
}

/**
 * Render navigation bar
 */
async function renderNavbar() {
    const profile = await getCurrentProfile();
    const navbarEl = document.getElementById("navbar");

    if (!profile) {
        navbarEl.innerHTML = "";
        return;
    }

    navbarEl.innerHTML = `
    <div class="navbar-container">
      <div class="navbar-brand">
        <h1><a href="#home">🌍 Word Adventure</a></h1>
      </div>

      <div class="navbar-stats">
        <div class="stat">
          <span class="label">Level</span>
          <span class="value" id="level-display">1</span>
        </div>
        <div class="stat">
          <span class="label">XP</span>
          <span class="value" id="xp-display">0</span>
        </div>
        <div class="stat">
          <span class="label">Streak</span>
          <span class="value" id="streak-display">0</span>
        </div>
      </div>

      <nav class="navbar-menu">
        <a href="#home" class="nav-link ${currentRoute === "/home" ? "active" : ""}">Home</a>
        <a href="#add-word" class="nav-link ${currentRoute === "/add-word" ? "active" : ""}">Add Word</a>
        <a href="#review" class="nav-link ${currentRoute === "/review" ? "active" : ""}">Review</a>
        <a href="#leaderboard" class="nav-link ${currentRoute === "/leaderboard" ? "active" : ""}">Leaderboard</a>
        <a href="#settings" class="nav-link ${currentRoute === "/settings" ? "active" : ""}">Settings</a>
      </nav>

      <div class="navbar-user">
        <span class="username">${profile.display_name}</span>
        <button class="logout-btn" onclick="window.app.handleLogout()">Logout</button>
      </div>
    </div>
  `;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Show loading indicator
 */
export function showLoading(show = true) {
    const loader = document.getElementById("loading");
    loader.style.display = show ? "flex" : "none";
}

/**
 * Show error message
 */
export function showError(message) {
    console.error("❌ Error:", message);
    const contentEl = document.getElementById("content");
    contentEl.innerHTML = `
    <div class="error-message">
      <h2>⚠️ Error</h2>
      <p>${message}</p>
      <button onclick="window.location.hash = '#home'">Go Home</button>
    </div>
  `;
}

/**
 * Show success message
 */
export function showSuccess(message) {
    console.log("✅ Success:", message);
    // Could be enhanced with a toast notification
    alert(message);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle logout
 */
async function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        await logout();
        window.location.hash = "#login";
    }
}

// ============================================================================
// Expose to global scope for HTML event handlers
// ============================================================================

window.app = {
    navigateTo,
    showLoading,
    showError,
    showSuccess,
    handleLogout,
};

// ============================================================================
// Start App
// ============================================================================

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);
