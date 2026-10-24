// Sidebar and phone HUD: packets, info panel, repair and sell, minimap.
'use strict';

/* ---------------- UI ---------------- */
let msgTimer = null;
function announce(t, warn) {
  if (G && G.headless) return;
  const m = $('#msg');
  m.textContent = t;
  m.className = 'msg show' + (warn ? ' warn' : '');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    m.className = 'msg';
  }, 2600);
}
function buildSidebar() {
  const mk = (wrap, kind, type) => {
    const d = type === 'b' ? BLDS[kind] : type === 'u' ? UNITS[kind] : UPGRADES[kind];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'packet';
    b.id = type + '-' + kind;
    b.title = d.desc;
    const icon =
      type === 'b'
        ? d.gate
          ? 'gate_0_0'
          : d.wall
            ? 'wall_0_10'
            : kind + '_0'
        : type === 'u'
          ? kind + '_0_0'
          : UP_ICON[kind];
    b.innerHTML = `<i class="fill"></i><img alt="" src="${iconURL(icon)}"><span class="txt"><span class="nm">${d.names[0]}</span><span class="cost">${d.cost}</span></span><b class="badge" hidden></b>`;
    b.addEventListener('click', () => {
      b.blur();
      type === 'b' ? clickBuild(kind) : type === 'u' ? clickTrain(kind) : clickUpgrade(kind);
    });
    b.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      type === 'b' ? cancelBuild(kind) : type === 'u' ? cancelTrain(kind) : cancelUpgrade(kind);
    });
    wrap.appendChild(b);
  };
  $('#build').innerHTML = '';
  $('#train').innerHTML = '';
  $('#upg').innerHTML = '';
  for (const k of BLD_ORDER) mk($('#build'), k, 'b');
  for (const k of UNIT_ORDER) mk($('#train'), k, 'u');
  for (const k of UP_ORDER) mk($('#upg'), k, 'g');
}
function clickBuild(kind) {
  if (!G || G.over) return;
  const b = G.build[0],
    d = BLDS[kind];
  if (!has(0, 'hq')) return announce('No Allotment Shed, no planting', true);
  if (d.wall) {
    if (G.money[0] < d.cost) return announce('Not enough compost', true);
    G.placing = G.placing === kind ? null : kind;
    G.wallStart = null;
    G.ghostAt = null;
    G.amove = false;
    G.boxMode = false;
    if (G.placing)
      announce(
        kind === 'wall'
          ? touchUI()
            ? 'Tap where the fence starts, then where it ends'
            : 'Click where the fence starts, then where it ends'
          : touchUI()
            ? 'Tap where the gate goes'
            : 'Click where the gate goes'
      );
    return;
  }
  if (b) {
    if (b.kind === kind && b.ready) {
      G.placing = G.placing === kind ? null : kind;
      G.ghostAt = null;
      G.amove = false;
      G.boxMode = false;
      if (G.placing && touchUI()) announce('Tap the ground where it should go');
    } else if (b.kind !== kind) announce('Already building a ' + BLDS[b.kind].names[0]);
    return;
  }
  if (!prereqMet(0, kind)) return announce('Needs a ' + BLDS[d.req].names[0] + ' first');
  if (G.money[0] < d.cost) return announce('Not enough compost', true);
  G.money[0] -= d.cost;
  G.build[0] = { kind, t: 0, total: d.time, ready: false };
}
function cancelBuild(kind) {
  if (BLDS[kind].wall) {
    if (G.placing === kind) {
      G.placing = null;
      G.wallStart = null;
    }
    return;
  }
  const b = G.build[0];
  if (b && b.kind === kind) {
    G.money[0] += BLDS[kind].cost;
    G.build[0] = null;
    G.placing = null;
    announce('Cancelled');
  }
}
function producerFor(kind) {
  const ps = own(0, UNITS[kind].from);
  if (!ps.length) return null;
  const s = G.sel.find(e => ps.includes(e));
  if (s) return s;
  return ps.reduce((a, b) => (b.queue.length < a.queue.length ? b : a));
}
function clickTrain(kind) {
  if (!G || G.over) return;
  const p = producerFor(kind);
  if (!p) return announce('Needs a ' + BLDS[UNITS[kind].from].names[0]);
  if (p.queue.length >= 9) return announce('That queue is full');
  if (G.money[0] < UNITS[kind].cost) return announce('Not enough compost', true);
  G.money[0] -= UNITS[kind].cost;
  p.queue.push(kind);
}
function cancelTrain(kind) {
  const ps = own(0, UNITS[kind].from).filter(p => p.queue.includes(kind));
  if (!ps.length) return;
  const p = ps[ps.length - 1];
  const i = p.queue.lastIndexOf(kind);
  if (i === 0) p.prodT = 0;
  p.queue.splice(i, 1);
  G.money[0] += UNITS[kind].cost;
}
function clickUpgrade(key) {
  if (!G || G.over) return;
  const u = UPGRADES[key];
  if (G.up[0][key]) return announce(u.names[0] + ' is already done');
  if (G.research[0]) return announce('Already researching ' + UPGRADES[G.research[0].key].names[0]);
  if (!prereqMet(0, key)) return announce('Needs a ' + BLDS[u.req].names[0] + ' first');
  if (G.money[0] < u.cost) return announce('Not enough compost', true);
  G.money[0] -= u.cost;
  G.research[0] = { key, t: 0, total: u.time };
  announce('Researching ' + u.names[0]);
}
function cancelUpgrade(key) {
  const r = G.research[0];
  if (r && r.key === key) {
    G.money[0] += UPGRADES[key].cost;
    G.research[0] = null;
    announce('Cancelled');
  }
}
let infoKey = '';
function selBld() {
  const s = G.sel;
  return s.length === 1 && s[0].bld && s[0].team === 0 && !s[0].dead ? s[0] : null;
}
function doRepair() {
  const b = selBld();
  if (!b) return;
  if (b.hp >= b.maxHp) return announce("It doesn't need repairing");
  b.repairing = !b.repairing;
  if (b.repairing) announce('Repairing ' + nameOf(b));
  uiTick();
}
function doSell() {
  const b = selBld();
  if (!b || b.kind === 'hq') return;
  if (G.sellArm && G.sellArm.id === b.id && performance.now() - G.sellArm.t < 3000) {
    G.sellArm = null;
    const n = nameOf(b);
    sellBuilding(b);
    announce(n + ' sold');
  } else {
    G.sellArm = { id: b.id, t: performance.now() };
    announce('Press Sell again to sell it for ' + Math.floor((b.d.cost * 0.5 * b.hp) / b.maxHp));
  }
  uiTick();
}
function uiTick() {
  G.shown += (G.money[0] - G.shown) * 0.35;
  if (Math.abs(G.money[0] - G.shown) < 1) G.shown = G.money[0];
  $('#money').textContent = Math.round(G.shown).toLocaleString('en-GB');
  const pw = G.power[0];
  $('#wtext').textContent = pw.used + ' / ' + pw.made;
  $('#wfill').style.width = (pw.made ? Math.min(100, (pw.used / pw.made) * 100) : 100) + '%';
  $('#wbar').classList.toggle('low', lowPower(0));
  const hq = has(0, 'hq'),
    b = G.build[0];
  for (const k of BLD_ORDER) {
    const el = $('#b-' + k);
    const d = BLDS[k];
    el.disabled = !hq || !prereqMet(0, k);
    el.classList.toggle('placing', G.placing === k);
    if (d.wall) {
      el.classList.toggle('poor', G.money[0] < d.cost);
      continue;
    }
    const mine = b && b.kind === k;
    el.classList.toggle('busy', !!b && !mine);
    el.classList.toggle('ready', !!(mine && b.ready));
    el.classList.toggle('poor', !b && G.money[0] < d.cost);
    el.style.setProperty('--p', mine ? Math.min(1, b.t / b.total) : 0);
    el.querySelector('.cost').textContent = mine
      ? b.ready
        ? 'Ready to plant'
        : Math.floor((b.t / b.total) * 100) + '%'
      : d.cost;
  }
  for (const k of UNIT_ORDER) {
    const el = $('#u-' + k);
    const ps = own(0, UNITS[k].from);
    el.disabled = !ps.length;
    let n = 0,
      prog = 0;
    for (const p of ps) {
      for (const q of p.queue) if (q === k) n++;
      if (p.queue[0] === k) prog = Math.max(prog, p.prodT / UNITS[k].time);
    }
    const bd = el.querySelector('.badge');
    bd.hidden = !n;
    bd.textContent = n;
    el.style.setProperty('--p', prog);
    el.classList.toggle('poor', G.money[0] < UNITS[k].cost);
  }
  const r = G.research[0];
  for (const k of UP_ORDER) {
    const el = $('#g-' + k);
    const done = G.up[0][k],
      mine = r && r.key === k;
    el.disabled = !done && !prereqMet(0, k);
    el.classList.toggle('done', !!done);
    el.classList.toggle('busy', !!r && !mine && !done);
    el.classList.toggle('poor', !done && !r && G.money[0] < UPGRADES[k].cost);
    el.style.setProperty('--p', mine ? r.t / r.total : 0);
    el.querySelector('.cost').textContent = done
      ? 'Done'
      : mine
        ? Math.floor((r.t / r.total) * 100) + '%'
        : UPGRADES[k].cost;
  }
  const sel = G.sel;
  let key = '',
    html = '';
  const sb = selBld();
  const armed = sb && G.sellArm && G.sellArm.id === sb.id && performance.now() - G.sellArm.t < 3000;
  if (sel.length === 1) {
    const e = sel[0];
    key =
      e.id +
      ':' +
      Math.ceil(e.hp) +
      ':' +
      (e.load || 0) +
      ':' +
      (e.queue ? e.queue.length : 0) +
      ':' +
      !!e.repairing +
      ':' +
      armed;
    html = `<span class="side ${e.team ? 'e' : 'p'}">${TEAM[e.team].name}</span><span class="nm">${nameOf(e)}</span><div class="hp"><i style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></i></div>
      <p>${Math.ceil(e.hp)} / ${Math.round(e.maxHp)} health${e.d.harv ? ` · carrying ${e.load} compost` : ''}${e.queue && e.queue.length ? ` · ${e.queue.length} in queue` : ''}</p>${e.team === 0 ? `<p>${e.d.desc}</p>` : ''}
      ${sb ? `<div class="acts"><button class="act${e.repairing ? ' on' : ''}" type="button" data-act="repair">${e.repairing ? 'Repairing' : 'Repair'}</button><button class="act${armed ? ' warn' : ''}" type="button" data-act="sell" ${e.kind === 'hq' ? 'disabled' : ''}>${armed ? 'Sure?' : 'Sell'}</button></div>` : ''}`;
  } else if (sel.length > 1) {
    const c = {};
    for (const e of sel) c[nameOf(e)] = (c[nameOf(e)] || 0) + 1;
    key = 'm:' + Object.entries(c).join();
    html = `<span class="side p">${sel.length} selected</span><p>${Object.entries(c)
      .map(([n, v]) => v + ' × ' + n)
      .join('<br>')}</p><p>Click the ground to move, an enemy to attack. A then click to attack-move.</p>`;
  } else {
    key = 'none';
    html = '<p>Select something to see it here. Drag across your troops to grab a group.</p>';
  }
  if (key !== infoKey) {
    infoKey = key;
    $('#info').innerHTML = html;
  }
  if (document.body.classList.contains('compact')) {
    const chip = $('#selchip');
    let t = '';
    if (G.placing === 'wall') t = G.wallStart ? 'Tap where the fence ends' : 'Tap where the fence starts';
    else if (G.placing)
      t = G.ghostAt
        ? 'Tap the outline to plant · Cancel to stop'
        : 'Tap the ground to place ' + BLDS[G.placing].names[0];
    else if (G.boxMode) t = 'Drag across your troops';
    else if (G.amove) t = 'Attack-move: tap a spot';
    else if (sel.length === 1)
      t =
        nameOf(sel[0]) +
        ' · ' +
        Math.ceil(sel[0].hp) +
        '/' +
        Math.round(sel[0].maxHp) +
        (sel[0].d.harv ? ' · ' + sel[0].load + ' compost' : '') +
        (sel[0].repairing ? ' · repairing' : '');
    else if (sel.length > 1) t = sel.length + ' selected · tap to move or attack';
    chip.hidden = !t;
    if (chip.textContent !== t) chip.textContent = t;
    const cm = $('#cmds');
    cm.classList.toggle('bld', !!sb);
    for (const bt of document.querySelectorAll('.cmd[data-cmd]')) {
      const c = bt.dataset.cmd;
      bt.classList.toggle(
        'on',
        (c === 'box' && !!G.boxMode) ||
          (c === 'amove' && !!G.amove) ||
          (c === 'pause' && G.paused) ||
          (c === 'repair' && !!(sb && sb.repairing))
      );
      if (c === 'sell') {
        bt.classList.toggle('warn', !!armed);
        bt.textContent = armed ? 'Sure?' : 'Sell';
        bt.disabled = !!(sb && sb.kind === 'hq');
      }
    }
  }
}
const MINI_COL = {
  0: [77, 122, 51],
  1: [163, 147, 111],
  2: [55, 122, 160],
  3: [34, 66, 29],
  4: [91, 61, 37],
  5: [100, 164, 72],
};
function drawMini() {
  const cv = $('#mini'),
    c = cv.getContext('2d');
  const img = G.miniImg,
    D = img.data;
  for (let i = 0; i < MW * MH; i++) {
    let col = MINI_COL[G.terr[i]];
    const h = G.heapAt[i];
    if (h >= 0 && G.heaps[h].amount > 0) col = [201, 133, 64];
    const v = G.vis[i],
      f = v === 0 ? 0 : v === 1 ? 0.5 : 1;
    D[i * 4] = col[0] * f;
    D[i * 4 + 1] = col[1] * f;
    D[i * 4 + 2] = col[2] * f;
    D[i * 4 + 3] = 255;
  }
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.team === 1 && !(e.bld ? seenByPlayer(e) : visibleToPlayer(e))) continue;
    const col = e.team ? [235, 90, 72] : [170, 230, 110];
    const pts = e.bld ? [] : [[tileOf(e.x), tileOf(e.y)]];
    if (e.bld)
      for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) pts.push([x, y]);
    for (const [x, y] of pts) {
      if (!inb(x, y)) continue;
      const k = idx(x, y) * 4;
      D[k] = col[0];
      D[k + 1] = col[1];
      D[k + 2] = col[2];
    }
  }
  G.miniCtx.putImageData(img, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(G.miniCv, 0, 0, cv.width, cv.height);
  const cam = S.cameras.main,
    sx = cv.width / WW;
  c.strokeStyle = '#f0e3c2';
  c.lineWidth = 1;
  c.strokeRect(
    cam.worldView.x * sx + 0.5,
    cam.worldView.y * sx + 0.5,
    cam.worldView.width * sx,
    cam.worldView.height * sx
  );
}
