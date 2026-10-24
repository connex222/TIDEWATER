# TIDEWATER Phase 13 — Audio reliability and installation audit

Phase 13 protects the TV and phone audio output under fast multiplayer events. It does **not** pretend the Mirelo recordings are installed before WAV bytes have been obtained.

- TV has 250ms per-cue cooldown and at most 4 concurrently playing effects; Muting cancels active effects and volume 0 immediately silences output.
- Phone has 350ms per-cue cooldown and at most 2 concurrent effects; muting stops current effects immediately.
- Generated Mirelo sound masters are not in this archive. The original bundled sounds remain playable and available locally.
- Install eight approved Mirelo WAVs via `python tools/install_mirelo_sfx.py --download` (time-limited URLs require private sidecar) or `python tools/install_mirelo_sfx.py --input-dir /your/approved/wavs`.
- **Release gate:** `python tools/verify_mirelo_installation.py` exits with status 0 only when eight distinct premium MP3/Ogg assets **and** WAV masters have been verified. Exit 2 means pending/not installed; do not state the premium sounds are live.
- Never commit `tools/mirelo_sources.local.json` to GitHub. It contains expiring signed download links.
- To verify after installation: `npm test`, `npm run test:live` (on a network-equipped server), and visual device sound checks.
- A successful deployment does not mean the premium sound release gate is passed.

**v0.13.1:** Eight original user-provided Mirelo WAV masters installed; source hashes and new browser encodes validated with `test/mirelo-installed-assets.test.js` and `tools/verify_mirelo_installation.py`. No signed Mirelo links or app credentials are part of the deployed files.
