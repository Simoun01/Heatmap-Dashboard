import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { SOURCE_BUCKETS, sourceBucket, type SourceBucket } from "./utm";

export type RangeKey = "7d" | "30d" | "90d";
export const RANGES: RangeKey[] = ["7d", "30d", "90d"];

export function parseRange(r?: string | string[]): RangeKey {
  const v = Array.isArray(r) ? r[0] : r;
  return v === "7d" || v === "90d" ? v : "30d";
}

export function rangeDays(r: RangeKey): number {
  return r === "7d" ? 7 : r === "90d" ? 90 : 30;
}

const DAY = 86_400_000;

export interface PeriodStats {
  clicks: number;
  qrScans: number;
  gbpSessions: number;
  sessions: number;
  conversionRate: number;
  avgScroll: number;
}

async function periodStats(start: Date, end: Date): Promise<PeriodStats> {
  const range = { gte: start, lt: end };
  const [clicks, qrScans, gbpSessions, sessions, converted, scroll] = await Promise.all([
    prisma.click.count({ where: { createdAt: range } }),
    prisma.click.count({ where: { createdAt: range, isQr: true } }),
    prisma.session.count({ where: { startedAt: range, utmSource: "google", utmMedium: "organic_local" } }),
    prisma.session.count({ where: { startedAt: range } }),
    prisma.session.count({ where: { startedAt: range, converted: true } }),
    prisma.session.aggregate({ where: { startedAt: range }, _avg: { maxScroll: true } }),
  ]);
  return {
    clicks,
    qrScans,
    gbpSessions,
    sessions,
    conversionRate: sessions ? converted / sessions : 0,
    avgScroll: scroll._avg.maxScroll ?? 0,
  };
}

export async function getKpis(days: number) {
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const prevFrom = new Date(from.getTime() - days * DAY);
  const [current, previous, activeCampaigns] = await Promise.all([
    periodStats(from, now),
    periodStats(prevFrom, from),
    prisma.campaign.count({ where: { status: "active" } }),
  ]);
  return { current, previous, activeCampaigns };
}

export type TrafficPoint = { date: string } & Record<SourceBucket, number>;

export async function getTrafficSeries(days: number): Promise<TrafficPoint[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * DAY);

  const rows = await prisma.$queryRaw<{ day: Date; source: string | null; medium: string | null; n: number }[]>`
    SELECT date_trunc('day', "startedAt") AS day, "utmSource" AS source, "utmMedium" AS medium, COUNT(*)::int AS n
    FROM "Session"
    WHERE "startedAt" >= ${from}
    GROUP BY 1, 2, 3`;

  const byDay = new Map<string, TrafficPoint>();
  for (let i = 0; i < days; i++) {
    const date = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
    const point = { date } as TrafficPoint;
    for (const b of SOURCE_BUCKETS) point[b] = 0;
    byDay.set(date, point);
  }
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    const point = byDay.get(key);
    if (point) point[sourceBucket(r.source, r.medium)] += Number(r.n);
  }
  return Array.from(byDay.values());
}

export interface CampaignRow {
  campaign: string;
  source: string;
  medium: string;
  sessions: number;
  visitors: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
  clicks: number;
}

export async function getCampaignPerformance(days: number, opts: { source?: string; medium?: string } = {}): Promise<CampaignRow[]> {
  const from = new Date(Date.now() - days * DAY);
  const sourceFilter = opts.source ? Prisma.sql`AND "utmSource" = ${opts.source}` : Prisma.empty;
  const mediumFilter = opts.medium ? Prisma.sql`AND "utmMedium" = ${opts.medium}` : Prisma.empty;

  const [rows, clicks] = await Promise.all([
    prisma.$queryRaw<{ campaign: string; source: string; medium: string; sessions: number; visitors: number; bounces: number; conversions: number }[]>`
      SELECT "utmCampaign" AS campaign,
             COALESCE("utmSource", '') AS source,
             COALESCE("utmMedium", '') AS medium,
             COUNT(*)::int AS sessions,
             COUNT(DISTINCT "visitorId")::int AS visitors,
             SUM(CASE WHEN "pageviews" <= 1 AND NOT "converted" THEN 1 ELSE 0 END)::int AS bounces,
             SUM(CASE WHEN "converted" THEN 1 ELSE 0 END)::int AS conversions
      FROM "Session"
      WHERE "startedAt" >= ${from} AND "utmCampaign" IS NOT NULL ${sourceFilter} ${mediumFilter}
      GROUP BY 1, 2, 3
      ORDER BY sessions DESC
      LIMIT 200`,
    prisma.click.groupBy({
      by: ["utmCampaign", "utmSource", "utmMedium"],
      where: {
        createdAt: { gte: from },
        utmCampaign: { not: null },
        ...(opts.source ? { utmSource: opts.source } : {}),
        ...(opts.medium ? { utmMedium: opts.medium } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const out = new Map<string, CampaignRow>();
  for (const r of rows) {
    const sessions = Number(r.sessions);
    out.set(`${r.campaign}|${r.source}|${r.medium}`, {
      campaign: r.campaign,
      source: r.source,
      medium: r.medium,
      sessions,
      visitors: Number(r.visitors),
      bounceRate: sessions ? Number(r.bounces) / sessions : 0,
      conversions: Number(r.conversions),
      conversionRate: sessions ? Number(r.conversions) / sessions : 0,
      clicks: 0,
    });
  }
  for (const c of clicks) {
    const key = `${c.utmCampaign}|${c.utmSource ?? ""}|${c.utmMedium ?? ""}`;
    const row = out.get(key);
    if (row) row.clicks = c._count._all;
    else
      out.set(key, {
        campaign: c.utmCampaign ?? "",
        source: c.utmSource ?? "",
        medium: c.utmMedium ?? "",
        sessions: 0,
        visitors: 0,
        bounceRate: 0,
        conversions: 0,
        conversionRate: 0,
        clicks: c._count._all,
      });
  }
  return Array.from(out.values()).sort((a, b) => b.sessions + b.clicks - (a.sessions + a.clicks));
}

export interface LinkRow {
  id: string;
  slug: string;
  title: string | null;
  destinationUrl: string;
  channel: string;
  placement: string | null;
  utmCampaign: string | null;
  qrFg: string;
  qrBg: string;
  createdAt: Date;
  directClicks: number;
  qrScans: number;
}

export async function getLinks(opts: { channel?: string; days?: number } = {}): Promise<LinkRow[]> {
  const from = new Date(Date.now() - (opts.days ?? 30) * DAY);
  const links = await prisma.trackedLink.findMany({
    where: opts.channel ? { channel: opts.channel } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, slug: true, title: true, destinationUrl: true, channel: true, placement: true, utmCampaign: true, qrFg: true, qrBg: true, createdAt: true },
  });
  if (links.length === 0) return [];
  const counts = await prisma.click.groupBy({
    by: ["linkId", "isQr"],
    where: { linkId: { in: links.map((l) => l.id) }, createdAt: { gte: from } },
    _count: { _all: true },
  });
  return links.map((l) => ({
    ...l,
    directClicks: counts.find((c) => c.linkId === l.id && !c.isQr)?._count._all ?? 0,
    qrScans: counts.find((c) => c.linkId === l.id && c.isQr)?._count._all ?? 0,
  }));
}
