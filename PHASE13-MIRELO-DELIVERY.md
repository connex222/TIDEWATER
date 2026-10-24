# TIDEWATER v0.13.1 — Premium Mirelo audio delivery

This release uses the owner's eight uploaded WAV files, not temporary Mirelo download links. Each WAV was tested as 48 kHz mono PCM; FFmpeg then produced a browser MP3 and Ogg using EBU R128 loudness normalisation to -19 LUFS with -3 dBTP ceiling. Original procedural effects are preserved as local backups in the downloadable archive. The base game's existing music loop is unchanged.

Audio is opt-in and throttled through the pre-existing Phase 13 playback controller; a normalised master alone does not guarantee equal perceived loudness, so audition on a TV and phone.

Tests: run `npm test`, `python tools/verify_mirelo_installation.py`, and GitHub Actions live WebSocket acceptance after deployment. The `ws` package was not installed in the offline container, so real TCP/WebSocket acceptance must be verified on GitHub Actions. Check real-device audio with sound enabled after a user gesture.

The audio manifest includes exact SHA256 checksums. Ensure the CDNs/cache returns the new files (hard-refresh or add asset URL query versions if cached).
