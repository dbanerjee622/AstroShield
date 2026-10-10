import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { round } from '../sim/math.js';
import { state } from '../state.js';
import { toast } from './notify.js';

const $ = id => document.getElementById(id);

const SLIDERS = [
  ['timeScale', v => v + '×'],
  ['maxDebris', v => String(v)],
  ['spawnPerSec', v => v.toFixed(2) + ' /s'],
  ['threatFraction', v => Math.round(v * 100) + '%'],
  ['speedMax', v => v + ' m/s'],
  ['gravityScale', v => v === 0 ? 'off' : v.toFixed(1) + '×'],
  ['sensorInterval', v => v.toFixed(1) + ' s'],
  ['sensorNoise', v => v.toFixed(1) + ' m']
];
const TOGGLES = [['t-truth', 'truth'], ['t-yours', 'yours'], ['t-trails', 'trails'], ['t-zone', 'zone'], ['t-labels', 'labels'], ['t-orbits', 'orbits']];

/* Wires up the settings rail, top bar buttons, sensor feed and 3D picking. */
export function bindControls({ sim, stage, debris, hud, onRestart }) {
  for (const [key, fmt] of SLIDERS) {
    const el = $('c-' + key), out = $('v-' + key);
    el.value = CONFIG[key];
    const upd = () => { CONFIG[key] = parseFloat(el.value); out.textContent = fmt(CONFIG[key]); };
    el.addEventListener('input', upd); upd();
  }
  for (const [id, key] of TOGGLES) {
    const el = $(id); el.checked = state.show[key];
    el.addEventListener('change', () => { state.show[key] = el.checked; hud.refresh(); });
  }
  $('t-rotate').addEventListener('change', e => { stage.controls.autoRotate = e.target.checked; });

  function setRunning(r) { state.running = r; $('btn-play').textContent = r ? 'Pause' : 'Play'; }
  $('btn-play').addEventListener('click', () => setRunning(!state.running));
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !/INPUT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); setRunning(!state.running);
    }
  });

  $('btn-reset').addEventListener('click', () => {
    CONFIG.seed = $('seed').value.trim() || 'aaron';
    sim.reset(CONFIG.seed); onRestart(); setRunning(true);
    toast('Restarted with seed "' + CONFIG.seed + '"');
  });
  $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-reset').click(); });
  $('btn-log').addEventListener('click', () => {
    console.log('Sensor data at t =', round(sim.time, 2), 's');
    console.log(JSON.stringify(sim.getSensorData(), null, 2));
    toast('Logged to the browser console');
  });

  // mobile: the side rails become bottom sheets
  $('btn-controls').addEventListener('click', () => {
    document.body.classList.toggle('show-controls'); document.body.classList.remove('show-feed');
  });
  $('btn-feed').addEventListener('click', () => {
    document.body.classList.toggle('show-feed'); document.body.classList.remove('show-controls');
  });

  $('feed-list').addEventListener('click', e => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    state.selectedId = Number(row.dataset.id); hud.refresh();
  });
  $('detail').addEventListener('click', e => {
    if (e.target.closest('[data-act="deselect"]')) { state.selectedId = null; hud.refresh(); }
  });

  /* click debris in 3D (ignore drags) */
  const canvas = stage.renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    const hits = ray.intersectObjects([...debris.items.values()].map(v => v.mesh));
    state.selectedId = hits.length ? hits[0].object.userData.id : null;
    hud.refresh();
  });
}
