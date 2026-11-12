# Lift Log

This is a free, offline training log I built using Claude Code, primarily for lifting and running. Its main job is showing progress over time: charts, BW trends, etc. I build it so that logging can be a quick thing to do right after your workout, not a cumbersome process that takes the better part of an hour..

There aren't any accounts, ads, analystics, or server; just a PWA on your phone (it's built for iPhone btw, so it probably doesn't work with any Androids).

**Open it on** https://achillgator.github.io/lift-log/

## How to install on iPhone

1. Open the link above in **Safari** (not Chrome, since there isn't an option to add to home screen as far as I'm aware).
2. Tap **Share → Add to Home Screen → Add**.
3. Now, open Lift Log only from the home screen (there should be an icon there). The installed app has its own data, which is separate from the Safari tab. This means that **anything entered in Safari doesn't carry over**.

After the first launch, it works fully offline. When a new version is available, you'll (hopefully) see "Updated – tap to reload".

## Getting started

When you launch, there's a small exercise library, including an example routine and an example warm-up (just to get you started). You can then:

- **Build your routines in the app:** Settings → routines, exercises and quick-adds. You give each routine a weekday, and the home screen shows it as "Log today" on that day.
- **Import a program file:** Settings → Import program. Program files hold routines, exercises, quick-adds and rules; they don't hold history. You can preview it before it's applied.
- **You can bring in your old notes:** Settings → Paste log turns lines like `2023-04-03 squat 3x5@95; bench 5@65, 5@65` into finished workouts (if you're importing from something like the notes app, copy and paste all of your previous data and give it to something like Gemini to format everything quickly and efficiently without burning too much usage. Just a suggestion)
- **Add your bodyweight** so that the trophies can rank your lifts (this is according to public data on natural male lifters, so take it with a grain of salt)

## Features

- **Log today:** this is today's routine, and its prefilled. You can a set or exercise for all its sets to mark it as done. Using the steppers, you can change a number (you should be able to press and hold to go faster). Additionally, it's possible to add, skip or remove a set, swap an exercise, or start an empty workout.
- **It's saved after every action,** so even if you accidentally close the app mid-workout, you don't lose anything.
- **Quick-add** lets you tap once to drop a saved block (like a warm-up or a routine) into today.
- **Finish summary:**
  - time (editable), + calories if you want to add them (no Apple Watch integration yet, so you'd have to do it manually)
  - volume, sets done, PRs hit
  - optional effort (1–10), a pain flag and a note (qualitative data is pretty useful actaully)
- **Auto-increase:**
  - Next time's weight goes up when you hit every rep and if your effort was 8 or lower.
  - It can be switched on or off for everything AND per lift.
  - Rep-range lifts add reps first, then weight.
- **Stall check:** if you miss reps for 2 weeks in a row, a banner suggests dropping the weight by 10% (there's an option to decline, too)
- **Progress charts:**
  - top set + est. 1RM per lift, plus pull-ups, dead hang, run distance, timed test runs and weekly volume
  - ranges of 4 weeks, 3 months or all time
  - drag along a chart to view any date
- **Lift trophies on Home:**
  - Squat, bench, deadlift and overhead press are ranked from Bronze to Diamond by estimated 1RM ÷ bodyweight.
  - Each trophy shows how many lb you need for the next tier.
  - The tiers are rough rules of thumb and can be edited in Settings (so if you find some data for your demographic you can put that in there).
- **Bodyweight:** a smoothed 7-day average + optional faint line of your daily weigh-ins.
- **History:** every workout, (sorted by recency), all editable.
- **Undo instead of "Are you sure?":** every log or delete gets an Undo toast. Typing 1000 for a 100 lb lift asks "Did you mean…?" (if my implementation worked)

Weights are in lb only. (until someone actually finds this and asks for kgs)

## Back up your data

Your data lives only on your phone, so if the phone is lost or the app is deleted, it's gone. iOS can also clear website data on its own, so you gotta do some backups:

- **Settings → Export backup (JSON)** saves everything through the share sheet. Save it to Files or iCloud Drive. **Export sets (CSV)** gives you a spreadsheet of every set.
- Home shows a reminder when your last backup is more than **7 days** old.
- **Settings → Import backup** restores a backup. You choose whether to merge it with what's there or replace it, and replacing asks you to confirm first.
- Settings also shows whether your phone has marked the app's storage as persistent, and how much space it uses.

## Coming later

- **v1.01:**
  - an actually good design, that I spent way too much time making
- **v1.1:**
  - daily habits with streaks, a calendar heatmap in History, a plate calculator using the plates you own, and a PR feed.
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
