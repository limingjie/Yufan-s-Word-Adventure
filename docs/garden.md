# Word Garden (`#/learner/garden`)

> Detail doc for [CLAUDE.md](../CLAUDE.md). The full-screen 3D voxel garden scene.

Full-screen (minus navbar) **3D scene** rendered with Three.js
(`js/lib/garden3d.js`). Flat colours, **no gradients** — a Minecraft-style grid
of dirt+grass **voxel blocks**, one plant per block. The renderer is transparent
so the **flat** CSS sky colour on `.garden-fs` shows behind it (sky tint warms
with Gardener rank and goes dark when the 🌙 theme is owned).

- **Plants** are billboard sprites on blocks — emoji = SRS stage (`masteryEmoji`),
  bigger as mastered. Due plants droop, desaturate, float a 💧. Tapping a due
  plant runs a **quick inline review right in the popup** (Water it → I knew it /
  Forgot): it calls `completeReview` + `recordTestResult` + `runAfterActivity`,
  then `controller.growPlant()` regrows the sprite and the top-bar counts/wallet
  update live — no jump to the review page. (The top-bar "Review all →" still
  opens a full session.)
- **Top action bar** merges everything: rank + Sunlight, per-mastery counts
  (🌱🌿🌷🌳🏆 from `gardenStats`), the 🪙 wallet, 🛒 Shop, 🔊 music toggle,
  `?` help (a round white circle chip — the shared `.help-btn`), and the
  "💧 N need watering → Review" CTA. (No Add/Quiz buttons here — those are
  reached from the nav tabs / Home; the garden bar is review-focused.)
- **Garden Shop** (bottom sheet) spends coins via `buyGardenItem()`. Items
  **stack** — buy as many butterflies as you can afford (decorations show ×count;
  boosters are one-off). Each purchase adds one instance live
  (`controller.addDecoration`) and persists (`getGardenItems`). Boosters are
  cosmetic only.
- **Critters** (butterflies/bees/bird) wander slowly with random behaviour —
  free flight, landing on a plant, or grouping up — show speech bubbles, and make
  their natural sound on a per-critter cooldown (bees buzz, birds tweet,
  butterflies silent).
- **Audio** (`js/lib/audio.js`): NES-style chiptune loop (4 phrases, ~12s) + a
  buzzing `bee()` and tweeting `bird()` via Web Audio (no files). Starts on first
  tap (autoplay rules); on/off persists in localStorage; 🔊 toggle in the top bar.
- **Help** (`js/lib/help.js`): the `?` button (home + garden) opens a modal
  explaining how Sunlight and Coins are earned.
- **Controls:** pointer-based — 1 finger orbit, 2-finger pinch zoom, tap to
  select, idle auto-spin (no extra addon; avoids a 2nd Three.js copy). Scene is
  disposed + music stopped on navigation (RAF/GL freed) via a `hashchange` listener.

`js/lib/garden.js` still exports `gardenStats(words)` (per-mastery counts).
