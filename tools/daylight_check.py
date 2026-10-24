#!/usr/bin/env python3
"""Check visual-only daylight, fog privacy, pause and reduced-motion behaviour.
Also saves the same garden at afternoon, sunset, night and dawn for review.
"""
import asyncio
from playwright.async_api import async_playwright
from harness import ROOT, LAUNCH_ARGS, open_match

SETUP = """() => {
  const sc=S; sc.sys.sceneUpdate=()=>sc.render(0);
  for(const[k,x,y]of TEMPLATE)if(k!=='hq')addBuilding(0,k,x,y,true);
  for(const[k,x,y]of DEF_TEMPLATE)addBuilding(0,k,x,y,true);
  updVis(); zoomTo(1.35); centreOn(13*T,(PLAYER_START.y-2)*T);
  G.sel=G.ents.filter(e=>e.team===0&&e.unit);
  uiTick();drawMini();
}"""
CHECK = """() => {
  const results=[], check=(name,ok)=>results.push({name,ok:!!ok});
  const state=()=>JSON.stringify({money:G.money,power:G.power,vis:[...G.vis],ents:G.ents.map(e=>[e.id,e.hp,e.x,e.y,e.cd]),ai:G.ai,stats:G.stats});
  const before=state(), unit=G.ents.find(e=>e.team===0&&e.unit);
  G.time=0;S.render(0); const day=S.terrain.tintTopLeft;
  G.time=DAYLIGHT_SECONDS*0.7;S.render(0);const night=S.terrain.tintTopLeft;
  check('terrain shifts from warm afternoon to cool moonlight',day!==night&&night===0x8098bd);
  check('unit colours stay clear at night',unit.spr.tintTopLeft===0xffffff);
  check('building lighting stays brighter than ground',S.daylight.buildings===0xb5c7e1);
  check('night does not change gameplay state or visibility',before===state());
  const phase=S.daylight.phase;S.render(0);S.render(0);
  check('paused rendering holds the lighting clock',phase===S.daylight.phase);
  check('cycle returns seamlessly to the same afternoon',JSON.stringify(daylightAt(0))===JSON.stringify(daylightAt(DAYLIGHT_SECONDS)));
  let maxJump=0; for(let t=1;t<=DAYLIGHT_SECONDS;t++)for(const shift of[0,8,16])maxJump=Math.max(maxJump,Math.abs(((daylightAt(t).terrain>>shift)&255)-((daylightAt(t-1).terrain>>shift)&255)));
  check('colour changes are gradual throughout the cycle',maxJump<=3);
  const random=Math.random;let rolls=0;Math.random=()=>{rolls++;return 0.5;};
  S.render(0.05);Math.random=random;
  check('new effects do not consume gameplay random rolls',rolls===0);
  G.vis.fill(0);S.render(0);
  check('fireflies and water glints stay hidden in fog',S.evening.fireflies.every(f=>!f.spr.visible&&!f.dot.visible)&&S.evening.reflections.every(r=>!r.spr.visible));
  const hidden=S.evening.lamps.commandBuffer.length;
  G.vis.fill(2);S.render(0);
  check('enemy lights only appear when their base is visible',S.evening.lamps.commandBuffer.length>hidden);
  check('smoke uses a fixed bounded pool',S.evening.smoke.length===16);
  updVis();return results;
}"""

async def main():
    failed=[]
    out=ROOT/'screens'/'daylight';out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=LAUNCH_ARGS)
        page,errors=await open_match(browser,seed=3,viewport=(1440,960))
        await page.evaluate(SETUP)
        results=await page.evaluate(CHECK)
        for r in results:
            print(('PASS ' if r['ok'] else 'FAIL ')+r['name'],flush=True)
            if not r['ok']:failed.append(r['name'])
        for label,time in [('afternoon',0),('sunset',182.4),('moonlight',336),('dawn',441.6)]:
            await page.evaluate('(t)=>{G.time=t;updVis();S.render(0);}',time)
            await page.screenshot(path=str(out/(label+'.png')))
        await page.emulate_media(reduced_motion='reduce')
        reduced=await page.evaluate('''()=>{
          G.time=336;S.render(0);const a=S.evening.fireflies.map(f=>[f.spr.x,f.spr.y,f.spr.alpha]);
          G.time=337;S.render(0);return JSON.stringify(a)===JSON.stringify(S.evening.fireflies.map(f=>[f.spr.x,f.spr.y,f.spr.alpha]))&&S.evening.smoke.every(p=>!p.spr.visible);
        }''')
        print(('PASS 'if reduced else 'FAIL ')+'reduced motion holds fireflies still and suppresses chimney smoke',flush=True)
        if not reduced:failed.append('reduced motion')
        assert not errors,errors
        await page.close()
        page,errors=await open_match(browser,seed=3,viewport=(390,844),phone=True,dpr=3)
        await page.evaluate(SETUP)
        await page.evaluate('()=>{G.time=336;zoomTo(0.85);S.render(0);}')
        await page.screenshot(path=str(out/'phone-moonlight.png'))
        assert not errors,errors
        print('PASS phone moonlight renders without browser errors',flush=True)
        await browser.close()
    assert not failed,failed

if __name__=='__main__':asyncio.run(main())
