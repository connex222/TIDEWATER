'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {newGame,chooseTide,currentPlacer,legalPlacements,placeSettlement}=require('../src/engine');
const newPlayers=n=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`Captain ${i}`}));
test('modes, starting inventory, market prices, and snake order',()=>{
  const players=newPlayers(4),g=newGame(players,'standard');
  assert.equal(g.phase,'placement');assert.equal(g.mode,'standard');assert.equal(g.placementTotal,undefined);
  assert.deepEqual(g.placementOrder,['p0','p1','p2','p3','p3','p2','p1','p0']);
  assert.equal(g.market.fish,2);assert.equal(g.market.timber,2);assert.equal(g.market.spice,2);assert.equal(g.market.silk,2);
  for(const p of players){assert.deepEqual(p.goods,{fish:1,timber:1,spice:1,silk:1});assert.equal(p.gold,2);}
});
test('a captain cannot place out of turn, in sea, or on an already settled tile',()=>{
  const p=newPlayers(2),g=newGame(p,'quick');const free=legalPlacements(g)[0],sea=g.chart.tiles.find(x=>x.type==='sea').id;
  assert.equal(placeSettlement(g,p,p[1].id,free).ok,false);
  assert.equal(placeSettlement(g,p,p[0].id,sea).ok,false);
  assert.equal(placeSettlement(g,p,p[0].id,free).ok,true);
  assert.equal(placeSettlement(g,p,p[1].id,free).ok,false);
  assert.equal(g.chart.tiles.find(t=>t.id===free).warships,1);
  assert.equal(p[0].placements,1);
});
test('all placements finish, Round 1 income applies, no double-claim permitted',()=>{
  const p=newPlayers(8),g=newGame(p,'standard');const originalGoods=p.map(x=>({...x.goods}));
  for(const id of g.placementOrder){const free=legalPlacements(g)[0];assert.equal(currentPlacer(g),id);assert.equal(placeSettlement(g,p,id,free).ok,true);}
  assert.equal(g.phase,'plan');assert.equal(g.round,1);assert.equal(g.era,'Sail');assert.equal(g.tide!==null,true);
  assert.equal(g.chart.tiles.filter(t=>t.owner!==null).length,16);
  for(const player of p){assert.equal(player.placements,2);assert.equal(player.gold,3);const total=Object.values(player.goods).reduce((a,b)=>a+b,0);
    assert.equal(total,6);assert.equal(Object.values(originalGoods[p.indexOf(player)]).reduce((a,b)=>a+b,0),4);}
  assert.equal(placeSettlement(g,p,'p0',legalPlacements(g)[0]).ok,false);
});
test('tide cannot be identical three consecutive rounds',()=>{
  for(let i=0;i<100;i++)assert.notEqual(chooseTide('Silver','Silver'),'Silver');
  for(let i=0;i<100;i++)assert.ok(['Blue','Green','Silver'].includes(chooseTide('Blue','Green')));
});
test('invalid mode is rejected',()=>assert.throws(()=>newGame(newPlayers(2),'bogus'),/Invalid/));
