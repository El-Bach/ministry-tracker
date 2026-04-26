-- migration_transaction_rate.sql
-- Snapshot the exchange rate at the moment each transaction is recorded.
-- Existing rows get NULL → UI falls back to the current org rate (backward compatible).

ALTER TABLE file_transactions
  ADD COLUMN IF NOT EXISTS rate_usd_lbp NUMERIC(14,4);

COMMENT ON COLUMN file_transactions.rate_usd_lbp IS
  'Exchange rate (LBP per 1 USD) locked at the moment this transaction was created. '
  'NULL on legacy rows — callers fall back to the current org rate.';
