// Page wiring: settings, pointer and keyboard editing, and redraws.

import { fieldAt, potentialAt, potentialGrid, totalCharge } from './field.js';
import { traceAll, lineTally } from './lines.js';
import { contourLevels, potentialRange, marchingSquares } from './contours.js';
import { findNullPoints } from './neutral.js';
import { SCENES, SCENE_ORDER, sceneCharges } from './scenes.js';
import { RANGES, LAYERS, MAX_CHARGES, CHARGE, clampSettings, clampCharge, toHash, fromHash, defaults } from './params.js';
import {
  makeView,
  paintPotential,
  drawFieldLines,
  drawContours,
  drawCharges,
  drawNulls,
  drawProbe,
  chargeRadius,
  formatNumber,
} from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('plot');
const ctx = canvas.getContext('2d');

const MODE_NOTES = {
  point: 'Point charges in space, seen in the plane through them. Field falls off as 1/r²; the line picture is a slice, so line counts only roughly follow the charge.',
  line: 'Charged rods crossing the page. Field falls off as 1/r and Gauss’s law holds in the plane, so the number of lines on a charge is a true measure of its flux.',
};

let settings = fromHash(location.hash);
let selected = -1;
let newSign = 1;
let newSize = 1;
let drag = null; // { index, dx, dy, pointerId }
let probe = null; // world point under the pointer
let view = makeView(16, 9);
let picture = null; // computed layers for the current settings and size
let pending = false;

// --- computation -------------------------------------------------------------

function compute() {
  const { charges, mode } = settings;
  const box = { x0: view.x0, x1: view.x1, y0: view.y0, y1: view.y1 };
  // One potential sample per few pixels is plenty for shading and contours.
  const nx = Math.max(32, Math.round(view.width / 4));
  const ny = Math.max(18, Math.round(view.height / 4));
  const grid = charges.length ? potentialGrid(charges, mode, box, nx, ny) : new Float64Array(nx * ny);
  const { lo, hi } = potentialRange(grid);
  const contours = contourLevels(settings.step, lo, hi).map((level) => ({ level, segs: marchingSquares(grid, nx, ny, level) }));
  // Lines may wander well beyond the view before they count as escaped.
  const wide = { x0: box.x0 * 6, x1: box.x1 * 6, y0: box.y0 * 6, y1: box.y1 * 6 };
  const lines = traceAll(charges, mode, wide, { density: settings.density });
  const nulls = findNullPoints(charges, mode, box);
  const colorScale = Math.max(Math.abs(lo), Math.abs(hi), settings.step) * 0.6;
  const image = new ImageData(nx, ny);
  paintPotential(image, grid, nx, ny, colorScale);
  picture = { box, nx, ny, contours, lines, nulls, image, bitmap: null };
  createImageBitmap(image).then((bitmap) => {
    if (picture && picture.image === image) {
      picture.bitmap = bitmap;
      draw();
    }
  });
}

// --- drawing -----------------------------------------------------------------

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, view.width, view.height);
  if (!picture) return;
  const { layers } = settings;
  if (layers.potential && picture.bitmap) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(picture.bitmap, 0, 0, view.width, view.height);
  }
  if (layers.contours) drawContours(ctx, view, picture.contours, picture.box, picture.nx, picture.ny);
  if (layers.lines) drawFieldLines(ctx, view, picture.lines);
  if (layers.nulls) drawNulls(ctx, view, picture.nulls);
  drawCharges(ctx, view, settings.charges, selected);
  if (probe && !drag) {
    const [ex, ey] = fieldAt(settings.charges, settings.mode, probe[0], probe[1]);
    drawProbe(ctx, view, probe[0], probe[1], ex, ey);
  }
}

function refresh({ recompute = true, hash = true } = {}) {
  if (recompute) picture = null;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!picture) compute();
    draw();
    updateText();
    if (hash) history.replaceState(null, '', '#' + toHash(settings));
  });
}

// --- text --------------------------------------------------------------------

const signed = (q) => (q > 0 ? '+' : q < 0 ? '−' : '') + String(Math.abs(Number(q.toFixed(2))));

function updateText() {
  const { charges } = settings;
  const { net } = totalCharge(charges);
  const n = charges.length;
  const parts = [n === 1 ? '1 charge' : `${n} charges`];
  if (n) parts.push(`net ${signed(net)}`);
  if (picture) {
    const nulls = picture.nulls.length;
    parts.push(nulls === 1 ? '1 null point in view' : `${nulls} null points in view`);
  }
  $('status').textContent = parts.join(' · ');
  $('tally').textContent = tallyText();
  updateProbeText();
  updateSelectionControls();
}

// Names a group of charges briefly: each one if there are few, else a count.
function describeGroup(group) {
  if (group.length === 1) return `the ${signed(group[0].q)}`;
  if (group.length <= 3) return `the ${group.map((c) => signed(c.q)).join(', ')}`;
  return `the ${group.length} ${group[0].q > 0 ? 'positive' : 'negative'} charges`;
}

function tallyText() {
  if (!picture || !picture.lines.length) return '';
  const { charges } = settings;
  const { ends, open, stalled } = lineTally(picture.lines, charges.length);
  const seeded = new Set(picture.lines.map((l) => l.source));
  const sources = charges.filter((_, i) => seeded.has(i));
  const others = charges.map((c, i) => ({ c, k: ends[i] })).filter((_, i) => !seeded.has(i));
  const out = sources[0].q > 0;
  // Verb agreeing with a count: 1 ends, 2 end.
  const v = (n, plural) => `${n} ${n === 1 ? plural.replace(/^\w+/, (w) => w + 's') : plural}`;
  const verb = out ? 'leave' : 'arrive at';
  const parts = [];
  if (others.length && others.length <= 3) {
    for (const { c, k } of others) parts.push(`${v(k, out ? 'end on' : 'start from')} the ${signed(c.q)}`);
  } else if (others.length) {
    const k = others.reduce((sum, o) => sum + o.k, 0);
    parts.push(`${v(k, out ? 'end on' : 'start from')} ${describeGroup(others.map((o) => o.c))}`);
  }
  if (open) parts.push(`${v(open, out ? 'run off to' : 'come in from')} infinity`);
  if (stalled) parts.push(`${v(stalled, 'stop at')} a null point`);
  return `${picture.lines.length} lines ${verb} ${describeGroup(sources)}: ${parts.join(', ')}.`;
}

function updateProbeText() {
  const el = $('probe');
  if (!probe) return;
  const [x, y] = probe;
  const { charges, mode } = settings;
  const v = potentialAt(charges, mode, x, y);
  const [ex, ey] = fieldAt(charges, mode, x, y);
  const m = Math.hypot(ex, ey);
  const deg = Math.round((Math.atan2(ey, ex) * 180) / Math.PI);
  el.textContent = `At (${formatNumber(x)}, ${formatNumber(y)}): potential V = ${formatNumber(v)}, field |E| = ${formatNumber(m)}` + (m > 0 ? `, pointing ${String(deg).replace('-', '−')}°` : '');
}

function updateSelectionControls() {
  const c = settings.charges[selected];
  $('flip').disabled = !c;
  $('remove').disabled = !c;
  $('size-label').textContent = c ? 'Size of the selected charge' : 'Size of new charges';
  const size = c ? Math.abs(c.q) : newSize;
  $('size').value = String(size);
  $('size-out').textContent = c ? signed(c.q) : String(size);
}

// --- editing -----------------------------------------------------------------

function edited() {
  settings = clampSettings(settings);
  refresh();
}

function chargeAt(px, py) {
  for (let i = settings.charges.length - 1; i >= 0; i--) {
    const c = settings.charges[i];
    const [sx, sy] = view.toScreen(c.x, c.y);
    if (Math.hypot(px - sx, py - sy) <= chargeRadius(c.q) + 3) return i;
  }
  return -1;
}

function removeCharge(i) {
  if (i < 0) return;
  settings.charges.splice(i, 1);
  selected = -1;
  edited();
}

function select(i) {
  selected = i;
  refresh({ recompute: false, hash: false });
}

function localPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  const [px, py] = localPoint(e);
  const hit = chargeAt(px, py);
  if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
    removeCharge(hit);
    return;
  }
  if (e.button !== 0) return;
  canvas.focus();
  let index = hit;
  if (index < 0) {
    if (settings.charges.length >= MAX_CHARGES) {
      $('status').textContent = `At most ${MAX_CHARGES} charges.`;
      return;
    }
    const [x, y] = view.toWorld(px, py);
    const c = clampCharge({ x, y, q: newSign * newSize });
    if (!c) return;
    settings.charges.push(c);
    index = settings.charges.length - 1;
    edited();
  }
  const c = settings.charges[index];
  const [sx, sy] = view.toScreen(c.x, c.y);
  drag = { index, dx: px - sx, dy: py - sy, pointerId: e.pointerId };
  selected = index;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  refresh({ recompute: false, hash: false });
});

canvas.addEventListener('pointermove', (e) => {
  const [px, py] = localPoint(e);
  if (drag && e.pointerId === drag.pointerId) {
    const [x, y] = view.toWorld(px - drag.dx, py - drag.dy);
    const c = clampCharge({ x, y, q: settings.charges[drag.index].q });
    settings.charges[drag.index] = c;
    refresh({ hash: false });
    return;
  }
  probe = view.toWorld(px, py);
  canvas.classList.toggle('over-charge', chargeAt(px, py) >= 0);
  refresh({ recompute: false, hash: false });
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag = null;
  canvas.classList.remove('dragging');
  edited();
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {
  if (drag) return;
  probe = null;
  refresh({ recompute: false, hash: false });
});

function nudge(dx, dy) {
  const c = settings.charges[selected];
  if (!c) return;
  settings.charges[selected] = clampCharge({ x: c.x + dx, y: c.y + dy, q: c.q }) ?? c;
  edited();
}

function resize(delta) {
  const c = settings.charges[selected];
  if (!c) {
    newSize = Math.min(CHARGE.max, Math.max(CHARGE.min, newSize + delta));
    updateSelectionControls();
    return;
  }
  const mag = Math.min(CHARGE.max, Math.max(CHARGE.min, Math.abs(c.q) + delta));
  c.q = Math.sign(c.q) * mag;
  edited();
}

function flip() {
  const c = settings.charges[selected];
  if (!c) return;
  c.q = -c.q;
  edited();
}

canvas.addEventListener('keydown', (e) => {
  const big = e.shiftKey ? 0.5 : 0.1;
  const moves = { ArrowLeft: [-big, 0], ArrowRight: [big, 0], ArrowUp: [0, big], ArrowDown: [0, -big] };
  if (moves[e.key] && selected >= 0) {
    nudge(...moves[e.key]);
  } else if (e.key === '[') {
    resize(-CHARGE.step);
  } else if (e.key === ']') {
    resize(CHARGE.step);
  } else if (e.key === 'f' || e.key === 'F') {
    flip();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    removeCharge(selected);
  } else if (e.key === '.') {
    const n = settings.charges.length;
    if (n) select((selected + 1) % n);
  } else if (e.key === 'Escape') {
    select(-1);
  } else if (e.key === 'm' || e.key === 'M') {
    settings.mode = settings.mode === 'point' ? 'line' : 'point';
    syncControls();
    edited();
  } else {
    return;
  }
  e.preventDefault();
});

// --- controls ----------------------------------------------------------------

function setupSlider(id, key) {
  const input = $(id);
  const r = RANGES[key];
  input.min = r.min;
  input.max = r.max;
  input.step = r.step;
  input.addEventListener('input', () => {
    settings[key] = Number(input.value);
    edited();
    $(`${id}-out`).textContent = String(settings[key]);
  });
}

function syncControls() {
  $('scene').value = settings.scene;
  $('note').textContent = SCENES[settings.scene].note;
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === settings.mode;
  $('mode-note').textContent = MODE_NOTES[settings.mode];
  for (const key of ['density', 'step']) {
    $(key).value = settings[key];
    $(`${key}-out`).textContent = String(settings[key]);
  }
  for (const k of Object.keys(LAYERS)) $(`layer-${k}`).checked = settings.layers[k];
}

for (const name of SCENE_ORDER) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = SCENES[name].label;
  $('scene').append(opt);
}

$('scene').addEventListener('change', () => {
  const keep = settings;
  settings = defaults($('scene').value);
  settings.mode = keep.mode;
  settings.density = keep.density;
  settings.step = keep.step;
  settings.layers = keep.layers;
  selected = -1;
  syncControls();
  edited();
});

for (const r of document.querySelectorAll('input[name="mode"]')) {
  r.addEventListener('change', () => {
    settings.mode = r.value;
    syncControls();
    edited();
  });
}

for (const r of document.querySelectorAll('input[name="sign"]')) {
  r.addEventListener('change', () => {
    newSign = Number(r.value);
  });
}

$('size').addEventListener('input', () => {
  const v = Number($('size').value);
  const c = settings.charges[selected];
  if (c) {
    c.q = Math.sign(c.q) * v;
    edited();
  } else {
    newSize = v;
    updateSelectionControls();
  }
});

$('flip').addEventListener('click', flip);
$('remove').addEventListener('click', () => removeCharge(selected));

$('reset').addEventListener('click', () => {
  settings.charges = sceneCharges(settings.scene);
  selected = -1;
  edited();
});

$('clear').addEventListener('click', () => {
  settings.charges = [];
  selected = -1;
  edited();
});

setupSlider('density', 'density');
setupSlider('step', 'step');

for (const k of Object.keys(LAYERS)) {
  $(`layer-${k}`).addEventListener('change', (e) => {
    settings.layers[k] = e.target.checked;
    refresh({ recompute: false });
  });
}

$('share').addEventListener('click', async () => {
  const url = `${location.href.split('#')[0]}#${toHash(settings)}`;
  try {
    await navigator.clipboard.writeText(url);
    $('status').textContent = 'Link copied.';
  } catch {
    $('status').textContent = url;
  }
});

$('png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fieldlines-${settings.scene}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

window.addEventListener('hashchange', () => {
  if (location.hash.slice(1) === toHash(settings)) return;
  settings = fromHash(location.hash);
  selected = -1;
  syncControls();
  refresh({ hash: false });
});

// --- size ----------------------------------------------------------------------

function fit() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  view = makeView(rect.width, rect.height);
  refresh({ hash: false });
}

new ResizeObserver(fit).observe(canvas.parentElement);
syncControls();
fit();
