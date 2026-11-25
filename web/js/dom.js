// Tiny DOM helpers. Text always goes in through textContent or text
// nodes; nothing here ever assigns innerHTML.

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * h("a.btn.primary", { href: "#/" }, "Read", child...)
 * Props: class, text, on* handlers, data-*, aria-*, any attribute.
 * The "style" attribute is refused (the page runs under a strict CSP).
 */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "style") throw new Error("inline style is not allowed");
    if (k === "class") el.className = [el.className, v].filter(Boolean).join(" ");
    else if (k === "text") el.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Simple 24x24 line icons drawn for this app (stroke = currentColor).
const ICONS = {
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"],
  pen: ["M16.5 3.5l4 4L8 20H4v-4z", "M14 6l4 4"],
  mug: ["M5 8h10v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z", "M15 11h2a3 3 0 0 1 0 6h-2", "M7 4.5c0-1 1-1.5 1-2.5", "M11 4.5c0-1 1-1.5 1-2.5"],
  coin: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M14.5 9.2c-.5-.9-1.5-1.4-2.6-1.4c-1.5 0-2.7.8-2.7 2c0 2.9 5.6 1.5 5.6 4.3c0 1.2-1.2 2.1-2.8 2.1c-1.2 0-2.3-.6-2.8-1.6", "M12 6v1.8", "M12 16.2V18"],
  flag: ["M5 21V4", "M5 4h11l-2 4l2 4H5"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"],
  trophy: ["M7 4h10v5a5 5 0 0 1-10 0z", "M7 6H4a3 3 0 0 0 3 4", "M17 6h3a3 3 0 0 1-3 4", "M12 14v4", "M8 21h8", "M9 18h6v3H9z"],
  map: ["M3 6l6-2l6 2l6-2v14l-6 2l-6-2l-6 2z", "M9 4v14", "M15 6v14"],
  back: ["M15 5l-7 7l7 7"],
  next: ["M9 5l7 7l-7 7"],
  sun: ["M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M2 12h2", "M20 12h2", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  moon: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
  auto: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M12 3v18", "M12 3a9 9 0 0 1 0 18z"],
  copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  wallet: ["M3 7a2 2 0 0 1 2-2h13v4", "M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z", "M16 14.5h1"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  lock: ["M6 11h12v10H6z", "M8 11V8a4 4 0 0 1 8 0v3"],
  refresh: ["M20 12a8 8 0 1 1-2.3-5.6", "M20 4v4.5h-4.5"],
  tree: ["M12 21v-8", "M12 13l-5-4", "M12 13l5-5", "M7 9l-3-3", "M7 9v-4", "M17 8l3-2", "M17 8V4"],
  external: ["M14 4h6v6", "M20 4l-9 9", "M18 14v6H4V6h6"],
  user: ["M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M4 21a8 8 0 0 1 16 0"],
  alert: ["M12 3l10 18H2z", "M12 10v5", "M12 18v.5"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  terminal: ["M3 5h18v14H3z", "M7 9l3 3l-3 3", "M12 15h5"],
};

export function icon(name, cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `icon ${cls}`.trim());
  for (const d of ICONS[name] || []) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

export const fmt = {
  int: (n) => Number(n || 0).toLocaleString("en-US"),
  gnot: (ugnot) => {
    const v = Number(ugnot || 0) / 1e6;
    return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} GNOT`;
  },
  plural: (n, word) => `${fmt.int(n)} ${word}${Number(n) === 1 ? "" : "s"}`,
  short: (addr) => (addr && addr.length > 14 ? `${addr.slice(0, 7)}…${addr.slice(-4)}` : addr || ""),
  name: (name, addr) => (name && name !== addr ? name : fmt.short(addr)),
  ago: (unix) => {
    if (!unix) return "";
    const s = Math.max(0, Date.now() / 1000 - unix);
    if (s < 60) return "just now";
    const units = [
      [86400 * 365, "year"],
      [86400 * 30, "month"],
      [86400, "day"],
      [3600, "hour"],
      [60, "minute"],
    ];
    for (const [sec, unit] of units) {
      if (s >= sec) {
        const n = Math.floor(s / sec);
        return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
      }
    }
    return "";
  },
  bytes: (s) => new TextEncoder().encode(s).length,
};

/** Split a passage body into paragraphs (blank-line separated). */
export function paragraphs(body) {
  return String(body || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
