'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {newGame,placeSettlement,legalPlacements,submitOrders,resolveRound,chooseUpgrade,upgradeOptions,answerDeal,expireDeals,pendingDeals,longestRoute,updateTrophies,beginRound}=require('../src/engine');
const hold={kind:'hold'};
function setup(n=2,mode='standard'){
 const players=Array.from({length:n},(_,i)=>({id:`p${i}`,name:`Captain ${i}`}));
 const game=newGame(players,mode);
 for(const id of game.placementOrder)assert.equal(placeSettlement(game,players,id,legalPlacements(game)[0]).ok,true);
 game.deadline=Date.now()+90000;
 return {game,players,p:players[0],q:players[1]};
}
function stocks(p){p.goods={fish:10,timber:10,spice:10,silk:10};p.gold=60;}

test('Voyage Contract deck contains exactly 24 cards before dealing',()=>{
 const players=Array.from({length:8},(_,i)=>({id:`c${i}`,name:`Captain ${i}`}));const game=newGame(players,'quick');
 assert.equal(game.contractDeck.length+players.reduce((n,p)=>n+p.contracts.length+p.contractReserve.length,0),24);
});

test('Private deals are validated, accepted atomically, and cannot be replayed',()=>{
 const {game,players,p,q}=setup();stocks(p);stocks(q);
 const order={kind:'deal',targetId:q.id,give:{fish:2,gold:3},receive:{spice:1,gold:1}};
 assert.equal(submitOrders(game,players,p.id,[order,hold]).ok,true);
 const d=game.deals[0];assert.equal(d.fromId,p.id);assert.equal(d.toId,q.id);assert.equal(p.goods.fish,10);
 assert.equal(answerDeal(game,players,p.id,d.id,true).ok,false,'sender cannot accept their own deal');
 assert.equal(answerDeal(game,players,q.id,d.id,true).ok,true);
 assert.equal(d.status,'accepted');assert.equal(p.goods.fish,8);assert.equal(q.goods.fish,12);
 assert.equal(p.goods.spice,11);assert.equal(q.goods.spice,9);
 assert.equal(p.gold,58);assert.equal(q.gold,62);
 assert.equal(answerDeal(game,players,q.id,d.id,true).ok,false,'deal is single-use');
});

test('Deal declines and expiries cannot move resources',()=>{
 const {game,players,p,q}=setup();stocks(p);stocks(q);
 assert.equal(submitOrders(game,players,p.id,[{kind:'deal',targetId:q.id,give:{fish:1},receive:{timber:1}},hold]).ok,true);
 const d=game.deals[0];assert.equal(answerDeal(game,players,q.id,d.id,false).ok,true);
 assert.equal(d.status,'declined');assert.equal(p.goods.fish,10);
 d.status='pending';assert.equal(expireDeals(game,d.expiresAt+1),true);assert.equal(d.status,'expired');
 assert.equal(answerDeal(game,players,q.id,d.id,true).ok,false);
});

test('Cannot trade with yourself, invent negative goods or over-commit inventory',()=>{
 const {game,players,p,q}=setup();
 const make=(targetId,give,receive)=>[{kind:'deal',targetId,give,receive},hold];
 assert.equal(submitOrders(game,players,p.id,make(p.id,{fish:1},{timber:1})).ok,false);
 assert.equal(submitOrders(game,players,p.id,make(q.id,{fish:-1},{timber:1})).ok,false);
 assert.equal(submitOrders(game,players,p.id,make(q.id,{fish:200},{timber:1})).ok,false);
 assert.equal(submitOrders(game,players,p.id,make(q.id,{fish:p.goods.fish+1},{timber:1})).ok,false);
 assert.equal(submitOrders(game,players,p.id,make(q.id,{fish:1},{timber:1})).ok,true);
 assert.equal(game.deals.length,1);
});

test('Locked Deal order does not replay or grant a failed-order bonus at Reveal',()=>{
 const {game,players,p,q}=setup();stocks(p);stocks(q);
 assert.equal(submitOrders(game,players,p.id,[{kind:'deal',targetId:q.id,give:{fish:2},receive:{silk:1}},hold]).ok,true);
 const d=game.deals[0];assert.equal(answerDeal(game,players,q.id,d.id,true).ok,true);
 assert.equal(submitOrders(game,players,q.id,[hold,hold]).ok,true);
 game.round=12;const gold=p.gold;resolveRound(game,players);
 assert.equal(p.gold,gold,'Deal order does not create a second trade or compensation Gold');
 assert.equal(p.goods.fish,8);
});

test('Era upgrade choice is single-use, and Privateers adds warships',()=>{
 const {game,players,p}=setup();
 assert.equal(upgradeOptions(game,p).length,3);
 const before=game.chart.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+t.warships,0);
 assert.equal(chooseUpgrade(game,players,p.id,'privateers').ok,true);
 const after=game.chart.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+t.warships,0);
 assert.equal(after,before+2);
 assert.equal(upgradeOptions(game,p).length,0);
 assert.equal(chooseUpgrade(game,players,p.id,'shipwrights').ok,false);
});

test('Longest Route and Mightiest Fleet score are transferred, not endlessly minted',()=>{
 const {game,players,p,q}=setup();
 // Keep all the chart lane positions but give ownership of two connected lanes to the leader.
 const one=game.chart.lanes[0],two=game.chart.lanes.find(l=>l.id!==one.id&&(l.from===one.from||l.from===one.to||l.to===one.from||l.to===one.to));
 assert.ok(two);one.owner=p.id;two.owner=p.id;
 game.chart.tiles.filter(t=>t.owner===p.id).forEach(t=>t.warships=4);
 const baseline=p.renown;
 updateTrophies(game,players);assert.equal(game.trophies.route,p.id);assert.equal(game.trophies.fleet,p.id);
 assert.equal(p.renown,baseline+4);
 updateTrophies(game,players);assert.equal(p.renown,baseline+4);
 game.chart.tiles.filter(t=>t.owner===p.id).forEach(t=>t.warships=0);
 one.owner=q.id;two.owner=q.id;
 updateTrophies(game,players);assert.equal(game.trophies.route,q.id);assert.equal(game.trophies.fleet,null);
 assert.equal(p.renown,baseline);assert.equal(q.renown,2);
 assert.equal(longestRoute(game,q.id)>=2,true);
});

test('Master Trader awards points at Sail era close, not on every round',()=>{
 const {game,players,p,q}=setup(2,'standard');stocks(p);stocks(q);
 for(let round=1;round<=4;round++){
  const po=[{kind:'market',direction:'sell',quantities:{fish:1}},hold];
  const qo=[hold,hold];
  assert.equal(submitOrders(game,players,p.id,po).ok,true);
  assert.equal(submitOrders(game,players,q.id,qo).ok,true);
  resolveRound(game,players,Date.now());
  if(game.phase==='finished')break;
 }
 assert.equal(game.masterTrader.length,1);
 assert.deepEqual(game.masterTrader[0],{era:'Sail',playerId:p.id});
});
