# Lift Log spec

Where the app spec and the technical reference disagree, the app spec wins.

## App spec

### PURPOSE: a free, offline training log for lifting and running that anyone can
install. Main job: visualizing progress over time. Logging is a quick
check-off of a pre-filled session, usually right after training. iPhone,
installed PWA, fully offline. Each person's data stays on their own device.

### OVERRIDES OF THE TECH REFERENCE: store lb (no kg toggle); own tiny hash
router; hand-rolled SVG charts; repo lift-log, base /lift-log/, never rename;
no rest timer and no wake lock.

### FIRST LAUNCH: seed only generic data, editable or deletable in the app:
- Exercise library: squat, pause squat, bench press, deadlift, overhead press,
  row, incline DB curl, hammer curl, pull-up drop set, pull-up negative,
  hanging leg raise, dead hang, run. Main lifts: squat, bench, deadlift, OHP.
- One example routine, "Example · Full body", with no weekday: squat 3x5;
  bench 3x5; row 3x8.
- One example quick-add, "Warm-up": 5 min easy cardio; dynamic stretching; 2
  ramp-up sets.
- Default settings.
No real person's plan, numbers or dates anywhere in the code. On a day with no
routine, Home shows "Nothing planned today" plus Log anyway.

### PROGRAM FILE: Settings has Import program and Export program. A program file
is JSON, {"kind": "lift-log-program", "version": 1, ...}, holding exercises,
routines, quick-adds, habits, calendar rows and settings rules, with no
sessions, sets, maxes, bodyweight or photos. Import validates the file, shows
a preview, then merges or replaces with a confirm. Replacing archives old
routines and exercises instead of deleting them, and never touches logged
data. Document the format in SPEC.md with a made-up example.

### ROUTINE FEATURES (stored as editable rows; logic never hard-codes a routine)
Lifts: sets, reps or a rep range, superset a/b, and optional derived weight
(a percent of a source exercise's latest weight in a source routine, rounded).
Assisted drop sets: target total reps per set; log strict reps, the rest are
banded. Negatives: sets and reps. Holds: seconds.
Runs: distance (mi) + time, with an optional distance progression (start, step,
every N weeks, from date, cap). Interval reps: distance (m), default count,
target time range, time per rep, free-text extra work. A routine can be marked
as a test.
Routines are fully editable in the app: create, rename, delete, reorder
exercises, change sets/reps/increments, assign a weekday.

### QUICK-ADDS (editable; any routine can also be quick-added)
A named block: a routine, exercise items, or checklist lines.

### PROGRESSION RULES (pure functions, unit-tested)
Auto-increase: global switch + per-exercise switch. When on: next target =
last weight in the same routine + incrementLb if every set hit target reps
AND effort <= 8 (no effort = fine); else hold. Rep-range lifts: add reps until
all sets hit repMax, then +increment, reset to repMin. Default increments:
squat 5, bench 5, deadlift 10, OHP 5, row 5, curls 2.5. Barbell rounds to 5
lb, dumbbells to 2.5.
Derived lifts follow their source, rounded. Stall: missed reps 2 weeks
running -> banner suggesting -10% (accept/dismiss).
e1RM = weight x (1 + reps/30), sets of <= 10 reps only.

### TROPHIES (Home, v1)
Main lifts: squat, bench, deadlift, OHP. Score = best e1RM / 7-day average
bodyweight (fallback: latest weigh-in; none -> show e1RM and "Add bodyweight
to rank"). Tiers (x bodyweight), editable in Settings:
squat 1.00/1.25/1.50/1.75/2.00; bench 0.75/1.00/1.25/1.50/1.75; deadlift
1.25/1.50/1.75/2.00/2.50; OHP 0.50/0.60/0.75/0.90/1.05 for
Bronze/Silver/Gold/Platinum/Diamond. Below Bronze = "Unranked". These are rough
rules of thumb, not population data.
Each trophy: tier color + tier name + e1RM + ratio + bar with "N lb to <next
tier>". Tap -> that lift's chart. Tier-up: one short shimmer. Tier colors
come from DESIGN.md.

### BODYWEIGHT CHART (v1)
Main: 7-day rolling average, 3 px, accent color, monotone-cubic smoothing
between real averages (never invent values). Toggle "Show weigh-ins"
(remembered): 1 px line + small dots of actual entries at ~25% opacity behind
the average. Ranges 4W/3M/All, scrub shows date + weigh-in + average, "change
since start" above.

### FEATURES BY RELEASE
v1: log today (pre-filled, tap set or exercise = done as planned, steppers
with press-and-hold, add/skip/remove set, swap exercise, start empty), quick-
add, routine/exercise/quick-add editors, per-workout duration (editable) +
optional calories, finish summary (time, calories, volume, sets, PRs, optional
effort 1-10 on the Apple Fitness scale, optional pain flag and note), auto-
increase, undo toasts, typo guard (> 1.5x target or > 500 lb -> inline "Did
you mean...?"), draft saved on every tap, History with editing, progress
charts (per lift top set + e1RM; pull-ups; dead hang; run distance by routine;
timed test runs; weekly volume; 4W/3M/All; scrub; gaps shown across breaks > 3
weeks), trophies, bodyweight page, export JSON + CSV, import (validate; merge
or replace with confirm), program file import/export, Paste log, backup banner
when last export > 7 days, storage status.
v1.1: daily habits (seed: Mobility, Protein target, Sleep 8+ h, Water;
add/rename/reorder/archive in app; streaks), calendar heatmap, plate calculator
(plates owned in Settings), PR feed.
v2: progress photos (front/side/back, compressed JPEG Blobs, compare two
dates, never in JSON export, separate photo export as zip via share sheet),
calendar (editable rows, in Settings and the program file, with no dates in
code: named phases with dates and a phase banner; test days; deload weeks with
a percent lighter and one fewer set; routine swaps on a repeating schedule),
optional trophy line "percentile vs adult drug-tested powerlifters" (attributed
CC BY 4.0 study).

### DATA MODEL (Dexie tables and fields)
exercises: id, name, kind (barbell|dumbbell|bodyweight|hold|run|checklist),
incrementLb, roundToLb, repMin?, repMax?, autoIncrease, derivedFrom?
{exerciseId, routineId, pct}, isMain (gets a trophy), archived. Archived
exercises keep their history.
routines: id, name, weekday?, order, isTest?, distanceProgression? {startMi,
stepMi, everyWeeks, fromDate, capMi}, archived, items[] {exerciseId, sets,
reps, repsMax?, superset? a|b}.
quickAdds: id, name, order, source: routineId | items[] | checklist lines.
sessions: id, date (local YYYY-MM-DD), routineId?, status (draft|done),
startedAt, endedAt, durationMin, calories?, effort? 1-10, painFlag, note.
sets: id, sessionId, exerciseId, order, setNo, targetWeightLb, targetReps,
weightLb, reps, strictReps?, band?, holdSec?, distanceM?, timeSec?, done,
skipped. Runs and interval reps live here too (distance + time).
maxes: id, exerciseId, date, weightLb, tested. Real 1RM attempts.
bodyweight: id, date (unique), weightLb.
habits: id, name, order, archived. habitLogs: [date+habitId], done. (v1.1)
calendar: id, type (phase|test|deload|swap), name, startDate, endDate?,
routineId?, pct?, fewerSets?, everyWeeks? (v2)
photos: id, date, pose, image Blob (JPEG 1600 px), thumb Blob (320 px). (v2)
settings: autoIncreaseGlobal, rules {stallWeeks 2, deloadPct 10, maxEffort 8},
trophyTiers, platesOwned, lastExportAt, unit "lb".

### SCREENS: tabs Home · Progress · History · Settings. Log is a full-screen
sheet. Settings ends with a small "Components" link to the kitchen-sink page.

### STATES: primitives reused everywhere (from DESIGN.md). Same SetRow in
logging, editing and history. Empty states name the next action. Errors say
what failed, whether data is safe, and what to do. Dates like "Fri Oct 17".
Only bulk destructive actions get a confirm; everything else gets Undo.

### DESIGN SKILLS (for CLAUDE.md)
- apple-design and impeccable live in .claude/skills/. They are advisors:
  DESIGN.md wins any conflict.
- Never run /impeccable teach or init (they write their own DESIGN.md),
  overdrive or delight. bolder, quieter and live only when I ask, during a
  tune step, and DESIGN.md gets updated to match what I keep.
- design/inspiration/ (screenshots + TASTE.md) is for design prompts only;
  never commit it.
- Ignore Impeccable's system-font rule: SF Pro is a deliberate choice.
- Skill findings that are bugs (contrast, tap targets, broken states,
  anything that doesn't match DESIGN.md) get fixed in the same session.
  Taste suggestions go in a "Design ideas" list in the PR description,
  never straight into code.

### NON-NEGOTIABLES (for CLAUDE.md)
1 Every Dexie change = version bump + migration + upgrade test; never drop or
rename a table or field that holds data.
2 Never rename the repo or change base path / start_url / scope.
3 No network calls at runtime; no CDNs; no analytics.
4 Every data-changing tap writes to IndexedDB immediately.
5 Progression, e1RM, trophies, stall, derived lifts, paste-log parser, program
file and migrations have Vitest tests; run them before every push.
6 Components never touch Dexie directly; go through src/db.
7 Update SPEC.md (and DESIGN.md for look changes) in the same commit when
behavior changes.
8 Public repo: never commit personal data or a real person's training plan
(names, age, school, sport, health notes, body stats, weights, history,
photos, exports, schedules). This covers files, commit messages and PR
descriptions. Personal data enters only through the app on the device.
9 DESIGN.md beats the design skills. Never run /impeccable teach.
10 private/ is gitignored personal material. Read it only when I ask in that
session, and never copy anything from it into committed files, commit messages
or PRs.
11 Sample data in committed files is always made up: DESIGN.md, the
kitchen-sink page, tests, fixtures and screenshots.
12 Name exports lift-log-backup-YYYY-MM-DD.json/.csv and the photo export
lift-log-photos-YYYY-MM-DD.zip, so .gitignore catches them.

## Technical reference

### Goals and constraints
- Client-side only: each person's data stays on their own device. No backend, no accounts, no analytics, no network calls at runtime.
- Must run entirely on an iPhone as an installed PWA (Safari → Add to Home Screen) and work fully offline.
- Hosted as static files on GitHub Pages from the public repo `lift-log` (URL `https://<username>.github.io/lift-log/`). The host only serves files; it never holds user data.
- The repo is public: never commit personal data (weights, history, photos, exports, health notes). Personal data enters only through the app on the phone. Also never commit `design/inspiration/` (other apps' screenshots and TASTE.md, used only for design prompts); it is gitignored.
- Apple Health / HealthKit is NOT accessible from a web app. Do not attempt it. Keep the export format clean and versioned so a future bridge (e.g., an Apple Shortcut or a native app) could consume it.

### Stack
- Vite + Svelte 5 (runes: `$state`, `$derived`, `$effect`) + TypeScript. Plain Vite + Svelte, NOT SvelteKit.
- Data: IndexedDB via Dexie. Use Dexie's `liveQuery` for reactive queries, wrapped in a small helper that exposes results to Svelte 5 state. Do NOT use localStorage for workout data (only trivial UI prefs like theme, a chart toggle, or the dev-only Tweaks panel values).
- PWA: `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`, precache all build assets so the app works fully offline. Web manifest: name, short_name, `display: 'standalone'`, theme/background colors, icons (192, 512, plus maskable, plus 180 apple-touch), `start_url` and `scope` set to `/lift-log/`.
- Navigation: a tiny custom hash-based router (own code, no router library) so refreshes never 404 on static hosting.
- Charts: hand-rolled SVG Svelte components (no chart library). Keep the bundle small.
- Icons: Lucide (Svelte package). The trophy is one custom glyph drawn at the same stroke weight. Do not use Apple SF Symbols; licensing prohibits web use.
- Tests: Vitest.

### Data model guidelines
- Tables (full field list in the APP SPEC): exercises, routines, quickAdds, sessions, sets, maxes, bodyweight, habits, habitLogs, calendar, photos, settings.
- IDs: `crypto.randomUUID()`. Timestamps as epoch ms; dates as local `YYYY-MM-DD`; display in local time.
- Store weights in **lb** (canonical). No kg toggle: kg storage causes rounding drift (135 lb → 134.99).
- Dexie schema with explicit version numbers and migrations. Never ship a change that could orphan or drop existing data. Never rename or delete a table or field that holds data; add new fields with defaults.
- Every schema change ships with a Vitest test that builds a database at the previous version, upgrades it, and checks that nothing was lost.
- Include `schemaVersion` in the export format.

### Persistence and storage durability
iOS/Safari can evict site storage, and users can clear website data, so protect data in layers:
1. Call `navigator.storage.persist()` (Storage API / StorageManager; returns `Promise<boolean>`) after the first meaningful user action (the first finished workout), not on page load. Feature-detect (`navigator.storage?.persist`). A `false` result is normal on iOS; never block on it.
2. Use `navigator.storage.persisted()` and `navigator.storage.estimate()` to show a small status row in Settings (persistent: yes/no, approximate usage, and photo storage once photos exist).
3. **Export**: full JSON backup (with `schemaVersion` and export date, photos excluded), plus CSV of sets. Photos get their own export (zip via the share sheet, v2). **Import**: validate the file, then offer merge or replace with explicit confirmation before overwriting anything.
4. Show a backup banner on Home when the last export is more than **7 days** old. On iOS, deliver exports via the Share sheet / file download so they can be saved to Files or iCloud Drive.
- An installed Home Screen app has its own storage, separate from the Safari tab. Data created in Safari before installing does not carry over, so install first, or use Export/Import.
- Storage is tied to the origin. The deployed URL must never change once in use: do not rename the repo or change the base path.

### Offline and updates
- Precached app shell; no runtime dependency on a CDN (self-host fonts and libraries).
- `autoUpdate`, but apply the new version on next launch or via a small non-intrusive "Updated – tap to reload" toast, so an in-progress log is never interrupted.
- Never put user data in the service worker cache. All user data lives in IndexedDB.

### GitHub Pages deployment
- Set Vite `base: '/lift-log/'` and make sure the manifest `start_url`, `scope`, and icon paths agree with it. Do not rename the repo later (it changes the origin and orphans the stored data).
- Use a GitHub Actions workflow (`.github/workflows/deploy.yml`): checkout → setup-node → `npm ci` → `npm test` → `npm run build` → `actions/configure-pages` → `actions/upload-pages-artifact` (path `dist`) → `actions/deploy-pages`. Repo Settings → Pages → Source: "GitHub Actions". Needs `pages: write` and `id-token: write` permissions. Deploy on pushes to `main`.
- A public repo is free for Pages. The source code is public, so no secrets and no personal data in the repo.
- Verify with `npm run preview`, then test installability, offline mode, and persistence on a real iPhone (service workers and install behavior can't be fully validated on desktop).

### iOS-specific PWA details
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<link rel="apple-touch-icon" href="...180x180.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` (or `default`; test), `<meta name="theme-color">` for light and dark via media attributes.
- Respect safe areas with `env(safe-area-inset-*)` for the top bar, bottom tab bar, and sheets.
- Inputs: font-size at least 16px (prevents iOS zoom on focus). Prefer steppers; where typing is needed, use `inputmode="decimal"` / `"numeric"`.
- Touch targets at least 44x44px. Mobile-first. No hover-only interactions.
- Save every data-changing tap to IndexedDB immediately (logs are saved as drafts), so nothing is lost if the app is backgrounded or killed.
- Global CSS: `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `overscroll-behavior: none` on the app shell, `user-select: none` on UI chrome (keep text selectable only where useful), `-webkit-touch-callout: none` on buttons.
- No rest timer and no screen wake lock: the app is for logging and viewing progress, not live coaching.

### Design: make it feel premium
The look comes from DESIGN.md (written from the Claude Design handoff). It is the source of truth for colors, type, spacing, radii and components. The principles below apply where DESIGN.md is silent. Design skills (apple-design, Impeccable) are advisors: when one conflicts with DESIGN.md, DESIGN.md wins.

**Typography**
- System font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` (SF Pro on iOS; no font download). This is a deliberate choice for native feel; ignore tooling that flags system fonts as generic. Numerals per DESIGN.md (SF Pro Rounded via `ui-rounded`, or SF Pro).
- A type scale (e.g., Large Title 34, Title 22–28, Headline 17 semibold, Body 17, Callout 16, Footnote 13, Caption 12, plus a Big Number size), in rem units.
- `font-variant-numeric: tabular-nums` on all numbers (weights, reps, totals) so digits don't jitter. Key numbers are big and bold; they're the hero of this app and must be readable at arm's length in dim light.
- Tight letter-spacing on large titles (about -0.02em). Limit to 2–3 font weights.

**Color and surfaces**
- Design tokens as CSS custom properties (`src/styles/tokens.css`): background, secondary background, surface, text, secondary text, separator, one accent, PR color, destructive red, and the five trophy tier colors. One accent; neutrals do the rest. Tier colors appear only on trophies.
- Full dark mode via `prefers-color-scheme` (default to system), near-black background in dark mode, layered surfaces. All text passes WCAG AA (4.5:1).
- Grouped, inset lists (iOS Settings style), with one group per exercise and never a card per set or cards inside cards. Consistent radii, hairline separators, no heavy borders. No gradients, glow or emoji anywhere.
- Translucent material only on the tab bar: `backdrop-filter: blur(20px) saturate(180%)` with a semi-transparent background (include the `-webkit-` prefix).

**Layout**
- 4/8pt spacing grid; consistent horizontal margins (16–20px).
- Bottom tab bar: Home · Progress · History · Settings. Logging is a full-screen sheet. Bottom sheets (grab handle, drag-to-dismiss, backdrop dim) for add/edit flows.
- One primary action per screen, thumb-reachable.

**Motion**
- Spring physics, not linear timing: `svelte/motion` (`spring`, `tweened`), `svelte/transition` (`fly`, `fade`, `scale`, `slide`), `animate:flip` for reordering. View Transitions API where supported (progressive enhancement).
- Most transitions 200–300ms. A set tap shows its check in under 100ms; animation confirms, never delays. Gestures track the finger 1:1.
- Press states: scale to about 0.96–0.98 on `:active`.
- Charts draw in; a PR or trophy tier-up gets one short, restrained moment (pulse or shimmer), not confetti.
- Honor `prefers-reduced-motion` by swapping to simple fades.

**Haptics and feedback**
- Skip haptics: iOS Safari does not support `navigator.vibrate`, and the known workarounds are unreliable. Use strong visual feedback instead (press states, animated checks).

**Tuning (dev-only Tweaks panel)**
- At the top of `#/kitchen-sink`: a control for every token in `tokens.css` that is a taste decision (numeral font, big-number size, accent, background warmth, radius, set-row height, chart line weight, motion speed).
- Changes apply app-wide through CSS variables and are stored in localStorage only, never Dexie. The panel has Reset and "Copy values" (only the changed tokens, as CSS).
- Copied values get locked into `tokens.css` and DESIGN.md in the next session, then the panel is reset. The panel never ships as a user feature; it stays behind Settings → Components.

**Details that signal quality**
- Empty states: one plain sentence plus a clear next action, no motivational copy. No spinners (data is local, so loads should be near-instant).
- Undo toasts instead of "Are you sure?" dialogs; confirm only bulk destructive actions (import-replace, delete all).
- Smart defaults: sets pre-filled from the plan, steppers with press-and-hold acceleration.
- Typo guard: a weight over 1.5× the target or over 500 lb shows an inline "Did you mean…?".
- Launch: matching background color so there's no white flash; a simple, bold app icon glyph (no text).
- Charts: minimal (faint axis, no gridlines), accent color for the main series, smooth monotone interpolation between real values only, gaps across breaks longer than 3 weeks, tap-and-drag scrub with date + value.
- Accessibility: semantic HTML, labels on icon buttons, visible focus states, sufficient contrast, scalable text.
- Consistency over novelty: same radii, spacing, icon stroke width and animation curves everywhere. The same SetRow is used in logging, editing and history.

### Code organization
- `src/db/` (Dexie schema, migrations, queries, seed), `src/features/` (log, routines, progress, trophies, body, history, habits, settings), `src/components/` (design-system primitives: Button, Stepper, SetRow, Sheet, ListRow, Toast, Banner, EmptyState, SegmentedControl, TabBar, Trophy, ChartCard), `src/styles/` (tokens.css, global.css), `src/lib/` (export/import, paste-log parser, progression math, units, dates), `src/pwa/` (registration, update toast).
- TypeScript throughout. Components never talk to Dexie directly; they go through `src/db`.
- Progression rules, e1RM, trophy tiers, stall rule, derived lifts, the paste-log parser and migrations are pure functions with Vitest tests.
- Build the design-system primitives first (shown on a `#/kitchen-sink` page linked from Settings, with the Tweaks panel at the top), then the features on top, so the whole app inherits the same look.

## Data layer reference

How `src/db` and `src/lib` read the spec where it left room. Screens call `api` from `src/db`; the pure rules live in `src/lib`.

### Storage details
- Schema versions live in `SCHEMA_VERSIONS` (`src/db/schema.ts`). Version 1 declares every table above. Settings is one row under the key `app`. Booleans are not indexed (IndexedDB can't index them); lists filter in memory.
- Upgrade tests use `upgradeTest({ from, write, check })` from `src/db/upgrade-harness.ts`: build the database at the previous version, write rows, reopen at the latest version, and check nothing was lost (see `schema.upgrade.test.ts`).
- `settings.trophyTiers` is keyed by exercise id. The seed fills in the four main lifts.
- Run distances are stored in meters (`distanceM`); routines and the UI talk in miles. Hold exercises use a routine item's `reps` as seconds. Interval reps are a run item with `sets` = default count, `distanceM` per rep, and optional `targetTimeSec`/`targetTimeMaxSec` and `note` (extra work).
- Deleting a routine or exercise means archiving it (`archived: true`), so history keeps its names.

### Pre-fill and progression
- `startSession(date, routineId)` returns the existing draft for that date and routine, or creates one. Each planned set starts with its actual values equal to its targets, so tapping it means "done as planned".
- "Last weight in the same routine" means the heaviest done set of the exercise in the latest finished session of that routine. With no history in that routine, the latest weight from any routine is used and held (never increased). With no history at all, the weight is left blank.
- "Every set hit target reps" means every set was done, not skipped, with reps >= its target reps. Effort is the finished session's effort.
- Rep ranges come from the routine item (`reps`..`repsMax`), else from the exercise (`repMin`..`repMax`). Under the same gate as auto-increase, the target goes up one rep per session until it reaches repMax; after a session with every set at repMax, the weight goes up by incrementLb and the reps reset to repMin. A miss holds both. Bodyweight lifts with no weight stay at repMax.
- Derived lifts use `pct` as a percent (80 = 80%) of the source exercise's heaviest done set in its latest finished session of the source routine, rounded to the derived exercise's `roundToLb`. With no source history they fall back to their own progression.
- Stall: weeks run Monday to Sunday, and a week counts as missed when the exercise's last session that week missed reps. A stall means `rules.stallWeeks` consecutive missed weeks ending with the latest session's week. The suggestion is the last weight minus `rules.deloadPct`, rounded. `api.stallStatus(exerciseId, routineId?)` returns it; accepting or dismissing is up to the screen.
- Run distance progression: `startMi` before and during the first `everyWeeks` weeks from `fromDate`, then `+ stepMi` every `everyWeeks` whole weeks, never past `capMi`.
- Quick-add checklist lines become sets of a `checklist` exercise with the same name, created on first use.
- Calendar swaps and deloads (v2) don't change `routineForDate` or pre-fill yet.

### Backup file (JSON) and CSV
- `exportJson()` gives `{"kind": "lift-log-backup", "schemaVersion": 1, "exportedAt": <epoch ms>, "data": {exercises, routines, quickAdds, sessions, sets, maxes, bodyweight, habits, habitLogs, calendar, settings}}`. Photos are never included. Exporting JSON sets `settings.lastExportAt`; CSV does not, since it isn't a full backup.
- `exportCsv()` has one row per set: `date, routine, exercise, sessionStatus, setNo, targetWeightLb, targetReps, weightLb, reps, strictReps, band, holdSec, distanceM, timeSec, done, skipped`.
- Import validates first: the kind, a schemaVersion no newer than the app's, every row's required fields, exercise kinds, that every set's session is in the file, and one bodyweight entry per date. An invalid file changes nothing.
- Merge: rows from the file win on the same id (bodyweight: on the same date); the device keeps its own settings. Replace: clears every table except photos, then loads the file, including its settings.
- File names come from `backupFileName()`: `lift-log-backup-YYYY-MM-DD.json/.csv`. The program file uses `lift-log-backup-program-YYYY-MM-DD.json`, so .gitignore catches it too.

### Program file format
A program file is the plan without the history. It holds exercises, routines, quick-adds, habits, calendar rows and `settings` (`autoIncreaseGlobal`, `rules`, `trophyTiers`). It never holds sessions, sets, maxes, bodyweight, habit logs or photos, and a file that contains any of those is rejected.

- Export includes active routines, every active exercise plus any archived one that an exported routine, quick-add or derived lift uses, all quick-adds, active habits, all calendar rows, and trophy tiers for the exported exercises.
- Validation checks the shape of every row and that every reference (routine items, `derivedFrom`, quick-add sources, calendar `routineId`, `trophyTiers` keys) points at a row in the same file.
- Merge: rows from the file win on the same id; the device keeps its settings and only adds trophy tiers for lifts that have none.
- Replace: archives every existing exercise, routine and habit (never deletes them, since logged data points at them), clears quick-adds and calendar rows, then adds the file's rows and applies its settings. Sessions, sets, maxes, bodyweight, habit logs and photos are never touched.

Example (made up):

```json
{
  "kind": "lift-log-program",
  "version": 1,
  "exportedAt": 1893456000000,
  "exercises": [
    { "id": "ex-goblet", "name": "Goblet squat", "kind": "dumbbell", "incrementLb": 5, "roundToLb": 2.5, "autoIncrease": true, "isMain": false, "archived": false },
    { "id": "ex-press", "name": "Overhead press", "kind": "barbell", "incrementLb": 5, "roundToLb": 5, "autoIncrease": true, "isMain": true, "archived": false },
    { "id": "ex-press-light", "name": "Light press", "kind": "barbell", "incrementLb": 5, "roundToLb": 5, "autoIncrease": false, "isMain": false, "archived": false,
      "derivedFrom": { "exerciseId": "ex-press", "routineId": "rt-a", "pct": 80 } },
    { "id": "ex-plank", "name": "Plank", "kind": "hold", "incrementLb": 0, "roundToLb": 0, "autoIncrease": false, "isMain": false, "archived": false },
    { "id": "ex-jog", "name": "Jog", "kind": "run", "incrementLb": 0, "roundToLb": 0, "autoIncrease": false, "isMain": false, "archived": false }
  ],
  "routines": [
    { "id": "rt-a", "name": "Day A", "weekday": 2, "order": 0, "archived": false, "items": [
      { "exerciseId": "ex-goblet", "sets": 3, "reps": 8, "repsMax": 12 },
      { "exerciseId": "ex-press", "sets": 3, "reps": 5 },
      { "exerciseId": "ex-plank", "sets": 2, "reps": 40 }
    ] },
    { "id": "rt-b", "name": "Day B", "weekday": 4, "order": 1, "archived": false, "items": [
      { "exerciseId": "ex-press-light", "sets": 3, "reps": 5, "superset": "a" },
      { "exerciseId": "ex-goblet", "sets": 3, "reps": 10, "superset": "b" }
    ] },
    { "id": "rt-jog", "name": "Easy jog", "weekday": 6, "order": 2, "archived": false,
      "distanceProgression": { "startMi": 1, "stepMi": 0.25, "everyWeeks": 2, "fromDate": "2030-01-07", "capMi": 3 },
      "items": [{ "exerciseId": "ex-jog", "sets": 1, "reps": 1 }] }
  ],
  "quickAdds": [
    { "id": "qa-warm", "name": "Warm-up", "order": 0, "source": { "lines": ["Easy bike 5 min", "Arm circles"] } },
    { "id": "qa-b", "name": "Day B", "order": 1, "source": { "routineId": "rt-b" } }
  ],
  "habits": [{ "id": "hb-walk", "name": "Walk", "order": 0, "archived": false }],
  "calendar": [
    { "id": "cal-1", "type": "deload", "name": "Easy week", "startDate": "2030-03-04", "endDate": "2030-03-10", "pct": 10, "fewerSets": 1 }
  ],
  "settings": {
    "autoIncreaseGlobal": true,
    "rules": { "stallWeeks": 2, "deloadPct": 10, "maxEffort": 8 },
    "trophyTiers": { "ex-press": [0.5, 0.6, 0.75, 0.9, 1.05] }
  }
}
```

### Paste log
Settings → Paste log takes old notes, one workout per line:

```
YYYY-MM-DD exercise NxR@W; exercise R@W, R@W; hang S,S,S
```

- Exercises: `squat` (Squat), `bench` (Bench press), `deadlift` (Deadlift), `curl` (saved as "Curl (legacy)", a dumbbell exercise) and `hang` (Dead hang, seconds per set). Names are case-insensitive. A missing exercise is created.
- Within an exercise, comma-separated groups are `NxR@W` (N sets of R reps at W lb) or `R@W` (one set). The full-width `＠` and `×` work too. Blank lines and lines starting with `#` are skipped.
- Each line is saved as a finished session under the routine "Legacy 5x5" (created archived, so it never shows up as a plan), with every set done as written.
- `previewPasteLog` returns counts (`sessions`, `sets`, `skipped`) and one error per malformed line, like `Line 4: unknown exercise "press" (use squat, bench, deadlift, curl, hang)`. `savePasteLog` saves nothing while any line has an error.
- A date that already has a Legacy 5x5 session is skipped, so pasting the same notes twice doesn't create duplicates.

Example (made up): `2023-04-03 squat 3x5@95; bench 5@65, 5@65, 4@65; hang 30,25,20`

### Storage persistence
- `requestPersistence()` runs after the first finished workout (from `finishSession`), never on page load, and is feature-detected. A `false` result is normal on iOS and never blocks anything.
- `storageStatus()` returns `persisted`, `usageBytes` and `quotaBytes` when the browser reports them, and `photoBytes` once photos exist.
