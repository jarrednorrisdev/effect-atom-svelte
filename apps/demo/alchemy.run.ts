import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

// Jarred's work deploys also use Alchemy on this machine, through the default profile. This stack
// only ever runs with the `personal` profile locally, and in CI with the repo's Cloudflare secrets
// (where Alchemy never reads profiles). Cloudflare variables in the environment would override the
// profile, so they are refused locally too.
const profileFlag = process.argv.indexOf("--profile");
const profile =
  profileFlag === -1
    ? process.env.ALCHEMY_PROFILE
    : process.argv[profileFlag + 1];
// `alchemy profile ...` loads this file too, to find the providers to log in to; it deploys nothing.
const managingProfiles = process.argv.includes("profile");
if (process.env.CI !== "true" && !managingProfiles) {
  if (profile !== "personal") {
    throw new Error(
      `Deploy the docs site with the personal Alchemy profile (bun run deploy), not "${profile ?? "default"}".`
    );
  }
  if (process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error(
      "Unset CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID: they would override the personal profile."
    );
  }
}

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
