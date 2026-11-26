import { after, NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { geoFromHeaders, isBot, parseUserAgent } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedLink = {
  id: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

const cache = new Map<string, { link: CachedLink | null; exp: number }>();
const TTL = 60_000;

async function resolve(slug: string): Promise<CachedLink | null> {
  const hit = cache.get(slug);
  if (hit && hit.exp > Date.now()) return hit.link;
  const { data: link } = await supabase
    .from("tracked_links")
    .select("id, destination_url, utm_source, utm_medium, utm_campaign")
    .eq("slug", slug)
    .maybeSingle();
  if (cache.size > 5000) cache.clear();
  cache.set(slug, { link, exp: Date.now() + TTL });
  return link;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{1,64}$/i.test(slug)) return NextResponse.redirect(new URL("/", req.url), 302);

  const link = await resolve(slug);
  if (!link) return NextResponse.redirect(new URL(`/links?missing=${encodeURIComponent(slug)}`, req.url), 302);

  const ua = req.headers.get("user-agent") ?? "";
  const isQr = req.nextUrl.searchParams.get("src") === "qr";
  const referrer = req.headers.get("referer");
  const geo = geoFromHeaders(req.headers);

  if (!isBot(ua)) {
    after(async () => {
      const { device, browser, os } = parseUserAgent(ua);
      try {
        await supabase.from("clicks").insert({
          link_id: link.id,
          is_qr: isQr,
          device,
          browser,
          os,
          referrer: referrer?.slice(0, 500) ?? null,
          country: geo.country,
          city: geo.city,
          utm_source: link.utm_source,
          utm_medium: link.utm_medium,
          utm_campaign: link.utm_campaign,
        });
      } catch (err) {
        console.error("click log failed", err instanceof Error ? err.message : "unknown");
      }
    });
  }

  const res = NextResponse.redirect(link.destination_url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
  return res;
}
