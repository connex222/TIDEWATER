'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {matrix,qrSvg}=require('../src/qr');
test('QR encoder produces version 5 symbol of expected size',()=>{
 const rows=matrix('https://tidewater.example/phone.html?room=ABCD');assert.equal(rows.length,37);
 assert.ok(rows.every(r=>r.length===37));assert.equal(rows[3][3],true);
 assert.equal(rows[33][33],false); // centre is not a finder at bottom-right
 const svg=qrSvg('http://localhost:3000/phone.html?room=ABCD');assert.match(svg,/viewBox="0 0 45 45"/);
 assert.ok(svg.includes('<rect'));
});
test('QR encoder rejects overlong URLs rather than generating corrupted QR',()=>assert.throws(()=>matrix('x'.repeat(107)),/too long/));
