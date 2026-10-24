// A* route-finding round ponds, hedges, buildings and fences. Gates let their own side through.
'use strict';

/* ---------------- pathfinding ---------------- */
const PF={g:new Float32Array(MW*MH),from:new Int32Array(MW*MH),stamp:new Uint32Array(MW*MH),closed:new Uint32Array(MW*MH),cur:0,team:0,breach:false};
const HF=[],HI=[];
function hpush(f,i){HF.push(f);HI.push(i);let k=HF.length-1;while(k>0){const p=(k-1)>>1;if(HF[p]<=HF[k])break;let t=HF[p];HF[p]=HF[k];HF[k]=t;t=HI[p];HI[p]=HI[k];HI[k]=t;k=p;}}
function hpop(){const top=HI[0];const lf=HF.pop(),li=HI.pop();if(HF.length){HF[0]=lf;HI[0]=li;let k=0;const n=HF.length;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<n&&HF[l]<HF[m])m=l;if(r<n&&HF[r]<HF[m])m=r;if(m===k)break;let t=HF[m];HF[m]=HF[k];HF[k]=t;t=HI[m];HI[m]=HI[k];HI[k]=t;k=m;}}return top;}
const passable=i=>!G.blocked[i]||G.gateTeam[i]===PF.team;
const free=(x,y)=>inb(x,y)&&passable(idx(x,y));
function nearestFree(gx,gy,sx,sy){for(let r=1;r<14;r++){let best=null,bd=1e9;for(let y=gy-r;y<=gy+r;y++)for(let x=gx-r;x<=gx+r;x++){if(Math.max(Math.abs(x-gx),Math.abs(y-gy))!==r)continue;if(!free(x,y))continue;const d=Math.hypot(x-sx,y-sy)+Math.hypot(x-gx,y-gy)*.5;if(d<bd){bd=d;best=[x,y];}}if(best)return best;}return null;}
function findPath(sx,sy,gx,gy){
  gx=clamp(gx,0,MW-1);gy=clamp(gy,0,MH-1);
  if(!passable(idx(gx,gy))){const n=nearestFree(gx,gy,sx,sy);if(!n)return null;gx=n[0];gy=n[1];}
  if(sx===gx&&sy===gy)return[];
  const s=++PF.cur;HF.length=0;HI.length=0;
  const H=(x,y)=>{const dx=Math.abs(x-gx),dy=Math.abs(y-gy);return dx+dy-.586*Math.min(dx,dy);};
  const start=idx(sx,sy),goal=idx(gx,gy);PF.stamp[start]=s;PF.g[start]=0;PF.from[start]=-1;hpush(H(sx,sy),start);
  let best=start,bestH=H(sx,sy),exp=0;
  while(HF.length){const c=hpop();if(PF.closed[c]===s)continue;PF.closed[c]=s;if(c===goal){best=c;break;}if(++exp>4200)break;
    const cx=c%MW,cy=(c/MW)|0;const h=H(cx,cy);if(h<bestH){bestH=h;best=c;}
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(!inb(nx,ny))continue;const n=idx(nx,ny);let extra=0;
      if(!passable(n)){if(PF.breach&&G.wallAt[n]&&G.wallTeam[n]!==PF.team&&!(dx&&dy))extra=9;else continue;}
      if(dx&&dy&&(!free(cx+dx,cy)||!free(cx,cy+dy)))continue;if(PF.closed[n]===s)continue;
      const ng=PF.g[c]+(dx&&dy?1.414:1)+extra;if(PF.stamp[n]!==s||ng<PF.g[n]){PF.stamp[n]=s;PF.g[n]=ng;PF.from[n]=c;hpush(ng+H(nx,ny),n);}}}
  const tiles=[];let c=best;while(c!==start&&c!==-1){tiles.push(c);c=PF.from[c];}tiles.reverse();
  const pts=tiles.map(i=>({x:(i%MW)*T+T/2,y:((i/MW)|0)*T+T/2}));
  const out=[];let a={x:sx*T+T/2,y:sy*T+T/2},i=0;
  while(i<pts.length){let j=pts.length-1;while(j>i&&!los(a,pts[j]))j--;out.push(pts[j]);a=pts[j];i=j+1;}
  return out;
}
function los(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<1)return true;const nx=-dy/d*9,ny=dx/d*9,steps=Math.ceil(d/8);
  for(let k=0;k<=steps;k++){const t=k/steps,x=a.x+dx*t,y=a.y+dy*t;for(const o of[-1,0,1]){const tx=tileOf(x+nx*o),ty=tileOf(y+ny*o);if(!inb(tx,ty)||!passable(idx(tx,ty)))return false;}}return true;}
function setPath(e,px,py){PF.team=e.team;PF.breach=!!(e.unit&&!e.d.harv);const p=findPath(tileOf(e.x),tileOf(e.y),tileOf(px),tileOf(py));PF.breach=false;e.path=p||[];e.dest={x:px,y:py};}
function freeTilesAround(gx,gy,n){gx=clamp(gx,1,MW-2);gy=clamp(gy,1,MH-2);if(!free(gx,gy)){const f=nearestFree(gx,gy,gx,gy);if(!f)return[];gx=f[0];gy=f[1];}
  const out=[],seen=new Set([idx(gx,gy)]),q=[[gx,gy]];while(q.length&&out.length<n){const[x,y]=q.shift();out.push([x,y]);
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy,k=idx(nx,ny);if(!free(nx,ny)||seen.has(k))continue;seen.add(k);q.push([nx,ny]);}}return out;}
function ringFree(b,ref){for(let m=1;m<=3;m++){let best=null,bd=1e9;for(let y=b.ty-m;y<b.ty+b.h+m;y++)for(let x=b.tx-m;x<b.tx+b.w+m;x++){
  const edge=x===b.tx-m||x===b.tx+b.w-1+m||y===b.ty-m||y===b.ty+b.h-1+m;if(!edge||!free(x,y)||G.gateTeam[idx(x,y)]>=0)continue;if(G.heapAt[idx(x,y)]>=0&&m===1)continue;
  const d=Math.hypot(x*T+T/2-ref.x,y*T+T/2-ref.y);if(d<bd){bd=d;best=[x,y];}}if(best)return best;}return null;}
