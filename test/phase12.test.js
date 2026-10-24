'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const {legalPlacements}=require('../src/engine');
const {exportBackup,importBackup,MAX_BYTES}=require('../src/backup');

class Socket{
  static OPEN=1;
  static Server=class {on(){}};
  constructor(){this.readyState=1;this.messages=[];}
  send(value){this.messages.push(JSON.parse(value));}
  close(){this.readyState=3;}
  last(type){return [...this.messages].reverse().find(m=>m.type===type);}
}
const original=Module._load;
Module._load=function(name,...rest){return name==='ws'?Socket:original.call(this,name,...rest);};
const {server,rooms,processAction,roomPublic}=require('../server');
Module._load=original;
const act=(socket,type,data={})=>processAction(socket,{type,...data});
const request=(port,endpoint,code,token,backup,headers={})=>fetch(`http://127.0.0.1:${port}/api/backup/${endpoint}`,{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...headers},
  body:JSON.stringify({room:code,...(backup?{backup}:{})})
});
function begunVoyage(){
  const host=new Socket();act(host,'create_room');const credentials=host.last('room_created');
  const guests=[];
  for(const [i,avatarId] of ['isadora','tobias'].entries()){
    const socket=new Socket();act(socket,'join',{room:credentials.code,name:`Captain ${i+1}`,avatarId});
    act(socket,'ready',{ready:true});guests.push(socket);
  }
  act(host,'set_mode',{mode:'quick'});act(host,'start');
  const room=rooms.get(credentials.code);
  while(room.game.phase==='placement'){
    const player=guests.find(s=>s.playerId===room.game.placementOrder[room.game.placementIndex]);
    act(player,'place',{tileId:legalPlacements(room.game)[0]});
  }
  return {host,guests,room,credentials};
}

test('host can export a paused private voyage and restore it on a fresh server room with identities intact',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let firstCode,temporaryCode;
  try{
    const port=server.address().port;
    const {host,guests,room,credentials}=begunVoyage();firstCode=credentials.code;
    const privateToken=room.players[0].token;
    act(guests[0],'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    assert.ok(room.game.orders[room.players[0].id]);
    assert.equal((await request(port,'export',credentials.code,credentials.token)).status,409,'must pause before export');
    act(host,'pause_game');assert.equal(room.paused,true);
    assert.equal((await request(port,'export',credentials.code,'not-the-token')).status,403);
    assert.equal((await request(port,'export',credentials.code,credentials.token,undefined,{Origin:'https://attacker.example'})).status,403);
    const response=await request(port,'export',credentials.code,credentials.token);
    assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.match(response.headers.get('content-disposition'),/private-backup/);
    const backup=await response.json();
    assert.equal(backup.rooms.length,1);
    assert.equal(backup.rooms[0].players[0].token,privateToken);
    assert.equal(backup.rooms[0].game.orders[room.players[0].id][0].kind,'hold');
    assert.equal(JSON.stringify(roomPublic(room)).includes(privateToken),false);
    const round=room.game.round;
    // Replicate redeploy with ephemeral storage wiped; none of this state is on disk.
    rooms.delete(firstCode);
    const nextHost=new Socket();act(nextHost,'create_room');const newDetails=nextHost.last('room_created');temporaryCode=newDetails.code;
    assert.equal((await request(port,'import',temporaryCode,'incorrect',backup)).status,403);
    const result=await request(port,'import',temporaryCode,newDetails.token,backup);
    assert.equal(result.status,200,JSON.stringify(await result.clone().json().catch(()=>({}))));
    assert.equal((await result.json()).code,firstCode);
    const recovered=rooms.get(firstCode);
    assert.ok(recovered);assert.equal(rooms.has(temporaryCode),false);
    assert.equal(recovered.host,nextHost);
    assert.equal(nextHost.roomCode,firstCode);
    assert.equal(recovered.paused,true);
    assert.equal(recovered.players[0].connected,false);
    assert.equal(recovered.players[0].token,privateToken);
    assert.equal(recovered.game.round,round);
    assert.equal(recovered.game.submitted[recovered.players[0].id],true);
    assert.equal(nextHost.last('room_created').token,credentials.token);
    // A previously joined captain may use the exact original credentials.
    const rejoined=new Socket();act(rejoined,'rejoin',{room:firstCode,playerId:recovered.players[0].id,token:privateToken});
    assert.equal(rejoined.last('joined').room,firstCode);
    act(nextHost,'resume_game');assert.equal(recovered.paused,false);
    assert.ok(recovered.game.deadline>Date.now());
  }finally{if(firstCode)rooms.delete(firstCode);if(temporaryCode)rooms.delete(temporaryCode);await new Promise(resolve=>server.close(resolve));}
});

test('backup import refuses invalid versions, malformed rooms, oversize payload and corrupt inputs',()=>{
  assert.throws(()=>importBackup({rooms:[]}),/exactly one/);
  assert.throws(()=>importBackup({schemaVersion:999,savedAt:Date.now(),rooms:[{code:'ABCD'}]}),/Unsupported or corrupt/);
  assert.throws(()=>importBackup({schemaVersion:1,savedAt:Date.now(),rooms:[{code:'ABCD'}]}),/Malformed room/);
  assert.throws(()=>importBackup({schemaVersion:1,rooms:[{x:'x'.repeat(MAX_BYTES)}]}),/512 KB/);
  assert.throws(()=>exportBackup({code:'ABCD',game:{phase:'plan'},paused:false}),/Pause/);
});

test('backup restore refuses overwriting an existing room and forbids importing into a populated lobby',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const codes=[];
  try{
    const port=server.address().port;
    const host=new Socket();act(host,'create_room');const first=host.last('room_created');codes.push(first.code);
    const backup=JSON.parse(exportBackup(rooms.get(first.code)));
    const host2=new Socket();act(host2,'create_room');const other=host2.last('room_created');codes.push(other.code);
    let response=await request(port,'import',other.code,other.token,backup);
    assert.equal(response.status,409);assert.match((await response.json()).error,/already exists/);
    const player=new Socket();act(player,'join',{room:other.code,name:'Player Two',avatarId:'isadora'});
    response=await request(port,'import',other.code,other.token,backup);
    assert.equal(response.status,409);assert.match((await response.json()).error,/empty lobby/);
    assert.equal(rooms.get(other.code).players.length,1);
  }finally{for(const code of codes)rooms.delete(code);await new Promise(resolve=>server.close(resolve));}
});

test('backup UI offers visible, explicit actions and server deployment remains dependency-light',()=>{
  const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
  const pkg=require('../package.json');
  assert.match(tv,/backup-save/);assert.match(tv,/backup-restore/);
  assert.match(tv,/Keep this file private/);
  assert.match(tv,/Authorization':'Bearer/);
  assert.match(tv,/role="status" aria-live="polite"/);
  assert.match(pkg.version,/^0\.(?:12|13)\.(?:0|1)$/);
  assert.deepEqual(Object.keys(pkg.dependencies),['ws']);
});
