// Start-up: keyboard shortcuts, phone/desktop layout switching, menus, and creating the Phaser game.
'use strict';

/* ---------------- boot ---------------- */
function togglePause() {
  if (!G || G.over) return;
  G.paused = !G.paused;
  $('#paused').hidden = !G.paused;
  if (G.paused) $('#resume').focus();
  else $('#resume').blur();
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
  for (const b of document.querySelectorAll('.tab[data-tab]')) b.classList.toggle('on', b.dataset.tab === t);
  if (document.body.classList.contains('compact')) {
    $('#build').hidden = t !== 'build';
    $('#train').hidden = t !== 'train';
    $('#upg').hidden = t !== 'upg';
    $('#build').scrollLeft = $('#train').scrollLeft = $('#upg').scrollLeft = 0;
    updateScrollCue();
  }
}
// Fade and arrow at the edge of the card strip while there are more cards to scroll to.
function updateScrollCue() {
  const el = $('#' + curTab);
  const more =
    el &&
    (el.scrollWidth - el.clientWidth - el.scrollLeft > 4 ||
      el.scrollHeight - el.clientHeight - el.scrollTop > 4);
  $('#tray-slot').classList.toggle('more', !!more);
}
for (const id of ['build', 'train', 'upg'])
  $('#' + id).addEventListener('scroll', updateScrollCue, { passive: true });
window.addEventListener('resize', updateScrollCue);
function setPanelOpen(open) {
  $('#panel').classList.toggle('shut', !open);
  $('#tray-toggle').textContent = open ? 'Hide' : 'Show';
  $('#tray-toggle').setAttribute('aria-expanded', String(open));
  updateScrollCue();
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
  if (S) setTimeout(setCamBounds, 30);
}
if (MQ.addEventListener) MQ.addEventListener('change', layout);
else MQ.addListener(layout);
$('#mini').height = Math.round($('#mini').width * MH / MW);
$('#mini').style.aspectRatio = MW + ' / ' + MH;
layout();
for (const b of document.querySelectorAll('.tab[data-tab]'))
  b.addEventListener('click', () => {
    setTab(b.dataset.tab);
    setPanelOpen(true);
    b.blur();
  });
$('#tray-toggle').addEventListener('click', () => setPanelOpen($('#panel').classList.contains('shut')));
for (const b of document.querySelectorAll('[data-cmd]'))
  b.addEventListener('click', () => {
    cmd(b.dataset.cmd);
    b.blur();
  });
$('#paused').addEventListener('click', togglePause);
function start(diff) {
  setMenuOpen(false);
  document.body.classList.remove('result-open');
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
  document.body.classList.remove('result-open');
  $('#brief').hidden = false;
  setMenuOpen(true);
  $('#brief [data-diff="standard"]').focus();
});
// The canvas has DPR device pixels per screen point, so it stays sharp on phones; Phaser's zoom shrinks it back to fit.
const stageSize = () => {
  const r = $('#stage').getBoundingClientRect();
  return [Math.max(2, Math.round(r.width * DPR)), Math.max(2, Math.round(r.height * DPR))];
};
const [stageW, stageH] = stageSize();
game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: '#0c0907',
  scale: { mode: Phaser.Scale.NONE, width: stageW, height: stageH, zoom: 1 / DPR },
  // Phaser otherwise enables pixel-art mode whenever scale.zoom differs from 1 (our DPR fix).
  render: { antialias: true, pixelArt: false, roundPixels: false },
  banner: false,
  input: { mouse: { preventDefaultWheel: true } },
});
function fitStage() {
  if (!game.isBooted) return;
  const [w, h] = stageSize();
  if (game.scale.width !== w || game.scale.height !== h) {
    game.scale.resize(w, h);
    if (S) setCamBounds();
  }
  updateScrollCue();
}
// Resize whenever the stage changes size, and once Phaser has finished starting (it may miss earlier changes).
new ResizeObserver(fitStage).observe($('#stage'));
game.events.once('ready', fitStage);
window.__AWstart = start;
window.__AWadd = (t, k, x, y) => addUnit(t, k, x, y);
