import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SiteForm } from "@/components/site-form";
import { SnippetBox } from "@/components/snippet-box";
import { prisma } from "@/lib/prisma";
import { demoSites, isDemoMode } from "@/lib/demo";
import { formatNumber, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Sites & Tracker" };
export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const demo = isDemoMode();
  const sites = demo
    ? demoSites()
    : await prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { sessions: true, events: true } } },
      });
  const lastSeen = demo
    ? demoSites().map((s) => ({ siteId: s.id, _max: { lastSeenAt: s.lastSeenAt } }))
    : await prisma.session.groupBy({ by: ["siteId"], _max: { lastSeenAt: true } });

  return (
    <>
      <PageHeader title="Sites & tracker" description="Install one line on sites you own for full first-party tracking: clicks, cursor trails, scroll depth, rage clicks, UTMs, device and location." />
      <Card>
        <CardHeader>
          <CardTitle>Add a site</CardTitle>
        </CardHeader>
        <CardContent>
          <SiteForm />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6">
        {sites.length === 0 && <p className="text-sm text-muted-foreground">No sites yet.</p>}
        {sites.map((s) => {
          const seen = lastSeen.find((l) => l.siteId === s.id)?._max.lastSeenAt;
          return (
            <Card key={s.id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>
                    {s.domain} · {formatNumber(s._count.sessions)} sessions · {formatNumber(s._count.events)} events · {seen ? `last hit ${timeAgo(seen)}` : "no data yet"}
                  </CardDescription>
                </div>
                <Link href="/heatmaps" className="text-sm font-medium text-primary hover:underline">
                  View heatmaps
                </Link>
              </CardHeader>
              <CardContent>
                <SnippetBox siteId={s.id} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What the tracker captures</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p>
            <strong className="text-foreground">Clicks</strong> as (x, y) normalised to document width and height, so heatmaps align across screen sizes. 3+ clicks within 700ms in a 30px radius are flagged as rage clicks.
          </p>
          <p>
            <strong className="text-foreground">Cursor trails</strong> sampled every 100ms and sent as one compact path per batch.
          </p>
          <p>
            <strong className="text-foreground">Scroll depth</strong> as the deepest point reached on each page.
          </p>
          <p>
            <strong className="text-foreground">Attribution</strong>: utm_source/medium/campaign/term/content (kept for the whole session), referrer, device type; country and city come from Vercel&apos;s edge geo headers.
          </p>
          <p className="md:col-span-2">
            Batches go out every 5 seconds and on page hide via <code>navigator.sendBeacon</code>, so the host page is never blocked. No cookies are set; IDs live in local/session storage. Under 5 KB, no dependencies.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
