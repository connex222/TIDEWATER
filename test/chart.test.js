'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createChart,distance}=require('../src/chart');
const expected={fish:6,timber:6,spice:5,silk:5,harbour:6,reef:4,sea:4,bazaar:1};
test('every chart has 37 tiles with the exact specification counts',()=>{
  for(let run=0;run<100;run++){
    const c=createChart(),actual={};for(const tile of c.tiles)actual[tile.type]=(actual[tile.type]||0)+1;
    assert.deepEqual(actual,expected);assert.equal(new Set(c.tiles.map(x=>x.id)).size,37);
    assert.equal(c.tiles.find(t=>t.id==='0,0').type,'bazaar');
  }
});
test('18 lanes have legal lengths, distinct endpoints and 6 lanes of each colour',()=>{
  for(let run=0;run<100;run++){
    const c=createChart(),tileMap=Object.fromEntries(c.tiles.map(t=>[t.id,t]));const counts={Blue:0,Green:0,Silver:0};
    assert.equal(c.lanes.length,18);
    for(const lane of c.lanes){counts[lane.colour]++;assert.ok(lane.segments>=2&&lane.segments<=5);assert.equal(lane.segments,distance(tileMap[lane.from],tileMap[lane.to]));
      assert.ok(['harbour','bazaar'].includes(tileMap[lane.from].type));assert.ok(['harbour','bazaar'].includes(tileMap[lane.to].type));}
    assert.deepEqual(counts,{Blue:6,Green:6,Silver:6});
    assert.equal(new Set(c.lanes.map(l=>[l.from,l.to].sort().join('|'))).size,18);
  }
});
