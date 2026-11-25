// Motion and feedback: toasts, count-up numbers, a light confetti and a
// coin burst. Everything is plain DOM + the Web Animations API (no inline
// style attributes, no canvas) and turns itself off for reduced motion.
import { h, icon } from "./dom.js";

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => motionQuery.matches;

// ----- toasts -----

let toastRoot;
export function toast(message, kind = "info", opts = {}) {
  toastRoot ||= document.getElementById("toasts");
  const iconName = { ok: "check", error: "alert", info: "spark" }[kind] || "spark";
  const t = h(
    "div.toast",
    { class: `toast-${kind}`, role: kind === "error" ? "alert" : "status" },
    icon(iconName),
    h("div.toast-body", h("p", { text: message }), opts.detail ? h("p.toast-detail", { text: opts.detail }) : null),
    h("button.icon-btn.toast-close", { type: "button", "aria-label": "Dismiss", onclick: () => dismiss() }, icon("close")),
  );
  toastRoot.append(t);
  requestAnimationFrame(() => t.classList.add("in"));
  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    t.classList.remove("in");
    t.classList.add("out");
    setTimeout(() => t.remove(), reducedMotion() ? 0 : 260);
  };
  setTimeout(dismiss, opts.ms || (kind === "error" ? 9000 : 5000));
  return dismiss;
}

// ----- numbers -----

export function countUp(el, to, format = (n) => Math.round(n).toLocaleString("en-US")) {
  if (reducedMotion() || !to) {
    el.textContent = format(to);
    return;
  }
  const dur = 900;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = format(to * eased);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ----- celebrations -----

const COLORS = ["c1", "c2", "c3", "c4", "c5"];

function layer() {
  const l = h("div.fx-layer", { "aria-hidden": "true" });
  document.body.append(l);
  return l;
}

/** A short confetti burst from the centre of `origin` (an element). */
export function confetti(origin, count = 36) {
  if (reducedMotion()) return;
  const r = origin.getBoundingClientRect();
  const x0 = r.left + r.width / 2;
  const y0 = r.top + r.height / 2;
  const l = layer();
  let done = 0;
  for (let i = 0; i < count; i++) {
    const bit = h("i.confetti", { class: COLORS[i % COLORS.length] + (i % 3 === 0 ? " round" : "") });
    l.append(bit);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 90 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 80;
    const spin = (Math.random() * 720 - 360) | 0;
    const a = bit.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(1)`, opacity: 1 },
        { transform: `translate(${x0 + dx * 0.7}px, ${y0 + dy}px) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x0 + dx}px, ${y0 + dy + 220}px) rotate(${spin}deg) scale(.6)`, opacity: 0 },
      ],
      { duration: 1300 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    );
    a.onfinish = () => {
      if (++done === count) l.remove();
    };
  }
}

/** Coins rising from a button, for tips. */
export function coinBurst(origin, count = 9) {
  if (reducedMotion()) return;
  const r = origin.getBoundingClientRect();
  const x0 = r.left + r.width / 2 - 12;
  const y0 = r.top;
  const l = layer();
  let done = 0;
  for (let i = 0; i < count; i++) {
    const c = h("i.coin-fx", icon("coin"));
    l.append(c);
    const dx = (i - (count - 1) / 2) * 16 + (Math.random() * 10 - 5);
    const a = c.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x0 + dx * 0.5}px, ${y0 - 50}px) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x0 + dx}px, ${y0 - 150 - Math.random() * 40}px) scale(.8)`, opacity: 0 },
      ],
      { duration: 1100 + i * 40, delay: i * 45, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
    );
    a.onfinish = () => {
      if (++done === count) l.remove();
    };
  }
}

/** A bouncing "+1" over the cheer button. */
export function plusOne(origin) {
  if (reducedMotion()) return;
  const r = origin.getBoundingClientRect();
  const l = layer();
  const t = h("span.plus-one", { text: "+1" });
  l.append(t);
  const x = r.left + r.width / 2 - 14;
  const y = r.top - 6;
  t.animate(
    [
      { transform: `translate(${x}px, ${y}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - 26}px) scale(1.15)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x}px, ${y - 60}px) scale(1)`, opacity: 0 },
    ],
    { duration: 900, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => l.remove();
}

// ----- page transitions -----

/**
 * Swap the view. Uses the View Transitions API when present (and motion
 * is allowed), else a CSS class animation.
 */
export async function swap(container, build, direction = "forward") {
  const apply = () => {
    container.replaceChildren(...[].concat(build()).filter(Boolean));
  };
  document.documentElement.dataset.dir = direction;
  if (reducedMotion()) {
    apply();
    return;
  }
  if (document.startViewTransition) {
    try {
      const vt = document.startViewTransition(apply);
      // A hidden tab aborts the transition; keep every promise handled so the
      // console stays clean.
      vt.ready.catch(() => {});
      vt.updateCallbackDone.catch(() => {});
      await vt.finished;
    } catch {
      /* transition skipped, the DOM is already updated */
    }
    return;
  }
  apply();
  container.classList.remove("enter");
  void container.offsetWidth;
  container.classList.add("enter");
}
