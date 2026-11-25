#!/usr/bin/env bash
# Seed a local gnodev chain with a small library of tales, through real
# signed transactions: three writers start tales, branch, write endings,
# cheer and tip each other.
#
# Usage (gnodev running, three keys in the keybase):
#   GNOKEY_HOME=~/.config/gno KEY_A=devtest KEY_B=bard2 KEY_C=bard3 \
#   REMOTE=127.0.0.1:26657 ./scripts/demo.sh
#
# On gnodev the keys are local test keys (gnodev pre-funds every key in
# the keybase). On a shared testnet with a single key, set SOLO=1 and
# KEY_A=KEY_B=KEY_C=<your key>: cheers and tips are skipped, since nobody
# can cheer or tip their own passages.
set -euo pipefail

PKG=${PKG:-gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0}
REMOTE=${REMOTE:-127.0.0.1:26657}
CHAINID=${CHAINID:-dev}
GNOKEY_HOME=${GNOKEY_HOME:-$HOME/.config/gno}
KEY_A=${KEY_A:-devtest}
KEY_B=${KEY_B:-bard2}
KEY_C=${KEY_C:-bard3}
PASSWORD=${PASSWORD:-}
PAUSE=${PAUSE:-0}

call() { # call <key> <func> [send] -- <args...>
  local key=$1 fn=$2 send=$3
  shift 4
  local args=()
  for a in "$@"; do args+=(-args "$a"); done
  local sendflag=()
  [ -n "$send" ] && sendflag=(-send "$send")
  echo "▶ $key → $fn $*" | cut -c1-110
  printf '%s\n' "$PASSWORD" | gnokey maketx call \
    -pkgpath "$PKG" -func "$fn" "${args[@]}" "${sendflag[@]}" \
    -gas-fee 50000ugnot -gas-wanted 50000000 \
    -broadcast -chainid "$CHAINID" -remote "$REMOTE" \
    -insecure-password-stdin -home "$GNOKEY_HOME" "$key" | grep -E '^\(|OK!|TX HASH' | tr '\n' ' '
  echo
  sleep "$PAUSE"
}

# Tale 1: The Lantern Cellar
call "$KEY_A" StartTale "" -- "The Lantern Cellar" \
  'Rain hammers the shutters of the Copper Kettle. The innkeeper slides a brass key across the bar and lowers her voice.\n\n"The cellar has been knocking all night," she says. "Three knocks, then a pause, then three more. Nobody who works here will go down."'
call "$KEY_B" Branch "" -- 1 "Take the lantern and go down" \
  'The stairs are slick with something that is not water. At the bottom, among the casks, one barrel rocks on its own, and something inside it is humming an old drinking song, slightly off key.'
call "$KEY_C" Branch "" -- 1 "Wake the innkeeper's cat first" \
  'The cat, a one-eyed tabby called Admiral, opens his good eye, looks at the cellar door, and very deliberately goes back to sleep. You decide this is either a good sign or a very bad one.'
call "$KEY_B" WriteEnding "" -- 1 "Give the key back" \
  'You hand the key back and order another ale. Some doors are better left shut. The knocking stops at dawn, and nobody ever mentions it again.'
call "$KEY_C" Branch "" -- 2 "Pry open the humming barrel" \
  'The lid comes off with a pop. Inside, curled in the dregs of last year'"'"'s cider, sits a gnome no taller than a tankard, wearing a thimble for a helmet. "Finally," he says. "Do you know how long I have been knocking?"'
call "$KEY_A" Branch "" -- 2 "Follow the wet footprints" \
  'Tiny wet footprints lead from the barrel to a crack in the wall. Through it you hear clinking glasses and laughter, as if a second tavern were hiding behind the first.'
call "$KEY_A" WriteEnding "" -- 5 "Offer him a job behind the bar" \
  'Within a week the gnome runs the cellar better than anyone ever has. The casks are always cool, the cider never sours, and three knocks on the floor now mean only one thing: another round.'

# Tale 2: The Seven Lamps of Mirewick
call "$KEY_B" StartTale "" -- "The Seven Lamps of Mirewick" \
  'Every night the lamplighter of Mirewick lights seven lamps along the marsh road. Tonight there are eight, and nobody remembers putting up the last one.'
call "$KEY_C" Branch "" -- 8 "Blow out the eighth lamp" \
  'The flame bends away from your breath, as if it would rather not go out. Somewhere in the marsh, something sighs.'

# Tale 3: The Gnome Who Sold Thunder
call "$KEY_C" StartTale "" -- "The Gnome Who Sold Thunder" \
  'At the spring fair a gnome sets up a stall with a single jar on it. The label says THUNDER, ONE BOTTLE, SLIGHTLY USED. The price is a story you have never told anyone.'

# Readers cheer and tip.
if [ "${SOLO:-0}" = 1 ]; then
  echo "done (SOLO: cheers and tips skipped)"
  exit 0
fi
call "$KEY_C" Cheer "" -- 2
call "$KEY_A" Cheer "" -- 5
call "$KEY_B" Cheer "" -- 5
call "$KEY_B" Cheer "" -- 7
call "$KEY_C" Cheer "" -- 6
call "$KEY_A" Tip 1000000ugnot -- 2
call "$KEY_A" Tip 2500000ugnot -- 5

echo "done: open the realm in gnoweb"
