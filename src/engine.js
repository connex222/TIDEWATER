'use strict';
const {MODES,TIDES,GOODS,randomInt}=require('./constants');
const {createChart,isProduction}=require('./chart');
function chooseTide(previous,previousPrevious){
  const choices=TIDES.filter(c=>!(previous===c && previousPrevious===c));
  return choices[randomInt(choices.length)];
}
function newGame(players,mode){
  if(!MODES[mode])throw new Error('Invalid game mode');
  const chart=createChart();
  const placementOrder=[...players.map(p=>p.id),...players.map(p=>p.id).reverse()];
  const game={mode,phase:'placement',round:0,era:'Sail',chart,placementOrder,placementIndex:0,
    market:Object.fromEntries(GOODS.map(g=>[g,2])),tide:null,nextTide:chooseTide(null,null),previousTide:null,
    history:['The Tidewater chart is unfurled. Captains, claim your first islands.']};
  for(const p of players){p.goods=Object.fromEntries(GOODS.map(g=>[g,1]));p.gold=2;p.renown=0;p.placements=0;}
  return game;
}
function currentPlacer(game){return game.phase==='placement'?game.placementOrder[game.placementIndex]??null:null;}
function legalPlacements(game){return game.chart.tiles.filter(t=>isProduction(t)&&t.owner===null).map(t=>t.id);}
function placeSettlement(game,players,playerId,tileId){
  if(game.phase!=='placement')return {ok:false,error:'Initial placement is closed.'};
  if(currentPlacer(game)!==playerId)return {ok:false,error:'It is not your turn to place.'};
  const tile=game.chart.tiles.find(t=>t.id===tileId);
  if(!tile||!isProduction(tile)||tile.owner!==null)return {ok:false,error:'Choose an unclaimed production island.'};
  const player=players.find(p=>p.id===playerId);
  if(!player)return {ok:false,error:'Captain not found.'};
  tile.owner=playerId;tile.warships=1;player.placements++;
  game.placementIndex++;
  game.history.push(`${player.name} settles ${tile.name} and stations 1 Warship.`);
  if(game.placementIndex===game.placementOrder.length){
    beginFirstRound(game,players);
  }
  return {ok:true};
}
function beginFirstRound(game,players){
  game.round=1;game.phase='foundation-complete';game.era='Sail';
  game.tide=game.nextTide;
  game.nextTide=chooseTide(game.tide,game.previousTide);
  game.previousTide=game.tide;
  for(const tile of game.chart.tiles){
    if(tile.owner){const player=players.find(p=>p.id===tile.owner);
      if(isProduction(tile))player.goods[tile.type]++;
      else if(tile.type==='harbour')player.gold+=tile.port?2:1;
    }
  }
  // Tide/production are implemented. All other order-resolution, market, eras and
  // tie-for-last catch-up adjudication will be completed in later phases.
  game.history.push(`Round 1: ${game.tide} is at Low Tide. Island income has been paid.`);
}
function publicGame(game){
  if(!game)return null;
  return {mode:game.mode,phase:game.phase,round:game.round,rounds:MODES[game.mode].rounds,
    era:game.era,chart:game.chart,placementIndex:game.placementIndex,placementTotal:game.placementOrder.length,
    currentPlacer:currentPlacer(game),legalPlacements:legalPlacements(game),market:game.market,
    tide:game.tide,nextTide:game.nextTide,history:game.history.slice(-9)};
}
module.exports={newGame,chooseTide,currentPlacer,legalPlacements,placeSettlement,publicGame,beginFirstRound};
