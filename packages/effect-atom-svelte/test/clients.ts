import { DemoApi, TodosRpcs } from "@demo/domain";
import { makeDemoHandler } from "@demo/domain/server";
import { Layer } from "effect";
import type { Duration } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi, AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { onTestFinished } from "vitest";

/**
 * Real HTTP and RPC clients against an in-process demo server. Each call gets a fresh server and
 * client classes, so store state and memoized layers never leak between tests. The server is
 * disposed of when the calling test finishes.
 */
export const makeClients = (
  options: { readonly latency?: Duration.Input } = {}
) => {
  const server = makeDemoHandler(options);
  onTestFinished(server.dispose);
  const fetchLayer = Layer.succeed(FetchHttpClient.Fetch)(
    (input: RequestInfo | URL, init?: RequestInit) =>
      server.handler(new Request(input, init))
  );
  const httpClient = FetchHttpClient.layer.pipe(Layer.provide(fetchLayer));

  class Rpc extends AtomRpc.Service<Rpc>()("test/Rpc", {
    group: TodosRpcs,
    protocol: RpcClient.layerProtocolHttp({
      url: "http://demo.test/api/rpc",
    }).pipe(Layer.provide([httpClient, RpcSerialization.layerNdjson])),
  }) {}

  class Http extends AtomHttpApi.Service<Http>()("test/Http", {
    api: DemoApi,
    baseUrl: "http://demo.test",
    httpClient,
  }) {}

  return { Http, Rpc };
};
