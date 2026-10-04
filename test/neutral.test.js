import test from 'node:test';
import assert from 'node:assert/strict';
import { findNullPoints } from '../src/neutral.js';

const VIEW = { x0: -8, x1: 8, y0: -4.5, y1: 4.5 };
const near = (p, x, y, tol = 1e-6) => Math.hypot(p.x - x, p.y - y) < tol;

test('two equal like charges cancel halfway between them', () => {
  for (const mode of ['point', 'line']) {
    const found = findNullPoints([{ x: -1, y: 0, q: 1 }, { x: 1, y: 0, q: 1 }], mode, VIEW);
    assert.equal(found.length, 1, mode);
    assert.ok(near(found[0], 0, 0));
  }
});

test('unequal like charges: the null sits closer to the weaker one', () => {
  const pair = [{ x: 0, y: 0, q: 4 }, { x: 3, y: 0, q: 1 }];
  // point: 4/x^2 = 1/(3-x)^2 -> x = 2; line: 4/x = 1/(3-x) -> x = 2.4
  assert.ok(near(findNullPoints(pair, 'point', VIEW)[0], 2, 0));
  assert.ok(near(findNullPoints(pair, 'line', VIEW)[0], 2.4, 0));
});

test('unequal opposite charges: the null lies outside, beyond the weaker charge', () => {
  const pair = [{ x: 0, y: 0, q: 2 }, { x: 1, y: 0, q: -1 }];
  const sqrt2 = Math.SQRT2;
  assert.ok(near(findNullPoints(pair, 'point', VIEW)[0], sqrt2 / (sqrt2 - 1), 0));
  assert.ok(near(findNullPoints(pair, 'line', VIEW)[0], 2, 0));
});

test('a balanced dipole and a lone charge have no null point', () => {
  assert.equal(findNullPoints([{ x: -1, y: 0, q: 1 }, { x: 1, y: 0, q: -1 }], 'point', VIEW).length, 0);
  assert.equal(findNullPoints([{ x: 0, y: 0, q: 1 }], 'point', VIEW).length, 0);
});

test('a square of four like charges has its null at the centre', () => {
  const square = [
    { x: 1, y: 1, q: 1 },
    { x: -1, y: 1, q: 1 },
    { x: -1, y: -1, q: 1 },
    { x: 1, y: -1, q: 1 },
  ];
  // For line charges the field grows like r^3 away from the centre, so
  // rounding limits how closely the null can be pinned down.
  for (const mode of ['point', 'line']) {
    const found = findNullPoints(square, mode, VIEW);
    assert.equal(found.length, 1, mode);
    assert.ok(near(found[0], 0, 0, 1e-4), mode);
  }
});

test('nulls outside the region are left out', () => {
  const pair = [{ x: 0, y: 0, q: 2 }, { x: 1, y: 0, q: -1 }];
  assert.equal(findNullPoints(pair, 'point', { x0: -2, x1: 2, y0: -2, y1: 2 }).length, 0);
});
