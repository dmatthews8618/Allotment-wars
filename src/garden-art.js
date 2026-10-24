// Painted materials and garden sprites, baked into a single terrain texture.
// Connected fences and swinging gates are composited from measured geometry.
'use strict';

let gardenArt = null;
const GARDEN_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const GARDEN_MATERIALS = ['grass', 'lawn', 'soil', 'gravel'];
const GARDEN_SPRITES = {
  cabbage: [0, 328, 313, 307],
  carrots: [314, 320, 313, 316],
  pumpkinPlant: [630, 335, 314, 301],
  beans: [956, 321, 298, 316],
  stones: [5, 651, 298, 269],
  puddle: [315, 675, 310, 243],
  daisies: [635, 654, 294, 277],
  hedge: [946, 644, 308, 300],
  leaves: [0, 956, 308, 298],
  violets: [317, 957, 310, 297],
  ivy: [634, 945, 307, 309],
  pots: [967, 985, 287, 269],
};

function prepareGardenArt() {
  if (gardenArt || !S.textures.exists('painted-garden')) return;
  const atlas = S.textures.get('painted-garden').getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = atlas.width;
  cv.height = atlas.height;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(atlas, 0, 0);
  const pixels = c.getImageData(0, 0, cv.width, cv.height).data;
  gardenArt = { atlas, materials: {}, sprites: {} };
  GARDEN_MATERIALS.forEach((name, col) => {
    // A reflected 2x2 repeat matches all four outer edges exactly, even if the
    // generated material swatch itself is not perfectly seamless.
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    tile
      .getContext('2d')
      .drawImage(
        atlas,
        ((col + 0.09) * cv.width) / 4,
        (0.09 * cv.height) / 4,
        (0.82 * cv.width) / 4,
        (0.82 * cv.height) / 4,
        0,
        0,
        128,
        128
      );
    const repeat = document.createElement('canvas');
    repeat.width = repeat.height = 256;
    const r = repeat.getContext('2d');
    for (const [x, y, sx, sy] of [
      [0, 0, 1, 1],
      [256, 0, -1, 1],
      [0, 256, 1, -1],
      [256, 256, -1, -1],
    ]) {
      r.save();
      r.translate(x, y);
      r.scale(sx, sy);
      r.drawImage(tile, 0, 0);
      r.restore();
    }
    gardenArt.materials[name] = repeat;
  });
  Object.entries(GARDEN_SPRITES).forEach(([name, [rx, ry, rw, rh]]) => {
    const x0 = Math.round((rx * cv.width) / 1254),
      x1 = Math.round(((rx + rw) * cv.width) / 1254);
    const y0 = Math.round((ry * cv.height) / 1254),
      y1 = Math.round(((ry + rh) * cv.height) / 1254);
    let l = x1,
      t = y1,
      r = x0,
      b = y0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (pixels[(y * cv.width + x) * 4 + 3] < 16) continue;
        l = Math.min(l, x);
        t = Math.min(t, y);
        r = Math.max(r, x + 1);
        b = Math.max(b, y + 1);
      }
    gardenArt.sprites[name] = r > l && b > t ? [l, t, r - l, b - t] : [x0, y0, x1 - x0, y1 - y0];
  });
}

function gardenPattern(c, material) {
  return c.createPattern(gardenArt.materials[material], 'repeat');
}

function gardenStamp(c, name, x, y, w, h, rotation = 0, alpha = 1) {
  const rect = gardenArt && gardenArt.sprites[name];
  if (!rect) return;
  const [sx, sy, sw, sh] = rect,
    k = Math.min(w / sw, h / sh);
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.globalAlpha *= alpha;
  c.drawImage(gardenArt.atlas, sx, sy, sw, sh, (-sw * k) / 2, (-sh * k) / 2, sw * k, sh * k);
  c.restore();
}

function gardenBedRegions() {
  const seen = new Uint8Array(MW * MH),
    regions = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || G.terr[i] !== 4) continue;
    const region = [],
      queue = [i];
    seen[i] = 1;
    while (queue.length) {
      const n = queue.pop();
      region.push(n);
      const x = n % MW,
        y = Math.floor(n / MW);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!inb(x + dx, y + dy)) continue;
        const next = idx(x + dx, y + dy);
        if (!seen[next] && G.terr[next] === 4) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    regions.push(region);
  }
  return regions;
}

function drawPaintedGardenTerrain() {
  const cv = document.createElement('canvas');
  cv.width = WW;
  cv.height = WH;
  const c = cv.getContext('2d'),
    R = mulberry32(G.seed ^ 0x47ad31);
  const at = (x, y) => (inb(x, y) ? G.terr[idx(x, y)] : 3);
  c.fillStyle = '#466d3d';
  c.fillRect(0, 0, WW, WH);
  c.save();
  c.globalAlpha = 0.34;
  c.scale(0.5, 0.5);
  c.fillStyle = gardenPattern(c, 'grass');
  c.fillRect(0, 0, WW * 2, WH * 2);
  c.restore();
  for (let i = 0; i < 480; i++) {
    const x = R() * WW,
      y = R() * WH,
      r = 28 + R() * 110;
    c.fillStyle = rad(c, x, y, r, [i % 2 ? 'rgba(26,57,35,.11)' : 'rgba(192,197,123,.09)', 'rgba(0,0,0,0)']);
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.fillStyle = gardenPattern(c, 'lawn');
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) if (at(x, y) === 5) c.fillRect(x * T, y * T, T, T);
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++)
      if (at(x, y) === 5) {
        c.fillStyle = Math.floor(x / 2) % 2 ? 'rgba(210,219,155,.055)' : 'rgba(20,49,29,.055)';
        c.fillRect(x * T, y * T, T, T);
      }

  // Timber-edged beds share soil and a crop type across connected tiles.
  const soil = gardenPattern(c, 'soil');
  gardenBedRegions().forEach((region, number) => {
    const crop = (number + ((G.seed >>> 0) % 4)) % 4;
    for (const n of region) {
      const x = (n % MW) * T,
        y = Math.floor(n / MW) * T;
      c.fillStyle = 'rgba(20,28,16,.5)';
      c.fillRect(x - 3, y - 1, T + 7, T + 6);
    }
    for (const n of region) {
      const tx = n % MW,
        ty = Math.floor(n / MW),
        x = tx * T,
        y = ty * T;
      c.fillStyle = soil;
      c.fillRect(x, y, T, T);
      for (let yy = 7; yy < T; yy += 10) {
        line(c, x + 2, y + yy, x + T - 2, y + yy, 'rgba(15,13,8,.4)', 2);
        line(c, x + 2, y + yy - 2, x + T - 2, y + yy - 2, 'rgba(177,132,78,.18)', 1);
      }
      if (crop === 3) gardenStamp(c, 'beans', x + 16, y + 15, 22, 27);
      else if (crop === 2) {
        gardenStamp(c, 'pumpkinPlant', x + 9, y + 16, 18, 20, -0.15);
        gardenStamp(c, 'pumpkinPlant', x + 25, y + 17, 17, 19, 0.3);
      } else
        for (const [xx, yy] of [
          [8, 8],
          [24, 8],
          [8, 24],
          [24, 24],
        ])
          gardenStamp(c, crop === 0 ? 'cabbage' : 'carrots', x + xx, y + yy, 14, 14, (R() - 0.5) * 0.6);
      for (const [dx, dy, ax, ay, bx, by] of [
        [0, -1, 0, 0, T, 0],
        [0, 1, 0, T, T, T],
        [-1, 0, 0, 0, 0, T],
        [1, 0, T, 0, T, T],
      ]) {
        if (at(tx + dx, ty + dy) === 4) continue;
        line(c, x + ax + 1, y + ay + 2, x + bx + 1, y + by + 2, '#2b2c1b', 4);
        line(c, x + ax, y + ay, x + bx, y + by, '#8d7047', 3);
        line(c, x + ax - 0.5, y + ay - 0.8, x + bx - 0.5, y + by - 0.8, '#bd9e66', 0.8);
        circ(c, x + ax, y + ay, 1, '#4b4430');
      }
    }
    const first = region[0];
    gardenStamp(c, 'pots', (first % MW) * T + 5, Math.floor(first / MW) * T + 5, 9, 10, 0, 0.9);
  });

  // Build a continuous mask, then fill it with gravel. Terrain connectivity and
  // every walkable/blocked tile remain exactly as supplied by the map generator.
  const path = document.createElement('canvas');
  path.width = WW;
  path.height = WH;
  const p = path.getContext('2d');
  const segments = [];
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++)
      if (at(x, y) === 1) {
        segments.push([x, y, x + 0.001, y]);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 1],
        ])
          if (at(x + dx, y + dy) === 1) segments.push([x, y, x + dx, y + dy]);
      }
  const band = (ctx, width, color) => {
    ctx.beginPath();
    for (const [x, y, xx, yy] of segments) {
      ctx.moveTo((x + 0.5) * T, (y + 0.5) * T);
      ctx.lineTo((xx + 0.5) * T, (yy + 0.5) * T);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  band(c, T * 1.28, 'rgba(37,52,27,.35)');
  band(c, T * 1.15, 'rgba(114,102,58,.6)');
  band(p, T * 1.02, '#b39d70');
  p.globalCompositeOperation = 'source-in';
  p.save();
  p.scale(0.5, 0.5);
  p.fillStyle = gardenPattern(p, 'gravel');
  p.fillRect(0, 0, WW * 2, WH * 2);
  p.restore();
  p.globalCompositeOperation = 'source-atop';
  p.fillStyle = 'rgba(164,144,103,.25)';
  p.fillRect(0, 0, WW, WH);
  band(p, T * 0.45, 'rgba(210,190,143,.16)');
  // Two quiet wear lines, rather than a perfectly even strip of gravel.
  p.save();
  p.translate(-3, 0);
  band(p, 2, 'rgba(83,65,37,.13)');
  p.restore();
  p.save();
  p.translate(3, 0);
  band(p, 2, 'rgba(83,65,37,.13)');
  p.restore();
  c.drawImage(path, 0, 0);

  const ponds = [];
  for (let i = 0; i < MW * MH; i++) if (G.terr[i] === 2) ponds.push(i);
  const waterShape = (ctx, color, inset = 0) => {
    ctx.beginPath();
    for (const n of ponds) {
      const x = n % MW,
        y = Math.floor(n / MW),
        cx = (x + 0.5) * T,
        cy = (y + 0.5) * T;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 0.01, cy);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ])
        if (at(x + dx, y + dy) === 2) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * T, cy + dy * T);
        }
    }
    ctx.lineWidth = T * 1.6 - inset * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  // Union-shaped banks avoid a separate circular rim around every pond tile.
  c.save();
  c.shadowColor = 'rgba(16,31,22,.45)';
  c.shadowBlur = 8;
  c.shadowOffsetY = 4;
  waterShape(c, '#756b43');
  c.restore();
  waterShape(c, '#467b78', 3);
  for (const n of ponds) {
    const tx = n % MW,
      ty = Math.floor(n / MW),
      x = tx * T,
      y = ty * T;
    let deep = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(tx + dx, ty + dy) === 2) deep++;
    if (deep === 9) {
      c.fillStyle = rad(c, x + 16, y + 16, 28, ['rgba(29,73,78,.38)', 'rgba(29,73,78,0)']);
      c.fillRect(x - 12, y - 12, 56, 56);
    }
    if (R() < 0.45) ell(c, x + 8 + R() * 16, y + 8 + R() * 16, 7 + R() * 6, 1.2, 'rgba(204,228,199,.22)');
    if (R() < 0.14) {
      ell(c, x + 14, y + 14, 5, 3.4, '#7d9b4b');
      circ(c, x + 13, y + 13, 1.5, '#ead6b4');
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (at(tx + dx, ty + dy) !== 2 && R() < 0.45) {
        const bx = x + 16 + dx * 20,
          by = y + 16 + dy * 20;
        for (let k = 0; k < 4; k++)
          line(c, bx + (k - 2) * 2, by, bx + (k - 2) * 3, by - 6 - R() * 7, '#678343', 1.2);
        gardenStamp(c, 'stones', bx + 3, by + 3, 12, 9, 0, 0.8);
      }
  }

  // Keep bushes on actual blocked hedge tiles; flowers and small stones are
  // decorative ground detail and never introduce invisible obstacles.
  c.beginPath();
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++)
      if (at(x, y) === 3)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ])
          if (at(x + dx, y + dy) === 3) {
            c.moveTo((x + 0.5) * T, (y + 0.5) * T);
            c.lineTo((x + dx + 0.5) * T, (y + dy + 0.5) * T);
          }
  c.strokeStyle = '#36592e';
  c.lineWidth = T * 0.76;
  c.lineCap = 'round';
  c.stroke();
  for (let i = 0; i < MW * MH; i++)
    if (G.terr[i] === 3) {
      const x = ((i % MW) + 0.5) * T,
        y = (Math.floor(i / MW) + 0.5) * T;
      ell(c, x + 3, y + 5, 20, 15, 'rgba(16,35,19,.35)');
      gardenStamp(c, 'hedge', x, y, 42, 40, (R() - 0.5) * 0.7);
      gardenStamp(c, 'ivy', x - 3, y - 4, 20, 18, R() * 6, 0.7);
    }
  for (let i = 0; i < 900; i++) {
    const x = R() * WW,
      y = R() * WH,
      t = at(tileOf(x), tileOf(y));
    if (t !== 0) continue;
    const name = i % 7 === 0 ? 'stones' : i % 3 === 0 ? 'leaves' : i % 2 === 0 ? 'daisies' : 'violets';
    const size = name === 'stones' ? 6 + R() * 6 : name === 'leaves' ? 8 + R() * 7 : 5 + R() * 5;
    gardenStamp(c, name, x, y, size, size, R() * 6, 0.45 + R() * 0.35);
  }
  for (let i = 0; i < MW * MH; i++)
    if (G.terr[i] === 1 && R() < 0.025) {
      const x = ((i % MW) + 0.5) * T,
        y = (Math.floor(i / MW) + 0.5) * T;
      gardenStamp(c, 'puddle', x, y, 27, 13, (R() - 0.5) * 0.7, 0.62);
    }
  c.fillStyle = lin(c, 0, 0, WW, WH, ['rgba(239,214,155,.035)', 'rgba(26,57,45,.035)']);
  c.fillRect(0, 0, WW, WH);
  if (S.textures.exists('terrain')) S.textures.remove('terrain');
  S.textures.addCanvas('terrain', cv);
  return cv;
}

function gardenFenceRail(c, x1, y1, x2, y2, team) {
  line(c, x1 + 1, y1 + 2, x2 + 1, y2 + 2, 'rgba(14,30,17,.42)', 6);
  line(c, x1, y1, x2, y2, team ? '#384f2a' : '#675036', 4.6);
  line(c, x1 - 0.4, y1 - 1, x2 - 0.4, y2 - 1, team ? '#6f8a4a' : '#be9c68', 1.2);
  const length = Math.hypot(x2 - x1, y2 - y1),
    dx = (x2 - x1) / length,
    dy = (y2 - y1) / length;
  for (let d = 4; d < length; d += 5.5) {
    c.save();
    c.translate(x1 + dx * d, y1 + dy * d);
    c.rotate(Math.atan2(dy, dx));
    c.fillStyle = lin(c, 0, -5, 0, 5, ['#c1a475', '#9b7c50', '#72583b']);
    c.beginPath();
    c.moveTo(-1.4, 5);
    c.lineTo(-1.4, -4);
    c.lineTo(0, -6);
    c.lineTo(1.4, -4);
    c.lineTo(1.4, 5);
    c.closePath();
    c.fill();
    line(c, -0.7, -3, -0.7, 4, '#ddc38b', 0.45);
    circ(c, 0, 0, 0.65, '#554c37');
    c.restore();
  }
}

function gardenFencePost(c, x, y, team) {
  c.fillStyle = 'rgba(15,29,19,.4)';
  rr(c, x - 3, y - 1, 8, 8, 1);
  c.fill();
  c.fillStyle = lin(c, x - 3, y - 3, x + 3, y + 3, ['#c0aa7b', '#83643f']);
  rr(c, x - 3, y - 3, 6, 6, 0.8);
  c.fill();
  line(c, x - 2.5, y - 2.5, x + 2.5, y - 2.5, '#e4c88f', 0.7);
  c.fillStyle = team ? '#a14b39' : '#4e8093';
  c.fillRect(x - 2.2, y - 2, 4.4, 1.5);
  circ(c, x + 0.7, y + 0.8, 0.65, '#55442d');
}

function drawGardenFence(c, team, mask) {
  const branches = [
    [mask & 1, 16, 0],
    [mask & 2, 32, 16],
    [mask & 4, 16, 32],
    [mask & 8, 0, 16],
  ];
  if (team) {
    for (const [on, x, y] of branches)
      if (on) {
        line(c, 16, 18, (x + 16) / 2, (y + 16) / 2 + 2, 'rgba(12,31,18,.4)', 17);
        gardenStamp(c, 'hedge', (x + 16) / 2, (y + 16) / 2, 24, 24, 0);
      }
    gardenStamp(c, 'hedge', 16, 16, 27, 26, 0);
    gardenStamp(c, 'ivy', 13, 12, 15, 14, -0.3, 0.8);
    circ(c, 16, 16, 1.6, '#bd7354');
    return;
  }
  if (!mask) {
    gardenFenceRail(c, 3, 16, 29, 16, 0);
    gardenFencePost(c, 3, 16, 0);
    gardenFencePost(c, 29, 16, 0);
  } else {
    for (const [on, x, y] of branches) if (on) gardenFenceRail(c, 16, 16, x, y, 0);
    gardenFencePost(c, 16, 16, 0);
  }
  if (mask !== 5 && mask !== 10) gardenStamp(c, 'ivy', 21, 21, 9, 9, -0.4, 0.7);
}

function drawGardenGate(c, team, amount) {
  if (team) {
    gardenStamp(c, 'hedge', 3, 16, 13, 22);
    gardenStamp(c, 'hedge', 29, 16, 13, 22);
  }
  const angle = (amount * Math.PI) / 2;
  for (const [hinge, sign] of [
    [6, 1],
    [26, -1],
  ]) {
    c.save();
    c.translate(hinge, 16);
    c.rotate(sign * angle);
    const x = sign > 0 ? 0 : -10;
    c.fillStyle = 'rgba(12,27,18,.4)';
    c.fillRect(x + 1, -2, 10, 8);
    c.fillStyle = team ? '#913f32' : '#376d7b';
    c.fillRect(x, -4, 10, 8);
    c.fillStyle = team ? '#ce9670' : '#8fb5ac';
    c.fillRect(x, -4, 10, 1);
    for (let k = 2; k < 10; k += 3) line(c, x + k, -2.5, x + k, 3, team ? '#63382b' : '#1d4e57', 0.7);
    line(c, x + 1, 2.5, x + 9, -2, '#d0b57b', 0.8);
    circ(c, sign > 0 ? 8 : -8, 0, 0.8, '#d9bb70');
    c.restore();
  }
  gardenFencePost(c, 3, 16, team);
  gardenFencePost(c, 29, 16, team);
}

function drawGardenHeap(c) {
  ell(c, 21, 29, 18, 8, 'rgba(15,26,16,.35)');
  c.save();
  c.beginPath();
  c.moveTo(3, 26);
  c.quadraticCurveTo(5, 17, 12, 13);
  c.quadraticCurveTo(16, 7, 23, 10);
  c.quadraticCurveTo(32, 12, 36, 23);
  c.quadraticCurveTo(39, 31, 29, 34);
  c.quadraticCurveTo(12, 38, 3, 29);
  c.closePath();
  c.clip();
  c.fillStyle = gardenPattern(c, 'soil');
  c.fillRect(0, 0, 40, 40);
  c.fillStyle = lin(c, 0, 8, 0, 36, ['rgba(196,152,91,.28)', 'rgba(25,20,12,.48)']);
  c.fillRect(0, 0, 40, 40);
  gardenStamp(c, 'leaves', 13, 24, 18, 12, 0.4, 0.9);
  gardenStamp(c, 'carrots', 24, 22, 11, 10, -0.5, 0.9);
  gardenStamp(c, 'cabbage', 19, 16, 7, 6, 0.5, 0.8);
  c.restore();
  line(c, 10, 31, 16, 29, '#4c6934', 1);
  line(c, 29, 28, 33, 25, '#b58a52', 1);
}
