import { Vector3 as V3 } from 'three';
import { MAX_POINTS } from '../config.js';
import { BODIES, bodiesAt } from './bodies.js';
import { round, hashSeed, mulberry32, gaussian } from './math.js';

/* =====================================================================
   SIMULATOR  (physics + sensor only, no drawing)
   With gravity off, debris moves in straight lines at constant speed.
   With gravity on, the sun and planets pull on every piece, so paths
   curve and speeds change.
   ===================================================================== */
export class Simulator {
  constructor(cfg) { this.cfg = cfg; this.reset(cfg.seed); }

  reset(seed) {
    const h = hashSeed(seed);
    this.rand = mulberry32(h);
    this.noiseRand = mulberry32(h ^ 0x9e3779b9);
    this.time = 0;
    this.debris = [];
    this.nextId = 1;
    this.hits = 0;
    this.lastScan = -Infinity;
    bodiesAt(0, 'pos');
    this.events = [{ type: 'reset' }];
    // INTERCEPTOR: e.g. this.interceptors = [];
    const n = Math.min(3, this.cfg.maxDebris);
    for (let i = 0; i < n; i++) this.spawn();
  }

  uniform(a, b) { return a + (b - a) * this.rand(); }

  randomUnit() {
    const z = this.uniform(-1, 1), phi = this.uniform(0, Math.PI * 2), r = Math.sqrt(1 - z * z);
    return new V3(r * Math.cos(phi), z, r * Math.sin(phi));
  }

  spawn() {
    const c = this.cfg;
    const dir = this.randomUnit();
    const start = dir.clone().multiplyScalar(c.worldRadius);

    // pick a point near the rocket to aim at, offset sideways by "miss"
    let side = this.randomUnit();
    side.addScaledVector(dir, -side.dot(dir));
    if (side.lengthSq() < 1e-6) side = new V3(1, 0, 0).cross(dir);
    side.normalize();
    const threat = this.rand() < c.threatFraction;
    const miss = threat
      ? this.uniform(0, c.rocketRadius * 0.8)
      : this.uniform(c.rocketRadius * 4, c.sensorRange * 0.5);
    const aim = side.multiplyScalar(miss);

    const speed = this.uniform(Math.min(c.speedMin, c.speedMax * 0.5), c.speedMax);
    const vel = aim.clone().sub(start).normalize().multiplyScalar(speed);
    if (threat && c.gravityScale > 0) {
      // gravity bends the path, so nudge the aim point until it really hits
      for (let k = 0; k < 8; k++) {
        const ca = this.coast(start, vel, { maxT: 200 });
        if (ca.minDist < c.rocketRadius * 0.5) break;
        aim.sub(ca.closest);
        vel.copy(aim).sub(start).normalize().multiplyScalar(speed);
      }
    }
    const mass = Math.pow(10, this.uniform(Math.log10(c.massMin), Math.log10(c.massMax)));
    const radius = Math.cbrt(3 * mass / (4 * Math.PI * 2700)); // aluminum sphere

    const d = { id: this.nextId++, mass, radius, pos: start, vel,
                sensorPoints: [], measuredVelocity: null, threat,
                start: { t: round(this.time, 3),
                         position: { x: round(start.x, 2), y: round(start.y, 2), z: round(start.z, 2) },
                         velocity: { x: round(vel.x, 2), y: round(vel.y, 2), z: round(vel.z, 2) } } };
    this.debris.push(d);
    this.events.push({ type: 'spawn', d });
    return d;
  }

  step(dt) {
    const c = this.cfg;
    bodiesAt(this.time, 'pos');
    this.time += dt;
    const keep = [];
    const acc = this._acc || (this._acc = new V3());
    for (const d of this.debris) {
      const prev = d.pos.clone();
      this.accelAt(d.pos, acc);
      d.vel.addScaledVector(acc, dt);
      d.pos.addScaledVector(d.vel, dt);
      // closest point to the rocket along this step (so fast debris can't skip through)
      const seg = d.vel.clone().multiplyScalar(dt);
      const s = Math.max(0, Math.min(1, -prev.dot(seg) / seg.lengthSq()));
      const closest = prev.addScaledVector(seg, s).length();
      if (closest <= c.worldRadius && !d.interceptionRequested) {
        d.interceptionRequested = true;
        bodiesAt(this.time, 'pos');
        fetch('/api/interception', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            r0: d.pos.toArray(),
            v0: d.vel.toArray(),
            planet_pos: BODIES.map(body => body.pos.toArray()),
            planet_masses: BODIES.map(body => body.mass),
            t0: this.time,
            gravity_scale: this.cfg.gravityScale
          })
        })
          .then(async response => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            return result;
          })
          .then(result => {
            d.interceptionResult = result;
            console.info(`Interception result for debris ${d.id}:`, result);
          })
          .catch(error => {
            d.interceptionError = error.message;
            console.error(`Interception request failed for debris ${d.id}:`, error);
          });
      }
      if (closest <= c.rocketRadius + d.radius) {
        this.hits++; this.events.push({ type: 'hit', d }); continue;
      }
      const body = this.bodyHit(d.pos);
      if (body) { this.events.push({ type: 'crash', d, body }); continue; }
      if (d.pos.length() > c.worldRadius * 1.05) {
        this.events.push({ type: 'exit', d }); continue;
      }
      keep.push(d);
    }
    this.debris = keep;
    bodiesAt(this.time, 'pos');

    // INTERCEPTOR: move interceptors here and check them against debris.

    if (this.time - this.lastScan >= c.sensorInterval - 1e-9) {
      this.lastScan = this.time;
      this.scan();
    }
    if (this.debris.length < c.maxDebris && this.rand() < c.spawnPerSec * dt) this.spawn();
  }

  /* gravity pull (m/s^2) at point p, written into out */
  accelAt(p, out, key) {
    out.set(0, 0, 0);
    const g = this.cfg.gravityScale;
    if (!g) return out;
    key = key || 'pos';
    for (const b of BODIES) {
      const bp = b[key];
      const dx = bp.x - p.x, dy = bp.y - p.y, dz = bp.z - p.z;
      const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
      const f = g * b.mu / (r2 * r);
      out.x += dx * f; out.y += dy * f; out.z += dz * f;
    }
    return out;
  }

  bodyHit(p, key) {
    key = key || 'pos';
    for (const b of BODIES) if (p.distanceTo(b[key]) <= b.radius) return b;
    return null;
  }

  /* Fly a copy of a piece forward without touching the sim. Returns its
     closest approach to the rocket, how the flight ends ('hit', 'body',
     'exit' or 'time'), and points along the way if sampleEvery is set. */
  coast(p0, v0, opts) {
    const o = opts || {};
    const maxT = o.maxT || 60, dt = o.dt || 0.05, every = o.sampleEvery || 0, rr = o.radius || 0;
    const c = this.cfg, p = p0.clone(), v = v0.clone(), a = new V3(), prev = new V3();
    let minDist = p.length(), tMin = 0, end = 'time', body = null, t = 0;
    const closest = p.clone();
    const path = every ? [p.clone()] : null;
    let nextSample = every;
    const t0 = o.t0 == null ? this.time : o.t0;   // planets move, so track when we are
    while (t < maxT) {
      prev.copy(p);
      bodiesAt(t0 + t, '_cp');
      this.accelAt(p, a, '_cp');
      v.addScaledVector(a, dt); p.addScaledVector(v, dt); t += dt;
      // closest point to the rocket along this little step
      const sx = p.x - prev.x, sy = p.y - prev.y, sz = p.z - prev.z;
      const L2 = sx * sx + sy * sy + sz * sz;
      const s = L2 ? Math.max(0, Math.min(1, -(prev.x * sx + prev.y * sy + prev.z * sz) / L2)) : 0;
      const qx = prev.x + sx * s, qy = prev.y + sy * s, qz = prev.z + sz * s;
      const dq = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (dq < minDist) { minDist = dq; closest.set(qx, qy, qz); tMin = t - dt * (1 - s); }
      if (path && t >= nextSample - 1e-9) { path.push(p.clone()); nextSample += every; }
      if (dq <= c.rocketRadius + rr) { end = 'hit'; t = tMin; break; }
      if ((body = this.bodyHit(p, '_cp'))) { end = 'body'; break; }
      const dist = p.length();
      if (dist > c.worldRadius * 1.05 && p.dot(v) > 0) { end = 'exit'; break; }
    }
    if (path && end !== 'time') path.push(end === 'hit' ? closest.clone() : p.clone());
    return { minDist, closest, tMin, end, body, t, path };
  }

  scan() {
    const c = this.cfg, n = c.sensorNoise, r = this.noiseRand;
    for (const d of this.debris) {
      if (d.pos.length() > c.sensorRange) continue;
      d.sensorPoints.push({
        t: round(this.time, 3),
        x: round(d.pos.x + (n ? gaussian(r) * n : 0), 2),
        y: round(d.pos.y + (n ? gaussian(r) * n : 0), 2),
        z: round(d.pos.z + (n ? gaussian(r) * n : 0), 2)
      });
      if (d.sensorPoints.length > MAX_POINTS) d.sensorPoints.shift();
      d.measuredVelocity = {
        x: round(d.vel.x + (n ? gaussian(r) * n * 0.05 : 0), 2),
        y: round(d.vel.y + (n ? gaussian(r) * n * 0.05 : 0), 2),
        z: round(d.vel.z + (n ? gaussian(r) * n * 0.05 : 0), 2)
      };
    }
  }

  readingFor(d) {
    return { id: d.id, mass: round(d.mass, 3),
             velocity: d.measuredVelocity ? { ...d.measuredVelocity } : null,
             start: { t: d.start.t, position: { ...d.start.position }, velocity: { ...d.start.velocity } },
             points: d.sensorPoints.map(p => ({ t: p.t, x: p.x, y: p.y, z: p.z })) };
  }

  /* Everything the sensor currently sees. This is the data your program gets. */
  getSensorData() {
    return this.debris.filter(d => d.sensorPoints.length).map(d => this.readingFor(d));
  }
}
