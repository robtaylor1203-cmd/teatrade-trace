# TeaTrade Trace · Public on-chain anchoring (scaffold)

> **Status: dormant.** Everything in this scaffold is committed but
> inactive. The live app's behaviour is unchanged until the contract
> is deployed and the Edge Function's secrets are set. Safe to read,
> review and apply the SQL migration without touching production
> behaviour.

## Why anchor at all?

The TTLedger inside Supabase is already cryptographically chained —
each event's hash includes the previous one, so you cannot edit a row
without invalidating every later hash. **But you and your customer
would still have to trust that TeaTrade hadn't quietly rewritten the
whole chain.** Public on-chain anchoring removes that trust requirement:
once a hash is published to Polygon, anyone in the world can verify it
independently, forever.

## What we built

| File | Purpose |
| --- | --- |
| [`supabase/anchor_migration.sql`](supabase/anchor_migration.sql) | Adds `trace_anchors` (public, audit-readable) + `trace_anchor_queue` (service-role only) + helper RPCs. Does **not** alter any existing table. |
| [`contracts/AnchorRegistry.sol`](contracts/AnchorRegistry.sol) | Minimal Solidity contract — emits an `Anchored` event per call. ~55k gas. No storage. |
| [`contracts/README.md`](contracts/README.md) | Hardhat deploy steps for Amoy testnet → Polygon mainnet. |
| [`supabase/functions/anchor-lot/index.ts`](supabase/functions/anchor-lot/index.ts) | Edge Function that drains the queue and submits txs. Returns `{ skipped: 'not configured' }` until env vars are set. |
| [`supabase/functions/anchor-lot/README.md`](supabase/functions/anchor-lot/README.md) | Deploy + cron schedule + dry-run instructions. |
| [`js/anchor-verify.js`](js/anchor-verify.js) | Browser helper (`window.TTAnchor.verifyLot(lotId)`). Pure logic, no DOM. Currently not loaded by any page. |

## Anchoring strategy

Two complementary modes:

1. **`head` anchor on `minted`** — instant cryptographic finality at
   issuance for each lot. ~$0.001 per lot.
2. **`daily-root` anchor** — a single tx per UTC day publishing a
   Merkle root over every event since the last root. Every event gets
   covered for the cost of ~one tx/day (~$0.30/year).

Either or both can be enabled. Recommended: turn on daily-root first
(rolling guarantee for everything), then add per-lot head anchors when
you want each minting moment timestamped on its own tx.

## Cost reality check

- Polygon PoS, ~30 gwei × ~55k gas × ~$0.50 MATIC = **~$0.001 / anchor**
- Head-only for 1,000 lots/year ≈ **$1–10/year**
- Every-event for 1,000 lots/year ≈ **$12–120/year**
- Daily-root only ≈ **a few dollars/year regardless of lot count**

The funded anchor wallet starts with ~5 MATIC (~$3); top-ups are rare.

## To go live (in order)

1. **Apply the SQL** — run [`supabase/anchor_migration.sql`](supabase/anchor_migration.sql)
   in Supabase SQL editor. Idempotent. Adds tables and RPCs, no
   front-end impact.
2. **Deploy the contract** — Amoy testnet first, then Polygon mainnet.
   See [`contracts/README.md`](contracts/README.md). Capture the deployed
   address.
3. **Set the four secrets** on the Supabase project:
   `ANCHOR_RPC_URL`, `ANCHOR_CHAIN_ID`, `ANCHOR_CONTRACT`, `ANCHOR_PRIVATE_KEY`.
4. **Deploy the Edge Function** — `supabase functions deploy anchor-lot`.
   Test with `{"dryRun":true}` first.
5. **Schedule the cron jobs** — see the function README. The drain
   runs every 5 minutes; the daily-root job runs at 00:05 UTC.
6. **Wire the wizard** — add `await sb.rpc('trace_enqueue_head_anchor', { p_lot_id })`
   immediately after the existing mint event in `lot-wizard.js`. (One
   line, deferred until you're ready.)
7. **Wire the passport** — add `<script src="./js/anchor-verify.js"></script>`
   to id.html and call `TTAnchor.verifyLot(lotId)` to render a
   "Verified on Polygon" badge. (Also one line, deferred.)

## Replacing the placeholder topic hash

[`js/anchor-verify.js`](js/anchor-verify.js) contains a placeholder for
the `Anchored` event topic hash. After deploying the contract, replace
it with the real keccak256:

```js
ethers.id("Anchored(bytes32,uint8,string,address)")
```

(If you'd rather, I can compute it locally and commit the real value
once the contract signature is final.)

## What we deliberately did NOT do

- Did not touch any front-end page or existing JS.
- Did not modify the wizard or passport (one-liner each, deferred).
- Did not enable any policy that requires the anchor feature.
- Did not bundle a Solidity toolchain — kept it framework-agnostic.

You can sit on this scaffold indefinitely. When ready, the path from
"committed code" to "live anchors" is roughly an hour of careful work.
