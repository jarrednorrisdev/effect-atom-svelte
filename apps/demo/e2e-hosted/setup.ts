import { buildDemo } from "../e2e/build.ts";
import { demoDir, host, portOffset, start, viteBin } from "../e2e/servers.ts";

const origin = `http://${host}:${5300 + portOffset}`;

/**
 * Builds the site as it is hosted, with the demo API running in the page, then previews it. The
 * preview starts after the build, which replaces the files a running preview serves.
 */
export default async function setup() {
  buildDemo({ VITE_DEMO_API: "in-tab" });
  const preview = await start(
    process.execPath,
    [
      viteBin,
      "preview",
      "--host",
      host,
      "--port",
      new URL(origin).port,
      "--strictPort",
    ],
    // Nothing listens there, so a request that reaches the network instead of the in-tab API
    // fails.
    {
      cwd: demoDir,
      env: { ...process.env, DEMO_API_ORIGIN: "http://localhost:9" },
    },
    origin
  );
  return () => {
    preview.kill();
  };
}
