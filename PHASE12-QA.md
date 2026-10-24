# TIDEWATER — Phase 12 deployment and private backup guide

## Purpose

Tidewater Phase 12 adds an explicit host-controlled portable snapshot for hosting platforms, such as Render's Free tier, where files written to the local application filesystem can disappear when the instance is replaced. **This is a manual backup.** It does not provide durable or continuous storage and cannot recover actions taken after the last downloaded file.

The original `SPECIFICATION.md`, the Tidewater rules, all eight captain portraits and existing audio are unchanged.

## Host workflow: save a voyage

1. On the TV/PC host screen, click **Pause Voyage · Host** (if the game has started and is not finished).
2. Click **Download Private Backup** under **Private voyage recovery**. Save the JSON file locally in a trusted, private folder. Do not share it in chat, email or with players.
3. Confirm that the file was actually downloaded and is non-empty. Download a newer backup after each significant section of gameplay.
4. Resume the voyage. Remember: the backup preserves only the position at which it was downloaded.

**Sensitive data:** Every backup intentionally contains the host recovery token, individual captain tokens, inventories, pending deals and secret orders. They are unencrypted. Only the host should store this file. Delete outdated copies securely when no longer needed.

## Restore after instance replacement

1. Confirm the old deployment/room is no longer active. If it is active, restoring a backup with the same room code is deliberately blocked.
2. Open the newly deployed game's TV host screen. If the server has lost the old room, Tidewater automatically offers a fresh empty lobby. **Do not let anyone join yet.**
3. Under **Private voyage recovery**, click **Restore Backup into Empty Room**, select the saved JSON and confirm.
4. Tidewater restores the original **four-letter room code** and player identities, including private tokens. Active games are placed in a **paused** state; the old deadlines cannot expire while everyone reconnects.
5. Each captain reopens the original phone game, lets automatic reconnection complete, checks their private inventory and locked orders, and confirms readiness to the host verbally.
6. Only then should the TV host click **Resume Saved Voyage**. Check the timer and outstanding deals.

Do not attempt to import a backup into a populated lobby or on top of an existing room. Importing a backup does not change the game's rules or redistribute resources.

## Security and operational limitations

- Backup endpoints accept only POST with a JSON body, a private Bearer host token, an active host session and a matching browser origin (when one is supplied). There are no public GET links for downloading private match files.
- Import input is capped at **512 KiB** and checked against the existing snapshot schema. Mismatched schema versions, malformed charts, duplicate room codes and non-empty destination lobbies are rejected.
- The export endpoint requires the match to be paused, in the lobby, or finished; export uses `Cache-Control: no-store` and a private download attachment.
- **Not encrypted:** Anyone with access to the private backup file can learn the contained room/captain tokens. This is deliberate to enable recovery across replaced servers, but means host file security is essential.
- The backup is **not** a live replication service, database, unattended server backup, or remote cloud storage; a crash before the host downloads a recent backup can still lose progress. Render's Free plan should not be represented as guaranteeing persistent game-state storage.
- One Node.js instance only: Tidewater's in-process room map and JSON snapshots do not implement multi-instance coordination. Do not enable horizontal scaling without redesigning shared state.
- Run the physical-device game-night checklist in `PHASE11-QA.md` before calling the game release-ready.

## Test results (24 October 2026)

- `node --test`: **117/117 passed**, covering old gameplay plus Phase 12 backup authentication, paused-only export, import recovery, preserve-secret-orders, reconnect tokens, anti-overwrite, version validation and UI presence.
- `python tools/phase9_browser_smoke.py`: **7/7 synthetic Chromium checks passed** across 320, 390, 600, 760, 1280 and 1920 px, plus phone draft/reload checks.
- The browser smoke uses a mock WebSocket connection. The actual `ws` dependency is not installed locally here. The existing real TCP/WebSocket CI runner should be used in GitHub Actions after updating the repository.
- Real Android/iPhone/TV recovery across an actual Render redeploy, physical-device music playback, and long-running match persistence remain **not verified**.

## Deployment and rollback

- The build requires Node.js >=20 and the single `ws` dependency (unchanged). Standard installation: `npm install`, `npm test`, `npm run test:release`, then `npm start`.
- GitHub and Render deployment are separate actions; extracting a ZIP or running local tests does not publish the build.
- To roll back the code, restore the previous tagged Phase 11 commit. Phase 12 does not change the local snapshot schema version, but always preserve your private backup files before rolling back or redeploying.
