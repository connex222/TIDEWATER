'use strict';
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
  assert.equal(game.phase,'foundation-complete');
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
server.close();
