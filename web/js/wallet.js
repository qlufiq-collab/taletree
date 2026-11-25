// Writing to the realm: through the Adena browser wallet when it is
// installed, otherwise through a copy-ready `gnokey maketx call` command.
// This page never asks for, sees or stores a mnemonic or a password.
import config from "../config.js";

const listeners = new Set();
const state = { address: "", chainId: "", connecting: false };

export const wallet = {
  get address() {
    return state.address;
  },
  get chainId() {
    return state.chainId;
  },
  get available() {
    return typeof window !== "undefined" && !!window.adena;
  },
  get connected() {
    return !!state.address;
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function emit() {
  for (const fn of listeners) fn(wallet);
}

export class WalletError extends Error {
  constructor(message, type = "") {
    super(message);
    this.type = type;
  }
}

/** Wait a little for the extension to inject window.adena. */
export function waitForAdena(ms = 1500) {
  return new Promise((resolve) => {
    if (window.adena) return resolve(true);
    const started = performance.now();
    const tick = () => {
      if (window.adena) return resolve(true);
      if (performance.now() - started > ms) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

const friendly = {
  NOT_CONNECTED: "Connect Adena first.",
  WALLET_LOCKED: "Adena is locked. Unlock it and try again.",
  NO_ACCOUNT: "Adena has no account yet.",
  ACCOUNT_MISMATCH: "The account in Adena changed. Try again.",
  TRANSACTION_REJECTED: "You declined the transaction in Adena.",
  CONNECTION_REJECTED: "You declined the connection in Adena.",
  SWITCH_NETWORK_REJECTED: "You declined the network switch in Adena.",
  ADD_NETWORK_REJECTED: "You declined adding the network in Adena.",
  UNRESOLVED_TRANSACTION_EXISTS: "Adena already has a request open. Finish it first.",
  TRANSACTION_FAILED: "The transaction failed on chain.",
};

function check(res, okTypes = []) {
  if (!res) throw new WalletError("Adena did not answer.");
  if (res.status === "success" || okTypes.includes(res.type)) return res;
  throw new WalletError(friendly[res.type] || res.message || "Adena returned an error.", res.type || "");
}

async function readAccount() {
  const res = check(await window.adena.GetAccount());
  state.address = (res.data && res.data.address) || "";
  state.chainId = (res.data && res.data.chainId) || "";
}

/** Ask Adena for access, then make sure it is on the realm's chain. */
export async function connect() {
  if (!window.adena) throw new WalletError("Adena is not installed in this browser.", "NO_ADENA");
  state.connecting = true;
  emit();
  try {
    check(await window.adena.AddEstablish("Taletree"), ["ALREADY_CONNECTED"]);
    await readAccount();
    await ensureNetwork();
    hookEvents();
  } finally {
    state.connecting = false;
    emit();
  }
}

/** Reconnect silently when the site was already approved. */
export async function restore() {
  if (!(await waitForAdena())) return;
  try {
    const res = await window.adena.GetAccount();
    if (res && res.status === "success") {
      state.address = res.data.address || "";
      state.chainId = res.data.chainId || "";
      hookEvents();
      emit();
    }
  } catch {
    /* not approved yet: stay read-only until the reader clicks Connect */
  }
}

async function ensureNetwork() {
  if (state.chainId === config.chainId) return;
  let res = await window.adena.SwitchNetwork(config.chainId);
  if (res && res.type === "UNADDED_NETWORK") {
    check(await window.adena.AddNetwork({ chainId: config.chainId, chainName: config.chainName, rpcUrl: config.rpc }));
    res = await window.adena.SwitchNetwork(config.chainId);
  }
  check(res, ["REDUNDANT_CHANGE_REQUEST"]);
  state.chainId = config.chainId;
}

let hooked = false;
function hookEvents() {
  if (hooked || !window.adena || typeof window.adena.On !== "function") return;
  hooked = true;
  window.adena.On("changedAccount", (addr) => {
    state.address = typeof addr === "string" ? addr : "";
    emit();
  });
  window.adena.On("changedNetwork", (chainId) => {
    state.chainId = typeof chainId === "string" ? chainId : "";
    emit();
  });
}

/**
 * Sign and broadcast one realm call with Adena.
 * @param {string} func realm function, e.g. "Branch"
 * @param {string[]} args arguments as strings, in order
 * @param {string} send coins sent with the call, e.g. "1000000ugnot"
 */
export async function call(func, args, send = "") {
  if (!state.address) await connect();
  await ensureNetwork();
  const res = await window.adena.DoContract({
    messages: [
      {
        type: "/vm.m_call",
        value: { caller: state.address, send, pkg_path: config.realmPath, func, args },
      },
    ],
    memo: "taletree web",
  });
  check(res, ["TRANSACTION_BROADCAST_SUCCESS"]);
  return { hash: (res.data && res.data.hash) || "", height: Number((res.data && res.data.height) || 0) };
}

// ----- gnokey fallback -----

/** POSIX shell single-quote. */
export function shq(s) {
  const str = String(s);
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(str)) return str;
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * A copy-ready gnokey command for one realm call. Newlines in long text
 * become the two characters \n, which the realm turns back into line
 * breaks, so the command stays on one logical line.
 */
export function gnokeyCommand(func, args, send = "") {
  const parts = [
    "gnokey maketx call",
    `  -pkgpath ${shq(config.realmPath)}`,
    `  -func ${func}`,
    ...args.map((a) => `  -args ${shq(String(a).replace(/\r?\n/g, "\\n"))}`),
  ];
  if (send) parts.push(`  -send ${send}`);
  parts.push(
    `  -gas-fee ${config.gasFee} -gas-wanted ${config.gasWanted}`,
    `  -broadcast -chainid ${shq(config.chainId)} -remote ${shq(config.gnokeyRemote)}`,
    "  YOUR_KEY_NAME",
  );
  return parts.join(" \\\n");
}

/** gnoweb's own action page for the call (it can sign with Adena too). */
export function gnowebActionURL(func, params = {}, send = "") {
  const realm = config.realmPath.replace(/^gno\.land/, "");
  const q = new URLSearchParams({ func, ...params });
  if (send) q.set(".send", send);
  return `${config.gnoweb}${realm}$help&${q.toString()}`;
}
