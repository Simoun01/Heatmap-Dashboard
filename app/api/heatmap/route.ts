import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { HeatmapData } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { DEMO_SITE_ID, demoHeatmapData, isDemoMode } from "@/lib/demo";

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

  if (isDemoMode()) {
    return NextResponse.json(demoHeatmapData(path, device), { headers: { "Cache-Control": "private, max-age=30" } });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { domain: true } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const where = {
    siteId,
    path,
    createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
    ...(device === "all" ? {} : { device }),
  };

  const [clickRows, moveRows, scrollRows, sessionGroups] = await Promise.all([
    prisma.event.findMany({ where: { ...where, type: { in: ["click", "rage"] } }, select: { x: true, y: true, type: true, vw: true, docH: true }, take: 8000, orderBy: { createdAt: "desc" } }),
    prisma.event.findMany({ where: { ...where, type: "move" }, select: { points: true }, take: 300, orderBy: { createdAt: "desc" } }),
    prisma.event.groupBy({ by: ["sessionId"], where: { ...where, type: "scroll" }, _max: { y: true } }),
    prisma.event.groupBy({ by: ["sessionId"], where: { ...where, type: "pageview" } }),
  ]);

  const data: HeatmapData = {
    pageUrl: siteId === DEMO_SITE_ID ? path : `${/^(localhost|127\.0\.0\.1)(:|$)/.test(site.domain) ? "http" : "https"}://${site.domain}${path}`,
    vw: median(clickRows.map((r) => r.vw ?? 0).filter(Boolean), device === "mobile" ? 390 : device === "tablet" ? 820 : 1440),
    docH: median(clickRows.map((r) => r.docH ?? 0).filter(Boolean), device === "mobile" ? 3200 : 2600),
    clicks: clickRows.filter((r) => r.x != null && r.y != null).map((r) => [r.x as number, r.y as number, r.type === "rage" ? 1 : 0]),
    trails: moveRows
      .map((r) => (Array.isArray(r.points) ? (r.points as unknown[]) : []))
      .map((pts) =>
        pts
          .filter((p): p is number[] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
          .map((p) => [p[0], p[1]] as [number, number]),
      )
      .filter((t) => t.length > 1),
    // one value per session: the deepest point that session reached on this page
    scrollDepths: scrollRows.map((r) => Math.round((r._max.y ?? 0) * 100)),
    sessions: sessionGroups.length,
  };
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
}
