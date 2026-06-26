# Word Garden (`#/learner/garden`)

> Detail doc for [CLAUDE.md](../CLAUDE.md). The full-screen 3D voxel garden scene.

Full-screen (minus navbar) **3D scene** rendered with Three.js
(`js/lib/garden3d.js`). Flat colours, **no gradients** — a Minecraft-style grid
of dirt+grass **voxel blocks**, one occupant per block. The renderer is transparent
so the **flat** CSS sky colour on `.garden-fs` shows behind it (sky tint warms
with Gardener rank and goes dark when the 🌙 theme is owned).

## Stored layout (positions are persisted, not derived)

The layout is **authoritative state**, not recomputed from word order. Every plant
and every placeable item remembers a fixed integer `(col, grid_row)`:
- Plant positions live in **`garden_plants`** (`getGardenPlants` / `setPlantPosition(s)`).
  A word with no row there has no home yet → the garden auto-assigns the nearest
  free cell on open and persists it (`onAssignHomes`).
- Placeable items store `col / grid_row / rotation` on their **`garden_items`** row
  (`placeGardenItem`); `col == null` means the item is still in the tray (unplaced).

The rendered field is the **bounding box of all entities + a 2-cell padding ring**
on every side (so there's always room to rearrange); dropping near an edge
auto-grows the field on the next rebuild. World position: `worldX(col)`/`worldZ(row)`
centre the box at the origin. `buildLayout()` rebuilds the dynamic ground+props
groups on every edit (gardens are small; full rebuild is cheap).

## Two layers per block (surface + occupant)

Each block has a **surface** (`grass` default · `road` · `rail` · `water`(pond) ·
`stone`(fountain)) and at most one **occupant** (`plant` · vehicle(`car`/`train`) ·
`structure`). A **car needs a road** under it, a **train needs a rail**; a plant
only grows on grass — so a plant must be **moved before** its block can become a
road/rail. `computeCells(skipRef)` derives the occupancy map for validation/render.

## Placeable playset — Arrange mode

The **Road / Rail / Car / Train** shop items are dragged onto chosen blocks:
- **🛒 Shop → buy** a placeable → it lands in the **tray** (bottom sheet) instead
  of the scene. Roads/rails are cheap, cars/trains pricier; buy as many as you like.
- **✋ Arrange** toggles arrange mode: shows the tray, and makes taps **select/move**
  instead of running review. Drag a tray chip onto a block to place it; drag a
  placed item, a **plant**, or a **structure** to move it; tap a placed item to
  **↻ Rotate** / **🗑 Remove** (remove refunds coins, since the balance is derived).
  Empty-block drags still orbit the camera. Invalid drops show a hint (`onInvalidDrop`).
- **Grabbing is block-cell based** (`occupantAt`), with a sprite raycast tried
  first for roaming vehicles. Raycasting the small, mostly-transparent emoji
  sprite directly was unreliable (a near-miss orbited the camera instead of
  grabbing); the whole 1×1 block under the finger is a big, dependable target, so
  plants and the sprite-less **pond** are easy to move.
- **Roads/rails auto-connect**: adjacent track slabs sit flush and grow centre
  markings / rails toward connected neighbours (straight → corner → cross).
- **Vehicles are voxel 3D models** (`buildCar`/`buildTrain`, flat-colour boxes —
  no external assets) that **drive the connected network**: a car follows **road**
  cells, a train **rail** cells (`trackNeighbours` = graph edges). They **turn to
  face travel** and **arc through corners** — each cell is traversed edge→edge
  (straight = line, corner = quarter-circle arc, dead end = in-and-out); at a
  junction the exit is random, never an immediate reverse unless there's nowhere
  else. Motion state (`vehicleState`, by item id) **persists across rebuilds** and
  is **re-routed** by `reconcileVehicle` when track moves/disappears; dragging a
  vehicle restarts it. Car engine / train whistle (`vehicleSound`) on a per-vehicle
  cooldown while moving (🔊 toggle). Vehicles **freeze in Arrange mode**. Stored
  cell is the *home*; the live driving position is runtime-only.
- **Traffic rules:** cars **keep right** (a `LANE` lateral offset, so opposing
  cars pass on separate sides; trains stay centred on their single rail).
  **Traffic lights** are auto-placed on road junctions with ≥3 arms (`lightCells`,
  voxel `buildTrafficLight`) and flip on a `PHASE_DUR` timer (N–S green ↔ E–W
  green); a car holds at the stop line when its approach axis is red. Cars also
  **queue** behind a same-direction car (per-frame cell occupancy snapshot — no
  head-on deadlock, since opposing traffic is lane-separated) and **slow through
  curves**. NOTE: **level crossings aren't possible** in this grid — one surface
  per block means road and rail cells never share a cell, so they never cross
  (would need a dedicated combined crossing tile). **Train stations** (stop +
  dwell) are not built yet.
- **Structures (pond/fountain/cottage)** have **persisted positions**: each
  remembers `col/grid_row` on its `garden_items` row, auto-assigned
  (`assignStructureHomes`) and persisted on build. Buying one places it live
  (`controller.addStructure`) without reloading, and it's draggable. The cottage
  is now a **voxel house** (`buildHouse`) and the fountain a **voxel fountain**;
  the house's windows **glow at night** (`updateNightGlow` swaps `userData.glow`
  meshes to an emissive material on theme change). Pond stays a flat water tile.
  The gnome still roams freely, ignoring blocks.
- **`rotation` is retired for the UI** — auto-connecting tiles and auto-facing
  vehicles made it do nothing, so the Arrange panel only offers 🗑 Remove (the
  column stays in the DB, harmless).
- **Phasing:** voxel models + driving/turning/arcs + the house + traffic rules
  (lanes, lights, queueing, curve slow-down) are done. **Still to come:** level
  crossings (needs a combined road+rail crossing tile), train stations, and
  voxelising the remaining emoji items (plants with mastery growth stages 0–5,
  gnome, sky critters).

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
