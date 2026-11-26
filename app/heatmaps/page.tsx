import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { HeatmapViewer, type HeatmapSite } from "@/components/heatmap-viewer";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Heatmaps" };
export const dynamic = "force-dynamic";

export default async function HeatmapsPage() {
  const { data: sites } = await supabase.from("sites").select("id, name, domain").order("created_at", { ascending: true });
  const { data: eventRows } = await supabase.from("events").select("site_id, path");

  const pageCounts = new Map<string, Map<string, number>>();
  for (const e of eventRows ?? []) {
    if (!pageCounts.has(e.site_id)) pageCounts.set(e.site_id, new Map());
    const paths = pageCounts.get(e.site_id)!;
    paths.set(e.path, (paths.get(e.path) ?? 0) + 1);
  }

  const data: HeatmapSite[] = (sites ?? []).map((s) => ({
    ...s,
    pages: Array.from(pageCounts.get(s.id)?.entries() ?? [])
      .map(([path, events]) => ({ path, events }))
      .sort((a, b) => b.events - a.events),
  }));

  return (
    <>
      <PageHeader title="Heatmap viewer" description="Click density, cursor movement and scroll reach, overlaid on the live page. Filter by device to compare layouts." />
      <HeatmapViewer sites={data} />
    </>
  );
}
