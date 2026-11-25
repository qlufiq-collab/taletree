// Taletree web app settings. This is the only file to edit when the
// realm moves to another network.
//
// Local gnodev (default; start it with
//   gnodev local -node-rpc-listener 127.0.0.1:26667 -web-listener 127.0.0.1:8898 .):
//   rpc: "http://127.0.0.1:26667", chainId: "dev"
// Onyx testnet (after deploy):
//   rpc: "https://rpc.onyx.testnets.gno.land", chainId: "onyx-1",
//   gnoweb: "https://onyx.testnets.gno.land"
//
// The RPC origin must also be allowed by `connect-src` in index.html.
// The default policy already allows http://127.0.0.1:*, http://localhost:*
// and https://*.gno.land.
export default Object.freeze({
  // Tendermint JSON-RPC endpoint of a gno.land node (CORS must allow this site).
  rpc: "http://127.0.0.1:26667",
  // Chain id the wallet must be on to write.
  chainId: "dev",
  // Human name shown in the header and sent to Adena with AddNetwork.
  chainName: "Local gnodev",
  // Full package path of the realm.
  realmPath: "gno.land/r/g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5/taletree/v0",
  // gnoweb base URL, for "open in gnoweb" links (no trailing slash).
  gnoweb: "http://127.0.0.1:8898",
  // gnokey flags used in the copy-ready commands.
  gnokeyRemote: "127.0.0.1:26667",
  gasFee: "100000ugnot",
  gasWanted: "50000000",
  // Tip presets, in GNOT.
  tipPresets: [0.5, 1, 2, 5],
});
