export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

/** Governance: the only mediums allowed in this workspace. */
export const ALLOWED_MEDIUMS = [
  "organic_local",
  "cpc",
  "paid_social",
  "email",
  "social",
  "referral",
  "print",
  "display",
  "affiliate",
  "sms",
] as const;

/** Lowercase, snake_case, ASCII only - keeps reports from splitting "Facebook" and "facebook". */
export function normalizeUtmValue(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeUtm(p: UtmParams): UtmParams {
  const out: UtmParams = {};
  for (const k of UTM_KEYS) {
    const v = p[k];
    if (v) {
      const n = normalizeUtmValue(v);
      if (n) out[k] = n;
    }
  }
  return out;
}

export interface UtmIssue {
  field: UtmKey;
  message: string;
}

export function validateUtm(p: UtmParams): UtmIssue[] {
  const issues: UtmIssue[] = [];
  for (const k of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    if (!p[k]) issues.push({ field: k, message: `${k} is required` });
  }
  for (const k of UTM_KEYS) {
    const v = p[k];
    if (v && v !== normalizeUtmValue(v)) issues.push({ field: k, message: `Will be saved as "${normalizeUtmValue(v)}"` });
    if (v && v.length > 80) issues.push({ field: k, message: "Keep under 80 characters" });
  }
  const medium = p.utm_medium ? normalizeUtmValue(p.utm_medium) : "";
  if (medium && !(ALLOWED_MEDIUMS as readonly string[]).includes(medium)) {
    issues.push({ field: "utm_medium", message: `"${medium}" is not an approved medium` });
  }
  return issues;
}

export function buildUtmUrl(base: string, p: UtmParams): string {
  const u = new URL(base);
  for (const k of UTM_KEYS) {
    const v = p[k];
    if (v) u.searchParams.set(k, v);
    else u.searchParams.delete(k);
  }
  return u.toString();
}

export function extractUtm(url: string): UtmParams {
  try {
    const u = new URL(url);
    const out: UtmParams = {};
    for (const k of UTM_KEYS) {
      const v = u.searchParams.get(k);
      if (v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export interface ChannelTemplate {
  id: string;
  label: string;
  channel: "gbp" | "ads" | "email" | "social" | "qr" | "general";
  placement?: string;
  source: string;
  medium: string;
  campaign: string;
  hint: string;
}

export const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  { id: "gbp_website", label: "GBP - Website button", channel: "gbp", placement: "website_button", source: "google", medium: "organic_local", campaign: "gbp_website", hint: "Paste into Business Profile > Edit profile > Website" },
  { id: "gbp_post", label: "GBP - Post", channel: "gbp", placement: "post", source: "google", medium: "organic_local", campaign: "gbp_post", hint: "Use as the 'Learn more' button URL on a GBP update" },
  { id: "gbp_product", label: "GBP - Product", channel: "gbp", placement: "product", source: "google", medium: "organic_local", campaign: "gbp_product", hint: "Product > Button > Order online / Learn more" },
  { id: "gbp_service", label: "GBP - Service", channel: "gbp", placement: "service", source: "google", medium: "organic_local", campaign: "gbp_service", hint: "Link from a service description or booking link" },
  { id: "gbp_appointment", label: "GBP - Appointment link", channel: "gbp", placement: "appointment", source: "google", medium: "organic_local", campaign: "gbp_appointment", hint: "Business Profile > Bookings" },
  { id: "google_ads", label: "Google Ads", channel: "ads", source: "google", medium: "cpc", campaign: "", hint: "Final URL suffix or tracking template" },
  { id: "meta_ads", label: "Meta Ads (Facebook / Instagram)", channel: "ads", source: "facebook", medium: "paid_social", campaign: "", hint: "Ad > Destination > URL parameters" },
  { id: "newsletter", label: "Newsletter / Email sequence", channel: "email", source: "newsletter", medium: "email", campaign: "", hint: "Use utm_content to tell links in the same email apart" },
  { id: "social_organic", label: "Organic social", channel: "social", source: "instagram", medium: "social", campaign: "", hint: "Bio links and organic posts" },
  { id: "qr_print", label: "Printed QR code", channel: "qr", source: "qr_code", medium: "print", campaign: "", hint: "Flyers, packaging, signage" },
];

export type SourceBucket = "GBP" | "Google Ads" | "Meta" | "Email" | "QR / Print" | "Social" | "Direct" | "Other";

/** Fixed order = fixed chart color per bucket. */
export const SOURCE_BUCKETS: SourceBucket[] = ["GBP", "Google Ads", "Meta", "Email", "QR / Print", "Social", "Direct", "Other"];

export function sourceBucket(source?: string | null, medium?: string | null): SourceBucket {
  const s = (source ?? "").toLowerCase();
  const m = (medium ?? "").toLowerCase();
  if (!s && !m) return "Direct";
  if (s === "google" && m === "organic_local") return "GBP";
  if (s === "google" && (m === "cpc" || m === "display")) return "Google Ads";
  if (["facebook", "instagram", "meta"].includes(s) && m === "paid_social") return "Meta";
  if (m === "email") return "Email";
  if (m === "print" || s.startsWith("qr")) return "QR / Print";
  if (m === "social") return "Social";
  return "Other";
}
