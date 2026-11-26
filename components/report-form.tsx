"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveReport } from "@/app/actions";

const CATEGORIES = ["campaign", "traffic", "link", "heatmap", "custom"] as const;

export function ReportForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await saveReport({
        name: fd.get("name") as string,
        category: fd.get("category") as (typeof CATEGORIES)[number],
        query: fd.get("query") as string,
        notes: (fd.get("notes") as string) || undefined,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="rpt-name">Name</Label>
        <Input id="rpt-name" name="name" required placeholder="e.g. Weekly campaign breakdown" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rpt-cat">Category</Label>
        <NativeSelect id="rpt-cat" name="category">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rpt-query">SQL Query</Label>
        <textarea
          id="rpt-query"
          name="query"
          required
          rows={4}
          placeholder={'SELECT "utmCampaign", COUNT(*) FROM "Session" GROUP BY 1 ORDER BY 2 DESC'}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rpt-notes">Notes (optional)</Label>
        <Input id="rpt-notes" name="notes" placeholder="Why this query matters, when to run it, etc." />
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save report"}
        </Button>
      </div>
    </form>
  );
}
