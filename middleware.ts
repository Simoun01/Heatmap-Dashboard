import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic auth for the dashboard.
 * Set DASHBOARD_PASSWORD (and optionally DASHBOARD_USER, default "admin") in Vercel to lock it down.
 * Public endpoints - short links, the tracker and its beacon endpoint, PWA files - are never gated.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [user, pass] = atob(header.slice(6)).split(":");
      if (user === (process.env.DASHBOARD_USER ?? "admin") && pass === password) return NextResponse.next();
    } catch {
      /* fall through to challenge */
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="UTM Heatmap Dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!r/|demo|api/track|tracker\\.js|manifest\\.json|sw\\.js|icons/|favicon\\.ico|_next/static|_next/image).*)"],
};
