import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { HeatmapViewer, type HeatmapSite } from "@/components/heatmap-viewer";
import { prisma } from "@/lib/prisma";
import { demoHeatmapSites, isDemoMode } from "@/lib/demo";

export const metadata: Metadata = { title: "Heatmaps" };
export const dynamic = "force-dynamic";

export default async function HeatmapsPage() {
  let data: HeatmapSite[];
  if (isDemoMode()) {
    data = demoHeatmapSites();
  } else {
    const [sites, pages] = await Promise.all([
      prisma.site.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, domain: true } }),
      prisma.event.groupBy({ by: ["siteId", "path"], _count: { _all: true }, orderBy: { _count: { id: "desc" } }, take: 500 }),
    ]);
    data = sites.map((s) => ({
      ...s,
      pages: pages.filter((p) => p.siteId === s.id).map((p) => ({ path: p.path, events: p._count._all })),
    }));
  }

  return (
    <>
      <PageHeader title="Heatmap viewer" description="Click density, cursor movement and scroll reach, overlaid on the live page. Filter by device to compare layouts." />
      <HeatmapViewer sites={data} />
    </>
  );
}
