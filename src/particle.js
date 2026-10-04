// Test charges: light charged particles that move in the field of the fixed
// charges without disturbing it. Mass is 1, so a test charge q feels the
// acceleration q E. Motion is integrated with fourth-order Runge-Kutta and
// a step that shrinks near charges and during fast close passes.

import { fieldAt, potentialAt } from './field.js';

export const CAPTURE_RADIUS = 0.06;
const DT_MAX = 0.02;
const DT_MIN = 1e-5;

export function makeParticle(x, y, vx, vy, q) {
  return { x, y, vx, vy, q, t: 0, alive: true, fate: null, trail: [x, y], energy0: null };
}

// Kinetic plus potential energy, which the motion should conserve.
export function energy(p, charges, mode) {
  return 0.5 * (p.vx * p.vx + p.vy * p.vy) + p.q * potentialAt(charges, mode, p.x, p.y);
}

function nearest(charges, x, y) {
  let d = Infinity;
  for (const c of charges) d = Math.min(d, Math.hypot(x - c.x, y - c.y));
  return d;
}

function derivative(charges, mode, q, s, out, e) {
  fieldAt(charges, mode, s[0], s[1], e);
  out[0] = s[2];
  out[1] = s[3];
  out[2] = q * e[0];
  out[3] = q * e[1];
}

// Step size for the current state: a small fraction of the time to cross
// the distance to the nearest charge, at the current speed or by the
// current acceleration, whichever is quicker.
export function stepSize(charges, mode, p) {
  const d = nearest(charges, p.x, p.y);
  if (!Number.isFinite(d)) return DT_MAX;
  const e = fieldAt(charges, mode, p.x, p.y);
  const speed = Math.hypot(p.vx, p.vy);
  const acc = Math.abs(p.q) * Math.hypot(e[0], e[1]);
  const byDistance = (0.02 * d) / Math.max(speed, 1e-9);
  const byForce = 0.05 * Math.sqrt(d / Math.max(acc, 1e-12));
  return Math.max(DT_MIN, Math.min(DT_MAX, byDistance, byForce));
}

const k1 = new Float64Array(4);
const k2 = new Float64Array(4);
const k3 = new Float64Array(4);
const k4 = new Float64Array(4);
const tmp = new Float64Array(4);
const e = [0, 0];

export function rk4Step(charges, mode, p, dt) {
  const s = [p.x, p.y, p.vx, p.vy];
  derivative(charges, mode, p.q, s, k1, e);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * dt * k1[i];
  derivative(charges, mode, p.q, tmp, k2, e);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * dt * k2[i];
  derivative(charges, mode, p.q, tmp, k3, e);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + dt * k3[i];
  derivative(charges, mode, p.q, tmp, k4, e);
  p.x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  p.y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  p.vx += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  p.vy += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
  p.t += dt;
}

// Advances a particle by `duration` time units. It is captured when it
// reaches a fixed charge and lost when it leaves `bounds`. The trail keeps
// at most `trailPoints` points, spaced at least `trailGap` apart.
export function advance(charges, mode, p, duration, bounds, { trailPoints = 4000, trailGap = 0.02 } = {}) {
  if (!p.alive) return;
  if (p.energy0 === null) p.energy0 = energy(p, charges, mode);
  let left = duration;
  while (left > 0 && p.alive) {
    const dt = Math.min(left, stepSize(charges, mode, p));
    rk4Step(charges, mode, p, dt);
    left -= dt;
    const n = p.trail.length;
    if (Math.hypot(p.x - p.trail[n - 2], p.y - p.trail[n - 1]) >= trailGap) {
      p.trail.push(p.x, p.y);
      if (p.trail.length > 2 * trailPoints) p.trail.splice(0, 2);
    }
    if (charges.length && nearest(charges, p.x, p.y) < CAPTURE_RADIUS) {
      p.alive = false;
      p.fate = 'captured';
    } else if (p.x < bounds.x0 || p.x > bounds.x1 || p.y < bounds.y0 || p.y > bounds.y1) {
      p.alive = false;
      p.fate = 'escaped';
    }
  }
  if (!p.alive) p.trail.push(p.x, p.y);
}

// Relative change in energy since launch. Moving a fixed charge changes the
// field under the particle, so the energy is re-baselined then.
export function energyDrift(p, charges, mode) {
  const now = energy(p, charges, mode);
  const scale = Math.max(Math.abs(p.energy0), 0.5 * (p.vx * p.vx + p.vy * p.vy), 1e-9);
  return (now - p.energy0) / scale;
}
