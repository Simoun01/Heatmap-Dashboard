"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Monitor, RefreshCw, Smartphone, Tablet, Layers } from "lucide-react";
import type { HeatmapData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface HeatmapSite {
  id: string;
  name: string;
  domain: string;
  pages: { path: string; events: number }[];
}

type Device = "desktop" | "mobile" | "tablet" | "all";
const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "all", label: "All", icon: Layers },
];

// allow-scripts + allow-same-origin is only safe for other origins; on our own origin it would let the frame escape the sandbox.
function frameSandbox(pageUrl: string): string {
  try {
    if (new URL(pageUrl).origin !== window.location.origin) return "allow-scripts allow-same-origin";
  } catch {}
  return "allow-scripts";
}

// Sequential warm ramp (yellow -> orange -> red); low density stays transparent.
const RAMP: [number, number, number][] = [
  [255, 237, 160],
  [254, 178, 76],
  [253, 141, 60],
  [240, 59, 32],
  [189, 0, 38],
];

function rampColor(t: number): [number, number, number] {
  const p = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(p);
  const f = p - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const SCROLL_MARKS = [25, 50, 75, 100];

export function HeatmapViewer({ sites }: { sites: HeatmapSite[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const site = sites.find((s) => s.id === siteId);
  const [path, setPath] = useState(site?.pages[0]?.path ?? "/");
  const [device, setDevice] = useState<Device>("desktop");
  const [days, setDays] = useState(30);
  const [showClicks, setShowClicks] = useState(true);
  const [showTrails, setShowTrails] = useState(false);
  const [showScroll, setShowScroll] = useState(true);
  const [livePage, setLivePage] = useState(true);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async () => {
    if (!siteId || !path) return;
    setStatus("loading");
    try {
      const qs = new URLSearchParams({ siteId, path, device, days: String(days) });
      const res = await fetch(`/api/heatmap?${qs}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as HeatmapData);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [siteId, path, device, days]);

  useEffect(() => {
    load();
  }, [load]);

  const scale = data && width ? width / data.vw : 0;
  const frameH = data ? Math.round(data.docH * scale) : 0;

  const reach = useMemo(() => {
    const depths = data?.scrollDepths ?? [];
    return SCROLL_MARKS.map((m) => ({ mark: m, pct: depths.length ? depths.filter((d) => d >= m).length / depths.length : 0 }));
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !width || !frameH) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = frameH * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${frameH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, frameH);

    if (showClicks && data.clicks.length) {
      // 1) accumulate density in the alpha channel, 2) colorize through the ramp.
      const off = document.createElement("canvas");
      off.width = width;
      off.height = frameH;
      const o = off.getContext("2d");
      if (o) {
        const r = Math.max(14, Math.min(36, width / 40));
        const alpha = Math.min(0.35, Math.max(0.04, 6 / Math.sqrt(data.clicks.length)));
        for (const [x, y] of data.clicks) {
          const cx = x * width;
          const cy = y * frameH;
          const g = o.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(0,0,0,${alpha})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          o.fillStyle = g;
          o.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        const img = o.getImageData(0, 0, width, frameH);
        const px = img.data;
        let max = 1;
        for (let i = 3; i < px.length; i += 4) if (px[i] > max) max = px[i];
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3];
          if (!a) continue;
          const t = a / max;
          const [cr, cg, cb] = rampColor(t);
          px[i] = cr;
          px[i + 1] = cg;
          px[i + 2] = cb;
          px[i + 3] = Math.min(220, 40 + t * 200);
        }
        o.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, width, frameH);
      }
      // Rage clicks get a distinct ring so they're not color-only.
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#dc3c3d";
      for (const [x, y, rage] of data.clicks) {
        if (!rage) continue;
        ctx.beginPath();
        ctx.arc(x * width, y * frameH, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (showTrails && data.trails.length) {
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(37,125,224,0.28)";
      for (const t of data.trails) {
        ctx.beginPath();
        t.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * frameH) : ctx.moveTo(x * width, y * frameH)));
        ctx.stroke();
      }
    }

    if (showScroll) {
      ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
      for (const { mark, pct } of reach) {
        const y = Math.min(frameH - 1, (mark / 100) * frameH);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "rgba(25,25,25,0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        const label = `${Math.round(pct * 100)}% reached ${mark}% depth`;
        const tw = ctx.measureText(label).width + 12;
        const ly = mark === 100 ? y - 24 : y + 4;
        ctx.fillStyle = "rgba(25,25,25,0.85)";
        ctx.fillRect(8, ly, tw, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, 14, ly + 14);
      }
    }
  }, [data, width, frameH, showClicks, showTrails, showScroll, reach]);

  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <p className="font-medium">No tracked sites yet</p>
          <p className="text-sm text-muted-foreground">Add a site and paste the one-line tracker snippet into its &lt;head&gt; to start collecting clicks, cursor trails and scroll depth.</p>
          <Button asChild>
            <Link href="/sites">Add a site</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rageCount = data?.clicks.filter((c) => c[2]).length ?? 0;
  const avgScroll = data?.scrollDepths.length ? Math.round(data.scrollDepths.reduce((a, b) => a + b, 0) / data.scrollDepths.length) : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle>Filters & layers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hm-site">Site</Label>
            <NativeSelect
              id="hm-site"
              value={siteId}
              onChange={(e) => {
                const next = sites.find((s) => s.id === e.target.value);
                setSiteId(e.target.value);
                setPath(next?.pages[0]?.path ?? "/");
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.domain})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hm-path">Page</Label>
            <NativeSelect id="hm-path" value={path} onChange={(e) => setPath(e.target.value)} disabled={!site?.pages.length}>
              {site?.pages.length ? (
                site.pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path} · {p.events} events
                  </option>
                ))
              ) : (
                <option value="/">No pages recorded yet</option>
              )}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hm-days">Date range</Label>
            <NativeSelect id="hm-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </NativeSelect>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Device</legend>
            <div className="grid grid-cols-2 gap-2">
              {DEVICES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={device === id}
                  onClick={() => setDevice(id)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    device === id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Layers</legend>
            {[
              { id: "l-clicks", label: "Click heatmap", on: showClicks, set: setShowClicks },
              { id: "l-trails", label: "Cursor movement trails", on: showTrails, set: setShowTrails },
              { id: "l-scroll", label: "Scroll depth fold lines", on: showScroll, set: setShowScroll },
              { id: "l-live", label: "Live page underlay", on: livePage, set: setLivePage },
            ].map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={l.id} className="font-normal">
                  {l.label}
                </Label>
                <Switch id={l.id} checked={l.on} onCheckedChange={l.set} />
              </div>
            ))}
          </fieldset>

          {data && (
            <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Sessions</dt>
                <dd className="font-semibold tabular-nums">{data.sessions}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Clicks</dt>
                <dd className="font-semibold tabular-nums">{data.clicks.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rage clicks</dt>
                <dd className="font-semibold tabular-nums">{rageCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Avg. scroll</dt>
                <dd className="font-semibold tabular-nums">{avgScroll}%</dd>
              </div>
            </dl>
          )}

          <div className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Legend</p>
            <div className="h-2.5 w-full rounded-full" style={{ background: "linear-gradient(90deg, rgb(255,237,160), rgb(254,178,76), rgb(240,59,32), rgb(189,0,38))" }} aria-hidden />
            <div className="flex justify-between">
              <span>Fewer clicks</span>
              <span>More clicks</span>
            </div>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[#dc3c3d]" aria-hidden /> Rage click (3+ fast clicks)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="truncate text-sm font-medium">{data?.pageUrl ?? "Loading page…"}</CardTitle>
          <Button size="sm" variant="ghost" onClick={load} disabled={status === "loading"} aria-label="Refresh heatmap">
            <RefreshCw className={cn(status === "loading" && "animate-spin")} aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={wrapRef} className="relative max-h-[75vh] w-full overflow-y-auto overflow-x-hidden border-t bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,hsl(var(--border))_40px)]">
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-sm">
                <p>Couldn&apos;t load heatmap data.</p>
                <Button size="sm" variant="outline" onClick={load}>
                  Retry
                </Button>
              </div>
            )}
            {status !== "error" && !data && <div className="h-[60vh] animate-pulse bg-muted" />}
            {data && status !== "error" && (
              <div className="relative" style={{ height: frameH }}>
                {livePage && scale > 0 && (
                  <iframe
                    title="Page preview"
                    src={data.pageUrl}
                    sandbox={frameSandbox(data.pageUrl)}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
                    style={{ width: data.vw, height: data.docH, transform: `scale(${scale})` }}
                  />
                )}
                <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" />
                {data.clicks.length === 0 && data.trails.length === 0 && (
                  <div className="absolute inset-x-0 top-10 mx-auto w-fit rounded-md bg-card px-4 py-3 text-sm shadow">No interactions recorded for this page, device and range yet.</div>
                )}
              </div>
            )}
          </div>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Coordinates are normalised to document width/height, so clicks line up across screen sizes. Sites that send X-Frame-Options/CSP frame-ancestors won&apos;t render underneath — switch off &ldquo;Live page underlay&rdquo; to view on a grid.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
