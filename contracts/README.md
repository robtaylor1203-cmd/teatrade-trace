# TeaTrade Trace · AnchorRegistry contract

Minimal Solidity registry that lets the TeaTrade Trace Edge Function
publish hashes to a public chain. The contract stores **nothing** — it
only emits `Anchored(hash, kind, reference, anchorer)` events. The
permanent event log on the chain is the proof.

## Why so minimal?

- Gas per anchor: ~55k (no SSTORE, just an event)
- Polygon PoS gas at ~30 gwei × ~$0.50 MATIC ≈ **$0.001 per anchor**
- Anyone can verify by querying the chain's event index for that hash

## Compile & deploy

You can use any Solidity toolchain. The simplest path with a fresh
Hardhat install:

```bash
npm init -y
npm i -D hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat init        # choose "Create a TypeScript project"
# copy contracts/AnchorRegistry.sol into the new contracts/ folder
```

`hardhat.config.ts` (excerpt):

```ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    amoy: {                       // Polygon testnet — free MATIC from faucet
      url: process.env.AMOY_RPC_URL!,
      accounts: [process.env.DEPLOY_PRIVATE_KEY!],
      chainId: 80002,
    },
    polygon: {                    // Polygon PoS mainnet
      url: process.env.POLYGON_RPC_URL!,
      accounts: [process.env.DEPLOY_PRIVATE_KEY!],
      chainId: 137,
    },
  },
};
export default config;
```

Deploy:

```bash
npx hardhat run scripts/deploy.ts --network amoy     # testnet first
npx hardhat run scripts/deploy.ts --network polygon  # then mainnet
```

`scripts/deploy.ts`:

```ts
import { ethers } from "hardhat";
async function main() {
  const Registry = await ethers.getContractFactory("AnchorRegistry");
  const reg = await Registry.deploy();
  await reg.waitForDeployment();
  console.log("AnchorRegistry deployed to:", await reg.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
```

## What to keep secret

- `DEPLOY_PRIVATE_KEY` — the wallet that deploys the contract
- `ANCHOR_PRIVATE_KEY` — the wallet the Edge Function uses for live
  anchors. Should be a **separate** funded wallet, not the deployer.

A small (~5 MATIC, ~$3) balance lasts thousands of anchors.

## After deployment

Set these in Supabase project secrets:

| Key | Value |
| --- | --- |
| `ANCHOR_RPC_URL` | `https://polygon-rpc.com` (or a private RPC) |
| `ANCHOR_CHAIN_ID` | `137` |
| `ANCHOR_CONTRACT` | The deployed contract address |
| `ANCHOR_PRIVATE_KEY` | The funded anchor wallet's private key |

Then deploy the function (see [`supabase/functions/anchor-lot/README.md`](../supabase/functions/anchor-lot/README.md)).
