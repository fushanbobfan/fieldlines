// Gauss's law, checked numerically. The surface is a circle in the plane:
// for line charges it is a closed loop and the flux through it is
// 2*pi times the charge inside; for point charges it is the equator of a
// sphere and the flux through that sphere is 4*pi times the charge inside.
// The flux is computed by quadrature of E . n, charge by charge, so the
// readout can show that charges outside add nothing to the total.

const LOOP_POINTS = 1024;
const SPHERE_POLAR = 48;
const SPHERE_AZIMUTH = 192;

export const FACTOR = { line: 2 * Math.PI, point: 4 * Math.PI };

// Gauss-Legendre nodes and weights on [-1, 1], by Newton's method on P_n.
export function gaussLegendre(n) {
  const nodes = new Float64Array(n);
  const weights = new Float64Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let x = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p0 = 1;
      let p1 = x;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (x * p1 - p0)) / (x * x - 1);
      const dx = p1 / dp;
      x -= dx;
      if (Math.abs(dx) < 1e-15) break;
    }
    const w = 2 / ((1 - x * x) * dp * dp);
    nodes[i] = -x;
    nodes[n - 1 - i] = x;
    weights[i] = w;
    weights[n - 1 - i] = w;
  }
  return { nodes, weights };
}

let sphereRule = null;

function loopFlux(c, { x, y, r }) {
  let flux = 0;
  for (let k = 0; k < LOOP_POINTS; k++) {
    const a = (2 * Math.PI * k) / LOOP_POINTS;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const dx = x + r * nx - c.x;
    const dy = y + r * ny - c.y;
    flux += (c.q * (dx * nx + dy * ny)) / (dx * dx + dy * dy);
  }
  return (flux * 2 * Math.PI * r) / LOOP_POINTS;
}

// The charges lie in the plane, so both hemispheres carry the same flux.
// Integrating over the upper one with the rule mapped onto [0, 1] puts the
// densest nodes at the equator, which is where charges near the surface
// make the integrand sharp.
function sphereFlux(c, { x, y, r }) {
  sphereRule ??= gaussLegendre(SPHERE_POLAR);
  const { nodes, weights } = sphereRule;
  let flux = 0;
  for (let i = 0; i < SPHERE_POLAR; i++) {
    const u = (nodes[i] + 1) / 2; // cos of the polar angle
    const s = Math.sqrt(1 - u * u);
    let ring = 0;
    for (let k = 0; k < SPHERE_AZIMUTH; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / SPHERE_AZIMUTH;
      const nx = s * Math.cos(a);
      const ny = s * Math.sin(a);
      const dx = x + r * nx - c.x;
      const dy = y + r * ny - c.y;
      const dz = r * u;
      const d2 = dx * dx + dy * dy + dz * dz;
      ring += (c.q * (dx * nx + dy * ny + dz * u)) / (d2 * Math.sqrt(d2));
    }
    flux += weights[i] * ring;
  }
  return (flux * r * r * 2 * Math.PI) / SPHERE_AZIMUTH;
}

// Flux of each charge's field out through the surface.
export function fluxPerCharge(charges, mode, surface) {
  return charges.map((c) => (mode === 'line' ? loopFlux(c, surface) : sphereFlux(c, surface)));
}

// Charges closer to the surface than this make the integrand too sharp
// for the fixed quadrature to be trusted to three decimals.
export const NEAR = 0.1;

export function gaussReport(charges, mode, surface) {
  const per = fluxPerCharge(charges, mode, surface);
  let enclosed = 0;
  let fluxInside = 0;
  let fluxOutside = 0;
  let inside = 0;
  let near = 0;
  charges.forEach((c, i) => {
    const d = Math.hypot(c.x - surface.x, c.y - surface.y);
    if (Math.abs(d - surface.r) < NEAR) near++;
    if (d < surface.r) {
      enclosed += c.q;
      fluxInside += per[i];
      inside++;
    } else {
      fluxOutside += per[i];
    }
  });
  const flux = fluxInside + fluxOutside;
  return { flux, factor: FACTOR[mode], enclosed, inside, fluxInside, fluxOutside, near };
}

// Sign of E . n around the drawn circle, for colouring it: +1 where the
// field leaves, -1 where it enters. In point mode the circle is the
// sphere's equator, where the normal lies in the plane, so the same test holds.
export function outwardSigns(charges, surface, mode, segments = 180) {
  const signs = new Int8Array(segments);
  for (let k = 0; k < segments; k++) {
    const a = (2 * Math.PI * (k + 0.5)) / segments;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const px = surface.x + surface.r * nx;
    const py = surface.y + surface.r * ny;
    let en = 0;
    for (const c of charges) {
      const dx = px - c.x;
      const dy = py - c.y;
      const r2 = dx * dx + dy * dy;
      const f = mode === 'line' ? c.q / r2 : c.q / (r2 * Math.sqrt(r2));
      en += f * (dx * nx + dy * ny);
    }
    signs[k] = en > 0 ? 1 : en < 0 ? -1 : 0;
  }
  return signs;
}
