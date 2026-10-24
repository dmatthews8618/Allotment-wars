// Fog of war.
'use strict';

/* ---------------- vision ---------------- */
function updVis() {
  const v = G.vis;
  for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
  for (const e of G.ents) {
    if (e.dead || e.team !== 0) continue;
    const r = e.bld ? e.d.sight + Math.max(e.w, e.h) / 2 : e.d.sight;
    const cx = e.x / T,
      cy = e.y / T,
      r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!inb(x, y)) continue;
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) v[idx(x, y)] = 2;
      }
  }
  if (G.headless) return;
  const D = G.fogImg.data;
  for (let i = 0; i < v.length; i++) {
    // Opaque, quiet green fog; a coordinate-only grain never reveals hidden terrain.
    const grain = (i * 17 + (i % MW) * 7) % 5;
    D[i * 4] = 17 + grain;
    D[i * 4 + 1] = 30 + grain;
    D[i * 4 + 2] = 26 + grain;
    D[i * 4 + 3] = v[i] === 0 ? 255 : v[i] === 1 ? 140 : 0;
  }
  G.fogCtx.putImageData(G.fogImg, 0, 0);
  G.fogTex.refresh();
  for (const e of G.ents) {
    if (e.dead || e.team !== 1) continue;
    const vis = e.bld ? seenByPlayer(e) : visibleToPlayer(e);
    e.spr.setVisible(vis);
    if (e.sh) e.sh.setVisible(vis);
  }
}
