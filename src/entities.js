// Creating buildings and units, water (power), visibility checks.
'use strict';

/* ---------------- entities ---------------- */
const own = (team, kind) => G.ents.filter(e => !e.dead && e.team === team && e.kind === kind);
const has = (team, kind) => G.ents.some(e => !e.dead && e.team === team && e.kind === kind);
function prereqMet(team, kind) {
  if (UNITS[kind]) return has(team, UNITS[kind].from);
  if (UPGRADES[kind]) return has(team, UPGRADES[kind].req);
  const r = BLDS[kind].req;
  return !r || has(team, r);
}
function recalcPower(team) {
  let m = 0,
    u = 0;
  for (const e of G.ents) {
    if (e.dead || !e.bld || e.team !== team) continue;
    if (e.d.power > 0) m += e.d.power;
    else u -= e.d.power;
  }
  const was = lowPower(team);
  G.power[team] = { made: m, used: u };
  if (team === 0 && !was && lowPower(0) && G.started) announce('Water running low. Plant a Water Butt', true);
}
const lowPower = team => G.power[team].used > G.power[team].made;
const capOf = e => CAP * (G.up[e.team].barrows ? 1.5 : 1);

function addBuilding(team, kind, tx, ty, free) {
  const d = BLDS[kind];
  const hpm = G.up[team].mulch ? 1.3 : 1;
  const e = {
    id: G.nextId++,
    team,
    kind,
    bld: true,
    d,
    tx,
    ty,
    w: d.w,
    h: d.h,
    x: (tx + d.w / 2) * T,
    y: (ty + d.h / 2) * T,
    hp: d.hp * hpm,
    maxHp: d.hp * hpm,
    queue: [],
    prodT: 0,
    cd: 0,
    scanT: 0,
    rally: null,
    flash: 0,
    smokeT: Math.random(),
  };
  const key = d.gate ? `gate_${team}_0` : d.wall ? `wall_${team}_10` : kind + '_' + team;
  e.spr = S.add.image(e.x, e.y, key).setDepth(d.wall ? 2.2 : 2);
  for (let y = ty; y < ty + d.h; y++)
    for (let x = tx; x < tx + d.w; x++) {
      const i = idx(x, y);
      G.blocked[i] = 1;
      G.bldAt[i] = e.id;
      if (d.wall) {
        G.wallAt[i] = e.id;
        G.wallTeam[i] = team;
        if (d.gate) G.gateTeam[i] = team;
      }
    }
  G.ents.push(e);
  if (!d.wall) recalcPower(team);
  if (d.wall) refreshWallsAround(tx, ty);
  PF.team = team;
  for (const u of G.ents) {
    if (u.dead || !u.unit) continue;
    const ux = tileOf(u.x),
      uy = tileOf(u.y);
    if (ux >= tx && ux < tx + d.w && uy >= ty && uy < ty + d.h) {
      if (d.gate && u.team === team) continue;
      PF.team = u.team;
      const n = nearestFree(ux, uy, ux, uy);
      if (n) {
        u.x = n[0] * T + T / 2;
        u.y = n[1] * T + T / 2;
        u.path = null;
      }
    }
  }
  if (G.started && !G.headless) {
    e.spr.setScale(0.55).setAlpha(0.3);
    S.tweens.add({ targets: e.spr, scale: 1, alpha: 1, duration: d.wall ? 160 : 420, ease: 'Back.Out' });
    if (!d.wall)
      for (let i = 0; i < 4; i++)
        fx(e.x + (Math.random() - 0.5) * d.w * T, e.y + (Math.random() - 0.5) * d.h * T, 'puff', 1, 0.6);
  }
  if (kind === 'bin' && free) {
    PF.team = team;
    const t = ringFree(e, { x: e.x, y: e.y + T * 2 });
    if (t) {
      const b = addUnit(team, 'barrow', t[0] * T + T / 2, t[1] * T + T / 2);
      b.hs = 'seek';
    }
  }
  return e;
}
function addUnit(team, kind, x, y) {
  const d = UNITS[kind];
  const hpm = G.up[team].toecaps && d.armor === 'inf' ? 1.3 : 1;
  const e = {
    id: G.nextId++,
    team,
    kind,
    unit: true,
    d,
    x,
    y,
    hp: d.hp * hpm,
    maxHp: d.hp * hpm,
    ang: team ? Math.PI : 0,
    path: null,
    order: null,
    target: null,
    cd: 0,
    scanT: Math.random() * 0.3,
    repT: 0,
    guard: { x, y },
    flash: 0,
    stuck: 0,
    stuckN: 0,
    lastX: x,
    lastY: y,
    chase: false,
    animT: Math.random(),
    frame: 0,
    px: x,
    py: y,
    soakT: 0,
    fireT: 0,
    breach: null,
    dest: null,
  };
  if (d.harv) {
    e.load = 0;
    e.hs = 'seek';
    e.ht = 0;
    e.heap = null;
  }
  e.sh = S.add
    .image(x + 2, y + 4, 'shadow')
    .setDepth(2.9)
    .setScale(d.r / 11);
  e.spr = S.add.image(x, y, `${kind}_${team}_0`).setDepth(3).setRotation(e.ang);
  G.ents.push(e);
  return e;
}
function rectDist(px, py, b) {
  const x0 = b.tx * T,
    y0 = b.ty * T,
    x1 = x0 + b.w * T,
    y1 = y0 + b.h * T;
  const dx = Math.max(x0 - px, 0, px - x1),
    dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}
function distTo(e, t) {
  return t.bld ? rectDist(e.x, e.y, t) : Math.hypot(t.x - e.x, t.y - e.y);
}
const angTo = (e, t) => Math.atan2(t.y - e.y, t.x - e.x);
function turn(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
function visibleToPlayer(o) {
  if (o.team === 0) return true;
  if (o.bld) {
    for (let y = o.ty; y < o.ty + o.h; y++)
      for (let x = o.tx; x < o.tx + o.w; x++) if (G.vis[idx(x, y)] === 2) return true;
    return false;
  }
  return G.vis[idx(clamp(tileOf(o.x), 0, MW - 1), clamp(tileOf(o.y), 0, MH - 1))] === 2;
}
function seenByPlayer(o) {
  if (o.team === 0) return true;
  if (o.bld) return G.vis[idx(o.tx, o.ty)] > 0 || visibleToPlayer(o);
  return visibleToPlayer(o);
}
