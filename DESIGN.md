# Taletree — design notes

Taletree is a realm for **collaborative branching stories** ("choose your own
adventure") that you read and write straight from gnoweb. Anyone can start a
tale; anyone can add the next passage under any passage, as a new *choice*.
Readers cheer the passages they like, and the most-cheered choice at each step
forms the tale's **canon**, a single read-through picked by readers.

## 1. Idea selection (M0)

Survey done on 2026-11-24 against the live Onyx testnet (`vm/qpaths` listed
883 realm paths), `awesome-gno`, `moul/gno-contracts` (377 packages) and the
monorepo `examples/`.

Crowded categories on Onyx: bounty boards with escrow (`guildhall/bounties`,
`hearthbounty/v1`, several `escrow` realms), tavern-themed games
(`gnometavern`, `tavern2048`), arcade and dice games, NFT launchpads,
polls, guestbooks, tip jars.

| Idea | Real use | Complexity (fit for 3 weeks) | Originality on Onyx | Demo in gnoweb | Total /20 |
|---|---|---|---|---|---|
| A. Quest/bounty board with escrow + reputation | 4 | 4 | **1** (two near-identical realms live) | 4 | 13 |
| B. Proof-of-work attestation registry | 3 | 4 | 2 (`memba_quest_attestation`, `statements`) | 2 | 11 |
| C. **Taletree: collaborative branching stories** | 3 | 4 | **5** (no story/branching realm on Onyx) | **5** (every passage is a page, every choice a link) | **17** |

Picked **C**. Name check: no realm path, awesome-gno entry or moul package
contains `tale`, `story`, `fable` or `saga`. The name does not start with
"Gno" and does not imply an official Gno.land product.

## 2. Why it suits Gno

- gnoweb already is the reader: `Render(path)` returns Markdown, so each
  passage is a page at `:p/<id>` and each choice is a plain link. No front-end
  to host.
- The Actions tab and `txlink` turn "write what happens next", "cheer" and
  "tip" into one-click transactions with Adena, or copy-paste `gnokey`
  commands.
- The source of the realm is readable on-chain next to the story, so readers
  can check the rules (one cheer per address, tips go 100% to the author).

## 3. Data model

All state lives in `avl.Tree`s keyed by `seqid` binary keys (sortable,
compact):

| Tree | Key | Value |
|---|---|---|
| `tales` | tale id | `*Tale` (title, narrator, root passage id, counters, locked) |
| `passages` | passage id | `*Passage` (tale, parent, author, choice, body, depth, children, cheers, tips, ending, hidden) |
| `cheers` | passage id + address | `true`, one cheer per address per passage |
| `bards` | address | `*Bard` (passages, cheers received, tips received, tales started) |
| `bardPassages` | address + passage id | passage id, so a profile lists a bard's work without scanning |
| `fame` | inverted zero-padded cheers + address | address, a ranking index kept sorted on every cheer |

Bounds keep every call and every Render cheap: at most 8 choices per passage,
depth at most 64, title 3 to 80 bytes, choice text 3 to 80 bytes, body 20 to
1,500 bytes.

## 4. Public API

Crossing functions (state-changing, caller from `cur.Previous()`):

| Function | Who | What |
|---|---|---|
| `StartTale(cur, title, opening)` | anyone | new tale + root passage, returns tale id |
| `Branch(cur, parentID, choice, body)` | anyone | new passage under `parentID` |
| `WriteEnding(cur, parentID, choice, body)` | anyone | same, but the passage is an ending (no further choices) |
| `Cheer(cur, passageID)` | anyone but the author | +1 cheer, once per address |
| `Tip(cur, passageID)` + `-send Nugnot` | EOA only (`IsUserCall`) | forwards the whole amount to the author, nothing stays in the realm |
| `Hide(cur, passageID, reason)` / `Unhide` | tale narrator or realm keeper | moderation; hidden passages and their subtree stop rendering |
| `LockTale(cur, taleID)` / `UnlockTale` | tale narrator or keeper | stop/allow new branches |
| `TransferKeeper(cur, addr)` | keeper | `ownable` hand-over |

Read API (non-crossing, returns values not pointers): `TaleCount`,
`PassageCount`, `GetPassage(id)` (a `PassageView` copy), `CanonPath(taleID)`.
Other realms can use these to embed a tale.

Events (`chain.Emit`): `TaleStarted`, `PassageWritten`, `Cheered`, `Tipped`,
`PassageHidden`, `PassageUnhidden`, `TaleLocked`, `TaleUnlocked`.

## 5. Canon

From the root, repeatedly follow the visible child with the most cheers; a tie
goes to the earliest passage. It stops at an ending or a passage with no
visible child. The walk is bounded by the depth cap (64) and the branch cap
(8), so it costs at most 512 lookups.

## 6. Render routes (`p/nt/mux/v0`)

| Path | Page |
|---|---|
| `` | home: what Taletree is, totals, tales (newest first, paged), how to start |
| `tale/{id}` | tale overview: opening, canon link, outline of branches (first 3 levels) |
| `tale/{id}/canon` | the canon as one continuous read |
| `p/{id}` | reading page: breadcrumb, passage, choices with cheer counts, actions |
| `bard/{addr}` | bard profile: totals and latest passages |
| `bards` | hall of fame (by cheers received) |

User text is passed through `p/nt/markdown/sanitize/v0` (`Block` for bodies,
`InlineText` for titles and choices) so nobody can inject headings, gnoweb
tags or fake action links into the page.

## 7. Security notes

- Caller identity only from `cur.Previous().Address()`; no `chain/runtime/unsafe`
  caller lookups inside crossing functions.
- `Tip` pairs `cur.Previous().IsUserCall()` with the `OriginSend` amount check
  (effective-gno, "Verifying inbound Coin payments"), accepts only `ugnot`,
  and forwards exactly what was sent. The realm holds no balance between
  transactions, so there is nothing to drain.
- No exported function returns a pointer into realm state.
- No `realm` value is stored.

## 8. Toolchain (pinned)

- `gno`, `gnokey`, `gnodev` **v1.8.0** built from `github.com/gnolang/gno`
  tag `v1.8.0` (commit `fc79041f4cd1a7b3ed4b316dc5ac14162eb78730`), the same
  commit Onyx runs as `v1.8.0-rc.1` since height 1,203,400 (2026-11-17), per
  `misc/deployments/onyx.gno.land/UPGRADES.md` on branch `chain/mainnet`.
- Go 1.27.4 (Go 1.25+ required).
- Imports used are all live on Onyx (checked with `gnokey query vm/qfile`):
  `p/nt/avl/v0`, `p/nt/avl/pager/v0`, `p/nt/ufmt/v0`, `p/nt/mux/v0`,
  `p/nt/seqid/v0`, `p/nt/ownable/v0`, `p/nt/markdown/sanitize/v0`,
  `p/moul/txlink/v0`, `p/nt/uassert/v0`, `p/nt/urequire/v0`.
