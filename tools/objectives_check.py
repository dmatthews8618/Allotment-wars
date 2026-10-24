#!/usr/bin/env python3
"""Community garden rules, enemy expeditions, fog privacy and interaction checks."""
import asyncio
from playwright.async_api import async_playwright
from harness import ROOT, LAUNCH_ARGS, open_match

CHECK = """() => {
  S.sys.sceneUpdate=()=>{};
  const results=[],check=(name,ok)=>results.push({name,ok:!!ok});
  const original=G.ents,headless=G.headless;G.headless=true;
  const g=G.gardens[0],base={owner:-1,knownOwner:-1,claimant:-1,progress:0,contested:false,incomeT:0,seen:false};
  const reset=()=>{Object.assign(g,base);G.ents=[];G.money=[1000,1000];G.stats.gardenIncome=0;G.stats.gardensCaptured=0;G.gardens.slice(1).forEach(p=>Object.assign(p,base));};
  const unit=(team,harv=false)=>({unit:true,team,d:{harv},x:g.x,y:g.y,dead:false});
  const run=(seconds)=>{for(let t=0;t<Math.round(seconds*20);t++)updGardens(0.05);};
  reset();G.ents=[unit(0,true)];run(20);
  check('wheelbarrows cannot claim gardens',g.owner===-1&&g.progress===0);
  reset();G.ents=[unit(0)];run(11.9);
  check('one troop must hold the point for the full capture time',g.owner===-1&&g.progress>0.98);
  run(0.1);check('twelve seconds claims a neutral garden',g.owner===0&&G.stats.gardensCaptured===1);
  const money=G.money[0];G.ents=[];run(29.9);
  check('income does not pay early or require a permanent garrison',G.money[0]===money);
  run(0.15);check('secure ownership pays 75 compost per 30 seconds',G.money[0]===money+75&&G.stats.gardenIncome===75);
  G.ents=[unit(0),unit(1)];const paid=G.money[0],progress=g.progress;run(40);
  check('opposing troops freeze capture and income',g.contested&&g.owner===0&&g.progress===progress&&G.money[0]===paid);
  G.ents=[unit(1)];run(6);const held=G.money[0];run(6);
  check('enemy troops can retake a player garden',g.owner===1&&G.money[0]===held);
  G.ents=[];run(30.1);check('enemy ownership credits enemy compost',G.money[1]===1075);
  reset();G.ents=[unit(0),unit(0),unit(0)];run(8);
  check('three fighting units capture faster',g.owner===0);
  reset();G.ents=[unit(0)];run(6);G.ents=[];run(6);
  check('abandoned partial captures decay without changing ownership',g.owner===-1&&g.progress<0.01);
  reset();g.owner=0;g.claimant=1;g.progress=0.5;G.ents=[unit(0)];run(2.1);
  check('defenders can remove an incomplete enemy claim',g.owner===0&&g.progress===0);
  reset();G.vis.fill(0);g.owner=1;updGardens(0);
  check('unseen enemy captures do not reveal markers or ownership',!g.seen&&g.knownOwner===-1);
  g.seen=true;g.knownOwner=-1;updGardens(0);check('explored fog retains last-known ownership',g.knownOwner===-1&&gardenStatus(g).includes('last seen'));
  G.ents=[];g.owner=0;updVis();
  check('claimed gardens provide sight for defence',G.vis[idx(g.tx,g.ty)]===2&&G.vis[idx(g.tx+4,g.ty)]===2);
  g.owner=1;updVis();check('lost gardens stop providing live sight',G.vis[idx(g.tx,g.ty)]===1);
  G.vis.fill(2);check('buildings and fences cannot cover the capture area',!canPlace(0,'wall',g.tx,g.ty,true)&&!canPlace(0,'water',g.tx-1,g.ty-1,true));
  G.ents=original;G.headless=headless;G.gardens.forEach(p=>Object.assign(p,base));
  const hq=G.ents.find(e=>e.team===1&&e.kind==='hq'), army=[];
  for(let i=0;i<5;i++)army.push(addUnit(1,'fork',hq.x+128+i*12,hq.y+128));
  G.time=250;G.ai.gardenT=0;updGardenAI(army,hq);
  const squad=army.filter(u=>u.gardenId!=null);
  check('enemy sends a small fighting squad while keeping defenders',squad.length===2&&army.length-squad.length===3&&squad.every(u=>u.order.type==='amove'&&u.path.length));
  if(squad.length){const target=G.gardens[squad[0].gardenId];target.owner=1;G.time=280;G.ai.gardenT=1e9;updGardenAI(army,hq);check('enemy capture squads return to the main army',squad.every(u=>u.gardenId==null));}
  for(const u of army){u.dead=true;u.spr.destroy();u.sh.destroy();}G.ents=G.ents.filter(e=>!e.dead);
  G.gardens.forEach(p=>Object.assign(p,base));G.time=0;G.vis.fill(0);updVis();
  g.seen=true;G.vis[idx(g.tx,g.ty)]=2;
  const player=G.ents.find(e=>e.team===0&&e.unit);G.sel=[player];leftClick(g.x,g.y,false,true,10000);
  check('tapping a discovered garden sends troops to capture it',player.order&&player.order.type==='amove'&&Math.hypot(player.order.x-g.x,player.order.y-g.y)<T*2);
  G.ai.tick=1e9;G.ai.waveT=1e9;
  const runner=addUnit(0,'fork',g.x,g.y);g.owner=-1;g.progress=0;g.claimant=-1;
  const cash=G.money[0];
  for(let i=0;i<44*20;i++)tick(0.05);
  check('the full game loop captures, reveals and pays for a held garden',g.owner===0&&G.stats.gardenIncome>=75&&G.money[0]>=cash+75&&gardenVisible(g));
  runner.dead=true;runner.spr.destroy();runner.sh.destroy();G.ents=G.ents.filter(e=>!e.dead);
  G.sel=[];leftClick(g.x+80,g.y+40,false,true,11000);uiTick();
  check('garden inspection explains capture and income',G.focusGarden===g.id&&document.querySelector('#info').textContent.includes('12 seconds'));
  return results;
}"""

PREVIEW = """() => {
  const g=G.gardens[0];G.time=155;G.vis.fill(2);G.gardens.forEach(p=>{p.seen=true;p.knownOwner=p.owner;});
  g.owner=0;g.knownOwner=0;g.claimant=1;g.progress=0.45;g.contested=true;
  for(let i=0;i<3;i++)addUnit(0,'fork',g.x-58+i*20,g.y+35);
  for(let i=0;i<2;i++)addUnit(1,'hose',g.x+60+i*18,g.y-8);
  zoomTo(1.65);centreOn(g.x,g.y+5);G.sel=[];G.focusGarden=g.id;updVis();uiTick();drawMini();S.render(0);
}"""

async def main():
    out=ROOT/'screens'/'community-gardens';out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=LAUNCH_ARGS)
        page,errors=await open_match(browser,seed=3,viewport=(1440,960))
        results=await page.evaluate(CHECK)
        for r in results:print(('PASS ' if r['ok'] else 'FAIL ')+r['name'],flush=True)
        assert all(r['ok']for r in results),[r for r in results if not r['ok']]
        await page.evaluate(PREVIEW);await page.screenshot(path=str(out/'contested.png'))
        await page.evaluate('()=>{G.time=336;G.gardens[0].contested=false;G.gardens[0].progress=0;S.render(0);}')
        await page.screenshot(path=str(out/'moonlight.png'))
        assert not errors,errors
        await page.close()
        page,errors=await open_match(browser,seed=3,viewport=(390,844),phone=True,dpr=3)
        await page.evaluate('()=>{S.sys.sceneUpdate=()=>{};}')
        await page.evaluate(PREVIEW)
        await page.locator('#garden-status').click()
        assert await page.evaluate('G.focusGarden!=null&&G.sel.length===0')
        assert await page.locator('#garden-status').is_visible()
        await page.evaluate('()=>{const g=G.gardens[0];G.focusGarden=0;zoomTo(0.95);centreOn(g.x,g.y);uiTick();S.render(0);document.activeElement.blur();}')
        await page.screenshot(path=str(out/'phone.png'))
        assert not errors,errors
        print('PASS phone garden control focuses discovered territory',flush=True)
        await browser.close()

if __name__=='__main__':asyncio.run(main())
