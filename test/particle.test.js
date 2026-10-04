import test from 'node:test';
import assert from 'node:assert/strict';
import { makeParticle, advance, energy, energyDrift, stepSize, CAPTURE_RADIUS } from '../src/particle.js';

const WIDE = { x0: -100, x1: 100, y0: -100, y1: 100 };
const core = [{ x: 0, y: 0, q: 1 }];

test('point charges: a circular Kepler orbit closes after one period', () => {
  // q Q / r^2 = v^2 / r with q Q = -1 and r = 2 gives v = sqrt(1/2).
  const v = Math.sqrt(0.5);
  const p = makeParticle(2, 0, 0, v, -1);
  const period = (2 * Math.PI * 2) / v;
  advance(core, 'point', p, period, WIDE);
  assert.ok(p.alive);
  assert.ok(Math.hypot(p.x - 2, p.y) < 1e-6, `${p.x}, ${p.y}`);
  assert.ok(Math.abs(energyDrift(p, core, 'point')) < 1e-9);
});

test('line charges: circular orbits have the same speed at every radius', () => {
  // q Q / r = v^2 / r: v = 1 for q Q = -1, whatever r is.
  for (const r of [0.5, 1, 3]) {
    const p = makeParticle(r, 0, 0, 1, -1);
    advance(core, 'line', p, 2 * Math.PI * r * 1.25, WIDE);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - r) < 1e-6, `r = ${r}`);
    assert.ok(Math.abs(p.y - r) < 1e-5); // a quarter turn past a full circle: at (0, r)
  }
});

test('an eccentric orbit keeps its energy through close passes', () => {
  const p = makeParticle(3, 0, 0, 0.25, -1);
  advance(core, 'point', p, 60, WIDE);
  assert.ok(p.alive);
  assert.ok(Math.abs(energyDrift(p, core, 'point')) < 1e-6, String(energyDrift(p, core, 'point')));
});

test('a like charge fired head-on turns back where its kinetic energy is used up', () => {
  // Energy 1/2 v^2 + qQ/r at the start equals qQ / r_min at the turn:
  // 1/2 + 1/6 = 1 / r_min, so r_min = 1.5.
  const p = makeParticle(-6, 0, 1, 0, 1);
  let closest = Infinity;
  for (let i = 0; i < 2000; i++) {
    advance(core, 'point', p, 0.01, WIDE);
    closest = Math.min(closest, Math.hypot(p.x, p.y));
  }
  assert.ok(Math.abs(closest - 1.5) < 1e-3, String(closest));
  assert.ok(p.vx < 0);
});

test('an opposite charge dropped from rest is captured; a fast one escapes the region', () => {
  const fall = makeParticle(1, 0, 0, 0, -1);
  advance(core, 'point', fall, 10, WIDE);
  assert.equal(fall.alive, false);
  assert.equal(fall.fate, 'captured');
  assert.ok(Math.hypot(fall.x, fall.y) < CAPTURE_RADIUS);
  const away = makeParticle(1, 0, 5, 0, 1);
  advance(core, 'point', away, 100, { x0: -10, x1: 10, y0: -10, y1: 10 });
  assert.equal(away.fate, 'escaped');
});

test('with no charges a particle moves in a straight line', () => {
  const p = makeParticle(0, 0, 1, 2, 1);
  advance([], 'point', p, 1.5, WIDE);
  assert.ok(Math.abs(p.x - 1.5) < 1e-12 && Math.abs(p.y - 3) < 1e-12);
  assert.equal(energy(p, [], 'point'), 2.5);
});

test('steps shrink near a charge and the trail stays bounded', () => {
  const far = makeParticle(5, 0, 0, 0.1, -1);
  const near = makeParticle(0.1, 0, 0, 3, -1);
  assert.ok(stepSize(core, 'point', near) < stepSize(core, 'point', far));
  const p = makeParticle(2, 0, 0, Math.sqrt(0.5), -1);
  advance(core, 'point', p, 200, WIDE, { trailPoints: 100 });
  assert.equal(p.trail.length, 200);
});
