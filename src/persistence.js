'use strict';
// Local, synchronous, atomic snapshots for one-process game-night hosting.
// Persistent storage must be provided by the hosting platform for restart safety.
const fs=require('node:fs');
const path=require('node:path');
const VERSION=1;
const CODE=/^[A-HJ-NP-Z]{4}$/;
const STATES=new Set(['placement','plan','finished']);
const MAX_MS=90_000;
function serialiseRoom(room,now=Date.now()){
  return {
    code:room.code,token:room.token,mode:room.mode,createdAt:room.createdAt,
    paused:!!room.paused,pauseRemainingMs:room.paused?room.pauseRemainingMs:null,
    dealRemainingMs:Object.fromEntries((room.game?.deals||[]).filter(d=>d.status==='pending').map(d=>[d.id,room.paused?(room.dealRemainingMs?.[d.id]??Math.max(0,d.expiresAt-now)):Math.max(0,d.expiresAt-now)])),
    players:room.players.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='ws'))),
    game:room.game
  };
}
function writeSnapshot(file,rooms,now=Date.now()){
  if(!file)return;
  const dir=path.dirname(file);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const payload=JSON.stringify({schemaVersion:VERSION,savedAt:now,rooms:[...rooms.values()].map(r=>serialiseRoom(r,now))});
  const tmp=path.join(dir,`.${path.basename(file)}.${process.pid}.tmp`);
  try{
    const fd=fs.openSync(tmp,'w',0o600);
    try{fs.writeFileSync(fd,payload);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,file);
    try{const dirFd=fs.openSync(dir,'r');try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}}catch{/* Some volumes do not support directory fsync. */}
  }catch(e){try{fs.unlinkSync(tmp);}catch{}throw e;}
}
function restoreSnapshot(file,now=Date.now()){
  if(!file||!fs.existsSync(file))return new Map();
  // A bad/mismatched snapshot stops boot instead of silently losing matches.
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!doc||doc.schemaVersion!==VERSION||!Number.isFinite(doc.savedAt)||!Array.isArray(doc.rooms))throw Error('Unsupported or corrupt Tidewater snapshot. Original file has been preserved.');
  if(doc.rooms.length>1000)throw Error('Snapshot exceeds maximum room count.');
  const rooms=new Map();
  for(const saved of doc.rooms){
    if(!saved||typeof saved.code!=='string'||!CODE.test(saved.code)||typeof saved.token!=='string'||saved.token.length<16||!Array.isArray(saved.players)||saved.players.length>8||saved.players.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.avatarId!=='string'||(p.bot!==true&&(typeof p.token!=='string'||p.token.length<16))))throw Error('Malformed room in Tidewater snapshot; original file preserved.');
    if(saved.game&&(!STATES.has(saved.game.phase)||!saved.game.chart||!Array.isArray(saved.game.chart.tiles)||saved.game.chart.tiles.length!==37||!Array.isArray(saved.game.chart.lanes)||saved.game.chart.lanes.length!==18))throw Error('Malformed game in Tidewater snapshot; original file preserved.');
    if(rooms.has(saved.code))throw Error('Duplicate room code in Tidewater snapshot.');
    const game=saved.game||null;
    const paused=!!game&&game.phase!=='finished';
    const duration=game?.mode==='quick'?60_000:MAX_MS;
    const remaining=saved.paused&&Number.isFinite(saved.pauseRemainingMs)?saved.pauseRemainingMs:(game?.deadline??now)-doc.savedAt;
    const pauseRemainingMs=game?.phase==='plan'?Math.min(duration,Math.max(1000,remaining)):null;
    // Move outstanding offer deadlines into the restored timeline. A pause
    // stops their clock; the host must explicitly resume the match.
    const dealRemainingMs={};
    for(const d of game?.deals||[])if(d.status==='pending'){
      const left=saved.dealRemainingMs?.[d.id]??(d.expiresAt-doc.savedAt);
      dealRemainingMs[d.id]=Math.max(0,Math.min(20_000,Number(left)||0));
    }
    if(paused&&game?.phase==='plan')game.deadline=null;
    const players=saved.players.map(p=>({...p,ws:null,connected:!!p.bot,ready:p.bot?true:(game?!!p.ready:false)}));
    rooms.set(saved.code,{
      code:saved.code,token:saved.token,host:null,mode:saved.mode,createdAt:saved.createdAt||now,
      players,game,paused,pauseRemainingMs,dealRemainingMs
    });
  }
  return rooms;
}
module.exports={writeSnapshot,restoreSnapshot,serialiseRoom,VERSION};
