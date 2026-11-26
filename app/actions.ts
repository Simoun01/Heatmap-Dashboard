"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo";
import { appUrl, randomSlug } from "@/lib/utils";
import { buildUtmUrl, normalizeUtm, normalizeUtmValue } from "@/lib/utm";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DEMO_ERROR = "Demo mode: set your Supabase env vars to save changes.";

// ── Authentication ──────────────────────────────────────────────────

const AUTH_COOKIE = "utm_session";

export async function login(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDemoMode()) {
    return { ok: false, error: "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy." };
  }
  const { data: user, error } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username.trim())
    .eq("password", password)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Database error: ${error.message}` };
  }
  if (!user) {
    return { ok: false, error: "Invalid username or password" };
  }
  const token = Buffer.from(`${user.username}:${Date.now()}`).toString("base64");
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
}

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full http(s) URL");

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0f172a");
const utmField = z.string().trim().max(160).optional();

const linkSchema = z.object({
  baseUrl: httpUrl,
  title: z.string().trim().max(120).optional(),
  slug: z
    .string()
    .trim()
    .max(48)
    .regex(/^[a-z0-9_-]*$/i, "Letters, numbers, - and _ only")
    .optional(),
  channel: z.enum(["gbp", "ads", "email", "social", "qr", "general"]).default("general"),
  placement: z.string().trim().max(60).optional(),
  utm_source: utmField,
  utm_medium: utmField,
  utm_campaign: utmField,
  utm_term: utmField,
  utm_content: utmField,
  qrFg: hex.optional(),
  qrBg: hex.optional(),
});

export type CreateLinkInput = z.input<typeof linkSchema>;
export interface CreatedLink {
  id: string;
  slug: string;
  shortUrl: string;
  qrUrl: string;
  destinationUrl: string;
  qrFg: string;
  qrBg: string;
}

export async function createTrackedLink(input: CreateLinkInput): Promise<Result<CreatedLink>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const utm = normalizeUtm(v);
  const destinationUrl = buildUtmUrl(v.baseUrl, utm);

  let slug = v.slug ? v.slug.toLowerCase() : randomSlug();
  if (v.slug) {
    const { data: taken } = await supabase.from("tracked_links").select("id").eq("slug", slug).maybeSingle();
    if (taken) return { ok: false, error: `/r/${slug} is already taken` };
  } else {
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase.from("tracked_links").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = randomSlug(8);
    }
  }

  const { data: campaign } = utm.utm_campaign
    ? await supabase.from("campaigns").select("id").eq("utm_campaign", utm.utm_campaign).maybeSingle()
    : { data: null };

  const { data: link, error } = await supabase
    .from("tracked_links")
    .insert({
      slug,
      title: v.title || null,
      base_url: v.baseUrl,
      destination_url: destinationUrl,
      channel: v.channel,
      placement: v.placement || null,
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_term: utm.utm_term ?? null,
      utm_content: utm.utm_content ?? null,
      qr_fg: v.qrFg ?? "#0f172a",
      qr_bg: v.qrBg ?? "#ffffff",
      campaign_id: campaign?.id ?? null,
    })
    .select("id, slug, qr_fg, qr_bg")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/links");
  revalidatePath("/gbp");
  revalidatePath("/campaigns");
  const shortUrl = `${appUrl()}/r/${link.slug}`;
  return {
    ok: true,
    data: { id: link.id, slug: link.slug, shortUrl, qrUrl: `${shortUrl}?src=qr`, destinationUrl, qrFg: link.qr_fg, qrBg: link.qr_bg },
  };
}

export async function updateQrColors(id: string, qrFg: string, qrBg: string): Promise<Result<null>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  const parsed = z.object({ id: z.string().min(1).max(64), qrFg: hex, qrBg: hex }).safeParse({ id, qrFg, qrBg });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await supabase.from("tracked_links").update({ qr_fg: qrFg, qr_bg: qrBg }).eq("id", id);
  revalidatePath("/links");
  return { ok: true, data: null };
}

export async function deleteTrackedLink(id: string): Promise<Result<null>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  if (!id || id.length > 64) return { ok: false, error: "Invalid link" };
  await supabase.from("tracked_links").delete().eq("id", id);
  revalidatePath("/links");
  return { ok: true, data: null };
}

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name").max(120),
  utmCampaign: z.string().trim().max(120).optional(),
  utmSource: z.string().trim().min(1, "Source is required").max(120),
  utmMedium: z.string().trim().min(1, "Medium is required").max(120),
  channel: z.enum(["gbp", "ads", "email", "social", "general"]),
});

export async function createCampaign(input: z.input<typeof campaignSchema>): Promise<Result<{ id: string; utmCampaign: string }>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const utmCampaign = normalizeUtmValue(v.utmCampaign || v.name);
  if (!utmCampaign) return { ok: false, error: "Campaign key can't be empty" };
  const { data: existing } = await supabase.from("campaigns").select("id").eq("utm_campaign", utmCampaign).maybeSingle();
  if (existing) return { ok: false, error: `utm_campaign "${utmCampaign}" already exists` };
  const { data: c, error } = await supabase
    .from("campaigns")
    .insert({ name: v.name, utm_campaign: utmCampaign, utm_source: normalizeUtmValue(v.utmSource), utm_medium: normalizeUtmValue(v.utmMedium), channel: v.channel })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/campaigns");
  revalidatePath("/");
  return { ok: true, data: { id: c.id, utmCampaign } };
}

export async function setCampaignStatus(id: string, status: "active" | "paused" | "ended"): Promise<Result<null>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  if (!["active", "paused", "ended"].includes(status)) return { ok: false, error: "Invalid status" };
  await supabase.from("campaigns").update({ status }).eq("id", id);
  revalidatePath("/campaigns");
  revalidatePath("/");
  return { ok: true, data: null };
}

const siteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  domain: z.string().trim().min(3, "Domain is required").max(253),
});

export async function createSite(input: z.input<typeof siteSchema>): Promise<Result<{ id: string; domain: string }>> {
  if (isDemoMode()) return { ok: false, error: DEMO_ERROR };
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let domain = parsed.data.domain.toLowerCase();
  try {
    domain = new URL(/^https?:\/\//.test(domain) ? domain : `https://${domain}`).hostname;
  } catch {
    return { ok: false, error: "That doesn't look like a domain" };
  }
  const { data: existing } = await supabase.from("sites").select("id, domain").eq("domain", domain).maybeSingle();
  if (existing) return { ok: true, data: { id: existing.id, domain: existing.domain } };
  const { data: site, error } = await supabase.from("sites").insert({ name: parsed.data.name, domain }).select("id, domain").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sites");
  revalidatePath("/heatmaps");
  return { ok: true, data: { id: site.id, domain: site.domain } };
}

// ── Saved Reports (Library) ────────────────────────────────────────

const savedReportSchema = z.object({
  name: z.string().trim().min(1, "Give the report a name").max(200),
  category: z.enum(["campaign", "traffic", "link", "heatmap", "custom"]).default("custom"),
  query: z.string().trim().min(1, "SQL query is required").max(10000),
  filters: z.record(z.unknown()).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type SaveReportInput = z.input<typeof savedReportSchema>;

export async function saveReport(input: SaveReportInput): Promise<Result<{ id: string }>> {
  const parsed = savedReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const { data, error } = await supabase
    .from("saved_reports")
    .insert({ name: v.name, category: v.category, query: v.query, filters: v.filters ?? null, notes: v.notes ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/library");
  return { ok: true, data: { id: data.id } };
}

export async function deleteReport(id: string): Promise<Result<null>> {
  if (!id || id.length > 64) return { ok: false, error: "Invalid report" };
  await supabase.from("saved_reports").delete().eq("id", id);
  revalidatePath("/library");
  return { ok: true, data: null };
}

// ── Records (printable analytics snapshots) ─────────────────────────

const recordSchema = z.object({
  title: z.string().trim().min(1, "Give the record a title").max(200),
  type: z.enum(["campaign", "traffic", "link", "session", "general"]).default("general"),
  data: z.record(z.unknown()),
  notes: z.string().trim().max(2000).optional(),
});

export type SaveRecordInput = z.input<typeof recordSchema>;

export async function saveRecord(input: SaveRecordInput): Promise<Result<{ id: string }>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const { data, error } = await supabase
    .from("records")
    .insert({ title: v.title, type: v.type, data: v.data, notes: v.notes ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/records");
  return { ok: true, data: { id: data.id } };
}

export async function deleteRecord(id: string): Promise<Result<null>> {
  if (!id || id.length > 64) return { ok: false, error: "Invalid record" };
  await supabase.from("records").delete().eq("id", id);
  revalidatePath("/records");
  return { ok: true, data: null };
}
