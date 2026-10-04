// Null points: places where the fields of the charges cancel exactly.
// Candidates are local minima of |E| on a coarse grid, polished by Newton's
// method on E(x, y) = 0 with a finite-difference Jacobian.

import { fieldAt } from './field.js';

function newton(charges, mode, x, y, iterations = 40) {
  const e = [0, 0];
  const h = 1e-6;
  for (let n = 0; n < iterations; n++) {
    fieldAt(charges, mode, x, y, e);
    const [ex, ey] = e;
    const a = fieldAt(charges, mode, x + h, y, [0, 0]);
    const b = fieldAt(charges, mode, x - h, y, [0, 0]);
    const c = fieldAt(charges, mode, x, y + h, [0, 0]);
    const d = fieldAt(charges, mode, x, y - h, [0, 0]);
    const jxx = (a[0] - b[0]) / (2 * h);
    const jyx = (a[1] - b[1]) / (2 * h);
    const jxy = (c[0] - d[0]) / (2 * h);
    const jyy = (c[1] - d[1]) / (2 * h);
    const det = jxx * jyy - jxy * jyx;
    // Rounding noise swamps the Jacobian right at a higher-order null.
    if (!Number.isFinite(det) || det === 0) break;
    let sx = (jyy * ex - jxy * ey) / det;
    let sy = (-jyx * ex + jxx * ey) / det;
    const s = Math.hypot(sx, sy);
    if (s > 0.5) {
      sx *= 0.5 / s;
      sy *= 0.5 / s;
    }
    x -= sx;
    y -= sy;
    if (s < 1e-11) break;
  }
  // Higher-order nulls (four like line charges on a square, say) have a
  // singular Jacobian and converge slowly, so the caller judges the residual.
  return { x, y };
}

export function findNullPoints(charges, mode, { x0, x1, y0, y1 }, n = 64) {
  if (charges.length < 2) return [];
  const ny = Math.max(8, Math.round((n * (y1 - y0)) / (x1 - x0)));
  const dx = (x1 - x0) / (n - 1);
  const dy = (y1 - y0) / (ny - 1);
  const mag = new Float64Array(n * ny);
  const e = [0, 0];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < n; i++) {
      fieldAt(charges, mode, x0 + i * dx, y0 + j * dy, e);
      mag[j * n + i] = Math.hypot(e[0], e[1]);
    }
  }
  const found = [];
  // A residual counts as zero against the field the charges make at unit distance.
  const tol = 1e-8 * charges.reduce((sum, c) => sum + Math.abs(c.q), 0);
  const minGap = Math.max(dx, dy) * 0.5;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < n; i++) {
      const m = mag[j * n + i];
      let isMin = true;
      for (let b = -1; b <= 1 && isMin; b++) {
        for (let a = -1; a <= 1; a++) {
          if (!a && !b) continue;
          const ii = i + a;
          const jj = j + b;
          if (ii < 0 || jj < 0 || ii >= n || jj >= ny) continue;
          if (mag[jj * n + ii] < m) {
            isMin = false;
            break;
          }
        }
      }
      if (!isMin) continue;
      const p = newton(charges, mode, x0 + i * dx, y0 + j * dy);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      fieldAt(charges, mode, p.x, p.y, e);
      if (Math.hypot(e[0], e[1]) > tol) continue;
      if (charges.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1e-3)) continue;
      if (found.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < minGap)) continue;
      found.push(p);
    }
  }
  return found;
}
