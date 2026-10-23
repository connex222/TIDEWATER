'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {legalPlacements}=require('../src/engine');
const {writeSnapshot,restoreSnapshot}=require('../src/persistence');
const {CAPTAINS}=require('../src/constants');
const hold=[{kind:'hold'},{kind:'hold'}];
class FakeSocket{
  constructor(){this.readyState=1;this.messages=[];this.closed=null;}
  send(text){this.messages.push(JSON.parse(text));}
  close(code,reason){this.closed={code,reason};this.readyState=3;}
  last(type){return [...this.messages].reverse().find(m=>m.type===type);}
  static OPEN=1;
  static Server=class{on(){}};
}
const orig=Module._load;
Module._load=function(req,...args){return req==='ws'?FakeSocket:orig.call(this,req,...args);};
const {server,rooms,processAction}=require('../server');Module._load=orig;
const action=(ws,type,props={})=>processAction(ws,{type,...props});
function newRoom(count,mode='quick'){
 const host=new FakeSocket();action(host,'create_room');const code=host.last('room_created').code;
 const guests=[];
 for(let i=0;i<count;i++){
  const ws=new FakeSocket();action(ws,'join',{room:code,name:`Player ${i+1}`,avatarId:CAPTAINS[i].id});
  assert.ok(ws.last('joined'));
  action(ws,'ready',{ready:true});guests.push(ws);
 }
 action(host,'set_mode',{mode});action(host,'start');
 const room=rooms.get(code);assert.equal(room.players.length,count);
 return {host,guests,room,code};
}
function finishPlacements(room,guests){
 while(room.game.phase==='placement'){
  const p=room.players.find(p=>p.id===room.game.placementOrder[room.game.placementIndex]);
  action(guests[room.players.indexOf(p)],'place',{tileId:legalPlacements(room.game)[0]});
 }
 assert.equal(room.game.phase,'plan');
}
function submitValidHold(room,guests){
 const before=room.game.round;
 for(let i=0;i<guests.length;i++){
  const p=room.players[i],ws=guests[i];
  if(room.game.phase!=='plan')break;
  if(!p.contractDrafted)action(ws,'choose_contracts',{contractIds:p.contracts.map(c=>c.id)});
  if(!room.game.submitted[p.id])action(ws,'submit_orders',{orders:hold});
  assert.equal(ws.last('error')?.message==='The planning window is closed.',false);
 }
 assert.ok(room.game.phase==='finished'||room.game.round>before,'the round should complete');
}
for(const count of [2,4,8])for(const mode of ['quick','standard','advanced']){
 test(`full in-process protocol voyage ${count} human captains in ${mode}: lobby → final scores`,()=>{
  const {host,guests,room,code}=newRoom(count,mode);
  try{
   finishPlacements(room,guests);
   const secret=guests[0].last('state').self;
   assert.equal(secret.id,room.players[0].id);
   assert.equal(host.last('state').self,undefined);
   const privateFirst=guests[1].last('state');
   assert.equal(privateFirst.self.id,room.players[1].id);
   for(let rounds=0;room.game.phase!=='finished'&&rounds<15;rounds++){
    submitValidHold(room,guests);
    assert.ok(room.game.round<=(room.game.mode==='quick'?8:12));
   }
   assert.equal(room.game.phase,'finished');
   assert.ok(room.game.winnerIds.length>=1);
   assert.ok(room.game.winnerIds.every(id=>room.players.some(p=>p.id===id)));
   assert.equal(host.last('state').room.game.phase,'finished');
   assert.equal(JSON.stringify(host.last('state')).includes(room.token),false);
   assert.equal(JSON.stringify(host.last('state')).includes(room.players[0].token),false);
   assert.equal(room.game.chart.tiles.length,37);assert.equal(room.game.chart.lanes.length,18);
  }finally{rooms.delete(code);}
 });
}

test('backup snapshot retains prior valid room after atomic replacement',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-backup-'));
 try{
  const file=path.join(dir,'rooms.json'),roomsToSave=new Map();
  roomsToSave.set('BARN',{code:'BARN',mode:'quick',token:'some-long-host-secret-123456789',players:[],game:null,createdAt:1000});
  writeSnapshot(file,roomsToSave,1000);
  assert.equal(fs.existsSync(file+'.bak'),false,'first snapshot has no predecessor');
  roomsToSave.get('BARN').createdAt=2000;
  writeSnapshot(file,roomsToSave,2000);
  assert.equal(fs.statSync(file+'.bak').mode&0o777,0o600);
  assert.equal(restoreSnapshot(file+'.bak').get('BARN').createdAt,1000);
  assert.equal(restoreSnapshot(file).get('BARN').createdAt,2000);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('corrupted primary does not overwrite the previous known-good backup',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-corrupt-backup-'));
 try{
  const file=path.join(dir,'rooms.json'),m=new Map([['SALT',{code:'SALT',mode:'standard',token:'some-long-host-secret-123456789',players:[],game:null,createdAt:1234}]]);
  writeSnapshot(file,m,2000);writeSnapshot(file,m,3000);
  const initialBackup=fs.readFileSync(file+'.bak','utf8');
  fs.writeFileSync(file,'CORRUPTED PRIMARY');
  writeSnapshot(file,m,4000);
  assert.equal(fs.readFileSync(file+'.bak','utf8'),initialBackup);
  assert.equal(restoreSnapshot(file).get('SALT').code,'SALT');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('explicit backup recovery preserves secrets and places an interrupted match on pause',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-backup-recover-'));
 try{
  const {room,code}=newRoom(2);
  finishPlacements(room,room.players.map(p=>p.ws));
  const file=path.join(dir,'rooms.json'),m=new Map([[room.code,room]]);
  writeSnapshot(file,m,1000);writeSnapshot(file,m,2000);
  fs.writeFileSync(file,'invalid JSON');
  assert.throws(()=>restoreSnapshot(file));
  const recovered=restoreSnapshot(file+'.bak',4000).get(code);
  assert.equal(recovered.paused,true);assert.equal(recovered.host,null);
  assert.equal(recovered.players[0].ws,null);
  assert.equal(recovered.players[0].token,room.players[0].token);
  rooms.delete(code);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('one broken outgoing socket cannot prevent the host and other captains receiving updates',()=>{
 const {host,guests,code,room}=newRoom(2);
 try{
  const before=host.messages.length,other=guests[1].messages.length;
  guests[0].send=()=>{throw Error('Transport disconnected during broadcast');};
  action(guests[1],'ready',{ready:true}); // Once launched, an invalid command still receives an error; trigger host-only success instead.
  action(host,'pause_game');
  assert.equal(room.paused,true);
  assert.ok(host.messages.length>before);
  assert.ok(guests[1].messages.length>other);
 }finally{rooms.delete(code);}
});

test('non-members cannot change paused games, inspect hidden inventories or resolve their rounds',()=>{
 const {host,room,code,guests}=newRoom(2);
 try{
  finishPlacements(room,guests);
  const intruder=new FakeSocket();action(intruder,'resolve_now');
  assert.match(intruder.last('error').message,/Join a room first/);
  action(host,'pause_game');
  const state=JSON.stringify(host.last('state'));
  assert.ok(!state.includes(room.players[0].token));
  assert.ok(!state.includes(room.token));
  action(guests[0],'choose_contracts',{contractIds:room.players[0].contracts.map(c=>c.id)});
  assert.match(guests[0].last('error').message,/paused/);
  assert.equal(room.paused,true);
 }finally{rooms.delete(code);}
});

test('disconnected guest can be replaced by AI and a two-captain voyage still finishes',()=>{
 const {host,room,guests,code}=newRoom(2);
 try{
  finishPlacements(room,guests);
  const abandoned=room.players[1];abandoned.ws=null;abandoned.connected=false;
  action(host,'replace_bot',{playerId:abandoned.id});
  assert.equal(abandoned.bot,true);assert.equal(abandoned.token,null);
  for(let i=0;i<13&&room.game.phase==='plan';i++){
   if(!room.game.submitted[room.players[0].id])action(guests[0],'submit_orders',{orders:hold});
   if(room.game.phase==='plan'&&room.game.submitted[room.players[0].id])action(host,'resolve_now');
  }
  assert.equal(room.game.phase,'finished');
  assert.ok(room.game.winnerIds.length>0);
 }finally{rooms.delete(code);}
});

test('host pause during a live round blocks orders until resume and preserves the submitted flag',()=>{
 const {host,room,guests,code}=newRoom(2);
 try{
  finishPlacements(room,guests);
  action(guests[0],'submit_orders',{orders:hold});
  assert.equal(room.game.submitted[room.players[0].id],true);
  action(host,'pause_game');
  assert.equal(room.paused,true);
  assert.equal(room.game.deadline,null);
  action(guests[1],'submit_orders',{orders:hold});
  assert.equal(room.game.submitted[room.players[1].id],undefined);
  assert.match(guests[1].last('error').message,/paused/);
  action(host,'resume_game');
  assert.ok(room.game.deadline>Date.now());
  assert.equal(room.game.submitted[room.players[0].id],true);
  action(guests[1],'submit_orders',{orders:hold});
  assert.equal(room.game.round,2);
 }finally{rooms.delete(code);}
});

server.close();
