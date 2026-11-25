"use client";

import { useCallback, useEffect, useState } from "react";
import { MousePointerClick, QrCode, Radio, RefreshCw } from "lucide-react";
import type { ActivityItem } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ICON = { click: MousePointerClick, qr: QrCode, session: Radio } as const;
const LABEL = { click: "Link click", qr: "QR scan", session: "Cursor session" } as const;

export function LiveFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { items: ActivityItem[] };
      setItems(json.items);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  if (items === null && !error) {
    return (
      <ul className="space-y-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </ul>
    );
  }

  if (error && !items?.length) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
        <p>Couldn&apos;t load live activity.</p>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw aria-hidden /> Retry
        </Button>
      </div>
    );
  }

  if (!items?.length) return <p className="text-sm text-muted-foreground">Waiting for the first click, scan or session…</p>;

  return (
    <ul className="divide-y" aria-live="polite" aria-label="Live activity">
      {items.map((it) => {
        const Icon = ICON[it.kind];
        return (
          <li key={it.id} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 rounded-md bg-muted p-1.5" title={LABEL[it.kind]}>
              <Icon className="h-3.5 w-3.5" aria-label={LABEL[it.kind]} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.title}</p>
              <p className="truncate text-xs text-muted-foreground">{it.detail}</p>
            </div>
            <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={it.at}>
              {timeAgo(it.at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
