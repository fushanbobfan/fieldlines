import test from 'node:test';
import assert from 'node:assert/strict';
import { makeView, potentialColor, polylineLength, arrowMarks, formatNumber, paintPotential, chargeRadius } from '../src/render.js';

test('makeView fits the 16 x 9 world and inverts cleanly', () => {
  const v = makeView(1600, 900);
  assert.equal(v.scale, 100);
  assert.deepEqual(v.toScreen(0, 0), [800, 450]);
  assert.deepEqual(v.toScreen(1, 1), [900, 350]);
  assert.deepEqual(v.toWorld(900, 350), [1, 1]);
  const tall = makeView(400, 800);
  assert.equal(tall.scale, 25);
  assert.equal(tall.y1, 16);
  assert.equal(tall.x1, 8);
});

test('potentialColor is background at zero and warms or cools with the sign', () => {
  assert.deepEqual(potentialColor(0, 1), [11, 15, 23]);
  const hot = potentialColor(5, 1);
  const cold = potentialColor(-5, 1);
  assert.ok(hot[0] > hot[2]);
  assert.ok(cold[2] > cold[0]);
  const warmer = potentialColor(1, 1);
  assert.ok(hot[0] > warmer[0]);
});

test('polylineLength sums the segments', () => {
  assert.equal(polylineLength([0, 0, 3, 4, 3, 10]), 11);
  assert.equal(polylineLength([1, 1]), 0);
});

test('arrowMarks spaces arrows evenly along the visible part of a line', () => {
  const box = { x0: -10, x1: 10, y0: -10, y1: 10 };
  const line = [0, 0, 2, 0, 4, 0, 6, 0];
  const marks = arrowMarks(line, 2, box);
  assert.deepEqual(marks.map((m) => m.x), [1, 3, 5]);
  assert.ok(marks.every((m) => m.y === 0 && m.angle === 0));
  // Short line: one arrow at its middle.
  assert.deepEqual(arrowMarks([0, 0, 0, 1], 3, box).map((m) => [m.x, m.y]), [[0, 0.5]]);
  // Pointing down the y axis.
  assert.ok(Math.abs(arrowMarks([0, 1, 0, 0], 3, box)[0].angle + Math.PI / 2) < 1e-12);
});

test('arrowMarks ignores the stretch outside the box', () => {
  const box = { x0: -1, x1: 1, y0: -1, y1: 1 };
  const line = [0, 0, 0.5, 0, 1, 0, 5, 0, 50, 0];
  const marks = arrowMarks(line, 3, box);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].x, 0.5);
  assert.deepEqual(arrowMarks([5, 5, 6, 6], 1, box), []);
});

test('formatNumber keeps readings short', () => {
  assert.equal(formatNumber(1.23456), '1.235');
  assert.equal(formatNumber(-0.5), '−0.500');
  assert.equal(formatNumber(123.456), '123.5');
  assert.equal(formatNumber(0), '0.000');
  assert.equal(formatNumber(12345), '1.23×10^4');
  assert.equal(formatNumber(Infinity), '–');
});

test('paintPotential flips rows so the top of the image is the top of the world', () => {
  const image = { data: new Uint8ClampedArray(2 * 2 * 4) };
  paintPotential(image, [-5, -5, 5, 5], 2, 2, 1);
  // Grid row 1 (y high, positive) lands in image row 0: warm.
  assert.ok(image.data[0] > image.data[2]);
  assert.ok(image.data[8 + 2] > image.data[8]);
  assert.equal(image.data[3], 255);
});

test('bigger charges get bigger discs', () => {
  assert.ok(chargeRadius(4) > chargeRadius(1));
  assert.equal(chargeRadius(-1), chargeRadius(1));
});
