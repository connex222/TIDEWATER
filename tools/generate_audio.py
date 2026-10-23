"""Generate original procedural Tidewater audio assets; requires numpy and scipy, ffmpeg.
The generated audio is original digital synthesis, not prerecorded or plugin-generated.
Run: python tools/generate_audio.py
"""
import math, shutil, subprocess, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'audio';OUT.mkdir(parents=True,exist_ok=True)
SR=24000
RNG=np.random.default_rng(41391)

def lowpass(x, hz):return sosfilt(butter(3,hz,fs=SR,output='sos'),x).astype(np.float32)
def highpass(x,hz):return sosfilt(butter(2,hz,fs=SR,btype='highpass',output='sos'),x).astype(np.float32)
def note(freq,dur,kind='pluck'):
    n=max(1,round(dur*SR));t=np.arange(n,dtype=np.float32)/SR
    if kind=='pluck':
        x=np.sin(2*np.pi*freq*t)+.27*np.sin(2*np.pi*freq*2*t)+.1*np.sin(2*np.pi*freq*3*t)
        env=(1-np.exp(-t*75))*np.exp(-t*(4.3/max(.14,dur)))
    elif kind=='flute':
        x=np.sin(2*np.pi*freq*t+.2*np.sin(2*np.pi*5*t))+.15*np.sin(2*np.pi*freq*2*t)
        env=np.minimum(t/.07,1)*np.minimum((dur-t)/.14,1)
    elif kind=='strings':
        x=np.sin(2*np.pi*freq*t)+.36*np.sin(2*np.pi*freq*2.01*t)+.13*np.sin(2*np.pi*freq*3.01*t)
        env=np.minimum(t/.2,1)*np.minimum((dur-t)/.25,1)
    elif kind=='bell':
        x=np.sin(2*np.pi*freq*t)+.31*np.sin(2*np.pi*freq*2.15*t)+.12*np.sin(2*np.pi*freq*3.57*t)
        env=(1-np.exp(-t*110))*np.exp(-t*(3/max(.2,dur)))
    elif kind=='bass':
        x=np.sin(2*np.pi*freq*t)+.24*np.sin(2*np.pi*2*freq*t)
        env=(1-np.exp(-t*65))*np.exp(-t*2.1/max(.2,dur))
    else:raise ValueError(kind)
    return (x*np.maximum(env,0)).astype(np.float32)

def mix_at(buf,x,at,vol=1,pan=0):
    start=round(at*SR)
    if start<0:return
    end=min(len(buf),start+len(x))
    if end<=start:return
    y=x[:end-start]*vol
    buf[start:end,0]+=y*np.sqrt((1-pan)/2)
    buf[start:end,1]+=y*np.sqrt((1+pan)/2)

def noise(dur, cutoff=1800, high=False):
    x=RNG.normal(0,1,max(1,int(SR*dur))).astype(np.float32)
    return highpass(x,cutoff) if high else lowpass(x,cutoff)

def percussion(kind,dur=.4):
    t=np.arange(int(SR*dur))/SR
    if kind=='kick':
        freq=50+90*np.exp(-t*24)
        sig=np.sin(2*np.pi*np.cumsum(freq)/SR)*np.exp(-t*20)
    elif kind=='wood':
        sig=(np.sin(2*np.pi*220*t)+.4*np.sin(2*np.pi*640*t))*np.exp(-t*37)
        sig+=.12*noise(dur,2500,True)*np.exp(-t*31)
    else:
        sig=noise(dur,2300,True)*np.exp(-t*20)
    return sig.astype(np.float32)

def master(buf):
    peak=max(.001,float(np.max(np.abs(buf))))
    buf=np.tanh(buf*(.84/peak)*1.1)*.9
    return buf.astype(np.float32)

def export(name,data,quality=5):
    data=master(data)
    temp=OUT/(name+'.wav')
    with wave.open(str(temp),'wb') as wf:
        wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(SR)
        wf.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
    out=OUT/(name+'.ogg')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(temp),'-c:a','libvorbis','-q:a',str(quality),str(out)]
    subprocess.run(cmd,check=True)
    mp3=OUT/(name+'.mp3')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(temp),'-c:a','libmp3lame','-q:a','4',str(mp3)],check=True)
    temp.unlink()
    print(name,round(out.stat().st_size/1024),'KiB Ogg',round(mp3.stat().st_size/1024),'KiB MP3',round(len(data)/SR,2),'seconds')

def backing():
    bpm=96;beat=60/bpm;bars=8;seconds=bars*4*beat
    buf=np.zeros((int(seconds*SR),2),np.float32)
    # Subtle continuous sea air; use wrapping signal to keep steady boundary.
    hiss=noise(seconds+1,300)
    waves=(np.sin(2*np.pi*np.arange(len(hiss))/SR*.072)*.5+.5)*.023
    sea=hiss*waves
    sea=sea[:len(buf)]
    buf[:,0]+=sea*.72;buf[:,1]+=sea*.86
    # Minor/mixolydian colours give a maritime character without a cliché jig.
    harmony=[(196,[196,246.94,293.66,392]),(146.83,[146.83,220,293.66,369.99]),
             (174.61,[174.61,220,261.63,349.23]),(196,[196,246.94,293.66,392]),
             (164.81,[164.81,246.94,329.63,392]),(146.83,[146.83,220,293.66,369.99]),
             (174.61,[174.61,220,261.63,349.23]),(196,[196,246.94,293.66,392])]
    melody=[[392,440,493.88,440],[392,369.99,329.63,293.66],[349.23,392,440,392],
            [293.66,329.63,392,440],[493.88,440,392,329.63],[369.99,329.63,293.66,329.63],
            [349.23,392,440,493.88],[392,329.63,293.66,392]]
    for bar,(root,chord) in enumerate(harmony):
        start=bar*4*beat
        # Warm accordion-like bowed chords, cleanly released before bar end.
        for j,f in enumerate(chord[1:]):
            mix_at(buf,note(f,3.8*beat,'strings'),start,.034,pan=-.4+j*.35)
        mix_at(buf,note(root/2,1.35*beat,'bass'),start,.2,pan=-.12)
        mix_at(buf,note(root/2,1.2*beat,'bass'),start+2*beat,.17,pan=.15)
        for step,f in enumerate([chord[0],chord[2],chord[1],chord[3],chord[0]*2,chord[2]]):
            mix_at(buf,note(f,.45*beat,'pluck'),start+step*(4*beat/6),.089,pan=(-.4 if step%2==0 else .32))
        for step,f in enumerate(melody[bar]):
            mix_at(buf,note(f,.94*beat,'flute'),start+step*beat,.13,pan=.2)
        for b in range(4):
            if b in (0,2):mix_at(buf,percussion('kick'),start+b*beat,.11)
            if b in (1,3):mix_at(buf,percussion('wood'),start+b*beat,.07,pan=-.2)
            mix_at(buf,percussion('brush',.2),start+b*beat,.023,pan=.35)
        if bar in (0,4):mix_at(buf,note(783.99,1.3,'bell'),start,.055,pan=.1)
    # Crossfade a short edge to make loop joins unobtrusive.
    blend=min(int(.14*SR),len(buf)//2)
    left=buf[:blend].copy();right=buf[-blend:].copy()
    a=np.linspace(0,1,blend,dtype=np.float32)[:,None]
    average=left*(1-a)+right*a
    buf[:blend]=average;buf[-blend:]=average
    export('harbour_shanty_loop',buf,quality=5)

def one(kind,dur):
    buf=np.zeros((int(dur*SR),2),np.float32)
    if kind=='bell':
        for f,at in [(698,0),(1046,.075)]:mix_at(buf,note(f,dur-at,'bell'),at,.27)
    elif kind=='tide':
        w=noise(dur,570);t=np.arange(len(w))/SR
        wav=w*(.3+.35*np.sin(np.pi*t/dur))*np.minimum(t/.17,1)*np.minimum((dur-t)/.22,1)
        mix_at(buf,wav,0,.2,pan=-.28)
        mix_at(buf,note(293.66,.8,'flute'),.1,.1,pan=.2)
    elif kind=='market':
        for f,at in [(880,0),(1318.5,.13),(1760,.28)]:mix_at(buf,note(f,dur-at,'bell'),at,.18,pan=.15)
        mix_at(buf,percussion('wood',.3),.05,.12,pan=-.4)
    elif kind=='build':
        for at in [0,.16,.36]:mix_at(buf,percussion('wood'),at,.22,pan=-.3)
        mix_at(buf,note(392,dur-.47,'bell'),.47,.18,pan=.2)
    elif kind=='cannon':
        t=np.arange(int(dur*SR))/SR
        body=np.sin(2*np.pi*(58*t+34*t*np.exp(-t*18)))*np.exp(-t*9)
        blast=lowpass(noise(dur,2800),900)*np.exp(-t*6)
        mix_at(buf,(body*.7+blast*.64).astype(np.float32),0,.4,pan=-.12)
        mix_at(buf,percussion('wood',.35),.025,.18,pan=.35)
    elif kind=='victory':
        for f,at in [(392,0),(493.88,.13),(587.33,.28),(783.99,.44),(1046.5,.64)]:mix_at(buf,note(f,dur-at,'bell'),at,.24,pan=(-.25 if int(at*100)%2 else .25))
        for f in [196,246.94,293.66]:mix_at(buf,note(f,dur-.15,'strings'),.15,.035)
    elif kind=='deal':
        mix_at(buf,note(523.25,.65,'pluck'),0,.24,pan=-.3)
        mix_at(buf,note(659.25,.65,'pluck'),.21,.22,pan=.3)
    elif kind=='warning':
        mix_at(buf,note(293.66,.5,'bell'),0,.16)
        mix_at(buf,note(261.63,.6,'bell'),.24,.14)
    export(kind,buf,quality=5)

if __name__=='__main__':
    backing()
    for k,d in [('bell',1.1),('tide',1.2),('market',.85),('build',1.2),('cannon',1.7),('victory',1.8),('deal',.9),('warning',1.1)]:one(k,d)
