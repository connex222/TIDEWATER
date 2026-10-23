'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {legalPlacements}=require('../src/engine');
const {writeSnapshot,restoreSnapshot}=require('../src/persistence');

class FakeSocket{
  constructor(){this.readyState=1;this.messages=[];this.closed=null;}
  send(msg){this.messages.push(JSON.parse(msg));}
  close(code,reason){this.closed={code,reason};this.readyState=3;}
  last(type){return [...this.messages].reverse().find(m=>m.type===type);}
  static OPEN=1;
  static Server=class{on(){};};
}
const oldLoader=Module._load;
Module._load=function(spec,...other){return spec==='ws'?FakeSocket:oldLoader.call(this,spec,...other);};
const {server,rooms,processAction,detach,roomPublic}=require('../server');
Module._load=oldLoader;
const act=(s,type,rest={})=>processAction(s,{type,...rest});
function create(withGame=true){
  const host=new FakeSocket();act(host,'create_room');
  const credential=host.last('room_created'),guests=[];
  for(const [i,avatarId] of ['isadora','tobias'].entries()){
    const s=new FakeSocket();act(s,'join',{room:credential.code,name:`Captain ${i+1}`,avatarId});
    act(s,'ready',{ready:true});guests.push(s);
  }
  const room=rooms.get(credential.code);
  if(withGame){act(host,'set_mode',{mode:'quick'});act(host,'start');
    while(room.game.phase==='placement'){
      const id=room.game.placementOrder[room.game.placementIndex];
      const guest=guests.find(s=>s.playerId===id);
      act(guest,'place',{tileId:legalPlacements(room.game)[0]});
    }
    assert.equal(room.game.phase,'plan');
  }
  return {host,guests,room,code:credential.code,token:credential.token};
}

test('TV host disconnect automatically freezes an active voyage and blocks changes',()=>{
  const {host,guests,room,code}=create();
  try{
    const originalDeadline=room.game.deadline;
    const id=room.players[0].id;
    act(guests[0],'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    assert.equal(room.game.submitted[id],true);
    detach(host);
    assert.equal(room.host,null);
    assert.equal(room.paused,true);
    assert.equal(room.pauseReason,'host-disconnected');
    assert.equal(room.game.deadline,null);
    assert.ok(room.pauseRemainingMs>0&&room.pauseRemainingMs<=60_000);
    assert.ok(originalDeadline>Date.now());
    act(guests[1],'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    assert.equal(room.game.submitted[room.players[1].id],undefined);
    assert.match(guests[1].last('error').message,/paused/);
    const publicView=roomPublic(room);
    assert.equal(publicView.pauseReason,'host-disconnected');
    assert.equal(publicView.game.deadline,null);
    assert.equal(JSON.stringify(publicView).includes(room.players[0].token),false);
  }finally{rooms.delete(code);}
});

test('host rejoin does not auto-resume a paused voyage; explicit resume restores private orders and clock',()=>{
  const {host,guests,room,code,token}=create();
  try{
    const originalRound=room.game.round;
    act(guests[0],'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    room.game.deals=[{id:'pending-1',status:'pending',expiresAt:Date.now()+15_000,fromId:room.players[0].id,toId:room.players[1].id}];
    detach(host);
    const frozen=room.pauseRemainingMs;
    const reconnect=new FakeSocket();act(reconnect,'create_room',{room:code,token});
    assert.equal(room.host,reconnect);
    assert.equal(room.paused,true);
    assert.equal(room.pauseReason,'host-disconnected');
    assert.equal(reconnect.last('state').room.paused,true);
    act(reconnect,'resume_game');
    assert.equal(room.paused,false);
    assert.equal(room.pauseReason,null);
    assert.equal(room.game.round,originalRound);
    assert.equal(room.game.submitted[room.players[0].id],true);
    assert.ok(room.game.deadline>=Date.now()+frozen-1500);
    assert.ok(room.game.deals[0].expiresAt>Date.now());
    assert.ok(room.game.deals[0].expiresAt<=Date.now()+20_000);
  }finally{rooms.delete(code);}
});

test('host takeover and old socket closure never interrupt the current host',()=>{
  const {host,room,code,token}=create();
  try{
    const newHost=new FakeSocket();act(newHost,'create_room',{room:code,token});
    assert.equal(room.host,newHost);
    detach(host); // delayed close event from superseded TV
    assert.equal(room.host,newHost);
    assert.equal(room.paused,false);
    assert.equal(room.game.phase,'plan');
  }finally{rooms.delete(code);}
});

test('player disconnect leaves the host and match running',()=>{
  const {guests,room,code}=create();
  try{
    detach(guests[0]);
    assert.equal(room.players[0].connected,false);
    assert.equal(room.paused,false);
    assert.equal(room.game.phase,'plan');
  }finally{rooms.delete(code);}
});

test('lobby host disconnect never pauses a game that has not started',()=>{
  const {host,room,code}=create(false);
  try{detach(host);assert.equal(room.paused,false);assert.equal(room.game,null);}
  finally{rooms.delete(code);}
});

test('on restart an interrupted host-pause is preserved and labelled for recovery',()=>{
  const {host,room,code}=create();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-phase11-'));
  try{
    detach(host);
    const target=path.join(dir,'state.json');writeSnapshot(target,new Map([[code,room]]));
    const restored=restoreSnapshot(target).get(code);
    assert.equal(restored.paused,true);
    assert.equal(restored.pauseReason,'server-restart');
    assert.equal(restored.game.deadline,null);
    assert.equal(restored.pauseRemainingMs,room.pauseRemainingMs);
    assert.equal(restored.players[0].ws,null);
  }finally{rooms.delete(code);fs.rmSync(dir,{recursive:true,force:true});}
});

test('Phase 11 UI and package expose automatic pause messaging and live acceptance command',()=>{
  const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
  const phone=fs.readFileSync(path.join(__dirname,'../public/phone.html'),'utf8');
  const pkg=require('../package.json');
  assert.match(tv,/TV connection lost/);
  assert.match(phone,/Voyage paused safely/);
  assert.equal(pkg.scripts['test:live'],'node tools/phase11-live-acceptance.js');
});
server.close();
