// Shooting, projectiles, damage, destruction and visual effects.
'use strict';

/* ---------------- combat ---------------- */
function fire(e, t) {
  const d = e.d,
    ak = e.kind,
    pk = d.proj;
  let dmg = d.dmg;
  if (e.unit && d.armor === 'veh' && G.up[e.team].tines) dmg *= 1.25;
  if (!pk) {
    damage(t, dmg, ak, e);
    fx(t.x + (Math.random() - 0.5) * 8, t.y + (Math.random() - 0.5) * 8, 'puff', 0.35, 0.25);
    return;
  }
  const kind = pk === 'pumpkin' && e.team === 1 ? 'bowl' : pk;
  const sx = e.bld ? e.x : e.x + Math.cos(e.ang) * 10,
    sy = e.bld ? e.y - 10 : e.y + Math.sin(e.ang) * 10;
  const arc = pk === 'pumpkin' || (e.bld && pk === 'clod');
  const p = {
    kind,
    x: sx,
    y: sy,
    tx: t.x,
    ty: t.y,
    t,
    team: e.team,
    dmg,
    ak,
    src: e,
    splash: d.splash || 0,
    soak: d.soak || 0,
    arc,
    speed: pk === 'drop' ? 430 : pk === 'clod' ? 300 : pk === 'bees' ? 240 : 210,
  };
  if (t.bld && !arc) {
    p.tx = clamp(e.x, t.tx * T + 6, (t.tx + t.w) * T - 6);
    p.ty = clamp(e.y, t.ty * T + 6, (t.ty + t.h) * T - 6);
  }
  p.total = Math.max(1, Math.hypot(p.tx - sx, p.ty - sy));
  if (!G.headless) {
    const launchLift = paintedInfantry(e) ? 9 : 0;
    p.spr = S.add.image(sx, sy - launchLift, kind).setDepth(5);
    if (arc) p.sh = S.add.image(sx, sy, 'pshadow').setDepth(4.4);
    if (pk === 'drop' && visibleToPlayerPt(sx, sy))
      for (let k = 0; k < 2; k++) {
        const im = S.add
          .image(sx, sy - launchLift, 'drop')
          .setDepth(5)
          .setScale(0.7);
        const a = Math.atan2(t.y - sy, t.x - sx) + (Math.random() - 0.5) * 0.5,
          l = p.total * (0.5 + Math.random() * 0.4);
        S.tweens.add({
          targets: im,
          x: sx + Math.cos(a) * l,
          y: sy + Math.sin(a) * l,
          alpha: 0,
          duration: (l / 430) * 1000,
          onComplete: () => im.destroy(),
        });
      }
    if (pk === 'clod' || pk === 'pumpkin') fx(sx, sy, 'puff', 0.4, 0.25);
  }
  if (e.kind === 'cata') e.fireT = 0.6;
  G.proj.push(p);
}
const visibleToPlayerPt = (x, y) =>
  G.vis[idx(clamp(tileOf(x), 0, MW - 1), clamp(tileOf(y), 0, MH - 1))] === 2;
function updProj(dt) {
  for (const p of G.proj) {
    if (!p.arc && p.t && !p.t.dead && p.t.unit) {
      p.tx = p.t.x;
      p.ty = p.t.y;
    }
    const dx = p.tx - p.x,
      dy = p.ty - p.y,
      d = Math.hypot(dx, dy),
      st = p.speed * dt;
    if (d <= st) {
      p.done = true;
      impact(p);
      if (p.spr) p.spr.destroy();
      if (p.sh) p.sh.destroy();
      continue;
    }
    p.x += (dx / d) * st;
    p.y += (dy / d) * st;
    if (!p.spr) continue;
    let h = 0;
    if (p.arc) {
      const pr = clamp(1 - d / p.total, 0, 1);
      h = Math.sin(Math.PI * pr) * Math.min(64, p.total * 0.35);
      p.spr.setScale(1 + 0.35 * Math.sin(Math.PI * pr));
      p.spr.rotation += dt * 6;
    }
    if (p.kind === 'bees') p.spr.rotation += dt * 10;
    const vis = p.team === 0 || visibleToPlayerPt(p.x, p.y);
    const launchLift = p.src && paintedInfantry(p.src) ? 9 * clamp(d / p.total, 0, 1) : 0;
    p.spr.setPosition(p.x, p.y - h - launchLift).setVisible(vis);
    if (p.sh)
      p.sh
        .setPosition(p.x, p.y)
        .setVisible(vis)
        .setScale(1 - h / 120);
  }
  if (G.proj.some(p => p.done)) G.proj = G.proj.filter(p => !p.done);
}
function impact(p) {
  const tex = p.kind === 'drop' ? 'splash' : p.kind === 'bees' ? 'buzz' : 'splat';
  impactAccent(p);
  if (p.splash) {
    const R = p.splash * T;
    for (const o of G.ents) {
      if (o.dead || o.team === p.team) continue;
      const d = o.bld ? rectDist(p.tx, p.ty, o) : Math.hypot(o.x - p.tx, o.y - p.ty);
      if (d <= R) damage(o, p.dmg * (d < R * 0.4 ? 1 : 0.6), p.ak, p.src);
    }
    fx(p.tx, p.ty, tex, 0.9, 0.5);
    if (p.kind !== 'bees') fx(p.tx, p.ty, 'puff', 0.7, 0.4);
  } else {
    if (p.t && !p.t.dead) {
      const d = p.t.bld ? rectDist(p.tx, p.ty, p.t) : Math.hypot(p.t.x - p.tx, p.t.y - p.ty);
      if (d <= (p.t.bld ? 8 : p.t.d.r + 8)) {
        damage(p.t, p.dmg, p.ak, p.src);
        if (p.soak && p.t.unit) p.t.soakT = p.soak;
      }
    }
    fx(p.tx, p.ty, tex, 0.45, 0.3);
  }
}
// One short-lived drawing per impact: directional droplets, pumpkin fragments or bee sparks.
// Uses fixed angles so visual detail cannot perturb the simulation's random sequence.
function impactAccent(p) {
  if (G.headless || !visibleToPlayerPt(p.tx, p.ty)) return;
  const water = p.kind === 'drop',
    bees = p.kind === 'bees';
  const col = water ? 0xc3ecf0 : bees ? 0xeed481 : p.kind === 'pumpkin' ? 0xe9a04d : 0xc0a074;
  const g = S.add.graphics().setPosition(p.tx, p.ty).setDepth(4.55);
  const radius = p.splash ? 18 : 9;
  g.lineStyle(1.2, col, 0.65);
  g.strokeEllipse(0, 0, radius * 1.8, radius);
  g.fillStyle(col, 0.85);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + p.tx * 0.03;
    const x = Math.cos(a) * radius,
      y = Math.sin(a) * radius * 0.6;
    if (water || bees) g.fillCircle(x, y, water ? 1.5 : 1);
    else g.fillRect(x, y, 3, 2);
  }
  S.tweens.add({
    targets: g,
    scale: 1.7,
    alpha: 0,
    duration: water ? 280 : 420,
    ease: 'Cubic.Out',
    onComplete: () => g.destroy(),
  });
}
function damage(t, amt, ak, src) {
  if (t.dead) return;
  const arm = t.bld ? 'bld' : t.d.armor;
  const m = MULT[ak] ? MULT[ak][arm] : 1;
  t.hp -= amt * m;
  t.flashUntil = performance.now() + 90;
  t.lastHit = G.time;
  t.lastAttacker = src;
  if (t.team === 0 && G.time - G.alertT > 12 && ((t.bld && !t.d.wall) || (t.unit && t.d.harv))) {
    G.alertT = G.time;
    announce(t.bld ? 'Our plot is under attack' : 'A wheelbarrow is under attack', true);
  }
  if (src && !src.dead && src.team !== t.team && G.time - (t.rallyT || -9) > 1) {
    t.rallyT = G.time;
    for (const u of G.ents) {
      if (u.dead || !u.unit || u.team !== t.team || u.d.harv || u.order || u.target) continue;
      if (Math.hypot(u.x - t.x, u.y - t.y) < 11 * T) {
        u.target = src;
        u.repT = 0;
      }
    }
  }
  if (t.hp <= 0) kill(t);
}
function clearFootprint(t) {
  for (let y = t.ty; y < t.ty + t.h; y++)
    for (let x = t.tx; x < t.tx + t.w; x++) {
      const i = idx(x, y);
      G.blocked[i] = 0;
      G.bldAt[i] = 0;
      G.wallAt[i] = 0;
      G.wallTeam[i] = -1;
      G.gateTeam[i] = -1;
    }
  if (!t.d.wall) recalcPower(t.team);
  else refreshWallsAround(t.tx, t.ty);
}
function debris(x, y, n, spread) {
  if (G.headless) return;
  for (let i = 0; i < n; i++) {
    const im = S.add
      .image(x, y, 'debris')
      .setDepth(4.6)
      .setRotation(Math.random() * 6);
    const a = Math.random() * Math.PI * 2,
      l = spread * (0.4 + Math.random() * 0.8);
    S.tweens.add({
      targets: im,
      x: x + Math.cos(a) * l,
      y: y + Math.sin(a) * l,
      rotation: im.rotation + (Math.random() - 0.5) * 8,
      alpha: 0,
      duration: 700 + Math.random() * 400,
      ease: 'Cubic.Out',
      onComplete: () => im.destroy(),
    });
  }
}
function kill(t) {
  t.dead = true;
  t.spr.destroy();
  if (t.sh) t.sh.destroy();
  if (t.bld) {
    clearFootprint(t);
    if (!t.d.wall) {
      if (!G.headless)
        S.add
          .image(t.x, t.y, 'scorch')
          .setDepth(1)
          .setScale(Math.max(t.w, t.h) * 0.6)
          .setAlpha(0.8);
      for (let i = 0; i < 7; i++)
        fx(
          t.x + (Math.random() - 0.5) * t.w * T,
          t.y + (Math.random() - 0.5) * t.h * T,
          i % 3 ? 'puff' : 'smoke',
          1.5,
          1
        );
      debris(t.x, t.y, 12, t.w * T);
      if (t.kind === 'hq' && t.team === 0 && !has(0, 'hq'))
        announce('The Allotment Shed is gone. No more planting', true);
    } else {
      fx(t.x, t.y, 'puff', 0.8, 0.5);
      debris(t.x, t.y, 4, 24);
    }
    if (G.sel.includes(t)) G.sel = G.sel.filter(e => e !== t);
  } else {
    fx(t.x, t.y, 'puff', 0.9, 0.5);
    fx(t.x, t.y, 'splat', 0.6, 0.6);
    if (t.d.armor === 'veh') debris(t.x, t.y, 6, 26);
  }
  if (!isWall(t)) {
    if (t.team === 1) G.stats.killed++;
    else G.stats.lost++;
  }
}
function fx(x, y, tex, scale, life) {
  if (G.headless) return;
  if (!visibleToPlayerPt(x, y)) return;
  const im = S.add
    .image(x, y, tex)
    .setDepth(4.5)
    .setScale(scale * 0.5);
  S.tweens.add({
    targets: im,
    scale: scale,
    alpha: 0,
    duration: life * 1000,
    onComplete: () => im.destroy(),
  });
}
function floatText(x, y, s, col) {
  if (G.headless) return;
  const t = S.add
    .text(x, y, s, {
      fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: col || '#f0e3c2',
      stroke: '#1a1410',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(7);
  S.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
}
