'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {newGame,placeSettlement,legalPlacements,submitOrders,resolveRound,chooseContracts,chooseUpgrade,upgradeOptions,WEATHER_CARDS,payIncome,applyOrder,beginRound,publicGame,lowTide}=require('../src/engine');
const {distance}=require('../src/chart');
const hold={kind:'hold'};
function init(mode='advanced',ids=['isadora','tobias']){
 const players=ids.map((avatarId,i)=>({id:`p${i}`,name:avatarId,avatarId}));
 const g=newGame(players,mode);
 for(const id of g.placementOrder)assert.ok(placeSettlement(g,players,id,legalPlacements(g)[0],1000).ok);
 return {g,players,p:players[0],q:players[1]};
}
const rich=p=>{p.gold=100;p.goods={fish:100,timber:100,spice:100,silk:100};};
function ctx(g,players){return {market:{...g.market},sold:new Set(),raids:[],explored:new Set(),players,dealOrders:new Set()};}
test('Advanced mode uses twelve distinct Weather cards, Standard never draws one',()=>{
 const {g,players}=init();assert.ok(g.weather);assert.ok(WEATHER_CARDS.some(w=>w.id===g.weather.id));
 const seen=new Set([g.weather.id]);
 for(let r=2;r<=12;r++){g.round=r;beginRound(g,players,r*10000);assert.equal(seen.has(g.weather.id),false,'Weather card must not repeat before all twelve are drawn');seen.add(g.weather.id);}
 assert.equal(seen.size,12);
 assert.equal(init('standard').g.weather,null);
});

test('Initial contract choices are private, validated and unchosen card returns to deck',()=>{
 const {g,players,p,q}=init();const ids=[p.contracts[0].id,p.contractReserve[0].id];
 assert.equal(publicGame(g).contracts,undefined);
 assert.equal(chooseContracts(g,p,[ids[0],ids[0]]).ok,false);
 const before=g.contractDeck.length;
 assert.equal(chooseContracts(g,p,ids).ok,true);
 assert.deepEqual(p.contracts.map(c=>c.id),ids);
 assert.equal(g.contractDeck.length,before+1);
 assert.equal(chooseContracts(g,p,ids).ok,false);
 assert.equal(q.contractReserve.length,1);
});

test('Compulsory era upgrade is automatically allocated at Reveal if not manually selected',()=>{
 const {g,players,p,q}=init('standard');
 assert.equal(upgradeOptions(g,p).length,3);
 assert.equal(submitOrders(g,players,p.id,[hold,hold]).ok,true);
 assert.equal(submitOrders(g,players,q.id,[hold,hold]).ok,true);
 assert.equal(resolveRound(g,players,2000).ok,true);
 assert.equal(p.upgrades.length,1);assert.equal(q.upgrades.length,1);
 assert.equal(p.upgrades[0],'shipwrights');
});

test('Captain abilities: Admiral half-price ships; Broker floor 2; Spice Queen +1 per Spice',()=>{
 const {g,players,p,q}=init();rich(p);rich(q);
 const own=g.chart.tiles.find(t=>t.owner===p.id);
 let r=applyOrder(g,p,{kind:'warships',tileId:own.id,count:2},ctx(g,players));
 assert.equal(r.ok,true);assert.equal(p.gold,98);
 const broker=players[1];broker.avatarId='felix';g.market.fish=1;
 r=applyOrder(g,broker,{kind:'market',direction:'sell',quantities:{fish:2}},ctx(g,players));
 assert.equal(r.ok,true);assert.equal(broker.gold,104);
 const spice=players[1];spice.avatarId='rosa';g.market.spice=2;
 r=applyOrder(g,spice,{kind:'market',direction:'sell',quantities:{spice:2}},ctx(g,players));
 assert.equal(r.ok,true);assert.equal(spice.gold,110);
});

test('Weather rule enforcement: Doldrums blocks lanes, Calm Seas blocks raids and Merchant Fleet removes buy surcharge',()=>{
 const {g,players,p,q}=init();rich(p);rich(q);
 const own=g.chart.tiles.find(t=>t.owner===p.id);const lane=g.chart.lanes[0];g.chart.tiles.find(t=>t.id===lane.from).owner=p.id;
 assert.ok(lane);
 g.weather={id:'doldrums'};
 assert.equal(applyOrder(g,p,{kind:'lane',laneId:lane.id},ctx(g,players)).ok,false);
 const target=g.chart.tiles.find(t=>t.owner===q.id&&distance(own,t)===1);
 if(target){own.warships=5;g.weather={id:'calm-seas'};assert.equal(applyOrder(g,p,{kind:'raid',tileId:target.id},ctx(g,players)).ok,false);}
 g.weather={id:'merchant-fleet'};g.market.fish=2;
 const start=p.gold;assert.equal(applyOrder(g,p,{kind:'market',direction:'buy',quantities:{fish:2}},ctx(g,players)).ok,true);
 assert.equal(p.gold,start-4);
});

test('King Tide blocks both affected colours; Fog conceals future tide in public state',()=>{
 const {g}=init();g.lowTides=['Blue','Silver'];assert.ok(lowTide(g,'Blue'));assert.ok(lowTide(g,'Silver'));assert.ok(!lowTide(g,'Green'));
 g.weather={id:'fog'};assert.equal(publicGame(g).nextTide,null);
});

test('Weather income modifiers and Fisherman Sail perk stack without impacting Standard mode',()=>{
 const {g,players,p}=init('advanced',['finch','tobias']);
 g.chart.tiles.forEach(t=>{t.owner=null;t.warships=0;});
 const fish=g.chart.tiles.find(t=>t.type==='fish');fish.owner=p.id;
 p.goods.fish=0;g.weather={id:'big-catch'};g.lowTides=[g.tide];
 payIncome(g,players);assert.equal(p.goods.fish,3);
 g.weather={id:'fair-winds'};p.goods.fish=0;payIncome(g,players);assert.equal(p.goods.fish,4);
});

test('Mei-Lin and Hugo discounts stack with era upgrades and never overcharge',()=>{
 const {g,players,p,q}=init('advanced',['mei-lin','hugo']);
 rich(p);rich(q);g.weather=null;
 const harbour=g.chart.tiles.find(t=>t.type==='harbour');harbour.owner=p.id;harbour.port=false;
 p.upgrades.push('deep-harbours');
 const silk=p.goods.silk;
 assert.ok(applyOrder(g,p,{kind:'port',tileId:harbour.id},ctx(g,players)).ok);
 assert.equal(p.goods.silk,silk,'two one-Silk discounts stack');
 const lane=g.chart.lanes[0];g.lowTides=[];g.chart.tiles.find(t=>t.id===lane.from).owner=q.id;
 q.upgrades.push('shipwrights');
 const timber=q.goods.timber;
 assert.ok(applyOrder(g,q,{kind:'lane',laneId:lane.id},ctx(g,players)).ok);
 assert.equal(q.goods.timber,timber-Math.max(0,lane.segments-2));
});

test('Navigator Low Tide exemption grants only one closed lane income each round',()=>{
 const {g,players,p,q}=init('advanced',['tobias','isadora']);
 for(const t of g.chart.tiles){t.owner=null;t.port=false;}
 for(const l of g.chart.lanes)l.owner=null;
 const [a,b]=g.chart.lanes;
 a.owner=p.id;b.owner=p.id;
 g.lowTides=['Blue','Green','Silver'];g.weather=null;
 p.gold=0;q.gold=0;p.renown=0;q.renown=5;
 payIncome(g,players);
 const oneLane=1+Number(a.from==='0,0'||a.to==='0,0');
 assert.equal(p.gold,oneLane+1,'one lane income, plus catch-up Gold');
 assert.equal(p.navigatorUsedRound,g.round);
});

test('Advanced final scores deduct unfinished contracts after scoring, before determining winner',()=>{
 const {g,players,p,q}=init('advanced',['isadora','tobias']);
 g.round=12;g.era='Steam';g.weather=null;
 p.renown=15;q.renown=0;
 p.contracts=[{id:'impossible-a',kind:'own-both',tileIds:['bad1','bad2'],points:2},{id:'impossible-b',kind:'own-lane',laneId:'bad',points:2}];
 p.contractReserve=[];
 q.contracts=[];q.contractReserve=[];
 assert.ok(submitOrders(g,players,p.id,[hold,hold]).ok);
 assert.ok(submitOrders(g,players,q.id,[hold,hold]).ok);
 assert.ok(resolveRound(g,players,2000).ok);
 assert.equal(g.phase,'finished');
 assert.equal(p.renown,13);
 assert.deepEqual(g.winnerIds,[p.id]);
});

test('Eight-captain drafting reserves all 24 cards yet permits Explore during first reveal',()=>{
 const ids=['isadora','tobias','rosa','finch','mei-lin','hugo','nyla','felix'];
 const {g,players,p}=init('advanced',ids);
 assert.equal(g.contractDeck.length,0);
 rich(p);g.weather=null;
 assert.equal(submitOrders(g,players,p.id,[{kind:'explore'},hold]).ok,true);
 for(const q of players.slice(1))assert.ok(submitOrders(g,players,q.id,[hold,hold]).ok);
 assert.ok(resolveRound(g,players,2000).ok);
 assert.equal(p.contracts.length,3);
});
