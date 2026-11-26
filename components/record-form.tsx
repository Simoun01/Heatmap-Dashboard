"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveRecord } from "@/app/actions";

const TYPES = ["campaign", "traffic", "link", "session", "analysis", "general"] as const;

export function RecordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dataStr = fd.get("data") as string;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataStr || "{}");
    } catch {
      setError("Data must be valid JSON");
      return;
    }
    start(async () => {
      setError(null);
      const res = await saveRecord({
        title: fd.get("title") as string,
        type: fd.get("type") as (typeof TYPES)[number],
        data,
        notes: (fd.get("notes") as string) || undefined,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="rec-title">Title</Label>
        <Input id="rec-title" name="title" required placeholder="e.g. Q4 Campaign Results" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rec-type">Type</Label>
        <NativeSelect id="rec-type" name="type">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rec-data">Data (JSON)</Label>
        <textarea
          id="rec-data"
          name="data"
          required
          rows={5}
          placeholder={'{\n  "clicks": 1250,\n  "sessions": 3400,\n  "conversions": 89,\n  "topSource": "google"\n}'}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="rec-notes">Notes (optional)</Label>
        <Input id="rec-notes" name="notes" placeholder="Context, date range, observations..." />
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save record"}
        </Button>
      </div>
    </form>
  );
}
