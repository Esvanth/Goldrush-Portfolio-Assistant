import { NextRequest, NextResponse } from "next/server";
import { fetchWalletSnapshot } from "@/lib/goldrush";
import { analyzeWallet } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { address, chain } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "address required" },
        { status: 400 }
      );
    }

    const snapshot = await fetchWalletSnapshot(
      address.trim(),
      chain ?? "solana-mainnet"
    );

    if (snapshot.totalUsd === 0 && snapshot.tokens.length === 0) {
      return NextResponse.json({
        snapshot,
        analysis: {
          summary: "This wallet appears empty or has no recognized tokens on this chain.",
          riskScore: 0,
          concentration: "No holdings detected",
          insights: [],
          risks: [],
          suggestions: ["Try a different chain or verify the address"],
        },
      });
    }

    const analysis = await analyzeWallet(snapshot);

    return NextResponse.json({ snapshot, analysis });
  } catch (err: any) {
    console.error("analyze error:", err);
    return NextResponse.json(
      { error: err?.message ?? "analysis failed" },
      { status: 500 }
    );
  }
}
