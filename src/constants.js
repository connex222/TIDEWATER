'use strict';
const crypto = require('node:crypto');
const CAPTAINS = Object.freeze([
  { id:'isadora', name:'Captain Isadora Vane', title:'The Admiral', colour:'#C0392B', initials:'IV', portrait:'/art/avatars/isadora_sail_neutral.png' },
  { id:'tobias', name:'Old Tobias Marlow', title:'The Navigator', colour:'#1C5D99', initials:'TM', portrait:'/art/avatars/tobias_sail_neutral.png' },
  { id:'rosa', name:'Rosa Quintero', title:'The Spice Queen', colour:'#D9921A', initials:'RQ', portrait:'/art/avatars/rosa_sail_neutral.png' },
  { id:'finch', name:'Bartholomew “Barnacle” Finch', title:'The Fisherman', colour:'#2A8C6E', initials:'BF', portrait:'/art/avatars/finch_sail_neutral.png' },
  { id:'mei-lin', name:'Lady Mei-Lin Ashcombe', title:'The Silk Merchant', colour:'#7B3B7E', initials:'MA', portrait:'/art/avatars/mei-lin_sail_neutral.png' },
  { id:'hugo', name:'Hugo Grimsby', title:'The Shipwright', colour:'#7A4B24', initials:'HG', portrait:'/art/avatars/hugo_sail_neutral.png' },
  { id:'nyla', name:'Captain Nyla Storm', title:'The Corsair', colour:'#1E2A44', initials:'NS', portrait:'/art/avatars/nyla_sail_neutral.png' },
  { id:'felix', name:'Master Felix Dorrington', title:'The Broker', colour:'#3BA7A0', initials:'FD', portrait:'/art/avatars/felix_sail_neutral.png' }
]);
const GOODS=Object.freeze(['fish','timber','spice','silk']);
const TIDES=Object.freeze(['Blue','Green','Silver']);
const MODES=Object.freeze({quick:{rounds:8,winAt:10,planSeconds:60},standard:{rounds:12,winAt:15,planSeconds:90},advanced:{rounds:12,winAt:15,planSeconds:90}});
const randomInt=max=>crypto.randomInt(max);
function shuffle(values){const a=[...values]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];} return a;}
module.exports={CAPTAINS,GOODS,TIDES,MODES,shuffle,randomInt};
