// Win and lose checks and the result screen.
'use strict';

/* ---------------- end ---------------- */
function checkEnd() {
  if (G.over) return;
  const eB = G.ents.some(e => !e.dead && e.team === 1 && e.bld && !e.d.wall);
  const pB = G.ents.some(e => !e.dead && e.team === 0 && e.bld && !e.d.wall),
    pU = G.ents.some(e => !e.dead && e.team === 0 && e.unit && !e.d.harv);
  if (!eB) endGame(true);
  else if (!pB && !pU) endGame(false);
}
function endGame(win) {
  G.over = true;
  if (G.headless) {
    G.result = win;
    return;
  }
  G.result = win;
  const m = Math.floor(G.time / 60),
    s = Math.floor(G.time % 60);
  $('#over-kicker').textContent = win ? 'Victory · ' + G.D.label : 'Defeat · ' + G.D.label;
  $('#over-title').textContent = win ? 'The plot is yours' : 'Paved over';
  $('#over-text').textContent = win
    ? 'The Clubhouse is rubble and the Tidy Lawns Society has retreated to the bowling club. The compost heaps belong to the people again.'
    : 'The gnomes have flattened your plot. Somewhere a ride-on mower is doing a victory lap.';
  $('#st-time').textContent = m + ':' + String(s).padStart(2, '0');
  $('#st-comp').textContent = G.stats.harvested.toLocaleString('en-GB');
  $('#st-kill').textContent = G.stats.killed;
  $('#st-lost').textContent = G.stats.lost;
  $('#garden-result').textContent =
    G.stats.gardensCaptured +
    ' gardens claimed · ' +
    G.stats.gardenIncome.toLocaleString('en-GB') +
    ' bonus compost earned';
  document.body.classList.add('result-open');
  $('#over').dataset.result = win ? 'victory' : 'defeat';
  $('#result-seal').innerHTML = resultEmblem(win);
  $('#over').hidden = false;
  $('#again').focus();
}
