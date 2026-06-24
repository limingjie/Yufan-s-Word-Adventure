// ============================================================================
// audio.js — old-school Nintendo-style chiptune (Web Audio, no files/deps)
// ============================================================================
// A square-wave lead + triangle bass loop (4 phrases, ~12s), plus critter
// sounds: a buzzing bee and a tweeting bird. Browser autoplay rules mean sound
// can only start inside a user gesture, so call ensureStarted() from a tap. The
// on/off preference persists in localStorage; default ON.

const LS_KEY = 'gardenMusicOn';

let ctx = null;
let master = null;
let musicGain = null;
let playing = false;
let timer = null;
let nextTime = 0;
let step = 0;

// Semitone offsets from A4 (0 = 440Hz); null = rest. Four 16-step phrases.
const LEAD = [
    // A — statement
    7, 7, 12, 7,  5, 4, 0, null,   7, 9, 12, 14,  12, 9, 7, null,
    // B — answer, a step down
    5, 5, 9, 5,   4, 2, -3, null,  5, 7, 9, 11,   9, 7, 5, null,
    // C — lift, higher register
    12, 12, 16, 12, 11, 9, 7, null, 12, 14, 16, 19, 16, 14, 12, null,
    // D — resolve home
    7, 4, 7, 9,   11, 9, 7, 4,    5, 7, 9, 7,    5, 4, 0, null,
];
const BASS = [
    -12, null, -12, null, -7, null, -7, null,  -5, null, -5, null, -7, null, -7, null,
    -14, null, -14, null, -9, null, -9, null,  -10, null, -10, null, -7, null, -7, null,
    -12, null, -12, null, -5, null, -5, null,  -7, null, -7, null,  -5, null, -5, null,
    -12, null, -7, null,  -5, null, -8, null,  -10, null, -7, null, -12, null, -12, null,
];
const STEP_DUR = 0.19;

function on() { return localStorage.getItem(LS_KEY) !== 'off'; }
function setOn(v) { localStorage.setItem(LS_KEY, v ? 'on' : 'off'); }
export function isOn() { return on(); }

function freq(semi) { return 440 * Math.pow(2, semi / 12); }

function ac() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        musicGain = ctx.createGain();
        musicGain.gain.value = 0.16;
        musicGain.connect(master);
    }
    return ctx;
}

function ready() { return on() && ctx && ctx.state === 'running'; }

function blip(time, f, dur, type, dest, peak = 0.5) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(dest);
    o.start(time); o.stop(time + dur + 0.02);
}

function scheduler() {
    while (nextTime < ctx.currentTime + 0.12) {
        const lead = LEAD[step % LEAD.length];
        const bass = BASS[step % BASS.length];
        if (lead != null) blip(nextTime, freq(lead + 12), STEP_DUR * 0.9, 'square', musicGain, 0.5);
        if (bass != null) blip(nextTime, freq(bass), STEP_DUR * 1.6, 'triangle', musicGain, 0.6);
        nextTime += STEP_DUR;
        step++;
    }
}

export function startMusic() {
    if (playing || !on()) return;
    ac();
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(scheduler, 25);
}

export function stopMusic() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
}

/** Call inside a user gesture; starts music if the preference is ON. */
export function ensureStarted() {
    if (on()) startMusic();
}

/** Toggle the preference; returns the new on/off boolean. */
export function toggle() {
    const next = !on();
    setOn(next);
    if (next) { ac(); if (ctx.state === 'suspended') ctx.resume(); startMusic(); }
    else stopMusic();
    return next;
}

// ── Critter sounds ───────────────────────────────────────────────────────────

// Bee: a low sawtooth "bzzz" with fast vibrato.
function bee() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 150;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 28;          // wing-beat flutter
    lfoG.gain.value = 22;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.04);
    g.gain.setValueAtTime(0.1, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(master);
    o.start(t); lfo.start(t);
    o.stop(t + 0.52); lfo.stop(t + 0.52);
}

// Bird: two or three quick rising "tweet" chirps.
function bird() {
    const t = ctx.currentTime;
    const tweet = (start, f0, f1) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(f0, start);
        o.frequency.exponentialRampToValueAtTime(f1, start + 0.09);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(0.16, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
        o.connect(g); g.connect(master);
        o.start(start); o.stop(start + 0.14);
    };
    tweet(t, 2100, 3100);
    tweet(t + 0.16, 2500, 3500);
    if (Math.random() < 0.6) tweet(t + 0.32, 1900, 2700);
}

function genericChirp() {
    const t = ctx.currentTime;
    blip(t, freq(19), 0.08, 'square', master, 0.18);
    blip(t + 0.08, freq(24), 0.08, 'square', master, 0.18);
}

/** Play a critter's natural sound. kind: 'bee' | 'bird' | 'butterfly' | other. */
export function creatureSound(kind) {
    if (!ready()) return;
    if (kind === 'bee') bee();
    else if (kind === 'bird') bird();
    else if (kind === 'butterfly') { /* butterflies are silent */ }
    else genericChirp();
}
