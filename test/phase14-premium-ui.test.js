"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
const phone=fs.readFileSync(path.join(__dirname,'../public/phone.html'),'utf8');
const pkg=require('../package.json');

test('premium landing and phone UI ship without new runtime dependencies',()=>{
  assert.equal(pkg.version,'0.14.0');
  assert.deepEqual(Object.keys(pkg.dependencies),['ws']);
  assert.match(tv,/id="home-splash"/);
  assert.match(tv,/id="landing-enter"/);
  assert.match(tv,/id="landing-help"/);
  assert.match(tv,/id="landing-code"/);
  assert.match(tv,/id="landing-qr"/);
  assert.match(tv,/id="landing-joinlink"/);
  assert.match(tv,/id="landing-phone"/);
  assert.match(tv,/updateLanding\(\)/);
  assert.match(tv,/room\.phase!=='lobby'\|\|room\.players\.length>0/);
  assert.match(tv,/location\.origin.*phone\.html\?room=/);
});
test('all host, private-backup, QR and accessibility controls remain available',()=>{
  for (const id of ['start','add-ai','mode','qr','code','joinlink','help','overlay','close-help','pause-voyage','resume-voyage','reveal','backup-save','backup-restore','backup-file','sound','music','volume','players','map'])
    assert.ok(tv.includes(`id="${id}"`),`TV control lost: ${id}`);
  for(const id of ['join','room','name','captains','ready','rules-open','rules-close','submit-orders','game-view','placement-view','order-editor','phone-sound'])
    assert.ok(phone.includes(`id="${id}"`),`Phone control lost: ${id}`);
  assert.match(tv,/aria-live="polite"/);
  assert.match(tv,/prefers-reduced-motion/);
  assert.match(phone,/prefers-reduced-motion/);
});
test('professional art and ship audio are preserved, and all eight captains remain selectable',()=>{
  assert.match(tv,/\/art\/logo.webp/);
  for(const name of ['isadora','tobias','rosa','finch','mei-lin','hugo','nyla','felix']){
    assert.ok(fs.existsSync(path.join(__dirname,`../public/art/avatars/${name}_sail_neutral.webp`)));
    assert.match(phone,new RegExp(name));
  }
  for(const effect of ['bell','cannon','deal','market','build','tide','victory','warning']){
    for(const fmt of ['mp3','ogg']) assert.ok(fs.statSync(path.join(__dirname,`../public/audio/${effect}.${fmt}`)).size>8000);
    assert.ok(fs.statSync(path.join(__dirname,`../public/audio/mirelo-masters/${effect}.wav`)).size>100000);
  }
});
test('landing, controller and gameplay layouts have 320px responsive and visible focus support',()=>{
 assert.match(tv,/@media\(max-width:480px\)/);
 assert.match(tv,/\.home-buttons\s*\{/);
 assert.match(tv,/\.home-strip/);
 assert.match(phone,/@media\(max-width:390px\)/);
 assert.match(phone, /\.avatar-choice\.selected/);
 assert.match(phone, /\.text-input/);
 assert.match(tv,/focus-visible/);
 assert.match(phone,/focus-visible/);
});
