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

  // 1) Concentration
  let topConcentrationPct = 0;
  if (snapshot.totalUsd > 0 && snapshot.tokens.length > 0) {
    const top = snapshot.tokens[0];
    topConcentrationPct = (top.usdValue / snapshot.totalUsd) * 100;
    let pts = 0;
    let note = "Holdings reasonably distributed";
    if (topConcentrationPct >= 90) {
      pts = 25;
      note = `${top.symbol} is ${topConcentrationPct.toFixed(0)}% of portfolio`;
    } else if (topConcentrationPct >= 70) {
      pts = 15;
      note = `${top.symbol} is ${topConcentrationPct.toFixed(0)}% of portfolio`;
    } else if (topConcentrationPct >= 50) {
      pts = 8;
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

  // 2) Approval hygiene (EVM only)
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
    } else if (unlimitedApprovals <= 2) {
      pts = 10;
      note = `${unlimitedApprovals} unlimited approval${
        unlimitedApprovals > 1 ? "s" : ""
      } exposing ${fmtUsd(approvalsExposureUsd)}`;
    } else if (unlimitedApprovals <= 5) {
      pts = 20;
      note = `${unlimitedApprovals} unlimited approvals exposing ${fmtUsd(
        approvalsExposureUsd
      )}`;
    } else {
      pts = 30;
      note = `${unlimitedApprovals} unlimited approvals exposing ${fmtUsd(
        approvalsExposureUsd
      )} — revoke stale ones`;
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

  // 3) Volatility cushion (stablecoin share)
  let stableSharePct = 0;
  if (snapshot.totalUsd > 0) {
    const stableUsd = snapshot.tokens
      .filter((t) => STABLES.has(t.symbol))
      .reduce((s, t) => s + t.usdValue, 0);
    stableSharePct = (stableUsd / snapshot.totalUsd) * 100;
    let pts = 0;
    let note = `Stablecoins ${stableSharePct.toFixed(0)}% of portfolio`;
    if (stableSharePct < 5) pts = 10;
    else if (stableSharePct < 15) pts = 5;
    components.push({ label: "Volatility cushion", points: pts, note });
    total += pts;
  }

  // 4) Activity signature
  const mix = snapshot.txMix;
  if (mix.total > 0) {
    const approvalShare = mix.approval / mix.total;
    const swapShare = mix.swap / mix.total;
    let pts = 0;
    let note = "Mixed on-chain activity";
    if (approvalShare > 0.4) {
      pts = 10;
      note = `Approval-heavy activity (${Math.round(approvalShare * 100)}%)`;
    } else if (swapShare > 0.6) {
      pts = 5;
      note = `Heavy swap activity (${Math.round(swapShare * 100)}%)`;
    }
    components.push({ label: "Activity signature", points: pts, note });
    total += pts;
  } else {
    components.push({
      label: "Activity signature",
      points: 3,
      note: "No recent activity detected",
    });
    total += 3;
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
