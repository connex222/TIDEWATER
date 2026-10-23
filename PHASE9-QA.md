# TIDEWATER — Phase 9 quality assurance and release guidance

## Automated verification in this build

- **90/90 Node `npm test` checks passed.** This includes engine, trading, private contract/deal visibility, simultaneous battles, pause/restart snapshots, host/captain rejoin, HTTP and packaged media routes, security and browser-script syntax.
- **9 additional Phase 9 regression tests** verify stale sockets cannot execute host/player actions after authenticated takeover; first missed WebSocket pong is retried and a second missed response terminates the socket; healthy pong responses keep the socket active; pingless test transports are tolerated; the reconnect UI/phone draft safeguards exist, an excessive message rate is closed with code 1008, the rate window resets correctly, and a cross-origin handshake is rejected.
- **Synthetic Chromium browser checks passed** on three phone widths (320, 390, 600px) and three TV/desktop widths (760, 1280, 1920px). None of these rendered layouts scrolled horizontally. They show the dynamic chart/phone orders and connection banners with a **mock WebSocket**, plus verify a focused quantity input survives another state message. A draft was also saved after disconnection and restored during simulated page reload.
- Audio assets, logo and eight captain portraits remain bundled in the ZIP. The original rules specification is unchanged.

## Verification boundary — IMPORTANT

The npm registry could not be reached in this environment (`EAI_AGAIN`), so `ws` was not installed and the real Node WebSocket game server was **not** exercised end-to-end. Browser navigation to local/custom origin was also blocked, so the visual checks loaded HTML via `page.set_content` and injected synthetic room snapshots and simulated client connections. These tests show script execution/layout/input behaviour, **not** proof of real-device multiplayer, live QR scanning, audio playback or physical TV overscan behaviour.

The browser smoke script needs an installed Python Playwright package and Chromium. The Node application itself has no Playwright dependency:

```bash
npm install
npm test
npm start
# Optional synthetic visual test where Python Playwright + Chromium are installed:
python tools/phase9_browser_smoke.py
```

## Release acceptance checklist for a real games night

- [ ] Run actual `ws` transport over HTTPS/WSS on a single Node instance (and on Render if used).
- [ ] Confirm a host TV and 2–8 phones can connect, scan the QR, choose captains, join a room, place the opening settlements and complete a Quick voyage.
- [ ] Verify locked orders and contracts are private to the owning phone; trade terms only reach sender and recipient.
- [ ] Open one captain in a second browser tab. Confirm the older session is told it has been replaced, stops automatic reconnect attempts and cannot submit new orders.
- [ ] Repeat host takeover in a second tab, verifying previous host commands no longer work.
- [ ] Disconnect Wi-Fi on one phone while selecting Market quantities. Edit an order offline, restore Wi-Fi or reload the tab and confirm the draft is retained and only one slot can be locked.
- [ ] Leave a player offline long enough for the server heartbeat to mark them disconnected; rejoin before replacing them with an AI captain.
- [ ] Pause a match, disconnect phones, restart the server, reconnect and confirm private inventory, countdown, contract choices and unanswered deals survived.
- [ ] Check 320/390px phones, tablet, 720p/1080p TV and actual overscan; ensure focus states and contrast are legible from typical seating distances.
- [ ] Toggle music and effects only after a user interaction; verify browser autoplay restrictions, mute, volume and audio output on host TV and phone.
- [ ] Verify persistence after **Render deployment replacement** with a mounted persistent disk. Never use the default ephemeral filesystem for guaranteed recovery.
- [ ] Human playtest trading, diplomacy, naval warfare, Advanced Weather and early Renown pacing with real groups.

## Security and hosting notes

- Do not commit `data/rooms.json`, backup snapshots, connection secrets or private orders. The `.gitignore` remains active; keep state under a protected persistent mount.
- WebSocket heartbeat is every 30 seconds; two consecutive checks without a pong terminate the old socket. A sleeping phone can reconnect with its existing token.
- Server request limit is 80 messages per 10 seconds per WebSocket, with close code 1008 if exceeded.
- Phone draft recovery uses per-tab `sessionStorage`, **not** a server-side backup: use the same browser tab/profile when restoring local drafts. Locked orders and authoritative state remain server-controlled.
- Do not run multiple Render instances against the same state file: snapshots support one writer and do not implement distributed locking.
- To upload/deploy Phase 9, commit the **contents** of this package's `tidewater-phase9/` directory to the desired GitHub branch; creating the archive does not automatically change GitHub or Render.
