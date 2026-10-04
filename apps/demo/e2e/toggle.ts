import { expect } from "@playwright/test";
import type { Locator } from "@playwright/test";

/**
 * Turns a toggle button (`aria-pressed`) on or off, and waits until it shows that state. A press
 * before hydration does nothing, so it presses again until the state sticks. Pressing a button of
 * a toggle group that is already on keeps it on, so `on: true` also picks a group's option.
 */
export const setPressed = async (button: Locator, on: boolean) => {
  const wanted = String(on);
  await expect(async () => {
    if ((await button.getAttribute("aria-pressed")) !== wanted) {
      await button.click();
    }
    await expect(button).toHaveAttribute("aria-pressed", wanted, {
      timeout: 1000,
    });
  }).toPass();
};
