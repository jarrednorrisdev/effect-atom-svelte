/**
 * A scripted story for Play / Restart: steps that run at set times after Play, as in Effect's
 * Module of the Week simulations. The steps change the example's own state (write atoms, add log
 * entries); the simulation only schedules them.
 *
 * ```ts
 * const sim = new Simulation({
 *   reset: () => registry.reset(),
 *   steps: [
 *     { at: 0, run: () => mount("A") },
 *     { at: 800, run: () => mount("B") },
 *     { at: 2000, run: () => unmount("A") },
 *   ],
 * });
 * $effect(() => () => sim.stop());
 * ```
 *
 * Pass `sim.playing` to `PlayControls`. Call `stop()` when the component goes away, so no step
 * runs after it.
 */

export interface Step {
  /** Milliseconds after Play. */
  readonly at: number;
  readonly run: () => void;
}

export interface SimulationOptions {
  /** Puts the example back to how it was before the first step. */
  readonly reset: () => void;
  readonly steps: readonly Step[];
}

export class Simulation {
  /** True from Play until the last step has run. */
  playing = $state(false);
  /** True once the last step has run, until Restart. */
  finished = $state(false);

  readonly #options: SimulationOptions;
  #timers: ReturnType<typeof setTimeout>[] = [];

  constructor(options: SimulationOptions) {
    this.#options = options;
  }

  /** Runs the steps from the start. Does nothing while already playing. */
  play() {
    if (this.playing) {
      return;
    }
    if (this.finished) {
      this.#options.reset();
    }
    this.playing = true;
    this.finished = false;
    const last = Math.max(0, ...this.#options.steps.map((step) => step.at));
    this.#timers = this.#options.steps.map((step) =>
      setTimeout(step.run, step.at)
    );
    this.#timers.push(
      setTimeout(() => {
        this.playing = false;
        this.finished = true;
      }, last)
    );
  }

  /** Stops, resets and plays again. */
  restart() {
    this.stop();
    this.#options.reset();
    this.finished = false;
    this.play();
  }

  /** Cancels the steps still to come, leaving the example as it is. */
  stop() {
    for (const timer of this.#timers) {
      clearTimeout(timer);
    }
    this.#timers = [];
    this.playing = false;
  }
}
