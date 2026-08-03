-- Sprint 3 / Task 001 — AI Insight Automation
-- Stores generated brand insights from penjualan_harian KPI analysis.

CREATE TABLE IF NOT EXISTS public.ai_insight (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand           TEXT NOT NULL,
  period_start    DATE,
  period_end      DATE,
  kpi_summary     JSONB,
  summary         TEXT,
  strengths       JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses      JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  insight         JSONB NOT NULL,
  model_used      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_insight IS
  'AI-generated sales insights per brand from penjualan_harian KPIs.';

COMMENT ON COLUMN public.ai_insight.insight IS
  'Full insight payload: { summary, strengths, weaknesses, recommendations }.';

COMMENT ON COLUMN public.ai_insight.kpi_summary IS
  'Aggregated KPI snapshot sent to the AI for this run.';

CREATE INDEX IF NOT EXISTS ai_insight_brand_idx
  ON public.ai_insight (brand);

CREATE INDEX IF NOT EXISTS ai_insight_created_at_idx
  ON public.ai_insight (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_insight_brand_created_at_idx
  ON public.ai_insight (brand, created_at DESC);
