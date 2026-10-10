import { CONFIG, SIM_DT } from './config.js';
import { Simulator } from './sim/simulator.js';
import { runUserCode } from './prediction.js';
import { state } from './state.js';
import { createStage } from './render/stage.js';
import { createRocket } from './render/rocket.js';
import { createPlanets } from './render/planets.js';
import { createOverlays } from './render/overlays.js';
import { createDebrisLayer } from './render/debris.js';
import { createHud } from './ui/hud.js';
import { bindControls } from './ui/controls.js';
import { toast, flashScreen } from './ui/notify.js';
import { tag, fmtMass } from './ui/format.js';

const sim = new Simulator(CONFIG);
// handy for poking at things from the browser console
window.sim = sim;
window.CONFIG = CONFIG;

const view = document.getElementById('view');
const labelsLayer = document.getElementById('labels');
const stage = createStage(view);
const rocket = createRocket(stage.scene);
const planets = createPlanets(stage.scene, labelsLayer);
const overlays = createOverlays(stage.scene);
const debris = createDebrisLayer(stage.scene, labelsLayer);
const hud = createHud({ sim, debris, planets });

let acc = 0;
bindControls({ sim, stage, debris, hud, onRestart: () => { acc = 0; } });

function impact(d) {
  flashScreen();
  rocket.flash();
  toast(`Impact: ${tag(d.id)} (${fmtMass(d.mass)}) hit the rocket`, true);
}

function processEvents() {
  for (const e of sim.events) {
    if (e.type === 'reset') { debris.clear(); state.selectedId = null; }
    else if (e.type === 'spawn') debris.add(e.d);
    else if (e.type === 'hit') { debris.remove(e.d.id); impact(e.d); }
    else if (e.type === 'exit') debris.remove(e.d.id);
    else if (e.type === 'crash') { debris.remove(e.d.id); toast(`${tag(e.d.id)} crashed into ${e.body.name}`); }
  }
  sim.events.length = 0;
}

/* =====================================================================
   MAIN LOOP
   ===================================================================== */
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = performance.now(), hudTimer = 0, clock = 0;

function frame(now) {
  const realDt = Math.min(0.1, (now - last) / 1000); last = now; clock += realDt;
  let simDt = 0;
  if (state.running) {
    acc += realDt * CONFIG.timeScale;
    let n = 0;
    while (acc >= SIM_DT && n < 900) { sim.step(SIM_DT); acc -= SIM_DT; simDt += SIM_DT; n++; }
    if (n >= 900) acc = 0;
  }
  processEvents();
  runUserCode(sim, debris.items);

  const w = view.clientWidth, h = view.clientHeight;
  rocket.animate(realDt, clock, reduceMotion);
  debris.update(sim, simDt, stage.camera, w, h);
  planets.update(simDt, stage.camera, w, h);
  const sel = state.selectedId != null ? debris.items.get(state.selectedId) : null;
  overlays.update(realDt, reduceMotion, sel, stage.camera);

  hudTimer += realDt;
  if (hudTimer > 0.2) { hudTimer = 0; hud.refresh(); }

  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(frame);
}
hud.refresh();
requestAnimationFrame(frame);
