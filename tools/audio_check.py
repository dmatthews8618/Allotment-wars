#!/usr/bin/env python3
"""Audio activation, mixing, privacy, lifecycle and desktop/phone controls.
Renders an offline WAV audition to screens/audio/preview.wav for listening.
"""
import asyncio,base64,pathlib,wave
from playwright.async_api import async_playwright
from harness import ROOT,LAUNCH_ARGS,open_match,PHASER_CDN,PHASER_LOCAL

CHECK = """async()=>{
  const a=GameAudio,c=a.ctx,results=[],check=(name,ok)=>results.push({name,ok:!!ok});
  check('audio unlocks after a real user gesture',c&&c.state==='running');
  G.paused=false;a.apply();const hq=G.ents.find(e=>e.team===0&&e.kind==='hq');
  const state=JSON.stringify({money:G.money,stats:G.stats,vis:[...G.vis],ents:G.ents.map(e=>[e.id,e.hp,e.x,e.y])});
  let rolls=0;const random=Math.random;Math.random=()=>{rolls++;return 0.5;};
  a.cooldowns.clear();const played=a.sound('place',hq.x,hq.y);Math.random=random;
  check('visible nearby actions produce a sound',played&&a.voices.size>0);
  check('audio consumes no gameplay random rolls',rolls===0);
  check('audio does not mutate gameplay state',state===JSON.stringify({money:G.money,stats:G.stats,vis:[...G.vis],ents:G.ents.map(e=>[e.id,e.hp,e.x,e.y])}));
  a.cooldowns.clear();const enemy=G.ents.find(e=>e.team===1&&e.kind==='hq');G.vis[idx(tileOf(enemy.x),tileOf(enemy.y))]=0;
  check('hidden enemies produce no positional sound',!a.sound('destroy',enemy.x,enemy.y));
  check('distant off-screen action is inaudible',!a.location(WW-2*T,WH-2*T));
  a.cooldowns.clear();a.sound('hose',hq.x,hq.y);check('rapid repeat effects are rate-limited',!a.sound('hose',hq.x,hq.y));
  a.stopVoices();for(let i=0;i<80;i++)a.play('fork','effects');
  check('busy battles cannot exceed twenty active effect voices',a.voices.size===20);
  a.stopVoices();check('stopping playback releases effect connections',a.voices.size===0);
  a.set('muted',true);check('mute prevents new sounds',!a.sound('ready',0,0,true)&&a.voices.size===0);
  a.set('muted',false);a.set('effects',0);check('effects can be silenced independently',!a.sound('ready',0,0,true)&&a.settings.ambience>0);
  a.set('effects',61);a.set('ambience',32);a.set('music',18);a.set('master',48);
  check('category volumes are independently adjustable',a.settings.effects===61&&a.settings.ambience===32&&a.settings.music===18&&a.settings.master===48);
  a.nextMusic=0;a.nextNature=0;a.update();check('optional music and nature are scheduled when enabled',a.voices.size>0&&a.nextMusic>0&&a.nextNature>0);
  G.paused=true;a.apply();check('pause stops effects and garden ambience',!a.active&&a.voices.size===0);
  G.paused=false;a.apply();check('resume restores the garden soundscape',a.active);
  a.play('ready','ui');a.reset();check('restarting clears old notes and cooldowns',a.voices.size===0&&a.cooldowns.size===0&&a.musicStep===0);
  G.over=true;a.apply();const won=a.sound('win',0,0,true);check('result fanfare can play after gameplay ambience stops',!a.active&&won&&a.voices.size>0);G.over=false;a.reset();
  const hidden=Object.getOwnPropertyDescriptor(document,'hidden');Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r=>setTimeout(r,80));check('backgrounding suspends the audio context',c.state==='suspended'&&a.voices.size===0);
  if(hidden)Object.defineProperty(document,'hidden',hidden);else delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));await a.unlock();
  check('returning to the tab resumes audio safely',c.state==='running');
  a.set('muted',true);check('preferences are saved on this device',JSON.parse(localStorage.getItem('allotment-wars-audio-v1')).master===48&&JSON.parse(localStorage.getItem('allotment-wars-audio-v1')).muted);
  G.paused=true;a.apply();return results;
}"""
AUDITION = """async()=>{
  const sr=44100,seconds=17,c=new OfflineAudioContext(1,sr*seconds,sr),a=new GardenAudio();a.ctx=c;
  a.buses={};for(const k of['effects','ambience','music','ui']){a.buses[k]=c.createGain();a.buses[k].connect(c.destination);}
  a.noise=c.createBuffer(1,sr*2,sr);const data=a.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=a.random()*2-1;
  const kinds=['fork','hose','tiller','cata','splash','soil','buzz','place','ready','harvest','capture','warn','destroy','bird','cricket','win'];
  kinds.forEach((k,i)=>a.play(k,'effects',0.55,0,null,0.1+i*0.9));
  const b=await c.startRendering(),samples=b.getChannelData(0);let peak=0,sum=0;
  for(const v of samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  const windows=kinds.map((k,i)=>{let energy=0;for(let j=Math.floor((0.1+i*0.9)*sr);j<Math.floor((0.6+i*0.9)*sr);j++)energy+=samples[j]**2;return {kind:k,rms:Math.sqrt(energy/(sr*0.5))};});
  const raw=new Uint8Array(samples.length*2),view=new DataView(raw.buffer);for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
  let binary='';for(let i=0;i<raw.length;i+=16384)binary+=String.fromCharCode(...raw.subarray(i,i+16384));
  return {peak,rms:Math.sqrt(sum/samples.length),windows,sampleRate:sr,pcm:btoa(binary)};
}"""

async def main():
    out=ROOT/'screens'/'audio';out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=LAUNCH_ARGS)
        page,errors=await open_match(browser,seed=3,viewport=(1440,960))
        await page.evaluate('()=>{S.sys.sceneUpdate=()=>{GameAudio.update();S.render(0);};}')
        assert await page.evaluate('GameAudio.ctx===null'),'audio created before gesture'
        print('PASS no audio context or autoplay before interaction',flush=True)
        await page.locator('#sound-settings').click()
        await page.wait_for_function('GameAudio.ctx&&GameAudio.ctx.state==="running"')
        results=await page.evaluate(CHECK)
        for r in results:print(('PASS 'if r['ok']else'FAIL ')+r['name'],flush=True)
        assert all(r['ok']for r in results),[r for r in results if not r['ok']]
        await page.locator('#sound-settings').click();await page.locator('#sound-settings').click()
        await page.screenshot(path=str(out/'desktop.png'))
        sound=await page.evaluate(AUDITION)
        assert 0.01<sound['peak']<0.95,sound['peak']
        assert all(w['rms']>0.0001 for w in sound['windows']),sound['windows']
        with wave.open(str(out/'preview.wav'),'wb')as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(sound['sampleRate']);w.writeframes(base64.b64decode(sound['pcm']))
        print('PASS all 16 sound designs render non-silent audio without clipping (peak %.3f)'%sound['peak'],flush=True)
        await page.reload();await page.wait_for_function('typeof start==="function"')
        assert await page.evaluate('GameAudio.settings.muted&&GameAudio.settings.master===48&&GameAudio.settings.effects===61&&GameAudio.ctx===null')
        print('PASS volume and mute survive reload without autoplay',flush=True)
        assert not errors,errors
        await page.close()
        for label,vp in [('portrait',(390,844)),('landscape',(844,390))]:
            page,errors=await open_match(browser,seed=3,viewport=vp,phone=True,dpr=3)
            await page.evaluate('()=>{S.sys.sceneUpdate=()=>{GameAudio.update();S.render(0);};}')
            await page.locator('#sound-settings').tap();await page.wait_for_function('GameAudio.ctx&&GameAudio.ctx.state==="running"')
            box=await page.locator('#sound-panel').bounding_box()
            assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=vp[0]+1 and box['y']+box['height']<=vp[1]+1,box
            await page.locator('#sound-toggle').tap();assert await page.evaluate('GameAudio.settings.muted')
            await page.screenshot(path=str(out/(label+'.png')))
            assert not errors,errors
            print('PASS '+label+' sound controls unlock, mute and fit the screen',flush=True)
            await page.close()
        ctx=await browser.new_context();page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.add_init_script('window.AudioContext=undefined;window.webkitAudioContext=undefined;window.__AWfreeze=true;')
        await page.route(PHASER_CDN,lambda r:r.fulfill(path=str(PHASER_LOCAL),content_type='text/javascript'))
        await page.goto((ROOT/'index.html').as_uri());await page.wait_for_function('typeof start==="function"');await page.evaluate('start("gentle")');await page.wait_for_function('G&&G.started')
        assert await page.locator('#sound-toggle').is_disabled();assert not errors,errors
        print('PASS unsupported audio leaves the game fully playable',flush=True)
        await browser.close()

if __name__=='__main__':asyncio.run(main())
