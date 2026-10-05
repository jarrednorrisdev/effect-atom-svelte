import { makeDemoHandler } from "@demo/domain/server";
import { Duration } from "effect";

const port = Number(process.env.PORT ?? 3010);
// 400 ms keeps loading states visible in the demo; the e2e suite runs with 0.
const latency = Duration.millis(Number(process.env.DEMO_LATENCY_MS ?? 400));

let demo = makeDemoHandler({ latency });

Bun.serve({
  fetch: async (request) => {
    // Puts the store back to its seed, so each e2e test starts from the same todos.
    // The docs' "Reset the demo API" button reaches it through the dev server's
    // /api proxy, as /api/__reset.
    const { pathname } = new URL(request.url);
    if (
      request.method === "POST" &&
      (pathname === "/__reset" || pathname === "/api/__reset")
    ) {
      const previous = demo;
      demo = makeDemoHandler({ latency });
      await previous.dispose();
      return new Response(null, { status: 204 });
    }
    return demo.handler(request);
  },
  port,
});
console.log(
  `demo api on http://localhost:${port} (HTTP at /api/todos, RPC at /api/rpc)`
);
