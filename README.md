# Tidewater — Phase 1 (v0.1.0)

A **runnable multiplayer foundation** for the Tidewater Isles, based on the full user-provided game specification in `SPECIFICATION.md`. This phase is **not** the complete game. Its playable journey ends after the opening settlements and Round 1 income.

## What is working

- Node.js HTTP + WebSocket server, using only the external dependency `ws`.
- Four-letter room codes, same-origin phone joins, and an on-server QR-code generator (no web service).
- Host-mode selection (Quick, Standard, Advanced), protected host controls, 2–8 captains, ready checks and duplicate-avatar prevention.
- Eight named captains with their official colours; initials-based portrait fallback is displayed until commissioned portrait artwork arrives.
- Persistent *client-side* rejoin tokens in `localStorage`; host session token in `sessionStorage`.
- Host can remove lobby players, add an AI captain, and replace a disconnected player with AI. Phase 1 AI selects legal initial settlements only.
- Server-authoritative 37-hex archipelago with exactly 6 Fish, 6 Timber, 5 Spice, 5 Silk, 6 Harbour, 4 Reef, 4 Open Sea and 1 Grand Bazaar.
- Exactly 18 sea lanes, 6 in each of Blue/Green/Silver, with lengths 2–4 hex segments. Solid/dashed/dotted line patterns aid colour discrimination.
- Correct snake-order two-settlement opening; each starts with one Warship. Initial personal resources are 2 Gold plus 1 of each good.
- First tide and next-tide preview; first-round island production income.
- Responsive TV and phone user interfaces; How to Play and lore accessible on both screens. TV has an opt-in synthesized notification bell.
- Automated tests for game state, geometry, protocol permissions, QR generation, and HTML script parsing.

## Run locally

Requirements: **Node.js 20+** and npm, with internet access to install the single runtime dependency.

```bash
npm install
npm start
```

Open `http://localhost:3000/tv.html` on the hosting computer. With a phone on the same Wi-Fi, **the TV page must be opened using the computer's local IP address**, e.g. `http://192.168.1.25:3000/tv.html`, so the QR code points to an address the phone can reach. On a public deployment, the QR uses the public domain.

1. On the TV, choose the game mode.
2. On each phone, scan the QR or enter `http://YOUR-HOST:3000/phone.html?room=CODE`.
3. Enter a name, select an unused captain and tap **Join the Fleet**, then **I'm Ready**.
4. When all captains are ready, press **Set Sail** on the TV.
5. Captains choose their two initial islands in snake order on their phones. The TV shows the public chart; private starting resources stay on phones.
6. After the last placement, Round 1 tide and production income resolve. Phase 1 ends there; later turns are deliberately disabled until the full rules are coded.

**Browser testing:** `localhost` and a private IP are different browser origins. For multiple test captains on one computer, use separate browser profiles/incognito windows so the `localStorage` rejoin credentials do not collide.

## Test

```bash
npm test
```

The tests use Node's built-in `node:test` runner. The protocol tests employ a deliberately small mocked WebSocket transport to exercise server action handling. **A real two-phone network/browser acceptance test has not yet been performed**, and was not possible in this build environment because npm registry access was unavailable.

## Deploy to Render

- New **Web Service**, Node runtime.
- Connect a GitHub repository containing these files.
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** `NODE_ENV=production` (optional). Render supplies `PORT`.
- Use a **single instance** while game rooms are held in memory. WebSocket sessions and rooms are not shared across instances.
- Open `https://YOUR-RENDER-DOMAIN/tv.html`. The room QR will point to your HTTPS phone page.
- Render free-tier hibernation or instance restarts will lose in-memory rooms. Persistence/recovery is a later hardening task.

**No GitHub push or Render deployment has been performed** as no destination repository/service was supplied for Tidewater in this request.

## Phase boundary and rule decisions

The original `SPECIFICATION.md` is authoritative. Phase 1 covers the networking, presentation and initial placement slices only. Deliberately **not implemented yet**: 24 Voyage Contracts or selecting 2 of 3, two secret orders, full 12-round turns and timers, market orders and prices changing, player deals, charting lanes, ports, warship purchases, battle dice, upgrades, weather, Renown victory checks, eras and Advanced avatar perks. The source does not specify names/details for all 24 Voyage Contracts.

The harbour tiles currently occupy six symmetrically distributed anchor positions two hexes from the Grand Bazaar to guarantee 18 short, traversable harbour/Bazaar connections; all other tile types and the lane colours are shuffled each game. This is a **topology implementation choice**, not a new player rule, and can be revisited with more natural sea-route geography.

The tie-handling rule for the "last place on Renown gets +1 Gold" catch-up is unspecified. To avoid assuming whether tied captains all qualify, that bonus is deferred until the round engine phase. Market sale price adjustment also differs in the brief ("drops 1 when anyone sells a good") versus the full build prompt ("drops by 1 per sell order"); this needs a clear decision before market logic is completed.

**Artwork/audio status:** Phase 1 includes designed CSS/SVG nautical branding and animated water, but **not** the requested commissioned 8 × 3 × 3 portrait set, bundled IM Fell English/Inter font files, or final gull/waves/coins/cannon/sea-shanty sound effects. No misleading artwork placeholders or external image requests are present; captain initials are the explicit specification fallback. The synth bell needs the user's first click to enable sound.

## Technology and privacy

All assets included in Phase 1 are local. The game uses no CDN, advertising or analytics. The server is authoritative for room membership and opening placement actions. Private captain inventory and rejoin credentials are never included in the TV public state. All rooms are ephemeral; do not rely on this phase to save a match across server restarts.

## Next build phase

1. Implement locked-in two-order planning, validated server resolution and final Market price updates.
2. Add island adjacency rules for Settle, Port prerequisites and owned-lane charting.
3. Introduce Voyage Contracts, Renown, trophy scoring and automatic win checks; agree contract contents and market price semantics first.
4. Add live timer, disconnect grace period, replay-safe command IDs, deterministic simulations and phone/TV acceptance testing.
5. Produce and integrate approved logo/art, portable font licenses and high-quality sound assets.
