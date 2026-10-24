#!/usr/bin/env python3
"""Headless playtest: plays scripted matches in Chromium and reports the results.

Setup once:  npm install            (fetches Phaser for offline testing)
             pip install playwright
Usage:       python3 tools/playtest.py            (all three difficulties)
             python3 tools/playtest.py gentle

The scripted player is deliberately simple: it builds a standard base, keeps
two wheelbarrows going, trains a mixed army and attacks after seven minutes.
It should win on Gentle; Standard is a coin toss depending on the map, and
Ruthless should beat it. Any page error fails
the run.
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHASER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js"
PHASER_LOCAL = ROOT / "node_modules/phaser/dist/phaser.min.js"

SIM = """() => {
  const A = window.__AW, G = A.G;
  const plan = ['water','bin','shed','water','tunnel','scare','water'];
  let pi = 0, attacked = false;
  for (let s = 0; s < 1500 && !G.over; s++) {
    for (let i = 0; i < 20; i++) A.tick(0.05);
    const b = G.build[0];
    if (!b && pi < plan.length) { A.clickBuild(plan[pi]); if (G.build[0]) pi++; }
    else if (b && b.ready) {
      let done = false;
      for (let r = 2; r < 12 && !done; r++)
        for (let y = 37 - r; y <= 39 + r && !done; y++)
          for (let x = 6 - r; x <= 8 + r && !done; x++)
            if (A.canPlace(0, b.kind, x, y, false)) { A.addBuilding(0, b.kind, x, y, true); G.build[0] = null; done = true; }
    }
    const harvs = G.ents.filter(e => e.team === 0 && e.d.harv).length;
    if (harvs < 2 && G.ents.some(e => e.team === 0 && e.kind === 'bin')) A.clickTrain('barrow');
    if (s % 4 === 0) { A.clickTrain('tiller'); A.clickTrain('fork'); A.clickTrain('hose'); if (s % 12 === 0) A.clickTrain('cata'); }
    const army = G.ents.filter(e => e.team === 0 && e.unit && !e.d.harv);
    const target = () => G.ents.find(e => e.team === 1 && e.kind === 'hq') || G.ents.find(e => e.team === 1 && e.bld && !e.d.wall);
    if (G.time > 420 && army.length >= 14 && !attacked) { attacked = true; const t = target(); A.orderMove(army, 'amove', t.x, t.y); }
    if (attacked && s % 15 === 0) {
      const idle = army.filter(e => !e.order && !e.target); const t = target();
      if (t && idle.length) A.orderMove(idle, 'amove', t.x, t.y);
    }
  }
  return { won: G.over ? !!G.result : null, minutes: +(G.time / 60).toFixed(1), stats: G.stats };
}"""


async def play(browser, diff):
    page = await browser.new_page(viewport={"width": 1400, "height": 860})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if PHASER_LOCAL.exists():
        await page.route(PHASER_CDN, lambda route: route.fulfill(path=str(PHASER_LOCAL), content_type="text/javascript"))
    await page.route("https://fonts.*/**", lambda route: route.abort())
    await page.goto((ROOT / "index.html").as_uri())
    await page.wait_for_timeout(500)
    await page.click(f'[data-diff="{diff}"]')
    await page.wait_for_timeout(600)
    result = await page.evaluate(SIM)
    await page.close()
    return result, errors


async def main(diffs):
    failed = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        for diff in diffs:
            result, errors = await play(browser, diff)
            outcome = {True: "won", False: "lost", None: "unfinished"}[result["won"]]
            s = result["stats"]
            print(f"{diff:9} {outcome:10} {result['minutes']:>5} min  hauled {s['harvested']:>6}  flattened {s['killed']:>3}  lost {s['lost']:>3}")
            for e in errors:
                print("   page error:", e)
                failed = True
        await browser.close()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["gentle", "standard", "ruthless"]))
