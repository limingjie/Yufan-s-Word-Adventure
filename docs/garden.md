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

Each block has a **surface** (`grass` default · `road` · `rail` · `crossing` ·
`fence` · `runway` · `water`(pond) · `stone`(fountain)) and at most one **occupant** (`plant` ·
vehicle(`car`/`bus`/`train`/`privatejet`) · `structure` · `animal`). A **car/bus needs a road** under it, a **train
needs a rail**, and a **private jet needs runway**; a plant only grows on grass — so a plant must be **moved before**
its block can become track/fence. `computeCells(skipRef)` derives the occupancy
map for validation/render. **One surface per block still holds** — road, rail and
fence never share a cell; the **`crossing` tile** is its own surface that *both*
networks treat as drivable (cars/buses: road+crossing; trains: rail+crossing; jets: runway only — see
`carries()`).

## Placeable playset — Arrange mode

The **Road / Rail / Level-Crossing / Fence / Runway Block / Transit Station / Control Tower / Car / Bus / Train / Private Jet** shop items are dragged
onto chosen blocks:
- **🛒 Shop → buy** a placeable → it lands in the **tray** (now a **top sheet**,
  sized to its content so it can't be clipped by iOS/iPadOS browser chrome) instead
  of the scene. Roads/rails/crossings/runways are cheap, vehicles/stations/towers pricier; buy
  as many as you like.
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
- **Roads/rails/fences/runways auto-connect**: adjacent track/fence/runway slabs sit flush and grow
  centre markings, rails or fence rails/posts toward connected neighbours
  (straight → corner → cross). A fence costs **1 coin**, is a normal surface tile,
  and blocks ground-animal movement.
- **Runways** are valid for jets only when they form a **straight connected segment
  of at least 10 runway blocks** (`runwayInfo`). Valid segments draw runway
  threshold/centre markings in either axis and blink edge lights at night.
- **Vehicles are voxel 3D models** (`buildCar`/`buildBus`/`buildTrain`/`buildPrivateJet`, flat-colour boxes —
  no external assets) that **drive the connected network**: cars and the blue bus follow
  **road+crossing** cells, trains **rail+crossing** cells (`carries()` predicate;
  `trackNeighbours` = graph edges). The private jet chooses a valid departure
  runway and an arrival runway/direction, rolls down the runway, climbs into a
  smooth cubic flight path, then aligns to final approach and rolls out on landing;
  short/broken runways leave it parked. Ground vehicles **turn to face travel** and **arc through
  corners** — each cell is traversed edge→edge (straight = line, corner =
  quarter-circle arc, dead end = in-and-out); at a junction the exit is random,
  never an immediate reverse unless there's nowhere else. Motion state
  (`vehicleState`, by item id) **persists across rebuilds** and is **re-routed** by
  `reconcileVehicle` when track moves/disappears; dragging a vehicle restarts it.
  Car/bus engine / train whistle (`vehicleSound`) on a per-vehicle cooldown while
  moving (🔊 toggle). Vehicles **freeze in Arrange mode**. Stored cell is the
  *home*; the live driving position is runtime-only.
- **Level crossings** are a **dedicated `crossing` tile** (its own shop item), so
  Decision #10's one-surface-per-block rule is untouched: a crossing cell renders a
  road slab **and** rails (no tie slab — rails sit in the road), auto-connecting to
  road neighbours on one axis and rail neighbours on the other. It belongs to both
  networks via `carries()`. `buildCrossingSignal` draws two boom gates (one per road
  approach, placed at the right road corner with the crossbucks/lights facing incoming road traffic) that **lower across the road** with flashing
  lamps when a train is on/entering the crossing (`trainAtCrossing`); approaching
  road vehicles hold behind the crossing cell.
- **Traffic rules:** road vehicles **keep right** (a `LANE` lateral offset; trains stay
  centred). **Canada-style traffic lights** (`buildTrafficLight` — four far-side,
  right-corner poles with 3-lamp red/amber/green heads facing incoming traffic and mast arms stretching left over the incoming lane) are auto-placed only on **4-way** road
  junctions (`lightCells`); a state machine (`axisStates`: green→yellow→all-red per
  axis) drives north/south and east/west alternately, and road vehicles hold before the junction unless
  their axis is green (`canGo`). **3-way (T) junctions get three right-side stop signs**
  (`buildStopSign`, `stopCells`) — a one-shot ~0.8 s mandatory halt
  (`signDwell`/`stopAt`) before entering. Road vehicles also **queue** behind a
  same-direction vehicle (per-frame occupancy snapshot) and **slow through curves**.
- **Transit stations** (`buildStation`, a placeable that needs an **adjacent rail or
  road**) auto-rotate to face the neighbouring transit cell. They mark neighbouring
  rail cells (`stationRailCells`) for trains and road cells (`stationRoadCells`) for
  buses; trains dwell ~2.5 s and buses ~2.0 s (`st.dwell`) then continue.
- **Structures (pond/fountain/cottage)** are **unlimited** (buy as many as you like;
  they stack) with **persisted positions**: each remembers `col/grid_row`,
  auto-assigned (`assignStructureHomes`) and persisted on build. Buying one places
  it live (`controller.addStructure`) without reloading, and it's draggable. All are
  voxel models (`buildHouse`/`buildFountain`/`buildPond` — pond = water tile + lily
  pads); the house/station windows **glow at night** (`updateNightGlow` swaps
  `userData.glow` meshes). The gnome and **roaming animals** walk freely, ignoring
  blocks.
- **Control Tower** is a premium placeable airport structure (`tower: true`) that
  needs an empty grass block. Its tall voxel cabin and beacon turn on at night.
- **`rotation` is retired for the UI** — auto-connecting tiles and auto-facing
  vehicles made it do nothing, so the Arrange panel only offers 🗑 Remove (the
  column stays in the DB, harmless).

- **Plants** are **voxel growth-stage models** (`buildPlant(level)`, group tagged
  `userData.wordId`) — 6 stages mapped to SRS mastery (seed → sprout → flowering
  bush → big flower → blossoming tree → golden tree), each with vivid bloom dots so
  it stands out from the grass. Due plants **droop** (tilt) and float a 💧. Tapping
  a due plant runs a **quick inline review right in the popup** (Water it → I knew
  it / Forgot): it calls `completeReview` + `recordTestResult` + `runAfterActivity`,
  then `controller.growPlant()` swaps in the next voxel stage with a pop and the
  top-bar counts/wallet update live — no jump to the review page. (The top-bar
  "Review all →" still opens a full session.)
- **Top action bar** merges everything: rank + Sunlight, per-mastery counts
  (🌱🌿🌷🌳🏆 from `gardenStats`), the 🪙 wallet, 🛒 Shop, 🔊 music toggle,
  `?` help (a round white circle chip — the shared `.help-btn`), and the
  "💧 N need watering → Review" CTA. (No Add/Quiz buttons here — those are
  reached from the nav tabs / Home; the garden bar is review-focused.)
- **Garden Shop** (bottom sheet) spends coins via `buyGardenItem()`, laid out as a
  **card grid grouped by category** (`cat`: playset · structures · animals · decor ·
  themes). Items **stack** — buy as many as you can afford (decorations show ×count;
  themes/boosters/gnome are one-off). Each purchase adds one instance live and
  persists (`getGardenItems`): structures via `addStructure`, placeables to the
  tray, animals/critters/gnome via `addDecoration`. Boosters are cosmetic only.
- **Ground animals** (cat/dog/rabbit/chicken/pig/cow/deer/bear — `buildAnimal`) are
  voxel models with **persisted home cells** in `garden_items`. Existing animal
  purchases with no position are auto-assigned a free grass home and saved; new
  animals are auto-placed live when bought. In Arrange mode, animals can be
  selected/moved/removed like other positioned items. Animal homes are **soft**:
  if a plant/surface/item takes an animal's saved home block, the animal is
  automatically re-homed to the nearest free grass block and persisted. Their live
  walking position is runtime-only: `pickWalkerTarget` flood-fills the connected
  non-fence region containing the home cell, and the per-frame walker guard
  rejects entering fence cells or leaving that region. The gnome still roams
  freely and sleeps at the cottage at night.
- **Critters** (butterflies/bees/bird — voxel `buildCritter`, wings flap via
  `userData.wing`) wander slowly with random behaviour —
  free flight, landing on a plant, or grouping up — show speech bubbles, and make
  their natural sound on a per-critter cooldown (bees buzz, birds tweet,
  butterflies silent).
- **Audio** (`js/lib/audio.js`): NES-style chiptune loop (4 phrases, ~12s) + a
  buzzing `bee()` and tweeting `bird()` via Web Audio (no files). Starts on first
  tap (autoplay rules); on/off persists in localStorage; 🔊 toggle in the top bar.
- **Help** (`js/lib/help.js`): the `?` button (home + garden) opens a modal
  explaining how Sunlight and Coins are earned.
- **Controls:** pointer-based — 1 finger orbit, 2-finger pinch zoom, mouse-wheel
  zoom, tap to select, idle auto-spin (no extra addon; avoids a 2nd Three.js
  copy). Wheel/pinch zoom anchors to the pointer or pinch midpoint, so the garden
  can zoom toward any field area instead of only the scene centre. Scene is
  disposed + music stopped on navigation (RAF/GL freed) via a `hashchange` listener.

`js/lib/garden.js` still exports `gardenStats(words)` (per-mastery counts).
