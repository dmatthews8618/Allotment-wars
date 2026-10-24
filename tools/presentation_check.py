#!/usr/bin/env python3
"""Review title, pause, results, replay and viewport changes with real browser input.
Runs offline when npm's Phaser is present. Screenshots go to screens/review/.
"""
import asyncio
from playwright.async_api import async_playwright
from harness import ROOT, PHASER_CDN, PHASER_LOCAL, LAUNCH_ARGS, SEEDED_RANDOM

async def main():
    out = ROOT / 'screens' / 'review'
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH_ARGS)
        for label, width, height, phone in [('desktop', 1440, 960, False), ('portrait', 390, 844, True), ('landscape', 844, 390, True), ('small-phone', 320, 568, True)]:
            ctx = await browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, reduced_motion='reduce')
            page = await ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.add_init_script(SEEDED_RANDOM % 4)
            await page.route(PHASER_CDN, lambda r: r.fulfill(path=str(PHASER_LOCAL), content_type='text/javascript'))
            await page.route('https://fonts.*/**', lambda r: r.abort())
            await page.goto((ROOT / 'index.html').as_uri())
            await page.wait_for_function('typeof start === "function"')
            await page.screenshot(path=str(out / f'{label}-title.png'))
            assert await page.locator('#brief').is_visible()
            if label in ('desktop', 'portrait', 'landscape'):
                assert await page.evaluate('''() => [...document.querySelectorAll('[data-diff]')].every(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })'''), 'Difficulty choices should fit without scrolling'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            # Difficulty buttons must remain reachable even on a short screen.
            for difficulty in ['gentle', 'standard', 'ruthless']:
                button = page.locator(f'[data-diff="{difficulty}"]')
                await button.scroll_into_view_if_needed()
                assert await button.is_visible()
            await page.locator('[data-diff="gentle"]').click()
            await page.wait_for_function('window.__AW && window.__AW.G.started')
            await page.wait_for_timeout(200)
            await page.evaluate('G.paused = false')
            await page.keyboard.press('p')
            assert await page.locator('#paused').is_visible()
            await page.screenshot(path=str(out / f'{label}-pause.png'))
            await page.locator('#resume').click()
            assert not await page.locator('#paused').is_visible()
            for win in [True, False]:
                # Force the actual end conditions; checkEnd must choose the result.
                await page.evaluate('''win => {
                  for (const e of G.ents) if (win ? e.team === 1 && e.bld : e.team === 0) e.dead = true;
                  checkEnd();
                }''', win)
                assert await page.locator('#over').is_visible()
                assert await page.locator('#over-title').inner_text() == ('The plot is yours' if win else 'Paved over')
                await page.wait_for_timeout(150)
                await page.screenshot(path=str(out / f'{label}-{"victory" if win else "defeat"}.png'))
                if label != 'small-phone':
                    assert await page.evaluate('''() => { const a = document.querySelector('#result-seal').getBoundingClientRect(); const b = document.querySelector('#over .row').getBoundingClientRect(); return a.top >= 0 && b.bottom <= innerHeight; }'''), 'Result emblem and actions should fit together'
                await page.locator('#again').click()
                await page.wait_for_function('window.__AW.G.started && !window.__AW.G.over')
                assert not await page.locator('#over').is_visible()
                assert await page.evaluate('G.diffKey') == 'gentle'
            # Return to the title through the real result-screen button.
            await page.evaluate('endGame(true)')
            await page.locator('#menu').click()
            assert await page.locator('#brief').is_visible()
            await page.locator('[data-diff="standard"]').click()
            await page.wait_for_function('G.diffKey === "standard" && !G.over')
            await page.set_viewport_size({'width': height, 'height': width})
            await page.wait_for_timeout(250)
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            print(f'PASS {label}: title, pause/resume, victory, defeat, replay, menu, rotation; no browser errors')
            await ctx.close()
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
