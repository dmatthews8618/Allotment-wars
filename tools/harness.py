"""Shared set-up for the headless tools: opens the game in Chromium with a
fixed random seed and the game loop frozen, so a test drives every tick itself
and the same seed always plays out the same way."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHASER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js"
PHASER_LOCAL = ROOT / "node_modules/phaser/dist/phaser.min.js"
LAUNCH_ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]

SEEDED_RANDOM = """
(() => {
  let a = %d >>> 0;
  Math.random = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  window.__AWfreeze = true;
})();
"""


async def open_match(browser, diff="standard", seed=1, viewport=(1400, 860)):
    """Start a match and return (page, errors). The match is frozen: call
    window.__AW.tick(dt) to advance it."""
    page = await browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.add_init_script(SEEDED_RANDOM % seed)
    if PHASER_LOCAL.exists():
        await page.route(PHASER_CDN, lambda r: r.fulfill(path=str(PHASER_LOCAL), content_type="text/javascript"))
    await page.route("https://fonts.*/**", lambda r: r.abort())
    await page.goto((ROOT / "index.html").as_uri())
    await page.wait_for_function("typeof Phaser !== 'undefined' && typeof start === 'function'")
    await page.evaluate(f"start('{diff}')")
    await page.wait_for_function("window.__AW && window.__AW.G && window.__AW.G.started")
    return page, errors
