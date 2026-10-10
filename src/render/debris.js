import * as THREE from 'three';
import { MAX_POINTS } from '../config.js';
import { state } from '../state.js';
import { tag } from '../ui/format.js';
import { toScreen } from './stage.js';

const V3 = THREE.Vector3;
const PATH_PTS = 130;
const ROCK_COLORS = [0x8a8278, 0x6f6b67, 0x9b8c75, 0x5e6168, 0xa49e95, 0x7d6e5c];

function rockGeometry(r) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const k = Math.random() * 10;
  const sx = 0.7 + Math.random() * 0.6, sy = 0.7 + Math.random() * 0.6, sz = 0.7 + Math.random() * 0.6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.22 * Math.sin(x * (3 + k) + y * 2.1 + k)
                + 0.16 * Math.sin(y * 4.3 + z * (2 + k * 0.3))
                + 0.10 * Math.sin(z * 5.7 + x * 3.1 + k * 2);
    p.setXYZ(i, x * n * r * sx, y * n * r * sy, z * n * r * sz);
  }
  g.computeVertexNormals();
  return g;
}
function visualSize(mass) { return 5 + 4.5 * Math.log10(mass * 100 + 1); } // exaggerated so you can see it

function lineGeo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATH_PTS * 3), 3));
  g.setDrawRange(0, 0);
  return g;
}
function setPath(line, pts) {
  const arr = line.geometry.attributes.position.array, n = Math.min(pts.length, PATH_PTS);
  for (let i = 0; i < n; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z; }
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.setDrawRange(0, n);
}

/* One visual per piece of debris: mesh, sensor trail, true path, your
   predicted path and a label. `items` maps debris id -> visual. */
export function createDebrisLayer(scene, labelsLayer) {
  const trailMat = new THREE.PointsMaterial({ color: 0xffb000, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.85 });
  const truthMat = new THREE.LineBasicMaterial({ color: 0x46e07a, transparent: true, opacity: 0.6 });
  const predMat  = new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.95 });
  const items = new Map();
  const tmp = new V3();

  function add(d) {
    const size = visualSize(d.mass);
    let mesh;
    if (Math.random() < 0.22) { // broken panel fragment
      mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 2.2, size * 0.16, size * 1.4),
        new THREE.MeshStandardMaterial({ color: 0x1f3a6e, metalness: 0.75, roughness: 0.32, emissive: 0x040b1c }));
    } else {
      mesh = new THREE.Mesh(rockGeometry(size), new THREE.MeshStandardMaterial({
        color: ROCK_COLORS[(Math.random() * ROCK_COLORS.length) | 0], roughness: 0.92, metalness: 0.12, flatShading: true }));
    }
    mesh.position.copy(d.pos);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    mesh.userData.id = d.id;
    scene.add(mesh);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Points(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);
    const truth = new THREE.Line(lineGeo(), truthMat); truth.frustumCulled = false; scene.add(truth);
    const pred = new THREE.Line(lineGeo(), predMat); pred.frustumCulled = false; pred.visible = false; scene.add(pred);

    const label = document.createElement('div');
    label.className = 'label'; label.textContent = tag(d.id);
    labelsLayer.appendChild(label);

    items.set(d.id, { d, mesh, size, trail, trailGeo, truth, pred, label,
      spin: new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2),
      trailKey: '', codeKey: '', prediction: null, predError: null, codeError: null });
  }

  function remove(id) {
    const v = items.get(id); if (!v) return;
    scene.remove(v.mesh, v.trail, v.truth, v.pred);
    v.mesh.geometry.dispose(); v.mesh.material.dispose();
    v.trailGeo.dispose(); v.truth.geometry.dispose(); v.pred.geometry.dispose();
    v.label.remove();
    items.delete(id);
    if (state.selectedId === id) state.selectedId = null;
  }

  function clear() { for (const id of [...items.keys()]) remove(id); }

  function update(sim, simDt, camera, w, h) {
    const show = state.show;
    for (const v of items.values()) {
      const d = v.d;
      v.mesh.position.copy(d.pos);
      if (simDt) { v.mesh.rotation.x += v.spin.x * simDt; v.mesh.rotation.y += v.spin.y * simDt; v.mesh.rotation.z += v.spin.z * simDt; }

      const p = d.sensorPoints, n = p.length;
      const key = n ? n + ':' + p[0].t : '0';
      if (key !== v.trailKey) {
        v.trailKey = key;
        const arr = v.trailGeo.attributes.position.array;
        for (let i = 0; i < n; i++) { arr[i * 3] = p[i].x; arr[i * 3 + 1] = p[i].y; arr[i * 3 + 2] = p[i].z; }
        v.trailGeo.attributes.position.needsUpdate = true;
        v.trailGeo.setDrawRange(0, n);
        v.trailGeo.computeBoundingSphere();
      }
      v.trail.visible = show.trails;

      v.truth.visible = show.truth;
      if (show.truth) setPath(v.truth, sim.coast(d.pos, d.vel, { maxT: 60, sampleEvery: 0.5, radius: d.radius }).path);

      if (v.prediction) {
        try {
          v.prediction.at(sim.time, tmp);
          v.predError = tmp.distanceTo(d.pos);
          if (show.yours) {
            const pts = [];
            for (let i = 0; i <= 120; i++) pts.push(v.prediction.at(sim.time + i * 0.5, new V3()));
            setPath(v.pred, pts);
          }
          v.pred.visible = show.yours;
        } catch (e) {
          v.prediction = null; v.predError = null; v.pred.visible = false;
          v.codeError = (e && e.message) ? e.message : String(e);
        }
      } else { v.pred.visible = false; v.predError = null; }

      const s = show.labels ? toScreen(d.pos, camera, w, h) : null;
      if (!s) { v.label.style.display = 'none'; }
      else {
        v.label.style.display = '';
        v.label.style.transform = `translate(${Math.round(s.x + 12)}px, ${Math.round(s.y - 22)}px)`;
        v.label.classList.toggle('threat', !!(show.truth && v.verdict && v.verdict.hit));
        v.label.classList.toggle('sel', d.id === state.selectedId);
      }
    }
  }

  return { items, add, remove, clear, update };
}
