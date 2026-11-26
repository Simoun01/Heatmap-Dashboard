import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { geoFromHeaders, isBot } from "@/lib/device";
import { normalizeUtmValue } from "@/lib/utm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const unit = z.number().min(0).max(1);
const str = (max: number) => z.string().max(max);

const eventSchema = z.object({
  t: z.enum(["pageview", "click", "rage", "move", "scroll", "conversion"]),
  p: str(500),
  x: unit.optional(),
  y: unit.optional(),
  vw: z.number().int().min(0).max(10000).optional(),
  dh: z.number().int().min(0).max(200000).optional(),
  pts: z.array(z.tuple([unit, unit, z.number().int().min(0)])).max(600).optional(),
  l: str(200).optional(),
});

const payloadSchema = z.object({
  s: str(64),
  v: str(64),
  sid: str(64),
  p: str(500),
  r: str(1000).optional(),
  d: z.enum(["desktop", "mobile", "tablet"]),
  sc: z.number().int().min(0).max(100).optional(),
  u: z
    .object({ source: str(120), medium: str(120), campaign: str(160), term: str(160), content: str(160) })
    .partial()
    .optional(),
  e: z.array(eventSchema).max(200),
});

const siteCache = new Map<string, { ok: boolean; exp: number }>();
async function siteExists(id: string): Promise<boolean> {
  const hit = siteCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.ok;
  const site = await prisma.site.findUnique({ where: { id }, select: { id: true } });
  if (siteCache.size > 1000) siteCache.clear();
  siteCache.set(id, { ok: !!site, exp: Date.now() + 300_000 });
  return !!site;
}

const empty = (status: number) => new NextResponse(null, { status, headers: CORS });

export function OPTIONS() {
  return empty(204);
}

export async function POST(req: NextRequest) {
  if (isBot(req.headers.get("user-agent") ?? "")) return empty(204);

  // sendBeacon posts text/plain to avoid a CORS preflight; parse the JSON ourselves.
  const raw = await req.text();
  if (raw.length > 256_000) return empty(413);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return empty(400);
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return empty(400);
  const b = parsed.data;

  if (!(await siteExists(b.s))) return empty(404);

  const geo = geoFromHeaders(req.headers);
  const pageviews = b.e.filter((e) => e.t === "pageview").length;
  const converted = b.e.some((e) => e.t === "conversion");
  const scroll = b.sc ?? 0;
  // Governance: "Google" and "google " land in the same bucket as "google".
  const utm = (v?: string) => (v ? normalizeUtmValue(v) || null : null);

  const createData: Prisma.SessionUncheckedCreateInput = {
    id: b.sid,
    siteId: b.s,
    visitorId: b.v,
    landingPath: b.p,
    referrer: b.r || null,
    device: b.d,
    country: geo.country,
    city: geo.city,
    utmSource: utm(b.u?.source),
    utmMedium: utm(b.u?.medium),
    utmCampaign: utm(b.u?.campaign),
    utmTerm: utm(b.u?.term),
    utmContent: utm(b.u?.content),
    pageviews,
    maxScroll: scroll,
    converted,
  };
  const updateData: Prisma.SessionUpdateInput = {
    lastSeenAt: new Date(),
    pageviews: { increment: pageviews },
    ...(converted ? { converted: true } : {}),
  };

  try {
    const existing = await prisma.session.findUnique({ where: { id: b.sid }, select: { siteId: true } });
    if (existing && existing.siteId !== b.s) return empty(409);
    try {
      await prisma.session.upsert({ where: { id: b.sid }, create: createData, update: updateData });
    } catch (err) {
      // Two beacons for a brand-new session can race; the loser just updates.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        await prisma.session.update({ where: { id: b.sid }, data: updateData });
      } else throw err;
    }
    if (scroll > 0) {
      await prisma.session.updateMany({ where: { id: b.sid, maxScroll: { lt: scroll } }, data: { maxScroll: scroll } });
    }
    if (b.e.length) {
      await prisma.event.createMany({
        data: b.e.map((e) => ({
          sessionId: b.sid,
          siteId: b.s,
          type: e.t,
          path: e.p,
          x: e.x ?? null,
          y: e.y ?? null,
          vw: e.vw ?? null,
          docH: e.dh ?? null,
          points: e.pts ? (e.pts as Prisma.InputJsonValue) : Prisma.JsonNull,
          label: e.l ?? null,
          device: b.d,
        })),
      });
    }
  } catch (err) {
    console.error("track failed", err instanceof Error ? err.message : "unknown");
    return empty(500);
  }

  return empty(204);
}
