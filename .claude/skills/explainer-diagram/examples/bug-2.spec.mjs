// Bug 2 from #38: a HydrationBoundary's first render in the browser didn't match the server's
// HTML. The reference spec: copy it to start a new diagram.
//   node ../scripts/build.mjs bug-2.spec.mjs bug-2.html

const live = (v, badge, tone) => ({ v, badge, tone, live: true });

export default {
  meta: {
    title: "Bug 2: the first render doesn't match the server's HTML",
    subtitle:
      'One page load with a <code>HydrationBoundary</code>, step by step. From <a href="https://github.com/jarrednorrisdev/effect-atom-svelte/pull/38">#38</a>.',
    kicker: "Bug 2 · one page load, step by step",
    stripLabel: "What the user sees, from the moment the page arrives",
    verdict: {
      before: { tone: "bad", text: "flicker: 2 → 1 → 2" },
      after: { tone: "ok", text: "no flicker" },
    },
  },

  // `phase` names a run of steps in the lane, above the rail.
  lanes: [
    { id: "S", label: "Server", phase: "On the server" },
    { id: "B", label: "Browser", phase: "In the browser" },
  ],
  // Drawn between exactly two lanes; a step with `packet: true` sends the packet across.
  wire: { label: "network", packet: "HTML + data.state" },

  // Stacked in each lane in this order. Kinds: store, text, data, queue, screen.
  boxes: [
    { id: "load", lane: "S", kind: "store", label: "load() registry · temporary", row: "countAtom", goneLabel: "thrown away" },
    { id: "stateS", lane: "S", kind: "data", label: "data.state", text: '[{ key: "count", value: 2 }]' },
    { id: "render", lane: "S", kind: "store", label: "render registry", row: "countAtom" },
    { id: "html", lane: "S", kind: "text", label: "HTML being written", text: "<p>{v}</p>" },
    { id: "screen", lane: "B", kind: "screen" },
    { id: "stateB", lane: "B", kind: "data", label: "data.state · from the page", text: '[{ key: "count", value: 2 }]' },
    { id: "browser", lane: "B", kind: "store", label: "browser registry", row: "countAtom" },
    { id: "queue", lane: "B", kind: "queue", label: "queued · write after render", text: "countAtom = 2" },
  ],

  files: {
    load: {
      name: "+page.server.ts · runs first, on the server",
      lines: [
        "export const load = async () => {",
        "  const registry = AtomRegistry.make();",
        "  // …run countAtom here: it computes 2",
        "  return {",
        "    state: Hydration.dehydrate(registry),",
        "  };",
        "};",
      ],
    },
    layout: {
      name: "+layout.svelte",
      lines: ["<RegistryProvider", "  initialValues={[[countAtom, 1]]}>", "  {@render children()}", "</RegistryProvider>"],
    },
    count: {
      name: "Count.svelte",
      lines: ['<script lang="ts">', "  const count = useAtomValue(countAtom);", "</script>", "", "<p>{count.current}</p>"],
    },
    boundaryBefore: {
      name: "inside HydrationBoundary · simplified",
      lines: [
        "for (const { key, value } of state) {",
        "  if (registry.has(key) && BROWSER) {",
        "    queueUntilAfterRender(key, value);",
        "  } else {",
        "    registry.set(key, value);   // write now",
        "  }",
        "}",
      ],
    },
    boundaryAfter: {
      name: "inside HydrationBoundary · with the fix",
      lines: [
        "for (const { key, value } of state) {",
        "  if (registry.has(key) && BROWSER",
        "      && !hydratingServerHTML) {",
        "    queueUntilAfterRender(key, value);",
        "  } else {",
        "    registry.set(key, value);   // write now",
        "  }",
        "}",
      ],
    },
    send: {
      name: "what SvelteKit sends",
      lines: [
        "<!-- the page's HTML -->",
        "<p>2</p>",
        "",
        "<!-- plus the page data, embedded -->",
        'data = { state: [{ key: "count", value: 2 }] }',
      ],
    },
  },

  // `set` changes box states; the rest carry over from the step before. A fix shares its first
  // steps, then `before` and `after` tell the rest, with equal lengths so step numbers line up.
  steps: {
    shared: [
      {
        side: "S", file: "load", hl: [0, 1, 2], active: ["load"],
        set: { load: 2 },
        title: "SvelteKit runs <code>load</code>, before rendering anything",
        body: "<code>load</code> makes its own temporary registry and runs <code>countAtom</code> in it. Say it fetches a count from a database: it comes back as <b>2</b>.",
        note: "This is where the 2 comes from.",
      },
      {
        side: "S", file: "load", hl: [3, 4, 5], active: ["stateS"],
        set: { load: { v: 2, gone: true }, stateS: true },
        title: "<code>dehydrate</code> turns the registry into plain data",
        body: 'A registry is a live object and can\'t be sent over the network. <code>Hydration.dehydrate</code> copies its values out as a plain list, <code>[{ key: "count", value: 2 }]</code>, which <code>load</code> returns as <code>data.state</code>. The temporary registry is then thrown away.',
        note: "Only the plain list survives.",
      },
      {
        side: "S", file: "layout", hl: [0, 1], active: ["render"],
        set: { render: 1 },
        title: "Rendering starts: the layout creates the render registry",
        body: "SvelteKit now renders the page. The layout's <code>RegistryProvider</code> creates a <em>second</em> server registry for this render, and <code>initialValues</code> starts <code>countAtom</code> at <b>1</b>.",
        note: "A starting value, before any real data.",
      },
      {
        side: "S", file: "boundaryBefore", hl: [4], active: ["render", "stateS"],
        set: { render: 2 },
        title: "On the server, <code>HydrationBoundary</code> writes <code>data.state</code> in straight away",
        body: "The page's <code>HydrationBoundary</code> receives <code>data.state</code>. On the server it always writes before its children render, so <code>countAtom</code> goes from 1 to <b>2</b>.",
        note: "The server never waits. Remember this for step 9.",
      },
      {
        side: "S", file: "count", hl: [1, 4], active: ["html", "render"],
        set: { html: 2 },
        title: "<code>&lt;Count /&gt;</code> renders <b>2</b> into the HTML",
        body: "<code>&lt;Count /&gt;</code> reads <code>countAtom</code> from the render registry, gets 2, and writes <code>&lt;p&gt;2&lt;/p&gt;</code> into the page's HTML.",
        note: "The server's HTML says 2.",
      },
      {
        side: "S", file: "send", hl: [1, 4], active: ["html", "stateS"], packet: true,
        title: "The server sends the HTML <em>and</em> <code>data.state</code>",
        body: "The response holds the HTML showing 2. SvelteKit also embeds the page data, including <code>data.state</code>, so the browser's components get the same <code>data</code> prop.",
        note: "Both server registries are gone now. Only HTML and plain data travel.",
      },
      {
        side: "B", file: "send", hl: [1], active: ["screen"], frame: 2,
        set: { screen: { v: 2, badge: "server HTML · no JavaScript yet" }, stateB: true },
        title: "The page appears, showing <b>2</b>",
        body: "The browser displays the server's HTML straight away. No JavaScript has run yet, and the browser has no registry: what you see is just the HTML.",
        note: "So far so good: the user sees 2.",
      },
      {
        side: "B", file: "layout", hl: [0, 1], active: ["browser"], frame: 2,
        set: { browser: 1, screen: { v: 2, badge: "hydrating…" } },
        title: "JavaScript starts: the layout runs again, in the browser",
        body: "Svelte now <em>hydrates</em>: it runs the same components again in the browser, starting with the layout. Its <code>RegistryProvider</code> creates a fresh browser registry, and <code>initialValues</code> sets <code>countAtom</code> to <b>1</b>.",
        note: "This is where the 1 comes from: the layout's starting value, set again.",
      },
    ],
    before: [
      {
        side: "B", file: "boundaryBefore", hl: [1, 2], active: ["queue", "stateB", "browser"], frame: 2,
        set: { queue: "on" },
        title: "<code>HydrationBoundary</code> finds <code>countAtom</code> already there, so it waits",
        body: "The boundary gets the same <code>data.state</code> (count = 2). But the layout just created <code>countAtom</code>, and the boundary's rule in the browser is: <em>don't overwrite an atom that already exists until after the children have rendered</em>. So it queues the write.",
        note: "This rule protects client-side navigation, but it misfires here.",
      },
      {
        side: "B", file: "count", hl: [1, 4], active: ["screen", "browser"], frame: 1, bad: true,
        set: { screen: live(1, "✕ the server's HTML said 2", "bad") },
        title: "<code>&lt;Count /&gt;</code> renders <b>1</b>, but the server's HTML said 2",
        body: "<code>&lt;Count /&gt;</code> reads the browser registry and gets 1. Hydration expects the browser's first render to match the server's HTML exactly, and it doesn't.",
        note: "The number on screen drops from 2 to 1.",
      },
      {
        side: "B", file: "boundaryBefore", hl: [2], active: ["browser", "queue"], frame: 1, bad: true,
        set: { browser: 2, queue: "applied", screen: live(1, "still showing 1", "bad") },
        title: "Render done: the queued write finally lands",
        body: "Now that the children have rendered, the boundary runs its queued write. <code>countAtom</code> becomes <b>2</b> in the browser registry.",
        note: "The registry is right again, but the screen hasn't caught up yet.",
      },
      {
        side: "B", file: "count", hl: [4], active: ["screen"], frame: 2,
        set: { screen: live(2, "back to 2") },
        title: "<code>&lt;Count /&gt;</code> re-renders: <b>2</b> again",
        body: "<code>&lt;Count /&gt;</code> sees <code>countAtom</code> change and re-renders. It shows 2, matching the server again.",
        note: "The user saw 2 → 1 → 2: a flicker, and a first render that didn't match the server's.",
      },
    ],
    after: [
      {
        side: "B", file: "boundaryAfter", hl: [1, 2, 5], active: ["browser", "stateB"], frame: 2,
        set: { browser: 2 },
        title: "<code>HydrationBoundary</code> sees it's hydrating the server's HTML, so it writes now",
        body: "<code>countAtom</code> already exists, but the boundary knows the browser is hydrating the server's HTML (that's what the tiny extra flag per page tells it). Matching the server is the right thing to do, so it writes straight away, as the server did: <code>countAtom</code> becomes <b>2</b>.",
        note: "Same order of writes as the server: 1, then 2, before the children render.",
      },
      {
        side: "B", file: "count", hl: [1, 4], active: ["screen", "browser"], frame: 2,
        set: { screen: live(2, "✓ matches the server's HTML", "ok") },
        title: "<code>&lt;Count /&gt;</code> renders <b>2</b>, matching the server",
        body: "<code>&lt;Count /&gt;</code> reads the browser registry and gets 2, the same as the server rendered. Hydration matches.",
        note: "The number on screen never changes.",
      },
      {
        side: "B", file: "boundaryAfter", hl: [], frame: 2,
        title: "Render done: nothing was queued",
        body: "The boundary wrote before the render, so there's nothing left to do after it.",
        note: "Steps 11 and 12 of the old timeline simply don't happen.",
      },
      {
        side: "B", file: "count", hl: [4], active: ["screen"], frame: 2,
        title: "Steady: <b>2</b> the whole time",
        body: "No re-render was needed, because the value never changed after hydration.",
        note: "The user saw 2 → 2 → 2: no flicker.",
      },
    ],
  },
};
