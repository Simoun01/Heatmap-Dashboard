"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteReport } from "@/app/actions";

interface Row {
  id: string;
  name: string;
  category: string;
  query: string;
  filters: Record<string, unknown> | null;
  notes: string | null;
  createdAt: Date;
}

export function ReportsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No saved reports yet.</p>;

  function handleDelete(id: string) {
    start(async () => {
      await deleteReport(id);
      router.refresh();
    });
  }

  function copyQuery(query: string) {
    navigator.clipboard.writeText(query);
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="hidden md:table-cell">Query</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="hidden sm:table-cell">Saved</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{r.category}</Badge>
              </TableCell>
              <TableCell className="hidden max-w-xs md:table-cell">
                <code className="block truncate text-xs">{r.query}</code>
              </TableCell>
              <TableCell className="hidden max-w-xs truncate lg:table-cell">{r.notes ?? "—"}</TableCell>
              <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                {r.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy query" onClick={() => copyQuery(r.query)}>
                    <Copy className="h-3.5 w-3.5" />
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
  );
}
