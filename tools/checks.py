#!/usr/bin/env python3
"""Behaviour checks: small set-piece scenarios that must always come out the
same way. Each one fails loudly if a rule of the game is broken.

Usage:  python3 tools/checks.py
"""
import asyncio
import sys

from playwright.async_api import async_playwright

from harness import LAUNCH_ARGS, open_match

# Isolate set-pieces from randomly positioned enemy defences and freeze the AI.
PREP = """
const A = window.__AW, G = A.G;
G.ai.tick = 1e9; G.ai.waveT = 1e9;
for (const e of G.ents) if (e.unit || (e.team === 1 && e.bld && e.kind !== 'hq')) { e.dead = true; e.spr.destroy(); e.sh && e.sh.destroy(); if (e.bld) clearFootprint(e); }
G.ents = G.ents.filter(e => !e.dead);
const at = (x, y) => [x * 32 + 16, y * 32 + 16];
const clear = (x0, y0, x1, y1) => {           // flatten terrain so the set-piece is the same on every map
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * MW + x; G.terr[i] = 0; G.blocked[i] = 0;
    if (G.heapAt[i] >= 0) { const h = G.heaps[G.heapAt[i]]; h.amount = 0; G.heapAt[i] = -1; if (h.spr) { h.spr.destroy(); h.spr = null; } }
  }
};
const run = secs => { for (let i = 0; i < secs * 20; i++) A.tick(0.05); };
const tileBlockedFor = (u) => { const i = Math.floor(u.y / 32) * MW + Math.floor(u.x / 32); return G.blocked[i] && G.gateTeam[i] !== u.team; };
"""

CHECKS = {
    "units route round a building planted across their path": """
      clear(10, 27, 20, 46);
      const u = window.__AWadd(0, 'fork', ...at(15, 28));
      A.orderMove([u], 'move', ...at(15, 45));
      run(1);
      A.addBuilding(0, 'tunnel', 14, 33, false);          // drops a 3x3 polytunnel right across the route
      let inside = 0;
      for (let i = 0; i < 400; i++) { A.tick(0.05); if (tileBlockedFor(u)) inside++; }
      const arrived = Math.hypot(u.x - at(15, 45)[0], u.y - at(15, 45)[1]) < 40;
      return { pass: inside === 0 && arrived, detail: `ticks inside building: ${inside}, arrived: ${arrived}` };
    """,
    "units never stand inside an enemy fence they are breaking": """
      clear(10, 27, 20, 46);
      for (let y = 27; y <= 46; y++) A.addBuilding(1, 'wall', 15, y, false);
      const u = window.__AWadd(0, 'tiller', ...at(12, 36));
      A.orderMove([u], 'move', ...at(18, 36));
      let inside = 0;
      for (let i = 0; i < 1200; i++) { A.tick(0.05); if (tileBlockedFor(u)) inside++; }
      const through = u.x > 16 * 32;
      return { pass: inside === 0 && through, detail: `ticks inside fence: ${inside}, got through: ${through}` };
    """,
    "catapults respect their minimum range when breaking fences": """
      clear(10, 27, 20, 46);
      for (let y = 27; y <= 46; y++) A.addBuilding(1, 'wall', 15, y, false);
      const u = window.__AWadd(0, 'cata', ...at(14, 36));   // starts right up against the fence
      A.orderMove([u], 'move', ...at(18, 36));
      const min = u.d.minRange * 32, close = [];
      const realFire = window.fire;
      window.fire = (e, t) => { if (e === u) { const d = A.G && distTo(e, t); if (d < min) close.push(Math.round(d)); } return realFire(e, t); };
      run(60);
      window.fire = realFire;
      const breached = G.ents.filter(e => e.kind === 'wall' && e.team === 1).length < 20;
      return { pass: close.length === 0 && breached, detail: `shots inside minimum range: ${close.length}${close.length ? ' (' + close.slice(0, 3).join(', ') + 'px)' : ''}, fence breached: ${breached}` };
    """,
    "own troops walk through their gate without damaging it": """
      clear(10, 27, 20, 46);
      for (let y = 27; y <= 46; y++) A.addBuilding(0, y === 36 ? 'gate' : 'wall', 15, y, false);
      const gate = G.ents.find(e => e.kind === 'gate');
      const u = window.__AWadd(0, 'fork', ...at(12, 36));
      A.orderMove([u], 'move', ...at(18, 36));
      run(10);
      return { pass: u.x > 16 * 32 && gate.hp === gate.maxHp, detail: `got through: ${u.x > 16 * 32}, gate health: ${Math.round(gate.hp)}/${gate.maxHp}` };
    """,
    "enemy troops cannot walk through a gate": """
      clear(10, 27, 20, 46);
      for (let y = 27; y <= 46; y++) A.addBuilding(0, y === 36 ? 'gate' : 'wall', 15, y, false);
      const u = window.__AWadd(1, 'fork', ...at(18, 36));
      u.order = { type: 'move', x: at(12, 36)[0], y: at(12, 36)[1] }; window.setPath(u, ...at(12, 36));
      let inside = 0;
      for (let i = 0; i < 100; i++) { A.tick(0.05); if (tileBlockedFor(u)) inside++; }
      return { pass: inside === 0 && u.x > 15 * 32, detail: `ticks inside gate: ${inside}, still outside: ${u.x > 15 * 32}` };
    """,
    "wheelbarrows don't pay into a bin destroyed mid-unload": """
      clear(4, 27, 20, 46);
      const bin = A.addBuilding(0, 'bin', 12, 30, false);
      const b = window.__AWadd(0, 'barrow', ...at(13, 32));
      b.load = 300; b.bin = bin; b.hs = 'unload'; b.ht = 1.2;
      const before = G.money[0];
      run(0.5);
      window.damage(bin, 99999, 'cata', null);
      run(2);
      return { pass: G.money[0] === before && b.load === 300, detail: `compost credited: ${G.money[0] - before}, still carrying: ${b.load}` };
    """,
    "wheelbarrows still unload into a healthy bin": """
      clear(4, 27, 20, 46);
      const bin = A.addBuilding(0, 'bin', 12, 30, false);
      const b = window.__AWadd(0, 'barrow', ...at(13, 32));
      b.load = 300; b.bin = bin; b.hs = 'unload'; b.ht = 1.2;
      const before = G.money[0];
      run(2);
      return { pass: G.money[0] > before && b.load === 0, detail: `compost credited: ${G.money[0] - before}` };
    """,
}


async def main():
    failed = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH_ARGS)
        for name, body in CHECKS.items():
            page, errors = await open_match(browser, "standard", seed=7)
            try:
                res = await page.evaluate("() => {" + PREP + body + "}")
            except Exception as e:
                res = {"pass": False, "detail": f"crashed: {str(e).splitlines()[0]}"}
            ok = res["pass"] and not errors
            failed += not ok
            print(f"{'PASS' if ok else 'FAIL'}  {name}\n      {res['detail']}")
            for e in errors:
                print("      page error:", e)
            await page.close()
        await browser.close()
    print(f"\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
