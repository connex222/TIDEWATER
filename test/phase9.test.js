'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {legalPlacements}=require('../src/engine');
const {heartbeatTick,startHeartbeat}=require('../src/heartbeat');

class FakeSocket{
  static OPEN=1;
  static Server=class{on(){}};
  constructor(){this.readyState=1;this.messages=[];this.closed=null;}
  send(data){this.messages.push(JSON.parse(data));}
  close(code,reason){this.closed={code,reason};this.readyState=3;}
  last(type){return [...this.messages].reverse().find(m=>m.type===type);}
}
const original=Module._load;
Module._load=function(request,...args){return request==='ws'?FakeSocket:original.call(this,request,...args);};
const {server,rooms,processAction}=require('../server');Module._load=original;
const act=(ws,type,data={})=>processAction(ws,{type,...data});
function lobby(){const host=new FakeSocket();act(host,'create_room');const auth=host.last('room_created');return {host,room:rooms.get(auth.code),auth};}

test('superseded player cannot change ready state or captain selection',()=>{
  const {room,auth}=lobby(),old=new FakeSocket(),current=new FakeSocket();
  act(old,'join',{room:auth.code,name:'Adele',avatarId:'isadora'});
  const token=old.last('joined');
  act(current,'rejoin',{room:auth.code,playerId:token.playerId,token:token.token});
  assert.equal(room.players[0].ws,current);
  assert.equal(old.closed.code,4000);
  old.readyState=1; // Simulate an in-flight frame before the close takes effect.
  act(old,'ready',{ready:true});
  assert.match(old.last('error').message,/replaced/);
  assert.equal(room.players[0].ready,false);
  act(old,'choose_avatar',{avatarId:'tobias'});
  assert.match(old.last('error').message,/replaced/);
  assert.equal(room.players[0].avatarId,'isadora');
  act(current,'ready',{ready:true});
  assert.equal(room.players[0].ready,true);
  rooms.delete(auth.code);
});

test('superseded host cannot kick, start, pause or change mode',()=>{
  const {host:old,room,auth}=lobby(),current=new FakeSocket();
  act(current,'create_room',{room:auth.code,token:auth.token});
  assert.equal(room.host,current);
  assert.equal(old.closed.code,4001);
  old.readyState=1; // Simulate an in-flight frame from the superseded host.
  act(old,'set_mode',{mode:'advanced'});assert.match(old.last('error').message,/replaced/);assert.equal(room.mode,'standard');
  act(old,'add_bot');assert.equal(room.players.length,0);
  act(old,'start');assert.equal(room.game,null);
  act(old,'pause_game');assert.equal(room.paused,false);
  act(current,'set_mode',{mode:'quick'});assert.equal(room.mode,'quick');
  rooms.delete(auth.code);
});

test('superseded player cannot place a settlement during a live opening',()=>{
  const {host,room,auth}=lobby(),old=new FakeSocket(),current=new FakeSocket();
  act(old,'join',{room:auth.code,name:'Alice',avatarId:'isadora'});
  const seat=old.last('joined');act(host,'add_bot');act(old,'ready',{ready:true});act(host,'start');
  act(current,'rejoin',{room:auth.code,playerId:seat.playerId,token:seat.token});
  old.readyState=1;
  const tile=legalPlacements(room.game)[0];
  const before=room.game.placementIndex;
  act(old,'place',{tileId:tile});assert.match(old.last('error').message,/replaced/);
  assert.equal(room.game.placementIndex,before);
  act(current,'place',{tileId:tile});assert.ok(room.game.placementIndex>before);
  rooms.delete(auth.code);
});

function socket(){const s=new EventEmitter();s.pings=0;s.terminated=false;s.ping=()=>{s.pings++;};s.terminate=()=>{s.terminated=true;};return s;}
test('heartbeat marks first ping as pending and terminates a nonresponsive socket on next tick',()=>{
  const s=socket(),srv=new EventEmitter();srv.clients=new Set([s]);
  const timer=startHeartbeat(srv,{intervalMs:60000});srv.emit('connection',s);
  assert.equal(s.tidewaterAlive,true);
  heartbeatTick(srv);assert.equal(s.pings,1);assert.equal(s.terminated,false);
  heartbeatTick(srv);assert.equal(s.terminated,true);
  clearInterval(timer);
});
test('heartbeat pong keeps responsive connections active',()=>{
  const s=socket(),srv=new EventEmitter();srv.clients=new Set([s]);
  const timer=startHeartbeat(srv,{intervalMs:60000});srv.emit('connection',s);
  heartbeatTick(srv);s.emit('pong');heartbeatTick(srv);
  assert.equal(s.pings,2);assert.equal(s.terminated,false);
  clearInterval(timer);
});
test('heartbeat does not terminate a synthetic transport with no ping support',()=>{
  const s=new EventEmitter();s.terminated=false;s.terminate=()=>{s.terminated=true;};
  const srv=new EventEmitter();srv.clients=new Set([s]);
  const timer=startHeartbeat(srv,{intervalMs:60000});srv.emit('connection',s);
  heartbeatTick(srv);heartbeatTick(srv);
  assert.equal(s.terminated,false);
  clearInterval(timer);
});

test('TV and phone display an accessible reconnection banner with preserved editing on phone',()=>{
  const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
  const phone=fs.readFileSync(path.join(__dirname,'../public/phone.html'),'utf8');
  for(const html of [tv,phone]){
    assert.match(html,/id="connection-banner"[^>]*role="status"/);
    assert.match(html,/aria-live="polite"/);
    assert.match(html,/onclose=event/);
  }
  assert.match(phone,/sessionStorage\.setItem\(draftKey\(room\.game\)/);
  assert.match(phone,/signature===editorSignature/);
  assert.match(phone,/addEventListener\('input'/);
  assert.match(tv,/3\.5vw/);
});
server.close();
