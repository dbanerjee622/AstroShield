import { Vector3 as V3 } from 'three';

/* Sun and planets. Game scale: far closer and stronger than real life,
   so the bending is big enough to see. mu = G * M, in m^3/s^2.
   Planets follow fixed circular orbits ("on rails"): the sun's gravity
   sets each orbit's speed, but the planets don't pull on each other
   and the gravity slider only changes how hard they pull on debris.
   Every orbit around the sun is tilted differently but passes a couple
   of kilometers from the rocket, so the planets sweep past the field. */
export const BODIES = [
  { name: 'Sun',     kind: 'sun',   pos: new V3(-10500, 2600, -7600), radius: 1300, mu: 2.2e8 },
  { name: 'Varo',    kind: 'giant', radius: 520, mu: 2.4e7, orbit: { around: 'Sun',  r: 17000, tilt: 0.25,  phase: -1.2 } },
  { name: 'Kestrel', kind: 'rocky', radius: 260, mu: 8e6,   orbit: { around: 'Sun',  r: 15800, tilt: -0.35, phase: -0.45 } },
  { name: 'Thule',   kind: 'ice',   radius: 210, mu: 5e6,   orbit: { around: 'Sun',  r: 10400, tilt: 0.6,   phase: -2.0 } },
  { name: 'Oro',     kind: 'moon',  radius: 120, mu: 1.6e6, orbit: { around: 'Varo', r: 1200,  tilt: 1.1,   phase: 0 } }
];
export const BODY_COLORS = { Sun: '#ffcf5a', Varo: '#e0a36c', Kestrel: '#ff7a55', Thule: '#8fe3ff', Oro: '#c9c6c0' };
export const G = 6.674e-11; // gravitational constant

(function setUpOrbits() {
  const byName = {};
  for (const b of BODIES) byName[b.name] = b;
  const sunPos = BODIES[0].pos;
  BODIES[0].home = sunPos.clone();
  const toRocket = sunPos.clone().negate().normalize();     // sun -> rocket direction
  const up = new V3(0, 1, 0);
  const w0 = up.clone().addScaledVector(toRocket, -up.dot(toRocket)).normalize();
  for (const b of BODIES) {
    if (!b.orbit) continue;
    const o = b.orbit;
    o.parent = byName[o.around];
    o.period = 2 * Math.PI * Math.sqrt(o.r * o.r * o.r / o.parent.mu);  // Kepler's third law
    o.omega = 2 * Math.PI / o.period;
    o.u = toRocket.clone();
    o.w = w0.clone().multiplyScalar(Math.cos(o.tilt)).add(toRocket.clone().cross(w0).multiplyScalar(Math.sin(o.tilt)));
    b.pos = new V3();
  }
})();

/* Put every body where it is at time t. Results go in b[key]
   ('pos' is the live position; other keys are scratch space). */
export function bodiesAt(t, key) {
  for (const b of BODIES) {
    const out = b[key] || (b[key] = new V3());
    if (!b.orbit) { out.copy(b.home); continue; }
    const o = b.orbit, th = o.phase + o.omega * t;
    out.copy(o.parent[key]).addScaledVector(o.u, o.r * Math.cos(th)).addScaledVector(o.w, o.r * Math.sin(th));
  }
}

bodiesAt(0, 'pos');
BODIES.forEach(b => { b.mass = b.mu / G; }); // kg

/* pull (m/s^2) and force (N) on piece d from each body */
export function gravityParts(d, gravityScale) {
  return BODIES.map(b => {
    const dir = b.pos.clone().sub(d.pos), r = dir.length();
    dir.divideScalar(r);
    const a = gravityScale * b.mu / (r * r);
    return { b, r, a, F: a * d.mass, dir };
  });
}
