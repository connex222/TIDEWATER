'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {writeSnapshot,restoreSnapshot}=require('../src/persistence');
const {newGame,placeSettlement,legalPlacements,submitOrders}=require('../src/engine');
const {CAPTAINS}=require('../src/constants');
function fixture(){
 const players=['isadora','tobias'].map((avatarId,i)=>({id:`p${i}`,name:`Sailor ${i}`,avatarId,token:`super-long-token-secret-${i}`,connected:true,ready:true,bot:false,ws:{secret:'do-not-serialize'}}));
 const game=newGame(players,'standard');
 for(const id of game.placementOrder)assert.ok(placeSettlement(game,players,id,legalPlacements(game)[0],1_000).ok);
 const room={code:'SALT',token:'super-long-host-secret-123456789',host:{secret:'host-socket-should-never-save'},players,game,createdAt:1234,mode:'standard',paused:false};
 return {players,game,room};
}
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-persist-'));}

test('durable snapshots retain private captain data while dropping live socket objects',()=>{
 const dir=temp();try{
  const {room,players,game}=fixture();players[0].gold=37;players[0].goods.silk=8;
  assert.ok(submitOrders(game,players,players[0].id,[{kind:'market',direction:'sell',quantities:{silk:1}},{kind:'hold'}]).ok);
  const file=path.join(dir,'secure','rooms.json');writeSnapshot(file,new Map([[room.code,room]]),2000);
  const disk=fs.readFileSync(file,'utf8');assert.equal(disk.includes('host-socket-should-never-save'),false);assert.equal(disk.includes('do-not-serialize'),false);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  const restored=restoreSnapshot(file,20_000).get('SALT');
  assert.equal(restored.host,null);assert.equal(restored.paused,true);
  assert.equal(restored.players[0].ws,null);assert.equal(restored.players[0].connected,false);
  assert.equal(restored.players[0].token,players[0].token);
  assert.equal(restored.token,room.token);
  assert.equal(restored.players[0].gold,37);assert.equal(restored.players[0].goods.silk,8);
  assert.deepEqual(restored.game.orders.p0,game.orders.p0);
  assert.deepEqual(restored.game.chart,game.chart);
  assert.equal(restored.game.phase,'plan');assert.equal(restored.game.deadline,null);
  assert.ok(restored.pauseRemainingMs>=1000&&restored.pauseRemainingMs<=90000);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a second restart preserves the paused timer and outstanding deal acceptance window',()=>{
 const dir=temp();try{
  const {room,game}=fixture();const file=path.join(dir,'rooms.json');
  game.deadline=30_000;game.deals=[{id:'deal-1',status:'pending',expiresAt:6_000,fromId:'p0',toId:'p1',give:{fish:1},receive:{silk:1}}];
  writeSnapshot(file,new Map([[room.code,room]]),5_000);
  const restored=restoreSnapshot(file,50_000).get(room.code);
  assert.equal(restored.pauseRemainingMs,25_000);assert.equal(restored.dealRemainingMs['deal-1'],1_000);
  writeSnapshot(file,new Map([[restored.code,restored]]),100_000);
  const again=restoreSnapshot(file,200_000).get(room.code);
  assert.equal(again.pauseRemainingMs,25_000);
  assert.equal(again.dealRemainingMs['deal-1'],1_000);
  assert.equal(again.paused,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('finished games restore as finished, whereas lobby guests must ready again',()=>{
 const dir=temp();try{
  const {room}=fixture();room.game.phase='finished';room.game.deadline=null;
  const lobby={code:'BARN',token:'long-host-token-123456789',mode:'standard',players:[{id:'p3',name:'Skipper',avatarId:CAPTAINS[2].id,token:'long-player-token-123456789',ready:true,connected:true,bot:false,ws:{}}],game:null,createdAt:12};
  const file=path.join(dir,'rooms.json');writeSnapshot(file,new Map([['SALT',room],['BARN',lobby]]),2000);
  const result=restoreSnapshot(file,5000);
  assert.equal(result.get('SALT').paused,false);assert.equal(result.get('SALT').game.phase,'finished');
  assert.equal(result.get('BARN').paused,false);assert.equal(result.get('BARN').players[0].ready,false);
  assert.equal(result.get('BARN').players[0].connected,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('corrupt snapshots are rejected without destroying their bytes',()=>{
 const dir=temp();try{
  const file=path.join(dir,'rooms.json');fs.writeFileSync(file,'{ broken file');
  assert.throws(()=>restoreSnapshot(file),SyntaxError);
  assert.equal(fs.readFileSync(file,'utf8'),'{ broken file');
  fs.writeFileSync(file,JSON.stringify({schemaVersion:999,savedAt:2000,rooms:[]}));
  assert.throws(()=>restoreSnapshot(file),/Unsupported or corrupt/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('player secrets are not exposed by the public room representation after resuming',()=>{
 const dir=temp();try{
  const {room}=fixture();const file=path.join(dir,'rooms.json');writeSnapshot(file,new Map([['SALT',room]]),2000);
  const recovered=restoreSnapshot(file,3000).get('SALT');
  const publicSummary={code:recovered.code,mode:recovered.mode,paused:recovered.paused,
    players:recovered.players.map(({id,name,avatarId,connected,ready,renown})=>({id,name,avatarId,connected,ready,renown}))};
  const payload=JSON.stringify(publicSummary);
  assert.equal(payload.includes(room.token),false);assert.equal(payload.includes(room.players[0].token),false);
  assert.equal(payload.includes('market'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('TV and phone both include restart recovery controls and the host retains credentials across browser restarts',()=>{
 const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
 const phone=fs.readFileSync(path.join(__dirname,'../public/phone.html'),'utf8');
 assert.match(tv,/id="resume-voyage"/);assert.match(tv,/send\('resume_game'\)/);
 assert.match(tv,/localStorage\.setItem\('tidewater\.host'/);
 assert.match(phone,/id="paused-banner"/);assert.match(phone,/el\.textContent='Paused'/);
 assert.match(phone,/!room\.paused&&g\.currentPlacer/);
});
