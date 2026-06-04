import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") || "";
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  const db = getSupabaseClient();

  const [vendorStats, rateStats] = await Promise.all([
    db.from("vendors_db")
      .select("quality_score", { count: "exact" })
      .eq("city", city),
    db.from("rates")
      .select("last_verified_at", { count: "exact" }),
  ]);

  const vendors = vendorStats.data ?? [];
  const total = vendors.length;
  const highQuality = vendors.filter((v: { quality_score: number }) => v.quality_score >= 2).length;
  const withCoords = vendors.filter((v: { quality_score: number }) => v.quality_score >= 1).length;

  const totalRates = rateStats.count ?? 0;
  const verifiedRates = (rateStats.data ?? []).filter(
    (r: { last_verified_at: string | null }) => r.last_verified_at !== null
  ).length;

  return NextResponse.json({
    city,
    vendors: { total, highQuality, withCoords, unverified: total - highQuality },
    rates: { total: totalRates, verified: verifiedRates },
    ready: highQuality >= 15, // good enough for pincode filtering
  });
}
