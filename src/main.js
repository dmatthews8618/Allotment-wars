// Start-up: keyboard shortcuts, phone/desktop layout switching, menus, and creating the Phaser game.
'use strict';

/* ---------------- boot ---------------- */
function togglePause() {
  if (!G || G.over) return;
  G.paused = !G.paused;
  $('#paused').hidden = !G.paused;
}
window.addEventListener('keydown', ev => {
  if (!G || !S) return;
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  const k = ev.key.toLowerCase();
  if (k === 'p') {
    togglePause();
    return;
  }
  if (G.over || G.paused) return;
  const m = /^Digit([1-5])$/.exec(ev.code);
  if (m) {
    const n = m[1];
    if (ev.shiftKey) {
      G.groups[n] = G.sel.filter(e => e.unit && e.team === 0);
      announce('Group ' + n + ' saved (' + G.groups[n].length + ')');
    } else {
      const g = (G.groups[n] || []).filter(e => !e.dead);
      if (g.length) {
        if (G.lastGroup === n && G.time - G.lastGroupT < 0.5) centreOn(g[0].x, g[0].y);
        G.sel = g.slice();
        G.lastGroup = n;
        G.lastGroupT = G.time;
      }
    }
    return;
  }
  if (k === 'a') startAmove();
  else if (k === 's') stopSel();
  else if (k === 'q') selectArmy();
  else if (k === 'r') doRepair();
  else if (k === 'escape') cancelAll();
  else if (k === 'h' || k === ' ') {
    ev.preventDefault();
    goHome();
  }
});
(function () {
  const cv = $('#mini');
  let down = false;
  const go = ev => {
    if (!G || !S) return;
    const r = cv.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * WW,
      y = ((ev.clientY - r.top) / r.height) * WH;
    centreOn(x, y);
  };
  cv.addEventListener('pointerdown', ev => {
    down = true;
    cv.setPointerCapture(ev.pointerId);
    go(ev);
  });
  cv.addEventListener('pointermove', ev => {
    if (down) go(ev);
  });
  cv.addEventListener('pointerup', () => {
    down = false;
  });
})();
$('#info').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || !G) return;
  if (b.dataset.act === 'repair') doRepair();
  else if (b.dataset.act === 'sell') doSell();
});
const MQ = window.matchMedia('(max-width:760px),(max-height:540px)');
let curTab = 'build';
function setTab(t) {
  curTab = t;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.tab === t);
  if (document.body.classList.contains('compact')) {
    $('#build').hidden = t !== 'build';
    $('#train').hidden = t !== 'train';
    $('#upg').hidden = t !== 'upg';
  }
}
function layout() {
  const c = MQ.matches;
  document.body.classList.toggle('compact', c);
  if (c) {
    $('#hud-res').append($('.res'));
    $('#hud-minislot').append($('#mini'));
    $('#tray-slot').append($('#build'), $('#train'), $('#upg'));
    setTab(curTab);
  } else {
    $('#slot-res').append($('.res'));
    $('#slot-mini').append($('#mini'));
    $('#slot-build').append($('#build'));
    $('#slot-train').append($('#train'));
    $('#slot-upg').append($('#upg'));
    $('#build').hidden = false;
    $('#train').hidden = false;
    $('#upg').hidden = false;
  }
  if (game && game.scale)
    setTimeout(() => {
      game.scale.refresh();
      setCamBounds();
    }, 30);
}
if (MQ.addEventListener) MQ.addEventListener('change', layout);
else MQ.addListener(layout);
layout();
for (const b of document.querySelectorAll('.tab'))
  b.addEventListener('click', () => {
    const tr = $('#tray');
    if (b.dataset.tab === curTab && !tr.classList.contains('shut')) {
      tr.classList.add('shut');
    } else {
      tr.classList.remove('shut');
      setTab(b.dataset.tab);
    }
    b.blur();
  });
for (const b of document.querySelectorAll('[data-cmd]'))
  b.addEventListener('click', () => {
    cmd(b.dataset.cmd);
    b.blur();
  });
$('#paused').addEventListener('click', togglePause);
function start(diff) {
  $('#brief').hidden = true;
  $('#over').hidden = true;
  $('#paused').hidden = true;
  const sc = game.scene.getScene('main');
  if (!sc) game.scene.add('main', Main, true, { diff });
  else sc.scene.restart({ diff });
}
document
  .querySelectorAll('[data-diff]')
  .forEach(b => b.addEventListener('click', () => start(b.dataset.diff)));
$('#again').addEventListener('click', () => start(G ? G.diffKey : 'standard'));
$('#menu').addEventListener('click', () => {
  $('#over').hidden = true;
  $('#brief').hidden = false;
});
game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0c0907',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  render: { antialias: true },
  banner: false,
  input: { mouse: { preventDefaultWheel: true } },
});
window.__AWstart = start;
window.__AWadd = (t, k, x, y) => addUnit(t, k, x, y);
