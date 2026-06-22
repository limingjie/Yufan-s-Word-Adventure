/**
 * Authentication Module
 * Handles user login, logout, and session management
 */

import { supabase } from "./supabase.js";

let currentUser = null;
let currentProfile = null;

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        return user;
    } catch (err) {
        console.error("Error getting current user:", err);
        return null;
    }
}

/**
 * Get current user's profile
 */
export async function getCurrentProfile() {
    if (!currentProfile) {
        const user = await getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
        currentProfile = data;
    }
    return currentProfile;
}

/**
 * Login with email and password
 */
export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        currentUser = data.user;
        currentProfile = null; // Clear cache to refetch

        console.log("✅ Login successful:", email);
        return { success: true, user: data.user };
    } catch (err) {
        console.error("❌ Login failed:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Logout
 */
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentUser = null;
        currentProfile = null;

        console.log("✅ Logout successful");
        return { success: true };
    } catch (err) {
        console.error("❌ Logout failed:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Check if user is logged in
 */
export async function isAuthenticated() {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    return !!session;
}

/**
 * Check if user is parent role
 */
export async function isParent() {
    const profile = await getCurrentProfile();
    return profile?.role === "parent";
}

/**
 * Check if user is learner role
 */
export async function isLearner() {
    const profile = await getCurrentProfile();
    return profile?.role === "learner";
}

/**
 * Get user's role
 */
export async function getUserRole() {
    const profile = await getCurrentProfile();
    return profile?.role;
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChanged(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        currentProfile = null; // Clear cache
        callback(event, session);
    });
}
