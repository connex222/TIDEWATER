'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {newGame,placeSettlement,legalPlacements,legalTargets,submitOrders,resolveRound}=require('../src/engine');
const GOODS=['fish','timber','spice','silk'];
test('12 full simulated four-captain voyages preserve inventory, market and board invariants',()=>{
 for(let voyage=0;voyage<12;voyage++){
  const players=Array.from({length:4},(_,i)=>({id:`p${i}`,name:`Captain ${i}`}));
  const g=newGame(players,'quick');
  for(const id of g.placementOrder)assert.equal(placeSettlement(g,players,id,legalPlacements(g)[0],1000).ok,true);
  for(let round=1;round<=8;round++){
   for(const p of players){
    const targets=legalTargets(g,p.id),orders=[];
    const sell=GOODS.find(k=>p.goods[k]>0);
    const choices=[
      targets.settle[0]&&{kind:'settle',tileId:targets.settle[0]},
      targets.port[0]&&{kind:'port',tileId:targets.port[0]},
      targets.lane[0]&&{kind:'lane',laneId:targets.lane[0]},
      targets.warships[0]&&{kind:'warships',tileId:targets.warships[0],count:1},
      sell&&{kind:'market',direction:'sell',quantities:{[sell]:1}},
      {kind:'hold'}
    ].filter(Boolean);
    const start=(voyage+round+Number(p.id.slice(1)))%choices.length;
    let accepted=false;
    for(let i=0;i<choices.length;i++){
      const order=choices[(start+i)%choices.length];
      if(submitOrders(g,players,p.id,[order,{kind:'hold'}]).ok){accepted=true;break;}
    }
    assert.equal(accepted,true);
   }
   assert.equal(resolveRound(g,players,2000+round*1000).ok,true);
   for(const v of Object.values(g.market))assert.ok(Number.isInteger(v)&&v>=1&&v<=4);
   for(const p of players){
    assert.ok(Number.isInteger(p.gold)&&p.gold>=0);
    for(const good of GOODS)assert.ok(Number.isInteger(p.goods[good])&&p.goods[good]>=0);
    assert.ok(Number.isInteger(p.renown)&&p.renown>=0);
   }
   assert.equal(g.chart.tiles.length,37);assert.equal(g.chart.lanes.length,18);
   assert.ok(g.chart.tiles.every(t=>t.owner===null||players.some(p=>p.id===t.owner)));
  }
  assert.equal(g.phase,'finished');assert.ok(g.winnerIds.length);
 }
});
