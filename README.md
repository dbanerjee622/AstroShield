# AstroShield — Debris Field Simulator

A sensor simulator seen from a rocket: debris flies through a field bent by
the gravity of nearby planets, and you write the code that predicts each
piece's trajectory from the sensor readings.

## Run it

Install the Python dependency once:

```sh
python3 -m pip install -r requirements.txt
```

Start the Python API in one terminal:

```sh
python3 src/api.py
```

Start the browser app in a second terminal:

```sh
npm install
npm run dev      # http://localhost:5173; /api requests are proxied to Python
npm run build    # production build in dist/
```

## Where things live

```
src/
  trajectory.py     Python interception solver
  api.py            HTTP endpoint that calls the solver
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
