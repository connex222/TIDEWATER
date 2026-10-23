'use strict';
/**
 * WebSocket protocol ping/pong liveness detection for a single game server.
 * Browser clients answer control frames automatically; no browser API is needed.
 * A missed pong marks the connection stale, then terminates it on the next tick.
 * Rejoining is handled by the existing authenticated room protocol.
 */
function heartbeatTick(wss){
  for(const socket of wss.clients||[]){
    if(socket.tidewaterAlive===false){
      if(typeof socket.terminate==='function')socket.terminate();
      else if(typeof socket.close==='function')socket.close(1001,'No heartbeat response');
      continue;
    }
    socket.tidewaterAlive=false;
    if(typeof socket.ping==='function'){
      try{socket.ping();}catch{if(typeof socket.terminate==='function')socket.terminate();}
    }else socket.tidewaterAlive=true;
  }
}
function startHeartbeat(wss,{intervalMs=30_000}={}){
  if(!wss||typeof wss.on!=='function'||!wss.clients)return null;
  wss.on('connection',socket=>{
    socket.tidewaterAlive=true;
    socket.on('pong',()=>{socket.tidewaterAlive=true;});
  });
  const timer=setInterval(()=>heartbeatTick(wss),intervalMs);
  timer.unref?.();
  return timer;
}
module.exports={startHeartbeat,heartbeatTick};
