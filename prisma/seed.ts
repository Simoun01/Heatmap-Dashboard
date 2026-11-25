/* eslint-disable no-console */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_SITE_ID = "demo-site";
const DAY = 86_400_000;
const DAYS = 90;

// Deterministic PRNG so every seed produces the same dashboard.
let state = 20261126;
function rand(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const clamp01 = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1e4) / 1e4));
const id = () => Math.floor(rand() * 1e12).toString(36) + Math.floor(rand() * 1e12).toString(36);

const CITIES: [string, string, number][] = [
  ["US", "Austin", 18],
  ["US", "Chicago", 12],
  ["US", "Denver", 8],
  ["PH", "Manila", 10],
  ["PH", "Cebu City", 4],
  ["GB", "London", 8],
  ["CA", "Toronto", 6],
  ["AU", "Sydney", 5],
  ["DE", "Berlin", 4],
];

type Device = "desktop" | "mobile" | "tablet";
const DEVICES: (readonly [Device, number])[] = [
  ["desktop", 45],
  ["mobile", 48],
  ["tablet", 7],
];
const BROWSERS: Record<Device, string[]> = { desktop: ["Chrome", "Chrome", "Safari", "Edge", "Firefox"], mobile: ["Safari", "Chrome", "Samsung"], tablet: ["Safari", "Chrome"] };
const OS: Record<Device, string[]> = { desktop: ["Windows", "macOS", "macOS", "Linux"], mobile: ["iOS", "Android"], tablet: ["iOS", "Android"] };

// [x, y, weight, isConversionTarget]
type Spot = [number, number, number, boolean?];
const SPOTS: Record<"desktop" | "small", { vw: number; docH: number; spots: Spot[]; rage: [number, number] }> = {
  desktop: {
    vw: 1440,
    docH: 3000,
    rage: [0.5, 0.505], // the Membership price - visitors expect it to be clickable
    spots: [
      [0.885, 0.012, 10],
      [0.43, 0.012, 3],
      [0.49, 0.012, 4],
      [0.553, 0.012, 2],
      [0.447, 0.171, 22],
      [0.57, 0.171, 10],
      [0.5, 0.11, 3],
      [0.139, 0.379, 5],
      [0.422, 0.379, 4],
      [0.706, 0.379, 4],
      [0.217, 0.33, 2],
      [0.217, 0.601, 6, true],
      [0.5, 0.601, 12, true],
      [0.783, 0.601, 5, true],
      [0.5, 0.7, 2],
      [0.5, 0.823, 6],
      [0.5, 0.845, 5],
      [0.5, 0.867, 9, true],
    ],
  },
  small: {
    vw: 390,
    docH: 4600,
    rage: [0.5, 0.56],
    spots: [
      [0.83, 0.008, 9],
      [0.5, 0.115, 20],
      [0.5, 0.13, 8],
      [0.25, 0.24, 4],
      [0.25, 0.3, 3],
      [0.25, 0.36, 3],
      [0.5, 0.52, 5, true],
      [0.5, 0.62, 10, true],
      [0.5, 0.72, 4, true],
      [0.5, 0.9, 6],
      [0.5, 0.92, 5],
      [0.5, 0.945, 8, true],
    ],
  },
};

const CAMPAIGNS = [
  { name: "GBP website button", utmCampaign: "gbp_website", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active" },
  { name: "GBP post - spring whitening", utmCampaign: "gbp_post_spring_whitening", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active" },
  { name: "GBP product - Invisalign", utmCampaign: "gbp_product_invisalign", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active" },
  { name: "GBP service - cleaning", utmCampaign: "gbp_service_cleaning", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active" },
  { name: "GBP appointments", utmCampaign: "gbp_appointment", utmSource: "google", utmMedium: "organic_local", channel: "gbp", status: "active" },
  { name: "Search - brand", utmCampaign: "search_brand_2026", utmSource: "google", utmMedium: "cpc", channel: "ads", status: "active" },
  { name: "Search - Invisalign", utmCampaign: "invisalign_search", utmSource: "google", utmMedium: "cpc", channel: "ads", status: "active" },
  { name: "Meta - spring whitening promo", utmCampaign: "spring_whitening_promo", utmSource: "facebook", utmMedium: "paid_social", channel: "ads", status: "ended" },
  { name: "Meta - Q4 retargeting", utmCampaign: "retargeting_q4", utmSource: "instagram", utmMedium: "paid_social", channel: "ads", status: "active" },
  { name: "Newsletter - November", utmCampaign: "newsletter_nov_2026", utmSource: "newsletter", utmMedium: "email", channel: "email", status: "active" },
  { name: "Welcome sequence", utmCampaign: "welcome_sequence", utmSource: "newsletter", utmMedium: "email", channel: "email", status: "active" },
  { name: "Downtown flyer", utmCampaign: "flyer_downtown", utmSource: "qr_code", utmMedium: "print", channel: "general", status: "paused" },
  { name: "Instagram bio", utmCampaign: "ig_bio", utmSource: "instagram", utmMedium: "social", channel: "social", status: "active" },
] as const;

type Camp = (typeof CAMPAIGNS)[number];
// Session share and conversion rate per campaign; null campaign = direct.
const TRAFFIC: (readonly [Camp | null, number, number])[] = [
  [CAMPAIGNS[0], 12, 0.09],
  [CAMPAIGNS[1], 4, 0.06],
  [CAMPAIGNS[2], 3, 0.08],
  [CAMPAIGNS[3], 3, 0.07],
  [CAMPAIGNS[4], 2, 0.18],
  [CAMPAIGNS[5], 9, 0.07],
  [CAMPAIGNS[6], 8, 0.05],
  [CAMPAIGNS[7], 6, 0.03],
  [CAMPAIGNS[8], 6, 0.04],
  [CAMPAIGNS[9], 6, 0.06],
  [CAMPAIGNS[10], 3, 0.09],
  [CAMPAIGNS[11], 4, 0.05],
  [CAMPAIGNS[12], 4, 0.02],
  [null, 28, 0.04],
];

function appHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.event.deleteMany();
  await prisma.session.deleteMany();
  await prisma.click.deleteMany();
  await prisma.trackedLink.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.site.deleteMany();

  console.log("Creating site, campaigns and links…");
  await prisma.site.create({ data: { id: DEMO_SITE_ID, name: "Brightside Dental (demo)", domain: appHost() } });

  const now = Date.now();
  const campaignIds = new Map<string, string>();
  for (const c of CAMPAIGNS) {
    const created = await prisma.campaign.create({ data: { ...c, createdAt: new Date(now - DAYS * DAY) } });
    campaignIds.set(c.utmCampaign, created.id);
  }

  const base = `http://${appHost()}/demo`;
  const LINKS = [
    { slug: "gbp-site", title: "GBP website button", campaign: "gbp_website", channel: "gbp", placement: "website_button", weight: 14, qr: 0.02 },
    { slug: "gbp-whiten", title: "GBP post: spring whitening", campaign: "gbp_post_spring_whitening", channel: "gbp", placement: "post", weight: 5, qr: 0.02 },
    { slug: "gbp-invis", title: "GBP product: Invisalign", campaign: "gbp_product_invisalign", channel: "gbp", placement: "product", weight: 4, qr: 0.02 },
    { slug: "gbp-clean", title: "GBP service: cleaning", campaign: "gbp_service_cleaning", channel: "gbp", placement: "service", weight: 4, qr: 0.02 },
    { slug: "gbp-book", title: "GBP appointment link", campaign: "gbp_appointment", channel: "gbp", placement: "appointment", weight: 3, qr: 0.02 },
    { slug: "nov-news", title: "November newsletter hero", campaign: "newsletter_nov_2026", channel: "email", placement: null, weight: 6, qr: 0 },
    { slug: "welcome-1", title: "Welcome email #1", campaign: "welcome_sequence", channel: "email", placement: null, weight: 3, qr: 0 },
    { slug: "flyer-dt", title: "Downtown flyer QR", campaign: "flyer_downtown", channel: "qr", placement: null, weight: 5, qr: 0.92 },
    { slug: "ig-bio", title: "Instagram bio link", campaign: "ig_bio", channel: "social", placement: null, weight: 4, qr: 0 },
    { slug: "whiten-ad", title: "Meta whitening ad", campaign: "spring_whitening_promo", channel: "ads", placement: null, weight: 4, qr: 0 },
  ] as const;

  const linkRows: { id: string; weight: number; qr: number; c: Camp }[] = [];
  for (const l of LINKS) {
    const c = CAMPAIGNS.find((x) => x.utmCampaign === l.campaign) as Camp;
    const url = new URL(base);
    url.searchParams.set("utm_source", c.utmSource);
    url.searchParams.set("utm_medium", c.utmMedium);
    url.searchParams.set("utm_campaign", c.utmCampaign);
    const row = await prisma.trackedLink.create({
      data: {
        slug: l.slug,
        title: l.title,
        baseUrl: base,
        destinationUrl: url.toString(),
        channel: l.channel,
        placement: l.placement,
        utmSource: c.utmSource,
        utmMedium: c.utmMedium,
        utmCampaign: c.utmCampaign,
        campaignId: campaignIds.get(c.utmCampaign),
        qrFg: l.qr > 0.5 ? "#115e59" : "#0f172a",
        createdAt: new Date(now - DAYS * DAY),
      },
    });
    linkRows.push({ id: row.id, weight: l.weight, qr: l.qr, c });
  }

  console.log("Generating 90 days of clicks, sessions and behaviour events…");
  const clicks: Prisma.ClickCreateManyInput[] = [];
  const sessions: Prisma.SessionCreateManyInput[] = [];
  const events: Prisma.EventCreateManyInput[] = [];

  for (let d = DAYS - 1; d >= 0; d--) {
    const dayStart = now - d * DAY - (now % DAY);
    const weekday = new Date(dayStart).getUTCDay();
    const seasonal = (weekday === 0 || weekday === 6 ? 0.7 : 1) * (1 + (DAYS - d) / DAYS) * (0.85 + rand() * 0.3);
    const ts = () => {
      const t = dayStart + Math.floor(rand() * DAY);
      return new Date(Math.min(t, now - Math.floor(rand() * 120_000)));
    };

    // Short-link clicks
    for (const l of linkRows) {
      const n = Math.round(l.weight * seasonal * (0.6 + rand()));
      for (let i = 0; i < n; i++) {
        const device = weighted(DEVICES);
        const [country, city] = weighted(CITIES.map((c) => [[c[0], c[1]], c[2]] as const));
        const isQr = rand() < l.qr;
        clicks.push({
          linkId: l.id,
          isQr,
          device: isQr ? (rand() < 0.95 ? "mobile" : "tablet") : device,
          browser: pick(BROWSERS[device]),
          os: pick(OS[device]),
          referrer: isQr ? null : l.c.utmSource === "google" ? "https://www.google.com/" : l.c.utmMedium === "email" ? null : "https://l.instagram.com/",
          country,
          city,
          utmSource: l.c.utmSource,
          utmMedium: l.c.utmMedium,
          utmCampaign: l.c.utmCampaign,
          createdAt: ts(),
        });
      }
    }

    // On-site sessions with behaviour events
    const sessionCount = Math.round(70 * seasonal);
    for (let i = 0; i < sessionCount; i++) {
      const [camp, , conv] = weighted(TRAFFIC.map((t) => [t, t[1]] as const));
      const device = camp?.utmMedium === "print" ? "mobile" : weighted(DEVICES);
      const [country, city] = weighted(CITIES.map((c) => [[c[0], c[1]], c[2]] as const));
      const start = ts();
      const sid = `seed_${id()}`;
      const layout = device === "desktop" ? SPOTS.desktop : SPOTS.small;
      const vw = device === "tablet" ? 820 : layout.vw;
      const docH = device === "tablet" ? 4000 : layout.docH;
      const converted = rand() < conv;
      const engaged = converted || rand() < 0.55;
      const pageviews = engaged ? 1 + Math.floor(rand() * 4) : 1;
      const maxScroll = Math.min(100, Math.round(engaged ? 45 + rand() * 60 : 12 + rand() * 45));

      sessions.push({
        id: sid,
        siteId: DEMO_SITE_ID,
        visitorId: rand() < 0.25 ? `seed_v_${Math.floor(rand() * 400)}` : `seed_v_${id()}`,
        startedAt: start,
        lastSeenAt: new Date(start.getTime() + Math.floor(rand() * 400_000)),
        landingPath: "/demo",
        referrer: camp?.utmSource === "google" ? "https://www.google.com/" : camp?.utmSource === "facebook" ? "https://m.facebook.com/" : null,
        device,
        country,
        city,
        utmSource: camp?.utmSource ?? null,
        utmMedium: camp?.utmMedium ?? null,
        utmCampaign: camp?.utmCampaign ?? null,
        pageviews,
        maxScroll,
        converted,
      });

      const ev = (e: Omit<Prisma.EventCreateManyInput, "sessionId" | "siteId" | "path" | "device">) =>
        events.push({ sessionId: sid, siteId: DEMO_SITE_ID, path: "/demo", device, ...e });

      ev({ type: "pageview", createdAt: start });
      const reachable = layout.spots.filter((s) => s[1] * 100 <= maxScroll + 5);
      const nClicks = engaged ? 1 + Math.floor(rand() * 4) : rand() < 0.4 ? 1 : 0;
      for (let c = 0; c < nClicks && reachable.length; c++) {
        const [x, y] = weighted(reachable.map((s) => [s, s[2]] as const));
        ev({ type: "click", x: clamp01(x + gauss() * 0.025), y: clamp01(y + gauss() * (12 / docH)), vw, docH, createdAt: new Date(start.getTime() + c * 4000) });
      }
      if (converted) {
        const target = layout.spots.filter((s) => s[3]);
        const [x, y] = pick(target);
        ev({ type: "click", x: clamp01(x + gauss() * 0.02), y: clamp01(y + gauss() * (10 / docH)), vw, docH, createdAt: new Date(start.getTime() + 30_000) });
        ev({ type: "conversion", label: "booking_form", createdAt: new Date(start.getTime() + 31_000) });
      }
      if (rand() < 0.035) {
        const [rx, ry] = layout.rage;
        for (let r = 0; r < 2; r++) ev({ type: "rage", x: clamp01(rx + gauss() * 0.01), y: clamp01(ry + gauss() * 0.002), vw, docH, createdAt: new Date(start.getTime() + 9000) });
      }
      ev({ type: "scroll", y: maxScroll / 100, createdAt: new Date(start.getTime() + 60_000) });

      if (device === "desktop" && rand() < 0.18) {
        const [tx, ty] = weighted(reachable.length ? reachable.map((s) => [s, s[2]] as const) : [[layout.spots[0], 1] as const]);
        let x = rand();
        let y = Math.max(0.01, ty - 0.08 + rand() * 0.06);
        const pts: [number, number, number][] = [];
        const steps = 20 + Math.floor(rand() * 40);
        for (let p = 0; p < steps; p++) {
          x += (tx - x) * 0.12 + gauss() * 0.01;
          y += (ty - y) * 0.12 + gauss() * 0.002;
          pts.push([clamp01(x), clamp01(y), p * 100]);
        }
        ev({ type: "move", points: pts, createdAt: new Date(start.getTime() + 5000) });
      }
    }
  }

  const chunk = async <T,>(rows: T[], fn: (batch: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
  };
  await chunk(clicks, (b) => prisma.click.createMany({ data: b }));
  await chunk(sessions, (b) => prisma.session.createMany({ data: b }));
  await chunk(events, (b) => prisma.event.createMany({ data: b }));

  console.log(`Seeded ${CAMPAIGNS.length} campaigns, ${linkRows.length} links, ${clicks.length} clicks, ${sessions.length} sessions, ${events.length} events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
