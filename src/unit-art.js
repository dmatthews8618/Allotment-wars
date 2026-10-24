// AI-generated painted unit sprites, composited into the game's existing texture keys.
'use strict';

const PAINTED_UNIT_COLUMNS = [0, 310, 582, 893, 1222, 1536];
const PAINTED_UNIT_ROWS = [0, 252, 497, 746, 1024];
const PAINTED_UNIT_SIZES = { fork: 30, hose: 30, barrow: 34, tiller: 38, cata: 40 };
let paintedUnitFrames = null;
let paintedUnitDirections = null;

function preparePaintedUnits() {
  if (!S.textures.exists('painted-units')) return false;
  if (paintedUnitFrames) return true;
  const atlas = S.textures.get('painted-units').getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = atlas.width;
  cv.height = atlas.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(atlas, 0, 0);
  const pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
  paintedUnitFrames = {};
  for (const team of [0, 1]) {
    ['fork', 'hose', 'barrow', 'tiller', 'cata'].forEach((kind, col) => {
      for (const state of [0, 1]) {
        const row = team * 2 + state;
        const x0 = Math.round((PAINTED_UNIT_COLUMNS[col] * cv.width) / 1536),
          x1 = Math.round((PAINTED_UNIT_COLUMNS[col + 1] * cv.width) / 1536);
        const y0 = Math.round((PAINTED_UNIT_ROWS[row] * cv.height) / 1024),
          y1 = Math.round((PAINTED_UNIT_ROWS[row + 1] * cv.height) / 1024);
        let left = x1,
          top = y1,
          right = x0,
          bottom = y0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            if (pixels[(y * cv.width + x) * 4 + 3] < 12) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + 1);
            bottom = Math.max(bottom, y + 1);
          }
        paintedUnitFrames[kind + '_' + team + '_' + state] =
          right > left && bottom > top ? [left, top, right - left, bottom - top] : [x0, y0, x1 - x0, y1 - y0];
      }
    });
  }
  prepareUnitDirections();
  return true;
}

function prepareUnitDirections() {
  if (paintedUnitDirections || !S.textures.exists('painted-unit-directions')) return;
  const atlas = S.textures.get('painted-unit-directions').getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = atlas.width;
  cv.height = atlas.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(atlas, 0, 0);
  const pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
  paintedUnitDirections = {};
  [
    ['fork', 0],
    ['hose', 0],
    ['fork', 1],
    ['hose', 1],
  ].forEach(([kind, team], col) => {
    for (let row = 0; row < 4; row++) {
      const x0 = Math.round(([0, 350, 650, 956][col] * cv.width) / 1254),
        x1 = Math.round(([348, 629, 938, 1254][col] * cv.width) / 1254);
      const y0 = Math.round(([0, 312, 610, 910][row] * cv.height) / 1254),
        y1 = Math.round(([304, 606, 905, 1254][row] * cv.height) / 1254);
      let left = x1,
        top = y1,
        right = x0,
        bottom = y0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (pixels[(y * cv.width + x) * 4 + 3] < 12) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      const direction = row < 2 ? 'n' : 's';
      paintedUnitDirections[kind + '_' + team + '_' + (row % 2) + '_' + direction] =
        right > left && bottom > top ? [left, top, right - left, bottom - top] : [x0, y0, x1 - x0, y1 - y0];
    }
  });
}

function drawUnitTexture(c, W, H, kind, team, frame, state, direction) {
  // Infantry/rotavators use movement frames. Carts and launchers instead have
  // separate loaded/firing drawings; their chassis keeps the same facing.
  const pose = kind === 'barrow' || kind === 'cata' ? (state ? 1 : 0) : frame;
  const directionalRect =
    direction &&
    paintedUnitDirections &&
    paintedUnitDirections[kind + '_' + team + '_' + frame + '_' + direction];
  const rect = directionalRect || (paintedUnitFrames && paintedUnitFrames[kind + '_' + team + '_' + pose]);
  if (!rect) return outlined((ctx, w, h) => DRAW[kind](ctx, w, h, TEAM[team], team, frame, state))(c, W, H);
  const [x, y, w, h] = rect;
  const infantry = kind === 'fork' || kind === 'hose';
  const scale = Math.min((W - 2) / w, (infantry ? 24 : H - 2) / h);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(
    S.textures.get(directionalRect ? 'painted-unit-directions' : 'painted-units').getSourceImage(),
    x,
    y,
    w,
    h,
    (W - w * scale) / 2,
    infantry ? H - 1 - h * scale : (H - h * scale) / 2,
    w * scale,
    h * scale
  );
}

function paintedInfantry(e) {
  return !!paintedUnitFrames && e.unit && e.d.armor === 'inf';
}

function unitDirectionSuffix(e) {
  if (!paintedInfantry(e) || !paintedUnitDirections) return '';
  const y = Math.sin(e.ang);
  return y < -0.75 ? '_n' : y > 0.75 ? '_s' : '';
}

function applyUnitFacing(e) {
  if (paintedInfantry(e)) {
    // Anchor the feet to the ground marker: north/south orders must not rotate
    // a standing character onto its side or turn it upside down.
    e.spr
      .setOrigin(0.5, 0.85)
      .setRotation(0)
      .setFlipX(!unitDirectionSuffix(e) && Math.cos(e.ang) < 0);
  } else e.spr.setOrigin(0.5).setRotation(e.ang).setFlipX(false);
}

function unitHealthY(e) {
  return e.y - (paintedInfantry(e) ? 28 : e.d.r + 9);
}
