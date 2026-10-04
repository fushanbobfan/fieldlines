// Electric field and potential of a set of charges, in units with the
// Coulomb constant set to 1.
//
// Two geometries share the same plane picture:
//   'point' - point charges in 3D space, seen in the plane through them:
//             E = q r / |r|^3, V = q / |r|.
//   'line'  - infinite charged rods crossing the plane at right angles
//             (2D electrostatics): E = q r / |r|^2, V = -q ln |r|.
// In 'line' mode Gauss's law holds inside the plane itself, so the number of
// field lines that leave a charge is a faithful measure of its flux.

export const MODES = ['point', 'line'];

const SOFT = 1e-12;

export function fieldAt(charges, mode, x, y, out = [0, 0]) {
  let ex = 0;
  let ey = 0;
  const line = mode === 'line';
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + SOFT;
    const f = line ? c.q / r2 : c.q / (r2 * Math.sqrt(r2));
    ex += f * dx;
    ey += f * dy;
  }
  out[0] = ex;
  out[1] = ey;
  return out;
}

export function potentialAt(charges, mode, x, y) {
  let v = 0;
  const line = mode === 'line';
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + SOFT;
    v += line ? -0.5 * c.q * Math.log(r2) : c.q / Math.sqrt(r2);
  }
  return v;
}

// Potential sampled on an nx-by-ny grid spanning [x0, x1] x [y0, y1],
// row-major with row 0 at y0.
export function potentialGrid(charges, mode, { x0, x1, y0, y1 }, nx, ny) {
  const grid = new Float64Array(nx * ny);
  const dx = (x1 - x0) / (nx - 1);
  const dy = (y1 - y0) / (ny - 1);
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * dy;
    for (let i = 0; i < nx; i++) grid[j * nx + i] = potentialAt(charges, mode, x0 + i * dx, y);
  }
  return grid;
}

export function totalCharge(charges) {
  let pos = 0;
  let neg = 0;
  for (const c of charges) {
    if (c.q > 0) pos += c.q;
    else neg -= c.q;
  }
  return { pos, neg, net: pos - neg };
}
