#!/usr/bin/env python3
"""Install approved Mirelo WAV masters into TIDEWATER as local MP3+Ogg.

No credentials are used or stored. Download URLs in the private sidecar
manifest are time-limited and are NEVER served by the game server.

Python 3.9+ and ffmpeg/ffprobe are required; no Python pip packages.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import wave
from pathlib import Path

GAME_ROOT = Path(__file__).resolve().parent.parent
CUES = ('bell', 'cannon', 'deal', 'market', 'build', 'tide', 'victory', 'warning')
SOURCES = Path(__file__).with_name('mirelo_sources.local.json')


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def validated_wave(filename):
    if filename.stat().st_size < 512:
        raise ValueError(f'Empty or truncated file: {filename}')
    with wave.open(str(filename), 'rb') as w:
        if w.getnchannels() not in (1, 2) or w.getsampwidth() not in (2, 3, 4):
            raise ValueError(f'Unsupported WAV audio layout: {filename}')
        duration = w.getnframes() / w.getframerate()
        if not (0.1 <= duration <= 60):
            raise ValueError(f'Implausible duration {duration:.2f}s: {filename}')
        return duration


def download(url, destination):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'mirelo.ai' or '/dl/' not in parsed.path:
        raise ValueError('Expected an official Mirelo HTTPS asset URL')
    request = urllib.request.Request(url, headers={'User-Agent': 'TidewaterAudioInstaller/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response, destination.open('wb') as output:
        shutil.copyfileobj(response, output, length=1024 * 256)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--download', action='store_true', help='Download WAV masters from official time-limited Mirelo links in the local sidecar manifest')
    group.add_argument('--input-dir', type=Path, help='Folder containing all eight manually downloaded cue-name.wav files')
    parser.add_argument('--no-masters', action='store_true', help='Do not retain uncompressed WAV masters after conversion')
    args = parser.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        parser.error('ffmpeg and ffprobe must be installed and present on PATH')
    sources = {}
    if args.download:
        sources = json.loads(SOURCES.read_text(encoding='utf-8'))
        if set(sources) != set(CUES):
            parser.error('Mirelo manifest must contain exactly the eight approved cues')
    audio_dir = GAME_ROOT / 'public' / 'audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='tidewater-mirelo-') as scratch:
        work = Path(scratch)
        outputs = []
        for name in CUES:
            wave_path = work / f'{name}.wav'
            if args.download:
                print(f'Downloading Mirelo {name}...')
                download(sources[name], wave_path)
            else:
                supplied = args.input_dir / f'{name}.wav'
                if not supplied.is_file():
                    parser.error(f'Missing WAV master: {supplied}')
                shutil.copyfile(supplied, wave_path)
            duration = validated_wave(wave_path)
            print(f'Valid WAV: {name}: {duration:.2f} s')
            for ext, codec_args in (
                ('mp3', ['-codec:a', 'libmp3lame', '-b:a', '160k']),
                ('ogg', ['-codec:a', 'libvorbis', '-q:a', '4']),
            ):
                path = work / f'{name}.{ext}'
                cmd = [
                    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(wave_path),
                    '-af', 'loudnorm=I=-19:TP=-3:LRA=9',
                    '-ac', '1', '-ar', '48000', *codec_args, str(path),
                ]
                run(cmd)
                if path.stat().st_size < 1024:
                    raise ValueError(f'Encoded output too small: {path}')
                run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                     '-show_entries', 'stream=codec_name', '-of', 'default=nw=1', str(path)])
                outputs.append((path, audio_dir / f'{name}.{ext}'))
        # All files have been downloaded, validated and encoded before altering the game.
        original_dir = audio_dir / 'previous-synthetic'
        original_dir.mkdir(exist_ok=True)
        for src, dest in outputs:
            prior = original_dir / dest.name
            if dest.is_file() and not prior.is_file():
                shutil.copyfile(dest, prior)
        for src, dest in outputs:
            os.replace(src, dest)
        if not args.no_masters:
            masters = audio_dir / 'mirelo-masters'
            masters.mkdir(exist_ok=True)
            for name in CUES:
                shutil.copyfile(work / f'{name}.wav', masters / f'{name}.wav')
        print(f'Installed {len(CUES)} supplied WAV cues in MP3+Ogg with original sounds safely backed up.')
        print('The music loop remains unchanged. The game needs no external audio services during playback.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Installation failed; unconverted sounds left unchanged: {exc}', file=sys.stderr)
        raise SystemExit(1)
