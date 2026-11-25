import { NextResponse } from "next/server";
import type { ActivityItem } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { sourceBucket } from "@/lib/utm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET() {
  const [clicks, sessions] = await Promise.all([
    prisma.click.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, isQr: true, device: true, city: true, country: true, createdAt: true, link: { select: { slug: true, title: true } } },
    }),
    prisma.session.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 15,
      select: { id: true, device: true, city: true, country: true, landingPath: true, utmSource: true, utmMedium: true, maxScroll: true, lastSeenAt: true, site: { select: { domain: true } } },
    }),
  ]);

  const place = (city: string | null, country: string | null) => [city, country].filter(Boolean).join(", ") || "Unknown location";

  const items: ActivityItem[] = [
    ...clicks.map((c) => ({
      id: `c_${c.id}`,
      kind: (c.isQr ? "qr" : "click") as ActivityItem["kind"],
      title: `${c.isQr ? "QR scan" : "Link click"} · /r/${c.link.slug}`,
      detail: `${c.link.title ?? "Untitled link"} · ${c.device} · ${place(c.city, c.country)}`,
      at: c.createdAt.toISOString(),
    })),
    ...sessions.map((s) => ({
      id: `s_${s.id}`,
      kind: "session" as const,
      title: `Cursor session · ${s.site.domain}${s.landingPath}`,
      detail: `${sourceBucket(s.utmSource, s.utmMedium)} · ${s.device} · scrolled ${s.maxScroll}% · ${place(s.city, s.country)}`,
      at: s.lastSeenAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
