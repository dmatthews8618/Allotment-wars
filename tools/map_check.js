// Validate larger maps and varied starting positions without a browser.
'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: { devicePixelRatio: 1 }, console });
for (const file of ['config.js', 'map.js'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context);
vm.runInContext(
  `
  const zones=new Set(), positions=new Set();
  const expect=(ok,detail,seed)=>{if(!ok)throw Error('seed '+seed+': '+detail);};
  for(let seed=1;seed<=250;seed++){
    const m=genMap(seed), repeat=genMap(seed);
    expect(JSON.stringify(m)===JSON.stringify(repeat),'generation is not deterministic',seed);
    expect(m.terr.length===MW*MH&&m.heapAt.length===MW*MH,'grid dimensions',seed);
    expect(Math.hypot(m.enemyStart.x-m.playerStart.x,m.enemyStart.y-m.playerStart.y)>=40,'starts too close',seed);
    expect(JSON.stringify(m.enemyStart)===JSON.stringify(chooseMapStarts(seed)[1]),'terrain retry changed the spawn',seed);
    zones.add(m.enemyStart.zone);positions.add(m.enemyStart.x+','+m.enemyStart.y);
    const occupied=new Uint8Array(MW*MH);
    for(const base of[m.playerStart,m.enemyStart])for(const[k,x,y]of layoutForBase(base)){
      const d=BLDS[k];expect(x>=2&&y>=2&&x+d.w<=MW-2&&y+d.h<=MH-2,'building outside safe map bounds',seed);
      for(let yy=y;yy<y+d.h;yy++)for(let xx=x;xx<x+d.w;xx++){
        const n=idx(xx,yy);
        expect(!occupied[n],'overlapping base buildings',seed);occupied[n]=1;
        expect(m.terr[n]!==2&&m.terr[n]!==3&&m.heapAt[n]<0,'obstructed building footprint',seed);
      }
    }
    for(const team of[0,1]){
      const fields=m.resourceFields.filter(f=>f.team===team);
      expect(fields.length===3&&fields.filter(f=>f.amount===500).reduce((sum,f)=>sum+f.count*f.amount,0)===7500&&fields.filter(f=>f.amount===600).reduce((sum,f)=>sum+f.count*f.amount,0)===3600,'unequal starter resources',seed);
    }
    const distances=[m.playerStart,m.enemyStart].map((b,team)=>m.resourceFields.filter(f=>f.team===team)
      .map(f=>(f.x-b.x-1)**2+(f.y-b.y-1)**2).sort((a,b)=>a-b));
    expect(JSON.stringify(distances[0])===JSON.stringify(distances[1]),'unequal starter field distances',seed);
    const seen=new Uint8Array(MW*MH),queue=[idx(...PLAYER_TROOPS[0])];seen[queue[0]]=1;
    for(let head=0;head<queue.length;head++){
      const n=queue[head],x=n%MW,y=Math.floor(n/MW);
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const xx=x+dx,yy=y+dy;if(!inb(xx,yy))continue;const next=idx(xx,yy);
        if(!seen[next]&&!occupied[next]&&m.terr[next]!==2&&m.terr[next]!==3){seen[next]=1;queue.push(next);}
      }
    }
    expect(seen[idx(...m.enemyExit)],'enemy exit unreachable',seed);
    expect(m.gardens.length===3,'missing community gardens',seed);
    for(const g of m.gardens){
      expect(seen[idx(g.tx,g.ty)],'unreachable garden',seed);
      expect([m.playerStart,m.enemyStart].every(b=>Math.hypot(g.tx-b.x-1,g.ty-b.y-1)>=20),'garden too close to a base',seed);
      for(let y=g.ty-3;y<=g.ty+3;y++)for(let x=g.tx-3;x<=g.tx+3;x++){
        const n=idx(x,y);expect(seen[n]&&!occupied[n]&&m.heapAt[n]<0,'obstructed garden capture area',seed);
      }
      for(const other of m.gardens)if(other.id!==g.id)expect(Math.hypot(other.tx-g.tx,other.ty-g.ty)>=14,'gardens overlap',seed);
    }

    for(const[x,y]of PLAYER_TROOPS)expect(seen[idx(x,y)]&&!occupied[idx(x,y)]&&m.heapAt[idx(x,y)]<0,'obstructed player troop spawn',seed);
    expect(m.heaps.length>=60,'insufficient expansion resources',seed);
    m.heaps.forEach((h,i)=>expect(m.heapAt[idx(h.tx,h.ty)]===i&&seen[idx(h.tx,h.ty)]&&!occupied[idx(h.tx,h.ty)],'unreachable or overlapping compost',seed));
  }
  expect(zones.size===enemyStartCandidates().length,'not every enemy start area is exercised',250);
  expect(positions.size>100,'insufficient variation within start areas',250);
  console.log('PASS 250 seeds: all '+zones.size+' enemy start areas, '+positions.size+' distinct positions, deterministic maps, equal starter supplies/distances, clear bases, three clear community gardens and reachable expansion resources.');
`,
  context
);
