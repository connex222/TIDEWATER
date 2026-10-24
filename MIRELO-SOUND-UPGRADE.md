# TIDEWATER — Mirelo sound upgrade (8 professionally generated cues)

Eight **actual Mirelo SFX 2.0** WAV masters were generated on 24 October 2026 under the game owner's Mirelo account. They are not music tracks. The game already contains original synthetic MP3/Ogg versions under `public/audio` and they remain playable until the Mirelo masters are installed.

| Mirelo cue | File name | Duration |
|---|---|---:|
| Ship's bell / Captain joins | `bell` | 2.0s |
| Naval cannon | `cannon` | 3.0s |
| Incoming private trade | `deal` | 1.9s |
| Merchant market | `market` | 1.7s |
| Harbour construction | `build` | 2.4s |
| Changing tide | `tide` | 2.8s |
| Victory celebration | `victory` | 3.8s |
| Warning / pause | `warning` | 1.7s |

## Install (on a computer with internet access)

1. Extract this archive.
2. Install FFmpeg. On Windows you can run `winget install Gyan.FFmpeg`, then open a new terminal. Confirm `ffmpeg -version` works.
3. From the extracted game folder run:
   `python tools/install_mirelo_sfx.py --download`
4. Run `npm test`, then `npm start`, or upload the upgraded `public/audio` folder to GitHub.

The installer fetches eight approved WAVs directly from Mirelo, verifies that they contain PCM audio, masters them for predictable browser loudness, and writes MP3/Ogg. It retains the WAV masters in `public/audio/mirelo-masters` and preserves the original game sounds in `public/audio/previous-synthetic`.

**Important:** The eight private signed URLs in `tools/mirelo_sources.local.json` expire on **31 October 2026**. Treat this file as temporary production information. Never upload it to a public repository. You can instead save the original WAVs and run:

`python tools/install_mirelo_sfx.py --input-dir /path/to/folder-of-wavs`

The game uses **local bundled audio** at runtime. No user sound downloads, third-party requests or Mirelo connection are required once installed. Existing music continues unchanged. Sound is opt-in on TV and phone, with a reduced gain for cannon fire and a visible-only alternative for every gameplay action.

## Packaging status

Because this workspace cannot retrieve the Mirelo media bytes directly, **this ZIP contains the original working game audio and the ready-to-run Mirelo installer, not the newly generated audio files themselves**. Do not claim the ZIP or a remote deployment contains Mirelo audio until the installer has run successfully. No GitHub or Render audio update was performed in this step.
