import { NextResponse } from "next/server";
import type { ActivityItem } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { sourceBucket } from "@/lib/utm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [{ data: clicks }, { data: sessions }] = await Promise.all([
    supabase
      .from("clicks")
      .select("id, is_qr, device, city, country, created_at, link_id")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("sessions")
      .select("id, device, city, country, landing_path, utm_source, utm_medium, max_scroll, last_seen_at, site_id")
      .order("last_seen_at", { ascending: false })
      .limit(15),
  ]);

  const linkIds = [...new Set((clicks ?? []).map((c) => c.link_id))];
  const { data: linksData } = linkIds.length
    ? await supabase.from("tracked_links").select("id, slug, title").in("id", linkIds)
    : { data: [] };
  const linksMap = new Map((linksData ?? []).map((l) => [l.id, l]));

  const siteIds = [...new Set((sessions ?? []).map((s) => s.site_id))];
  const { data: sitesData } = siteIds.length
    ? await supabase.from("sites").select("id, domain").in("id", siteIds)
    : { data: [] };
  const sitesMap = new Map((sitesData ?? []).map((s) => [s.id, s]));

  const place = (city: string | null, country: string | null) => [city, country].filter(Boolean).join(", ") || "Unknown location";

  const items: ActivityItem[] = [
    ...(clicks ?? []).map((c) => {
      const link = linksMap.get(c.link_id);
      return {
        id: `c_${c.id}`,
        kind: (c.is_qr ? "qr" : "click") as ActivityItem["kind"],
        title: `${c.is_qr ? "QR scan" : "Link click"} · /r/${link?.slug ?? "?"}`,
        detail: `${link?.title ?? "Untitled link"} · ${c.device} · ${place(c.city, c.country)}`,
        at: c.created_at,
      };
    }),
    ...(sessions ?? []).map((s) => {
      const site = sitesMap.get(s.site_id);
      return {
        id: `s_${s.id}`,
        kind: "session" as const,
        title: `Cursor session · ${site?.domain ?? "?"}${s.landing_path}`,
        detail: `${sourceBucket(s.utm_source, s.utm_medium)} · ${s.device} · scrolled ${s.max_scroll}% · ${place(s.city, s.country)}`,
        at: s.last_seen_at,
      };
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
