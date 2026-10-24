// Random map generator. Maps are mirrored so both sides get a fair start.
'use strict';

/* ---------------- map ---------------- */
function genMap(seed) {
  for (let a = 0; a < 60; a++) {
    const m = tryMap(seed + a * 7919);
    if (m) return m;
  }
  throw new Error('map');
}
function tryMap(seed) {
  const R = mulberry32(seed),
    terr = new Uint8Array(MW * MH);
  const set = (x, y, v) => {
    if (!inb(x, y)) return;
    terr[idx(x, y)] = v;
    terr[idx(MW - 1 - x, MH - 1 - y)] = v;
  };
  const g = () => (R() + R() + R() - 1.5) / 1.5;
  const nearBase = (x, y, d) => Math.hypot(x - 10, y - 38) < d || Math.hypot(x - (MW - 11), y - 9) < d;
  let placed = 0,
    tries = 0;
  const nP = Math.round(((3 + ((R() * 2) | 0)) * MW) / 64);
  while (placed < nP && tries++ < 60) {
    const cx = 16 + R() * (MW - 32),
      cy = 6 + R() * 36;
    if (nearBase(cx, cy, 15)) continue;
    const r = 1.8 + R() * 2;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (Math.hypot(x - cx, (y - cy) * 1.15) < r + (R() - 0.5) * 0.8) set(x, y, 2);
      }
    placed++;
  }
  const nH = Math.round(((5 + ((R() * 3) | 0)) * MW) / 64);
  for (let i = 0; i < nH; i++) {
    const hx = 12 + ((R() * (MW - 24)) | 0),
      hy = 4 + ((R() * 40) | 0);
    if (nearBase(hx, hy, 13)) continue;
    const len = 4 + ((R() * 6) | 0),
      hor = R() < 0.5;
    for (let k = 0; k < len; k++) set(hor ? hx + k : hx, hor ? hy : hy + k, 3);
  }
  for (let y = 26; y <= 46; y++) for (let x = 1; x <= 21; x++) set(x, y, 0);
  const P = [
    [9, 37],
    [MW * 0.32 + R() * 6, 26 + R() * 6],
    [MW * 0.6 + R() * 6, 16 + R() * 6],
    [MW - 10, 10],
  ];
  for (let t = 0; t <= 1; t += 0.003) {
    const u = 1 - t;
    const x = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
    const y = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
    const tx = Math.round(x),
      ty = Math.round(y);
    if (inb(tx, ty) && terr[idx(tx, ty)] !== 2 && terr[idx(tx, ty)] !== 3) set(tx, ty, 1);
  }
  for (let i = 0; i < 7; i++) {
    const bx = 3 + ((R() * 15) | 0),
      by = 28 + ((R() * 16) | 0);
    if (Math.hypot(bx - 6, by - 39) < 4) continue;
    const hor = R() < 0.6;
    for (let k = 0; k < 3; k++) {
      const x = hor ? bx + k : bx,
        y = hor ? by : by + k;
      if (inb(x, y) && terr[idx(x, y)] === 0) terr[idx(x, y)] = 4;
    }
  }
  for (let x = 0; x < MW; x++) {
    terr[idx(x, 0)] = 3;
    terr[idx(x, MH - 1)] = 3;
  }
  for (let y = 0; y < MH; y++) {
    terr[idx(0, y)] = 3;
    terr[idx(MW - 1, y)] = 3;
  }
  for (let y = 1; y <= 20; y++)
    for (let x = MW - 22; x <= MW - 2; x++) if (terr[idx(x, y)] === 0) terr[idx(x, y)] = 5;
  const tmpl = new Uint8Array(MW * MH);
  for (const [k, x, y] of [...TEMPLATE, ...DEF_TEMPLATE]) {
    const d = BLDS[k];
    for (let yy = y - 1; yy <= y + d.h; yy++)
      for (let xx = x - 1; xx <= x + d.w; xx++) {
        if (inb(xx, yy)) {
          tmpl[idx(xx, yy)] = 1;
          tmpl[idx(MW - 1 - xx, MH - 1 - yy)] = 1;
        }
      }
  }
  for (const [x, y] of [
    [10, 44],
    [11, 44],
    [12, 44],
  ])
    tmpl[idx(x, y)] = 1;
  const heaps = [],
    heapAt = new Int16Array(MW * MH).fill(-1);
  const add = (x, y, a) => {
    heapAt[idx(x, y)] = heaps.length;
    heaps.push({ tx: x, ty: y, amount: a, max: a, spr: null });
  };
  const field = (cx, cy, n, a) => {
    let c = 0,
      tr = 0;
    while (c < n && tr++ < 300) {
      const x = Math.round(cx + g() * 2.6),
        y = Math.round(cy + g() * 2.6);
      if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) continue;
      const t = terr[idx(x, y)];
      if (t === 2 || t === 3) continue;
      const mx = MW - 1 - x,
        my = MH - 1 - y;
      if (heapAt[idx(x, y)] >= 0 || tmpl[idx(x, y)] || tmpl[idx(mx, my)] || heapAt[idx(mx, my)] >= 0)
        continue;
      add(x, y, a);
      add(mx, my, a);
      c++;
    }
  };
  field(19, 43, 8, 500);
  field(7, 28, 7, 500);
  field(Math.round(MW * 0.40625), 21, 9, 800);
  // Additional mirrored expansion fields reward moving into the wider centre.
  field(Math.round(MW * 0.47), 34, 6, 600);
  const seen = new Uint8Array(MW * MH),
    q = [idx(10, 44)];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop(),
      cx = c % MW,
      cy = (c / MW) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (seen[n]) continue;
      const t = terr[n];
      if (t === 2 || t === 3) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  if (!seen[idx(MW - 11, 3)]) return null;
  for (const h of heaps) if (!seen[idx(h.tx, h.ty)]) return null;
  return { terr, heaps, heapAt };
}
