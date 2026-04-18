import { NextRequest, NextResponse } from "next/server";
import { fetchWalletSnapshot } from "@/lib/goldrush";
import { compareWallets } from "@/lib/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { addressA, addressB, chain } = await req.json();

    if (
      !addressA ||
      !addressB ||
      typeof addressA !== "string" ||
      typeof addressB !== "string"
    ) {
      return NextResponse.json(
        { error: "addressA and addressB are required" },
        { status: 400 }
      );
    }

    const a = addressA.trim();
    const b = addressB.trim();

    if (a.toLowerCase() === b.toLowerCase()) {
      return NextResponse.json(
        { error: "The two addresses must be different" },
        { status: 400 }
      );
    }

    const chainId = chain ?? "solana-mainnet";
    const [snapA, snapB] = await Promise.all([
      fetchWalletSnapshot(a, chainId),
      fetchWalletSnapshot(b, chainId),
    ]);

    const result = compareWallets(
      { address: a, snapshot: snapA },
      { address: b, snapshot: snapB }
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("compare error:", err);
    const msg = err instanceof Error ? err.message : "comparison failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
