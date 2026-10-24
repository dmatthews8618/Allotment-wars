#!/usr/bin/env python3
"""Exercise facing, walking and equipment-state art through the real scene renderer."""
import asyncio
from playwright.async_api import async_playwright
from harness import LAUNCH_ARGS, open_match

SCENARIO = """() => {
  const A = window.__AW, G = A.G, sc = A.S;
  G.ai.tick = G.ai.waveT = 1e9;
  for (const e of G.ents) if (e.unit) { e.dead = true; e.spr.destroy(); e.sh.destroy(); }
  G.ents = G.ents.filter(e => !e.dead);
  for (let y = 25; y < 36; y++) for (let x = 18; x < 28; x++) {
    G.terr[idx(x,y)] = 0; G.blocked[idx(x,y)] = 0;
  }
  const checks = [];
  const expect = (label, condition) => { if (!condition) throw Error(label); checks.push(label); };
  expect('painted atlases decoded', !!paintedUnitFrames && !!paintedUnitDirections);
  for (const team of [0, 1]) for (const kind of ['fork', 'hose']) {
    const u = window.__AWadd(team, kind, 22.5*T, 32.5*T);
    for (const [direction, angle, suffix, flip] of [
      ['east', 0, '', false], ['north', -Math.PI/2, '_n', false],
      ['south', Math.PI/2, '_s', false], ['west', Math.PI, '', true],
    ]) {
      u.ang = angle; sc.render(0);
      expect(kind+' team '+team+' faces '+direction,
        u.spr.texture.key === kind+'_'+team+'_'+u.frame+suffix &&
        u.spr.rotation === 0 && u.spr.flipX === flip);
    }
    expect('health bar clears '+kind+' head', unitHealthY(u) < u.spr.getBounds().top);
    const poses = new Set();
    A.orderMove([u], 'move', 22.5*T, 28.5*T);
    for (let i=0; i<12; i++) { A.tick(.05); sc.render(.05); poses.add(u.frame); }
    expect(kind+' team '+team+' cycles walking poses while moving', poses.size === 2);
    u.dead=true;u.spr.destroy();u.sh.destroy();
    G.ents=G.ents.filter(e=>!e.dead);
  }
  for (const team of [0,1]) {
    const cart = window.__AWadd(team, 'barrow', 22.5*T, 32.5*T);
    cart.load=0;sc.render(0);const empty=cart.spr.texture.key;
    cart.load=150;sc.render(0);const full=cart.spr.texture.key;
    expect('team '+team+' cart visibly changes when loaded', empty.startsWith('barrow_') &&
      full.startsWith('barrowfull_') && iconURL(empty) !== iconURL(full));
    const launcher=window.__AWadd(team,'cata',24.5*T,32.5*T);
    launcher.fireT=0;sc.render(0);const ready=launcher.spr.texture.key;
    launcher.fireT=.6;sc.render(0);const firing=launcher.spr.texture.key;
    expect('team '+team+' launcher has distinct firing art', firing.startsWith('catafire_') && iconURL(ready)!==iconURL(firing));
    launcher.ang=-Math.PI/2;sc.render(0);
    expect('team '+team+' vehicle turns with its order', Math.abs(launcher.spr.rotation+Math.PI/2)<.001 && !launcher.spr.flipX);
  }
  return checks;
}"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH_ARGS)
        page, errors = await open_match(browser, seed=4)
        checks = await page.evaluate(SCENARIO)
        assert not errors, errors
        print(f'PASS {len(checks)} unit-art checks: cardinal facing, upright infantry, walking poses, health bars, loaded carts, firing launchers and vehicle rotation.')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
