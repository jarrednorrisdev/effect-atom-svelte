/**
 * An attachment that fades an element up the first time it scrolls into view, once. Anything
 * already on screen when the page loads stays as it is, so nothing visible blinks out at
 * hydration, and under `prefers-reduced-motion` nothing moves.
 *
 * ```svelte
 * <section {@attach reveal}>…</section>
 * ```
 */

import { animate } from "motion";
import type { Attachment } from "svelte/attachments";

import { reducedMotion } from "#lib/docs/kit/motion.ts";

export const reveal: Attachment<HTMLElement> = (element) => {
  if (
    reducedMotion() ||
    element.getBoundingClientRect().top < window.innerHeight
  ) {
    return;
  }
  element.style.opacity = "0";
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) {
        return;
      }
      observer.disconnect();
      animate(
        element,
        { opacity: [0, 1], y: [16, 0] },
        {
          duration: 0.5,
          ease: [0.2, 0.7, 0.2, 1],
          // Leave no transform behind: the reason's sticky prose sits inside.
          onComplete: () => {
            element.style.removeProperty("opacity");
            element.style.removeProperty("transform");
          },
        }
      );
    },
    // Everything above the viewport counts as seen, so a fast scroll or a jump to a link further
    // down can't skip past an element and leave it hidden.
    { rootMargin: "100000px 0px -15% 0px" }
  );
  observer.observe(element);
  return () => observer.disconnect();
};
