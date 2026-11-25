import type { UtmParams } from "./utm";

export interface ScrapedLink {
  href: string;
  text: string;
  hasUtm: boolean;
}

export interface ScrapeResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  title: string;
  description: string;
  ogTitle: string | null;
  ogImage: string | null;
  canonical: string | null;
  favicon: string | null;
  utm: UtmParams;
  headings: { level: number; text: string }[];
  internalLinks: ScrapedLink[];
  outboundLinks: ScrapedLink[];
  stats: { internal: number; outbound: number; withUtm: number; images: number; words: number };
}

export interface HeatmapData {
  pageUrl: string;
  vw: number;
  docH: number;
  clicks: [number, number, 0 | 1][];
  trails: [number, number][][];
  scrollDepths: number[];
  sessions: number;
}

export interface ActivityItem {
  id: string;
  kind: "click" | "qr" | "session";
  title: string;
  detail: string;
  at: string;
}
