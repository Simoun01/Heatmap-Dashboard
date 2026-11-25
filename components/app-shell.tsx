"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Flame, Globe, LayoutDashboard, Link2, MapPin, Megaphone, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { UrlBar } from "@/components/url-bar";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analyze", label: "URL Analyzer", icon: ScanSearch },
  { href: "/heatmaps", label: "Heatmaps", icon: Flame },
  { href: "/gbp", label: "Google Business", icon: MapPin },
  { href: "/campaigns", label: "Campaigns & Ads", icon: Megaphone },
  { href: "/links", label: "Short Links & QR", icon: Link2 },
  { href: "/sites", label: "Sites & Tracker", icon: Globe },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // The demo landing page renders without dashboard chrome.
  if (pathname.startsWith("/demo")) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Activity className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-semibold">UTM Heatmap</span>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive(href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <p className="p-5 text-xs text-muted-foreground">First-party, cookieless tracking.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <Activity className="h-5 w-5 shrink-0 text-primary lg:hidden" aria-hidden />
            <UrlBar />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Main mobile">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium",
                  isActive(href) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="safe-bottom mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
