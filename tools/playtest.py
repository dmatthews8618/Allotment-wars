#!/usr/bin/env python3
"""Balance playtest: a simple scripted player plays fixed-seed matches on each
difficulty, and the run fails if the results land outside the expected range.

Setup once:  npm install            (fetches Phaser for offline testing)
             pip install playwright
Usage:       python3 tools/playtest.py              all difficulties, seeds 1-3
             python3 tools/playtest.py gentle       one difficulty
             python3 tools/playtest.py --seeds 4,5  other maps

The scripted player builds a standard base, keeps two wheelbarrows going,
leaves access lanes between buildings, trains a mixed army and attacks after seven minutes. A beginner who does that
should beat Gentle, Ruthless should beat them, and Standard is reported but
not enforced. The same seed always plays out the same way, so a failure can be
replayed. Any page error also fails the run.
"""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

from harness import LAUNCH_ARGS, open_match

EXPECT = {"gentle": True, "standard": None, "ruthless": False}   # True = player must win, False = must lose, None = report only

SIM = """() => {
  const A = window.__AW, G = A.G;
  const plan = ['water','bin','shed','water','tunnel','scare','water'];
  let pi = 0, attacked = false;
  const timeline = [];
  for (let s = 0; s < 1500 && !G.over; s++) {
    if (s % 60 === 0) timeline.push({time: Math.round(G.time), money: Math.round(G.money[0]),
      army: G.ents.filter(e=>e.team===0&&e.unit&&!e.d.harv).map(e=>e.kind),
      enemyArmy: G.ents.filter(e=>e.team===1&&e.unit&&!e.d.harv).length,
      workers: G.ents.filter(e=>e.team===0&&e.d.harv).map(e=>({state:e.hs,hp:Math.round(e.hp),x:Math.round(e.x/32),y:Math.round(e.y/32)})),
      harvested: G.stats.harvested, attacked});
    for (let i = 0; i < 20; i++) A.tick(0.05);
    const b = G.build[0];
    if (!b && pi < plan.length) { A.clickBuild(plan[pi]); if (G.build[0]) pi++; }
    else if (b && b.ready) {
      let done = false;
      for (let r = 2; r < 12 && !done; r++)
        for (let y = PLAYER_START.y - 1 - r; y <= PLAYER_START.y + 1 + r && !done; y++)
          for (let x = 6 - r; x <= 8 + r && !done; x++)
            if (A.canPlace(0, b.kind, x, y, false) && !G.ents.some(e => e.bld && !e.dead && x < e.tx + e.d.w + 1 && x + BLDS[b.kind].w + 1 > e.tx && y < e.ty + e.d.h + 1 && y + BLDS[b.kind].h + 1 > e.ty)) { A.addBuilding(0, b.kind, x, y, true); G.build[0] = null; done = true; }
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
  return { won: G.over ? !!G.result : null, minutes: +(G.time / 60).toFixed(1), stats: G.stats, mapSeed: G.seed, enemyStart: G.enemyStart, timeline };
}"""


async def main(diffs, seeds):
    failed = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH_ARGS)
        for diff in diffs:
            for seed in seeds:
                print(f'Testing {diff} seed {seed}', flush=True)
                page, errors = await open_match(browser, diff, seed)
                r = await page.evaluate(SIM)
                await page.close()
                want = EXPECT[diff]
                ok = not errors and (want is None or r["won"] is want)
                failed += not ok
                outcome = {True: "won", False: "lost", None: "unfinished"}[r["won"]]
                s = r["stats"]
                flag = "    " if want is None else ("ok  " if ok else "FAIL")
                print(f"{flag} {diff:9} seed {seed:<3} {outcome:10} {r['minutes']:>5} min  "
                      f"hauled {s['harvested']:>6}  flattened {s['killed']:>3}  lost {s['lost']:>3}")
                print(f"     map {r['mapSeed']} · enemy {r['enemyStart']['zone']} ({r['enemyStart']['x']}, {r['enemyStart']['y']})", flush=True)
                if not ok:
                    print('     timeline: ' + json.dumps(r['timeline']), flush=True)
                for e in errors:
                    print("     page error:", e)
        await browser.close()
    print("\nAll balance expectations met." if not failed else f"\n{failed} run(s) outside expectations.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    args = sys.argv[1:]
    seeds = [1, 2, 3]
    if "--seeds" in args:
        i = args.index("--seeds")
        seeds = [int(x) for x in args[i + 1].split(",")]
        del args[i:i + 2]
    asyncio.run(main(args or list(EXPECT), seeds))
