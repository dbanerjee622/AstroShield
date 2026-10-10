/* Default settings. The sliders in the left rail write straight into CONFIG,
   and the simulator reads it live, so changes apply immediately. */
export const CONFIG = {
  worldRadius: 2000,     // debris appears on a sphere this far out (m)
  sensorRange: 1500,     // sensor sees debris inside this radius (m)
  rocketRadius: 15,      // rocket's hit zone (m)
  sensorInterval: 0.5,   // seconds between sensor readings
  sensorNoise: 0,        // std. deviation of position error (m)
  speedMin: 40,          // m/s
  speedMax: 200,         // m/s
  massMin: 0.01,         // kg
  massMax: 500,          // kg
  maxDebris: 8,
  spawnPerSec: 0.35,     // chance per second of a new piece appearing
  threatFraction: 0.35,  // share of debris aimed to hit the rocket
  timeScale: 1,
  gravityScale: 0.6,     // multiplies every body's pull (0 = straight lines)
  seed: 'aaron'
};
export const SIM_DT = 1 / 60;   // physics step (s)
export const MAX_POINTS = 400;  // sensor readings kept per piece
