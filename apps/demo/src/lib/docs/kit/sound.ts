/**
 * Short synthesized sounds for the live examples, made with Tone.js as on effect.kitlangton.com:
 * the same synths and notes (`sound-engine.ts`), a pentatonic scale so cues never clash, and a
 * little reverb, quiet enough to sit under a click.
 *
 * ```ts
 * import { play } from "#lib/docs/kit/sound.ts";
 *
 * play("success");
 * ```
 *
 * Tone.js is large, so this module is small and loads it only when a cue first plays: never with
 * the page, never while sound is off (the header toggle, `sound-preference.ts`), and never before
 * the visitor has interacted with the page. The first cue is always in answer to a click, so it
 * starts the audio inside that click, as browsers require: before Tone.js has loaded, by resuming a
 * plain `AudioContext` that Tone.js then adopts, and afterwards by calling `Tone.start()`.
 */

import { isSoundOn } from "../sound-preference.ts";
import type { Engine } from "./sound-engine.ts";

/**
 * The cues, by what happened:
 *
 * - `tap`: a control was pressed (Example plays it for every button and checkbox).
 * - `start`: something started running (a Run or Play control).
 * - `success`: something finished with a value. Successes close together form a chord.
 * - `failure`: something failed.
 * - `interrupt`: something was stopped before it finished.
 * - `reset`: back to the start.
 * - `tick`: a small step, such as a stream item or a counter changing on its own.
 */
export type Cue =
  | "failure"
  | "interrupt"
  | "reset"
  | "start"
  | "success"
  | "tap"
  | "tick";

let engine: Engine | undefined;
let loading: Promise<Engine> | undefined;
// The context the first gesture starts, before Tone.js is there to start its own.
let context: AudioContext | undefined;
// A cue that waited longer than this for Tone.js to load is dropped: a late sound is worse than
// none.
const staleMs = 400;

/** Ignores a rejection: Firefox rejects audio calls when the click also leaves the page. */
const quietly = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch {
    // The cue is simply not heard.
  }
};

/** Starts the audio. Must run inside the gesture (click, key or tap) that asked for sound. */
const unlock = () => {
  if (engine) {
    engine.start();
    return;
  }
  context ??= new AudioContext({ latencyHint: "interactive" });
  if (context.state === "suspended") {
    void quietly(context.resume());
  }
};

/** Loads Tone.js and builds the synths, once. */
const build = async (): Promise<Engine> => {
  try {
    // Tone.js prints its version to the console when it loads; the docs don't need that.
    Object.assign(window, { TONE_SILENCE_LOGGING: true });
    const { createEngine } = await import("./sound-engine.ts");
    context ??= new AudioContext({ latencyHint: "interactive" });
    try {
      engine = createEngine(context);
    } catch {
      // Firefox's Tone.js rejects a context it didn't make ("param must be an AudioParam"), so
      // it makes its own. The visitor's earlier click lets that one start outside the gesture.
      engine = createEngine();
      engine.start();
    }
    return engine;
  } catch (error) {
    // A failed download leaves the examples silent; the next cue tries again.
    loading = undefined;
    throw error;
  }
};

/** Loads Tone.js and builds the synths, once. */
const load = (): Promise<Engine> => {
  loading ??= build();
  return loading;
};

const preload = async () => {
  try {
    await load();
  } catch {
    // Tone.js didn't load; the next cue tries again.
  }
};

/** Plays a cue once Tone.js has loaded, unless that took too long or sound went off meanwhile. */
const playWhenLoaded = async (cue: Cue, requested: number) => {
  try {
    const loaded = await load();
    if (performance.now() - requested < staleMs && isSoundOn()) {
      loaded.play(cue);
    }
  } catch {
    // Tone.js didn't load: this cue is skipped.
  }
};

/**
 * Starts loading Tone.js early, on a pointer or key press in an example, so the click's own cue
 * isn't late. Does nothing while sound is off.
 */
export const warm = () => {
  if (typeof window === "undefined" || !isSoundOn() || engine) {
    return;
  }
  try {
    unlock();
    void preload();
  } catch {
    // No Web Audio: the examples work the same without sound.
  }
};

// The same cue twice within this many milliseconds plays once (two readers of one change, say).
const debounceMs = 40;
const lastPlayed = new Map<Cue, number>();

/** Whether the visitor has clicked, tapped or typed on this page; browsers block audio before. */
const activated = () => navigator.userActivation?.hasBeenActive ?? true;

/** Plays a cue, unless sound is off or the visitor hasn't interacted with the page yet. */
export const play = (cue: Cue) => {
  if (typeof window === "undefined" || !isSoundOn() || !activated()) {
    return;
  }
  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? Number.NEGATIVE_INFINITY) < debounceMs) {
    return;
  }
  lastPlayed.set(cue, now);
  try {
    unlock();
    if (engine) {
      engine.play(cue);
      return;
    }
    void playWhenLoaded(cue, now);
  } catch {
    // No Web Audio (or it was refused): the examples work the same without sound.
  }
};
