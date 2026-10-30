-- Ordinal 77: the intent journal's delivery identity must admit the internal browser EXECUTION family.
--
-- Exactly ONE original single-column delivery_id CHECK is located, its COMPLETE definition is verified
-- against the applied 0001 predicate, and only then is that same constraint replaced by the widened one.
-- Zero, multiple or unexpected definitions RAISE before any ALTER, so an unknown schema can never be
-- reported as an applied no-op.
--
-- No table, column, index, grant or record rule changes: the record stays exactly
-- {operation,argumentsSha256} and the state/outcome/immutability/retention rules are untouched.
DO $$
DECLARE
  constraint_name text;
  definition text;
  matches integer;
BEGIN
  SELECT count(*) INTO matches
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
   WHERE ns.nspname = 'meri_intents'
     AND rel.relname = 'preparations'
     AND con.contype = 'c'
     AND cardinality(con.conkey) = 1
     AND att.attname = 'delivery_id'
     AND pg_get_constraintdef(con.oid) LIKE '%delivery_id ~%';
  IF matches <> 1 THEN
    RAISE EXCEPTION 'MERI_INTENT_DELIVERY_CHECK_NOT_UNIQUE: %', matches;
  END IF;

  SELECT con.conname, pg_get_constraintdef(con.oid) INTO constraint_name, definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
   WHERE ns.nspname = 'meri_intents'
     AND rel.relname = 'preparations'
     AND con.contype = 'c'
     AND cardinality(con.conkey) = 1
     AND att.attname = 'delivery_id'
     AND pg_get_constraintdef(con.oid) LIKE '%delivery_id ~%';

  -- The applied 0001 constraint is exactly the anchored sdk-only predicate. Only the two known
  -- renderings of that same expression are accepted; anything else (including an already widened
  -- constraint) refuses instead of silently succeeding.
  IF definition NOT IN (
      'CHECK ((delivery_id ~ ''^sdk:[a-f0-9]{64}$''::text))',
      'CHECK ((delivery_id ~ ''^sdk:[a-f0-9]{64}$''))'
     )
  THEN
    RAISE EXCEPTION 'MERI_INTENT_DELIVERY_CHECK_UNEXPECTED: %', definition;
  END IF;

  EXECUTE format('ALTER TABLE meri_intents.preparations DROP CONSTRAINT %I', constraint_name);
  EXECUTE format('ALTER TABLE meri_intents.preparations ADD CONSTRAINT %I CHECK (delivery_id ~ %L)',
    constraint_name, '^(sdk|browser):[a-f0-9]{64}$');
END
$$;
