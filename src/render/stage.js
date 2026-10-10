import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BODIES } from '../sim/bodies.js';
import { nebulaTexture } from './textures.js';

/* Renderer, camera, orbit controls, sky and lights. */
export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.domElement.id = 'scene';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D view of the rocket and debris');
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050608');

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 300000);
  camera.position.set(2100, 1250, 2700);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 50;
  controls.maxDistance = 40000;
  controls.autoRotateSpeed = 0.35;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  if (camera.aspect < 0.9) camera.position.multiplyScalar(1.6);

  addSky(scene);

  scene.add(new THREE.AmbientLight(0x8090b8, 0.38));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.7); sun.position.copy(BODIES[0].pos); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fb4d0, 0.35); rim.position.set(-2000, -600, -1600); scene.add(rim);

  return { renderer, scene, camera, controls };
}

/* stars + nebula glow */
function addSky(scene) {
  const n = 4500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const tints = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.88, 0.7], [0.85, 0.8, 1]];
  for (let i = 0; i < n; i++) {
    const z = Math.random() * 2 - 1, p = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    const R = 90000 + Math.random() * 60000;
    pos[i * 3] = r * Math.cos(p) * R; pos[i * 3 + 1] = z * R; pos[i * 3 + 2] = r * Math.sin(p) * R;
    const t = tints[(Math.random() * tints.length) | 0], b = 0.35 + Math.pow(Math.random(), 3) * 0.65;
    col[i * 3] = t[0] * b; col[i * 3 + 1] = t[1] * b; col[i * 3 + 2] = t[2] * b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true })));

  [[[90, 70, 200], 0.28, [-56000, 20000, -72000], 88000],
   [[30, 120, 170], 0.22, [64000, -24000, -48000], 72000],
   [[170, 80, 120], 0.14, [16000, 36000, 80000], 64000]].forEach(([c, a, p, s]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexture(c.join(','), a), depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(p[0], p[1], p[2]); sp.scale.set(s, s, 1); scene.add(sp);
  });
}

/* Screen position (px) of a world point, or null when it's off screen. */
const proj = new THREE.Vector3();
export function toScreen(p, camera, w, h) {
  proj.copy(p).project(camera);
  if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) return null;
  return { x: (proj.x + 1) / 2 * w, y: (1 - proj.y) / 2 * h };
}
