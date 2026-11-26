-- Run this in the Supabase SQL Editor to create the saved_reports table

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

-- Auto-update updated_at on row change
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

-- Enable RLS (allow all via service role key used server-side)
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON saved_reports FOR ALL USING (true) WITH CHECK (true);
