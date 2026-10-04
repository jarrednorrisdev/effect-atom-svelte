/**
 * Counts how many times a function ran, for the "derived atom or transform" example. The functions
 * run while Svelte renders, where state must not change, so each run is counted on a microtask.
 */
export class Runs {
  count = $state(0);

  add() {
    queueMicrotask(() => {
      this.count += 1;
    });
  }
}
