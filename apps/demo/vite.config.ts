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
  // The demo API has no CORS; the browser reaches it same-origin through this proxy.
  preview: {
    port: 5181,
    proxy: { "/api": "http://localhost:3010" },
    strictPort: true,
  },
  server: {
    port: 5180,
    proxy: { "/api": "http://localhost:3010" },
    strictPort: true,
  },
});
