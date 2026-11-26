"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, Globe, Loader2, ScanSearch, Tag } from "lucide-react";
import type { ScrapedLink, ScrapeResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkBuilder } from "@/components/link-builder";
import { SnippetBox } from "@/components/snippet-box";
import { createSite, saveRecord } from "@/app/actions";

function LinkList({ links, empty }: { links: ScrapedLink[]; empty: string }) {
  if (!links.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-80 divide-y overflow-y-auto text-sm">
      {links.map((l) => (
        <li key={l.href} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate">{l.text || <span className="text-muted-foreground">(no anchor text)</span>}</p>
            <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="block truncate font-mono text-xs text-muted-foreground hover:underline">
              {l.href}
            </a>
          </div>
          {l.hasUtm && (
            <Badge variant="secondary">
              <Tag className="h-3 w-3" aria-hidden /> UTM
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Analyzer({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<{ id: string; domain: string } | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const scrape = useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSite(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target.trim() }) });
      const json = (await res.json()) as ScrapeResult | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "Scrape failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUrl) scrape(initialUrl);
  }, [initialUrl, scrape]);

  const host = data ? new URL(data.finalUrl).hostname : "";

  return (
    <div className="space-y-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          scrape(url);
        }}
      >
        <label htmlFor="analyze-url" className="sr-only">
          URL to analyze
        </label>
        <Input id="analyze-url" inputMode="url" placeholder="https://example.com/page?utm_source=..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <ScanSearch aria-hidden />}
          {loading ? "Scanning…" : "Scan"}
        </Button>
      </form>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={() => scrape(url)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="grid gap-6 lg:grid-cols-5" aria-busy="true">
          <div className="h-80 animate-pulse rounded-lg bg-muted lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-lg bg-muted lg:col-span-3" />
        </div>
      )}

      {!data && !loading && !error && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Paste a URL above. The scanner reads its title, meta description, Open Graph image, canonical, favicon, any UTM parameters, every link on the page and its heading outline.
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="overflow-hidden lg:col-span-2">
            {data.ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.ogImage} alt="" className="aspect-[1.91/1] w-full border-b bg-muted object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex aspect-[1.91/1] w-full items-center justify-center border-b bg-muted text-sm text-muted-foreground">No Open Graph image</div>
            )}
            <CardHeader>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {data.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.favicon} alt="" className="h-4 w-4" referrerPolicy="no-referrer" />
                ) : (
                  <Globe className="h-4 w-4" aria-hidden />
                )}
                <span className="truncate">{host}</span>
                <Badge variant="outline">HTTP {data.status}</Badge>
              </div>
              <CardTitle className="leading-snug">{data.title}</CardTitle>
              <CardDescription>{data.description || "No meta description."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Final URL</dt>
                <dd className="break-all font-mono text-xs">{data.finalUrl}</dd>
                <dt className="text-muted-foreground">Canonical</dt>
                <dd className="break-all font-mono text-xs">{data.canonical ?? "Not set"}</dd>
                <dt className="text-muted-foreground">Existing UTMs</dt>
                <dd className="flex flex-wrap gap-1">
                  {Object.keys(data.utm).length ? (
                    Object.entries(data.utm).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="font-mono">
                        {k}={v}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </dl>
              <div className="grid grid-cols-4 gap-2 border-t pt-4 text-center">
                {[
                  ["Internal", data.stats.internal],
                  ["Outbound", data.stats.outbound],
                  ["Tagged", data.stats.withUtm],
                  ["Words", data.stats.words],
                ].map(([label, n]) => (
                  <div key={label}>
                    <p className="text-lg font-semibold tabular-nums">{n}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <a href={data.finalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Open page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || saveMsg?.ok === true}
                  onClick={() =>
                    startSave(async () => {
                      const r = await saveRecord({
                        title: (data.title || host).slice(0, 200),
                        type: "analysis",
                        data: {
                          "Scanned URL": url.trim(),
                          "Final URL": data.finalUrl,
                          "HTTP status": data.status,
                          Title: data.title,
                          Description: data.description || "None",
                          Canonical: data.canonical ?? "Not set",
                          "Existing UTMs": Object.entries(data.utm).map(([k, v]) => `${k}=${v}`).join(", ") || "None",
                          "Internal links": data.stats.internal,
                          "Outbound links": data.stats.outbound,
                          "Tagged links": data.stats.withUtm,
                          Words: data.stats.words,
                          H1: data.headings.find((h) => h.level === 1)?.text ?? "None",
                        },
                      });
                      setSaveMsg(r.ok ? { ok: true, text: "Saved to Records" } : { ok: false, text: r.error });
                    })
                  }
                >
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardList aria-hidden />}
                  {saving ? "Saving…" : saveMsg?.ok ? "Saved" : "Save to Records"}
                </Button>
              </div>
              {saveMsg && (
                <p className={saveMsg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                  {saveMsg.ok ? (
                    <>
                      Saved. <Link href="/records" className="font-medium text-primary hover:underline">View in Records</Link>
                    </>
                  ) : (
                    saveMsg.text
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Generate trackable link, QR & heatmap wrapper</CardTitle>
                <CardDescription>Short links and QR codes work on any URL. Heatmaps need the tracker snippet on a site you control.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="link">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="link" className="flex-1 sm:flex-none">
                      Link + QR
                    </TabsTrigger>
                    <TabsTrigger value="heatmap" className="flex-1 sm:flex-none">
                      Heatmap snippet
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="link">
                    <LinkBuilder idPrefix="an" defaultBaseUrl={data.canonical ?? data.finalUrl.split("?")[0]} defaultTitle={data.title.slice(0, 120)} />
                  </TabsContent>
                  <TabsContent value="heatmap" className="space-y-4">
                    {site ? (
                      <>
                        <p className="text-sm">
                          <strong>{site.domain}</strong> is registered. Add this line to every page you want heatmaps for:
                        </p>
                        <SnippetBox siteId={site.id} />
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Register <strong className="text-foreground">{host}</strong> as a tracked site to get its one-line snippet. Clicks, cursor trails, scroll depth, rage clicks and UTMs will start
                          flowing in as soon as it&apos;s installed.
                        </p>
                        {siteError && <p className="text-sm text-destructive">{siteError}</p>}
                        <Button
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const r = await createSite({ name: data.title.slice(0, 80) || host, domain: host });
                              if (r.ok) setSite(r.data);
                              else setSiteError(r.error);
                            })
                          }
                        >
                          {pending ? "Registering…" : `Track ${host}`}
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Page structure & links</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="headings">
                  <TabsList>
                    <TabsTrigger value="headings">Headings ({data.headings.length})</TabsTrigger>
                    <TabsTrigger value="internal">Internal ({data.stats.internal})</TabsTrigger>
                    <TabsTrigger value="outbound">Outbound ({data.stats.outbound})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="headings">
                    {data.headings.length ? (
                      <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
                        {data.headings.map((h, i) => (
                          <li key={i} style={{ paddingLeft: (h.level - 1) * 16 }} className="flex gap-2">
                            <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">H{h.level}</span>
                            <span className={h.level === 1 ? "font-semibold" : ""}>{h.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No H1–H3 headings found.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="internal">
                    <LinkList links={data.internalLinks} empty="No internal links found." />
                  </TabsContent>
                  <TabsContent value="outbound">
                    <LinkList links={data.outboundLinks} empty="No outbound links found." />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
