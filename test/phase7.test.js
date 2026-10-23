'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {newGame,legalPlacements,placeSettlement,submitOrders}=require('../src/engine');
const root=path.resolve(__dirname,'..');
const kinds=['harbour_shanty_loop','bell','tide','market','build','cannon','victory','deal','warning'];

test('all nine original procedural sound assets exist in Ogg and MP3 versions',()=>{
 for(const kind of kinds){const filename=path.join(root,'public','audio',`${kind}.ogg`);const data=fs.readFileSync(filename);
  assert.ok(data.length>4000,`Missing or undersized sound: ${kind}`);
  assert.equal(data.toString('ascii',0,4),'OggS',`Invalid Ogg: ${kind}`);
  const mp3=fs.readFileSync(path.join(root,'public','audio',kind+'.mp3'));assert.ok(mp3.length>4000,kind+' MP3');
  assert.ok(mp3.toString('ascii',0,3)==='ID3'||mp3[0]===0xff,'Invalid MP3 '+kind);
 }
});
test('both screens use bundled audio and show accessible explicit mute controls',()=>{
 const tv=fs.readFileSync(path.join(root,'public','tv.html'),'utf8');
 const phone=fs.readFileSync(path.join(root,'public','phone.html'),'utf8');
 assert.match(tv,/id="music"[^>]*aria-pressed="false"/);
 assert.match(tv,/id="sound"[^>]*aria-pressed="false"/);
 assert.match(tv,/harbour_shanty_loop\.mp3/);
 assert.match(tv,/id="volume" type="range"/);
 assert.match(phone,/id="phone-sound"[^>]*aria-pressed="false"/);
 assert.match(phone,/Quick order reference/);
 assert.match(phone,/role="progressbar"/);
 assert.match(tv,/renown-progress/);
});

let server,botOrders;
const MockSocket=class{};MockSocket.OPEN=1;MockSocket.Server=class{on(){}};
const previous=Module._load;
Module._load=function(name,...args){if(name==='ws')return MockSocket;return previous.call(this,name,...args);};
try{({server,botOrders}=require('../server'));}finally{Module._load=previous;}

test('HTTP serves bundled audio with correct MIME, not arbitrary host files',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const kind of kinds){const response=await fetch(`${base}/audio/${kind}.ogg`);
   assert.equal(response.status,200,kind);
   assert.match(response.headers.get('content-type')||'',/audio\/ogg/,kind);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'OggS');
  }
  const mp3=await fetch(base+'/audio/bell.mp3');assert.equal(mp3.status,200);assert.match(mp3.headers.get('content-type')||'',/audio\/mpeg/);
  const head=await fetch(base+'/audio/bell.ogg',{method:'HEAD'});assert.equal(head.status,200);
  const missing=await fetch(base+'/audio/not-existing.ogg');assert.equal(missing.status,404);
  const traversal=await fetch(base+'/audio/%2e%2e/secret-file.ogg');assert.equal(traversal.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('AI composes a legal two-slot order using no other players\' secret data',()=>{
 for(const avatarId of ['isadora','tobias','rosa','finch','mei-lin','hugo','nyla','felix']){
  const players=[{id:'ai',name:'Automated Captain',avatarId},{id:'guest',name:'Guest',avatarId:'nyla'}],g=newGame(players,'standard');
  for(const id of g.placementOrder){const place=placeSettlement(g,players,id,legalPlacements(g)[0],1000);assert.equal(place.ok,true);}
  const p=players[0];p.goods={fish:25,timber:25,spice:25,silk:25};p.gold=60;
  // No earlier submission and a richly resourced captain have two legal options.
  const planned=botOrders(g,p);
  assert.equal(planned.length,2);
  assert.notEqual(planned[0].kind,'hold',avatarId);
  assert.equal(submitOrders(g,players,p.id,planned).ok,true,avatarId);
  assert.deepEqual(g.submitted,{ai:true});
 }
});
