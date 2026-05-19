-- Phase 1: per-test granularity for dashboard
CREATE TABLE IF NOT EXISTS test_run_tests (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id      text NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_file   text NOT NULL,
  test_suite  text,
  test_name   text NOT NULL,
  status      text NOT NULL CHECK (status IN ('passed', 'failed', 'flaky', 'skipped')),
  duration_ms int,
  retry_count int DEFAULT 0,
  error_message text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_run_tests_run_id_idx ON test_run_tests (run_id);
CREATE INDEX IF NOT EXISTS test_run_tests_file_status_idx ON test_run_tests (test_file, status);

ALTER TABLE test_run_tests ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS automatically
-- authenticated users: read-only
CREATE POLICY "authenticated read test_run_tests"
  ON test_run_tests FOR SELECT
  TO authenticated
  USING (true);
