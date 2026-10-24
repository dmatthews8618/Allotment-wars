// The Phaser scene: sets up a match, handles camera and pointer input, runs the game loop and draws overlays.
'use strict';

/* ---------------- scene ---------------- */
class Main extends Phaser.Scene {
  constructor() {
    super('main');
  }
  create(data) {
    S = this;
    const D = DIFF[data.diff || 'standard'];
    const seed = (Math.random() * 1e9) | 0;
    const M = genMap(seed);
    G = {
      D,
      diffKey: data.diff || 'standard',
      seed,
      terr: M.terr,
      heaps: M.heaps,
      heapAt: M.heapAt,
      blocked: new Uint8Array(MW * MH),
      bldAt: new Int32Array(MW * MH),
      vis: new Uint8Array(MW * MH),
      wallAt: new Int32Array(MW * MH),
      wallTeam: new Int8Array(MW * MH).fill(-1),
      gateTeam: new Int8Array(MW * MH).fill(-1),
      ents: [],
      proj: [],
      nextId: 1,
      money: [D.money[0], D.money[1]],
      shown: D.money[0],
      power: [
        { made: 0, used: 0 },
        { made: 0, used: 0 },
      ],
      build: [null, null],
      research: [null, null],
      up: [{}, {}],
      sel: [],
      groups: {},
      time: 0,
      paused: false,
      over: false,
      placing: null,
      amove: false,
      alertT: -99,
      readyT: -99,
      visT: 0,
      endT: 1,
      uiT: 0,
      miniT: 0,
      stats: { harvested: 0, killed: 0, lost: 0 },
      ai: {
        tick: 2,
        waveT: D.first,
        waveN: 0,
        layout: [...TEMPLATE, ...(D.defences ? DEF_TEMPLATE : [])].map(([k, x, y]) => {
          const d = BLDS[k];
          return [k, MW - x - d.w, MH - y - d.h];
        }),
      },
      headless: !!data.headless,
      started: false,
    };
    for (let i = 0; i < MW * MH; i++) G.blocked[i] = G.terr[i] === 2 || G.terr[i] === 3 ? 1 : 0;
    makeTextures();
    if (!G.headless) {
      drawTerrain();
      this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(0);
    }
    const HR = mulberry32(seed ^ 99);
    for (const h of G.heaps)
      h.spr = this.add
        .image(h.tx * T + T / 2, h.ty * T + T / 2, 'heap')
        .setDepth(1)
        .setRotation(HR() * 6.28)
        .setScale((0.45 + (0.55 * h.amount) / h.max) / RES);
    if (!this.textures.exists('fog')) this.textures.createCanvas('fog', MW, MH);
    G.fogTex = this.textures.get('fog');
    G.fogCtx = G.fogTex.getContext();
    G.fogImg = G.fogCtx.createImageData(MW, MH);
    this.add.image(0, 0, 'fog').setOrigin(0).setScale(T).setDepth(8);
    G.miniCv = document.createElement('canvas');
    G.miniCv.width = MW;
    G.miniCv.height = MH;
    G.miniCtx = G.miniCv.getContext('2d');
    G.miniImg = G.miniCtx.createImageData(MW, MH);
    addBuilding(0, 'hq', 5, 38, false);
    for (const [x, y] of [
      [10, 44],
      [11, 44],
      [12, 44],
    ])
      addUnit(0, 'fork', x * T + T / 2, y * T + T / 2);
    for (const [k, x, y] of G.ai.layout) {
      if (DEF_TEMPLATE.some(d => d[0] === k)) continue;
      addBuilding(1, k, x, y, false);
    }
    const ebin = G.ents.find(e => e.team === 1 && e.kind === 'bin');
    PF.team = 1;
    for (let i = 0; i < 2; i++) {
      const t = ringFree(ebin, { x: ebin.x - T * 3, y: ebin.y + T * (i * 2) });
      const b = addUnit(1, 'barrow', t[0] * T + T / 2, t[1] * T + T / 2);
      b.hs = 'seek';
    }
    const ehq = G.ents.find(e => e.team === 1 && e.kind === 'hq');
    const ft = freeTilesAround(ehq.tx - 2, ehq.ty + 5, D.extra.length);
    D.extra.forEach((k, i) => {
      const t = ft[i];
      if (t) addUnit(1, k, t[0] * T + T / 2, t[1] * T + T / 2);
    });
    G.started = true;
    if (window.__AWfreeze) G.paused = true;
    updVis();
    const cam = this.cameras.main;
    setCamBounds();
    cam.setBackgroundColor('#0c0907');
    zoomTo(
      document.body.classList.contains('compact') && Math.min(this.scale.width, this.scale.height) < 420 * DPR
        ? 0.85
        : 1
    );
    centreOn(6.5 * T, 39.5 * T + 60);
    this.selg = this.add.graphics().setDepth(2.95);
    this.ov = this.add.graphics().setDepth(7);
    this.ghost = this.add
      .image(0, 0, 'water_0')
      .setAlpha(0.6)
      .setVisible(false)
      .setDepth(6.5)
      .setScale(1 / RES);
    this.rallyImg = this.add.image(0, 0, 'rally_0').setOrigin(0.15, 0.95).setVisible(false).setDepth(6.6);
    initAmbience(this);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.mouse.disableContextMenu();
    this.drag = null;
    this.pan = null;
    this.tpan = null;
    this.pinch = null;
    this.mouseIn = false;
    this.lastTouch = document.body.classList.contains('compact');
    this.input.addPointer(2);
    const downs = () =>
      [this.input.pointer1, this.input.pointer2, this.input.pointer3].filter(q => q && q.isDown);
    this.input.on('gameover', () => {
      this.mouseIn = true;
    });
    this.input.on('gameout', () => {
      this.mouseIn = false;
    });
    this.input.on('pointerdown', p => {
      if (G.over || G.paused) return;
      this.lastTouch = !!p.wasTouch;
      if (p.wasTouch) {
        const d = downs();
        if (d.length >= 2) {
          this.pinch = { d0: Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y) || 1, z0: viewZoom() };
          this.drag = null;
          this.tpan = null;
          return;
        }
        if (G.boxMode) {
          this.drag = { x: p.x, y: p.y, wx: p.worldX, wy: p.worldY, active: false };
          return;
        }
        this.tpan = { id: p.id, x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
        return;
      }
      if (p.middleButtonDown()) {
        this.pan = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
        return;
      }
      if (p.rightButtonDown()) {
        if (G.placing) {
          if (G.wallStart) G.wallStart = null;
          else {
            G.placing = null;
            G.ghostAt = null;
          }
        } else if (G.amove) G.amove = false;
        else {
          G.sel = [];
          G.sellArm = null;
        }
        return;
      }
      this.drag = { x: p.x, y: p.y, wx: p.worldX, wy: p.worldY, active: false };
    });
    this.input.on('pointermove', p => {
      if (this.pinch) {
        const d = downs();
        if (d.length >= 2) {
          const dist = Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y);
          zoomTo((this.pinch.z0 * dist) / this.pinch.d0);
        }
        return;
      }
      if (this.tpan && p.id === this.tpan.id) {
        const dx = p.x - this.tpan.x,
          dy = p.y - this.tpan.y;
        if (!this.tpan.moved && Math.hypot(dx, dy) > 10 * DPR) this.tpan.moved = true;
        if (this.tpan.moved) {
          cam.scrollX = this.tpan.sx - dx / cam.zoom;
          cam.scrollY = this.tpan.sy - dy / cam.zoom;
        }
        return;
      }
      if (this.pan) {
        cam.scrollX = this.pan.sx - (p.x - this.pan.x) / cam.zoom;
        cam.scrollY = this.pan.sy - (p.y - this.pan.y) / cam.zoom;
        return;
      }
      if (
        this.drag &&
        !this.drag.active &&
        (!G.placing || G.boxMode) &&
        Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 8 * DPR
      )
        this.drag.active = true;
    });
    this.input.on('pointerup', p => {
      if (this.pinch) {
        if (!downs().length) this.pinch = null;
        this.tpan = null;
        this.drag = null;
        return;
      }
      if (this.tpan) {
        const t = this.tpan;
        this.tpan = null;
        if (!t.moved && !G.over && !G.paused) {
          const w = cam.getWorldPoint(p.x, p.y);
          leftClick(w.x, w.y, false, true, p.upTime);
        }
        return;
      }
      if (this.pan) {
        this.pan = null;
        return;
      }
      const d = this.drag;
      this.drag = null;
      if (!d || G.over || G.paused) return;
      const w = cam.getWorldPoint(p.x, p.y);
      const shift = p.event && p.event.shiftKey;
      if (d.active) {
        boxSelect(d.wx, d.wy, w.x, w.y, shift);
        if (G.boxMode) {
          G.boxMode = false;
          uiTick();
        }
      } else leftClick(w.x, w.y, shift, !!p.wasTouch);
    });
    this.input.on('wheel', (p, o, dx, dy) => {
      zoomTo(viewZoom() - dy * 0.0012);
    });
    buildSidebar();
    infoKey = '';
    uiTick();
    if (!G.headless) announce('Plant a Water Butt to get started');
    window.__AW = {
      G,
      S,
      tick,
      clickBuild,
      clickTrain,
      clickUpgrade,
      canPlace,
      addBuilding,
      orderMove,
      leftClick,
      sellBuilding,
      wallClick,
      doRepair,
      doSell,
      uiTick,
    };
  }
  update(time, delta) {
    if (!G) return;
    const dt = Math.min(delta / 1000, 0.05);
    const cam = this.cameras.main;
    if (!G.over) {
      const sp = (700 * dt) / viewZoom();
      if (this.cursors.left.isDown) cam.scrollX -= sp;
      if (this.cursors.right.isDown) cam.scrollX += sp;
      if (this.cursors.up.isDown) cam.scrollY -= sp;
      if (this.cursors.down.isDown) cam.scrollY += sp;
      const p = this.input.activePointer;
      if (this.mouseIn && !this.lastTouch && !this.pan && !this.drag) {
        const m = 14 * DPR,
          W = this.scale.width,
          H = this.scale.height;
        if (p.x < m) cam.scrollX -= sp;
        else if (p.x > W - m) cam.scrollX += sp;
        if (p.y < m) cam.scrollY -= sp;
        else if (p.y > H - m) cam.scrollY += sp;
      }
    }
    if (G.over || G.paused) {
      this.render(0);
      return;
    }
    tick(dt);
    updAmbience(this, dt);
    this.render(dt);
    G.uiT -= dt;
    if (G.uiT <= 0) {
      G.uiT = 0.15;
      uiTick();
    }
    G.miniT -= dt;
    if (G.miniT <= 0) {
      G.miniT = 0.25;
      drawMini();
    }
  }
  render(dt) {
    const now = performance.now();
    for (const e of G.ents) {
      if (e.dead) continue;
      if (e.unit) {
        const moved = Math.hypot(e.x - e.px, e.y - e.py) > 0.05;
        e.px = e.x;
        e.py = e.y;
        if (moved) {
          e.animT += dt;
          const f = Math.floor(e.animT * (e.d.armor === 'inf' ? 7 : 10)) % 2;
          if (f !== e.frame) e.frame = f;
        }
        if (e.fireT > 0) e.fireT -= dt;
        const base =
          e.kind === 'barrow'
            ? e.load > 0
              ? 'barrowfull'
              : 'barrow'
            : e.kind === 'cata' && e.fireT > 0
              ? 'catafire'
              : e.kind;
        const key = `${base}_${e.team}_${e.frame}`;
        if (e.spr.texture.key !== key) e.spr.setTexture(key);
        const bob = moved && e.d.armor === 'inf' ? Math.sin(e.animT * 22) * 0.6 : 0;
        e.spr
          .setPosition(e.x, e.y + bob)
          .setRotation(e.ang)
          .setDepth(3 + e.y / 1e5);
        e.sh.setPosition(e.x + 2, e.y + 4);
      } else if (e.d.gate) {
        let open = false;
        for (const u of G.ents)
          if (
            !u.dead &&
            u.unit &&
            u.team === e.team &&
            Math.abs(u.x - e.x) < 30 &&
            Math.abs(u.y - e.y) < 30
          ) {
            open = true;
            break;
          }
        const key = `gate_${e.team}_${open ? 1 : 0}`;
        if (e.spr.texture.key !== key) e.spr.setTexture(key);
      }
      if ((e.flashUntil || 0) > now) {
        if (e.tint !== 'f') {
          e.spr.setTintFill(0xffffff);
          e.tint = 'f';
        }
      } else if (e.unit && e.soakT > 0) {
        if (e.tint !== 's') {
          e.spr.clearTint();
          e.spr.setTint(0xa8d8f0);
          e.tint = 's';
        }
      } else if (e.tint) {
        e.spr.clearTint();
        e.tint = null;
      }
      if (e.bld && !e.d.wall && dt > 0) {
        const f = e.hp / e.maxHp;
        if (f < 0.5) {
          e.smokeT -= dt;
          if (e.smokeT <= 0) {
            e.smokeT = f < 0.25 ? 0.22 : 0.5;
            const x = e.x + (Math.random() - 0.5) * e.w * T * 0.6,
              y = e.y + (Math.random() - 0.5) * e.h * T * 0.6;
            if (visibleToPlayerPt(x, y)) {
              const im = this.add.image(x, y, 'smoke').setDepth(4.7).setScale(0.35).setAlpha(0.7);
              this.tweens.add({
                targets: im,
                y: y - 34,
                scale: 1.1,
                alpha: 0,
                duration: 1600,
                onComplete: () => im.destroy(),
              });
              if (f < 0.25) {
                const sp = this.add.image(x, y, 'spark').setDepth(4.75).setScale(0.8);
                this.tweens.add({
                  targets: sp,
                  y: y - 10,
                  scale: 0.2,
                  alpha: 0,
                  duration: 500,
                  onComplete: () => sp.destroy(),
                });
              }
            }
          }
        }
      }
    }
    const g = this.ov,
      sg = this.selg;
    g.clear();
    sg.clear();
    const cam = this.cameras.main;
    const bar = (e, w, y) => {
      const f = clamp(e.hp / e.maxHp, 0, 1);
      g.fillStyle(0x140f0b, 0.85);
      g.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
      g.fillStyle(f > 0.6 ? 0x7ccf4a : f > 0.3 ? 0xe8c547 : 0xe0503c, 1);
      g.fillRect(e.x - w / 2, y, w * f, 3);
    };
    for (const e of G.sel) {
      if (e.dead) continue;
      const col = TEAM[e.team].sel;
      if (e.unit) {
        // a disc on the ground under the unit, so a crowd stays readable
        sg.fillStyle(col, 0.28);
        sg.fillEllipse(e.x, e.y + 3, e.d.r * 2 + 6, e.d.r * 1.3 + 5);
        sg.lineStyle(1.5, col, 0.95);
        sg.strokeEllipse(e.x, e.y + 3, e.d.r * 2 + 6, e.d.r * 1.3 + 5);
        if (e.hp < e.maxHp) bar(e, 20, e.y - e.d.r - 9);
        if (e.d.harv && e.load > 0) {
          g.fillStyle(0x140f0b, 0.85);
          g.fillRect(e.x - 11, e.y + e.d.r + 4, 22, 4);
          g.fillStyle(0xd4813a, 1);
          g.fillRect(e.x - 10, e.y + e.d.r + 5, (20 * e.load) / capOf(e), 2);
        }
      } else {
        const x0 = e.tx * T,
          y0 = e.ty * T,
          x1 = x0 + e.w * T,
          y1 = y0 + e.h * T,
          L = e.d.wall ? 5 : 8;
        g.lineStyle(2, col, 0.95);
        for (const [cx, cy, sx, sy] of [
          [x0, y0, 1, 1],
          [x1, y0, -1, 1],
          [x0, y1, 1, -1],
          [x1, y1, -1, -1],
        ]) {
          g.lineBetween(cx, cy, cx + L * sx, cy);
          g.lineBetween(cx, cy, cx, cy + L * sy);
        }
        bar(e, Math.max(24, e.w * T * 0.8), y0 - 8);
      }
    }
    for (const e of G.ents) {
      if (e.dead || G.sel.includes(e) || e.hp >= e.maxHp) continue;
      if (e.team === 1 && !(e.bld ? visibleToPlayer(e) : e.spr.visible)) continue;
      if (e.unit) bar(e, 20, e.y - e.d.r - 9);
      else bar(e, Math.max(20, e.w * T * 0.7), e.ty * T - 6);
    }
    const sb = selBld();
    if (sb && sb.rally) {
      g.lineStyle(1, 0xf0e3c2, 0.45);
      g.lineBetween(sb.x, sb.y, sb.rally.x, sb.rally.y);
      this.rallyImg.setPosition(sb.rally.x, sb.rally.y).setVisible(true);
    } else this.rallyImg.setVisible(false);
    const p = this.input.activePointer,
      w = cam.getWorldPoint(p.x, p.y);
    if (G.placing === 'wall' && !G.over) {
      this.ghost.setVisible(false);
      const ptx = tileOf(w.x),
        pty = tileOf(w.y);
      const tiles = G.wallStart
        ? this.lastTouch
          ? [G.wallStart]
          : wallRun(G.wallStart[0], G.wallStart[1], ptx, pty)
        : this.lastTouch
          ? []
          : [[ptx, pty]];
      let money = G.money[0];
      const anchor = tiles.some(([x, y]) => canPlace(0, 'wall', x, y, false));
      for (const [x, y] of tiles) {
        const ok = anchor && canPlace(0, 'wall', x, y, true) && money >= BLDS.wall.cost;
        if (ok) money -= BLDS.wall.cost;
        g.fillStyle(ok ? 0x93c25a : 0xe0503c, 0.45);
        g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
      }
      if (!this.lastTouch) this.game.canvas.style.cursor = 'cell';
    } else if (G.placing && !G.over && this.lastTouch && !(G.ghostAt && G.ghostAt.kind === G.placing)) {
      this.ghost.setVisible(false);
    } else if (G.placing && !G.over) {
      const d = BLDS[G.placing];
      let [tx, ty] = placeOrigin(G.placing, w.x, w.y);
      if (this.lastTouch && G.ghostAt) {
        tx = G.ghostAt.x;
        ty = G.ghostAt.y;
      }
      const ok = canPlace(0, G.placing, tx, ty, false);
      this.ghost
        .setTexture(d.gate ? 'gate_0_0' : G.placing + '_0')
        .setPosition((tx + d.w / 2) * T, (ty + d.h / 2) * T)
        .setVisible(true);
      for (let y = ty; y < ty + d.h; y++)
        for (let x = tx; x < tx + d.w; x++) {
          const k = inb(x, y) ? idx(x, y) : -1;
          const bad = k < 0 || G.blocked[k] || G.heapAt[k] >= 0 || !ok;
          g.fillStyle(bad ? 0xe0503c : 0x93c25a, 0.35);
          g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
        }
      this.game.canvas.style.cursor = 'cell';
    } else {
      this.ghost.setVisible(false);
      if (!G.over && !this.lastTouch) {
        const h = G.amove ? null : pick(w.x, w.y);
        const armed = G.sel.some(e => e.unit && e.team === 0 && !e.d.harv);
        this.game.canvas.style.cursor =
          G.amove || (h && h.team === 1 && armed) ? 'crosshair' : h ? 'pointer' : 'default';
      }
    }
    if (this.drag && this.drag.active) {
      g.fillStyle(0xb8e383, 0.08);
      g.lineStyle(1.5 / viewZoom(), 0xb8e383, 0.9);
      const x = Math.min(w.x, this.drag.wx),
        y = Math.min(w.y, this.drag.wy),
        bw = Math.abs(w.x - this.drag.wx),
        bh = Math.abs(w.y - this.drag.wy);
      g.fillRect(x, y, bw, bh);
      g.strokeRect(x, y, bw, bh);
    }
  }
}
function separate() {
  const us = G.ents.filter(e => e.unit && !e.dead);
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const min = (a.d.r + b.d.r) * 0.85;
      let dx = b.x - a.x,
        dy = b.y - a.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.01) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d = Math.hypot(dx, dy);
      }
      const push = (min - d) * 0.25,
        nx = dx / d,
        ny = dy / d;
      shift(a, -nx * push, -ny * push);
      shift(b, nx * push, ny * push);
    }
  }
}
function shift(e, dx, dy) {
  const nx = e.x + dx,
    ny = e.y + dy;
  const i = idx(tileOf(nx), tileOf(ny));
  if (!G.blocked[i] || G.gateTeam[i] === e.team) {
    e.x = nx;
    e.y = ny;
  }
}
function tick(dt) {
  G.time += dt;
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.unit) {
      if (e.soakT > 0) e.soakT -= dt;
      if (e.d.harv) updHarv(e, dt);
      else updUnit(e, dt);
    } else if (e.d.range) updTurret(e, dt);
  }
  separate();
  updProj(dt);
  updProduction(dt);
  updAI(dt);
  G.visT -= dt;
  if (G.visT <= 0) {
    G.visT = 0.2;
    updVis();
  }
  if (G.ents.some(e => e.dead)) G.ents = G.ents.filter(e => !e.dead);
  if (G.sel.some(e => e.dead)) G.sel = G.sel.filter(e => !e.dead);
  G.endT -= dt;
  if (G.endT <= 0) {
    G.endT = 1;
    checkEnd();
  }
}
