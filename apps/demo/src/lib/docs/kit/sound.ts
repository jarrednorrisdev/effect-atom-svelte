/**
 * Short synthesized sounds for the live examples, after effect.kitlangton.com's (which uses
 * Tone.js; this is the same idea in plain Web Audio, so there is nothing to download). Each cue is
 * one or two notes from a pentatonic scale with a soft envelope and a little reverb, quiet enough
 * to sit under a click.
 *
 * ```ts
 * import { play } from "#lib/docs/kit/sound.ts";
 *
 * play("success");
 * ```
 *
 * Nothing plays while sound is off (the header toggle, `sound-preference.ts`), nor before the
 * visitor has interacted with the page. The `AudioContext` is created by the first cue that plays,
 * which is always in answer to a click.
 */

import { isSoundOn } from "../sound-preference.ts";

/**
 * The cues, by what happened:
 *
 * - `tap`: a control was pressed (Example plays it for every button and checkbox).
 * - `start`: something started running (a Run or Play control).
 * - `success`: something finished with a value. Successive successes climb the scale.
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

interface Note {
  /** Seconds after the cue starts. */
  readonly at: number;
  /** Seconds the note holds before it releases. */
  readonly hold: number;
  readonly hz: number;
  readonly release: number;
  readonly type: OscillatorType;
  readonly volume: number;
}

// C D E G A: any two of them sound fine together, so cues never clash.
const pentatonic = [0, 2, 4, 7, 9];
const c4 = 261.63;
const pitch = (step: number, octave: number) => {
  const semitones = pentatonic[step % pentatonic.length] ?? 0;
  const octaves = octave - 4 + Math.floor(step / pentatonic.length);
  return c4 * 2 ** (octaves + semitones / 12);
};

// Walks up the scale, so repeated taps and successes form a little tune instead of one note.
let walk = 0;
const nextStep = () => {
  walk = (walk + 1) % (pentatonic.length * 2);
  return walk;
};

const notes = (cue: Cue): readonly Note[] => {
  switch (cue) {
    case "tap": {
      const hz = pitch(nextStep(), 5);
      return [
        { at: 0, hold: 0.02, hz, release: 0.06, type: "sine", volume: 0.22 },
      ];
    }
    case "start": {
      const hz = pitch(nextStep(), 4);
      return [
        { at: 0, hold: 0.04, hz, release: 0.1, type: "sine", volume: 0.3 },
      ];
    }
    case "tick": {
      return [
        {
          at: 0,
          hold: 0.01,
          hz: pitch(2, 6),
          release: 0.04,
          type: "sine",
          volume: 0.15,
        },
      ];
    }
    case "success": {
      const step = nextStep();
      return [
        {
          at: 0,
          hold: 0.12,
          hz: pitch(step, 4),
          release: 0.5,
          type: "triangle",
          volume: 0.35,
        },
        {
          at: 0.07,
          hold: 0.12,
          hz: pitch(step + 2, 4),
          release: 0.6,
          type: "triangle",
          volume: 0.3,
        },
      ];
    }
    case "failure": {
      return [
        {
          at: 0,
          hold: 0.1,
          hz: pitch(4, 2),
          release: 0.35,
          type: "sawtooth",
          volume: 0.3,
        },
        {
          at: 0.12,
          hold: 0.16,
          hz: pitch(0, 2),
          release: 0.5,
          type: "sawtooth",
          volume: 0.3,
        },
      ];
    }
    case "interrupt": {
      return [
        {
          at: 0,
          hold: 0.03,
          hz: pitch(0, 5),
          release: 0.04,
          type: "triangle",
          volume: 0.3,
        },
        {
          at: 0.07,
          hold: 0.03,
          hz: pitch(2, 5),
          release: 0.04,
          type: "triangle",
          volume: 0.3,
        },
      ];
    }
    case "reset": {
      return [
        {
          at: 0,
          hold: 0.05,
          hz: pitch(3, 3),
          release: 0.12,
          type: "sine",
          volume: 0.35,
        },
        {
          at: 0.1,
          hold: 0.05,
          hz: pitch(0, 3),
          release: 0.12,
          type: "sine",
          volume: 0.35,
        },
      ];
    }
    default: {
      return [];
    }
  }
};

interface Output {
  readonly context: AudioContext;
  readonly input: AudioNode;
}

let output: Output | undefined;

/** A decaying noise burst, which a convolver turns into a small room. */
const impulse = (context: AudioContext, seconds: number) => {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
};

const open = (): Output => {
  if (output) {
    return output;
  }
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.25;
  master.connect(context.destination);
  // Softens the sawtooth of the failure cue and any harshness in the others.
  const filter = context.createBiquadFilter();
  filter.frequency.value = 2400;
  filter.connect(master);
  const reverb = context.createConvolver();
  reverb.buffer = impulse(context, 1.2);
  const wet = context.createGain();
  wet.gain.value = 0.3;
  filter.connect(reverb).connect(wet).connect(master);
  output = { context, input: filter };
  return output;
};

const schedule = ({ context, input }: Output, start: number, note: Note) => {
  const at = start + note.at;
  const oscillator = context.createOscillator();
  oscillator.type = note.type;
  oscillator.frequency.value = note.hz;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(note.volume, at + 0.005);
  gain.gain.setValueAtTime(note.volume, at + note.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + note.hold + note.release);
  oscillator.connect(gain).connect(input);
  oscillator.start(at);
  oscillator.stop(at + note.hold + note.release + 0.05);
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
    const out = open();
    if (out.context.state === "suspended") {
      void out.context.resume();
    }
    for (const note of notes(cue)) {
      schedule(out, out.context.currentTime + 0.01, note);
    }
  } catch {
    // No Web Audio (or it was refused): the examples work the same without sound.
  }
};
