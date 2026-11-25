"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { SOURCE_BUCKETS, type SourceBucket } from "@/lib/utm";
import type { TrafficPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Color follows the entity (fixed slot per source), never its rank.
const COLOR: Record<SourceBucket, string> = {
  GBP: "var(--series-1)",
  "Google Ads": "var(--series-2)",
  Meta: "var(--series-3)",
  Email: "var(--series-4)",
  "QR / Print": "var(--series-5)",
  Social: "var(--series-6)",
  Direct: "var(--series-7)",
  Other: "var(--series-8)",
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {String(p.dataKey)}
          </span>
          <span className="tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  const totals = useMemo(() => {
    const t = {} as Record<SourceBucket, number>;
    for (const b of SOURCE_BUCKETS) t[b] = data.reduce((s, d) => s + d[b], 0);
    return t;
  }, [data]);
  const present = SOURCE_BUCKETS.filter((b) => totals[b] > 0);
  const [hidden, setHidden] = useState<Set<SourceBucket>>(new Set());
  const [showTable, setShowTable] = useState(false);

  if (present.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
        <p>No tracked sessions in this range yet.</p>
        <p>Install the tracker on a site or share a short link to start collecting data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Toggle traffic sources">
        {present.map((b) => {
          const off = hidden.has(b);
          return (
            <button
              key={b}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(b)) next.delete(b);
                  else next.add(b);
                  return next;
                })
              }
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                off ? "text-muted-foreground opacity-60" : "text-foreground",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: off ? "transparent" : COLOR[b], border: `2px solid ${COLOR[b]}` }} aria-hidden />
              {b}
              <span className="tabular-nums text-muted-foreground">{totals[b]}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setShowTable((v) => !v)} className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline">
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Date</th>
                {present.map((b) => (
                  <th key={b} className="px-2 py-2 text-right font-medium">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="px-2 py-1.5">{fmtDate(d.date)}</td>
                  {present.map((b) => (
                    <td key={b} className="px-2 py-1.5 text-right tabular-nums">
                      {d[b]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "var(--chart-ink)", fontSize: 11 }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--chart-ink)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-axis)" }} />
              {present
                .filter((b) => !hidden.has(b))
                .map((b) => (
                  <Line key={b} type="monotone" dataKey={b} stroke={COLOR[b]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-surface)" }} isAnimationActive={false} />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
