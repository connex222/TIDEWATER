'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Module=require('node:module');
const {newGame,placeSettlement,legalPlacements,submitOrders}=require('../src/engine');
const {writeSnapshot,restoreSnapshot}=require('../src/persistence');
class FakeSocket{
 constructor(){this.readyState=1;this.messages=[];this.roomCode=null;this.kind=null;this.playerId=null;}
 send(data){this.messages.push(JSON.parse(data));}
 close(code,reason){this.readyState=3;this.closed={code,reason};}
 last(type){return [...this.messages].reverse().find(m=>m.type===type);}
 static OPEN=1;
 static Server=class{on(){}};
}
const original=Module._load;
Module._load=function(request,...args){return request==='ws'?FakeSocket:original.call(this,request,...args);};
const {server,rooms,processAction}=require('../server');Module._load=original;
const action=(ws,type,data={})=>processAction(ws,{type,...data});

test('real protocol host and player rejoin from a saved game, then host resumes without leaking hidden orders',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tidewater-rejoin-'));
 try{
  const players=[0,1].map(i=>({id:`cap-${i}`,name:`Sailor ${i}`,avatarId:['isadora','tobias'][i],token:`long-credential-token-${i}-123456789`,ready:true,connected:true,bot:false,ws:null}));
  const game=newGame(players,'quick');
  for(const id of game.placementOrder)placeSettlement(game,players,id,legalPlacements(game)[0],1000);
  submitOrders(game,players,players[0].id,[{kind:'market',direction:'sell',quantities:{fish:1}},{kind:'hold'}]);
  game.deadline=Date.now()+48000;
  const code='BARN',hostToken='host-long-secret-000000000000';
  const saved={code,token:hostToken,mode:'quick',createdAt:Date.now(),players,game,paused:false};
  const file=path.join(dir,'rooms.json');writeSnapshot(file,new Map([[code,saved]]));
  const restored=restoreSnapshot(file);rooms.set(code,restored.get(code));
  const host=new FakeSocket(),a=new FakeSocket(),b=new FakeSocket();
  action(host,'create_room',{room:code,token:'invalid'});assert.match(host.last('error').message,/recover/);
  action(host,'create_room',{room:code,token:hostToken});assert.equal(host.last('room_created').code,code);
  assert.equal(host.last('state').room.paused,true);
  assert.equal(host.last('state').room.game.deadline,null);
  assert.equal(JSON.stringify(host.last('state')).includes('quantities'),false);
  action(a,'rejoin',{room:code,playerId:players[0].id,token:players[0].token});
  action(b,'rejoin',{room:code,playerId:players[1].id,token:players[1].token});
  assert.equal(a.last('state').self.orders[0].quantities.fish,1);
  assert.equal(b.last('state').self.orders,null);
  assert.equal(b.last('state').room.players[0].token,undefined);
  action(a,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});assert.match(a.last('error').message,/paused/);
  action(host,'resume_game');assert.equal(host.last('state').room.paused,false);
  assert.ok(host.last('state').room.game.deadline>Date.now());
  action(b,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
  assert.equal(rooms.get(code).game.round,2);
  rooms.delete(code);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
server.close();
