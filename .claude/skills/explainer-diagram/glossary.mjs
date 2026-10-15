// The shared glossary for explainer diagrams: one general definition per term, for every spec's
// primer. A spec picks the terms it needs with `terms(...)`, and can add a sentence on why a term
// matters in that diagram. See SKILL.md, "The primer's terms".
//
// A definition says what the term is and where it comes from, in plain words, with nothing about
// one diagram's scenario: that goes in the spec's extra sentence. Keep {{links}} out of these: a
// spec may not pick the term a link points to. Changing a definition changes it for every diagram
// built afterwards; pages already built and published keep the wording they were built with.

export const glossary = {
  // ---- Effect: atoms and the registry ----
  atom: {
    term: "Atom",
    from: "Effect",
    html: "A piece of state. <code>Atom.make(value)</code> holds a value that can be set. <code>Atom.make((get) =&gt; …)</code> is <em>derived</em>: a function that works its value out from other atoms, like a spreadsheet cell with a formula, and runs again when they change.",
  },
  node: {
    term: "Registry and node",
    from: "Effect",
    html: "The registry (<code>AtomRegistry</code>) stores the app's atoms while they're in use; an app can have more than one. For each atom it keeps a <em>node</em>: the atom's current value, its <em>listeners</em> (the callbacks to run when that value changes) and its <em>parents</em> (the atoms its function read the last time it ran; when one changes, the node runs again). A node stays while something holds it, a subscriber or a mount. Once nothing does, the registry <em>sweeps</em> it: the node and its value are gone, and the next use starts afresh.",
  },
  nodestate: {
    term: "A node's state",
    from: "Effect",
    html: "<code>currentState()</code> says where a node stands: <code>uninitialized</code> (never built), <code>valid</code> (built and current) or <code>stale</code> (built, but something it depends on changed, so the next read rebuilds it). Building a node runs its atom's function and stores the result.",
  },
  announce: {
    term: "Listeners and announcements",
    from: "Effect",
    html: "<code>registry.subscribe(atom, listener)</code> registers a listener on the atom's node. Whenever the node stores a value, it calls its listeners: it <em>announces</em> the change. That includes the first build: a listener subscribed before the build hears it.",
  },
  get: {
    term: "<code>get(x)</code>",
    from: "Effect",
    html: "Inside a derived atom's function, reads <code>x</code>'s value and makes <code>x</code> a parent. Parents are learned afresh on every run: one the function didn't read this time is dropped once it returns, silently.",
  },
  mount: {
    term: "<code>get.mount(x)</code>",
    from: "Effect",
    html: "Keeps <code>x</code> running (subscribed, so its node stays alive) for as long as this run of the function lasts, without reading its value. A mounted atom is <em>not</em> a parent. When the function runs again, the old mount is let go and the new run mounts it afresh.",
  },
  keepAlive: {
    term: "<code>Atom.keepAlive</code>",
    from: "Effect",
    html: "Keeps an atom's node in the registry even while nothing reads it, so its value survives.",
  },
  family: {
    term: "<code>Atom.family</code>",
    from: "Effect",
    html: "Makes one atom per key, on first use, and hands back the same atom for the same key afterwards.",
  },
  fn: {
    term: "<code>Atom.fn</code>",
    from: "Effect",
    html: "Makes a mutation: an atom you write to as you would call a function. Each write runs the function with the written value, as an effect in a fiber, and the atom's value is the call's result, an <code>AsyncResult</code>: <code>Initial</code> and waiting while it runs, then <code>Success</code> or <code>Failure</code>.",
  },
  initialValue: {
    term: "<code>initialValue</code>",
    from: "Effect",
    html: "An option of <code>Atom.fn</code>: the value it shows before the first call and after a reset, as a <code>Success</code> instead of <code>Initial</code>. That <code>Success</code> is made once, when the atom is created, so its timestamp is the creation time.",
  },
  reset: {
    term: "<code>Atom.Reset</code>",
    from: "Effect",
    html: "A special value to write to an <code>Atom.fn</code>. It puts the atom back to its initial value, and stops any call still running.",
  },
  result: {
    term: "<code>AsyncResult</code>",
    from: "Effect",
    html: "The value of an async atom. <code>Initial</code>: no result yet. <code>Success</code> or <code>Failure</code>: a run finished. Each can carry <code>waiting</code>, meaning a run is going now. A <code>Success</code> also carries a <code>timestamp</code>: <code>Date.now()</code> when it was made.",
  },
  fiber: {
    term: "Fiber, interrupted",
    from: "Effect",
    html: "A running Effect, like a lightweight thread. Interrupting a fiber stops it where it is: it never produces a <code>Success</code> or a <code>Failure</code>.",
  },
  getResult: {
    term: "<code>AtomRegistry.getResult</code>",
    from: "Effect",
    html: "An effect that waits for an async atom's result: it adds a listener to the atom's node and resumes when the value is no longer <code>Initial</code>. If nothing calls that listener, it waits forever.",
  },
  dispose: {
    term: "<code>registry.dispose()</code>",
    from: "Effect",
    html: "Removes every node: it interrupts what each was running and empties its set of listeners, <em>without calling them</em>. Nothing waiting on a node hears that it is gone.",
  },

  // ---- Svelte ----
  derived: {
    term: "<code>$derived</code>",
    from: "Svelte",
    html: "A value worked out from other reactive values, and worked out again whenever one of them changes, like a spreadsheet formula. It holds nothing of its own. Svelte runs it again whenever something it read signals a change, even if the new result is the same.",
  },
  effect: {
    term: "<code>$effect</code>",
    from: "Svelte",
    html: "Runs a function after the component renders, and again whenever a value it read changes. A new object counts as a change, even with the same contents.",
  },
  state: {
    term: "<code>$props</code> and <code>$state</code>",
    from: "Svelte",
    html: "<code>$props()</code> is what a component's parent passes in; <code>$state</code> is the component's own value. When a prop changes, the component re-renders with the new prop, but its <code>$state</code> keeps whatever it held.",
  },
  await: {
    term: "Top-level <code>await</code> in a component",
    from: "Svelte",
    html: "With <code>experimental.async</code>, a component's script can <code>await</code>, and the server render waits for it. A component the render drops isn't cancelled: its script still resumes when the promise settles, after its render may be over.",
  },
  boundary: {
    term: "<code>&lt;svelte:boundary&gt;</code>",
    from: "Svelte",
    html: "Catches errors thrown by the components inside it. With a <code>failed</code> snippet, when one child throws while it sets up, Svelte drops <em>all</em> the boundary's children from the output and renders the snippet instead.",
  },
  onDestroy: {
    term: "<code>onDestroy</code>",
    from: "Svelte",
    html: "Runs a callback when the component is destroyed. On the server, it runs for each component once the render is done.",
  },
  getAbortSignal: {
    term: "<code>getAbortSignal()</code> and <code>abort</code>",
    from: "Svelte · JavaScript",
    html: "Svelte gives each server render, and each reaction in the browser, an <code>AbortSignal</code>, and aborts it when the render ends or the reaction runs again. A signal fires its <code>abort</code> event once: listeners added before then run, and one added afterwards never does. <code>signal.aborted</code> says whether it already has.",
  },

  // ---- SvelteKit ----
  beforeNavigate: {
    term: "<code>beforeNavigate</code>",
    from: "SvelteKit",
    html: "Registers a callback, from <code>$app/navigation</code>, that SvelteKit runs before each navigation it handles: a link, <code>goto</code>, a form, back or forward (<code>type: \"popstate\"</code>, with <code>delta</code>, the number of entries moved) and leaving the page (<code>\"leave\"</code>). The callback can call <code>navigation.cancel()</code>, only synchronously, to stop it. For back or forward the browser has already moved by then, so on a cancel SvelteKit undoes the move with <code>history.go(-delta)</code>.",
  },

  // ---- JavaScript ----
  abortSignal: {
    term: "<code>AbortSignal</code>",
    from: "JavaScript",
    html: "A flag one piece of code raises (<code>controller.abort()</code>) and others listen to. Effect's <code>runPromiseExit</code> takes one: when it aborts, the effect is interrupted and the promise settles as interrupted.",
  },
  popstate: {
    term: "<code>popstate</code>",
    from: "JavaScript",
    html: "The event a page gets when the tab moves to another of its own history entries, as after Back, Forward or <code>history.go</code>. It fires once the move has happened.",
  },
  historyGo: {
    term: "<code>history.go(n)</code>",
    from: "JavaScript",
    html: "Asks the browser to move <code>n</code> entries through the tab's history: <code>-1</code> is Back, <code>1</code> Forward. It returns at once, and the move happens later, followed by a <code>popstate</code>.",
  },
  confirm: {
    term: "<code>window.confirm</code>",
    from: "JavaScript",
    html: "Shows the browser's own OK / Cancel dialog with a message, and returns <code>true</code> for OK.",
  },
  microtask: {
    term: "Microtask",
    from: "JavaScript",
    html: "A callback queued (with <code>queueMicrotask</code>) to run as soon as the code running now has finished.",
  },

  // ---- This library ----
  provider: {
    term: "<code>RegistryProvider</code>",
    from: "this library",
    html: "A Svelte component that gives the components inside it a registry, through Svelte context. With no <code>registry</code> prop it creates one, per request on the server and per mount in the browser, and disposes of it when it is destroyed. Passing a <code>registry</code> shares that one instead. Two providers, side by side or nested, mean two separate registries.",
  },
  useAtomValue: {
    term: "<code>useAtomValue</code>",
    from: "this library",
    html: "Reads an atom in a Svelte component and returns an object whose <code>.current</code> is the value. Given a getter, <code>() =&gt; atom</code>, the atom can change with other state. Given a transform, <code>.current</code> is the transform's result, worked out in a <code>$derived</code>.",
  },
  setter: {
    term: "<code>useAtomSet</code>",
    from: "this library",
    html: "Returns a function that writes to an atom, so a component calls <code>setCount(5)</code>, or <code>setCount((n) =&gt; n + 1)</code> to write from the current value. The component holds the atom while it lives. With <code>mode: \"promise\"</code>, calling it writes and returns a promise that waits for the atom's next settled value: it resolves on a <code>Success</code> and rejects on a <code>Failure</code>. <code>\"promiseExit\"</code> does the same, but resolves with an Effect <code>Exit</code> either way (success, failure or interruption) and never rejects.",
  },
  initial: {
    term: "<code>useAtomInitialValues</code>",
    from: "this library",
    html: "Sets atoms' starting values from a component, usually from data the page loaded, and holds them while the component lives. A value applies once while the atom is held, so a second component setting the same atom doesn't overwrite the first.",
  },
  reader: {
    term: "The reader",
    from: "this library",
    html: "The piece inside <code>useAtomValue</code> that reads from the registry. It subscribes to its atom, and when its listener is called it tells Svelte the value changed, so everything that read <code>.current</code> runs again.",
  },
  hold: {
    term: "A hold, and its release",
    from: "this library",
    html: "On the server, each hook that uses an atom holds its node, so the registry doesn't sweep it mid-render, and registers a <em>release</em> to let go once the render is over.",
  },
  onRenderEnd: {
    term: "<code>onRenderEnd</code>",
    from: "this library",
    html: "Runs a cleanup once when a server render ends: from <code>onDestroy</code> or the render's abort signal, whichever comes first. Every hold's release goes through it.",
  },
  useForm: {
    term: "<code>useForm</code> and <code>dirty</code>",
    from: "this library",
    html: "Creates an instance of a form, defined with <code>Form.make</code> from an Effect Schema, in a Svelte component: values to bind to inputs, their errors, and a submit. <code>form.dirty</code> is true while the values differ from the ones the form started from or last saved.",
  },
  guard: {
    term: "<code>useUnsavedChangesGuard</code>",
    from: "this library",
    html: "From <code>effect-atom-svelte/sveltekit</code>. Registers a <code>beforeNavigate</code> callback that, while a form is dirty, cancels the navigation, awaits the app's <code>confirm</code>, and on yes starts the navigation again, letting that one retry through without asking.",
  },
  inspector: {
    term: "Inspector events",
    from: "this library",
    html: "The inspector watches the registry and reports what happens: <code>NodeAdded</code> / <code>NodeRemoved</code> when a node is created or removed, <code>Built</code> when a derived atom starts running, <code>Updated</code> when a value is stored, <code>ReadersChanged</code> when an atom gains or loses a subscriber. Effect has no event for a parent gained or dropped.",
  },
  scope: {
    term: "Inspector scope",
    from: "this library",
    html: "<code>provideInspectorScope()</code> marks a part of the page. It covers the atoms the components below read, plus everything upstream of them. A panel calls <code>snapshot()</code> to draw those atoms, and redraws when the scope sends <code>ScopeChanged</code>. The scope only passes on inspector events about its own atoms.",
  },

  // ---- This library's devtools ----
  picker: {
    term: "The panel and its picker",
    from: "this library's devtools",
    html: "<code>&lt;AtomDevtools /&gt;</code> shows one registry at a time. When the page has several, a picker at the top switches between them.",
  },
  model: {
    term: "Model and its numbers",
    from: "this library's devtools",
    html: "The panel's record of one registry: every atom it has seen and what happened to it. It gives each atom a number the first time it sees it, counting from 0, and the panel's views name atoms by that number.",
  },
  timeline: {
    term: "Timeline and its filter",
    from: "this library's devtools",
    html: "The Timeline tab lists events (an atom built, updated, removed) as rows. Clicking an atom's name in a row narrows the list to that atom's rows and shows a chip, <code>only cartAtom ✕</code>, that clears the filter.",
  },
};

/**
 * The terms for a spec's primer, in order. Each pick is a glossary id, or `[id, extra]` to add a
 * sentence (HTML, may use {{links}}) on why the term matters in this diagram. A name only one
 * diagram's scenario uses, such as a variable in its code, can be written out as
 * `{ id, term, from, html }`. An id the glossary doesn't have throws: add the term to the glossary.
 */
export const terms = (...picks) =>
  picks.map((pick) => {
    if (pick !== null && typeof pick === "object" && !Array.isArray(pick)) {
      return pick;
    }
    const [id, extra] = [].concat(pick);
    const entry = glossary[id];
    if (entry === undefined) {
      throw new Error(
        `The glossary has no term "${id}". Add it to explainer-diagram/glossary.mjs with a general definition (SKILL.md, "The primer's terms"), and put what is specific to this diagram in an extra sentence.`
      );
    }
    return { id, ...entry, html: extra ? `${entry.html} ${extra}` : entry.html };
  });
