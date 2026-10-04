import test from 'node:test';
import assert from 'node:assert/strict';
import { contourLevels, potentialRange, marchingSquares } from '../src/contours.js';
import { potentialGrid } from '../src/field.js';

test('contourLevels lists multiples of the step inside the range, nearest zero first', () => {
  assert.deepEqual(contourLevels(0.5, -1.2, 1.6), [0, -0.5, 0.5, -1, 1, 1.5]);
  assert.deepEqual(contourLevels(1, 2.5, 4.5), [3, 4]);
  assert.deepEqual(contourLevels(1, -10, 10, 3), [0, -1, 1]);
  assert.deepEqual(contourLevels(0, -1, 1), []);
});

test('potentialRange ignores the spikes at the charges', () => {
  const grid = new Float64Array(100).fill(1);
  grid[3] = 1e9;
  grid[7] = -1e9;
  grid[50] = Infinity;
  assert.deepEqual(potentialRange(grid), { lo: 1, hi: 1 });
});

test('a single cell crossing yields one interpolated segment', () => {
  // corners (0,0)=0, (1,0)=0, (1,1)=0, (0,1)=2; level 1 cuts left and top edges halfway.
  const segs = marchingSquares([0, 0, 2, 0], 2, 2, 1);
  assert.deepEqual(segs, [0, 0.5, 0.5, 1]);
});

test('saddle cells are split according to the centre value', () => {
  // Grid order is row by row: (0,0), (1,0), (0,1), (1,1). The highs sit at (0,0) and (1,1).
  const high = marchingSquares([2, 0, 0, 3], 2, 2, 1); // centre 1.25: the highs join
  const low = marchingSquares([1.5, 0, 0, 1.5], 2, 2, 1); // centre 0.75: the highs stay apart
  // Joined highs cut off the low corners (1,0) and (0,1).
  assert.deepEqual(high, [0, 0.5, 1 / 3, 1, 0.5, 0, 1, 1 / 3]);
  // Separate highs are each cut off on their own.
  assert.deepEqual(low, [0, 1 / 3, 1 / 3, 0, 1, 2 / 3, 2 / 3, 1]);
});

test('equipotentials of a point charge are circles of radius q/V', () => {
  const box = { x0: -3, x1: 3, y0: -3, y1: 3 };
  const n = 121;
  const grid = potentialGrid([{ x: 0, y: 0, q: 2 }], 'point', box, n, n);
  const segs = marchingSquares(grid, n, n, 1); // radius 2
  assert.ok(segs.length > 100);
  const h = 6 / (n - 1);
  for (let k = 0; k < segs.length; k += 2) {
    const r = Math.hypot(-3 + segs[k] * h, -3 + segs[k + 1] * h);
    assert.ok(Math.abs(r - 2) < 0.01, `r = ${r}`);
  }
});
