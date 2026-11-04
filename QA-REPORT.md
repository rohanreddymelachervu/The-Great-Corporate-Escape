# v3.0.1 QA — persistent Sprint failure menu and uploaded ringtone

4 November 2026. Supersedes the Sprint failure-screen policy described in the archived v3.0 report below.

## Requested change

Clock Out Sprint now keeps the red corporate-jargon failure screen open until an explicit choice: Restart Level or Main Menu. No Continue button and no automatic retry. The clock stays frozen. Restart resets the same course/pattern; Main Menu returns to the normal title screen. Space no longer dismisses an unfocused Sprint failure screen, but keyboard activation of a focused button works. R remains a deliberate restart shortcut. Touch targets for both choices are in-bounds and at least 44px high.

The exact uploaded Microsoft_Teams_Incoming_Call_Sound-646775-mobiles24.mp3 is embedded without re-encoding: 418,795 bytes; SHA-256 03f47b85c57c3401bbda6ea0f96c8c194d56f4044ed42d794bbb26464aad1374. MP3 container duration is approximately 26.17s. WebAudio decodes and loops it while awaiting a choice. This is user-supplied third-party audio, not the old synthesized substitute; no official provenance or redistribution license is asserted. Asset provenance is preserved in licenses/USER-SUPPLIED-AUDIO.txt, including the offline build's notices.

Playback obeys mute and SFX gain, ducks the game music, stops on restart/menu/scene shutdown, and suspends on settings/focus loss. Async decode rechecks whether the call is still requested before starting; one source is active at a time. Failure-state pause keeps the same two-choice screen instead of replacing it with a generic menu containing Resume. No resuming a failed ranked run is implemented.

Only Clock Out Sprint gets this behavior. Existing Office Heist and Buzzword Run rules/retries are preserved.

## Executed final checks

- Production build and strict TypeScript: PASS. Portable HTML and docs/index.html match byte-for-byte.
- 825 unit/data checks: PASS, including a cryptographic identity check against the uploaded MP3.
- 62 browser journeys: PASS (47 existing heist, 15 racing). The updated focused 15-racing suite also passed after adding both mobile failure-button bounds and actual Main Menu touch activation.
- Ringtone-specific browser checks: real MP3 decoding, looping source/duration, persistent two-choice failure, explicit restart and repeat capture, Main Menu cleanup, M mute/unmute, SFX zero/restoration, shared settings suspension/resume, focus-loss suspension, keyboard Main Menu activation, and unchanged Buzzword quick retry.
- Six offline production checks: PASS, across desktop and both mobile orientations for existing heist and racing. The desktop Sprint failure was left open for 28 seconds, beyond the uploaded recording's duration; the ringtone was still playing and no retry occurred. Both touch orientations also verified the persistent loss screen, uploaded ringtone, frozen clock, explicit restart and daily startup. No JavaScript errors or network dependencies.
- Real-input production traversal: all ten Sprint courses plus today's SYNC Buzzword race completed again. Failed Sprint attempts now use the visible restart button rather than relying on auto-retry. No position/clock/health/win mutation.

Build: 2605927 bytes. SHA-256 693dfbfbbb3ad9dc00ba8d97f5d1e193bc09b1d42efbe7cb481eaf6b161b1206.

Physical speaker output, physical mobile hardware and non-Chromium browsers remain unmeasured. Audio checks establish decoded uploaded bytes and active WebAudio source/lifecycle, not a physical acoustic recording. The existing GitHub Pages deployment setting is not changed; the owner redeploys main/docs.

---

## Archived v3.0 report — prior behavior

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
