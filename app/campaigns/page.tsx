import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { RangeTabs } from "@/components/range-tabs";
import { CampaignTable } from "@/components/campaign-table";
import { CampaignForm } from "@/components/campaign-form";
import { LinkBuilder } from "@/components/link-builder";
import { CampaignStatus } from "@/components/campaign-status";
import { getCampaignPerformance, parseRange, rangeDays } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Campaigns, Emails & Ads" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const days = rangeDays(range);
  const [all, campaigns] = await Promise.all([
    getCampaignPerformance(days),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { links: true } } } }),
  ]);

  const ads = all.filter((r) => r.medium === "cpc" || r.medium === "paid_social" || r.medium === "display");
  const email = all.filter((r) => r.medium === "email");

  return (
    <>
      <PageHeader title="Campaigns, emails & ads" description="One builder and one performance table for Google Ads, Meta Ads and email sequences - grouped by utm_campaign, source and medium.">
        <RangeTabs current={range} basePath="/campaigns" />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
          <CardDescription>Bounce = single-page session without a conversion</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({all.length})</TabsTrigger>
              <TabsTrigger value="ads">Paid ads ({ads.length})</TabsTrigger>
              <TabsTrigger value="email">Email ({email.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <CampaignTable rows={all} />
            </TabsContent>
            <TabsContent value="ads">
              <CampaignTable rows={ads} empty="No cpc / paid_social traffic in this range." />
            </TabsContent>
            <TabsContent value="email">
              <CampaignTable rows={email} empty="No email traffic in this range." />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New campaign</CardTitle>
            <CardDescription>Registers a governed utm_campaign key so links and reports stay consistent.</CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tagged link for a campaign</CardTitle>
            <CardDescription>Use the campaign key above as utm_campaign; links are attached to it automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkBuilder idPrefix="cmp" templateIds={["google_ads", "meta_ads", "newsletter", "social_organic"]} defaultTemplateId="google_ads" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Campaign registry</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns registered yet.</p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.utmSource} / {c.utmMedium} / {c.utmCampaign}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.channel}</Badge>
                    <Badge variant="secondary">{c._count.links} links</Badge>
                    <CampaignStatus id={c.id} status={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
