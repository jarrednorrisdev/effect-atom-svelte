import { browser } from "$app/env";
import { Effect, Layer } from "effect";
import { KeyValueStore } from "effect/persistence";
import { Atom } from "effect/reactivity";

/** Only cookies with this prefix are passed to the page and seen by the store. */
export const preferencePrefix = "pref-";

/**
 * The request's preference cookies, set by the root layout through `RegistryProvider`'s
 * `initialValues`. Kept alive so the registry never sweeps it and loses the request's values.
 */
export const preferenceCookiesAtom = Atom.make<
  Readonly<Record<string, string>>
>({}).pipe(Atom.keepAlive);

const readDocumentCookies = (): Map<string, string> => {
  const cookies = new Map<string, string>();
  for (const entry of document.cookie.split("; ")) {
    const separator = entry.indexOf("=");
    const name = entry.slice(0, separator);
    if (separator > 0 && name.startsWith(preferencePrefix)) {
      cookies.set(name, decodeURIComponent(entry.slice(separator + 1)));
    }
  }
  return cookies;
};

const writeDocumentCookie = (name: string, value: string, maxAge: number) => {
  // oxlint-disable-next-line unicorn/no-document-cookie -- the store is the cookie API
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
};

/** Reads and writes `document.cookie`, so every write reaches the server on the next request. */
const documentCookieStore = KeyValueStore.makeStringOnly({
  clear: Effect.sync(() => {
    for (const name of readDocumentCookies().keys()) {
      writeDocumentCookie(name, "", 0);
    }
  }),
  get: (key) => Effect.sync(() => readDocumentCookies().get(key)),
  remove: (key) => Effect.sync(() => writeDocumentCookie(key, "", 0)),
  set: (key, value) =>
    Effect.sync(() => writeDocumentCookie(key, value, 60 * 60 * 24 * 365)),
  size: Effect.sync(() => readDocumentCookies().size),
});

/** Reads the request's cookies. Writes stay in memory: a server render cannot set cookies. */
const requestCookieStore = (cookies: Readonly<Record<string, string>>) => {
  const values = new Map(Object.entries(cookies));
  return KeyValueStore.makeStringOnly({
    clear: Effect.sync(() => values.clear()),
    get: (key) => Effect.sync(() => values.get(key)),
    remove: (key) => Effect.sync(() => values.delete(key)),
    set: (key, value) => Effect.sync(() => values.set(key, value)),
    size: Effect.sync(() => values.size),
  });
};

/** A `KeyValueStore` runtime for preferences that must be right on the server's first paint. */
export const cookieStorage = Atom.runtime((get) =>
  Layer.succeed(KeyValueStore.KeyValueStore)(
    browser
      ? documentCookieStore
      : requestCookieStore(get(preferenceCookiesAtom))
  )
);
