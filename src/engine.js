'use strict';
const {MODES,TIDES,GOODS,randomInt,shuffle}=require('./constants');
const {createChart,isProduction,distance}=require('./chart');
const COST={settle:{timber:1,fish:1},port:{spice:2,silk:2,timber:1},explore:{gold:3,spice:1}};
const ERA_UPGRADES={
 Sail:[{id:'shipwrights',name:'Shipwrights',effect:'Sea lanes cost 1 less Timber each.'},{id:'fishmongers',name:"Fishmongers’ Guild",effect:'Fish sells for at least 3 Gold.'},{id:'privateers',name:'Privateers',effect:'Gain 2 Warships now and 1 at each new era.'}],
 Cannon:[{id:'deep-harbours',name:'Deep Harbours',effect:'Ports cost 1 less Silk.'},{id:'trade-winds',name:'Trade Winds',effect:'Your sea lanes earn Gold at Low Tide.'},{id:'coastal-forts',name:'Coastal Forts',effect:'Every owned island gains +1 defence.'}],
 Steam:[{id:'steam-packets',name:'Steam Packets',effect:'Chart sea lanes even at Low Tide.'},{id:'admiralty-house',name:'Admiralty House',effect:'Your first Port awards +2 additional Renown.'},{id:'chamber-commerce',name:'Chamber of Commerce',effect:'Each completed Voyage Contract awards +1 Renown.'}]
};

const fail=error=>({ok:false,error});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

function chooseTide(previous,previousPrevious){
  const choices=TIDES.filter(c=>!(previous===c&&previousPrevious===c));
  return choices[randomInt(choices.length)];
}

function newGame(players,mode){
  if(!MODES[mode])throw new Error('Invalid game mode');
  if(players.length<2||players.length>8)throw new Error('Invalid captain count');
  const chart=createChart();
  const placementOrder=[...players.map(p=>p.id),...players.map(p=>p.id).reverse()];
  const contractDeck=createContracts(chart);
  const game={
    mode,phase:'placement',round:0,era:'Sail',chart,placementOrder,placementIndex:0,
    market:Object.fromEntries(GOODS.map(g=>[g,2])),tide:null,nextTide:chooseTide(null,null),previousTide:null,
    orders:{},submitted:{},deadline:null,rotation:0,winnerIds:[],marketSales:[],deals:[],dealSequence:0,trophies:{route:null,fleet:null},masterTrader:[],
    contractDeck,history:['The Tidewater chart is unfurled. Captains, claim your first islands.']
  };
  for(const p of players){
    p.goods=Object.fromEntries(GOODS.map(g=>[g,1]));
    p.gold=2;p.renown=0;p.placements=0;p.contracts=drawContracts(game,2);p.completedContracts=0;p.upgrades=[];p.marketGoldEra=0;
  }
  return game;
}

function drawContracts(game,count){
  const taken=[];
  while(count-->0&&game.contractDeck.length)taken.push(game.contractDeck.pop());
  return taken;
}

function createContracts(chart){
  const production=shuffle(chart.tiles.filter(t=>['fish','timber','spice','silk'].includes(t.type)));
  const harbours=chart.tiles.filter(t=>t.type==='harbour');
  const bazaarLanes=shuffle(chart.lanes.filter(l=>l.from==='0,0'||l.to==='0,0'));
  const deck=[];
  for(let i=0;i<10&&i*2+1<production.length;i++){
    const a=production[i*2],b=production[i*2+1];
    deck.push({id:`pair-${i+1}`,kind:'own-both',tileIds:[a.id,b.id],points:i<6?2:3,text:i<6?`Hold both ${a.name} and ${b.name}.`:`Secure a double charter: ${a.name} and ${b.name}.`});
  }
  const harbourPairs=[[0,1],[2,3],[4,5],[0,5]];
  for(let i=0;i<harbourPairs.length;i++){
    const [x,y]=harbourPairs[i],a=harbours[x],b=harbours[y];
    deck.push({id:`harbours-${i+1}`,kind:'own-both',tileIds:[a.id,b.id],points:3,text:`Control both ${a.name} and ${b.name}.`});
  }
  for(let i=0;i<4&&i<bazaarLanes.length;i++){
    const lane=bazaarLanes[i];
    const harbourId=lane.from==='0,0'?lane.to:lane.from;
    const harbour=harbours.find(t=>t.id===harbourId);
    deck.push({id:`bazaar-run-${i+1}`,kind:'own-lane',laneId:lane.id,points:3,text:`Own the Bazaar Run from ${harbour?.name||'Harbour'} to the Grand Bazaar.`});
  }
  for(const type of GOODS){
    deck.push({id:`monopoly-${type}`,kind:'own-type-count',tileType:type,count:3,points:2,text:`Control 3 ${titleCase(type)} islands.`});
  }
  deck.push({id:'fleet',kind:'warship-count',count:5,points:2,text:'Command a fleet of at least 5 Warships.'});
  deck.push({id:'lanes',kind:'lane-count',count:4,points:2,text:'Own at least 4 sea lanes.'});
  return shuffle(deck);
}

function currentPlacer(game){return game.phase==='placement'?game.placementOrder[game.placementIndex]??null:null;}
function legalPlacements(game){return game.chart.tiles.filter(t=>isProduction(t)&&t.owner===null).map(t=>t.id);}

function placeSettlement(game,players,playerId,tileId,now=Date.now()){
  if(game.phase!=='placement')return fail('Initial placement is closed.');
  if(currentPlacer(game)!==playerId)return fail('It is not your turn to place.');
  const tile=game.chart.tiles.find(t=>t.id===tileId);
  if(!tile||!isProduction(tile)||tile.owner!==null)return fail('Choose an unclaimed production island.');
  const player=players.find(p=>p.id===playerId);if(!player)return fail('Captain not found.');
  tile.owner=playerId;tile.warships=1;player.placements++;
  game.placementIndex++;game.history.push(`${player.name} settles ${tile.name} and stations 1 Warship.`);
  if(game.placementIndex===game.placementOrder.length)beginFirstRound(game,players,now);
  return {ok:true};
}

function eraFor(game){return game.round<=(game.mode==='quick'?3:4)?'Sail':game.round<=(game.mode==='quick'?6:8)?'Cannon':'Steam';}

function payIncome(game,players){
  for(const tile of game.chart.tiles){if(!tile.owner)continue;
    const player=players.find(p=>p.id===tile.owner);if(!player)continue;
    if(isProduction(tile))player.goods[tile.type]++;
    else if(tile.type==='harbour')player.gold+=tile.port?2:1;
  }
  for(const lane of game.chart.lanes){if(!lane.owner)continue;
    const player=players.find(p=>p.id===lane.owner);if(player&&(lane.colour!==game.tide||hasUpgrade(player,'trade-winds')))player.gold+=1+(lane.from==='0,0'||lane.to==='0,0'?1:0);
  }
  const low=Math.min(...players.map(p=>p.renown));
  for(const p of players)if(p.renown===low)p.gold++;
}

function beginRound(game,players,now=Date.now()){
  const priorEra=game.era;
  game.phase='plan';game.era=eraFor(game);
  if(priorEra!==game.era){
    for(const p of players){p.marketGoldEra=0;if(hasUpgrade(p,'privateers'))addWarships(game,p.id,1);}
  }
  game.tide=game.nextTide;game.nextTide=chooseTide(game.tide,game.previousTide);game.previousTide=game.tide;
  game.orders={};game.submitted={};game.deals=[];game.deadline=now+MODES[game.mode].planSeconds*1000;
  // A house is never permanently eliminated. The Admiralty grants one free vacant island.
  for(const p of players)if(!game.chart.tiles.some(t=>t.owner===p.id)){
    const free=game.chart.tiles.filter(t=>t.owner===null&&['fish','timber','spice','silk','harbour','reef'].includes(t.type));
    if(free.length){const t=free[randomInt(free.length)];t.owner=p.id;t.warships=0;if(t.type==='harbour')p.renown++;game.history.push(`${p.name} returns with a free settlement at ${t.name}.`);}
  }
  payIncome(game,players);
  game.history.push(`Round ${game.round}: ${game.tide} Low Tide. Income paid. Plot two secret orders.`);
}
function beginFirstRound(game,players,now=Date.now()){game.round=1;beginRound(game,players,now);}
function resourcesEnough(p,cost){return Object.entries(cost).every(([g,v])=>(g==='gold'?p.gold:p.goods[g])>=v);}
function spend(p,cost){for(const [good,count]of Object.entries(cost)){if(good==='gold')p.gold-=count;else p.goods[good]-=count;}}
function hasUpgrade(p,id){return !!p?.upgrades?.includes(id);}
function addWarships(game,id,n){const home=game.chart.tiles.find(t=>t.owner===id);if(home)home.warships+=n;}
function firstRoundOfEra(game){return game.round===(game.mode==='quick'?{Sail:1,Cannon:4,Steam:7}:{Sail:1,Cannon:5,Steam:9})[game.era];}
function upgradeOptions(game,p){return game.phase==='plan'&&firstRoundOfEra(game)&&!p.upgrades?.some(id=>ERA_UPGRADES[game.era].some(c=>c.id===id))?ERA_UPGRADES[game.era]:[];}
function chooseUpgrade(game,players,id,upgradeId){
 const p=players.find(x=>x.id===id);if(!p||!upgradeOptions(game,p).some(x=>x.id===upgradeId))return fail('That era upgrade is not available.');
 if(game.submitted[id])return fail('Choose an upgrade before locking orders.');
 p.upgrades.push(upgradeId);if(upgradeId==='steam-packets'){game.steamPacketHolders??=[];game.steamPacketHolders.push(id);}
 if(upgradeId==='privateers')addWarships(game,id,2);
 if(upgradeId==='admiralty-house'){const port=game.chart.tiles.find(t=>t.owner===id&&t.port);if(port){port.admiraltyHouse=true;p.renown+=2;p.admiraltyAwarded=true;}}
 if(upgradeId==='chamber-commerce')p.renown+=(p.completedContracts||0);
 game.history.push(`${p.name} adopts ${ERA_UPGRADES[game.era].find(x=>x.id===upgradeId).name}.`);
 return {ok:true};
}

function tileById(game,id){return game.chart.tiles.find(t=>t.id===id);} 
function laneById(game,id){return game.chart.lanes.find(t=>t.id===id);} 
function laneNearby(lane,tile,game){
  const a=tileById(game,lane.from),b=tileById(game,lane.to);
  const aq=a.q+a.r/2,ar=a.r*Math.sqrt(3)/2,bq=b.q+b.r/2,br=b.r*Math.sqrt(3)/2;
  const tq=tile.q+tile.r/2,tr=tile.r*Math.sqrt(3)/2;
  const dx=bq-aq,dy=br-ar,t=Math.max(0,Math.min(1,((tq-aq)*dx+(tr-ar)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(tq-(aq+t*dx),tr-(ar+t*dy))<=1.01;
}
function canSettle(game,id,tile){return game.chart.tiles.some(t=>t.owner===id&&distance(t,tile)===1)||game.chart.lanes.some(l=>l.owner===id&&laneNearby(l,tile,game));}
function validOrderShape(o){return o&&typeof o==='object'&&!Array.isArray(o)&&typeof o.kind==='string';}

function raidSources(game,attackerId,targetTile){
  return game.chart.tiles.filter(t=>t.owner===attackerId&&t.warships>0&&distance(t,targetTile)===1);
}

function applyOrder(game,p,order,context){
  if(!validOrderShape(order))return fail('Choose a valid order.');
  const market=context.market,sold=context.sold;
  if(order.kind==='hold')return {ok:true,description:`${p.name} holds position.`};
  if(order.kind==='settle'){
    const t=tileById(game,order.tileId);
    if(!t||t.owner!==null||!['fish','timber','spice','silk','harbour','reef'].includes(t.type))return fail('The island is not available.');
    if(!canSettle(game,p.id,t))return fail('Settlement must touch your island or sea lane.');
    if(!resourcesEnough(p,COST.settle))return fail('Not enough Fish and Timber.');
    spend(p,COST.settle);t.owner=p.id;t.warships=0;if(t.type==='harbour')p.renown++;
    return {ok:true,description:`${p.name} settles ${t.name}${t.type==='harbour'?' (+1 Renown)':''}.`};
  }
  if(order.kind==='port'){
    const t=tileById(game,order.tileId);
    if(!t||t.owner!==p.id||t.type!=='harbour'||t.port)return fail('Choose one of your Harbour settlements without a Port.');
    const portCost={...COST.port,silk:Math.max(0,COST.port.silk-(hasUpgrade(p,'deep-harbours')?1:0))};
    if(!resourcesEnough(p,portCost))return fail('Not enough Spice, Silk and Timber for a Port.');
    spend(p,portCost);t.port=true;p.renown+=2;
    if(hasUpgrade(p,'admiralty-house')&&!p.admiraltyAwarded){p.renown+=2;p.admiraltyAwarded=true;t.admiraltyHouse=true;}
    return {ok:true,description:`${p.name} raises a lighthouse at ${t.name} (+2 Renown).`};
  }
  if(order.kind==='lane'){
    const l=laneById(game,order.laneId);
    if(!l||l.owner!==null)return fail('That sea lane is already claimed or missing.');
    if(l.colour===game.tide&&!hasUpgrade(p,'steam-packets'))return fail('This sea lane is closed at Low Tide.');
    if(tileById(game,l.from)?.owner!==p.id&&tileById(game,l.to)?.owner!==p.id)return fail('A lane must touch one of your islands.');
    const cost={timber:Math.max(0,l.segments-(hasUpgrade(p,'shipwrights')?1:0)),silk:l.segments};if(!resourcesEnough(p,cost))return fail(`You need ${l.segments} Timber and ${l.segments} Silk.`);
    spend(p,cost);l.owner=p.id;
    return {ok:true,description:`${p.name} charts a ${l.colour} lane (${l.segments} segments).`};
  }
  if(order.kind==='warships'){
    if(!Number.isInteger(order.count)||order.count<1||order.count>3)return fail('Launch 1–3 Warships.');
    const t=tileById(game,order.tileId);
    if(!t||t.owner!==p.id)return fail('Warships must launch from your own island.');
    if(!resourcesEnough(p,{gold:2*order.count}))return fail('Not enough Gold to launch these Warships.');
    spend(p,{gold:2*order.count});t.warships+=order.count;
    return {ok:true,description:`${p.name} launches ${order.count} Warship${order.count>1?'s':''} at ${t.name}.`};
  }
  if(order.kind==='market'){
    if(!['buy','sell'].includes(order.direction))return fail('Choose Buy or Sell.');
    const quantities=order.quantities;
    if(!quantities||typeof quantities!=='object'||Array.isArray(quantities)||Object.keys(quantities).some(g=>!GOODS.includes(g)))return fail('Invalid goods selection.');
    const q=Object.fromEntries(GOODS.map(g=>[g,own(quantities,g)?quantities[g]:0]));
    if(Object.values(q).some(n=>!Number.isInteger(n)||n<0||n>10)||Object.values(q).reduce((a,b)=>a+b,0)>20)return fail('Select at most 20 goods, up to 10 of each type.');
    if(!Object.values(q).some(n=>n>0))return fail('Choose at least one good to trade.');
    const cost=GOODS.reduce((n,g)=>n+q[g]*(order.direction==='buy'?market[g]+1:g==='fish'&&hasUpgrade(p,'fishmongers')?Math.max(3,market[g]):market[g]),0);
    if(order.direction==='sell'){
      for(const g of GOODS)if(q[g]>p.goods[g])return fail(`Not enough ${g} to sell.`);
      for(const g of GOODS){p.goods[g]-=q[g];if(q[g]){sold.add(g);market[g]=Math.max(1,market[g]-1);}}
      p.gold+=cost;p.marketGoldEra=(p.marketGoldEra||0)+cost;
    }else{
      if(p.gold<cost)return fail('Not enough Gold for this purchase.');
      p.gold-=cost;for(const g of GOODS)p.goods[g]+=q[g];
    }
    return {ok:true,description:`${p.name} ${order.direction==='sell'?'sells':'buys'} ${GOODS.filter(g=>q[g]).map(g=>`${q[g]} ${g}`).join(', ')} for ${cost} Gold.`};
  }
  if(order.kind==='explore'){
    if(context.explored?.has(p.id))return fail('Explore may only be used once per round.');
    if(!resourcesEnough(p,COST.explore))return fail('Explore needs 3 Gold and 1 Spice.');
    if(!game.contractDeck.length)return fail('No Voyage Contracts remain to draw.');
    spend(p,COST.explore);context.explored?.add(p.id);
    const [contract]=drawContracts(game,1);p.contracts.push(contract);
    return {ok:true,description:`${p.name} explores new waters and draws a Voyage Contract.`};
  }
  if(order.kind==='deal'){
    if(!context.players)return fail('Trading partners are unavailable.');
    const deal=validateDeal(context.players,p.id,order);
    if(!deal.ok)return deal;
    if(context.dealOrders?.has(p.id))return fail('Only one Deal may be offered per round.');
    context.dealOrders?.add(p.id);
    return {ok:true,description:`${p.name} makes a private trade offer.`};
  }
  if(order.kind==='raid'){
    const target=tileById(game,order.tileId);
    if(!target||!target.owner||target.owner===p.id||['sea','bazaar'].includes(target.type))return fail('Choose an enemy island to raid.');
    const sources=raidSources(game,p.id,target);
    if(!sources.length)return fail('A raid needs adjacent Warships.');
    context.raids?.push({attackerId:p.id,targetId:target.id,sourceIds:sources.map(t=>t.id)});
    return {ok:true,description:`${p.name} commits a raid against ${target.name}.`};
  }
  return fail('This order is not available yet.');
}

function cloneForDraft(game,players){
  return {game:structuredClone({...game,orders:{},submitted:{}}),players:players.map(p=>({id:p.id,name:p.name,gold:p.gold,goods:{...p.goods},renown:p.renown,contracts:structuredClone(p.contracts||[]),upgrades:[...(p.upgrades||[])],marketGoldEra:p.marketGoldEra||0,completedContracts:p.completedContracts||0}))};
}

function submitOrders(game,players,id,orders){
  if(game.phase!=='plan')return fail('The planning window is closed.');
  if(game.submitted[id])return fail('Your orders are already locked.');
  if(!Array.isArray(orders)||orders.length!==2)return fail('Submit exactly two orders (Hold is permitted).');
  const real=players.find(p=>p.id===id);if(!real)return fail('Captain not found.');
  const cloned=cloneForDraft(game,players),p=cloned.players.find(x=>x.id===id);
  const context={market:{...cloned.game.market},sold:new Set(),raids:[],explored:new Set(),players:cloned.players,dealOrders:new Set()};
  for(const order of orders){const result=applyOrder(cloned.game,p,order,context);if(!result.ok)return result;}
  game.orders[id]=orders.map(o=>({kind:o.kind,...(o.targetId?{targetId:o.targetId}:{}),...(o.give?{give:cleanBundle(o.give)}:{}),...(o.receive?{receive:cleanBundle(o.receive)}:{}),...(o.tileId?{tileId:o.tileId}:{}),...(o.laneId?{laneId:o.laneId}:{}),...(o.count!==undefined?{count:o.count}:{}),...(o.direction?{direction:o.direction}:{}),...(o.quantities?{quantities:Object.fromEntries(GOODS.map(g=>[g,o.quantities[g]??0]))}: {})}));
  game.submitted[id]=true;
  for(const order of game.orders[id])if(order.kind==='deal'){
    game.deals.push({id:`deal-${++game.dealSequence}`,round:game.round,fromId:id,toId:order.targetId,give:order.give,receive:order.receive,status:'pending',expiresAt:Math.min(game.deadline,Date.now()+20000)});
  }
  return {ok:true};
}

function everyoneSubmitted(game,players){return players.every(p=>game.submitted[p.id]);}

function resolveRound(game,players,now=Date.now()){
  if(game.phase!=='plan')return fail('This round cannot be resolved.');
  expireDeals(game,Date.now(),true);
  // Unchosen upgrades are not auto-awarded: the phone offers a clear opt-in choice at the first planning phase of each era.
  game.phase='reveal';const prices={...game.market},sold=new Set(),raids=[],explored=new Set();
  const ordered=[...players.slice(game.rotation),...players.slice(0,game.rotation)];
  for(const p of ordered){
    const orders=game.orders[p.id]||[{kind:'hold'},{kind:'hold'}];
    for(const order of orders){
      // Deal offers were already answered or expired during the planning window.
      if(order.kind==='deal')continue;
      const result=applyOrder(game,p,order,{market:prices,sold,raids,explored,players,dealOrders:new Set()});
      if(result.ok){if(order.kind!=='hold')game.history.push(result.description);}
      else {p.gold++;game.history.push(`${p.name}: order failed (${result.error}); 1 Gold compensation.`);}
    }
  }
  resolveRaids(game,players,raids);
  for(const good of GOODS)if(!sold.has(good))prices[good]=Math.min(4,prices[good]+1);
  game.market=prices;game.marketSales=[...sold];
  awardContracts(game,players);
  updateTrophies(game,players);
  if(eraEnds(game)){awardMasterTrader(game,players);}
  game.history.push(`Round ${game.round} resolved. Market: ${GOODS.map(g=>`${g} ${prices[g]}`).join(' · ')}.`);
  const threshold=MODES[game.mode].winAt;
  if(players.some(p=>p.renown>=threshold)||game.round>=MODES[game.mode].rounds){
    const max=Math.max(...players.map(p=>p.renown));
    const finalists=players.filter(p=>p.renown===max).sort((a,b)=>b.gold-a.gold||laneCount(game,b.id)-laneCount(game,a.id));
    const best=finalists[0];game.winnerIds=finalists.filter(p=>p.gold===best.gold&&laneCount(game,p.id)===laneCount(game,best.id)).map(p=>p.id);
    game.phase='finished';game.deadline=null;
    game.history.push(`${game.winnerIds.length>1?'Draw: '+game.winnerIds.map(id=>players.find(p=>p.id===id).name).join(' and '):best.name} takes the Admiralty Charter!`);
  }else{game.round++;game.rotation=(game.rotation+1)%players.length;beginRound(game,players,now);}
  game.history=game.history.slice(-40);
  return {ok:true};
}

function laneCount(game,id){return game.chart.lanes.filter(l=>l.owner===id).length;}
function warshipCount(game,id){return game.chart.tiles.filter(t=>t.owner===id).reduce((n,t)=>n+t.warships,0);}

function legalTargets(game,id){
  if(game?.phase!=='plan')return {settle:[],port:[],lane:[],warships:[],raid:[]};
  const owned=game.chart.tiles.filter(t=>t.owner===id);
  return {
    settle:game.chart.tiles.filter(t=>t.owner===null&&['fish','timber','spice','silk','harbour','reef'].includes(t.type)&&canSettle(game,id,t)).map(t=>t.id),
    port:owned.filter(t=>t.type==='harbour'&&!t.port).map(t=>t.id),
    lane:game.chart.lanes.filter(l=>l.owner===null&&(l.colour!==game.tide||game.steamPacketHolders?.includes(id))&&(owned.some(t=>t.id===l.from||t.id===l.to))).map(l=>l.id),
    warships:owned.map(t=>t.id),
    raid:game.chart.tiles.filter(t=>t.owner&&t.owner!==id&&raidSources(game,id,t).length).map(t=>t.id)
  };
}

function publicGame(game){if(!game)return null;
  return {mode:game.mode,phase:game.phase,round:game.round,rounds:MODES[game.mode].rounds,winAt:MODES[game.mode].winAt,
    era:game.era,chart:game.chart,placementIndex:game.placementIndex,placementTotal:game.placementOrder.length,
    currentPlacer:currentPlacer(game),legalPlacements:game.phase==='placement'?legalPlacements(game):[],
    market:game.market,tide:game.tide,nextTide:game.nextTide,deadline:game.deadline,
    submittedIds:Object.keys(game.submitted),winnerIds:game.winnerIds,history:game.history.slice(-14),contractDeckCount:game.contractDeck.length,trophies:game.trophies,masterTrader:game.masterTrader};
}

function resolveRaids(game,players,raids){
  for(const raid of raids){
    const target=tileById(game,raid.targetId);if(!target||!target.owner||target.owner===raid.attackerId)continue;
    const sources=raid.sourceIds.map(id=>tileById(game,id)).filter(t=>t&&t.owner===raid.attackerId&&t.warships>0&&distance(t,target)===1);
    const attackShips=sources.reduce((n,t)=>n+t.warships,0);if(!attackShips)continue;
    const defenderId=target.owner,defenderShips=target.warships;
    const attackRoll=randomInt(6)+1,defendRoll=randomInt(6)+1;
    const defendBonus=(target.type==='reef'?1:0)+(target.port?1:0)+(hasUpgrade(players.find(p=>p.id===defenderId),'coastal-forts')?1:0);
    const attackStrength=attackShips+attackRoll,defendStrength=defenderShips+defendBonus+defendRoll;
    for(const source of sources)source.warships=0;
    const attacker=players.find(p=>p.id===raid.attackerId),defender=players.find(p=>p.id===defenderId);
    if(attackStrength>defendStrength){
      target.owner=raid.attackerId;target.warships=Math.max(0,attackShips-1);
      if(target.type==='harbour'){
        const points=1+(target.port?2:0)+(target.admiraltyHouse?2:0);
        defender.renown=Math.max(0,defender.renown-points);attacker.renown+=points;
      }
      game.history.push(`⚔ ${attacker?.name||'Attacker'} captures ${target.name} from ${defender?.name||'the defender'} (${attackStrength} vs ${defendStrength}).`);
    }else{
      redistributeShips(sources,Math.max(0,attackShips-Math.ceil(attackShips/2)));
      target.warships=Math.max(0,target.warships-1);
      game.history.push(`🛡 ${defender?.name||'The defender'} repels a raid on ${target.name} (${defendStrength} vs ${attackStrength}).`);
    }
  }
}

function redistributeShips(sources,count){
  let i=0;
  while(count>0&&sources.length){sources[i%sources.length].warships++;count--;i++;}
}

function awardContracts(game,players){
  for(const p of players){
    for(const contract of p.contracts||[]){
      if(contract.completed)continue;
      if(contractCompleted(game,p.id,contract)){
        contract.completed=true;p.completedContracts=(p.completedContracts||0)+1;p.renown+=contract.points+(hasUpgrade(p,'chamber-commerce')?1:0);
        game.history.push(`📜 ${p.name} completes a Voyage Contract: ${contract.text} (+${contract.points} Renown).`);
      }
    }
  }
}

function contractCompleted(game,playerId,contract){
  const ownedTiles=game.chart.tiles.filter(t=>t.owner===playerId);
  switch(contract.kind){
    case 'own-both': return contract.tileIds.every(id=>ownedTiles.some(t=>t.id===id));
    case 'own-lane': return game.chart.lanes.some(l=>l.id===contract.laneId&&l.owner===playerId);
    case 'own-type-count': return ownedTiles.filter(t=>t.type===contract.tileType).length>=contract.count;
    case 'warship-count': return warshipCount(game,playerId)>=contract.count;
    case 'lane-count': return laneCount(game,playerId)>=contract.count;
    default: return false;
  }
}

function cleanBundle(input){
  return Object.fromEntries([...GOODS,'gold'].map(k=>[k,Number.isInteger(input?.[k])?input[k]:0]));
}
function bundleTotal(bundle){return Object.values(bundle).reduce((n,v)=>n+v,0);}
function validateDeal(players,id,order){
  const to=players.find(p=>p.id===order.targetId),from=players.find(p=>p.id===id);
  if(!to||!from||to.id===from.id)return fail('Choose another captain for the trade.');
  if(!order.give||!order.receive||typeof order.give!=='object'||typeof order.receive!=='object'||Array.isArray(order.give)||Array.isArray(order.receive))return fail('Specify goods to exchange.');
  const valid=obj=>Object.keys(obj).every(k=>[...GOODS,'gold'].includes(k))&&Object.values(obj).every(v=>Number.isInteger(v)&&v>=0&&v<=30);
  if(!valid(order.give)||!valid(order.receive))return fail('Deal quantities must be whole numbers from 0 to 30.');
  const give=cleanBundle(order.give),receive=cleanBundle(order.receive);
  if(!bundleTotal(give)||!bundleTotal(receive))return fail('Both sides must offer at least one good or Gold.');
  if(!resourcesEnough(from,give))return fail('You cannot offer more than you own.');
  return {ok:true};
}
function pendingDeals(game,now=Date.now()){return (game.deals||[]).filter(d=>d.status==='pending'&&d.expiresAt>now);}
function expireDeals(game,now=Date.now(),force=false){
  let changed=false;
  for(const d of game.deals||[]){if(d.status==='pending'&&(force||d.expiresAt<=now)){d.status='expired';changed=true;}}
  return changed;
}
function answerDeal(game,players,recipientId,dealId,accept,now=Date.now()){
  if(game.phase!=='plan')return fail('Trading is closed.');
  expireDeals(game,now);
  const d=game.deals.find(x=>x.id===dealId&&x.toId===recipientId&&x.status==='pending');
  if(!d)return fail('This offer is no longer available.');
  if(!accept){d.status='declined';return {ok:true};}
  const from=players.find(p=>p.id===d.fromId),to=players.find(p=>p.id===d.toId);
  if(!from||!to||!resourcesEnough(from,d.give)||!resourcesEnough(to,d.receive)){d.status='cancelled';return fail('One captain no longer has the goods for this trade.');}
  spend(from,d.give);spend(to,d.receive);
  for(const [k,v] of Object.entries(d.receive)){if(k==='gold')from.gold+=v;else from.goods[k]+=v;}
  for(const [k,v] of Object.entries(d.give)){if(k==='gold')to.gold+=v;else to.goods[k]+=v;}
  d.status='accepted';game.history.push(`🤝 ${from.name} and ${to.name} make a private trade.`);
  return {ok:true};
}
function longestRoute(game,id){
 const lanes=game.chart.lanes.filter(l=>l.owner===id);
 const adj=new Map();lanes.forEach((l,i)=>{for(const v of [l.from,l.to]){if(!adj.has(v))adj.set(v,[]);adj.get(v).push(i);}});
 function explore(node,used){let best=0;for(const i of adj.get(node)||[]){if(used.has(i))continue;used.add(i);const l=lanes[i];best=Math.max(best,1+explore(l.from===node?l.to:l.from,used));used.delete(i);}return best;}
 return Math.max(0,...[...adj.keys()].map(n=>explore(n,new Set())));
}
function updateTrophies(game,players){
 for(const [type,score] of [['route',p=>longestRoute(game,p.id)],['fleet',p=>warshipCount(game,p.id)]]){
  const values=players.map(p=>({id:p.id,score:score(p)}));const best=Math.max(...values.map(v=>v.score));
  const min=type==='fleet'?5:1;
  const leaders=values.filter(v=>v.score===best),winner=best>=min&&leaders.length===1?leaders[0].id:null;
  const prior=game.trophies[type];if(prior===winner)continue;
  if(prior){const p=players.find(x=>x.id===prior);if(p)p.renown=Math.max(0,p.renown-2);}
  if(winner){const p=players.find(x=>x.id===winner);p.renown+=2;game.history.push(`🏆 ${p.name} claims ${type==='route'?'Longest Trade Route':'Mightiest Fleet'} (+2 Renown).`);}
  game.trophies[type]=winner;
 }
}
function eraEnds(game){return game.mode==='quick'?[3,6,8].includes(game.round):[4,8,12].includes(game.round);}
function awardMasterTrader(game,players){
 const best=Math.max(...players.map(p=>p.marketGoldEra||0));
 if(best>0){for(const p of players){if((p.marketGoldEra||0)===best){p.renown++;game.masterTrader.push({era:game.era,playerId:p.id});game.history.push(`🏆 ${p.name} is Master Trader of the ${game.era} Era (+1 Renown).`);}}}
 for(const p of players)p.marketGoldEra=0;
}

function titleCase(text){return text.charAt(0).toUpperCase()+text.slice(1);}

module.exports={newGame,chooseTide,currentPlacer,legalPlacements,placeSettlement,publicGame,beginFirstRound,
  payIncome,beginRound,submitOrders,resolveRound,everyoneSubmitted,applyOrder,canSettle,legalTargets,drawContracts,chooseUpgrade,upgradeOptions,expireDeals,pendingDeals,answerDeal,longestRoute,updateTrophies,ERA_UPGRADES};
