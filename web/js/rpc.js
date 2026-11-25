// Read-only access to the Taletree realm over Tendermint JSON-RPC.
// Every read is one `abci_query` on `vm/qeval`, calling a *JSON function
// of the realm. The realm returns a Go string; it is unquoted here and
// parsed with JSON.parse. Nothing from the chain is ever turned into HTML.
import config from "../config.js";

const TIMEOUT_MS = 9000;
let nextId = 1;

export class NodeError extends Error {
  constructor(message, kind = "network", detail = "") {
    super(message);
    this.kind = kind; // "network" | "query" | "parse"
    this.detail = detail;
  }
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder("utf-8", { fatal: false });

function toBase64(text) {
  let bin = "";
  for (const byte of utf8.encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return fromUtf8.decode(bytes);
}

async function rpc(method, params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(config.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new NodeError(
      ctrl.signal.aborted ? "The node took too long to answer." : "Could not reach the node.",
      "network",
      String(err && err.message ? err.message : err),
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new NodeError(`The node answered HTTP ${res.status}.`, "network");
  let body;
  try {
    body = await res.json();
  } catch {
    throw new NodeError("The node sent something that is not JSON.", "parse");
  }
  if (body.error) {
    throw new NodeError("The node rejected the request.", "query", body.error.data || body.error.message || "");
  }
  return body.result;
}

/** Node status: chain id and latest block height. */
export async function status() {
  const r = await rpc("status", {});
  const info = r && r.sync_info ? r.sync_info : {};
  const node = r && r.node_info ? r.node_info : {};
  return { height: Number(info.latest_block_height || 0), chainId: node.network || "" };
}

async function abciQuery(path, data) {
  const r = await rpc("abci_query", { path, data: toBase64(data) });
  const base = r && r.response && r.response.ResponseBase;
  if (!base) throw new NodeError("Unexpected answer from the node.", "parse");
  if (base.Error) {
    const type = (base.Error && base.Error["@type"]) || "";
    const line = (base.Log || "").split("\n").find((l) => l.trim() && !l.startsWith("--=")) || "";
    throw new NodeError("The realm could not answer this query.", "query", [type, line.trim()].filter(Boolean).join(" · ").slice(0, 300));
  }
  return fromBase64(base.Data);
}

/**
 * Unquote a Go string literal as printed by strconv.Quote. Handles
 * the simple escapes, octal, hex bytes and 4/8-digit code points.
 */
export function goUnquote(lit) {
  if (lit.length < 2 || lit[0] !== '"' || lit[lit.length - 1] !== '"') {
    throw new NodeError("Unexpected value from the realm.", "parse");
  }
  const s = lit.slice(1, -1);
  const out = [];
  let run = "";
  const flush = () => {
    if (run) {
      for (const b of utf8.encode(run)) out.push(b);
      run = "";
    }
  };
  const simple = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, "\\": 92, '"': 34, "'": 39 };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") {
      run += c;
      continue;
    }
    const e = s[++i];
    if (e in simple) {
      flush();
      out.push(simple[e]);
    } else if (e === "x") {
      flush();
      out.push(parseInt(s.substr(i + 1, 2), 16));
      i += 2;
    } else if (e === "u" || e === "U") {
      const n = e === "u" ? 4 : 8;
      const cp = parseInt(s.substr(i + 1, n), 16);
      i += n;
      run += String.fromCodePoint(cp);
    } else if (e >= "0" && e <= "7") {
      flush();
      out.push(parseInt(s.substr(i, 3), 8));
      i += 2;
    } else {
      throw new NodeError("Unexpected escape in a realm value.", "parse");
    }
  }
  flush();
  return fromUtf8.decode(new Uint8Array(out));
}

/** Evaluate `<realm>.<expr>` and return the raw qeval text. */
export async function qeval(expr) {
  return abciQuery("vm/qeval", `${config.realmPath}.${expr}`);
}

/** Call one of the realm's *JSON functions and parse the result. */
export async function readJSON(expr) {
  const raw = (await qeval(expr)).trim();
  const m = /^\((".*") string\)$/s.exec(raw);
  if (!m) throw new NodeError("Unexpected value from the realm.", "parse", raw.slice(0, 120));
  try {
    return JSON.parse(goUnquote(m[1]));
  } catch (err) {
    if (err instanceof NodeError) throw err;
    throw new NodeError("The realm sent JSON this page cannot read.", "parse");
  }
}

const int = (n) => {
  const v = Number(n);
  if (!Number.isSafeInteger(v) || v < 0) throw new NodeError("Invalid id.", "query");
  return v;
};

export const isAddress = (a) => typeof a === "string" && /^g1[02-9ac-hj-np-z]{38}$/.test(a);

export const api = {
  stats: () => readJSON("StatsJSON()"),
  tales: (page = 1, size = 24) => readJSON(`TalesJSON(${int(page)}, ${int(size)})`),
  tale: (id) => readJSON(`TaleJSON(${int(id)})`),
  passage: (id) => readJSON(`PassageJSON(${int(id)})`),
  canon: (id) => readJSON(`CanonJSON(${int(id)})`),
  fame: (limit = 50) => readJSON(`FameJSON(${int(limit)})`),
  bard: (addr) => {
    if (!isAddress(addr)) return Promise.resolve({ error: "invalid_address" });
    return readJSON(`BardJSON("${addr}")`);
  },
  hasCheered: async (passageID, addr) => {
    if (!isAddress(addr)) return false;
    const raw = await qeval(`HasCheered(${int(passageID)}, "${addr}")`);
    return /^\(true bool\)/.test(raw.trim());
  },
};
