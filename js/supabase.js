/**
 * Supabase Client Initialization
 * Initializes and exports the Supabase client instance
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Initialize Supabase client
const { createClient } = window.supabase;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Verify connection to Supabase
 */
export async function verifyConnection() {
    try {
        const { data, error } = await supabase.from("profiles").select("count", { count: "exact" }).limit(1);

        if (error) throw error;
        console.log("✅ Connected to Supabase");
        return true;
    } catch (err) {
        console.error("❌ Supabase connection failed:", err.message);
        return false;
    }
}
