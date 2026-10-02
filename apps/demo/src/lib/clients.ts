import { DemoApi, TodosRpcs } from "@demo/domain";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi, AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

// Server rendering calls the demo API directly; the browser goes through the Vite proxy.
const origin = import.meta.env.SSR ? "http://localhost:3010" : "";

export class TodosRpc extends AtomRpc.Service<TodosRpc>()("demo/TodosRpc", {
  group: TodosRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: `${origin}/api/rpc` }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])
  ),
}) {}

export class TodosHttp extends AtomHttpApi.Service<TodosHttp>()(
  "demo/TodosHttp",
  {
    api: DemoApi,
    baseUrl: origin || undefined,
    httpClient: FetchHttpClient.layer,
  }
) {}
