'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
for(const file of ['tv.html','phone.html']){
 test(`${file} includes keyboard-usable How to Play and has valid inline JavaScript`,()=>{
   const html=fs.readFileSync(path.join(__dirname,'..','public',file),'utf8');
   assert.match(html,/How to Play/);assert.match(html,/<html lang="en-GB">/);
   assert.doesNotMatch(html,/https?:\/\/[^<\s"']*\.(?:js|css)/);
   const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
   assert.doesNotThrow(()=>new vm.Script(code,{filename:file}));
 });
}
