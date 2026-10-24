# Premium entrance (Phase 14)

The **Royal Chart Room** theme introduces an elegant TV welcome screen and matching phone controller. The TV already creates a room automatically on connecting; the four-letter code and QR appear on the welcome screen, and **Enter Harbour Lobby** reveals the existing host controls. The welcome screen automatically closes on the first player joining; active/recovered voyages open directly on the game board. No game rules, Mirelo audio, pairing or persistence behaviour has been removed. See `PHASE14-PREMIUM-DESIGN.md` for details.

## Phase 13 audio improvements

Audio playback now limits simultaneous sounds on TV and phone. Mute immediately stops live effect instances. The new `tools/verify_mirelo_installation.py` enforces a real audio-file release gate, rather than claiming generated links equal deployed audio. See `PHASE13-AUDIO-QA.md`.

# TIDEWATER — Phase 12 (v0.12.0)

**Phase 12: manual, host-authorised portable match recovery.** On hosts without a persistent volume (including Render's Free tier), the host can pause an active match, download a private JSON backup from the TV/PC, and later restore it into a *new empty lobby* after the server is replaced. The import keeps the original room code and captain credentials, preserves private orders and inventories, and resumes only when the host explicitly chooses Resume. Unauthorised downloads and overwrites of existing rooms are rejected.

The backup file contains **unencrypted private tokens, secret orders and inventories**, so keep it confidential. The backup is manual, not a guarantee of persistent or continuous storage. See **`PHASE12-QA.md`** for usage, limitations and verification instructions. Existing gameplay rules, the original `SPECIFICATION.md`, avatar art and sound are unchanged.

**Phase 12 QA:** `npm test` / `node --test` passed **117/117**; the seven synthetic Chromium phone/TV checks passed. Real-device failover and the original WebSocket acceptance runner were **not executed in this development environment**. GitHub and Render deployment remain separate steps.

---

# TIDEWATER — Phase 11 (v0.11.0)

**Phase 11: host-disconnect safety and a repeatable real WebSocket acceptance harness.** If the authenticated TV host drops offline during an active voyage, planning and outstanding deal timers now freeze automatically; the host reconnects with the existing credentials and explicitly resumes the voyage. Stale host close events do not pause a newly authenticated TV session. No core game rules or original `SPECIFICATION.md` have changed.

Run automated checks: `npm test` (113 Node tests), then `npm run test:live` (real local TCP/WebSocket host and two captains, requiring `npm install`). `npm run test:release` runs both. GitHub Actions runs these checks upon a pushed branch/PR once this code is uploaded. For verified results, limits and real-device release checklist, read **`PHASE11-QA.md`**.

**Test limitation:** the `ws` dependency was unavailable in this build environment owing to npm registry DNS failure. The full 113-test mocked-transport suite and seven Chromium synthetic-layout checks passed, but the new live acceptance runner could not be executed here. Physical TVs, phones and Render disk recovery are not yet acceptance-verified.

---

**TV-hosted, phone-controlled, server-authoritative island trading game.**

**Phase 10 is the game-night reliability and QA pass.** It adds a last-known-good backup for durable match snapshots, protects the host and other captains when an outgoing WebSocket send fails, and introduces automated full-voyage protocol tests for 2, 4 and 8 human captains in all three game modes. Existing music, sound effects, portrait art and original game specification remain unchanged.

## What changed in Phase 10

- **Recoverable local state:** `data/rooms.json.bak` preserves the last valid previous snapshot (0600 permissions). If the primary snapshot is corrupt, stop the server, preserve the damaged original, restore the backup to the configured `TIDEWATER_STATE_FILE`, then restart; recovered active voyages are paused pending host resume. This is a *single-instance* last-known-good snapshot, not a database or off-site backup.
- **Fault-isolated broadcasts:** a disconnected socket throwing during a state broadcast no longer prevents other captains receiving updates.
- **Full-voyage acceptance simulations:** 2-, 4- and 8-person lobbies proceed through captain selection, snake placements, 8/12 planning rounds, final results and shared-state privacy checks in Quick, Standard and Advanced modes.
- **Interruption tests:** automated cases now cover AI takeover, restart/backup recovery, pausing during a partially locked round, and protection against non-member actions.
- **QA:** **106/106 Node tests passed**; the six-width Chromium interface smoke test also passed. These are in-process simulated WebSocket connections, **not** proof of genuine physical TV/phone multiplayer.
- **Release guidance:** see `PHASE10-QA.md` for real-device testing, Render persistent disk requirements, audio checks, and restore procedure.

## Phase 9 reconnect hardening (retained)

Phase 9 builds on restart recovery with **stronger reconnect safety, resilient phone order drafts and responsive TV/phone layouts**, while preserving all Phase 7 trading, diplomacy, naval-combat, artwork and audio systems. The original `SPECIFICATION.md` is retained unchanged and remains the authoritative gameplay specification.

## What changed in Phase 9

- **Session handover security:** reconnecting on another browser/device immediately invalidates an old captain or host socket. Old frames cannot change live state after handover.
- **Heartbeat detection:** the server sends periodic WebSocket ping frames; disconnected or unresponsive clients are removed from the active session, allowing the existing rejoin/AI replacement path to work.
- **Phone draft recovery:** the two secret order choices are saved only in that phone tab's sessionStorage, scoped by room, captain and round. Focused editors are no longer replaced by routine server updates, and offline edits survive a page reload in that tab.
- **Connection feedback:** both screens indicate lost connections; actions are guarded while offline. A second tab/device takeover does not trigger endless reconnect contention.
- **Layout improvements:** 320px phone-header overflow fixed, supporting text made easier to read and the TV presentation uses larger overscan margins.
- **QA:** **90/90 automated tests passed**, including nine new regressions. Chromium visual/input smoke checks succeeded at 320, 390, 600, 760, 1280 and 1920px using **mocked WebSocket messages**, not genuine transport sessions. See `PHASE9-QA.md`.

## Phase 8 match recovery (retained)

- **Durable snapshots:** one local JSON room snapshot updated automatically when room state changes, written atomically with restricted file permissions; the file contains sensitive room/session credentials and must remain private.
- **Server restart recovery:** saved room codes, host and player tokens, private plans, inventories, contracts, upgrades, trade offers and the full board can be restored into an explicitly paused state.
- **Host Pause/Resume:** the host can pause a match at any time during opening placements or planning and resume it on their TV/PC. Planning and pending-deal clocks retain their remaining time.
- **Phone/TV UX:** both screens show when a voyage is paused, with protected gameplay actions and a clear host Resume button. The host can recover their own room after closing their browser using same-profile localStorage.
- **QA:** added actual HTTP asset smoke tests (using a mocked WebSocket transport), persisted-state and rejoin protocol tests, plus authorisation and UI regression tests. **81 automated tests pass.**
- **Security:** automatic snapshots live outside `/public`; `.gitignore` excludes stored rooms and dependency folders. Snapshot errors are exposed by the health check.

### Storage and hosting

Start the game normally with `npm install && npm start`. By default saved rooms are written to `data/rooms.json` inside the project. You may point to a separate protected directory using an absolute path:

```sh
TIDEWATER_STATE_FILE=/var/data/tidewater-rooms.json npm start
```

**Important:** the default app filesystem on managed hosts can be ephemeral. On Render, mount a persistent disk and set `TIDEWATER_STATE_FILE` inside its mount before relying on recovery after a redeploy or replacement. This release is **single-instance only**; it does not implement a shared multiplayer database or multi-node locking.

**To resume after a restart:** open the TV as the same host/browser profile; the saved host code and token are recovered automatically. Players reconnect on their original phone browsers, retaining their seats. Press **Resume Saved Voyage** on the TV when ready. Timers do not count down during the pause. The host can also use **Pause Voyage** mid-match without restarting the server.

Read `PHASE8-QA.md` for a full human acceptance checklist and precise testing limitations.

### Phase 7 features retained

- Bundled 20-second maritime theme and eight original digital sound effects (`.ogg` and `.mp3`), with independent opt-in sound/music controls.
- Captain-specific two-order AI, Renown goals, mobile quick rules and naval-combat reports.
- The 960 simulated Phase 7 voyages and their published outcomes remain in `BALANCE-REPORT.md`. This phase did **not** modify gameplay balance or rerun that large tournament.

## Requirements

- Node.js **20+** and npm.
- A TV, PC or laptop for the shared chart, and a phone, tablet or another browser tab for each player.
- All players must reach the same host over HTTPS/WSS in production (or via its local network address when testing).

## Run locally

```sh
npm install
npm test
npm start
```

Open `http://localhost:3000/tv.html` on the host. The host displays a **four-letter room code** and a QR code. Open the phone link on a different device or browser tab, pick an available captain, and tap **I'm Ready**. Two or more captains are required. The host presses **Set Sail**.

If using separate devices on a home network, use the host PC's local IP address instead of `localhost` so phones can connect to that PC.

### Sample game

1. Start a **Quick** voyage (8 rounds; 60-second planning timer).
2. Each player places two free Settlements in snake order. Each gets one Warship.
3. On each phone's **Captain's Log**, select two orders. `Hold Position` is allowed when you cannot or do not wish to spend resources.
4. Press **Hoist Sails** to lock the orders. They cannot be altered once submitted.
5. The server reveals the round when everyone submits, the timer expires, or the host presses **Reveal Now**.
6. Watch the new chart state, resource balances, Renown and prices update, then plan the next round.

## Order types available in this build

| Order | Cost | Effect |
| --- | --- | --- |
| Settle | 1 Fish + 1 Timber | Claim an unowned production isle, Harbour or Reef within reach of your island or claimed sea lane. |
| Build Port | 2 Spice + 2 Silk + 1 Timber | Upgrade an owned Harbour; earn 2 additional Renown. |
| Chart Lane | 1 Timber + 1 Silk **per segment** | Claim a complete, available lane which touches an owned island. Closed at Low Tide. |
| Launch Warships | 2 Gold each, 1–3 in an order | Station on an owned island. |
| Explore | 3 Gold + 1 Spice | Draw 1 Voyage Contract from the remaining deck. One successful Explore per captain per round. |
| Raid | Free order slot | Commit adjacent Warships to a simultaneous end-of-round battle. Defenders win ties; Reefs, Ports and Coastal Forts improve defence. |
| Go to Market | Free order slot; payment for purchases | Buy goods for displayed price +1 per unit, or sell at the current price. Multiple goods per order (up to 10 of each / 20 total). |
| Offer a Deal | Free order slot | Propose a private exchange of goods and/or Gold to another captain. Recipient accepts or declines within up to 20 seconds. |
| Hold Position | Free | No action, using one of the two order slots. |

The Phone highlights candidate expansion islands; the server checks adjacency, costs, ownership and Low Tide before accepting an order. Planned orders are validated together so a player cannot submit a planned double-spend. Execution happens in **rotating player order**. When a valid planned action becomes impossible because of other players, the player is not charged and receives the specified **+1 Gold failed-order compensation**.

### Market price handling

Market prices start at **2**. Every sell order reducing a particular good's price lowers the current price for later orders in that round by **1**, minimum 1. The market board publishes the new prices at the end of Reveal. Unsold goods rise by 1 (maximum 4). Buying does not alter prices. Trade purchases cost price **+1** for each unit. This is the current implementation interpretation of potentially ambiguous market wording in the specification.

### Scoring (current build)

- Claiming a Harbour earns **1 Renown**.
- Upgrading that Harbour to a Port earns **an additional 2 Renown**.
- First reaching **10 Renown (Quick)** or **15 (Standard)** at resolution, or having the most Renown at the final round, wins. Ties break by Gold, then claimed sea lanes, then remain tied.
- Voyage Contracts award 2–3 Renown as completed. **Longest Trade Route** and **Mightiest Fleet** award 2 Renown to the unique current leader; when leadership changes those points move to the new owner, and ties leave the trophy unclaimed. A fleet must have at least 5 Warships.
- **Master Trader** awards +1 Renown to the leading seller(s) at the end of each era, based on Gold earned from Market sales in that era. No award is issued if nobody sold anything.
- Era Upgrade Cards and their principal abilities are enabled. Advanced mode now adds weather, captain-specific perks and an unfinished-contract deduction at match end.

At the beginning of a round, each owned production isle gives one good, Harbours give 1 Gold, Ports 2 Gold, and open claimed sea lanes give 1 Gold (+1 if connected to the Grand Bazaar). A house tied for last Renown also receives +1 Gold. The tide changes before income is paid, and the next tide is visible in advance.

The **Quick** Era timeline is 3 Sail / 3 Cannon / 2 Steam rounds; **Standard** is 4 / 4 / 4. On the first planning round of each era, the phone offers 3 relevant upgrade cards. Choose **one before locking orders**; if none is chosen, the server automatically assigns the first listed option at Reveal so the draft is compulsory without blocking a timed game. Different players may choose the same upgrade.

### Voyage Contracts in this delivery

- Each captain receives **3 private Voyage Contracts** (the original two plus a reserve choice). During the first planning window they can keep exactly 2. The discarded card returns to the common deck. If no selection is made before Reveal, the first two are kept automatically.
- `Explore` draws **1 additional contract**.
- Completed contracts award **2–3 Renown** automatically at the end of Reveal.
- The present UI implements **choose exactly 2 of 3**, a tighter interpretation of the specification’s “keep at least 2” requirement; this should be reviewed during multiplayer testing. If all eight captains are present, newly discarded contracts become available at the first Reveal.

### Private trading rules

- A trade offer uses **one of the two order slots**. On locking your orders, the recipient gets a private offer to exchange the specified goods or Gold. The sender cannot cancel a locked offer.
- Both sides must offer something; amounts must be whole numbers and the sender must own their outgoing goods. At acceptance the server rechecks the two warehouses and performs both transfers together.
- The acceptance window is **up to 20 seconds**, closing at the earlier of 20 seconds or the end of the planning timer. All player orders can be locked while a deal is pending; Reveal waits for its answer or expiry unless the host explicitly ends the round. Declined/expired offers do not transfer any goods.
- Successful exchanges are announced by captain name on the TV; transaction terms remain visible only on the two participating phones.

### Era upgrade cards

| Era | Choices | Effects |
| --- | --- | --- |
| Sail | Shipwrights / Fishmongers' Guild / Privateers | Discount Timber when charting a lane / sell Fish for at least 3 Gold / add 2 Warships now, 1 at later era changes |
| Cannon | Deep Harbours / Trade Winds / Coastal Forts | Discount Silk when building Ports / earn lane income despite Low Tide / +1 defence to owned islands |
| Steam | Steam Packets / Admiralty House / Chamber of Commerce | Chart during Low Tide / first owned Port gains +2 Renown / +1 per completed Voyage Contract |

Raid capture transfers the ownership-related Renown of Harbours and Ports. A house with no islands automatically receives a free vacant settlement at the start of the following round when a legal unclaimed tile exists.

## Render deployment

This package includes `render.yaml` for a Node web service. Push the files to your own repository, connect that repository to Render as a Blueprint/web service, and deploy. Render supplies the `PORT` environment variable automatically; this server binds to `0.0.0.0`.

The health probe is `/health`. The server now writes **single-instance JSON snapshots** via `TIDEWATER_STATE_FILE` (default `data/rooms.json`). For reliable restart recovery, configure a **persistent disk** and point `TIDEWATER_STATE_FILE` inside its mount. The default application filesystem may be ephemeral after deployment. Restarted active games are paused until the host resumes. Multi-instance scale-out is not supported.

## Automated QA

Run `npm test`. The 90-test suite covers game rules, trading privacy, server authorisation, deals, upgrades, trophy transfers, image/audio HTTP serving, chart generation, simulated voyages, on-disk recovery, host pause/resume and inline UI script syntax. It also catches double-trading, invalid deal quantities and unauthorised acceptance. Phase 9 adds stale-session handover tests, WebSocket heartbeat tests and a synthetic Chromium layout/editor smoke script (`python tools/phase9_browser_smoke.py`). Real browser-device and actual WebSocket transport QA remains necessary.

**Testing limitation in this delivery environment:** the `ws` dependency is not available in the local npm cache, so live end-to-end testing through real browser WebSocket connections could not be completed here. The automated protocol tests use a mock transport. Do not treat this as confirmation that the full multi-device application is production-ready.

## Phase 5 — Advanced Weather and perks (retained)

- **Quick and Standard:** Weather events and avatar abilities stay disabled.
- **Advanced:** each round draws one Weather card without repeats until all twelve have been used. All weather is public, although Fog hides the following round's tide preview.
- **Fair Winds:** normal island, Harbour, sea-lane and catch-up income doubles. **Storm:** no lane income, even with Trade Winds.
- **Doldrums:** cannot Chart Lanes. **Spice Fever / Silk Glut:** market price set to 4 / 1 at the beginning of the round.
- **Big Catch:** +1 Fish per fishing isle. **Pirate Sighting:** houses with zero Warships lose 1 Gold (not below zero).
- **Royal Regatta:** leaders tied for most sea lanes each earn 1 Renown, provided at least one lane is held. **Fog:** next Tide preview is hidden.
- **Calm Seas:** no Raid orders. **Merchant Fleet:** purchases cost their listed market price. **King Tide:** two distinct lane colours close.
- **Captain perks:** Isadora half-price Warships; Tobias ignores Low Tide once per round (used on the first eligible income lane, otherwise available for one Chart Lane); Rosa +1 Gold for every Spice sold; Finch +1 Fish per fishing isle in Sail; Mei-Lin −1 Silk per Port; Hugo −1 Timber per Chart Lane; Nyla rolls two dice and uses the higher result per battle; Felix sells at no less than 2 Gold per unit. Upgrade discounts stack with avatar discounts but costs never become negative.
- **Unfinished Voyage Contracts:** each unfinished card deducts 1 Renown at the end of an Advanced match, with score floored at zero. The penalty counts when deciding whether a Renown threshold has been reached.

## Outstanding work

- **Multiplayer acceptance testing** on TV, PC and mobile devices, including game reconnects, Weather/tide transitions, AI fill-ins and timing races, is still required.
- **Persistent snapshots** are now available, but **Render needs a persistent disk** before recovery across service replacement can be guaranteed.
- **Simultaneous raid fairness and structured battle reports** are already implemented; real-player clarity and naval balance still need acceptance testing.
- **Audio** now includes original bundled digital soundtrack and effects, but naturalistic/studio-quality recorded audio has not yet been commissioned.
- **Avatar art** covers eight neutral Sail-era portraits; Cannon/Steam outfits and additional expressions are still outstanding.
- **Design decisions needing approval:** exact two-contract choice, Weather tie handling, fallback era upgrade order and Nyla's higher-of-two dice interpretation.

## Security/architecture

- Server is authoritative for the implemented rules, simultaneous combat, private deals, upgrades, trophies, resources, prices, round timing and resolution.
- Player inventory, locked order details and credentials are not broadcast to the TV or other phones. Deal details are shown only to their sender and recipient; the shared state exposes only order-ready status.
- Authenticated session tokens allow rejoining a seat; secrets are not broadcast. Host-only controls are checked on the server.
- HTML/CSS/JS self-contained under `public/`, no runtime CDN; only the same-origin WebSocket is required.

Refer to `SPECIFICATION.md` for the eventual complete rules and `CHANGELOG.md` for what changed.


## Phase 6 — simultaneous naval combat

The server gathers every valid Raid during the Reveal and resolves them against **one frozen pre-battle map**. This corrects an older flaw in which a fleet could be used twice or a captured island could influence another battle in the same Reveal. The following are explicit resolution conventions added where `SPECIFICATION.md` leaves details open:

1. **Commitment:** each originating island’s fleet is committed to the first Raid that legally uses it (rotating order). Later Raid orders cannot reuse those ships. If all available source fleets are already committed, the Raid fails and earns the normal +1 Gold compensation. Two Raids with disjoint source fleets remain legal.
2. **One contest per target:** if several houses attack the same island, each contributes its committed fleet and rolls **one six-sided die**. The original defending house contributes its uncommitted Warships, defence bonuses and one die. Nyla’s one reroll applies in Advanced mode.
3. **Victory:** a unique attacker must beat **both the defender and every other attacking house**. All equal-highest attacking scores cause a defensive stalemate; a tie between attacker and defender also favours the defender. Battles remain simultaneous even when armies attack one another’s original launch islands.
4. **Casualties:** the winner loses one Warship where possible; each defeated force loses half of its committed ships, **rounded up**. Surviving attackers return to still-owned home islands. Defending survivors retreat to their nearest remaining owned island. If none exists, they are lost at sea.
5. **Scoring and reporting:** Harbour and Port ownership Renown transfers only once per capture. A structured public battle report records the destination, contenders, dice, strengths, bonuses, casualties and victor. Private inventories, contract choices and credentials stay confidential. The latest round’s battles remain visible during the following planning round.

**Game feedback:** the TV and phone show recent naval battle reports and highlight affected islands, with reduced-motion and keyboard-accessible interfaces preserved. Phase 7 replaces the earlier oscillator-only effects with original bundled MP3/Ogg cues. This is not yet a professionally recorded production package.

**Historical QA:** Phase 6 reached **67 tests**; Phase 7 reached **71**; Phase 8 reached **81**; Phase 9 reaches **90 automated tests**, plus synthetic Chromium layout/input checks. Real-device TV/phone multiplayer and audio QA remains outstanding because a usable local WebSocket installation and physical devices are not available in this build environment.

**Deployment:** GitHub/Render are not automatically updated by creating this archive. Commit and deploy separately. Phase 8 can recover active rooms *only when its state file is retained*; deploys that replace an ephemeral filesystem still reset matches.

### Mirelo effects installed — v0.13.1

Eight professional user-provided Mirelo WAVs have been installed for bell, build, cannon, deal, market, tide, victory and warning; browsers use local MP3/Ogg, original WAV masters are retained, and provenance is recorded in `public/audio/mirelo-assets.json`. Verify with `npm test` and `python tools/verify_mirelo_installation.py`. Music is unchanged.
