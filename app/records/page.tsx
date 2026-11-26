import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RecordForm } from "@/components/record-form";
import { RecordsTable } from "@/components/records-table";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Records" };
export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const { data: records } = await supabase
    .from("records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (records ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    type: r.type as string,
    data: r.data as Record<string, unknown>,
    notes: r.notes as string | null,
    createdAt: new Date(r.created_at as string),
  }));

  return (
    <>
      <PageHeader title="Records" description="Store analytics snapshots and export them as printable PDF reports." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>New record</CardTitle>
            <CardDescription>Save a campaign result, traffic snapshot or any analytics data.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecordForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved records</CardTitle>
            <CardDescription>{rows.length} record{rows.length !== 1 ? "s" : ""} stored</CardDescription>
          </CardHeader>
          <CardContent>
            <RecordsTable rows={rows} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
