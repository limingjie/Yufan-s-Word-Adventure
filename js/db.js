/**
 * Database Query Module
 * All database operations for words, reviews, tests, achievements, leaderboards
 */

import { supabase } from "./supabase.js";
import { getCurrentUser, getCurrentProfile } from "./auth.js";

// ============================================================================
// WORDS
// ============================================================================

/**
 * Add a new word
 */
export async function addWord(wordData) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("words")
        .insert({
            user_id: user.id,
            word: wordData.word,
            part_of_speech: wordData.partOfSpeech || null,
            english_definition: wordData.englishDef || null,
            chinese_definition: wordData.chineseDef || null,
            example_sentence: wordData.exampleSentence || null,
            category: wordData.category || "general",
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all words for current user
 */
export async function getWords(options = {}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    let query = supabase.from("words").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Get word by ID
 */
export async function getWord(wordId) {
    const { data, error } = await supabase.from("words").select("*").eq("id", wordId).single();

    if (error) throw error;
    return data;
}

/**
 * Update word
 */
export async function updateWord(wordId, updates) {
    const { data, error } = await supabase.from("words").update(updates).eq("id", wordId).select().single();

    if (error) throw error;
    return data;
}

/**
 * Delete word
 */
export async function deleteWord(wordId) {
    const { error } = await supabase.from("words").delete().eq("id", wordId);

    if (error) throw error;
    return true;
}

/**
 * Get words count for user
 */
export async function getWordsCount() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { count, error } = await supabase.from("words").select("id", { count: "exact" }).eq("user_id", user.id);

    if (error) throw error;
    return count;
}

// ============================================================================
// REVIEW SCHEDULE
// ============================================================================

/**
 * Get words due for review today
 */
export async function getWordsForReviewToday() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("review_schedule")
        .select(
            `
      id,
      word_id,
      review_level,
      words!inner(*)
    `,
        )
        .eq("user_id", user.id)
        .lte("next_review_date", today)
        .order("review_level", { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Update review schedule after review
 */
export async function updateReviewSchedule(reviewId, updates) {
    const { data, error } = await supabase.from("review_schedule").update(updates).eq("id", reviewId).select().single();

    if (error) throw error;
    return data;
}

// ============================================================================
// TEST RESULTS
// ============================================================================

/**
 * Record test result
 */
export async function recordTestResult(wordId, testType, isCorrect, response = null) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("test_results")
        .insert({
            user_id: user.id,
            word_id: wordId,
            test_type: testType,
            correct: isCorrect,
            response: response,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get test results for a word
 */
export async function getTestResults(wordId) {
    const { data, error } = await supabase
        .from("test_results")
        .select("*")
        .eq("word_id", wordId)
        .order("tested_at", { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Get user's accuracy percentage
 */
export async function getUserAccuracy() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase.from("test_results").select("correct").eq("user_id", user.id);

    if (error) throw error;

    if (!data || data.length === 0) return 0;
    const correct = data.filter((r) => r.correct).length;
    return Math.round((correct / data.length) * 100);
}

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

/**
 * Award achievement to user
 */
export async function awardAchievement(achievementCode) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("achievements")
        .insert({
            user_id: user.id,
            achievement_code: achievementCode,
        })
        .select()
        .single();

    if (error && !error.message.includes("duplicate")) {
        throw error;
    }

    return data;
}

/**
 * Check if user has achievement
 */
export async function hasAchievement(achievementCode) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("achievements")
        .select("id")
        .eq("user_id", user.id)
        .eq("achievement_code", achievementCode)
        .single();

    if (error && error.code === "PGRST116") return false; // Not found
    if (error) throw error;

    return !!data;
}

/**
 * Get all user's achievements
 */
export async function getUserAchievements() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

// ============================================================================
// LEADERBOARDS & COMPETITION
// ============================================================================

/**
 * Get XP leaderboard (top learners by XP)
 */
export async function getXPLeaderboard(limit = 10) {
    const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select(
            `
      id,
      user_id,
      total_xp,
      current_level,
      profiles!inner(id, display_name, avatar_color)
    `,
        )
        .eq("profiles.is_public", true)
        .eq("profiles.role", "learner")
        .eq("snapshot_date", new Date().toISOString().split("T")[0])
        .order("total_xp", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Get mastered words leaderboard
 */
export async function getMasteredWordsLeaderboard(limit = 10) {
    const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select(
            `
      id,
      user_id,
      mastered_words_count,
      profiles!inner(id, display_name, avatar_color)
    `,
        )
        .eq("profiles.is_public", true)
        .eq("profiles.role", "learner")
        .eq("snapshot_date", new Date().toISOString().split("T")[0])
        .order("mastered_words_count", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Get streaks leaderboard
 */
export async function getStreaksLeaderboard(limit = 10) {
    const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select(
            `
      id,
      user_id,
      current_streak,
      profiles!inner(id, display_name, avatar_color)
    `,
        )
        .eq("profiles.is_public", true)
        .eq("profiles.role", "learner")
        .eq("snapshot_date", new Date().toISOString().split("T")[0])
        .order("current_streak", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Get learner profile
 */
export async function getLearnerProfile(learnerId) {
    const { data, error } = await supabase
        .from("profiles")
        .select(
            `
      *,
      achievements!inner(achievement_code)
    `,
        )
        .eq("id", learnerId)
        .eq("is_public", true)
        .eq("role", "learner")
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get head-to-head comparison
 */
export async function comparelearners(learnerId1, learnerId2) {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select(
            `
      user_id,
      total_xp,
      current_level,
      mastered_words_count,
      current_streak,
      accuracy_pct,
      profiles!inner(id, display_name, avatar_color)
    `,
        )
        .in("user_id", [learnerId1, learnerId2])
        .eq("snapshot_date", today);

    if (error) throw error;
    return data || [];
}

/**
 * Get all public learners
 */
export async function getPublicLearners() {
    const { data, error } = await supabase
        .from("profiles")
        .select(
            `
      id,
      display_name,
      avatar_color,
      role
    `,
        )
        .eq("is_public", true)
        .eq("role", "learner")
        .order("display_name");

    if (error) throw error;
    return data || [];
}

// ============================================================================
// STATS & CALCULATIONS
// ============================================================================

/**
 * Calculate user stats (for leaderboard cache)
 */
export async function calculateUserStats(userId) {
    try {
        // Words added
        const { count: wordsCount } = await supabase
            .from("words")
            .select("id", { count: "exact" })
            .eq("user_id", userId);

        // Tests taken
        const { data: tests } = await supabase.from("test_results").select("correct").eq("user_id", userId);

        const testsCount = tests?.length || 0;
        const testsCorrect = tests?.filter((t) => t.correct).length || 0;
        const accuracy = testsCount > 0 ? Math.round((testsCorrect / testsCount) * 100) : 0;

        // XP calculation: words * 1 + tests * 2 + correct * 3
        const totalXP = (wordsCount || 0) * 1 + (testsCount || 0) * 2 + (testsCorrect || 0) * 3;
        const level = Math.floor(totalXP / 100) + 1;

        return {
            wordsCount: wordsCount || 0,
            testsCount: testsCount || 0,
            testsCorrect: testsCorrect || 0,
            accuracy: accuracy,
            totalXP: totalXP,
            level: level,
        };
    } catch (err) {
        console.error("Error calculating stats:", err);
        return null;
    }
}
