// Starting arrangements. Coordinates are in world units; the view spans
// 16 by 9 units centred on the origin.

const row = (n, x0, x1, y, q) =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y, q }));

const ring = (n, r, q, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / n;
    return { x: Number((r * Math.cos(a)).toFixed(2)), y: Number((r * Math.sin(a)).toFixed(2)), q };
  });

export const SCENES = {
  dipole: {
    label: 'Dipole',
    note: 'Equal and opposite charges. Every line that leaves the positive charge lands on the negative one, except the one fired straight backwards.',
    charges: [{ x: -1.5, y: 0, q: 1 }, { x: 1.5, y: 0, q: -1 }],
  },
  pair: {
    label: 'Like pair',
    note: 'Two positive charges push their lines apart. Halfway between them the fields cancel: a null point, marked with a cross.',
    charges: [{ x: -1.5, y: 0, q: 1 }, { x: 1.5, y: 0, q: 1 }],
  },
  unequal: {
    label: 'Unequal pair',
    note: 'A +2 and a −1. Only part of the bigger charge’s flux lands on the smaller one; the rest escapes. The null point now sits outside, beyond the weaker charge.',
    charges: [{ x: -1, y: 0, q: 2 }, { x: 1, y: 0, q: -1 }],
  },
  single: {
    label: 'Single charge',
    note: 'Lines run straight out and equipotentials are circles. In point mode the circles crowd towards the charge (V = q/r); in line mode their radii grow geometrically (V = −q ln r).',
    charges: [{ x: 0, y: 0, q: 1 }],
  },
  quadrupole: {
    label: 'Quadrupole',
    note: 'Alternating charges on a square. The field dies away fast with distance, and the zero-potential lines cross at the centre.',
    charges: [
      { x: -1.5, y: 1.5, q: 1 },
      { x: 1.5, y: 1.5, q: -1 },
      { x: 1.5, y: -1.5, q: 1 },
      { x: -1.5, y: -1.5, q: -1 },
    ],
  },
  capacitor: {
    label: 'Parallel plates',
    note: 'Two rows of opposite charges. Between them the lines run nearly straight and evenly spaced and the equipotentials are flat: a uniform field. At the ends it bulges out as fringe field.',
    charges: [...row(9, -4, 4, 1.25, 0.5), ...row(9, -4, 4, -1.25, -0.5)],
  },
  triangle: {
    label: 'Triangle',
    note: 'Three like charges. Their fields cancel at the centre. For point charges three more null points sit between the centre and the sides; switch to line charges and they merge into the centre.',
    charges: ring(3, 2, 1, Math.PI / 2),
  },
  ring: {
    label: 'Ring and core',
    note: 'A ring of negative charge around a positive core of equal total charge. Outside the ring the fields nearly cancel; inside, the lines run from the core to the ring.',
    charges: [{ x: 0, y: 0, q: 3 }, ...ring(12, 2.5, -0.25)],
  },
  empty: {
    label: 'Empty plane',
    note: 'Click to place charges. Pick the sign and size first, then drag charges around.',
    charges: [],
  },
};

export const SCENE_ORDER = ['dipole', 'pair', 'unequal', 'single', 'quadrupole', 'capacitor', 'triangle', 'ring', 'empty'];

export function sceneCharges(name) {
  const scene = SCENES[name] ?? SCENES.dipole;
  return scene.charges.map((c) => ({ ...c }));
}
