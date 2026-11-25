"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { updateQrColors } from "@/app/actions";

type Ecl = "L" | "M" | "Q" | "H";

export function QrCodeCard({
  url,
  filename,
  linkId,
  initialFg = "#0f172a",
  initialBg = "#ffffff",
}: {
  url: string;
  filename: string;
  linkId?: string;
  initialFg?: string;
  initialBg?: string;
}) {
  const [fg, setFg] = useState(initialFg);
  const [bg, setBg] = useState(initialBg);
  const [ecl, setEcl] = useState<Ecl>("M");
  const [margin, setMargin] = useState(2);
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const opts = { errorCorrectionLevel: ecl, margin, color: { dark: fg, light: bg } };

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: ecl, margin, width: 1024, color: { dark: fg, light: bg } })
      .then((d) => {
        if (!alive) return;
        setPng(d);
        setError(null);
      })
      .catch(() => {
        if (alive) setError("Couldn't render this QR code.");
      });
    return () => {
      alive = false;
    };
  }, [url, fg, bg, ecl, margin]);

  const download = (href: string, ext: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${filename}.${ext}`;
    a.click();
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(blobUrl, "svg");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-md border" style={{ background: bg }}>
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt={`QR code for ${url}`} className="h-40 w-40" />
        ) : (
          <div className="h-40 w-40 animate-pulse rounded bg-muted" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`fg-${filename}`}>Foreground</Label>
            <input id={`fg-${filename}`} type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`bg-${filename}`}>Background</Label>
            <input id={`bg-${filename}`} type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-10 w-full cursor-pointer rounded-md border bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ecl-${filename}`}>Error correction</Label>
            <NativeSelect id={`ecl-${filename}`} value={ecl} onChange={(e) => setEcl(e.target.value as Ecl)}>
              <option value="L">Low (7%)</option>
              <option value="M">Medium (15%)</option>
              <option value="Q">Quartile (25%)</option>
              <option value="H">High (30%) - for print</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`margin-${filename}`}>Quiet zone</Label>
            <NativeSelect id={`margin-${filename}`} value={margin} onChange={(e) => setMargin(Number(e.target.value))}>
              {[0, 1, 2, 4, 6].map((m) => (
                <option key={m} value={m}>
                  {m} modules
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => png && download(png, "png")} disabled={!png}>
            <Download aria-hidden /> PNG
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={downloadSvg}>
            <Download aria-hidden /> SVG
          </Button>
          {linkId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await updateQrColors(linkId, fg, bg);
                  setSaved(r.ok ? "Style saved" : r.error);
                })
              }
            >
              <Save aria-hidden /> {pending ? "Saving…" : "Save style"}
            </Button>
          )}
          {saved && <span className="self-center text-xs text-muted-foreground">{saved}</span>}
        </div>
        <p className="break-all text-xs text-muted-foreground">
          Encodes <code>{url}</code> - scans are counted separately from direct clicks.
        </p>
      </div>
    </div>
  );
}
