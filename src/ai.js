// The Tidy Lawns Society: rebuilds its base, harvests, trains troops, defends and sends attack waves.
'use strict';

/* ---------------- enemy AI ---------------- */
function updAI(dt) {
  const A = G.ai;
  A.tick -= dt;
  A.waveT -= dt;
  if (A.tick > 0) return;
  A.tick = 1;
  const myB = G.ents.filter(e => !e.dead && e.team === 1 && e.bld),
    myU = G.ents.filter(e => !e.dead && e.team === 1 && e.unit);
  const hq = myB.find(b => b.kind === 'hq');
  const cur = G.build[1];
  if (cur && cur.ready) {
    let spot = null;
    if (canPlace(1, cur.kind, cur.spot[0], cur.spot[1], true)) spot = cur.spot;
    else if (hq) {
      outer: for (let r = 2; r < 10; r++)
        for (let y = hq.ty - r; y <= hq.ty + r; y++)
          for (let x = hq.tx - r; x <= hq.tx + r; x++)
            if (canPlace(1, cur.kind, x, y, false)) {
              spot = [x, y];
              break outer;
            }
    }
    if (spot) {
      addBuilding(1, cur.kind, spot[0], spot[1], true);
      G.build[1] = null;
    }
  }
  if (!G.build[1] && hq) {
    for (const [k, x, y] of A.layout) {
      if (myB.some(b => b.kind === k && b.tx === x && b.ty === y)) continue;
      if (!prereqMet(1, k)) continue;
      if (G.money[1] >= BLDS[k].cost) {
        G.money[1] -= BLDS[k].cost;
        G.build[1] = { kind: k, t: 0, total: BLDS[k].time, ready: false, spot: [x, y] };
      }
      break;
    }
  }
  const rebuilding =
    !!G.build[1] || A.layout.some(([k, x, y]) => !myB.some(b => b.kind === k && b.tx === x && b.ty === y));
  const reserve = rebuilding ? 400 : 0;
  for (const b of myB)
    if (!b.repairing && b.hp < b.maxHp * 0.9 && G.time - (b.lastHit ?? -99) > 6 && G.money[1] > 300)
      b.repairing = true;
  if (G.D.upgrades && !G.research[1] && G.time > 300) {
    const k = UP_ORDER.find(k => !G.up[1][k] && prereqMet(1, k));
    if (k && G.money[1] > UPGRADES[k].cost + 500) {
      G.money[1] -= UPGRADES[k].cost;
      G.research[1] = { key: k, t: 0, total: UPGRADES[k].time };
    }
  }
  const harvs = myU.filter(u => u.d.harv).length + (hq ? hq.queue.filter(k => k === 'barrow').length : 0);
  if (
    hq &&
    has(1, 'bin') &&
    harvs < (G.time > 420 ? 3 : 2) &&
    !hq.queue.length &&
    G.money[1] >= UNITS.barrow.cost
  ) {
    G.money[1] -= UNITS.barrow.cost;
    hq.queue.push('barrow');
  }
  const army = myU.filter(u => !u.d.harv);
  if (army.length < G.D.cap + A.waveN * (G.diffKey === 'gentle' ? 1 : 2)) {
    for (const b of myB) {
      if (b.queue.length) continue;
      let k = null;
      if (b.kind === 'shed') k = Math.random() < 0.55 ? 'fork' : 'hose';
      else if (b.kind === 'tunnel') k = Math.random() < 0.7 ? 'tiller' : 'cata';
      if (k && G.money[1] - reserve >= UNITS[k].cost) {
        G.money[1] -= UNITS[k].cost;
        b.queue.push(k);
      }
    }
  }
  for (const v of [...myB, ...myU.filter(u => u.d.harv)]) {
    if (G.time - (v.lastHit ?? -99) < 3 && v.lastAttacker && !v.lastAttacker.dead) {
      const att = v.lastAttacker;
      for (const u of army)
        if (!u.wave && !u.target && Math.hypot(u.x - v.x, u.y - v.y) < 16 * T) {
          u.order = { type: 'attack', t: att };
          u.target = att;
          u.path = null;
        }
    }
  }
  updGardenAI(army, hq);
  if (A.waveT <= 0) {
    const idle = army.filter(u => !u.wave && u.gardenId == null);
    const need = Math.min(G.diffKey === 'gentle' ? 2 + A.waveN : 3 + A.waveN * 2, G.D.waveMax);
    if (idle.length >= need) {
      const home = hq || { x: (G.enemyStart.x + 1.5) * T, y: (G.enemyStart.y + 1.5) * T };
      const tgt = playerTarget(home);
      if (tgt) {
        const keep = idle.length > need + 1 ? 2 : 0;
        idle.sort((a, b) => Math.hypot(b.x - home.x, b.y - home.y) - Math.hypot(a.x - home.x, a.y - home.y));
        const send = idle.slice(0, Math.min(idle.length - keep, G.D.waveMax));
        for (const u of send) {
          u.wave = true;
          u.order = { type: 'amove', x: tgt.x, y: tgt.y };
          u.target = null;
          setPath(u, tgt.x, tgt.y);
        }
        A.waveN++;
        A.waveT = G.D.every;
      } else A.waveT = 10;
    } else A.waveT = 12;
  }
  for (const u of army)
    if (u.wave && !u.order && !u.target && !u.breach) {
      const tgt = playerTarget(u);
      if (tgt) {
        u.order = { type: 'amove', x: tgt.x, y: tgt.y };
        setPath(u, tgt.x, tgt.y);
      }
    }
}
function playerTarget(from) {
  let best = null,
    bd = 1e9;
  for (const o of G.ents) {
    if (o.dead || o.team !== 0) continue;
    const d = Math.hypot(o.x - from.x, o.y - from.y) + (o.bld ? (o.d.wall ? 40 * T : 0) : 12 * T);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
