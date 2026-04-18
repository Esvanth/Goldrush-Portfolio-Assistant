"use client";

import { useState } from "react";

type Token = {
  symbol: string;
  name: string;
  balanceFormatted: number;
  usdValue: number;
  logoUrl?: string;
};

type TxCategory =
  | "swap"
  | "stablecoin"
  | "approval"
  | "bridge"
  | "transfer"
  | "other";

type TxMix = Record<TxCategory, number> & { total: number };

type ApprovalRisk = {
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

type RiskComponent = { label: string; points: number; note: string };

type RiskBreakdown = {
  total: number;
  severity: "low" | "moderate" | "elevated";
  components: RiskComponent[];
  unlimitedApprovals: number;
  approvalsExposureUsd: number;
  topConcentrationPct: number;
  stableSharePct: number;
};

type Snapshot = {
  address: string;
  chain: string;
  isEvm: boolean;
  totalUsd: number;
  tokens: Token[];
  txCount: number;
  txMix: TxMix;
  approvals: ApprovalRisk[];
};

type AnalyzeResponse = {
  snapshot: Snapshot;
  analysis: {
    summary: string;
    riskScore: number;
    riskSeverity: "low" | "moderate" | "elevated";
    riskBreakdown: RiskBreakdown;
    concentration: string;
    insights: string[];
    risks: string[];
    suggestions: string[];
  };
};

type WalletReport = {
  address: string;
  snapshot: Snapshot;
  risk: RiskBreakdown;
};

type CompareResponse = {
  chain: string;
  a: WalletReport;
  b: WalletReport;
  delta: number;
  riskier: "A" | "B" | "tie";
  driverLabel: string;
  driverDelta: number;
  verdict: string;
};

const CATEGORY_LABELS: Record<TxCategory, string> = {
  swap: "Swaps",
  stablecoin: "Stablecoin transfers",
  approval: "Approvals",
  bridge: "Bridge",
  transfer: "Transfers",
  other: "Other",
};

const CATEGORY_COLORS: Record<TxCategory, string> = {
  swap: "#c9a44c",
  stablecoin: "#8f7432",
  approval: "#b56b5e",
  bridge: "#7aa877",
  transfer: "#a8a59f",
  other: "#5a5550",
};

const CHAINS = [
  { id: "solana-mainnet", label: "Solana" },
  { id: "eth-mainnet", label: "Ethereum" },
  { id: "base-mainnet", label: "Base" },
  { id: "matic-mainnet", label: "Polygon" },
  { id: "bsc-mainnet", label: "BNB Chain" },
];

const SAMPLE: Record<string, string> = {
  "solana-mainnet": "3Nzp8qrkKCvV8kHHwKfE7Qk5d9iJ9U4mqgYkNvV4Lu4d",
  "eth-mainnet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "base-mainnet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "matic-mainnet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "bsc-mainnet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
};

const DONUT_COLORS = [
  "#c9a44c",
  "#8f7432",
  "#6b6960",
  "#a8a59f",
  "#5a5550",
  "#3f3d39",
];

function shortAddr(a: string) {
  if (!a) return "";
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatBalance(n: number) {
  if (!isFinite(n) || n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(2);
}

function formatUsd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function Home() {
  const [mode, setMode] = useState<"analyze" | "compare">("analyze");
  const [address, setAddress] = useState("");
  const [addressA, setAddressA] = useState("");
  const [addressB, setAddressB] = useState("");
  const [chain, setChain] = useState("solana-mainnet");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetResults() {
    setData(null);
    setCompareData(null);
    setError(null);
  }

  async function analyze(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    resetResults();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function compare(e?: React.FormEvent) {
    e?.preventDefault();
    if (!addressA.trim() || !addressB.trim()) return;
    setLoading(true);
    resetResults();
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addressA: addressA.trim(),
          addressB: addressB.trim(),
          chain,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setCompareData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setAddress(SAMPLE[chain] ?? SAMPLE["eth-mainnet"]);
  }

  function loadSampleCompare() {
    const base = SAMPLE[chain] ?? SAMPLE["eth-mainnet"];
    setAddressA(base);
    // Use vitalik.eth as B on EVM chains, a known high-activity SOL on Solana
    setAddressB(
      chain.startsWith("solana")
        ? "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"
        : "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    );
  }

  const chainLabel = CHAINS.find((c) => c.id === chain)?.label ?? chain;

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
        {/* Masthead */}
        <header className="border-b hairline-strong pb-5 mb-10 flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] tracking-[0.25em] text-[color:var(--brass)]">
              ※ GOLDRUSH
            </span>
            <span className="smallcaps">№ 001 · Portfolio Analyst</span>
          </div>
          <div className="smallcaps tabular">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>

        {/* Wordmark */}
        <section className="mb-12">
          <h1 className="font-serif text-[52px] sm:text-[72px] leading-[0.95] tracking-tight text-[color:var(--ink)]">
            On-chain intelligence,
            <br />
            <em className="italic text-[color:var(--brass)]">read like a page.</em>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[color:var(--ink-dim)]">
            Paste a wallet from Solana, Ethereum, Base, Polygon, or BNB Chain.
            GoldRush returns balances and activity; the analyst turns them into a
            brief a human would write.
          </p>
        </section>

        {/* Mode toggle */}
        <div className="mb-4 flex items-center gap-5 border-b hairline pb-2">
          {(["analyze", "compare"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                resetResults();
              }}
              className={`smallcaps pb-1 -mb-[1px] border-b-[1px] transition ${
                mode === m
                  ? "text-[color:var(--ink)] border-[color:var(--brass)]"
                  : "text-[color:var(--ink-muted)] border-transparent hover:text-[color:var(--ink-dim)]"
              }`}
            >
              {m === "analyze" ? "Analyze one" : "Compare two"}
            </button>
          ))}
        </div>

        {/* Form */}
        {mode === "analyze" ? (
          <form
            onSubmit={analyze}
            className="border hairline-strong bg-[color:var(--panel)] p-4 sm:p-5 mb-12"
          >
            <div className="grid sm:grid-cols-[160px_1fr_auto] gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="smallcaps">Chain</span>
                <ChainSelect value={chain} onChange={setChain} />
              </label>

              <label className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="smallcaps">Wallet address</span>
                  <button
                    type="button"
                    onClick={loadSample}
                    className="smallcaps text-[color:var(--brass)] hover:text-[color:var(--ink)] transition"
                  >
                    Load sample →
                  </button>
                </div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={`Paste a ${chainLabel} address`}
                  spellCheck={false}
                  className="h-11 w-full bg-transparent border hairline px-3 text-sm font-mono text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)] focus:outline-none focus:border-[color:var(--brass)] transition"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="smallcaps opacity-0 hidden sm:block">Go</span>
                <button
                  type="submit"
                  disabled={loading || !address.trim()}
                  className="h-11 px-6 text-sm font-medium bg-[color:var(--ink)] text-[#0b0b0d] hover:bg-[color:var(--brass)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing…" : "Analyze ↵"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form
            onSubmit={compare}
            className="border hairline-strong bg-[color:var(--panel)] p-4 sm:p-5 mb-12"
          >
            <div className="grid sm:grid-cols-[160px_1fr] gap-3 mb-3">
              <label className="flex flex-col gap-1.5">
                <span className="smallcaps">Chain</span>
                <ChainSelect value={chain} onChange={setChain} />
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={loadSampleCompare}
                  className="smallcaps text-[color:var(--brass)] hover:text-[color:var(--ink)] transition"
                >
                  Load sample pair →
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="smallcaps">Wallet A</span>
                <input
                  value={addressA}
                  onChange={(e) => setAddressA(e.target.value)}
                  placeholder={`Paste a ${chainLabel} address`}
                  spellCheck={false}
                  className="h-11 w-full bg-transparent border hairline px-3 text-sm font-mono text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)] focus:outline-none focus:border-[color:var(--brass)] transition"
                />
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="smallcaps">Wallet B</span>
                <input
                  value={addressB}
                  onChange={(e) => setAddressB(e.target.value)}
                  placeholder={`Paste a ${chainLabel} address`}
                  spellCheck={false}
                  className="h-11 w-full bg-transparent border hairline px-3 text-sm font-mono text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)] focus:outline-none focus:border-[color:var(--brass)] transition"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading || !addressA.trim() || !addressB.trim()}
                className="h-11 px-6 text-sm font-medium bg-[color:var(--ink)] text-[#0b0b0d] hover:bg-[color:var(--brass)] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Comparing…" : "Compare ↵"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="border hairline-strong border-l-2 border-l-[color:var(--neg)] bg-[color:var(--panel)] px-4 py-3 mb-10 text-sm">
            <div className="smallcaps text-[color:var(--neg)] mb-1">Error</div>
            <div className="text-[color:var(--ink-dim)]">{error}</div>
          </div>
        )}

        {loading && <LoadingState />}
        {!loading && !data && !compareData && !error && <EmptyState />}
        {data && <Results data={data} chainLabel={chainLabel} />}
        {compareData && (
          <CompareResults data={compareData} chainLabel={chainLabel} />
        )}

        <footer className="mt-20 pt-6 border-t hairline flex items-center justify-end smallcaps">
          <div>© {new Date().getFullYear()} · All rights reserved</div>
        </footer>
      </div>
    </main>
  );
}

function Results({
  data,
  chainLabel,
}: {
  data: AnalyzeResponse;
  chainLabel: string;
}) {
  const totalPositions = data.snapshot.tokens.length;

  return (
    <div>
      {/* Meta strip */}
      <div className="border-y hairline-strong py-3 mb-10 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-8">
        <MetaCell label="Chain" value={chainLabel} />
        <MetaCell
          label="Address"
          value={
            <span className="font-mono">{shortAddr(data.snapshot.address)}</span>
          }
          action={<CopyButton value={data.snapshot.address} />}
        />
        <MetaCell label="Positions" value={totalPositions.toLocaleString()} />
        <MetaCell
          label="Transactions"
          value={data.snapshot.txCount.toLocaleString()}
        />
      </div>

      {/* Lead figures */}
      <section className="mb-12">
        <div className="smallcaps mb-3">I · Figures</div>
        <div className="grid sm:grid-cols-3 border hairline-strong divide-y sm:divide-y-0 sm:divide-x hairline">
          <Figure
            label="Portfolio value"
            value={formatUsd(data.snapshot.totalUsd)}
            note={
              data.snapshot.tokens[0]
                ? `Top position ${data.snapshot.tokens[0].symbol}`
                : undefined
            }
          />
          <RiskFigure
            score={data.analysis.riskScore}
            severity={data.analysis.riskSeverity}
          />
          <Figure
            label="Activity"
            value={`${data.snapshot.txCount.toLocaleString()} tx`}
            note="Recent on-chain"
          />
        </div>
      </section>

      {/* Brief + Allocation */}
      <section className="mb-12 grid lg:grid-cols-[1fr_280px] gap-10">
        <div>
          <div className="smallcaps mb-3">II · The brief</div>
          <p className="font-serif text-[20px] leading-[1.5] text-[color:var(--ink)]">
            <span className="text-[color:var(--brass)]">“</span>
            {data.analysis.summary}
            <span className="text-[color:var(--brass)]">”</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-dim)]">
            {data.analysis.concentration}
          </p>
        </div>

        <AllocationPanel
          tokens={data.snapshot.tokens}
          total={data.snapshot.totalUsd}
        />
      </section>

      {/* Columns: insights / risks / suggestions */}
      <section className="mb-12">
        <div className="smallcaps mb-3">III · Notes</div>
        <div className="grid md:grid-cols-3 border hairline-strong divide-y md:divide-y-0 md:divide-x hairline">
          <NotesColumn title="Insights" items={data.analysis.insights} />
          <NotesColumn title="Risks" items={data.analysis.risks} />
          <NotesColumn title="Suggestions" items={data.analysis.suggestions} />
        </div>
      </section>

      {/* Holdings table */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="smallcaps">IV · Top Holdings</div>
          <div className="smallcaps tabular">
            {Math.min(10, totalPositions)} of {totalPositions}
          </div>
        </div>
        <div className="border hairline-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b hairline-strong">
                <Th className="w-10 text-left">#</Th>
                <Th className="text-left">Symbol</Th>
                <Th className="text-left hidden sm:table-cell">Name</Th>
                <Th className="text-right">Balance</Th>
                <Th className="text-right">Value</Th>
                <Th className="text-right w-40 hidden sm:table-cell">Share</Th>
              </tr>
            </thead>
            <tbody>
              {data.snapshot.tokens.slice(0, 10).map((t, i) => {
                const pct =
                  data.snapshot.totalUsd > 0
                    ? (t.usdValue / data.snapshot.totalUsd) * 100
                    : 0;
                return (
                  <tr
                    key={i}
                    className={
                      "border-b hairline last:border-b-0 hover:bg-white/[0.02]"
                    }
                  >
                    <Td className="text-[color:var(--ink-muted)] tabular">
                      {String(i + 1).padStart(2, "0")}
                    </Td>
                    <Td className="font-medium text-[color:var(--ink)]">
                      {t.symbol || "—"}
                    </Td>
                    <Td className="text-[color:var(--ink-dim)] hidden sm:table-cell">
                      {t.name || "—"}
                    </Td>
                    <Td className="text-right tabular font-mono text-[color:var(--ink-dim)]">
                      {formatBalance(t.balanceFormatted)}
                    </Td>
                    <Td className="text-right tabular font-mono text-[color:var(--ink)]">
                      {formatUsd(t.usdValue)}
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="flex-1 h-[2px] bg-[color:var(--rule-strong)] relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-[color:var(--brass)]"
                            style={{
                              width: `${Math.min(100, Math.max(1, pct))}%`,
                            }}
                          />
                        </div>
                        <span className="tabular font-mono text-[color:var(--ink-dim)] w-12 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {totalPositions === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-[color:var(--ink-muted)] text-sm"
                  >
                    No tokens found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* V · Activity mix */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-3">
          <div className="smallcaps">V · Activity</div>
          <div className="smallcaps tabular">
            {data.snapshot.txMix.total} classified
          </div>
        </div>
        <ActivityMix mix={data.snapshot.txMix} />
      </section>

      {/* VI · Approvals — EVM only */}
      {data.snapshot.isEvm && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <div className="smallcaps">VI · Approvals</div>
            <div className="smallcaps tabular">
              {data.analysis.riskBreakdown.unlimitedApprovals} unlimited ·{" "}
              {data.snapshot.approvals.length} total
            </div>
          </div>
          <ApprovalsPanel
            approvals={data.snapshot.approvals}
            breakdown={data.analysis.riskBreakdown}
          />
        </section>
      )}

      {/* Risk breakdown — computed, not LLM */}
      <section className="mt-12">
        <div className="smallcaps mb-3">Risk · how it was scored</div>
        <div className="border hairline-strong divide-y hairline">
          {data.analysis.riskBreakdown.components.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-2.5 text-sm"
            >
              <div className="smallcaps w-40 shrink-0">{c.label}</div>
              <div className="flex-1 text-[color:var(--ink-dim)]">{c.note}</div>
              <div
                className="tabular font-mono text-[color:var(--ink)] w-12 text-right"
                title={`${c.points} points`}
              >
                +{c.points}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 px-4 py-3 text-sm bg-white/[0.02]">
            <div className="smallcaps w-40 shrink-0 text-[color:var(--ink)]">
              Total
            </div>
            <div className="flex-1 text-[color:var(--ink-muted)]">
              Severity ·{" "}
              <span className="text-[color:var(--ink)]">
                {data.analysis.riskSeverity}
              </span>
            </div>
            <div className="tabular font-mono text-[color:var(--ink)] w-12 text-right font-semibold">
              {data.analysis.riskBreakdown.total}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityMix({ mix }: { mix: TxMix }) {
  if (mix.total === 0) {
    return (
      <div className="border hairline-strong p-5 text-sm text-[color:var(--ink-muted)]">
        No recent transactions to classify.
      </div>
    );
  }
  const cats: TxCategory[] = [
    "swap",
    "stablecoin",
    "approval",
    "bridge",
    "transfer",
    "other",
  ];
  const nonEmpty = cats.filter((c) => mix[c] > 0);

  return (
    <div className="border hairline-strong p-5">
      <div className="flex w-full h-3 overflow-hidden">
        {cats.map((c) => {
          const pct = (mix[c] / mix.total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={c}
              style={{
                width: `${pct}%`,
                background: CATEGORY_COLORS[c],
              }}
              title={`${CATEGORY_LABELS[c]}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
        {nonEmpty.map((c) => {
          const pct = (mix[c] / mix.total) * 100;
          return (
            <li key={c} className="flex items-center gap-2">
              <span
                className="w-2 h-2 shrink-0"
                style={{ background: CATEGORY_COLORS[c] }}
              />
              <span className="text-[color:var(--ink)] flex-1 truncate">
                {CATEGORY_LABELS[c]}
              </span>
              <span className="tabular font-mono text-[color:var(--ink-dim)]">
                {mix[c]} · {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ApprovalsPanel({
  approvals,
  breakdown,
}: {
  approvals: ApprovalRisk[];
  breakdown: RiskBreakdown;
}) {
  if (approvals.length === 0) {
    return (
      <div className="border hairline-strong p-5 text-sm text-[color:var(--ink-dim)]">
        No outstanding token approvals — clean slate.
      </div>
    );
  }

  return (
    <div className="border hairline-strong">
      {breakdown.unlimitedApprovals > 0 && (
        <div className="px-4 py-3 border-b hairline-strong bg-[color:var(--neg)]/[0.08] text-sm">
          <span className="text-[color:var(--neg)] font-medium">
            {breakdown.unlimitedApprovals} unlimited approval
            {breakdown.unlimitedApprovals > 1 ? "s" : ""}
          </span>
          <span className="text-[color:var(--ink-dim)]">
            {" "}
            · ${Math.round(breakdown.approvalsExposureUsd).toLocaleString()}{" "}
            exposed
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b hairline-strong">
              <Th className="text-left">Token</Th>
              <Th className="text-left">Spender</Th>
              <Th className="text-right">At risk</Th>
              <Th className="text-right w-32">Allowance</Th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((a, i) => (
              <tr
                key={i}
                className="border-b hairline last:border-b-0"
              >
                <Td className="font-medium text-[color:var(--ink)]">
                  {a.token}
                </Td>
                <Td className="text-[color:var(--ink-dim)]">
                  <div className="flex flex-col">
                    <span className="truncate max-w-[260px]">
                      {a.spenderLabel || "Unlabeled contract"}
                    </span>
                    <span className="text-[11px] font-mono text-[color:var(--ink-muted)] truncate">
                      {a.spender}
                    </span>
                  </div>
                </Td>
                <Td className="text-right tabular font-mono text-[color:var(--ink)]">
                  {a.valueAtRiskUsd > 0
                    ? `$${Math.round(a.valueAtRiskUsd).toLocaleString()}`
                    : "—"}
                </Td>
                <Td className="text-right">
                  {a.isUnlimited ? (
                    <span className="inline-flex items-center gap-1.5 smallcaps text-[color:var(--neg)] border border-[color:var(--neg)]/40 px-1.5 py-0.5">
                      Unlimited
                    </span>
                  ) : (
                    <span className="smallcaps text-[color:var(--ink-muted)]">
                      Capped
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="smallcaps">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-[color:var(--ink)] truncate">{value}</span>
        {action}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="p-5">
      <div className="smallcaps mb-2">{label}</div>
      <div className="font-serif text-[32px] leading-none tabular text-[color:var(--ink)]">
        {value}
      </div>
      {note && (
        <div className="mt-2 text-xs text-[color:var(--ink-muted)]">{note}</div>
      )}
    </div>
  );
}

function RiskFigure({
  score,
  severity,
}: {
  score: number;
  severity: "low" | "moderate" | "elevated";
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    severity === "elevated"
      ? "var(--neg)"
      : severity === "moderate"
        ? "var(--brass)"
        : "var(--pos)";
  const label =
    severity === "elevated"
      ? "Elevated"
      : severity === "moderate"
        ? "Moderate"
        : "Contained";

  return (
    <div className="p-5">
      <div className="smallcaps mb-2">Risk</div>
      <div className="flex items-baseline gap-2">
        <div
          className="font-serif text-[32px] leading-none tabular"
          style={{ color: `color-mix(in srgb, ${color} 85%, white 15%)` }}
        >
          {clamped}
        </div>
        <div className="text-sm text-[color:var(--ink-muted)] tabular">
          / 100
        </div>
      </div>
      <div className="mt-3 h-[3px] bg-[color:var(--rule-strong)] relative">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${clamped}%`, background: `${color}` }}
        />
      </div>
      <div
        className="mt-2 text-xs"
        style={{ color: `color-mix(in srgb, ${color} 70%, white 30%)` }}
      >
        {label} · computed from GoldRush signals
      </div>
    </div>
  );
}

function AllocationPanel({
  tokens,
  total,
}: {
  tokens: Token[];
  total: number;
}) {
  if (total <= 0 || tokens.length === 0) {
    return (
      <aside className="border-l hairline pl-6 hidden lg:block">
        <div className="smallcaps mb-3">Allocation</div>
        <div className="text-sm text-[color:var(--ink-muted)]">No data.</div>
      </aside>
    );
  }

  const top = tokens.slice(0, 5);
  const rest = tokens.slice(5).reduce((a, t) => a + t.usdValue, 0);
  const slices = [
    ...top.map((t) => ({ label: t.symbol || "?", value: t.usdValue })),
    ...(rest > 0 ? [{ label: "Other", value: rest }] : []),
  ];

  const r = 48;
  const stroke = 1.5;
  const size = 120;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;

  let acc = 0;
  const segments = slices.map((s, i) => {
    const pct = s.value / total;
    const len = pct * circumference;
    const seg = {
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      dasharray: `${Math.max(0, len - 1)} ${circumference}`,
      offset: -acc,
      pct,
      label: s.label,
      value: s.value,
    };
    acc += len;
    return seg;
  });

  return (
    <aside className="lg:border-l hairline lg:pl-6">
      <div className="smallcaps mb-3">Allocation</div>
      <div className="flex items-start gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <circle
            cx={center}
            cy={center}
            r={r}
            stroke="var(--rule-strong)"
            strokeWidth={stroke}
            fill="none"
          />
          <g transform={`rotate(-90 ${center} ${center})`}>
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={r}
                stroke={seg.color}
                strokeWidth={12}
                fill="none"
                strokeDasharray={seg.dasharray}
                strokeDashoffset={seg.offset}
              />
            ))}
          </g>
        </svg>
        <ul className="flex-1 min-w-0 space-y-1.5 text-xs">
          {segments.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2"
              title={`${s.label}: ${formatUsd(s.value)}`}
            >
              <span
                className="w-2 h-2 shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[color:var(--ink)] truncate flex-1 min-w-0">
                {s.label}
              </span>
              <span className="tabular font-mono text-[color:var(--ink-dim)]">
                {(s.pct * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function NotesColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-5">
      <div className="smallcaps mb-3">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-[color:var(--ink-muted)] italic">
          None detected.
        </div>
      ) : (
        <ol className="space-y-3 text-sm leading-relaxed text-[color:var(--ink)]">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="smallcaps tabular pt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border hairline-strong p-10">
      <div className="max-w-xl">
        <div className="smallcaps mb-3">Before you begin</div>
        <p className="font-serif text-[22px] leading-[1.4] text-[color:var(--ink)]">
          The analyst is ready. Choose a chain, paste an address, and a concise
          portfolio brief will follow — risk, concentration, and notes included.
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2">
          {CHAINS.map((c) => (
            <div
              key={c.id}
              className="text-sm text-[color:var(--ink-dim)] border-t hairline pt-2"
            >
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="border hairline-strong p-6">
      <div className="flex items-center gap-3 text-sm text-[color:var(--ink-dim)]">
        <span className="inline-block w-1.5 h-1.5 bg-[color:var(--brass)]" />
        <span>
          Fetching balances from GoldRush · composing brief
          <span className="inline-block w-6 text-left align-baseline">
            <span className="animate-pulse">…</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="smallcaps text-[color:var(--brass)] hover:text-[color:var(--ink)] transition"
      aria-label="Copy address"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`smallcaps font-normal px-4 py-2.5 text-[color:var(--ink-muted)] ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function ChainSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none bg-transparent border hairline px-3 pr-8 text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brass)] transition cursor-pointer"
      >
        {CHAINS.map((c) => (
          <option
            key={c.id}
            value={c.id}
            className="bg-[color:var(--panel)]"
          >
            {c.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--ink-muted)]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

function severityColor(severity: "low" | "moderate" | "elevated") {
  return severity === "elevated"
    ? "var(--neg)"
    : severity === "moderate"
      ? "var(--brass)"
      : "var(--pos)";
}

function severityLabel(severity: "low" | "moderate" | "elevated") {
  return severity === "elevated"
    ? "Elevated"
    : severity === "moderate"
      ? "Moderate"
      : "Contained";
}

function CompareResults({
  data,
  chainLabel,
}: {
  data: CompareResponse;
  chainLabel: string;
}) {
  const absDelta = Math.abs(data.delta);
  const riskierLetter =
    data.riskier === "tie" ? "=" : data.riskier === "A" ? "A" : "B";
  const deltaColor =
    data.riskier === "tie" ? "var(--ink-muted)" : "var(--neg)";

  return (
    <div>
      {/* Verdict banner */}
      <section className="mb-10 border hairline-strong p-5 sm:p-6">
        <div className="smallcaps mb-3">Verdict</div>
        <p className="font-serif text-[22px] leading-[1.4] text-[color:var(--ink)]">
          <span className="text-[color:var(--brass)]">“</span>
          {data.verdict}
          <span className="text-[color:var(--brass)]">”</span>
        </p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-8 border-t hairline pt-4">
          <div>
            <div className="smallcaps mb-1">Chain</div>
            <div className="text-sm text-[color:var(--ink)]">{chainLabel}</div>
          </div>
          <div>
            <div className="smallcaps mb-1">Scores</div>
            <div className="text-sm tabular font-mono text-[color:var(--ink)]">
              <span>A · {data.a.risk.total}</span>
              <span className="mx-2 text-[color:var(--ink-muted)]">vs</span>
              <span>B · {data.b.risk.total}</span>
            </div>
          </div>
          <div>
            <div className="smallcaps mb-1">Gap</div>
            <div
              className="text-sm tabular font-mono"
              style={{ color: deltaColor }}
            >
              {absDelta === 0
                ? "No difference"
                : `${absDelta} pts → ${riskierLetter}`}
            </div>
          </div>
          <div>
            <div className="smallcaps mb-1">Driver</div>
            <div className="text-sm text-[color:var(--ink)]">
              {data.driverLabel}
            </div>
          </div>
        </div>
      </section>

      {/* Two-column wallet summaries */}
      <section className="mb-10 grid md:grid-cols-2 gap-5">
        <WalletCard label="Wallet A" report={data.a} />
        <WalletCard label="Wallet B" report={data.b} />
      </section>

      {/* Side-by-side risk breakdown */}
      <section>
        <div className="smallcaps mb-3">Risk · component by component</div>
        <div className="border hairline-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b hairline-strong">
                <Th className="text-left">Component</Th>
                <Th className="text-right w-20">A</Th>
                <Th className="text-right w-20">B</Th>
                <Th className="text-right w-24">Δ</Th>
                <Th className="text-left">Notes</Th>
              </tr>
            </thead>
            <tbody>
              {data.a.risk.components.map((ca, i) => {
                const cb = data.b.risk.components[i];
                const d = (cb?.points ?? 0) - ca.points;
                const dColor =
                  d === 0
                    ? "var(--ink-muted)"
                    : d > 0
                      ? "var(--neg)"
                      : "var(--pos)";
                return (
                  <tr key={i} className="border-b hairline last:border-b-0">
                    <Td className="smallcaps text-[color:var(--ink)]">
                      {ca.label}
                    </Td>
                    <Td className="text-right tabular font-mono text-[color:var(--ink-dim)]">
                      {ca.points}
                    </Td>
                    <Td className="text-right tabular font-mono text-[color:var(--ink-dim)]">
                      {cb?.points ?? 0}
                    </Td>
                    <Td
                      className="text-right tabular font-mono"
                      // eslint-disable-next-line react/forbid-dom-props
                    >
                      <span style={{ color: dColor }}>
                        {d > 0 ? `+${d}` : d}
                      </span>
                    </Td>
                    <Td className="text-[color:var(--ink-muted)] text-xs">
                      <div>
                        <span className="smallcaps mr-1">A</span>
                        {ca.note}
                      </div>
                      <div className="mt-0.5">
                        <span className="smallcaps mr-1">B</span>
                        {cb?.note ?? "—"}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-white/[0.02]">
                <Td className="smallcaps text-[color:var(--ink)]">Total</Td>
                <Td className="text-right tabular font-mono text-[color:var(--ink)] font-semibold">
                  {data.a.risk.total}
                </Td>
                <Td className="text-right tabular font-mono text-[color:var(--ink)] font-semibold">
                  {data.b.risk.total}
                </Td>
                <Td className="text-right tabular font-mono font-semibold">
                  <span
                    style={{
                      color:
                        data.delta === 0
                          ? "var(--ink-muted)"
                          : data.delta > 0
                            ? "var(--neg)"
                            : "var(--pos)",
                    }}
                  >
                    {data.delta > 0 ? `+${data.delta}` : data.delta}
                  </span>
                </Td>
                <Td className="text-[color:var(--ink-muted)] text-xs">
                  Severity · A {data.a.risk.severity} · B {data.b.risk.severity}
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WalletCard({
  label,
  report,
}: {
  label: string;
  report: WalletReport;
}) {
  const color = severityColor(report.risk.severity);
  const sevLabel = severityLabel(report.risk.severity);
  const clamped = Math.max(0, Math.min(100, report.risk.total));
  const topToken = report.snapshot.tokens[0];

  return (
    <div className="border hairline-strong p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="smallcaps text-[color:var(--brass)]">{label}</div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-[color:var(--ink-dim)] truncate">
            {shortAddr(report.address)}
          </span>
          <CopyButton value={report.address} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="smallcaps mb-1">Portfolio</div>
          <div className="font-serif text-[26px] leading-none tabular text-[color:var(--ink)]">
            {formatUsd(report.snapshot.totalUsd)}
          </div>
          {topToken && (
            <div className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Top · {topToken.symbol}
            </div>
          )}
        </div>
        <div>
          <div className="smallcaps mb-1">Risk</div>
          <div className="flex items-baseline gap-1.5">
            <div
              className="font-serif text-[26px] leading-none tabular"
              style={{ color: `color-mix(in srgb, ${color} 85%, white 15%)` }}
            >
              {clamped}
            </div>
            <div className="text-xs text-[color:var(--ink-muted)] tabular">
              / 100
            </div>
          </div>
          <div className="mt-2 h-[2px] bg-[color:var(--rule-strong)] relative">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${clamped}%`, background: color }}
            />
          </div>
          <div
            className="mt-1 text-xs"
            style={{ color: `color-mix(in srgb, ${color} 70%, white 30%)` }}
          >
            {sevLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs border-t hairline pt-3">
        <div>
          <div className="smallcaps mb-1">Transactions</div>
          <div className="tabular font-mono text-[color:var(--ink)]">
            {report.snapshot.txCount.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="smallcaps mb-1">Approvals</div>
          <div className="tabular font-mono text-[color:var(--ink)]">
            {report.snapshot.isEvm ? (
              report.risk.unlimitedApprovals > 0 ? (
                <span className="text-[color:var(--neg)]">
                  {report.risk.unlimitedApprovals} unlimited ·{" "}
                  {formatUsd(report.risk.approvalsExposureUsd)}
                </span>
              ) : (
                <span className="text-[color:var(--ink-dim)]">None</span>
              )
            ) : (
              <span className="text-[color:var(--ink-muted)]">n/a</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="smallcaps mb-2">Activity mix</div>
        <ActivityMix mix={report.snapshot.txMix} />
      </div>
    </div>
  );
}
