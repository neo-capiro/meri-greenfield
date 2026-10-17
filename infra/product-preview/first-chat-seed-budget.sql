-- Meri first-chat preview Stage 1 seed (change set D1, Neo, 17 October 2026).
-- The single global product budget row: cap 25,000,000 microUSD ($25), non-resetting.
-- Applied once by first-chat-migrate.mjs as meri_product_migrator, inside the runner's own transaction,
-- after apps/gateway/budget/migrations/0002_tenant_budgets.sql. No runtime role can INSERT here or
-- change cap_micro_usd. A later cap change is a separately reviewed UPDATE, never a re-seed.
INSERT INTO meri_product_budget.budget (id, cap_micro_usd, consumed_micro_usd, quarantined)
VALUES (1, 25000000, 0, false)
ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
 IF (SELECT cap_micro_usd FROM meri_product_budget.budget WHERE id = 1) IS DISTINCT FROM 25000000 THEN
  RAISE EXCEPTION 'MERI_D2_BUDGET_SEED_CONFLICT';
 END IF;
END $$;
