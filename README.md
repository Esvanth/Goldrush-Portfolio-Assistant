# GoldRush Portfolio Analyst

Paste any wallet address from Solana, Ethereum, Base, Polygon, or BNB Chain — the analyst returns a written brief, a computed risk score, an activity-mix breakdown, and (on EVM chains) a flagged approvals table. Or switch to **Compare** mode and score two wallets side by side with a component-level risk delta.

Built for the Build with GoldRush track of the Colosseum Hackathon.

> **Live:** https://goldrush-portfolio-analyst.vercel.app

## What the risk score actually measures

This is the part judges should see. The score is **deterministic, computed from GoldRush signals** — it is not the LLM guessing. The LLM writes the narrative; the number comes from code.

| Signal | Source | Max points |
|---|---|---|
| **Concentration** — top holding share (waived if top asset is a stablecoin) | `BalanceService` | 30 |
| **Approval hygiene** — unlimited-approval count **and** $ exposure | `SecurityService.getApprovals` | 40 |
| **Volatility cushion** — stablecoin share of portfolio | `BalanceService` | 15 |
| **Activity signature** — approval-heavy or swap-heavy tx mix | `TransactionService` log_events | 15 |

Max score is 100, bucketed into `low` (< 25) / `moderate` (25–49) / `elevated` (≥ 50), and shown with a per-component breakdown so you can see *why* a wallet scored where it did.

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

## Compare mode

Two wallets, one screen. `POST /api/compare` takes `{ addressA, addressB, chain }`, fetches both snapshots from GoldRush in parallel, runs the same deterministic risk scorer against each, and returns:

- Both full risk breakdowns (per-component points + notes)
- The gap (`delta = B - A`) and which wallet is riskier
- The driver component — the row with the largest `|delta|` — and a templated verdict that names it

```
Wallet B carries 64 points more risk than Wallet A, driven by approval hygiene —
5 unlimited approvals exposing $42,310.
```

The verdict is generated in code, not by the LLM, so the comparison is reproducible and doesn't depend on model latency. The UI renders a component-by-component delta table so you can see exactly which signal drove the gap.

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
  page.tsx                 editorial UI (analyze + compare modes)
  api/analyze/route.ts     single-wallet orchestration (force-dynamic)
  api/compare/route.ts     two-wallet orchestration (force-dynamic)
lib/
  goldrush.ts              GoldRush fetching, tx classifier, approval parsing
  risk.ts                  deterministic risk scoring (max 100)
  analyze.ts               LLM narrative (fed the classified signals)
  compare.ts               deterministic delta + verdict generator
```

## Submission

- Live app: https://goldrush-portfolio-analyst.vercel.app
- Public repo: https://github.com/Esvanth/Goldrush-Portfolio-Assistant
- GoldRush endpoints used: three (Balance, Transaction with logs, Security)
- Track: Wallet & Portfolio apps — specifically hitting the bullet *"Score wallet risk from SPL token balances, approval hygiene, and full transaction history."*
