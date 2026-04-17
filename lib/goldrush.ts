import { GoldRushClient } from "@covalenthq/client-sdk";

const apiKey = process.env.GOLDRUSH_API_KEY;

if (!apiKey) {
  console.warn("GOLDRUSH_API_KEY is not set");
}

export const goldrush = new GoldRushClient(apiKey ?? "");

export type WalletSnapshot = {
  address: string;
  chain: string;
  totalUsd: number;
  tokens: TokenHolding[];
  recentTxs: RecentTx[];
  txCount: number;
};

export type TokenHolding = {
  symbol: string;
  name: string;
  balance: string;
  balanceFormatted: number;
  usdValue: number;
  usdPrice: number;
  logoUrl?: string;
  contractAddress: string;
};

export type RecentTx = {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  valueUsd?: number;
  successful: boolean;
  type?: string;
};

export async function fetchWalletSnapshot(
  address: string,
  chain: string = "solana-mainnet"
): Promise<WalletSnapshot> {
  const [balancesRes, txsRes] = await Promise.all([
    goldrush.BalanceService.getTokenBalancesForWalletAddress(
      chain as never,
      address,
      { quoteCurrency: "USD", noSpam: true }
    ),
    goldrush.TransactionService.getAllTransactionsForAddressByPage(
      chain as never,
      address,
      { quoteCurrency: "USD", noLogs: true }
    ),
  ]);

  const balances = balancesRes?.data?.items ?? [];
  const tokens: TokenHolding[] = balances
    .filter((t: any) => Number(t?.quote ?? 0) > 0.01)
    .map((t: any) => {
      const decimals = Number(t?.contract_decimals ?? 0);
      const raw = t?.balance ? BigInt(t.balance) : 0n;
      const formatted =
        decimals > 0 ? Number(raw) / Math.pow(10, decimals) : Number(raw);
      return {
        symbol: t?.contract_ticker_symbol ?? "?",
        name: t?.contract_name ?? "Unknown",
        balance: String(raw),
        balanceFormatted: formatted,
        usdValue: Number(t?.quote ?? 0),
        usdPrice: Number(t?.quote_rate ?? 0),
        logoUrl: t?.logo_url,
        contractAddress: t?.contract_address ?? "",
      };
    })
    .sort((a: TokenHolding, b: TokenHolding) => b.usdValue - a.usdValue);

  const totalUsd = tokens.reduce((s, t) => s + t.usdValue, 0);

  const txItems = txsRes?.data?.items ?? [];
  const recentTxs: RecentTx[] = txItems.slice(0, 25).map((tx: any) => ({
    hash: tx?.tx_hash ?? "",
    timestamp: tx?.block_signed_at ?? "",
    from: tx?.from_address ?? "",
    to: tx?.to_address ?? "",
    valueUsd: Number(tx?.value_quote ?? 0),
    successful: !!tx?.successful,
  }));

  return {
    address,
    chain,
    totalUsd,
    tokens: tokens.slice(0, 25),
    recentTxs,
    txCount: txItems.length,
  };
}
