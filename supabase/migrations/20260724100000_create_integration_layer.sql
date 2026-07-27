-- =============================================================================
-- Migration: Integration Layer tables
-- =============================================================================
-- Creates ONLY new tables for marketplace integrations.
-- Does NOT modify any existing production tables
-- (penjualan, penjualan_harian, affiliate*, livestream, ads_*).
--
-- Tables:
--   1. marketplace_connections
--   2. sync_jobs
--   3. sync_logs
--   4. sync_errors
--
-- Compatible with: PostgreSQL 14+, Supabase
-- =============================================================================

-- Required for gen_random_uuid() on Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helper: keep updated_at current on row updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Trigger function that sets NEW.updated_at to the current UTC timestamp.';

-- =============================================================================
-- 1. marketplace_connections
-- =============================================================================
CREATE TABLE public.marketplace_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace      TEXT NOT NULL,
  shop_id          TEXT NOT NULL,
  shop_name        TEXT NOT NULL,
  brand            TEXT,

  partner_id       TEXT,
  client_id        TEXT,

  access_token     TEXT,
  refresh_token    TEXT,
  token_expired_at TIMESTAMPTZ,

  status           TEXT NOT NULL DEFAULT 'pending',

  last_sync_at     TIMESTAMPTZ,
  last_error       TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT marketplace_connections_marketplace_check
    CHECK (marketplace IN ('shopee', 'tiktok', 'meta', 'tokopedia', 'lazada')),

  CONSTRAINT marketplace_connections_status_check
    CHECK (status IN ('pending', 'active', 'inactive', 'expired', 'error', 'revoked')),

  CONSTRAINT marketplace_connections_shop_id_not_blank
    CHECK (length(trim(shop_id)) > 0),

  CONSTRAINT marketplace_connections_shop_name_not_blank
    CHECK (length(trim(shop_name)) > 0)
);

COMMENT ON TABLE public.marketplace_connections IS
  'Connected marketplace shops/accounts with inline OAuth credentials. Integration layer only; does not alter business reporting tables.';

COMMENT ON COLUMN public.marketplace_connections.id IS
  'Primary key (UUID).';
COMMENT ON COLUMN public.marketplace_connections.marketplace IS
  'Marketplace identifier: shopee | tiktok | meta | tokopedia | lazada.';
COMMENT ON COLUMN public.marketplace_connections.shop_id IS
  'External shop or ad-account ID from the marketplace (e.g. Shopee shop_id, Meta act_*).';
COMMENT ON COLUMN public.marketplace_connections.shop_name IS
  'Human-readable shop or account display name.';
COMMENT ON COLUMN public.marketplace_connections.brand IS
  'Optional brand association within the organization (e.g. Kilap Premium, Purfress).';
COMMENT ON COLUMN public.marketplace_connections.partner_id IS
  'Marketplace partner / app partner ID used for API signing (e.g. Shopee partner_id).';
COMMENT ON COLUMN public.marketplace_connections.client_id IS
  'OAuth client / app client ID when required by the marketplace.';
COMMENT ON COLUMN public.marketplace_connections.access_token IS
  'Current OAuth access token. Store ciphertext at the application layer when possible; never log this column.';
COMMENT ON COLUMN public.marketplace_connections.refresh_token IS
  'OAuth refresh token used to renew access_token.';
COMMENT ON COLUMN public.marketplace_connections.token_expired_at IS
  'UTC timestamp when access_token expires and must be refreshed.';
COMMENT ON COLUMN public.marketplace_connections.status IS
  'Connection lifecycle status: pending | active | inactive | expired | error | revoked.';
COMMENT ON COLUMN public.marketplace_connections.last_sync_at IS
  'Timestamp of the most recent sync attempt for this connection.';
COMMENT ON COLUMN public.marketplace_connections.last_error IS
  'Most recent sync/auth error message for quick diagnostics in UI.';
COMMENT ON COLUMN public.marketplace_connections.created_at IS
  'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.marketplace_connections.updated_at IS
  'Row last-update timestamp (UTC); maintained by trigger.';

CREATE UNIQUE INDEX marketplace_connections_marketplace_shop_uidx
  ON public.marketplace_connections (marketplace, shop_id);

CREATE INDEX marketplace_connections_marketplace_idx
  ON public.marketplace_connections (marketplace);

CREATE INDEX marketplace_connections_status_idx
  ON public.marketplace_connections (status);

CREATE INDEX marketplace_connections_brand_idx
  ON public.marketplace_connections (brand)
  WHERE brand IS NOT NULL;

CREATE INDEX marketplace_connections_token_expired_at_idx
  ON public.marketplace_connections (token_expired_at)
  WHERE token_expired_at IS NOT NULL AND status = 'active';

CREATE TRIGGER trg_marketplace_connections_updated_at
  BEFORE UPDATE ON public.marketplace_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. sync_jobs
-- =============================================================================
CREATE TABLE public.sync_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id    UUID NOT NULL
                     REFERENCES public.marketplace_connections (id)
                     ON DELETE CASCADE,
  job_name         TEXT NOT NULL,
  module           TEXT NOT NULL,
  target_table     TEXT,
  interval_minutes INTEGER NOT NULL,
  is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at      TIMESTAMPTZ,
  next_run_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT sync_jobs_module_check
    CHECK (module IN (
      'sales',
      'affiliate',
      'ads',
      'livestream',
      'product',
      'token_refresh'
    )),

  CONSTRAINT sync_jobs_target_table_check
    CHECK (
      target_table IS NULL
      OR target_table IN (
        'penjualan_harian',
        'affiliate_weekly',
        'affiliate_monthly',
        'affiliate_paid',
        'livestream',
        'ads_shopee',
        'ads_tiktok',
        'ads_meta'
      )
    ),

  CONSTRAINT sync_jobs_interval_minutes_check
    CHECK (interval_minutes > 0),

  CONSTRAINT sync_jobs_name_not_blank
    CHECK (length(trim(job_name)) > 0)
);

COMMENT ON TABLE public.sync_jobs IS
  'Recurring sync job definitions. Jobs write into existing production reporting tables without altering their schemas.';

COMMENT ON COLUMN public.sync_jobs.id IS
  'Primary key (UUID).';
COMMENT ON COLUMN public.sync_jobs.connection_id IS
  'FK to marketplace_connections.id that this job syncs from.';
COMMENT ON COLUMN public.sync_jobs.job_name IS
  'Human-readable job name for UI and logs.';
COMMENT ON COLUMN public.sync_jobs.module IS
  'Business module synced: sales | affiliate | ads | livestream | product | token_refresh.';
COMMENT ON COLUMN public.sync_jobs.target_table IS
  'Optional destination production table this job upserts into.';
COMMENT ON COLUMN public.sync_jobs.interval_minutes IS
  'How often the job should run, in minutes (must be > 0).';
COMMENT ON COLUMN public.sync_jobs.is_enabled IS
  'When false, the scheduler must skip this job.';
COMMENT ON COLUMN public.sync_jobs.last_run_at IS
  'Timestamp of the most recent job execution start.';
COMMENT ON COLUMN public.sync_jobs.next_run_at IS
  'Computed next scheduled run timestamp (UTC).';
COMMENT ON COLUMN public.sync_jobs.created_at IS
  'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sync_jobs.updated_at IS
  'Row last-update timestamp (UTC); maintained by trigger.';

CREATE INDEX sync_jobs_connection_id_idx
  ON public.sync_jobs (connection_id);

CREATE INDEX sync_jobs_enabled_next_run_idx
  ON public.sync_jobs (is_enabled, next_run_at)
  WHERE is_enabled = TRUE;

CREATE INDEX sync_jobs_module_idx
  ON public.sync_jobs (module);

CREATE TRIGGER trg_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. sync_logs
-- =============================================================================
CREATE TABLE public.sync_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id        UUID
                       REFERENCES public.sync_jobs (id)
                       ON DELETE SET NULL,
  connection_id      UUID NOT NULL
                       REFERENCES public.marketplace_connections (id)
                       ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending',
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  records_processed  INTEGER NOT NULL DEFAULT 0,
  duration_ms        INTEGER,
  api_endpoint       TEXT,
  date_range_start   DATE,
  date_range_end     DATE,
  message            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT sync_logs_status_check
    CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed', 'cancelled')),

  CONSTRAINT sync_logs_records_processed_non_negative
    CHECK (records_processed >= 0),

  CONSTRAINT sync_logs_duration_ms_non_negative
    CHECK (duration_ms IS NULL OR duration_ms >= 0),

  CONSTRAINT sync_logs_date_range_check
    CHECK (
      date_range_start IS NULL
      OR date_range_end IS NULL
      OR date_range_start <= date_range_end
    ),

  CONSTRAINT sync_logs_finished_after_started
    CHECK (
      finished_at IS NULL
      OR started_at IS NULL
      OR finished_at >= started_at
    )
);

COMMENT ON TABLE public.sync_logs IS
  'Execution history for marketplace sync runs (scheduled or manual).';

COMMENT ON COLUMN public.sync_logs.id IS
  'Primary key (UUID).';
COMMENT ON COLUMN public.sync_logs.sync_job_id IS
  'FK to sync_jobs.id. Null for ad-hoc/manual syncs not tied to a saved job.';
COMMENT ON COLUMN public.sync_logs.connection_id IS
  'FK to marketplace_connections.id that was synced.';
COMMENT ON COLUMN public.sync_logs.status IS
  'Run status: pending | running | success | partial | failed | cancelled.';
COMMENT ON COLUMN public.sync_logs.started_at IS
  'When the sync worker began processing this run.';
COMMENT ON COLUMN public.sync_logs.finished_at IS
  'When the sync worker finished (success, partial, failed, or cancelled).';
COMMENT ON COLUMN public.sync_logs.records_processed IS
  'Total number of records processed in this run (fetched and handled).';
COMMENT ON COLUMN public.sync_logs.duration_ms IS
  'Wall-clock duration of the run in milliseconds.';
COMMENT ON COLUMN public.sync_logs.api_endpoint IS
  'Primary marketplace API endpoint called during this run.';
COMMENT ON COLUMN public.sync_logs.date_range_start IS
  'Inclusive start date of the data window synced.';
COMMENT ON COLUMN public.sync_logs.date_range_end IS
  'Inclusive end date of the data window synced.';
COMMENT ON COLUMN public.sync_logs.message IS
  'Short human-readable summary of the run outcome.';
COMMENT ON COLUMN public.sync_logs.created_at IS
  'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sync_logs.updated_at IS
  'Row last-update timestamp (UTC); maintained by trigger.';

CREATE INDEX sync_logs_connection_id_idx
  ON public.sync_logs (connection_id);

CREATE INDEX sync_logs_sync_job_id_idx
  ON public.sync_logs (sync_job_id)
  WHERE sync_job_id IS NOT NULL;

CREATE INDEX sync_logs_status_idx
  ON public.sync_logs (status);

CREATE INDEX sync_logs_started_at_idx
  ON public.sync_logs (started_at DESC NULLS LAST);

CREATE INDEX sync_logs_created_at_idx
  ON public.sync_logs (created_at DESC);

CREATE TRIGGER trg_sync_logs_updated_at
  BEFORE UPDATE ON public.sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. sync_errors
-- =============================================================================
CREATE TABLE public.sync_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id     UUID NOT NULL
                    REFERENCES public.sync_logs (id)
                    ON DELETE CASCADE,
  sync_job_id     UUID
                    REFERENCES public.sync_jobs (id)
                    ON DELETE SET NULL,
  connection_id   UUID
                    REFERENCES public.marketplace_connections (id)
                    ON DELETE SET NULL,
  error_code      TEXT,
  error_message   TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'error',
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT sync_errors_severity_check
    CHECK (severity IN ('warning', 'error', 'critical')),

  CONSTRAINT sync_errors_message_not_blank
    CHECK (length(trim(error_message)) > 0)
);

COMMENT ON TABLE public.sync_errors IS
  'Detailed errors captured during a sync run for debugging and alerting.';

COMMENT ON COLUMN public.sync_errors.id IS
  'Primary key (UUID).';
COMMENT ON COLUMN public.sync_errors.sync_log_id IS
  'FK to sync_logs.id for the run that produced this error.';
COMMENT ON COLUMN public.sync_errors.sync_job_id IS
  'Optional FK to sync_jobs.id (denormalized for easier querying).';
COMMENT ON COLUMN public.sync_errors.connection_id IS
  'Optional FK to marketplace_connections.id (denormalized for easier querying).';
COMMENT ON COLUMN public.sync_errors.error_code IS
  'Provider or application error code (e.g. rate_limit_exceeded, invalid_token).';
COMMENT ON COLUMN public.sync_errors.error_message IS
  'Human-readable error summary.';
COMMENT ON COLUMN public.sync_errors.severity IS
  'Severity: warning | error | critical.';
COMMENT ON COLUMN public.sync_errors.resolved_at IS
  'When the issue was acknowledged/resolved; null means still open.';
COMMENT ON COLUMN public.sync_errors.created_at IS
  'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sync_errors.updated_at IS
  'Row last-update timestamp (UTC); maintained by trigger.';

CREATE INDEX sync_errors_sync_log_id_idx
  ON public.sync_errors (sync_log_id);

CREATE INDEX sync_errors_sync_job_id_idx
  ON public.sync_errors (sync_job_id)
  WHERE sync_job_id IS NOT NULL;

CREATE INDEX sync_errors_connection_id_idx
  ON public.sync_errors (connection_id)
  WHERE connection_id IS NOT NULL;

CREATE INDEX sync_errors_severity_idx
  ON public.sync_errors (severity);

CREATE INDEX sync_errors_unresolved_idx
  ON public.sync_errors (created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX sync_errors_error_code_idx
  ON public.sync_errors (error_code)
  WHERE error_code IS NOT NULL;

CREATE TRIGGER trg_sync_errors_updated_at
  BEFORE UPDATE ON public.sync_errors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- End of migration
-- =============================================================================
