# Shopee API Mapping — Kilap Premium Reporting

**Document:** `docs/06_Shopee_API_Mapping.md`  
**Sprint:** 2 — Task 005A  
**Purpose:** Map Shopee Open API v2 endpoints to Kilap reporting modules **before** expanding sync implementations.  
**Base URL (Live / SG):** `https://partner.shopeemobile.com`  
**Auth storage:** `marketplace_connections` (`access_token`, `refresh_token`, `shop_id`, `partner_id`)

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Implemented** | Used in production code today (`lib/marketplace/providers/shopee.js` or legacy routes) |
| **Planned** | Required for Kilap modules; design is clear; implement after partner permissions are confirmed |
| **Waiting for Partner approval** | Needs Shopee Open Platform app permission / AMS / Ads / Live product enablement before live use |

---

## 0. Authentication (shared foundation)

> Not a reporting module, but required by every shop-scoped API below.

| Field | Detail |
|-------|--------|
| **API product/module** | Authorization & Authentication |
| **Authentication method** | Public API HMAC for auth URLs/token; Shop API HMAC for data calls |
| **Signature (Public)** | `HMAC-SHA256(partner_id + path + timestamp, partner_key)` |
| **Signature (Shop)** | `HMAC-SHA256(partner_id + path + timestamp + access_token + shop_id, partner_key)` |
| **Env vars** | `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `NEXT_PUBLIC_APP_URL` |

### Endpoints

| Endpoint | Method | Required params | Response fields (Kilap) | Status |
|----------|--------|-----------------|-------------------------|--------|
| `/api/v2/shop/auth_partner` | GET (redirect) | `partner_id`, `timestamp`, `sign`, `redirect` | OAuth authorize URL → `code`, `shop_id` | **Implemented** (`connect`) |
| `/api/v2/auth/token/get` | POST | Body: `code`, `shop_id`, `partner_id` + query sign | `access_token`, `refresh_token`, `expire_in`, `shop_id` | **Implemented** (`callback`) |
| `/api/v2/auth/access_token/get` | POST | Body: `refresh_token`, `shop_id`, `partner_id` + query sign | `access_token`, `refresh_token`, `expire_in` | **Planned** (`refreshToken` TODO) |

**Permission / scope:** Shop authorization for the seller shop; partner app must be approved for the target region (ID).

**Kilap mapping:** Persist tokens into `marketplace_connections` (`marketplace='shopee'`, `status='active'`).

---

## 1. Shop Performance / Sales

| Field | Detail |
|-------|--------|
| **Kilap module** | Sales / Dashboard Utama (`/penjualan`) |
| **Target table** | `penjualan_harian` |
| **API product/module** | Order API (primary for GMV/orders); optional Shop / Account Health later |
| **Authentication method** | Shop API (access_token + shop_id + sign) |
| **Required permission** | Order read permission on partner app |

### Endpoints

| Endpoint | Method | Required parameters | Response fields needed by Kilap | Maps to `penjualan_harian` | Status |
|----------|--------|---------------------|---------------------------------|----------------------------|--------|
| `/api/v2/order/get_order_list` | GET | `partner_id`, `timestamp`, `access_token`, `shop_id`, `sign`, `time_range_field=create_time`, `time_from`, `time_to`, `page_size`, `cursor` | `order_list[].order_sn`, `order_status`, `more`, `next_cursor` | Used to discover orders in date window | **Implemented** (`sync`) |
| `/api/v2/order/get_order_detail` | GET | Common shop params + `order_sn_list` (max 50), `response_optional_fields=total_amount` | `create_time`, `order_status`, `total_amount` | Aggregated → `omzet`, `pesanan_masuk`, `pesanan_batal`, `cancel_rate`, `aov_order`, `channel='Shopee'`, `tanggal` | **Implemented** (`sync`) |
| `/api/v2/shop/get_shop_info` | GET | Common shop params | `shop_name`, region, status | Enrich `marketplace_connections.shop_name` | **Planned** (was PoC; not in current sales sync path) |
| `/api/v2/account_health/get_shop_performance` | GET | Common shop params | Metric list (cancellation, fulfillment, rating) | Optional ops KPIs — **not** primary GMV source | **Waiting for Partner approval** / **Planned** |

### Kilap field mapping (current sync aggregation)

| Kilap column | Source |
|--------------|--------|
| `tanggal` | Date of `create_time` |
| `channel` | Hardcoded `'Shopee'` |
| `omzet` | Sum of `total_amount` for non-cancelled orders |
| `pesanan_masuk` | Count of orders |
| `pesanan_batal` | Count where status `CANCELLED` / `IN_CANCEL` |
| `cancel_rate` | `pesanan_batal / pesanan_masuk * 100` |
| `aov_order` | `omzet / (pesanan_masuk - pesanan_batal)` |
| `pengunjung_toko`, `omzet_ads`, `omzet_affiliate`, … | **Not available** from Order APIs — leave null / existing values; need Ads/AMS later |

**Notes:**
- `get_order_list` max range is **15 days** per call; chunk longer windows.
- Visitor / CVR require traffic analytics APIs (often restricted) — mark as future gap.

---

## 2. Shopee Ads

| Field | Detail |
|-------|--------|
| **Kilap module** | Performance Marketing → Shopee Ads (`/ads`, table `ads_shopee`) |
| **API product/module** | Shopee On-Platform Ads API (`v2.ads.*`) |
| **Authentication method** | Shop API (access_token + shop_id + sign) |
| **Required permission** | Ads API / Marketing permission enabled on partner app; seller must have Ads active |

### Endpoints (planned set)

| Endpoint | Method | Required parameters | Response fields needed by Kilap | Maps to `ads_shopee` | Status |
|----------|--------|---------------------|---------------------------------|----------------------|--------|
| `/api/v2/ads/get_total_balance` (or region equivalent) | GET | Common shop params | Balance / budget context | Optional UI only | **Waiting for Partner approval** |
| `/api/v2/ads/get_all_cpc_ads_daily_performance` *(name may vary by region/version)* | GET | Common shop params + date range | impressions, clicks, expense, GMV/orders from ads | `impresi`, `klik`, `biaya_iklan`, `omzet`, `pesanan`, derive `ctr`, `cpc`, `cpm`, `roi`, `cpa`, `aov` | **Waiting for Partner approval** |
| Campaign list / performance APIs (`v2.ads.*`) | GET | Common shop params + campaign filters | `campaign_name`, daily metrics | `nama_kampanye`, `tanggal`, funnel metrics | **Waiting for Partner approval** |

### Kilap fields (`ads_shopee`)

| Kilap column | Needed from Ads API |
|--------------|---------------------|
| `tanggal` | Report date |
| `nama_kampanye` / `tipe_kampanye` | Campaign metadata |
| `impresi`, `klik`, `ctr`, `cpc`, `cpm` | Awareness / consideration |
| `atc`, `rasio_atc` | Intent (if available) |
| `pesanan`, `cvr`, `produk_terjual` | Conversion |
| `biaya_iklan`, `omzet`, `roi`, `cpa`, `aov` | Spend & return |

**Status summary:** Entire Ads sync = **Waiting for Partner approval** (then **Planned** implementation). Manual Excel upload remains the current data path.

---

## 3. Affiliate Marketing Solution (AMS)

| Field | Detail |
|-------|--------|
| **Kilap module** | Affiliate (`/affiliate`) |
| **Target tables** | `affiliate_monthly`, `affiliate_weekly`, `affiliate_paid` |
| **API product/module** | Affiliate Marketing Solutions (AMS) — `v2.ams.*` |
| **Authentication method** | Shop API + AMS-enabled partner app type |
| **Required permission** | App type **Affiliate Marketing Solution Management**; seller must accept AMS T&C in Seller Center |

### Endpoints

| Endpoint | Method | Required parameters | Response fields needed by Kilap | Maps to | Status |
|----------|--------|---------------------|---------------------------------|---------|--------|
| `/api/v2/ams/get_shop_performance` | GET | Common shop params + period (`start_date` / `end_date` / period type) | Shop-level sales, orders, ROI-related AMS KPIs | `affiliate_weekly` / `affiliate_monthly` aggregates | **Waiting for Partner approval** |
| `/api/v2/ams/get_affiliate_performance` | GET | Common shop params + date range + pagination | Affiliate GMV, commission, content counts | `affiliate_paid` (`nama_partner`, `gmv`, `cost`/`komisi_shopee`, `roi`, `items_sold`, …) | **Waiting for Partner approval** |
| `/api/v2/ams/get_product_performance` | GET | Common shop params + `order_type`, dates | Product sales, orders, clicks, est_commission, ROI | Optional product-level analysis | **Waiting for Partner approval** |
| `/api/v2/ams/get_content_performance` | GET | Common shop params + dates | Live / Video content GMV & engagement | Bridge to Livestream + Affiliate content KPIs | **Waiting for Partner approval** |
| `/api/v2/ams/get_performance_data_update_time` | GET | Common shop params | Latest AMS data freshness timestamp | Sync scheduling / UI freshness | **Waiting for Partner approval** |
| `/api/v2/ams/get_campaign_key_metrics_performance` | GET | Common shop params + campaign filters | Campaign GMV, commission, ROI | Campaign reporting (future) | **Waiting for Partner approval** |

### Kilap fields (examples)

| Table | Columns to fill from AMS |
|-------|---------------------------|
| `affiliate_weekly` / `affiliate_monthly` | `gmv`, `cost` / komisi, `take_rate_gmv`, `total_affiliate`, `affiliate_acquisition`, growth fields |
| `affiliate_paid` | `nama_partner`, `platform='Shopee'`, `gmv`, `cost`, `roi`, `items_sold`, `jumlah_konten`, `jumlah_live`, `komisi_shopee` |

**Also:** Sales table columns `omzet_affiliate`, `biaya_affiliate`, `pesanan_affiliate`, `roi_affiliate` on `penjualan_harian` can be backfilled from AMS daily aggregates once approved.

---

## 4. Livestream

| Field | Detail |
|-------|--------|
| **Kilap module** | Livestream (`/livestream`) |
| **Target table** | `livestream` |
| **API product/module** | Livestream Open API (`v2.livestream.*` or region-equivalent) **and/or** AMS content performance for Live |
| **Authentication method** | Shop API |
| **Required permission** | Livestream API product enabled on partner app |

### Endpoints

| Endpoint | Method | Required parameters | Response fields needed by Kilap | Maps to `livestream` | Status |
|----------|--------|---------------------|---------------------------------|----------------------|--------|
| Livestream session list / detail APIs (`v2.livestream.*`) | GET | Common shop params + date range | Session time, host/streamer id/name, duration, GMV, orders, viewers | `tanggal`, `nama_host`, `platform='Shopee'`, `jadwal_sesi`, `durasi_jam`, `gmv`, `pesanan`, `penonton` | **Waiting for Partner approval** |
| `/api/v2/ams/get_content_performance` | GET | Common shop params + dates; filter Live content | Live GMV, orders, views | Partial mapping if Live API unavailable | **Waiting for Partner approval** |

### Kilap fields

| Kilap column | Needed from API |
|--------------|-----------------|
| `tanggal` | Session date |
| `nama_host` | Host / streamer name |
| `platform` | `'Shopee'` |
| `brand` | Not from Shopee — set in app / connection metadata |
| `jadwal_sesi` | Derived from session start/end |
| `durasi_jam` | Session duration |
| `gmv`, `pesanan`, `penonton` | Session performance |
| TikTok-only fields (`ctr_tiktok`, …) | N/A for Shopee |

**Status summary:** **Waiting for Partner approval**. Manual input remains current path.

---

## 5. Orders

| Field | Detail |
|-------|--------|
| **Kilap module** | Sales sync foundation (and future dedicated Order views) |
| **API product/module** | Order API |
| **Authentication method** | Shop API |
| **Required permission** | Order read |

### Endpoints

| Endpoint | Method | Required parameters | Response fields needed by Kilap | Status |
|----------|--------|---------------------|---------------------------------|--------|
| `/api/v2/order/get_order_list` | GET | See Sales section | `order_sn`, status, pagination | **Implemented** |
| `/api/v2/order/get_order_detail` | GET | `order_sn_list`, optional fields | `total_amount`, `create_time`, `order_status`, item_list (future SKU reports) | **Implemented** |
| `/api/v2/order/get_shipment_list` *(if enabled)* | GET | Common shop params | Logistics / pickup failure signals | **Planned** (for `jumlah_gagal_pickup` / fail rates) |
| Return / cancel APIs | GET | Common shop params | Return-refund rates | **Planned** |

**Note:** Order APIs currently feed **Sales** aggregation into `penjualan_harian`. A dedicated Order module UI is out of scope for Sprint 2 sync, but the same endpoints apply.

---

## Cross-module summary

| Module | Primary APIs | Kilap tables | Overall status |
|--------|--------------|--------------|----------------|
| Auth | `auth_partner`, `token/get`, `access_token/get` | `marketplace_connections` | **Implemented** (+ refresh **Planned**) |
| Shop Performance / Sales | `order/get_order_list`, `order/get_order_detail` | `penjualan_harian` | **Implemented** (partial metrics) |
| Shopee Ads | `v2.ads.*` performance APIs | `ads_shopee` | **Waiting for Partner approval** |
| Affiliate (AMS) | `v2.ams.get_*_performance` | `affiliate_*`, affiliate cols on `penjualan_harian` | **Waiting for Partner approval** |
| Livestream | `v2.livestream.*` and/or `ams.get_content_performance` | `livestream` | **Waiting for Partner approval** |
| Orders | Order list/detail (+ logistics later) | Sales aggregation; future Order UI | **Implemented** (as Sales source) |

---

## Implementation notes for Kilap

1. **Reuse existing business tables** — never create parallel Shopee-only sales tables; write into `penjualan_harian`, `ads_shopee`, `affiliate_*`, `livestream`.
2. **Partner Console checklist** — enable products: Shop/Order, Ads, AMS, Livestream (as needed). AMS requires AMS app type + seller T&C.
3. **Token lifecycle** — access tokens expire (~4h); implement `refreshToken()` before Ads/AMS cron sync.
4. **Gaps after Order-based Sales sync** — store visitors, ads omzet, affiliate omzet still need Ads/AMS (or remain manual).
5. **Legacy routes** — `app/api/shopee-auth` and `app/api/shopee-callback` remain available; new flow uses `/api/marketplace/*` + `lib/marketplace/providers/shopee.js`.

---

## Document history

| Date | Change |
|------|--------|
| 2026-08-01 | Initial mapping (Sprint 2 — Task 005A) |
