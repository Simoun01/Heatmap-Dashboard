import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
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
  const { data } = await supabase.from("sites").select("id").eq("id", id).maybeSingle();
  if (siteCache.size > 1000) siteCache.clear();
  siteCache.set(id, { ok: !!data, exp: Date.now() + 300_000 });
  return !!data;
}

const empty = (status: number) => new NextResponse(null, { status, headers: CORS });

export function OPTIONS() {
  return empty(204);
}

export async function POST(req: NextRequest) {
  if (isBot(req.headers.get("user-agent") ?? "")) return empty(204);

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
  const utm = (v?: string) => (v ? normalizeUtmValue(v) || null : null);

  try {
    const { data: existing } = await supabase.from("sessions").select("site_id").eq("id", b.sid).maybeSingle();
    if (existing && existing.site_id !== b.s) return empty(409);

    if (existing) {
      await supabase.from("sessions").update({
        last_seen_at: new Date().toISOString(),
        pageviews: existing ? (await supabase.from("sessions").select("pageviews").eq("id", b.sid).single()).data!.pageviews + pageviews : pageviews,
        ...(converted ? { converted: true } : {}),
      }).eq("id", b.sid);
    } else {
      const { error } = await supabase.from("sessions").insert({
        id: b.sid,
        site_id: b.s,
        visitor_id: b.v,
        landing_path: b.p,
        referrer: b.r || null,
        device: b.d,
        country: geo.country,
        city: geo.city,
        utm_source: utm(b.u?.source),
        utm_medium: utm(b.u?.medium),
        utm_campaign: utm(b.u?.campaign),
        utm_term: utm(b.u?.term),
        utm_content: utm(b.u?.content),
        pageviews,
        max_scroll: scroll,
        converted,
      });
      if (error && error.code === "23505") {
        await supabase.from("sessions").update({
          last_seen_at: new Date().toISOString(),
          ...(converted ? { converted: true } : {}),
        }).eq("id", b.sid);
      } else if (error) throw error;
    }

    if (scroll > 0) {
      const { data: cur } = await supabase.from("sessions").select("max_scroll").eq("id", b.sid).single();
      if (cur && cur.max_scroll < scroll) {
        await supabase.from("sessions").update({ max_scroll: scroll }).eq("id", b.sid);
      }
    }

    if (b.e.length) {
      await supabase.from("events").insert(
        b.e.map((e) => ({
          session_id: b.sid,
          site_id: b.s,
          type: e.t,
          path: e.p,
          x: e.x ?? null,
          y: e.y ?? null,
          vw: e.vw ?? null,
          doc_h: e.dh ?? null,
          points: e.pts ?? null,
          label: e.l ?? null,
          device: b.d,
        }))
      );
    }
  } catch (err) {
    console.error("track failed", err instanceof Error ? err.message : "unknown");
    return empty(500);
  }

  return empty(204);
}
