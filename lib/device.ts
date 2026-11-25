export type DeviceType = "desktop" | "mobile" | "tablet";

export function parseUserAgent(ua: string): { device: DeviceType; browser: string; os: string } {
  const device: DeviceType = /ipad|tablet|kindle|playbook|silk|android(?!.*mobile)/i.test(ua)
    ? "tablet"
    : /mobi|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(ua)
      ? "mobile"
      : "desktop";

  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung"
        : /chrome|crios/i.test(ua)
          ? "Chrome"
          : /firefox|fxios/i.test(ua)
            ? "Firefox"
            : /safari/i.test(ua)
              ? "Safari"
              : "Other";

  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Other";

  return { device, browser, os };
}

export function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i.test(ua);
}

/** Vercel adds these geo headers on every request at the edge. */
export function geoFromHeaders(h: Headers): { country: string | null; city: string | null } {
  const country = h.get("x-vercel-ip-country");
  let city: string | null = null;
  const raw = h.get("x-vercel-ip-city");
  if (raw) {
    try {
      city = decodeURIComponent(raw);
    } catch {
      city = raw;
    }
  }
  return { country: country || null, city };
}
