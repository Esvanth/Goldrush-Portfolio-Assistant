import OpenAI from "openai";
import type { WalletSnapshot } from "./goldrush";
import { computeRisk, type RiskBreakdown } from "./risk";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export type Analysis = {
  summary: string;
  riskScore: number;
  riskSeverity: RiskBreakdown["severity"];
  riskBreakdown: RiskBreakdown;
  concentration: string;
  insights: string[];
  risks: string[];
  suggestions: string[];
};

export async function analyzeWallet(snapshot: WalletSnapshot): Promise<Analysis> {
  const risk = computeRisk(snapshot);

  const topTokens = snapshot.tokens.slice(0, 10).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    usdValue: Math.round(t.usdValue),
    pctOfPortfolio:
      snapshot.totalUsd > 0
        ? Math.round((t.usdValue / snapshot.totalUsd) * 1000) / 10
        : 0,
  }));

  const topApprovals = snapshot.approvals.slice(0, 10).map((a) => ({
    token: a.token,
    spender: a.spenderLabel || a.spender,
    unlimited: a.isUnlimited,
    exposedUsd: Math.round(a.valueAtRiskUsd),
    riskFactor: a.riskFactor,
  }));

  const mix = snapshot.txMix;
  const mixPct =
    mix.total > 0
      ? {
          swap: Math.round((mix.swap / mix.total) * 100),
          stablecoin: Math.round((mix.stablecoin / mix.total) * 100),
          approval: Math.round((mix.approval / mix.total) * 100),
          bridge: Math.round((mix.bridge / mix.total) * 100),
          transfer: Math.round((mix.transfer / mix.total) * 100),
          other: Math.round((mix.other / mix.total) * 100),
        }
      : null;

  const prompt = `You are a crypto portfolio analyst. Return ONLY valid JSON.

You are given a wallet snapshot from GoldRush (balances, classified recent transactions, and token approvals). A deterministic risk score has already been computed from these signals — you do NOT produce the risk score. You produce the narrative.

CHAIN: ${snapshot.chain}
ADDRESS: ${snapshot.address}
PORTFOLIO VALUE: $${Math.round(snapshot.totalUsd).toLocaleString()}
TOKENS HELD: ${snapshot.tokens.length}
TX COUNT (recent page): ${snapshot.txCount}

TOP HOLDINGS (up to 10):
${JSON.stringify(topTokens, null, 2)}

RECENT TRANSACTION MIX (classified from GoldRush log_events, % of last ${mix.total}):
${mixPct ? JSON.stringify(mixPct, null, 2) : "null"}

OUTSTANDING APPROVALS (EVM, from GoldRush SecurityService):
${snapshot.isEvm ? JSON.stringify(topApprovals, null, 2) : "not applicable on this chain"}

COMPUTED RISK SIGNALS (already scored, use these in your narrative):
- severity: ${risk.severity} (${risk.total}/100)
- top concentration: ${risk.topConcentrationPct.toFixed(1)}%
- stablecoin share: ${risk.stableSharePct.toFixed(1)}%
- unlimited approvals: ${risk.unlimitedApprovals}
- approvals exposure: $${Math.round(risk.approvalsExposureUsd).toLocaleString()}
- components: ${JSON.stringify(risk.components)}

Return JSON with this exact shape:
{
  "summary": "2-3 sentences in plain English about this wallet's profile — reference the actual tx mix and approvals when they're meaningful",
  "concentration": "one line on portfolio concentration, referencing the top token share",
  "insights": ["3-5 specific observations grounded in the snapshot"],
  "risks": ["2-4 concrete risks — cite unlimited approvals if any, and name specific risky spenders"],
  "suggestions": ["2-4 actionable suggestions — if unlimited approvals exist, mention revoking them"]
}`;

  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a sharp crypto portfolio analyst. Ground every claim in the provided snapshot. Be specific, cite numbers, and avoid generic advice. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  return {
    summary: parsed.summary ?? "",
    riskScore: risk.total,
    riskSeverity: risk.severity,
    riskBreakdown: risk,
    concentration: parsed.concentration ?? "",
    insights: parsed.insights ?? [],
    risks: parsed.risks ?? [],
    suggestions: parsed.suggestions ?? [],
  };
}
