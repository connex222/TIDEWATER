'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events'),Module=require('node:module');
class MockSocket extends EventEmitter {
  static OPEN=1;
  constructor(){super();this.readyState=1;this.messages=[];this.closed=null;}
  send(data){this.messages.push(JSON.parse(data));}
  close(code,reason){this.closed={code,reason};this.readyState=3;this.emit('close');}
  ping(){this.emit('pong');}
}
MockSocket.Server=class extends EventEmitter{
  constructor(){super();this.clients=new Set();}
  connect(ws,request={headers:{host:'localhost'}}){this.clients.add(ws);this.emit('connection',ws,request);ws.once('close',()=>this.clients.delete(ws));}
};
const load=Module._load;
Module._load=function(request,...args){return request==='ws'?MockSocket:load.call(this,request,...args);};
const {wss,server}=require('../server');Module._load=load;
test('WebSocket per-connection message rate limit closes flooding client with code 1008',()=>{
  const ws=new MockSocket();wss.connect(ws);
  for(let i=0;i<80;i++)ws.emit('message',Buffer.from(JSON.stringify({type:'preview',room:'NOPE'})));
  assert.equal(ws.closed,null);assert.equal(ws.messages.length,80);
  ws.emit('message',Buffer.from(JSON.stringify({type:'preview',room:'NOPE'})));
  assert.equal(ws.closed.code,1008);
  assert.match(ws.closed.reason,/rate limit/i);
});
test('WebSocket per-connection request window resets after ten seconds; cross-origin clients denied',()=>{
  const ws=new MockSocket();wss.connect(ws);
  ws.rateWindow-=11_000;
  for(let i=0;i<50;i++)ws.emit('message',Buffer.from('{"type":"preview","room":"NOPE"}'));
  assert.equal(ws.closed,null);
  assert.equal(ws.rateCount,50);
  const bad=new MockSocket();wss.connect(bad,{headers:{origin:'https://evil.example',host:'tidewater.example'}});
  assert.equal(bad.closed.code,1008);
});
server.close();
