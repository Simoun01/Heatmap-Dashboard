import { NextResponse } from "next/server";
import { supabase, supabaseUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let network: string;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, { cache: "no-store" });
    network = `reachable (HTTP ${res.status})`;
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    network = `failed: ${err.message} ${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`.trim();
  }
  const { error } = await supabase.from("tracked_links").select("id", { head: true, count: "exact" });
  return NextResponse.json({
    rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    urlUsed: supabaseUrl,
    keySet: rawKey.length > 0,
    keyPrefix: rawKey.trim().slice(0, 10),
    keyLength: rawKey.length,
    network,
    query: error ? `error: ${error.message}` : "ok",
  });
}
