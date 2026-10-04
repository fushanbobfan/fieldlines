// Drawing: the world-to-screen transform, the potential colour map, arrow
// placement along field lines, and the canvas painters used by the page.

import { VIEW_HALF } from './params.js';

// World units map to pixels so that the 16 x 9 world fits the canvas.
export function makeView(width, height) {
  const scale = Math.min(width / (2 * VIEW_HALF.x), height / (2 * VIEW_HALF.y));
  const cx = width / 2;
  const cy = height / 2;
  return {
    width,
    height,
    scale,
    x0: -cx / scale,
    x1: cx / scale,
    y0: -cy / scale,
    y1: cy / scale,
    toScreen: (x, y) => [cx + x * scale, cy - y * scale],
    toWorld: (px, py) => [(px - cx) / scale, (cy - py) / scale],
  };
}

const BG = [11, 15, 23];
const POS = [232, 112, 84];
const NEG = [74, 144, 226];

// Diverging map: warm for positive potential, cool for negative, fading to
// the background at zero. `scale` is the potential that reaches ~76%.
export function potentialColor(v, scale) {
  const t = Math.tanh(v / scale);
  const c = t >= 0 ? POS : NEG;
  const a = Math.abs(t) * 0.55;
  return [
    Math.round(BG[0] + (c[0] - BG[0]) * a),
    Math.round(BG[1] + (c[1] - BG[1]) * a),
    Math.round(BG[2] + (c[2] - BG[2]) * a),
  ];
}

export function polylineLength(points) {
  let len = 0;
  for (let i = 2; i < points.length; i += 2) len += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
  return len;
}

// Arrowheads along a line: one in the middle of the visible stretch for
// short lines, otherwise one every `spacing` units, offset by half a gap.
// Only points inside `box` count, so arrows stay on screen.
export function arrowMarks(points, spacing, box) {
  const inside = (x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  let visible = 0;
  for (let i = 2; i < points.length; i += 2) {
    if (inside(points[i - 2], points[i - 1]) && inside(points[i], points[i + 1])) {
      visible += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
    }
  }
  if (visible === 0) return [];
  const count = Math.max(1, Math.floor(visible / spacing));
  const gap = visible / count;
  const marks = [];
  let next = gap / 2;
  let run = 0;
  for (let i = 2; i < points.length && marks.length < count; i += 2) {
    const ax = points[i - 2];
    const ay = points[i - 1];
    const bx = points[i];
    const by = points[i + 1];
    if (!inside(ax, ay) || !inside(bx, by)) continue;
    const seg = Math.hypot(bx - ax, by - ay);
    while (seg > 0 && run + seg >= next && marks.length < count) {
      const f = (next - run) / seg;
      marks.push({ x: ax + f * (bx - ax), y: ay + f * (by - ay), angle: Math.atan2(by - ay, bx - ax) });
      next += gap;
    }
    run += seg;
  }
  return marks;
}

export function formatNumber(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e4 || a < 1e-3)) return v.toExponential(2).replace('e', '×10^').replace('+', '');
  return v.toFixed(a >= 100 ? 1 : 3).replace('-', '−');
}

// --- canvas painters --------------------------------------------------------

// Paints the potential grid (row 0 at the bottom of the world) into an
// ImageData of the same size.
export function paintPotential(image, grid, nx, ny, scale) {
  const data = image.data;
  for (let j = 0; j < ny; j++) {
    const row = ny - 1 - j; // image rows run downwards
    for (let i = 0; i < nx; i++) {
      const [r, g, b] = potentialColor(grid[j * nx + i], scale);
      const k = 4 * (row * nx + i);
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
      data[k + 3] = 255;
    }
  }
}

export function drawFieldLines(ctx, view, lines, { color = 'rgba(236, 240, 247, 0.85)', width = 1.25, arrowSpacing = 3 } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  const box = { x0: view.x0, x1: view.x1, y0: view.y0, y1: view.y1 };
  for (const l of lines) {
    const p = l.points;
    ctx.beginPath();
    let [sx, sy] = view.toScreen(p[0], p[1]);
    ctx.moveTo(sx, sy);
    for (let i = 2; i < p.length; i += 2) {
      [sx, sy] = view.toScreen(p[i], p[i + 1]);
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    for (const m of arrowMarks(p, arrowSpacing, box)) {
      const [ax, ay] = view.toScreen(m.x, m.y);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(-m.angle);
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-4, 3.5);
      ctx.lineTo(-4, -3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// Segments come from marchingSquares in grid coordinates over `box`.
export function drawContours(ctx, view, contours, box, nx, ny) {
  const gx = (box.x1 - box.x0) / (nx - 1);
  const gy = (box.y1 - box.y0) / (ny - 1);
  ctx.save();
  ctx.lineWidth = 1;
  for (const { level, segs } of contours) {
    ctx.strokeStyle = level === 0 ? 'rgba(255, 255, 255, 0.55)' : level > 0 ? 'rgba(255, 190, 160, 0.45)' : 'rgba(160, 200, 255, 0.45)';
    ctx.setLineDash(level === 0 ? [5, 4] : []);
    ctx.beginPath();
    for (let k = 0; k < segs.length; k += 4) {
      const [ax, ay] = view.toScreen(box.x0 + segs[k] * gx, box.y0 + segs[k + 1] * gy);
      const [bx, by] = view.toScreen(box.x0 + segs[k + 2] * gx, box.y0 + segs[k + 3] * gy);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function chargeRadius(q) {
  return 9 + 3 * Math.sqrt(Math.abs(q));
}

export function drawCharges(ctx, view, charges, selected) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  charges.forEach((c, i) => {
    const [x, y] = view.toScreen(c.x, c.y);
    const r = chargeRadius(c.q);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = c.q > 0 ? '#d9573b' : '#2f76c9';
    ctx.fill();
    ctx.lineWidth = i === selected ? 3 : 1.5;
    ctx.strokeStyle = i === selected ? '#ffd27a' : 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '600 13px system-ui, sans-serif';
    const mag = Math.abs(c.q);
    ctx.fillText((c.q > 0 ? '+' : '−') + (mag === 1 ? '' : String(mag)), x, y + 0.5);
  });
  ctx.restore();
}

export function drawNulls(ctx, view, nulls) {
  ctx.save();
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = 2;
  for (const p of nulls) {
    const [x, y] = view.toScreen(p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawProbe(ctx, view, x, y, ex, ey) {
  const m = Math.hypot(ex, ey);
  if (!(m > 0)) return;
  const [sx, sy] = view.toScreen(x, y);
  const len = 28;
  const ux = ex / m;
  const uy = -ey / m;
  ctx.save();
  ctx.strokeStyle = '#ffd27a';
  ctx.fillStyle = '#ffd27a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + ux * len, sy + uy * len);
  ctx.stroke();
  const a = Math.atan2(uy, ux);
  ctx.translate(sx + ux * len, sy + uy * len);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-5, 4);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
