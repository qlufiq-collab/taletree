// Taletree web app: hash router, views and actions.
import config from "../config.js";
import { api, status, NodeError, isAddress } from "./rpc.js";
import { h, icon, fmt, paragraphs, clear } from "./dom.js";
import { toast, countUp, confetti, coinBurst, plusOne, swap, reducedMotion } from "./fx.js";
import { wallet, connect, restore, call, gnokeyCommand, gnowebActionURL, WalletError } from "./wallet.js";

const main = document.getElementById("main");
let limits = { minTitle: 3, maxTitle: 80, minChoice: 3, maxChoice: 80, minBody: 20, maxBody: 1500, maxChoices: 8 };
let lastDepth = 0;
let firstRender = true;

// ----- small cache, dropped after every write -----

const cache = new Map();
function cached(key, load, ttl = 8000) {
  const hit = cache.get(key);
  if (hit && performance.now() - hit.at < ttl) return hit.value;
  const value = load().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: performance.now(), value });
  return value;
}
const invalidate = () => cache.clear();

// ----- links -----

const link = {
  home: () => "#/",
  tale: (id) => `#/tale/${id}`,
  canon: (id) => `#/tale/${id}/canon`,
  passage: (id) => `#/p/${id}`,
  fame: () => "#/bards",
  bard: (addr) => `#/bard/${addr}`,
  write: () => "#/new",
};
const realmWeb = config.realmPath.replace(/^gno\.land/, "");
const gnowebURL = (path = "") => `${config.gnoweb}${realmWeb}${path ? ":" + path : ""}`;

// ----- shared pieces -----

function bardChip(addr, name) {
  return h("a.bard-chip", { href: link.bard(addr), title: addr }, monogram(addr, name), h("span", { text: fmt.name(name, addr) }));
}

function monogram(addr, name) {
  const label = name && name.startsWith("@") ? name.slice(1, 3) : addr.slice(2, 4);
  let sum = 0;
  for (const ch of addr) sum = (sum * 31 + ch.charCodeAt(0)) >>> 0;
  return h("span.mono", { class: `hue-${sum % 6}`, "aria-hidden": "true", text: label.toUpperCase() });
}

function stat(iconName, value, label) {
  return h("span.stat", { title: label }, icon(iconName), h("span", { text: value }), h("span.sr-only", { text: " " + label }));
}

function richText(text) {
  // Paragraphs, line breaks and *emphasis* / **strong**, built as text nodes.
  return paragraphs(text).map((para) => {
    const p = h("p");
    para.split("\n").forEach((line, i) => {
      if (i) p.append(h("br"));
      const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
      let last = 0;
      for (const m of line.matchAll(re)) {
        if (m.index > last) p.append(line.slice(last, m.index));
        const tok = m[0];
        p.append(tok.startsWith("**") ? h("strong", { text: tok.slice(2, -2) }) : h("em", { text: tok.slice(1, -1) }));
        last = m.index + tok.length;
      }
      if (last < line.length) p.append(line.slice(last));
    });
    return p;
  });
}

function crumbs(items) {
  const ol = h("ol");
  items.forEach((it, i) => {
    const last = i === items.length - 1;
    ol.append(
      h(
        "li",
        it.href && !last ? h("a", { href: it.href, text: it.text }) : h("span", { text: it.text, "aria-current": last ? "page" : null }),
      ),
    );
  });
  return h("nav.crumbs", { "aria-label": "Breadcrumb" }, ol);
}

function pageTitle(text, sub) {
  return h("header.page-head", h("h1", { tabindex: "-1", text }), sub ? h("p.lede", sub) : null);
}

function externalLink(href, text) {
  return h("a.ext", { href, target: "_blank", rel: "noopener noreferrer" }, h("span", { text }), icon("external"));
}

// ----- states -----

function skeleton(kind = "list") {
  const bar = (cls = "") => h("span.sk", { class: cls });
  if (kind === "reader") {
    return h(
      "div.skeleton",
      { "aria-busy": "true", "aria-label": "Loading" },
      bar("w-40 sm"),
      h("div.page.sk-page", bar("w-70 lg"), bar("w-30 sm"), bar(), bar(), bar("w-90"), bar(), bar("w-60")),
      h("div.choice-list", bar("btn"), bar("btn"), bar("btn")),
    );
  }
  return h(
    "div.skeleton",
    { "aria-busy": "true", "aria-label": "Loading" },
    h("div.sk-hero", bar("w-60 xl"), bar("w-80"), bar("w-40")),
    h("div.cards", ...[0, 1, 2].map(() => h("div.card.sk-card", bar("w-70 lg"), bar("w-40 sm"), bar(), bar("w-90"), bar("w-50 sm")))),
  );
}

function errorView(err, retry) {
  const offline = err instanceof NodeError && err.kind === "network";
  const missing = err instanceof NodeError && err.kind === "query" && /InvalidPkgPath|not found|unknown|invalid package/i.test(err.detail || "");
  const title = offline ? "The story node is out of reach" : missing ? "Taletree is not on this node" : "Something went wrong";
  const tips = offline
    ? [
        `Is the node running? This page reads ${config.rpc}.`,
        "For local work, start gnodev in the taletree folder (see README).",
        "Check your connection, then try again.",
      ]
    : missing
      ? [`No realm at ${config.realmPath}.`, "Deploy it, or fix realmPath in web/config.js."]
      : ["Try again in a moment.", "If it keeps happening, open the same page in gnoweb."];
  return h(
    "section.state.state-error",
    { role: "alert" },
    h("div.state-icon", icon(offline ? "refresh" : "alert")),
    h("h1", { tabindex: "-1", text: title }),
    h("p.lede", { text: err.message || String(err) }),
    h("ul.tips", ...tips.map((t) => h("li", { text: t }))),
    err.detail ? h("details.detail", h("summary", { text: "Technical detail" }), h("code", { text: err.detail })) : null,
    h(
      "div.row",
      h("button.btn.primary", { type: "button", onclick: retry }, icon("refresh"), h("span", { text: "Try again" })),
      externalLink(gnowebURL(), "Open in gnoweb"),
    ),
  );
}

function emptyState(iconName, title, text, action) {
  return h("section.state", h("div.state-icon", icon(iconName)), h("h2", { text: title }), h("p", { text }), action || null);
}

// ----- router -----

const routes = [
  [/^\/?$/, () => viewHome()],
  [/^\/tale\/(\d+)$/, (m) => viewTale(+m[1])],
  [/^\/tale\/(\d+)\/canon$/, (m) => viewCanon(+m[1])],
  [/^\/p\/(\d+)$/, (m) => viewPassage(+m[1])],
  [/^\/bards$/, () => viewFame()],
  [/^\/bard\/(g1[0-9a-z]{38})$/, (m) => viewBard(m[1])],
  [/^\/new$/, () => viewNew()],
];

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const path = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
  let match = null;
  let handler = null;
  for (const [re, fn] of routes) {
    match = re.exec(path);
    if (match) {
      handler = fn;
      break;
    }
  }
  setActiveNav(path);
  if (!handler) {
    await show(() => notFound(), "forward");
    return;
  }
  const isReader = /^\/(p|tale)\//.test(path);
  // Only show the skeleton when loading is not instant.
  const skeletonTimer = setTimeout(() => {
    if (seq === renderSeq) main.replaceChildren(skeleton(isReader ? "reader" : "list"));
  }, 120);
  try {
    const view = await handler(match);
    clearTimeout(skeletonTimer);
    if (seq !== renderSeq) return;
    await show(() => view.nodes, view.dir || "forward");
    if (view.after) view.after();
  } catch (err) {
    clearTimeout(skeletonTimer);
    if (seq !== renderSeq) return;
    console.warn("[taletree]", err);
    await show(() => errorView(err, () => render()), "forward");
  }
}

async function show(build, dir) {
  await swap(main, build, dir);
  if (!firstRender) {
    const h1 = main.querySelector("h1");
    if (h1) h1.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }
  firstRender = false;
  const h1 = main.querySelector("h1");
  document.title = h1 && h1.textContent ? `${h1.textContent} · Taletree` : "Taletree";
}

function setActiveNav(path) {
  for (const a of document.querySelectorAll(".nav a[data-route]")) {
    const r = a.dataset.route;
    const on = r === "/" ? path === "/" || path.startsWith("/tale") || path.startsWith("/p/") : path.startsWith(r);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function notFound() {
  return h(
    "section.state",
    h("div.state-icon", icon("map")),
    h("h1", { tabindex: "-1", text: "This page is not in any tale" }),
    h("p", { text: "The link may be old, or the passage was never written." }),
    h("a.btn.primary", { href: link.home() }, icon("book"), h("span", { text: "Back to the library" })),
  );
}

// ----- views -----

async function viewHome() {
  const [stats, list] = await Promise.all([cached("stats", api.stats), cached("tales:1", () => api.tales(1, 24))]);
  if (stats.limits) limits = stats.limits;
  const first = list.tales.find((t) => !t.hidden);

  const statNums = [
    [stats.tales, "tales"],
    [stats.passages, "passages"],
    [stats.bards, "bards"],
  ].map(([n, label]) => {
    const num = h("strong.num", { text: "0" });
    return { el: h("li", num, h("span", { text: label })), num, n };
  });
  const tipNum = h("strong.num", { text: "0" });

  const hero = h(
    "section.hero",
    h(
      "div.hero-copy",
      h("p.eyebrow", icon("tree"), h("span", { text: "Collaborative fiction on gno.land" })),
      h("h1", { tabindex: "-1" }, "Stories that branch. ", h("em", { text: "You" }), " write what happens next."),
      h("p.lede", {
        text:
          "Taletree is a library of choose-your-own-adventure tales written together, on-chain. Pick a choice, or add your own. " +
          "The most-cheered path becomes the canon, and every tip goes straight to the author.",
      }),
      h(
        "div.row.cta",
        first
          ? h("a.btn.primary.lg", { href: link.passage(first.root) }, icon("book"), h("span", { text: "Start reading" }))
          : null,
        h("a.btn.ghost.lg", { href: link.write() }, icon("pen"), h("span", { text: "Start a tale" })),
      ),
      stats.paused
        ? h("p.notice", icon("lock"), h("span", { text: "Writing is paused by the keeper. Reading, cheering and tipping still work." }))
        : null,
    ),
    h(
      "div.hero-art",
      { "aria-hidden": "true" },
      h(
        "div.book",
        h("div.book-page.left", h("span.line"), h("span.line"), h("span.line.short"), h("span.line"), h("span.line.short")),
        h(
          "div.book-page.right",
          h("span.branch.b1"),
          h("span.branch.b2"),
          h("span.branch.b3"),
          h("span.node.n0"),
          h("span.node.n1"),
          h("span.node.n2"),
          h("span.node.n3"),
        ),
      ),
      h("span.firefly.f1"),
      h("span.firefly.f2"),
      h("span.firefly.f3"),
    ),
  );

  const stripe = h(
    "section.stats-strip",
    { "aria-label": "Library totals" },
    h("ul", ...statNums.map((s) => s.el), h("li", tipNum, h("span", { text: "GNOT tipped to authors" }))),
  );

  const cards = list.tales.length
    ? h("div.cards", ...list.tales.map((t, i) => taleCard(t, i)))
    : emptyState(
        "book",
        "The shelves are empty",
        "No tale has been started yet. The first opening line could be yours.",
        h("a.btn.primary", { href: link.write() }, icon("pen"), h("span", { text: "Start the first tale" })),
      );

  const how = h(
    "section.how",
    h("h2", { text: "How a tale grows" }),
    h(
      "ol.steps",
      step("book", "Read", "Open a tale and follow the choices, or read its canon in one go."),
      step("pen", "Write", `Under any passage, add a choice and what happens next (${limits.minBody} to ${fmt.int(limits.maxBody)} characters), or write an ending.`),
      step("mug", "Cheer", "One cheer per passage per account. The most-cheered choice at each step is the canon."),
      step("coin", "Tip", "Send GNOT to a passage you liked. All of it reaches the author in the same transaction."),
    ),
  );

  return {
    nodes: [
      hero,
      stripe,
      h(
        "section.library",
        h(
          "div.section-head",
          h("h2", { text: "The library" }),
          h("span.muted", { text: fmt.plural(list.total, "tale") }),
        ),
        cards,
      ),
      how,
    ],
    after: () => {
      statNums.forEach((s) => countUp(s.num, s.n));
      countUp(tipNum, stats.tipsUgnot / 1e6, (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
    },
  };
}

function step(iconName, title, text) {
  return h("li", h("span.step-icon", icon(iconName)), h("h3", { text: title }), h("p", { text }));
}

function taleCard(t, i) {
  if (t.hidden) {
    return h(
      "article.card.tale-card.is-hidden",
      h("h3", { text: "Hidden tale" }),
      h("p.muted", { text: "A moderator took this tale off the shelves." }),
    );
  }
  return h(
    "article.card.tale-card",
    { class: `hue-${t.id % 6}` },
    h("div.card-top", h("span.tag", { text: `Tale ${t.id}` }), t.locked ? h("span.tag.lock", icon("lock"), h("span", { text: "Finished" })) : null),
    h("h3", h("a.stretch", { href: link.tale(t.id), text: t.title })),
    h("p.excerpt", { text: t.excerpt || "" }),
    h(
      "div.card-meta",
      h("span.by", "by ", bardChip(t.narrator, t.narratorName)),
      h(
        "span.stats",
        stat("book", fmt.int(t.passages), "passages"),
        stat("flag", fmt.int(t.endings), "endings"),
        stat("mug", fmt.int(t.cheers), "cheers"),
      ),
    ),
    h("p.updated", { text: `Updated ${fmt.ago(t.updated)}` }),
  );
}

async function viewTale(id) {
  const data = await cached(`tale:${id}`, () => api.tale(id));
  if (data.error) return { nodes: notFound() };
  const t = data.tale;
  if (t.hidden) {
    return {
      nodes: [
        crumbs([{ text: "Library", href: link.home() }, { text: "Hidden tale" }]),
        emptyState("lock", "This tale was hidden", "A moderator took it off the shelves."),
      ],
    };
  }
  const canon = new Set(data.canon || []);
  const head = h(
    "header.tale-head",
    h("p.eyebrow", h("span", { text: `Tale ${t.id}` }), t.locked ? h("span.tag.lock", icon("lock"), h("span", { text: "Finished" })) : null),
    h("h1", { tabindex: "-1", text: t.title }),
    h(
      "p.tale-meta",
      "Narrated by ",
      bardChip(t.narrator, t.narratorName),
      h(
        "span.stats",
        stat("book", fmt.int(t.passages), "passages"),
        stat("flag", fmt.int(t.endings), "endings"),
        stat("mug", fmt.int(t.cheers), "cheers"),
      ),
    ),
  );
  const opening = h(
    "article.page.opening",
    h("p.chapter", { text: "The opening" }),
    h("div.prose.dropcap", ...richText(data.opening.body)),
    h(
      "div.row.cta",
      h("a.btn.primary", { href: link.passage(data.opening.id) }, icon("book"), h("span", { text: "Start reading" })),
      h("a.btn.ghost", { href: link.canon(t.id) }, icon("spark"), h("span", { text: "Read the canon" })),
    ),
  );

  const map = h(
    "section.map",
    h(
      "div.section-head",
      h("h2", { text: "Map of the tale" }),
      h("span.legend", h("span.badge.canon", icon("spark"), h("span", { text: "canon" })), h("span.badge.ending", icon("flag"), h("span", { text: "ending" }))),
    ),
    data.tree.length > 1
      ? buildTree(data.tree, data.opening.id, canon)
      : emptyState(
          "tree",
          "No choice yet",
          "The opening is waiting for its first branch.",
          h("a.btn.primary", { href: link.passage(data.opening.id) }, icon("pen"), h("span", { text: "Write the first choice" })),
        ),
    data.truncated ? h("p.muted", { text: "Only the first 300 passages are shown. Open a passage to go deeper." }) : null,
  );

  return {
    nodes: [crumbs([{ text: "Library", href: link.home() }, { text: t.title }]), head, opening, map, gnowebFoot(`tale/${t.id}`)],
    dir: lastDepth > 0 ? "back" : "forward",
    after: () => {
      lastDepth = 0;
    },
  };
}

function buildTree(nodes, rootID, canon) {
  const kids = new Map();
  for (const n of nodes) {
    if (!kids.has(n.parent)) kids.set(n.parent, []);
    kids.get(n.parent).push(n);
  }
  const list = (parent, level) => {
    const items = kids.get(parent) || [];
    if (!items.length) return null;
    const ul = h("ul.tree", { role: level === 0 ? "tree" : "group" });
    for (const n of items) {
      const sub = list(n.id, level + 1);
      const label = h(
        "a.node-link",
        { href: link.passage(n.id), class: canon.has(n.id) ? "is-canon" : "" },
        h("span.node-choice", { text: n.choice }),
        h(
          "span.node-meta",
          canon.has(n.id) ? h("span.badge.canon", icon("spark"), h("span.sr-only", { text: "canon" })) : null,
          n.ending ? h("span.badge.ending", icon("flag"), h("span.sr-only", { text: "ending" })) : null,
          h("span.count", icon("mug"), h("span", { text: fmt.int(n.cheers) }), h("span.sr-only", { text: " cheers" })),
        ),
      );
      if (sub) {
        const det = h("details", { open: level < 2 || canon.has(n.id) }, h("summary", label), sub);
        ul.append(h("li", { role: "treeitem" }, det));
      } else {
        ul.append(h("li.leaf", { role: "treeitem" }, label));
      }
    }
    return ul;
  };
  return h("div.tree-wrap", list(rootID, 0));
}

async function viewPassage(id) {
  const data = await cached(`p:${id}`, () => api.passage(id));
  if (data.error) return { nodes: notFound() };
  const t = data.tale;
  const p = data.passage;
  if (p.hidden) {
    return {
      nodes: [
        crumbs([{ text: "Library", href: link.home() }, { text: t.title || "Tale", href: link.tale(t.id) }, { text: "Hidden passage" }]),
        h(
          "section.state",
          h("div.state-icon", icon("lock")),
          h("h1", { tabindex: "-1", text: "This passage was hidden" }),
          h("p", { text: "A moderator took this passage, or one before it, off the page." + (p.reason ? ` Reason: ${p.reason}` : "") }),
          h("a.btn.primary", { href: link.tale(t.id) }, icon("map"), h("span", { text: "Back to the tale" })),
        ),
      ],
    };
  }
  const canon = new Set(data.canon || []);
  const dir = p.depth >= lastDepth ? "forward" : "back";

  const trail = [{ text: "Library", href: link.home() }, { text: t.title, href: link.tale(t.id) }];
  const path = data.path.filter((a) => a.depth > 0);
  if (path.length > 3) trail.push({ text: "…" });
  for (const a of path.slice(-3)) trail.push({ text: a.choice, href: link.passage(a.id) });
  if (p.depth > 0) trail.push({ text: p.choice });

  const progress = h(
    "div.path-dots",
    { "aria-hidden": "true" },
    ...data.path.map((a) => h("a.dot", { href: link.passage(a.id), class: canon.has(a.id) ? "canon" : "", tabindex: "-1" })),
    h("span.dot.here", { class: canon.has(p.id) ? "canon" : "" }),
  );

  const metaBits = [
    h("span", "by ", bardChip(p.author, p.authorName)),
  ];
  if (p.height > 0) metaBits.push(h("span.muted", { text: `block ${fmt.int(p.height)}` }));
  if (p.tipsUgnot > 0) metaBits.push(h("span.tipped", icon("coin"), h("span", { text: fmt.gnot(p.tipsUgnot) })));

  const page = h(
    "article.page",
    { class: p.ending ? "is-ending" : "" },
    h(
      "p.chapter",
      { text: p.depth === 0 ? "The opening" : `Chapter ${p.depth + 1}` },
    ),
    h("h1", { tabindex: "-1", text: p.depth === 0 ? t.title : p.choice }),
    canon.has(p.id) ? h("p.canon-ribbon", icon("spark"), h("span", { text: "On the canon path" })) : null,
    h("div.prose.dropcap", ...richText(p.body)),
    h("p.page-meta", ...metaBits),
    p.ending ? h("div.the-end", h("span", { text: "The End" })) : null,
  );

  const cheerBtn = h(
    "button.btn.cheer",
    { type: "button", "aria-label": `Cheer this passage (${p.cheers} cheers)`, "data-passage": p.id },
    icon("mug"),
    h("span", { text: "Cheer" }),
    h("span.pill", { text: fmt.int(p.cheers) }),
  );
  cheerBtn.addEventListener("click", () => doCheer(p, cheerBtn));

  const tipBtn = h("button.btn.tip", { type: "button" }, icon("coin"), h("span", { text: "Tip the author" }));
  tipBtn.addEventListener("click", () => openTip(p, tipBtn));

  const canWrite = !p.ending && !t.locked && p.slots > 0;
  const actions = h(
    "div.actions",
    cheerBtn,
    tipBtn,
    canWrite
      ? h("button.btn.ghost", { type: "button", onclick: () => openCompose(p, false) }, icon("pen"), h("span", { text: "Add a choice" }))
      : null,
    canWrite
      ? h("button.btn.ghost", { type: "button", onclick: () => openCompose(p, true) }, icon("flag"), h("span", { text: "Write an ending" }))
      : null,
  );

  let next;
  if (p.ending) {
    next = h(
      "section.next.ending-next",
      h("h2", { text: "This path ends here" }),
      h("p", { text: "Every tale has more than one ending. Go back and choose differently, or read the path most readers chose." }),
      h(
        "div.row",
        h("a.btn.primary", { href: link.canon(t.id) }, icon("spark"), h("span", { text: "Read the canon" })),
        h("a.btn.ghost", { href: link.tale(t.id) }, icon("map"), h("span", { text: "Explore other branches" })),
      ),
    );
  } else {
    const choices = data.choices;
    next = h(
      "section.next",
      h("h2", { text: "What happens next?" }),
      choices.length
        ? h(
            "ol.choice-list",
            ...choices.map((c, i) =>
              h(
                "li",
                h(
                  "a.choice",
                  { href: link.passage(c.id), class: canon.has(c.id) ? "is-canon" : "", "data-key": i + 1 },
                  h("span.key", { text: String(i + 1), "aria-hidden": "true" }),
                  h("span.choice-text", { text: c.choice }),
                  h(
                    "span.choice-meta",
                    canon.has(c.id) ? h("span.badge.canon", icon("spark"), h("span", { text: "canon" })) : null,
                    c.ending ? h("span.badge.ending", icon("flag"), h("span", { text: "ending" })) : null,
                    h("span.count", icon("mug"), h("span", { text: fmt.int(c.cheers) }), h("span.sr-only", { text: " cheers" })),
                  ),
                  icon("next", "chev"),
                ),
              ),
            ),
          )
        : h(
            "div.state.inline",
            h("p", { text: "Nobody has written it yet. It could be you." }),
            canWrite
              ? h("button.btn.primary", { type: "button", onclick: () => openCompose(p, false) }, icon("pen"), h("span", { text: "Write what happens next" }))
              : null,
          ),
      t.locked ? h("p.notice", icon("lock"), h("span", { text: "The narrator finished this tale. No new passages, but cheers and tips still work." })) : null,
      !t.locked && !p.ending && p.slots <= 0 ? h("p.notice", { text: `This passage already has ${limits.maxChoices} choices.` }) : null,
    );
  }

  const pager = h(
    "nav.pager",
    { "aria-label": "Tale navigation" },
    p.parent
      ? h("a.btn.ghost", { href: link.passage(p.parent) }, icon("back"), h("span", { text: "Previous passage" }))
      : h("a.btn.ghost", { href: link.home() }, icon("back"), h("span", { text: "Library" })),
    h("a.btn.ghost", { href: link.tale(t.id) }, icon("map"), h("span", { text: "Map of the tale" })),
  );

  return {
    nodes: [crumbs(trail), progress, h("div.reader", page, actions, next), pager, gnowebFoot(`p/${p.id}`)],
    dir,
    after: () => {
      if (p.ending && p.depth > lastDepth) {
        setTimeout(() => {
          const end = main.querySelector(".the-end");
          if (end) confetti(end, 28);
        }, 380);
      }
      lastDepth = p.depth;
      markCheered(p, cheerBtn);
      if (wallet.address && wallet.address === p.author) {
        cheerBtn.disabled = true;
        tipBtn.disabled = true;
        cheerBtn.title = tipBtn.title = "This is your passage";
      }
    },
  };
}

async function markCheered(p, btn) {
  if (!wallet.address) return;
  try {
    if (await api.hasCheered(p.id, wallet.address)) {
      btn.classList.add("is-cheered");
      btn.disabled = true;
      btn.querySelector("span").textContent = "Cheered";
    }
  } catch {
    /* read-only hint; ignore */
  }
}

async function viewCanon(id) {
  const data = await cached(`canon:${id}`, () => api.canon(id));
  if (data.error) return { nodes: notFound() };
  const t = data.tale;
  const ps = data.passages;
  if (t.hidden || !ps.length) {
    return { nodes: emptyState("lock", "This tale was hidden", "A moderator took it off the shelves.") };
  }
  const last = ps[ps.length - 1];
  const book = h(
    "article.page.canon-book",
    h("p.chapter", icon("spark"), h("span", { text: "The canon" })),
    h("h1", { tabindex: "-1", text: t.title }),
    h("p.lede", { text: "The path readers cheered most, one passage after another." }),
    ...ps.map((p, i) =>
      h(
        "section.canon-part",
        i > 0 ? h("h2.canon-choice", h("a", { href: link.passage(p.id) }, icon("next"), h("span", { text: p.choice }))) : null,
        h("div.prose", { class: i === 0 ? "dropcap" : "" }, ...richText(p.body)),
        h("p.page-meta", h("span", "by ", bardChip(p.author, p.authorName)), stat("mug", fmt.int(p.cheers), "cheers")),
      ),
    ),
    last.ending
      ? h("div.the-end", h("span", { text: "The End" }))
      : h(
          "div.state.inline",
          h("p", { text: "The canon continues when someone writes what happens next." }),
          !t.locked
            ? h("a.btn.primary", { href: link.passage(last.id) }, icon("pen"), h("span", { text: "Continue the story" }))
            : null,
        ),
  );
  return {
    nodes: [crumbs([{ text: "Library", href: link.home() }, { text: t.title, href: link.tale(t.id) }, { text: "Canon" }]), book, gnowebFoot(`tale/${t.id}/canon`)],
  };
}

async function viewFame() {
  const data = await cached("fame", () => api.fame(50));
  const bards = data.bards || [];
  const head = pageTitle("Hall of fame", "Bards ranked by the cheers their passages received.");
  if (!bards.length) {
    return { nodes: [head, emptyState("trophy", "No bard yet", "Write the first passage and your name goes up here.")] };
  }
  const podium = h(
    "ol.podium",
    ...bards.slice(0, 3).map((b, i) =>
      h(
        "li.podium-spot",
        { class: `place-${i + 1}` },
        h("span.medal", { text: String(i + 1), "aria-label": `Rank ${i + 1}` }),
        monogram(b.addr, b.name),
        h("a.podium-name", { href: link.bard(b.addr), text: fmt.name(b.name, b.addr) }),
        h("p.big", h("strong", { text: fmt.int(b.cheers) }), h("span", { text: b.cheers === 1 ? " cheer" : " cheers" })),
        h("p.muted", { text: `${fmt.plural(b.passages, "passage")} · ${fmt.gnot(b.tipsUgnot)} tips` }),
      ),
    ),
  );
  const rest = bards.slice(3);
  const table = rest.length
    ? h(
        "div.table-wrap",
        h(
          "table.fame",
          h("caption.sr-only", { text: "Other bards" }),
          h("thead", h("tr", ...["#", "Bard", "Cheers", "Passages", "Tips"].map((c) => h("th", { scope: "col", text: c })))),
          h(
            "tbody",
            ...rest.map((b, i) =>
              h(
                "tr",
                h("td", { text: String(i + 4) }),
                h("td", bardChip(b.addr, b.name)),
                h("td.num", { text: fmt.int(b.cheers) }),
                h("td.num", { text: fmt.int(b.passages) }),
                h("td.num", { text: fmt.gnot(b.tipsUgnot) }),
              ),
            ),
          ),
        ),
      )
    : null;
  return { nodes: [head, podium, table, gnowebFoot("bards")] };
}

async function viewBard(addr) {
  if (!isAddress(addr)) return { nodes: notFound() };
  const data = await cached(`bard:${addr}`, () => api.bard(addr));
  if (data.error) return { nodes: notFound() };
  const name = fmt.name(data.name, addr);
  const head = h(
    "header.bard-head",
    monogram(addr, data.name),
    h("div", h("h1", { tabindex: "-1", text: name }), h("p.addr", h("code", { text: addr }))),
  );
  if (!data.bard) {
    return {
      nodes: [crumbs([{ text: "Hall of fame", href: link.fame() }, { text: name }]), head, emptyState("pen", "Nothing written yet", "This address has not written a passage.")],
    };
  }
  const b = data.bard;
  const nums = h(
    "ul.bard-stats",
    h("li", h("strong", { text: fmt.int(b.passages) }), h("span", { text: "passages" })),
    h("li", h("strong", { text: fmt.int(b.tales) }), h("span", { text: "tales started" })),
    h("li", h("strong", { text: fmt.int(b.cheers) }), h("span", { text: "cheers received" })),
    h("li", h("strong", { text: fmt.gnot(b.tipsUgnot) }), h("span", { text: "in tips" })),
  );
  const list = data.passages.length
    ? h(
        "ul.passage-list",
        ...data.passages.map((p) =>
          h(
            "li",
            h(
              "a.card.passage-card",
              { href: link.passage(p.id) },
              h("span.muted", { text: p.depth === 0 ? "Opening of" : `Chapter ${p.depth + 1} of` }),
              h("strong", { text: p.depth === 0 ? p.taleTitle : p.choice }),
              p.depth === 0 ? null : h("span.muted", { text: p.taleTitle }),
              h("span.stats", stat("mug", fmt.int(p.cheers), "cheers"), p.ending ? h("span.badge.ending", icon("flag"), h("span", { text: "ending" })) : null),
            ),
          ),
        ),
      )
    : h("p.muted", { text: "Nothing to show." });
  return {
    nodes: [
      crumbs([{ text: "Hall of fame", href: link.fame() }, { text: name }]),
      head,
      nums,
      h("section", h("h2", { text: "Latest passages" }), list),
      gnowebFoot(`bard/${addr}`),
    ],
  };
}

function viewNew() {
  const title = field({ id: "nt-title", label: "Title", min: limits.minTitle, max: limits.maxTitle, placeholder: "The Lantern Cellar" });
  const opening = field({
    id: "nt-opening",
    label: "Opening passage",
    min: limits.minBody,
    max: limits.maxBody,
    multiline: true,
    placeholder: "Rain hammers the shutters of the Copper Kettle…",
    hint: "Set the scene and end on a question. Readers will write the choices.",
  });
  const preview = h("div.prose.dropcap.preview-body");
  const previewTitle = h("h2.preview-title", { text: "Your title" });
  const refresh = () => {
    previewTitle.textContent = title.value().trim() || "Your title";
    const nodes = richText(opening.value());
    preview.replaceChildren(...(nodes.length ? nodes : [h("p.muted", { text: "Your opening appears here as readers will see it." })]));
  };
  title.input.addEventListener("input", refresh);
  opening.input.addEventListener("input", refresh);
  refresh();

  const form = h(
    "form.compose-form",
    { novalidate: true },
    title.el,
    opening.el,
    h("div.row", h("button.btn.primary.lg", { type: "submit" }, icon("pen"), h("span", { text: "Start the tale" }))),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (![title.validate(), opening.validate()].every(Boolean)) {
      form.querySelector("[aria-invalid='true']")?.focus();
      return;
    }
    const args = [title.value().trim(), opening.value().trim()];
    const btn = form.querySelector("button[type=submit]");
    await act("StartTale", args, "", {
      origin: btn,
      what: "Your tale",
      onDone: () => {
        location.hash = link.home();
      },
    });
  });

  return {
    nodes: [
      crumbs([{ text: "Library", href: link.home() }, { text: "Start a tale" }]),
      pageTitle("Start a tale", "Write an opening. Anyone can add the first choice under it, and you become the narrator."),
      h("div.compose-grid", form, h("aside.page.preview", { "aria-label": "Preview" }, h("p.chapter", { text: "Preview" }), previewTitle, preview)),
    ],
  };
}

function gnowebFoot(path) {
  return h("p.gnoweb-foot", externalLink(gnowebURL(path), "View this page in gnoweb"));
}

// ----- form fields -----

function field({ id, label, min, max, multiline = false, placeholder = "", hint = "" }) {
  const input = multiline
    ? h("textarea", { id, name: id, rows: 8, placeholder, "aria-describedby": `${id}-count ${id}-msg` })
    : h("input", { id, name: id, type: "text", autocomplete: "off", placeholder, "aria-describedby": `${id}-count ${id}-msg` });
  const counter = h("span.counter", { id: `${id}-count`, "aria-live": "polite" });
  const msg = h("p.field-msg", { id: `${id}-msg` });
  const meter = h("span.meter", h("span.meter-fill"));
  const el = h(
    "div.field",
    h("div.field-top", h("label", { for: id, text: label }), counter),
    hint ? h("p.hint", { text: hint }) : null,
    input,
    meter,
    msg,
  );
  let touched = false;
  const update = () => {
    const n = fmt.bytes(input.value.trim());
    counter.textContent = `${fmt.int(n)} / ${fmt.int(max)}`;
    const ok = n >= min && n <= max;
    el.classList.toggle("over", n > max);
    el.classList.toggle("ok", ok);
    const k = Math.min(1, n / max);
    // Ten fixed width steps, set by class: no inline style.
    meter.className = `meter step-${Math.round(k * 10)}`;
    if (touched) showMsg(n);
    return ok;
  };
  const showMsg = (n) => {
    let text = "";
    if (n < min) text = `At least ${min} characters (${min - n} to go).`;
    else if (n > max) text = `At most ${fmt.int(max)} characters (${fmt.int(n - max)} too many).`;
    msg.textContent = text;
    input.setAttribute("aria-invalid", text ? "true" : "false");
  };
  input.addEventListener("input", update);
  input.addEventListener("blur", () => {
    touched = true;
    update();
  });
  update();
  return {
    el,
    input,
    value: () => input.value,
    validate: () => {
      touched = true;
      return update();
    },
  };
}

// ----- dialogs -----

const dialog = document.getElementById("dialog");
const dialogBody = document.getElementById("dialog-body");
const dialogTitle = document.getElementById("dialog-title");
let dialogOpener = null;

function openDialog(title, ...content) {
  dialogOpener = document.activeElement;
  dialogTitle.textContent = title;
  dialogBody.replaceChildren(...content.flat().filter(Boolean));
  if (!dialog.open) dialog.showModal();
  const first = dialogBody.querySelector("input, textarea, button, a[href]");
  if (first) first.focus();
}
function closeDialog() {
  if (dialog.open) dialog.close();
}
dialog.addEventListener("close", () => {
  if (dialogOpener && document.contains(dialogOpener)) dialogOpener.focus();
});
document.getElementById("dialog-close").addEventListener("click", closeDialog);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeDialog();
});

function openCompose(parent, ending) {
  const choice = field({
    id: "c-choice",
    label: ending ? "Choice that leads to the ending" : "Choice text",
    min: limits.minChoice,
    max: limits.maxChoice,
    placeholder: ending ? "Give the key back" : "Open the cellar door",
    hint: "The link readers click, like a button in a game.",
  });
  const body = field({
    id: "c-body",
    label: ending ? "The ending" : "What happens next",
    min: limits.minBody,
    max: limits.maxBody,
    multiline: true,
    placeholder: ending ? "And so the story ends…" : "The stairs are slick with something that is not water…",
  });
  const submit = h("button.btn.primary", { type: "submit" }, icon(ending ? "flag" : "pen"), h("span", { text: ending ? "Publish the ending" : "Publish the choice" }));
  const form = h(
    "form.compose-form",
    { novalidate: true },
    h("p.muted", { text: `Under “${parent.depth === 0 ? "the opening" : parent.choice}”.` }),
    choice.el,
    body.el,
    ending ? h("p.hint", { text: "An ending closes this path: nobody can add choices under it." }) : null,
    h("div.row", submit),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (![choice.validate(), body.validate()].every(Boolean)) {
      form.querySelector("[aria-invalid='true']")?.focus();
      return;
    }
    const fn = ending ? "WriteEnding" : "Branch";
    await act(fn, [String(parent.id), choice.value().trim(), body.value().trim()], "", {
      origin: submit,
      what: ending ? "Your ending" : "Your choice",
      onDone: () => {
        if (ending) confetti(document.querySelector(".next") || document.body);
      },
    });
  });
  openDialog(ending ? "Write an ending" : "Add a choice", form);
}

function openTip(p, origin) {
  let amount = 1;
  const group = h("div.tip-amounts", { role: "radiogroup", "aria-label": "Tip amount" });
  const buttons = config.tipPresets.map((v) => {
    const b = h("button.btn.chip", { type: "button", role: "radio", "aria-checked": v === amount ? "true" : "false", text: `${v} GNOT` });
    b.addEventListener("click", () => {
      amount = v;
      for (const o of buttons) o.setAttribute("aria-checked", o === b ? "true" : "false");
    });
    return b;
  });
  group.append(...buttons);
  const send = h("button.btn.primary.tip", { type: "button" }, icon("coin"), h("span", { text: "Send tip" }));
  send.addEventListener("click", async () => {
    const ugnot = Math.round(amount * 1e6);
    await act("Tip", [String(p.id)], `${ugnot}ugnot`, {
      origin: send,
      what: `Your ${amount} GNOT tip`,
      onDone: () => coinBurst(origin),
    });
  });
  openDialog(
    "Tip the author",
    h("p", "All of it goes to ", bardChip(p.author, p.authorName), " in the same transaction. The realm keeps nothing."),
    group,
    h("div.row", send),
  );
}

function openWalletHelp() {
  openDialog(
    "Writing to Taletree",
    h("p", { text: "Reading needs nothing. To write, cheer or tip you sign a transaction with your own key:" }),
    h(
      "ul.tips",
      h("li", h("strong", { text: "Adena wallet: " }), "install the browser extension, then press Connect. Each action opens Adena for you to approve."),
      h("li", h("strong", { text: "gnokey: " }), "without Adena, every action gives you a ready-to-copy gnokey command for your own key."),
    ),
    h("p.muted", { text: "This page never asks for a recovery phrase or a password." }),
    h("div.row", externalLink("https://www.adena.app/", "Get Adena"), externalLink("https://docs.gno.land/users/interact-with-gnokey", "gnokey guide")),
  );
}

// ----- actions -----

async function act(func, args, send, { origin, what, onDone }) {
  if (!wallet.available) {
    showGnokey(func, args, send);
    return;
  }
  origin.disabled = true;
  origin.classList.add("is-busy");
  try {
    const res = await call(func, args, send);
    closeDialog();
    toast(`${what} is on chain.`, "ok", { detail: res.hash ? `tx ${res.hash.slice(0, 16)}…` : "" });
    invalidate();
    if (onDone) onDone();
    setTimeout(render, 900);
  } catch (err) {
    const msg = err instanceof WalletError ? err.message : "The transaction did not go through.";
    toast(msg, "error", { detail: err && err.type ? err.type : "" });
  } finally {
    origin.disabled = false;
    origin.classList.remove("is-busy");
  }
}

function showGnokey(func, args, send) {
  const cmd = gnokeyCommand(func, args, send);
  const pre = h("pre.cmd", { tabindex: "0" }, h("code", { text: cmd }));
  const copy = h("button.btn.primary", { type: "button" }, icon("copy"), h("span", { text: "Copy command" }));
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      copy.querySelector("span").textContent = "Copied";
      toast("Command copied. Run it in a terminal with your key.", "ok");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast("Select-all done: press Ctrl+C to copy.", "info");
    }
  });
  const params = {};
  const names = { StartTale: ["title", "opening"], Branch: ["parentID", "choice", "body"], WriteEnding: ["parentID", "choice", "body"], Cheer: ["passageID"], Tip: ["passageID"] }[func] || [];
  names.forEach((n, i) => {
    if (args[i] !== undefined && args[i].length < 300) params[n] = args[i];
  });
  const refresh = h("button.btn.ghost", { type: "button" }, icon("refresh"), h("span", { text: "I ran it, refresh" }));
  refresh.addEventListener("click", () => {
    invalidate();
    closeDialog();
    render();
  });
  openDialog(
    "Sign with gnokey",
    h("p", { text: "No Adena wallet found, so here is the same action as a gnokey command. Replace YOUR_KEY_NAME with a key from gnokey list." }),
    pre,
    h("div.row", copy, refresh),
    h("p.muted", "Prefer a form? ", externalLink(gnowebActionURL(func, params, send), "Open this action in gnoweb")),
  );
}

async function doCheer(p, btn) {
  if (!wallet.available) {
    showGnokey("Cheer", [String(p.id)], "");
    return;
  }
  btn.disabled = true;
  btn.classList.add("is-busy");
  try {
    await call("Cheer", [String(p.id)], "");
    btn.classList.remove("is-busy");
    btn.classList.add("is-cheered", "pop");
    btn.querySelector("span").textContent = "Cheered";
    btn.querySelector(".pill").textContent = fmt.int(p.cheers + 1);
    plusOne(btn);
    toast("Cheers! Your vote helps pick the canon.", "ok");
    invalidate();
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove("is-busy");
    toast(err instanceof WalletError ? err.message : "The cheer did not go through.", "error");
  }
}

// ----- header: wallet, network, theme -----

const walletBtn = document.getElementById("wallet-btn");
function paintWallet() {
  const label = walletBtn.querySelector("span");
  walletBtn.classList.toggle("is-connected", wallet.connected);
  if (wallet.connected) {
    label.textContent = fmt.short(wallet.address);
    walletBtn.title = `Connected: ${wallet.address}`;
  } else if (wallet.available) {
    label.textContent = "Connect Adena";
    walletBtn.title = "Connect the Adena wallet to write, cheer and tip";
  } else {
    label.textContent = "How to write";
    walletBtn.title = "Reading is open to all. See how to write.";
  }
}
walletBtn.addEventListener("click", async () => {
  if (!wallet.available) return openWalletHelp();
  if (wallet.connected) return navigateTo(link.bard(wallet.address));
  try {
    await connect();
    toast("Adena connected. You can write, cheer and tip.", "ok");
    render();
  } catch (err) {
    toast(err.message || "Could not connect Adena.", "error");
  }
});
let seenAddress = "";
wallet.onChange(() => {
  paintWallet();
  // A new account changes what this page shows (cheered, own passage): redraw it.
  if (wallet.address !== seenAddress) {
    seenAddress = wallet.address;
    if (!firstRender) render();
  }
});

function navigateTo(hash) {
  location.hash = hash;
}

const netPill = document.getElementById("net");
async function pollStatus() {
  try {
    const s = await status();
    netPill.className = "net ok";
    netPill.querySelector(".net-label").textContent = `${config.chainName} · block ${fmt.int(s.height)}`;
    netPill.title = `Node ${config.rpc}, chain ${s.chainId}`;
  } catch {
    netPill.className = "net down";
    netPill.querySelector(".net-label").textContent = "Node offline";
    netPill.title = `Cannot reach ${config.rpc}`;
  }
}

const themeBtn = document.getElementById("theme-btn");
const THEMES = ["auto", "light", "dark"];
function paintTheme() {
  const t = document.documentElement.dataset.theme || "auto";
  themeBtn.replaceChildren(icon(t === "light" ? "sun" : t === "dark" ? "moon" : "auto"), h("span.sr-only", { text: `Theme: ${t}` }));
  themeBtn.title = `Theme: ${t} (click to change)`;
}
themeBtn.addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "auto";
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("taletree-theme", next);
  } catch {
    /* private mode */
  }
  paintTheme();
});

// Number keys pick a choice on the reader page.
document.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || dialog.open) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (/^[1-8]$/.test(e.key)) {
    const a = main.querySelector(`.choice[data-key="${e.key}"]`);
    if (a) {
      e.preventDefault();
      a.click();
    }
  }
});

// ----- boot -----

window.addEventListener("hashchange", render);
document.getElementById("year").textContent = String(new Date().getFullYear());
paintTheme();
paintWallet();
render();
pollStatus();
setInterval(() => {
  if (!document.hidden) pollStatus();
}, 15000);
restore().then(paintWallet);
