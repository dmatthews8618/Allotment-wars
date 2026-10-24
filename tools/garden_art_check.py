#!/usr/bin/env python3
"""Check terrain invariants, material seams, fence joins and animated gate states."""
import asyncio
from playwright.async_api import async_playwright
from harness import LAUNCH_ARGS, open_match

SCENARIO = """() => {
  const checks=[];
  const expect=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  expect('garden atlas decoded',!!gardenArt);
  const fields=['terr','blocked','heapAt','bldAt','wallAt','wallTeam','gateTeam','vis'];
  const before=fields.map(k=>JSON.stringify(Array.from(G[k])));
  const image=S.children.list.find(o=>o.texture&&o.texture.key==='terrain');
  drawTerrain();image.setTexture('terrain');
  fields.forEach((k,i)=>expect('terrain painting preserves '+k,before[i]===JSON.stringify(Array.from(G[k]))));
  for(const name of GARDEN_MATERIALS){
    const cv=gardenArt.materials[name],data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let seamless=true;
    for(let p=0;p<cv.width;p++)for(let channel=0;channel<4;channel++){
      const left=(p*cv.width)*4+channel,right=(p*cv.width+cv.width-1)*4+channel;
      const top=p*4+channel,bottom=((cv.height-1)*cv.width+p)*4+channel;
      if(Math.abs(data[left]-data[right])>2||Math.abs(data[top]-data[bottom])>2)seamless=false;
    }
    expect(name+' repeats without edge seams',seamless);
  }
  for(const team of [0,1])for(let mask=0;mask<16;mask++){
    const cv=document.createElement('canvas');cv.width=cv.height=64;
    const c=cv.getContext('2d');c.scale(2,2);drawWall(c,team,mask);
    const pixels=c.getImageData(0,0,64,64).data;
    for(const[bit,edge]of[[1,'n'],[2,'e'],[4,'s'],[8,'w']])if(mask&bit){
      let ink=0;
      for(let p=18;p<46;p++)for(let d=0;d<3;d++){
        const x=edge==='w'?d:edge==='e'?63-d:p,y=edge==='n'?d:edge==='s'?63-d:p;
        if(pixels[(y*64+x)*4+3]>50)ink++;
      }
      expect('team '+team+' mask '+mask+' joins '+edge,ink>3);
    }
  }
  for(let y=28;y<33;y++)for(let x=18;x<24;x++){G.terr[idx(x,y)]=0;G.blocked[idx(x,y)]=0;}
  const gate=addBuilding(0,'gate',20,30,true),u=addUnit(0,'fork',gate.x,gate.y-8);
  const frames=[];
  for(let i=0;i<4;i++){S.render(.055);frames.push(gate.spr.texture.key);}
  expect('friendly approach animates gate through opening poses',frames.join('|')==='gate_0_step1|gate_0_step2|gate_0_step3|gate_0_1');
  u.x+=160;u.y+=160;
  const closing=[];
  for(let i=0;i<4;i++){S.render(.055);closing.push(gate.spr.texture.key);}
  expect('gate closes after troops leave',closing.join('|')==='gate_0_step3|gate_0_step2|gate_0_step1|gate_0_0');
  window.__gardenGateTest={gate,u};
  return checks;
}"""

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=LAUNCH_ARGS)
        page,errors=await open_match(browser,seed=4)
        checks=await page.evaluate(SCENARIO)
        await page.emulate_media(reduced_motion='reduce')
        await page.wait_for_function('GARDEN_MOTION.matches')
        reduced=await page.evaluate('''() => {
          const {gate,u}=window.__gardenGateTest;u.x=gate.x;u.y=gate.y-8;
          S.render(0);return gate.spr.texture.key==='gate_0_1';
        }''')
        assert reduced, 'Reduced motion should open the gate immediately'
        assert not errors, errors
        print(f'PASS {len(checks)+1} garden-art checks: terrain invariants, seamless materials, all fence connections, opening/closing gates and reduced motion.')
        await browser.close()

if __name__=='__main__':
    asyncio.run(main())
