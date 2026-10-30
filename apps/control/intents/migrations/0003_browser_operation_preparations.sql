-- Ordinal 77: the intent journal's delivery identity must admit the internal browser EXECUTION family.
--
-- Only the existing delivery_id CHECK is extended, from `sdk:<64 hex>` to `sdk:` or `browser:` plus
-- 64 hex. No table, column, index, grant or record rule changes; the record stays exactly
-- {operation,argumentsSha256} and the state/outcome/immutability/retention rules are untouched.
--
-- The original constraint is located by its verified definition and attribute (single-column constraint
-- on delivery_id in meri_intents.preparations), never by a guessed generated name.
DO $$
DECLARE constraint_name text;
BEGIN
 FOR constraint_name IN
  SELECT con.conname
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
  WHERE ns.nspname = 'meri_intents'
    AND rel.relname = 'preparations'
    AND con.contype = 'c'
    AND cardinality(con.conkey) = 1
    AND att.attname = 'delivery_id'
    AND pg_get_constraintdef(con.oid) LIKE '%sdk:[a-f0-9]%'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%browser:%'
 LOOP
  EXECUTE format('ALTER TABLE meri_intents.preparations DROP CONSTRAINT %I', constraint_name);
  EXECUTE format('ALTER TABLE meri_intents.preparations ADD CONSTRAINT %I CHECK (delivery_id ~ %L)',
   constraint_name, '^(sdk|browser):[a-f0-9]{64}$');
 END LOOP;
END
$$;
