# TIDEWATER — Phase 10 games-night acceptance plan

## Automated evidence (23 October 2026)

- `npm test`: **106/106 passed** (full engine, auth/privacy, contract drafts, market, naval combat, pause and recovery, 2–8 human-captain simulated voyages in all three modes, and backups).
- `python tools/phase9_browser_smoke.py`: **7 checks passed** across 320, 390 and 600px phones and 760, 1280 and 1920px TV/desktop layouts, plus draft preservation across synthetic disconnect/reload. Chromium uses synthetic WebSocket messages.
- Original `SPECIFICATION.md`, eight captain portraits, logo, music and effects are retained.
- This delivery environment has no locally installable `ws` package and cannot validate a production Node WebSocket connection. Automated tests use a mock transport and **are not live multiplayer acceptance**.

## Recommended release gate — must be completed on a real network

- [ ] Install `ws` with `npm install` and run `npm test` and `npm start` on the actual server.
- [ ] Host on a connected PC/TV and scan the room QR with two real phones on the same home network; confirm the code matches.
- [ ] Test 4 and 8 players, different Android/iPhone devices, the TV browser, and a laptop. Play a complete Quick round sequence to final victory.
- [ ] Confirm no player can see another captain's orders, offers, contracts, inventory or reconnect credentials.
- [ ] Submit two secret orders simultaneously on different phones; verify round reveal timing, resource charges, and contested action compensation.
- [ ] Verify captain-device takeover: the older tab cannot act after a successful rejoin and is shown an informative message.
- [ ] Disconnect Wi-Fi with a partially edited order; verify local draft persistence, rejoin and no double submissions.
- [ ] Pause a mid-round game with one captain already locked; restart the Node process and confirm recovery is paused with the same captain and timer remaining.
- [ ] Disconnect a captain long enough for heartbeat expiry; have them rejoin or deliberately replace their seat with AI.
- [ ] Confirm a snapshot is saved to the configured mounted persistent disk, then redeploy Render and verify the match survives **instance replacement**.
- [ ] Check music and effects on TV and phones (mute defaults, volume, autoplay after interaction, no distorted audio).
- [ ] Check 720p/1080p TV overscan, 320px phones, tap targets, colour legibility, keyboard access, reduced motion and How to Play.
- [ ] Human-playtest the Renown race, trades, fleets and Weather; automated scripted matches do not establish enjoyment or competitive balance.

## State recovery procedure (single server only)

1. **Stop the game server**; do not copy private state while the process is writing.
2. Preserve the current state file, for example `rooms.json.corrupt` (never commit or share it: it contains host and player tokens).
3. Check that `rooms.json.bak` exists **on the persistent disk** and that it belongs to the same instance and intended game.
4. Copy the backup to the configured `TIDEWATER_STATE_FILE` (default `data/rooms.json`), and restrict it to mode `0600`.
5. Restart the Node service. Previously active matches should reopen **paused** and require host reconnect and Resume.
6. The backup contains the previous **valid** snapshot, so actions made since that snapshot may not be present.

### Critical deployment limitations

- These snapshots rely on one writer. Do **not** scale to multiple web service instances or run multiple writers against the same file.
- Render's default ephemeral filesystem is **not sufficient** for guaranteed recovery through redeployment. Configure a persistent disk and point `TIDEWATER_STATE_FILE` inside its mount.
- The last-known-good `.bak` protects against primary-file corruption, **not** whole-disk failure, deletion, or loss of an ephemeral container. Make external backups for long-running games if appropriate.
- Corrupt primary snapshots intentionally stop startup rather than silently starting fresh and losing a match. Restore from the backup manually once the operator has verified it.
- The game is currently a private games-night build, not a publicly security-audited multiplayer service.

## Release decision

**Phase 10 code acceptance: passed the automated suite and synthetic layouts.**

**Production/physical-device acceptance: not yet established.** Do not describe this build as fully tested live multiplayer until the above real-device checklist has been completed.
