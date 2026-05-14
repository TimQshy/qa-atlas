-- Add is_duplicatable flag to folders and items
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_duplicatable boolean NOT NULL DEFAULT false;
ALTER TABLE items   ADD COLUMN IF NOT EXISTS is_duplicatable boolean NOT NULL DEFAULT false;
