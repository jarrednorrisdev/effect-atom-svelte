import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

// The hosted site has no demo API server: the build runs the API in the page instead
// (src/lib/in-tab-api.ts). Alchemy runs the Vite build in this process, so it reads this.
process.env.VITE_DEMO_API = "in-tab";

/** The docs site, on Jarred's Cloudflare account. Prerendered pages are served as static assets. */
export const Website = Cloudflare.Website.SvelteKit("Website", {
  domain: "atom.jarrednorris.dev",
  memo: {
    // The build reads the library's and the demo domain's source too, so a change to either
    // deploys again.
    include: [
      "**/*",
      "../../packages/effect-atom-svelte/src/**",
      "../../packages/effect-atom-svelte/package.json",
      "../../packages/demo-domain/src/**",
      "../../packages/demo-domain/package.json",
    ],
    lockfile: true,
  },
});

export default Alchemy.Stack(
  "effect-atom-svelte",
  {
    providers: Cloudflare.providers(),
    // Kept on Cloudflare, so CI's deploys share it.
    state: Cloudflare.state(),
  },
  Effect.gen(function* deploy() {
    const site = yield* Website;
    return { url: site.url };
  })
);
