// Mouse and touch orders: selecting, moving, attacking, planting buildings and fences, command buttons.
'use strict';

/* ---------------- input ---------------- */
function pick(wx, wy, tol) {
  tol = tol || 0;
  let best = null,
    bd = 1e9;
  for (let i = G.ents.length - 1; i >= 0; i--) {
    const e = G.ents[i];
    if (e.dead || !e.unit) continue;
    if (e.team === 1 && !visibleToPlayer(e)) continue;
    const d = Math.hypot(e.x - wx, e.y - wy);
    if (d <= e.d.r + 5 + tol && d < bd) {
      bd = d;
      best = e;
    }
  }
  if (best) return best;
  const k = idx(clamp(tileOf(wx), 0, MW - 1), clamp(tileOf(wy), 0, MH - 1));
  const id = G.bldAt[k];
  if (id) {
    const b = G.ents.find(e => e.id === id && !e.dead);
    if (b && seenByPlayer(b)) return b;
  }
  return null;
}
function orderMove(units, type, wx, wy) {
  PF.team = 0;
  const tiles = freeTilesAround(tileOf(wx), tileOf(wy), units.length);
  const goal = { x: wx, y: wy };
  units = units
    .slice()
    .sort((a, b) => Math.hypot(a.x - goal.x, a.y - goal.y) - Math.hypot(b.x - goal.x, b.y - goal.y));
  units.forEach((u, i) => {
    const t = tiles[i] || tiles[0];
    if (!t) return;
    const px = t[0] * T + T / 2,
      py = t[1] * T + T / 2;
    u.order = { type, x: px, y: py };
    u.target = null;
    u.chase = false;
    u.breach = null;
    if (u.d.harv) {
      u.order.type = 'move';
      u.hs = 'idle';
    }
    setPath(u, px, py);
  });
}
function marker(x, y, col) {
  if (G.headless) return;
  const g = S.add.graphics().setDepth(6);
  g.lineStyle(2, col, 1);
  g.strokeCircle(0, 0, 10);
  g.setPosition(x, y);
  S.tweens.add({ targets: g, scale: 0.2, alpha: 0, duration: 450, onComplete: () => g.destroy() });
}
function wallRun(sx, sy, ex, ey) {
  const out = [];
  if (Math.abs(ex - sx) >= Math.abs(ey - sy)) {
    const st = ex >= sx ? 1 : -1;
    for (let x = sx; x !== ex + st && out.length < 24; x += st) out.push([x, sy]);
  } else {
    const st = ey >= sy ? 1 : -1;
    for (let y = sy; y !== ey + st && out.length < 24; y += st) out.push([sx, y]);
  }
  return out;
}
function wallClick(wx, wy) {
  const tx = tileOf(wx),
    ty = tileOf(wy);
  if (!G.wallStart) {
    G.wallStart = [tx, ty];
    announce(touchUI() ? 'Now tap where the fence ends' : 'Now click where the fence ends');
    return;
  }
  const run = wallRun(G.wallStart[0], G.wallStart[1], tx, ty);
  let n = 0,
    poor = false;
  const k0 = run.findIndex(([x, y]) => canPlace(0, 'wall', x, y, false));
  const order = k0 < 0 ? [] : [...run.slice(k0), ...run.slice(0, k0).reverse()];
  for (const [x, y] of order) {
    if (G.money[0] < BLDS.wall.cost) {
      poor = true;
      break;
    }
    if (canPlace(0, 'wall', x, y, false)) {
      G.money[0] -= BLDS.wall.cost;
      addBuilding(0, 'wall', x, y, false);
      n++;
    }
  }
  G.wallStart = null;
  if (n)
    announce(
      n + ' fence panel' + (n > 1 ? 's' : '') + ' planted' + (poor ? '. Ran out of compost' : ''),
      poor
    );
  else announce(poor ? 'Not enough compost' : "Can't fence there. Start near your buildings", true);
}
function placeAt(kind, tx, ty) {
  const d = BLDS[kind];
  if (d.wall) {
    if (G.money[0] < d.cost) {
      announce('Not enough compost', true);
      return false;
    }
    G.money[0] -= d.cost;
    addBuilding(0, kind, tx, ty, false);
    G.placing = null;
    G.ghostAt = null;
    announce(d.names[0] + ' planted');
    return true;
  }
  addBuilding(0, kind, tx, ty, true);
  G.build[0] = null;
  G.placing = null;
  G.ghostAt = null;
  announce(d.names[0] + ' planted');
  return true;
}
function leftClick(wx, wy, shift, touch) {
  if (G.placing === 'wall') {
    wallClick(wx, wy);
    return;
  }
  if (G.placing) {
    if (touch) touchPlace(wx, wy);
    else tryPlace(wx, wy);
    return;
  }
  const tx = tileOf(wx),
    ty = tileOf(wy);
  const ent = pick(wx, wy, touch ? 14 / S.cameras.main.zoom : 0);
  const now = performance.now();
  if (
    ent &&
    ent.team === 0 &&
    ent.unit &&
    G.lastPick &&
    G.lastPick.id === ent.id &&
    now - G.lastPick.t < 380 &&
    !G.amove
  ) {
    const v = S.cameras.main.worldView;
    G.sel = G.ents.filter(
      e => !e.dead && e.unit && e.team === 0 && e.kind === ent.kind && v.contains(e.x, e.y)
    );
    G.lastPick = null;
    return;
  }
  G.lastPick = ent ? { id: ent.id, t: now } : null;
  const mine = G.sel.filter(e => e.unit && e.team === 0 && !e.dead);
  if (G.amove && mine.length) {
    orderMove(
      mine.filter(u => !u.d.harv),
      'amove',
      wx,
      wy
    );
    G.amove = false;
    marker(wx, wy, 0xe2604e);
    return;
  }
  G.amove = false;
  if (ent) {
    if (ent.team === 0) {
      const harvs = mine.filter(u => u.d.harv);
      if (ent.bld && ent.kind === 'bin' && harvs.length && !shift) {
        for (const u of harvs) {
          u.order = null;
          u.hs = 'return';
          u.forceBin = ent;
        }
        marker(ent.x, ent.y, 0xb8e383);
        return;
      }
      if (ent.bld && ent.d.gate && mine.length) {
        orderMove(mine, 'move', wx, wy);
        marker(wx, wy, 0xb8e383);
        return;
      }
      if (shift) {
        const i = G.sel.indexOf(ent);
        if (i >= 0) G.sel.splice(i, 1);
        else if (ent.unit && G.sel.every(e => e.unit && e.team === 0)) G.sel.push(ent);
        else G.sel = [ent];
      } else G.sel = [ent];
      G.sellArm = null;
      return;
    }
    if (mine.length) {
      const fighters = mine.filter(u => !u.d.harv);
      for (const u of fighters) {
        u.order = { type: 'attack', t: ent };
        u.target = ent;
        u.path = null;
        u.repT = 0;
        u.breach = null;
      }
      marker(ent.x, ent.y, 0xe2604e);
      if (fighters.length) return;
    }
    if (!mine.length) {
      G.sel = [ent];
      return;
    }
  }
  const hi = inb(tx, ty) ? G.heapAt[idx(tx, ty)] : -1;
  const harvs = mine.filter(u => u.d.harv);
  if (hi >= 0 && harvs.length && G.vis[idx(tx, ty)] > 0) {
    const h = G.heaps[hi];
    for (const u of harvs) {
      u.order = null;
      u.heap = h;
      u.badHeap = null;
      setPath(u, h.tx * T + T / 2, h.ty * T + T / 2);
      u.hs = 'toHeap';
    }
    const rest = mine.filter(u => !u.d.harv);
    if (rest.length) orderMove(rest, 'move', wx, wy);
    marker(wx, wy, 0xd4813a);
    return;
  }
  if (mine.length) {
    orderMove(mine, 'move', wx, wy);
    marker(wx, wy, 0xb8e383);
    return;
  }
  const b = selBld();
  if (b && ['hq', 'shed', 'tunnel'].includes(b.kind)) {
    b.rally = { x: wx, y: wy };
    marker(wx, wy, 0xb8e383);
    return;
  }
  G.sel = [];
}
function boxSelect(x1, y1, x2, y2, shift) {
  const minx = Math.min(x1, x2),
    maxx = Math.max(x1, x2),
    miny = Math.min(y1, y2),
    maxy = Math.max(y1, y2);
  let got = G.ents.filter(
    e => !e.dead && e.unit && e.team === 0 && e.x >= minx && e.x <= maxx && e.y >= miny && e.y <= maxy
  );
  if (got.some(e => !e.d.harv)) got = got.filter(e => !e.d.harv);
  if (shift) {
    for (const e of got) if (!G.sel.includes(e)) G.sel.push(e);
    G.sel = G.sel.filter(e => e.unit);
  } else G.sel = got;
}
function placeOrigin(kind, wx, wy) {
  const d = BLDS[kind];
  return [Math.round(wx / T - d.w / 2), Math.round(wy / T - d.h / 2)];
}
function tryPlace(wx, wy) {
  const kind = G.placing;
  const [tx, ty] = placeOrigin(kind, wx, wy);
  if (!canPlace(0, kind, tx, ty, false))
    return announce("Can't plant there. Pick clear ground near your buildings", true);
  placeAt(kind, tx, ty);
}
function touchPlace(wx, wy) {
  const kind = G.placing;
  const o = placeOrigin(kind, wx, wy);
  const d = BLDS[kind];
  const g = G.ghostAt;
  if (
    g &&
    g.kind === kind &&
    wx >= g.x * T &&
    wx < (g.x + d.w) * T &&
    wy >= g.y * T &&
    wy < (g.y + d.h) * T
  ) {
    if (canPlace(0, kind, g.x, g.y, false)) placeAt(kind, g.x, g.y);
    else announce("Can't plant there. Pick clear ground near your buildings", true);
    return;
  }
  G.ghostAt = { kind, x: o[0], y: o[1] };
  if (canPlace(0, kind, o[0], o[1], false)) announce('Tap the outline again to plant');
  else announce("Can't plant there. Pick clear ground near your buildings", true);
}
function centreOn(x, y) {
  S.cameras.main.centerOn(x, y);
}
function setCamBounds() {
  if (!S) return;
  const c = S.cameras.main;
  if (document.body.classList.contains('compact')) c.setBounds(-60, -70, WW + 120, WH + 70 + 190);
  else c.setBounds(0, 0, WW, WH);
}
function stopSel() {
  for (const e of G.sel)
    if (e.unit && e.team === 0) {
      e.order = null;
      e.target = null;
      e.path = null;
      e.breach = null;
      e.guard = { x: e.x, y: e.y };
      if (e.d.harv) {
        e.hs = 'idle';
        e.ht = 6;
      }
    }
}
function selectArmy() {
  G.sel = G.ents.filter(e => !e.dead && e.unit && e.team === 0 && !e.d.harv);
  if (!G.sel.length) announce('No troops yet. Train some at the Potting Shed');
}
function goHome() {
  const h =
    G.ents.find(e => !e.dead && e.team === 0 && e.kind === 'hq') || G.ents.find(e => !e.dead && e.team === 0);
  if (h) centreOn(h.x, h.y);
}
function startAmove() {
  if (G.sel.some(e => e.unit && e.team === 0 && !e.d.harv)) {
    G.amove = true;
    G.placing = null;
    G.boxMode = false;
    announce(touchUI() ? 'Attack-move: tap where to go' : 'Attack-move: click where to go');
  } else announce('Select some troops first');
}
function cancelAll() {
  G.placing = null;
  G.ghostAt = null;
  G.wallStart = null;
  G.amove = false;
  G.boxMode = false;
  G.sel = [];
  G.sellArm = null;
}
const touchUI = () => document.body.classList.contains('compact') || (S && S.lastTouch);
function cmd(c) {
  if (!G || !S) return;
  if (c === 'pause') {
    togglePause();
    return;
  }
  if (G.over || G.paused) return;
  if (c === 'all') selectArmy();
  else if (c === 'box') {
    G.boxMode = !G.boxMode;
    G.amove = false;
    if (G.boxMode) announce('Drag across your troops to select them');
  } else if (c === 'amove') startAmove();
  else if (c === 'stop') stopSel();
  else if (c === 'home') goHome();
  else if (c === 'cancel') cancelAll();
  else if (c === 'repair') doRepair();
  else if (c === 'sell') doSell();
  uiTick();
}
