# TIDEWATER — Phase 11 Multiplayer Acceptance & Release Gate

## Deliverable, 23 October 2026

Phase 11 addresses the risk of a TV host unexpectedly disconnecting while captains have unsubmitted or locked plans. **An active voyage now pauses automatically** when the currently authenticated TV host socket closes. Orders, contract selections, cargo, ongoing offers and remaining decision time are retained. The host must reconnect using its existing host token and explicitly press **Resume Saved Voyage**. Delayed close events from a superseded host cannot pause the current session.

This does not change the original `SPECIFICATION.md` gameplay rules. An automatic host-disconnect pause is an operational reliability rule, not a change to the order resolution system.

## Evidence confirmed in this environment

- `npm test` — **113/113 passed**, including seven new host disconnect, recovery, session handover and display regressions.
- `python tools/phase9_browser_smoke.py` — **7/7 passed**: 320/390/600px phone layouts; 760/1280/1920px TV/desktop layouts; draft editing preserved through synthetic server updates, disconnection and reload.
- JavaScript syntax checked for `server.js`, persistence module, and the new live acceptance runner.
- The full original 37-hex/18-lane specification, eight portrait assets, title logo, and bundled music/SFX remain in the archive.

**Not confirmed:** actual TCP/WebSocket live multiplayer. `npm install` could not download `ws` here (`EAI_AGAIN`, package registry unreachable). Node tests use a deliberately mocked `ws` transport; Chromium tests stub WebSocket messages. Do not claim physical TV/phone acceptance from these results.

## New genuine-WebSocket acceptance runner

Once the runtime dependency is installed, run:

```sh
npm install
npm test
npm run test:live
```

`test:live` starts the actual Node server on a local TCP port and creates **real WebSocket clients through `ws`**. It tests:

1. HTTP health endpoint and encoded QR endpoint;
2. Spectator rejection for an unauthorised host action;
3. Host room creation and two player joins;
4. Captain-ready status and snake-order placement of four opening settlements;
5. Secret Voyage Contract selection;
6. Submission privacy (the TV and other captain cannot view locked orders);
7. Two orders resolving to Round 2;
8. An interrupted host connection pausing the match automatically;
9. Authenticated host reconnection and explicit Resume;
10. Completion of all eight Quick rounds with a recorded winner.

The GitHub Actions workflow `.github/workflows/acceptance.yml` runs `npm test` and `npm run test:live` for pushes and pull requests to `main`. This workflow becomes operational **only after Phase 11 is pushed to GitHub and Actions is enabled**. A passing run will establish a local-loopback real WebSocket test; it does not establish physical multi-device play or Render persistence.

## Mandatory real-device release checklist

- [ ] Run `npm run test:live` successfully on the deployed-source version with npm dependencies installed.
- [ ] Confirm the deployed Render commit/version is the intended Phase 11 release and that `/health` returns healthy.
- [ ] Configure a mounted persistent disk and set `TIDEWATER_STATE_FILE` to a file within that disk; confirm one Node server instance only.
- [ ] Host from an actual television/PC and join on two separate Android/iOS phones using the QR. Test 2-, 4-, and 8-player sessions as practical.
- [ ] Complete a real 8-round Quick match, including a Harbour, Market, sea lane, Raid, Voyage Contract, era draft and final result.
- [ ] Physically unplug/disconnect the host network mid-Plan; confirm TV host loss pauses the round, including outstanding offer timers. Reconnect the same TV and Resume. The remaining time should match the paused state, not the wall-clock time offline.
- [ ] Test captain loss/rejoin while the host remains online. Ensure no stolen seat or duplicate action from superseded tabs.
- [ ] Restart/redeploy the hosting service while a match is paused. Verify that a snapshot on persistent disk restores the same room and private orders; it must require manual host Resume.
- [ ] Verify the game's contract, inventory, token and trade-offer privacy between phones and shared TV.
- [ ] Verify touch targets and button layouts on 320px phones, a 720p and 1080p television (overscan), and a laptop. Review keyboard focus and How to Play readability.
- [ ] Test soundtrack and effects on real phones and a TV after first user interaction, at several volume settings. Both remain muted by default.
- [ ] Conduct a human gameplay balance/clarity session. Automated strategy simulations alone do not show whether a game is engaging.

## Host-loss behaviour and limitations

- If a **current** authenticated host WebSocket closes unexpectedly, an active game pauses. Once the host reconnects, the match **stays paused** until the host explicitly resumes it.
- If a host is merely superseded by a new authenticated host, the old socket's delayed close does **not** pause the match.
- A player disconnect does **not** pause the entire match. The host can use the existing AI-replacement control after disconnection.
- In-memory state survives socket disconnections; process and instance replacement require the configured persistent state file. The `.bak` file is only the previous valid snapshot, not disaster recovery.
- Multiplayer is one-process, one-writer only. There is no shared database, cross-instance coordination or public matchmaking.
- This delivery has **not** modified any live GitHub repository or Render service. Deployment must be separately requested and verified.

## Release judgement

**Local engine/protocol regression gate:** passed (113/113).  
**Synthetic Chromium responsive UI gate:** passed (7/7).  
**Real TCP WebSocket acceptance gate:** not executed in the present environment (dependency registry unreachable).  
**Physical TV/phone and Render persistent-disk acceptance:** not executed.
