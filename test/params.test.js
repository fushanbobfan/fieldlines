import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  clampSettings,
  clampCharge,
  encodeCharges,
  decodeCharges,
  toHash,
  fromHash,
  MAX_CHARGES,
} from '../src/params.js';
import { SCENES, SCENE_ORDER, sceneCharges } from '../src/scenes.js';

test('every scene is listed once and its charges survive clamping unchanged', () => {
  assert.deepEqual([...SCENE_ORDER].sort(), Object.keys(SCENES).sort());
  for (const name of SCENE_ORDER) {
    const charges = sceneCharges(name);
    assert.deepEqual(charges.map(clampCharge), charges, name);
    assert.ok(charges.length <= MAX_CHARGES, name);
  }
});

test('sceneCharges hands out copies', () => {
  const a = sceneCharges('dipole');
  a[0].x = 99;
  assert.equal(sceneCharges('dipole')[0].x, -1.5);
});

test('clampCharge snaps the size, keeps the sign and holds the charge inside the view', () => {
  assert.deepEqual(clampCharge({ x: 20, y: -0.123, q: -1.3 }), { x: 7.75, y: -0.12, q: -1.25 });
  assert.deepEqual(clampCharge({ x: 0, y: 0, q: 0.01 }), { x: 0, y: 0, q: 0.25 });
  assert.deepEqual(clampCharge({ x: 0, y: 0, q: 40 }), { x: 0, y: 0, q: 5 });
  assert.equal(clampCharge({ x: 0, y: 0, q: 0 }), null);
  assert.equal(clampCharge({ x: 'a', y: 0, q: 1 }), null);
});

test('clampSettings falls back to defaults for junk and caps the charge count', () => {
  const s = clampSettings({ scene: 'nope', mode: 'cube', density: 'x', step: 99, layers: { lines: false, nulls: 3 } });
  assert.equal(s.scene, 'dipole');
  assert.equal(s.mode, 'point');
  assert.equal(s.density, 8);
  assert.equal(s.step, 2);
  assert.deepEqual(s.layers, { lines: false, contours: true, potential: true, nulls: true });
  const many = Array.from({ length: 40 }, (_, i) => ({ x: i / 10, y: 0, q: 1 }));
  assert.equal(clampSettings({ charges: many }).charges.length, MAX_CHARGES);
});

test('charges round-trip through their text form', () => {
  const charges = [{ x: -1.5, y: 0.25, q: 2 }, { x: 3, y: -4, q: -0.75 }];
  assert.equal(encodeCharges(charges), '-1.5,0.25,2;3,-4,-0.75');
  assert.deepEqual(decodeCharges(encodeCharges(charges)), charges);
  assert.deepEqual(decodeCharges('1,2;x,y,z;0,0,0'), []);
  assert.deepEqual(decodeCharges(''), []);
});

test('a share link keeps only what differs from the scene', () => {
  assert.equal(toHash(defaults('pair')), 's=pair');
  const s = defaults('dipole');
  s.mode = 'line';
  s.density = 12;
  s.layers.potential = false;
  s.charges[1].y = 1;
  const hash = toHash(s);
  assert.equal(hash, 's=dipole&m=line&c=-1.5%2C0%2C1%3B1.5%2C1%2C-1&d=12&f=len');
  assert.deepEqual(fromHash('#' + hash), clampSettings(s));
});

test('an empty plane and all layers off survive the round trip', () => {
  const s = defaults('capacitor');
  s.charges = [];
  s.layers = { lines: false, contours: false, potential: false, nulls: false };
  const back = fromHash(toHash(s));
  assert.deepEqual(back.charges, []);
  assert.deepEqual(back.layers, s.layers);
});

test('fromHash tolerates garbage', () => {
  assert.deepEqual(fromHash(''), defaults('dipole'));
  assert.deepEqual(fromHash('#s=ring&d=abc&v=-4'), { ...defaults('ring'), step: 0.05 });
});
