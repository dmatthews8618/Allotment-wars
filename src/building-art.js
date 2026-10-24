// AI-generated painted-style building atlas. The source artwork is assets/buildings.webp;
// tools/build.py embeds it as a data URL so file:// and the single-file game work too.
'use strict';

// Explicit source rectangles keep neighbouring props outside each sprite.
// Coordinates are measured on the 1254-square master and scaled with the atlas.
const PAINTED_BUILDING_RECTS = {
  hq: [
    [0, 0, 315, 307],
    [635, 0, 319, 308],
  ],
  shed: [
    [320, 0, 310, 308],
    [955, 0, 299, 313],
  ],
  water: [
    [25, 312, 285, 298],
    [636, 320, 314, 292],
  ],
  bin: [
    [310, 330, 320, 282],
    [950, 330, 304, 282],
  ],
  tunnel: [
    [0, 610, 327, 315],
    [637, 625, 320, 300],
  ],
  scare: [
    [330, 615, 305, 310],
    [960, 623, 294, 302],
  ],
  hive: [
    [5, 925, 302, 329],
    [645, 925, 300, 329],
  ],
  sprink: [
    [350, 925, 270, 329],
    [970, 925, 284, 329],
  ],
};
let paintedBuildingFrames = null;

function preparePaintedBuildings() {
  if (!S.textures.exists('painted-buildings')) return false;
  const atlas = S.textures.get('painted-buildings').getSourceImage();
  // Cache the occupied area of each cell once. Trimming transparent gutters
  // preserves the art's proportions and makes small defences readable.
  if (!paintedBuildingFrames) {
    const cv = document.createElement('canvas');
    cv.width = atlas.width;
    cv.height = atlas.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(atlas, 0, 0);
    const pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
    paintedBuildingFrames = {};
    for (const [kind, cells] of Object.entries(PAINTED_BUILDING_RECTS)) {
      cells.forEach(([rx, ry, rw, rh], team) => {
        const x0 = Math.round((rx * cv.width) / 1254),
          x1 = Math.round(((rx + rw) * cv.width) / 1254);
        const y0 = Math.round((ry * cv.height) / 1254),
          y1 = Math.round(((ry + rh) * cv.height) / 1254);
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
        paintedBuildingFrames[kind + '_' + team] =
          right > left && bottom > top ? [left, top, right - left, bottom - top] : [x0, y0, x1 - x0, y1 - y0];
      });
    }
  }
  return true;
}

function drawPaintedBuilding(c, W, H, kind, team) {
  const frame = paintedBuildingFrames && paintedBuildingFrames[kind + '_' + team];
  if (!frame) return DRAW[kind](c, W, H, TEAM[team], team);
  const [x, y, w, h] = frame;
  const inset = Math.min(W, H) > 32 ? 3 : 1;
  const scale = Math.min((W - inset * 2) / w, (H - inset * 2) / h);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(
    S.textures.get('painted-buildings').getSourceImage(),
    x,
    y,
    w,
    h,
    (W - w * scale) / 2,
    H - inset - h * scale,
    w * scale,
    h * scale
  );
}
