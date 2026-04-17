import OpenAI from "openai";
import type { WalletSnapshot } from "./goldrush";

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
  concentration: string;
  insights: string[];
  risks: string[];
  suggestions: string[];
};

export async function analyzeWallet(snapshot: WalletSnapshot): Promise<Analysis> {
  const topTokens = snapshot.tokens.slice(0, 10).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    usdValue: Math.round(t.usdValue),
    pctOfPortfolio:
      snapshot.totalUsd > 0
        ? Math.round((t.usdValue / snapshot.totalUsd) * 1000) / 10
        : 0,
  }));

  const recentActivity = snapshot.recentTxs.slice(0, 10).map((t) => ({
    time: t.timestamp,
    valueUsd: Math.round(t.valueUsd ?? 0),
    successful: t.successful,
  }));

  const prompt = `You are a crypto portfolio analyst. Analyze this wallet and return ONLY valid JSON.

Wallet: ${snapshot.address}
Chain: ${snapshot.chain}
Total USD Value: $${Math.round(snapshot.totalUsd).toLocaleString()}
Token Count: ${snapshot.tokens.length}
Recent Transactions: ${snapshot.txCount}

Top Holdings:
${JSON.stringify(topTokens, null, 2)}

Recent Activity (last 10):
${JSON.stringify(recentActivity, null, 2)}

Return JSON with this exact shape:
{
  "summary": "2-3 sentences in plain English about this wallet's profile",
  "riskScore": 0-100 number (higher = riskier),
  "concentration": "one line on portfolio concentration (e.g. 'Heavily concentrated in X')",
  "insights": ["3-5 specific observations"],
  "risks": ["2-4 concrete risks"],
  "suggestions": ["2-4 actionable suggestions"]
}`;

  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a sharp crypto portfolio analyst. Always return valid JSON. Be specific and insightful, not generic.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  return {
    summary: parsed.summary ?? "",
    riskScore: Number(parsed.riskScore ?? 0),
    concentration: parsed.concentration ?? "",
    insights: parsed.insights ?? [],
    risks: parsed.risks ?? [],
    suggestions: parsed.suggestions ?? [],
  };
}
