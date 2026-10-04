import test from 'node:test';
import assert from 'node:assert/strict';
import { gaussLegendre, fluxPerCharge, gaussReport, outwardSigns, FACTOR } from '../src/gauss.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('Gauss-Legendre integrates polynomials up to degree 2n-1 exactly', () => {
  const { nodes, weights } = gaussLegendre(5);
  const integrate = (f) => nodes.reduce((s, x, i) => s + weights[i] * f(x), 0);
  close(integrate(() => 1), 2, 1e-14);
  close(integrate((x) => x ** 8), 2 / 9, 1e-14);
  close(integrate((x) => x ** 9 + x ** 3), 0, 1e-14);
  assert.ok(nodes.every((x, i) => i === 0 || x > nodes[i - 1]));
});

test('a charge inside gives 2*pi*q through a loop and 4*pi*q through a sphere', () => {
  const surface = { x: 0.3, y: -0.2, r: 2 };
  const charges = [{ x: 0.9, y: 0.4, q: 1.5 }];
  close(fluxPerCharge(charges, 'line', surface)[0], 2 * Math.PI * 1.5, 1e-9);
  close(fluxPerCharge(charges, 'point', surface)[0], 4 * Math.PI * 1.5, 1e-6);
});

test('a charge outside gives no net flux in either mode', () => {
  const surface = { x: 0, y: 0, r: 1.5 };
  const charges = [{ x: 2.3, y: 0.4, q: -2 }];
  close(fluxPerCharge(charges, 'line', surface)[0], 0, 1e-9);
  close(fluxPerCharge(charges, 'point', surface)[0], 0, 1e-6);
});

test('the sphere rule stays accurate for charges just clear of the flagged band', () => {
  const surface = { x: 0, y: 0, r: 2 };
  for (const d of [-0.1, 0.1]) {
    const expected = d < 0 ? 4 * Math.PI : 0;
    close(fluxPerCharge([{ x: 2 + d, y: 0.01, q: 1 }], 'point', surface)[0], expected, 1e-3);
  }
});

test('gaussReport adds up the enclosed charge and splits the flux by origin', () => {
  const charges = [
    { x: 0, y: 0, q: 2 },
    { x: 0.5, y: 0.5, q: -0.5 },
    { x: 4, y: 0, q: 3 },
    { x: -3, y: 2, q: -1 },
  ];
  for (const mode of ['line', 'point']) {
    const r = gaussReport(charges, mode, { x: 0, y: 0, r: 2 });
    assert.equal(r.inside, 2);
    assert.equal(r.enclosed, 1.5);
    assert.equal(r.factor, FACTOR[mode]);
    close(r.flux / r.factor, 1.5, 1e-6);
    close(r.fluxOutside, 0, 1e-6);
    assert.equal(r.near, 0);
  }
});

test('gaussReport flags charges sitting on the surface', () => {
  const r = gaussReport([{ x: 2.05, y: 0, q: 1 }], 'line', { x: 0, y: 0, r: 2 });
  assert.equal(r.near, 1);
  assert.equal(r.inside, 0);
});

test('outwardSigns: a positive charge inside pushes out all round, one outside pushes in on its near side', () => {
  const surface = { x: 0, y: 0, r: 1 };
  assert.ok(outwardSigns([{ x: 0.2, y: 0, q: 1 }], surface, 'point').every((s) => s === 1));
  const signs = outwardSigns([{ x: 3, y: 0, q: 1 }], surface, 'line', 4);
  // Segment centres at 45, 135, 225 and 315 degrees: the right side faces the charge.
  assert.deepEqual(Array.from(signs), [-1, 1, 1, -1]);
});
