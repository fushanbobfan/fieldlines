// Field-line tracing. Lines are seeded evenly around the charges of the
// dominant sign (positive unless the negative charge outweighs it), with a
// count proportional to each charge, and followed with fourth-order
// Runge-Kutta along the unit field direction until they reach a charge,
// leave the region or stall at a point where the field vanishes.

import { fieldAt, totalCharge } from './field.js';

export const DEFAULTS = {
  density: 8, // lines per unit of charge
  step: 0.03, // base arc-length step, in world units
  startRadius: 0.06,
  endRadius: 0.05,
  maxSteps: 8000,
  maxLength: 300,
};

export function seedCount(q, density) {
  return Math.max(1, Math.round(Math.abs(q) * density));
}

// Angle of the first seed on a charge: towards the nearest charge of the
// other sign if there is one, else towards the nearest charge at all, so a
// dipole always gets the line along its axis.
export function seedPhase(charges, index) {
  const c = charges[index];
  let best = null;
  let bestOpposite = false;
  let bestD = Infinity;
  for (let i = 0; i < charges.length; i++) {
    if (i === index) continue;
    const o = charges[i];
    const opposite = Math.sign(o.q) !== Math.sign(c.q);
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d === 0) continue;
    if ((opposite && !bestOpposite) || (opposite === bestOpposite && d < bestD)) {
      best = o;
      bestD = d;
      bestOpposite = opposite;
    }
  }
  return best ? Math.atan2(best.y - c.y, best.x - c.x) : 0;
}

function nearestCharge(charges, x, y) {
  let index = -1;
  let d = Infinity;
  for (let i = 0; i < charges.length; i++) {
    const di = Math.hypot(x - charges[i].x, y - charges[i].y);
    if (di < d) {
      d = di;
      index = i;
    }
  }
  return { index, d };
}

// Follows one line from (x, y). sign = +1 runs with the field, -1 against it.
// Returns { points: [x0, y0, x1, y1, ...], end: 'charge'|'escape'|'stall'|'limit', charge }.
export function traceLine(charges, mode, x, y, sign, bounds, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const points = [x, y];
  const e = [0, 0];
  const dir = (px, py, out) => {
    fieldAt(charges, mode, px, py, e);
    const m = Math.hypot(e[0], e[1]);
    if (!(m > 1e-12)) return false;
    out[0] = (sign * e[0]) / m;
    out[1] = (sign * e[1]) / m;
    return true;
  };
  const k1 = [0, 0];
  const k2 = [0, 0];
  const k3 = [0, 0];
  const k4 = [0, 0];
  let length = 0;
  for (let n = 0; n < o.maxSteps; n++) {
    const near = nearestCharge(charges, x, y);
    // Small steps near charges, where the direction turns fastest; long ones far out.
    const h = Math.min(o.step * 12, Math.max(o.step, 0.25 * near.d));
    if (!dir(x, y, k1)) return { points, end: 'stall', charge: -1 };
    if (!dir(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1], k2)) return { points, end: 'stall', charge: -1 };
    if (!dir(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1], k3)) return { points, end: 'stall', charge: -1 };
    if (!dir(x + h * k3[0], y + h * k3[1], k4)) return { points, end: 'stall', charge: -1 };
    const sx = (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    const sy = (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    // A step that turns back on itself means the line has run into a null point.
    if (k1[0] * k4[0] + k1[1] * k4[1] < -0.5) return { points, end: 'stall', charge: -1 };
    x += sx;
    y += sy;
    length += h;
    points.push(x, y);
    const hit = nearestCharge(charges, x, y);
    if (n > 2 && hit.d < Math.max(o.endRadius, 0.6 * h)) {
      const c = charges[hit.index];
      points.push(c.x, c.y);
      return { points, end: 'charge', charge: hit.index };
    }
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) {
      return { points, end: 'escape', charge: -1 };
    }
    if (length > o.maxLength) return { points, end: 'limit', charge: -1 };
  }
  return { points, end: 'limit', charge: -1 };
}

// Traces every line of the picture. `bounds` is the region lines may wander
// in before they count as escaped; it should be wider than the view so lines
// that swing out and come back are not cut.
export function traceAll(charges, mode, bounds, options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (charges.length === 0) return [];
  const { pos, neg } = totalCharge(charges);
  const sign = pos >= neg ? 1 : -1;
  const lines = [];
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (Math.sign(c.q) !== sign) continue;
    const n = seedCount(c.q, o.density);
    const phase = seedPhase(charges, i);
    for (let k = 0; k < n; k++) {
      const a = phase + (2 * Math.PI * k) / n;
      const x = c.x + o.startRadius * Math.cos(a);
      const y = c.y + o.startRadius * Math.sin(a);
      const line = traceLine(charges, mode, x, y, sign, bounds, o);
      line.points.unshift(c.x, c.y);
      line.source = i;
      // Lines are always stored running with the field, positive to negative.
      if (sign < 0) line.points = reversePoints(line.points);
      lines.push(line);
    }
  }
  return lines;
}

export function reversePoints(points) {
  const out = new Array(points.length);
  for (let i = 0, n = points.length; i < n; i += 2) {
    out[n - 2 - i] = points[i];
    out[n - 1 - i] = points[i + 1];
  }
  return out;
}

// How many traced lines end on each charge (or start there, for lines
// seeded from negative charges), how many run off to infinity, and how many
// stop at a null point, where the field gives them no direction.
export function lineTally(lines, count) {
  const ends = new Array(count).fill(0);
  let open = 0;
  let stalled = 0;
  for (const l of lines) {
    if (l.end === 'charge') ends[l.charge]++;
    else if (l.end === 'stall') stalled++;
    else open++;
  }
  return { ends, open, stalled };
}
