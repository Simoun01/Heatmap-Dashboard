import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LinkBuilder } from "@/components/link-builder";
import { LinksTable } from "@/components/links-table";
import { getLinks } from "@/lib/analytics";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Short Links & QR" };
export const dynamic = "force-dynamic";

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { missing } = await searchParams;
  const links = await getLinks({ days: 30 });

  return (
    <>
      <PageHeader title="Short links & dynamic QR codes" description="Every /r/ link logs device, referrer, location and UTMs, then 302-redirects. QR codes encode ?src=qr so scans are counted apart from clicks." />
      {missing && (
        <p role="status" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          The short link <code>/r/{missing}</code> doesn&apos;t exist (it may have been deleted).
        </p>
      )}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create a short link</CardTitle>
            <CardDescription>Pick a channel template to pre-fill governed UTM values.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkBuilder idPrefix="links" defaultTemplateId="qr_print" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>All links</CardTitle>
            <CardDescription>Counts cover the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinksTable links={links} origin={appUrl()} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
