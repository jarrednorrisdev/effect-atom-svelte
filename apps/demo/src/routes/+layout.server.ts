import { preferencePrefix } from "#lib/preferences.ts";

import type { LayoutServerLoad } from "./$types";

// Only preference cookies reach the page: page data is embedded in the HTML, so passing every
// cookie would expose HttpOnly ones to scripts.
export const load: LayoutServerLoad = ({ cookies }) => ({
  preferenceCookies: Object.fromEntries(
    cookies
      .getAll()
      .filter(({ name }) => name.startsWith(preferencePrefix))
      .map(({ name, value }) => [name, value])
  ),
});
