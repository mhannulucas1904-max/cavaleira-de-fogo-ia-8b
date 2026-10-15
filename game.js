(()=>{
'use strict';
/* ====================== CONSTANTES ====================== */
const TILE=40,ROWS=12,VW=800,VH=480,GROUND=10,GY=GROUND*TILE;
const cv=document.getElementById('game'),ctx=cv.getContext('2d');
cv.width=VW;cv.height=VH;ctx.imageSmoothingEnabled=false;
const FONT='"Press Start 2P", ui-monospace, Menlo, Consolas, monospace';
const GRAV=.55,MAXFALL=13,ACC=.5,FRIC=.8,MAXV=4.2,JUMPV=-13;

/* ====================== UTILITÁRIOS ====================== */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(n){n=Math.imul(n|0,0x9E3779B1);n^=n>>>15;n=Math.imul(n,0x85EBCA77);n^=n>>>13;n=Math.imul(n,0xC2B2AE3D);n^=n>>>16;return(n>>>0)/4294967296}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function circ(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,6.2832);ctx.fill()}
function ell(x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,6.2832);ctx.fill()}
function tri(a,b,c,d,e,f){ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.lineTo(e,f);ctx.closePath();ctx.fill()}
function txt(s,x,y,size,col,align,shadow){
  ctx.font=size+'px '+FONT;ctx.textAlign=align||'left';ctx.textBaseline='middle';
  if(shadow!==false){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillText(s,x+2,y+2)}
  ctx.fillStyle=col;ctx.fillText(s,x,y);
}
function grad(stops){const g=ctx.createLinearGradient(0,0,0,GY);stops.forEach(([p,c])=>g.addColorStop(p,c));ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH)}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}

/* ====================== ÁUDIO ====================== */
let AC=null,muted=false;
function initAudio(){
  if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){AC=null}}
  if(AC&&AC.state==='suspended')AC.resume();
}
function tone(f0,f1,dur,type,vol,delay){
  if(!AC||muted)return;
  const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'square';o.frequency.setValueAtTime(f0,t);
  if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+.03);
}
const SFX={
  jump:()=>tone(280,640,.16,'square',.04),
  fire:()=>tone(900,240,.18,'sawtooth',.035),
  coin:()=>{tone(988,988,.07,'square',.04);tone(1319,1319,.2,'square',.04,.07)},
  stomp:()=>tone(220,60,.15,'square',.06),
  kill:()=>tone(520,90,.22,'sawtooth',.045),
  hurt:()=>tone(260,70,.35,'sawtooth',.06),
  bump:()=>tone(160,100,.08,'square',.05),
  heart:()=>[523,659,784].forEach((f,i)=>tone(f,f,.12,'triangle',.06,i*.08)),
  boss:()=>tone(120,50,.4,'sawtooth',.06),
  clear:()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,f,.18,'square',.045,i*.12)),
  over:()=>[392,330,262,196].forEach((f,i)=>tone(f,f*.97,.3,'triangle',.07,i*.22))
};
function sfx(n){if(AC&&!muted)SFX[n]()}
const MUSIC=[
  {root:196,step:.22,wave:'triangle',vol:.05,notes:[0,3,7,3,10,7,3,0,-2,2,5,2,8,5,2,-2],bass:[-12,-12,-14,-14]},
  {root:220,step:.2,wave:'triangle',vol:.05,notes:[0,4,7,12,7,4,0,4,2,5,9,14,9,5,2,5],bass:[-12,-8,-10,-12]},
  {root:110,step:.28,wave:'sawtooth',vol:.022,notes:[0,null,0,3,0,null,7,5,0,null,0,3,0,null,10,8],bass:[-12,-12,-9,-12]},
  {root:262,step:.17,wave:'square',vol:.022,notes:[0,4,7,9,7,4,0,-3,0,4,7,9,12,9,7,4],bass:[-12,-12,-8,-10]},
  {root:220,step:.125,wave:'square',vol:.02,notes:[0,7,12,7,3,10,15,10,0,7,12,7,5,12,17,12],bass:[-24,-24,-21,-19]}
];
let musicTimer=null,mStep=0;
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null}}
function startMusic(i){
  stopMusic();const m=MUSIC[i];mStep=0;
  musicTimer=setInterval(()=>{
    if(!AC||muted||state!=='play')return;
    const n=m.notes[mStep%m.notes.length];
    if(n!==null){const f=m.root*Math.pow(2,n/12);tone(f,f,m.step*.9,m.wave,m.vol)}
    if(mStep%4===0){const b=m.bass[((mStep/4)|0)%m.bass.length],f=m.root*Math.pow(2,b/12);tone(f,f,m.step*3.6,'triangle',.06)}
    mStep++;
  },m.step*1000);
}

/* ====================== SPRITES (pixel art) ====================== */
function sprite(rows,pal,s){
  const h=rows.length,w=rows[0].length,c=document.createElement('canvas');c.width=w*s;c.height=h*s;
  const g=c.getContext('2d');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=rows[y][x];if(ch!=='.'){g.fillStyle=pal[ch];g.fillRect(x*s,y*s,s,s)}}
  return c;
}
function flipped(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const g=f.getContext('2d');g.translate(c.width,0);g.scale(-1,1);g.drawImage(c,0,0);return f}

const KP={S:'#d9e0ea',s:'#8a96a8',R:'#e0343c',K:'#f6cfa3',B:'#c4561f',G:'#f4c430',P:'#7a3fc0',D:'#2b2540',E:'#1d1830'};
const KT=[
"....RR......",
"...RRR......",
"...SSSSS....",
"..SSSSSSs...",
"..BSKKEKs...",
"..BSKKKKs...",
"..BBSSSs....",
"..BBsSSSss..",
"..BsPPGPPSS.",
"...sPPPPPSs.",
"...PPPPPPP..",
"..PPPPPPPPP."];
const KL0=["...SS..SS...","...SS..SS...","...DD..DD...","..DDD..DDD.."];
const KL1=["....SSSS....","....SSSS....","....DDDD....","...DDDDDD..."];
const knightR=[sprite(KT.concat(KL0),KP,3),sprite(KT.concat(KL1),KP,3)];
const knightL=knightR.map(flipped);

const GT=[
"g..........g",
"gg.gggggg.gg",
".gggggggggg.",
".gYdggggYdg.",
".gggggggggg.",
"..gWgWWgWg..",
"..NNNNNNNN..",
".gNNNNNNNNg.",
".gNNNNNNNNg.",
"..NNNNNNNN.."];
const GL0=["..dd....dd..",".ddd....ddd."];
const GL1=["...dd..dd...","...ddd.ddd.."];
let gobS=[],bossS=[];
function buildGoblinSprites(cloth){
  const pal={g:'#5bbd3c',d:'#2f6b24',Y:'#ffe14d',W:'#ffffff',N:cloth};
  gobS=[sprite(GT.concat(GL0),pal,3),sprite(GT.concat(GL1),pal,3)];
  const bp={g:'#4aa032',d:'#24521c',Y:'#ff5a3d',W:'#ffffff',N:'#22223b'};
  bossS=[sprite(GT.concat(GL0),bp,6),sprite(GT.concat(GL1),bp,6)];
}
const HEART=[".xx.xx.","xxxxxxx","xxxxxxx",".xxxxx.","..xxx..","...x..."];
function drawHeart(x,y,full){
  for(let r=0;r<HEART.length;r++)for(let c=0;c<7;c++)if(HEART[r][c]==='x'){
    ctx.fillStyle=full?'#ff3b55':'rgba(0,0,0,.45)';ctx.fillRect(x+c*3,y+r*3,3,3);
  }
  if(full){ctx.fillStyle='#ffb3bf';ctx.fillRect(x+3,y+3,3,3)}
}
function hat(x,y,kind){
  switch(kind){
    case 'cap':ctx.fillStyle='#6b4a2b';ctx.fillRect(x+8,y-2,20,7);ctx.fillStyle='#4a3119';ctx.fillRect(x+6,y+4,24,3);break;
    case 'feather':ctx.fillStyle='#8c2f39';ctx.fillRect(x+8,y-3,20,8);ctx.fillRect(x+5,y+4,26,3);ctx.fillStyle='#fff';ctx.fillRect(x+24,y-11,3,9);ctx.fillRect(x+27,y-13,3,6);break;
    case 'top':ctx.fillStyle='#17171c';ctx.fillRect(x+10,y-12,16,14);ctx.fillRect(x+6,y+2,24,4);ctx.fillStyle='#c7873a';ctx.fillRect(x+10,y-1,16,3);break;
    case 'cap2':ctx.fillStyle='#d9594c';ctx.fillRect(x+9,y-3,18,8);ctx.fillStyle='#8e2f27';ctx.fillRect(x+24,y+3,12,3);break;
    case 'phones':ctx.fillStyle='#15151f';ctx.fillRect(x+8,y-4,20,3);ctx.fillRect(x+6,y-2,3,10);ctx.fillRect(x+27,y-2,3,10);ctx.fillStyle='#ff3ea5';ctx.fillRect(x+3,y+5,6,10);ctx.fillRect(x+27,y+5,6,10);break;
  }
}

/* ====================== TEMAS / ERAS ====================== */
const THEMES=[
 {name:'Idade Média',sub:'Século XII — O reino das muralhas',top:'grass',gTop:'#58b947',gTop2:'#2f8a35',gFill:'#7b5a3a',gLine:'#5a4128',brick:'#9ca7b3',brickLine:'#5f6a77',hard:'#a9783f',hardLine:'#6b4623',cloth:'#6b4a2b',hat:'cap'},
 {name:'Renascimento',sub:'Século XV — Cúpulas, moinhos e arte',top:'cobble',gTop:'#e2a566',gTop2:'#b97b3f',gFill:'#c98e57',gLine:'#9a6234',brick:'#e8d5b0',brickLine:'#b79c6b',hard:'#f0e6d0',hardLine:'#b6a47c',cloth:'#8c2f39',hat:'feather'},
 {name:'Revolução Industrial',sub:'Século XIX — Fumaça, vapor e ferro',top:'iron',gTop:'#6d6d73',gTop2:'#3d3d42',gFill:'#4a3a33',gLine:'#2d2320',brick:'#9c4a3a',brickLine:'#5b2a21',hard:'#5b6068',hardLine:'#2e3238',cloth:'#4a4f57',hat:'top'},
 {name:'Anos 1950',sub:'Século XX — Neon, lanchonetes e carros',top:'asphalt',gTop:'#3a3d4a',gTop2:'#23252e',gFill:'#8a8d99',gLine:'#62656f',brick:'#d9594c',brickLine:'#8e2f27',hard:'#e8c14a',hardLine:'#2a2a2a',cloth:'#2f6fc4',hat:'cap2'},
 {name:'Mundo Moderno',sub:'Século XXI — Arranha-céus e drones',top:'neon',gTop:'#22e6ff',gTop2:'#0a8aa3',gFill:'#1b2142',gLine:'#2b3470',brick:'#2a3366',brickLine:'#00e5ff',hard:'#2b2f55',hardLine:'#ff3ea5',cloth:'#e0409a',hat:'phones'}
];
let TH=THEMES[0];

/* ====================== TILES ====================== */
let tileCache={};
function tileImg(t,par){
  const k=t*2+par;
  if(!tileCache[k]){const c=document.createElement('canvas');c.width=c.height=TILE;renderTile(c.getContext('2d'),t,par);tileCache[k]=c}
  return tileCache[k];
}
function renderTile(g,t,par){
  const th=TH;
  if(t===1||t===2){
    g.fillStyle=th.gFill;g.fillRect(0,0,40,40);
    g.fillStyle=th.gLine;g.fillRect(0,19,40,2);
    g.fillRect(par?10:30,0,2,19);g.fillRect(par?30:10,21,2,19);
    if(t===1){
      switch(th.top){
        case 'grass':g.fillStyle=th.gTop;g.fillRect(0,0,40,10);g.fillStyle=th.gTop2;g.fillRect(0,9,40,3);g.fillStyle=th.gTop;for(let k=0;k<5;k++)g.fillRect(k*8+(par?2:5),10,4,4);break;
        case 'cobble':g.fillStyle=th.gTop;g.fillRect(0,0,40,9);g.fillStyle=th.gTop2;for(let k=0;k<4;k++)g.fillRect(k*10+(par?3:7),0,2,9);g.fillRect(0,8,40,2);break;
        case 'iron':g.fillStyle=th.gTop;g.fillRect(0,0,40,9);g.fillStyle=th.gTop2;g.fillRect(0,8,40,3);g.fillRect(5,3,3,3);g.fillRect(32,3,3,3);break;
        case 'asphalt':g.fillStyle=th.gTop;g.fillRect(0,0,40,9);g.fillStyle=th.gTop2;g.fillRect(0,8,40,2);if(par){g.fillStyle='#f2c230';g.fillRect(8,3,24,2)}break;
        case 'neon':g.fillStyle=th.gTop;g.fillRect(0,0,40,3);g.fillStyle='rgba(34,230,255,.28)';g.fillRect(0,3,40,7);g.fillStyle=th.gTop2;g.fillRect(0,10,40,2);break;
      }
    }
    return;
  }
  if(t===3){
    g.fillStyle=th.brick;g.fillRect(0,0,40,40);g.fillStyle=th.brickLine;
    g.fillRect(0,12,40,2);g.fillRect(0,26,40,2);
    g.fillRect(20,0,2,12);g.fillRect(10,14,2,12);g.fillRect(30,14,2,12);g.fillRect(20,28,2,12);
    g.strokeStyle=th.brickLine;g.lineWidth=2;g.strokeRect(1,1,38,38);
    return;
  }
  if(t===4){
    g.fillStyle='#f5b82e';g.fillRect(0,0,40,40);
    g.fillStyle='#ffe08a';g.fillRect(2,2,36,4);g.fillRect(2,2,4,36);
    g.fillStyle='#b9770e';g.fillRect(2,34,36,4);g.fillRect(34,2,4,36);
    g.fillStyle='#7a4b00';[[5,5],[31,5],[5,31],[31,31]].forEach(([a,b])=>g.fillRect(a,b,4,4));
    g.font='bold 24px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('?',20,22);
    return;
  }
  if(t===5){
    g.fillStyle='#7b6a5a';g.fillRect(0,0,40,40);g.fillStyle='#5a4b3e';g.fillRect(0,0,40,3);g.fillRect(0,0,3,40);g.fillRect(0,37,40,3);g.fillRect(37,0,3,40);
    g.fillStyle='#4a3d32';[[5,5],[31,5],[5,31],[31,31]].forEach(([a,b])=>g.fillRect(a,b,4,4));
    return;
  }
  if(t===6){
    g.fillStyle=th.hard;g.fillRect(0,0,40,40);g.strokeStyle=th.hardLine;g.lineWidth=3;g.strokeRect(2,2,36,36);
    g.lineWidth=2;g.beginPath();g.moveTo(4,4);g.lineTo(36,36);g.moveTo(36,4);g.lineTo(4,36);g.stroke();
  }
}

/* ====================== FUNDOS (parallax por era) ====================== */
let bgI=0;
const cam={x:0};
let tick=0;
function layer(f,s,cb){
  const off=Math.round(cam.x*f),i0=Math.floor(off/s)-1,i1=Math.floor((off+VW)/s)+1;
  for(let i=i0;i<=i1;i++)cb(i*s-off,i,hash(i*37+bgI*1013+((f*100)|0)*7));
}
function cloud(x,y,s,a){ctx.fillStyle='rgba(255,255,255,'+a+')';[[0,0,26],[24,-8,22],[48,0,26],[24,6,24]].forEach(([dx,dy,r])=>circ(x+dx*s,y+dy*s,r*s))}
function bldg(x,b,w,h,col,win,seed,rate){
  ctx.fillStyle=col;ctx.fillRect(x,b-h,w,h);ctx.fillStyle=win;
  for(let yy=10;yy<h-12;yy+=16)for(let xx=7;xx<w-9;xx+=14){
    if(hash(seed*97+xx*3+yy*11)<rate)ctx.fillRect(x+xx,b-h+yy,7,9);
  }
}
/* --- 0: Idade Média --- */
function castle(x,b,s,col,roof){
  ctx.save();ctx.translate(x,b);ctx.scale(s,s);
  ctx.fillStyle=col;ctx.fillRect(-70,-80,140,80);
  for(let k=0;k<7;k++)ctx.fillRect(-70+k*20,-92,12,12);
  [-86,54].forEach(tx=>{ctx.fillStyle=col;ctx.fillRect(tx,-130,32,130);for(let k=0;k<3;k++)ctx.fillRect(tx+k*11-1,-140,8,10);ctx.fillStyle=roof;tri(tx-6,-140,tx+16,-185,tx+38,-140)});
  ctx.fillStyle=col;ctx.fillRect(-24,-130,48,52);ctx.fillStyle=roof;tri(-30,-130,0,-182,30,-130);
  ctx.fillStyle='#2f2a40';ctx.beginPath();ctx.arc(0,-22,15,Math.PI,0);ctx.lineTo(15,0);ctx.lineTo(-15,0);ctx.fill();
  ctx.fillRect(-4,-112,8,16);ctx.fillRect(-76,-112,8,16);ctx.fillRect(68,-112,8,16);
  ctx.fillStyle='#8b1f2a';ctx.fillRect(-1,-182,2,-26);ctx.fillRect(1,-206,18,10);
  ctx.restore();
}
function pine(x,b,h){
  ctx.fillStyle='#5a3d22';ctx.fillRect(x-2,b-8,4,8);ctx.fillStyle='#2f6b3a';
  tri(x-14,b-8,x,b-h*.55,x+14,b-8);tri(x-11,b-h*.4,x,b-h*.8,x+11,b-h*.4);tri(x-8,b-h*.65,x,b-h,x+8,b-h*.65);
}
function bg0(){
  grad([[0,'#5aa9f0'],[1,'#d3ebff']]);
  ctx.fillStyle='rgba(255,240,150,.35)';circ(660,90,54);ctx.fillStyle='#fff3a0';circ(660,90,34);
  layer(.06,300,(x,i,r)=>cloud(x,40+r*90,1+r*.6,.9));
  layer(.14,340,(x,i,r)=>{const ph=110+r*90;ctx.fillStyle='#8fb0d6';tri(x-40,GY,x+120,GY-ph,x+280,GY);ctx.fillStyle='#fff';tri(x+80,GY-ph*.75,x+120,GY-ph,x+160,GY-ph*.75)});
  layer(.32,560,(x,i,r)=>{if(r>.3)castle(x+120,GY,.85+hash(i+5)*.4,'#8d98a8','#b3453c')});
  layer(.55,260,(x,i,r)=>{
    const cx=x+130,rx=150,ry=55+r*30;ctx.fillStyle='#4f9a45';ell(cx,GY+30,rx,ry);
    for(let k=0;k<3;k++){const px=cx-70+k*70+hash(i*7+k)*20,hy=GY+30-ry*Math.sqrt(Math.max(0,1-Math.pow((px-cx)/rx,2)));pine(px,hy+4,44+hash(i*3+k)*20)}
  });
}
/* --- 1: Renascimento --- */
const TOWNC=['#f0d9a8','#e6c28a','#f4e2c0','#d9ad78'];
function town(x,i,r){
  for(let k=0;k<4;k++){
    const q=hash(i*17+k*5+3),bx=x+k*100,w=64+q*26,h=64+hash(i*7+k)*56;
    ctx.fillStyle=TOWNC[(((i*3+k)%4)+4)%4];ctx.fillRect(bx,GY-h,w,h);
    ctx.fillStyle='#b5482f';tri(bx-6,GY-h,bx+w/2,GY-h-26,bx+w+6,GY-h);
    ctx.fillStyle='#6b4a3a';
    for(let wx=bx+10;wx<bx+w-10;wx+=18){ctx.fillRect(wx,GY-h+16,8,14);ctx.fillRect(wx,GY-h+40,8,14)}
  }
  if(r>.5){
    const bx=x+40;ctx.fillStyle='#f4e2c0';ctx.fillRect(bx-10,GY-120,90,120);
    ctx.fillStyle='#c1503a';ctx.beginPath();ctx.ellipse(bx+35,GY-120,44,46,0,Math.PI,0);ctx.fill();
    ctx.fillStyle='#f4e2c0';ctx.fillRect(bx+31,GY-176,8,12);ctx.fillStyle='#d4a017';circ(bx+35,GY-180,5);
    ctx.fillStyle='#6b4a3a';ctx.fillRect(bx+20,GY-100,10,24);ctx.fillRect(bx+40,GY-100,10,24);
  }else{
    const bx=x+210;ctx.fillStyle='#ecd2a0';ctx.fillRect(bx,GY-170,28,170);
    ctx.fillStyle='#b5482f';tri(bx-4,GY-170,bx+14,GY-205,bx+32,GY-170);ctx.fillStyle='#6b4a3a';ctx.fillRect(bx+9,GY-150,10,18);ctx.fillRect(bx+9,GY-110,10,18);
  }
}
function windmill(x,b,s){
  ctx.save();ctx.translate(x,b);ctx.scale(s,s);
  ctx.fillStyle='#e9dcc3';ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-11,-70);ctx.lineTo(11,-70);ctx.lineTo(18,0);ctx.fill();
  ctx.fillStyle='#a8452f';tri(-15,-70,0,-88,15,-70);
  ctx.translate(0,-66);ctx.rotate(tick*.02);ctx.strokeStyle='#6b4a2b';ctx.lineWidth=3;
  for(let k=0;k<4;k++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-48);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(2,-46,12,30)}
  ctx.restore();
}
function cypress(x,b,h){ctx.fillStyle='#2f5a3a';ell(x,b-h/2,9,h/2);ctx.fillStyle='#4a3119';ctx.fillRect(x-1,b-6,3,6)}
function bg1(){
  grad([[0,'#f6a96a'],[.55,'#ffd8a0'],[1,'#fff0cf']]);
  ctx.fillStyle='rgba(255,255,230,.5)';circ(640,110,60);ctx.fillStyle='#fff7c9';circ(640,110,38);
  layer(.06,320,(x,i,r)=>cloud(x,50+r*80,1+r*.5,.75));
  layer(.14,400,(x,i,r)=>{ctx.fillStyle='#d9a56e';ell(x+200,GY+40,230,60+r*40)});
  layer(.3,440,(x,i,r)=>town(x,i,r));
  layer(.5,760,(x,i,r)=>{if(r>.3)windmill(x+100,GY-4,.9+r*.3)});
  layer(.7,170,(x,i,r)=>cypress(x+30+r*60,GY,60+r*40));
}
/* --- 2: Revolução Industrial --- */
function factory(x,b,s,col,i,lit){
  const w=170*s,h=64*s;
  ctx.fillStyle=col;ctx.fillRect(x,b-h,w,h);
  for(let k=0;k<4;k++)tri(x+k*w/4,b-h,x+k*w/4,b-h-18*s,x+(k+1)*w/4,b-h);
  const c1=x+w*.2,c2=x+w*.7,ch=[100+hash(i)*50,80+hash(i+9)*50];
  ctx.fillRect(c1,b-h-ch[0]*s,14*s,ch[0]*s);ctx.fillRect(c2,b-h-ch[1]*s,14*s,ch[1]*s);
  [[c1,ch[0]],[c2,ch[1]]].forEach(([cx,hh],n)=>{
    for(let k=0;k<4;k++){const age=(tick*.5+k*28+n*14+i*11)%112;ctx.fillStyle='rgba(90,84,76,'+(.55*(1-age/112))+')';circ(cx+7*s+age*.25,b-h-hh*s-age,7+age*.22)}
  });
  if(lit){ctx.fillStyle='#ffd27a';for(let wx=x+12;wx<x+w-14;wx+=24)ctx.fillRect(wx,b-h+14,10,12*s)}
}
function train(){
  const x=((tick*1.5)%(VW+560))-470,y=GY-2;
  for(let k=0;k<3;k++){ctx.fillStyle=k%2?'#5a2f22':'#3d2a24';ctx.fillRect(x+k*62,y-30,56,26)}
  ctx.fillStyle='#18171a';ctx.fillRect(x+190,y-30,70,28);ctx.fillRect(x+196,y-46,26,18);ctx.fillRect(x+246,y-50,10,22);
  ctx.fillStyle='#e0b050';ctx.fillRect(x+196,y-40,26,4);
  ctx.fillStyle='#0c0c0e';[10,40,70,100,130,160,205,225,245].forEach(o=>circ(x+o+8,y-4,6));
  for(let k=0;k<4;k++){const age=(tick*.8+k*20)%80;ctx.fillStyle='rgba(230,225,215,'+(.5*(1-age/80))+')';circ(x+251-age*.9,y-54-age*.8,6+age*.15)}
}
function lamp(x){ctx.fillStyle='#2a2a2e';ctx.fillRect(x,GY-110,4,110);ctx.fillRect(x-6,GY-124,16,16);ctx.fillStyle='rgba(255,220,120,.22)';circ(x+2,GY-116,34);ctx.fillStyle='#f6d36b';ctx.fillRect(x-3,GY-121,10,10)}
function bg2(){
  grad([[0,'#6f6a63'],[.6,'#b8a98c'],[1,'#d9c9a3']]);
  ctx.fillStyle='rgba(255,230,170,.35)';circ(600,120,64);
  layer(.15,420,(x,i)=>factory(x,GY,.8,'#5c5750',i,false));
  layer(.35,520,(x,i)=>factory(x+30,GY,1.05,'#3f3a36',i,true));
  train();
  layer(.65,230,(x)=>lamp(x));
}
/* --- 3: Anos 1950 --- */
function billboard(x,b){
  ctx.fillStyle='#24142c';ctx.fillRect(x+20,b-70,6,70);ctx.fillRect(x+110,b-70,6,70);
  ctx.fillStyle='#ffefc9';ctx.fillRect(x,b-150,136,76);ctx.fillStyle='#d9594c';ctx.fillRect(x+4,b-146,128,5);ctx.fillRect(x+4,b-82,128,5);
  ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('LANCHES',x+68,b-120);
  ctx.font='bold 12px sans-serif';ctx.fillStyle='#3f2057';ctx.fillText('ABERTO 24H',x+68,b-98);
}
function wtower(x,b){ctx.fillStyle='#2a1736';ctx.fillRect(x,b-140,44,34);tri(x-3,b-140,x+22,b-162,x+47,b-140);ctx.fillRect(x+4,b-106,3,106);ctx.fillRect(x+37,b-106,3,106)}
function car(x,y,col){
  ctx.fillStyle=col;ctx.fillRect(x,y-14,58,10);ctx.fillRect(x+12,y-24,30,12);
  ctx.fillStyle='#cfeeff';ctx.fillRect(x+15,y-22,11,8);ctx.fillRect(x+29,y-22,10,8);
  ctx.fillStyle='#111';circ(x+13,y-4,6);circ(x+45,y-4,6);ctx.fillStyle='#ccc';circ(x+13,y-4,2.5);circ(x+45,y-4,2.5);
}
function pole(x){
  ctx.fillStyle='#1b1020';ctx.fillRect(x,GY-150,5,150);ctx.fillRect(x-16,GY-140,37,4);
  ctx.strokeStyle='#1b1020';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-14,GY-138);ctx.quadraticCurveTo(x+170,GY-100,x+326,GY-138);ctx.stroke();
}
function bg3(){
  grad([[0,'#2d1b5a'],[.4,'#b83f7c'],[.75,'#ff8a5c'],[1,'#ffd08a']]);
  ctx.fillStyle='#ffe3a1';circ(560,310,74);
  ctx.fillStyle='rgba(255,138,92,.85)';for(let k=0;k<5;k++)ctx.fillRect(480,300+k*14,160,3+k);
  layer(.12,300,(x,i)=>{for(let k=0;k<3;k++)bldg(x+k*100,GY,72,80+hash(i*5+k)*100,'#6a2f6e','rgba(255,200,130,.5)',i*3+k,.25)});
  layer(.3,400,(x,i)=>{for(let k=0;k<3;k++)bldg(x+k*130,GY,96,70+hash(i*11+k+2)*90,'#3f2057','#ffd27a',i*7+k,.45)});
  layer(.45,1300,(x,i,r)=>{if(r>.4)wtower(x+40,GY)});
  layer(.5,900,(x,i,r)=>{if(r>.3)billboard(x+60,GY)});
  [[0,1.6,'#e8564a'],[300,1.1,'#3aa7d9'],[560,2.1,'#f2c230']].forEach(([o,sp,col])=>car(((tick*sp+o)%(VW+160))-100,GY-2,col));
  layer(.8,340,(x)=>pole(x));
}
/* --- 4: Mundo Moderno --- */
const NEON=['#00e5ff','#ff3ea5','#8cff5a','#ffd23e'];
function holo(x,b){
  ctx.fillStyle='#2a3070';ctx.fillRect(x+80,b-100,4,100);
  ctx.fillStyle='rgba(0,229,255,.14)';ctx.fillRect(x,b-190,170,70);
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;ctx.strokeRect(x,b-190,170,70);
  ctx.fillStyle='rgba(0,229,255,.1)';for(let k=0;k<70;k+=4)ctx.fillRect(x,b-190+k,170,1);
  ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ff3ea5';ctx.fillText('GOBLIN.COM',x+85+(Math.sin(tick*.1)>.95?3:0),b-155);
}
function drones(){
  for(let k=0;k<3;k++){
    const x=((tick*(.8+k*.45)+k*300)%(VW+100))-50,y=70+k*46+Math.sin(tick*.05+k)*6;
    ctx.fillStyle='#9fb0ff';ctx.fillRect(x-7,y,14,4);ctx.fillRect(x-11,y-3,8,2);ctx.fillRect(x+3,y-3,8,2);
    ctx.fillStyle=((tick/12|0)+k)%2?'#ff4040':'#40ff80';circ(x,y+6,2.5);
  }
}
function bg4(){
  grad([[0,'#050818'],[.55,'#1a1b5c'],[1,'#7a2f98']]);
  for(let i=0;i<70;i++){
    const sx=(((hash(i*3+1)*VW*1.4-cam.x*.03)%VW)+VW)%VW,sy=hash(i*3+2)*280,a=.35+.65*Math.abs(Math.sin(tick*.03+i));
    ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.fillRect(sx,sy,2,2);
  }
  ctx.fillStyle='#f4f1d8';circ(120,84,28);ctx.fillStyle='#d9d5b4';circ(110,76,6);circ(130,92,5);circ(124,72,3);
  layer(.1,300,(x,i)=>{for(let k=0;k<3;k++)bldg(x+k*100,GY,70,110+hash(i*5+k)*120,'#141a45','#6b7bd6',i*3+k,.18)});
  layer(.25,360,(x,i)=>{
    for(let k=0;k<2;k++){
      const hh=170+hash(i*7+k)*150,bx=x+k*170+20,nc=NEON[(((i+k)%4)+4)%4];
      bldg(bx,GY,100,hh,'#1d2260','#ffe9a0',i*5+k,.5);
      ctx.fillStyle=nc;ctx.fillRect(bx,GY-hh,100,3);ctx.globalAlpha=.18;ctx.fillRect(bx-3,GY-hh-6,106,14);ctx.globalAlpha=1;
      ctx.fillStyle='#3a4080';ctx.fillRect(bx+48,GY-hh-34,3,34);
      if(((tick/25)|0)%2){ctx.fillStyle='#ff4040';circ(bx+49.5,GY-hh-36,3)}
    }
  });
  layer(.5,820,(x,i,r)=>{if(r>.3)holo(x+60,GY)});
  drones();
  layer(.7,210,(x)=>{
    ctx.fillStyle='#1a1f4d';ctx.fillRect(x,GY-150,5,150);ctx.fillRect(x,GY-152,34,4);
    ctx.fillStyle='rgba(0,229,255,.18)';circ(x+30,GY-146,28);ctx.fillStyle='#bff8ff';circ(x+30,GY-148,5);
  });
}
const BG=[bg0,bg1,bg2,bg3,bg4];
function drawBg(i){bgI=i;BG[i]()}

/* ====================== ESTADO DO JOGO ====================== */
let state='title',LV=0,score=0,coinsN=0,best=0,scoreAtStart=0,coinsAtStart=0,bannerT=0,clearT=0,fade=0;
try{best=+localStorage.getItem('cavaleira_best')||0}catch(e){}
let L=null,P=null,fireballs=[],particles=[],popups=[],bumps={};
const inp={left:false,right:false,jump:false,fire:false};
const held={};let jumpQ=0,fireQ=0;
buildGoblinSprites(THEMES[0].cloth);

/* ====================== GERAÇÃO DE FASES ====================== */
function mkGoblin(cx,row,idx,rnd){
  return {x:cx*TILE+5,y:row*TILE-30,w:30,h:30,vx:0,vy:0,dir:rnd()<.5?-1:1,speed:.8+idx*.18,alive:true,squash:0,onGround:false,anim:0,hitWall:false};
}
function buildLevel(idx){
  const rnd=mulberry32(9001+idx*131),len=120+idx*15;
  const g=[];for(let i=0;i<len;i++)g.push(new Uint8Array(ROWS));
  const contents={},enemies=[],coins=[];
  const ground=c=>{g[c][GROUND]=1;g[c][GROUND+1]=2};
  let x=0;
  const flat=n=>{const s=x;for(let i=0;i<n&&x<len;i++)ground(x++);return s};
  const addE=(cx,row)=>enemies.push(mkGoblin(cx,row,idx,rnd));
  const dens=.45+idx*.1;
  flat(12);
  const endMain=len-34;
  let heartPlaced=false;
  while(x<endMain){
    const r=rnd();
    if(r<.25){
      const gw=2+(rnd()<.35+idx*.1?1:0);
      for(let k=0;k<3;k++)coins.push({x:(x+gw*(k+.5)/3)*TILE,y:GY-80-(k===1?30:0),got:false});
      x+=gw;flat(4+Math.floor(rnd()*3));
    }else if(r<.47){
      const n=9+Math.floor(rnd()*3),s=flat(n),pl=3+Math.floor(rnd()*3),px=s+2+Math.floor(rnd()*(n-pl-3));
      for(let i=0;i<pl;i++){
        const q=(i===1||(pl>3&&i===pl-2))&&rnd()<.85;
        g[px+i][7]=q?4:3;
        if(q)contents[(px+i)*100+7]=(!heartPlaced&&rnd()<.25)?(heartPlaced=true,'heart'):'coin';
        coins.push({x:(px+i)*TILE+20,y:6*TILE+14,got:false});
      }
      if(rnd()<.55)addE(px+1,7);
      if(rnd()<dens)addE(s+n-3,GROUND);
    }else if(r<.62){
      flat(2+Math.floor(rnd()*2));
      const h=1+Math.floor(rnd()*2),w=1+Math.floor(rnd()*2);
      for(let i=0;i<w;i++){ground(x);for(let k=1;k<=h;k++)g[x][GROUND-k]=6;x++}
      const s=flat(4+Math.floor(rnd()*2));
      if(rnd()<dens)addE(s+2,GROUND);
    }else if(r<.76){
      flat(2);const h=2+(rnd()<.5?1:0);
      for(let k=1;k<=h;k++){ground(x);for(let j=1;j<=k;j++)g[x][GROUND-j]=6;x++}
      ground(x);for(let j=1;j<=h;j++)g[x][GROUND-j]=6;x++;
      for(let k=h;k>=1;k--){ground(x);for(let j=1;j<=k;j++)g[x][GROUND-j]=6;x++}
      const s=flat(4);if(rnd()<dens)addE(s+1,GROUND);
    }else{
      const n=7+Math.floor(rnd()*4),s=flat(n);
      addE(s+2,GROUND);if(rnd()<dens+.2)addE(s+n-3,GROUND);
      const mid=s+(n>>1);g[mid][7]=4;contents[mid*100+7]='coin';
      for(let k=0;k<4;k++)coins.push({x:(s+1+k)*TILE+20,y:GY-24,got:false});
    }
  }
  flat(len-x);
  // checkpoints
  const cps=[];
  [.33,.66].forEach(f=>{
    let c=Math.floor(len*f),ok=false;
    while(c<len-30&&!ok){
      ok=g[c][GROUND]===1&&g[c-1][GROUND]===1&&g[c+1][GROUND]===1;
      for(let rr=0;rr<GROUND&&ok;rr++)if(g[c][rr]||g[c-1][rr]||g[c+1][rr])ok=false;
      if(!ok)c++;
    }
    cps.push({x:c*TILE,on:false});
  });
  let boss=null;
  if(idx===4){
    boss={x:(len-12)*TILE,y:GY-64,w:60,h:64,vx:0,vy:0,dir:-1,hp:10,max:10,alive:true,inv:0,onGround:false,jt:90,anim:0,active:false,hitWall:false,x0:(len-21)*TILE,x1:(len-8)*TILE};
  }
  return {grid:g,len,contents,enemies,coins,checkpoints:cps,boss,goalX:(len-5)*TILE};
}

/* ====================== FÍSICA ====================== */
function solid(tx,ty){
  if(tx<0||tx>=L.len)return true;
  if(ty<0||ty>=ROWS)return false;
  return L.grid[tx][ty]>0;
}
function moveX(e){
  e.x+=e.vx;e.hitWall=false;
  if(e.vx===0)return;
  const y0=Math.floor(e.y/TILE),y1=Math.floor((e.y+e.h-.01)/TILE);
  if(e.vx>0){
    const tx=Math.floor((e.x+e.w)/TILE);
    for(let ty=y0;ty<=y1;ty++)if(solid(tx,ty)){e.x=tx*TILE-e.w;e.vx=0;e.hitWall=true;return}
  }else{
    const tx=Math.floor(e.x/TILE);
    for(let ty=y0;ty<=y1;ty++)if(solid(tx,ty)){e.x=(tx+1)*TILE;e.vx=0;e.hitWall=true;return}
  }
}
function moveY(e){
  e.y+=e.vy;e.onGround=false;
  const x0=Math.floor(e.x/TILE),x1=Math.floor((e.x+e.w-.01)/TILE);
  if(e.vy>=0){
    const ty=Math.floor((e.y+e.h)/TILE);
    for(let tx=x0;tx<=x1;tx++)if(solid(tx,ty)){e.y=ty*TILE-e.h;e.vy=0;e.onGround=true;break}
  }else{
    const ty=Math.floor(e.y/TILE),cx=(e.x+e.w/2)/TILE;
    let bt=-1,bd=9;
    for(let tx=x0;tx<=x1;tx++)if(solid(tx,ty)){const d=Math.abs(tx+.5-cx);if(d<bd){bd=d;bt=tx}}
    if(bt>=0){e.y=(ty+1)*TILE;e.vy=0;if(e===P)bumpTile(bt,ty)}
  }
}
function burst(x,y,cols,n,spd,life){
  for(let i=0;i<n;i++){
    const a=Math.random()*6.283,s=(.4+Math.random())*spd;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:life*(.6+Math.random()*.6),max:life,col:cols[(Math.random()*cols.length)|0],size:2+Math.random()*3});
  }
  if(particles.length>500)particles.splice(0,particles.length-500);
}
function popup(x,y,text,col){popups.push({x,y,text,col:col||'#fff',life:55})}
const FIRE=['#ff3b1f','#ff8a1f','#ffd23e'];

function killEnemy(en,how){
  en.alive=false;
  if(how==='stomp'){en.squash=24;sfx('stomp')}
  else{en.squash=0;sfx('kill');burst(en.x+en.w/2,en.y+en.h/2,FIRE.concat(['#5bbd3c']),14,3,28)}
  score+=100;popup(en.x+en.w/2,en.y-8,'+100','#ffe14d');
}
function bumpTile(tx,ty){
  const t=L.grid[tx][ty];bumps[tx*100+ty]=10;
  if(t===4){
    L.grid[tx][ty]=5;
    const c=L.contents[tx*100+ty];
    if(c==='heart'&&P.hp<3){P.hp++;popup(tx*TILE+20,ty*TILE-6,'VIDA +1','#ff8fa3');sfx('heart')}
    else{coinsN++;score+=50;popup(tx*TILE+20,ty*TILE-6,'+50','#ffd23e');sfx('coin')}
    burst(tx*TILE+20,ty*TILE,['#ffd23e','#fff3a8'],8,2,24);
  }else sfx('bump');
  L.enemies.forEach(en=>{
    if(en.alive&&Math.abs(en.y+en.h-ty*TILE)<5&&en.x+en.w>tx*TILE&&en.x<(tx+1)*TILE)killEnemy(en,'bump');
  });
}

function respawn(){
  P.x=P.cpx;P.y=GY-P.h-2;P.vx=0;P.vy=0;P.inv=120;
  cam.x=clamp(P.x-VW*.4,0,L.len*TILE-VW);fade=.6;
}
function hurtPlayer(){
  if(P.inv>0)return;
  P.hp--;P.inv=100;sfx('hurt');
  burst(P.x+P.w/2,P.y+P.h/2,['#fff','#ff3b55'],10,3,24);
  if(P.hp<=0){gameOver();return}
  P.vy=-7;P.vx=-P.face*5;
}
function pitDeath(){
  P.hp--;sfx('hurt');
  if(P.hp<=0){gameOver();return}
  respawn();
}
function gameOver(){
  state='gameover';stopMusic();sfx('over');
  if(score>best){best=score;try{localStorage.setItem('cavaleira_best',String(best))}catch(e){}}
}
function levelClear(){
  state='clear';clearT=210;stopMusic();sfx('clear');
  const bonus=P.hp*300;score+=bonus;L.bonus=bonus;
  burst(L.goalX+20,GY-64,['#fff','#ffd23e','#8cff5a','#00e5ff','#ff3ea5'],40,5,50);
}
function winGame(){
  state='win';
  if(score>best){best=score;try{localStorage.setItem('cavaleira_best',String(best))}catch(e){}}
}
function loadLevel(idx){
  LV=idx;TH=THEMES[idx];L=buildLevel(idx);tileCache={};buildGoblinSprites(TH.cloth);
  P={x:2*TILE,y:GY-42,w:24,h:42,vx:0,vy:0,face:1,onGround:true,hp:3,inv:60,coyote:0,fireCd:0,shoot:0,anim:0,cpx:2*TILE,scale:1};
  fireballs=[];particles=[];popups=[];bumps={};cam.x=0;bannerT=170;fade=1;
  scoreAtStart=score;coinsAtStart=coinsN;state='play';startMusic(idx);
}
function newGame(){score=0;coinsN=0;loadLevel(0)}
function advance(){
  if(state==='title')newGame();
  else if(state==='gameover'){score=scoreAtStart;coinsN=coinsAtStart;loadLevel(LV)}
  else if(state==='win'){state='title';tick=0}
  else if(state==='paused')togglePause();
}
function togglePause(){
  if(state==='play'){state='paused'}
  else if(state==='paused'){state='play'}
  document.getElementById('btnPause').textContent=state==='paused'?'Continuar':'Pausar';
}
function toggleMute(){
  muted=!muted;document.getElementById('btnMute').textContent=muted?'Som: desligado':'Som: ligado';
}

/* ====================== ATUALIZAÇÃO ====================== */
function shoot(){
  P.fireCd=16;P.shoot=8;sfx('fire');
  fireballs.push({x:P.face>0?P.x+P.w+2:P.x-14,y:P.y+14,w:12,h:12,vx:6.5*P.face,vy:0,life:140,onGround:false,hitWall:false});
}
function updatePlayer(){
  const p=P;
  if(p.fireCd>0)p.fireCd--;if(p.inv>0)p.inv--;if(p.shoot>0)p.shoot--;
  let ax=0;if(inp.left)ax--;if(inp.right)ax++;
  if(ax){p.vx+=ax*ACC*(p.onGround?1:.8);p.face=ax}else p.vx*=p.onGround?FRIC:.95;
  p.vx=clamp(p.vx,-MAXV,MAXV);if(Math.abs(p.vx)<.05)p.vx=0;
  if(p.onGround)p.coyote=6;else if(p.coyote>0)p.coyote--;
  if(jumpQ>0){jumpQ--;if(p.coyote>0){p.vy=JUMPV;p.onGround=false;p.coyote=0;jumpQ=0;sfx('jump')}}
  if(!inp.jump&&p.vy<-4.5)p.vy=-4.5;
  if(fireQ>0)fireQ--;
  if((inp.fire||fireQ>0)&&p.fireCd<=0&&fireballs.length<3){shoot();fireQ=0}
  p.vy=Math.min(p.vy+GRAV,MAXFALL);
  moveX(p);moveY(p);
  if(p.onGround)p.anim+=Math.abs(p.vx)*.12;
  if(L.boss&&L.boss.alive)p.x=Math.min(p.x,L.goalX-60);
  // checkpoints
  L.checkpoints.forEach(c=>{if(!c.on&&p.x>c.x){c.on=true;p.cpx=c.x;popup(c.x+20,GY-80,'CHECKPOINT','#8cff5a');sfx('coin')}});
  // portal
  if(Math.abs(p.x+p.w/2-(L.goalX+20))<30&&!(L.boss&&L.boss.alive)){levelClear();return}
  if(p.y>VH+60)pitDeath();
}
function active(e){return Math.abs(e.x+e.w/2-(cam.x+VW/2))<VW*.85}
function updateEnemies(){
  const p=P;
  for(const en of L.enemies){
    if(!en.alive){en.squash--;continue}
    if(!active(en))continue;
    en.vx=en.dir*en.speed;en.vy=Math.min(en.vy+GRAV,MAXFALL);
    moveX(en);if(en.hitWall)en.dir*=-1;
    moveY(en);en.anim++;
    if(en.onGround){
      const ax=en.dir>0?en.x+en.w+2:en.x-2;
      if(!solid(Math.floor(ax/TILE),Math.floor((en.y+en.h+2)/TILE)))en.dir*=-1;
    }
    if(en.y>VH+100){en.alive=false;en.squash=0;continue}
    if(state==='play'&&hit(p,en)){
      if(p.vy>.5&&(p.y+p.h)-en.y<22){killEnemy(en,'stomp');p.vy=inp.jump?-11:-8;p.y=en.y-p.h}
      else hurtPlayer();
    }
  }
  L.enemies=L.enemies.filter(e=>e.alive||e.squash>0);
  const b=L.boss;
  if(b&&b.alive){
    if(!b.active&&Math.abs(b.x-p.x)<VW*.8)b.active=true;
    if(b.inv>0)b.inv--;
    if(b.active){
      const sp=1.3+(b.hp<=4?.9:0);
      if(b.x<=b.x0)b.dir=1;if(b.x>=b.x1)b.dir=-1;
      b.vx=b.dir*sp;b.vy=Math.min(b.vy+GRAV,MAXFALL);
      moveX(b);if(b.hitWall)b.dir*=-1;
      moveY(b);b.anim++;
      if(--b.jt<=0&&b.onGround){b.vy=-12;b.jt=80+Math.random()*80}
      if(state==='play'&&hit(p,b)){
        if(p.vy>.5&&(p.y+p.h)-b.y<26&&b.inv<=0){damageBoss(3);p.vy=-11;p.y=b.y-p.h}
        else hurtPlayer();
      }
    }
  }
}
function damageBoss(n){
  const b=L.boss;b.hp-=n;b.inv=n>1?50:10;sfx('boss');
  burst(b.x+b.w/2,b.y+b.h/2,FIRE,12,3,26);
  if(b.hp<=0){
    b.alive=false;score+=2000;sfx('clear');
    burst(b.x+b.w/2,b.y+b.h/2,FIRE.concat(['#fff','#5bbd3c']),80,6,60);
    popup(b.x+b.w/2,b.y-10,'+2000','#ffe14d');popup(L.goalX+20,GY-150,'PORTAL ABERTO!','#8cff5a');
  }
}
function updateFireballs(){
  for(const f of fireballs){
    f.vy=Math.min(f.vy+.45,10);
    moveX(f);if(f.hitWall){f.life=0;burst(f.x+6,f.y+6,FIRE,6,2,16);continue}
    moveY(f);if(f.onGround)f.vy=-6.2;
    f.life--;
    if(f.x<cam.x-60||f.x>cam.x+VW+60)f.life=0;
    if(f.life%2===0)particles.push({x:f.x+6,y:f.y+6,vx:(Math.random()-.5),vy:(Math.random()-.5),life:12,max:12,col:FIRE[(Math.random()*3)|0],size:3});
    for(const en of L.enemies){
      if(en.alive&&hit(f,en)){killEnemy(en,'fire');f.life=0;break}
    }
    const b=L.boss;
    if(f.life>0&&b&&b.alive&&b.active&&hit(f,b)){f.life=0;damageBoss(1)}
  }
  fireballs=fireballs.filter(f=>f.life>0);
}
function updateMisc(){
  for(const c of L.coins){
    if(!c.got&&Math.abs(c.x-(P.x+P.w/2))<24&&Math.abs(c.y-(P.y+P.h/2))<32){c.got=true;coinsN++;score+=50;sfx('coin');popup(c.x,c.y-12,'+50','#ffd23e')}
  }
  for(const k in bumps){if(--bumps[k]<=0)delete bumps[k]}
  for(const q of particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.15;q.life--}
  particles=particles.filter(q=>q.life>0);
  for(const q of popups){q.y-=.6;q.life--}
  popups=popups.filter(q=>q.life>0);
}
function updateCam(){
  const target=clamp(P.x+P.w/2-VW*.42+P.face*40,0,L.len*TILE-VW);
  cam.x+=(target-cam.x)*.1;
}
function update(){
  tick++;
  if(state==='title'){cam.x+=1.2;return}
  if(state==='paused')return;
  if(fade>0)fade=Math.max(0,fade-.025);
  if(state==='play'){
    if(bannerT>0)bannerT--;
    updatePlayer();
    if(state!=='play')return;
    updateEnemies();updateFireballs();updateMisc();updateCam();
  }else if(state==='clear'){
    clearT--;
    const px=L.goalX+20-P.w/2,py=GY-64-P.h/2;
    P.x+=(px-P.x)*.07;P.y+=(py-P.y)*.07;P.scale=Math.max(0,P.scale-.012);
    updateMisc();
    if(clearT<=0){if(LV<4)loadLevel(LV+1);else winGame()}
  }else if(state==='gameover'){
    updateMisc();
  }else if(state==='win'){
    if(tick%3===0)particles.push({x:cam.x+Math.random()*VW,y:-10,vx:(Math.random()-.5)*2,vy:1+Math.random()*2,life:140,max:140,col:NEON[(Math.random()*4)|0],size:4});
    updateMisc();
  }
}

/* ====================== DESENHO ====================== */
function drawPortal(){
  const x=L.goalX+20,y=GY-64,locked=L.boss&&L.boss.alive;
  ctx.save();ctx.translate(x,y);
  if(locked){
    ctx.fillStyle='rgba(60,60,75,.7)';ell(0,0,28,50);
    ctx.strokeStyle='#777';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,30,52,0,0,6.3);ctx.stroke();
    ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-26,-20);ctx.lineTo(26,20);ctx.moveTo(26,-20);ctx.lineTo(-26,20);ctx.stroke();
  }else{
    ctx.fillStyle='rgba(180,120,255,.25)';ell(0,0,42,64);
    for(let k=0;k<4;k++){
      const a0=tick*.06*(k%2?-1:1);
      ctx.strokeStyle='hsl('+((tick*4+k*70)%360)+',95%,'+(62-k*5)+'%)';ctx.lineWidth=4;
      ctx.beginPath();ctx.ellipse(0,0,28-k*6,50-k*10,0,a0,a0+4.4);ctx.stroke();
    }
    ctx.fillStyle='#fff';circ(0,0,4+Math.sin(tick*.2)*2);
  }
  ctx.restore();
}
function drawGoblin(en){
  const dx=Math.round(en.x+en.w/2-18),dy=Math.round(en.y+en.h-36);
  if(!en.alive){ctx.save();ctx.translate(dx,en.y+en.h);ctx.scale(1,.25);ctx.drawImage(gobS[0],0,-36);ctx.restore();return}
  ctx.drawImage(gobS[Math.floor(en.anim/8)%2],dx,dy);hat(dx,dy,TH.hat);
}
function drawBoss(b){
  const dx=Math.round(b.x+b.w/2-36),dy=Math.round(b.y+b.h-72);
  if(b.inv>0&&((tick/3)|0)%2)ctx.globalAlpha=.45;
  ctx.drawImage(bossS[Math.floor(b.anim/8)%2],dx,dy);
  ctx.fillStyle='#e0343c';ctx.fillRect(dx+33,dy+40,7,22);
  ctx.fillStyle='#f4c430';ctx.fillRect(dx+16,dy-2,40,12);tri(dx+16,dy-2,dx+22,dy-18,dx+28,dy-2);tri(dx+30,dy-2,dx+36,dy-22,dx+42,dy-2);tri(dx+44,dy-2,dx+50,dy-18,dx+56,dy-2);
  ctx.fillStyle='#e0343c';circ(dx+36,dy+4,3);
  ctx.globalAlpha=1;
}
function drawPlayer(){
  const p=P;
  if(p.inv>0&&((tick/4)|0)%2&&state==='play')return;
  const fr=p.onGround?(Math.abs(p.vx)>.3?Math.floor(p.anim)%2:0):1;
  const img=(p.face>0?knightR:knightL)[fr];
  const dx=Math.round(p.x-6),dy=Math.round(p.y+p.h-48);
  if(p.scale<1){ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.scale(p.scale,p.scale);ctx.rotate((1-p.scale)*8);ctx.drawImage(img,-18,-24);ctx.restore()}
  else ctx.drawImage(img,dx,dy);
  if(p.shoot>0){
    const hx=p.face>0?p.x+p.w+6:p.x-6,hy=p.y+19;
    ctx.fillStyle='rgba(255,170,40,.6)';circ(hx,hy,9);ctx.fillStyle='#ffe14d';circ(hx,hy,5);
  }
}
function drawFireball(f){
  const cx=f.x+6,cy=f.y+6,s=1+Math.sin(tick*.5)*.12;
  ctx.fillStyle='rgba(255,90,20,.35)';circ(cx,cy,12*s);
  ctx.fillStyle='#ff6a1f';circ(cx,cy,8*s);ctx.fillStyle='#ffc233';circ(cx,cy,5.5*s);ctx.fillStyle='#fff6c8';circ(cx,cy,2.5);
}
function drawWorld(){
  const c0=Math.max(0,Math.floor(cam.x/TILE)),c1=Math.min(L.len-1,c0+21);
  for(let c=c0;c<=c1;c++)for(let r=0;r<ROWS;r++){
    const t=L.grid[c][r];if(!t)continue;
    let y=r*TILE;const bp=bumps[c*100+r];if(bp)y-=Math.sin((1-bp/10)*Math.PI)*8;
    ctx.drawImage(tileImg(t,(c+r)&1),c*TILE,y);
  }
  L.checkpoints.forEach(cp=>{
    ctx.fillStyle='#aaa';ctx.fillRect(cp.x+18,GY-64,4,64);
    ctx.fillStyle=cp.on?'#8cff5a':'#e0343c';
    const w=Math.sin(tick*.15)*3;tri(cp.x+22,GY-64,cp.x+22,GY-44,cp.x+44+w,GY-54);
  });
  drawPortal();
  for(const c of L.coins){
    if(c.got||c.x<cam.x-20||c.x>cam.x+VW+20)continue;
    const w=Math.abs(Math.cos(tick*.08+c.x*.05))*7+1;
    ctx.fillStyle='#b9770e';ell(c.x,c.y,w+1.5,9.5);ctx.fillStyle='#ffd23e';ell(c.x,c.y,w,8);ctx.fillStyle='#fff3a8';ctx.fillRect(c.x-1,c.y-5,2,4);
  }
  L.enemies.forEach(en=>{if(en.x>cam.x-60&&en.x<cam.x+VW+60)drawGoblin(en)});
  if(L.boss&&L.boss.alive)drawBoss(L.boss);
  drawPlayer();
  fireballs.forEach(drawFireball);
  for(const q of particles){ctx.globalAlpha=clamp(q.life/q.max,0,1);ctx.fillStyle=q.col;ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size)}
  ctx.globalAlpha=1;
  popups.forEach(q=>txt(q.text,q.x,q.y,11,q.col,'center'));
}
function drawHUD(){
  for(let i=0;i<3;i++)drawHeart(14+i*28,12,i<P.hp);
  txt('PONTOS '+String(score).padStart(6,'0'),14,52,14,'#fff');
  ctx.fillStyle='#ffd23e';circ(VW-150,23,9);ctx.fillStyle='#b9770e';ctx.fillRect(VW-152,17,3,12);
  txt('x'+String(coinsN).padStart(2,'0'),VW-134,23,16,'#fff');
  txt('FASE '+(LV+1)+'/5',VW-14,52,14,'#fff','right');
  txt(TH.name,VW/2,22,12,'#cfe8ff','center');
  const b=L.boss;
  if(b&&b.alive&&b.active){
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(VW/2-152,70,304,18);
    ctx.fillStyle='#e0343c';ctx.fillRect(VW/2-150,72,300*b.hp/b.max,14);
    txt('REI GOBLIN S.A.',VW/2,102,11,'#fff','center');
  }
}
function dim(a){ctx.fillStyle='rgba(8,6,20,'+a+')';ctx.fillRect(0,0,VW,VH)}
function drawTitle(){
  dim(.5);
  txt('CAVALEIRA',VW/2,92,52,'#ffd23e','center');
  txt('DE FOGO',VW/2,156,52,'#ff6a3d','center');
  txt('Uma jornada através das eras',VW/2,208,16,'#fff','center');
  txt(THEMES[bgI].name,VW/2,240,14,'#9be7ff','center');
  const kf=Math.floor(tick/10)%2;
  ctx.drawImage(knightR[kf],250,285,72,96);
  ctx.drawImage(gobS[kf],478,309,72,72);
  const s=1+Math.sin(tick*.3)*.15;
  ctx.fillStyle='rgba(255,90,20,.35)';circ(395,335,20*s);ctx.fillStyle='#ff6a1f';circ(395,335,13*s);ctx.fillStyle='#ffc233';circ(395,335,8*s);ctx.fillStyle='#fff6c8';circ(395,335,4);
  if(((tick/30)|0)%2===0)txt('ENTER ou toque para começar',VW/2,418,16,'#fff','center');
  txt('← → mover   ↑ pular   X fogo',VW/2,450,12,'#cfd6ff','center');
  if(best>0)txt('Recorde '+String(best).padStart(6,'0'),VW/2,472,10,'#ffd23e','center');
}
function drawOverlays(){
  if(state==='play'&&bannerT>0){
    const a=clamp(Math.min(bannerT/30,(170-bannerT)/20),0,1);
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(8,6,20,.62)';ctx.fillRect(0,130,VW,132);
    txt('FASE '+(LV+1),VW/2,162,14,'#ffd23e','center');
    txt(TH.name,VW/2,200,26,'#fff','center');
    txt(TH.sub,VW/2,240,11,'#cfe8ff','center');
    ctx.globalAlpha=1;
  }
  if(state==='paused'){dim(.6);txt('PAUSA',VW/2,210,40,'#fff','center');txt('P ou toque para continuar',VW/2,270,14,'#cfd6ff','center')}
  if(state==='gameover'){
    dim(.6);txt('FIM DE JOGO',VW/2,170,40,'#ff4b5c','center');
    txt('Pontos '+score,VW/2,238,16,'#fff','center');
    txt('Recorde '+best,VW/2,266,12,'#ffd23e','center');
    if(((tick/30)|0)%2===0)txt('ENTER ou toque para tentar de novo',VW/2,340,14,'#fff','center');
  }
  if(state==='clear'){
    dim(.5);txt('FASE CONCLUÍDA!',VW/2,150,30,'#8cff5a','center');
    txt('Bônus de vida +'+(L.bonus||0),VW/2,208,14,'#ffd23e','center');
    const nxt=LV<4?THEMES[LV+1].name:null;
    txt(nxt?'Viajando no tempo… '+nxt:'Você chegou ao presente!',VW/2,256,13,'#cfe8ff','center');
  }
  if(state==='win'){
    dim(.55);txt('VOCÊ VENCEU!',VW/2,130,38,'#ffd23e','center');
    txt('A cavaleira atravessou todas as eras',VW/2,196,13,'#fff','center');
    txt('Pontos '+score,VW/2,244,18,'#fff','center');
    txt('Recorde '+best,VW/2,278,12,'#ffd23e','center');
    if(((tick/30)|0)%2===0)txt('ENTER ou toque para voltar ao início',VW/2,350,13,'#fff','center');
  }
}
function draw(){
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  if(state==='title'){drawBg(Math.floor(tick/420)%5);drawTitle();return}
  drawBg(LV);
  ctx.save();ctx.translate(-Math.round(cam.x),0);drawWorld();ctx.restore();
  drawHUD();drawOverlays();
  if(fade>0){ctx.fillStyle='rgba(0,0,0,'+fade+')';ctx.fillRect(0,0,VW,VH)}
}

/* ====================== LOOP ====================== */
let last=performance.now(),acc=0;
function frame(t){
  acc+=Math.min(100,t-last);last=t;
  while(acc>=16.667){update();acc-=16.667}
  draw();requestAnimationFrame(frame);
}

/* ====================== ENTRADA ====================== */
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyX:'fire',KeyZ:'fire',KeyJ:'fire',KeyK:'fire',ShiftLeft:'fire',ShiftRight:'fire'};
function setInp(act,v,src){held[src+act]=v;inp[act]=!!(held['k'+act]||held['t'+act])}
window.addEventListener('keydown',e=>{
  initAudio();
  const a=keyMap[e.code];
  if(a){
    e.preventDefault();
    if(!e.repeat){if(a==='jump')jumpQ=7;if(a==='fire')fireQ=8}
    setInp(a,true,'k');
  }
  if(e.repeat)return;
  if(e.code==='Enter'||(e.code==='Space'&&state!=='play'))advance();
  if(e.code==='KeyP'||e.code==='Escape')togglePause();
  if(e.code==='KeyM')toggleMute();
});
window.addEventListener('keyup',e=>{const a=keyMap[e.code];if(a){e.preventDefault();setInp(a,false,'k')}});
window.addEventListener('blur',()=>{for(const k in held)held[k]=false;for(const k in inp)inp[k]=false;if(state==='play')togglePause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')togglePause()});
cv.addEventListener('pointerdown',e=>{initAudio();if(state!=='play'&&state!=='clear'){e.preventDefault();advance()}});
document.querySelectorAll('[data-act]').forEach(btn=>{
  const act=btn.dataset.act;
  const down=e=>{
    e.preventDefault();initAudio();btn.classList.add('on');setInp(act,true,'t');
    if(act==='jump'){jumpQ=7;if(state!=='play'&&state!=='clear')advance()}
    if(act==='fire')fireQ=8;
    try{btn.setPointerCapture(e.pointerId)}catch(_){}
  };
  const up=e=>{e.preventDefault();btn.classList.remove('on');setInp(act,false,'t')};
  btn.addEventListener('pointerdown',down);
  btn.addEventListener('pointerup',up);
  btn.addEventListener('pointercancel',up);
  btn.addEventListener('contextmenu',e=>e.preventDefault());
});
document.getElementById('btnPause').addEventListener('click',()=>{if(state==='play'||state==='paused')togglePause()});
document.getElementById('btnMute').addEventListener('click',()=>{initAudio();toggleMute()});

if(document.fonts&&document.fonts.load){document.fonts.load('16px "Press Start 2P"').catch(()=>{})}
requestAnimationFrame(frame);
})();
