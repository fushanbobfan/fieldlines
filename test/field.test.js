import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldAt, potentialAt, potentialGrid, totalCharge } from '../src/field.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('a point charge follows the inverse-square law', () => {
  const charges = [{ x: 1, y: 2, q: 3 }];
  const [ex, ey] = fieldAt(charges, 'point', 1, 4);
  close(ex, 0);
  close(ey, 3 / 4);
  close(potentialAt(charges, 'point', 1, 4), 3 / 2);
});

test('a line charge follows the inverse-distance law with a logarithmic potential', () => {
  const charges = [{ x: 0, y: 0, q: 2 }];
  const [ex, ey] = fieldAt(charges, 'line', -4, 0);
  close(ex, -2 / 4);
  close(ey, 0);
  close(potentialAt(charges, 'line', 0, 1) - potentialAt(charges, 'line', 0, Math.E), 2);
});

test('the field is minus the gradient of the potential in both modes', () => {
  const charges = [
    { x: -1, y: 0.3, q: 1.5 },
    { x: 1.2, y: -0.4, q: -1 },
    { x: 0.1, y: 1.7, q: 0.5 },
  ];
  const h = 1e-5;
  for (const mode of ['point', 'line']) {
    for (const [x, y] of [[0.3, 0.2], [-2, 1], [2.5, -1.5]]) {
      const [ex, ey] = fieldAt(charges, mode, x, y);
      const gx = (potentialAt(charges, mode, x + h, y) - potentialAt(charges, mode, x - h, y)) / (2 * h);
      const gy = (potentialAt(charges, mode, x, y + h) - potentialAt(charges, mode, x, y - h)) / (2 * h);
      close(ex, -gx, 1e-6);
      close(ey, -gy, 1e-6);
    }
  }
});

test('superposition: a symmetric dipole has no field across its axis on the midline', () => {
  const dipole = [{ x: -1, y: 0, q: 1 }, { x: 1, y: 0, q: -1 }];
  for (const mode of ['point', 'line']) {
    const [ex, ey] = fieldAt(dipole, mode, 0, 2);
    assert.ok(ex > 0);
    close(ey, 0);
    close(potentialAt(dipole, mode, 0, 2), 0);
  }
});

test('potentialGrid samples rows from y0 upward', () => {
  const charges = [{ x: 0, y: 0, q: 1 }];
  const grid = potentialGrid(charges, 'point', { x0: -2, x1: 2, y0: -1, y1: 3 }, 5, 5);
  assert.equal(grid.length, 25);
  close(grid[0 * 5 + 2], 1); // (0, -1)
  close(grid[4 * 5 + 2], 1 / 3); // (0, 3)
  close(grid[1 * 5 + 0], 1 / 2); // (-2, 0)
});

test('totalCharge splits positive and negative charge', () => {
  assert.deepEqual(totalCharge([{ q: 2 }, { q: -0.5 }, { q: -1 }]), { pos: 2, neg: 1.5, net: 0.5 });
});
