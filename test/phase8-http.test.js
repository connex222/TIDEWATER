'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Module=require('node:module');
class FakeSocket{static OPEN=1;static Server=class{on(){}};}
const load=Module._load;
Module._load=function(request,...args){if(request==='ws')return FakeSocket;return load.call(this,request,...args);};
const {server}=require('../server');Module._load=load;
const root='http://127.0.0.1';
function fetchRoute(port,route){return fetch(`${root}:${port}${route}`)}
test('same-origin HTTP routes serve Phase 8 assets and reject unknown paths',async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const port=server.address().port;
  const health=await fetchRoute(port,'/health');assert.equal(health.status,200);assert.equal((await health.json()).app,'Tidewater');
  const tv=await fetchRoute(port,'/tv.html');assert.equal(tv.status,200);assert.match(await tv.text(),/resume-voyage/);
  const phone=await fetchRoute(port,'/phone.html');assert.equal(phone.status,200);assert.match(await phone.text(),/paused-banner/);
  const logo=await fetchRoute(port,'/art/logo.webp');assert.equal(logo.status,200);assert.match(logo.headers.get('content-type'),/webp/);assert.ok((await logo.arrayBuffer()).byteLength>1000);
  const music=await fetchRoute(port,'/audio/harbour_shanty_loop.mp3');assert.equal(music.status,200);assert.ok((await music.arrayBuffer()).byteLength>1000);
  assert.equal((await fetchRoute(port,'/not-found')).status,404);
  assert.equal((await fetchRoute(port,'/art/missing-portrait.webp')).status,404);
 }finally{await new Promise(ok=>server.close(ok));}
});
