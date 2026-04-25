# anchor-lot · Supabase Edge Function

Drains `trace_anchor_queue` and writes hashes to AnchorRegistry on
Polygon. Designed to be invoked on a schedule (every ~5 minutes) or
manually for a dry run.

## Pre-flight

1. Apply the database migration: [`supabase/anchor_migration.sql`](../../anchor_migration.sql).
2. Deploy the [`AnchorRegistry`](../../../contracts/AnchorRegistry.sol) contract
   — see [`contracts/README.md`](../../../contracts/README.md).
3. Fund the anchor wallet with ~5 MATIC (~$3) on Polygon mainnet, or
   testnet MATIC on Amoy.

## Required secrets

In Supabase Studio → Project Settings → Edge Functions → Secrets:

| Key | Notes |
| --- | --- |
| `ANCHOR_RPC_URL` | `https://polygon-rpc.com` (free) or a private RPC for reliability |
| `ANCHOR_CHAIN_ID` | `137` (Polygon PoS) or `80002` (Amoy testnet) |
| `ANCHOR_CONTRACT` | The deployed contract address (`0x…`) |
| `ANCHOR_PRIVATE_KEY` | Funded anchor wallet's private key (`0x…`) — keep separate from the deployer key |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided.

## Deploy

```bash
supabase functions deploy anchor-lot
```

## Test (dry run — does not send a tx)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/anchor-lot" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"dryRun":true}'
```

Returns the queue row that *would* have been anchored.

## Schedule

Use Supabase's pg_cron or external scheduler to invoke every 5 min:

```sql
select cron.schedule(
  'anchor-lot-drain',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://<project>.functions.supabase.co/anchor-lot',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
       )
     ) $$
);
```

(The function is idempotent — concurrent invocations are safe; only one
will claim a given queue row.)

## Daily Merkle root

Schedule the SQL helper once a day:

```sql
select cron.schedule(
  'anchor-daily-root',
  '5 0 * * *',                  -- 00:05 UTC
  $$ select public.trace_enqueue_daily_root() $$
);
```

The Edge Function then picks it up on its next 5-minute drain.

## Verification (consumer side)

[`js/anchor-verify.js`](../../../js/anchor-verify.js) is a small browser
helper that, given a `lot_id`, fetches the anchor record from
`trace_anchors` and re-derives the on-chain hash via a public RPC. Wire
it into `passport.html` whenever you're ready — until then it's
inert.

## Status / behaviour

- **No env vars set** → function returns `{ skipped: 'not configured' }`. App unaffected.
- **Env vars set but contract not deployed** → first tx will revert; row marked `failed`, manual retry possible.
- **Healthy** → ~$0.001/anchor on Polygon PoS. Daily-root strategy keeps total cost to a few dollars/year per importer.
