"use client";

import { Fragment, useState, useTransition } from "react";
import { QrCode, Trash2 } from "lucide-react";
import type { LinkRow } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { QrCodeCard } from "@/components/qr-code";
import { deleteTrackedLink } from "@/app/actions";
import { formatNumber } from "@/lib/utils";

export function LinksTable({ links, origin, showDelete = true }: { links: LinkRow[]; origin: string; showDelete?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!links.length) return <p className="py-6 text-center text-sm text-muted-foreground">No links yet. Create one above.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Link</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead className="text-right">Direct clicks</TableHead>
          <TableHead className="text-right">QR scans</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {links.map((l) => {
          const short = `${origin}/r/${l.slug}`;
          return (
            <Fragment key={l.id}>
              <TableRow>
                <TableCell className="max-w-xs">
                  <p className="truncate font-medium">{l.title ?? l.slug}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={l.destinationUrl}>
                    /r/{l.slug} → {l.destinationUrl}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{l.placement ? `${l.channel} · ${l.placement}` : l.channel}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(l.directClicks)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(l.qrScans)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <CopyButton value={short} label="Copy" />
                    <Button size="sm" variant="outline" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
                      <QrCode aria-hidden /> QR
                    </Button>
                    {showDelete &&
                      (confirming === l.id ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await deleteTrackedLink(l.id);
                              setConfirming(null);
                            })
                          }
                        >
                          {pending ? "Deleting…" : "Confirm delete"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" aria-label={`Delete /r/${l.slug}`} onClick={() => setConfirming(l.id)}>
                          <Trash2 aria-hidden />
                        </Button>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
              {open === l.id && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                    <QrCodeCard url={`${short}?src=qr`} filename={`qr-${l.slug}`} linkId={l.id} initialFg={l.qrFg} initialBg={l.qrBg} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
