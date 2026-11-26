import { after, NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { geoFromHeaders, isBot, parseUserAgent } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedLink = {
  id: string;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

// Warm-instance cache: repeat hits skip the DB lookup entirely.
const cache = new Map<string, { link: CachedLink | null; exp: number }>();
const TTL = 60_000;

async function resolve(slug: string): Promise<CachedLink | null> {
  const hit = cache.get(slug);
  if (hit && hit.exp > Date.now()) return hit.link;
  const link = await prisma.trackedLink.findUnique({
    where: { slug },
    select: { id: true, destinationUrl: true, utmSource: true, utmMedium: true, utmCampaign: true },
  });
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

  // Telemetry is written after the response is sent, so the redirect isn't delayed by the insert.
  if (!isBot(ua)) {
    after(async () => {
      const { device, browser, os } = parseUserAgent(ua);
      try {
        await prisma.click.create({
          data: {
            linkId: link.id,
            isQr,
            device,
            browser,
            os,
            referrer: referrer?.slice(0, 500) ?? null,
            country: geo.country,
            city: geo.city,
            utmSource: link.utmSource,
            utmMedium: link.utmMedium,
            utmCampaign: link.utmCampaign,
          },
        });
      } catch (err) {
        console.error("click log failed", err instanceof Error ? err.message : "unknown");
      }
    });
  }

  const res = NextResponse.redirect(link.destinationUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
  return res;
}
