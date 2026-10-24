// All artwork. Every sprite and the terrain are drawn with canvas code when the game loads; there are no image files.
'use strict';

/* ---------------- textures ---------------- */
function rr(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}
function circ(c, x, y, r, fill) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
function ell(c, x, y, rx, ry, fill, rot) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
function line(c, x1, y1, x2, y2, col, w) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.stroke();
}
function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function rad(c, x, y, r, stops, fx, fy) {
  const g = c.createRadialGradient(fx ?? x, fy ?? y, 0, x, y, r);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function soft(c, fn, blur, ox, oy) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)';
  c.shadowBlur = blur ?? 7;
  c.shadowOffsetX = ox ?? 3;
  c.shadowOffsetY = oy ?? 4;
  fn();
  c.restore();
}
// Draws a texture with canvas code. res > 1 draws it at higher resolution; sprites using it are scaled by 1/res.
function mkTex(key, w, h, fn, res = 1) {
  if (S.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = w * res;
  cv.height = h * res;
  const c = cv.getContext('2d');
  c.scale(res, res);
  fn(c, w, h);
  S.textures.addCanvas(key, cv);
  ICONS[key] = cv;
}
// Wraps a unit drawing so it gets a dark outline, which keeps small troops readable on grass.
function outlined(draw) {
  return (c, W, H) => {
    const cw = c.canvas.width,
      ch = c.canvas.height,
      k = cw / W;
    const s = document.createElement('canvas');
    s.width = cw;
    s.height = ch;
    const sc = s.getContext('2d');
    sc.scale(k, k);
    draw(sc, W, H);
    const m = document.createElement('canvas');
    m.width = cw;
    m.height = ch;
    const mc = m.getContext('2d');
    mc.drawImage(s, 0, 0);
    mc.globalCompositeOperation = 'source-in';
    mc.fillStyle = 'rgba(16,12,8,.9)';
    mc.fillRect(0, 0, cw, ch);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const o = 1.3 * k;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ])
      c.drawImage(m, dx * o, dy * o);
    c.drawImage(s, 0, 0);
    c.restore();
  };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  const f = amt < 0 ? 0 : 255,
    p = Math.abs(amt);
  r = Math.round(r + (f - r) * p);
  g = Math.round(g + (f - g) * p);
  b = Math.round(b + (f - b) * p);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const DRAW = {
  hq(c, W, H, C, team) {
    // A pitched-roof shed seen from above, with a porch at the front.
    const top = 6,
      ridge = 38,
      eave = 70,
      L = 8,
      Rt = W - 8;
    const deck = team ? '#f1ede2' : '#9a6f40';
    soft(
      c,
      () => {
        c.fillStyle = deck;
        c.fillRect(24, eave - 2, 48, 22);
      },
      4,
      2,
      3
    );
    c.fillStyle = team ? 'rgba(0,0,0,.1)' : 'rgba(40,25,10,.45)';
    for (let x = 29; x < 72; x += 6) c.fillRect(x, eave, 1, 20);
    soft(
      c,
      () => {
        c.fillStyle = C.dark;
        c.fillRect(L, top, Rt - L, eave - top);
      },
      9,
      4,
      5
    );
    c.fillStyle = lin(c, 0, top, 0, ridge, [shade(C.main, 0.25), shade(C.main, 0.06)]);
    c.fillRect(L, top, Rt - L, ridge - top);
    c.fillStyle = lin(c, 0, ridge, 0, eave, [shade(C.main, -0.3), shade(C.main, -0.45)]);
    c.fillRect(L, ridge, Rt - L, eave - ridge);
    for (let y = top + 6, row = 0; y < eave - 2; y += 7, row++) {
      if (Math.abs(y - ridge) < 4) continue;
      c.fillStyle = 'rgba(0,0,0,.2)';
      c.fillRect(L, y, Rt - L, 1.2);
      c.fillStyle = 'rgba(0,0,0,.12)';
      for (let x = L + (row % 2 ? 6 : 0); x < Rt; x += 12) c.fillRect(x, y - 6, 1, 6);
    }
    c.fillStyle = shade(C.dark, -0.25);
    c.fillRect(L - 1, ridge - 3, Rt - L + 2, 6);
    c.fillStyle = 'rgba(255,255,255,.2)';
    c.fillRect(L - 1, ridge - 3, Rt - L + 2, 1.5);
    c.strokeStyle = shade(C.dark, -0.5);
    c.lineWidth = 2;
    c.strokeRect(L, top, Rt - L, eave - top);
    c.fillStyle = '#9a9a94';
    c.fillRect(L - 1, eave - 1, Rt - L + 2, 3);
    if (!team) {
      c.fillStyle = 'rgba(185,225,245,.9)';
      c.fillRect(20, 14, 20, 14);
      c.fillStyle = 'rgba(255,255,255,.65)';
      c.fillRect(20, 14, 20, 3);
      c.strokeStyle = '#26282a';
      c.lineWidth = 1.5;
      c.strokeRect(20, 14, 20, 14);
      line(c, 30, 14, 30, 28, '#26282a', 1);
      soft(c, () => circ(c, Rt - 16, ridge + 14, 4.5, '#77736c'), 3, 1, 2);
      circ(c, Rt - 16, ridge + 14, 2.8, '#33302b');
      line(c, Rt - 3, eave, Rt - 1, eave + 6, '#9a9a94', 2);
      soft(c, () => circ(c, Rt - 1, eave + 13, 7, '#2d3a24'), 3, 1, 2);
      circ(c, Rt - 1, eave + 13, 5, '#2a5d78');
      ell(c, Rt - 3, eave + 11, 2, 1.2, 'rgba(220,245,255,.5)');
      for (const [px, py, f] of [
        [16, eave + 12, '#4f9a35'],
        [9, eave + 20, '#e8892b'],
      ]) {
        soft(c, () => circ(c, px, py, 5, '#b5603a'), 2, 1, 1);
        circ(c, px, py, 3.6, '#4a3424');
        circ(c, px, py, 2.6, f);
      }
      c.fillStyle = '#7d6b3c';
      c.fillRect(40, eave + 6, 16, 9);
      line(c, 76, eave + 2, 84, eave + 17, '#b08a5a', 2);
      c.save();
      c.translate(85, eave + 19);
      c.rotate(-0.5);
      c.fillStyle = '#9ea3a6';
      rr(c, -3.5, -2, 7, 8, 1.5);
      c.fill();
      c.restore();
    } else {
      c.fillStyle = 'rgba(255,255,255,.18)';
      for (let y = top + 3; y < eave; y += 7) for (let x = L + 3; x < Rt - 2; x += 6) c.fillRect(x, y, 3, 1);
      line(c, 76, eave + 18, 76, eave - 14, '#f4f1e8', 1.6);
      c.beginPath();
      c.moveTo(77, eave - 14);
      c.lineTo(90, eave - 10);
      c.lineTo(77, eave - 6);
      c.closePath();
      c.fillStyle = C.main;
      c.fill();
      c.fillStyle = '#ffffff';
      rr(c, 36, eave + 5, 24, 10, 2);
      c.fill();
      c.fillStyle = C.dark;
      c.font = 'bold 7.5px sans-serif';
      c.textAlign = 'center';
      c.fillText('T.L.S.', 48, eave + 12.5);
      for (const bx of [28, 33]) {
        circ(c, bx, eave + 15, 2.6, '#1d1d1d');
        circ(c, bx - 0.8, eave + 14.2, 0.8, '#888');
      }
    }
  },
  water(c, W, H, C) {
    const x = W / 2,
      y = H / 2;
    soft(c, () => circ(c, x, y, 26, '#5b3b22'), 8, 3, 4);
    circ(c, x, y, 26, rad(c, x, y, 26, ['#8a5e36', '#5b3b22', '#3e2715'], x - 6, y - 6));
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      line(
        c,
        x + Math.cos(t) * 19,
        y + Math.sin(t) * 19,
        x + Math.cos(t) * 26,
        y + Math.sin(t) * 26,
        'rgba(0,0,0,.22)',
        1
      );
    }
    c.beginPath();
    c.arc(x, y, 24, 0, Math.PI * 2);
    c.strokeStyle = '#9a9a94';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.arc(x, y, 21.5, 0, Math.PI * 2);
    c.strokeStyle = C.main;
    c.lineWidth = 3;
    c.stroke();
    circ(c, x, y, 19, rad(c, x, y, 19, ['#5fb0d8', '#2f78a3', '#1d5677'], x - 4, y - 5));
    ell(c, x - 6, y - 7, 7, 3.5, 'rgba(220,245,255,.45)', -0.5);
    c.fillStyle = '#9a9a94';
    c.fillRect(x + 22, y - 3, 8, 6);
    c.fillStyle = C.light;
    c.fillRect(x + 27, y - 4, 3, 8);
  },
  bin(c, W, H, C, team) {
    // Plot Holders: three black 'dalek' compost bins, one with its lid off. Tidy Lawns: wheelie bins of clippings.
    const R = mulberry32(7);
    ell(c, W / 2, H / 2 + 6, W / 2 - 4, H / 2 - 8, 'rgba(40,28,18,.35)');
    for (let i = 0; i < 46; i++) {
      c.fillStyle = team
        ? ['#7fbf4a', '#5f9a3a', '#a9d36a'][i % 3]
        : ['#5a3d26', '#4a3424', '#d4813a', '#6e9a3c'][i % 4];
      const sz = 1 + R() * 2;
      c.fillRect(6 + R() * (W - 12), 34 + R() * (H - 38), sz, sz);
    }
    const xs = [17, 48, 79],
      y = 30;
    xs.forEach((x, i) => {
      if (!team) {
        soft(c, () => circ(c, x, y, 14.5, '#161d15'), 5, 2, 3);
        circ(c, x, y, 14.5, rad(c, x, y, 14.5, ['#3d4d3a', '#1d261c', '#111710'], x - 4, y - 5));
        c.beginPath();
        c.arc(x, y, 12.4, 0, Math.PI * 2);
        c.strokeStyle = C.main;
        c.lineWidth = 2.2;
        c.stroke();
        if (i === 1) {
          circ(c, x, y, 10.5, rad(c, x, y, 10.5, ['#74513a', '#3d2a1c']));
          for (let k = 0; k < 16; k++) {
            c.fillStyle = ['#d4813a', '#78a542', '#e6c45a'][k % 3];
            c.fillRect(x - 7 + R() * 14, y - 7 + R() * 14, 1.7, 1.7);
          }
        } else {
          circ(c, x, y, 10, rad(c, x, y, 10, ['#4d6049', '#253022'], x - 3, y - 4));
          c.beginPath();
          c.arc(x, y, 6.5, 0, Math.PI * 2);
          c.strokeStyle = 'rgba(0,0,0,.35)';
          c.lineWidth = 1;
          c.stroke();
          rr(c, x - 6, y - 1.6, 12, 3.2, 1.6);
          c.fillStyle = '#0e130d';
          c.fill();
          ell(c, x - 4, y - 5, 4, 2, 'rgba(255,255,255,.18)', -0.5);
        }
      } else {
        const w = 24,
          h = 28;
        soft(
          c,
          () => {
            rr(c, x - w / 2, y - h / 2, w, h, 3);
            c.fillStyle = '#244d2a';
            c.fill();
          },
          5,
          2,
          3
        );
        rr(c, x - w / 2, y - h / 2, w, h, 3);
        c.fillStyle = '#2e6033';
        c.fill();
        rr(c, x - w / 2 + 1, y - h / 2 + 3, w - 2, h - 6, 2);
        c.fillStyle = lin(c, 0, y - h / 2, 0, y + h / 2, [shade(C.main, 0.15), shade(C.main, -0.2)]);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,.18)';
        for (let k = -1; k <= 1; k++) c.fillRect(x - w / 2 + 3, y + k * 6, w - 6, 1.3);
        c.fillStyle = '#1b1b1b';
        c.fillRect(x - w / 2, y - h / 2, w, 3);
        c.fillRect(x - w / 2 + 2, y - h / 2 - 3, 4, 3);
        c.fillRect(x + w / 2 - 6, y - h / 2 - 3, 4, 3);
        rr(c, x - 5, y + h / 2 - 4, 10, 3, 1.5);
        c.fill();
      }
    });
  },
  shed(c, W, H, C) {
    soft(
      c,
      () => {
        c.fillStyle = C.dark;
        rr(c, 4, 4, W - 8, H - 8, 3);
        c.fill();
      },
      8,
      3,
      4
    );
    c.fillStyle = '#3d2e20';
    c.fillRect(8, 8, W - 16, H - 16);
    const R = mulberry32(5);
    for (let i = 0; i < 9; i++) {
      const px = 14 + (i % 3) * 18,
        py = 15 + ((i / 3) | 0) * 17;
      circ(c, px, py, 5.5, '#3f7a2a');
      circ(c, px - 1, py - 1, 3.5, '#6eaa45');
      if (R() < 0.4) circ(c, px + 2, py + 1, 1.6, '#e14a3a');
    }
    c.fillStyle = lin(c, 8, 8, W - 8, H - 8, [
      'rgba(230,248,255,.75)',
      'rgba(190,225,240,.45)',
      'rgba(230,248,255,.7)',
    ]);
    c.fillRect(8, 8, W - 16, H - 16);
    c.strokeStyle = C.main;
    c.lineWidth = 2;
    for (let k = 1; k < 3; k++) {
      c.beginPath();
      c.moveTo(8 + (k * (W - 16)) / 3, 8);
      c.lineTo(8 + (k * (W - 16)) / 3, H - 8);
      c.stroke();
      c.beginPath();
      c.moveTo(8, 8 + (k * (H - 16)) / 3);
      c.lineTo(W - 8, 8 + (k * (H - 16)) / 3);
      c.stroke();
    }
    line(c, 12, H - 14, W - 20, 10, 'rgba(255,255,255,.4)', 2);
    line(c, 20, H - 12, W - 12, 18, 'rgba(255,255,255,.2)', 1.5);
  },
  tunnel(c, W, H, C) {
    soft(
      c,
      () => {
        c.fillStyle = '#cfd5c6';
        rr(c, 4, 14, W - 8, H - 28, 13);
        c.fill();
      },
      9,
      3,
      5
    );
    c.fillStyle = lin(c, 0, 14, 0, H - 14, ['#f7f8f2', '#e3e8dc', '#c3cab8', '#a9b19d']);
    rr(c, 4, 14, W - 8, H - 28, 13);
    c.fill();
    c.globalAlpha = 0.32;
    for (let x = 16; x < W - 14; x += 9)
      for (let y = 27; y < H - 24; y += 13) {
        circ(c, x, y, 3.2, '#3f7a2a');
      }
    c.globalAlpha = 1;
    c.strokeStyle = C.dark;
    c.globalAlpha = 0.5;
    c.lineWidth = 2;
    for (let x = 14; x < W - 10; x += 11) {
      c.beginPath();
      c.moveTo(x, 15);
      c.lineTo(x, H - 15);
      c.stroke();
    }
    c.globalAlpha = 1;
    ell(c, W / 2, 24, W / 2 - 14, 4, 'rgba(255,255,255,.55)');
    c.fillStyle = C.main;
    c.fillRect(4, 17, 6, H - 34);
    c.fillRect(W - 10, 17, 6, H - 34);
    c.fillStyle = shade(C.main, -0.35);
    c.fillRect(W - 10, H / 2 - 8, 6, 16);
  },
  scare(c, W, H, C) {
    ell(c, 17, 19, 9, 6, 'rgba(0,0,0,.3)');
    line(c, 16, 3, 16, 28, '#7a5532', 3);
    line(c, 4, 12, 28, 12, '#7a5532', 3);
    for (const [x, y] of [
      [4, 12],
      [28, 12],
      [16, 28],
    ]) {
      for (let k = 0; k < 5; k++) line(c, x, y, x + (k - 2) * 1.6, y + (y === 28 ? 3 : 2.5), '#e6c45a', 1);
    }
    soft(
      c,
      () => {
        c.fillStyle = C.main;
        c.fillRect(10, 9, 12, 11);
      },
      2,
      1,
      1
    );
    c.fillStyle = shade(C.main, -0.3);
    c.fillRect(17, 13, 4, 4);
    circ(c, 16, 14, 6.5, shade(C.dark, -0.1));
    circ(c, 16, 14, 4.2, C.dark);
    c.beginPath();
    c.arc(16, 14, 6.5, 0, Math.PI * 2);
    c.strokeStyle = C.light;
    c.lineWidth = 1.2;
    c.stroke();
    circ(c, 25, 10, 2, '#151515');
    circ(c, 26.4, 9.4, 0.7, '#e6c45a');
  },
  hive(c, W, H, C, team) {
    ell(c, 18, 20, 10, 8, 'rgba(0,0,0,.3)');
    if (team) {
      ell(c, 16, 16, 10, 11, rad(c, 16, 16, 11, ['#d8d2c4', '#a29b8b', '#6f6a5e'], 13, 12));
      c.strokeStyle = 'rgba(60,55,45,.5)';
      c.lineWidth = 1;
      for (let r = 3; r < 10; r += 2.5) {
        c.beginPath();
        c.ellipse(16, 16, r, r * 1.1, 0, 0, Math.PI * 2);
        c.stroke();
      }
      circ(c, 16, 23, 2.2, '#2a2520');
      c.beginPath();
      c.arc(16, 16, 11, 0, Math.PI * 2);
      c.strokeStyle = C.main;
      c.lineWidth = 1.5;
      c.stroke();
    } else {
      soft(
        c,
        () => {
          c.fillStyle = '#efe6cf';
          c.fillRect(6, 6, 20, 20);
        },
        2,
        1,
        1
      );
      c.fillStyle = lin(c, 0, 6, 0, 26, ['#f6eed8', '#d9cba5']);
      c.fillRect(6, 6, 20, 20);
      c.strokeStyle = 'rgba(120,95,50,.4)';
      c.lineWidth = 1;
      for (const y of [12, 19]) {
        c.beginPath();
        c.moveTo(6, y);
        c.lineTo(26, y);
        c.stroke();
      }
      c.fillStyle = C.main;
      c.fillRect(4, 4, 24, 5);
      c.fillStyle = C.light;
      c.fillRect(4, 4, 24, 1.5);
      c.fillStyle = '#3a2a1c';
      c.fillRect(12, 24, 8, 2);
    }
    for (const [x, y] of [
      [5, 25],
      [27, 6],
      [28, 25],
      [4, 8],
    ]) {
      ell(c, x, y, 1.8, 1.3, '#f2c230');
      line(c, x - 0.6, y, x + 0.6, y, '#222', 0.8);
    }
  },
  sprink(c, W, H, C) {
    soft(c, () => circ(c, 16, 16, 12, '#7d7a73'), 5, 2, 3);
    circ(c, 16, 16, 12, rad(c, 16, 16, 12, ['#b4b0a6', '#86827a', '#5d5a54'], 12, 12));
    c.beginPath();
    c.arc(16, 16, 9.5, 0, Math.PI * 2);
    c.strokeStyle = C.main;
    c.lineWidth = 2.5;
    c.stroke();
    circ(c, 16, 16, 5, '#3a3a3a');
    line(c, 16, 16, 29, 16, '#4d5a62', 3);
    circ(c, 29, 16, 2.6, '#7cc3e6');
    circ(c, 15, 15, 2, '#888');
  },
  barrow(c, W, H, C, team, frame, full) {
    line(c, 2, 9, 10, 12, '#8a6a45', 2.2);
    line(c, 2, 21, 10, 18, '#8a6a45', 2.2);
    circ(c, 2, 9, 1.6, '#3a2a1c');
    circ(c, 2, 21, 1.6, '#3a2a1c');
    c.beginPath();
    c.moveTo(8, 7);
    c.lineTo(24, 9);
    c.lineTo(24, 21);
    c.lineTo(8, 23);
    c.closePath();
    c.fillStyle = lin(c, 0, 7, 0, 23, [shade(C.main, 0.2), C.main, shade(C.main, -0.25)]);
    c.fill();
    c.strokeStyle = C.dark;
    c.lineWidth = 1.5;
    c.stroke();
    c.beginPath();
    c.moveTo(11, 10);
    c.lineTo(21, 11);
    c.lineTo(21, 19);
    c.lineTo(11, 20);
    c.closePath();
    c.fillStyle = full ? '#4a3424' : shade(C.dark, -0.15);
    c.fill();
    if (full) {
      const R = mulberry32(3);
      ell(c, 16, 15, 4.5, 4, '#5a4030');
      for (let i = 0; i < 12; i++) {
        c.fillStyle = ['#d4813a', '#6e9a3c', '#a37b4f'][i % 3];
        c.fillRect(12 + R() * 8, 11 + R() * 7, 2, 2);
      }
    }
    c.fillStyle = '#1f1f1f';
    rr(c, 23.5, 11.5, 6, 7, 2);
    c.fill();
    c.strokeStyle = '#666';
    c.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const y = 12.5 + ((k * 2 + frame) % 6);
      c.beginPath();
      c.moveTo(24, y);
      c.lineTo(29, y);
      c.stroke();
    }
  },
  fork(c, W, H, C, team, frame) {
    feet(c, frame);
    line(c, 11, 15, 20, 15, '#b08a5a', 2);
    for (const y of [13.5, 15, 16.5]) line(c, 19, y, 22, y, '#d8d8d8', 1);
    body(c, C);
    head(c, team, C);
  },
  hose(c, W, H, C, team, frame) {
    feet(c, frame);
    c.beginPath();
    c.arc(5, 11, 3.5, 0, Math.PI * 2);
    c.strokeStyle = '#3f8f3a';
    c.lineWidth = 2;
    c.stroke();
    line(c, 11, 7, 21, 7, '#7cc3e6', 2.4);
    circ(c, 21, 7, 1.4, '#c9e9f7');
    body(c, C);
    head(c, team, C);
  },
  tiller(c, W, H, C, team, frame) {
    if (team) {
      circ(c, 18, 16, 11.5, rad(c, 18, 16, 11.5, ['#8a8a8a', '#5a5a5a'], 15, 13));
      c.beginPath();
      c.arc(18, 16, 11.5, 0, Math.PI * 2);
      c.strokeStyle = '#333';
      c.lineWidth = 1;
      c.stroke();
      const a = frame ? Math.PI / 3 : 0;
      line(
        c,
        18 - Math.cos(a) * 9,
        16 - Math.sin(a) * 9,
        18 + Math.cos(a) * 9,
        16 + Math.sin(a) * 9,
        'rgba(230,230,230,.8)',
        1.6
      );
    } else
      for (const y of [10, 16, 22]) {
        circ(c, 26, y, 3.6, '#9a9a9a');
        const a = frame ? Math.PI / 4 : 0;
        for (let k = 0; k < 2; k++) {
          const b = a + (k * Math.PI) / 2;
          line(
            c,
            26 - Math.cos(b) * 3.6,
            y - Math.sin(b) * 3.6,
            26 + Math.cos(b) * 3.6,
            y + Math.sin(b) * 3.6,
            '#4a4a4a',
            1.2
          );
        }
      }
    line(c, 7, 9, 2, 6, '#555', 2);
    line(c, 7, 23, 2, 26, '#555', 2);
    circ(c, 2, 6, 1.5, '#222');
    circ(c, 2, 26, 1.5, '#222');
    c.fillStyle = lin(c, 0, 8, 0, 24, [shade(C.main, 0.25), C.main, shade(C.main, -0.3)]);
    rr(c, 7, 8, 18, 16, 3);
    c.fill();
    c.strokeStyle = C.dark;
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#2e2e2e';
    rr(c, 11, 11, 8, 10, 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(12, 12, 6, 2);
    if (team) {
      c.fillStyle = '#1d1d1d';
      c.fillRect(8, 10, 3, 12);
    }
  },
  cata(c, W, H, C, team, frame, fired) {
    c.fillStyle = '#262626';
    for (const [x, y] of [
      [6, 5],
      [22, 5],
      [6, 25],
      [22, 25],
    ]) {
      c.fillRect(x, y, 6, 4);
      c.fillStyle = '#555';
      c.fillRect(x + (frame ? 3 : 1), y, 1.5, 4);
      c.fillStyle = '#262626';
    }
    c.fillStyle = lin(c, 6, 8, 28, 26, ['#a3743f', '#8a6236', '#6b4a2a']);
    rr(c, 6, 8, 22, 18, 2);
    c.fill();
    c.strokeStyle = '#5e4126';
    c.lineWidth = 1.5;
    c.stroke();
    line(c, 6, 8, 28, 26, '#5e4126', 1.5);
    line(c, 6, 26, 28, 8, '#5e4126', 1.5);
    c.fillStyle = C.main;
    c.fillRect(6, 8, 22, 3);
    c.fillRect(6, 23, 22, 3);
    if (fired) {
      line(c, 17, 17, 8, 17, '#6b4a2a', 3);
      circ(c, 7, 17, 4.5, '#5e4126');
      circ(c, 7, 17, 3, '#3a2a1c');
    } else {
      line(c, 13, 17, 28, 17, '#6b4a2a', 3);
      circ(c, 29, 17, 4.5, '#5e4126');
      if (team) {
        circ(c, 29, 17, 3.4, rad(c, 29, 17, 3.4, ['#555', '#151515'], 28, 16));
      } else {
        circ(c, 29, 17, 3.4, rad(c, 29, 17, 3.4, ['#f6a948', '#d26f1c'], 28, 16));
        circ(c, 29, 14.6, 1.1, '#4c7a2a');
      }
    }
  },
};
function feet(c, f) {
  const a = f ? 3 : -1,
    b = f ? -1 : 3;
  ell(c, 11 + a, 7.5, 2.4, 1.7, '#3a2a1c');
  ell(c, 11 + b, 14.5, 2.4, 1.7, '#3a2a1c');
}
function body(c, C) {
  c.beginPath();
  c.ellipse(10, 11, 5.5, 7, 0, 0, Math.PI * 2);
  c.fillStyle = rad(c, 10, 11, 7, [shade(C.main, 0.25), C.main, shade(C.main, -0.3)], 9, 9);
  c.fill();
  c.strokeStyle = C.dark;
  c.lineWidth = 1;
  c.stroke();
}
function head(c, team, C) {
  if (team) {
    circ(c, 11, 11, 4.4, rad(c, 11, 11, 4.4, [shade(C.light, 0.15), C.light, C.main], 10, 10));
    circ(c, 8.4, 11, 1.7, C.dark);
    c.beginPath();
    c.arc(13.6, 11, 2.3, -1.25, 1.25);
    c.strokeStyle = '#f4f1ea';
    c.lineWidth = 1.8;
    c.stroke();
  } else {
    circ(c, 11, 11, 3.7, rad(c, 11, 11, 3.7, ['#f2d2b0', '#d9a77e'], 10, 10));
    c.beginPath();
    c.arc(10.4, 11, 3.7, Math.PI * 0.6, Math.PI * 1.4);
    c.strokeStyle = '#5a3d26';
    c.lineWidth = 2;
    c.stroke();
  }
}
function drawWall(c, team, mask) {
  const C = TEAM[team],
    N = mask & 1,
    E = mask & 2,
    S_ = mask & 4,
    Wd = mask & 8;
  const dirs = [
    [N, 16, 0],
    [E, 32, 16],
    [S_, 16, 32],
    [Wd, 0, 16],
  ];
  if (team === 0) {
    c.save();
    c.shadowColor = 'rgba(0,0,0,.4)';
    c.shadowBlur = 3;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 3;
    for (const [on, x, y] of dirs)
      if (on) {
        line(c, 16, 16, x, y, '#e9e4d6', 2.2);
      }
    if (!mask) {
      line(c, 8, 16, 24, 16, '#e9e4d6', 2.2);
    }
    c.restore();
    for (const [on, x, y] of dirs)
      if (on) {
        const dx = (x - 16) / 16,
          dy = (y - 16) / 16;
        for (let k = 6; k <= 16; k += 5) {
          const px = 16 + dx * k,
            py = 16 + dy * k;
          c.fillStyle = '#f6f2e6';
          c.fillRect(px - 1.8, py - 1.8, 3.6, 3.6);
          c.fillStyle = 'rgba(0,0,0,.18)';
          c.fillRect(px - 1.8, py + 1, 3.6, 0.8);
        }
      }
    if (!mask)
      for (const px of [10, 22]) {
        c.fillStyle = '#f6f2e6';
        c.fillRect(px - 1.8, 14.2, 3.6, 3.6);
      }
    soft(
      c,
      () => {
        c.fillStyle = '#7a5532';
        c.fillRect(12.5, 12.5, 7, 7);
      },
      2,
      1,
      2
    );
    c.fillStyle = C.main;
    c.fillRect(12.5, 12.5, 7, 2.2);
  } else {
    const blob = (x, y, r) => {
      circ(c, x + 1.5, y + 2.5, r, 'rgba(0,0,0,.28)');
      circ(c, x, y, r, '#2c5a25');
      circ(c, x - 1.6, y - 1.8, r * 0.7, '#3f7a32');
      circ(c, x - 2.6, y - 3, r * 0.32, '#5a9a46');
    };
    for (const [on, x, y] of dirs) if (on) blob((x + 16) / 2, (y + 16) / 2, 8.5);
    if (mask & 1 || mask & 4) {
      c.fillStyle = '#2c5a25';
      c.fillRect(9, mask & 1 ? 0 : 16, 14, 16);
    }
    if (mask & 2 || mask & 8) {
      c.fillStyle = '#2c5a25';
      c.fillRect(mask & 8 ? 0 : 16, 9, 16, 14);
    }
    blob(16, 16, 10);
    circ(c, 16, 16, 2.3, C.main);
    circ(c, 15.4, 15.4, 0.9, C.light);
  }
}
function drawGate(c, team, open) {
  const C = TEAM[team];
  if (team === 0) {
    for (const x of [3, 29]) {
      soft(
        c,
        () => {
          c.fillStyle = '#7a5532';
          c.fillRect(x - 3.5, 12.5, 7, 7);
        },
        2,
        1,
        2
      );
      c.fillStyle = C.main;
      c.fillRect(x - 3.5, 12.5, 7, 2.2);
    }
    if (open) {
      line(c, 6, 16, 10, 28, shade(C.main, -0.2), 4);
      line(c, 26, 16, 22, 28, shade(C.main, -0.2), 4);
    } else {
      c.save();
      c.shadowColor = 'rgba(0,0,0,.35)';
      c.shadowBlur = 3;
      c.shadowOffsetY = 3;
      c.fillStyle = C.main;
      c.fillRect(6, 13, 20, 6);
      c.restore();
      c.fillStyle = C.light;
      c.fillRect(6, 13, 20, 1.5);
      c.strokeStyle = C.dark;
      c.lineWidth = 1;
      for (const x of [11, 16, 21]) {
        c.beginPath();
        c.moveTo(x, 13);
        c.lineTo(x, 19);
        c.stroke();
      }
      line(c, 7, 18, 25, 14, C.dark, 1);
    }
  } else {
    const blob = (x, y, r) => {
      circ(c, x + 1.5, y + 2.5, r, 'rgba(0,0,0,.28)');
      circ(c, x, y, r, '#2c5a25');
      circ(c, x - 1.6, y - 1.8, r * 0.7, '#3f7a32');
    };
    blob(4, 16, 7);
    blob(28, 16, 7);
    c.fillStyle = 'rgba(63,122,50,.55)';
    c.fillRect(4, 10, 24, 12);
    if (!open) {
      line(c, 6, 16, 26, 16, C.main, 2.5);
      circ(c, 16, 16, 2, C.light);
    }
  }
}
function makeTextures() {
  const us = { barrow: 30, fork: 22, hose: 22, tiller: 32, cata: 34 };
  for (let team = 0; team < 2; team++) {
    const C = TEAM[team];
    for (const k in BLDS) {
      if (BLDS[k].wall) continue;
      const d = BLDS[k];
      mkTex(k + '_' + team, d.w * T, d.h * T, (c, W, H) => DRAW[k](c, W, H, C, team), RES);
    }
    for (const k in us)
      for (let f = 0; f < 2; f++)
        mkTex(
          `${k}_${team}_${f}`,
          us[k],
          us[k],
          outlined((c, W, H) => DRAW[k](c, W, H, C, team, f, false)),
          RES
        );
    for (let f = 0; f < 2; f++)
      mkTex(
        `barrowfull_${team}_${f}`,
        30,
        30,
        outlined((c, W, H) => DRAW.barrow(c, W, H, C, team, f, true)),
        RES
      );
    for (let f = 0; f < 2; f++)
      mkTex(
        `catafire_${team}_${f}`,
        34,
        34,
        outlined((c, W, H) => DRAW.cata(c, W, H, C, team, f, true)),
        RES
      );
    mkTex('wall_' + team + '_10', 32, 32, c => drawWall(c, team, 10), RES);
    mkTex('gate_' + team + '_0', 32, 32, c => drawGate(c, team, false), RES);
    mkTex('gate_' + team + '_1', 32, 32, c => drawGate(c, team, true), RES);
    mkTex('rally_' + team, 16, 22, c => {
      line(c, 3, 21, 3, 3, '#e8dfc8', 2);
      c.beginPath();
      c.moveTo(4, 3);
      c.lineTo(15, 7);
      c.lineTo(4, 11);
      c.closePath();
      c.fillStyle = C.main;
      c.fill();
    });
  }
  mkTex('shadow', 32, 20, c =>
    ell(c, 16, 10, 15, 9, rad(c, 16, 10, 15, ['rgba(0,0,0,.42)', 'rgba(0,0,0,.28)', 'rgba(0,0,0,0)']))
  );
  mkTex('drop', 8, 8, c => {
    ell(c, 4, 4, 3.5, 2.5, '#9fd6f2');
    ell(c, 3, 3, 1.4, 1, '#e8f7ff');
  });
  mkTex('clod', 10, 10, c => {
    circ(c, 5, 5, 4, rad(c, 5, 5, 4, ['#8f6a45', '#5a3d26'], 4, 4));
    circ(c, 6, 6, 1, '#3a2a1c');
  });
  mkTex('pumpkin', 14, 14, c => {
    circ(c, 7, 7, 6, rad(c, 7, 7, 6, ['#f8b25a', '#e8892b', '#b9611a'], 5, 5));
    line(c, 7, 2, 7, 12, '#c56f1f', 1);
    line(c, 3.5, 3, 3.5, 11, '#c56f1f', 1);
    line(c, 10.5, 3, 10.5, 11, '#c56f1f', 1);
    circ(c, 7, 1.6, 1.4, '#4c7a2a');
  });
  mkTex('bowl', 12, 12, c => {
    circ(c, 6, 6, 5.5, rad(c, 6, 6, 5.5, ['#666', '#262626', '#111'], 4, 4));
    circ(c, 4.5, 4.5, 1.3, '#aaa');
  });
  mkTex('bees', 16, 16, c => {
    const R = mulberry32(4);
    for (let i = 0; i < 6; i++) {
      const x = 3 + R() * 10,
        y = 3 + R() * 10;
      ell(c, x, y, 2, 1.4, '#f2c230');
      line(c, x - 0.7, y, x + 0.7, y, '#222', 1);
      ell(c, x, y - 1.3, 1.2, 0.8, 'rgba(255,255,255,.75)');
    }
  });
  mkTex('pshadow', 16, 10, c => ell(c, 8, 5, 7, 4, 'rgba(0,0,0,.3)'));
  const radial = (key, s, stops) =>
    mkTex(key, s, s, c => {
      c.fillStyle = rad(c, s / 2, s / 2, s / 2, stops);
      c.fillRect(0, 0, s, s);
    });
  radial('puff', 32, ['rgba(240,232,214,.95)', 'rgba(240,232,214,.5)', 'rgba(240,232,214,0)']);
  radial('splat', 32, ['rgba(110,76,46,.95)', 'rgba(110,76,46,.4)', 'rgba(110,76,46,0)']);
  radial('splash', 32, ['rgba(190,232,250,.95)', 'rgba(170,220,245,.4)', 'rgba(170,220,245,0)']);
  radial('buzz', 32, ['rgba(250,210,70,.8)', 'rgba(250,210,70,.25)', 'rgba(250,210,70,0)']);
  radial('smoke', 32, ['rgba(70,64,58,.75)', 'rgba(70,64,58,.35)', 'rgba(70,64,58,0)']);
  radial('spark', 16, ['rgba(255,214,120,1)', 'rgba(255,120,40,.6)', 'rgba(255,90,20,0)']);
  radial('heal', 16, ['rgba(190,240,140,1)', 'rgba(150,220,90,.5)', 'rgba(150,220,90,0)']);
  radial('scorch', 64, ['rgba(28,20,14,.75)', 'rgba(28,20,14,.4)', 'rgba(28,20,14,0)']);
  mkTex('cloud', 256, 160, c => {
    c.save();
    c.scale(1, 160 / 256);
    const R = mulberry32(9);
    for (let i = 0; i < 7; i++) {
      const x = 70 + R() * 116,
        y = 90 + R() * 76,
        r = 40 + R() * 40;
      c.fillStyle = rad(c, x, y, r, ['rgba(0,0,0,.5)', 'rgba(0,0,0,0)']);
      c.fillRect(0, 0, 256, 256);
    }
    c.restore();
  });
  mkTex('debris', 8, 6, c => {
    c.fillStyle = '#6b4a2a';
    c.fillRect(0, 0, 8, 6);
    c.fillStyle = '#8a6236';
    c.fillRect(0, 0, 8, 2);
  });
  for (const [k, col] of [
    ['fly0', '#f4f1ea'],
    ['fly1', '#f0a33a'],
    ['fly2', '#7ab8e8'],
  ])
    mkTex(k, 12, 10, c => {
      ell(c, 3.5, 3.5, 3.2, 2.6, col);
      ell(c, 8.5, 3.5, 3.2, 2.6, col);
      ell(c, 3.8, 7, 2.4, 2, col);
      ell(c, 8.2, 7, 2.4, 2, col);
      line(c, 6, 2, 6, 9, '#2a2118', 1.2);
    });
  mkTex(
    'heap',
    40,
    40,
    c => {
      ell(c, 22, 26, 17, 11, 'rgba(0,0,0,.3)');
      ell(c, 20, 22, 16, 12, rad(c, 20, 22, 16, ['#6a4a33', '#4a3424', '#33241a'], 16, 17));
      ell(c, 18, 19, 9, 6, 'rgba(140,100,70,.35)');
      const R = mulberry32(11);
      for (let i = 0; i < 34; i++) {
        c.fillStyle = ['#d4813a', '#78a542', '#a37b4f', '#e6c45a', '#c9b07a'][i % 5];
        const s = 1 + R() * 1.6;
        c.fillRect(8 + R() * 24, 12 + R() * 18, s, s);
      }
      line(c, 14, 16, 18, 13, '#78a542', 1.5);
      line(c, 24, 20, 27, 17, '#d4813a', 1.5);
    },
    RES
  );
}
function wallMask(e) {
  let m = 0;
  const chk = (x, y, b) => {
    if (!inb(x, y)) return;
    const id = G.wallAt[idx(x, y)];
    if (id && G.wallTeam[idx(x, y)] === e.team) m |= b;
  };
  chk(e.tx, e.ty - 1, 1);
  chk(e.tx + 1, e.ty, 2);
  chk(e.tx, e.ty + 1, 4);
  chk(e.tx - 1, e.ty, 8);
  return m;
}
function refreshWall(e) {
  if (!e || e.dead || !e.spr) return;
  if (e.d.gate) {
    const m = wallMask(e);
    e.orient = m & 5 && !(m & 10) ? 1 : 0;
    e.spr.setRotation(e.orient ? Math.PI / 2 : 0);
    return;
  }
  const m = wallMask(e),
    key = `wall_${e.team}_${m}`;
  mkTex(key, 32, 32, c => drawWall(c, e.team, m), RES);
  e.spr.setTexture(key);
}
function refreshWallsAround(tx, ty) {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = tx + dx,
      y = ty + dy;
    if (!inb(x, y)) continue;
    const id = G.wallAt[idx(x, y)];
    if (id) refreshWall(G.ents.find(o => o.id === id && !o.dead));
  }
}
function iconURL(key) {
  const cv = ICONS[key];
  if (!cv) return '';
  if (!cv._url) cv._url = cv.toDataURL();
  return cv._url;
}
function drawTerrain() {
  const cv = document.createElement('canvas');
  cv.width = WW;
  cv.height = WH;
  const x = cv.getContext('2d');
  const R = mulberry32(G.seed ^ 0x5bd1);
  const terr = G.terr;
  const at = (tx, ty) => (inb(tx, ty) ? terr[idx(tx, ty)] : 3);
  x.fillStyle = '#4e7c34';
  x.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 1100; i++) {
    const cx = R() * WW,
      cy = R() * WH,
      r = 30 + R() * 130;
    const light = R() < 0.5;
    x.fillStyle = rad(x, cx, cy, r, [
      light ? `rgba(140,185,90,${0.08 + R() * 0.08})` : `rgba(25,55,18,${0.08 + R() * 0.1})`,
      'rgba(0,0,0,0)',
    ]);
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      if (terr[idx(tx, ty)] !== 5) continue;
      x.fillStyle = (tx >> 1) & 1 ? 'rgba(105,170,78,.55)' : 'rgba(84,140,60,.5)';
      x.fillRect(tx * T, ty * T, T, T);
    }
  x.lineWidth = 1;
  for (let i = 0; i < 46000; i++) {
    const bx = R() * WW,
      by = R() * WH;
    const t = terr[idx(tileOf(bx), tileOf(by))];
    if (t !== 0 && t !== 5) continue;
    x.strokeStyle = R() < 0.5 ? 'rgba(170,210,115,.28)' : 'rgba(30,60,20,.22)';
    x.beginPath();
    x.moveTo(bx, by);
    x.lineTo(bx + R() * 3 - 1.5, by - 3 - R() * 4);
    x.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const bx = R() * WW,
      by = R() * WH;
    if (terr[idx(tileOf(bx), tileOf(by))] !== 0) continue;
    if (R() < 0.6) {
      for (let k = 0; k < 3; k++)
        circ(x, bx + Math.cos(k * 2.1) * 1.8, by + Math.sin(k * 2.1) * 1.8, 1.5, 'rgba(110,170,80,.6)');
    } else circ(x, bx, by, 1.6, ['#f2ead2', '#e6c45a', '#c9a4e0'][(R() * 3) | 0]);
  }
  // beds
  for (let i = 0; i < MW * MH; i++) {
    if (terr[i] !== 4) continue;
    const px = (i % MW) * T,
      py = ((i / MW) | 0) * T;
    x.fillStyle = '#3d2a1a';
    x.fillRect(px - 2, py - 2, T + 4, T + 4);
  }
  for (let i = 0; i < MW * MH; i++) {
    if (terr[i] !== 4) continue;
    const px = (i % MW) * T,
      py = ((i / MW) | 0) * T;
    x.fillStyle = lin(x, 0, py, 0, py + T, ['#664630', '#573b26']);
    x.fillRect(px, py, T, T);
    for (let r = 0; r < 4; r++) {
      x.fillStyle = 'rgba(30,18,10,.35)';
      x.fillRect(px, py + 6 + r * 8, T, 2);
      x.fillStyle = 'rgba(150,110,75,.25)';
      x.fillRect(px, py + 4 + r * 8, T, 1);
    }
    for (let r = 0; r < 4; r++)
      if (R() < 0.8)
        for (let k = 0; k < 3; k++) {
          const cx = px + 5 + k * 11 + R() * 2,
            cy = py + 3 + r * 8;
          circ(x, cx - 1.3, cy, 1.7, '#5f9a3a');
          circ(x, cx + 1.3, cy, 1.7, '#5f9a3a');
          circ(x, cx, cy - 1.2, 1.6, '#8cc95a');
        }
  }
  // paths: one continuous band joining neighbouring path tiles, with soft edges and gravel speckle
  const pathSegs = [];
  for (let i = 0; i < MW * MH; i++) {
    if (terr[i] !== 1) continue;
    const tx = i % MW,
      ty = (i / MW) | 0;
    pathSegs.push([tx, ty, tx, ty]);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [-1, 1],
    ])
      if (at(tx + dx, ty + dy) === 1) pathSegs.push([tx, ty, tx + dx, ty + dy]);
  }
  const band = (ctx, width, colour) => {
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of pathSegs) {
      ctx.moveTo(x0 * T + T / 2, y0 * T + T / 2);
      ctx.lineTo(x1 * T + T / 2 + 0.01, y1 * T + T / 2);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.stroke();
  };
  x.save();
  x.shadowColor = 'rgba(60,48,30,.6)';
  x.shadowBlur = 10;
  band(x, T * 1.3, 'rgba(85,70,45,.35)');
  x.restore();
  const pc = document.createElement('canvas');
  pc.width = WW;
  pc.height = WH;
  const p = pc.getContext('2d');
  band(p, T * 1.12, '#a99872');
  p.globalCompositeOperation = 'source-atop';
  for (const [tx, ty, ex, ey] of pathSegs) {
    if (tx !== ex || ty !== ey) continue;
    for (let k = 0; k < 30; k++) {
      const v = R();
      p.fillStyle = v < 0.4 ? '#8b7b5c' : v < 0.8 ? '#c4b48f' : '#e0d3b0';
      const sz = 1 + R() * 1.6;
      p.fillRect(tx * T - 6 + R() * (T + 12), ty * T - 6 + R() * (T + 12), sz, sz);
    }
  }
  p.lineWidth = 1;
  p.strokeStyle = 'rgba(255,245,220,.12)';
  band(p, T * 0.25, 'rgba(255,245,220,.10)');
  x.save();
  x.shadowColor = '#a99872';
  x.shadowBlur = 3;
  x.drawImage(pc, 0, 0);
  x.restore();
  // ponds
  const ponds = [];
  for (let i = 0; i < MW * MH; i++) if (terr[i] === 2) ponds.push(i);
  for (const i of ponds) circ(x, (i % MW) * T + T / 2, ((i / MW) | 0) * T + T / 2 + 2, T * 0.9, '#5c4a30');
  for (const i of ponds) circ(x, (i % MW) * T + T / 2, ((i / MW) | 0) * T + T / 2, T * 0.8, '#2a5d78');
  for (const i of ponds) {
    const tx = i % MW,
      ty = (i / MW) | 0;
    let deep = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(tx + dx, ty + dy) === 2) deep++;
    if (deep >= 8) circ(x, tx * T + T / 2, ty * T + T / 2, T * 0.75, '#1f4c66');
  }
  for (const i of ponds) {
    const px = (i % MW) * T,
      py = ((i / MW) | 0) * T;
    if (R() < 0.35) ell(x, px + R() * T, py + R() * T, 6 + R() * 6, 2, 'rgba(200,235,250,.18)', R() * 0.4);
    if (R() < 0.16) {
      const lx = px + 6 + R() * 20,
        ly = py + 6 + R() * 20;
      x.beginPath();
      x.arc(lx, ly, 5.5, 0.3, Math.PI * 2 - 0.3);
      x.lineTo(lx, ly);
      x.fillStyle = '#4f8a3a';
      x.fill();
      if (R() < 0.4) circ(x, lx + 1, ly - 1, 1.8, '#f3c7d8');
    }
  }
  for (const i of ponds) {
    const tx = i % MW,
      ty = (i / MW) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (at(tx + dx, ty + dy) === 2 || R() < 0.5) continue;
      const bx = tx * T + T / 2 + dx * T * 0.62,
        by = ty * T + T / 2 + dy * T * 0.62;
      for (let k = 0; k < 5; k++) {
        const rx = bx + (R() - 0.5) * 12,
          ry = by + (R() - 0.5) * 12;
        line(x, rx, ry, rx + (R() - 0.5) * 3, ry - 6 - R() * 6, '#5d7a32', 1.4);
        if (R() < 0.3) ell(x, rx, ry - 8, 1.2, 2.6, '#5a3d20');
      }
    }
  }
  // hedges
  const hedges = [];
  for (let i = 0; i < MW * MH; i++) if (terr[i] === 3) hedges.push(i);
  for (const i of hedges)
    circ(x, (i % MW) * T + T / 2 + 3, ((i / MW) | 0) * T + T / 2 + 5, T * 0.68, 'rgba(0,0,0,.32)');
  for (const i of hedges) circ(x, (i % MW) * T + T / 2, ((i / MW) | 0) * T + T / 2, T * 0.68, '#1f3d1a');
  for (const i of hedges) {
    const px = (i % MW) * T,
      py = ((i / MW) | 0) * T;
    circ(x, px + T / 2 - 3, py + T / 2 - 3, T * 0.5, '#2b5324');
    for (let k = 0; k < 9; k++) {
      const a = R();
      circ(
        x,
        px + 4 + R() * 24,
        py + 4 + R() * 24,
        1.6 + R() * 1.8,
        a < 0.45 ? '#3d7232' : a < 0.8 ? '#18331a' : '#4f8a3e'
      );
    }
    if (R() < 0.12) for (let k = 0; k < 3; k++) circ(x, px + 6 + R() * 20, py + 6 + R() * 20, 1.3, '#f4f0e4');
  }
  if (S.textures.exists('terrain')) S.textures.remove('terrain');
  S.textures.addCanvas('terrain', cv);
  return cv;
}
