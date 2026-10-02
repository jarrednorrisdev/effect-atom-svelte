import { makeDemoHandler } from "@demo/domain/server";

const port = Number(process.env.PORT ?? 3010);
const { handler } = makeDemoHandler({ latency: "400 millis" });

Bun.serve({ fetch: (request) => handler(request), port });
console.log(`demo api on http://localhost:${port} (HTTP at /api, RPC at /rpc)`);
