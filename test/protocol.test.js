'use strict';
const {legalPlacements}=require('../src/engine');
const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
class FakeSocket{
  constructor(){this.readyState=1;this.messages=[];this.roomCode=null;this.kind=null;this.playerId=null;}
  send(data){this.messages.push(JSON.parse(data));}
  close(code,reason){this.closed={code,reason};this.readyState=3;}
  last(type){return [...this.messages].reverse().find(msg=>msg.type===type);}
}
FakeSocket.OPEN=1;FakeSocket.Server=class{on(){}};
const originalLoad=Module._load;
Module._load=function(request,...args){if(request==='ws')return FakeSocket;return originalLoad.call(this,request,...args);};
const {processAction,rooms,server}=require('../server');Module._load=originalLoad;
function action(ws,type,rest={}){processAction(ws,{type,...rest});}
function makeRoom(){const host=new FakeSocket();action(host,'create_room');const details=host.last('room_created');assert.ok(details.code);return {host,room:rooms.get(details.code),details};}
test('host-only mode selection, protected lobby and duplicate captain rejection',()=>{
  const {host,room,details}=makeRoom();const p1=new FakeSocket(),p2=new FakeSocket();
  action(p1,'join',{room:details.code,name:'Captain Jane',avatarId:'isadora'});
  assert.equal(p1.last('joined').room,details.code);
  action(p2,'join',{room:details.code,name:'Captain Tom',avatarId:'isadora'});
  assert.match(p2.last('error').message,/already been claimed/);
  action(p2,'join',{room:details.code,name:'Captain Tom',avatarId:'tobias'});
  assert.equal(room.players.length,2);
  action(p1,'set_mode',{mode:'advanced'});assert.equal(room.mode,'standard');
  action(host,'set_mode',{mode:'quick'});assert.equal(room.mode,'quick');
  action(host,'start');assert.match(host.last('error').message,/ready/);
  action(p1,'ready',{ready:true});action(p2,'ready',{ready:true});action(host,'start');
  assert.equal(room.game.phase,'placement');assert.equal(room.game.mode,'quick');
  assert.equal(room.game.placementOrder.length,4);
  const state=host.last('state');assert.equal(state.room.players[0].token,undefined);
  assert.equal(state.room.players[0].goods,undefined);assert.equal(p1.last('state').self.gold,2);
  assert.equal(p2.last('state').self.goods.fish,1);
});
test('settlement turn ownership is enforced through the WebSocket protocol',()=>{
  const {host,room,details}=makeRoom();const a=new FakeSocket(),b=new FakeSocket();
  action(a,'join',{room:details.code,name:'Anna','avatarId':'isadora'});
  action(b,'join',{room:details.code,name:'Ben','avatarId':'tobias'});
  action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
  const firstTile=room.game.chart.tiles.find(t=>t.type==='fish').id;
  action(b,'place',{tileId:firstTile});assert.match(b.last('error').message,/not your turn/);
  action(a,'place',{tileId:firstTile});assert.equal(room.game.chart.tiles.find(t=>t.id===firstTile).owner,a.playerId);
  assert.equal(room.game.placementIndex,1);
});
test('player credentials support rejoining without revealing a token to the host',()=>{
  const {room,details}=makeRoom();const first=new FakeSocket();
  action(first,'join',{room:details.code,name:'Sailing Sam',avatarId:'rosa'});
  const joined=first.last('joined');const duplicate=new FakeSocket();
  action(duplicate,'rejoin',{room:details.code,playerId:joined.playerId,token:'bad'});
  assert.match(duplicate.last('error').message,/not recognised/);
  action(duplicate,'rejoin',{room:details.code,playerId:joined.playerId,token:joined.token});
  assert.equal(room.players.length,1);assert.equal(room.players[0].ws,duplicate);
  assert.equal(first.closed.code,4000);
  assert.equal(duplicate.last('joined').playerId,joined.playerId);
});
test('host can add AI and the AI completes legal opening placements',()=>{
  const {host,room,details}=makeRoom();const a=new FakeSocket();
  action(a,'join',{room:details.code,name:'Anna',avatarId:'isadora'});
  action(host,'add_bot');assert.equal(room.players.length,2);assert.equal(room.players[1].bot,true);
  action(a,'ready',{ready:true});action(host,'start');
  const game=room.game;assert.equal(game.placementIndex,0);
  const first=game.chart.tiles.find(t=>t.type==='fish').id;action(a,'place',{tileId:first});
  assert.equal(game.placementIndex,3); // AI takes its two consecutive snake-order turns.
  const second=game.chart.tiles.find(t=>['fish','timber','spice','silk'].includes(t.type)&&t.owner===null).id;
  action(a,'place',{tileId:second});assert.equal(game.placementIndex,4);
  assert.equal(game.phase,'plan');
});
test('only the host can kick an unready player; rooms disallow ninth captain',()=>{
 const {host,room,details}=makeRoom();const guests=[];
 for(let i=0;i<8;i++){const p=new FakeSocket();action(p,'join',{room:details.code,name:`Guest ${i}`,avatarId:['isadora','tobias','rosa','finch','mei-lin','hugo','nyla','felix'][i]});guests.push(p);}
 assert.equal(room.players.length,8);
 const ninth=new FakeSocket();action(ninth,'join',{room:details.code,name:'Ninth captain',avatarId:'isadora'});
 assert.match(ninth.last('error').message,/eight captains/);
 action(guests[0],'kick',{playerId:room.players[1].id});assert.equal(room.players.length,8);
 action(host,'kick',{playerId:room.players[1].id});assert.equal(room.players.length,7);
});
test('secret orders are visible only to their owning phone and cannot be submitted by the host',()=>{
  const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket();
  action(a,'join',{room:details.code,name:'Alyssa',avatarId:'isadora'});
  action(b,'join',{room:details.code,name:'Bryn',avatarId:'tobias'});
  action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
  for(const captain of room.game.placementOrder){
    const sender=room.players.find(p=>p.id===captain).ws;
    action(sender,'place',{tileId:legalPlacements(room.game)[0]});
  }
  assert.equal(room.game.phase,'plan');
  const orders=[{kind:'market',direction:'sell',quantities:{fish:1}},{kind:'hold'}];
  action(host,'submit_orders',{orders});assert.match(host.last('error').message,/captain/);
  action(a,'submit_orders',{orders});
  assert.equal(room.game.phase,'plan');assert.equal(room.game.submitted[a.playerId],true);
  const hostState=host.last('state'),aState=a.last('state'),bState=b.last('state');
  assert.equal(JSON.stringify(hostState).includes('quantities'),false);
  assert.equal(JSON.stringify(bState).includes('quantities'),false);
  assert.equal(aState.self.orders[0].kind,'market');assert.equal(aState.self.orders[0].quantities.fish,1);assert.equal(aState.self.orders[1].kind,'hold');
  assert.equal(aState.self.submitted,true);assert.equal(bState.self.submitted,false);
  action(a,'submit_orders',{orders});assert.match(a.last('error').message,/locked/);
  action(b,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
  assert.equal(room.game.round,2);assert.equal(room.game.phase,'plan');
  assert.equal(room.game.market.fish,1);
});
test('host can safely end a stalled round and AI replacement continues planning',()=>{
  const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket();
  action(a,'join',{room:details.code,name:'Admiral',avatarId:'isadora'});
  action(b,'join',{room:details.code,name:'Trader',avatarId:'tobias'});
  action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
  for(const player of room.game.placementOrder){action(room.players.find(p=>p.id===player).ws,'place',{tileId:legalPlacements(room.game)[0]});}
  action(a,'resolve_now');assert.match(a.last('error').message,/Only the host/);
  action(host,'resolve_now');assert.equal(room.game.round,2);
  const replacement=room.players[1];replacement.connected=false;replacement.ws=null;
  action(host,'replace_bot',{playerId:replacement.id});
  assert.equal(room.game.submitted[replacement.id],true);
  assert.equal(host.last('state').room.game.submittedIds.includes(replacement.id),true);
});
test('two AI captains can complete all timed rounds without clients becoming stuck',()=>{
  const {host,room}=makeRoom();action(host,'add_bot');action(host,'add_bot');action(host,'start');
  assert.equal(room.game.phase,'finished');assert.ok(room.game.round>=1&&room.game.round<=12,'game may finish early when a captain wins');
  assert.ok(room.game.winnerIds.length>0);
});
server.close();

test('private trade visibility and accept permissions remain server-controlled',()=>{
 const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket(),c=new FakeSocket();
 for(const [sock,name,avatar] of [[a,'Alex','isadora'],[b,'Bill','tobias'],[c,'Chloe','rosa']]){
   action(sock,'join',{room:details.code,name,avatarId:avatar});action(sock,'ready',{ready:true});
 }
 action(host,'start');
 for(const id of room.game.placementOrder)action(room.players.find(p=>p.id===id).ws,'place',{tileId:legalPlacements(room.game)[0]});
 assert.equal(room.game.phase,'plan');
 const offer={kind:'deal',targetId:b.playerId,give:{fish:1},receive:{silk:1}};
 action(a,'submit_orders',{orders:[offer,{kind:'hold'}]});
 const id=room.game.deals[0].id;
 assert.equal(a.last('state').self.deals[0].id,id);
 assert.equal(b.last('state').self.deals[0].id,id);
 assert.equal(c.last('state').self.deals.length,0);
 assert.equal(host.last('state').room.game.deals,undefined);
 action(c,'answer_deal',{dealId:id,accept:true});assert.match(c.last('error').message,/no longer available/);
 action(host,'answer_deal',{dealId:id,accept:true});assert.match(host.last('error').message,/Only a captain/);
 const pa=room.players.find(p=>p.id===a.playerId),pb=room.players.find(p=>p.id===b.playerId);
 const beforeA=pa.goods.fish,beforeB=pb.goods.silk;
 action(b,'answer_deal',{dealId:id,accept:true});
 assert.equal(pa.goods.fish,beforeA-1);assert.equal(pb.goods.silk,beforeB-1);
 assert.equal(room.game.deals[0].status,'accepted');
});

test('captain upgrade choices are authorised and cannot be changed after locking orders',()=>{
 const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket();
 action(a,'join',{room:details.code,name:'Anna',avatarId:'isadora'});
 action(b,'join',{room:details.code,name:'Bob',avatarId:'tobias'});
 action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
 for(const id of room.game.placementOrder)action(room.players.find(p=>p.id===id).ws,'place',{tileId:legalPlacements(room.game)[0]});
 action(host,'choose_upgrade',{upgradeId:'privateers'});assert.match(host.last('error').message,/Only a captain/);
 action(a,'choose_upgrade',{upgradeId:'privateers'});
 assert.deepEqual(a.last('state').self.upgrades,['privateers']);
 assert.equal(b.last('state').self.upgrades.length,0);
 action(a,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
 action(a,'choose_upgrade',{upgradeId:'shipwrights'});
 assert.match(a.last('error').message,/not available/);
});

test('only the host may resume a paused recovered game, with its remaining timer and private orders preserved',()=>{
 const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket();
 action(a,'join',{room:details.code,name:'Alice',avatarId:'isadora'});
 action(b,'join',{room:details.code,name:'Bernie',avatarId:'tobias'});
 action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
 for(const id of room.game.placementOrder)action(room.players.find(p=>p.id===id).ws,'place',{tileId:legalPlacements(room.game)[0]});
 action(a,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
 room.paused=true;room.pauseRemainingMs=15_000;room.game.deadline=null;
 action(b,'resume_game');assert.match(b.last('error').message,/Only the host/);
 action(b,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});assert.match(b.last('error').message,/paused/);
 assert.equal(room.game.submitted[b.playerId],undefined);
 const snapshot=JSON.stringify(host.last('state'));
 assert.equal(snapshot.includes('quantities'),false);
 const now=Date.now();action(host,'resume_game');
 assert.equal(room.paused,false);
 assert.ok(room.game.deadline>=now+14_500&&room.game.deadline<=Date.now()+15_500);
 assert.equal(room.game.submitted[a.playerId],true);
 action(b,'submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
 assert.equal(room.game.round,2);
});

test('host may pause and resume mid-round; the clock freezes and guests cannot pause',()=>{
 const {host,room,details}=makeRoom(),a=new FakeSocket(),b=new FakeSocket();
 action(a,'join',{room:details.code,name:'Admiral',avatarId:'isadora'});
 action(b,'join',{room:details.code,name:'Helmsman',avatarId:'tobias'});
 action(a,'ready',{ready:true});action(b,'ready',{ready:true});action(host,'start');
 for(const captain of room.game.placementOrder)action(room.players.find(p=>p.id===captain).ws,'place',{tileId:legalPlacements(room.game)[0]});
 action(a,'pause_game');assert.match(a.last('error').message,/Only the host/);
 action(host,'pause_game');assert.equal(room.paused,true);assert.equal(room.game.deadline,null);
 assert.equal(host.last('state').room.game.deadline,null);
 action(host,'resolve_now');assert.match(host.last('error').message,/paused/);
 action(host,'resume_game');assert.equal(room.paused,false);
 assert.ok(room.game.deadline>Date.now());
});
