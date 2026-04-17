# GoldRush Portfolio Analyst

AI-powered on-chain wallet intelligence. Paste a wallet address → get an instant portfolio breakdown, risk score, and actionable insights generated from GoldRush's decoded blockchain data + GPT-4o-mini reasoning.

Built for the **Build with GoldRush Track** hackathon (Powered by Covalent).

## What it does

- Fetches full wallet state across Solana, Ethereum, Base, Polygon, BNB Chain via GoldRush APIs
- Pulls token balances, USD pricing, and transaction history in one pass
- Feeds the snapshot to an LLM that generates:
  - Plain-English summary
  - 0–100 risk score
  - Concentration analysis
  - Specific insights, risks, and suggestions
- Renders it all in a clean dashboard UI

## Why it's different

Raw RPC providers give you hex. GoldRush gives you **classified, decoded, USD-priced data** — exactly what an LLM needs to reason about. This project is the proof: combine GoldRush's rich data layer with LLM reasoning to ship insights no raw-chain tool can match.

## GoldRush endpoints used

- `BalanceService.getTokenBalancesForWalletAddress` — token holdings + USD values
- `TransactionService.getAllTransactionsForAddressByPage` — wallet activity history

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4
- `@covalenthq/client-sdk` for GoldRush
- `openai` SDK with `gpt-4o-mini`

## Setup

1. Install deps:
   ```bash
   npm install
   ```

2. Add your keys to `.env.local`:
   ```
   GOLDRUSH_API_KEY=your_goldrush_key
   OPENAI_API_KEY=your_openai_key
   ```

3. Run:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000, paste a wallet address, pick a chain, hit Analyze.

## Project structure

- `app/page.tsx` — wallet input and results UI
- `app/api/analyze/route.ts` — orchestration endpoint
- `lib/goldrush.ts` — GoldRush data fetching + normalization
- `lib/analyze.ts` — LLM analysis prompt

## Demo

Record a 60–90s video showing:
1. Pasting a whale wallet
2. Live fetch + analysis
3. Walking through the AI-generated risk score and insights
4. Posting on X with `@goldrushdev` tag
