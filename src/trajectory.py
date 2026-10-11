def interception(
    r0,
    v0,
    planet_pos,
    planet_masses,
    t0=0.0,
    gravity_scale=0.6,
    interceptor_speed=50.0,
    dt=0.05,
    tol=0.5,
    table_length=60.0,
):
    """
    3D INTERCEPT SOLVER (fully commented)

    PURPOSE
        Find the direction to fire an interceptor, and how long it flies, so that it
        reaches the same point as a piece of debris at the same moment. Planet gravity
        bends the paths of BOTH objects, so the answer is found by guess-and-correct
        (Newton's method) rather than by a single formula.

    SETUP
        - The ship sits at the origin (0, 0, 0) and never moves. Every position is
        measured from the ship.
        - The origin is treated as a non-accelerating reference point.
        - Units: meters (m), seconds (s), kilograms (kg), radians (rad).
        - Vectors are NumPy arrays of 3 numbers [x, y, z]. Math on them acts on all
        three components at once (e.g. r0 + v0*T adds x, y, z separately).

    OVERALL FLOW
        Step 0   define the inputs
        Step 1   planet positions (function)
        Step 2   gravity at any point (function)
        Step 3   compute the debris path ONCE and store it as a table
        Step 4   first-guess flight time, ignoring gravity (quadratic)
        Step 5   first-guess aim, converted to two angles
        Step 6   angles -> launch velocity (function)
        Step 7   simulate the interceptor (function)
        Steps 8-11  loop: measure miss, build Jacobian, Newton update, repeat
        Step 12  return the final answers
    """
    import numpy as np   # NumPy: arrays and math functions (sqrt, sin, cos, dot, solve, ...)

    r0 = np.asarray(r0, dtype=float)
    v0 = np.asarray(v0, dtype=float)
    planet_pos = np.asarray(planet_pos, dtype=float)
    planet_masses = np.asarray(planet_masses, dtype=float)
    if r0.shape != (3,) or v0.shape != (3,):
        raise ValueError("r0 and v0 must each contain three coordinates.")
    if planet_pos.ndim != 2 or planet_pos.shape[1:] != (3,):
        raise ValueError("planet_pos must contain one three-coordinate position per body.")
    if planet_masses.shape != (len(planet_pos),) or len(planet_masses) == 0:
        raise ValueError("planet_masses must contain one mass per body.")
    if not all(np.all(np.isfinite(values)) for values in (r0, v0, planet_pos, planet_masses)):
        raise ValueError("Input vectors and masses must contain finite numbers.")
    if not all(np.isfinite(value) for value in (t0, gravity_scale, interceptor_speed, dt, tol, table_length)):
        raise ValueError("Solver settings must be finite numbers.")
    if interceptor_speed <= 0 or dt <= 0 or tol <= 0 or table_length <= 0:
        raise ValueError("interceptor_speed, dt, tol, and table_length must be positive.")
    if gravity_scale < 0 or np.any(planet_masses <= 0):
        raise ValueError("gravity_scale cannot be negative and planet masses must be positive.")

    # G: gravitational constant in N*m^2/kg^2.
    G = 6.674e-11
    u = interceptor_speed

    # =====================================================================
    # STEP 2: GRAVITATIONAL ACCELERATION at a point x at time t
    #     a(x, t) = sum over planets of  G * M_i * (p_i - x) / |p_i - x|^3
    # This is the only force law in the program. It is used for the debris
    # and for the interceptor.
    # =====================================================================
    def a_grav(x, t):
        """
        Input:  x = [x, y, z] position where you want the acceleration (m)
                t = time (s), needed because planets move
        Output: acceleration vector [ax, ay, az] in m/s^2 caused by all planets.
        """
        # total: running sum of every planet's pull. Starts at zero. Accelerations
        #        from different planets add as vectors.
        total = np.zeros(3)

        # Loop over planets: M = this planet's mass, p = this planet's position.
        for M, p in zip(planet_masses, planet_pos):
            # d_vec: vector from the point x TO the planet. Its direction is the
            #        direction of the pull (gravity points toward the planet).
            d_vec = p - x

            # d: length of d_vec = distance from x to the planet (m).
            d = np.linalg.norm(d_vec)
            if d == 0:
                raise ValueError("A simulated object reached a planet's position.")

            # d_vec has length d, so dividing by d**3 leaves a vector of length
            # G*M/d**2 (the inverse-square law) still pointing at the planet.
            total += gravity_scale * G * M * d_vec / d**3

        return total


    # =====================================================================
    # STEP 3: DEBRIS PATH (computed once, stored as a table)
    # Uses "velocity Verlet", an accurate way to step a moving object forward.
    # One step from time t to t+h does:
    #   1. a_n      = acceleration at the current position   (passed in as 'a')
    #   2. x_new    = x + v*h + 0.5*a*h^2    (straight-line motion + gravity bend)
    #   3. a_new    = acceleration at the new position
    #   4. v_new    = v + 0.5*(a + a_new)*h  (average of old and new acceleration)
    # =====================================================================
    def verlet_step(x, v, a, t, h):
        """
        Move one object forward by one step of length h.
        Inputs:  x = current position, v = current velocity,
                a = acceleration at (x, t), t = current time, h = step length (s)
        Output:  new position, new velocity, new acceleration, new time.
        """
        # x_new: position after the step. x + v*h is where it would be with no
        #        gravity; 0.5*a*h**2 is how far gravity pulled it off that line.
        x_new = x + v*h + 0.5*a*h**2

        # a_new: acceleration at the NEW position and NEW time (planets have moved too).
        a_new = a_grav(x_new, t + h)

        # v_new: velocity after the step. Uses the average of the old and new
        #        acceleration because acceleration changes during the step.
        v_new = v + 0.5*(a + a_new)*h

        # Return a_new so the next step can reuse it as its starting 'a'
        # (avoids computing gravity twice at the same point).
        return x_new, v_new, a_new, t + h


    # n_steps: how many steps of size dt are needed to cover table_length.
    n_steps = int(round(table_length / dt))

    # The table: one row per time stamp (n_steps + 1 rows including the starting one).
    #   times:  clock time of each row (s)
    #   r_hist: debris position at each time, shape (rows, 3)
    #   v_hist: debris velocity at each time, shape (rows, 3)
    times  = np.zeros(n_steps + 1)
    r_hist = np.zeros((n_steps + 1, 3))
    v_hist = np.zeros((n_steps + 1, 3))

    # Working variables for the loop (current state of the debris):
    #   r = position, v = velocity, t = time. .copy() so the original r0, v0 are not changed.
    r, v, t = r0.copy(), v0.copy(), t0

    # a: acceleration at the starting position (needed to begin the first step).
    a = a_grav(r, t)

    # Row 0 of the table is the starting state.
    times[0], r_hist[0], v_hist[0] = t, r, v

    # TIME-STEPPING LOOP: advance the debris one step at a time and save each result.
    for n in range(n_steps):
        r, v, a, t = verlet_step(r, v, a, t, dt)
        times[n+1], r_hist[n+1], v_hist[n+1] = t, r, v

    def debris_state(t):
        """
        Look up the debris position and velocity at ANY time t.
        The table only has values at multiples of dt, so np.interp draws a straight
        line between neighboring rows to estimate values in between.
        Only valid for t between times[0] and times[-1].
        Output: (position [x,y,z], velocity [vx,vy,vz]).
        """
        # For each component k (0=x, 1=y, 2=z), interpolate that column of the table.
        r = np.array([np.interp(t, times, r_hist[:, k]) for k in range(3)])
        v = np.array([np.interp(t, times, v_hist[:, k]) for k in range(3)])
        return r, v


    # =====================================================================
    # STEP 4: FIRST-GUESS FLIGHT TIME (ignores gravity)
    # With no gravity, debris is at r0 + v0*T at time T. The interceptor travels
    # a distance u*T in a straight line. They can meet when
    #     |r0 + v0*T| = u*T
    # Squaring and collecting powers of T gives a quadratic:  A*T^2 + B*T + C = 0
    # =====================================================================
    def first_guess_time(r0, v0, u):
        """
        Input:  debris start position r0, debris velocity v0, interceptor speed u.
        Output: flight time T (s), or None if no intercept is possible.
        """
        # A: (debris speed)^2 - (interceptor speed)^2. np.dot(v0, v0) = vx^2+vy^2+vz^2.
        A = np.dot(v0, v0) - u**2

        # B: 2 * (r0 . v0). The dot product is negative when the debris moves
        #    toward the ship and positive when it moves away.
        B = 2.0 * np.dot(r0, v0)

        # C: (starting distance)^2. Never negative.
        C = np.dot(r0, r0)

        # scale: the size of the squared speeds, used to judge whether A is "tiny".
        scale = max(np.dot(v0, v0), u**2)

        # CASE A is (essentially) zero: debris speed equals interceptor speed.
        # The quadratic formula divides by 2A, which would be division by zero, so
        # the T^2 term vanishes and we solve the simple equation B*T + C = 0.
        # We compare against a tiny number, not exactly 0, because floating-point
        # math rarely produces an exact 0.
        if abs(A) < 1e-9 * scale:
            if B < 0:               # debris is approaching: a solution exists
                return -C / B
            return None             # debris moving away at equal speed: can never catch it

        # disc: the discriminant B^2 - 4AC. If negative, the square root is not a
        #       real number, meaning no real meeting time exists.
        disc = B**2 - 4*A*C
        if disc < 0:
            return None

        # root: square root of the discriminant.
        root = np.sqrt(disc)

        # candidates: the two solutions from the quadratic formula (the +/-).
        candidates = [(-B + root) / (2*A), (-B - root) / (2*A)]

        # positive: keep only solutions in the future (T > 0). Negative T is the past.
        positive = [T for T in candidates if T > 0]
        if not positive:
            return None

        # Return the smallest positive T = the earliest possible intercept.
        return min(positive)

    # T: flight time (s). From here on T is one of the three unknowns the solver adjusts.
    T = first_guess_time(r0, v0, u)
    if T is None:
        raise ValueError("No intercept possible: interceptor is too slow.")


    # =====================================================================
    # STEP 5: FIRST-GUESS AIM, CONVERTED TO ANGLES
    # Where will the debris be at time T (no gravity)? Aim at that spot.
    #     u_hat = (r0 + v0*T) / (u*T)       (a unit vector, length 1)
    # Then convert the direction into two angles, which are what the solver adjusts.
    # =====================================================================

    # u_hat: unit vector pointing from the ship toward the debris's predicted
    #        location. The top is the predicted position; u*T is its distance
    #        (by construction), so dividing gives length 1.
    u_hat = (r0 + v0*T) / (u*T)

    # theta: azimuth angle (rad). Rotation in the x-y plane measured from the +x
    #        axis. arctan2(y, x) gives the correct angle in all four quadrants.
    theta = np.arctan2(u_hat[1], u_hat[0])

    # phi: elevation angle (rad). Tilt above (+) or below (-) the x-y plane.
    #      np.clip keeps the input of arcsin inside [-1, 1] (rounding error could
    #      push it slightly outside, which would give an error).
    phi = np.arcsin(np.clip(u_hat[2], -1, 1))


    # =====================================================================
    # STEP 6: ANGLES -> LAUNCH VELOCITY
    #     u_hat(theta, phi) = (cos(phi)cos(theta), cos(phi)sin(theta), sin(phi))
    #     launch velocity   = u * u_hat
    # =====================================================================
    def launch_velocity(theta, phi):
        """
        Input:  azimuth theta and elevation phi (radians).
        Output: launch velocity vector [vx, vy, vz] (m/s), with length u.
        """
        # direction: unit vector (length 1) for these angles.
        #   x part: cos(phi)*cos(theta)   y part: cos(phi)*sin(theta)   z part: sin(phi)
        direction = np.array([np.cos(phi)*np.cos(theta),
                            np.cos(phi)*np.sin(theta),
                            np.sin(phi)])
        # Multiply direction by speed to get a velocity vector.
        return u * direction


    # =====================================================================
    # STEP 7: SIMULATE THE INTERCEPTOR FOR TIME T
    # "If I fire at (theta, phi), where am I after T seconds, with planets pulling?"
    # Uses the same verlet_step as the debris.
    # This runs MANY times: once per Newton pass, plus twice more for the Jacobian.
    # =====================================================================
    def propagate(theta, phi, T):
        """
        Input:  launch angles theta, phi (rad) and flight time T (s).
        Output: X = interceptor position at time t0+T (m),
                V = interceptor velocity at time t0+T (m/s).
        """
        # x: interceptor position. Starts at the ship, the origin.
        x = np.zeros(3)

        # v: interceptor velocity. Starts as the launch velocity for these angles.
        v = launch_velocity(theta, phi)

        # t: current time in this simulation. Starts at launch time.
        t = t0

        # a: acceleration at the starting point (needed for the first step).
        a = a_grav(x, t)

        # n_full: number of whole dt-sized steps that fit inside T.
        n_full = int(T // dt)

        # leftover: the remaining fraction of a step so the total is exactly T.
        leftover = T - n_full * dt

        # step_sizes: list of step lengths: n_full steps of dt, then one short step.
        step_sizes = [dt] * n_full
        if leftover > 1e-12:               # skip a pointless, vanishingly small step
            step_sizes.append(leftover)

        # TIME-STEPPING LOOP for the interceptor. h = this step's length.
        for h in step_sizes:
            x, v, a, t = verlet_step(x, v, a, t, h)

        return x, v   # position and velocity at time t0 + T


    # =====================================================================
    # STEPS 8-11: THE NEWTON LOOP
    # Three unknowns (theta, phi, T) and three equations (the x, y, z components
    # of the miss must all be zero). Each pass:
    #   Step 8   measure the miss vector e
    #   Step 9   build the Jacobian J (how e changes if each unknown changes)
    #   Step 10  solve J*delta = e and correct the unknowns
    #   Step 11  repeat until the miss is small
    # =====================================================================

    # eps: the tiny nudge (rad) used to estimate how the result changes with an angle.
    #      Too large = crude estimate. Too small = rounding error dominates.
    eps = 1e-6

    # max_iter: safety limit so the loop cannot run forever if it fails to converge.
    max_iter = 20

    # converged: becomes True if we reach the tolerance.
    converged = False

    for iteration in range(max_iter):

        # Safety check: T must be positive and the debris table must extend to t0+T,
        # otherwise debris_state() would return wrong values.
        if T <= 0 or t0 + T > times[-1]:
            raise ValueError("Estimated intercept time is outside the precomputed debris path.")

        # --- Step 7: simulate the current guess ---
        # X: where the interceptor ends up. V: its velocity there.
        X, V = propagate(theta, phi, T)

        # --- Step 8: miss vector ---
        # r_d, v_d: debris position and velocity at the same moment t0+T.
        r_d, v_d = debris_state(t0 + T)

        # e: miss vector = interceptor position - debris position (3 components).
        #    e = [0, 0, 0] would be a perfect hit.
        e = X - r_d

        # miss: the length of e, i.e. how far apart they are (m).
        miss = np.linalg.norm(e)
        # Stopping rule: close enough, so leave the loop.
        if miss < tol:
            converged = True
            break

        # --- Step 9: Jacobian ---
        # Re-simulate with theta nudged by eps. The endpoint X_th differs slightly
        # from X. (The "_" discards the velocity, which we don't need here.)
        X_th, _ = propagate(theta + eps, phi, T)

        # Same, with phi nudged by eps.
        X_ph, _ = propagate(theta, phi + eps, T)

        # J: 3x3 matrix. Each column says how the miss vector changes per unit
        #    change in one unknown.
        #   column 1: d e / d theta  = (change in endpoint) / eps
        #   column 2: d e / d phi    = (change in endpoint) / eps
        #   column 3: d e / d T      = V - v_d  (letting the flight run slightly
        #             longer moves the interceptor by V and the debris by v_d)
        # The debris position doesn't depend on the angles, so only the
        # interceptor's endpoint appears in the first two columns.
        J = np.column_stack([
            (X_th - X) / eps,
            (X_ph - X) / eps,
            V - v_d,
        ])

        # --- Step 10: Newton update ---
        # delta: the correction (d_theta, d_phi, d_T) that would cancel the current
        #        miss if the response were perfectly linear. Found by solving
        #        J * delta = e (better than inverting J: faster and more stable).
        try:
            delta = np.linalg.solve(J, e)
        except np.linalg.LinAlgError as exc:
            raise ValueError("The solver could not find a stable interception correction.") from exc

        # Apply the correction by subtracting it. It is only approximate (the real
        # response is curved), which is why the loop repeats.
        theta, phi, T = theta - delta[0], phi - delta[1], T - delta[2]

    # If the loop ended by running out of iterations, tell the user.
    # =====================================================================
    # STEP 12: FINAL ANSWERS
    # =====================================================================

    X, V = propagate(theta, phi, T)
    r_hit, v_hit = debris_state(t0 + T)
    miss = np.linalg.norm(X - r_hit)

    # fire_direction: unit vector showing where to aim the interceptor.
    fire_direction = launch_velocity(theta, phi) / u

    # launch_vel: velocity vector the interceptor leaves with (speed u).
    launch_vel = u * fire_direction

    # impact_velocity: interceptor velocity relative to the debris at impact
    #                  (V is the velocity from the last propagate()).
    impact_velocity = V - v_hit

    return {
        "converged": bool(converged),
        "missDistance": float(miss),
        "fireDirection": fire_direction.tolist(),
        "launchVelocity": launch_vel.tolist(),
        "flightTime": float(T),
        "interceptPoint": r_hit.tolist(),
        "impactVelocity": impact_velocity.tolist(),
    }
