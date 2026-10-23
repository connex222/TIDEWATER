# Tidewater development history

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
