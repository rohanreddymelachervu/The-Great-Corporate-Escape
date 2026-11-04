# v3.0 QA — Clock Out Sprint + Buzzword Run

4 November 2026. Two new isolated racing modes, with the existing Office Heist retained.

## Delivered

### Clock Out Sprint

Ten distinct authored courses; move/sprint/dodge only. No loot, active abilities, BS/stamina meter, heist cutaway or elevator wait. The exit is open immediately. The result and record are active completion time, not derived points. Lower is better. Countdown, pause and failed-screen time are excluded. Gold targets are displayed accurately and medals/PB ties agree with the displayed centisecond precision.

Courses: Quick Sync, Reply All, Mandatory Happiness, Scope Creep, The Pivot, Friday Deployment, Bandwidth Issues, Return To Office, Alignment Workshop, Exit Interview. All selectable without heist unlocks. Progression adds route/pattern combinations rather than unpredictable tracking or extreme speeds.

### Buzzword Run

Separate UTC-daily course/word/letter layout, seeded and shared for the same build/date. Curated sixteen-word corporate dictionary, four to seven letters, each with a finish punchline. Automatic unordered collection, correct indexed slots including duplicate characters, exit locked only until all badges are collected. At least one side-pocket badge is included where the authored template offers one. No inventory/spelling menu or extra letter points. Separate local daily records and shareable challenge codes.

### Humour and failure

Deep-red corporate-jargon wall, rotating failure quips, short original meeting-call chime, same-pattern automatic quick retry. R/Space/Retry can return sooner after a short guard. The sound is an original WebAudio motif, not a Microsoft Teams recording or copied ringtone. Mute/SFX volume and reduced motion are respected. No flashing/strobing punishment. Finish screens add corporate performance reviews and personal-best jokes after the clock has stopped.

## Executed checks

### Production build — PASS

TypeScript, Vite and portable/Pages packaging pass. The expected large-chunk warning is retained because runtime engine/fonts are bundled rather than fetched from a CDN.

`docs/index.html` and portable game: **2,043,839 bytes**.
SHA-256: **59e5af30c2aa2757d6f1853906747d8a85d9d4d9acee53efe955f0c824571c76**.

### Unit/data suites — 824 PASS

All 739 previous heist/UX/social/map/logic tests remain passing, plus:
- 52 sprint-course geometry/content checks: ten distinct layouts, walls/props, reachable exits/letter sites, swept routes, legal predictable guard routes, safe starts and hazard periods/bounds.
- 26 pure racing model checks: countdown, raw active time, diagonal/wall movement, dash, guard vision/LOS/contact, telegraphed hazards, retry, automatic letters, duplicate characters, locked exit, time-only result, medals and deterministic daily generation across 90 dates.
- 7 record checks: lower-is-better, centisecond ties, mode/date separation, existing-heist key untouched, denied/corrupt storage and no points field.

### Browser journeys — 58 PASS

All 47 previous heist journeys still pass. Eleven racing journeys verify:
1. Distinct menu entries and ten accessible courses.
2. Actual keyboard movement/dodge, with no racing health, stamina or loot state.
3. Real guard capture, red jargon punishment, stopped failure clock and same-pattern reset.
4. Pause, shared sound settings and focus-loss clock freezing.
5. Immediate sprint exit and raw-time storage, then Next Course.
6. Fixed UTC daily mode, unordered automatic badges, incomplete-exit refusal, completed word/joke and separate records.
7. Retry clearing letters/time while preserving that day's word/layout.
8. Returning from racing to a fully functioning existing heist.
9–10. Portrait and landscape touch controls, disjoint HUD/map/dock, red retry bounds and >=44px button.
11. Countdown/failure focus loss cannot advance unseen or auto-retry in the background.

Focused integration tests use development-only positioning to isolate capture/exit/letter behavior; they are not misrepresented as no-cheat playthroughs. These helpers are absent in production.

### Offline production checks — 6 PASS

The self-contained production file was loaded with networking disabled:
- Three existing-heist desktop/portrait/landscape smoke checks: actual movement, dodge, coffee and pause.
- Three racing desktop/portrait/landscape checks: native keyboard/touch movement and dash, a deliberately reached real guard capture, red failure UI, stopped clock, auto retry, Buzzword startup, viewport fit and no overflow.

No JavaScript errors or production QA helpers occurred. Audio synthesis paths were exercised without errors; physical speaker output was not measured.

### Real-input production course playtest — ALL TEN + DAILY PASS

Ran `npm run test:races` against the portable production HTML. Actual keyboard input only: no position, clock, health or win mutation. The controller reads the read-only snapshot, knows the authored maps and can deliberately vary its departure timing on bounded retries. It is an automated completion check, not a human difficulty/fun study.

| Course | Successful time | Attempts |
|---|---:|---:|
| Quick Sync | 9.94s | 1 |
| Reply All | 8.67s | 1 |
| Mandatory Happiness | 14.87s | 1 |
| Scope Creep | 7.83s | 1 |
| The Pivot | 8.83s | 2 |
| Friday Deployment | 16.56s | 1 |
| Bandwidth Issues | 8.76s | 1 |
| Return To Office | 11.38s | 1 |
| Alignment Workshop | 16.83s | 1 |
| Exit Interview | 12.84s | 1 |
| Daily SYNC — 2026-11-04-C02 | 13.05s | 1 |

The course-five capture is present in the raw execution log, not hidden. Earlier development runs also used retries on the final course. Experienced map-aware times are faster than the rough casual 20–45 second intention; no artificial minimum wait is enforced.

## Integration fixes and safeguards

- Separate Phaser scene/model/UI/store rather than changing heist rules.
- Shared settings correctly pause/resume racing; returning home stops racing and restores heist controls.
- Space handling avoids the previously discovered document/Phaser default-prevention trap.
- Pause/focus resume rebases the wall clock; countdown and failed-run auto-retry also freeze on focus loss.
- Accurate decimal Gold target avoids a rounded UI target disagreeing with a medal boundary.
- Records treat displayed centisecond ties as ties rather than claiming an invisible PB improvement.
- Mode-selection shortcuts cannot accidentally restart a stopped previous race.
- Stage ID namespace keeps racing background caches separate from heist floors.

## Limits and delivery

Local/honor-system records only; no online leaderboard, backend, authentication or anti-cheat. Physical mobile hardware, Safari and Firefox remain untested. Full race timing counts active wall time while physics is bounded on an unusually long frame, so a laggy device is not awarded free time; ordinary browser timing is not a certified competition system. More human playtesting remains useful.

Source and the exact tested docs build are prepared for the same existing main branch. The user handles Pages redeployment; committing files does not itself prove a new Pages deployment. No repository visibility or hosting settings are changed.
