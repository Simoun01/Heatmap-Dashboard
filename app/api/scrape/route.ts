import { NextResponse, type NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { ScrapedLink, ScrapeResult } from "@/lib/types";
import { safeFetch } from "@/lib/ssrf";
import { extractUtm } from "@/lib/utm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const bodySchema = z.object({ url: z.string().min(4).max(2048) });
const MAX_BYTES = 3_000_000;



function abs(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a JSON body like { \"url\": \"https://example.com\" }." }, { status: 400 });

  let input = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const { res, finalUrl } = await safeFetch(input, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UTMHeatmapBot/1.0; +https://github.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      return NextResponse.json({ error: `That URL returned ${type || "a non-HTML response"}, not a web page.` }, { status: 422 });
    }
    const buf = await res.arrayBuffer();
    const html = new TextDecoder().decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    const $ = cheerio.load(html);

    const meta = (sel: string) => $(sel).attr("content")?.trim() || null;
    const base = finalUrl;
    const host = new URL(finalUrl).hostname.replace(/^www\./, "");

    const headings: ScrapeResult["headings"] = [];
    $("h1, h2, h3").each((_, el) => {
      if (headings.length >= 60) return;
      const tag = String($(el).prop("tagName") ?? "h3").toLowerCase();
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) headings.push({ level: Number(tag.slice(1)) || 3, text: text.slice(0, 160) });
    });

    const seen = new Set<string>();
    const internalLinks: ScrapedLink[] = [];
    const outboundLinks: ScrapedLink[] = [];
    $("a[href]").each((_, el) => {
      const href = abs($(el).attr("href"), base);
      if (!href || !/^https?:/i.test(href) || seen.has(href)) return;
      seen.add(href);
      const text = ($(el).text() || $(el).attr("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const link = { href, text, hasUtm: Object.keys(extractUtm(href)).length > 0 };
      const linkHost = new URL(href).hostname.replace(/^www\./, "");
      (linkHost === host ? internalLinks : outboundLinks).push(link);
    });

    const favicon =
      abs($('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || $('link[rel="apple-touch-icon"]').attr("href"), base) ??
      abs("/favicon.ico", base);

    const result: ScrapeResult = {
      requestedUrl: input,
      finalUrl,
      status: res.status,
      title: $("title").first().text().trim() || meta('meta[property="og:title"]') || host,
      description: meta('meta[name="description"]') ?? meta('meta[property="og:description"]') ?? "",
      ogTitle: meta('meta[property="og:title"]'),
      ogImage: abs(meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]') ?? undefined, base),
      canonical: abs($('link[rel="canonical"]').attr("href"), base),
      favicon,
      utm: extractUtm(input),
      headings,
      internalLinks: internalLinks.slice(0, 150),
      outboundLinks: outboundLinks.slice(0, 150),
      stats: {
        internal: internalLinks.length,
        outbound: outboundLinks.length,
        withUtm: [...internalLinks, ...outboundLinks].filter((l) => l.hasUtm).length,
        images: $("img").length,
        words: $("body").text().split(/\s+/).filter(Boolean).length,
      },
    };
    return NextResponse.json(result);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const message = aborted ? "The site took too long to respond." : err instanceof Error ? err.message : "Couldn't fetch that page.";
    const safe = /private hosts|valid url|http and https|credentials|redirects|too long/i.test(message) ? message : "Couldn't fetch that page. Check the URL and try again.";
    return NextResponse.json({ error: safe }, { status: 422 });
  } finally {
    clearTimeout(timer);
  }
}
