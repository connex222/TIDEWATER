'use strict';
/** Unseeded rules-level strategy tournament. Run multiple times for a broader sample.
 * This is a heuristic model, NOT a human balance validation or a gameplay rule.
 */
const fs=require('node:fs');
const path=require('node:path');
const {newGame,placeSettlement,legalPlacements,legalTargets,submitOrders,resolveRound,canSettle}=require('../src/engine');
const {distance}=require('../src/chart');
const MODES=['quick','standard','advanced'];
const STRATEGIES=['trade','expand','navy','hybrid'];
const COUNTS=Number(process.argv[2]||80);
const OUT=path.join(__dirname,'..','BALANCE-REPORT.json');
function candidates(game,p,type){const l=legalTargets(game,p.id);return l[type]||[];}
function fill(game,players,p,order){const primary=order||{kind:'hold'};
 if(submitOrders(game,players,p.id,[primary,{kind:'hold'}]).ok)return primary.kind;
 if(submitOrders(game,players,p.id,[{kind:'hold'},{kind:'hold'}]).ok)return 'hold';
 throw Error('Cannot submit Hold order');}
function pick(game,p,strategy){
 const owned=game.chart.tiles.filter(t=>t.owner===p.id);
 const ports=candidates(game,p,'port').filter(id=>p.goods.spice>=2&&p.goods.silk>=2&&p.goods.timber>=1);
 const settle=candidates(game,p,'settle').filter(id=>p.goods.fish>=1&&p.goods.timber>=1)
    .sort((a,b)=>Number(game.chart.tiles.find(t=>t.id===b)?.type==='harbour')-Number(game.chart.tiles.find(t=>t.id===a)?.type==='harbour'));
 const lanes=candidates(game,p,'lane').filter(id=>{const l=game.chart.lanes.find(l=>l.id===id);return p.goods.timber>=l.segments&&p.goods.silk>=l.segments;});
 const raid=candidates(game,p,'raid').filter(id=>{
  const tile=game.chart.tiles.find(t=>t.id===id);
  return owned.filter(t=>t.warships>0&&distance(t,tile)===1).reduce((n,t)=>n+t.warships,0)>=tile.warships+2;
 });
 const fleet=owned.filter(t=>t.warships>0).sort((a,b)=>b.warships-a.warships);
 const toSell=['spice','silk','fish','timber'].find(g=>p.goods[g]>(g==='fish'||g==='timber'?2:0));
 const market=()=>toSell?{kind:'market',direction:'sell',quantities:{[toSell]:Math.min(5,Math.max(1,p.goods[toSell]-(toSell==='fish'||toSell==='timber'?2:0)))}}:null;
 const build=()=>settle[0]?{kind:'settle',tileId:settle[0]}:ports[0]?{kind:'port',tileId:ports[0]}:lanes[0]?{kind:'lane',laneId:lanes[0]}:null;
 const ship=()=>owned.length&&p.gold>=6?{kind:'warships',tileId:(fleet[0]||owned[0]).id,count:3}:null;
 const attack=()=>raid[0]?{kind:'raid',tileId:raid[0]}:null;
 const buy=()=>p.gold>=12&&(p.goods.fish<1||p.goods.timber<1)?{kind:'market',direction:'buy',quantities:{fish:p.goods.fish<1?1:0,timber:p.goods.timber<1?1:0}}:null;
 const options={
   trade:[market(),ports[0]&&{kind:'port',tileId:ports[0]},build(),buy()],
   expand:[build(),buy(),market(),ship()],
   navy:[attack(),ship(),market(),build()],
   hybrid:[build(),market(),attack(),ship(),buy()]
 }[strategy];
 return options.find(Boolean)||{kind:'hold'};
}
function choosePlacement(game,p,strategy){
 const avail=legalPlacements(game);
 // Early fish/timber production makes building economically possible.
 const ranked=avail.map(id=>game.chart.tiles.find(t=>t.id===id)).sort((a,b)=>{
  const weight=t=>{
   let val={fish:6,timber:6,spice:4,silk:4}[t.type]||0;
   const n=game.chart.tiles.filter(u=>u.owner===p.id&&u.type===t.type).length;
   if(n)val-=3;
   if(strategy==='trade'&&['spice','silk'].includes(t.type))val+=5;
   if(strategy==='navy')val+=game.chart.tiles.filter(u=>u.owner&&u.owner!==p.id&&distance(u,t)===1).length*2;
   return val;
  };return weight(b)-weight(a);
 });return ranked[0]?.id;
}
function runOne(mode,run){
 const strategies=STRATEGIES.map((_,i)=>STRATEGIES[(i+run)%4]);
 const players=strategies.map((strategy,i)=>({id:`p${i}`,name:`Simulated ${strategy} ${i}`,avatarId:['isadora','tobias','rosa','finch'][i],strategy}));
 const game=newGame(players,mode);
 for(const id of game.placementOrder){const p=players.find(p=>p.id===id);const tile=choosePlacement(game,p,p.strategy);const r=placeSettlement(game,players,id,tile,1000);if(!r.ok)throw Error(`Placement: ${r.error}`);}
 const used=Object.fromEntries(STRATEGIES.map(s=>[s,{}]));let rounds=0;
 while(game.phase==='plan'&&rounds<14){
  rounds++;
  for(const p of players){const kind=fill(game,players,p,pick(game,p,p.strategy));used[p.strategy][kind]=(used[p.strategy][kind]||0)+1;}
  const r=resolveRound(game,players,1000+rounds*1000);if(!r.ok)throw Error(r.error);
  for(const p of players){if(p.gold<0||Object.values(p.goods).some(n=>n<0)||p.renown<0)throw Error('Resources or scores underflow');}
 }
 if(game.phase!=='finished')throw Error('Game did not finish');
 return {winner:players.filter(p=>game.winnerIds.includes(p.id)).map(p=>p.strategy),rounds,used,players:players.map(p=>({strategy:p.strategy,renown:p.renown,gold:p.gold,islands:game.chart.tiles.filter(t=>t.owner===p.id).length,lanes:game.chart.lanes.filter(t=>t.owner===p.id).length,ships:game.chart.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+t.warships,0)}))};
}
const report={generatedAt:new Date().toISOString(),name:'Tidewater Phase 7 heuristic strategy balance probe',runsPerMode:COUNTS,notes:[
  'Artificial rule-level agents, one action plus Hold each round; no human tactical anticipation or negotiated trades.',
  'Board, dice, weather, and seat assignments vary; run output is stochastic and is not a validated win-rate forecast.',
  'No balance rule alterations are made on the basis of this report.'
 ],modes:{}};
for(const mode of MODES){
 const summary={runs:0,sharedWins:0,winCredits:Object.fromEntries(STRATEGIES.map(x=>[x,0])),meanRenown:Object.fromEntries(STRATEGIES.map(x=>[x,0])),meanGold:Object.fromEntries(STRATEGIES.map(x=>[x,0])),meanIslands:Object.fromEntries(STRATEGIES.map(x=>[x,0])),meanShips:Object.fromEntries(STRATEGIES.map(x=>[x,0])),meanRound:0,actions:Object.fromEntries(STRATEGIES.map(x=>[x,{}]))};
 for(let i=0;i<COUNTS;i++){
  const r=runOne(mode,i);summary.runs++;summary.meanRound+=r.rounds;
  if(r.winner.length>1)summary.sharedWins++;
  for(const winner of r.winner)summary.winCredits[winner]+=1/r.winner.length;
  for(const p of r.players){summary.meanRenown[p.strategy]+=p.renown;summary.meanGold[p.strategy]+=p.gold;summary.meanIslands[p.strategy]+=p.islands;summary.meanShips[p.strategy]+=p.ships;}
  for(const [strategy,actions] of Object.entries(r.used))for(const [kind,n]of Object.entries(actions))summary.actions[strategy][kind]=(summary.actions[strategy][kind]||0)+n;
 }
 summary.meanRound=+(summary.meanRound/COUNTS).toFixed(2);
 for(const k of ['meanRenown','meanGold','meanIslands','meanShips'])for(const s of STRATEGIES)summary[k][s]=+(summary[k][s]/COUNTS).toFixed(2);
 for(const s of STRATEGIES)summary.winCredits[s]=+(100*summary.winCredits[s]/COUNTS).toFixed(1);
 report.modes[mode]=summary;
 console.log(mode,summary.winCredits,'rounds',summary.meanRound);
}
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log('Results:',OUT);
