# TIDEWATER — Phase 8 Recovery & Acceptance Checklist

## Automated results

Run `npm test` on Node 20+ after `npm install`.

Automated cases include the unchanged rules, 960 previously reported Phase 7 balance simulations (not re-run by `npm test`), private trading and battle regressions, mock WebSocket authorisation, on-disk snapshot round trips, atomic permissions, paused timer/deal restoration, host-only pause/resume, recovered captain rejoin, and HTTP/static asset smoke tests. The test runner uses mock WebSockets for protocol tests; it does **not** establish real browser WebSocket sessions.

## Real-device acceptance — NOT COMPLETED

The following require human testing in a deployed environment with actual TV/PC/phone browser clients and an installed `ws` dependency:

- [ ] Open TV host on a 16:9 television using its overscan-safe area; confirm no buttons, captions, Renown bars, room code or QR are clipped
- [ ] Use phones at 320 px, 390 px and tablet widths; confirm no sideways scrolling, legible contrast and easy one-thumb order entry
- [ ] Enter the four-letter code and test QR scanning on two different phones; join at least two captains
- [ ] Start a Quick game, perform the full snake-order placement, submit secret orders, confirm they do not appear on another captain’s phone or TV
- [ ] Leave one player disconnected, then reconnect with their localStorage seat token; verify no duplicate captain is created
- [ ] Submit a private trade, test Accept, Decline and 20-second expiry; check balances change only after valid acceptance
- [ ] During an unfinished planning round, press Pause Voyage on the TV; confirm phones show a paused banner and can no longer send orders
- [ ] Resume on TV and confirm the saved countdown continues from its remaining duration
- [ ] **Restart the application server during a planning round**. Reopen the host in the same browser profile, rejoin both phones, and ensure the TV displays *Resume Saved Voyage*
- [ ] Verify previously locked orders, contracts, private deals, scores and inventory remain intact; timer and offer expiry must remain frozen until the host presses Resume
- [ ] Play through the Reveal, naval battle reports, tides and the three eras, verifying no duplicate Gold or Renown awards
- [ ] Test sound mute defaults, effects/music volume and audio after browser autoplay restrictions; try reduced-motion setting
- [ ] Reopen a finished voyage after a server restart and confirm the final results remain available
- [ ] Test disconnect/restart on the actual Render instance and verify a persistent disk is mounted before calling state durable

## Notes on recovery and security

- The whole room snapshot **contains authentication tokens, private orders and secret contracts**. Never commit the state file to GitHub or place it in `/public`.
- `TIDEWATER_STATE_FILE` specifies the snapshot path; default is `<project>/data/rooms.json`.
- Snapshots are written via a temporary file, fsync and atomic rename, mode `0600`. The parent directory is created with private permissions (`0700`).
- On startup a previously active match is **paused**. The host explicitly resumes it. A finished match remains finished; a lobby requires humans to tap Ready again.
- Pending 20-second trade offers keep their remaining duration while paused. Planning time similarly remains frozen. A manual host Pause uses the same mechanism.
- If a saved snapshot is malformed or uses an unknown version, startup stops and **does not erase it**. Recover from a verified backup or restore a compatible file; do not delete data to bypass the failure.
- Snapshots provide single-instance restart recovery, **not** multi-server synchronisation, matchmaking, replicated storage or cloud failover.
- Health check `/health` returns HTTP 503 if a snapshot write fails during operation. Monitor logs and persistence health.

## Render configuration

Render application storage can be ephemeral. **Mount a persistent disk** and set `TIDEWATER_STATE_FILE` to a file under the disk mount (for example, `/var/data/tidewater-rooms.json`). Running the default on the application filesystem is useful locally but will not guarantee persistence across deploys or instance replacements.

For existing Render plans without persistent disk support, keep the server on a single instance and assume a deployment/restart may still lose rooms. Do not test a restart on a live game night until the disk is configured and verified.

## Browser testing in this build environment

An actual local HTTP route and its static media were exercised with Node's `fetch` against a server using a mocked WebSocket transport. Chromium / Playwright navigations to localhost were blocked with `ERR_BLOCKED_BY_ADMINISTRATOR`; therefore visual TV/phone screenshots and end-to-end multiplayer browser acceptance are **not verified**.
