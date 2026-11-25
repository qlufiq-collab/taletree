// Taletree web app settings. This is the only file to edit when the
// realm moves to another network.
//
// Default: the live Onyx testnet deployment (chain id onyx-1).
// For a local gnodev chain (start it with
//   gnodev local -node-rpc-listener 127.0.0.1:26667 -web-listener 127.0.0.1:8898 .)
// copy config.local.js over this file.
//
// The RPC origin must also be allowed by `connect-src` in index.html.
// The default policy already allows http://127.0.0.1:*, http://localhost:*
// and https://*.gno.land.
export default Object.freeze({
  // Tendermint JSON-RPC endpoint of a gno.land node (CORS must allow this site).
  rpc: "https://rpc.onyx.testnets.gno.land",
  // Chain id the wallet must be on to write.
  chainId: "onyx-1",
  // Human name shown in the header and sent to Adena with AddNetwork.
  chainName: "Gno.land Onyx",
  // Full package path of the realm.
  realmPath: "gno.land/r/g1k2u0zja7uyfwxfhsau8upj34tynmxkrzvwz35a/taletree/v0",
  // gnoweb base URL, for "open in gnoweb" links (no trailing slash).
  gnoweb: "https://onyx.testnets.gno.land",
  // gnokey flags used in the copy-ready commands.
  gnokeyRemote: "https://rpc.onyx.testnets.gno.land:443",
  gasFee: "100000ugnot",
  gasWanted: "50000000",
  // Tip presets, in GNOT.
  tipPresets: [0.5, 1, 2, 5],
});
