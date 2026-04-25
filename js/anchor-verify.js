/* =====================================================================
   TeaTrade Trace · anchor verifier (DORMANT helper)
   ---------------------------------------------------------------------
  Pure helper, no DOM, no auto-init. Loaded only when id.html
   (or any other page) opts in. Given a lot id, it:

     1. Fetches the latest anchor record from public.trace_anchors via
        the existing TTSupabase client (anon-readable).
     2. Re-fetches the tx receipt + the indexed `Anchored` event from a
        public Polygon RPC.
     3. Compares the on-chain hash to the off-chain head hash.

   Returns one of:
     { status: 'unanchored' }
     { status: 'verified',  txHash, block, chainId, anchorKind }
     { status: 'mismatch',  expected, actual }
     { status: 'error',     message }

   Does NOT touch the UI. The caller decides how to render.
   ===================================================================== */
(function (global) {
  'use strict';

  // Topic hash of: Anchored(bytes32,uint8,string,address)
  // = keccak256("Anchored(bytes32,uint8,string,address)")
  // Pre-computed so we don't ship a keccak implementation here.
  var ANCHORED_TOPIC = '0x' +
    'd38e3c4ca41d49b0c4d8a9e99b96c1cf8c9e0b7f2a3e4c5d6f70819a2b3c4d5e';
  // NOTE: replace with real topic after first contract deploy:
  //   ethers.id("Anchored(bytes32,uint8,string,address)")

  function rpcUrlFor(chainId) {
    if (chainId === 137)   return 'https://polygon-rpc.com';
    if (chainId === 80002) return 'https://rpc-amoy.polygon.technology';
    return null;
  }

  async function rpc(url, method, params) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params })
    });
    var json = await res.json();
    if (json.error) throw new Error(method + ': ' + json.error.message);
    return json.result;
  }

  async function fetchAnchorRow(lotId) {
    if (!global.TTSupabase || !global.TTSupabase.client) return null;
    var sb = global.TTSupabase.client;
    var res = await sb
      .from('trace_anchors')
      .select('payload_hash, tx_hash, block_number, chain_id, contract_addr, anchor_kind')
      .eq('lot_id', lotId)
      .order('anchored_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data || null;
  }

  /**
   * Verify that `lotId`'s head hash is anchored on-chain.
   * @param {string} lotId
   * @returns {Promise<object>}
   */
  async function verifyLot(lotId) {
    try {
      var anchor = await fetchAnchorRow(lotId);
      if (!anchor) return { status: 'unanchored' };

      var rpcUrl = rpcUrlFor(anchor.chain_id);
      if (!rpcUrl) {
        return { status: 'error', message: 'unsupported chain ' + anchor.chain_id };
      }

      var receipt = await rpc(rpcUrl, 'eth_getTransactionReceipt', [anchor.tx_hash]);
      if (!receipt) return { status: 'error', message: 'tx not found on chain' };
      if (receipt.status !== '0x1') return { status: 'error', message: 'tx reverted' };

      // Find the Anchored log emitted by our contract.
      var contractLower = (anchor.contract_addr || '').toLowerCase();
      var match = (receipt.logs || []).find(function (log) {
        return (log.address || '').toLowerCase() === contractLower;
      });
      if (!match) return { status: 'error', message: 'no anchor event in tx' };

      // topics[1] = indexed bytes32 hash
      var onChainHash = (match.topics && match.topics[1]) || '';
      var expected = (anchor.payload_hash || '').toLowerCase();
      // pad expected to 32 bytes if needed
      while (expected.length < 66) expected = '0x' + '0' + expected.slice(2);

      if (onChainHash.toLowerCase() !== expected.toLowerCase()) {
        return { status: 'mismatch', expected: expected, actual: onChainHash };
      }

      return {
        status: 'verified',
        txHash: anchor.tx_hash,
        block: anchor.block_number,
        chainId: anchor.chain_id,
        anchorKind: anchor.anchor_kind
      };
    } catch (err) {
      return { status: 'error', message: err && err.message || String(err) };
    }
  }

  global.TTAnchor = {
    verifyLot: verifyLot,
    _rpcUrlFor: rpcUrlFor,
    _ANCHORED_TOPIC: ANCHORED_TOPIC
  };
})(window);
