"use client";

import { useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteRecord } from "@/app/actions";

interface Row {
  id: string;
  title: string;
  type: string;
  data: Record<string, unknown>;
  notes: string | null;
  createdAt: Date;
}

function esc(v: unknown): string {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function PrintableRecord({ row }: { row: Row }) {
  return (
    <div className="space-y-4 p-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">{row.title}</h1>
        <p className="text-sm text-gray-500">
          Type: {row.type} · Created: {row.createdAt.toLocaleDateString()} {row.createdAt.toLocaleTimeString()}
        </p>
        {row.notes && <p className="mt-2 text-sm">{row.notes}</p>}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4 text-left font-semibold">Field</th>
            <th className="py-2 text-left font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(row.data).map(([key, value]) => (
            <tr key={key} className="border-b">
              <td className="py-2 pr-4 font-medium">{key}</td>
              <td className="py-2">{typeof value === "object" ? JSON.stringify(value) : String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pt-4 text-center text-xs text-gray-400">UTM Heatmap · Analytics Record</p>
    </div>
  );
}

export function RecordsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No records yet.</p>;

  function handleDelete(id: string) {
    start(async () => {
      await deleteRecord(id);
      router.refresh();
    });
  }

  function handlePrint(row: Row) {
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${esc(row.title)} - UTM Heatmap Record</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 2rem; color: #1a1a1a; }
          h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
          .meta { font-size: 0.8rem; color: #666; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
          .notes { font-size: 0.85rem; margin-bottom: 1.5rem; padding: 0.75rem; background: #f9fafb; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
          th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 0.85rem; }
          td { padding: 0.5rem; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { text-align: center; font-size: 0.7rem; color: #9ca3af; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
          @media print { body { padding: 1rem; } }
        </style>
      </head>
      <body>
        <h1>${esc(row.title)}</h1>
        <div class="meta">Type: ${esc(row.type)} · Created: ${row.createdAt.toLocaleDateString()} ${row.createdAt.toLocaleTimeString()}</div>
        ${row.notes ? `<div class="notes">${esc(row.notes)}</div>` : ""}
        <table>
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>
            ${Object.entries(row.data)
              .map(([key, value]) => `<tr><td><strong>${esc(key)}</strong></td><td>${esc(value)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
        <div class="footer">UTM Heatmap · Analytics Record · Printed ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Fields</TableHead>
              <TableHead className="hidden lg:table-cell">Notes</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.type}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">{Object.keys(r.data).length} fields</span>
                </TableCell>
                <TableCell className="hidden max-w-xs truncate lg:table-cell">{r.notes ?? "—"}</TableCell>
                <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                  {r.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Print / PDF" onClick={() => handlePrint(r)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" disabled={pending} onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div ref={printRef} className="hidden" />
    </>
  );
}
