import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // For the panel's model, which keeps its snapshot in runes.
  plugins: [svelte()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
