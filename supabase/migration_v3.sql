-- Add is_duplicatable flag to folders and items
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_duplicatable boolean NOT NULL DEFAULT false;
ALTER TABLE items   ADD COLUMN IF NOT EXISTS is_duplicatable boolean NOT NULL DEFAULT false;

-- Per-release item overrides (composite PK)
CREATE TABLE IF NOT EXISTS release_item_overrides (
  release_id text NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  title text,
  description text,
  tags jsonb,
  priority text,
  status text,
  tickets jsonb,
  bugs jsonb,
  is_stable boolean,
  is_duplicatable boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, item_id)
);

ALTER TABLE releases ADD COLUMN IF NOT EXISTS excluded_folder_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS release_id text REFERENCES releases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS release_item_overrides_lookup ON release_item_overrides(release_id);
CREATE INDEX IF NOT EXISTS comments_release_idx ON comments(release_id);

ALTER TABLE release_item_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON release_item_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
