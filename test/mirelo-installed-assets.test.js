'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/audio/mirelo-assets.json'),'utf8'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalHashes={bell:'cedd46ef27f5e1372a4cefba4bf1327305904f8df5e28a2cab64f4d10a9d0ebe',build:'237fb2c6144eb430241cc88dca6cf090584d0abb5ca9307289c49f80b2d56a70',cannon:'44046f1619b378077a38761a5b76cd35592c19c7db4acbd8ad741ab0e77433ad',deal:'2ca53278815b1b3919d40100908ab3531b724bea30df5a304265df425ec8f8ea',market:'6cf1005ff84baf7db39d88e0178279afa302968ac0f5b06b7d862c40be4c97ee',tide:'c7cb9174930db3c98d2d5d970326426175d85bfc81d4e94cf5ff93e318976bbd',victory:'ba8b8ae5cff7490bc9deae46a995468d58355ed9c33e63a7f2adb3edc9c598d6',warning:'cdce2ca14006f269821d5ccd33f03a32a8935d1301f272f40e9c27aa78cfbc2d'};
test('all eight user-uploaded Mirelo cues have exact source/master and browser encodings',()=>{
 assert.equal(manifest.effects.length,8);
 assert.deepEqual(manifest.effects.map(x=>x.cue).sort(),Object.keys(originalHashes).sort());
 for(const entry of manifest.effects){
  assert.match(entry.source,/Mirelo SFX 2\.0/);
  assert.ok(entry.duration_ms>=1500&&entry.duration_ms<=4000);
  for(const ext of ['wav','mp3','ogg']){
   const asset=entry.variants[ext];assert.ok(asset.path.startsWith('public/audio/'));
   const p=path.join(root,asset.path),data=fs.readFileSync(p);
   assert.equal(digest(data),asset.sha256,`${entry.cue}.${ext} checksum`);
   assert.equal(data.length,asset.bytes);
   assert.ok(data.length>=8000);
   if(ext==='wav') {assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');}
   if(ext==='ogg') assert.equal(data.toString('ascii',0,4),'OggS');
  }
  assert.notEqual(entry.variants.mp3.sha256,originalHashes[entry.cue],`${entry.cue} must be the upgraded effect`);
 }
});
test('original backing music is retained and no third-party sound URL is used during playback',()=>{
 const music=path.join(root,'public/audio/harbour_shanty_loop.mp3');
 assert.ok(fs.statSync(music).size>50000);
 for(const ui of ['public/tv.html','public/phone.html']){
  const text=fs.readFileSync(path.join(root,ui),'utf8');
  assert.match(text,/\/audio\//);
  assert.doesNotMatch(text,/mirelo\.ai/);
 }
});
