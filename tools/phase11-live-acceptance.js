#!/usr/bin/env node
'use strict';
/**
 * Phase 11 actual local TCP/WebSocket acceptance. No synthetic WebSocket or
 * browser UI messages are used. Requires `npm install` (the production `ws`).
 * Run: npm run test:live
 *
 * Exercises host room, two player joins, QR target, 2x snake placements,
 * private plans, round resolution, host dropout/pause/rejoin, and victory.
 * This is not a substitute for running the same flow on physical phones/TVs.
 */
const assert=require('node:assert/strict');
const WebSocket=require('ws');
const {server,rooms}=require('../server');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitMs=7000;
function member(socket){
  let events=[],closed=false,waiters=[];
  const deliver=()=>{
    for(const w of [...waiters]){
      const i=events.findIndex(m=>w.predicate(m));
      if(i>=0){const item=events.splice(i,1)[0];waiters=waiters.filter(x=>x!==w);clearTimeout(w.timer);w.resolve(item);}
    }
  };
  socket.on('message',buffer=>{let message;try{message=JSON.parse(buffer.toString('utf8'));}catch{return;}events.push(message);deliver();});
  socket.on('close',()=>{closed=true;for(const w of waiters){clearTimeout(w.timer);w.reject(Error('WebSocket closed before '+w.label));}waiters=[];});
  return {socket,send(type,fields={}){assert.equal(socket.readyState,WebSocket.OPEN);socket.send(JSON.stringify({type,...fields}));},
    wait(predicate,label='message',timeout=waitMs){
      const i=events.findIndex(predicate);if(i>=0)return Promise.resolve(events.splice(i,1)[0]);
      if(closed)return Promise.reject(Error('WebSocket closed before '+label));
      return new Promise((resolve,reject)=>{const w={predicate,label,resolve,reject,timer:null};w.timer=setTimeout(()=>{waiters=waiters.filter(x=>x!==w);reject(Error('Timed out waiting for '+label));},timeout);waiters.push(w);});
    }, close(){socket.close();}};
}
async function connect(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url,{origin:url.replace(/^ws/,'http')});
    socket.once('open',()=>resolve(member(socket)));
    socket.once('error',reject);
  });
}
const state=(client,predicate=()=>true,label='state')=>client.wait(m=>m.type==='state'&&predicate(m),label);
async function completeRound(players,host,prevRound){
  for(const p of players){
    p.client.send('submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    // Each submission updates everyone; consume only the matching state.
    await state(p.client,m=>m.room.game.phase==='finished'||m.room.game.round>prevRound||(m.room.game.round===prevRound&&m.self?.submitted===true),'orders submitted');
  }
  return state(host,m=>m.room.game.phase==='finished'||m.room.game.round>prevRound,'round '+prevRound+' resolved');
}
async function main(){
  const sockets=[];
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const port=server.address().port,url=`ws://127.0.0.1:${port}`;
    const health=await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status,200);
    console.log('PASS health endpoint on an actual TCP listener');

    let host=await connect(url);sockets.push(host);
    host.send('create_room');const auth=await host.wait(m=>m.type==='room_created','host credentials');
    assert.match(auth.code,/^[A-HJ-NP-Z]{4}$/);
    const qr=await fetch(`http://127.0.0.1:${port}/qr.svg?room=${auth.code}`);
    assert.equal(qr.status,200);assert.match(await qr.text(),/<svg[\s>]/);
    console.log('PASS host creates four-letter room and real join QR '+auth.code);
    const intruder=await connect(url);sockets.push(intruder);
    intruder.send('resolve_now');
    const denied=await intruder.wait(m=>m.type==='error','spectator denied');
    assert.match(denied.message,/Join a room first/);
    intruder.close();
    console.log('PASS unjoined connection cannot issue host commands');
    const players=[];
    for(const [index,avatarId] of ['isadora','tobias'].entries()){
      const client=await connect(url);sockets.push(client);
      client.send('join',{room:auth.code,name:`Live Captain ${index+1}`,avatarId});
      const credentials=await client.wait(m=>m.type==='joined','player token');
      assert.equal(credentials.room,auth.code);
      await state(client,m=>m.self?.id===credentials.playerId);
      client.send('ready',{ready:true});await state(client,m=>m.room.players.find(p=>p.id===credentials.playerId)?.ready===true,'ready');
      players.push({client,id:credentials.playerId,token:credentials.token});
    }
    host.send('set_mode',{mode:'quick'});
    await state(host,m=>m.room.mode==='quick','mode selection');
    host.send('start');
    let h=await state(host,m=>m.room.game?.phase==='placement','start');
    console.log('PASS two real WebSocket captains joined and game started');
    let placements=0;
    while(h.room.game.phase==='placement'){
      const {currentPlacer,legalPlacements}=h.room.game;
      const player=players.find(p=>p.id===currentPlacer);
      assert.ok(player&&legalPlacements.length);
      player.client.send('place',{tileId:legalPlacements[0]});
      h=await state(host,m=>m.room.game?.placementIndex>placements||m.room.game?.phase==='plan','placement '+(placements+1));
      placements++;
      assert.ok(placements<=4);
    }
    assert.equal(placements,4);
    assert.equal(h.room.game.phase,'plan');
    console.log('PASS snake-order settlement and first round');
    for(const p of players){
      const me=await state(p.client,m=>m.room.game?.phase==='plan'&&!!m.self?.contractReserve?.length,'private contract hand');
      assert.equal(me.self.contractReserve.length,1);
      const choices=me.self.contracts.map(c=>c.id);
      p.client.send('choose_contracts',{contractIds:choices});
      await state(p.client,m=>m.self?.contractDrafted===true,'private contract draft');
    }
    const publicState=JSON.stringify(h.room);
    for(const p of players){assert.ok(!publicState.includes(p.token));}
    assert.ok(!publicState.includes('contractReserve'));
    console.log('PASS private contract selection and secrecy of credentials');

    const before=h.room.game.round;
    players[0].client.send('submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    await state(players[0].client,m=>m.room.game?.round===before&&m.self?.submitted===true,'captain 1 locked');
    const hostWaiting=await state(host,m=>m.room.game?.round===before&&m.room.game.submittedIds.includes(players[0].id),'public order-ready flag');
    assert.ok(!JSON.stringify(hostWaiting.room).includes('orders'));
    const otherWaiting=await state(players[1].client,m=>m.room.game?.round===before&&m.room.game.submittedIds.includes(players[0].id),'captain 2 waiting');
    assert.equal(otherWaiting.self.orders,null,'the other captain must not see the locked secret order');
    players[1].client.send('submit_orders',{orders:[{kind:'hold'},{kind:'hold'}]});
    await state(players[1].client,m=>m.room.game.round>before||m.room.game.phase==='finished','captain 2 locked');
    h=await state(host,m=>m.room.game.round>before||m.room.game.phase==='finished','both orders resolved');
    assert.equal(h.room.game.round,2);
    console.log('PASS locked plans stay secret and two real orders advance the round');

    // A host losing its physical connection must never silently let the round
    // timer keep running and destroy unfinished decisions.
    host.close();
    const paused=await state(players[0].client,m=>m.room.paused===true,'automatic pause on host dropout');
    assert.equal(paused.room.pauseReason,'host-disconnected');
    assert.equal(paused.room.game.deadline,null);
    console.log('PASS TV host disconnect automatically pauses active match');

    host=await connect(url);sockets.push(host);
    host.send('create_room',{room:auth.code,token:auth.token});
    await host.wait(m=>m.type==='room_created','rejoin host');
    const stillPaused=await state(host,m=>m.room.paused===true,'host rejoin');
    assert.equal(stillPaused.room.game.round,2);
    host.send('resume_game');
    h=await state(host,m=>m.room.paused===false,'host resumes');
    assert.ok(h.room.game.deadline>Date.now());
    console.log('PASS host rejoin and explicit resume retain round progress');

    for(let n=0;n<10&&h.room.game.phase!=='finished';n++){
      h=await completeRound(players,host,h.room.game.round);
    }
    assert.equal(h.room.game.phase,'finished');
    assert.ok(h.room.game.winnerIds.length>0);
    assert.equal(h.room.game.round,8);
    console.log('PASS all 8 Quick rounds finish and yield an Admiralty winner');
    console.log('LOCAL LIVE WEBSOCKET ACCEPTANCE PASSED');
  }finally{
    for(const socket of sockets){try{socket.socket.terminate();}catch{}}
    await sleep(50);
    if(server.listening)await new Promise(resolve=>server.close(resolve));
    rooms.clear();
  }
}
main().catch(err=>{console.error('LIVE ACCEPTANCE FAILED:',err.stack||err);process.exitCode=1;});
