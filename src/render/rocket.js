import * as THREE from 'three';

/* The rocket at the origin, with a flickering engine and a red glow on impact. */
export function createRocket(scene) {
  const rocket = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf3, metalness: 0.35, roughness: 0.42 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2336, metalness: 0.6, roughness: 0.38 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6b3d, metalness: 0.25, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 26, 40), hullMat); rocket.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 4.45, 1.6, 40), darkMat); band.position.y = 6; rocket.add(band);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(4, 11, 40), noseMat); nose.position.y = 18.5; rocket.add(nose);
  const port = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.6, 28),
    new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x1a6a88, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 }));
  port.rotation.x = Math.PI / 2; port.position.set(0, 9, 4.1); rocket.add(port);
  for (let i = 0; i < 4; i++) {
    const piv = new THREE.Group(); piv.rotation.y = i * Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 5.5), noseMat);
    fin.position.set(0, -9.5, 5.6); fin.rotation.x = -0.18; piv.add(fin); rocket.add(piv);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 4, 32), darkMat); nozzle.position.y = -15; rocket.add(nozzle);

  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(2.6, 15, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  flameOuter.rotation.x = Math.PI; flameOuter.position.y = -24.5; rocket.add(flameOuter);
  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flameInner.rotation.x = Math.PI; flameInner.position.y = -21.5; rocket.add(flameInner);
  const engineLight = new THREE.PointLight(0xff9a40, 2.2, 260); engineLight.position.y = -26; rocket.add(engineLight);

  rocket.rotation.z = -0.25; rocket.rotation.x = 0.12;
  rocket.scale.setScalar(0.72);
  scene.add(rocket);

  let impactGlow = 0;
  return {
    flash() { impactGlow = 1; },
    animate(realDt, clock, reduceMotion) {
      const flick = reduceMotion ? 1 : 1 + 0.09 * Math.sin(clock * 31) + 0.05 * Math.sin(clock * 17.3);
      flameOuter.scale.set(1, flick, 1); flameInner.scale.set(1, 2 - flick, 1);
      impactGlow = Math.max(0, impactGlow - realDt * 1.6);
      hullMat.emissive.setRGB(impactGlow * 0.9, impactGlow * 0.08, impactGlow * 0.1);
    }
  };
}
