#!/usr/bin/env python3
"""Exercise real scene starts, AI rebuilding and attack routing in every spawn area."""
import asyncio
from playwright.async_api import async_playwright
from harness import LAUNCH_ARGS, open_match

CHECK = """() => {
  const A=window.__AW,G=A.G,expect=(ok,label)=>{if(!ok)throw Error(label);};
  const expected=layoutForBase(G.enemyStart).filter(([k])=>G.D.defences||!DEF_TEMPLATE.some(([d])=>d===k));
  expect(JSON.stringify(expected)===JSON.stringify(G.ai.layout),'AI layout does not follow the chosen start');
  const hq=G.ents.find(e=>e.team===1&&e.kind==='hq');
  const home=G.ents.find(e=>e.team===0&&e.kind==='hq');
  expect(hq.tx===G.enemyStart.x&&hq.ty===G.enemyStart.y,'enemy HQ in wrong location');
  expect(home.tx===PLAYER_START.x&&home.ty===PLAYER_START.y,'player home did not move with larger map');
  expect(G.vis[idx(hq.tx,hq.ty)]===0,'enemy start revealed before scouting');
  for(const e of G.ents)if(e.unit)expect(!G.blocked[idx(tileOf(e.x),tileOf(e.y))],'unit spawned inside an obstacle');
  const water=G.ents.find(e=>e.team===1&&e.kind==='water'),spot=[water.tx,water.ty];
  damage(water,99999,'cata',null);G.money[1]=100000;G.ai.tick=0;G.ai.waveT=1e9;G.build[1]=null;
  updAI(1);
  expect(G.build[1]&&G.build[1].kind==='water'&&JSON.stringify(G.build[1].spot)===JSON.stringify(spot),'AI rebuild targeted old corner');
  G.build[1].ready=true;updAI(1);
  expect(G.ents.some(e=>!e.dead&&e.team===1&&e.kind==='water'&&e.tx===spot[0]&&e.ty===spot[1]),'AI failed to rebuild at its actual base');
  const guard=G.ents.find(e=>!e.dead&&e.team===1&&e.unit&&!e.d.harv);
  PF.team=1;PF.breach=true;
  const goal=[PLAYER_START.x+4,PLAYER_START.y+4],route=findPath(tileOf(guard.x),tileOf(guard.y),...goal);
  PF.breach=false;
  expect(route&&route.length&&tileOf(route[route.length-1].x)===goal[0]&&tileOf(route[route.length-1].y)===goal[1],'full-map route was truncated or blocked');
  G.ai.tick=0;G.ai.waveT=0;updAI(1);
  const wave=G.ents.filter(e=>e.team===1&&e.unit&&e.wave);
  expect(wave.length>0,'AI failed to send a wave');
  expect(wave.every(e=>e.order&&e.order.type==='amove'&&G.ents.some(p=>p.team===0&&p.x===e.order.x&&p.y===e.order.y)),'attack wave targets wrong base');
  return {zone:G.enemyStart.zone,x:hq.tx,y:hq.ty};
}"""

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=LAUNCH_ARGS)
        page,errors=await open_match(browser,seed=4)
        print('Initial game loaded',flush=True)
        zones=set()
        for seed in [1,2,3,4,5,7,9]:
            print('Checking map seed '+str(seed),flush=True)
            await page.evaluate('seed => { game.scene.getScene("main").scene.restart({diff:"standard",seed,headless:true}); }',seed)
            await page.wait_for_function('(seed)=>window.__AW && G.seed===seed && G.started',arg=seed)
            print('Scene ready for seed '+str(seed),flush=True)
            result=await asyncio.wait_for(page.evaluate(CHECK),timeout=25)
            zones.add(result['zone'])
            print(f"PASS {result['zone']}: scene spawn ({result['x']},{result['y']}), hidden HQ, clear unit spawns, AI rebuild, full-map path and attack wave.",flush=True)
        assert len(zones)==7,zones
        assert not errors,errors
        await browser.close()

if __name__=='__main__':
    asyncio.run(main())
