import * as THREE from 'three';
import { BODIES, BODY_COLORS } from '../sim/bodies.js';
import { state } from '../state.js';
import { toScreen } from './stage.js';
import { blotchy, banded, glowTexture } from './textures.js';

/* Sun, planets, their orbit lines and name labels. */
export function createPlanets(scene, labelsLayer) {
  const list = [];
  for (const b of BODIES) {
    const group = new THREE.Group(); group.position.copy(b.pos); scene.add(group);
    let orbitLine = null;
    if (b.orbit) {
      const o = b.orbit, pts = [];
      for (let i = 0; i < 360; i++) {
        const a = i / 360 * Math.PI * 2;
        pts.push(o.u.clone().multiplyScalar(o.r * Math.cos(a)).addScaledVector(o.w, o.r * Math.sin(a)));
      }
      orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: new THREE.Color(BODY_COLORS[b.name]).getHex(), transparent: true, opacity: 0.3 }));
      orbitLine.frustumCulled = false;
      orbitLine.position.copy(o.parent.pos);
      scene.add(orbitLine);
    }
    let mesh, haloColor = null;
    if (b.kind === 'sun') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 64, 32), new THREE.MeshBasicMaterial({ color: 0xffd68a }));
      [[6, '255,200,110', 0.6], [16, '255,150,70', 0.22]].forEach(([k, c, a]) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(c, a), depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.scale.set(b.radius * k, b.radius * k, 1); group.add(sp);
      });
    } else {
      const map = b.kind === 'giant' ? banded(['#c9a27a', '#b4835a', '#e2c8a2', '#9c6b48', '#d8b38c'])
        : b.kind === 'rocky' ? blotchy('#9b4a32', ['#6e3020', '#c26a45', '#4a2418', '#b8836a'])
        : b.kind === 'ice' ? blotchy('#9fd3e8', ['#e8f7ff', '#6aa9c4', '#c4e6f2'])
        : blotchy('#8d8a86', ['#6a6764', '#b0ada8', '#55524f']);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 64, 32), new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.05 }));
      haloColor = { giant: 0xffc890, rocky: 0xff8a60, ice: 0x9fe4ff }[b.kind];
      if (b.kind === 'giant') {
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(b.radius * 1.4, b.radius * 2.25, 128),
          new THREE.MeshBasicMaterial({ color: 0xd8c3a0, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
        ringMesh.rotation.x = -Math.PI / 2 + 0.45; ringMesh.rotation.y = 0.2; group.add(ringMesh);
      }
    }
    mesh.rotation.z = 0.3;
    group.add(mesh);
    if (haloColor) {
      group.add(new THREE.Mesh(new THREE.SphereGeometry(b.radius * 1.07, 48, 24),
        new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    }
    const label = document.createElement('div'); label.className = 'label body'; label.textContent = b.name;
    labelsLayer.appendChild(label);
    list.push({ b, mesh, label, group, orbitLine });
  }

  const labelAt = new THREE.Vector3();
  return {
    /* label text shows each planet's range from the rocket */
    refreshLabels() {
      for (const bv of list) bv.label.textContent = bv.b.orbit ? `${bv.b.name}  ${(bv.b.pos.length() / 1000).toFixed(1)} km` : bv.b.name;
    },
    update(simDt, camera, w, h) {
      for (const bv of list) {
        bv.group.position.copy(bv.b.pos);
        if (bv.orbitLine) { bv.orbitLine.position.copy(bv.b.orbit.parent.pos); bv.orbitLine.visible = state.show.orbits; }
        if (simDt) bv.mesh.rotation.y += simDt * 0.03;
        labelAt.copy(bv.b.pos); labelAt.y += bv.b.radius * 1.15;
        const s = state.show.labels ? toScreen(labelAt, camera, w, h) : null;
        if (!s) bv.label.style.display = 'none';
        else {
          bv.label.style.display = '';
          bv.label.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y - 18)}px) translateX(-50%)`;
        }
      }
    }
  };
}
