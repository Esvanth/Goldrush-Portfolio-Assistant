# GoldRush Portfolio Analyst

Paste any wallet address from Solana, Ethereum, Base, Polygon, or BNB Chain — the analyst returns a written brief, a computed risk score, an activity-mix breakdown, and (on EVM chains) a flagged approvals table.

Built for the Build with GoldRush track of the Colosseum Hackathon.

> **Live:** _add your Vercel URL here after first successful deploy_

## What the risk score actually measures

This is the part judges should see. The score is **deterministic, computed from GoldRush signals** — it is not the LLM guessing. The LLM writes the narrative; the number comes from code.

| Signal | Source | Max points |
|---|---|---|
| **Concentration** — top holding share | `BalanceService` | 25 |
| **Approval hygiene** — unlimited approvals, $ exposure | `SecurityService.getApprovals` | 30 |
| **Volatility cushion** — stablecoin share of portfolio | `BalanceService` | 10 |
| **Activity signature** — approval-heavy or swap-heavy tx mix | `TransactionService` log_events | 10 |

Score is capped at 100, bucketed into `low` / `moderate` / `elevated`, and shown with a per-component breakdown so you can see *why* a wallet scored where it did.

## How GoldRush is used

Three endpoints, working together:

1. **`BalanceService.getTokenBalancesForWalletAddress`** — holdings with USD pricing, `noSpam: true` to filter airdrop tokens.
2. **`TransactionService.getAllTransactionsForAddressByPage`** (with logs) — recent transactions. Each tx is classified by walking its `log_events`:
   - `Swap` / `SwapV3` → DEX activity
   - Stablecoin `Transfer` → USDC/USDT/DAI flow
   - `Approval` without a `Transfer` → approval operation
   - Bridge contracts (name-matched) → cross-chain
   - Otherwise → transfer / other
3. **`SecurityService.getApprovals`** (EVM only) — outstanding ERC-20 approvals, with `value_at_risk_quote` and `risk_factor` from GoldRush plus an `isUnlimited` flag we derive against `MAX_UINT256`.

The classified signals feed both the UI (activity bar, approvals table) and the LLM prompt so the written brief cites real numbers (*"48% of recent activity is swaps"*, *"3 unlimited approvals exposing $12,400"*) instead of producing generic vibes.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- `@covalenthq/client-sdk` for GoldRush
- `openai` SDK (`gpt-4o-mini`) — narrative only; never produces the risk number
- Deployed on Vercel

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the two keys
npm run dev
```

Open http://localhost:3000.

Required env:

```
GOLDRUSH_API_KEY=...
OPENAI_API_KEY=...
```

## Project layout

```
app/
  page.tsx                 editorial UI
  api/analyze/route.ts     orchestration (force-dynamic)
lib/
  goldrush.ts              GoldRush fetching, tx classifier, approval parsing
  risk.ts                  deterministic risk scoring
  analyze.ts               LLM narrative (fed the classified signals)
```

## Submission

- Public repo: https://github.com/Esvanth/Goldrush-Portfolio-Assistant
- GoldRush endpoints used: three (Balance, Transaction, Security)
- Track: Wallet & Portfolio apps — specifically hitting the bullet *"Score wallet risk from SPL token balances, approval hygiene, and full transaction history."*
