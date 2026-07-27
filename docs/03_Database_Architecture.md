# Database Architecture

## Business Tables

Existing production tables (DO NOT MODIFY)

- penjualan
- penjualan_harian
- affiliate
- affiliate_weekly
- affiliate_monthly
- affiliate_paid
- livestream
- ads_shopee
- ads_tiktok
- ads_meta

These tables are considered production contracts with the frontend.

All marketplace integrations must write data compatible with these structures whenever possible.

---

## Integration Layer

New tables:

- marketplace_connections
- api_credentials
- sync_jobs
- sync_logs
- sync_errors

Purpose:

Store marketplace connections, OAuth tokens, scheduler configuration, synchronization history, and errors.

No existing production table may be modified by this migration.