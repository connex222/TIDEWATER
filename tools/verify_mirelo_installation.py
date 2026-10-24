#!/usr/bin/env python3
"""Audit the premium Mirelo 8-cue installation; never claim synthetic defaults are premium."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
NAMES=('bell','build','cannon','deal','market','tide','victory','warning')
# SHA256 hashes of original bundled synthetic MP3s, used to distinguish an actual replacement.
ORIGINALS={'bell': 'cedd46ef27f5e1372a4cefba4bf1327305904f8df5e28a2cab64f4d10a9d0ebe', 'build': '237fb2c6144eb430241cc88dca6cf090584d0abb5ca9307289c49f80b2d56a70', 'cannon': '44046f1619b378077a38761a5b76cd35592c19c7db4acbd8ad741ab0e77433ad', 'deal': '2ca53278815b1b3919d40100908ab3531b724bea30df5a304265df425ec8f8ea', 'market': '6cf1005ff84baf7db39d88e0178279afa302968ac0f5b06b7d862c40be4c97ee', 'tide': 'c7cb9174930db3c98d2d5d970326426175d85bfc81d4e94cf5ff93e318976bbd', 'victory': 'ba8b8ae5cff7490bc9deae46a995468d58355ed9c33e63a7f2adb3edc9c598d6', 'warning': 'cdce2ca14006f269821d5ccd33f03a32a8935d1301f272f40e9c27aa78cfbc2d'}
def check():
    results={}
    for name in NAMES:
        mp3=ROOT/'public/audio'/f'{name}.mp3'
        ogg=ROOT/'public/audio'/f'{name}.ogg'
        master=ROOT/'public/audio/mirelo-masters'/f'{name}.wav'
        changed=mp3.exists() and hashlib.sha256(mp3.read_bytes()).hexdigest()!=ORIGINALS[name]
        present=changed and ogg.exists() and master.exists()
        if present:
            for file in (mp3,ogg,master):
                p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1',str(file)],capture_output=True,text=True)
                if p.returncode or 'duration=' not in p.stdout:present=False
        results[name]='installed' if present else ('changed-but-incomplete' if changed else 'original-synthetic')
    all_installed=all(x=='installed' for x in results.values())
    print(json.dumps({'mirelo_audio_installed':all_installed,'cues':results},indent=2))
    return 0 if all_installed else 2
if __name__=='__main__':sys.exit(check())
