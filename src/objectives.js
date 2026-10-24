// Community gardens: neutral territory, timed capture, income and AI expeditions.
'use strict';

function gardenVisible(g) {
  return G.vis[idx(g.tx, g.ty)] === 2;
}
function gardenNear(x, y) {
  return G.gardens.find(g => g.seen && Math.hypot(g.x - x, g.y - y) <= COMMUNITY.radius * T);
}
function gardenStatus(g) {
  if (!gardenVisible(g) && g.owner !== 0)
    return g.knownOwner === 1 ? 'Enemy held · last seen' : 'Neutral · last seen';
  if (g.contested) return 'Contested · income paused';
  if (g.progress > 0)
    return (g.claimant === 0 ? 'Claiming ' : 'Enemy claiming ') + Math.floor(g.progress * 100) + '%';
  return g.owner === 0
    ? 'Yours · +150 compost/min'
    : g.owner === 1
      ? 'Enemy held · +150 compost/min'
      : 'Neutral · hold to claim';
}
function updGardens(dt) {
  const fighters = G.ents.filter(e => !e.dead && e.unit && !e.d.harv);
  for (const g of G.gardens) {
    let flipped = false;
    const count = [0, 0];
    for (const e of fighters) if (Math.hypot(e.x - g.x, e.y - g.y) <= COMMUNITY.radius * T) count[e.team]++;
    g.contested = count[0] > 0 && count[1] > 0;
    const team = count[0] ? 0 : count[1] ? 1 : -1;
    if (!g.contested) {
      if (team >= 0 && team !== g.owner) {
        const step = (dt / COMMUNITY.captureSeconds) * (1 + (Math.min(count[team], 3) - 1) * 0.25);
        if (g.claimant !== team && g.progress > 0) g.progress = Math.max(0, g.progress - step);
        else {
          g.claimant = team;
          g.progress += step;
        }
        if (g.progress >= 1 - 1e-9) {
          const previous = g.owner;
          flipped = true;
          g.owner = team;
          g.claimant = -1;
          g.progress = 0;
          g.incomeT = 0;
          if (team === 0) {
            g.seen = true;
            g.knownOwner = 0;
            G.stats.gardensCaptured++;
            GameAudio.sound('capture', 0, 0, true);
          }
          if (!G.headless && (team === 0 || previous === 0 || gardenVisible(g)))
            announce(
              team === 0
                ? g.name + ' claimed · +75 compost every 30 seconds'
                : g.name + ' taken by the Society',
              team !== 0
            );
        }
      } else if (g.progress > 0) {
        g.progress = Math.max(0, g.progress - dt / (team === g.owner ? 4 : 12));
      }
    }
    if (g.progress === 0) g.claimant = -1;
    // No payouts during capture or combat, and no capture-time credit on a flip.
    if (!flipped && g.owner >= 0 && !g.contested && g.progress === 0 && (team < 0 || team === g.owner)) {
      g.incomeT += dt;
      if (g.incomeT >= COMMUNITY.interval) {
        const amount = Math.floor(g.incomeT / COMMUNITY.interval) * COMMUNITY.income;
        g.incomeT %= COMMUNITY.interval;
        G.money[g.owner] += amount;
        if (g.owner === 0) {
          G.stats.gardenIncome += amount;
          if (!G.headless && gardenVisible(g)) floatText(g.x, g.y - 24, '+' + amount);
        }
      }
    }
    if (gardenVisible(g) || g.owner === 0) {
      g.seen = true;
      g.knownOwner = g.owner;
    }
  }
}

function updGardenAI(army, hq) {
  if (!hq) return;
  for (const u of army) {
    if (u.gardenId == null) continue;
    const g = G.gardens[u.gardenId];
    if (
      !g ||
      G.time - u.gardenSince > 100 ||
      (g.owner === 1 && !g.contested && g.progress === 0 && G.time - u.gardenSince > 20)
    ) {
      u.gardenId = null;
      if (!u.target) {
        u.order = { type: 'amove', x: hq.x, y: hq.y };
        setPath(u, hq.x, hq.y);
      }
    } else if (!u.order && !u.target && Math.hypot(u.x - g.x, u.y - g.y) > COMMUNITY.radius * T) {
      u.order = { type: 'amove', x: g.x, y: g.y };
      setPath(u, g.x, g.y);
    }
  }
  const start = G.diffKey === 'gentle' ? G.D.first + 30 : G.D.first * 0.65;
  if (G.time < start || G.time < (G.ai.gardenT || 0)) return;
  const available = army.filter(u => !u.wave && u.gardenId == null && !u.target);
  if (available.length < 4) return;
  const targets = G.gardens.filter(g => g.owner !== 1 && !army.some(u => u.gardenId === g.id));
  targets.sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
  const g = targets[0];
  if (!g) return;
  available.sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y));
  for (const u of available.slice(0, 2)) {
    u.gardenId = g.id;
    u.gardenSince = G.time;
    u.wave = false;
    u.order = { type: 'amove', x: g.x, y: g.y };
    u.target = null;
    setPath(u, g.x, g.y);
  }
  G.ai.gardenT = G.time + 35;
}

function focusGarden() {
  const known = G.gardens.filter(g => g.seen);
  if (!known.length) {
    announce('Scout for community gardens. Hold the flag with fighting units to earn extra compost.');
    return;
  }
  const at = known.findIndex(g => g.id === G.focusGarden);
  const g = known[(at + 1) % known.length];
  G.focusGarden = g.id;
  G.sel = [];
  centreOn(g.x, g.y);
  uiTick();
  announce(g.name + ' · ' + gardenStatus(g));
}

// A small community allotment assembled from the painted crop atlas, with
// timber beds, a stone meeting circle, potting bench and hand-lettered sign.
function initGardenArt(sc) {
  if (G.headless) return;
  mkTex(
    'community-garden',
    144,
    144,
    c => {
      const R = mulberry32(481);
      ell(c, 72, 80, 65, 50, 'rgba(14,28,19,.2)');
      ell(c, 72, 74, 62, 48, '#726e54');
      ell(c, 72, 72, 61, 46, gardenArt ? gardenPattern(c, 'gravel') : '#b5ae86');
      ell(c, 72, 72, 61, 46, rad(c, 62, 60, 72, ['rgba(255,236,186,.13)', 'rgba(46,47,27,.22)']));
      for (let i = 0; i < 180; i++)
        circ(c, 16 + R() * 112, 33 + R() * 78, 0.3 + R() * 0.7, 'rgba(64,68,47,.18)');
      for (const [x, y, kind] of [
        [22, 41, 'cabbage'],
        [94, 43, 'carrots'],
        [20, 91, 'pumpkinPlant'],
        [94, 93, 'cabbage'],
      ]) {
        ell(c, x + 15, y + 21, 18, 7, 'rgba(24,30,18,.3)');
        rr(c, x - 2, y + 1, 30, 24, 3);
        c.fillStyle = '#574533';
        c.fill();
        rr(c, x, y, 27, 20, 2);
        c.fillStyle = lin(c, x, y, x, y + 20, ['#c39b66', '#967148', '#62472e']);
        c.fill();
        c.fillStyle = '#493c2b';
        c.fillRect(x + 3, y + 3, 21, 14);
        line(c, x + 1, y + 1, x + 25, y + 1, '#c4a16a', 1.5);
        for (let grain = 0; grain < 4; grain++)
          line(
            c,
            x + 3 + R() * 7,
            y + 18 + grain,
            x + 17 + R() * 7,
            y + 18 + grain,
            'rgba(47,32,22,.23)',
            0.4
          );
        if (gardenArt) for (const dx of [7, 19]) gardenStamp(c, kind, x + dx, y + 10, 17, 19);
        else for (const dx of [8, 19]) circ(c, x + dx, y + 10, 5, '#789445');
      }
      // Curving setts around an open, walkable flag courtyard.
      for (let i = 0; i < 15; i++) {
        const a = (i / 15) * Math.PI * 2,
          x = 72 + Math.cos(a) * 22,
          y = 76 + Math.sin(a) * 15;
        rr(c, x - 4, y - 2, 8, 5, 1);
        c.fillStyle = lin(c, x, y - 2, x, y + 3, [i % 2 ? '#d1c8ad' : '#e6d9b7', '#958e75']);
        c.fill();
      }
      // A shaded bench and tool shelf at the top of the plot.
      ell(c, 74, 40, 24, 5, 'rgba(28,34,18,.18)');
      for (const x of [54, 87]) {
        line(c, x, 28, x, 38, '#514a32', 3);
      }
      rr(c, 49, 24, 44, 9, 2);
      c.fillStyle = lin(c, 0, 24, 0, 33, ['#d0a972', '#9c764b', '#674a31']);
      c.fill();
      line(c, 50, 25, 92, 25, '#d3ac72', 2);
      line(c, 51, 29, 91, 29, 'rgba(67,43,25,.4)', 0.7);
      circ(c, 60, 25, 3, '#ae6340');
      circ(c, 60, 22, 4, '#698246');
      line(c, 80, 26, 87, 20, '#cec6aa', 2);
      // Noticeboard, tilted roof and flowers framing the entrance.
      line(c, 39, 125, 39, 106, '#615039', 3);
      rr(c, 22, 104, 35, 14, 2);
      c.fillStyle = '#58674a';
      c.fill();
      line(c, 22, 104, 56, 104, '#b69a69', 2);
      c.font = 'bold 5px Georgia';
      c.textAlign = 'center';
      c.fillStyle = '#f4e7b8';
      c.fillText('COMMUNITY', 39, 110);
      c.fillText('GARDEN', 39, 116);
      for (const [x, y] of [
        [15, 70],
        [128, 71],
        [72, 119],
      ]) {
        if (gardenArt) gardenStamp(c, 'daisies', x, y, 18, 16);
        else circ(c, x, y, 6, '#637d41');
      }
    },
    RES
  );
  sc.gardenGround = sc.add.graphics().setDepth(1.6);
  sc.gardenFlags = sc.add.graphics().setDepth(2.3);
  sc.gardenLabels = [];
  for (const g of G.gardens) {
    g.spr = sc.add
      .image(g.x, g.y, 'community-garden')
      .setScale(1 / RES)
      .setDepth(0.8);
    const label = sc.add
      .text(g.x, g.y + 83, g.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#f4e9c7',
        backgroundColor: '#203124dd',
        padding: { x: 7, y: 4 },
      })
      .setResolution(RES)
      .setOrigin(0.5, 0)
      .setDepth(7);
    sc.gardenLabels.push(label);
  }
}

function renderGardens(sc) {
  if (G.headless || !sc.gardenGround) return;
  const ground = sc.gardenGround,
    flags = sc.gardenFlags;
  ground.clear();
  flags.clear();
  for (const g of G.gardens) {
    const visible = gardenVisible(g),
      owner = visible || g.owner === 0 ? g.owner : g.knownOwner;
    const colour = owner === 0 ? 0x79b9ed : owner === 1 ? 0xe68572 : 0xe5d28c;
    g.spr.setVisible(g.seen).setTint(sc.daylight ? sc.daylight.terrain : 0xffffff);
    const label = sc.gardenLabels[g.id];
    label.setVisible(visible);
    if (!g.seen) continue;
    const radius = COMMUNITY.radius * T;
    ground.lineStyle(1, colour, visible ? 0.35 : 0.15);
    ground.strokeCircle(g.x, g.y, radius);
    if (visible && g.progress > 0) {
      ground.lineStyle(4, g.claimant === 0 ? 0x9fd0ff : 0xf4a493, 0.9);
      ground.beginPath();
      ground.arc(g.x, g.y, radius, -Math.PI / 2, -Math.PI / 2 + g.progress * Math.PI * 2, false);
      ground.strokePath();
    }
    flags.fillStyle(0x615d46);
    flags.fillEllipse(g.x + 1, g.y + 18, 16, 7);
    flags.lineStyle(2, 0xe9dab3);
    flags.lineBetween(g.x, g.y + 16, g.x, g.y - 39);
    flags.fillStyle(colour);
    flags.fillTriangle(g.x + 1, g.y - 38, g.x + 27, g.y - 33, g.x + 1, g.y - 23);
    flags.lineStyle(1, 0xfff1ca, 0.65);
    flags.lineBetween(g.x + 2, g.y - 37, g.x + 24, g.y - 33);
    const text =
      visible && g.contested
        ? g.name + ' · CONTESTED'
        : visible && g.progress > 0
          ? g.name + (g.claimant === 0 ? ' · Claiming ' : ' · Society ') + Math.floor(g.progress * 100) + '%'
          : g.name + (owner === 0 ? ' · +150/min' : owner === 1 ? ' · Society held' : ' · Neutral');
    const ink = visible && g.contested ? '#ffbf9e' : '#f4e9c7';
    // Text style setters rerasterise their canvas, so update only on a change.
    if (label.text !== text) label.setText(text);
    if (label.style.color !== ink) label.setColor(ink);
  }
}
