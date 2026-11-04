# THE GREAT OFFICE ESCAPE: 4:59 PM — Three Ways to Clock Out v3.0

> You've finished your work. Unfortunately, nobody else has.

A client-side Phaser 3 + TypeScript + Vite office-escape game. No backend, account, database, runtime AI, API key, tracker or paid gameplay service.

**Preview:** https://hyperagent.com/s/0RA76fgitXB1NI7B7D0-mA

**Deployable GitHub Pages build:** `docs/index.html` on `main`. The source and rebuilt `docs` are committed to the existing `rohanreddymelachervu/The-Great-Corporate-Escape` repository. This update does not change hosting settings; redeploy your existing Pages setup from that folder.

## New in v3.0: two separate time-only racing modes

The original Office Heist remains available with its existing maps, loot, abilities, difficulty, records and animations. New racing records are stored independently.

### CLOCK OUT SPRINT

Choose any of **ten short authored courses**. Move with WASD/arrows or joystick, sprint with Shift/RUN, dodge with Space/DASH. Reach the always-open exit as fast as possible. No loot, distractions/abilities, Corporate BS, stamina meter, lift wait or heist hit cutaway.

Your result is **active race time**, displayed in hundredths. Lower is better; records and medal boundaries agree with that display precision. Countdown, pause and loss-screen time do not count. Gold/Silver targets are per course. All ten courses are selectable without affecting heist unlocks; Next Course provides a natural difficulty progression through timing, route choices and readable pattern combinations.

A catch stops the clock and triggers a **deep-red corporate-jargon punishment wall** with an original meeting-call chime, then an automatic quick retry of the same course/pattern. R/Space or Retry can return sooner after a short guard. The cue is original WebAudio, **not an embedded Microsoft Teams recording or copied ringtone**. Mute and SFX volume apply. There is no flashing punishment; reduced motion removes word-stamp animation.

The ten courses are Quick Sync, Reply All, Mandatory Happiness, Scope Creep, The Pivot, Friday Deployment, Bandwidth Issues, Return To Office, Alignment Workshop and Exit Interview. Experienced map-aware play can clear them much faster than a new exploratory player; there is no forced minimum wait.

### BUZZWORD RUN

A separate **UTC-daily letter race**. Everyone on the same build gets the same authored course, corporate word, letter locations and hazard patterns for that date. Run over letter badges **in any order**; slots fill their correct positions automatically, including repeated letters. The exit unlocks after every badge is collected. No spelling menu, E interaction, loot or bonus points.

Sixteen curated 4–7-letter corporate words have finish-screen punchlines. Examples: SYNERGY — “Two departments, twice the meetings”; PIVOT — “The original plan has left the chat”; SCOPE — “It grew while you were reading this.” Where a template has a genuine side pocket, the daily placement includes one instead of merely repeating the pure exit line.

Pure sprint, daily buzzword dates and heist scores never share a leaderboard bucket. Records are local, and Share Time copies/shares the course/word, time, medal and daily challenge code. There is **no online leaderboard or anti-cheat service**. Pausing freezes the race; focus loss also freezes countdown and failed-run retry rather than advancing unseen.

Finish screens include a deliberately unhelpful corporate performance review. Compensation remains unchanged.

### Racing development checks

```sh
npm run test:races          # Real-input production traversal: ten courses + today's letters
npm run test:race-release   # Offline desktop + both touch orientations; loss/retry and daily startup
```

The race playtester reads the read-only inspector and uses actual keyboard input. It knows the authored maps, can retry at most eight times, and varies its departure timing on retries; it does not move the player or mutate health/clock/win state.

## Office Heist UX retained from v2.2

The underlying v2.1 difficulty tuning is retained: enemy speeds/damage/vision, tool cooldowns/durations, lift waits, maps, patrol routes, staff counts and meeting schedules are regression-tested against qa-evidence/difficulty-v21.json. No stronger enemies or compensating difficulty buffs were added.

- **Core actions first:** move, E to use/hold to steal, Space to dodge. Throw Coffee and Fake Call stay on the main strip. More Tools pauses the office and explains optional Look Busy (stay still), Meeting Shield and Office Freeze; choosing a ready tool returns to play and activates it. Shortcuts 3–5 still work directly.
- **Brief, optional context tips:** one useful hint when relevant, no compulsory tutorial or pause. Dismiss it or turn Context tips off in Settings. Learned tips are remembered locally.
- **One visual grammar:** gold arrow = objective, mint = interaction, common red cones = vision, outlined hazard = warning and filled hazard = active. Characters keep their own clothing/name colours.
- **Less label clutter:** only the current E target or steal in progress displays its detailed loot label. The highlighted object matches the action E will actually take.
- **Automatic WFH:** picking up the purple house token opens the alternate exit immediately; no numbered activation is required. The arrow reroutes, and the regular lift remains usable too. Old key 6 simply explains the status.
- **Intern meets founder:** where both existing characters are present, a safe natural encounter or a coffee-assisted meetup can turn into an eight-second pitch. They physically approach, face each other, gesture, show a tiny AGENT demo and exchange scripted lines. Both are occupied rather than attacking you. There is no new key, dialogue tree, actor spawn or forced camera. This is a limited breather, not another threat.
- **Meeting-room reactions:** existing colleagues retain the same walkout/return schedules and spotting rules, with clearer hand, walking and noticing poses.
- **Incident report:** an optional collapsed recap after a run uses actual loot/hit/dodge/coffee/conversation counters. The existing Share button shares the report. No runtime AI, new meter or extra scoring system.

## Office heist content retained from v2.1

All five floors are now **1600×1120**, twice the old world area. Ten enclosed meeting rooms connect to the existing office through new lounges, pantry areas, service corridors and broad doorways. Amber lights warn when meetings end; attendees physically walk out, can spot you and alert major enemies, ask one quick question, then walk back in. They do not teleport into hallways or detect through walls.

**Every applied enemy, hazard or meeting-attendee hit plays its own animated cutaway:** forced HR photo, calendar ambush, intern AGENT chain, printer paperwork burial, founder inspiration, PM scope expansion, gossip location broadcast, or meeting-door interruption. Settings offers **Brief** (~1.3–1.6 seconds) and **Long haul** (~3.3–3.8 seconds). The office, lift and score clock pause during the scene. E, Space, Enter, Escape or Skip returns early after a short input guard. Reduced motion removes flashes and uses gentler motion. The already animated HR rhythm activity keeps its own result screen.

### Optional heist loot

Hold **E / ACT** while standing beside an object to steal it. Moving, releasing or leaving range cancels an incomplete theft. Snacks only need a tap. The bag is run-local: **escape to bank its points; a failed escape banks nothing.**

| Object | Bag points | Hold | Risk / benefit |
|---|---:|---:|---|
| Office TV | 800 | 1.6s | Loud equipment alarm; bulky |
| Coffee machine | 650 | 1.4s | Loud, bulky |
| Innovation trophy | 400 | 0.8s | Clinks, adds weight |
| Abandoned laptop | 300 | 0.65s | Portable, modest noise |
| Mechanical keyboard | 220 | 0.55s | Its clickiness follows you |
| Desk plant | 160 | 0.65s | Low noise; it wanted better culture too |
| Snack stash | 100 | Tap | Quiet; −6 BS and +15 stamina |

There are **45 new loot objects** across the floors, plus the existing laptops. Bulky loot is visibly carried, makes you easier to notice and reduces normal movement by up to 18%; the actual speed penalty is shown beside your bag value. Dodges still work at full burst speed. Slack cannot convincingly hide a television. Theft alarms reveal the theft's position to nearby colleagues, not every enemy on the map. Three extra achievements reward escaping with a TV, two snack stashes or 1,500 bag points.

The gold navigation cue now follows reachable passageways rather than pointing straight through intervening walls. Only nearby meeting warnings reach the message rail, so a distant room cannot overwrite immediate player feedback.

## This is a different gameplay loop

The old compulsory badge-and-switch errands are gone. You already have your own ID.

1. **Follow the gold arrow to the lift. Press E to call it.**
2. **Survive the office while it arrives.** HR attempts photo charges, moving photo sweeps cross your lane, and meetings, intern yap, paperwork and all-hands announcements create marked danger zones. Badge pings draw colleagues toward a snapshot of your last position.
3. **Board before the doors close.** The lift opens for ten seconds. Miss it and another arrives in fourteen seconds; missing one is not an arbitrary instant loss.

The first floor already has both the manager and HR. **DODGE HR · QUICK PLAY** jumps directly into the HR floor. The optional rhythm activity remains at office booths and under **CLAP PRACTICE**; it is not a substitute for the escape game.

Lift waits are 20 / 26 / 30 / 34 / 38 seconds across the five floors. Side switches are optional tactics: sabotage the main nuisance, cancel matching interference and bring the lift up to seven seconds sooner. WFH tokens on later floors enable a real alternative exit.

## The interference has counterplay

- **HR photo charge:** HR stops, draws a locked-aim line, then lunges at that recorded position. Dodge sideways. She cannot home during the charge or go through furniture.
- **Photo sweep:** a warning lane precedes the moving beam. Step out of its lane or time a dodge through it.
- **Meeting zone:** move away before the calendar circle arms.
- **Intern yap:** leave the marked ring. The intern also moves quickly and slows nearby employees with his monologue.
- **Friday paperwork:** stacks cross a telegraphed path. Move aside, use cover or dodge.
- **Founder All Hands:** get out of the marked circle. The whistle redirects the office and expands awareness temporarily. The founder ignores fake calls.
- **Manager / PM:** catching you during a lift wait can add a one-time four / three second delay respectively. They cannot delay it forever.
- **Gossip:** discovery broadcasts your last known position to nearby colleagues.

All hazards have a warning before activation. Walls and solid furniture block line of sight and hazard contact. A hazard can damage you once, not every frame. Dodging does not permit walking through desks. Remaining inside an armed circle after a dash can still hurt.

Getting caught builds **Corporate BS**. At 100%, you are promoted to staying late. Physical catches grant a three-second escape grace period. Coffee pickups, pantry breaks and brief hiding provide recovery.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | Joystick |
| Sprint | Hold Shift | Hold RUN |
| Dodge | Space | DASH |
| Call lift / use a nearby tool / hide | E | ACT |
| Throw coffee ahead | 1 | COFFEE |
| Fake Call | 2 | CLIENT CALL |
| Look Busy — stay still (More Tools) | 3 | BUSY |
| Meeting Shield (More Tools) | 4 | CALENDAR |
| Office Freeze (More Tools) | 5 | VPN |
| WFH exit | Pick up a purple house token; walk into its exit | Same |
| Pause | Escape / pause button | Pause button |
| Mute | M / sound button | Sound button |

**Space is a dodge, not an interaction.** It costs 18 stamina, lasts 0.19 seconds and has a 1.7-second cooldown. Walk or refill coffee to recover stamina. Sprint exhaustion uses a recovery latch rather than jittering between speeds.

Coffee now diverts **at most two nearby colleagues**, and a close pursuer who still sees you only hesitates. Break sight and throw around cover. It is not a group invisibility button.

Fake calls last five seconds and slow your movement; founder and intern ignore them. Calendar immunity lasts 3.5 seconds. VPN clears live hazards and stops enemies for two seconds while the lift continues coming. Camouflage requires remaining stationary. Tools unlock progressively by floor.

House-shaped hiding markers offer **six seconds of cover**, then expire and need a cooldown. You cannot hide through an entire lift wait. Hiding, pantry coffee and optional sabotage are useful choices rather than mandatory fetch steps.

The HUD, map and controls occupy separate grid regions. Only the current objective and one nearby NPC speaker are shown. Portrait and landscape touch layouts retain the same rules. Audio starts after a gesture and provides separate music/SFX volume controls and mute. Reduced-motion settings disable camera shake and dash ghosts. Losing focus pauses the run.

## Optional HR Fun Friday

At pink booths on floors 2, 4 and 5, use E to play **Clap for the Culture**. Read the instruction, then press Start Activity. Land three of five claps in the mint timing zone to get −25 BS, one coffee, twelve seconds of HR distraction and accuracy points. Failure adds eight BS. Booths are single-use per floor.

The office simulation pauses while the activity runs, including the lift; the activity's time is added to your score clock. Menu practice has its own local best and does not change campaign progress.

## Scores and replay

The base score rewards time, never being spotted/caught, laptop recovery, limited credited distractions and low final BS. Each actual hazard/HR-charge dodge adds **125 points**; HR activity adds twice its accuracy points. Bronze, Silver, Gold and Ghost Employee medals, local personal bests, sixteen achievements and UTC-seeded daily challenges remain available.

A failed run and pause-menu restart retain their opening seed, so retries let you learn rather than rerolling the problem. Replays after a win can vary. Old unlocks, achievements and audio settings are preserved; ruleset-2 campaign and daily scores use separate keys so old nine-second fetch-route records do not dominate the new game. There is no server leaderboard, anti-cheat or cloud save.

## Build and test

Node 22+ and npm. No secrets or environment configuration are required.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Vite serves development on port 4173. That development address is not a public deployment.

Build outputs:
- `dist/`: ordinary static hosting output.
- `release/office-escape.html`: portable offline single-file game.
- `docs/index.html` and `docs/.nojekyll`: the same game prepared for branch-based GitHub Pages. `docs` is intentionally committed.

The approximately 2.04 MB uncompressed release contains Phaser, fonts, artwork code, audio code and legal notices. The large-chunk warning is expected: runtime CDN dependency was deliberately avoided.

```sh
npx playwright install chromium
npm run test:browser
npm run test:release
npm run test:campaign
# Optional: SIMPLE_CONTROLS=1 npm run test:campaign skips advanced tools
```

`CHROMIUM_PATH` optionally selects an existing Chromium executable. Otherwise Playwright uses its managed browser.

- **824 unit/data tests across the app:** geometry, navigation, saves, RNG, maps, sixty-three encounter-director checks, seventy-two enemy checks, thirty-two meeting-traffic checks, twenty loot checks, HR rhythm logic legacy-score migration, a twenty-one-check social model, and eleven UX/difficulty/report checks.
- **58 browser journeys across the app:** actual keyboard and touch dodges, arrow/WASD movement, windup/locked-aim behavior, warnings before hits, real hazard dodge credit, camping consequences, lift timing/boarding, optional sabotage, recovery, alternative WFH, loss/retry, settings, daily seed, responsive bounds HR activity success/failure, all eight animated hit scenes, lethal-hit recovery, long-haul skipping, held theft, snack recovery, bank/loss rules and real meeting-room walkouts.
- **Three offline production checks:** desktop plus portrait/landscape touch startup, input, dodge, coffee and pause with network disabled and no production QA helpers.
- **Real-input production campaign:** the map-aware controller plays all five floors without positioning, health, timer or win hooks. It can attempt a floor at most three times, using actual optional sabotage after a failed attempt; failures are recorded, not hidden. Focused development runs may explicitly skip unlocks, but full production runs do not.

The previous Space/arrow default-prevention bug was found through browser input tests and fixed. See `QA-REPORT.md` for the actual final run evidence. Passing automated tests proves functionality, not that every person will find the game fun; more human playtesting remains valuable.

## Architecture

```
src/main.ts                  Shared lifecycle/settings and unchanged heist UI
src/sprint/scene.ts          Separate Phaser racing scene, input and visuals
src/sprint/model.ts          Pure movement/timer/capture/daily-word model
src/sprint/courses.ts        Ten distinct authored courses and legal letter sites
src/sprint/ui.ts             Race selection, minimal HUD, red failure/retry, results
src/sprint/progression.ts    Independent raw-time records and daily history
src/sprint/style.css         Isolated responsive racing UI and jargon wall
src/game/scene.ts            Fixed-step run, movement, abilities, lift interaction, effects
src/game/director.ts         Pure seeded interference, warning/hit rules, lift/boarding clock
src/game/traffic.ts          Seeded meeting-room walkout/return, spotting and interruption
src/game/loot.ts             Run-local bag, timed theft, points and carrying rules
src/game/render-traffic.ts   Staff animation, clipped vision and amber doorway cues
src/game/render-incidents.ts World hazard telegraphs, HR charge cues and lift feedback
src/game/enemy.ts            Patrol/investigate/chase/search FSM, HR locked-aim lunge
src/game/social.ts           Bounded harmless intern–founder meetup and conversation
src/game/render-social.ts    Actual-world character gestures and animated pitch
src/game/coach.ts            Non-blocking contextual advice only
src/game/report.ts           Factual deterministic incident recap
src/game/logic.ts            Swept collision, LOS/FOV, radius-inflated A*, RNG, score
src/game/levels.ts           Five office layouts, optional tactics and enemy routes
src/game/catalog.ts          Tuning, dialogue, abilities and achievements
src/game/progression.ts      Versioned local progress; separate ruleset-2 scores
src/game/fun.ts              Pure five-beat HR activity
src/ui/fun-ui.ts             HR activity controls and cleanup-safe animation
src/ui/hit-scenes.ts         Eight original skippable animated hit cutaways
src/art/loot.ts              Original pixel TVs, snacks, keyboards and other loot
src/art/art.ts               Original pixel sprites and once-baked office artwork
src/audio/audio.ts           Original WebAudio music, synthesizers and foley
src/ui/style.css             Non-overlapping responsive HUD/map/control layout
scripts/standalone.mjs       Portable HTML and GitHub Pages packaging
```

Phaser Canvas is intentional for reliable software/mobile rendering. Static office illustrations are baked once. Dynamic hazards are bounded in number, navigation is refreshed at controlled intervals, and gameplay uses a fixed 60 Hz step.

`window.__office.snapshot()` is read-only inspection for QA. Positioning and seeded-start helpers exist only in Vite development mode with `?qa=1`; they are absent in the production release.

## Redeploy GitHub Pages

Use your existing repository and Pages setup. Pull the updated `main` branch and redeploy **`/docs`**. No new repository, account, workflow secret, API token or database is needed. This update does not alter repository visibility or hosting settings.

If setting up Pages for the first time, GitHub Settings → Pages → Deploy from a branch → `main` → `/docs` → Save. Use the actual HTTPS address GitHub returns. A GitHub Pages deployment is not claimed merely because build files were committed.

Future updates: build, test and commit both source and regenerated `docs/index.html`. Other static hosts can serve `dist`; `wrangler.toml` remains an optional Cloudflare configuration without credentials.

## Licenses and remaining limits

Original sprites, office art, dialogue, layouts, sound and music are generated locally. Application source is MIT licensed. Phaser's MIT notice and Barlow Condensed / IBM Plex Mono SIL Open Font License notices are preserved in `licenses`, hosted builds and the portable file. No remote image/audio/font service is required during play.

Physical iOS/Android hardware and Safari/Firefox have not been tested. Daily competition and saves remain local/honor-system. World characters use expressive sprites, bob/flip movement and dash ghosts rather than full directional animation sheets; hit cutaways add original staged character and object animation. This is a compact arcade-stealth survival game, not a long narrative RPG. A map-aware controller clears floors faster than a first-time exploratory player; pacing and subjective enjoyment still need human feedback.
