// Building and training queues, repairs, upgrades research, placement rules, selling.
'use strict';

/* ---------------- production, repair, research ---------------- */
function applyUpgrade(team, key) {
  G.up[team][key] = true;
  if (key === 'toecaps')
    for (const e of G.ents)
      if (!e.dead && e.unit && e.team === team && e.d.armor === 'inf') {
        e.hp *= 1.3;
        e.maxHp *= 1.3;
      }
  if (key === 'mulch')
    for (const e of G.ents)
      if (!e.dead && e.bld && e.team === team) {
        e.hp *= 1.3;
        e.maxHp *= 1.3;
      }
}
function updProduction(dt) {
  for (const team of [0, 1]) {
    const f = (lowPower(team) ? 0.5 : 1) * (team === 1 ? 1 / G.D.aiProd : 1);
    const b = G.build[team];
    if (b && !b.ready && has(team, 'hq')) {
      b.t += dt * f;
      if (b.t >= b.total) {
        b.ready = true;
        if (team === 0) GameAudio.sound('ready', 0, 0, true);
        if (team === 0)
          announce('Ready to plant. ' + (touchUI() ? 'Tap' : 'Click') + ' the packet, then the ground');
      }
    }
    const r = G.research[team];
    if (r && has(team, UPGRADES[r.key].req)) {
      r.t += dt * f;
      if (r.t >= r.total) {
        applyUpgrade(team, r.key);
        if (team === 0) GameAudio.sound('capture', 0, 0, true);
        G.research[team] = null;
        if (team === 0) announce(UPGRADES[r.key].names[0] + ' researched');
      }
    }
  }
  for (const e of G.ents) {
    if (e.dead || !e.bld) continue;
    if (e.repairing) {
      if (e.hp >= e.maxHp) {
        e.repairing = false;
      } else {
        const add = e.maxHp * 0.05 * dt,
          cost = (add * (Math.max(e.d.cost, 400) * 0.5)) / e.maxHp;
        if (G.money[e.team] >= cost) {
          G.money[e.team] -= cost;
          e.hp = Math.min(e.maxHp, e.hp + add);
          e.healT = (e.healT || 0) - dt;
          if (e.healT <= 0 && e.team === 0) {
            e.healT = 0.7;
            fx(
              e.x + (Math.random() - 0.5) * e.w * T * 0.6,
              e.y + (Math.random() - 0.5) * e.h * T * 0.6,
              'heal',
              0.9,
              0.6
            );
          }
        } else {
          e.repairing = false;
          if (e.team === 0) announce('Not enough compost to keep repairing', true);
        }
      }
    }
    if (!e.queue.length) continue;
    const f = (lowPower(e.team) ? 0.5 : 1) * (e.team === 1 ? 1 / G.D.aiProd : 1);
    e.prodT += dt * f;
    const k = e.queue[0];
    if (e.prodT >= UNITS[k].time) {
      const ref = e.rally || { x: e.x, y: (e.ty + e.h + 1) * T };
      PF.team = e.team;
      const t = ringFree(e, ref);
      if (!t) {
        e.prodT = UNITS[k].time - 0.5;
        continue;
      }
      e.prodT = 0;
      e.queue.shift();
      const u = addUnit(e.team, k, t[0] * T + T / 2, t[1] * T + T / 2);
      if (u.d.harv) u.hs = 'seek';
      else if (e.rally) {
        u.order = { type: 'move', x: e.rally.x, y: e.rally.y };
        setPath(u, e.rally.x, e.rally.y);
      }
      if (e.team === 0 && G.time - G.readyT > 2) {
        GameAudio.sound('ready', 0, 0, true);
        G.readyT = G.time;
        announce(u.d.names[0] + ' ready');
      }
    }
  }
}
function canPlace(team, kind, tx, ty, skipNear) {
  const d = BLDS[kind];
  for (let y = ty; y < ty + d.h; y++)
    for (let x = tx; x < tx + d.w; x++) {
      if (x < 1 || y < 1 || x > MW - 2 || y > MH - 2) return false;
      const k = idx(x, y);
      if (G.blocked[k] || G.heapAt[k] >= 0 || G.gardenAt[k]) return false;
      if (team === 0 && G.vis[k] === 0) return false;
    }
  if (skipNear) return true;
  const reach = 3;
  for (const b of G.ents) {
    if (b.dead || !b.bld || b.team !== team) continue;
    const gx = Math.max(b.tx - (tx + d.w), tx - (b.tx + b.w), 0),
      gy = Math.max(b.ty - (ty + d.h), ty - (b.ty + b.h), 0);
    if (Math.max(gx, gy) <= reach) return true;
  }
  return false;
}
function sellBuilding(e) {
  if (!e || e.dead || e.kind === 'hq') return;
  const refund = Math.floor((e.d.cost * 0.5 * e.hp) / e.maxHp);
  G.money[e.team] += refund;
  e.dead = true;
  e.spr.destroy();
  clearFootprint(e);
  fx(e.x, e.y, 'puff', 1.2, 0.6);
  if (!e.d.wall) debris(e.x, e.y, 6, e.w * T * 0.6);
  if (e.team === 0) {
    floatText(e.x, e.y - 10, '+' + refund);
    G.sel = G.sel.filter(o => o !== e);
  }
  G.ents = G.ents.filter(o => !o.dead);
}
