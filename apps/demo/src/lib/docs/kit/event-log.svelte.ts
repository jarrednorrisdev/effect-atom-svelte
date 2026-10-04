/**
 * Timestamped entries for `EventLog` and `Timeline`: what happened, when (milliseconds since the
 * log started or was last cleared), and in which tone. Use it where timing is the point (a refresh
 * and `waiting`, reactivity keys, streams), not as a console for every example.
 *
 * ```ts
 * const log = new EventLogState();
 * log.add("refresh started", { tone: "running" });
 * log.add("resolved with 4", { lane: "suspendOnWaiting", tone: "success" });
 * log.clear();
 * ```
 */

import { untrack } from "svelte";

import type { Tone } from "./tone.ts";

export interface LogEntry {
  /** Milliseconds since the log started or was last cleared, rounded. */
  readonly at: number;
  readonly id: number;
  readonly label: string;
  /** Which row of a Timeline the entry belongs to, such as one boundary out of two. */
  readonly lane?: string;
  readonly tone: Tone;
}

export interface EntryOptions {
  readonly lane?: string;
  readonly tone?: Tone;
}

export class EventLogState {
  entries = $state<readonly LogEntry[]>([]);

  readonly #limit: number;
  #nextId = 0;
  #start: number | undefined;

  /** Keeps the most recent `limit` entries (50 by default). */
  constructor({ limit = 50 }: { limit?: number } = {}) {
    this.#limit = limit;
  }

  /** Adds an entry. The first entry after creating or clearing the log is at 0 ms. */
  add(label: string, { lane, tone = "idle" }: EntryOptions = {}) {
    const now = performance.now();
    this.#start ??= now;
    this.#nextId += 1;
    const entry: LogEntry = {
      at: Math.round(now - this.#start),
      id: this.#nextId,
      label,
      tone,
      ...(lane === undefined ? {} : { lane }),
    };
    // Untracked, so an atom's effect may log while Svelte reads the atom (in markup or a
    // `$derived`), such as a resource being acquired when the effect starts. Svelte rejects a
    // tracked state change there (`state_unsafe_mutation`).
    untrack(() => {
      this.entries = [...this.entries, entry].slice(-this.#limit);
    });
  }

  /** Empties the log; the next entry is at 0 ms again. */
  clear() {
    untrack(() => {
      this.entries = [];
    });
    this.#start = undefined;
  }
}
