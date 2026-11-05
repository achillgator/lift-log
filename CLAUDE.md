# Lift Log

Offline iPhone PWA for logging training and showing progress. Read SPEC.md and DESIGN.md before any change. DESIGN.md is created from the Claude Design handoff and is the source of truth for the look; until it exists, use the placeholder tokens in `src/styles/tokens.css`.

One feature phase per session. Run `npm test` and `npm run build` before every push.

## Code layout

- `src/db/`: Dexie schema, migrations, queries, seed. `types.ts` and `api.ts` are the shared contract.
- `src/features/`: log, routines, progress, trophies, body, history, habits, settings.
- `src/components/`: design-system primitives, shown on `#/kitchen-sink`.
- `src/styles/`: tokens.css, global.css.
- `src/lib/`: export/import, paste-log parser, progression math, units, dates, router.
- `src/pwa/`: registration, update toast.

## Non-negotiables

1. Every Dexie change = version bump + migration + upgrade test; never drop or rename a table or field that holds data.
2. Never rename the repo or change base path / start_url / scope.
3. No network calls at runtime; no CDNs; no analytics.
4. Every data-changing tap writes to IndexedDB immediately.
5. Progression, e1RM, trophies, stall, derived lifts, paste-log parser, program file and migrations have Vitest tests; run them before every push.
6. Components never touch Dexie directly; go through `src/db`.
7. Update SPEC.md (and DESIGN.md for look changes) in the same commit when behavior changes.
8. Public repo: never commit personal data or a real person's training plan (names, age, school, sport, health notes, body stats, weights, history, photos, exports, schedules). This covers files, commit messages and PR descriptions. Personal data enters only through the app on the device.
9. DESIGN.md beats the design skills. Never run /impeccable teach.
10. `private/` is gitignored personal material. Read it only when asked in that session, and never copy anything from it into committed files, commit messages or PRs.
11. Sample data in committed files is always made up: DESIGN.md, the kitchen-sink page, tests, fixtures and screenshots.
12. Name exports `lift-log-backup-YYYY-MM-DD.json/.csv` and the photo export `lift-log-photos-YYYY-MM-DD.zip`, so .gitignore catches them.

## Design skills

- apple-design and impeccable live in `.claude/skills/`. They are advisors: DESIGN.md wins any conflict.
- Never run /impeccable teach or init, overdrive or delight. bolder, quieter and live only when asked, during a tune step, and DESIGN.md gets updated to match what is kept.
- `design/inspiration/` is for design prompts only; never commit it.
- Ignore Impeccable's system-font rule: SF Pro is a deliberate choice.
- Findings that are bugs get fixed in the same session. Taste suggestions go in a "Design ideas" list in the PR description, never straight into code.
