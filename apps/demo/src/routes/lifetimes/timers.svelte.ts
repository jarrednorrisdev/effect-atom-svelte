/**
 * `setInterval` and `clearInterval` for the finalizers example, recording each timer so the
 * example can draw it: how often it ticks, how many times it has, and whether it was stopped.
 * Writes are deferred a microtask, because the atom starts a timer while Svelte reads it.
 */

export interface Timer {
  readonly every: number;
  readonly id: number;
  stopped: boolean;
  ticks: number;
}

export const timers: Timer[] = $state([]);

const handles = new Map<number, ReturnType<typeof setInterval>>();
let next = 0;

/** Starts a timer that calls `tick` every `every` ms, and returns its id. */
export const startTimer = (tick: () => void, every: number): number => {
  next += 1;
  const id = next;
  queueMicrotask(() => timers.push({ every, id, stopped: false, ticks: 0 }));
  handles.set(
    id,
    setInterval(() => {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) {
        timer.ticks += 1;
      }
      tick();
    }, every)
  );
  return id;
};

/** Stops a timer started with `startTimer`. */
export const stopTimer = (id: number) => {
  clearInterval(handles.get(id));
  handles.delete(id);
  queueMicrotask(() => {
    const timer = timers.find((entry) => entry.id === id);
    if (timer) {
      timer.stopped = true;
    }
  });
};

/** Stops every timer, leaked ones included, and forgets them. */
export const resetTimers = () => {
  for (const handle of handles.values()) {
    clearInterval(handle);
  }
  handles.clear();
  timers.length = 0;
};
