// Seeded large-map generation with varied, validated enemy starting areas.
'use strict';

function enemyStartCandidates() {
  return [
    ['north-west', 22, 14],
    ['north', Math.round(MW * 0.46), 14],
    ['north-east', MW - 20, 14],
    ['east', MW - 20, Math.round(MH * 0.48)],
    ['south-east', MW - 20, MH - 22],
    ['south', Math.round(MW * 0.46), MH - 22],
    ['central', Math.round(MW * 0.51), Math.round(MH * 0.43)],
  ];
}

function chooseMapStarts(seed) {
  const R = mulberry32(seed ^ 0x71a53b);
  const candidates = enemyStartCandidates();
  const [zone, x, y] = candidates[Math.floor(R() * candidates.length)];
  const enemy = {
    x: x + Math.floor(R() * 7) - 3,
    y: y + Math.floor(R() * 7) - 3,
    zone,
  };
  enemy.mirrorX = PLAYER_START.x < enemy.x;
  enemy.mirrorY = PLAYER_START.y > enemy.y;
  return [{ ...PLAYER_START }, enemy];
}

function layoutForBase(base, defences = true) {
  return [...TEMPLATE, ...(defences ? DEF_TEMPLATE : [])].map(([kind, x, y]) => {
    const d = BLDS[kind],
      ox = x - PLAYER_START.x,
      oy = y - PLAYER_START.y;
    return [kind, base.x + (base.mirrorX ? 3 - ox - d.w : ox), base.y + (base.mirrorY ? 3 - oy - d.h : oy)];
  });
}

function baseTile(base, x, y) {
  return [base.x + (base.mirrorX ? 2 - x : x), base.y + (base.mirrorY ? 2 - y : y)];
}

function genMap(seed) {
  // A retry changes terrain, not the chosen spawn, so difficult terrain cannot
  // quietly bias the distribution back towards a preferred corner.
  const starts = chooseMapStarts(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const map = tryMap(seed + attempt * 7919, starts);
    if (map) return map;
  }
  throw new Error('Unable to generate a connected map');
}

function tryMap(seed, starts = chooseMapStarts(seed)) {
  const R = mulberry32(seed),
    terr = new Uint8Array(MW * MH);
  const [playerStart, enemyStart] = starts;
  if (Math.hypot(playerStart.x - enemyStart.x, playerStart.y - enemyStart.y) < 40) return null;
  const layouts = starts.map(base => layoutForBase(base));
  const reserved = new Uint8Array(MW * MH),
    occupied = new Uint8Array(MW * MH);
  for (const layout of layouts)
    for (const [kind, x, y] of layout) {
      const d = BLDS[kind];
      if (x < 2 || y < 2 || x + d.w > MW - 2 || y + d.h > MH - 2) return null;
      for (let yy = y - 1; yy <= y + d.h; yy++)
        for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy)) reserved[idx(xx, yy)] = 1;
      for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) occupied[idx(xx, yy)] = 1;
    }
  for (const [x, y] of PLAYER_TROOPS) reserved[idx(x, y)] = 1;
  const nearBase = (x, y, d) => starts.some(b => Math.hypot(x - b.x - 1.5, y - b.y - 1.5) < d);
  const set = (x, y, t) => {
    if (inb(x, y)) terr[idx(x, y)] = t;
  };
  const area = (MW * MH) / (64 * 48);
  for (let i = 0; i < Math.round(4.5 * area); i++) {
    const cx = 10 + R() * (MW - 20),
      cy = 7 + R() * (MH - 14),
      r = 1.8 + R() * 2.2;
    if (nearBase(cx, cy, 18)) continue;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
        if (Math.hypot(x - cx, (y - cy) * 1.15) < r + (R() - 0.5) * 0.8) set(x, y, 2);
  }
  for (let i = 0; i < Math.round(12 * area); i++) {
    const x = 4 + Math.floor(R() * (MW - 8)),
      y = 4 + Math.floor(R() * (MH - 8));
    if (nearBase(x, y, 16)) continue;
    const horizontal = R() < 0.5,
      length = 4 + Math.floor(R() * 6);
    for (let k = 0; k < length; k++) set(x + (horizontal ? k : 0), y + (horizontal ? 0 : k), 3);
  }
  // Generous clear yards include every building, exit and starter resource field.
  starts.forEach((base, team) => {
    for (let y = -14; y <= 10; y++)
      for (let x = -4; x <= 19; x++) {
        const [tx, ty] = baseTile(base, x, y);
        if (inb(tx, ty)) terr[idx(tx, ty)] = team ? 5 : 0;
      }
  });
  for (let x = 0; x < MW; x++) {
    set(x, 0, 3);
    set(x, MH - 1, 3);
  }
  for (let y = 0; y < MH; y++) {
    set(0, y, 3);
    set(MW - 1, y, 3);
  }
  const canWalk = (x, y) =>
    inb(x, y) && terr[idx(x, y)] !== 2 && terr[idx(x, y)] !== 3 && !occupied[idx(x, y)];
  const [startX, startY] = PLAYER_TROOPS[0];
  const dx = playerStart.x - enemyStart.x,
    dy = playerStart.y - enemyStart.y,
    length = Math.hypot(dx, dy);
  let enemyExit = null;
  const ex = Math.round(enemyStart.x + 1.5 + (dx / length) * 10),
    ey = Math.round(enemyStart.y + 1.5 + (dy / length) * 10);
  for (let radius = 0; radius < 7 && !enemyExit; radius++)
    for (let y = ey - radius; y <= ey + radius && !enemyExit; y++)
      for (let x = ex - radius; x <= ex + radius; x++)
        if (canWalk(x, y)) {
          enemyExit = [x, y];
          break;
        }
  if (!enemyExit || !canWalk(startX, startY)) return null;
  // A road follows an actual obstacle-aware route; it never paints over ponds,
  // hedge obstacles or the planned building footprints.
  const route = mapRoadRoute(terr, occupied, [startX, startY], enemyExit, seed);
  if (!route) return null;
  for (const n of route) terr[n] = 1;

  const heaps = [],
    heapAt = new Int16Array(MW * MH).fill(-1),
    resourceFields = [];
  const spread = () => ((R() + R() + R() - 1.5) / 1.5) * 2.6;
  const field = (cx, cy, count, amount, team = null) => {
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < count; tries++) {
      const x = Math.round(cx + spread()),
        y = Math.round(cy + spread());
      if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) continue;
      const n = idx(x, y);
      if (terr[n] === 2 || terr[n] === 3 || reserved[n] || heapAt[n] >= 0) continue;
      heapAt[n] = heaps.length;
      heaps.push({ tx: x, ty: y, amount, max: amount, spr: null });
      placed++;
    }
    resourceFields.push({ x: cx, y: cy, count: placed, amount, team });
    return placed === count;
  };
  for (const [team, base] of starts.entries())
    for (const [x, y, count] of [
      [14, 5, 8],
      [2, -10, 7],
    ]) {
      const [cx, cy] = baseTile(base, x, y);
      if (!field(cx, cy, count, 500, team)) return null;
    }
  // A nearby second-stage supply keeps a larger battlefield from requiring
  // blind worker journeys before the player has had time to scout.
  for (const [team, base] of starts.entries()) {
    const [cx, cy] = baseTile(base, 16, -7);
    if (!field(cx, cy, 6, 600, team)) return null;
  }
  const mx = (playerStart.x + enemyStart.x) / 2,
    my = (playerStart.y + enemyStart.y) / 2;
  for (const offset of [-14, 0, 14]) {
    const x = Math.round(mx - (dy / length) * offset),
      y = Math.round(my + (dx / length) * offset);
    field(clamp(x, 5, MW - 6), clamp(y, 5, MH - 6), 8, 800);
  }
  for (let i = 0; i < 10; i++) {
    const x = 8 + Math.floor(R() * (MW - 16)),
      y = 8 + Math.floor(R() * (MH - 16));
    if (!nearBase(x, y, 23)) field(x, y, 6, 600);
  }
  // Vegetable beds decorate free ground, avoiding resource piles and building yards.
  const plant = (x, y, horizontal) => {
    const tiles = [];
    for (let k = 0; k < 3; k++) {
      const xx = x + (horizontal ? k : 0),
        yy = y + (horizontal ? 0 : k);
      if (!inb(xx, yy) || xx < 2 || yy < 2 || xx > MW - 3 || yy > MH - 3) return false;
      const n = idx(xx, yy);
      if (terr[n] !== 0 || reserved[n] || heapAt[n] >= 0) return false;
      tiles.push(n);
    }
    for (const n of tiles) terr[n] = 4;
    return true;
  };
  for (let i = 0; i < 14; i++)
    plant(3 + Math.floor(R() * 17), PLAYER_START.y - 12 + Math.floor(R() * 17), R() < 0.6);
  let planted = 0;
  for (let tries = 0; tries < 200 && planted < Math.round(area * 7); tries++)
    if (plant(3 + Math.floor(R() * (MW - 8)), 3 + Math.floor(R() * (MH - 8)), R() < 0.5)) planted++;

  // Validate connectivity with all planned buildings present, not just terrain.
  const seen = new Uint8Array(MW * MH),
    queue = [idx(startX, startY)];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head],
      x = n % MW,
      y = Math.floor(n / MW);
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + ox,
        yy = y + oy;
      if (!canWalk(xx, yy)) continue;
      const next = idx(xx, yy);
      if (!seen[next]) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  if (!seen[idx(...enemyExit)] || heaps.some(h => !seen[idx(h.tx, h.ty)])) return null;
  const gardens = placeCommunityGardens(terr, reserved, heapAt, seen, starts);
  if (!gardens) return null;
  return {
    terr,
    heaps,
    heapAt,
    playerStart: { ...playerStart },
    enemyStart: { ...enemyStart },
    enemyLayout: layouts[1],
    enemyExit,
    resourceFields,
    gardens,
  };
}

function placeCommunityGardens(terr, reserved, heapAt, seen, starts) {
  const candidates = [];
  for (let y = 5; y < MH - 5; y++)
    for (let x = 5; x < MW - 5; x++) {
      if (starts.some(b => Math.hypot(x - b.x - 1, y - b.y - 1) < 20)) continue;
      let clear = true;
      for (let yy = y - 3; yy <= y + 3 && clear; yy++)
        for (let xx = x - 3; xx <= x + 3; xx++) {
          const n = idx(xx, yy);
          if (!seen[n] || reserved[n] || heapAt[n] >= 0 || terr[n] === 2 || terr[n] === 3) {
            clear = false;
            break;
          }
        }
      if (clear) candidates.push([x, y]);
    }
  const [a, b] = starts,
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  const gardens = [];
  const names = ['Marigold Green', 'Orchard Corner', 'Sunflower Square'];
  for (const [fraction, side] of [
    [0.3, 0],
    [0.5, 13],
    [0.7, 0],
  ]) {
    const tx = a.x + 1 + dx * fraction - (dy / length) * side,
      ty = a.y + 1 + dy * fraction + (dx / length) * side;
    let best = null,
      distance = Infinity;
    for (const [x, y] of candidates) {
      if (gardens.some(g => Math.hypot(g.tx - x, g.ty - y) < 14)) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d < distance) {
        distance = d;
        best = [x, y];
      }
    }
    if (!best) return null;
    gardens.push({ id: gardens.length, name: names[gardens.length], tx: best[0], ty: best[1] });
  }
  return gardens;
}

function mapRoadRoute(terr, occupied, from, to, seed) {
  const size = MW * MH,
    dist = new Float64Array(size).fill(Infinity),
    parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size),
    heap = [];
  const push = (n, score) => {
    heap.push([n, score]);
    let at = heap.length - 1;
    while (at) {
      const p = (at - 1) >> 1;
      if (heap[p][1] <= score) break;
      heap[at] = heap[p];
      at = p;
    }
    heap[at] = [n, score];
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop();
    if (heap.length) {
      let at = 0;
      while (at * 2 + 1 < heap.length) {
        let child = at * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1][1] < heap[child][1]) child++;
        if (last[1] <= heap[child][1]) break;
        heap[at] = heap[child];
        at = child;
      }
      heap[at] = last;
    }
    return first[0];
  };
  const start = idx(...from),
    goal = idx(...to),
    walk = (x, y) => inb(x, y) && terr[idx(x, y)] !== 2 && terr[idx(x, y)] !== 3 && !occupied[idx(x, y)];
  const heuristic = (x, y) => {
    const dx = Math.abs(x - to[0]),
      dy = Math.abs(y - to[1]);
    return dx + dy - 0.586 * Math.min(dx, dy);
  };
  dist[start] = 0;
  push(start, heuristic(...from));
  while (heap.length) {
    const n = pop();
    if (closed[n]) continue;
    closed[n] = 1;
    if (n === goal) break;
    const x = n % MW,
      y = Math.floor(n / MW);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx,
          yy = y + dy;
        if (!walk(xx, yy) || (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy)))) continue;
        const next = idx(xx, yy);
        if (closed[next]) continue;
        const cost = dist[n] + (dx && dy ? 1.414 : 1) + (((next * 17 + seed) >>> 0) % 11) * 0.015;
        if (cost < dist[next]) {
          dist[next] = cost;
          parent[next] = n;
          push(next, cost + heuristic(xx, yy));
        }
      }
  }
  if (!closed[goal]) return null;
  const route = [];
  for (let n = goal; n !== -1; n = parent[n]) {
    route.push(n);
    if (n === start) break;
  }
  return route;
}
