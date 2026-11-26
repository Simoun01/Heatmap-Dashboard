import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ReportForm } from "@/components/report-form";
import { ReportsTable } from "@/components/reports-table";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const { data: reports } = await supabase
    .from("saved_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (reports ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    query: r.query as string,
    filters: r.filters as Record<string, unknown> | null,
    notes: r.notes as string | null,
    createdAt: new Date(r.created_at as string),
  }));

  return (
    <>
      <PageHeader title="Analytics Library" description="Save and organise SQL queries, campaign reports and analytics snapshots for quick access." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Save a report</CardTitle>
            <CardDescription>Paste any SQL query or analytics config to save it for later.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved reports</CardTitle>
            <CardDescription>{rows.length} report{rows.length !== 1 ? "s" : ""} in the library</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportsTable rows={rows} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
