// Bug 1 from #41: an inspector scope cached its atoms in the middle of a computation, so after an
// atom switched what it reads, the snapshot stayed stale and ScopeChanged never fired.
// Test: inspector-scope.browser.test.ts, "says its atoms changed when an atom that mounts another
// switches dependencies" (flag/a/b/ticker there are showDraft/saved/draft/presence here).

import { terms } from "../glossary.mjs";

// The registry's graph around doc: what doc reads (solid) and mounts (dashed).
const reg = (edges, extra = {}) => ({ edges, ...extra });
const panel = (show, edges, extra = {}) => ({ show, edges, ...extra });

const OLD = [["showDraft", "doc"], ["saved", "doc"]];
const MOUNT = ["presence", "doc", "mount"];

export default {
  meta: {
    title: "Bug 1: the inspector scope keeps a list of atoms that's already out of date",
    subtitle:
      'One click that makes an atom read something else, step by step. From <a href="https://github.com/jarrednorrisdev/effect-atom-svelte/pull/41">#41</a>.',
    kicker: "Bug 1 · one dependency switch, step by step",
    stripLabel: "What the panel says doc reads: on open, after the click, after the re-check",
    verdict: {
      before: { tone: "bad", text: "panel stuck on saved" },
      after: { tone: "ok", text: "panel shows draft" },
    },
  },

  primer: {
    title: "Before you start: the app, and the pieces involved",
    intro: [
      "Picture a document editor. The page shows a document's text: normally the last saved version, and the user's unsaved draft once they click <b>Show draft</b>. An atom called <code>doc</code> decides which of the two to show.",
      "<code>doc</code> also keeps a <code>presence</code> connection open: a socket that tells other people who's looking at the document. <code>doc</code> never uses a value from it; it just needs it open while the document is on screen.",
      "Beside the editor sits an atom graph panel, like the one the docs site draws next to each example. It shows which atoms <code>doc</code> depends on. <b>The bug:</b> after the click, the panel still says <code>doc</code> depends on <code>saved</code>, though it now reads <code>draft</code>.",
    ],
    terms: terms(
      "atom",
      ["node", "Here, what matters is the node's parents."],
      "get",
      "mount",
      ["keepAlive", "Here it keeps the draft's text."],
      "inspector",
      "scope",
      ["microtask", "Here: once the registry is done running <code>doc</code>."],
    ),
  },

  lanes: [
    { id: "R", label: "Effect's registry", phase: "Registry" },
    { id: "S", label: "Inspector scope and the panel", phase: "Scope" },
  ],

  boxes: [
    {
      id: "graph", lane: "R", kind: "graph", label: "registry · doc's node and what it uses", height: 132,
      nodes: [
        { id: "showDraft", x: 0.17, y: 0.18 },
        { id: "saved", x: 0.5, y: 0.18 },
        { id: "draft", x: 0.83, y: 0.18 },
        { id: "presence", x: 0.86, y: 0.82 },
        { id: "doc", x: 0.5, y: 0.82 },
      ],
      legend: "solid: a parent, read with get · dashed: mounted, not a parent · red: just dropped",
    },
    { id: "event", lane: "R", kind: "data", label: "inspector event just sent", text: "" },
    {
      id: "panel", lane: "S", kind: "graph", chrome: true, label: "atom graph panel · what it draws", height: 104,
      nodes: [
        { id: "showDraft", x: 0.17, y: 0.2 },
        { id: "saved", x: 0.5, y: 0.2 },
        { id: "draft", x: 0.83, y: 0.2 },
        { id: "doc", x: 0.5, y: 0.8 },
      ],
    },
    { id: "cache", lane: "S", kind: "store", label: "scope · cached list of its atoms", row: "#members", goneLabel: "cleared" },
    { id: "check", lane: "S", kind: "queue", label: "microtask · runs when doc is done", text: "re-check: snapshot, compare, ScopeChanged?" },
  ],

  files: {
    app: {
      name: "atoms.ts · the app",
      lines: [
        "const showDraft = Atom.make(false);",
        "const saved = Atom.make(savedText);",
        "const draft = Atom.keepAlive(Atom.make(\"\"));",
        "const presence = Atom.make(openSocket);",
        "",
        "const doc = Atom.make((get) => {",
        "  get.mount(presence); // keep the socket open",
        "  return get(showDraft)",
        "    ? get(draft) : get(saved);",
        "});",
      ],
    },
    devtools: {
      name: "the editor and the panel · simplified",
      lines: [
        "// Editor.svelte: a scope over the editor",
        "const scope = provideInspectorScope();",
        "const text = useAtomValue(doc);",
        "",
        "// the panel",
        "scope.subscribe((event) => {",
        "  if (event._tag === \"ScopeChanged\")",
        "    draw(scope.snapshot());",
        "});",
        "draw(scope.snapshot());",
      ],
    },
    toolbar: {
      name: "Toolbar.svelte",
      lines: [
        "const setShowDraft = useAtomSet(showDraft);",
        "",
        "<button onclick={() => setShowDraft(true)}>",
        "  Show draft",
        "</button>",
      ],
    },
    build: {
      name: "Effect's node.build() · simplified",
      lines: [
        "build() {",
        "  inspector.built(this);   // Built",
        "  const value = atom.read(get); // doc's fn",
        "  this.dropUnread(reads);  // no event",
        "  this.setValue(value);    // Updated",
        "}",
      ],
    },
    scopeBefore: {
      name: "Inspector.ts · Scope, before · simplified",
      lines: [
        "receive(event) {",
        "  const inScope = previous.has(event.node)",
        "    || this.nodes().has(event.node);",
        "  if (event is Built / NodeAdded / NodeRemoved)",
        "    this.changed();",
        "  if (inScope) pass the event on;",
        "}",
        "nodes() {",
        "  this.members ??= walkUpFromReads(); // kept",
        "  return this.members;",
        "}",
        "changed() {",
        "  this.members = undefined;",
        "  queueMicrotask(() => this.check());",
        "}",
        "check() {",
        "  if (sign(this.nodes()) !== this.signature)",
        "    emit({ _tag: \"ScopeChanged\" });",
        "}",
      ],
    },
    scopeAfter: {
      name: "Inspector.ts · Scope, with the fix · simplified",
      lines: [
        "receive(event) {",
        "  const inScope = previous.has(event.node)",
        "    || (this.members ?? walkUpFromReads())",
        "         .has(event.node); // not kept",
        "  if (event is Built / NodeAdded / NodeRemoved)",
        "    this.changed();",
        "  if (inScope) pass the event on;",
        "}",
        "nodes() {",
        "  this.members ??= walkUpFromReads(); // kept",
        "  return this.members;",
        "}",
        "check() {",
        "  if (sign(this.nodes()) !== this.signature)",
        "    emit({ _tag: \"ScopeChanged\" });",
        "}",
      ],
    },
  },

  steps: {
    shared: [
      {
        side: "R", file: "app", hl: [0, 1, 2, 3, 5, 6, 7, 8, 9], active: ["graph"],
        set: { graph: reg([...OLD, MOUNT], { values: { showDraft: "false" } }) },
        title: "The app's atoms: <code>doc</code> picks the saved text or the draft",
        body: [
          "<code>showDraft</code> is the switch the toolbar flips. <code>saved</code> holds the last saved text and <code>draft</code> the unsaved edits; {{keepAlive}} keeps the draft's {{node|node}} in the registry even while nothing shows it.",
          "<code>doc</code> is a derived {{atom|atom}}. Its function first calls {{mount|get.mount(presence)}} to hold the socket open, then reads <code>showDraft</code> with {{get}}, and then reads <code>saved</code> or <code>draft</code>.",
          "<code>showDraft</code> is false, so the registry lists <code>doc</code>'s parents as <code>showDraft</code> and <code>saved</code>: the solid arrows. <code>presence</code> is mounted (dashed), not a parent. <code>draft</code> has a node but nothing points from it to <code>doc</code>.",
        ],
        note: "A node's parents are whatever its function read the last time it ran.",
      },
      {
        side: "S", file: "devtools", hl: [1, 2, 9], active: ["cache", "panel"], frame: "saved",
        set: {
          cache: "doc, showDraft, saved",
          panel: panel(["showDraft", "saved", "doc"], OLD),
        },
        title: "The panel asks the scope which atoms to draw",
        body: [
          "The editor component calls {{scope|provideInspectorScope()}} and reads <code>doc</code>, so the scope covers <code>doc</code>. The panel calls <code>snapshot()</code>: the scope starts at <code>doc</code> and follows its parents upward, finding <code>showDraft</code> and <code>saved</code>. <code>presence</code> is only mounted, so it isn't in the scope.",
          "The scope keeps that list in a cache, <code>#members</code>. The cache does two jobs: it's what <code>snapshot()</code> returns, and it's how the scope tells which {{inspector|inspector events}} are about its atoms and should go to the panel.",
        ],
        note: "A cached list is right only until doc's parents change.",
      },
      {
        side: "R", file: "toolbar", hl: [2], active: ["graph", "event"], frame: "saved",
        set: {
          graph: reg([...OLD, ["presence", "doc", "gone"]], { values: { showDraft: "true" }, mark: { showDraft: "hl" } }),
          event: "Updated · showDraft",
        },
        title: "The user clicks <b>Show draft</b>: <code>showDraft</code> becomes true",
        body: [
          "The inspector reports <code>Updated</code> for <code>showDraft</code>. It's in the scope's cache, so the scope passes the event to the panel.",
          "<code>showDraft</code> is a parent of <code>doc</code>, so <code>doc</code> is now out of date and has to run again. First the registry ends <code>doc</code>'s last run, which lets go of its mount of <code>presence</code> (the red dotted line).",
        ],
        note: "None of doc's parents have changed yet, so the cache is still right.",
      },
      {
        side: "R", file: "build", hl: [1], active: ["graph", "event"],
        set: {
          graph: reg(OLD, { values: { showDraft: "true" }, mark: { doc: "hl" } }),
          event: "Built · doc",
        },
        title: "<code>doc</code> starts running again: the inspector reports <code>Built</code>",
        body: [
          "Effect's <code>build()</code> reports <code>Built</code> first, and only then calls <code>doc</code>'s function. The registry still lists the parents from the last run, <code>showDraft</code> and <code>saved</code>: they're only replaced as this run reads things, and after it returns.",
        ],
        note: "doc's parents are about to change, and Built is the scope's warning.",
      },
      {
        side: "S", file: "scopeBefore", hl: [3, 4, 11, 12, 13], active: ["cache", "check"],
        set: { cache: { v: "doc, showDraft, saved", gone: true }, check: "on" },
        title: "The scope clears its cache and schedules a re-check",
        body: [
          "<code>Built</code>, <code>NodeAdded</code> and <code>NodeRemoved</code> are the events that can change which atoms are in the scope, so on <code>Built</code> the scope clears <code>#members</code>.",
          "It can't take a new snapshot yet, with <code>doc</code> halfway through running. So it queues a {{microtask}}: once the registry is done, take a fresh snapshot, and if it differs from the last one, send <code>ScopeChanged</code> so the panel redraws.",
        ],
        note: "The plan is sound: work the atoms out again once doc has finished.",
      },
      {
        side: "R", file: "app", hl: [6], active: ["graph", "event"],
        set: {
          graph: reg([...OLD, ["presence", "doc", "new"]], { values: { showDraft: "true" }, mark: { doc: "hl" } }),
          event: "ReadersChanged · presence",
        },
        title: "<code>doc</code>'s function mounts <code>presence</code> again",
        body: [
          "The function's first line is <code>get.mount(presence)</code>. Mounting adds a subscriber to <code>presence</code>, so the inspector reports <code>ReadersChanged</code> for <code>presence</code>.",
          "That event arrives in the middle of <code>doc</code>'s run. <code>doc</code> hasn't read <code>showDraft</code> or <code>draft</code> yet, so the registry still lists its parents as <code>showDraft</code> and <code>saved</code>.",
        ],
        note: "An event arrives while doc is half-way through its run.",
      },
    ],
    before: [
      {
        side: "S", file: "scopeBefore", hl: [1, 2, 7, 8, 9], active: ["cache"],
        set: { cache: { v: "doc, showDraft, saved", tone: "bad" } },
        title: "The scope checks whether <code>presence</code> is one of its atoms, and caches the answer",
        body: [
          "To decide whether to pass the event on, <code>receive</code> asks <code>nodes()</code> for the scope's atoms. The cache is empty, so <code>nodes()</code> follows <code>doc</code>'s parents up again and <em>stores</em> what it finds.",
          "But <code>doc</code> is mid-run, so its parents are still <code>showDraft</code> and <code>saved</code>. The cache is refilled with <code>doc, showDraft, saved</code>. (<code>presence</code> isn't in it, so the event isn't passed on, which is correct.)",
        ],
        note: "The cache is refilled from a graph that's about to change.",
      },
      {
        side: "R", file: "app", hl: [7, 8], active: ["graph"],
        set: {
          graph: reg([...OLD, MOUNT, ["draft", "doc", "new"]], { values: { showDraft: "true" } }),
          event: "— none —",
        },
        title: "<code>doc</code> reads <code>showDraft</code> (true), and then <code>draft</code>",
        body: [
          "<code>draft</code> becomes a parent of <code>doc</code>. The registry already had a node for <code>draft</code> (it's kept alive), so it creates none, and nothing is reported: there's no event for gaining a parent.",
        ],
        note: "The registry now says doc reads draft. The cache doesn't know.",
      },
      {
        side: "R", file: "build", hl: [3], active: ["graph", "cache"],
        set: {
          graph: reg([["showDraft", "doc"], ["saved", "doc", "gone"], MOUNT, ["draft", "doc"]], { values: { showDraft: "true" } }),
        },
        title: "The function returns, and Effect drops <code>saved</code> as a parent",
        body: [
          "After the function returns, <code>build()</code> removes every parent this run didn't read. <code>doc</code> didn't read <code>saved</code> this time, so it goes. Effect reports nothing for this either.",
        ],
        note: "doc no longer reads saved, but the cache still lists it.",
      },
      {
        side: "R", file: "build", hl: [4], active: ["event", "cache"],
        set: {
          graph: reg([["showDraft", "doc"], MOUNT, ["draft", "doc"]], { values: { showDraft: "true" } }),
          event: "Updated · doc",
        },
        title: "<code>doc</code>'s new value is stored: the inspector reports <code>Updated</code>",
        body: [
          "The scope looks <code>doc</code> up in its cache, finds it, and passes the event on. <code>Updated</code> isn't one of the events that clear the cache, so the stale list stays.",
        ],
        note: "The stale cache keeps answering.",
      },
      {
        side: "S", file: "scopeBefore", hl: [15, 16, 17], active: ["check", "cache", "panel"], frame: "saved", bad: true,
        set: {
          check: "applied",
          panel: panel(["showDraft", "saved", "doc"], [["showDraft", "doc"], ["saved", "doc", "bad"]], { mark: { saved: "bad" } }),
        },
        title: "The re-check runs, reads the stale cache, and sees no change",
        body: [
          "The microtask takes a snapshot through <code>nodes()</code>, which returns the list cached in step 7: <code>doc, showDraft, saved</code>. That's the same as the last snapshot, so the scope sends no <code>ScopeChanged</code>, and the panel keeps drawing <code>doc</code> reading <code>saved</code>.",
          "It stays wrong until some unrelated event clears the cache, such as a new atom being created.",
        ],
        note: "The panel shows a dependency that no longer exists, and misses the one that does.",
      },
    ],
    after: [
      {
        side: "S", file: "scopeAfter", hl: [1, 2, 3], active: ["cache"],
        set: { cache: { v: "empty: walked, not kept", tone: "ok" } },
        title: "The scope checks whether <code>presence</code> is one of its atoms, and keeps nothing",
        body: [
          "<code>receive</code> still follows <code>doc</code>'s parents up to answer, and gets the same half-finished list: <code>presence</code> isn't in the scope, so the event isn't passed on.",
          "With the fix, that list is used for this one event and thrown away. Only <code>nodes()</code>, which snapshots use, stores what it finds.",
        ],
        note: "An answer worked out mid-run is used once and never stored.",
      },
      {
        side: "R", file: "app", hl: [7, 8], active: ["graph"],
        set: {
          graph: reg([...OLD, MOUNT, ["draft", "doc", "new"]], { values: { showDraft: "true" } }),
          event: "— none —",
        },
        title: "<code>doc</code> reads <code>showDraft</code> (true), and then <code>draft</code>",
        body: [
          "<code>draft</code> becomes a parent of <code>doc</code>, again with no event. This time there's no cached list to go stale.",
        ],
        note: "The same registry steps as before.",
      },
      {
        side: "R", file: "build", hl: [3], active: ["graph"],
        set: {
          graph: reg([["showDraft", "doc"], ["saved", "doc", "gone"], MOUNT, ["draft", "doc"]], { values: { showDraft: "true" } }),
        },
        title: "The function returns, and Effect drops <code>saved</code> as a parent",
        body: [
          "<code>saved</code> is dropped, still without an event. The registry's graph is now final: <code>doc</code> reads <code>showDraft</code> and <code>draft</code>.",
        ],
        note: "The graph is finished, and nothing has a stale copy of it.",
      },
      {
        side: "R", file: "build", hl: [4], active: ["event"],
        set: {
          graph: reg([["showDraft", "doc"], MOUNT, ["draft", "doc"]], { values: { showDraft: "true" } }),
          event: "Updated · doc",
        },
        title: "<code>doc</code>'s new value is stored: the inspector reports <code>Updated</code>",
        body: [
          "To check <code>doc</code>, the scope follows the parents up again (the finished graph now), finds <code>doc</code>, and passes the event on. It still keeps nothing.",
        ],
        note: "Walking on each event until the re-check costs little: a scope has a handful of atoms.",
      },
      {
        side: "S", file: "scopeAfter", hl: [8, 9, 12, 13, 14], active: ["check", "cache", "panel"], frame: "draft",
        set: {
          check: "applied",
          cache: { v: "doc, showDraft, draft", tone: "ok" },
          panel: panel(["showDraft", "draft", "doc"], [["showDraft", "doc"], ["draft", "doc", "ok"]], { mark: { draft: "ok" } }),
        },
        title: "The re-check walks the finished graph and sends <code>ScopeChanged</code>",
        body: [
          "The microtask's snapshot finds no cache, so it walks the graph as it is now and keeps <code>doc, showDraft, draft</code>. That differs from the last snapshot, so the scope sends <code>ScopeChanged</code>, and the panel redraws with <code>doc</code> reading <code>draft</code>.",
        ],
        note: "The panel follows the switch from saved to draft.",
      },
    ],
  },
};
