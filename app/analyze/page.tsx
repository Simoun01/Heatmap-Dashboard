import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Analyzer } from "@/components/analyzer";

export const metadata: Metadata = { title: "URL Analyzer" };

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <PageHeader
        title="URL Analyzer"
        description="Inspect any page's metadata, UTMs, links and structure, then generate a trackable short link, QR code and heatmap snippet in one flow."
      />
      <Analyzer key={url ?? "empty"} initialUrl={url ?? ""} />
    </>
  );
}
