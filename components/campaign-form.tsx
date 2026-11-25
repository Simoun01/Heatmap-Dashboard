"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createCampaign } from "@/app/actions";
import { ALLOWED_MEDIUMS, normalizeUtmValue } from "@/lib/utm";

const PRESETS = {
  google_ads: { label: "Google Ads", source: "google", medium: "cpc", channel: "ads" },
  meta_ads: { label: "Meta Ads", source: "facebook", medium: "paid_social", channel: "ads" },
  email: { label: "Newsletter / Email", source: "newsletter", medium: "email", channel: "email" },
  social: { label: "Organic social", source: "instagram", medium: "social", channel: "social" },
  gbp: { label: "Google Business Profile", source: "google", medium: "organic_local", channel: "gbp" },
} as const;
type PresetKey = keyof typeof PRESETS;

export function CampaignForm() {
  const [preset, setPreset] = useState<PresetKey>("google_ads");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [source, setSource] = useState<string>(PRESETS.google_ads.source);
  const [medium, setMedium] = useState<string>(PRESETS.google_ads.medium);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const campaignKey = normalizeUtmValue(key || name);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await createCampaign({ name, utmCampaign: key || undefined, utmSource: source, utmMedium: medium, channel: PRESETS[preset].channel });
          if (r.ok) {
            setMsg({ ok: true, text: `Created utm_campaign=${r.data.utmCampaign}` });
            setName("");
            setKey("");
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cf-preset">Channel</Label>
        <NativeSelect
          id="cf-preset"
          value={preset}
          onChange={(e) => {
            const p = e.target.value as PresetKey;
            setPreset(p);
            setSource(PRESETS[p].source);
            setMedium(PRESETS[p].medium);
          }}
        >
          {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
            <option key={k} value={k}>
              {PRESETS[k].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-name">Campaign name</Label>
        <Input id="cf-name" required minLength={2} maxLength={120} placeholder="Black Friday 2026" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-source">utm_source</Label>
        <Input id="cf-source" required value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-medium">utm_medium</Label>
        <NativeSelect id="cf-medium" value={medium} onChange={(e) => setMedium(e.target.value)}>
          {ALLOWED_MEDIUMS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="cf-key">utm_campaign key (optional)</Label>
        <Input id="cf-key" placeholder="defaults to the name" value={key} onChange={(e) => setKey(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Will be saved as <code className="font-mono">{campaignKey || "…"}</code> - lowercase snake_case keeps reports from splitting.
        </p>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          <Plus aria-hidden /> {pending ? "Creating…" : "Create campaign"}
        </Button>
        {msg && (
          <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
