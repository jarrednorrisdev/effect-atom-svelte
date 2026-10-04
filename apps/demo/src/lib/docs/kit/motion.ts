/**
 * The kit's motion, with Motion (`animate`, springs, `stagger`) as on effect.kitlangton.com, and
 * the Svelte attachments that drive it. Kit components use these; an example's own code never
 * needs to.
 *
 * ```svelte
 * <script lang="ts">
 *   import { animate } from "motion";
 *   import { enter, onChange, reducedMotion, springs } from "./motion.ts";
 *
 *   // Pops the element whenever `value` changes (not on first render).
 *   const pop = onChange(
 *     () => value,
 *     (element) => {
 *       if (!reducedMotion()) {
 *         animate(element, { scale: [0.85, 1] }, springs.bouncy);
 *       }
 *     }
 *   );
 * </script>
 *
 * <span {@attach pop}>{value}</span>
 * <li {@attach enter()}>…</li>
 * ```
 *
 * Every animation is short and explains a change. Under `prefers-reduced-motion` nothing moves:
 * check `reducedMotion()` before animating position, scale or rotation (color may still change),
 * and `enter` and `jitter` do nothing.
 */

import { animate, stagger } from "motion";
import type { AnimationPlaybackControls, DOMKeyframesDefinition } from "motion";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

/** The springs of effect.kitlangton.com's `animations.ts`. */
export const springs = {
  /** A result arriving: a quick overshoot that settles. */
  bouncy: { bounce: 0.3, type: "spring", visualDuration: 0.5 },
  /** The content of a tile that just completed. */
  contentScale: {
    bounce: 0.3,
    damping: 18,
    stiffness: 260,
    type: "spring",
    visualDuration: 0.5,
  },
  /** General movement. */
  default: { damping: 25, mass: 0.8, stiffness: 180, type: "spring" },
  /** Small, fast things: a value ticking, a dot landing. */
  snappy: { bounce: 0.4, type: "spring", visualDuration: 0.3 },
} as const;

/** Whether the reader asked for less motion. Read it when animating, so a change applies at once. */
export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * An attachment that calls `react` each time `read()` returns a new value, but not on first
 * render, so a page's own load doesn't animate. `react` gets the element, the new value and the
 * old one; it runs untracked.
 */
export const onChange = <T, E extends Element = HTMLElement>(
  read: () => T,
  react: (element: E, now: T, before: T) => void
): Attachment<E> => {
  let seen = false;
  let before: T;
  return (element) => {
    const now = read();
    if (!seen) {
      seen = true;
      before = now;
      return;
    }
    if (Object.is(now, before)) {
      return;
    }
    const was = before;
    before = now;
    untrack(() => react(element, now, was));
  };
};

// Elements that mounted in the same frame enter together, one after another.
let arriving: { element: Element; keyframes: DOMKeyframesDefinition }[] = [];

const flush = () => {
  const batch = arriving;
  arriving = [];
  // Elements with the same keyframes stagger as one group.
  const groups = new Map<string, typeof batch>();
  for (const entry of batch) {
    const key = JSON.stringify(entry.keyframes);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const entries of groups.values()) {
    animate(
      entries.map((entry) => entry.element),
      entries[0]?.keyframes ?? {},
      { ...springs.snappy, delay: stagger(0.05) }
    );
  }
};

/**
 * An attachment that animates an element in when it mounts (a log entry sliding in, a dot
 * landing), staggered with others mounting at the same time. Nothing moves with reduced motion.
 */
export const enter =
  (keyframes?: DOMKeyframesDefinition): Attachment =>
  (element) => {
    if (reducedMotion()) {
      return;
    }
    if (arriving.length === 0) {
      queueMicrotask(flush);
    }
    arriving.push({
      element,
      keyframes: keyframes ?? { opacity: [0, 1], y: [-6, 0] },
    });
  };

/** A random offset between `-range / 2` and `range / 2`. */
const nudge = (range: number) => (Math.random() - 0.5) * range;

/** -1 or 1, at random. */
const sign = () => (Math.random() < 0.5 ? -1 : 1);

/**
 * Shakes an element as effect.kitlangton.com shakes a failed effect: a few quick random nudges,
 * then back to rest. Does nothing with reduced motion.
 */
export const shake = async (
  element: Element,
  { count = 6, intensity = 8, rotation = 8 } = {}
) => {
  if (reducedMotion()) {
    return;
  }
  for (let index = 0; index < count; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each nudge starts where the last one ended
    await animate(
      element,
      { rotate: nudge(rotation), x: nudge(intensity), y: nudge(intensity) },
      { duration: 0.08, ease: "easeInOut" }
    );
  }
  await animate(
    element,
    { rotate: 0, x: 0, y: 0 },
    { duration: 0.3, ease: "easeOut" }
  );
};

/**
 * Shows that a press was refused (a `blocked` cue): the control flashes the failure color, through
 * `data-blocked` and the `.demo` styles in app.css, and shakes its head from side to side. With
 * reduced motion it only flashes.
 */
export const refuse = (element: HTMLElement) => {
  element.dataset.blocked = "";
  setTimeout(() => delete element.dataset.blocked, 400);
  if (reducedMotion()) {
    return;
  }
  animate(element, { x: [0, -5, 5, -4, 4, -2, 0] }, { duration: 0.4, ease: "easeInOut" });
};

/**
 * Jitters an element while something runs, as effect.kitlangton.com's running effects do: small
 * random tilts and nudges until the returned function is called, which settles it back. Use it in
 * an attachment and return the stop function as its cleanup. Does nothing with reduced motion.
 */
export const jitter = (
  element: Element,
  { angle = 2, offset = 1 } = {}
): (() => void) => {
  if (reducedMotion()) {
    return () => undefined;
  }
  const stopped = new AbortController();
  let current: AnimationPlaybackControls | undefined;
  const loop = async () => {
    while (!stopped.signal.aborted) {
      current = animate(
        element,
        {
          rotate: (Math.random() * angle + 0.5) * sign(),
          x: (Math.random() * offset + 0.5) * sign(),
          y: (Math.random() * offset * 0.4 + 0.1) * sign(),
        },
        { duration: 0.1 + Math.random() * 0.1, ease: "easeInOut" }
      );
      // oxlint-disable-next-line no-await-in-loop -- each tilt starts where the last one ended
      await current;
    }
  };
  void loop();
  return () => {
    stopped.abort();
    current?.stop();
    animate(
      element,
      { rotate: 0, x: 0, y: 0 },
      { duration: 0.3, ease: [0.4, 0, 0.6, 1] }
    );
  };
};
