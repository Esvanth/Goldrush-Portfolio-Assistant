import { GoldRushClient, type Transaction } from "@covalenthq/client-sdk";

let _client: GoldRushClient | null = null;

function goldrush(): GoldRushClient {
  if (_client) return _client;
  const apiKey = process.env.GOLDRUSH_API_KEY;
  if (!apiKey) throw new Error("GOLDRUSH_API_KEY is not set");
  _client = new GoldRushClient(apiKey);
  return _client;
}

export type WalletSnapshot = {
  address: string;
  chain: string;
  isEvm: boolean;
  totalUsd: number;
  tokens: TokenHolding[];
  recentTxs: RecentTx[];
  txCount: number;
  txMix: TxMix;
  approvals: ApprovalRisk[];
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
  category?: TxCategory;
};

export type TxCategory =
  | "swap"
  | "stablecoin"
  | "approval"
  | "bridge"
  | "transfer"
  | "other";

export type TxMix = Record<TxCategory, number> & { total: number };

export type ApprovalRisk = {
  token: string;
  tokenName: string;
  tokenAddress: string;
  spender: string;
  spenderLabel: string;
  allowance: string;
  valueAtRiskUsd: number;
  riskFactor: string;
  isUnlimited: boolean;
};

const STABLE_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "USDS",
  "BUSD",
  "PYUSD",
  "FDUSD",
  "TUSD",
  "USDD",
  "LUSD",
  "FRAX",
  "GUSD",
  "USDC.e",
  "USDbC",
]);

const BRIDGE_HINTS = [
  "bridge",
  "portal",
  "layerzero",
  "wormhole",
  "hop",
  "across",
  "synapse",
  "stargate",
  "circle cctp",
  "relay",
];

function classifyTx(tx: Transaction): TxCategory {
  const logs = tx?.log_events ?? [];
  let hasSwap = false;
  let hasApproval = false;
  let hasStableTransfer = false;
  let hasTransfer = false;
  let hasBridge = false;

  for (const l of logs) {
    const name = l?.decoded?.name ?? "";
    const sym = l?.sender_contract_ticker_symbol ?? "";
    const senderName = (l?.sender_name ?? "").toLowerCase();
    const senderLabel = (l?.sender_address_label ?? "").toLowerCase();

    if (name === "Swap" || name === "SwapV3" || name === "TokenSwap") hasSwap = true;
    else if (name === "Approval" || name === "ApprovalForAll") hasApproval = true;
    else if (name === "Transfer") {
      hasTransfer = true;
      if (STABLE_SYMBOLS.has(sym)) hasStableTransfer = true;
    }
    if (BRIDGE_HINTS.some((h) => senderName.includes(h) || senderLabel.includes(h)))
      hasBridge = true;
  }

  if (hasSwap) return "swap";
  if (hasBridge) return "bridge";
  if (hasStableTransfer) return "stablecoin";
  if (hasApproval && !hasTransfer) return "approval";
  if (hasTransfer) return "transfer";
  if (Number(tx?.value ?? 0) > 0) return "transfer";
  return "other";
}

function emptyMix(): TxMix {
  return {
    swap: 0,
    stablecoin: 0,
    approval: 0,
    bridge: 0,
    transfer: 0,
    other: 0,
    total: 0,
  };
}

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);
const UNLIMITED_THRESHOLD = (MAX_UINT256 / 100n) * 99n;

function isUnlimitedAllowance(allowance: string): boolean {
  if (!allowance) return false;
  try {
    return BigInt(allowance) >= UNLIMITED_THRESHOLD;
  } catch {
    return false;
  }
}

export async function fetchWalletSnapshot(
  address: string,
  chain: string = "solana-mainnet"
): Promise<WalletSnapshot> {
  const client = goldrush();
  const isEvm = !chain.startsWith("solana");

  const [balancesRes, txsRes, approvalsRes] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(
      chain as never,
      address,
      { quoteCurrency: "USD", noSpam: true }
    ),
    client.TransactionService.getAllTransactionsForAddressByPage(
      chain as never,
      address,
      { quoteCurrency: "USD", noLogs: !isEvm }
    ),
    isEvm
      ? client.SecurityService.getApprovals(chain as never, address).catch(
          () => null
        )
      : Promise.resolve(null),
  ]);

  // Tokens
  const balances = (balancesRes?.data?.items ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const tokens: TokenHolding[] = balances
    .filter((t) => Number((t?.quote as number) ?? 0) > 0.01)
    .map((t) => {
      const decimals = Number(t?.contract_decimals ?? 0);
      const raw = t?.balance ? BigInt(t.balance as string) : 0n;
      const formatted =
        decimals > 0 ? Number(raw) / Math.pow(10, decimals) : Number(raw);
      return {
        symbol: (t?.contract_ticker_symbol as string) ?? "?",
        name: (t?.contract_name as string) ?? "Unknown",
        balance: String(raw),
        balanceFormatted: formatted,
        usdValue: Number(t?.quote ?? 0),
        usdPrice: Number(t?.quote_rate ?? 0),
        logoUrl: t?.logo_url as string | undefined,
        contractAddress: (t?.contract_address as string) ?? "",
      };
    })
    .sort((a, b) => b.usdValue - a.usdValue);

  const totalUsd = tokens.reduce((s, t) => s + t.usdValue, 0);

  // Transactions — classify up to 100 recent
  const txItems = (txsRes?.data?.items ?? []) as Transaction[];
  const toClassify = txItems.slice(0, 100);
  const txMix = emptyMix();
  const classified: TxCategory[] = [];
  for (const tx of toClassify) {
    const cat = isEvm ? classifyTx(tx) : Number(tx?.value ?? 0) > 0 ? "transfer" : "other";
    classified.push(cat);
    txMix[cat] += 1;
    txMix.total += 1;
  }

  const recentTxs: RecentTx[] = toClassify.slice(0, 25).map((tx, i) => ({
    hash: (tx?.tx_hash as string) ?? "",
    timestamp: String(tx?.block_signed_at ?? ""),
    from: (tx?.from_address as string) ?? "",
    to: (tx?.to_address as string) ?? "",
    valueUsd: Number(tx?.value_quote ?? 0),
    successful: !!tx?.successful,
    category: classified[i],
  }));

  // Approvals (EVM only)
  const approvals: ApprovalRisk[] = [];
  if (isEvm && approvalsRes) {
    const items = (approvalsRes?.data?.items ?? []) as Array<
      Record<string, unknown>
    >;
    for (const it of items) {
      const token = (it?.ticker_symbol as string) ?? "?";
      const tokenName = (it?.token_address_label as string) ?? "";
      const tokenAddress = (it?.token_address as string) ?? "";
      const spenders = (it?.spenders ?? []) as Array<Record<string, unknown>>;
      for (const sp of spenders) {
        const allowance = String(sp?.allowance ?? "0");
        approvals.push({
          token,
          tokenName,
          tokenAddress,
          spender: (sp?.spender_address as string) ?? "",
          spenderLabel: (sp?.spender_address_label as string) ?? "",
          allowance,
          valueAtRiskUsd: Number(sp?.value_at_risk_quote ?? 0),
          riskFactor: (sp?.risk_factor as string) ?? "",
          isUnlimited: isUnlimitedAllowance(allowance),
        });
      }
    }
    approvals.sort((a, b) => {
      if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
      return b.valueAtRiskUsd - a.valueAtRiskUsd;
    });
  }

  return {
    address,
    chain,
    isEvm,
    totalUsd,
    tokens: tokens.slice(0, 25),
    recentTxs,
    txCount: txItems.length,
    txMix,
    approvals: approvals.slice(0, 15),
  };
}
