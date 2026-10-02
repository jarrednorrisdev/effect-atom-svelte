import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// The e2e suite runs a demo API per worker and points each preview server at its own.
const api = process.env.DEMO_API_ORIGIN ?? "http://localhost:3010";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
      experimental: { remoteFunctions: true },
    }),
  ],
  // The demo API has no CORS; the browser reaches it same-origin through this proxy.
  preview: {
    port: 5181,
    proxy: { "/api": api },
    strictPort: true,
  },
  server: {
    port: 5180,
    proxy: { "/api": api },
    strictPort: true,
  },
});
