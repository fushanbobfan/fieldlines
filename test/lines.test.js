import test from 'node:test';
import assert from 'node:assert/strict';
import { traceAll, traceLine, seedCount, seedPhase, lineTally, reversePoints } from '../src/lines.js';
import { fieldAt } from '../src/field.js';

const BOUNDS = { x0: -24, x1: 24, y0: -14, y1: 14 };
// Dipole lines that leave nearly backwards swing far out before returning.
const WIDE = { x0: -60, x1: 60, y0: -60, y1: 60 };

test('seedCount is proportional to the charge and never zero', () => {
  assert.equal(seedCount(1, 8), 8);
  assert.equal(seedCount(-2.5, 8), 20);
  assert.equal(seedCount(0.01, 8), 1);
});

test('seedPhase points at the nearest opposite charge, else the nearest charge', () => {
  const charges = [{ x: 0, y: 0, q: 1 }, { x: 0, y: 1, q: 1 }, { x: -3, y: 0, q: -1 }];
  assert.ok(Math.abs(seedPhase(charges, 0) - Math.PI) < 1e-12);
  assert.ok(Math.abs(seedPhase([{ x: 0, y: 0, q: 1 }, { x: 0, y: 2, q: 1 }], 0) - Math.PI / 2) < 1e-12);
  assert.equal(seedPhase([{ x: 0, y: 0, q: 1 }], 0), 0);
});

test('a lone positive charge sends straight radial lines out of the region', () => {
  for (const mode of ['point', 'line']) {
    const lines = traceAll([{ x: 0, y: 0, q: 1 }], mode, BOUNDS, { density: 6 });
    assert.equal(lines.length, 6);
    for (const l of lines) {
      assert.equal(l.end, 'escape');
      const n = l.points.length;
      const a0 = Math.atan2(l.points[3], l.points[2]);
      const a1 = Math.atan2(l.points[n - 1], l.points[n - 2]);
      assert.ok(Math.abs(Math.sin(a1 - a0)) < 1e-6);
    }
  }
});

test('every point of a traced line moves along the field', () => {
  const charges = [{ x: -1, y: 0, q: 1 }, { x: 1.5, y: 0.5, q: -1 }];
  const lines = traceAll(charges, 'point', BOUNDS, { density: 10 });
  const e = [0, 0];
  for (const l of lines) {
    const p = l.points;
    for (let i = 2; i + 3 < p.length - 2; i += 2) {
      const dx = p[i + 2] - p[i];
      const dy = p[i + 3] - p[i + 1];
      fieldAt(charges, 'point', p[i] + dx / 2, p[i + 1] + dy / 2, e);
      const cos = (dx * e[0] + dy * e[1]) / (Math.hypot(dx, dy) * Math.hypot(e[0], e[1]));
      assert.ok(cos > 0.99, `cos ${cos}`);
    }
  }
});

test('in a dipole the lines from the positive charge land on the negative one', () => {
  const dipole = [{ x: -1, y: 0, q: 1 }, { x: 1, y: 0, q: -1 }];
  for (const mode of ['point', 'line']) {
    const lines = traceAll(dipole, mode, WIDE, { density: 12 });
    const { ends, open } = lineTally(lines, 2);
    // The line leaving straight backwards along the axis runs off to infinity.
    assert.ok(ends[1] >= 10, `${mode}: ${ends[1]} landed`);
    assert.ok(open <= 2);
    for (const l of lines) if (l.end === 'charge') assert.deepEqual(l.points.slice(-2), [1, 0]);
  }
});

test('line charges obey Gauss in the plane: a +2/-1 pair sends half its lines to the -1', () => {
  const pair = [{ x: -1, y: 0, q: 2 }, { x: 1, y: 0, q: -1 }];
  const lines = traceAll(pair, 'line', WIDE, { density: 8 });
  assert.equal(lines.length, 16);
  const { ends } = lineTally(lines, 2);
  assert.ok(Math.abs(ends[1] - 8) <= 1, `${ends[1]} lines ended on -1`);
});

test('when negative charge dominates, lines are seeded there and still run positive to negative', () => {
  const charges = [{ x: 0, y: 0, q: -2 }, { x: 2, y: 0, q: 1 }];
  const lines = traceAll(charges, 'point', BOUNDS, { density: 4 });
  assert.equal(lines.length, 8);
  for (const l of lines) {
    const n = l.points.length;
    assert.deepEqual(l.points.slice(n - 2), [0, 0]);
    assert.equal(l.source, 0);
  }
});

test('a line aimed straight at the null point between like charges stalls there', () => {
  const pair = [{ x: -1, y: 0, q: 1 }, { x: 1, y: 0, q: 1 }];
  const l = traceLine(pair, 'point', -0.9, 0, 1, BOUNDS);
  assert.equal(l.end, 'stall');
  const n = l.points.length;
  assert.ok(Math.abs(l.points[n - 2]) < 0.05);
});

test('reversePoints swaps point order but keeps each pair intact', () => {
  assert.deepEqual(reversePoints([1, 2, 3, 4, 5, 6]), [5, 6, 3, 4, 1, 2]);
});
