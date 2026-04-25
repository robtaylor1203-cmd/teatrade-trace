// =====================================================================
// TeaTrade Trace · anchor-lot Edge Function
// ---------------------------------------------------------------------
// Drains public.trace_anchor_queue (oldest pending row), submits the
// hash to AnchorRegistry on Polygon, and writes the resulting tx_hash
// + block_number into public.trace_anchors.
//
// This function is INACTIVE without env vars. The function will simply
// return { skipped: 'not configured' } until you set:
//
//   ANCHOR_RPC_URL       https://polygon-rpc.com (or private RPC)
//   ANCHOR_CHAIN_ID      137
//   ANCHOR_CONTRACT      0x... (the deployed AnchorRegistry address)
//   ANCHOR_PRIVATE_KEY   0x... (the funded anchor wallet)
//   SUPABASE_URL         (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-provided)
//
// Recommended schedule: every 5 minutes via Supabase cron.
// Manual one-shot: POST { dryRun: true } to preview without sending.
// =====================================================================
//
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.2";

const ABI = [
  "function anchor(bytes32 hash, uint8 kind, string reference) external",
  "event Anchored(bytes32 indexed hash, uint8 indexed kind, string reference, address indexed anchorer)",
];

interface QueueRow {
  id: string;
  anchor_kind: "head" | "daily-root";
  payload_hash: string;
  lot_id: string | null;
  merkle_leaves: any;
  attempts: number;
}

function envOrNull(k: string): string | null {
  const v = Deno.env.get(k);
  return v && v.length > 0 ? v : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req) => {
  let dryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun = !!body?.dryRun;
    } catch { /* no body */ }
  }

  const RPC = envOrNull("ANCHOR_RPC_URL");
  const CONTRACT = envOrNull("ANCHOR_CONTRACT");
  const PK = envOrNull("ANCHOR_PRIVATE_KEY");
  const CHAIN_ID = parseInt(envOrNull("ANCHOR_CHAIN_ID") ?? "0", 10);
  const SB_URL = envOrNull("SUPABASE_URL");
  const SB_KEY = envOrNull("SUPABASE_SERVICE_ROLE_KEY");

  if (!RPC || !CONTRACT || !PK || !CHAIN_ID || !SB_URL || !SB_KEY) {
    return jsonResponse({ skipped: "not configured", needs: [
      !RPC && "ANCHOR_RPC_URL",
      !CONTRACT && "ANCHOR_CONTRACT",
      !PK && "ANCHOR_PRIVATE_KEY",
      !CHAIN_ID && "ANCHOR_CHAIN_ID",
      !SB_URL && "SUPABASE_URL",
      !SB_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean) }, 200);
  }

  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  // 1. Claim the oldest pending row (best-effort optimistic lock).
  const { data: claim, error: claimErr } = await sb
    .from("trace_anchor_queue")
    .update({ status: "processing", attempts: 0 /* set below */ })
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .select("*")
    .single();

  if (claimErr || !claim) {
    return jsonResponse({ ok: true, processed: 0 });
  }
  const row = claim as QueueRow;

  if (dryRun) {
    // Release the row and report what we *would* have done.
    await sb.from("trace_anchor_queue")
      .update({ status: "pending" })
      .eq("id", row.id);
    return jsonResponse({ ok: true, dryRun: true, would_anchor: row });
  }

  try {
    // 2. Build & send the tx.
    const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
    const wallet = new ethers.Wallet(PK, provider);
    const registry = new ethers.Contract(CONTRACT, ABI, wallet);

    const hashHex = row.payload_hash.startsWith("0x")
      ? row.payload_hash
      : "0x" + row.payload_hash;
    // Coerce to 32 bytes — db hash is sha256 hex, padded if shorter.
    const hash32 = ethers.zeroPadValue(hashHex, 32);
    const kind = row.anchor_kind === "head" ? 0 : 1;
    const reference = row.lot_id ?? new Date().toISOString().slice(0, 10);

    const tx = await registry.anchor(hash32, kind, reference);
    const receipt = await tx.wait();

    // 3. Record the anchor + link.
    const { data: anchorRow, error: insErr } = await sb
      .from("trace_anchors")
      .insert({
        anchor_kind: row.anchor_kind,
        payload_hash: hashHex,
        lot_id: row.lot_id,
        event_count: row.merkle_leaves
          ? Array.isArray(row.merkle_leaves) ? row.merkle_leaves.length : 1
          : 1,
        merkle_leaves: row.merkle_leaves,
        chain_id: CHAIN_ID,
        contract_addr: CONTRACT,
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
      })
      .select("*")
      .single();

    if (insErr) throw new Error("anchor insert failed: " + insErr.message);

    await sb.from("trace_anchor_queue")
      .update({ status: "done", anchor_id: anchorRow.id, last_error: null })
      .eq("id", row.id);

    // 4. Backfill anchor_id on the underlying event(s) so the UI can
    //    surface "Anchored on Polygon ✓" without an extra join.
    if (row.anchor_kind === "head" && row.lot_id) {
      await sb.from("trace_lot_events")
        .update({ anchor_id: anchorRow.id })
        .eq("lot_id", row.lot_id)
        .order("block_height", { ascending: false })
        .limit(1);
    } else if (row.anchor_kind === "daily-root" && Array.isArray(row.merkle_leaves)) {
      const ids = row.merkle_leaves.map((l: any) => l.event_id).filter(Boolean);
      if (ids.length) {
        await sb.from("trace_lot_events")
          .update({ anchor_id: anchorRow.id })
          .in("event_id", ids);
      }
    }

    return jsonResponse({
      ok: true,
      anchored: {
        kind: row.anchor_kind,
        tx_hash: receipt.hash,
        block: receipt.blockNumber,
        chain_id: CHAIN_ID,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("trace_anchor_queue")
      .update({
        status: "failed",
        attempts: row.attempts + 1,
        last_error: msg.slice(0, 500),
      })
      .eq("id", row.id);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
