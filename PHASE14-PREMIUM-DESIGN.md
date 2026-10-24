# TIDEWATER — Phase 14 Royal Chart Room

## Selected direction
The fourth of five approved premium concepts: Royal Chart Room. Dark midnight-navy chart-room surfaces, polished antique-gold controls, existing cinematic official logo and existing eight photorealistic captain portraits.

## Behaviour
- TV starts with a full-width premium home screen, clearly labelled four-letter room code, QR, link for phones, Enter Harbour Lobby, and How to Play.
- The host room is still created by the existing server WebSocket handshake: the new entry button reveals the already-created room; it does not create a duplicate.
- On first captain joining, the TV automatically reveals the live host lobby. Games in progress never show the landing screen, and lobby rejoin/backup/recovery remain functional.
- Phone join page uses matching theme, large accessible room/name fields, enlarged captain portraits and explicit Join Voyage. The working lobby/placement/private-orders screens retain all IDs and rules.
- All existing Mirelo WAV masters, MP3/Ogg recordings, audio volume controls and original logo/artwork remain in this package.
- Uses local CSS and current same-origin artwork only. No libraries, CDNs or new runtime dependencies.

## QA checklist
Run `npm test` and `npm run test:live` after `npm install`. Inspect the TV landing at 320, 390, 760, 1280 and 1920px, and phone join at 320, 390, 600px. Check QR/URL, two actual phone joins, automatic lobby transition, pause/resume, reconnect, and audio. The TV heading and controls should not clip under normal browser zoom or overscan. Real-device TV/mobile acceptance remains required.

## Verified on 24 October 2026

- **131/131 Node tests passed**, including 4 new premium-entry regression checks.
- Synthetic Chromium exercised TV 1920, 1280, 760, 390, 320 widths and phone 600, 390, 320 widths; all eight checked layouts had no horizontal overflow or JavaScript errors.
- Mock WebSocket created `SAIL` and populated the TV QR/code; the splash How to Play button opened/closed correctly and Enter Harbour Lobby revealed existing game controls.
- Phone check verified all eight captain choices, changing selection, and How to Play modal.
- No real TCP/WebSocket sessions could be run in this local environment because the `ws` dependency was not installed here. Existing GitHub Actions live acceptance covers real server smoke after a commit; verify its outcome separately.
- Real TV overscan and physical-phone acceptance remain recommended.
