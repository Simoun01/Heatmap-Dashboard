import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { HeatmapData } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { DEMO_SITE_ID } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  siteId: z.string().min(1).max(64),
  path: z.string().min(1).max(500),
  device: z.enum(["all", "desktop", "mobile", "tablet"]).default("desktop"),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { siteId, path, device, days } = parsed.data;

  const { data: site } = await supabase.from("sites").select("domain").eq("id", siteId).maybeSingle();
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let clickQ = supabase
    .from("events")
    .select("x, y, type, vw, doc_h")
    .eq("site_id", siteId)
    .eq("path", path)
    .in("type", ["click", "rage"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8000);
  if (device !== "all") clickQ = clickQ.eq("device", device);

  let moveQ = supabase
    .from("events")
    .select("points")
    .eq("site_id", siteId)
    .eq("path", path)
    .eq("type", "move")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (device !== "all") moveQ = moveQ.eq("device", device);

  let scrollQ = supabase
    .from("events")
    .select("session_id, y")
    .eq("site_id", siteId)
    .eq("path", path)
    .eq("type", "scroll")
    .gte("created_at", since);
  if (device !== "all") scrollQ = scrollQ.eq("device", device);

  let pvQ = supabase
    .from("events")
    .select("session_id")
    .eq("site_id", siteId)
    .eq("path", path)
    .eq("type", "pageview")
    .gte("created_at", since);
  if (device !== "all") pvQ = pvQ.eq("device", device);

  const [{ data: clickRows }, { data: moveRows }, { data: scrollRows }, { data: pvRows }] = await Promise.all([clickQ, moveQ, scrollQ, pvQ]);

  const scrollBySession = new Map<string, number>();
  for (const r of scrollRows ?? []) {
    const cur = scrollBySession.get(r.session_id) ?? 0;
    if ((r.y ?? 0) > cur) scrollBySession.set(r.session_id, r.y ?? 0);
  }

  const sessionSet = new Set((pvRows ?? []).map((r) => r.session_id));

  const data: HeatmapData = {
    pageUrl: siteId === DEMO_SITE_ID ? path : `${/^(localhost|127\.0\.0\.1)(:|$)/.test(site.domain) ? "http" : "https"}://${site.domain}${path}`,
    vw: median((clickRows ?? []).map((r) => r.vw ?? 0).filter(Boolean), device === "mobile" ? 390 : device === "tablet" ? 820 : 1440),
    docH: median((clickRows ?? []).map((r) => r.doc_h ?? 0).filter(Boolean), device === "mobile" ? 3200 : 2600),
    clicks: (clickRows ?? []).filter((r) => r.x != null && r.y != null).map((r) => [r.x as number, r.y as number, r.type === "rage" ? 1 : 0]),
    trails: (moveRows ?? [])
      .map((r) => (Array.isArray(r.points) ? (r.points as unknown[]) : []))
      .map((pts) =>
        pts
          .filter((p): p is number[] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
          .map((p) => [p[0], p[1]] as [number, number]),
      )
      .filter((t) => t.length > 1),
    scrollDepths: Array.from(scrollBySession.values()).map((v) => Math.round(v * 100)),
    sessions: sessionSet.size,
  };
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
}
