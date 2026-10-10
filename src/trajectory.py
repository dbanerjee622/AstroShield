/* =====================================================================
   YOUR CODE (Aaron)
   ---------------------------------------------------------------------
   calculateTrajectory() is called every time the sensor gets a new
   reading on a piece of debris. A reading is one measurement: where
   the debris was (x, y, z) at one moment in time (t).

     reading = {
       id:     7,
       mass:   12.4,      // kg
       velocity: { x: -61.2, y: 4.8, z: -32.9 },  // m/s, measured at the latest reading
       start: {           // where and how it entered the field
         t: 41.2,                 // s
         position: { x, y, z },   // m
         velocity: { x, y, z }    // m/s
       },
       points: [ { t: 3.5, x: 1210.4, y: -88.2, z: 640.9 }, ... ]
     }                    // t in seconds, x/y/z in meters, oldest first

     env = {
       time: 42.5,        // current sim time (s)
       gravityScale: 0.6, // the "Gravity strength" slider (0 = off)
       bodies: [ { name, x, y, z, vx, vy, vz, mass, mu, radius, orbit }, ... ],
       positionAt(name, t)  // where a body is at time t -> { x, y, z }
     }
     The planets orbit the sun (and Oro orbits Varo), so x, y, z and
     vx, vy, vz are where each body is and how fast it's moving right
     now. orbit = { around, radius, period } (null for the sun).
     mass in kg, mu = G * mass (m^3/s^2). Pull from one body =
     gravityScale * mu / r^2 (m/s^2), pointing toward that body.
     Because the planets move, use positionAt(name, t) to know where
     they'll be when you predict a path into the future.

   Return null if you can't work it out yet, or ONE of these:

   1) A straight line (exactly right when gravity is off):
        { point: {x, y, z}, direction: {x, y, z}, t0: number }
      meaning position(t) = point + direction * (t - t0),
      where "direction" is the velocity vector in m/s.

   2) Any path you like (for curved, gravity-bent paths):
        { positionAt: function (t) { return { x: ..., y: ..., z: ... }; } }

   Your path is drawn in magenta, and the sensor feed shows how far your
   prediction is from where the debris really is. Turn on "True paths"
   to compare against the real answer.
   ===================================================================== */
export function calculateTrajectory(reading, env) {
  // TODO: your math goes here
  return null;
}

/* Interceptor: when you're ready, search src/sim/simulator.js for
   "INTERCEPTOR" — that's where launching and moving it plugs in.        */
