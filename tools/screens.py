#!/usr/bin/env python3
"""Screenshots and touch tests on emulated screens.

Usage:  python3 tools/screens.py          writes screens/*.png and prints touch-test results

Sets up the same mid-game battle on a desktop, a phone held upright and a phone
held sideways (both at 3x pixel density), saves a screenshot of each, then
drives the phone controls with real touch events: tap to select, double-tap,
drag to pan, pinch to zoom, box select, and two-tap building placement.
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

from harness import LAUNCH_ARGS, ROOT, open_match

OUT = ROOT / "screens"

BATTLE = """() => {
  const A = window.__AW, G = A.G;
  G.money[0] = 20000;
  const place = k => {
    A.clickBuild(k);
    if (!G.build[0]) return;
    G.build[0].t = G.build[0].total; G.build[0].ready = true;
    for (let r = 2; r < 12; r++) for (let y = 36 - r; y <= 39 + r; y++) for (let x = 5 - r; x <= 8 + r; x++)
      if (A.canPlace(0, k, x, y, false)) { A.addBuilding(0, k, x, y, true); G.build[0] = null; return; }
  };
  for (const k of ['water', 'bin', 'shed', 'water', 'tunnel', 'scare', 'hive', 'water']) place(k);
  A.clickBuild('wall'); A.wallClick(17 * 32, 30 * 32); A.wallClick(17 * 32, 37 * 32); G.placing = null;
  for (let i = 0; i < 3; i++) { A.clickTrain('fork'); A.clickTrain('hose'); A.clickTrain('tiller'); }
  for (let i = 0; i < 900; i++) A.tick(0.05);
  G.ai.waveT = 0;
  for (let i = 0; i < 640; i++) A.tick(0.05);
  const fight = G.ents.find(e => e.team === 1 && e.unit && !e.d.harv && e.spr.visible) || G.ents.find(e => e.team === 0 && e.kind === 'hq');
  A.S.cameras.main.centerOn(fight.x - 40, fight.y + 20);
  G.sel = G.ents.filter(e => e.team === 0 && e.unit && !e.d.harv).slice(0, 7);
  A.uiTick();
  drawMini();
}"""

# world -> CSS pixel position on the page, allowing for the canvas being rendered at device density
W2S = """(p) => { const S = window.__AW.S, c = S.cameras.main, r = S.game.canvas.getBoundingClientRect();
  const k = r.width / S.game.canvas.width;
  return [r.x + (p[0] - c.worldView.x) * c.zoom * k, r.y + (p[1] - c.worldView.y) * c.zoom * k]; }"""


async def touch(cdp, kind, pts):
    await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})


async def tap(cdp, pt):
    await touch(cdp, "touchStart", [pt]); await asyncio.sleep(0.05); await touch(cdp, "touchEnd", [])


async def drag(cdp, a, b, steps=8):
    await touch(cdp, "touchStart", [a])
    for i in range(1, steps + 1):
        t = i / steps
        await touch(cdp, "touchMove", [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]); await asyncio.sleep(0.02)
    await touch(cdp, "touchEnd", [])


async def touch_tests(page, results):
    cdp = await page.context.new_cdp_session(page)
    ev = page.evaluate
    ok = lambda name, cond, detail="": results.append((name, bool(cond), detail))
    await ev("() => { const G = window.__AW.G; G.paused = false; G.sel = []; const f = G.ents.find(e => e.kind === 'fork' && e.team === 0); window.__AW.S.cameras.main.centerOn(f.x, f.y); }")
    await page.wait_for_timeout(120)
    unit = await ev("() => { const f = window.__AW.G.ents.find(e => e.kind === 'fork' && e.team === 0); return [f.x + 9, f.y + 7]; }")
    sp = await ev(W2S, unit)
    view0 = await ev("() => [window.__AW.S.cameras.main.scrollX, window.__AW.S.cameras.main.scrollY]")
    await tap(cdp, sp); await page.wait_for_timeout(80)
    sel = await ev("() => window.__AW.G.sel.map(e => e.kind)")
    view1 = await ev("() => [window.__AW.S.cameras.main.scrollX, window.__AW.S.cameras.main.scrollY]")
    ok("tap near a small unit selects it", sel == ["fork"], str(sel))
    ok("tapping a unit doesn't move the camera", view0 == view1)
    await ev("() => { window.__AW.G.sel = []; window.__AW.G.lastPick = null; }")
    # Double-tap timing can't be tested with emulated touches (they arrive a frame apart), so check the logic directly.
    kinds = await ev("""() => { const A = window.__AW, G = A.G; const f = G.ents.filter(e => e.kind === 'hose' && e.team === 0);
        A.S.cameras.main.centerOn(f[0].x, f[0].y); f[1].x = f[0].x + 30; f[1].y = f[0].y;
        G.sel = []; G.lastPick = null;
        leftClick(f[0].x, f[0].y, false, true, 1000); leftClick(f[0].x, f[0].y, false, true, 1250);
        return G.sel.map(e => e.kind); }""")
    ok("double-tap selects all of that kind on screen", len(kinds) > 1 and set(kinds) == {"hose"}, str(kinds))
    unit = await ev("() => { const u = window.__AW.G.sel[0]; return [u.x, u.y]; }")
    # open ground that is on screen and not under any of the HUD
    ground = await ev("""(u) => { const S = window.__AW.S, c = S.cameras.main, cv = S.game.canvas, r = cv.getBoundingClientRect(), k = r.width / cv.width;
        for (let rr = 3; rr < 9; rr++) for (let a = 0; a < 16; a++) {
          const x = u[0] + Math.cos(a * 0.4) * rr * 32, y = u[1] + Math.sin(a * 0.4) * rr * 32;
          const i = Math.floor(y / 32) * 64 + Math.floor(x / 32);
          const sx = r.x + (x - c.worldView.x) * c.zoom * k, sy = r.y + (y - c.worldView.y) * c.zoom * k;
          if (!pick(x, y, 20) && !window.__AW.G.blocked[i] && window.__AW.G.vis[i] === 2 && document.elementFromPoint(sx, sy) === cv) return [x, y]; } }""", unit)
    await tap(cdp, await ev(W2S, ground)); await page.wait_for_timeout(80)
    orders = await ev("() => window.__AW.G.sel.map(e => e.order && e.order.type)")
    ok("tapping open ground moves the selection", orders and all(o == "move" for o in orders), str(orders))
    box = await ev("() => window.__AW.S.game.canvas.getBoundingClientRect().toJSON()")
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    before = await ev("() => [window.__AW.S.cameras.main.scrollX, window.__AW.G.sel.length]")
    await drag(cdp, (cx, cy), (cx - 80, cy - 60))
    after = await ev("() => [window.__AW.S.cameras.main.scrollX, window.__AW.G.sel.length]")
    ok("dragging pans without giving orders or changing selection", after[0] > before[0] + 30 and after[1] == before[1], f"{before} -> {after}")
    z0 = await ev("() => window.__AW.S.cameras.main.zoom")
    await touch(cdp, "touchStart", [(cx - 40, cy), (cx + 40, cy)])
    for i in range(1, 8):
        await touch(cdp, "touchMove", [(cx - 40 - i * 10, cy), (cx + 40 + i * 10, cy)]); await asyncio.sleep(0.02)
    await touch(cdp, "touchEnd", [])
    z1 = await ev("() => window.__AW.S.cameras.main.zoom")
    ok("pinch zooms in", z1 > z0 * 1.3, f"{z0:.2f} -> {z1:.2f}")
    await ev("() => { const A = window.__AW; A.G.sel = []; const u = A.G.ents.filter(e => e.kind === 'fork' && e.team === 0); A.S.cameras.main.setZoom(A.S.cameras.main.zoom / 1.8 * 1); A.S.cameras.main.centerOn(u[0].x, u[0].y); A.uiTick(); }")
    await page.wait_for_timeout(100)
    await page.tap('[data-cmd="box"]')
    corners = await ev("() => { const v = window.__AW.S.cameras.main.worldView; const u = window.__AW.G.ents.filter(e => e.unit && e.team === 0 && !e.d.harv && v.contains(e.x - 40, e.y - 40) && v.contains(e.x + 40, e.y + 40)); const xs = u.map(e => e.x), ys = u.map(e => e.y); return [Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30]; }")
    await drag(cdp, await ev(W2S, corners[:2]), await ev(W2S, corners[2:]))
    n = await ev("() => window.__AW.G.sel.length")
    ok("Box then drag selects a group", n >= 3, f"{n} selected")
    await ev("() => { const A = window.__AW, G = A.G; G.sel = []; G.money[0] = 5000; A.clickBuild('water'); G.build[0].t = G.build[0].total; G.build[0].ready = true; const h = G.ents.find(e => e.kind === 'hq' && e.team === 0); A.S.cameras.main.centerOn(h.x, h.y); A.uiTick(); }")
    await page.tap('#b-water'); await page.wait_for_timeout(80)
    count = "() => window.__AW.G.ents.filter(e => e.kind === 'water' && e.team === 0).length"
    n0 = await ev(count)
    spot = await ev("() => { const A = window.__AW; for (let r = 2; r < 9; r++) for (let y = 37 - r; y <= 39 + r; y++) for (let x = 5 - r; x <= 8 + r; x++) if (A.canPlace(0, 'water', x, y, false)) return [(x + 1) * 32, (y + 1) * 32]; }")
    t = await ev(W2S, spot)
    await tap(cdp, t); await page.wait_for_timeout(120)
    mid = await ev(count)
    await tap(cdp, t); await page.wait_for_timeout(120)
    n1 = await ev(count)
    ok("planting takes two taps: outline, then confirm", mid == n0 and n1 == n0 + 1, f"{n0} -> {mid} -> {n1}")


async def main():
    OUT.mkdir(exist_ok=True)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH_ARGS)
        for name, vp, phone, dpr in [("desktop", (1400, 860), False, 1), ("phone-portrait", (390, 844), True, 3), ("phone-landscape", (844, 390), True, 3)]:
            page, errors = await open_match(browser, "standard", seed=4, viewport=vp, phone=phone, dpr=dpr)
            await page.evaluate(BATTLE)
            await page.wait_for_timeout(400)
            await page.screenshot(path=str(OUT / f"{name}.png"))
            overflow = await page.evaluate("() => document.documentElement.scrollWidth > innerWidth")
            results.append((f"{name}: no sideways page scroll", not overflow, ""))
            canvas = await page.evaluate("() => { const c = window.__AW.S.game.canvas, r = c.getBoundingClientRect(); return [c.width, Math.round(r.width)]; }")
            if phone:
                results.append((f"{name}: canvas renders at high density", canvas[0] >= canvas[1] * 2 - 2, f"{canvas[0]} pixels across {canvas[1]} points"))
                await touch_tests(page, results)
            for e in errors:
                results.append((f"{name}: page error", False, e))
            await page.context.close()
        await browser.close()
    failed = 0
    for name, good, detail in results:
        failed += not good
        print(f"{'PASS' if good else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
    print(f"\nScreenshots in {OUT.relative_to(ROOT)}/")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
