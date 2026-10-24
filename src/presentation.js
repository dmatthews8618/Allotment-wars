// Menu illustration and screen presentation. Purely visual; never consumes match randomness.
'use strict';

function drawTitleArt() {
  const cv = $('#title-art');
  const rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(rect.width * density);
  cv.height = Math.round(rect.height * density);
  const c = cv.getContext('2d');
  const scale = Math.max(rect.width / 1440, rect.height / 1000);
  c.scale(density * scale, density * scale);
  c.translate((rect.width / scale - 1440) / 2, (rect.height / scale - 1000) / 2);
  const R = mulberry32(70823);
  c.fillStyle = lin(c, 0, 0, 0, 1000, ['#163e43', '#659583', '#f1cf86']);
  c.fillRect(0, 0, 1440, 1000);
  c.fillStyle = rad(c, 1130, 250, 360, ['rgba(255,226,154,.5)', 'rgba(255,226,154,0)']);
  c.fillRect(740, 0, 700, 650);
  circ(c, 1130, 250, 56, '#f9e4ad');
  for (let i = 0; i < 8; i++) {
    const x = 450 + R() * 1050,
      y = 110 + R() * 240;
    ell(c, x, y, 60 + R() * 70, 8 + R() * 10, 'rgba(245,238,203,.12)');
  }
  const hill = (y, col, bend) => {
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(420, y - bend, 760, y + bend, 1440, y - 30);
    c.lineTo(1440, 1000);
    c.lineTo(0, 1000);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  };
  hill(440, '#48746a', 110);
  hill(500, '#315d4b', 80);
  hill(570, '#264c38', 100);
  // Distant village and the rival society's impeccably tidy pavilion.
  for (let i = 0; i < 8; i++) {
    const x = 820 + i * 77,
      y = 455 + Math.sin(i) * 15;
    c.fillStyle = '#597468';
    c.fillRect(x, y - 34, 46, 39);
    c.beginPath();
    c.moveTo(x - 5, y - 34);
    c.lineTo(x + 23, y - 57);
    c.lineTo(x + 51, y - 34);
    c.fillStyle = '#344c49';
    c.fill();
    c.fillStyle = '#a5aa84';
    c.fillRect(x + 17, y - 22, 9, 12);
  }
  c.fillStyle = lin(c, 0, 540, 0, 1000, ['#59733c', '#263f2d']);
  c.beginPath();
  c.moveTo(0, 620);
  c.quadraticCurveTo(900, 445, 1440, 580);
  c.lineTo(1440, 1000);
  c.lineTo(0, 1000);
  c.fill();
  // Winding gravel path, behind the beds and shed.
  c.beginPath();
  c.moveTo(965, 550);
  c.bezierCurveTo(860, 680, 1230, 780, 1040, 1030);
  c.strokeStyle = '#ac9460';
  c.lineWidth = 72;
  c.stroke();
  c.strokeStyle = '#bca876';
  c.lineWidth = 48;
  c.stroke();
  for (let i = 0; i < 700; i++) {
    const x = 650 + R() * 800,
      y = 555 + R() * 445;
    line(c, x, y, x + 2, y - 3 - R() * 7, R() > 0.5 ? '#72904b' : '#314e2c', 1);
  }
  // Vegetable beds in perspective: timber edges, turned soil and individual crops.
  function bed(x, y, w, h, kind) {
    c.save();
    c.translate(x, y);
    c.transform(1, 0.12, -0.55, 0.6, 0, 0);
    c.shadowColor = '#17291d';
    c.shadowBlur = 16;
    c.shadowOffsetY = 10;
    c.fillStyle = '#98734a';
    c.fillRect(0, 0, w, h);
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.fillStyle = '#483527';
    c.fillRect(6, 6, w - 12, h - 12);
    line(c, 0, 0, w, 0, '#c7a875', 3);
    for (let yy = 24; yy < h - 10; yy += 30) {
      line(c, 10, yy + 9, w - 10, yy + 9, '#2e271d', 3);
      for (let xx = 23; xx < w - 12; xx += 32) {
        if (kind === 'pumpkin') {
          ell(c, xx + 3, yy + 5, 13, 10, '#30291e');
          circ(c, xx, yy, 11, '#c66b2d');
          ell(c, xx - 3, yy - 2, 5, 8, '#e89f43');
          line(c, xx, yy - 9, xx + 2, yy - 14, '#7a963b', 3);
        } else {
          ell(c, xx + 3, yy + 4, 13, 8, '#292e20');
          for (let a = 0; a < 5; a++)
            ell(
              c,
              xx + Math.cos(a * 1.26) * 5,
              yy + Math.sin(a * 1.26) * 4,
              7,
              4,
              a % 2 ? '#789951' : '#4d793e',
              a * 1.26
            );
          circ(c, xx - 1, yy - 2, 4, '#a1b86c');
        }
      }
    }
    c.restore();
  }
  bed(800, 665, 180, 116, 'greens');
  bed(766, 795, 205, 130, 'pumpkin');
  bed(1210, 748, 210, 120, 'greens');
  bed(1190, 875, 240, 130, 'pumpkin');
  // A greenhouse with translucent glazing and warm reflections.
  c.save();
  c.translate(1165, 500);
  c.fillStyle = '#385b4d';
  c.fillRect(0, 40, 180, 112);
  c.beginPath();
  c.moveTo(0, 40);
  c.lineTo(45, -15);
  c.lineTo(180, 5);
  c.lineTo(180, 152);
  c.lineTo(0, 152);
  c.fillStyle = 'rgba(161,204,176,.5)';
  c.fill();
  for (let x = 10; x < 180; x += 30) {
    line(c, x, 40, x, 149, '#c0cbb0', 3);
    line(c, x, 40, x + 42, -10 + x * 0.1, '#c0cbb0', 3);
    ell(c, x + 8, 126, 9, 17, '#416c3d');
  }
  line(c, 0, 40, 180, 40, '#d3d8b9', 4);
  line(c, 0, 91, 180, 91, '#a4b59a', 3);
  line(c, 0, 150, 180, 150, '#d3d8b9', 4);
  c.restore();
  // The blue allotment shed: the same team colour as the playable buildings.
  c.save();
  c.translate(945, 478);
  ell(c, 70, 166, 140, 28, 'rgba(17,34,23,.38)', -0.12);
  c.fillStyle = '#315c68';
  c.fillRect(0, 25, 153, 133);
  c.fillStyle = '#27494e';
  c.beginPath();
  c.moveTo(153, 25);
  c.lineTo(199, 3);
  c.lineTo(199, 137);
  c.lineTo(153, 158);
  c.fill();
  for (let y = 33; y < 157; y += 13) line(c, 0, y, 153, y, '#497786', 2);
  c.beginPath();
  c.moveTo(-16, 30);
  c.lineTo(69, -43);
  c.lineTo(168, 30);
  c.closePath();
  c.fillStyle = '#ba7850';
  c.fill();
  c.beginPath();
  c.moveTo(69, -43);
  c.lineTo(123, -66);
  c.lineTo(216, 5);
  c.lineTo(168, 30);
  c.closePath();
  c.fillStyle = '#744d3c';
  c.fill();
  for (let y = -25; y < 24; y += 12) line(c, 69 - (y + 43) * 1.15, y, 69 + (y + 43) * 1.35, y, '#965c40', 2);
  line(c, -16, 30, 69, -43, '#e0a56b', 5);
  line(c, 69, -43, 168, 30, '#e0a56b', 5);
  c.fillStyle = '#1b3941';
  c.fillRect(89, 55, 43, 102);
  line(c, 91, 57, 130, 57, '#6c9190', 3);
  circ(c, 121, 107, 3, '#e4bd71');
  c.fillStyle = '#e4cf93';
  c.fillRect(16, 55, 49, 43);
  c.fillStyle = '#91b9ad';
  c.fillRect(20, 59, 41, 35);
  c.beginPath();
  c.moveTo(20, 59);
  c.lineTo(53, 59);
  c.lineTo(20, 89);
  c.fillStyle = '#cbdac0';
  c.fill();
  line(c, 40, 59, 40, 94, '#e4cf93', 3);
  line(c, 20, 77, 61, 77, '#e4cf93', 3);
  c.fillStyle = '#926b43';
  c.fillRect(8, 100, 67, 12);
  for (let i = 0; i < 7; i++) {
    circ(c, 14 + i * 9, 96 - R() * 6, 7, '#638441');
    circ(c, 14 + i * 9, 93 - R() * 7, 3, i % 2 ? '#e2bc63' : '#e79978');
  }
  c.fillStyle = '#c5b58a';
  c.fillRect(35, 11, 67, 20);
  c.font = 'bold 10px Georgia';
  c.textAlign = 'center';
  c.fillStyle = '#394e3a';
  c.fillText('PLOT No. 01', 68, 25);
  // Water butt and a fork leaning against the wall.
  ell(c, -20, 146, 23, 12, '#17392e');
  c.fillStyle = '#376c67';
  c.fillRect(-43, 105, 46, 41);
  ell(c, -20, 105, 23, 10, '#65938a');
  ell(c, -20, 105, 17, 6, '#224c52');
  line(c, 170, 142, 186, 67, '#c3a06c', 4);
  line(c, 183, 76, 198, 80, '#abb8a4', 3);
  for (let i = 0; i < 4; i++) line(c, 183 + i * 5, 76 + i, 185 + i * 5, 61 + i, '#abb8a4', 2);
  c.restore();
  // Foreground fence and flowers frame the illustration, leaving the title calm.
  for (const y of [884, 933]) line(c, 575, y, 1450, y + 45, '#9c8052', 13);
  for (let i = 0; i < 13; i++) {
    const x = 620 + i * 70,
      y = 868 + i * 4;
    c.fillStyle = '#bb9c68';
    c.beginPath();
    c.moveTo(x - 9, y + 120);
    c.lineTo(x - 9, y);
    c.lineTo(x, y - 14);
    c.lineTo(x + 9, y);
    c.lineTo(x + 9, y + 120);
    c.fill();
    line(c, x - 6, y + 5, x - 6, y + 108, '#d4b781', 2);
    circ(c, x + 1, y + 21, 2, '#5c5338');
  }
  for (let i = 0; i < 75; i++) {
    const x = 590 + R() * 900,
      y = 960 + R() * 80,
      h = 15 + R() * 68;
    line(c, x, y, x - 5, y - h, '#426438', 2);
    ell(c, x + 2, y - h * 0.5, 9, 3, '#6d863e', -0.6);
    if (i % 3 === 0) {
      for (let a = 0; a < 5; a++)
        circ(
          c,
          x - 5 + Math.cos(a * 1.26) * 5,
          y - h + Math.sin(a * 1.26) * 5,
          4,
          i % 2 ? '#e6bd61' : '#e7d7aa'
        );
      circ(c, x - 5, y - h, 3, '#77572f');
    }
  }
  // Tiny birds in the evening sky.
  for (let i = 0; i < 4; i++) {
    const x = 900 + i * 38,
      y = 275 + Math.sin(i * 2) * 19;
    c.beginPath();
    c.moveTo(x - 8, y);
    c.quadraticCurveTo(x - 3, y - 3, x, y + 2);
    c.quadraticCurveTo(x + 4, y - 4, x + 9, y - 2);
    c.strokeStyle = '#395b54';
    c.lineWidth = 2;
    c.stroke();
  }
}

function setMenuOpen(open) {
  document.body.classList.toggle('menu-open', open);
  if (open) requestAnimationFrame(drawTitleArt);
}

function resultEmblem(win) {
  return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="53" stroke="currentColor" opacity=".25"/><circle cx="60" cy="60" r="46" stroke="currentColor" stroke-dasharray="2 5" opacity=".45"/><path d="M40 90C17 75 22 46 35 33M80 90c23-15 18-44 5-57" stroke="currentColor" stroke-width="2"/><path d="M29 68l-9-12 12 3m-4-7-4-14 11 8m-3 32-11-7 13-1m57-2 9-12-12 3m4-7 4-14-11 8m3 32 11-7-13-1" fill="currentColor" opacity=".7"/>${win ? '<path d="M43 80l31-43m-6-5 12 9m-15-5 9-12m-3 17 9-12m-3 17 9-12M76 80L48 43m-6-8c-8-11-14-2-6 7l10 9 9-7z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M60 86V62l-8-8 8-10V31M59 46c-18 0-23-10-22-18 14 0 23 5 22 18zm2 18c17 0 23-10 22-18-14 0-22 5-22 18z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'}</svg>`;
}

new ResizeObserver(() => {
  if (!$('#brief').hidden) drawTitleArt();
}).observe($('#brief'));
setMenuOpen(!$('#brief').hidden);
