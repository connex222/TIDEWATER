'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=name=>fs.readFileSync(path.join(root,name),'utf8');

test('TV limits concurrent cues, throttles repeats and releases audio instances',()=>{
  const s=file('public/tv.html');
  assert.match(s,/MAX_ACTIVE_SOUNDS=4,CUE_COOLDOWN_MS=250/);
  assert.match(s,/activeSounds\.size>=MAX_ACTIVE_SOUNDS/);
  assert.match(s,/effect\.addEventListener\('ended',release/);
  assert.match(s,/effect\.addEventListener\('error',release/);
  assert.match(s,/if\(!soundOn\)silenceEffects\(\)/);
});
test('Phone effects remain opt-in and never exceed two overlapping sounds',()=>{
  const s=file('public/phone.html');
  assert.match(s,/phoneActiveSounds\.size>=2/);
  assert.match(s,/if\(!phoneSounds\)stopPhoneSounds\(\)/);
  assert.match(s,/phoneLastCueAt\.get\(kind\)/);
});
test('original offline sound assets remain available; installer never sends media to external hosts at playback',()=>{
  assert.match(file('tools/install_mirelo_sfx.py'),/if parsed.scheme != 'https' or parsed.hostname != 'mirelo.ai'/);
  assert.match(file('tools/verify_mirelo_installation.py'),/original-synthetic/);
  for(const n of ['bell','build','cannon','deal','market','tide','victory','warning']){
    assert.ok(fs.statSync(path.join(root,'public/audio',n+'.mp3')).size>1000);
    assert.ok(fs.statSync(path.join(root,'public/audio',n+'.ogg')).size>1000);
  }
});

const vm=require('node:vm');
function fakeAudio(){
  const created=[];
  class StubAudio{
    constructor(src){this.src=src;this.paused=false;this.listeners=new Map();created.push(this)}
    addEventListener(name,fn){this.listeners.set(name,fn)}
    play(){return Promise.resolve()}
    pause(){this.paused=true}
    fire(name){if(name==='ended'||name==='error')this.paused=true;this.listeners.get(name)?.()}
  }
  return {StubAudio,created};
}
test('TV audio actually enforces cooldown, four-voice cap, and stop-all',()=>{
  const s=file('public/tv.html'), beginning=s.indexOf('const activeSounds=new Set()');
  const ending=s.indexOf('function syncAudioControls()',beginning);
  assert.ok(beginning>0&&ending>beginning);
  const {StubAudio,created}=fakeAudio();let now=1000;
  const context={Audio:StubAudio,Date:{now:()=>now},soundOn:true,audioVolume:1,
    EFFECTS:new Set(['bell','cannon','deal','market','build','tide','victory','warning']),
    EFFECT_GAIN:{bell:.58,cannon:.32}};
  vm.createContext(context);
  vm.runInContext(s.slice(beginning,ending)+'\nthis.playSound=sound;this.stop=silenceEffects;',context);
  context.playSound('bell');context.playSound('bell');
  assert.equal(created.length,1,'rapid duplicate sound suppressed');
  for(const n of ['cannon','deal','market','build'])context.playSound(n);
  assert.equal(created.length,4,'fifth concurrent sound suppressed');
  created[0].fire('ended');now+=400;context.playSound('bell');
  assert.equal(created.length,5,'a finished sound frees a voice');
  context.stop();assert.ok(created.every(x=>x.paused));
});
test('Phone audio actually limits playback and frees failed audio',()=>{
  const s=file('public/phone.html'), beginning=s.indexOf('const phoneActiveSounds=new Set()');
  const ending=s.indexOf('function syncPhoneSound()',beginning);
  const {StubAudio,created}=fakeAudio();let now=1000;
  const context={Audio:StubAudio,Date:{now:()=>now},phoneSounds:true};
  vm.createContext(context);
  vm.runInContext(s.slice(beginning,ending)+'\nthis.cue=phoneCue;this.stop=stopPhoneSounds;',context);
  context.cue('deal');context.cue('deal');context.cue('bell');context.cue('cannon');
  assert.equal(created.length,2);
  created[0].fire('error');now+=400;context.cue('cannon');
  assert.equal(created.length,3,'failure frees a phone slot');
  context.stop();assert.ok(created.every(x=>x.paused));
});
