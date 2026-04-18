import type { WalletSnapshot } from "./goldrush";
import { computeRisk, type RiskBreakdown } from "./risk";

export type WalletReport = {
  address: string;
  snapshot: WalletSnapshot;
  risk: RiskBreakdown;
};

export type CompareResult = {
  chain: string;
  a: WalletReport;
  b: WalletReport;
  delta: number;
  riskier: "A" | "B" | "tie";
  driverLabel: string;
  driverDelta: number;
  verdict: string;
};

export function compareWallets(
  a: { address: string; snapshot: WalletSnapshot },
  b: { address: string; snapshot: WalletSnapshot }
): CompareResult {
  const riskA = computeRisk(a.snapshot);
  const riskB = computeRisk(b.snapshot);

  const delta = riskB.total - riskA.total;
  const riskier: CompareResult["riskier"] =
    delta > 0 ? "B" : delta < 0 ? "A" : "tie";

  const componentDeltas = riskA.components.map((ca, i) => {
    const cb = riskB.components[i];
    return {
      label: ca.label,
      delta: (cb?.points ?? 0) - ca.points,
      aNote: ca.note,
      bNote: cb?.note ?? "",
    };
  });

  const driver = componentDeltas.reduce(
    (best, cur) =>
      Math.abs(cur.delta) > Math.abs(best.delta) ? cur : best,
    componentDeltas[0] ?? { label: "—", delta: 0, aNote: "", bNote: "" }
  );

  let verdict: string;
  if (riskier === "tie") {
    verdict = `Both wallets score ${riskA.total}/100 — effectively identical risk profiles.`;
  } else {
    const riskierLabel = riskier === "A" ? "Wallet A" : "Wallet B";
    const saferLabel = riskier === "A" ? "Wallet B" : "Wallet A";
    const absDelta = Math.abs(delta);
    const driverPhrase = driver.label.toLowerCase();
    const riskierNote =
      (riskier === "A" ? driver.aNote : driver.bNote) || driverPhrase;
    verdict =
      `${riskierLabel} carries ${absDelta} point${absDelta === 1 ? "" : "s"} ` +
      `more risk than ${saferLabel}, driven by ${driverPhrase} — ${riskierNote}.`;
  }

  return {
    chain: a.snapshot.chain,
    a: { address: a.address, snapshot: a.snapshot, risk: riskA },
    b: { address: b.address, snapshot: b.snapshot, risk: riskB },
    delta,
    riskier,
    driverLabel: driver.label,
    driverDelta: driver.delta,
    verdict,
  };
}
