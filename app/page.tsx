import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/kpi-cards";
import { TrafficChart } from "@/components/traffic-chart";
import { LiveFeed } from "@/components/live-feed";
import { RangeTabs } from "@/components/range-tabs";
import { CampaignTable } from "@/components/campaign-table";
import { PageHeader } from "@/components/page-header";
import { getCampaignPerformance, getKpis, getLinks, getTrafficSeries, parseRange, rangeDays } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const days = rangeDays(range);
  const [kpis, series, campaigns, links] = await Promise.all([getKpis(days), getTrafficSeries(days), getCampaignPerformance(days), getLinks({ days })]);
  const topLinks = [...links].sort((a, b) => b.directClicks + b.qrScans - (a.directClicks + a.qrScans)).slice(0, 6);

  return (
    <>
      <PageHeader title="Overview" description="Clicks, scans and on-site behaviour across every tracked channel.">
        <RangeTabs current={range} />
      </PageHeader>

      <KpiCards current={kpis.current} previous={kpis.previous} activeCampaigns={kpis.activeCampaigns} days={days} />

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sessions by traffic source</CardTitle>
            <CardDescription>Last {days} days, grouped from utm_source + utm_medium</CardDescription>
          </CardHeader>
          <CardContent>
            <TrafficChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              Live activity
            </CardTitle>
            <CardDescription>Clicks, QR scans and cursor sessions · refreshes every 5s</CardDescription>
          </CardHeader>
          <CardContent>
            <LiveFeed />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Top campaigns</CardTitle>
              <CardDescription>Grouped by utm_campaign, source and medium</CardDescription>
            </div>
            <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline">
              All campaigns
            </Link>
          </CardHeader>
          <CardContent>
            <CampaignTable rows={campaigns.slice(0, 8)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Top short links</CardTitle>
            <Link href="/links" className="text-sm font-medium text-primary hover:underline">
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {topLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No short links yet.</p>
            ) : (
              <ul className="divide-y">
                {topLinks.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.title ?? `/r/${l.slug}`}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">/r/{l.slug}</p>
                    </div>
                    <div className="text-right text-xs tabular-nums text-muted-foreground">
                      <p>
                        <span className="font-semibold text-foreground">{formatNumber(l.directClicks)}</span> clicks
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">{formatNumber(l.qrScans)}</span> scans
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
