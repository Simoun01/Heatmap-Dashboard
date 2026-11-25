import type { CampaignRow, LinkRow, PeriodStats, TrafficPoint } from "./analytics";
import type { ActivityItem, HeatmapData } from "./types";
import type { HeatmapSite } from "@/components/heatmap-viewer";
import { SOURCE_BUCKETS, type SourceBucket } from "./utm";

/** Fixed id of the seeded demo site, whose page lives at /demo inside this app. */
export const DEMO_SITE_ID = "demo-site";

/**
 * The whole dashboard runs on Postgres. When no DATABASE_URL is configured
 * (e.g. a quick Vercel deploy with no database attached) we fall back to this
 * built-in sample dataset so every page renders instead of erroring. Set a real
 * DATABASE_URL and the app automatically switches back to the live database.
 */
export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

const DAY = 86_400_000;

/** Deterministic PRNG so the demo numbers are stable across renders/builds. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- KPIs ---------------------------------------------------------------

function statsFor(days: number, factor: number): PeriodStats {
  const sessions = Math.round(days * 94 * factor);
  const clicks = Math.round(days * 41 * factor);
  return {
    clicks,
    qrScans: Math.round(clicks * 0.27),
    gbpSessions: Math.round(sessions * 0.19),
    sessions,
    conversionRate: 0.058 + 0.01 * factor,
    avgScroll: Math.round(54 + 6 * factor),
  };
}

export function demoKpis(days: number) {
  return {
    current: statsFor(days, 1),
    previous: statsFor(days, 0.88),
    activeCampaigns: 5,
  };
}

// ---- Traffic series -----------------------------------------------------

const BUCKET_WEIGHT: Record<SourceBucket, number> = {
  GBP: 0.22,
  "Google Ads": 0.18,
  Meta: 0.14,
  Email: 0.11,
  "QR / Print": 0.07,
  Social: 0.12,
  Direct: 0.1,
  Other: 0.06,
};

export function demoTrafficSeries(days: number): TrafficPoint[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * DAY);
  const rand = rng(days * 7 + 13);
  const out: TrafficPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * DAY);
    const weekday = d.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.6 : 1;
    const total = Math.round((80 + rand() * 40) * weekendDip);
    const point = { date: d.toISOString().slice(0, 10) } as TrafficPoint;
    for (const b of SOURCE_BUCKETS) {
      point[b] = Math.max(0, Math.round(total * BUCKET_WEIGHT[b] * (0.7 + rand() * 0.6)));
    }
    out.push(point);
  }
  return out;
}

// ---- Campaign performance ----------------------------------------------

interface DemoCampaignSeed {
  campaign: string;
  source: string;
  medium: string;
  weight: number;
}

const CAMPAIGN_SEEDS: DemoCampaignSeed[] = [
  { campaign: "gbp_website", source: "google", medium: "organic_local", weight: 1 },
  { campaign: "gbp_post", source: "google", medium: "organic_local", weight: 0.55 },
  { campaign: "gbp_service", source: "google", medium: "organic_local", weight: 0.4 },
  { campaign: "spring_sale", source: "google", medium: "cpc", weight: 0.9 },
  { campaign: "retargeting_q2", source: "facebook", medium: "paid_social", weight: 0.7 },
  { campaign: "brand_awareness", source: "instagram", medium: "paid_social", weight: 0.5 },
  { campaign: "newsletter_june", source: "newsletter", medium: "email", weight: 0.65 },
  { campaign: "winback", source: "newsletter", medium: "email", weight: 0.3 },
  { campaign: "link_in_bio", source: "instagram", medium: "social", weight: 0.45 },
];

export function demoCampaignPerformance(days: number, opts: { source?: string; medium?: string } = {}): CampaignRow[] {
  const scale = days / 30;
  const rand = rng(days + 101);
  return CAMPAIGN_SEEDS.filter((s) => (!opts.source || s.source === opts.source) && (!opts.medium || s.medium === opts.medium)).map((s) => {
    const sessions = Math.max(1, Math.round(640 * s.weight * scale * (0.85 + rand() * 0.3)));
    const conversions = Math.round(sessions * (0.04 + rand() * 0.05));
    return {
      campaign: s.campaign,
      source: s.source,
      medium: s.medium,
      sessions,
      visitors: Math.round(sessions * (0.78 + rand() * 0.1)),
      bounceRate: 0.28 + rand() * 0.22,
      conversions,
      conversionRate: sessions ? conversions / sessions : 0,
      clicks: Math.round(sessions * (0.9 + rand() * 0.6)),
    };
  });
}

// ---- Tracked links ------------------------------------------------------

interface DemoLinkSeed {
  slug: string;
  title: string;
  channel: string;
  placement?: string;
  utmCampaign: string;
  dest: string;
  weight: number;
}

const LINK_SEEDS: DemoLinkSeed[] = [
  { slug: "book-now", title: "GBP · Book an appointment", channel: "gbp", placement: "appointment", utmCampaign: "gbp_appointment", dest: "https://example.com/book", weight: 1 },
  { slug: "visit-site", title: "GBP · Website button", channel: "gbp", placement: "website_button", utmCampaign: "gbp_website", dest: "https://example.com", weight: 0.9 },
  { slug: "summer-post", title: "GBP · Summer post", channel: "gbp", placement: "post", utmCampaign: "gbp_post", dest: "https://example.com/summer", weight: 0.55 },
  { slug: "our-services", title: "GBP · Services", channel: "gbp", placement: "service", utmCampaign: "gbp_service", dest: "https://example.com/services", weight: 0.5 },
  { slug: "spring-ad", title: "Google Ads · Spring sale", channel: "ads", utmCampaign: "spring_sale", dest: "https://example.com/sale", weight: 0.8 },
  { slug: "fb-promo", title: "Meta · Retargeting", channel: "ads", utmCampaign: "retargeting_q2", dest: "https://example.com/promo", weight: 0.6 },
  { slug: "news-june", title: "Email · June newsletter", channel: "email", utmCampaign: "newsletter_june", dest: "https://example.com/news", weight: 0.55 },
  { slug: "flyer-qr", title: "Print · Flyer QR", channel: "qr", placement: "flyer", utmCampaign: "qr_flyer", dest: "https://example.com/offer", weight: 0.7 },
  { slug: "bio-link", title: "Social · Link in bio", channel: "social", utmCampaign: "link_in_bio", dest: "https://example.com", weight: 0.45 },
];

export function demoLinks(opts: { channel?: string; days?: number } = {}): LinkRow[] {
  const rand = rng((opts.days ?? 30) + 404);
  const now = Date.now();
  return LINK_SEEDS.filter((l) => !opts.channel || l.channel === opts.channel).map((l, i) => {
    const total = Math.round(220 * l.weight * (0.8 + rand() * 0.4));
    const isQrHeavy = l.channel === "qr" || l.placement === "flyer";
    const qrScans = Math.round(total * (isQrHeavy ? 0.75 : 0.18));
    return {
      id: `demo_${l.slug}`,
      slug: l.slug,
      title: l.title,
      destinationUrl: l.dest,
      channel: l.channel,
      placement: l.placement ?? null,
      utmCampaign: l.utmCampaign,
      qrFg: "#0f172a",
      qrBg: "#ffffff",
      createdAt: new Date(now - (i + 2) * 3 * DAY),
      directClicks: total - qrScans,
      qrScans,
    };
  });
}

/** Resolve a demo short link by slug (used by the /r redirect in demo mode). */
export function demoLinkBySlug(slug: string): DemoLinkSeed | null {
  return LINK_SEEDS.find((l) => l.slug === slug.toLowerCase()) ?? null;
}

// ---- Campaign registry (Campaigns page) ---------------------------------

export function demoCampaignRegistry() {
  const now = Date.now();
  const rows = [
    { name: "GBP – Website button", utmCampaign: "gbp_website", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active", links: 3 },
    { name: "Spring Sale", utmCampaign: "spring_sale", utmSource: "google", utmMedium: "cpc", channel: "ads", status: "active", links: 2 },
    { name: "Retargeting Q2", utmCampaign: "retargeting_q2", utmSource: "facebook", utmMedium: "paid_social", channel: "ads", status: "active", links: 2 },
    { name: "June Newsletter", utmCampaign: "newsletter_june", utmSource: "newsletter", utmMedium: "email", channel: "email", status: "active", links: 1 },
    { name: "Link in bio", utmCampaign: "link_in_bio", utmSource: "instagram", utmMedium: "social", channel: "social", status: "paused", links: 1 },
  ];
  return rows.map((r, i) => ({
    id: `demo_cmp_${i}`,
    name: r.name,
    utmCampaign: r.utmCampaign,
    utmSource: r.utmSource,
    utmMedium: r.utmMedium,
    channel: r.channel,
    status: r.status,
    createdAt: new Date(now - (i + 1) * 5 * DAY),
    _count: { links: r.links },
  }));
}

// ---- Sites (Sites page) -------------------------------------------------

export function demoSites() {
  const now = Date.now();
  const sites = [
    { id: DEMO_SITE_ID, name: "Demo Storefront", domain: "demo.example.com", sessions: 2840, events: 18650, seenMinsAgo: 3 },
    { id: "demo-site-2", name: "Landing Pages", domain: "go.example.com", sessions: 1210, events: 7420, seenMinsAgo: 27 },
  ];
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    createdAt: new Date(now - 40 * DAY),
    _count: { sessions: s.sessions, events: s.events },
    lastSeenAt: new Date(now - s.seenMinsAgo * 60_000),
  }));
}

// ---- Heatmap page (site + page list) ------------------------------------

export function demoHeatmapSites(): HeatmapSite[] {
  return [
    {
      id: DEMO_SITE_ID,
      name: "Demo Storefront",
      domain: "demo.example.com",
      pages: [
        { path: "/", events: 9240 },
        { path: "/pricing", events: 4120 },
        { path: "/signup", events: 2610 },
        { path: "/features", events: 1880 },
      ],
    },
    {
      id: "demo-site-2",
      name: "Landing Pages",
      domain: "go.example.com",
      pages: [
        { path: "/lp/spring", events: 3300 },
        { path: "/lp/webinar", events: 1540 },
      ],
    },
  ];
}

// ---- Heatmap data (points for the viewer / /api/heatmap) ----------------

export function demoHeatmapData(path: string, device: string): HeatmapData {
  const vw = device === "mobile" ? 390 : device === "tablet" ? 820 : 1440;
  const docH = device === "mobile" ? 3200 : 2600;
  const rand = rng(path.length * 97 + device.length * 31 + 7);
  // A few hotspots (hero CTA, nav, mid-page), with scatter around each.
  const hotspots: [number, number, number][] = [
    [0.5, 0.12, 120],
    [0.5, 0.34, 90],
    [0.82, 0.05, 60],
    [0.3, 0.55, 70],
    [0.5, 0.78, 50],
  ];
  const clicks: [number, number, 0 | 1][] = [];
  for (const [cx, cy, n] of hotspots) {
    for (let i = 0; i < n; i++) {
      const x = Math.min(0.99, Math.max(0.01, cx + (rand() - 0.5) * 0.12));
      const y = Math.min(0.99, Math.max(0.01, cy + (rand() - 0.5) * 0.08));
      clicks.push([x, y, rand() < 0.05 ? 1 : 0]);
    }
  }
  const trails: [number, number][][] = [];
  for (let t = 0; t < 12; t++) {
    const trail: [number, number][] = [];
    let x = rand();
    let y = rand() * 0.3;
    const steps = 8 + Math.floor(rand() * 10);
    for (let i = 0; i < steps; i++) {
      x = Math.min(0.99, Math.max(0.01, x + (rand() - 0.5) * 0.1));
      y = Math.min(0.99, Math.max(0.01, y + rand() * 0.08));
      trail.push([x, y]);
    }
    trails.push(trail);
  }
  const scrollDepths = Array.from({ length: 60 }, () => {
    const r = rand();
    return r < 0.2 ? 25 + Math.round(rand() * 20) : r < 0.55 ? 45 + Math.round(rand() * 25) : 70 + Math.round(rand() * 30);
  });
  return {
    pageUrl: path,
    vw,
    docH,
    clicks,
    trails,
    scrollDepths,
    sessions: 60,
  };
}

// ---- Live activity feed -------------------------------------------------

export function demoActivity(): ActivityItem[] {
  const now = Date.now();
  const places = ["Austin, US", "Toronto, CA", "London, GB", "Berlin, DE", "Sydney, AU", "Unknown location"];
  const devices = ["desktop", "mobile", "tablet"];
  const rand = rng(Math.floor(now / 60_000)); // reshuffles ~once a minute so it looks live
  const items: ActivityItem[] = [];
  const linkTitles = LINK_SEEDS.slice(0, 5);
  for (let i = 0; i < 20; i++) {
    const at = new Date(now - i * (45_000 + Math.floor(rand() * 90_000))).toISOString();
    const roll = rand();
    const device = devices[Math.floor(rand() * devices.length)];
    const place = places[Math.floor(rand() * places.length)];
    if (roll < 0.4) {
      const l = linkTitles[Math.floor(rand() * linkTitles.length)];
      const isQr = rand() < 0.3;
      items.push({
        id: `demo_c_${i}`,
        kind: isQr ? "qr" : "click",
        title: `${isQr ? "QR scan" : "Link click"} · /r/${l.slug}`,
        detail: `${l.title} · ${device} · ${place}`,
        at,
      });
    } else {
      const buckets = ["GBP", "Google Ads", "Meta", "Email", "Social", "Direct"];
      const b = buckets[Math.floor(rand() * buckets.length)];
      const scroll = 20 + Math.floor(rand() * 80);
      items.push({
        id: `demo_s_${i}`,
        kind: "session",
        title: `Cursor session · demo.example.com/${["", "pricing", "signup", "features"][Math.floor(rand() * 4)]}`,
        detail: `${b} · ${device} · scrolled ${scroll}% · ${place}`,
        at,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
