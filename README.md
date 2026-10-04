# fieldlines

Electric field lines and equipotentials in the browser. Place charges,
drag them around, and watch the field reshape around them: lines that
show which way a positive test charge is pushed, equipotentials where it
takes no work to move, and crosses at the null points where every push
cancels.

**Live demo:** https://fushanbobfan.github.io/fieldlines/

No build step and no dependencies. The field, the line tracer, the
equipotentials, the null-point finder, the scenes and the settings are
plain ES modules covered by a Node test suite; only `src/main.js` touches
the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Dipole.** The page opens on a +1 and a −1. Seven of the eight lines
leaving the positive charge land on the negative one; the eighth leaves
straight backwards along the axis and never returns. Drag the negative
charge around and the lines follow it.

**Like pair.** Two positive charges push their lines apart. Halfway
between them the fields cancel, and the line aimed along the axis stops
there. The tally under the picture counts it as stopping at a null point.

**Unequal pair.** A +2 and a −1, 2 units apart. Only part of the +2's
lines land on the −1 and the rest escape. The null point moves outside
the pair, beyond the weaker charge: 6.83 units from the +2 for point
charges (where 2/r² = 1/(r − 2)²), but only 4 units for line charges
(where 2/r = 1/(r − 2)), because a line charge's field fades more slowly.

**Parallel plates.** Two rows of opposite charges. Between them the lines
run straight and evenly spaced and the equipotentials are flat. Switch to
line charges and a small null point appears just outside each gap between
neighbouring charges, where a row's own push away from itself balances
the pull of the other row.

**Triangle.** Three like charges. Their fields cancel at the centre. For
point charges three more null points sit between the centre and the
sides; for line charges they merge into the centre.

**Point or line charges.** The switch changes what the dots stand for.
Point charges are charges in space seen in the plane through them, with
field q/r² and potential q/r. Line charges are infinite charged rods
crossing the page, with field q/r and potential −q ln r. Only for line
charges does Gauss's law hold inside the plane, so only there is the
number of lines on a charge an exact measure of its flux: switch the
unequal pair to line charges and close to half the +2's lines land on the
−1.

## Controls

- Click empty space to place a charge with the chosen sign and size.
- Drag a charge to move it. Right-click or Shift-click removes it.
- With the picture focused: arrow keys move the selected charge (Shift for
  bigger steps), `[` and `]` shrink and grow it, `F` flips its sign,
  `Delete` removes it, `.` selects the next one, `Escape` deselects, `M`
  switches between point and line charges.
- The size slider sets the size of new charges, or of the selected one.
- Lines per unit charge sets the line density; the potential step sets the
  potential difference between neighbouring equipotentials, so they crowd
  where the field is strong.
- Copy link saves the whole picture in the address; Save PNG downloads it.

## How it works

The field and potential are summed over the charges directly
(`src/field.js`). Units set the Coulomb constant to 1.

Field lines (`src/lines.js`) start on whichever sign holds more charge,
evenly spaced around each charge with a count proportional to it, the
first one aimed at the nearest charge of the other sign. Each line is
followed along the unit field direction with fourth-order Runge–Kutta,
with steps that shrink near charges and grow far from them. A line stops
when it reaches a charge, wanders far outside the view, or turns back on
itself at a null point.

Equipotentials (`src/contours.js`) come from marching squares over the
potential sampled every few pixels, at every multiple of the chosen step
between the 2nd and 98th percentiles of the sampled values, so the
infinite spikes at the charges do not swamp the levels.

Null points (`src/neutral.js`) are found by starting Newton's method on
the field from every local minimum of the field strength on a coarse grid.
The Jacobian comes from finite differences. A null where the field grows
faster than linearly (the centre of four like line charges on a square,
where it grows as r³) has a singular Jacobian, so the residual, not the
step size, decides whether a point counts.

## Accessibility

The picture is keyboard operable: focus it with Tab, then select, move,
resize, flip and remove charges with the keys above. The status line and
the line tally are plain text under the picture, and the status line is
announced when it changes. Every control is a native input with a label.

## License

MIT
