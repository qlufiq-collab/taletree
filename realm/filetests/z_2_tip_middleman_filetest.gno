// PKGPATH: gno.land/r/demo/middleman

// A realm that sits between the signer and Tip could have kept the
// coins of the transaction: Tip must refuse it.
package middleman

import (
	"chain"
	"testing"

	"gno.land/p/nt/testutils/v0"
	taletree "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0"
)

func main(cur realm) {
	testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("alice")))
	taletree.StartTale(cross(cur), "A tale worth tipping",
		"The bard tunes a lute and waits for the crowd to fill the room.")

	// The middleman realm calls Tip itself, with coins attached to the tx.
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/demo/middleman"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	taletree.Tip(cross(cur), 1)
}

// Error:
// taletree: tips must be sent directly by an account (gnokey maketx call)
