/**
 * Database Query Module
 * All database operations for words, reviews, tests, achievements, leaderboards
 */

import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";
import { nextLevel, nextReviewDate, intervalDays } from "./lib/srs.js";
import { computeSunlight } from "./lib/growth.js";
import { computeCoins, itemCost, isOneOffItem } from "./lib/coins.js";
import { MISSION_NEW_WORDS, missionThreshold } from "./lib/missions.js";

function localYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function getTestCountsForUser(userId) {
    const [takenRes, correctRes] = await Promise.all([
        supabase.from("test_results").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("test_results").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("correct", true),
    ]);
    if (takenRes.error) throw takenRes.error;
    if (correctRes.error) throw correctRes.error;
    return {
        testsTaken: takenRes.count || 0,
        testsCorrect: correctRes.count || 0,
    };
}

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
            ipa: wordData.ipa || null,
            part_of_speech: wordData.partOfSpeech || null,
            english_definition: wordData.englishDefinition || null,
            chinese_definition: wordData.chineseDefinition || null,
            example_sentence: wordData.exampleSentence || null,
            category: wordData.category || "general",
            audio_url_uk: wordData.audioUrlUK || null,
            audio_url_us: wordData.audioUrlUS || null,
            word_forms: wordData.wordForms || null,
            synonyms:   wordData.synonyms  || null,
            antonyms:   wordData.antonyms  || null,
            quotes:     wordData.quotes    || null,
        })
        .select()
        .single();

    if (error) throw error;

    // Auto-create review schedule entry so the word is due immediately
    await supabase.from("review_schedule").insert({
        word_id: data.id,
        user_id: user.id,
        next_review_date: localYMD(new Date()),
        review_level: 0,
        interval_days: 1,
    });

    return data;
}

/**
 * Get all words for current user
 */
export async function getWords(options = {}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    let query = supabase.from("words").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Get all words with their current SRS review_level merged in
 */
export async function getWordsWithSRS() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const [wordsResult, scheduleResult] = await Promise.all([
        supabase.from("words").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("review_schedule").select("word_id,review_level").eq("user_id", user.id),
    ]);

    if (wordsResult.error) throw wordsResult.error;

    const levelMap = new Map((scheduleResult.data || []).map(s => [s.word_id, s.review_level]));
    return (wordsResult.data || []).map(w => ({ ...w, review_level: levelMap.get(w.id) ?? 0 }));
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
 * Soft-delete a word (moves it to trash)
 */
export async function deleteWord(wordId) {
    const { error } = await supabase
        .from("words")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", wordId);

    if (error) throw error;
    return true;
}

/**
 * Restore a soft-deleted word from trash
 */
export async function restoreWord(wordId) {
    const { error } = await supabase
        .from("words")
        .update({ deleted_at: null })
        .eq("id", wordId);

    if (error) throw error;
    return true;
}

/**
 * Permanently delete a word (irreversible)
 */
export async function permanentlyDeleteWord(wordId) {
    const { error } = await supabase.from("words").delete().eq("id", wordId);

    if (error) throw error;
    return true;
}

/**
 * Get all trashed (soft-deleted) words for current user
 */
export async function getTrashedWords() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("words")
        .select("*")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get words count for user (excludes trashed)
 */
export async function getWordsCount() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { count, error } = await supabase.from("words").select("id", { count: "exact" }).eq("user_id", user.id).is("deleted_at", null);

    if (error) throw error;
    return count;
}

// ============================================================================
// REVIEW SCHEDULE
// ============================================================================

/**
 * Get words due for review today.
 *
 * scope:
 *   'all'   — all due words, today's new words first, capped at 30 (default)
 *   'new'   — only words created today that are due (uncapped)
 *   'curve' — only older due words (created before today), by memory curve,
 *             capped at 30
 */
export async function getWordsForReviewToday(scope = "all") {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const today = localYMD(new Date());

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

    let active = (data || []).filter(row => row.words?.deleted_at == null);

    const isToday = row => localYMD(new Date(row.words.created_at)) === today;

    if (scope === "new") {
        // Today's freshly-added words, lowest level first. No cap.
        return active
            .filter(isToday)
            .sort((a, b) => a.review_level - b.review_level);
    }

    if (scope === "curve") {
        // Older due words only, by memory curve (level ascending), capped at 30.
        return active
            .filter(row => !isToday(row))
            .sort((a, b) => a.review_level - b.review_level)
            .slice(0, 30);
    }

    // 'all' — priority within the 30-word daily cap:
    // 1. New words (added today) first
    // 2. Higher levels ascending
    active.sort((a, b) => {
        const aIsNew = isToday(a);
        const bIsNew = isToday(b);
        if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;
        return a.review_level - b.review_level;
    });

    return active.slice(0, 30);
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

    const { testsTaken, testsCorrect } = await getTestCountsForUser(user.id);
    if (testsTaken === 0) return 0;
    return Math.round((testsCorrect / testsTaken) * 100);
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

    if (error?.code === "PGRST116") return false; // Not found
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
        .eq("snapshot_date", localYMD(new Date()))
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
        .eq("snapshot_date", localYMD(new Date()))
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
        .eq("snapshot_date", localYMD(new Date()))
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
    const today = localYMD(new Date());

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

        const { testsTaken: testsCount, testsCorrect } = await getTestCountsForUser(userId);
        const accuracy = testsCount > 0 ? Math.round((testsCorrect / testsCount) * 100) : 0;

        const totalSun = computeSunlight({ wordsAdded: wordsCount || 0, testsTaken: testsCount, testsCorrect });
        const level = Math.floor(totalSun / 100) + 1;

        return {
            wordsCount: wordsCount || 0,
            testsCount,
            testsCorrect,
            accuracy,
            totalSun,
            level,
        };
    } catch (err) {
        console.error("Error calculating stats:", err);
        return null;
    }
}

// ============================================================================
// XP & STREAK (current user)
// ============================================================================

export async function getUserSunlight() {
    const user = await getCurrentUser();
    if (!user) return { sun: 0, wordsAdded: 0, testsTaken: 0, testsCorrect: 0 };

    const [wordsResult, testCounts] = await Promise.all([
        supabase.from("words").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        getTestCountsForUser(user.id),
    ]);

    const wordsAdded = wordsResult.count || 0;
    const { testsTaken, testsCorrect } = testCounts;
    const sun = computeSunlight({ wordsAdded, testsTaken, testsCorrect });

    return { sun, wordsAdded, testsTaken, testsCorrect };
}

// ============================================================================
// COINS & GARDEN ITEMS
// ============================================================================
// Coins are the spendable currency. Like Sunlight, *earned* coins are derived
// from countable history (never stored as a running total); only purchases are
// stored (garden_items). balance = earned − Σ(item costs). No drift.

export async function getBadgeCount() {
    const user = await getCurrentUser();
    if (!user) return 0;
    const { count } = await supabase
        .from("achievements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
    return count || 0;
}

export async function getUserCoins() {
    const user = await getCurrentUser();
    if (!user) return { earned: 0, spent: 0, balance: 0 };

    const [wordsRes, testCounts, badgeRes, itemsRes] = await Promise.all([
        supabase.from("words").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        getTestCountsForUser(user.id),
        supabase.from("achievements").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("garden_items").select("item_code").eq("user_id", user.id),
    ]);

    const wordsAdded   = wordsRes.count || 0;
    const { testsTaken, testsCorrect } = testCounts;
    const badgeCount   = badgeRes.count || 0;

    const earned = computeCoins({ wordsAdded, testsTaken, testsCorrect, badgeCount });
    const seenOneOff = new Set();
    const spent  = (itemsRes.data || []).reduce((s, r) => {
        if (isOneOffItem(r.item_code)) {
            if (seenOneOff.has(r.item_code)) return s;
            seenOneOff.add(r.item_code);
        }
        return s + itemCost(r.item_code);
    }, 0);
    return { earned, spent, balance: earned - spent };
}

export async function getGardenItems() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from("garden_items")
        .select("id, item_code, col, grid_row, rotation, created_at")
        .eq("user_id", user.id);
    if (error) throw error;
    return data || [];
}

// Plant positions — { word_id, col, grid_row }. A word missing here has no home
// block yet; the garden auto-assigns one and persists it via setPlantPositions.
export async function getGardenPlants() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from("garden_plants")
        .select("word_id, col, grid_row")
        .eq("user_id", user.id);
    if (error) throw error;
    return data || [];
}

/** Upsert one plant's block position. */
export async function setPlantPosition(wordId, col, gridRow) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
        .from("garden_plants")
        .upsert({ user_id: user.id, word_id: wordId, col, grid_row: gridRow },
                { onConflict: "user_id,word_id" });
    if (error) throw error;
}

/** Batch upsert plant positions: [{ wordId, col, gridRow }]. */
export async function setPlantPositions(rows) {
    const user = await getCurrentUser();
    if (!user || !rows?.length) return;
    const payload = rows.map((r) => ({
        user_id: user.id, word_id: r.wordId, col: r.col, grid_row: r.gridRow,
    }));
    const { error } = await supabase
        .from("garden_plants")
        .upsert(payload, { onConflict: "user_id,word_id" });
    if (error) throw error;
}

/** Move/rotate a placed item (or send it back to the tray with null col/row). */
export async function placeGardenItem(id, col, gridRow, rotation = 0) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
        .from("garden_items")
        .update({ col, grid_row: gridRow, rotation })
        .eq("id", id)
        .eq("user_id", user.id);
    if (error) throw error;
}

/** Delete a placed/owned item. Coins refund automatically (balance is derived). */
export async function removeGardenItem(id) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
        .from("garden_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
    if (error) throw error;
}

let gardenPurchaseQueue = Promise.resolve();

/** Buy a shop item. Re-checks balance before inserting. Returns new balance. */
export async function buyGardenItem(itemCode) {
    const purchase = gardenPurchaseQueue.catch(() => {}).then(() => buyGardenItemNow(itemCode));
    gardenPurchaseQueue = purchase.catch(() => {});
    return purchase;
}

async function buyGardenItemNow(itemCode) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const cost = itemCost(itemCode);
    if (cost <= 0) throw new Error("Unknown item");

    const { balance } = await getUserCoins();
    if (balance < cost) throw new Error("Not enough coins");

    if (isOneOffItem(itemCode)) {
        const { data: existing, error: existingError } = await supabase
            .from("garden_items")
            .select("id")
            .eq("user_id", user.id)
            .eq("item_code", itemCode)
            .limit(1);
        if (existingError) throw existingError;
        if ((existing || []).length) throw new Error("Already owned");
    }

    const { data, error } = await supabase
        .from("garden_items")
        .insert({ user_id: user.id, item_code: itemCode })
        .select("id")
        .single();
    if (error) throw error;

    return { balance: balance - cost, id: data?.id };
}

export async function getUserStreak() {
    const user = await getCurrentUser();
    if (!user) return 0;

    const [wordsResult, testsResult] = await Promise.all([
        supabase.from("words").select("created_at").eq("user_id", user.id),
        supabase.from("test_results").select("tested_at").eq("user_id", user.id),
    ]);

    const dates = new Set();
    for (const w of wordsResult.data || []) dates.add(localYMD(new Date(w.created_at)));
    for (const t of testsResult.data || []) dates.add(localYMD(new Date(t.tested_at)));

    if (dates.size === 0) return 0;

    const sorted = [...dates].sort((a, b) => (a < b ? 1 : -1));
    const now       = new Date();
    const today     = localYMD(now);
    const yesterday = localYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak    = 0;
    let cursorYMD = sorted[0];

    for (const date of sorted) {
        if (date === cursorYMD) {
            streak++;
            const [y, m, d] = cursorYMD.split('-').map(Number);
            cursorYMD = localYMD(new Date(y, m - 1, d - 1));
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Daily mission progress. The "done" counts are distinct words answered
 * CORRECTLY today (a wrong answer doesn't advance the goal); the *Acc fields are
 * accuracy over attempts.
 * Returns:
 *   wordsAdded        — words created today
 *   reviewsNewDone    — today's new words reviewed correctly today (test_type 'review')
 *   reviewsCurveDone  — older words reviewed correctly today (test_type 'review')
 *   meaningQuizCount  — today's new words answered correctly in a meaning quiz today
 *   spellingQuizCount — today's new words answered correctly in a spelling quiz today
 *   reviewsNewAcc/reviewsCurveAcc/meaningAcc/spellingAcc — % correct over attempts (null if none)
 *   newDue            — today's new words still due (not yet reviewed)
 *   curveDue          — older words still due, capped at 30
 */
export async function getDailyProgress(userId) {
    if (!userId) {
        const user = await getCurrentUser();
        userId = user?.id;
    }
    if (!userId) return { wordsAdded: 0, reviewsNewDone: 0, reviewsCurveDone: 0, meaningQuizCount: 0, spellingQuizCount: 0, newDue: 0, curveDue: 0, reviewsNewAcc: null, reviewsCurveAcc: null, meaningAcc: null, spellingAcc: null, reviewsNewTries: 0, meaningTries: 0, spellingTries: 0, reviewsCurveTries: 0 };

    const now   = new Date();
    const today = localYMD(now);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [wordsRes, testsRes, dueRes] = await Promise.all([
        supabase.from('words')
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', start)
            .lt('created_at', end),
        supabase.from('test_results')
            .select('word_id, test_type, correct')
            .eq('user_id', userId)
            .gte('tested_at', start)
            .lt('tested_at', end),
        supabase.from('review_schedule')
            .select('word_id, words!inner(created_at, deleted_at)')
            .eq('user_id', userId)
            .lte('next_review_date', today),
    ]);

    const todayWordIds = new Set((wordsRes.data || []).map(w => w.id));
    const wordsAdded   = todayWordIds.size;
    const tests        = testsRes.data || [];

    // Distinct words answered CORRECTLY today — a failed word does NOT count
    // toward a mission's goal, so getting things wrong lowers the numerator and
    // the 85% completion threshold has to be earned.
    const distinctCorrect = (type, pred = () => true) =>
        new Set(tests.filter(t => t.test_type === type && t.correct && pred(t.word_id)).map(t => t.word_id)).size;

    // Missions 2-4 track today's NEW words only (they're gated by mission 1).
    const isToday = id => todayWordIds.has(id);
    const reviewsNewDone    = distinctCorrect('review',  isToday);
    const meaningQuizCount  = distinctCorrect('meaning', isToday);
    const spellingQuizCount = distinctCorrect('spelling', isToday);

    // Mission 5 (the older-word mixed drill) practices each due word in ONE of
    // three modalities, so its progress is distinct OLDER words answered
    // correctly today across review/meaning/spelling combined.
    const isOlder = id => !todayWordIds.has(id);
    const reviewsCurveDone = new Set(
        tests.filter(t => isOlder(t.word_id) && t.correct
            && (t.test_type === 'review' || t.test_type === 'meaning' || t.test_type === 'spelling'))
            .map(t => t.word_id)
    ).size;

    // Today's accuracy per mission scope (over attempts, not distinct words).
    // null when there are no attempts yet, so the UI can hide it.
    const accuracy = (type, pred = () => true) => {
        const rows = tests.filter(t => t.test_type === type && pred(t.word_id));
        return rows.length ? Math.round(rows.filter(t => t.correct).length / rows.length * 100) : null;
    };
    const reviewsNewAcc   = accuracy('review',  isToday);
    const meaningAcc      = accuracy('meaning', isToday);
    const spellingAcc     = accuracy('spelling', isToday);
    // Mission 5 accuracy spans all three modalities on older words.
    const curveRows       = tests.filter(t => isOlder(t.word_id)
        && (t.test_type === 'review' || t.test_type === 'meaning' || t.test_type === 'spelling'));
    const reviewsCurveAcc = curveRows.length
        ? Math.round(curveRows.filter(t => t.correct).length / curveRows.length * 100) : null;

    // Total attempts per mission scope (the denominator behind each accuracy %),
    // surfaced so the mission card can show effort volume ("🎯 88% · 25 tries").
    const tries = (type, pred = () => true) => tests.filter(t => t.test_type === type && pred(t.word_id)).length;
    const reviewsNewTries  = tries('review',  isToday);
    const meaningTries     = tries('meaning', isToday);
    const spellingTries    = tries('spelling', isToday);
    const reviewsCurveTries = curveRows.length;

    // Still-due queues, split new vs curve.
    const due = (dueRes.data || []).filter(r => r.words?.deleted_at == null);
    const newDue   = due.filter(r => localYMD(new Date(r.words.created_at)) === today).length;
    const curveDue = Math.min(30, due.filter(r => localYMD(new Date(r.words.created_at)) !== today).length);

    return {
        wordsAdded, reviewsNewDone, reviewsCurveDone, meaningQuizCount, spellingQuizCount, newDue, curveDue,
        reviewsNewAcc, reviewsCurveAcc, meaningAcc, spellingAcc,
        reviewsNewTries, meaningTries, spellingTries, reviewsCurveTries,
    };
}

/**
 * Per-word attempt counts for TODAY in one modality (test_type), as a
 * Map<word_id, count>. Used to enforce the daily practice cap: a word already
 * quizzed DAILY_QUIZ_CAP times today in a modality drops out of that quiz's
 * deck. Coins are unchanged — there are simply fewer attempts to earn from.
 * See pages/quiz.js.
 */
export async function getTodayAttemptCounts(testType) {
    const user = await getCurrentUser();
    if (!user) return new Map();
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const { data } = await supabase.from('test_results')
        .select('word_id')
        .eq('user_id', user.id)
        .eq('test_type', testType)
        .gte('tested_at', start)
        .lt('tested_at', end);
    const counts = new Map();
    for (const r of (data || [])) counts.set(r.word_id, (counts.get(r.word_id) || 0) + 1);
    return counts;
}

/**
 * Mission completion history for a learner over the last `days` days.
 *
 * Returns one row per day (newest first) with the counts we can reconstruct
 * from history: words added, today's-new-words reviewed/quizzed, and older
 * ("curve") reviews. `coreDone` flags days where the add goal plus all three
 * new-word practice missions were met. The "review older words" mission is
 * omitted from `coreDone` because its due-state can't be reconstructed.
 */
export async function getMissionHistory(userId, days = 14) {
    if (!userId) {
        const user = await getCurrentUser();
        userId = user?.id;
    }
    if (!userId) return [];

    const now       = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    const start     = startDate.toISOString();

    const [wordsRes, testsRes] = await Promise.all([
        supabase.from('words').select('id, created_at').eq('user_id', userId).is('deleted_at', null).gte('created_at', start),
        supabase.from('test_results').select('word_id, test_type, correct, tested_at').eq('user_id', userId).gte('tested_at', start),
    ]);

    const wordsByDay = new Map();   // ymd -> Set(wordId) of words created that day
    for (const w of wordsRes.data || []) {
        const d = localYMD(new Date(w.created_at));
        if (!wordsByDay.has(d)) wordsByDay.set(d, new Set());
        wordsByDay.get(d).add(w.id);
    }

    const testsByDay = new Map();   // ymd -> test rows
    for (const t of testsRes.data || []) {
        const d = localYMD(new Date(t.tested_at));
        if (!testsByDay.has(d)) testsByDay.set(d, []);
        testsByDay.get(d).push(t);
    }

    const out = [];
    for (let i = 0; i < days; i++) {
        const dd  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const ymd = localYMD(dd);

        const newSet     = wordsByDay.get(ymd) || new Set();
        const wordsAdded = newSet.size;
        const dayTests   = testsByDay.get(ymd) || [];

        // Distinct words answered CORRECTLY (matches getDailyProgress).
        const distinct = (type, pred) =>
            new Set(dayTests.filter(t => t.test_type === type && t.correct && pred(t.word_id)).map(t => t.word_id)).size;
        const isNew = id => newSet.has(id);

        const reviewsNew   = distinct('review',   isNew);
        const meaning      = distinct('meaning',  isNew);
        const spelling     = distinct('spelling', isNew);
        // Mission 5 drill: distinct OLDER words correct across all three modalities.
        const reviewsCurve = new Set(
            dayTests.filter(t => t.correct && !isNew(t.word_id)
                && (t.test_type === 'review' || t.test_type === 'meaning' || t.test_type === 'spelling'))
                .map(t => t.word_id)
        ).size;

        // Mirror buildMissions: 85% of each target counts as complete.
        const practiceNeed = missionThreshold(wordsAdded);
        const coreDone = wordsAdded >= missionThreshold(MISSION_NEW_WORDS)
            && reviewsNew >= practiceNeed && meaning >= practiceNeed && spelling >= practiceNeed;

        out.push({
            date: ymd, wordsAdded, reviewsNew, reviewsCurve, meaning, spelling,
            totalTests: dayTests.length,
            hasActivity: wordsAdded > 0 || dayTests.length > 0,
            coreDone,
        });
    }
    return out;
}

/**
 * All active words annotated with SRS review_level + next_review_date, ordered
 * for quiz decks: (1) words added today, (2) due words by level ascending,
 * (3) the rest by next_review_date ascending.
 */
export async function getPrioritizedWords() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const today = localYMD(new Date());

    const [wordsResult, scheduleResult] = await Promise.all([
        supabase.from("words").select("*").eq("user_id", user.id).is("deleted_at", null),
        supabase.from("review_schedule").select("word_id, review_level, next_review_date").eq("user_id", user.id),
    ]);

    if (wordsResult.error) throw wordsResult.error;

    const schedMap = new Map((scheduleResult.data || []).map(s => [s.word_id, s]));
    const words = (wordsResult.data || []).map(w => {
        const s = schedMap.get(w.id);
        return { ...w, review_level: s?.review_level ?? 0, next_review_date: s?.next_review_date ?? today };
    });

    const rank = w => {
        if (localYMD(new Date(w.created_at)) === today) return 0;       // added today
        if (w.next_review_date <= today) return 1;                       // due
        return 2;                                                        // future
    };

    words.sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 2) return a.next_review_date < b.next_review_date ? -1 : 1;
        return a.review_level - b.review_level;
    });

    return words;
}

/**
 * Update the current user's avatar emoji and/or background color.
 * Pass emoji = null/'' to clear it (fall back to the display-name initial).
 * Either argument may be undefined to leave that field unchanged.
 */
export async function updateAvatar(emoji, color) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const patch = { updated_at: new Date().toISOString() };
    if (emoji !== undefined) patch.avatar_emoji = emoji || null;
    if (color !== undefined) patch.avatar_color = color;

    const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);

    if (error) throw error;
    return true;
}

export async function getMasteredCount() {
    const user = await getCurrentUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from("review_schedule")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("review_level", 4);

    if (error) return 0;
    return count || 0;
}

// ============================================================================
// SRS REVIEW COMPLETION
// ============================================================================

export async function completeReview(wordId, correct) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const { data: schedule, error: fetchErr } = await supabase
        .from("review_schedule")
        .select("id, review_level")
        .eq("word_id", wordId)
        .eq("user_id", user.id)
        .single();

    if (fetchErr) throw fetchErr;

    const newLevel = nextLevel(schedule.review_level, correct);
    const { error } = await supabase
        .from("review_schedule")
        .update({
            review_level: newLevel,
            next_review_date: nextReviewDate(newLevel),
            interval_days: intervalDays(newLevel),
            updated_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

    if (error) throw error;
    return newLevel;
}
