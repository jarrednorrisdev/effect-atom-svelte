import { DemoApi, TodosRpcs } from "@demo/domain";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi, AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { inTabApi, inTabHttpClient, inTabOrigin } from "./in-tab-api.ts";

// The hosted build runs the demo API in the page (in-tab-api.ts). Otherwise server rendering calls
// the demo API directly and the browser goes through the Vite proxy. The e2e suite points each
// worker's server at its own API with DEMO_API_ORIGIN.
const apiOrigin = (): string => {
  if (inTabApi) {
    return inTabOrigin;
  }
  if (!import.meta.env.SSR) {
    return "";
  }
  // oxlint-disable-next-line effecttsgo/process-env -- read once at module load, outside any Effect, to build the client classes below
  return process.env.DEMO_API_ORIGIN ?? "http://localhost:3010";
};
const origin = apiOrigin();

/** The demo API's origin for `AtomHttpApi`'s `baseUrl`; undefined for the page's own origin. */
export const baseUrl = origin || undefined;

/** The HTTP client layer the demo's clients use, for examples that define a client of their own. */
export const httpClient = inTabApi ? inTabHttpClient : FetchHttpClient.layer;

export class TodosRpc extends AtomRpc.Service<TodosRpc>()("demo/TodosRpc", {
  group: TodosRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: `${origin}/api/rpc` }).pipe(
    Layer.provide([httpClient, RpcSerialization.layerNdjson])
  ),
}) {}

export class TodosHttp extends AtomHttpApi.Service<TodosHttp>()(
  "demo/TodosHttp",
  {
    api: DemoApi,
    baseUrl,
    httpClient,
  }
) {}
