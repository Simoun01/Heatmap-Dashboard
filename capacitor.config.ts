import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the deployed web app as a native iOS/Android shell.
 * The app loads live from the production URL, so dashboard updates ship
 * without an app-store release.
 *
 *   npx cap add android   # or: npx cap add ios
 *   npx cap sync
 *   npx cap open android
 */
const config: CapacitorConfig = {
  appId: "com.utmheatmap.dashboard",
  appName: "UTM Heatmap",
  webDir: "public",
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  ios: { contentInset: "automatic" },
};

export default config;
