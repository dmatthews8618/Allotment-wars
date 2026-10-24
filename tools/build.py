#!/usr/bin/env python3
"""Bundle the game into one self-contained HTML file for the claude.ai artifact.

Usage:  python3 tools/build.py
Output: dist/allotment-wars.html

index.html stays the source of truth. This script copies its markup, inlines
css/style.css, and joins the src/*.js files in the order index.html loads them.
css/base.css is left out because the artifact page supplies its own reset.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
index = (ROOT / "index.html").read_text(encoding="utf-8")

title = re.search(r"<title>.*?</title>", index, re.S).group(0)
head_extras = "\n".join(
    m.group(0)
    for m in re.finditer(r'<meta name="claude:[^>]*>|<link rel="(?:preconnect|stylesheet)" href="https://[^>]*>', index)
)
body = re.search(r"<body>(.*)</body>", index, re.S).group(1)

local_js = re.findall(r'<script src="(src/[^"]+)"></script>', body)
body = re.sub(r'<script src="src/[^"]+"></script>\s*', "", body).strip()

css = (ROOT / "css/style.css").read_text(encoding="utf-8")
js = "\n\n".join(
    f"/* ===== {path} ===== */\n" + (ROOT / path).read_text(encoding="utf-8")
    for path in local_js
)

out = f"""{title}
{head_extras}
<style>
{css}</style>

{body}
<script>
(function(){{
{js}
}})();
</script>
"""

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "allotment-wars.html").write_text(out, encoding="utf-8")
print(f"Built dist/allotment-wars.html from {len(local_js)} scripts ({len(out):,} bytes)")
