'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
class MockSocket{};
MockSocket.Server=class{on(){}};
const load=Module._load;
Module._load=function(name,...args){if(name==='ws')return MockSocket;return load.call(this,name,...args);};
const {server}=require('../server');
Module._load=load;
test('bundled logo and all eight portrait images serve with a correct WebP content type',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
   const base=`http://127.0.0.1:${server.address().port}`;
   const ids=['isadora','tobias','rosa','finch','mei-lin','hugo','nyla','felix'];
   for(const file of ['/art/logo.webp','/art/compass-icon.webp',...ids.map(id=>`/art/avatars/${id}_sail_neutral.webp`)]){
     const res=await fetch(base+file);assert.equal(res.status,200,file);
     assert.match(res.headers.get('content-type'),/image\/webp/,file);
     assert.ok((await res.arrayBuffer()).byteLength>10000,file);
   }
   for(const page of ['/tv.html','/phone.html']){
     const res=await fetch(base+page);assert.equal(res.status,200);assert.match(await res.text(),/\/art\/logo\.webp/);
   }
   assert.equal((await fetch(base+'/art/unknown.webp')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
