import { Vector3 as V3 } from 'three';
import { BODIES, bodiesAt } from './sim/bodies.js';
import { calculateTrajectory } from './trajectory.js';

/* =====================================================================
   YOUR CODE HOOK
   Calls calculateTrajectory() whenever a piece gets new readings and
   turns whatever it returns into something the renderer can sample.
   ===================================================================== */
export function toTrajectory(r) {
  if (!r || typeof r !== 'object') return null;
  if (typeof r.positionAt === 'function') {
    const f = r.positionAt;
    return { at(t, out) {
      const q = f(t);
      if (!q || ![q.x, q.y, q.z].every(Number.isFinite)) throw new Error('positionAt(t) has to return { x, y, z } with numbers in it.');
      return out.set(q.x, q.y, q.z);
    } };
  }
  if (!r.point || !r.direction) return null;
  const t0 = r.t0 == null ? 0 : r.t0;
  const nums = [r.point.x, r.point.y, r.point.z, r.direction.x, r.direction.y, r.direction.z, t0];
  if (!nums.every(Number.isFinite)) return null;
  const P = new V3(r.point.x, r.point.y, r.point.z), D = new V3(r.direction.x, r.direction.y, r.direction.z);
  return { at(t, out) { return out.copy(P).addScaledVector(D, t - t0); } };
}

/* Updates prediction / codeError on each debris visual in `items`. */
export function runUserCode(sim, items) {
  const gravityScale = sim.cfg.gravityScale;
  bodiesAt(sim.time - 0.5, '_e0'); bodiesAt(sim.time + 0.5, '_e1');
  const env = {
    time: sim.time,
    gravityScale,
    bodies: BODIES.map(b => ({
      name: b.name, x: b.pos.x, y: b.pos.y, z: b.pos.z,
      vx: b._e1.x - b._e0.x, vy: b._e1.y - b._e0.y, vz: b._e1.z - b._e0.z,
      mass: b.mass, mu: b.mu, radius: b.radius,
      orbit: b.orbit ? { around: b.orbit.around, radius: b.orbit.r, period: b.orbit.period } : null })),
    positionAt(name, t) {
      const b = BODIES.find(x => x.name === name);
      if (!b) throw new Error('No body named "' + name + '"');
      bodiesAt(t, '_env');
      return { x: b._env.x, y: b._env.y, z: b._env.z };
    }
  };
  for (const v of items.values()) {
    const p = v.d.sensorPoints, n = p.length;
    if (!n) continue;
    const key = n + ':' + p[0].t + ':' + p[n - 1].t + ':' + gravityScale;
    if (key === v.codeKey) continue;
    v.codeKey = key;
    try {
      const out = calculateTrajectory(sim.readingFor(v.d), env);
      v.prediction = toTrajectory(out);
      v.codeError = (out != null && !v.prediction)
        ? 'Your function returned something, but it isn\'t a { point, direction, t0 } line or a { positionAt } path.'
        : null;
    } catch (e) {
      v.prediction = null;
      v.codeError = (e && e.message) ? e.message : String(e);
    }
  }
}
