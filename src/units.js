// Unit behaviour: moving, choosing targets, breaking through fences, wheelbarrow harvesting, defence towers.
'use strict';

/* ---------------- unit behaviour ---------------- */
function moveAlong(e,dt){
  if(!e.path||!e.path.length)return false;
  const p=e.path[0],dx=p.x-e.x,dy=p.y-e.y,dd=Math.hypot(dx,dy);const sp=e.d.speed*dt*(e.soakT>0?.5:1);
  if(dd>.5){const ah=Math.min(dd,e.d.r+5),ax=e.x+dx/dd*ah,ay=e.y+dy/dd*ah,ti=idx(tileOf(ax),tileOf(ay));
    if(G.blocked[ti]&&G.gateTeam[ti]!==e.team&&G.bldAt[ti]!==G.bldAt[idx(tileOf(e.x),tileOf(e.y))]){
      const wid=G.wallAt[ti];if(wid&&G.wallTeam[ti]!==e.team&&!e.d.harv){const w=G.ents.find(o=>o.id===wid&&!o.dead);if(w){e.breach=w;return true;}}}}
  if(dd<=sp){e.x=p.x;e.y=p.y;e.path.shift();}else{e.x+=dx/dd*sp;e.y+=dy/dd*sp;}
  if(dd>.5)e.ang=turn(e.ang,Math.atan2(dy,dx),dt*9);
  e.stuck+=dt;if(e.stuck>1){const m=Math.hypot(e.x-e.lastX,e.y-e.lastY);e.lastX=e.x;e.lastY=e.y;e.stuck=0;
    if(m<6&&e.path.length){e.stuckN++;const last=e.path[e.path.length-1];if(e.stuckN>3){e.path=[];e.stuckN=0;}else setPath(e,last.x,last.y);}else e.stuckN=0;}
  return true;
}
function findTarget(e,rangeTiles){
  const R=rangeTiles*T,ak=e.kind;let best=null,bd=1e9;
  for(const o of G.ents){if(o.dead||o.team===e.team||isWall(o))continue;const arm=o.bld?'bld':o.d.armor;if(!MULT[ak][arm])continue;
    if(e.team===0&&!visibleToPlayer(o))continue;const d=distTo(e,o);if(d>R)continue;if(e.d.minRange&&d<e.d.minRange*T)continue;
    let sc=d+(o.bld?R*.8:0)+(o.unit&&o.d.harv?R*.3:0)+(o.unit&&o.d.range>0&&!o.d.harv?-T:0);if(sc<bd){bd=sc;best=o;}}
  return best;
}
function updUnit(e,dt){
  const d=e.d;e.cd-=dt;e.repT-=dt;e.scanT-=dt;
  if(e.breach){const w=e.breach;if(w.dead){e.breach=null;if(e.dest)setPath(e,e.dest.x,e.dest.y);}
    else if(distTo(e,w)<=Math.max(d.range,1.2)*T+d.r){e.ang=turn(e.ang,angTo(e,w),dt*12);if(e.cd<=0){fire(e,w);e.cd=d.cd;}return;}else e.breach=null;}
  if(e.target&&e.target.dead)e.target=null;
  const o=e.order;
  if(o&&o.type==='attack'){if(o.t.dead){e.order=null;e.target=null;e.guard={x:e.x,y:e.y};}else e.target=o.t;}
  if(o&&o.type==='move'){e.target=null;if(!moveAlong(e,dt)){e.order=null;e.guard={x:e.x,y:e.y};}return;}
  if(!e.target&&e.scanT<=0){e.scanT=.3+Math.random()*.1;const t=findTarget(e,d.sight);if(t){e.target=t;e.repT=0;}}
  if(e.target){
    const t=e.target,dist=distTo(e,t);const forced=e.order&&e.order.type==='attack';
    if(d.minRange&&dist<d.minRange*T&&!forced){e.target=null;}
    else if(dist<=d.range*T+(t.unit?t.d.r*.5:0)+d.r*.5&&!(d.minRange&&dist<d.minRange*T)){e.path=null;e.chase=false;e.ang=turn(e.ang,angTo(e,t),dt*12);if(e.cd<=0){fire(e,t);e.cd=d.cd;}return;}
    else{
      if(!e.order&&e.guard&&Math.hypot(e.x-e.guard.x,e.y-e.guard.y)>(d.sight+8)*T){e.target=null;e.chase=false;setPath(e,e.guard.x,e.guard.y);}
      else if(e.team===0&&!forced&&!visibleToPlayer(t)&&dist>(d.sight+2)*T){e.target=null;}
      else if(e.repT<=0||!e.path||!e.path.length){e.repT=.6;e.chase=true;
        if(!forced){const n=findTarget(e,d.sight);if(n&&n!==t&&distTo(e,n)<dist-T*.5){e.target=n;}}setPath(e,e.target.x,e.target.y);}
    }
  }
  if(!e.target){
    if(e.chase){e.chase=false;if(o&&o.type==='amove')setPath(e,o.x,o.y);else if(e.guard)setPath(e,e.guard.x,e.guard.y);}
    else if(o&&o.type==='amove'&&(!e.path||!e.path.length)){if(Math.hypot(e.x-o.x,e.y-o.y)<T*1.6){e.order=null;e.guard={x:e.x,y:e.y};}else{setPath(e,o.x,o.y);if(!e.path.length){e.order=null;e.guard={x:e.x,y:e.y};}}}
  }
  moveAlong(e,dt);
}
function nearestOwn(e,kind){let b=null,bd=1e9;for(const o of G.ents){if(o.dead||o.team!==e.team||o.kind!==kind)continue;const d=distTo(e,o);if(d<bd){bd=d;b=o;}}return b;}
function pickHeap(e){
  let best=null,bd=1e9;
  for(const h of G.heaps){if(h.amount<=0||h===e.badHeap)continue;const k=idx(h.tx,h.ty);const hx=h.tx*T+T/2,hy=h.ty*T+T/2;const d=Math.hypot(hx-e.x,hy-e.y);
    if(e.team===0&&G.vis[k]===0&&d>16*T)continue;
    let claims=0;for(const o of G.ents)if(o!==e&&!o.dead&&o.unit&&o.d.harv&&o.heap===h&&(o.hs==='toHeap'||o.hs==='gather'))claims++;
    const sc=d+claims*2.5*T+(e.lastHeap?Math.hypot(hx-e.lastHeap.tx*T,hy-e.lastHeap.ty*T)*.3:0);if(sc<bd){bd=sc;best=h;}}
  return best;
}
function updHeap(h){if(!h.spr)return;if(h.amount<=0){h.spr.destroy();h.spr=null;G.heapAt[idx(h.tx,h.ty)]=-1;return;}h.spr.setScale(.45+.55*h.amount/h.max);}
function updHarv(e,dt){
  if(e.order&&e.order.type==='move'){if(!moveAlong(e,dt)){e.order=null;e.hs='idle';e.ht=4;}return;}
  e.ht-=dt;const cap=capOf(e);
  switch(e.hs){
    case'idle':if(e.ht<=0)e.hs=e.load>=cap?'return':'seek';break;
    case'seek':{const h=pickHeap(e);if(!h){if(e.load>0)e.hs='return';else{e.hs='idle';e.ht=3;}break;}e.heap=h;setPath(e,h.tx*T+T/2,h.ty*T+T/2);e.hs='toHeap';break;}
    case'toHeap':{const h=e.heap;if(!h||h.amount<=0){e.hs='seek';break;}if(!moveAlong(e,dt)){const dd=Math.hypot(e.x-(h.tx*T+T/2),e.y-(h.ty*T+T/2));
      if(dd<16){e.hs='gather';e.ht=.5;e.badHeap=null;}else{e.badHeap=h;e.hs='idle';e.ht=.5;}}break;}
    case'gather':if(e.ht<=0){e.ht=.5;const h=e.heap;if(!h||h.amount<=0){e.hs=e.load>=cap*.5?'return':'seek';break;}
      const take=Math.min(40,h.amount,cap-e.load);h.amount-=take;e.load+=take;e.lastHeap=h;updHeap(h);if(e.load>=cap)e.hs='return';}break;
    case'return':{const bin=e.forceBin&&!e.forceBin.dead?e.forceBin:nearestOwn(e,'bin');e.forceBin=null;if(!bin){e.hs='idle';e.ht=3;break;}
      e.bin=bin;setPath(e,bin.x,bin.y);e.hs='toBin';break;}
    case'toBin':if(!e.bin||e.bin.dead){e.hs='return';break;}if(!moveAlong(e,dt)){if(rectDist(e.x,e.y,e.bin)<T*1.15){e.hs='unload';e.ht=1.2;e.ang=angTo(e,e.bin);}else{e.hs='idle';e.ht=1;}}break;
    case'unload':if(e.ht<=0){const amt=Math.round(e.load*(e.team===1?G.D.inc:G.D.pinc));G.money[e.team]+=amt;
      if(e.team===0){G.stats.harvested+=amt;floatText(e.x,e.y-16,'+'+amt);}e.load=0;e.hs='seek';}break;
  }
}
function updTurret(e,dt){const d=e.d;e.cd-=dt*(lowPower(e.team)?.5:1);e.scanT-=dt;
  if(e.target&&(e.target.dead||distTo(e,e.target)>d.range*T||(e.team===0&&!visibleToPlayer(e.target))))e.target=null;
  if(!e.target&&e.scanT<=0){e.scanT=.3;e.target=findTarget(e,d.range);}
  if(e.target&&e.cd<=0){fire(e,e.target);e.cd=d.cd;}}
