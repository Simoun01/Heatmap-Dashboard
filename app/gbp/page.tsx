import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RangeTabs } from "@/components/range-tabs";
import { LinkBuilder } from "@/components/link-builder";
import { LinksTable } from "@/components/links-table";
import { CampaignTable } from "@/components/campaign-table";
import { getCampaignPerformance, getLinks, parseRange, rangeDays } from "@/lib/analytics";
import { appUrl, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Google Business Profile" };
export const dynamic = "force-dynamic";

const PLACEMENTS = [
  { id: "website_button", label: "Website button" },
  { id: "post", label: "Posts" },
  { id: "product", label: "Products" },
  { id: "service", label: "Services" },
  { id: "appointment", label: "Appointments" },
];

export default async function GbpPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const days = rangeDays(range);
  const [rows, links] = await Promise.all([getCampaignPerformance(days, { source: "google", medium: "organic_local" }), getLinks({ channel: "gbp", days })]);

  const totals = rows.reduce((t, r) => ({ sessions: t.sessions + r.sessions, conversions: t.conversions + r.conversions }), { sessions: 0, conversions: 0 });
  const byPlacement = PLACEMENTS.map((p) => {
    const ls = links.filter((l) => l.placement === p.id);
    return { ...p, links: ls.length, clicks: ls.reduce((s, l) => s + l.directClicks + l.qrScans, 0) };
  });

  return (
    <>
      <PageHeader title="Google Business Profile" description="Governed UTMs for every GBP surface (utm_source=google, utm_medium=organic_local, utm_campaign=gbp_*), with local map-pack clicks and conversions.">
        <RangeTabs current={range} basePath="/gbp" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["GBP sessions", formatNumber(totals.sessions)],
          ["GBP conversions", formatNumber(totals.conversions)],
          ["Conversion rate", totals.sessions ? formatPercent(totals.conversions / totals.sessions) : "-"],
          ["GBP short-link clicks", formatNumber(links.reduce((s, l) => s + l.directClicks + l.qrScans, 0))],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>GBP UTM generator</CardTitle>
            <CardDescription>Choose the profile surface; source, medium and campaign prefix are locked to the GBP naming standard.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkBuilder idPrefix="gbp" templateIds={["gbp_website", "gbp_post", "gbp_product", "gbp_service", "gbp_appointment"]} defaultTemplateId="gbp_website" />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Clicks by profile surface</CardTitle>
            <CardDescription>Short-link clicks in the last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {byPlacement.map((p) => {
                const max = Math.max(1, ...byPlacement.map((x) => x.clicks));
                return (
                  <li key={p.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {p.label}
                        <span className="text-xs text-muted-foreground">({p.links} links)</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatNumber(p.clicks)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden>
                      <div className="h-2 rounded-full" style={{ width: `${(p.clicks / max) * 100}%`, background: "var(--series-1)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>GBP campaign performance</CardTitle>
          <CardDescription>On-site sessions attributed to google / organic_local</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignTable rows={rows} empty="No GBP-attributed sessions yet. Add a tagged link to your Business Profile to start." />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>GBP links</CardTitle>
        </CardHeader>
        <CardContent>
          <LinksTable links={links} origin={appUrl()} />
        </CardContent>
      </Card>
    </>
  );
}
