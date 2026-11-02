# Clearer Escapes v2.2 — UX and Character Interaction QA

2 November 2026. Scope: make the existing game easier to learn and add personality without raising difficulty. Source and rebuilt main/docs stay in the same repository; hosting settings are not changed.

## Implemented

- Main strip presents Dodge, Throw Coffee and Fake Call. Optional advanced tools are under More Tools, with clear functional names and descriptions; the office pauses while choosing and a ready selection returns to play and activates once. Keyboard shortcuts 3–5 remain available.
- Brief, remembered, dismissible context tips teach relevant actions without stopping gameplay. Tips can be turned off.
- One shared danger grammar: common vision cones, outlined incoming hazards, filled active areas, mint interactions and a gold objective arrow. Numeric geometry and timings are unchanged.
- Only the actual current E target/in-progress steal shows a detailed loot label, matching what E will do.
- Purple house tokens automatically open WFH exits; no extra numbered action is required. The lift still works and key 6 remains a harmless compatibility explanation.
- A natural intern–founder meetup uses the existing actors: approach valid standing spots, face one another, gesture, show an animated AGENT demo and exchange five alternating lines over eight seconds. No teleport, new actor, player control, forced camera or damage. At most one attempt per run; busy actors give a breather, not an additional attack.
- Existing meeting attendees have clearer walking, book/hand and noticing reactions. Their model, counts, schedules, speed, sight and damage remain the same.
- An optional collapsed incident report after a run uses actual recorded counters/loot and can be shared using the existing Share button. It adds no gameplay rule or score system.

## Difficulty preservation — verified

`qa-evidence/difficulty-v21.json` was captured before changing the v2.1 release. Regression tests compare:
- Every major enemy's speed, range, FOV and damage.
- Ability cooldowns, durations and unlock floors.
- All lift waits.
- World dimensions, initial enemy roster/patrols, room traffic counts and schedules.

These values are unchanged. Existing director and traffic tests continue to cover damage, grace, warning windows and movement. No new foes or harder wave frequency were added. Social chats can suppress those occupied characters' attacks temporarily, and automatic WFH is a convenience benefit. This is not a claim of an identical human win rate.

## Final executed checks

### Build — PASS

TypeScript, Vite and portable/GitHub Pages packaging pass. The expected large-bundle warning remains because the engine/fonts are self-contained rather than fetched from a CDN.

Final `docs/index.html` / portable game: **1,990,245 bytes**.
SHA-256: **248e59d059cdb4bac07ecc307b4e5f590a5a77687f27cf25b6a978bb3d4dc92c**.

### Unit/data checks — 739 PASS

388 expanded-map/data checks; 100 shared logic/save checks; 72 enemy FSM checks; 63 director checks; 32 meeting traffic checks; 30 HR rhythm checks; 21 social-model checks; 20 loot checks; 11 context/report/difficulty checks; 2 progression migration checks.

### Browser journeys — 47 PASS

All 38 prior scenarios pass, including all eight hit cutaways, Long haul/skip, lethal-hit recovery, held theft/cancellation, score banking/loss, meeting walkouts/spotting, touch and layout checks.

Nine added scenarios verify:
1. Only primary tools appear initially; More Tools pauses, explains and activates correctly.
2. Advanced shortcuts still work without the drawer.
3. Tips dismiss without pausing and the preference persists.
4. Exactly one intended loot target is labelled with a clear E prompt.
5. A WFH token opens the exit without a numbered activation.
6. The intern and founder naturally meet in the actual authored floor, physically approach, display alternating animated conversation, remain distracted and finish normally.
7. The optional report reflects actual snack/loot/escape facts.
8–9. Primary controls and optional drawer remain usable in portrait and landscape touch viewports.

Natural chat validation used the real existing actor routes and a reproducible development seed, not a forced actor-position/chat hook. Player-only QA positioning was used to inspect the animation up close. Other isolated integration tests retain explicitly development-only positioning/hit helpers; these are not claimed as full no-cheat runs.

### Offline production smoke — 3 PASS

Networking disabled; production HTML loaded from file at 1280×900, 390×844 and 844×390. Actual movement/dodge, coffee, pause and viewport fit passed. No horizontal overflow, production QA helper or JavaScript error.

### Simple-controls production campaign — ALL FIVE PASS

Executed `SIMPLE_CONTROLS=1 npm run test:campaign` on the portable production release. This mode skips advanced ability shortcuts; play used movement/sprint, E, Space, Coffee and Fake Call. No player-position, health, clock or win mutation was available or used. The controller knows the authored map and reads the public read-only snapshot, so this demonstrates functionality/viability, not first-time human learnability.

| Floor | Game seconds | Final BS | Sightings | Hits | Dodge credits | Route |
|---|---:|---:|---:|---:|---:|---|
| Quick Sync | 30.6 | 16 | 0 | 1 | 1 | Lift |
| Mandatory Fun Friday | 36.1 | 10 | 2 | 1 | 1 | Lift |
| Yappening | 42.0 | 12 | 2 | 1 | 1 | Lift |
| All-Hands Ambush | 47.8 | 55 | 7 | 3 | 0 | Lift |
| Founder Mode | 49.8 | 25 | 6 | 2 | 1 | Lift |

All five passed on the first attempt in this final run. Automatic WFH is separately integration-tested; this run used all regular lifts.

## Retained limits

Physical iOS/Android devices, Safari and Firefox remain untested. Difficulty and subjective enjoyment still benefit from human feedback. Social chats are opportunistic, only where the existing actors can meet; they are not guaranteed on every floor/run. Local/honor-system records, no backend/LLM/analytics, original procedural art/audio and the existing larger maps remain unchanged. Committing a Pages build does not itself prove that the user's Pages deployment has been redeployed.
