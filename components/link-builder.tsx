"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CopyButton } from "@/components/copy-button";
import { QrCodeCard } from "@/components/qr-code";
import { createTrackedLink, type CreatedLink } from "@/app/actions";
import { buildUtmUrl, CHANNEL_TEMPLATES, normalizeUtm, validateUtm, type UtmKey, type UtmParams } from "@/lib/utm";

const FIELDS: { key: UtmKey; label: string; placeholder: string }[] = [
  { key: "utm_source", label: "Source", placeholder: "google" },
  { key: "utm_medium", label: "Medium", placeholder: "organic_local" },
  { key: "utm_campaign", label: "Campaign", placeholder: "spring_sale_2026" },
  { key: "utm_term", label: "Term", placeholder: "optional keyword" },
  { key: "utm_content", label: "Content", placeholder: "optional variant" },
];

export function LinkBuilder({
  templateIds,
  defaultTemplateId,
  defaultBaseUrl = "",
  defaultTitle = "",
  idPrefix = "lb",
}: {
  templateIds?: string[];
  defaultTemplateId?: string;
  defaultBaseUrl?: string;
  defaultTitle?: string;
  idPrefix?: string;
}) {
  const templates = templateIds ? CHANNEL_TEMPLATES.filter((t) => templateIds.includes(t.id)) : CHANNEL_TEMPLATES;
  const initial = templates.find((t) => t.id === defaultTemplateId) ?? templates[0];

  const [templateId, setTemplateId] = useState(initial.id);
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState("");
  const [utm, setUtm] = useState<UtmParams>({ utm_source: initial.source, utm_medium: initial.medium, utm_campaign: initial.campaign });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [pending, startTransition] = useTransition();

  const template = templates.find((t) => t.id === templateId) ?? initial;
  const issues = validateUtm(utm);
  const blocking = issues.filter((i) => i.message.endsWith("required"));
  const urlValid = useMemo(() => {
    try {
      const u = new URL(baseUrl);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [baseUrl]);
  const preview = urlValid ? buildUtmUrl(baseUrl, normalizeUtm(utm)) : "";

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setUtm((u) => ({ ...u, utm_source: t.source, utm_medium: t.medium, utm_campaign: t.campaign || u.utm_campaign }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!urlValid || blocking.length) return;
    setError(null);
    startTransition(async () => {
      const r = await createTrackedLink({
        baseUrl,
        title: title || undefined,
        slug: slug || undefined,
        channel: template.channel,
        placement: template.placement,
        ...utm,
      });
      if (r.ok) setCreated(r.data);
      else setError(r.error);
    });
  };

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={id("url")}>Destination URL</Label>
            <Input
              id={id("url")}
              type="url"
              inputMode="url"
              placeholder="https://example.com/landing-page"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              aria-invalid={touched && !urlValid}
              aria-describedby={id("url-err")}
            />
            {touched && !urlValid && (
              <p id={id("url-err")} className="text-xs text-destructive">
                Enter a full URL starting with https://
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("tpl")}>Channel template</Label>
            <NativeSelect id={id("tpl")} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{template.hint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("title")}>Link name (internal)</Label>
            <Input id={id("title")} placeholder="e.g. Summer flyer QR" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          {FIELDS.map((f) => {
            const fieldIssues = issues.filter((i) => i.field === f.key);
            const showIssues = fieldIssues.filter((i) => touched || !i.message.endsWith("required"));
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id(f.key)}>
                  {f.label} <code className="text-xs font-normal text-muted-foreground">{f.key}</code>
                </Label>
                <Input
                  id={id(f.key)}
                  placeholder={f.placeholder}
                  value={utm[f.key] ?? ""}
                  onChange={(e) => setUtm((u) => ({ ...u, [f.key]: e.target.value }))}
                  aria-invalid={touched && fieldIssues.some((i) => i.message.endsWith("required"))}
                />
                {showIssues.map((i) => (
                  <p key={i.message} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden /> {i.message}
                  </p>
                ))}
              </div>
            );
          })}
          <div className="space-y-1.5">
            <Label htmlFor={id("slug")}>Custom short slug (optional)</Label>
            <Input id={id("slug")} placeholder="auto-generated" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9_-]/gi, ""))} maxLength={48} />
          </div>
        </div>

        {preview && (
          <div className="rounded-md bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Final tagged URL</p>
            <p className="break-all font-mono text-xs">{preview}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          <Link2 aria-hidden />
          {pending ? "Creating…" : "Generate trackable link + QR"}
        </Button>
      </form>

      {created && (
        <div className="space-y-4 rounded-lg border bg-card p-4" aria-live="polite">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Short link (direct clicks)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-sm">{created.shortUrl}</code>
                <CopyButton value={created.shortUrl} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tagged destination</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-sm">{created.destinationUrl}</code>
                <CopyButton value={created.destinationUrl} />
              </div>
            </div>
          </div>
          <QrCodeCard url={created.qrUrl} filename={`qr-${created.slug}`} linkId={created.id} initialFg={created.qrFg} initialBg={created.qrBg} />
        </div>
      )}
    </div>
  );
}
