-- ============================================================
-- UTM Heatmap – Complete Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Sites
CREATE TABLE IF NOT EXISTS sites (
    id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        text NOT NULL,
    domain      text UNIQUE NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name         text NOT NULL,
    utm_campaign text UNIQUE NOT NULL,
    utm_source   text NOT NULL,
    utm_medium   text NOT NULL,
    channel      text NOT NULL DEFAULT 'general',
    status       text NOT NULL DEFAULT 'active',
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Tracked Links
CREATE TABLE IF NOT EXISTS tracked_links (
    id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug            text UNIQUE NOT NULL,
    title           text,
    base_url        text NOT NULL,
    destination_url text NOT NULL,
    channel         text NOT NULL DEFAULT 'general',
    placement       text,
    utm_source      text,
    utm_medium      text,
    utm_campaign    text,
    utm_term        text,
    utm_content     text,
    qr_fg           text NOT NULL DEFAULT '#0f172a',
    qr_bg           text NOT NULL DEFAULT '#ffffff',
    campaign_id     text REFERENCES campaigns(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracked_links_channel_idx ON tracked_links(channel);

-- Clicks
CREATE TABLE IF NOT EXISTS clicks (
    id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    link_id      text NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
    is_qr        boolean NOT NULL DEFAULT false,
    device       text NOT NULL,
    browser      text,
    os           text,
    referrer     text,
    country      text,
    city         text,
    utm_source   text,
    utm_medium   text,
    utm_campaign text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clicks_link_created_idx ON clicks(link_id, created_at);
CREATE INDEX IF NOT EXISTS clicks_created_idx ON clicks(created_at);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id           text PRIMARY KEY,
    site_id      text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    visitor_id   text NOT NULL,
    started_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    landing_path text NOT NULL,
    referrer     text,
    device       text NOT NULL,
    country      text,
    city         text,
    utm_source   text,
    utm_medium   text,
    utm_campaign text,
    utm_term     text,
    utm_content  text,
    pageviews    int NOT NULL DEFAULT 0,
    max_scroll   int NOT NULL DEFAULT 0,
    converted    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS sessions_site_started_idx ON sessions(site_id, started_at);
CREATE INDEX IF NOT EXISTS sessions_campaign_idx ON sessions(utm_campaign);
CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions(started_at);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    site_id    text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    type       text NOT NULL,
    path       text NOT NULL,
    x          double precision,
    y          double precision,
    vw         int,
    doc_h      int,
    points     jsonb,
    label      text,
    device     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_site_path_type_idx ON events(site_id, path, type);
CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at);

-- Saved Reports (Library)
CREATE TABLE IF NOT EXISTS saved_reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    category    text NOT NULL DEFAULT 'custom',
    query       text NOT NULL,
    filters     jsonb,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_reports_category_idx ON saved_reports(category);
CREATE INDEX IF NOT EXISTS saved_reports_created_at_idx ON saved_reports(created_at);

-- Auto-update updated_at trigger for saved_reports
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saved_reports_updated_at ON saved_reports;
CREATE TRIGGER saved_reports_updated_at
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all tables (service role key bypasses RLS)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role (used server-side)
CREATE POLICY "Service role full access" ON sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tracked_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON clicks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON saved_reports FOR ALL USING (true) WITH CHECK (true);
