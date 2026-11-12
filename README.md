# Lift Log

A free, offline training log for lifting and running, built for iPhone. Its main job is showing your progress over time: charts, lift trophies and your bodyweight trend. Logging is a quick check-off of a pre-filled workout, usually right after you train.

There are no accounts, no ads, no analytics and no server. Everything you log stays on your phone.

**Open it:** https://achillgator.github.io/lift-log/

## Install on iPhone

1. Open the link above in **Safari** (not Chrome).
2. Tap **Share → Add to Home Screen → Add**.
3. From then on, open Lift Log only from the Home Screen icon. The installed app keeps its own data, separate from the Safari tab, so anything entered in Safari doesn't carry over.

After the first launch it works fully offline, including in airplane mode. When a new version is available, you'll see "Updated – tap to reload". Otherwise the update applies the next time you open the app, so it never interrupts a workout you're logging.

## Getting started

The app starts with a small exercise library, one example routine ("Example · Full body") and one example warm-up. Edit or delete them, then set up your own:

- **Build your routines in the app:** Settings → routines, exercises and quick-adds. Give each routine a weekday, and Home shows it as "Log today" on that day.
- **Or import a program file:** Settings → Import program. A program file holds routines, exercises, quick-adds and rules, but no history. You can preview it before it's applied.
- **Bring in old notes:** Settings → Paste log turns lines like `2023-04-03 squat 3x5@95; bench 5@65, 5@65` into finished workouts.
- **Add your bodyweight** so the trophies can rank your lifts.

## Features

- **Log today:** today's routine, pre-filled. Tap a set, or an exercise for all its sets, to mark it done as planned, and use the steppers to change a number (press and hold to go faster). You can also add, skip or remove a set, swap an exercise, or start an empty workout.
- **Saved on every tap:** closing the app mid-workout loses nothing.
- **Quick-add:** one tap drops a saved block, like a warm-up or a whole routine, into today.
- **Finish summary:**
  - time (editable), plus calories if you want to add them
  - volume, sets done and PRs hit
  - optional effort (1–10), a pain flag and a note
- **Auto-increase:**
  - Next time's weight goes up when you hit every rep and your effort was 8 or lower.
  - It can be switched on or off for everything or per lift.
  - Rep-range lifts add reps first, then weight.
- **Stall check:** if you miss reps 2 weeks running, a banner suggests dropping the weight by 10%. You decide whether to accept it.
- **Progress charts:**
  - top set and estimated 1RM per lift, plus pull-ups, dead hang, run distance, timed test runs and weekly volume
  - ranges of 4 weeks, 3 months or all time
  - drag along a chart to read any date
- **Lift trophies on Home:**
  - Squat, bench, deadlift and overhead press are ranked from Bronze to Diamond by estimated 1RM ÷ bodyweight.
  - Each trophy shows how many lb you need for the next tier.
  - The tiers are rough rules of thumb and can be edited in Settings.
- **Bodyweight:** a smoothed 7-day average, with an optional faint line of your daily weigh-ins.
- **History:** every workout, newest first, all editable.
- **Undo instead of "Are you sure?":** every log or delete gets an Undo toast. Typing 1000 for a 100 lb lift asks "Did you mean…?"

Weights are in lb only.

## Back up your data

Your data lives only on your phone, so if the phone is lost or the app is deleted, it's gone. iOS can also clear website data on its own, so backups are your job:

- **Settings → Export backup (JSON)** saves everything through the share sheet. Save it to Files or iCloud Drive. **Export sets (CSV)** gives you a spreadsheet of every set.
- Home shows a reminder when your last backup is more than **7 days** old.
- **Settings → Import backup** restores a backup. You choose whether to merge it with what's there or replace it, and replacing asks you to confirm first.
- Settings also shows whether your phone has marked the app's storage as persistent, and how much space it uses.

## Coming later

- **v1.1:** daily habits with streaks, a calendar heatmap in History, a plate calculator using the plates you own, and a PR feed.
- **v2:**
  - progress photos (front, side and back, compared across two dates; they stay on the phone and are exported separately)
  - a training calendar with phases, test days and deload weeks
  - an optional trophy line comparing you with adult drug-tested powerlifters

## Run it locally

You need Node.js. The app uses Vite, Svelte 5, TypeScript, Dexie (IndexedDB), vite-plugin-pwa and Vitest.

```bash
npm install
npm run dev       # dev server
npm test          # Vitest
npm run build     # production build in dist/
npm run preview   # serve the build
```

Every push to `main` runs the tests and the build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`). `SPEC.md` has the full spec, including the data model, the progression rules and the backup and program file formats.

## License

[MIT](LICENSE)
