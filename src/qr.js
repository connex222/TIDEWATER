'use strict';
// Minimal self-contained ISO/IEC 18004 QR encoder: Version 5, error correction L,
// 8-bit data mode, 108 data + 26 ECC codewords. No runtime libraries or CDNs.
const N=37, DATA_LENGTH=108, ECC_LENGTH=26;
function mul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z;}
function ecc(data){
  const d=new Array(ECC_LENGTH).fill(0);d[ECC_LENGTH-1]=1;let root=1;
  for(let i=0;i<ECC_LENGTH;i++){for(let j=0;j<ECC_LENGTH;j++){d[j]=mul(d[j],root);if(j+1<ECC_LENGTH)d[j]^=d[j+1];}root=mul(root,2);}
  const result=new Array(ECC_LENGTH).fill(0);
  for(const b of data){let f=b^result.shift();result.push(0);for(let i=0;i<ECC_LENGTH;i++)result[i]^=mul(d[i],f);}
  return result;
}
function matrix(text){
  const bytes=Buffer.from(text,'utf8');if(bytes.length>106)throw new Error('QR payload too long');
  const bits=[];function append(x,n){for(let i=n-1;i>=0;i--)bits.push((x>>>i)&1);}
  append(4,4);append(bytes.length,8);for(const b of bytes)append(b,8);
  append(0,Math.min(4,DATA_LENGTH*8-bits.length));while(bits.length%8)append(0,1);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
  for(let i=0;data.length<DATA_LENGTH;i++)data.push(i%2?0x11:0xec);
  const payload=[...data,...ecc(data)];const modules=Array.from({length:N},()=>Array(N).fill(false));
  const reserved=Array.from({length:N},()=>Array(N).fill(false));
  function set(x,y,dark){if(x>=0&&x<N&&y>=0&&y<N){modules[y][x]=!!dark;reserved[y][x]=true;}}
  for(const [cx,cy] of [[3,3],[N-4,3],[3,N-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const radius=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,radius!==2&&radius!==4);
  }
  for(let i=8;i<N-8;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  // Reserve format information (also filled with the calculated BCH checksum).
  const format=(1<<3)|0;let rem=format;for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>>9)&1)*0x537);
  const fmt=((format<<10)|rem)^0x5412;const bit=i=>((fmt>>>i)&1)!==0;
  for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));
  for(let i=9;i<15;i++)set(14-i,8,bit(i));for(let i=0;i<8;i++)set(N-1-i,8,bit(i));
  for(let i=8;i<15;i++)set(8,N-15+i,bit(i));set(8,N-8,true);
  const stream=[];for(const b of payload)for(let j=7;j>=0;j--)stream.push((b>>>j)&1);
  let index=0;
  for(let right=N-1;right>=1;right-=2){if(right===6)right=5;
    for(let vert=0;vert<N;vert++){
      const y=((right+1)&2)===0?N-1-vert:vert;
      for(let j=0;j<2;j++){const x=right-j;
        if(!reserved[y][x]){const value=(index<stream.length?stream[index]:0)===1;index++;modules[y][x]=value!==((x+y)%2===0);}
      }
    }
  }
  return modules;
}
function qrSvg(text){const m=matrix(text);let shapes='';
  for(let y=0;y<N;y++){let x=0;while(x<N){if(!m[y][x]){x++;continue;}let end=x+1;while(end<N&&m[y][end])end++;shapes+=`<rect x="${x+4}" y="${y+4}" width="${end-x}" height="1"/>`;x=end;}}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" role="img" aria-label="QR code to join Tidewater"><rect width="45" height="45" fill="#fff"/><g fill="#162936">${shapes}</g></svg>`;
}
module.exports={matrix,qrSvg};
