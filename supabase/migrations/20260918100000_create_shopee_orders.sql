-- =============================================================================
-- Migration: shopee_orders (order-level source of truth)
-- =============================================================================
-- Stores Shopee orders per order_sn so daily penjualan_harian rows can be
-- rebuilt from persisted orders instead of overwriting a date from a single
-- API window.
--
-- Does NOT modify existing production tables
-- (penjualan, penjualan_harian, affiliate*, livestream, ads_*).
--
-- Compatible with: PostgreSQL 14+, Supabase
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- shopee_orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopee_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id    UUID NOT NULL
                     REFERENCES public.marketplace_connections (id)
                     ON DELETE CASCADE,

  shop_id          TEXT NOT NULL,
  shop_name        TEXT,
  brand            TEXT,

  order_sn         TEXT NOT NULL,
  order_status     TEXT,
  currency         TEXT,

  create_time      TIMESTAMPTZ,
  update_time      TIMESTAMPTZ,
  pay_time         TIMESTAMPTZ,

  -- Calendar dates in Asia/Jakarta, used to rebuild penjualan_harian
  create_date      DATE,
  pay_date         DATE,
  update_date      DATE,

  total_amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  item_count       INTEGER NOT NULL DEFAULT 0,
  is_cancelled     BOOLEAN NOT NULL DEFAULT FALSE,

  raw              JSONB,

  last_synced_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT shopee_orders_shop_id_not_blank
    CHECK (length(trim(shop_id)) > 0),

  CONSTRAINT shopee_orders_order_sn_not_blank
    CHECK (length(trim(order_sn)) > 0),

  CONSTRAINT shopee_orders_item_count_non_negative
    CHECK (item_count >= 0),

  CONSTRAINT shopee_orders_shop_order_uidx
    UNIQUE (shop_id, order_sn)
);

COMMENT ON TABLE public.shopee_orders IS
  'Shopee order-level source of truth. UPSERT on (shop_id, order_sn); daily sales aggregates are rebuilt from this table for affected dates only.';

COMMENT ON COLUMN public.shopee_orders.id IS
  'Primary key (UUID).';
COMMENT ON COLUMN public.shopee_orders.connection_id IS
  'FK to marketplace_connections.id that owns this order.';
COMMENT ON COLUMN public.shopee_orders.shop_id IS
  'Shopee shop_id. Combined with order_sn for idempotent UPSERT.';
COMMENT ON COLUMN public.shopee_orders.shop_name IS
  'Shop display name at last sync.';
COMMENT ON COLUMN public.shopee_orders.brand IS
  'Brand copied from marketplace_connections.brand.';
COMMENT ON COLUMN public.shopee_orders.order_sn IS
  'Shopee order SN. Unique per shop.';
COMMENT ON COLUMN public.shopee_orders.order_status IS
  'Latest Shopee order_status (e.g. UNPAID, READY_TO_SHIP, COMPLETED, CANCELLED).';
COMMENT ON COLUMN public.shopee_orders.currency IS
  'Order currency code when provided by Shopee.';
COMMENT ON COLUMN public.shopee_orders.create_time IS
  'Shopee create_time (UTC).';
COMMENT ON COLUMN public.shopee_orders.update_time IS
  'Shopee update_time (UTC). Used for incremental sync.';
COMMENT ON COLUMN public.shopee_orders.pay_time IS
  'Shopee pay_time (UTC). Null when unpaid.';
COMMENT ON COLUMN public.shopee_orders.create_date IS
  'Asia/Jakarta calendar date of create_time. Feeds pesanan_masuk.';
COMMENT ON COLUMN public.shopee_orders.pay_date IS
  'Asia/Jakarta calendar date of pay_time. Feeds omzet and jumlah_produk_terjual.';
COMMENT ON COLUMN public.shopee_orders.update_date IS
  'Asia/Jakarta calendar date of update_time. Feeds pesanan_batal when cancelled.';
COMMENT ON COLUMN public.shopee_orders.total_amount IS
  'Shopee total_amount used as omzet for paid orders.';
COMMENT ON COLUMN public.shopee_orders.item_count IS
  'Sum of item_list.model_quantity_purchased.';
COMMENT ON COLUMN public.shopee_orders.is_cancelled IS
  'True when order_status is CANCELLED or IN_CANCEL.';
COMMENT ON COLUMN public.shopee_orders.raw IS
  'Last get_order_detail payload for diagnostics. Do not log at the application layer if it may contain PII.';
COMMENT ON COLUMN public.shopee_orders.last_synced_at IS
  'When this order row was last UPSERTed from the Shopee API.';
COMMENT ON COLUMN public.shopee_orders.created_at IS
  'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.shopee_orders.updated_at IS
  'Row last-update timestamp (UTC); maintained by trigger.';

CREATE INDEX IF NOT EXISTS shopee_orders_connection_id_idx
  ON public.shopee_orders (connection_id);

CREATE INDEX IF NOT EXISTS shopee_orders_shop_id_idx
  ON public.shopee_orders (shop_id);

CREATE INDEX IF NOT EXISTS shopee_orders_order_sn_idx
  ON public.shopee_orders (order_sn);

CREATE INDEX IF NOT EXISTS shopee_orders_shop_create_date_idx
  ON public.shopee_orders (shop_id, create_date);

CREATE INDEX IF NOT EXISTS shopee_orders_shop_pay_date_idx
  ON public.shopee_orders (shop_id, pay_date);

CREATE INDEX IF NOT EXISTS shopee_orders_shop_update_date_idx
  ON public.shopee_orders (shop_id, update_date);

CREATE INDEX IF NOT EXISTS shopee_orders_status_idx
  ON public.shopee_orders (order_status);

CREATE INDEX IF NOT EXISTS shopee_orders_last_synced_at_idx
  ON public.shopee_orders (last_synced_at DESC);

DROP TRIGGER IF EXISTS trg_shopee_orders_updated_at ON public.shopee_orders;

CREATE TRIGGER trg_shopee_orders_updated_at
  BEFORE UPDATE ON public.shopee_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
