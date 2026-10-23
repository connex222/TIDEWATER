# TIDEWATER — Phase 7 (v0.7.0)

**TV-hosted, phone-controlled, server-authoritative island trading game.**

Phase 7 builds on the naval-combat release with bundled original maritime soundtrack and sound cues, separate opt-in TV and phone audio controls, stronger computer captains, clearer Renown progress and a scripted strategy balance probe. The approved WebP artwork and original `SPECIFICATION.md` are retained unchanged.

## What changed in Phase 7

- **Audio:** a 20-second looping instrumental theme and eight original sound effects, each bundled in `.mp3` and `.ogg`. Both screens remain muted until a user enables audio. The host can control music, effects and volume independently; phone sound is optional. See `SOUND-DESIGN.md` for asset/production details. These are **procedural digital compositions**, not plugin-generated or professionally recorded audio.
- **Smarter AI:** captain-specific ordering priorities, two legal planned actions when affordable, a simulation pass to avoid overspending, conservative avoidance of committing the same fleet twice. No human player's private orders are consulted.
- **TV / phone usability:** accessible Renown-to-goal indicators, shorter board notation explaining patterned sea lanes, larger TV safe margin on common widescreen sizes, and a collapsible phone order reference.
- **Game balance research:** `BALANCE-REPORT.md` and `BALANCE-REPORT.json` document **960 artificial full voyages (320 Quick, 320 Standard, 320 Advanced)**. The sample did not show navy-only domination, but **Renown was generally low**. The rules, starting resources and victory thresholds have not been changed without user approval. These bots do not model expert human behaviour.
- **QA:** the existing 67 regression tests plus 4 new audio/security/UI/bot tests: **71 automated tests passed**. Actual mobile/TV browser multiplayer testing is still pending.

To repeat a fresh smaller tournament, use `npm run balance`. The sound files are ready to play without Python, but `python tools/generate_audio.py` can regenerate them during development with `numpy`, `scipy` and `ffmpeg`.


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

The health probe is `/health`. All rooms and games are currently held **in process memory**; restarting the instance discards active games. Persistent storage/recovery and scale-out are later architecture tasks. For reliable casual game nights, use one always-on instance and do not restart it during a match.

## Automated QA

Run `npm test`. The suite covers game rules, trading privacy, server authorisation, deals, upgrades, trophy transfers, image HTTP serving, chart generation, simulated voyages and inline UI script syntax. It also catches double-trading, invalid deal quantities and unauthorised acceptance. Full browser-device QA remains necessary.

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
- **Durable server storage** is still absent; a restart loses live rooms.
- **Simultaneous raid fairness and richer battle presentation** remain future improvements.
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

**Historical Phase 6 QA:** Phase 6 extended 53 tests with 14 focused tests (including 80 seeded-pattern combat stress scenarios), reaching **67 tests**. Phase 7 adds four further tests for **71 total**. Real-device TV/phone multiplayer and audio QA remains outstanding because a usable local WebSocket installation and physical devices are not available in this build environment.

**Deployment:** GitHub/Render are not automatically updated by creating this archive. The build needs to be committed and deployed separately; currently active rooms would be reset by a deployment because rooms are stored in server memory.
