// Equipotential lines by marching squares over a sampled potential grid.

// Levels k * step for every integer k whose level falls inside [lo, hi],
// nearest zero first, capped at maxLevels.
export function contourLevels(step, lo, hi, maxLevels = 80) {
  if (!(step > 0) || !(hi >= lo)) return [];
  const levels = [];
  const kMax = Math.floor(hi / step);
  const kMin = Math.ceil(lo / step);
  const ks = [];
  for (let k = kMin; k <= kMax; k++) ks.push(k);
  ks.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  for (const k of ks.slice(0, maxLevels)) levels.push(k * step);
  return levels;
}

// Robust range for the levels: the potential is unbounded at each charge,
// so use quantiles of the grid instead of its extremes.
export function potentialRange(grid, lowQuantile = 0.02, highQuantile = 0.98) {
  const sorted = Float64Array.from(grid).filter(Number.isFinite).sort();
  if (sorted.length === 0) return { lo: 0, hi: 0 };
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  return { lo: at(lowQuantile), hi: at(highQuantile) };
}

// Segments [ax, ay, bx, by] in grid coordinates (column i, row j) where the
// sampled field crosses `level`. Saddle cells are split by the cell centre.
export function marchingSquares(grid, nx, ny, level) {
  const segs = [];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = grid[j * nx + i]; // (i, j)
      const v1 = grid[j * nx + i + 1]; // (i+1, j)
      const v2 = grid[(j + 1) * nx + i + 1]; // (i+1, j+1)
      const v3 = grid[(j + 1) * nx + i]; // (i, j+1)
      if (!(Number.isFinite(v0) && Number.isFinite(v1) && Number.isFinite(v2) && Number.isFinite(v3))) continue;
      const code = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      // Crossing points on each edge: bottom, right, top, left.
      const b = () => [i + lerp(v0, v1), j];
      const r = () => [i + 1, j + lerp(v1, v2)];
      const t = () => [i + lerp(v3, v2), j + 1];
      const l = () => [i, j + lerp(v0, v3)];
      const add = (p, q) => segs.push(p[0], p[1], q[0], q[1]);
      switch (code) {
        case 1: case 14: add(l(), b()); break;
        case 2: case 13: add(b(), r()); break;
        case 3: case 12: add(l(), r()); break;
        case 4: case 11: add(r(), t()); break;
        case 6: case 9: add(b(), t()); break;
        case 7: case 8: add(l(), t()); break;
        case 5: case 10: {
          const centre = (v0 + v1 + v2 + v3) / 4 > level;
          // code 5: corners 0 and 2 high. If the centre is high they join.
          if ((code === 5) === centre) {
            add(l(), t());
            add(b(), r());
          } else {
            add(l(), b());
            add(r(), t());
          }
          break;
        }
        default: break;
      }
    }
  }
  return segs;
}
