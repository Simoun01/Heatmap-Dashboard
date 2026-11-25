import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CampaignRow } from "@/lib/analytics";
import { formatNumber, formatPercent } from "@/lib/utils";

export function CampaignTable({ rows, empty = "No campaign traffic in this range yet." }: { rows: CampaignRow[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>utm_campaign</TableHead>
          <TableHead>Source / medium</TableHead>
          <TableHead className="text-right">Link clicks</TableHead>
          <TableHead className="text-right">Sessions</TableHead>
          <TableHead className="text-right">Unique visitors</TableHead>
          <TableHead className="text-right">Bounce rate</TableHead>
          <TableHead className="text-right">Conversions</TableHead>
          <TableHead className="text-right">Conv. rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.campaign}|${r.source}|${r.medium}`}>
            <TableCell className="font-mono text-xs">{r.campaign}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {r.source || "-"} / {r.medium || "-"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(r.clicks)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(r.sessions)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(r.visitors)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.sessions ? formatPercent(r.bounceRate) : "-"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(r.conversions)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.sessions ? formatPercent(r.conversionRate) : "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
