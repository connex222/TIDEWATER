# TIDEWATER — Phase 7 Audio Guide

This delivery bundles original, procedurally composed digital audio. These are **working original game assets**, not professional live recordings and not outputs from Sonilo or Mirelo. They are intentionally lightweight and work offline once served by the Node game server.

## Music

| File | Role | Duration |
|---|---|---:|
| `harbour_shanty_loop.mp3` (and `.ogg`) | Warm maritime background loop for the host TV/PC: plucked strings, soft sustained harmony, flute melody, deep bass, brushed percussion, lantern bells, low surf | 20 s |

The music loops while enabled. It intentionally keeps dynamic range moderate, so the spoken conversation of a private games night remains audible.

## Effects

| Cue | Trigger | Approx. duration |
|---|---|---:|
| `bell` | New captain arrives, audio enabled | 1.1 s |
| `tide` | Round/tide changes | 1.2 s |
| `market` | Market prices change | 0.85 s |
| `build` | Settlements or Ports are constructed | 1.2 s |
| `cannon` | Battle report sequence advances | 1.7 s |
| `victory` | Admiralty Charter is awarded | 1.8 s |
| `deal` | New private deal offer arrives (opt-in phone) | 0.9 s |
| `warning` | Reserved for an explicit future warning event; asset bundled, not yet wired | 1.1 s |

## Playback, controls and privacy

- **TV / PC:** Sound Effects and Music are separate buttons, both **muted by default**. The master volume slider controls both; music is mixed below effects. Local volume preference is saved; playback is only enabled by clicking a sound button.
- **Phone:** Local feedback remains **muted by default**. The optional top-right speaker button enables quiet event cues for incoming deals, battles and match end. Phones never automatically play the full music loop.
- **Assets:** MP3 is used in the UI for broad browser compatibility; the Ogg files are also shipped as alternatives. There are **no CDN, streaming, or per-game download requests** beyond the game's own asset server.
- **Accessibility:** Game rules never depend on audio. Visual battle reports, order states and notifications remain the source of truth. Muting audio never affects gameplay.

## Regeneration and production note

To regenerate these original digital audio assets, run `python tools/generate_audio.py`. This development utility requires `numpy`, `scipy`, and `ffmpeg`; none is required to **play the game** because finished MP3/Ogg files are included.

A later optional studio-audio pass could replace these with more natural ship rigging, gulls, waves, harbour bells, battle cannon and licensed instrumental performances. Such a production pass has **not** been claimed or carried out in Phase 7.

## October 2026 — Mirelo mastering kit

Eight professional WAV cue generations from Mirelo SFX 2.0 succeeded. See `MIRELO-SOUND-UPGRADE.md` and `tools/install_mirelo_sfx.py` for installation, exact filenames and expiry. These generated media bytes are **not** inside this particular uninstalled package: the existing synthetic sound tracks remain in place as working fallback. The TV and phone apply safer per-cue gain, especially for naval cannon fire. The TV plays `warning` when the host pauses a voyage.
