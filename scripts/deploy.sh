#!/usr/bin/env bash
# Deploy the Taletree realm under your own address namespace.
#
#   KEY=<gnokey key name> ADDR=<your g1 address> ./scripts/deploy.sh
#
# Defaults target the Onyx testnet (chain id onyx-1). The script copies
# realm/ to a temp dir, rewrites the module path to
# gno.land/r/<ADDR>/taletree/v0, runs the unit tests on that copy, then
# sends one addpkg transaction signed by KEY.
#
# Optional: REMOTE, CHAINID, NAME (path after the namespace, default
# taletree/v0), GAS_WANTED, GAS_FEE, MAX_DEPOSIT, GNOKEY_HOME,
# SKIP_TESTS=1.
#
# Cost measured on a local gnodev (v1.8.0), with the JSON read API:
# ~115M gas and a storage deposit of 12,524,200 ugnot (125,242 bytes at
# 100 ugnot/byte), so the key needs about 12.8 GNOT. The deposit stays
# locked while the package exists; it is not a fee.
set -euo pipefail

: "${KEY:?set KEY to the name of your gnokey key}"
: "${ADDR:?set ADDR to your g1 address}"
REMOTE=${REMOTE:-https://rpc.onyx.testnets.gno.land:443}
CHAINID=${CHAINID:-onyx-1}
NAME=${NAME:-taletree/v0}
GAS_WANTED=${GAS_WANTED:-140000000}
GAS_FEE=${GAS_FEE:-140000ugnot}
MAX_DEPOSIT=${MAX_DEPOSIT:-14000000ugnot}
GNOKEY_HOME=${GNOKEY_HOME:-$HOME/.config/gno}

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG="gno.land/r/$ADDR/$NAME"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Package sources only: the filetests import the dev path and stay local.
mkdir -p "$TMP/realm"
cp "$ROOT"/realm/*.gno "$ROOT/realm/gnomod.toml" "$TMP/realm/"
sed -i "s|^module = .*|module = \"$PKG\"|" "$TMP/realm/gnomod.toml"
touch "$TMP/gnowork.toml"

echo "package path: $PKG"
echo "network:      $CHAINID ($REMOTE)"
if [ "${SKIP_TESTS:-0}" != 1 ]; then
  (cd "$TMP/realm" && gno test .)
fi

# Local test runs only (gnodev keys): read the key password from stdin.
pwflag=()
[ "${INSECURE_PASSWORD_STDIN:-0}" = 1 ] && pwflag=(-insecure-password-stdin)

gnokey maketx addpkg "${pwflag[@]}" \
  -pkgpath "$PKG" -pkgdir "$TMP/realm" \
  -gas-fee "$GAS_FEE" -gas-wanted "$GAS_WANTED" -max-deposit "$MAX_DEPOSIT" \
  -broadcast -chainid "$CHAINID" -remote "$REMOTE" \
  -home "$GNOKEY_HOME" "$KEY"

echo
echo "Deployed. Check it with:"
echo "  gnokey query vm/qrender -data \"$PKG:\" -remote $REMOTE"
