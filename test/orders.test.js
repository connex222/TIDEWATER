'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {newGame,placeSettlement,legalPlacements,submitOrders,resolveRound,canSettle,beginRound}=require('../src/engine');
const {distance}=require('../src/chart');
function setup(n=2,mode='standard'){
 const players=Array.from({length:n},(_,i)=>({id:`p${i}`,name:`Captain ${i}`})),g=newGame(players,mode);
 for(const id of g.placementOrder)assert.equal(placeSettlement(g,players,id,legalPlacements(g)[0],1000).ok,true);
 assert.equal(g.phase,'plan');return {g,players,p:players[0],q:players[1]};
}
const hold={kind:'hold'};
function round(g,players){for(const p of players)if(!g.submitted[p.id])assert.equal(submitOrders(g,players,p.id,[hold,hold]).ok,true);assert.equal(resolveRound(g,players,2000).ok,true);}
function rich(p){p.goods={fish:50,timber:50,spice:50,silk:50};p.gold=100;}
test('planning runs with the mode-specific server-side deadline and full opening catch-up income',()=>{
 const {g,players}=setup(3,'quick');assert.equal(g.deadline,1000+60000);assert.equal(g.round,1);
 assert.equal(g.phase,'plan');assert.ok(players.every(p=>p.gold===3));
 const a=submitOrders(g,players,players[0].id,[hold,hold]);assert.ok(a.ok);
 assert.equal(submitOrders(g,players,players[0].id,[hold,hold]).ok,false);
 assert.equal(g.phase,'plan');
 round(g,players);assert.equal(g.round,2);assert.equal(g.deadline,2000+60000);
});
test('rejects malformed, unaffordable and impossible orders at submission without charging players',()=>{
 const {g,players,p}=setup();const before=JSON.stringify({goods:p.goods,gold:p.gold});
 for(const orders of [[],[hold],['bad',hold],[{kind:'market',direction:'sell',quantities:{fish:99}},hold],[{kind:'market',direction:'sell',quantities:{__proto__:1}},hold],
    [{kind:'port',tileId:'0,0'},hold],[{kind:'warships',tileId:'0,0',count:-1},hold]]){
   assert.equal(submitOrders(g,players,p.id,orders).ok,false);
 }
 assert.equal(JSON.stringify({goods:p.goods,gold:p.gold}),before);assert.equal(Object.keys(g.submitted).length,0);
});
test('island expansion costs resources, requires adjacency, and awards Harbour settlement Renown',()=>{
 const {g,players,p}=setup();rich(p);
 const adjacent=g.chart.tiles.find(t=>t.owner===null&&t.type==='harbour'&&g.chart.tiles.some(k=>k.owner===p.id&&distance(k,t)===1))||
 g.chart.tiles.find(t=>t.owner===null&&t.type!=='sea'&&t.type!=='bazaar'&&g.chart.tiles.some(k=>k.owner===p.id&&distance(k,t)===1));
 assert.ok(adjacent);assert.ok(canSettle(g,p.id,adjacent));
 const startRenown=p.renown;
 assert.equal(submitOrders(g,players,p.id,[{kind:'settle',tileId:adjacent.id},hold]).ok,true);
 round(g,players);
 assert.equal(adjacent.owner,p.id);assert.equal(p.goods.fish,49+(g.chart.tiles.filter(t=>t.owner===p.id&&t.type==='fish').length));
 assert.equal(p.renown-startRenown,adjacent.type==='harbour'?1:0);
});
test('Port construction costs 2 Spice + 2 Silk + 1 Timber and adds two Renown',()=>{
 const {g,players,p}=setup();rich(p);
 const harbour=g.chart.tiles.find(t=>t.type==='harbour');harbour.owner=p.id;
 const before={...p.goods},score=p.renown;
 assert.equal(submitOrders(g,players,p.id,[{kind:'port',tileId:harbour.id},hold]).ok,true);
 round(g,players);assert.equal(harbour.port,true);assert.equal(p.renown,score+2);
 assert.equal(p.goods.spice,before.spice-2+g.chart.tiles.filter(t=>t.owner===p.id&&t.type==='spice').length);
 assert.equal(p.goods.silk,before.silk-2+g.chart.tiles.filter(t=>t.owner===p.id&&t.type==='silk').length);
 assert.equal(p.goods.timber,before.timber-1+g.chart.tiles.filter(t=>t.owner===p.id&&t.type==='timber').length);
});
test('a player may not claim a Low Tide lane or an unconnected lane; legal lanes pay next-round income',()=>{
 const {g,players,p}=setup();rich(p);
 const low=g.chart.lanes.find(l=>l.colour===g.tide);g.chart.tiles.find(t=>t.id===low.from).owner=p.id;
 assert.equal(submitOrders(g,players,p.id,[{kind:'lane',laneId:low.id},hold]).ok,false);
 const lane=g.chart.lanes.find(l=>l.colour!==g.tide);const island=g.chart.tiles.find(t=>t.id===lane.from);island.owner=p.id;
 assert.equal(submitOrders(g,players,p.id,[{kind:'lane',laneId:lane.id},hold]).ok,true);
 const goldBefore=p.gold;round(g,players);
 assert.equal(lane.owner,p.id);assert.ok(p.gold>=goldBefore);
});
test('sell orders pay existing prices, market adjusts only after reveal and unsold goods rise',()=>{
 const {g,players,p,q}=setup();rich(p);rich(q);
 assert.equal(submitOrders(g,players,p.id,[{kind:'market',direction:'sell',quantities:{spice:3,fish:2}},hold]).ok,true);
 assert.deepEqual(g.market,{fish:2,timber:2,spice:2,silk:2});
 assert.equal(submitOrders(g,players,q.id,[{kind:'market',direction:'sell',quantities:{spice:1}},hold]).ok,true);
 assert.equal(resolveRound(g,players,2000).ok,true);
 assert.equal(g.market.fish,1);assert.equal(g.market.spice,1);assert.equal(g.market.timber,3);assert.equal(g.market.silk,3);
 // p sells 3 spice and 2 fish at 2 Gold, q sells spice at 1 Gold.
 const bottom=Math.min(p.renown,q.renown);assert.equal(p.gold,110+(p.renown===bottom?1:0));assert.equal(q.gold,101+(q.renown===bottom?1:0));
});
test('buying costs listed price +1, planning rejects double-spends in both order slots',()=>{
 const {g,players,p}=setup();p.gold=5;p.goods={fish:0,timber:0,spice:0,silk:0};
 const order={kind:'market',direction:'buy',quantities:{fish:1}};
 assert.equal(submitOrders(g,players,p.id,[order,order]).ok,false);
 assert.equal(submitOrders(g,players,p.id,[order,hold]).ok,true);
 assert.equal(p.gold,5);round(g,players);assert.equal(p.goods.fish>=1,true);
});
test('competition for one harbour resolves in rotating player order with compensation for loser',()=>{
 const {g,players,p,q}=setup();rich(p);rich(q);
 const t=g.chart.tiles.find(t=>t.type==='harbour');const near=g.chart.tiles.filter(x=>x.type==='fish'&&distance(x,t)===1);
 // If the generated distribution lacks both nearby fishing islands, use production islands.
 const neighbours=g.chart.tiles.filter(x=>x.type==='fish'||x.type==='timber'||x.type==='silk'||x.type==='spice').filter(x=>distance(x,t)===1);
 assert.ok(neighbours.length>=2);for(const x of g.chart.tiles)if(x.id===t.id)x.owner=null;
 neighbours[0].owner=p.id;neighbours[1].owner=q.id;
 const beforeQ=q.gold;
 assert.equal(submitOrders(g,players,p.id,[{kind:'settle',tileId:t.id},hold]).ok,true);
 assert.equal(submitOrders(g,players,q.id,[{kind:'settle',tileId:t.id},hold]).ok,true);
 resolveRound(g,players,2000);assert.equal(t.owner,p.id);assert.ok(q.gold>=beforeQ+1);
});
test('round limits produce a complete game with exact final phase, and era advances',()=>{
 const {g,players}=setup(2,'quick');for(let i=0;i<8;i++)round(g,players);
 assert.equal(g.round,8);assert.equal(g.phase,'finished');assert.ok(g.winnerIds.length>0);assert.equal(g.era,'Steam');
 assert.equal(submitOrders(g,players,players[0].id,[hold,hold]).ok,false);
});

test('Explore draws a new Voyage Contract and Raid transfers an adjacent enemy island on victory',()=>{
 const {g,players,p,q}=setup();rich(p);rich(q);
 const contractsBefore=(p.contracts||[]).length,deckBefore=g.contractDeck.length;
 assert.equal(submitOrders(g,players,p.id,[{kind:'explore'},hold]).ok,true);
 assert.equal(submitOrders(g,players,q.id,[hold,hold]).ok,true);
 assert.equal(resolveRound(g,players,2000).ok,true);
 assert.equal((p.contracts||[]).length,contractsBefore+1);
 assert.equal(g.contractDeck.length,deckBefore-1);
 // Set up a deterministic raid.
 g.chart.tiles.forEach(t=>{t.owner=null;t.warships=0;t.port=false;});
 const attackPair=g.chart.tiles.filter(t=>!['sea','bazaar'].includes(t.type)).flatMap(a=>g.chart.tiles.filter(b=>b.id!==a.id&&!['sea','bazaar'].includes(b.type)&&distance(a,b)===1).map(b=>[a,b]))[0];
 assert.ok(attackPair);
 const [attackerBase,target]=attackPair;
 attackerBase.owner=p.id;attackerBase.warships=10;target.owner=q.id;target.warships=1;
 rich(p);rich(q);g.phase='plan';g.submitted={};g.orders={};
 assert.equal(submitOrders(g,players,p.id,[{kind:'raid',tileId:target.id},hold]).ok,true);
 assert.equal(submitOrders(g,players,q.id,[hold,hold]).ok,true);
 assert.equal(resolveRound(g,players,3000).ok,true);
 assert.equal(target.owner,p.id);
});

test('successful income from owned lanes excludes Low Tide and adds a Bazaar bonus',()=>{
 const {g,players,p}=setup();
 for(const t of g.chart.tiles){t.owner=null;t.port=false;}
 for(const l of g.chart.lanes){l.owner=null;}
 // Keep one existing island to isolate lane income from the Phase 4 free re-settlement rule.
 g.chart.tiles.find(t=>t.type==='reef').owner=p.id;
 const lane=g.chart.lanes.find(l=>(l.from==='0,0'||l.to==='0,0')&&l.colour!==g.nextTide);assert.ok(lane);
 lane.owner=p.id;p.gold=0;players[1].renown=5;
 g.round=2;beginRound(g,players,5000);
 assert.equal(p.gold,1+(lane.colour===g.tide?0:2));
});
