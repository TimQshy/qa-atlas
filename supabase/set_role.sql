-- Set role for a user. Run in Supabase SQL Editor.
-- Roles: 'qa' (full access) or 'dev' (dashboard only)

-- Set Dev role:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "dev"}'
WHERE email = 'dev@example.com';

-- Set QA role (or reset to default):
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "qa"}'
WHERE email = 'qa@example.com';

-- Check current roles:
SELECT email, raw_user_meta_data->>'role' AS role FROM auth.users;
