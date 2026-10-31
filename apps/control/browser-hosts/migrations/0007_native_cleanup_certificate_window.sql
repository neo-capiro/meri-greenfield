-- C2 source preparation only. Separate successor after exact qualified observer delta.
-- ServerAuth cleanup window only; workload/client authority remains at original lease.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
LOCK TABLE meri_host_control.host_allocations IN ACCESS EXCLUSIVE MODE;
DO $predecessor$
BEGIN
 IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='meri_host_control.host_allocations'::regclass)) IS DISTINCT FROM current_user THEN RAISE EXCEPTION 'NATIVE_C2_OWNER'; END IF;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocations_check' AND convalidated AND pg_get_constraintdef(oid)='CHECK (((client_cert_not_after_ms <= lease_deadline_ms) AND (server_cert_not_after_ms <= lease_deadline_ms)))') THEN RAISE EXCEPTION 'NATIVE_C2_EXPIRY_PREDECESSOR'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.guard_allocation()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='ee96403bf8406b9b98e15db632f77ce39cb84ceba6c7088b18ebbd95e7536367' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.guard_allocation()'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.guard_native_observer()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='24b998630c9116f54bc7efaf236fc45fae7a0b6a67c2d8094f3bc15361ba5883' AND prosecdef=true AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.guard_native_observer()'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_context(jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='fb01a4f62f8a3eb5e8cc6de5c14cf08383b8a6fe675d722eb327622cd90aad93' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_context(jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_discovery(jsonb,text,text,text,numeric)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='8bdf592dd989e7471e20a9a79da9b172166f9bce66a856ebcc6d4ed42121718d' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_discovery(jsonb,text,text,text,numeric)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_event(jsonb,text)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='bfee54f4ffccf71bcaed0d41667190f76c13b60454b597fd2ca95846721e11b6' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_event(jsonb,text)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_facts(jsonb,jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='bf9da9943919049e484eeddf4a346b9f9abb62ca2a5d58709c7df1980f55f72f' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_facts(jsonb,jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_full_commit()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='13f35934aefc819a195471ea3ed5df5c92b19fd47d8b1d26ea50412c824efe48' AND prosecdef=true AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_full_commit()'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_hash(text)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='a7668c5ec5661ce809cf17b0d9c7ceee93b8da13ea8408fe0ebf5c71ad030a91' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_hash(text)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_history_event(jsonb,jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='ab2a7631a78fc08ba97ee42f6139961a43f246080a94e7acc1124fc68604d4d5' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_history_event(jsonb,jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_int(jsonb,numeric,numeric)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='14216fcf5b7c96ff0f46c818f57cc9416b4b36320ef8206b70fe269677f8900e' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_int(jsonb,numeric,numeric)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_journal(jsonb,jsonb,text,numeric)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='1696fd52ea3b22bb29f3042492c70950a35b6e8cc019d84f80ead6f724e0fd19' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_journal(jsonb,jsonb,text,numeric)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_managed(jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='f98c42bcabe054e9680c5b44ab96ca5f8d434207889a4f6d2301fff1254862d3' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_managed(jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_object(jsonb,text[])') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='80966ae69c988ea9edaec521905dd86771155661289ffb3a7ef60f2968a4dfc5' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_object(jsonb,text[])'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_raw(text,text[])') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='c1bc0d9438c7936f335313297f819a3313f1cdf9542cac6718d2e5c62db3a607' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_raw(text,text[])'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_request(jsonb,text,text,jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='329849644ba3929c6ea406d465c11648a863c639e5cc78261928a5dbdbbaf53f' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_request(jsonb,text,text,jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_require(boolean,text)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='5925f180b47a5395b1e55c6343484c23a3a501aede858d9e7e8fbdf676d7e6b0' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_require(boolean,text)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_resources(jsonb,text,jsonb)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='b2f99ea8ce996297399e48dacc35e0bfba7e7e1ffd14b34c37de46e354e572f4' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_resources(jsonb,text,jsonb)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_size(text)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='7e2d88244c463ce85fe072e1100efcec1d94a6850126f4f1d1db1f05afb0420f' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_size(text)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_strings(jsonb,text,integer,integer,boolean)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='88398c8c1b35c7399fea50e84f567387e8af770456c2141052a5c62d7e1b479c' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_strings(jsonb,text,integer,integer,boolean)'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.observer_verified(jsonb,text,jsonb,numeric)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='8906b066e4f69c38d03d38636620d1d5e55dd13571e70d16be0d302ab2b07496' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'NATIVE_C2_FUNCTION_PREDECESSOR: %','meri_host_control.observer_verified(jsonb,text,jsonb,numeric)'; END IF;
END $predecessor$;
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocations_check;
ALTER TABLE meri_host_control.host_allocations ADD CONSTRAINT host_allocation_certificate_window CHECK (
 -- Preserve the complete old predicate, including its pre-effect NULL behavior.
 (client_cert_not_after_ms<=lease_deadline_ms AND server_cert_not_after_ms<=lease_deadline_ms)
 OR (
  client_cert_not_after_ms<=lease_deadline_ms
  AND server_cert_not_after_ms<=(lease_deadline_ms::numeric+25000)
  AND allocation_json->>'hostMode'='native-processing'
  AND declaration_json->>'schema'='meri-native-provisioning-declaration/2'
  AND declaration_json->'leaseDeadlineMs'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>>'{watchdog,schema}'='meri-native-watchdog-intent/1'
  AND declaration_json#>>'{watchdog,input,schema}'='meri-native-watchdog-input/2'
  AND declaration_json#>'{watchdog,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>'{watchdog,cleanupCeilingMs}'=to_jsonb(lease_deadline_ms::numeric+25000)
  AND declaration_json#>'{watchdog,deadlineMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND declaration_json#>'{watchdog,input,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>'{watchdog,input,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json->>'schema'='meri-native-physical-contexts/2'
  AND native_physical_context_json#>>'{managed,phase}'='managed'
  AND native_physical_context_json#>'{managed,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND native_physical_context_json#>'{managed,startedAtMs}'=to_jsonb(lease_deadline_ms)
  AND native_physical_context_json#>'{managed,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json#>'{managed,deadlineMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json#>>'{managed,declarationSha256}'=declaration_sha256::text
  AND bootstrap_prepare_json->>'state'='succeeded'
  AND bootstrap_install_json->>'state'='succeeded'
  AND bootstrap_prepare_json#>'{observation,scope}'=bootstrap_install_json#>'{observation,scope}'
  AND bootstrap_prepare_json#>'{observation,scope,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND bootstrap_install_json#>'{observation,scope,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
 ) IS TRUE
);
COMMENT ON CONSTRAINT host_allocation_certificate_window ON meri_host_control.host_allocations IS 'C2: original workload/client lease unchanged; serverAuth cleanup extension only for /2 with matching original watchdog/context and protected successful bootstrap scope. Actual certificate lifetime proof remains source-owned.';
COMMIT;
