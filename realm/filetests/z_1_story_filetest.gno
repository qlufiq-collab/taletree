// PKGPATH: gno.land/r/demo/main

// A whole story from two writers and one reader: start, branch, end,
// cheer and tip, then the canon page as gnoweb would render it.
package main

import (
	"chain"
	"testing"

	"gno.land/p/nt/testutils/v0"
	taletree "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
)

func main(cur realm) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")

	testing.SetRealm(testing.NewUserRealm(alice))
	tale := taletree.StartTale(cross(cur), "The Lantern Cellar",
		"Rain hammers the shutters. The innkeeper slides you a brass key: the cellar has been knocking all night.")

	testing.SetRealm(testing.NewUserRealm(bob))
	down := taletree.Branch(cross(cur), 1, "Take the lantern and go down",
		"The stairs are slick. At the bottom, a barrel rocks on its own, and something inside it hums a drinking song.")
	taletree.WriteEnding(cross(cur), 1, "Give the key back",
		"You hand the key back and order another ale. Some doors are better left shut. The knocking stops at dawn.")

	testing.SetRealm(testing.NewUserRealm(carol))
	taletree.Cheer(cross(cur), down)
	tip := chain.Coins{{Denom: "ugnot", Amount: 2_000_000}}
	testing.IssueCoins(chain.PackageAddress("gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"), tip)
	testing.SetOriginSend(tip)
	taletree.Tip(cross(cur), down)

	println(tale, taletree.CanonPath(tale))
	println(taletree.Render("tale/1/canon"))
}

// Output:
// 1 slice[(1 int),(2 int)]
// [Taletree](/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0) › [The Lantern Cellar](/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0:tale/1)
//
// # The Lantern Cellar: the canon
//
// *The path readers cheered most, one passage after another.*
//
//
//
// Rain hammers the shutters. The innkeeper slides you a brass key: the cellar has been knocking all night.
//
// *[g1v9kxjc…40gh](/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0:bard/g1v9kxjcm9ta047h6lta047h6lta047h6lzd40gh) · 🍻 0*
//
// ### → [Take the lantern and go down](/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0:p/2)
//
//
// The stairs are slick. At the bottom, a barrel rocks on its own, and something inside it hums a drinking song.
//
// *[g1vfhkyh…vdhu](/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0:bard/g1vfhkyh6lta047h6lta047h6lta047h6l03vdhu) · 🍻 1*
//
// ---
//
// *The canon continues when someone writes what happens next.*
//
// <gno-button href="/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0$help&func=Branch&parentID=2" label="✍️ Write what happens next" />

// Events:
// [
//   {
//     "type": "TaleStarted",
//     "attrs": [
//       {
//         "key": "tale",
//         "value": "1"
//       },
//       {
//         "key": "passage",
//         "value": "1"
//       },
//       {
//         "key": "narrator",
//         "value": "g1v9kxjcm9ta047h6lta047h6lta047h6lzd40gh"
//       }
//     ],
//     "pkg_path": "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
//   },
//   {
//     "type": "PassageWritten",
//     "attrs": [
//       {
//         "key": "tale",
//         "value": "1"
//       },
//       {
//         "key": "passage",
//         "value": "2"
//       },
//       {
//         "key": "parent",
//         "value": "1"
//       },
//       {
//         "key": "author",
//         "value": "g1vfhkyh6lta047h6lta047h6lta047h6l03vdhu"
//       },
//       {
//         "key": "ending",
//         "value": "false"
//       }
//     ],
//     "pkg_path": "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
//   },
//   {
//     "type": "PassageWritten",
//     "attrs": [
//       {
//         "key": "tale",
//         "value": "1"
//       },
//       {
//         "key": "passage",
//         "value": "3"
//       },
//       {
//         "key": "parent",
//         "value": "1"
//       },
//       {
//         "key": "author",
//         "value": "g1vfhkyh6lta047h6lta047h6lta047h6l03vdhu"
//       },
//       {
//         "key": "ending",
//         "value": "true"
//       }
//     ],
//     "pkg_path": "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
//   },
//   {
//     "type": "Cheered",
//     "attrs": [
//       {
//         "key": "passage",
//         "value": "2"
//       },
//       {
//         "key": "by",
//         "value": "g1vdshymmvta047h6lta047h6lta047h6l2asz94"
//       },
//       {
//         "key": "cheers",
//         "value": "1"
//       }
//     ],
//     "pkg_path": "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
//   },
//   {
//     "type": "Tipped",
//     "attrs": [
//       {
//         "key": "passage",
//         "value": "2"
//       },
//       {
//         "key": "from",
//         "value": "g1vdshymmvta047h6lta047h6lta047h6l2asz94"
//       },
//       {
//         "key": "to",
//         "value": "g1vfhkyh6lta047h6lta047h6lta047h6l03vdhu"
//       },
//       {
//         "key": "ugnot",
//         "value": "2000000"
//       }
//     ],
//     "pkg_path": "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
//   }
// ]
