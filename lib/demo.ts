/** Fixed id of the seeded demo site, whose page lives at /demo inside this app. */
export const DEMO_SITE_ID = "demo-site";

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
