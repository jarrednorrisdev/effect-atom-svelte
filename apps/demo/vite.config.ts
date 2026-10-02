import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
      experimental: { remoteFunctions: true },
    }),
  ],
  server: {
    port: 5180,
    // The demo API has no CORS; the browser reaches it same-origin through this proxy.
    proxy: { "/api": "http://localhost:3010" },
    strictPort: true,
  },
});
