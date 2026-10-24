'use strict';
// Explicit, host-controlled portable backups for Render deployments without
// persistent disks. The unencrypted JSON contains private orders and tokens:
// keep it on the host's own device, never send it to another player.
const crypto=require('node:crypto');
const {serialiseRoom,restoreDocument,VERSION}=require('./persistence');
const MAX_BYTES=512*1024;

function exportBackup(room,now=Date.now()){
  if(!room||!room.code)throw Error('Room not found.');
  if(room.game&&room.game.phase!=='finished'&&!room.paused)throw Error('Pause the voyage before saving a portable backup.');
  return JSON.stringify({schemaVersion:VERSION,savedAt:now,rooms:[serialiseRoom(room,now)]});
}
function importBackup(input,now=Date.now()){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid Tidewater backup.');
  const text=JSON.stringify(input);
  if(!text||Buffer.byteLength(text,'utf8')>MAX_BYTES)throw Error('Backup exceeds the 512 KB limit.');
  if(!Array.isArray(input.rooms)||input.rooms.length!==1)throw Error('A portable backup must contain exactly one room.');
  const restored=restoreDocument(input,now);
  if(restored.size!==1)throw Error('Invalid or empty Tidewater backup.');
  return [...restored.values()][0];
}
function authorised(token,supplied){
  if(typeof token!=='string'||typeof supplied!=='string')return false;
  const a=Buffer.from(token),b=Buffer.from(supplied);
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}
function checkOrigin(req){
  const origin=req.headers.origin;
  if(!origin)return true; // e.g. a local CLI recovery client with a valid token
  try{return new URL(origin).host===req.headers.host;}catch{return false;}
}
async function readRequest(req){
  if(!/^application\/json(?:\s*;.*)?$/i.test(String(req.headers['content-type']||'')))throw Object.assign(Error('JSON content type required.'),{status:415});
  if(Number(req.headers['content-length']||0)>MAX_BYTES)throw Object.assign(Error('Backup request exceeds 512 KB.'),{status:413});
  let total=0;const chunks=[];
  for await(const chunk of req){total+=chunk.length;if(total>MAX_BYTES)throw Object.assign(Error('Backup request exceeds 512 KB.'),{status:413});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(Error('Malformed backup JSON.'),{status:400});}
}
module.exports={exportBackup,importBackup,authorised,checkOrigin,readRequest,MAX_BYTES};
