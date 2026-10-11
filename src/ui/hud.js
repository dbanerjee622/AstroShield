import { Vector3 as V3 } from 'three';
import { CONFIG } from '../config.js';
import { BODIES, BODY_COLORS, gravityParts } from '../sim/bodies.js';
import { state } from '../state.js';
import { tag, f1, vmag, fmtMass, fmtTime, fmtSci, fmtPeriod, fmtForce, escapeHtml } from './format.js';

const $ = id => document.getElementById(id);

function lastRange(d) { const p = d.sensorPoints[d.sensorPoints.length - 1]; return Math.hypot(p.x, p.y, p.z); }

function fitClass(v) {
  if (v.codeError) return 'err';
  if (!v.prediction || v.predError == null) return '';
  const tol = Math.max(5, CONFIG.sensorNoise * 2);
  return v.predError < tol ? 'good' : v.predError < tol * 6 ? 'ok' : 'bad';
}

function verdict(sim, d) {
  const ca = sim.coast(d.pos, d.vel, { maxT: 180, radius: d.radius });
  if (ca.end === 'hit') return { hit: true, text: `Will hit the rocket in ${f1(ca.t)} s`, cls: 'verdict-hit' };
  if (ca.end === 'body') return { text: `Crashes into ${ca.body.name} in ${f1(ca.t)} s`, cls: 'verdict-miss' };
  if (ca.tMin <= 0.06) return { text: 'Moving away from the rocket', cls: 'verdict-miss' };
  return { text: `Misses by ${f1(ca.minDist)} m in ${f1(ca.tMin)} s`, cls: 'verdict-miss' };
}

const swatch = name => `<span class="swatch" style="background:${BODY_COLORS[name]}"></span> ${name}`;

function gravityTable(d) {
  let h = `<div class="subh">Gravity on this piece</div>`;
  if (!CONFIG.gravityScale) return h + '<div class="msg">Gravity is off. Turn up "Gravity strength" to see the pull from each body.</div>';
  const parts = gravityParts(d, CONFIG.gravityScale);
  const total = parts.reduce((acc, p) => acc.addScaledVector(p.dir, p.a), new V3()).length();
  h += `<div class="pts-wrap"><table class="pts grav"><thead><tr><th>Body</th><th>Distance</th><th>Pull</th><th>Force</th></tr></thead><tbody>` +
    parts.map(p => `<tr><td>${swatch(p.b.name)}</td><td>${(p.r / 1000).toFixed(2)} km</td><td>${p.a.toFixed(2)} m/s²</td><td>${fmtForce(p.F)}</td></tr>`).join('') +
    `<tr class="total"><td>Total</td><td></td><td>${total.toFixed(2)} m/s²</td><td>${fmtForce(total * d.mass)}</td></tr></tbody></table></div>
    <p class="hint small">Force = mass × pull. The total is less than the sum because the pulls point in different directions and partly cancel. The arrows in the 3D view show each pull; white is the total.</p>`;
  return h;
}

function renderBodyTable() {
  $('bodies-table').innerHTML = '<thead><tr><th>Body</th><th>Mass (kg)</th><th>Radius</th><th>Orbit</th></tr></thead><tbody>' +
    BODIES.map(b => `<tr><td>${swatch(b.name)}</td><td>${fmtSci(b.mass)}</td><td>${b.radius} m</td><td>${b.orbit ? fmtPeriod(b.orbit.period) : '—'}</td></tr>`).join('') +
    '</tbody>';
}

function renderBodyPositions() {
  $('bodies-pos').innerHTML = '<thead><tr><th>Now (m)</th><th>x</th><th>y</th><th>z</th><th>Range</th></tr></thead><tbody>' +
    BODIES.map(b => `<tr><td>${swatch(b.name)}</td><td>${Math.round(b.pos.x)}</td><td>${Math.round(b.pos.y)}</td><td>${Math.round(b.pos.z)}</td><td>${(b.pos.length() / 1000).toFixed(1)} km</td></tr>`).join('') +
    '</tbody>';
}

function renderDetail(v) {
  const d = v.d, pts = d.sensorPoints;
  let html = `<div class="dhead"><span class="tag">${tag(d.id)}</span><button class="x" data-act="deselect" aria-label="Close">×</button></div>
    <dl class="kv">
      <dt>Mass</dt><dd>${fmtMass(d.mass)}</dd>
      <dt>Measured velocity (m/s)</dt><dd>${d.measuredVelocity ? `${f1(d.measuredVelocity.x)}, ${f1(d.measuredVelocity.y)}, ${f1(d.measuredVelocity.z)}` : '—'}</dd>
      <dt>Range at last reading</dt><dd>${pts.length ? f1(lastRange(d)) + ' m' : '—'}</dd>
      <dt>Readings</dt><dd>${pts.length}</dd>
    </dl>`;
  if (pts.length) {
    html += `<div class="subh"><span class="swatch" style="background:var(--fix)"></span>Latest readings</div>
      <div class="pts-wrap"><table class="pts"><thead><tr><th>t (s)</th><th>x</th><th>y</th><th>z</th></tr></thead><tbody>` +
      pts.slice(-6).reverse().map(p => `<tr><td>${p.t.toFixed(2)}</td><td>${f1(p.x)}</td><td>${f1(p.y)}</td><td>${f1(p.z)}</td></tr>`).join('') +
      `</tbody></table></div>`;
  } else {
    html += '<p class="hint">Not in sensor range yet.</p>';
  }
  const s0 = d.start, sv = s0.velocity, sm = vmag(sv);
  html += `<div class="subh">Starting state</div>
    <dl class="kv">
      <dt>Entered at</dt><dd>t = ${s0.t.toFixed(2)} s</dd>
      <dt>Position (m)</dt><dd>${f1(s0.position.x)}, ${f1(s0.position.y)}, ${f1(s0.position.z)}</dd>
      <dt>Velocity (m/s)</dt><dd>${f1(sv.x)}, ${f1(sv.y)}, ${f1(sv.z)}</dd>
      <dt>Direction</dt><dd>${(sv.x / sm).toFixed(3)}, ${(sv.y / sm).toFixed(3)}, ${(sv.z / sm).toFixed(3)}</dd>
      <dt>Starting speed</dt><dd>${f1(sm)} m/s</dd>
    </dl>`;
  html += gravityTable(d);
  html += `<div class="subh"><span class="swatch" style="background:var(--yours)"></span>Your trajectory</div>`;
  if (v.codeError) html += `<div class="msg err">calculateTrajectory() threw an error: ${escapeHtml(v.codeError)}</div>`;
  else if (v.prediction) html += `<div class="msg">Your line is <b class="mono">${f1(v.predError)} m</b> from the debris right now.</div>`;
  else html += `<div class="msg"><code>calculateTrajectory()</code> returned null for this one. Write it in src/trajectory.js and your line shows up here.</div>`;
  if (state.show.truth) {
    const vt = v.verdict;
    html += `<div class="subh"><span class="swatch" style="background:var(--truth)"></span>True answer</div>
      <dl class="kv">
        <dt>Velocity now (m/s)</dt><dd>${f1(d.vel.x)}, ${f1(d.vel.y)}, ${f1(d.vel.z)}</dd>
        <dt>Outcome</dt><dd class="${vt.cls}">${vt.text}</dd>
      </dl>`;
  }
  return html;
}

/* Top bar stats, planet tables, sensor feed and the detail panel. */
export function createHud({ sim, debris, planets }) {
  renderBodyTable();
  renderBodyPositions();

  function refresh() {
    renderBodyPositions();
    planets.refreshLabels();
    $('st-time').textContent = fmtTime(sim.time);
    $('st-field').textContent = sim.debris.length;
    const tracked = sim.debris.filter(d => d.sensorPoints.length).sort((a, b) => lastRange(a) - lastRange(b));
    $('st-tracked').textContent = tracked.length;
    $('st-hits').textContent = sim.hits;
    $('st-deflected').textContent = sim.deflected;
    $('feed-count').textContent = tracked.length;
    for (const v of debris.items.values()) v.verdict = state.show.truth ? verdict(sim, v.d) : null;

    $('feed-list').innerHTML = tracked.length ? tracked.map(d => {
      const v = debris.items.get(d.id); if (!v) return '';
      const threat = !!(v.verdict && v.verdict.hit);
      const fc = fitClass(v);
      const title = v.codeError ? 'Your code threw an error' : v.prediction ? `Off by ${f1(v.predError)} m` : 'No prediction yet';
      return `<div class="feed-row${d.id === state.selectedId ? ' sel' : ''}" data-id="${d.id}" role="button" tabindex="0">
        <span class="id${threat ? ' threat' : ''}">${tag(d.id)}</span>
        <span>${fmtMass(d.mass)}</span>
        <span>${f1(vmag(d.measuredVelocity))}</span>
        <span>${d.sensorPoints.length}</span>
        <span class="fit ${fc}" title="${title}"></span></div>`;
    }).join('') : '<div class="feed-empty">Nothing in sensor range yet. Debris shows up here once it comes inside the sensor sphere.</div>';

    const v = state.selectedId != null ? debris.items.get(state.selectedId) : null;
    $('detail').innerHTML = v ? renderDetail(v) : '<p class="hint">Click a row or a piece of debris to see its raw sensor data.</p>';
  }

  return { refresh };
}
