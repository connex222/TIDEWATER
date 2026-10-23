'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {newGame,resolveRaids,publicGame}=require('../src/engine');
const {distance}=require('../src/chart');
function setup(avatars=['isadora','tobias','rosa'],mode='standard'){
 const players=avatars.map((avatarId,i)=>({id:`p${i}`,name:`Captain ${i+1}`,avatarId}));
 const game=newGame(players,mode);game.phase='reveal';game.round=2;game.weather=null;
 for(const tile of game.chart.tiles){tile.owner=null;tile.warships=0;tile.port=false;tile.admiraltyHouse=false;}
 return {game,players};
}
const claimable=tile=>!['sea','bazaar'].includes(tile.type);
function cluster(game,n){
 return game.chart.tiles.filter(t=>['fish','timber','spice','silk'].includes(t.type)).map(t=>[t,...game.chart.tiles.filter(x=>claimable(x)&&x.id!==t.id&&distance(t,x)===1)]).find(group=>group.length>=n+1)?.slice(0,n+1);
}
function total(game){return game.chart.tiles.reduce((n,t)=>n+t.warships,0);}
const six=()=>6,one=()=>1;

test('three-house battle resolves contested target only once from a shared defender snapshot',()=>{
 const {game:g,players:[a,b,c]}=setup();const [target,sa,sb]=cluster(g,2);
 target.owner=c.id;target.warships=2;sa.owner=a.id;sa.warships=6;sb.owner=b.id;sb.warships=5;
 const initial=total(g);
 const results=resolveRaids(g,[a,b,c],[{attackerId:a.id,targetId:target.id,sourceIds:[sa.id]},
   {attackerId:b.id,targetId:target.id,sourceIds:[sb.id]}],six);
 assert.equal(results.length,1);
 const r=results[0];assert.equal(r.outcome,'captured');assert.equal(r.winnerId,a.id);
 assert.equal(r.defender.strength,8);assert.deepEqual(r.attackers.map(x=>x.strength),[12,11]);
 assert.equal(target.owner,a.id);assert.equal(target.warships,5);
 assert.equal(sb.warships,2,'losing attacker returns surviving fleet');
 assert.equal(r.strandedShips,1,'a defending house with no other islands cannot retreat');
 assert.equal(total(g),7);
 assert.equal(initial-total(g),6,'all casualties and stranded survivors are accounted for');
 assert.equal(g.battleSequence,1);assert.equal(g.battleRound,2);
});

test('a single fleet cannot be reused for two raids; second order gets +1 Gold compensation',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const [source,t1,t2]=cluster(g,2);
 source.owner=a.id;source.warships=8;t1.owner=b.id;t2.owner=b.id;
 a.gold=0;const reports=resolveRaids(g,[a,b],[
  {attackerId:a.id,targetId:t1.id,sourceIds:[source.id]},
  {attackerId:a.id,targetId:t2.id,sourceIds:[source.id]}
 ],one);
 assert.equal(reports.length,1);assert.equal(t1.owner,a.id);assert.equal(t1.warships,7);
 assert.equal(t2.owner,b.id);assert.equal(source.warships,0);assert.equal(a.gold,1);
 assert.match(g.history.join(' '),/already committed/);
});

test('defender wins ties and keeps island; losers lose ceil(half), winner loses one',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const [t,s]=cluster(g,1);
 t.owner=b.id;t.warships=4;s.owner=a.id;s.warships=4;
 const [r]=resolveRaids(g,[a,b],[{attackerId:a.id,targetId:t.id,sourceIds:[s.id]}],six);
 assert.equal(r.outcome,'defended');assert.equal(r.winnerId,b.id);assert.equal(t.owner,b.id);
 assert.equal(r.defender.losses,1);assert.equal(r.attackers[0].losses,2);
 assert.equal(t.warships,3);assert.equal(s.warships,2);
});

test('equal-strength rival attackers stalemate and defender retains the tile',()=>{
 const {game:g,players:[a,b,c]}=setup();const [t,sa,sb]=cluster(g,2);
 t.owner=c.id;t.warships=0;sa.owner=a.id;sa.warships=5;sb.owner=b.id;sb.warships=5;
 const [r]=resolveRaids(g,[a,b,c],[{attackerId:a.id,targetId:t.id,sourceIds:[sa.id]},
   {attackerId:b.id,targetId:t.id,sourceIds:[sb.id]}],one);
 assert.equal(r.outcome,'defended');assert.equal(r.winnerId,c.id);
 assert.equal(sa.warships,2);assert.equal(sb.warships,2);assert.equal(t.warships,0);
});

test('cross raids launch concurrently without using each destination for defence',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const [ta,tb]=cluster(g,1);
 ta.owner=a.id;ta.warships=6;tb.owner=b.id;tb.warships=6;
 const reports=resolveRaids(g,[a,b],[{attackerId:a.id,targetId:tb.id,sourceIds:[ta.id]},
    {attackerId:b.id,targetId:ta.id,sourceIds:[tb.id]}],one);
 assert.equal(reports.length,2);
 assert.ok(reports.every(r=>r.outcome==='captured'));
 assert.equal(ta.owner,b.id);assert.equal(tb.owner,a.id);
 assert.equal(ta.warships,5);assert.equal(tb.warships,5);
 assert.equal(total(g),10);
});

test('Nyla gets one die reroll when attacking and defending only in Advanced mode',()=>{
 for(const mode of ['advanced','standard']){
  const {game:g,players:[nyla,b]}=setup(['nyla','tobias'],mode);const [t,s]=cluster(g,1);
  t.owner=b.id;t.warships=3;s.owner=nyla.id;s.warships=2;
  const rolls=[3,1,6];let pos=0;
  const [r]=resolveRaids(g,[nyla,b],[{attackerId:nyla.id,targetId:t.id,sourceIds:[s.id]}],()=>rolls[pos++]??1);
  assert.equal(r.outcome,mode==='advanced'?'captured':'defended');
  assert.deepEqual(r.attackers[0].dice,mode==='advanced'?[1,6]:[1]);
 }
});

test('harbour, Port and Admiralty House renown transfer exactly once after a capture',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const harbour=g.chart.tiles.find(t=>t.type==='harbour');
 const source=g.chart.tiles.find(t=>claimable(t)&&distance(t,harbour)===1);
 harbour.owner=b.id;harbour.port=true;harbour.admiraltyHouse=true;harbour.warships=0;
 source.owner=a.id;source.warships=10;b.renown=5;a.renown=0;
 const [r]=resolveRaids(g,[a,b],[{attackerId:a.id,targetId:harbour.id,sourceIds:[source.id]}],six);
 assert.equal(r.outcome,'captured');assert.equal(harbour.owner,a.id);
 assert.equal(a.renown,5);assert.equal(b.renown,0);
});

test('defenders retreat to another owned island when their coast is captured',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const [target,source]=cluster(g,1);
 const refuge=g.chart.tiles.find(t=>claimable(t)&&![source.id,target.id].includes(t.id));
 target.owner=b.id;target.warships=4;source.owner=a.id;source.warships=10;refuge.owner=b.id;
 const initial=total(g);const [r]=resolveRaids(g,[a,b],[{attackerId:a.id,targetId:target.id,sourceIds:[source.id]}],six);
 assert.equal(r.outcome,'captured');assert.equal(refuge.warships,2);assert.equal(r.strandedShips,0);
 assert.equal(total(g),initial-3);
});

test('battle report is public but never includes hidden contract details, inventory or token',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);const [t,s]=cluster(g,1);
 t.owner=b.id;s.owner=a.id;s.warships=8;
 resolveRaids(g,[a,b],[{attackerId:a.id,targetId:t.id,sourceIds:[s.id]}],one);
 const shared=publicGame(g),text=JSON.stringify(shared);
 assert.equal(shared.battles.length,1);assert.equal(shared.battleRound,2);
 assert.deepEqual(shared.battles[0].attackers[0].dice,[1]);
 assert.ok(!text.includes('contractReserve'));
 assert.ok(!text.includes('contractDeck:'));
 assert.ok(!text.includes('token'));
});

test('long deterministic stress run conserves nonnegative ship counts with overlapping raids',()=>{
 for(let run=0;run<80;run++){
  const {game:g,players}=setup(['isadora','tobias','rosa','hugo']);
  const targets=g.chart.tiles.filter(claimable);
  for(let i=0;i<targets.length;i++){targets[i].owner=players[(i+run)%players.length].id;targets[i].warships=(i+run)%7;}
  const before=total(g);const raids=[];
  for(let i=0;i<targets.length;i++){
   const target=targets[i];const attacker=players.find(p=>p.id!==target.owner&&targets.some(src=>src.owner===p.id&&src.warships&&distance(src,target)===1));
   if(!attacker)continue;
   raids.push({attackerId:attacker.id,targetId:target.id,sourceIds:targets.filter(src=>src.owner===attacker.id&&src.warships&&distance(src,target)===1).map(t=>t.id)});
  }
  const battle=resolveRaids(g,players,raids,()=>4);
  assert.ok(battle.length>0);
  assert.ok(g.chart.tiles.every(t=>Number.isInteger(t.warships)&&t.warships>=0));
  assert.ok(total(g)<=before,`ships must not multiply on run ${run}`);
  assert.ok(g.chart.tiles.every(t=>t.owner===null||players.some(p=>p.id===t.owner)));
 }
});

test('phone and television include real game battle reports and accessible labels',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const tv=fs.readFileSync(path.join(__dirname,'../public/tv.html'),'utf8');
 const phone=fs.readFileSync(path.join(__dirname,'../public/phone.html'),'utf8');
 assert.match(tv,/id="battle-summary"/);assert.match(tv,/function renderBattleSummary/);
 assert.match(phone,/id="battle-reports"/);assert.match(phone,/function renderBattles/);
 assert.match(tv,/aria-label="Latest naval battles"/);
 assert.match(phone,/aria-label="Latest naval battle results"/);
 assert.match(tv,/battleSequence/);
});

test('two raids with separate fleets are both permitted in one round',()=>{
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);
 const [t1,s1]=cluster(g,1);
 const pair=g.chart.tiles.filter(t=>claimable(t)&&![t1.id,s1.id].includes(t.id))
   .map(t=>[t,...g.chart.tiles.filter(s=>claimable(s)&&![t1.id,s1.id,t.id].includes(s.id)&&distance(s,t)===1)])
   .find(x=>x.length>1);
 assert.ok(pair);const [t2,s2]=pair;
 t1.owner=b.id;t2.owner=b.id;s1.owner=a.id;s2.owner=a.id;s1.warships=8;s2.warships=8;
 const reports=resolveRaids(g,[a,b],[
   {attackerId:a.id,targetId:t1.id,sourceIds:[s1.id]},
   {attackerId:a.id,targetId:t2.id,sourceIds:[s2.id]}
 ],one);
 assert.equal(reports.length,2);assert.equal(t1.owner,a.id);assert.equal(t2.owner,a.id);
 assert.equal(t1.warships,7);assert.equal(t2.warships,7);
});

test('Nyla defending an island can reroll in Advanced but not Standard',()=>{
 for(const mode of ['standard','advanced']){
  const {game:g,players:[nyla,a]}=setup(['nyla','isadora'],mode);
  const [target,source]=cluster(g,1);
  target.owner=nyla.id;target.warships=2;source.owner=a.id;source.warships=4;
  const dice=[1,6,4];let index=0;
  const [r]=resolveRaids(g,[nyla,a],[{attackerId:a.id,targetId:target.id,sourceIds:[source.id]}],()=>dice[index++]||1);
  assert.equal(r.outcome,mode==='advanced'?'defended':'captured');
  assert.deepEqual(r.defender.dice,mode==='advanced'?[1,6]:[1]);
 }
});

test('end-to-end Plan/Reveal retains the last battle on the next planning round',()=>{
 const {newGame,submitOrders,resolveRound,publicGame}=require('../src/engine');
 const {game:g,players:[a,b]}=setup(['isadora','tobias']);
 const [target,source]=cluster(g,1);
 target.owner=b.id;target.warships=0;source.owner=a.id;source.warships=10;
 g.phase='plan';g.era='Sail';g.round=2;g.orders={};g.submitted={};
 assert.equal(submitOrders(g,[a,b],a.id,[{kind:'raid',tileId:target.id},{kind:'hold'}]).ok,true);
 assert.equal(submitOrders(g,[a,b],b.id,[{kind:'hold'},{kind:'hold'}]).ok,true);
 assert.equal(resolveRound(g,[a,b],5000).ok,true);
 assert.equal(g.phase,'plan');assert.equal(g.round,3);
 assert.equal(g.battles.length,1);assert.equal(g.battleRound,2);
 assert.equal(publicGame(g).battles[0].winnerId,a.id);
});
