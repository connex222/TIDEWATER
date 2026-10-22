'use strict';
const {shuffle}=require('./constants');
const HEX_NAMES=['Coral Point','Saltmere','Sunward Cay','Seabird Isle','Crownfish Bay','Amber Reach','Pelican Rest','Palmhaven','Shellwater','Driftwood Key','Gullrock','Starling Shore','Brasswater','The Shallows','Marigold Key','Seafarer’s Rest','Whisper Reef','Pearlward','Westwind Cay','High Tern','Hearthcove','Moonkelp','Brightwake','Turtlewatch','Flintshore','Kingfisher Isle','Spindle Quay','Redwater','Seafoam Reach','Westlock','Honeyshell','Larksail','Far Lantern','Goldwake','Oystermere','Copper Cove'];
const tileTypes=[...Array(6).fill('fish'),...Array(6).fill('timber'),...Array(5).fill('spice'),...Array(5).fill('silk'),...Array(4).fill('reef'),...Array(4).fill('sea')];
const harbourCoords=[[2,0],[0,2],[-2,2],[-2,0],[0,-2],[2,-2]];
const key=(q,r)=>`${q},${r}`;
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function createChart(){
  const hexes=[];
  for(let r=-3;r<=3;r++) for(let q=-3;q<=3;q++) if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3) hexes.push({q,r});
  const names=shuffle(HEX_NAMES), types=shuffle(tileTypes), harbourSet=new Set(harbourCoords.map(([q,r])=>key(q,r)));
  let n=0;
  const tiles=hexes.map(({q,r})=>{
    const type=q===0&&r===0?'bazaar':harbourSet.has(key(q,r))?'harbour':types[n++];
    return {id:key(q,r),q,r,type,name:type==='bazaar'?'The Grand Bazaar':type==='harbour'?`Harbour ${harbourCoords.findIndex(([hq,hr])=>hq===q&&hr===r)+1}`:names.shift(),owner:null,warships:0,port:false};
  });
  const points=[...tiles.filter(t=>t.type==='harbour'),tiles.find(t=>t.type==='bazaar')];
  // 6 Bazaar links + 12 harbour-to-harbour links = 18, with lengths 2–4.
  const edges=[];
  for(let i=0;i<6;i++)edges.push([i,6]);
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)if((j-i)!==3)edges.push([i,j]);
  if(edges.length!==18)throw new Error('Lane topology must total 18');
  const colours=shuffle([...Array(6).fill('Blue'),...Array(6).fill('Green'),...Array(6).fill('Silver')]);
  const lanes=edges.map(([a,b],i)=>({id:`lane-${i+1}`,from:points[a].id,to:points[b].id,segments:distance(points[a],points[b]),colour:colours[i],owner:null}));
  if(tiles.length!==37||n!==30||lanes.some(l=>l.segments<2||l.segments>5))throw new Error('Invalid generated chart');
  return {tiles,lanes};
}
function isProduction(tile){return ['fish','timber','spice','silk'].includes(tile?.type);}
module.exports={createChart,isProduction,distance};
