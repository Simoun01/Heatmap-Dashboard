import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { PeriodStats } from "@/lib/analytics";

interface Kpi {
  label: string;
  value: string;
  delta: number | null;
  hint: string;
}

function delta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return (cur - prev) / prev;
}

export function KpiCards({ current, previous, activeCampaigns, days }: { current: PeriodStats; previous: PeriodStats; activeCampaigns: number; days: number }) {
  const kpis: Kpi[] = [
    { label: "Total tracked clicks", value: formatNumber(current.clicks), delta: delta(current.clicks, previous.clicks), hint: "Short-link + QR redirects" },
    { label: "QR scans", value: formatNumber(current.qrScans), delta: delta(current.qrScans, previous.qrScans), hint: "Scans via ?src=qr" },
    { label: "GBP traffic", value: formatNumber(current.gbpSessions), delta: delta(current.gbpSessions, previous.gbpSessions), hint: "Sessions from google / organic_local" },
    { label: "Active campaigns", value: String(activeCampaigns), delta: null, hint: "Status = active" },
    { label: "Avg. scroll depth", value: `${Math.round(current.avgScroll)}%`, delta: delta(current.avgScroll, previous.avgScroll), hint: "Per tracked session" },
    { label: "Conversion rate", value: formatPercent(current.conversionRate), delta: delta(current.conversionRate, previous.conversionRate), hint: `${formatNumber(current.sessions)} sessions` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {k.delta === null ? (
                <span className="text-muted-foreground">{k.hint}</span>
              ) : (
                <>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-medium",
                      k.delta > 0.005 ? "text-success" : k.delta < -0.005 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {k.delta > 0.005 ? <ArrowUpRight className="h-3 w-3" aria-label="up" /> : k.delta < -0.005 ? <ArrowDownRight className="h-3 w-3" aria-label="down" /> : <Minus className="h-3 w-3" aria-label="flat" />}
                    {formatPercent(Math.abs(k.delta), 0)}
                  </span>
                  <span className="text-muted-foreground">vs prior {days}d</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
