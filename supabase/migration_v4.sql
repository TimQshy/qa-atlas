-- E2E test run history (populated via POST /api/test-runs from Cloud Build)
CREATE TABLE IF NOT EXISTS test_runs (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  build_id      text        NOT NULL,
  started_at    timestamptz NOT NULL,
  expected      int         NOT NULL DEFAULT 0,
  unexpected    int         NOT NULL DEFAULT 0,
  flaky         int         NOT NULL DEFAULT 0,
  skipped       int         NOT NULL DEFAULT 0,
  total         int         NOT NULL DEFAULT 0,
  duration_sec  int         NOT NULL DEFAULT 0,
  hard_fail_tests jsonb     NOT NULL DEFAULT '[]',
  is_infra_failure boolean  NOT NULL DEFAULT false,
  hard_fail_rate numeric(6,4) NOT NULL DEFAULT 0,
  flaky_rate     numeric(6,4) NOT NULL DEFAULT 0,
  report_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_runs_started_idx ON test_runs(started_at DESC);

ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role all"   ON test_runs FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read" ON test_runs FOR SELECT TO authenticated USING (true);
