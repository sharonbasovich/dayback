# DayBack

**One lost day. Not a lost week.**

DayBack is a small, local-first prototype for checking whether a study plan still fits after a missed day. It checks capacity **before each deadline**, not only the weekly total, and lets you preview an explicit repair before applying it. Protected commitments and deadlines do not move. Undo restores the previous plan.

## Open the demo

Applying an unchanged effort estimate reports that no change was applied and existing Undo history was preserved. Undo still targets the last actual repair, if any.

The current source includes an explicit “Clear missed day when saving” control and high-zoom focus/status improvements. The live demo follows GitHub Pages deployments; a source merge alone does not confirm that a deployment has finished. Serve this source locally using the instructions below to test this exact version. The v0.1.0 release assets remain the original snapshot and do not include these corrections.

[Try DayBack in your browser](https://sharonbasovich.github.io/dayback/). The free static demo needs no account or API key. It starts with synthetic data; edits stay in page memory and are lost on reload. Baseline, missed day, late/early repair preview, Apply and Undo were checked on the hosted version.

The v0.1.0 release assets remain the original reviewed snapshot; their embedded documentation predates this hosting update. Local run instructions below still apply.

## A concrete example

The invented student week starts with 7 usable hours for 5 hours of work. Losing Wednesday leaves 5 usable hours, but the first deadline needs 3 hours and has only 1 available before it. The 4 hours later in the week cannot cover that 2-hour shortfall. Adding time on Saturday does not fix Friday; adding genuinely available time on Thursday does.

The example is synthetic. There is no student study or claim of improved grades, productivity or wellbeing.

## Run and test

Requires a modern browser. Serve this directory with a static HTTP server and open `index.html`. For example, if Python 3 is installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000` locally. No dependency installation, API key or account is needed.

A self-contained generated version is in `portable/DayBack.html`. It embeds the stylesheet and the four JavaScript modules, with source/output hashes in `portable/manifest.json`. Regenerate it with `npm run export:single`. Native direct `file://` opening has not been accepted in testing; the source/server path above is the documented run route. No dependency downloads are needed by the app.

With Node.js 24:

```sh
npm test
npm run demo
```

Tests cover deadline bottlenecks, exact boundaries, protected overlap, immutable inputs, repair preview, stale revisions, Undo and staged editing. Independent finite model checks and bounded browser checks informed development; these are not a proof of real-world workload estimates or complete accessibility conformance.

## Try it

1. Select **Compare lost day** with November 11, 2026.
2. Read the deadline explanation. The total hours match, but the first deadline does not fit.
3. Try Saturday +2h, then Thursday +2h. Preview does not change the plan.
4. Apply only if that earlier time is genuinely available; then try Undo.
5. Edit the plan to stage your own tasks, study blocks and protected commitments. Invalid saves retain the draft. Cancel discards it. When a missed day is selected, the editor offers an unchecked **Clear missed day when saving** choice. Use it to save a new horizon that excludes that date without losing your staged edits. Saving without the choice keeps the existing missed-day comparison; failed validation never clears it.

Long status messages stay within a scrollable region at high zoom. Tab to the message and use Home or End to read its beginning or end; Shift+Tab returns to the previous control. New updates start at the beginning of the message.

An effort revision is an explicit estimate or scope change, not completed work. Changing the missed-day scenario or saving a plan clears repair history while retaining the current plan. The baseline means the current plan without a missed day, not an immutable original.

## Model and limits

- One person, a horizon of 1–31 days and divisible 30-minute work units, all available at the start.
- Explicit civil dates in one time basis; no timezone conversion, overnight blocks, prerequisites, fatigue or uncertainty model.
- Non-overlapping study intervals; protected overlap is excluded once. The displayed excluded overlap is not the total duration of all commitments.
- An infeasible allocation witness is partial, not a complete schedule.
- All entered data stays in page memory. **Reloading loses the plan.** No persistence, calendar integration, telemetry, AI inference or application backend.
- Responsive layout, focus handling and reduced-motion CSS are implemented. Screen-reader, physical-device and OS reduced-motion runtime acceptance are not established.

## Development and attribution

Created for the Silicon Valley Buildathon during its November–December 2026 build window. This is an original prototype; no award or real-user outcome is claimed. Design, implementation, tests and review were produced with OpenAI AI-assistant assistance. No third-party runtime dependencies or external media assets are included. System fonts are used.

Source is published for inspection and evaluation. No open-source license grant is made in this repository; applicable copyright is retained. Publication does not imply permission for unrestricted reuse.
