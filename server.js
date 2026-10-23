'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const WebSocket=require('ws');
const {CAPTAINS,MODES,randomInt}=require('./src/constants');
const {newGame,placeSettlement,publicGame,currentPlacer,legalPlacements,submitOrders,resolveRound,everyoneSubmitted,canSettle,legalTargets,applyOrder,chooseUpgrade,upgradeOptions,chooseContracts,expireDeals,pendingDeals,answerDeal}=require('./src/engine');
const {qrSvg}=require('./src/qr');
const {writeSnapshot,restoreSnapshot}=require('./src/persistence');
const PORT=Number(process.env.PORT)||3000;
const PUBLIC=path.resolve(__dirname,'public');
// In automated protocol tests the server is imported with a mocked transport;
// normal production execution always enables durable state snapshots.
const STATE_FILE=process.env.TIDEWATER_STATE_FILE||path.join(__dirname,'data','rooms.json');
const persistenceEnabled=require.main===module||!!process.env.TIDEWATER_STATE_FILE;
const rooms=persistenceEnabled?restoreSnapshot(STATE_FILE):new Map();
let persistenceError=null;
function saveRooms(){
  if(!persistenceEnabled)return;
  try{writeSnapshot(STATE_FILE,rooms);persistenceError=null;}
  catch(e){persistenceError=e;console.error('Tidewater state persistence failed:',e.message);}
}
const codeChars='ABCDEFGHJKLMNPQRSTUVWXYZ';
const makeToken=()=>crypto.randomBytes(24).toString('base64url');
const makeId=()=>crypto.randomUUID();
function makeCode(){let value;do{value=Array.from({length:4},()=>codeChars[randomInt(codeChars.length)]).join('');}while(rooms.has(value));return value;}
function send(ws,message){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));}
function error(ws,message){send(ws,{type:'error',message});}
function roomPublic(room){return {
  code:room.code,mode:room.mode,phase:room.game?.phase||'lobby',paused:!!room.paused,
  captains:CAPTAINS,players:room.players.map(({id,name,avatarId,ready,connected,bot,renown})=>({id,name,avatarId,ready,connected,bot,renown:renown||0})),
  game:room.paused&&room.game?{...publicGame(room.game),deadline:null}:publicGame(room.game)
};}
function publish(room){
  saveRooms();
  const data=roomPublic(room);
  send(room.host,{type:'state',room:data,host:true});
  for(const p of room.players){
    send(p.ws,{type:'state',room:data,self:{id:p.id,avatarId:p.avatarId,goods:p.goods||null,gold:p.gold??null,renown:p.renown??0,contracts:p.contracts||[],contractReserve:p.contractDrafted?[]:p.contractReserve||[],contractDrafted:!!p.contractDrafted,completedContracts:p.completedContracts||0,orders:room.game?.orders[p.id]||null,submitted:!!room.game?.submitted[p.id],legalTargets:legalTargets(room.game,p.id),upgrades:p.upgrades||[],upgradeOptions:room.game?upgradeOptions(room.game,p):[],deals:room.game?.deals.filter(d=>d.fromId===p.id||d.toId===p.id).map(d=>({id:d.id,fromId:d.fromId,toId:d.toId,give:d.give,receive:d.receive,status:d.status,expiresAt:d.expiresAt}))||[]}});
  }
}
function record(room,text){if(room.game){room.game.history.push(text);room.game.history=room.game.history.slice(-30);}}
function availableAvatar(room,requested,exceptId=null){return CAPTAINS.some(c=>c.id===requested)&&!room.players.some(p=>p.id!==exceptId&&p.avatarId===requested);}
function initialRoom(ws){const room={code:makeCode(),token:makeToken(),host:ws,mode:'standard',players:[],game:null,createdAt:Date.now(),paused:false,pauseRemainingMs:null,dealRemainingMs:{}};rooms.set(room.code,room);return room;}
function safeName(raw){const text=typeof raw==='string'?raw.trim().replace(/[\u0000-\u001F\u007F<>]/g,''):'';return text.length>=2&&text.length<=24?text:null;}
function detach(ws){
  if(!ws.roomCode)return;
  const room=rooms.get(ws.roomCode);if(!room)return;
  if(ws.kind==='host'&&room.host===ws)room.host=null;
  if(ws.kind==='player'){
    const p=room.players.find(p=>p.id===ws.playerId);
    if(p&&p.ws===ws){p.ws=null;p.connected=false;if(!room.game)p.ready=false;}
  }
  publish(room);
}
function bind(ws,room,kind,playerId){
  if(ws.roomCode)detach(ws);
  ws.roomCode=room.code;ws.kind=kind;ws.playerId=playerId||null;
}
function join(ws,msg){
  if(ws.roomCode)return error(ws,'This device is already attached to a room.');
  const room=rooms.get(String(msg.room||'').toUpperCase());
  if(!room)return error(ws,'Room not found. Check the four-letter code.');
  if(room.game)return error(ws,'This voyage has already departed. Rejoin with your saved captain instead.');
  if(room.players.length>=8)return error(ws,'This room already has eight captains.');
  const name=safeName(msg.name);if(!name)return error(ws,'Enter a captain name of 2–24 characters.');
  const avatar=String(msg.avatarId||'');if(!availableAvatar(room,avatar))return error(ws,'That captain has already been claimed. Choose another.');
  const p={id:makeId(),token:makeToken(),name,avatarId:avatar,ready:false,connected:true,bot:false,ws,renown:0};
  room.players.push(p);bind(ws,room,'player',p.id);
  send(ws,{type:'joined',room:room.code,playerId:p.id,token:p.token});publish(room);
}
function rejoin(ws,msg){
  if(ws.roomCode)return error(ws,'This device is already attached to a room.');
  const room=rooms.get(String(msg.room||'').toUpperCase());
  if(!room)return error(ws,'Room not found. Ask the host for a fresh room code.');
  const player=room.players.find(p=>p.id===msg.playerId&&p.token===msg.token&&!p.bot);
  if(!player)return error(ws,'Saved captain credentials were not recognised.');
  const prior=player.ws;player.ws=ws;player.connected=true;bind(ws,room,'player',player.id);
  send(ws,{type:'joined',room:room.code,playerId:player.id,token:player.token});publish(room);
  if(prior&&prior!==ws)prior.close(4000,'Captain rejoined elsewhere');
}
function replaceWithBot(room,p){p.bot=true;p.ws=null;p.connected=true;p.ready=true;p.token=null;p.name=`${p.name} (AI)`;}
function runBotPlacement(room){
  if(room.paused)return;
  let safety=18;
  while(room.game?.phase==='placement'&&safety--){
    const player=room.players.find(p=>p.id===currentPlacer(room.game));
    if(!player?.bot)break;
    const choices=legalPlacements(room.game);
    if(!choices.length)break;
    placeSettlement(room.game,room.players,player.id,choices[randomInt(choices.length)]);
  }
}
/** Candidate-driven AI: chooses up to two actually affordable legal orders.
 * Rules are checked on a disposable clone; no private player information is used.
 * Each captain's preference is deliberately distinct, not a claim of optimal play.
 */
function botOrders(game,p){
  const targets=legalTargets(game,p.id);
  const owned=game.chart.tiles.filter(t=>t.owner===p.id);
  const tile=id=>game.chart.tiles.find(t=>t.id===id);
  const lane=id=>game.chart.lanes.find(l=>l.id===id);
  const outgoing=[];
  // An enemy with a weak garrison is a valid tactical target.
  const raids=targets.raid.map(id=>tile(id)).filter(t=>t&&owned.filter(o=>o.warships>0&&Math.max(Math.abs(o.q-t.q),Math.abs(o.r-t.r),Math.abs(o.q+o.r-t.q-t.r))===1).reduce((n,o)=>n+o.warships,0)>=t.warships+2);
  const settles=targets.settle.map(tile).filter(Boolean).sort((a,b)=>{
    const score=t=>(t.type==='harbour'?12:0)+(['fish','timber'].includes(t.type)?6:0)+((p.goods[t.type]||0)<2?2:0);
    return score(b)-score(a);
  });
  const ports=targets.port.map(tile).filter(Boolean);
  const lanes=targets.lane.map(lane).filter(Boolean).sort((a,b)=>a.segments-b.segments);
  const marketOrders=['spice','silk','fish','timber'].filter(g=>p.goods[g]>=(['spice','silk'].includes(g)?2:4)).map(g=>({kind:'market',direction:'sell',quantities:{[g]:Math.min(3,p.goods[g]-(['fish','timber'].includes(g)?2:0))}}));
  const buy=()=>({kind:'market',direction:'buy',quantities:{fish:p.goods.fish<1?1:0,timber:p.goods.timber<1?1:0}});
  const constructs=[...settles.slice(0,5).map(t=>({kind:'settle',tileId:t.id})),...ports.map(t=>({kind:'port',tileId:t.id})),...lanes.slice(0,5).map(l=>({kind:'lane',laneId:l.id}))];
  const ships=owned.map(t=>({kind:'warships',tileId:t.id,count:p.gold>=6?3:1}));
  const combat=raids.map(t=>({kind:'raid',tileId:t.id}));
  const exploration=game.contractDeck.length?[{kind:'explore'}]:[];
  const categories={
    isadora:[combat,ships,constructs,marketOrders,exploration],
    tobias:[lanes.map(l=>({kind:'lane',laneId:l.id})),constructs,marketOrders,ships,combat],
    rosa:[marketOrders,constructs,exploration,ships,combat],
    finch:[constructs,marketOrders,exploration,combat,ships],
    'mei-lin':[ports.map(t=>({kind:'port',tileId:t.id})),constructs,marketOrders,exploration,ships],
    hugo:[lanes.map(l=>({kind:'lane',laneId:l.id})),constructs,marketOrders,ships,combat],
    nyla:[combat,ships,constructs,marketOrders,exploration],
    felix:[marketOrders,constructs,exploration,ships,combat]
  };
  outgoing.push(...(categories[p.avatarId]||[constructs,marketOrders,ships,combat,exploration]).flat());
  if(p.goods.fish<1||p.goods.timber<1)outgoing.push(buy());
  outgoing.push({kind:'hold'});
  const clone=structuredClone({...game,orders:{},submitted:{}});
  const captain=structuredClone({id:p.id,name:p.name,avatarId:p.avatarId,gold:p.gold,goods:p.goods,renown:p.renown,
    contracts:p.contracts||[],contractReserve:p.contractReserve||[],upgrades:p.upgrades||[],marketGoldEra:p.marketGoldEra||0});
  const context={market:{...clone.market},sold:new Set(),raids:[],explored:new Set(),players:[captain],dealOrders:new Set()};
  const chosen=[];
  for(const order of outgoing){
    if(chosen.length===2)break;
    // Do not let novice AI double-commit a fleet to two different raids.
    if(order.kind==='raid'&&chosen.some(x=>x.kind==='raid'))continue;
    const result=applyOrder(clone,captain,order,context);
    if(result.ok){chosen.push(order);if(order.kind==='hold')break;}
  }
  while(chosen.length<2)chosen.push({kind:'hold'});
  return chosen;
}
function progressPlanning(room,now=Date.now()){
  if(room.paused)return;
  if(!room.game||room.game.phase!=='plan')return;
  // A bound prevents runaway automatic rounds in all-bot rooms.
  for(let iterations=0;iterations<16&&room.game.phase==='plan';iterations++){
    for(const p of room.players){if(p.bot&&!room.game.submitted[p.id]){
      const options=upgradeOptions(room.game,p);if(options.length)chooseUpgrade(room.game,room.players,p.id,options[randomInt(options.length)].id);
      const result=submitOrders(room.game,room.players,p.id,botOrders(room.game,p));
      if(!result.ok)submitOrders(room.game,room.players,p.id,[{kind:'hold'},{kind:'hold'}]);
    }}
    expireDeals(room.game,now);
    if(room.game.deadline>now&&(!everyoneSubmitted(room.game,room.players)||pendingDeals(room.game,now).length))break;
    resolveRound(room.game,room.players,now);
  }
}
function processAction(ws,msg){
  if(!msg||typeof msg!=='object'||Array.isArray(msg)||typeof msg.type!=='string')return error(ws,'Malformed request.');
  if(msg.type==='create_room'){
    if(ws.roomCode)return error(ws,'Already attached to a room.');
    let room;
    if(msg.room&&msg.token){room=rooms.get(String(msg.room).toUpperCase());
      if(!room||room.token!==msg.token)return error(ws,'Could not recover the host session.');
      if(room.host&&room.host!==ws)room.host.close(4001,'Host reconnected');room.host=ws;
    }else room=initialRoom(ws);
    bind(ws,room,'host');send(ws,{type:'room_created',code:room.code,token:room.token});publish(room);return;
  }
  if(msg.type==='preview'){
    const room=rooms.get(String(msg.room||'').toUpperCase());
    return send(ws,{type:'preview',code:room?.code||null,available:room&&!room.game?CAPTAINS.filter(c=>availableAvatar(room,c.id)).map(c=>c.id):[],occupied:room?room.players.map(p=>p.avatarId):[],phase:room?.game?.phase||'lobby'});
  }
  if(msg.type==='join')return join(ws,msg);
  if(msg.type==='rejoin')return rejoin(ws,msg);
  const room=rooms.get(ws.roomCode||'');if(!room)return error(ws,'Join a room first.');
  if(msg.type==='set_mode'){
    if(ws.kind!=='host'||room.game)return error(ws,'Only the host can select a mode in the lobby.');
    if(!MODES[msg.mode])return error(ws,'Unknown mode.');room.mode=msg.mode;publish(room);return;
  }
  if(msg.type==='ready'){
    if(ws.kind!=='player'||room.game)return error(ws,'Ready status can only change in the lobby.');
    const p=room.players.find(p=>p.id===ws.playerId);if(!p||p.bot)return error(ws,'Captain not found.');
    p.ready=!!msg.ready;publish(room);return;
  }
  if(msg.type==='choose_avatar'){
    if(ws.kind!=='player'||room.game)return error(ws,'You can only select a captain before departure.');
    const p=room.players.find(p=>p.id===ws.playerId);if(!p)return error(ws,'Captain not found.');
    if(!availableAvatar(room,msg.avatarId,p.id))return error(ws,'Captain is unavailable.');
    p.avatarId=msg.avatarId;p.ready=false;publish(room);return;
  }
  if(msg.type==='kick'){
    if(ws.kind!=='host'||room.game)return error(ws,'Only the host can remove captains before departure.');
    const p=room.players.find(p=>p.id===msg.playerId);if(!p)return error(ws,'Captain not found.');
    room.players=room.players.filter(other=>other!==p);if(p.ws){send(p.ws,{type:'kicked'});p.ws.roomCode=null;p.ws.close(4002,'Removed by host');}publish(room);return;
  }
  if(msg.type==='replace_bot'){
    if(ws.kind!=='host')return error(ws,'Only the host may activate AI captains.');
    const p=room.players.find(p=>p.id===msg.playerId);if(!p)return error(ws,'Captain not found.');
    if(room.paused)return error(ws,'Resume the saved voyage before replacing captains with AI.');
    if(p.connected&&!p.bot)return error(ws,'Only disconnected captains may be replaced by AI.');
    replaceWithBot(room,p);record(room,`${p.name} has taken the helm.`);runBotPlacement(room);progressPlanning(room);publish(room);return;
  }
  if(msg.type==='add_bot'){
    if(ws.kind!=='host'||room.game)return error(ws,'AI captains may only be added in the lobby.');
    if(room.players.length>=8)return error(ws,'Maximum of eight captains.');
    const free=CAPTAINS.filter(c=>availableAvatar(room,c.id));if(!free.length)return error(ws,'No captain is available.');
    const avatar=free[randomInt(free.length)];room.players.push({id:makeId(),token:null,name:`${avatar.title} (AI)`,avatarId:avatar.id,ready:true,connected:true,bot:true,ws:null,renown:0});publish(room);return;
  }
  if(msg.type==='start'){
    if(ws.kind!=='host'||room.game)return error(ws,'Only the host can launch a new game.');
    if(room.players.length<2)return error(ws,'At least two captains must join.');
    if(room.players.some(p=>!p.ready||!p.connected))return error(ws,'All captains must be present and ready.');
    room.game=newGame(room.players,room.mode);runBotPlacement(room);progressPlanning(room);publish(room);return;
  }
  if(msg.type==='pause_game'){
    if(ws.kind!=='host'||!room.game||room.paused||!['placement','plan'].includes(room.game.phase))return error(ws,'Only the host may pause an active voyage.');
    const now=Date.now();
    room.pauseRemainingMs=room.game.phase==='plan'?Math.max(1000,Math.min(MODES[room.mode].planSeconds*1000,(room.game.deadline??now)-now)):null;
    room.dealRemainingMs=Object.fromEntries((room.game.deals||[]).filter(d=>d.status==='pending').map(d=>[d.id,Math.max(0,d.expiresAt-now)]));
    room.paused=true;
    if(room.game.phase==='plan')room.game.deadline=null;
    record(room,'⚓ The host has paused the voyage.');publish(room);return;
  }
  if(msg.type==='resume_game'){
    if(ws.kind!=='host'||!room.game||!room.paused)return error(ws,'Only the host can resume a paused voyage.');
    if(room.game.phase==='plan'){
      const now=Date.now();
      room.game.deadline=now+Math.max(1000,Math.min(MODES[room.mode].planSeconds*1000,room.pauseRemainingMs??MODES[room.mode].planSeconds*1000));
      for(const d of room.game.deals||[])if(d.status==='pending')d.expiresAt=now+Math.max(0,Math.min(20_000,room.dealRemainingMs?.[d.id]??20_000));
    }
    room.paused=false;room.pauseRemainingMs=null;room.dealRemainingMs={};
    record(room,'⚓ The Admiralty has resumed this voyage.');
    runBotPlacement(room);progressPlanning(room);publish(room);return;
  }
  // After a restart, restore all captain identities and private plans, but
  // prevent any action that could change the board until the host resumes.
  if(room.paused)return error(ws,'This voyage is paused after a restart. Ask the host to resume it.');
  if(msg.type==='place'){
    if(ws.kind!=='player'||!room.game)return error(ws,'There is no active placement turn.');
    const result=placeSettlement(room.game,room.players,ws.playerId,msg.tileId);
    if(!result.ok)return error(ws,result.error);runBotPlacement(room);progressPlanning(room);publish(room);return;
  }
  if(msg.type==='choose_contracts'){
    if(ws.kind!=='player'||!room.game)return error(ws,'Only a captain may select Voyage Contracts.');
    const p=room.players.find(p=>p.id===ws.playerId);
    if(!p||p.bot||p.ws!==ws||room.game.phase!=='plan'||room.game.submitted[p.id])return error(ws,'Finish the draft before locking orders.');
    const result=chooseContracts(room.game,p,msg.contractIds);
    if(!result.ok)return error(ws,result.error);publish(room);return;
  }
  if(msg.type==='choose_upgrade'){
    if(ws.kind!=='player'||!room.game)return error(ws,'Only a captain may select an upgrade.');
    const p=room.players.find(p=>p.id===ws.playerId);if(!p||p.bot||p.ws!==ws)return error(ws,'Not your active captain session.');
    const result=chooseUpgrade(room.game,room.players,p.id,msg.upgradeId);
    if(!result.ok)return error(ws,result.error);publish(room);return;
  }
  if(msg.type==='answer_deal'){
    if(ws.kind!=='player'||!room.game)return error(ws,'Only a captain may answer a deal.');
    const p=room.players.find(p=>p.id===ws.playerId);if(!p||p.bot||p.ws!==ws)return error(ws,'Not your active captain session.');
    if(typeof msg.accept!=='boolean')return error(ws,'Choose Accept or Decline.');
    const result=answerDeal(room.game,room.players,p.id,msg.dealId,msg.accept);
    if(!result.ok){publish(room);return error(ws,result.error);}
    progressPlanning(room);publish(room);return;
  }
  if(msg.type==='submit_orders'){
    if(ws.kind!=='player'||!room.game)return error(ws,'Only a captain may submit orders.');
    const captain=room.players.find(p=>p.id===ws.playerId);if(!captain||captain.ws!==ws||captain.bot)return error(ws,'Only your active captain session may submit orders.');
    if(room.game.phase==='plan'&&Date.now()>=room.game.deadline){progressPlanning(room);publish(room);return error(ws,'The planning window has closed.');}
    const result=submitOrders(room.game,room.players,ws.playerId,msg.orders);
    if(!result.ok)return error(ws,result.error);
    progressPlanning(room);publish(room);return;
  }
  if(msg.type==='resolve_now'){
    if(ws.kind!=='host'||room.game?.phase!=='plan')return error(ws,'Only the host may end the planning window.');
    resolveRound(room.game,room.players);progressPlanning(room);publish(room);return;
  }
  return error(ws,'Unknown action or not available in this phase.');
}
const ROUTES=new Map([['/','tv.html'],['/tv.html','tv.html'],['/phone.html','phone.html']]);
const MIME={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'){const ok=!persistenceError;res.writeHead(ok?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:ok?'ok':'degraded',app:'Tidewater',rooms:rooms.size,persistence:persistenceEnabled?(ok?'ok':'error'):'disabled'}));return;}
    if(url.pathname==='/qr.svg'){
      const code=(url.searchParams.get('room')||'').toUpperCase();if(!/^[A-Z]{4}$/.test(code)||!rooms.has(code)){res.writeHead(404);res.end();return;}
      let host=req.headers['x-forwarded-host']||req.headers.host||'';
      if(typeof host!=='string'||!/^[a-z\d.\-:\[\]]{1,120}$/i.test(host)){res.writeHead(400);res.end();return;}
      const protocol=req.headers['x-forwarded-proto']==='https'?'https':req.socket.encrypted?'https':'http';
      const joinUrl=`${protocol}://${host}/phone.html?room=${code}`;
      const svg=qrSvg(joinUrl);res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(svg);return;
    }
    if(url.pathname.startsWith('/art/')||url.pathname.startsWith('/audio/')){
      const kind=url.pathname.startsWith('/audio/')?'audio':'art';
      const asset=path.resolve(PUBLIC,'.'+url.pathname);
      const root=path.join(PUBLIC,kind)+path.sep;
      if(!asset.startsWith(root)||!fs.existsSync(asset)||!fs.statSync(asset).isFile()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');return;}
      const ext=path.extname(asset).toLowerCase();
      res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD'){res.end();return;}
      fs.createReadStream(asset).pipe(res);return;
    }
    const file=ROUTES.get(url.pathname);if(!file){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    fs.createReadStream(path.join(PUBLIC,file)).pipe(res);
  }catch(e){res.writeHead(500);res.end('Internal error');}
});
const wss=new WebSocket.Server({server,maxPayload:8192});
wss.on('connection',(ws,req)=>{
  // Explicit same-origin policy protects join and host actions in browsers.
  const origin=req.headers.origin;if(origin){
    try{const a=new URL(origin),b=new URL(`http://${req.headers.host}`);if(a.host!==b.host) {ws.close(1008,'Origin not allowed');return;}}
    catch{ws.close(1008,'Bad origin');return;}
  }
  ws.on('message',raw=>{
    try{if(raw.length>8192)throw Error('Too large');const msg=JSON.parse(String(raw));processAction(ws,msg);}
    catch(e){error(ws,'Invalid message.');}
  });
  ws.on('close',()=>detach(ws));ws.on('error',()=>{});
});
const planningClock=setInterval(()=>{
  const now=Date.now();for(const room of rooms.values()){
    if(!room.paused&&room.game?.phase==='plan'){
      const changed=expireDeals(room.game,now);
      if(now>=room.game.deadline||changed){progressPlanning(room,now);publish(room);}
    }
  }
},350);planningClock.unref();
const sweeper=setInterval(()=>{
  const now=Date.now();for(const [code,room] of rooms){if(!room.game&&!room.host&&room.players.every(p=>!p.ws)&&now-room.createdAt>12*60*60*1000){rooms.delete(code);saveRooms();}}
},60*60*1000);sweeper.unref();
if(require.main===module){server.listen(PORT,'0.0.0.0',()=>console.log(`Tidewater Phase 8 serving on http://localhost:${PORT}`));}
module.exports={server,wss,rooms,processAction,botOrders,roomPublic};
