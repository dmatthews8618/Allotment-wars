// Background life: cloud shadows, butterflies, pond ripples.
'use strict';

/* ---------------- ambience ---------------- */
function initAmbience(sc){
  sc.clouds=[];if(G.headless)return;
  for(let i=0;i<4;i++)sc.clouds.push(sc.add.image(Math.random()*WW,Math.random()*WH,'cloud').setDepth(4.9).setScale(3+Math.random()*2).setAlpha(.14));
  sc.flies=[];for(let i=0;i<10;i++){const f={x:200+Math.random()*(WW-400),y:200+Math.random()*(WH-400),tx:0,ty:0,t:Math.random()*10};f.tx=f.x;f.ty=f.y;
    f.spr=sc.add.image(f.x,f.y,'fly'+(i%3)).setDepth(4.8).setScale(.9);sc.flies.push(f);}
  sc.rippleT=0;sc.ponds=[];for(let i=0;i<MW*MH;i++)if(G.terr[i]===2)sc.ponds.push(i);
}
function updAmbience(sc,dt){
  if(G.headless)return;
  for(const c of sc.clouds){c.x+=9*dt;c.y+=3*dt;if(c.x>WW+500){c.x=-500;c.y=Math.random()*WH;}if(c.y>WH+400)c.y=-400;}
  for(const f of sc.flies){f.t+=dt;const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);
    if(d<6){f.tx=clamp(f.x+(Math.random()-.5)*260,60,WW-60);f.ty=clamp(f.y+(Math.random()-.5)*260,60,WH-60);}else{f.x+=dx/d*28*dt+Math.sin(f.t*3)*12*dt;f.y+=dy/d*28*dt+Math.cos(f.t*2.3)*12*dt;}
    f.spr.setPosition(f.x,f.y-6).setScale(.9*(.3+.7*Math.abs(Math.sin(f.t*14))),.9).setRotation(Math.atan2(dy,dx)+Math.PI/2).setVisible(visibleToPlayerPt(f.x,f.y));}
  sc.rippleT-=dt;if(sc.rippleT<=0&&sc.ponds.length){sc.rippleT=.35;const i=sc.ponds[(Math.random()*sc.ponds.length)|0];const x=(i%MW)*T+Math.random()*T,y=((i/MW)|0)*T+Math.random()*T;
    if(visibleToPlayerPt(x,y)){const g=sc.add.graphics().setDepth(1.5);g.lineStyle(1,0xd8f0fb,.5);g.strokeEllipse(0,0,10,5);g.setPosition(x,y);sc.tweens.add({targets:g,scale:2.4,alpha:0,duration:1400,onComplete:()=>g.destroy()});}}
}
