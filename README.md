# UTM & Behavioral Heatmap Analytics Dashboard

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma + PostgreSQL · Recharts · PWA + Capacitor.

| Module | Where |
|---|---|
| URL analyzer + scrape-to-track | `/analyze`, `app/api/scrape` (SSRF-guarded, cheerio) |
| Tracker (<5 KB, sendBeacon batches) | `public/tracker.js` → `app/api/track` |
| Heatmap viewer (clicks, cursor trails, scroll folds, device filter) | `/heatmaps`, `app/api/heatmap` |
| Google Business Profile UTM manager | `/gbp` |
| Campaigns, emails & ads | `/campaigns` |
| Short links + dynamic QR | `/links`, redirector `app/r/[slug]/route.ts` |
| Overview KPIs, 7/30/90d chart, live feed | `/` |
| Demo landing page (tracker installed, used by seed data) | `/demo` |

## Deploy to Vercel

```bash
git init && git add . && git commit -m "UTM heatmap dashboard"
gh repo create utm-heatmap-dashboard --private --source=. --push
# or: git remote add origin https://github.com/<you>/utm-heatmap-dashboard.git && git push -u origin main
```

1. On vercel.com: **Add New → Project → Import** the repo (framework: Next.js, settings left as they are).
2. Before the first deploy, open **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`.
3. Add `NEXT_PUBLIC_APP_URL` = `https://<your-project>.vercel.app` (and optionally `DASHBOARD_PASSWORD`).
4. Deploy. The `vercel-build` script runs `prisma generate && prisma db push && next build`, so tables are created automatically.
5. Seed the production database once, from your machine:
   ```bash
   # copy DATABASE_URL from Vercel → Settings → Environment Variables
   DATABASE_URL="postgresql://..." NEXT_PUBLIC_APP_URL="https://<your-project>.vercel.app" npx prisma db seed
   ```

If the seed ran with a different `NEXT_PUBLIC_APP_URL`, nothing breaks: the demo site is always previewed at this app's own `/demo`.

## Install the tracker on a site you own

Add the site under **Sites & Tracker**, then paste:

```html
<script src="https://<your-app>/tracker.js" data-site-id="<site id>" defer></script>
```

Conversions: add `data-track-conversion="signup"` to any button, link or form, or call `window.utmhm("conversion", "purchase")`.

## Mobile

- **PWA**: `manifest.json` + `sw.js` make the dashboard installable on iOS (Share → Add to Home Screen), Android and desktop Chrome/Edge.
- **Capacitor**: `capacitor.config.ts` points the native shell at `NEXT_PUBLIC_APP_URL`.
  ```bash
  npx cap add android      # and/or: npx cap add ios (macOS + Xcode)
  npx cap sync && npx cap open android
  ```

## Notes

- **Security**: the dashboard has no user accounts. Set `DASHBOARD_PASSWORD` to put it behind HTTP Basic auth; `/r/*`, `/tracker.js`, `/api/track` and `/demo` stay public. The scraper refuses private/loopback hosts and re-checks every redirect.
- **Redirect speed**: `/r/[slug]` runs on the Node runtime (Prisma), caches slug lookups per warm instance and writes the click row *after* the 302 is sent (`after()`), so the response doesn't wait on the insert. A true Edge-runtime redirect needs Prisma Accelerate or a Neon serverless driver adapter.
- **Geo**: country/city come from Vercel's `x-vercel-ip-*` headers, so they're empty in local dev.
- **Heatmap underlay**: pages that send `X-Frame-Options`/`frame-ancestors` won't render in the iframe. Turn off "Live page underlay" to view on a grid.
- **Scale**: aggregation uses indexed SQL (`date_trunc`, `GROUP BY`). For millions of events/day, add rollup tables or move events to a columnar store.
