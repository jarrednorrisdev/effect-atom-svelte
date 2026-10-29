// The terms the scope-cache example picks, from effect-atom-svelte's glossary. A repo keeps its
// own glossary in this shape: one general definition per term, with nothing about one diagram.

export const glossary = {
  atom: {
    "term": "Atom",
    "from": "Effect",
    "html": "A piece of state. <code>Atom.make(value)</code> holds a value that can be set. <code>Atom.make((get) =&gt; …)</code> is <em>derived</em>: a function that works its value out from other atoms, like a spreadsheet cell with a formula, and runs again when they change."
  },
  node: {
    "term": "Registry and node",
    "from": "Effect",
    "html": "The registry (<code>AtomRegistry</code>) stores the app's atoms while they're in use; an app can have more than one. For each atom it keeps a <em>node</em>: the atom's current value, its <em>listeners</em> (the callbacks to run when that value changes) and its <em>parents</em> (the atoms its function read the last time it ran; when one changes, the node runs again). A node stays while something holds it, a subscriber or a mount. Once nothing does, the registry <em>sweeps</em> it: the node and its value are gone, and the next use starts afresh."
  },
  get: {
    "term": "<code>get(x)</code>",
    "from": "Effect",
    "html": "Inside a derived atom's function, reads <code>x</code>'s value and makes <code>x</code> a parent. Parents are learned afresh on every run: one the function didn't read this time is dropped once it returns, silently."
  },
  mount: {
    "term": "<code>get.mount(x)</code>",
    "from": "Effect",
    "html": "Keeps <code>x</code> running (subscribed, so its node stays alive) for as long as this run of the function lasts, without reading its value. A mounted atom is <em>not</em> a parent. When the function runs again, the old mount is let go and the new run mounts it afresh."
  },
  keepAlive: {
    "term": "<code>Atom.keepAlive</code>",
    "from": "Effect",
    "html": "Keeps an atom's node in the registry even while nothing reads it, so its value survives."
  },
  inspector: {
    "term": "Inspector events",
    "from": "this library",
    "html": "The inspector watches the registry and reports what happens: <code>NodeAdded</code> / <code>NodeRemoved</code> when a node is created or removed, <code>Built</code> when a derived atom starts running, <code>Updated</code> when a value is stored, <code>ReadersChanged</code> when an atom gains or loses a subscriber. Effect has no event for a parent gained or dropped."
  },
  scope: {
    "term": "Inspector scope",
    "from": "this library",
    "html": "<code>provideInspectorScope()</code> marks a part of the page. It covers the atoms the components below read, plus everything upstream of them. A panel calls <code>snapshot()</code> to draw those atoms, and redraws when the scope sends <code>ScopeChanged</code>. The scope only passes on inspector events about its own atoms."
  },
  microtask: {
    "term": "Microtask",
    "from": "JavaScript",
    "html": "A callback queued (with <code>queueMicrotask</code>) to run as soon as the code running now has finished."
  },
};
