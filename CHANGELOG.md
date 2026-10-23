# Tidewater development history

## v0.11.0 — Phase 11: Multiplayer Acceptance & Host-Loss Safety

- Automatically pause in-progress voyages when the active TV host disconnects. Preserve remaining Plan and Deal countdowns, inventories and all locked orders.
- Authenticate rejoining hosts with the existing token and require the host to explicitly resume. A superseded host's delayed close never pauses the successor.
- Expose a public, non-sensitive pause reason for more useful host/phone status messages; restore interrupted matches with a `server-restart` pause reason.
- Add a genuine TCP/WebSocket local acceptance runner (`npm run test:live`) covering QR, unauthorised clients, join/ready, snake placements, private contracts/orders, host outage/rejoin and complete Quick games.
- Add GitHub Actions automated checks for the full Node suite plus the real WebSocket loopback runner after repository upload.
- Add seven regression tests and an explicit physical-device/Render release checklist (`PHASE11-QA.md`).
- QA in this build environment: 113/113 Node regression tests and 7/7 synthetic Chromium smoke checks passed; live WebSocket test requires installing `ws` and could not execute here.


## v0.10.0 — Phase 10: Game-Night Reliability & Release QA

- Added a permission-restricted `.bak` backup containing the previous valid match snapshot, with an explicit manual restore route that preserves the corrupt primary.
- Protected state broadcasts from failing socket sends; other players and the TV continue receiving updates.
- Added complete, in-process multiplayer protocol scenarios for 2, 4 and 8 human captains across Quick, Standard and Advanced.
- Added tests for AI takeover after disconnection, host pause/resume during partially locked planning, snapshot backup secrecy and intruder rejection.
- Updated TV/phone footer and rules scope labels, without altering the original design specification.
- **106/106 automated Node tests passed**; synthetic Chromium layout/input checks at 320, 390, 600, 760, 1280 and 1920px passed.

**Testing boundary:** the real `ws` package could not be installed in this environment, so the WebSocket tests use a mock transport. Live phone-to-TV connectivity, sounds on real hardware, persistent Render disk mounts and real games-night balance still require external testing. GitHub/Render deployment is separate from local packaging.


## v0.9.0 — Phase 9: Reconnect Safety & Screen Polish

- Hardened host/captain session authorisation: a superseded WebSocket cannot perform any bound gameplay action after a new authenticated connection takes control, including commands arriving during the old socket's close handshake.
- Added RFC 6455 ping/pong heartbeat checks, terminating unresponsive connections so disconnected seats are shown accurately and can rejoin or be replaced with an AI captain.
- Added a bounded 80-message-per-10-second WebSocket request limit to protect private games from accidentally flooding the server.
- Added TV and phone connection-status banners; a captain taken over on another tab is informed rather than trapped in repeated reconnect loops.
- Preserved two-slot secret order drafts locally in phone sessionStorage, including edits during network interruption and page refreshes. Routine room updates no longer recreate a focused order editor.
- Corrected 320px-wide phone-header overflow, improved auxiliary text contrast and font sizes, and increased overscan safety on large TV screens.
- Added nine automated regression tests (new total **90**) for superseded sessions, heartbeat, rate limiting, cross-origin security and UI safeguards.
- Ran a **synthetic Chromium visual/input smoke test** at 320, 390, 600, 760, 1280 and 1920px. Tested draft preservation across server pushes, disconnect, offline edits and simulated reload. **Not** a real WebSocket or physical-device acceptance run.

**No gameplay costs, scoring values or art/audio assets were changed.** The original `SPECIFICATION.md` remains the game bible. Full multi-device end-to-end acceptance is still required.


## v0.8.0 — Phase 8: Match Recovery & Host Controls

- Added atomic local room snapshots with restrictive permissions and explicit schema validation, including full game state and hidden private orders.
- Restored rooms are paused, rather than allowing stale round or trade deadlines to resolve while captains are offline.
- Added host-only Pause Voyage and Resume Saved Voyage actions, including remaining timer and outstanding deal window restoration.
- Extended the host TV and player phone to show recovery status and prevent active gameplay actions during the pause.
- Retained the host's rejoin token in same-profile localStorage so a closed host tab can recover its original room after a restart.
- Added persistence, recovered protocol session, authorisation, static HTTP and UI tests; 81 automated tests pass.
- Included private-data `.gitignore`, Render persistent disk deployment guidance, and a human TV/PC/phone acceptance checklist.

**Limitations:** Snapshot recovery is local and single-instance, requires persistent disk storage for survival of platform replacement, and has not been exercised in an actual multi-device WebSocket/browser session. No gameplay rules, thresholds or balance values were changed.


## v0.7.0 — Phase 7: Audio, accessibility & strategy balance

- Added 20-second original procedurally composed maritime theme in MP3 and Ogg.
- Bundled eight designed event cues: bell, tide, market, build, cannon, victory, deal and warning.
- Integrated local host sound effects, looping music, and master volume controls. Sound remains muted until a click; phone effects are a separate opt-in.
- Added safe static media serving for `/audio/` with MIME types and GET/HEAD support.
- Improved AI captains with distinct strategic priorities, two-slot legal order construction and resistance to double-spending or reusing one fleet for two raids.
- Added TV and phone Renown goal progress, a concise collapsible phone orders reference, and patterned sea-lane legend text.
- Executed **960** simple four-strategy simulated voyages, grouped by Quick, Standard and Advanced. Published results and cautions in `BALANCE-REPORT.md` and `BALANCE-REPORT.json`.
- Preserved all published game-bible costs, victory thresholds and scoring rules; balance findings require human validation.
- Added four regression tests for assets, safe HTTP audio serving, muted-by-default UI and valid AI orders. All **71 tests passed**.
- Remaining: full real-device multiplayer/browser verification, professional recorded/licensed audio, persistence and human game-balance playtests.



## v0.6.0 — Phase 6: Simultaneous Naval Combat and Game Feedback

- Reworked Raid resolution to use one frozen pre-battle state: no sequential capture advantage.
- Each island’s Warships may serve only one Raid per reveal; later conflicting Raid orders earn normal failed-order compensation.
- Multiple attackers on one target contest a single common defence; defender wins all ties and attacker-versus-attacker deadlocks.
- Cross-raids resolve simultaneously, including fleets that departed before their own home island was attacked.
- Enforced winner/loser casualty rules and supported defender withdrawal/stranded survivors.
- Preserved Port, Harbour and Admiralty House Renown transfer upon capture.
- Added public structured battle reports, TV and phone battle panels, highlighted target islands, and optional cannon sound cue.
- Added 14 focused regression tests, including 80 deterministic multi-raid stress scenarios; 67 automated tests passed.
- Explicit simultaneous battle conventions documented in README; the authoritative SPECIFICATION.md remains unchanged.



## v0.5.0 — Phase 5: Advanced Mode and Captain Identity

- Enabled server-controlled Advanced mode with twelve unique Weather cards per 12-round voyage, King Tide, Fog-hidden previews and weather-modified trade/combat/income.
- Implemented all eight avatar-specific abilities, active only in Advanced mode, with phone-side descriptions.
- Introduced initial private 3-card Voyage Contract drafting, choosing 2 and returning the discarded card to the deck, with automatic fallback for timed rounds.
- Changed all eras to compulsory 1-of-3 upgrades, using a legal automatic fallback if the captain does not choose before Reveal.
- Added unfinished-contract penalties at an Advanced match conclusion; victory threshold accounts for the deductions.
- Retained Phase 4 WebP logo, all eight portraits, 20-second private deals, three-era upgrades, trophies and the 37-tile archipelago.
- Expanded test coverage for Weather, draft validation, market/perk discounts, forced upgrades and public-state hiding.

**Design interpretations:** the specification says “keep at least 2” contracts; Phase 5 requires exactly 2 for a predictable shared deck. Nyla uses the higher of two dice when re-rolling. Royal Regatta ties award every tied leader. Tobias's one-use exemption applies first to lane income if available; otherwise to a lane claim. These are implementation decisions, not edits to `SPECIFICATION.md`.


## v0.4.0 — Phase 4: Diplomacy, Eras & Admiralty Trophies

- Added private player-to-player Trade Offers with a 20-second acceptance window, atomic stock transfers, decline/expiry, and per-recipient WebSocket visibility.
- Added a 3-card upgrade selection at the opening round of each era; implemented all nine listed upgrade effects. The draft is currently optional and non-exclusive.
- Added Longest Trade Route, Mightiest Fleet and per-era Master Trader scoring; dynamic trophies change ownership and points when leadership changes.
- Fixed Phase 3's 26-card contract generator to produce the specified 24 cards.
- Added Harbour/Port Renown transfer when an island changes hands in a raid, plus a no-elimination free re-settlement safeguard.
- Optimised approved logo and Sail-neutral photorealistic portraits from ~24 MB combined PNGs to ~2.5 MB WebP, with a dedicated compass app icon.
- Added server and interface controls for trades and upgrades, TV trophy display, server-side validation and expanded tests.

**Remaining design interpretation:** upgrade selections are optional rather than compulsory, tied route/fleet trophies stay unclaimed, and deals expire at the planning deadline if less than 20 seconds remain. These choices do not alter `SPECIFICATION.md`.



## v0.3.0 — Phase 3: Identity, Contracts & Raids

- Integrated the approved Tidewater crest logo into TV and phone UI.
- Replaced coloured-initial captain selection with integrated portrait avatar artwork across join, lobby and shared-view surfaces.
- Added a static asset-serving route for bundled game art under `/public/art`.
- Added Voyage Contract dealing, hidden per-player contract state, end-of-reveal contract scoring and Explore order support.
- Added Raid order support with server-authoritative battle resolution, defender bonuses for Reefs/Ports and capture outcomes.
- Extended phone UI with contract display plus Explore/Raid order controls.
- Expanded automated tests to cover Explore and Raid flows.



## v0.2.0 — Phase 2: Trading & Expansion

- Live server-authoritative Plan → Reveal → next-round loop, 60/90-second time windows.
- Secret two-order phone editor, Hoist Sails lock, order validation, Hold Position option.
- Settle (islands, Harbours and Reefs), Build Port, Chart Lane, Launch Warships and Go to Market.
- Market price calculations, inventory accounting, low tide, lane income and Grand Bazaar income.
- Round-rotating execution order, failed contested order compensation, basic Renown & match completion.
- Legal target lists per captain; TV shows ready counts without exposing secret orders.
- Basic AI actions for subsequent rounds, early host reveal, reconnect-safe locked order state.
- Lightweight Web Audio cues for harbour arrivals, trades, build events, tide and match result.
- Extra automated tests for orders, security, market, resource invariants and full match simulations.

### Explicit rule interpretations pending design approval

1. **Port Renown:** +2 is added on top of the initial +1 for an owned Harbour.
2. **Last-place tie:** every captain tied for the lowest Renown gets 1 catch-up Gold.
3. **Market repricing:** each *sell order* reduces that good's price once (not once per unit). Changes take effect within resolution but are shown on the TV when Reveal completes.
4. **Sea lane adjacency:** a settlement may be placed within one hex-width of an owned sea lane's straight corridor.
5. **Hold Position:** a no-action order added so a captain with few resources is never forced to perform an illegal purchase.
6. **Failed orders:** resources are only debited on successful execution; a legal-at-submission order that fails during resolution gets +1 Gold.
7. **Advanced mode:** disabled in the host UI until its Weather/cards/perks are built.

These are implementation decisions, **not** changes to `SPECIFICATION.md`.

## v0.1.0 — Phase 1

- Four-letter rooms, QR, eight captains, TV/phone layouts.
- 37 hex tiles, 18 sea lanes, snake-order opening placement and initial tide/income.
- Rejoin tokens, basic bot placement, bundled specification and Render Blueprint.
