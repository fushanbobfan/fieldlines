// Picture settings: defaults, clamping, and share links.

import { MODES } from './field.js';
import { SCENES, sceneCharges } from './scenes.js';

export const VIEW_HALF = { x: 8, y: 4.5 };
export const MAX_CHARGES = 24;
export const CHARGE = { min: 0.25, max: 5, step: 0.25 };

export const RANGES = {
  density: { min: 2, max: 20, step: 1 },
  step: { min: 0.05, max: 2, step: 0.05 },
  radius: { min: 0.25, max: 6, step: 0.05 },
};

export const LAYERS = { lines: 'l', contours: 'e', potential: 'p', nulls: 'n' };

export function defaults(scene = 'dipole') {
  const name = Object.hasOwn(SCENES, scene) ? scene : 'dipole';
  return {
    scene: name,
    mode: 'point',
    charges: sceneCharges(name),
    density: 8,
    step: 0.25,
    layers: { lines: true, contours: true, potential: true, nulls: true },
    gauss: { on: false, x: 0, y: 0, r: 2 },
  };
}

function snap(value, { min, max, step }, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Number((Math.round(v / step) * step).toFixed(4))));
}

export function clampCharge(c) {
  const x = Number(c?.x);
  const y = Number(c?.y);
  const q = Number(c?.q);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(q) || q === 0) return null;
  const mag = snap(Math.abs(q), CHARGE, CHARGE.min);
  const pos = (v, half) => Math.round(Math.min(half - 0.25, Math.max(-half + 0.25, v)) * 100) / 100;
  return { x: pos(x, VIEW_HALF.x), y: pos(y, VIEW_HALF.y), q: Math.sign(q) * mag };
}

export function clampGauss(g, fallback) {
  const centre = clampCharge({ x: g?.x, y: g?.y, q: 1 });
  return {
    on: typeof g?.on === 'boolean' ? g.on : fallback.on,
    x: centre ? centre.x : fallback.x,
    y: centre ? centre.y : fallback.y,
    r: snap(g?.r, RANGES.radius, fallback.r),
  };
}

export function clampSettings(s) {
  const base = defaults(s?.scene);
  const charges = Array.isArray(s?.charges) ? s.charges.map(clampCharge).filter(Boolean).slice(0, MAX_CHARGES) : base.charges;
  const layers = { ...base.layers };
  for (const k of Object.keys(LAYERS)) if (typeof s?.layers?.[k] === 'boolean') layers[k] = s.layers[k];
  return {
    scene: base.scene,
    mode: MODES.includes(s?.mode) ? s.mode : base.mode,
    charges,
    density: snap(s?.density, RANGES.density, base.density),
    step: snap(s?.step, RANGES.step, base.step),
    layers,
    gauss: clampGauss(s?.gauss, base.gauss),
  };
}

const num = (v) => String(Number(v.toFixed(2)));

export function encodeCharges(charges) {
  return charges.map((c) => `${num(c.x)},${num(c.y)},${num(c.q)}`).join(';');
}

export function decodeCharges(text) {
  if (typeof text !== 'string' || text === '') return [];
  return text
    .split(';')
    .map((part) => {
      const [x, y, q] = part.split(',').map(Number);
      return clampCharge({ x, y, q });
    })
    .filter(Boolean)
    .slice(0, MAX_CHARGES);
}

const sameCharges = (a, b) =>
  a.length === b.length && a.every((c, i) => c.x === b[i].x && c.y === b[i].y && c.q === b[i].q);

// Query string holding only what differs from the scene's defaults.
export function toHash(settings) {
  const s = clampSettings(settings);
  const base = defaults(s.scene);
  const p = new URLSearchParams();
  p.set('s', s.scene);
  if (s.mode !== base.mode) p.set('m', s.mode);
  if (!sameCharges(s.charges, base.charges)) p.set('c', encodeCharges(s.charges));
  if (s.density !== base.density) p.set('d', String(s.density));
  if (s.step !== base.step) p.set('v', String(s.step));
  const flags = Object.entries(LAYERS)
    .filter(([k]) => s.layers[k])
    .map(([, f]) => f)
    .join('');
  if (Object.keys(LAYERS).some((k) => s.layers[k] !== base.layers[k])) p.set('f', flags || '-');
  if (s.gauss.on) p.set('g', `${num(s.gauss.x)},${num(s.gauss.y)},${num(s.gauss.r)}`);
  return p.toString();
}

export function fromHash(hash) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const base = defaults(p.get('s') ?? 'dipole');
  const s = { ...base };
  if (p.has('m')) s.mode = p.get('m');
  if (p.has('c')) s.charges = decodeCharges(p.get('c'));
  if (p.has('d')) s.density = p.get('d');
  if (p.has('v')) s.step = p.get('v');
  if (p.has('f')) {
    const f = p.get('f');
    s.layers = Object.fromEntries(Object.entries(LAYERS).map(([k, letter]) => [k, f.includes(letter)]));
  }
  if (p.has('g')) {
    const [x, y, r] = p.get('g').split(',').map(Number);
    s.gauss = { on: true, x, y, r };
  }
  return clampSettings(s);
}
