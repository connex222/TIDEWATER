# TIDEWATER — Phase 4 (v0.4.0)

**TV-hosted, phone-controlled, server-authoritative island trading game.**

Phase 4 builds on the approved logo, eight photorealistic captains, contracts, exploration and naval raids. It adds private 20-second player deals, optional per-era upgrade selections and trophy scoring. All artwork has been repackaged in high-quality WebP for faster TV and phone loading. The original `SPECIFICATION.md` is retained unchanged as the **authoritative design specification**.

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
| Raid | Free order slot | Attack an adjacent enemy island using all adjacent Warships. Defender wins ties; Reefs and Ports improve defence. |
| Go to Market | Free order slot; payment for purchases | Buy goods for displayed price +1 per unit, or sell at the current price. Multiple goods per order (up to 10 of each / 20 total). |
| Offer a Deal | Free order slot | Propose a private exchange of goods and/or Gold to another captain. Recipient accepts or declines within up to 20 seconds. |
| Hold Position | Free | No action, using one of the two order slots. |

The Phone highlights candidate expansion islands; the server checks adjacency, costs, ownership and Low Tide before accepting an order. Planned orders are validated together so a player cannot submit a planned double-spend. Execution happens in **rotating player order**. When a valid planned action becomes impossible because of other players, the player is not charged and receives the specified **+1 Gold failed-order compensation**.

### Market price handling

Market prices start at **2**. Every sell order reducing a particular good's price lowers the current price for later orders in that round by **1**, minimum 1. The market board publishes the new prices at the end of Reveal. Unsold goods rise by 1 (maximum 4). Buying does not alter prices. Trade purchases cost price **+1** for each unit. This is the current implementation interpretation of potentially ambiguous market wording in the specification.

### Scoring in Phase 4

- Claiming a Harbour earns **1 Renown**.
- Upgrading that Harbour to a Port earns **an additional 2 Renown**.
- First reaching **10 Renown (Quick)** or **15 (Standard)** at resolution, or having the most Renown at the final round, wins. Ties break by Gold, then claimed sea lanes, then remain tied.
- Voyage Contracts award 2–3 Renown as completed. **Longest Trade Route** and **Mightiest Fleet** award 2 Renown to the unique current leader; when leadership changes those points move to the new owner, and ties leave the trophy unclaimed. A fleet must have at least 5 Warships.
- **Master Trader** awards +1 Renown to the leading seller(s) at the end of each era, based on Gold earned from Market sales in that era. No award is issued if nobody sold anything.
- Era Upgrade Cards and their principal abilities are available as optional choices; Advanced mode and its avatar perks remain disabled.

At the beginning of a round, each owned production isle gives one good, Harbours give 1 Gold, Ports 2 Gold, and open claimed sea lanes give 1 Gold (+1 if connected to the Grand Bazaar). A house tied for last Renown also receives +1 Gold. The tide changes before income is paid, and the next tide is visible in advance.

The **Quick** Era timeline is 3 Sail / 3 Cannon / 2 Steam rounds; **Standard** is 4 / 4 / 4. On the first planning round of each era, the phone offers 3 relevant upgrade cards. Choose **one before locking orders**. Unlike a compulsory draft, unchosen upgrades are skipped rather than automatically assigned; this is a documented Phase 4 simplification. Players may choose the same card as each other.

### Voyage Contracts in this delivery

- Each captain begins with **2 secret Voyage Contracts** from a shared deck.
- `Explore` draws **1 additional contract**.
- Completed contracts award **2–3 Renown** automatically at the end of Reveal.
- This is a practical Phase 3 slice; the specification's full “draw 3, keep at least 2” draft step is still a later UX refinement.

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

Raid capture now transfers the ownership-related Renown of Harbours and Ports. A house with no islands automatically receives a free vacant settlement at the start of the following round when a legal unclaimed tile exists.

## Render deployment

This package includes `render.yaml` for a Node web service. Push the files to your own repository, connect that repository to Render as a Blueprint/web service, and deploy. Render supplies the `PORT` environment variable automatically; this server binds to `0.0.0.0`.

The health probe is `/health`. All rooms and games are currently held **in process memory**; restarting the instance discards active games. Persistent storage/recovery and scale-out are later architecture tasks. For reliable casual game nights, use one always-on instance and do not restart it during a match.

## Automated QA

Run `npm test`. The suite covers game rules, trading privacy, server authorisation, deals, upgrades, trophy transfers, image HTTP serving, chart generation, simulated voyages and inline UI script syntax. It also catches double-trading, invalid deal quantities and unauthorised acceptance. Full browser-device QA remains necessary.

**Testing limitation in this delivery environment:** the `ws` dependency is not available in the local npm cache, so live end-to-end testing through real browser WebSocket connections could not be completed here. The automated protocol tests use a mock transport. Do not treat this as confirmation that the full multi-device application is production-ready.

## Phase 4 limitations / subsequent work

- **Not implemented:** Advanced Weather cards, avatar-specific perks, full initial Voyage Contract selection (deal 3/keep at least 2), strict compulsory era drafts, and durable match persistence.
- **Trophy tie interpretation:** ties for Longest Trade Route or Mightiest Fleet are unclaimed. Master Trader ties share the 1-Renown award. These choices must be confirmed through playtesting against the authoritative specification.
- **Sea battles** are server resolved but the specified simultaneous-battle fairness and animation polish still need a multiplayer review.
- **Advanced mode** is disabled in the host UI until its distinguishing rules are available.
- **Avatar art** includes eight photorealistic Sail-neutral portraits and a prestige logo, with WebP packaging. Cannon/Steam outfits and smug/furious expressions remain planned.
- **Audio** uses simple generated bell/market/build/tide/victory feedback when enabled on the host, not the final recorded/generative sound package.
- **Typography** still relies on system font fallbacks; the specification's locally bundled IM Fell English and Inter font files have not yet been supplied.
- **Persistence** is limited to a rejoin token in the phone's `localStorage`; the server itself is not backed by a database.
- **Accessibility/browser QA** needs a physical TV/phone pass, including TV overscan, colour contrast, touch ergonomics and screen-reader interactions.

## Security/architecture

- Server is authoritative for the implemented Phase 4 rules, private deals, upgrades, trophies, resources, prices, round timing and resolution.
- Player inventory, locked order details and credentials are not broadcast to the TV or other phones. Deal details are shown only to their sender and recipient; the shared state exposes only order-ready status.
- Authenticated session tokens allow rejoining a seat; secrets are not broadcast. Host-only controls are checked on the server.
- HTML/CSS/JS self-contained under `public/`, no runtime CDN; only the same-origin WebSocket is required.

Refer to `SPECIFICATION.md` for the eventual complete rules and `CHANGELOG.md` for what changed.
