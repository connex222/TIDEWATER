'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('Mirelo installer and private source manifest are packaged but excluded from git',()=>{
  assert.match(files('.gitignore'),/tools\/mirelo_sources\.local\.json/);
  assert.ok(fs.existsSync(path.join(root,'tools','install_mirelo_sfx.py')));
  const privateManifest=path.join(root,'tools','mirelo_sources.local.json');
  if(fs.existsSync(privateManifest)){
    const s=JSON.parse(fs.readFileSync(privateManifest,'utf8'));
    assert.deepEqual(Object.keys(s).sort(), ['bell','build','cannon','deal','market','tide','victory','warning']);
    for(const [cue,url] of Object.entries(s))assert.ok(url.startsWith('https://mirelo.ai/dl/'),cue);
  }
});
test('all existing offline music and effects remain valid fallbacks until Mirelo installation',()=>{
  for(const cue of ['bell','build','cannon','deal','market','tide','victory','warning','harbour_shanty_loop']){
    for(const ext of ['mp3','ogg']){
      const name=path.join(root,'public','audio',cue+'.'+ext);
      assert.ok(fs.statSync(name).size>1000, name);
    }
  }
});
test('TV and phone apply safe per-effect gain; host pause is audible only when opted in',()=>{
  const tv=files('public/tv.html'), phone=files('public/phone.html');
  assert.match(tv,/EFFECT_GAIN=\{/);
  assert.match(tv,/cannon:\.32/);
  assert.match(tv,/after\?\.paused\)return sound\('warning'\)/);
  assert.match(phone,/kind==='cannon'\?\.16/);
  assert.match(tv,/soundOn=false/);
  assert.match(phone,/phoneSounds=false/);
});
