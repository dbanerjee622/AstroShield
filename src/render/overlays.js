import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BODIES, BODY_COLORS, gravityParts } from '../sim/bodies.js';
import { state } from '../state.js';

const V3 = THREE.Vector3;

function ring(r, color, opacity, rx, rz) {
  const pts = [];
  for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.rotation.x = rx || 0; l.rotation.z = rz || 0; return l;
}

function setArrow(ar, from, dir, accel) {
  const len = 20 + accel * 120, head = Math.min(36, len * 0.3);
  ar.position.copy(from); ar.setDirection(dir); ar.setLength(len, head, head * 0.5); ar.visible = true;
}

/* Hit zone, sensor sphere + sweep, world boundary, selection ring and
   the gravity arrows drawn on the selected piece. */
export function createOverlays(scene) {
  const hitZone = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xff5466, wireframe: true, transparent: true, opacity: 0.35 }));
  hitZone.visible = false; scene.add(hitZone);

  /* sensor range shell, rings, grid, sweep */
  const sensorGroup = new THREE.Group(); scene.add(sensorGroup);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0xa8b4c2, transparent: true, opacity: 0.025, side: THREE.BackSide, depthWrite: false }));
  sensorGroup.add(shell);
  const sensorRings = [ring(1, 0xa8b4c2, 0.3), ring(1, 0xa8b4c2, 0.1, Math.PI / 2), ring(1, 0xa8b4c2, 0.1, Math.PI / 2, Math.PI / 2)];
  sensorRings.forEach(r => sensorGroup.add(r));
  const grid = new THREE.PolarGridHelper(1, 12, 6, 96, 0x3a424c, 0x23282e);
  grid.material.transparent = true; grid.material.opacity = 0.55; sensorGroup.add(grid);
  const sweep = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(1, 0, 0)]),
    new THREE.LineBasicMaterial({ color: 0xd8dee6, transparent: true, opacity: 0.45 }));
  sensorGroup.add(sweep);
  const worldRing = ring(CONFIG.worldRadius, 0x8f9bb8, 0.12); scene.add(worldRing);
  sensorGroup.scale.setScalar(CONFIG.sensorRange);

  /* selection marker */
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
  selRing.renderOrder = 10; selRing.visible = false; scene.add(selRing);

  /* gravity arrows on the selected piece: one per body, plus the total in white */
  const forceArrows = BODIES.map(b => {
    const a = new THREE.ArrowHelper(new V3(1, 0, 0), new V3(), 100, new THREE.Color(BODY_COLORS[b.name]).getHex(), 24, 12);
    a.visible = false; scene.add(a); return a;
  });
  const totalArrow = new THREE.ArrowHelper(new V3(1, 0, 0), new V3(), 100, 0xffffff, 30, 15);
  totalArrow.visible = false; scene.add(totalArrow);

  return {
    /* sel is the selected debris visual, or null */
    update(realDt, reduceMotion, sel, camera) {
      sensorGroup.scale.setScalar(CONFIG.sensorRange);
      hitZone.visible = state.show.zone; hitZone.scale.setScalar(CONFIG.rocketRadius);
      if (state.running && !reduceMotion) sweep.rotation.y -= realDt * 0.9 * Math.min(CONFIG.timeScale, 3);

      selRing.visible = !!sel;
      if (sel) {
        selRing.position.copy(sel.mesh.position);
        selRing.scale.setScalar(sel.size * 2.1);
        selRing.quaternion.copy(camera.quaternion);
      }
      if (sel && CONFIG.gravityScale > 0) {
        const tot = new V3();
        gravityParts(sel.d, CONFIG.gravityScale).forEach((p, i) => { setArrow(forceArrows[i], sel.mesh.position, p.dir, p.a); tot.addScaledVector(p.dir, p.a); });
        const ta = tot.length();
        if (ta > 0) setArrow(totalArrow, sel.mesh.position, tot.divideScalar(ta), ta);
      } else {
        forceArrows.forEach(a => { a.visible = false; });
        totalArrow.visible = false;
      }
    }
  };
}
