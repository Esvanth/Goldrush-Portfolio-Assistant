import type { WalletSnapshot } from "./goldrush";

export type RiskComponent = {
  label: string;
  points: number;
  note: string;
};

export type RiskBreakdown = {
  total: number;
  severity: "low" | "moderate" | "elevated";
  components: RiskComponent[];
  unlimitedApprovals: number;
  approvalsExposureUsd: number;
  topConcentrationPct: number;
  stableSharePct: number;
};

const STABLES = new Set([
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

function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function computeRisk(snapshot: WalletSnapshot): RiskBreakdown {
  const components: RiskComponent[] = [];
  let total = 0;

  // 1) Concentration — max 30. Waived when the dominant asset is a stablecoin
  // (holding only USDC isn't volatility risk; volatility cushion scores that instead).
  let topConcentrationPct = 0;
  if (snapshot.totalUsd > 0 && snapshot.tokens.length > 0) {
    const top = snapshot.tokens[0];
    topConcentrationPct = (top.usdValue / snapshot.totalUsd) * 100;
    const topIsStable = STABLES.has(top.symbol);
    let pts = 0;
    let note = "Holdings reasonably distributed";
    if (topIsStable && topConcentrationPct >= 50) {
      note = `${top.symbol} is ${topConcentrationPct.toFixed(
        0
      )}% of portfolio — stablecoin, no volatility penalty`;
    } else if (topConcentrationPct >= 90) {
      pts = 30;
      note = `${top.symbol} is ${topConcentrationPct.toFixed(0)}% of portfolio`;
    } else if (topConcentrationPct >= 70) {
      pts = 20;
      note = `${top.symbol} is ${topConcentrationPct.toFixed(0)}% of portfolio`;
    } else if (topConcentrationPct >= 50) {
      pts = 10;
      note = `${top.symbol} is ${topConcentrationPct.toFixed(0)}% of portfolio`;
    }
    components.push({ label: "Concentration", points: pts, note });
    total += pts;
  } else {
    components.push({
      label: "Concentration",
      points: 0,
      note: "No holdings to score",
    });
  }

  // 2) Approval hygiene (EVM only) — max 40. Combines count tier with $ exposure
  // so 1 unlimited approval on $500k isn't scored the same as 1 unlimited on $5 of dust.
  let unlimitedApprovals = 0;
  let approvalsExposureUsd = 0;
  if (snapshot.isEvm) {
    unlimitedApprovals = snapshot.approvals.filter((a) => a.isUnlimited).length;
    approvalsExposureUsd = snapshot.approvals.reduce(
      (s, a) => s + (a.isUnlimited ? a.valueAtRiskUsd : 0),
      0
    );

    let pts = 0;
    let note = "No outstanding approvals";

    if (snapshot.approvals.length === 0) {
      note = "No outstanding approvals";
    } else if (unlimitedApprovals === 0) {
      pts = 2;
      note = `${snapshot.approvals.length} capped approvals, none unlimited`;
    } else {
      // Count-based component (max 24)
      let countPts = 8;
      if (unlimitedApprovals >= 6) countPts = 24;
      else if (unlimitedApprovals >= 3) countPts = 16;

      // Exposure-based component (max 16)
      let exposurePts = 0;
      if (approvalsExposureUsd >= 100_000) exposurePts = 16;
      else if (approvalsExposureUsd >= 10_000) exposurePts = 12;
      else if (approvalsExposureUsd >= 1_000) exposurePts = 8;
      else if (approvalsExposureUsd >= 100) exposurePts = 4;

      pts = Math.min(40, countPts + exposurePts);

      const exposureNote =
        approvalsExposureUsd > 0
          ? `exposing ${fmtUsd(approvalsExposureUsd)}`
          : "exposure not priced";
      const tail = unlimitedApprovals >= 3 ? " — revoke stale ones" : "";
      note = `${unlimitedApprovals} unlimited approval${
        unlimitedApprovals > 1 ? "s" : ""
      } ${exposureNote}${tail}`;
    }
    components.push({ label: "Approval hygiene", points: pts, note });
    total += pts;
  } else {
    components.push({
      label: "Approval hygiene",
      points: 0,
      note: "Not applicable on this chain",
    });
  }

  // 3) Volatility cushion (stablecoin share) — max 15
  let stableSharePct = 0;
  if (snapshot.totalUsd > 0) {
    const stableUsd = snapshot.tokens
      .filter((t) => STABLES.has(t.symbol))
      .reduce((s, t) => s + t.usdValue, 0);
    stableSharePct = (stableUsd / snapshot.totalUsd) * 100;
    let pts = 0;
    const note = `Stablecoins ${stableSharePct.toFixed(0)}% of portfolio`;
    if (stableSharePct < 5) pts = 15;
    else if (stableSharePct < 15) pts = 8;
    components.push({ label: "Volatility cushion", points: pts, note });
    total += pts;
  } else {
    components.push({
      label: "Volatility cushion",
      points: 0,
      note: "No holdings to score",
    });
  }

  // 4) Activity signature — max 15
  const mix = snapshot.txMix;
  if (mix.total > 0) {
    const approvalShare = mix.approval / mix.total;
    const swapShare = mix.swap / mix.total;
    let pts = 0;
    let note = "Mixed on-chain activity";
    if (approvalShare > 0.4) {
      pts = 15;
      note = `Approval-heavy activity (${Math.round(approvalShare * 100)}%)`;
    } else if (swapShare > 0.6) {
      pts = 8;
      note = `Heavy swap activity (${Math.round(swapShare * 100)}%)`;
    }
    components.push({ label: "Activity signature", points: pts, note });
    total += pts;
  } else {
    components.push({
      label: "Activity signature",
      points: 4,
      note: "No recent activity detected",
    });
    total += 4;
  }

  total = Math.max(0, Math.min(100, total));
  const severity: RiskBreakdown["severity"] =
    total >= 50 ? "elevated" : total >= 25 ? "moderate" : "low";

  return {
    total,
    severity,
    components,
    unlimitedApprovals,
    approvalsExposureUsd,
    topConcentrationPct,
    stableSharePct,
  };
}
