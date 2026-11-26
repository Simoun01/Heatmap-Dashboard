import { supabase } from "./supabase";
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
  const s = start.toISOString();
  const e = end.toISOString();

  const [
    { count: clicks },
    { count: qrScans },
    { count: gbpSessions },
    { count: sessions },
    { count: converted },
    { data: scrollData },
  ] = await Promise.all([
    supabase.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", s).lt("created_at", e),
    supabase.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", s).lt("created_at", e).eq("is_qr", true),
    supabase.from("sessions").select("*", { count: "exact", head: true }).gte("started_at", s).lt("started_at", e).eq("utm_source", "google").eq("utm_medium", "organic_local"),
    supabase.from("sessions").select("*", { count: "exact", head: true }).gte("started_at", s).lt("started_at", e),
    supabase.from("sessions").select("*", { count: "exact", head: true }).gte("started_at", s).lt("started_at", e).eq("converted", true),
    supabase.from("sessions").select("max_scroll").gte("started_at", s).lt("started_at", e),
  ]);

  const totalScroll = (scrollData ?? []).reduce((sum, r) => sum + (r.max_scroll ?? 0), 0);
  const sessCount = sessions ?? 0;

  return {
    clicks: clicks ?? 0,
    qrScans: qrScans ?? 0,
    gbpSessions: gbpSessions ?? 0,
    sessions: sessCount,
    conversionRate: sessCount ? (converted ?? 0) / sessCount : 0,
    avgScroll: sessCount ? totalScroll / sessCount : 0,
  };
}

export async function getKpis(days: number) {
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const prevFrom = new Date(from.getTime() - days * DAY);
  const [current, previous] = await Promise.all([
    periodStats(from, now),
    periodStats(prevFrom, from),
  ]);
  const { count: activeCampaigns } = await supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active");
  return { current, previous, activeCampaigns: activeCampaigns ?? 0 };
}

export type TrafficPoint = { date: string } & Record<SourceBucket, number>;

export async function getTrafficSeries(days: number): Promise<TrafficPoint[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * DAY);

  const { data: rows } = await supabase
    .from("sessions")
    .select("started_at, utm_source, utm_medium")
    .gte("started_at", from.toISOString());

  const byDay = new Map<string, TrafficPoint>();
  for (let i = 0; i < days; i++) {
    const date = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
    const point = { date } as TrafficPoint;
    for (const b of SOURCE_BUCKETS) point[b] = 0;
    byDay.set(date, point);
  }
  for (const r of rows ?? []) {
    const key = new Date(r.started_at).toISOString().slice(0, 10);
    const point = byDay.get(key);
    if (point) point[sourceBucket(r.utm_source, r.utm_medium)] += 1;
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
  const from = new Date(Date.now() - days * DAY).toISOString();

  let sessQuery = supabase
    .from("sessions")
    .select("utm_campaign, utm_source, utm_medium, visitor_id, pageviews, converted")
    .gte("started_at", from)
    .not("utm_campaign", "is", null);
  if (opts.source) sessQuery = sessQuery.eq("utm_source", opts.source);
  if (opts.medium) sessQuery = sessQuery.eq("utm_medium", opts.medium);
  const { data: sessRows } = await sessQuery;

  let clickQuery = supabase
    .from("clicks")
    .select("utm_campaign, utm_source, utm_medium")
    .gte("created_at", from)
    .not("utm_campaign", "is", null);
  if (opts.source) clickQuery = clickQuery.eq("utm_source", opts.source);
  if (opts.medium) clickQuery = clickQuery.eq("utm_medium", opts.medium);
  const { data: clickRows } = await clickQuery;

  const out = new Map<string, CampaignRow>();

  for (const r of sessRows ?? []) {
    const key = `${r.utm_campaign}|${r.utm_source ?? ""}|${r.utm_medium ?? ""}`;
    let row = out.get(key);
    if (!row) {
      row = { campaign: r.utm_campaign, source: r.utm_source ?? "", medium: r.utm_medium ?? "", sessions: 0, visitors: 0, bounceRate: 0, conversions: 0, conversionRate: 0, clicks: 0 };
      out.set(key, row);
    }
    row.sessions++;
    if (r.converted) row.conversions++;
    if (r.pageviews <= 1 && !r.converted) row.bounceRate++;
  }

  const visitorSets = new Map<string, Set<string>>();
  for (const r of sessRows ?? []) {
    const key = `${r.utm_campaign}|${r.utm_source ?? ""}|${r.utm_medium ?? ""}`;
    if (!visitorSets.has(key)) visitorSets.set(key, new Set());
    visitorSets.get(key)!.add(r.visitor_id);
  }

  for (const [key, row] of out) {
    row.visitors = visitorSets.get(key)?.size ?? 0;
    row.bounceRate = row.sessions ? row.bounceRate / row.sessions : 0;
    row.conversionRate = row.sessions ? row.conversions / row.sessions : 0;
  }

  for (const c of clickRows ?? []) {
    const key = `${c.utm_campaign}|${c.utm_source ?? ""}|${c.utm_medium ?? ""}`;
    let row = out.get(key);
    if (row) {
      row.clicks++;
    } else {
      row = { campaign: c.utm_campaign ?? "", source: c.utm_source ?? "", medium: c.utm_medium ?? "", sessions: 0, visitors: 0, bounceRate: 0, conversions: 0, conversionRate: 0, clicks: 1 };
      out.set(key, row);
    }
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
  const from = new Date(Date.now() - (opts.days ?? 30) * DAY).toISOString();

  let query = supabase
    .from("tracked_links")
    .select("id, slug, title, destination_url, channel, placement, utm_campaign, qr_fg, qr_bg, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.channel) query = query.eq("channel", opts.channel);
  const { data: links } = await query;
  if (!links?.length) return [];

  const ids = links.map((l) => l.id);
  const { data: clickData } = await supabase
    .from("clicks")
    .select("link_id, is_qr")
    .in("link_id", ids)
    .gte("created_at", from);

  const countMap = new Map<string, { direct: number; qr: number }>();
  for (const c of clickData ?? []) {
    const entry = countMap.get(c.link_id) ?? { direct: 0, qr: 0 };
    if (c.is_qr) entry.qr++;
    else entry.direct++;
    countMap.set(c.link_id, entry);
  }

  return links.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    destinationUrl: l.destination_url,
    channel: l.channel,
    placement: l.placement,
    utmCampaign: l.utm_campaign,
    qrFg: l.qr_fg,
    qrBg: l.qr_bg,
    createdAt: new Date(l.created_at),
    directClicks: countMap.get(l.id)?.direct ?? 0,
    qrScans: countMap.get(l.id)?.qr ?? 0,
  }));
}
