/**
 * The synths behind `sound.ts`, built with Tone.js on the settings of effect.kitlangton.com's
 * `TaskSounds`: the same oscillators, envelopes, notes and reverb, routed through a volume at
 * -12 dB. Only `sound.ts` imports this, dynamically, so Tone.js loads on the first cue that plays.
 */

import * as Tone from "tone";

import type { Cue } from "./sound.ts";

/** Ignores a rejection: Firefox rejects audio calls when the click also leaves the page. */
const quietly = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch {
    // The cue is simply not heard.
  }
};

export interface Engine {
  readonly play: (cue: Cue) => void;
  /** `Tone.start()`: call it inside every gesture that plays a cue. */
  readonly start: () => void;
}

// C D E G A: any two of them sound fine together, so overlapping cues never clash.
const scale = ["C", "D", "E", "G", "A"] as const;
const baseOctave = 3;
// Notes within this many milliseconds of each other are voiced as one chord.
const chordWindowMs = 100;
const triad = [0, 4, 7] as const;

const synth = (
  oscillator: Tone.ToneOscillatorType,
  envelope: Partial<Tone.EnvelopeOptions>
) =>
  new Tone.PolySynth(Tone.Synth, {
    envelope,
    oscillator: { type: oscillator },
  } as Partial<Tone.SynthOptions>);

/** Builds the synths on the context that `sound.ts` started inside the first gesture. */
export const createEngine = (context: AudioContext): Engine => {
  // No look-ahead: a cue answers a click, so it plays now rather than 0.1 s later. The old
  // context isn't disposed: Firefox throws "Can't close an AudioContext twice" when it is.
  Tone.setContext(new Tone.Context({ context, lookAhead: 0 }));

  const volume = new Tone.Volume(-12).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(volume);
  const synths = {
    bass: synth("sawtooth", {
      attack: 0.02,
      decay: 0.4,
      release: 0.8,
      sustain: 0.1,
    }),
    config: synth("triangle", {
      attack: 0.001,
      decay: 0.05,
      release: 0.05,
      sustain: 0,
    }),
    interrupt: synth("triangle", {
      attack: 0.001,
      decay: 0.08,
      release: 0.04,
      sustain: 0,
    }),
    refUpdate: synth("sine", {
      attack: 0.001,
      decay: 0.04,
      release: 0.04,
      sustain: 0,
    }),
    reset: synth("sine", {
      attack: 0.004,
      decay: 0.18,
      release: 0.12,
      sustain: 0,
    }),
    running: synth("sine", {
      attack: 0.002,
      decay: 0.08,
      release: 0.1,
      sustain: 0,
    }),
    success: synth("triangle", {
      attack: 0.02,
      decay: 0.3,
      release: 1.2,
      sustain: 0.1,
    }),
  };
  for (const voice of Object.values(synths)) {
    voice.connect(reverb);
  }

  // Walks the scale, so repeated cues form a little tune instead of one note, and notes that
  // land together (two counters, two boundaries) form a chord.
  let noteIndex = 0;
  let chordStart: number | undefined;
  let chordStep = 0;
  let chordRoot = 0;
  let chordOctave = baseOctave;

  const enterChord = (octave: number) => {
    const now = Date.now();
    if (chordStart === undefined || now - chordStart > chordWindowMs) {
      chordStart = now;
      chordStep = 0;
      chordRoot = noteIndex % scale.length;
      chordOctave = octave;
    }
  };
  const advance = () => {
    chordStep += 1;
    noteIndex = (noteIndex + 1) % (scale.length * 2);
  };
  const nextNote = (octave: number) => {
    enterChord(octave);
    const note = `${scale[(chordRoot + chordStep) % scale.length]}${chordOctave}`;
    advance();
    return note;
  };
  const nextTriadNote = () => {
    enterChord(baseOctave + 1);
    const root = `${scale[chordRoot]}${chordOctave}`;
    const note = Tone.Frequency(root)
      .transpose(triad[chordStep % triad.length] ?? 0)
      .toNote();
    advance();
    return note;
  };

  const play = (cue: Cue) => {
    const now = Tone.now();
    switch (cue) {
      case "tap": {
        synths.config.triggerAttackRelease(nextNote(5), "16n", now, 0.6);
        break;
      }
      case "start": {
        synths.running.triggerAttackRelease(nextNote(4), "32n", now, 0.25);
        break;
      }
      case "tick": {
        synths.refUpdate.triggerAttackRelease("E6", "64n", now, 0.35);
        break;
      }
      case "success": {
        synths.success.triggerAttackRelease(nextTriadNote(), "4n", now);
        break;
      }
      case "failure": {
        const note = `${scale[noteIndex % scale.length]}${baseOctave - 1}`;
        noteIndex = (noteIndex + 1) % scale.length;
        synths.bass.triggerAttackRelease(note, "4n", now, 0.65);
        break;
      }
      case "interrupt": {
        // Two quick rising beeps, an alert.
        synths.interrupt.triggerAttackRelease("C5", "32n", now, 0.6);
        synths.interrupt.triggerAttackRelease("E5", "32n", now + 0.07, 0.6);
        break;
      }
      case "reset": {
        // G down to C, back to the start.
        synths.reset.triggerAttackRelease(`G${baseOctave}`, "16n", now, 0.6);
        synths.reset.triggerAttackRelease(
          `C${baseOctave}`,
          "16n",
          now + 0.1,
          0.6
        );
        break;
      }
      default: {
        break;
      }
    }
  };

  return {
    play,
    start: () => {
      void quietly(Tone.start());
    },
  };
};
