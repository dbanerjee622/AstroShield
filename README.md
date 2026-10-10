# AstroShield — Debris Field Simulator

A sensor simulator seen from a rocket: debris flies through a field bent by
the gravity of nearby planets, and you write the code that predicts each
piece's trajectory from the sensor readings.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Where things live

```
src/
  trajectory.js     <- your code: calculateTrajectory(reading, env)
  prediction.js     calls your code and checks what it returns
  config.js         default settings (the sliders edit these live)
  state.js          shared UI state (paused, selection, visibility toggles)
  main.js           wires everything together and runs the frame loop
  sim/              physics + sensor, no drawing
    simulator.js    debris spawning, stepping, sensor scans ("INTERCEPTOR" hooks)
    bodies.js       sun/planet definitions, orbits, gravity
    math.js         rounding and seeded RNG
  render/           three.js scene
    stage.js        renderer, camera, controls, sky, lights
    rocket.js  planets.js  debris.js  overlays.js  textures.js
  ui/               DOM panels
    hud.js          top bar, sensor feed, detail panel, planet tables
    controls.js     sliders, toggles, buttons, click-to-select
    notify.js       toasts and impact flash
    format.js       number/unit formatting
  styles/           base (tokens), layout, panels, view
```

`window.sim` and `window.CONFIG` are exposed for poking around in the browser console.
