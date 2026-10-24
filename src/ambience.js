// Background life and a purely visual, eight-minute day/night cycle.
'use strict';

/* ---------------- ambience ---------------- */
function initAmbience(sc) {
  sc.clouds = [];
  if (G.headless) return;
  initDaylight(sc);
  for (let i = 0; i < 4; i++)
    sc.clouds.push(
      sc.add
        .image(Math.random() * WW, Math.random() * WH, 'cloud')
        .setDepth(4.9)
        .setScale(3 + Math.random() * 2)
        .setAlpha(0.14)
    );
  sc.flies = [];
  for (let i = 0; i < 10; i++) {
    const f = {
      x: 200 + Math.random() * (WW - 400),
      y: 200 + Math.random() * (WH - 400),
      tx: 0,
      ty: 0,
      t: Math.random() * 10,
    };
    f.tx = f.x;
    f.ty = f.y;
    f.spr = sc.add
      .image(f.x, f.y, 'fly' + (i % 3))
      .setDepth(4.8)
      .setScale(0.9);
    sc.flies.push(f);
  }
  sc.rippleT = 0;
  sc.ponds = [];
  for (let i = 0; i < MW * MH; i++) if (G.terr[i] === 2) sc.ponds.push(i);
}
function updAmbience(sc, dt) {
  if (G.headless) return;
  for (const c of sc.clouds) {
    c.x += 9 * dt;
    c.y += 3 * dt;
    if (c.x > WW + 500) {
      c.x = -500;
      c.y = Math.random() * WH;
    }
    if (c.y > WH + 400) c.y = -400;
  }
  for (const f of sc.flies) {
    f.t += dt;
    const dx = f.tx - f.x,
      dy = f.ty - f.y,
      d = Math.hypot(dx, dy);
    if (d < 6) {
      f.tx = clamp(f.x + (Math.random() - 0.5) * 260, 60, WW - 60);
      f.ty = clamp(f.y + (Math.random() - 0.5) * 260, 60, WH - 60);
    } else {
      f.x += (dx / d) * 28 * dt + Math.sin(f.t * 3) * 12 * dt;
      f.y += (dy / d) * 28 * dt + Math.cos(f.t * 2.3) * 12 * dt;
    }
    f.spr
      .setPosition(f.x, f.y - 6)
      .setScale(0.9 * (0.3 + 0.7 * Math.abs(Math.sin(f.t * 14))), 0.9)
      .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
      .setAlpha(1 - (sc.daylight ? sc.daylight.night : 0))
      .setVisible(visibleToPlayerPt(f.x, f.y));
  }
  sc.rippleT -= dt;
  if (sc.rippleT <= 0 && sc.ponds.length) {
    sc.rippleT = 0.35;
    const i = sc.ponds[(Math.random() * sc.ponds.length) | 0];
    const x = (i % MW) * T + Math.random() * T,
      y = ((i / MW) | 0) * T + Math.random() * T;
    if (visibleToPlayerPt(x, y)) {
      const g = sc.add.graphics().setDepth(1.5);
      g.lineStyle(1, 0xd8f0fb, 0.5);
      g.strokeEllipse(0, 0, 10, 5);
      g.setPosition(x, y);
      sc.tweens.add({ targets: g, scale: 2.4, alpha: 0, duration: 1400, onComplete: () => g.destroy() });
    }
  }
}

const DAYLIGHT_SECONDS = 480;
const DAYLIGHT_STOPS = [
  // fraction, terrain, buildings, night lights, water reflections
  [0, 0xfff5df, 0xfffaf1, 0, 0.1],
  [0.22, 0xffe2b3, 0xffedcf, 0, 0.25],
  [0.38, 0xe4ac97, 0xffd9be, 0.2, 0.6],
  [0.51, 0x9cabc9, 0xcad3ec, 0.8, 0.25],
  [0.62, 0x8098bd, 0xb5c7e1, 1, 0.3],
  [0.78, 0x8098bd, 0xb5c7e1, 1, 0.3],
  [0.92, 0xe8c6b1, 0xf7e5db, 0.25, 0.4],
  [1, 0xfff5df, 0xfffaf1, 0, 0.1],
];

function daylightAt(seconds) {
  const phase = (((seconds % DAYLIGHT_SECONDS) + DAYLIGHT_SECONDS) % DAYLIGHT_SECONDS) / DAYLIGHT_SECONDS;
  let i = 1;
  while (phase > DAYLIGHT_STOPS[i][0]) i++;
  const a = DAYLIGHT_STOPS[i - 1],
    b = DAYLIGHT_STOPS[i];
  const p = (phase - a[0]) / (b[0] - a[0]),
    t = p * p * (3 - 2 * p);
  const colour = (x, y) => {
    let out = 0;
    for (const shift of [16, 8, 0])
      out |= Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t) << shift;
    return out;
  };
  return {
    phase,
    terrain: colour(a[1], b[1]),
    buildings: colour(a[2], b[2]),
    night: a[3] + (b[3] - a[3]) * t,
    water: a[4] + (b[4] - a[4]) * t,
  };
}

function initDaylight(sc) {
  // This separate random stream never changes combat, AI or production rolls.
  const R = mulberry32(G.seed ^ 0x4d6f6f6e);
  sc.evening = { R, fireflies: [], reflections: [], smoke: [], smokeT: 0 };
  const ev = sc.evening;
  if (!sc.textures.exists('lantern-glow'))
    mkTex('lantern-glow', 64, 64, c => {
      c.fillStyle = rad(c, 32, 32, 32, [
        'rgba(255,208,105,.6)',
        'rgba(255,172,60,.18)',
        'rgba(255,172,60,0)',
      ]);
      c.fillRect(0, 0, 64, 64);
    });
  const crops = [];
  for (let i = 0; i < G.terr.length; i++) if (G.terr[i] === 4) crops.push(i);
  for (let i = 0; i < Math.min(48, crops.length); i++) {
    const tile = crops[Math.floor(R() * crops.length)];
    ev.fireflies.push({
      x: ((tile % MW) + R()) * T,
      y: (Math.floor(tile / MW) + R()) * T,
      phase: R() * Math.PI * 2,
      speed: 0.4 + R() * 0.5,
      spr: sc.add.image(0, 0, 'lantern-glow').setDepth(4.6).setScale(0.16).setVisible(false),
      dot: sc.add.circle(0, 0, 1.1, 0xf5ffb0).setDepth(4.61).setVisible(false),
    });
  }
  const ponds = [];
  for (let i = 0; i < G.terr.length; i++) if (G.terr[i] === 2) ponds.push(i);
  for (let i = 0; i < Math.min(48, ponds.length); i++) {
    const tile = ponds[Math.floor(R() * ponds.length)];
    ev.reflections.push({
      x: ((tile % MW) + 0.25 + R() * 0.5) * T,
      y: (Math.floor(tile / MW) + 0.25 + R() * 0.5) * T,
      phase: R() * 6.28,
      spr: sc.add
        .ellipse(0, 0, 5 + R() * 10, 1.2, 0xe6efff)
        .setDepth(0.5)
        .setVisible(false),
    });
  }
  // A fixed pool prevents particles accumulating in long matches.
  for (let i = 0; i < 16; i++)
    ev.smoke.push({
      age: 9,
      spr: sc.add.image(0, 0, 'puff').setDepth(4.5).setTint(0xd7dfdf).setVisible(false),
    });
  ev.lamps = sc.add.graphics().setDepth(2.15);
  ev.pools = sc.add.graphics().setDepth(1.8);
  sc.daylight = daylightAt(G.time);
}

// Window positions are fractions of the displayed building texture. Separate
// layouts follow the painted blue shed and red clubhouse, rather than a generic box.
const EVENING_WINDOWS = {
  hq: [
    [[0.71, 0.64, 0.075, 0.12]],
    [
      [0.23, 0.69, 0.08, 0.1],
      [0.76, 0.69, 0.08, 0.1],
    ],
  ],
  shed: [
    [
      [0.42, 0.67, 0.11, 0.1],
      [0.61, 0.62, 0.1, 0.1],
    ],
    [
      [0.39, 0.68, 0.08, 0.09],
      [0.68, 0.67, 0.07, 0.08],
    ],
  ],
  tunnel: [
    [[0.28, 0.7, 0.11, 0.1]],
    [
      [0.22, 0.53, 0.035, 0.07],
      [0.77, 0.53, 0.035, 0.07],
    ],
  ],
};

function renderDaylight(sc, dt) {
  if (G.headless || !sc.evening) return;
  const light = (sc.daylight = daylightAt(G.time)),
    ev = sc.evening;
  const motion = !GARDEN_MOTION.matches,
    time = motion ? G.time : 0;
  sc.terrain.setTint(light.terrain);
  for (const c of sc.clouds) c.setAlpha(0.14 * (1 - light.night * 0.65));
  ev.lamps.clear();
  ev.pools.clear();
  for (const e of G.ents) {
    if (e.dead || !e.bld || !EVENING_WINDOWS[e.kind] || !visibleToPlayer(e)) continue;
    const amount = light.night * (lowPower(e.team) ? 0.4 : 1);
    if (amount < 0.01) continue;
    const x = e.tx * T,
      y = e.ty * T,
      w = e.w * T,
      h = e.h * T;
    for (const [wx, wy, ww, wh] of EVENING_WINDOWS[e.kind][e.team]) {
      const xx = x + wx * w,
        yy = y + wy * h;
      ev.lamps.fillStyle(0xffb852, amount * 0.65);
      ev.lamps.fillRoundedRect(xx - (ww * w) / 2, yy - (wh * h) / 2, ww * w, wh * h, 1);
      ev.lamps.fillStyle(0xffefb0, amount * 0.5);
      ev.lamps.fillRect(xx - 0.5, yy - wh * h * 0.35, 1, wh * h * 0.7);
    }
    // Small entrance lanterns and soft ground pools, below troops and selection marks.
    const lx = x + w * (e.team ? 0.8 : 0.34),
      ly = y + h * 0.78;
    for (let r = 3; r > 0; r--) {
      ev.pools.fillStyle(0xffc064, amount * 0.025);
      ev.pools.fillEllipse(lx, y + h * 0.94, 18 + r * 12, 6 + r * 5);
    }
    ev.lamps.fillStyle(0x43392a, amount);
    ev.lamps.fillRoundedRect(lx - 2, ly - 3, 4, 6, 1);
    ev.lamps.fillStyle(0xffdf90, amount);
    ev.lamps.fillRect(lx - 1, ly - 2, 2, 3);
  }
  for (const f of ev.fireflies) {
    const x = f.x + Math.sin(time * f.speed + f.phase) * 13,
      y = f.y + Math.cos(time * f.speed * 0.7 + f.phase) * 9;
    const on = light.night > 0.1 && visibleToPlayerPt(x, y);
    const alpha = light.night * (motion ? 0.45 + 0.4 * Math.sin(time * 1.3 + f.phase) ** 2 : 0.65);
    f.spr
      .setPosition(x, y)
      .setAlpha(alpha * 0.7)
      .setVisible(on);
    f.dot.setPosition(x, y).setAlpha(alpha).setVisible(on);
  }
  for (const r of ev.reflections) {
    r.spr
      .setPosition(r.x, r.y)
      .setFillStyle(light.night > 0.6 ? 0xd4e7ff : 0xffdc9b)
      .setAlpha(light.water * (motion ? 0.3 + 0.4 * Math.sin(time * 0.8 + r.phase) ** 2 : 0.5))
      .setScale(motion ? 0.8 + Math.sin(time * 0.6 + r.phase) * 0.2 : 1, 1)
      .setVisible(visibleToPlayerPt(r.x, r.y));
  }
  if (motion && dt > 0) {
    ev.smokeT -= dt;
    if (ev.smokeT <= 0) {
      ev.smokeT = 0.9;
      for (const e of G.ents) {
        if (e.dead || e.kind !== 'hq' || e.hp < e.maxHp * 0.5 || !visibleToPlayer(e)) continue;
        const p = ev.smoke.find(p => p.age >= 3.5);
        if (!p) break;
        p.age = 0;
        p.x = (e.tx + e.w * (e.team ? 0.16 : 0.33)) * T;
        p.y = (e.ty + e.h * (e.team ? 0.19 : 0.2)) * T;
        p.drift = 4 + ev.R() * 4;
      }
    }
  }
  for (const p of ev.smoke) {
    p.age += dt;
    const on = motion && p.age < 3.5 && visibleToPlayerPt(p.x, p.y);
    p.spr.setVisible(on);
    if (on)
      p.spr
        .setPosition(p.x + p.age * p.drift, p.y - p.age * 9)
        .setScale(0.12 + p.age * 0.08)
        .setAlpha(Math.sin((p.age / 3.5) * Math.PI) * 0.2);
  }
}
