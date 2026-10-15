// The explainer engine: builds a step-through diagram page from a spec. See ../SKILL.md for the
// spec's shape and ../examples/ for a full one. Inlined into each page by ../scripts/build.mjs.
const Stepper = (() => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  // Replays a CSS animation on every call.
  const replay = (e, cls) => {
    e.classList.remove(cls);
    void e.offsetWidth;
    e.classList.add(cls);
  };
  const valueOf = (s) => (s !== null && typeof s === "object" ? s.v : s);

  /**
   * Box kinds: `make` builds the element once, `paint` shows one step's state (null only for a
   * screen). A state object's `tone` ("bad" | "ok") colours any box; render() applies it.
   */
  const KINDS = {
    // A store with one named value, such as a registry holding countAtom.
    store: {
      make: (b) => {
        const e = el("div", "node", `<div class="nodehead"><span class="label">${b.label}</span></div>
          <div class="row"><code>${esc(b.row ?? "")}</code><span class="val">·</span></div>`);
        // Read by the CSS label a gone store shows.
        e.querySelector(".nodehead").dataset.gone = b.goneLabel ?? "gone";
        return e;
      },
      paint: (e, s, b, animate) => {
        e.classList.toggle("gone", typeof s === "object" && !!s.gone);
        const val = e.querySelector(".val");
        const next = String(valueOf(s) ?? "·");
        if (val.textContent !== next) {
          val.textContent = next;
          if (animate) replay(val, "flash");
        }
      },
    },
    // Text with a value in it: `text` contains {v}, such as "<p>{v}</p>".
    text: {
      make: (b) => el("div", "node htmlbox", `<div class="nodehead"><span class="label">${b.label}</span></div><pre></pre>`),
      paint: (e, s, b) => {
        e.querySelector("pre").innerHTML = esc(b.text).replace("{v}", `<b>${esc(valueOf(s) ?? "")}</b>`);
      },
    },
    // Plain data, such as a dehydrated list. A string state replaces the box's text.
    data: {
      make: (b) => el("div", "chip", `<span class="label">${b.label}</span><span class="body"></span>`),
      paint: (e, s, b) => {
        const text = typeof s === "string" ? s : typeof s === "object" ? s.text : undefined;
        e.querySelector(".body").textContent = text ?? b.text;
      },
    },
    // Something waiting to happen. State "applied" strikes it through.
    queue: {
      make: (b) => el("div", "chip queue", `<span class="label">${b.label}</span><span class="body">${esc(b.text)}</span>`),
      paint: (e, s) => e.classList.toggle("applied", s === "applied"),
    },
    // What the user sees: { v, badge, tone: "bad" | "ok", live }. Never hidden; null shows it empty.
    screen: {
      make: (b) => el("div", "screen", `<div class="chrome"><i></i><i></i><i></i><span>${esc(b.label ?? "what the user sees")}</span></div>
        <div class="view blank"><span class="big"></span><span class="badge"></span></div>`),
      paint: (e, s, b, animate) => {
        const view = e.querySelector(".view");
        const big = e.querySelector(".big");
        const badge = e.querySelector(".badge");
        if (s == null) {
          view.className = "view blank";
          big.textContent = "";
          badge.textContent = "";
          return;
        }
        view.className = "view " + (s.live ? "live" : "static") + (s.tone ? " " + s.tone : "");
        const next = String(s.v ?? "");
        // Longer values drop to a size that fits the box.
        big.classList.toggle("long", next.length > 5);
        if (big.textContent !== next) {
          if (animate && big.textContent) {
            replay(big, "flip");
            setTimeout(() => (big.textContent = next), 180);
          } else big.textContent = next;
        }
        badge.textContent = s.badge ?? "";
        badge.className = "badge" + (s.tone ? " " + s.tone : "");
      },
    },
    // Atoms and the edges between them, such as a node and its parents. The box places `nodes`
    // ({ id, label, x, y }, x and y from 0 to 1 across the plot); a step's state is
    // { edges: [[from, to, kind]], show, mark, values }. An edge kind is "read" (solid), "mount"
    // (dashed), "new" (amber), "gone" (fading, struck), "bad" or "ok". `show` lists the visible
    // nodes (all by default), `mark` maps a node to "hl" | "bad" | "ok" | "dim", and `values` puts
    // a value under a node's name. `chrome: true` draws it as a window, for what a user sees.
    graph: {
      make: (b) => {
        const head = b.chrome
          ? `<div class="chrome"><i></i><i></i><i></i><span>${esc(b.label)}</span></div>`
          : `<div class="nodehead"><span class="label">${b.label}</span></div>`;
        const e = el("div", "node graph" + (b.chrome ? " windowed" : ""), `${head}
          <div class="plot" style="height:${b.height ?? 140}px"><svg aria-hidden="true"></svg></div>
          ${b.legend ? `<div class="legend">${b.legend}</div>` : ""}`);
        const plot = e.querySelector(".plot");
        for (const n of b.nodes) {
          const d = el("div", "gn", `<span class="gl">${esc(n.label ?? n.id)}</span><span class="gv"></span>`);
          d.dataset.id = n.id;
          d.style.left = `${n.x * 100}%`;
          d.style.top = `${n.y * 100}%`;
          plot.append(d);
        }
        e._edges = [];
        new ResizeObserver(() => drawEdges(e, false)).observe(plot);
        return e;
      },
      paint: (e, s, b, animate) => {
        const st = s ?? {};
        for (const d of e.querySelectorAll(".gn")) {
          const id = d.dataset.id;
          d.classList.toggle("off", !!st.show && !st.show.includes(id));
          d.dataset.mark = st.mark?.[id] ?? "";
          const gv = d.querySelector(".gv");
          const next = st.values?.[id] == null ? "" : String(st.values[id]);
          if (gv.textContent !== next) {
            gv.textContent = next;
            if (animate && next) replay(gv, "flash");
          }
        }
        e._edges = st.edges ?? [];
        drawEdges(e, animate);
      },
    },
  };

  // Draws a graph box's edges between its nodes as they're laid out now, from the edge of one
  // node's box to the edge of the other's. Edges that weren't there last time draw themselves in.
  const ARROWS = ["read", "mount", "new", "gone", "bad", "ok"];
  function drawEdges(e, animate) {
    const plot = e.querySelector(".plot");
    const svg = plot.querySelector("svg");
    const box = plot.getBoundingClientRect();
    if (!box.width) return;
    const at = (id) => {
      const r = plot.querySelector(`.gn[data-id="${id}"]`)?.getBoundingClientRect();
      return r && { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, w: r.width / 2 + 4, h: r.height / 2 + 4 };
    };
    // Where the line from a node's centre towards (dx, dy) leaves its box.
    const exit = (n, dx, dy) => {
      const t = Math.min(dx ? n.w / Math.abs(dx) : Infinity, dy ? n.h / Math.abs(dy) : Infinity);
      return { x: n.x + dx * t, y: n.y + dy * t };
    };
    const before = e._drawn ?? new Set();
    const now = new Set();
    let html = `<defs>${ARROWS.map((k) => `<marker id="${e.dataset.uid}-${k}" class="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" /></marker>`).join("")}</defs>`;
    for (const [from, to, kind = "read"] of e._edges) {
      const a = at(from);
      const b = at(to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const p = exit(a, dx, dy);
      const q = exit(b, -dx, -dy);
      const key = `${from}>${to}>${kind}`;
      now.add(key);
      const fresh = animate && !before.has(key) ? " fresh" : "";
      html += `<line class="edge edge-${kind}${fresh}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"
        marker-end="url(#${e.dataset.uid}-${kind})" />`;
    }
    svg.innerHTML = html;
    e._drawn = now;
  }

  // Terms from the spec's primer, written {{id}} or {{id|shown text}} in any step's HTML: shown
  // underlined, with the term's definition on hover or focus.
  let terms = {};
  const withTerms = (html) =>
    String(html ?? "").replace(/\{\{(\w+)(?:\|([^}]+))?\}\}/g, (m, id, shown) =>
      terms[id] ? `<span class="term" tabindex="0" data-term="${id}">${shown ?? terms[id].term}</span>` : shown ?? id);

  function mount(spec, extraKinds = {}) {
    // A spec's own box kinds (see scripts/build.mjs), for a picture the built-in kinds can't draw.
    Object.assign(KINDS, extraKinds);
    const { meta, lanes, boxes, files, steps: tracks, primer } = spec;
    terms = Object.fromEntries((primer?.terms ?? []).map((t) => [t.id, t]));
    const after = tracks.after ?? [];
    const hasAfter = after.length > 0;
    const laneById = Object.fromEntries(lanes.map((l) => [l.id, l]));
    let mode = "before";
    let i = 0;
    let painted = false;

    // Each step's full state: box states carry over from the step before unless the step sets
    // them; `null` hides a box.
    const steps = () => {
      let state = Object.fromEntries(boxes.map((b) => [b.id, b.start ?? null]));
      return tracks.shared.concat(mode === "before" ? tracks.before : after).map((s) => {
        state = { ...state, ...s.set };
        return { ...s, state };
      });
    };

    // Page skeleton.
    document.title = meta.title;
    const body = document.body;
    body.innerHTML = `
      <div class="standalone-only"><h1 class="page-title"></h1><p class="page-sub"></p></div>
      <details class="primer" open><summary class="label"></summary><div class="intro"></div><dl></dl></details>
      <div class="top"><span class="label kicker"></span>
        <div class="seg" role="group" aria-label="Version"><button data-mode="before"></button><button data-mode="after"></button></div></div>
      <div class="rail"></div><div class="phases"></div>
      <div class="stage"><div class="diagram"></div></div>
      <div class="lower"><div class="code"><div class="file label"></div><pre class="src"></pre></div><div class="text"></div></div>
      <div class="controls"><button class="btn prev">← Back</button><span class="counter"></span><button class="btn primary next">Next →</button></div>
      <div class="strip"><span class="label strip-label"></span><div class="frames"></div></div>
      <p class="kbd">Use ← and → to step, or click a step number. Each step has its own link: the address bar follows along.</p>`;
    const q = (sel) => body.querySelector(sel);
    q(".page-title").textContent = meta.title;
    q(".page-sub").innerHTML = meta.subtitle ?? "";
    q(".kicker").textContent = meta.kicker ?? "";
    q(".strip-label").textContent = meta.stripLabel ?? "";
    const [bBefore, bAfter] = body.querySelectorAll(".seg button");
    bBefore.textContent = meta.beforeLabel ?? "Before the fix";
    bAfter.textContent = meta.afterLabel ?? "After the fix";
    if (!hasAfter) q(".seg").style.display = "none";

    // The primer: the scenario in prose, then each term the steps use, before the first step.
    if (primer) {
      q(".primer summary").textContent = primer.title ?? "Before you start";
      q(".primer .intro").innerHTML = [].concat(primer.intro ?? []).map((p) => `<p>${withTerms(p)}</p>`).join("");
      q(".primer dl").innerHTML = (primer.terms ?? [])
        .map((t) => `<div><dt>${t.term}${t.from ? ` <span class="from">${esc(t.from)}</span>` : ""}</dt><dd>${withTerms(t.html)}</dd></div>`)
        .join("");
    } else q(".primer").remove();
    const tip = el("div", "tip");
    tip.setAttribute("role", "tooltip");
    body.append(tip);
    const showTip = (ev) => {
      const t = ev.target.closest?.(".term");
      if (!t) return;
      const def = terms[t.dataset.term];
      tip.innerHTML = `<b>${def.term}</b>${def.from ? ` <span class="from">${esc(def.from)}</span>` : ""}<div>${withTerms(def.html)}</div>`;
      tip.classList.add("on");
      const r = t.getBoundingClientRect();
      const w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      const below = r.bottom + 8 + tip.offsetHeight < innerHeight;
      tip.style.top = `${below ? r.bottom + 8 : r.top - 8 - tip.offsetHeight}px`;
    };
    const hideTip = (ev) => ev.target.closest?.(".term") && tip.classList.remove("on");
    body.addEventListener("mouseover", showTip);
    body.addEventListener("focusin", showTip);
    body.addEventListener("mouseout", hideTip);
    body.addEventListener("focusout", hideTip);
    addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });

    // Lanes and their boxes, with a wire between exactly two lanes if the spec has one.
    const diagram = q(".diagram");
    const wired = spec.wire && lanes.length === 2;
    diagram.classList.toggle("wired", !!wired);
    diagram.style.setProperty("--cols", wired ? "1fr 92px 1fr" : `repeat(${lanes.length}, 1fr)`);
    const boxEls = {};
    // A box with lane "*" spans every lane, in a row above them: for a picture that needs the
    // page's width, such as a timeline.
    for (const b of boxes.filter((x) => x.lane === "*")) {
      const e = KINDS[b.kind].make(b);
      e.dataset.uid = `box-${b.id}`;
      e.classList.add("span");
      boxEls[b.id] = e;
      diagram.append(e);
    }
    lanes.forEach((lane, n) => {
      if (wired && n === 1) {
        diagram.append(el("div", "wire", `<div class="line"></div><span class="label wl">${esc(spec.wire.label ?? "")}</span>
          <div class="packet">${esc(spec.wire.packet ?? "")}</div>`));
      }
      const col = el("div", "col", `<div class="colhead"><span class="dot"></span><span class="label">${esc(lane.label)}</span></div>`);
      col.dataset.side = lane.id;
      for (const b of boxes.filter((x) => x.lane === lane.id)) {
        const e = KINDS[b.kind].make(b);
        e.dataset.uid = `box-${b.id}`;
        boxEls[b.id] = e;
        col.append(e);
      }
      diagram.append(col);
    });

    function buildRail() {
      const all = steps();
      const rail = q(".rail");
      rail.style.setProperty("--n", all.length);
      rail.innerHTML = "";
      all.forEach((_, n) => {
        const b = el("button", "", String(n + 1));
        b.title = `Step ${n + 1}`;
        b.onclick = () => go(n);
        rail.append(b);
      });
      // One phase per run of steps in the same lane.
      const runs = [];
      all.forEach((s, n) => {
        const last = runs[runs.length - 1];
        if (last && last.side === s.side) last.end = n;
        else runs.push({ side: s.side, start: n, end: n });
      });
      const ph = q(".phases");
      ph.innerHTML = "";
      // The same columns as the rail, so each phase sits under its own steps. A label too long for
      // a short run is cut off, with the whole of it on hover.
      ph.style.gridTemplateColumns = `repeat(${all.length}, minmax(0, 1fr))`;
      for (const r of runs) {
        const name = laneById[r.side].phase ?? laneById[r.side].label;
        const span = r.start === r.end ? `step ${r.start + 1}` : `steps ${r.start + 1}–${r.end + 1}`;
        const d = el("div", "label", esc(name));
        d.title = `${name} · ${span}`;
        d.style.gridColumn = `${r.start + 1} / span ${r.end - r.start + 1}`;
        d.dataset.start = r.start;
        d.dataset.end = r.end;
        ph.append(d);
      }
    }

    function render() {
      const all = steps();
      const s = all[i];
      const last = all.length - 1;
      [...q(".rail").children].forEach((b, n) => (b.className = n === i ? "now" : n < i ? "done" : ""));
      [...q(".phases").children].forEach((d) => d.classList.toggle("on", i >= +d.dataset.start && i <= +d.dataset.end));
      body.querySelectorAll(".col").forEach((c) => c.classList.toggle("on", c.dataset.side === s.side));

      for (const b of boxes) {
        const e = boxEls[b.id];
        const st = s.state[b.id];
        // A box this mode never shows takes no room; one that appears later keeps its place.
        e.style.display = b.kind !== "screen" && all.every((x) => x.state[b.id] == null) ? "none" : "";
        const hidden = st == null && b.kind !== "screen";
        e.classList.toggle("hidden", hidden);
        e.classList.toggle("active", (s.active ?? []).includes(b.id));
        // Any box but the screen (which has its own) can be marked wrong or right: { …, tone }.
        const tone = b.kind !== "screen" && st !== null && typeof st === "object" ? st.tone : undefined;
        e.classList.toggle("tone-bad", tone === "bad");
        e.classList.toggle("tone-ok", tone === "ok");
        if (!hidden) KINDS[b.kind].paint(e, st, b, painted);
      }
      const packet = q(".packet");
      if (packet) {
        packet.classList.remove("go");
        if (s.packet) replay(packet, "go");
      }

      const f = files[s.file];
      q(".file").textContent = f.name;
      q(".src").innerHTML = f.lines
        .map((l, n) => `<span class="ln${(s.hl ?? []).includes(n) ? " hl" : ""}">${esc(l) || " "}</span>`)
        .join("");
      const t = q(".text");
      // `body` is one paragraph or a list of them.
      const paras = [].concat(s.body ?? []).map((p) => `<p>${withTerms(p)}</p>`).join("");
      t.innerHTML = `<span class="label">Step ${i + 1} of ${all.length}</span><h3>${withTerms(s.title)}</h3>${paras}${s.note ? `<p class="note">${withTerms(s.note)}</p>` : ""}`;
      replay(t, "fade-in");

      // The strip: one frame per step that sets `frame`.
      const framed = all.map((st, n) => ({ st, n })).filter(({ st }) => st.frame !== undefined);
      q(".strip").style.display = framed.length ? "" : "none";
      const frames = q(".frames");
      frames.innerHTML = "";
      framed.forEach(({ st, n }, k) => {
        if (k) frames.append(el("span", "arrow", "→"));
        const seen = i >= n;
        const d = el("div", "frame" + (seen ? " seen" : "") + (seen && st.bad ? " bad" : ""), esc(st.frame));
        d.title = `Step ${n + 1}`;
        frames.append(d);
      });
      const verdict = i === last && meta.verdict?.[mode];
      frames.append(el("span", "stripnote" + (verdict ? " " + verdict.tone : ""), verdict ? esc(verdict.text) : ""));

      q(".counter").textContent = `${i + 1} / ${all.length} · ${(laneById[s.side].phase ?? laneById[s.side].label).toLowerCase()}`;
      q(".prev").disabled = i === 0;
      q(".next").textContent =
        i === last ? (hasAfter && mode === "before" ? "See it with the fix →" : "Start over ↺") : "Next →";
      history.replaceState(null, "", `${location.search}#${mode}-${i + 1}`);
      painted = true;
    }

    const count = () => steps().length;
    function go(n) {
      i = Math.max(0, Math.min(count() - 1, n));
      render();
    }
    function setMode(m) {
      mode = hasAfter ? m : "before";
      bBefore.setAttribute("aria-pressed", mode === "before");
      bAfter.setAttribute("aria-pressed", mode === "after");
      buildRail();
      i = Math.min(i, count() - 1);
      render();
    }
    q(".prev").onclick = () => go(i - 1);
    q(".next").onclick = () => {
      if (i === count() - 1) {
        if (hasAfter && mode === "before") {
          setMode("after");
          go(tracks.shared.length);
        } else {
          setMode("before");
          go(0);
        }
      } else go(i + 1);
    };
    bBefore.onclick = () => setMode("before");
    bAfter.onclick = () => setMode("after");
    addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") q(".next").click();
      if (e.key === "ArrowLeft") go(i - 1);
    });

    // Standalone (GitHub Pages): no host theme, so centre the page and show its title. Checked
    // again after load, in case a host injects its theme late.
    const checkHost = () =>
      body.classList.toggle("standalone", !getComputedStyle(document.documentElement).getPropertyValue("--background").trim());
    checkHost();
    addEventListener("load", checkHost);
    setTimeout(checkHost, 500);
    body.classList.toggle("capture", new URLSearchParams(location.search).has("capture"));

    // Links such as #before-10 or #after-9 open on that step.
    const linked = /^#(before|after)-(\d+)$/.exec(location.hash);
    if (linked) {
      mode = linked[1];
      i = +linked[2] - 1;
    }
    setMode(mode);
    // For scripts/shoot.mjs.
    window.stepper = { count, hasAfter };
  }

  return { mount };
})();
