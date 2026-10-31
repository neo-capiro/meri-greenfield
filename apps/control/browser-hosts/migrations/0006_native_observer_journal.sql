-- PREPARATION ONLY: additive observer storage after exact qualified SQL117.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
LOCK TABLE meri_host_control.host_allocations IN ACCESS EXCLUSIVE MODE;
DO $check$
BEGIN
 IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='meri_host_control.host_allocations'::regclass)) IS DISTINCT FROM current_user THEN RAISE EXCEPTION 'NATIVE_OBSERVER_OWNER'; END IF;
 IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='meri_host_control.guard_allocation()'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '88d64d95b091a04d663a21e95ee01e5e3e0301a9bbf16e302374590100693aae' THEN RAISE EXCEPTION 'NATIVE_OBSERVER_GUARD_PREDECESSOR'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='meri_host_control' AND (p.proname LIKE 'observer_%' OR p.proname='guard_native_observer')) THEN RAISE EXCEPTION 'NATIVE_OBSERVER_ALREADY_PRESENT'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='meri_host_allocator' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls) THEN RAISE EXCEPTION 'NATIVE_OBSERVER_ALLOCATOR'; END IF;
 IF encode(sha256(convert_to((SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='native_declaration_shape'),'UTF8')),'hex') IS DISTINCT FROM '9a4c442eabbcb7dff19908952941491c7c8982b2fb4920da1ec6055da3bec67f' THEN RAISE EXCEPTION 'NATIVE_OBSERVER_CONSTRAINT_PREDECESSOR'; END IF;
END $check$;


CREATE FUNCTION meri_host_control.observer_require(ok boolean, label text) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'NATIVE_OBSERVER_%',label; END IF; END $$;
CREATE FUNCTION meri_host_control.observer_object(v jsonb, keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(v)='object' AND v ?& keys AND v-keys='{}'::jsonb,false)
$$;
CREATE FUNCTION meri_host_control.observer_int(v jsonb, minimum numeric DEFAULT 0, maximum numeric DEFAULT 9007199254740991) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN jsonb_typeof(v)='number' THEN (v::text)::numeric BETWEEN minimum AND maximum AND trunc((v::text)::numeric)=(v::text)::numeric ELSE false END
$$;
CREATE FUNCTION meri_host_control.observer_strings(v jsonb, pattern text, minimum integer DEFAULT 0, maximum integer DEFAULT 256, sorted boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE e jsonb; previous text; seen text[]:='{}';
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(v)<minimum OR jsonb_array_length(v)>maximum THEN RETURN false; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF jsonb_typeof(e)<>'string' OR (e#>>'{}') !~ pattern OR (e#>>'{}')=ANY(seen) OR (sorted AND previous IS NOT NULL AND (e#>>'{}') COLLATE "C"<=previous COLLATE "C") THEN RETURN false; END IF;
  previous:=e#>>'{}';seen:=array_append(seen,previous);
 END LOOP; RETURN true;
END $$;
-- Extract an exact value's bytes from already parsed JSON text. This is NOT a
-- second canonical serializer: keys/values are never re-encoded or sorted.
CREATE FUNCTION meri_host_control.observer_raw(t text, route text[]) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
 SELECT json_extract_path(t::json,VARIADIC route)::text
$$;
CREATE FUNCTION meri_host_control.observer_hash(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(t,'UTF8')),'hex') $$;
CREATE FUNCTION meri_host_control.observer_size(t text) RETURNS integer
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$ SELECT octet_length(convert_to(t,'UTF8')) $$;
CREATE FUNCTION meri_host_control.observer_event(j jsonb, id text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT e FROM jsonb_array_elements(j->'entries') e WHERE e->>'operationId'=id $$;

ALTER TABLE meri_host_control.host_allocations
 ADD COLUMN native_physical_context_json jsonb,
 ADD COLUMN native_physical_context_sha256 text,
 ADD COLUMN native_physical_context_canonical text,
 ADD COLUMN native_physical_resources_json jsonb,
 ADD COLUMN native_physical_resources_sha256 text,
 ADD COLUMN native_physical_resources_canonical text,
 ADD COLUMN native_physical_dispatch_json jsonb,
 ADD COLUMN native_physical_dispatch_sha256 text,
 ADD COLUMN native_physical_dispatch_canonical text,
 ADD COLUMN native_physical_dispatch_result_json jsonb,
 ADD COLUMN native_physical_dispatch_result_sha256 text,
 ADD COLUMN native_physical_dispatch_result_canonical text,
 ADD COLUMN native_physical_observations_json jsonb,
 ADD COLUMN native_physical_observations_sha256 text,
 ADD COLUMN native_physical_observations_canonical text,
 ADD COLUMN native_physical_result_json jsonb,
 ADD COLUMN native_physical_result_sha256 text,
 ADD COLUMN native_physical_result_canonical text;
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT native_declaration_shape;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_declaration_shape CHECK((
  (allocation_json->>'hostMode' IS DISTINCT FROM 'native-processing'
   AND declaration_json IS NULL AND declaration_sha256 IS NULL)
  OR
  (allocation_json->>'hostMode'='native-processing'
   AND jsonb_typeof(declaration_json)='object'
   AND char_length(declaration_sha256)=64 AND declaration_sha256 ~ '^[0-9a-f]{64}$'
   AND jsonb_typeof(declaration_json)='object'
   AND declaration_json->>'schema' IN ('meri-native-provisioning-declaration/1','meri-native-provisioning-declaration/2')
   AND declaration_json->>'accountId' ~ '^[0-9]{12}$'
   AND declaration_json->>'region'='us-east-1'
   AND declaration_json->>'imageDigest' ~ '^sha256:[0-9a-f]{64}$'
   AND declaration_json->>'token' ~ '^[0-9a-f]{64}$'
   AND declaration_json->'leaseDeadlineMs'=to_jsonb(lease_deadline_ms)
   AND declaration_json->'placement'->>'subnetId'=declaration_json->'launch'->>'SubnetId'
   AND declaration_json->'placement'->>'iamInstanceProfile'=declaration_json->'launch'->'IamInstanceProfile'->>'Name')
  OR
  -- historical complete native rows admitted before this extension remain valid
  (allocation_json->>'hostMode'='native-processing' AND declaration_json IS NULL AND declaration_sha256 IS NULL
   AND state IN ('active','revoked','quarantined','terminated')
   AND host_identity_json IS NOT NULL AND endpoint_json IS NOT NULL)
 ) IS TRUE);
CREATE FUNCTION meri_host_control.observer_context(r jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE d jsonb:=r->'declaration_json'; w jsonb:=d->'watchdog'; i jsonb:=w->'input'; p jsonb:=d->'placement'; l jsonb:=d->'launch'; o jsonb:=d->'physicalObserver'; c jsonb:=r->'native_physical_context_json'; m jsonb:=c->'managed'; v jsonb; name text; keys text[]; hex text:='^[0-9a-f]{64}$';
BEGIN
 PERFORM meri_host_control.observer_require(
  meri_host_control.observer_object(d-ARRAY['nativeHelperSha256','maxLifetimeMs'],ARRAY['schema','imageDigest','sourceCommit','bootstrapSha256','accountId','region','placement','launch','token','tags','leaseDeadlineMs','bootstrapSpec','watchdog','physicalObserver','launchTagPolicy'])
  AND d->>'schema'='meri-native-provisioning-declaration/2' AND d->>'launchTagPolicy'='instance-and-root-volume-owner-tags/1'
  AND d->>'imageDigest'=r#>>'{allocation_json,imageDigest}' AND d->>'sourceCommit'~'^[0-9a-f]{40}$'
  AND d->>'bootstrapSha256'~hex AND d->>'accountId'~'^[0-9]{12}$' AND d->>'region'='us-east-1' AND d->>'token'~hex
  AND d->'leaseDeadlineMs'=r->'lease_deadline_ms' AND d#>>'{tags,MeriProvisionToken}'=d->>'token'
  AND (NOT d?'nativeHelperSha256' OR d->>'nativeHelperSha256'~hex)
  AND (NOT d?'maxLifetimeMs' OR meri_host_control.observer_int(d->'maxLifetimeMs',60000)),'DECLARATION');
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(o,ARRAY['schema','protocol','bridgeFunctionVersionArn','route','authenticationPrincipal'])
  AND o->>'schema'='meri-native-managed-observer/1' AND o->>'protocol'='native-observer-around-managed/1'
  AND o->>'route'='/v1/execution/native/physical-observer' AND o->>'authenticationPrincipal'='native-watchdog-observer-v1'
  AND o->>'bridgeFunctionVersionArn'~('^arn:aws:lambda:us-east-1:'||(d->>'accountId')||':function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$'),'OBSERVER');
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(p,ARRAY['availabilityZone','vpcId','subnetId','securityGroupIds','iamInstanceProfile'])
  AND meri_host_control.observer_object(l,ARRAY['ImageId','InstanceType','SubnetId','SecurityGroupIds','IamInstanceProfile'])
  AND meri_host_control.observer_object(l->'IamInstanceProfile',ARRAY['Name'])
  AND p->>'availabilityZone'~'^us-east-1[a-z]$' AND p->>'vpcId'~'^vpc-([0-9a-f]{8}|[0-9a-f]{17})$'
  AND p->>'subnetId'~'^subnet-([0-9a-f]{8}|[0-9a-f]{17})$'
  AND meri_host_control.observer_strings(p->'securityGroupIds','^sg-([0-9a-f]{8}|[0-9a-f]{17})$',1,1)
  AND l->'SecurityGroupIds'=p->'securityGroupIds' AND l->>'SubnetId'=p->>'subnetId'
  AND l#>>'{IamInstanceProfile,Name}'=p->>'iamInstanceProfile' AND length(p->>'iamInstanceProfile') BETWEEN 1 AND 128
  AND l->>'ImageId'~'^ami-([0-9a-f]{8}|[0-9a-f]{17})$' AND l->>'InstanceType'~'^[a-z0-9-]+\.[a-z0-9]+$','PLACEMENT');
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(w,ARRAY['schema','executionName','executionArn','stateMachineVersionArn','definitionSha256','qualificationEvidenceSha256','t0Ms','deadlineMs','leaseDeadlineMs','cleanupCeilingMs','inputSha256','input'])
  AND w->>'schema'='meri-native-watchdog-intent/1' AND w->>'definitionSha256'~hex AND w->>'qualificationEvidenceSha256'~hex AND w->>'inputSha256'~hex
  AND w->>'executionArn'~('^arn:aws:states:us-east-1:'||(d->>'accountId')||':execution:[A-Za-z0-9_-]{1,80}:'||(r->>'host_id')||'-g'||(r->>'generation')||'$')
  AND w->>'stateMachineVersionArn'~('^arn:aws:states:us-east-1:'||(d->>'accountId')||':stateMachine:[A-Za-z0-9_-]{1,80}:[1-9][0-9]*$')
  AND w->>'executionName'=(r->>'host_id')||'-g'||(r->>'generation')
  AND meri_host_control.observer_int(w->'t0Ms',1) AND meri_host_control.observer_int(w->'leaseDeadlineMs',1)
  AND meri_host_control.observer_int(w->'cleanupCeilingMs',1) AND w->'leaseDeadlineMs'=r->'lease_deadline_ms'
  AND (w->>'t0Ms')::numeric<(w->>'leaseDeadlineMs')::numeric
  AND (w->>'cleanupCeilingMs')::numeric=(w->>'leaseDeadlineMs')::numeric+25000
  AND w->'deadlineMs'=w->'cleanupCeilingMs','WATCHDOG');
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(i-'nativeHelperSha256',ARRAY['schema','hostId','generation','accountId','region','allocationSha256','sourceCommit','imageDigest','bootstrapSha256','placementSha256','launchSha256','controlPolicySha256','provisionToken','originalT0Ms','deadlineMs','leaseDeadlineMs','cleanupCeilingMs','executionName','physicalObserver','placement','launch'])
  AND i->>'schema'='meri-native-watchdog-input/2' AND i->>'hostId'=r->>'host_id' AND i->'generation'=r->'generation'
  AND i->>'allocationSha256'=r->>'allocation_sha256' AND i->'physicalObserver'=o AND i->'placement'=p AND i->'launch'=l
  AND i->'accountId'=d->'accountId' AND i->'region'=d->'region' AND i->'sourceCommit'=d->'sourceCommit'
  AND i->'imageDigest'=d->'imageDigest' AND i->'bootstrapSha256'=d->'bootstrapSha256'
  AND i->'nativeHelperSha256' IS NOT DISTINCT FROM d->'nativeHelperSha256'
  AND i->'provisionToken'=d->'token' AND i->'originalT0Ms'=w->'t0Ms' AND i->'executionName'=w->'executionName'
  AND i->'deadlineMs'=w->'deadlineMs' AND i->'leaseDeadlineMs'=w->'leaseDeadlineMs' AND i->'cleanupCeilingMs'=w->'cleanupCeilingMs'
  AND i->>'placementSha256'~hex AND i->>'launchSha256'~hex AND i->'controlPolicySha256'=d#>'{bootstrapSpec,control,policySha256}','INPUT');
 keys:=ARRAY['phase','hostId','generation','allocationSha256','originalBindingSha256','declarationSha256','provisionToken','accountId','region','leaseDeadlineMs','cleanupCeilingMs','startedAtMs','deadlineMs','launchRequestSha256','authority'];
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(c,ARRAY['schema','ordinary','managed']) AND c->>'schema'='meri-native-physical-contexts/2','CONTEXT');
 FOREACH name IN ARRAY ARRAY['managed','ordinary'] LOOP
  v:=c->name; IF name='ordinary' AND v='null'::jsonb THEN CONTINUE; END IF;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(v,keys) AND v->>'phase'=name AND v->>'hostId'=r->>'host_id'
   AND v->'generation'=r->'generation' AND v->>'allocationSha256'=r->>'allocation_sha256' AND v->>'declarationSha256'=r->>'declaration_sha256'
   AND v->>'originalBindingSha256'~hex AND v->>'launchRequestSha256'~hex AND v->'provisionToken'=d->'token'
   AND v->'accountId'=d->'accountId' AND v->'region'=d->'region' AND v->'leaseDeadlineMs'=w->'leaseDeadlineMs'
   AND v->'cleanupCeilingMs'=w->'cleanupCeilingMs' AND meri_host_control.observer_int(v->'startedAtMs',1)
   AND meri_host_control.observer_int(v->'deadlineMs',1) AND (v->>'deadlineMs')::numeric=(v->>'startedAtMs')::numeric+25000,'CONTEXT_JOIN');
  IF name='managed' THEN
   PERFORM meri_host_control.observer_require(v->'startedAtMs'=w->'leaseDeadlineMs' AND v->'deadlineMs'=w->'cleanupCeilingMs'
    AND v->'authority'=jsonb_build_object('kind','prearmed-graph','executionArn',w->'executionArn','stateMachineVersionArn',w->'stateMachineVersionArn','definitionSha256',w->'definitionSha256','inputSha256',w->'inputSha256'),'MANAGED_AUTHORITY');
  ELSE
   PERFORM meri_host_control.observer_require((v-ARRAY['phase','startedAtMs','deadlineMs','authority'])=(m-ARRAY['phase','startedAtMs','deadlineMs','authority'])
    AND meri_host_control.observer_object(v->'authority',ARRAY['kind','requestId']) AND v#>>'{authority,kind}'='control-original'
    AND v#>>'{authority,requestId}'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','ORDINARY_AUTHORITY');
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION meri_host_control.observer_request(q jsonb, phase text, stage text, d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE api text:=q->>'api'; keys text[]; idkey text; pattern text;
BEGIN
 keys:=CASE api WHEN 'GetCallerIdentity' THEN ARRAY['api'] WHEN 'DescribeInstances' THEN CASE WHEN stage='discovery' THEN ARRAY['api','kind','provisionToken','nextToken','maxResults','scanId','pageIndex'] ELSE ARRAY['api','kind','instanceId'] END
 WHEN 'DescribeVolumes' THEN ARRAY['api','volumeId'] WHEN 'DescribeNetworkInterfaces' THEN ARRAY['api','networkInterfaceId'] WHEN 'TerminateInstances' THEN ARRAY['api','instanceId','dispatchId'] WHEN 'DescribeExecution' THEN ARRAY['api','executionArn'] WHEN 'GetExecutionHistory' THEN ARRAY['api','executionArn','nextToken','maxResults','reverseOrder','includeExecutionData'] END;
 PERFORM meri_host_control.observer_require(keys IS NOT NULL AND meri_host_control.observer_object(q,keys) AND phase IN('ordinary','managed') AND
  CASE stage WHEN 'authentication' THEN api='GetCallerIdentity' WHEN 'discovery' THEN api='DescribeInstances' AND q->>'kind'='discovery'
  WHEN 'capture' THEN api IN('DescribeInstances','DescribeVolumes','DescribeNetworkInterfaces') WHEN 'absence' THEN api IN('DescribeInstances','DescribeVolumes','DescribeNetworkInterfaces')
  WHEN 'termination' THEN phase='ordinary' AND api='TerminateInstances' WHEN 'provenance' THEN phase='managed' AND api IN('DescribeExecution','GetExecutionHistory') ELSE false END,'REQUEST_MATRIX');
 IF api='DescribeInstances' AND stage<>'discovery' THEN PERFORM meri_host_control.observer_require(q->>'kind'='exact','REQUEST_KIND'); END IF;
 FOREACH idkey IN ARRAY ARRAY['instanceId','volumeId','networkInterfaceId'] LOOP
  IF q?idkey THEN pattern:=CASE idkey WHEN 'instanceId' THEN '^i-' WHEN 'volumeId' THEN '^vol-' ELSE '^eni-' END||'([0-9a-f]{8}|[0-9a-f]{17})$';
   PERFORM meri_host_control.observer_require(jsonb_typeof(q->idkey)='string' AND q->>idkey~pattern,'REQUEST_ID'); END IF;
 END LOOP;
 IF q?'nextToken' THEN PERFORM meri_host_control.observer_require(q->'nextToken'='null'::jsonb OR jsonb_typeof(q->'nextToken')='string' AND octet_length(q->>'nextToken') BETWEEN 1 AND 2048,'REQUEST_TOKEN'); END IF;
 IF stage='discovery' THEN PERFORM meri_host_control.observer_require(q->'maxResults'='100'::jsonb AND meri_host_control.observer_int(q->'pageIndex',0,19)
  AND q->'provisionToken'=d->'token' AND q->>'scanId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','DISCOVERY_REQUEST'); END IF;
 IF stage='provenance' THEN
  PERFORM meri_host_control.observer_require(q->'executionArn'=d#>'{watchdog,executionArn}','HISTORY_REQUEST');
  IF api='GetExecutionHistory' THEN PERFORM meri_host_control.observer_require(q->'maxResults'='100'::jsonb AND q->'reverseOrder'='false'::jsonb AND q->'includeExecutionData'='true'::jsonb,'HISTORY_REQUEST'); END IF;
 END IF;
 IF api='TerminateInstances' THEN PERFORM meri_host_control.observer_require(q->>'dispatchId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','DISPATCH_ID'); END IF;
END $$;

CREATE FUNCTION meri_host_control.observer_facts(e jsonb, r jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE f jsonb:=e#>'{completion,facts}';q jsonb:=e->'request';d jsonb:=r->'declaration_json';w jsonb:=d->'watchdog';p jsonb:=d->'placement';api text:=q->>'api';stage text:=e->>'stage';n jsonb;a jsonb;v jsonb;h jsonb;previous numeric:=0;marker boolean;expected jsonb;ids jsonb;
BEGIN
 IF e#>>'{completion,outcome}'='invalid-response' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['reason','knownInstanceIds','knownVolumeIds','knownEniIds','observedCount','overflow'])
   AND f->>'reason' IN('malformed-wire','identity-mismatch','metadata-missing','resource-drift','bounds-exceeded')
   AND meri_host_control.observer_int(f->'observedCount') AND jsonb_typeof(f->'overflow')='boolean'
   AND meri_host_control.observer_strings(f->'knownInstanceIds','^i-([0-9a-f]{8}|[0-9a-f]{17})$',0,16)
   AND meri_host_control.observer_strings(f->'knownVolumeIds','^vol-([0-9a-f]{8}|[0-9a-f]{17})$',0,16)
   AND meri_host_control.observer_strings(f->'knownEniIds','^eni-([0-9a-f]{8}|[0-9a-f]{17})$',0,16),'INVALID_FACTS');RETURN;
 END IF;
 IF api='GetCallerIdentity' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['accountId','arn','userId']) AND f->'accountId'=d->'accountId'
   AND jsonb_typeof(f->'arn')='string' AND length(f->>'arn')<=2048 AND f->>'arn'~('^arn:aws:(iam|sts)::'||(d->>'accountId')||':(user/|role/|assumed-role/)[^[:space:]]+$')
   AND jsonb_typeof(f->'userId')='string' AND length(f->>'userId') BETWEEN 1 AND 256,'STS_FACTS');RETURN;
 END IF;
 IF stage='discovery' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['scanId','pageIndex','nextToken','matches','conflicts','observedCount','overflow','complete'])
   AND f->'scanId'=q->'scanId' AND f->'pageIndex'=q->'pageIndex' AND jsonb_typeof(f->'matches')='array' AND jsonb_typeof(f->'conflicts')='array'
   AND meri_host_control.observer_int(f->'observedCount') AND jsonb_typeof(f->'overflow')='boolean' AND jsonb_typeof(f->'complete')='boolean'
   AND (f->'nextToken'='null'::jsonb OR jsonb_typeof(f->'nextToken')='string' AND octet_length(f->>'nextToken') BETWEEN 1 AND 2048),'DISCOVERY_FACTS');
  PERFORM meri_host_control.observer_require(jsonb_array_length(f->'matches')+jsonb_array_length(f->'conflicts')<=16
   AND (f->'complete'<>'true'::jsonb OR f->'nextToken'='null'::jsonb AND f->'overflow'='false'::jsonb AND f->'conflicts'='[]'::jsonb),'DISCOVERY_BOUND');
  FOR v IN SELECT value FROM jsonb_array_elements(f->'matches') LOOP
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(v,ARRAY['instanceId','ownerAccountId','allocationSha256','provisionToken','placementSha256','rootVolumeId','networkInterfaceIds'])
    AND v->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$' AND v->'ownerAccountId'=d->'accountId' AND v->'allocationSha256'=r->'allocation_sha256'
    AND v->'provisionToken'=d->'token' AND v->'placementSha256'=d#>'{watchdog,input,placementSha256}'
    AND (v->'rootVolumeId'='null'::jsonb OR v->>'rootVolumeId'~'^vol-([0-9a-f]{8}|[0-9a-f]{17})$')
    AND meri_host_control.observer_strings(v->'networkInterfaceIds','^eni-([0-9a-f]{8}|[0-9a-f]{17})$',0,16),'DISCOVERY_MATCH');
  END LOOP;
  FOR v IN SELECT value FROM jsonb_array_elements(f->'conflicts') LOOP
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(v,ARRAY['instanceId','reason']) AND v->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$'
    AND v->>'reason' IN('foreign-owner','intent-mismatch','resource-drift','invalid-shape','bounds-exceeded'),'DISCOVERY_CONFLICT');
  END LOOP;RETURN;
 END IF;
 IF stage='provenance' THEN
  IF api='DescribeExecution' THEN
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['executionArn','stateMachineArn','stateMachineVersionArn','inputSha256','status','startAtMs','stopAtMs'])
    AND f->'executionArn'=w->'executionArn' AND f->'stateMachineVersionArn'=w->'stateMachineVersionArn'
    AND f->>'stateMachineArn'=regexp_replace(w->>'stateMachineVersionArn',':[1-9][0-9]*$','') AND f->'inputSha256'=w->'inputSha256'
    AND f->>'status' IN('RUNNING','SUCCEEDED','FAILED','TIMED_OUT','ABORTED') AND meri_host_control.observer_int(f->'startAtMs')
    AND (f->>'startAtMs')::numeric BETWEEN (w->>'t0Ms')::numeric AND (w->>'leaseDeadlineMs')::numeric
    AND (f->'stopAtMs'='null'::jsonb OR meri_host_control.observer_int(f->'stopAtMs') AND (f->>'stopAtMs')::numeric BETWEEN (f->>'startAtMs')::numeric AND (e#>>'{completion,completedAtMs}')::numeric),'EXECUTION_FACTS');RETURN;
  END IF;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['executionArn','nextToken','events']) AND f->'executionArn'=w->'executionArn'
   AND (f->'nextToken'='null'::jsonb OR jsonb_typeof(f->'nextToken')='string' AND octet_length(f->>'nextToken') BETWEEN 1 AND 2048)
   AND jsonb_typeof(f->'events')='array','HISTORY_FACTS');
  PERFORM meri_host_control.observer_require(jsonb_array_length(f->'events')<=100,'HISTORY_COUNT');
  FOR h IN SELECT value FROM jsonb_array_elements(f->'events') LOOP
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(h,ARRAY['historyEventId','previousEventId','atMs','kind','instanceId','attemptId','attemptedAtMs','taskStateName','taskResource','outcomeDigest'])
    AND meri_host_control.observer_int(h->'historyEventId',1) AND (h->>'historyEventId')::numeric>previous
    AND meri_host_control.observer_int(h->'previousEventId') AND (h->>'previousEventId')::numeric<(h->>'historyEventId')::numeric
    AND meri_host_control.observer_int(h->'atMs') AND (h->>'atMs')::numeric BETWEEN (w->>'t0Ms')::numeric AND (e#>>'{completion,completedAtMs}')::numeric
    AND h->>'kind' IN('state-entered','state-exited','task-scheduled','task-started','task-succeeded','task-failed','task-timed-out')
    AND (h->'taskStateName'='null'::jsonb OR h->>'taskStateName' IN('CaptureManagedAttempt','MarkManagedAttempt','TerminateBudget','TerminateOwned'))
    AND (h->'taskResource'='null'::jsonb OR h->>'taskResource'='arn:aws:states:::aws-sdk:ec2:terminateInstances')
    AND (h->'outcomeDigest'='null'::jsonb OR h->>'outcomeDigest'~'^[0-9a-f]{64}$')
    AND (h->'instanceId'='null'::jsonb AND h->'attemptId'='null'::jsonb OR h->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$' AND h->>'attemptId'=(w->>'executionArn')||':'||(h->>'instanceId')),'HISTORY_EVENT');
   marker:=h->>'kind'='state-exited' AND h->>'taskStateName'='MarkManagedAttempt';
   IF marker THEN
    PERFORM meri_host_control.observer_require(h->'instanceId'<>'null'::jsonb AND meri_host_control.observer_int(h->'attemptedAtMs')
     AND (h->>'attemptedAtMs')::numeric>=(w->>'leaseDeadlineMs')::numeric AND (h->>'attemptedAtMs')::numeric<=(h->>'atMs')::numeric
     AND (h->>'attemptedAtMs')::numeric<(w->>'cleanupCeilingMs')::numeric
     AND h->>'outcomeDigest'=meri_host_control.observer_hash('{"attemptId":'||to_json(h->>'attemptId')::text||',"attemptedAtMs":'||(h->>'attemptedAtMs')||',"instanceId":'||to_json(h->>'instanceId')::text||'}'),'ATTEMPT_TIME');
   ELSE PERFORM meri_host_control.observer_require(h->'attemptedAtMs'='null'::jsonb,'ATTEMPT_TIME_PLACEMENT'); END IF;
   previous:=(h->>'historyEventId')::numeric;
  END LOOP;RETURN;
 END IF;
 IF api='TerminateInstances' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['instanceId','currentState','currentStateCode']) AND f->'instanceId'=q->'instanceId'
   AND (f->>'currentState'='shutting-down' AND f->'currentStateCode'='32'::jsonb OR f->>'currentState'='terminated' AND f->'currentStateCode'='48'::jsonb),'TERMINATE_FACTS');RETURN;
 END IF;
 IF api='DescribeInstances' AND stage='absence' AND f->>'state'='terminated' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['instanceId','ownerAccountId','state','stateCode']) AND f->'instanceId'=q->'instanceId' AND f->'ownerAccountId'=d->'accountId' AND f->'stateCode'='48'::jsonb,'TERMINAL_FACTS');RETURN;
 END IF;
 IF api='DescribeVolumes' AND stage='absence' AND f->>'state'='deleted' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['volumeId','state']) AND f->'volumeId'=q->'volumeId','DELETED_FACTS');RETURN;
 END IF;
 expected:=jsonb_build_object('Project','meri-greenfield','MeriHostId',r->'host_id','MeriGeneration',r->>'generation','MeriAllocationSha256',r->'allocation_sha256');
 IF api='DescribeInstances' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['instanceId','ownerAccountId','state','stateCode','amiId','vpcId','subnetId','rootDeviceName','rootDeviceType','publicIpPresent','publicDnsPresent','blockDeviceMappingCount','privateIp','tags','root','networkInterfaces'])
   AND f->'instanceId'=q->'instanceId' AND f->'ownerAccountId'=d->'accountId' AND f->'amiId'=d#>'{launch,ImageId}' AND f->'vpcId'=p->'vpcId' AND f->'subnetId'=p->'subnetId'
   AND f->'stateCode'=CASE f->>'state' WHEN 'pending' THEN '0'::jsonb WHEN 'running' THEN '16'::jsonb WHEN 'shutting-down' THEN '32'::jsonb WHEN 'terminated' THEN '48'::jsonb WHEN 'stopping' THEN '64'::jsonb WHEN 'stopped' THEN '80'::jsonb END
   AND f->>'rootDeviceName'='/dev/xvda' AND f->>'rootDeviceType'='ebs' AND f->'publicIpPresent'='false'::jsonb AND f->'publicDnsPresent'='false'::jsonb AND f->'blockDeviceMappingCount'='1'::jsonb AND f->'tags'=expected
   AND meri_host_control.observer_object(f->'root',ARRAY['volumeId','deleteOnTermination']) AND f#>>'{root,volumeId}'~'^vol-([0-9a-f]{8}|[0-9a-f]{17})$' AND f#>'{root,deleteOnTermination}'='true'::jsonb
   AND jsonb_typeof(f->'networkInterfaces')='array','INSTANCE_FACTS');
  IF f->'privateIp'<>'null'::jsonb THEN
   PERFORM meri_host_control.observer_require(jsonb_typeof(f->'privateIp')='string' AND f->>'privateIp'~'^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' AND family((f->>'privateIp')::inet)=4 AND ((f->>'privateIp')::inet<<'10.0.0.0/8'::inet OR (f->>'privateIp')::inet<<'172.16.0.0/12'::inet OR (f->>'privateIp')::inet<<'192.168.0.0/16'::inet),'PRIVATE_IP');
  END IF;
  SELECT jsonb_agg(value->'id') INTO ids FROM jsonb_array_elements(f->'networkInterfaces');
  PERFORM meri_host_control.observer_require(meri_host_control.observer_strings(ids,'^eni-([0-9a-f]{8}|[0-9a-f]{17})$',1,16),'INSTANCE_NICS');
  FOR n IN SELECT value FROM jsonb_array_elements(f->'networkInterfaces') LOOP
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(n,ARRAY['id','ownerAccountId','vpcId','subnetId','securityGroupIds','publicAssociationPresent','attachment'])
    AND n->'ownerAccountId'=d->'accountId' AND n->'vpcId'=p->'vpcId' AND n->'subnetId'=p->'subnetId' AND n->'securityGroupIds'=p->'securityGroupIds' AND n->'publicAssociationPresent'='false'::jsonb
    AND meri_host_control.observer_object(n->'attachment',ARRAY['attachmentId','deviceIndex','deleteOnTermination']) AND n#>>'{attachment,attachmentId}'~'^eni-attach-[0-9a-f]{8,17}$'
    AND meri_host_control.observer_int(n#>'{attachment,deviceIndex}',0,15) AND n#>'{attachment,deleteOnTermination}'='true'::jsonb
    AND (jsonb_array_length(f->'networkInterfaces')<>1 OR n#>'{attachment,deviceIndex}'='0'::jsonb),'INSTANCE_NIC');
  END LOOP;RETURN;
 END IF;
 a:=f->'attachment';
 IF api='DescribeVolumes' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['volumeId','ownerAccountId','state','encrypted','tags','attachment'])
   AND f->'volumeId'=q->'volumeId' AND f->'ownerAccountId'=d->'accountId' AND f->>'state'='in-use' AND f->'encrypted'='true'::jsonb AND f->'tags'=expected
   AND meri_host_control.observer_object(a,ARRAY['instanceId','volumeId','device','deleteOnTermination']) AND a->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$'
   AND a->'volumeId'=f->'volumeId' AND a->>'device'='/dev/xvda' AND a->'deleteOnTermination'='true'::jsonb,'VOLUME_FACTS');RETURN;
 END IF;
 IF api='DescribeNetworkInterfaces' THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(f,ARRAY['id','ownerAccountId','vpcId','subnetId','securityGroupIds','publicAssociationPresent','attachment'])
   AND f->'id'=q->'networkInterfaceId' AND f->'ownerAccountId'=d->'accountId' AND f->'vpcId'=p->'vpcId' AND f->'subnetId'=p->'subnetId' AND f->'securityGroupIds'=p->'securityGroupIds' AND f->'publicAssociationPresent'='false'::jsonb
   AND meri_host_control.observer_object(a,ARRAY['instanceId','attachmentId','deviceIndex','deleteOnTermination']) AND a->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$'
   AND a->>'attachmentId'~'^eni-attach-[0-9a-f]{8,17}$' AND meri_host_control.observer_int(a->'deviceIndex',0,15) AND a->'deleteOnTermination'='true'::jsonb,'ENI_FACTS');RETURN;
 END IF;
 PERFORM meri_host_control.observer_require(false,'UNKNOWN_FACTS');
END $$;

CREATE FUNCTION meri_host_control.observer_discovery(j jsonb, phase text, scan text, instance text, before_ms numeric) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE e jsonb;f jsonb;v jsonb;token jsonb:='null';page integer:=0;owned text[]:='{}';ids jsonb:='[]';
BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements(j->'entries') WHERE value->>'stage'='discovery' AND value#>>'{request,scanId}'=scan ORDER BY (value#>>'{request,pageIndex}')::integer LOOP
  f:=e#>'{completion,facts}';
  PERFORM meri_host_control.observer_require(e->>'phase'=phase AND e#>>'{completion,outcome}'='success' AND e#>'{request,pageIndex}'=to_jsonb(page)
   AND e#>'{request,nextToken}'=token AND (page=0 OR token<>'null'::jsonb) AND (e#>>'{completion,completedAtMs}')::numeric<=before_ms
   AND f->'overflow'='false'::jsonb AND f->'conflicts'='[]'::jsonb,'DISCOVERY_CHAIN');
  FOR v IN SELECT value FROM jsonb_array_elements(f->'matches') LOOP IF NOT (v->>'instanceId')=ANY(owned) THEN owned:=array_append(owned,v->>'instanceId');END IF;END LOOP;
  token:=f->'nextToken';ids:=ids||jsonb_build_array(e->'operationId');page:=page+1;
 END LOOP;
 PERFORM meri_host_control.observer_require(page BETWEEN 1 AND 20 AND token='null'::jsonb AND cardinality(owned)=1 AND owned[1]=instance AND f->'complete'='true'::jsonb,'DISCOVERY_COMPLETE');
 RETURN jsonb_build_object('scanId',scan,'pageEventIds',ids);
END $$;

CREATE FUNCTION meri_host_control.observer_journal(r jsonb, old_r jsonb, operation text, now_ms numeric) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE j jsonb:=r->'native_physical_observations_json';old_j jsonb:=old_r->'native_physical_observations_json';t text:=r->>'native_physical_observations_canonical';
 e jsonb;prior jsonb;c jsonb;q jsonb;ctx jsonb;set_value jsonb;auth jsonb;capture jsonb;phase text;stage text;count_at integer:=0;old_count integer:=0;pending integer:=0;active_reads integer:=0;term_count integer:=0;
 op_ids text[]:='{}';auth_ids text[]:='{}';start_ms numeric;deadline numeric;done_ms numeric;new_entry boolean;fence jsonb;old_fence jsonb;entry_text text;completion_text text;request_text text;valid_target boolean;
BEGIN
 IF j IS NULL OR j='null'::jsonb THEN
  PERFORM meri_host_control.observer_require(old_j IS NULL OR old_j='null'::jsonb,'JOURNAL_ERASE');RETURN;
 END IF;
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(j,ARRAY['schema','entries','closedForFullTeardown']) AND j->>'schema'='meri-native-physical-journal/2' AND jsonb_typeof(j->'entries')='array','JOURNAL');
 PERFORM meri_host_control.observer_require(jsonb_array_length(j->'entries')<=256,'EVENT_COUNT');
 IF old_j IS NOT NULL AND old_j<>'null'::jsonb THEN old_count:=jsonb_array_length(old_j->'entries'); END IF;
 PERFORM meri_host_control.observer_require(jsonb_array_length(j->'entries') BETWEEN old_count AND old_count+1,'JOURNAL_APPEND');
 fence:=j->'closedForFullTeardown';old_fence:=coalesce(old_j->'closedForFullTeardown','null'::jsonb);
 IF old_fence<>'null'::jsonb THEN PERFORM meri_host_control.observer_require(fence=old_fence AND jsonb_array_length(j->'entries')=old_count,'FENCE_IMMUTABLE'); END IF;
 IF fence<>'null'::jsonb THEN
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(fence,ARRAY['receiptSha256','closedAtMs']) AND fence->>'receiptSha256'~'^[0-9a-f]{64}$'
   AND meri_host_control.observer_int(fence->'closedAtMs',1) AND (fence->>'closedAtMs')::numeric<=now_ms
   AND r#>>'{native_physical_result_json,ordinary,status}'='verified-absent','FULL_FENCE');
 END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(j->'entries') LOOP
  phase:=e->>'phase';stage:=e->>'stage';q:=e->'request';c:=e->'completion';ctx:=r->'native_physical_context_json'->phase;set_value:=r->'native_physical_resources_json'->phase;
  prior:=old_j->'entries'->count_at;new_entry:=count_at>=old_count;
  entry_text:=meri_host_control.observer_raw(t,ARRAY['entries',count_at::text]);request_text:=meri_host_control.observer_raw(entry_text,ARRAY['request']);completion_text:=meri_host_control.observer_raw(entry_text,ARRAY['completion']);
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(e,ARRAY['sequence','operationId','phase','stage','sessionId','request','startedAtMs','callDeadlineMs','completion'])
   AND e->'sequence'=to_jsonb(count_at+1) AND e->>'operationId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND e->>'sessionId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND NOT (e->>'operationId')=ANY(op_ids) AND phase IN('ordinary','managed') AND jsonb_typeof(ctx)='object'
   AND meri_host_control.observer_int(e->'startedAtMs',1) AND meri_host_control.observer_int(e->'callDeadlineMs',1)
   AND meri_host_control.observer_size(request_text)<=4096 AND meri_host_control.observer_size(completion_text)<=8192,'EVENT');
  op_ids:=array_append(op_ids,e->>'operationId');start_ms:=(e->>'startedAtMs')::numeric;deadline:=(e->>'callDeadlineMs')::numeric;
  PERFORM meri_host_control.observer_require(start_ms<deadline AND deadline<=(ctx->>'deadlineMs')::numeric
   AND (phase='managed' OR start_ms>=(ctx->>'startedAtMs')::numeric),'EVENT_TIME');
  PERFORM meri_host_control.observer_request(q,phase,stage,r->'declaration_json');
  IF new_entry THEN
   PERFORM meri_host_control.observer_require(c='null'::jsonb AND old_fence='null'::jsonb AND (old_r->'native_physical_result_json'->phase IS NULL OR old_r->'native_physical_result_json'->phase='null'::jsonb)
    AND r->>'state' IN('dispatching','unknown','active','revoked','quarantined') AND start_ms<=now_ms AND start_ms>=floor(extract(epoch FROM transaction_timestamp())*1000)
    AND now_ms<deadline,'EVENT_CURRENT');
   IF phase='managed' AND stage IN('authentication','discovery','capture') THEN
    PERFORM meri_host_control.observer_require(deadline<=start_ms+3000 AND deadline<=CASE WHEN start_ms<(ctx->>'leaseDeadlineMs')::numeric THEN (ctx->>'leaseDeadlineMs')::numeric ELSE (ctx->>'cleanupCeilingMs')::numeric-1000 END,'PREPARE_DEADLINE');
   END IF;
  ELSE
   PERFORM meri_host_control.observer_require((e-'completion')=(prior-'completion') AND (prior->'completion'='null'::jsonb OR c=prior->'completion'),'EVENT_IMMUTABLE');
  END IF;
  IF stage='authentication' THEN
   PERFORM meri_host_control.observer_require(NOT (e->>'sessionId')=ANY(auth_ids),'SESSION_DUPLICATE');auth_ids:=array_append(auth_ids,e->>'sessionId');
  ELSE
   SELECT value INTO auth FROM jsonb_array_elements(j->'entries') WHERE value->>'stage'='authentication' AND value->'sessionId'=e->'sessionId' AND value->'phase'=e->'phase' AND value#>>'{completion,outcome}'='success' AND (value->>'sequence')::int<(e->>'sequence')::int;
   PERFORM meri_host_control.observer_require(auth IS NOT NULL AND (auth#>>'{completion,completedAtMs}')::numeric<=start_ms,'SESSION_JOIN');
  END IF;
  IF stage IN('absence','termination') THEN PERFORM meri_host_control.observer_require(jsonb_typeof(set_value)='object','RESOURCE_REQUIRED'); END IF;
  IF set_value IS NOT NULL AND set_value<>'null'::jsonb THEN
   PERFORM meri_host_control.observer_require((NOT q?'instanceId' OR q->'instanceId'=set_value->'instanceId') AND (NOT q?'volumeId' OR q->'volumeId'=set_value->'rootVolumeId') AND (NOT q?'networkInterfaceId' OR set_value->'networkInterfaceIds' ? (q->>'networkInterfaceId')),'RESOURCE_REQUEST_JOIN');
  END IF;
  IF new_entry AND stage='capture' THEN
   IF q->>'api'='DescribeInstances' THEN
    valid_target:=coalesce(q->'instanceId'=old_r#>'{observed_instance_json,instanceId}',false);
    IF NOT valid_target THEN
     FOR capture IN SELECT DISTINCT value->'request' AS request FROM jsonb_array_elements(j->'entries') WHERE value->>'phase'=phase AND value->>'stage'='discovery' LOOP
      BEGIN PERFORM meri_host_control.observer_discovery(j,phase,capture->>'scanId',q->>'instanceId',start_ms);valid_target:=true;EXIT;
      EXCEPTION WHEN raise_exception THEN NULL; END;
     END LOOP;
    END IF;
    PERFORM meri_host_control.observer_require(valid_target,'CAPTURE_DISCOVERY');
   ELSE
    SELECT value INTO capture FROM jsonb_array_elements(j->'entries') WHERE value->>'phase'=phase AND value->>'stage'='capture' AND value#>>'{request,api}'='DescribeInstances' AND value#>>'{completion,outcome}'='success'
     AND (value#>>'{completion,completedAtMs}')::numeric<=start_ms AND (value#>'{completion,facts,root,volumeId}'=q->'volumeId' OR EXISTS(SELECT FROM jsonb_array_elements(value#>'{completion,facts,networkInterfaces}') nic WHERE nic->'id'=q->'networkInterfaceId')) LIMIT 1;
    PERFORM meri_host_control.observer_require(capture IS NOT NULL,'CAPTURE_TARGET');
   END IF;
  END IF;
  IF stage='termination' THEN term_count:=term_count+1; END IF;
  IF c='null'::jsonb THEN pending:=pending+1;
  ELSE
   PERFORM meri_host_control.observer_require(meri_host_control.observer_object(c,ARRAY['completedAtMs','outcome','requestId','httpStatusCode','errorCode','facts'])
    AND meri_host_control.observer_int(c->'completedAtMs') AND (c->>'completedAtMs')::numeric BETWEEN start_ms AND now_ms
    AND c->>'outcome' IN('success','service-error','transport-unknown','invalid-response','abandoned')
    AND (c->'requestId'='null'::jsonb OR jsonb_typeof(c->'requestId')='string' AND c->>'requestId'~'^[A-Za-z0-9-]{8,128}$')
    AND (c->'httpStatusCode'='null'::jsonb OR meri_host_control.observer_int(c->'httpStatusCode',100,599))
    AND (c->'errorCode'='null'::jsonb OR jsonb_typeof(c->'errorCode')='string' AND length(c->>'errorCode') BETWEEN 1 AND 128),'COMPLETION');
   IF c->>'outcome'='success' THEN
    PERFORM meri_host_control.observer_require(c->'requestId'<>'null'::jsonb AND c->'httpStatusCode'='200'::jsonb AND c->'errorCode'='null'::jsonb AND (c->>'completedAtMs')::numeric<=deadline,'SUCCESS_METADATA');
   ELSIF c->>'outcome'='service-error' THEN
    PERFORM meri_host_control.observer_require(c->'requestId'<>'null'::jsonb AND c->'httpStatusCode'<>'null'::jsonb AND c->'errorCode'<>'null'::jsonb AND c->'facts'='null'::jsonb,'SERVICE_ERROR');
   ELSIF c->>'outcome' IN('transport-unknown','abandoned') THEN PERFORM meri_host_control.observer_require(c->'facts'='null'::jsonb,'UNKNOWN_FACTS'); END IF;
   IF c->>'outcome'='abandoned' THEN PERFORM meri_host_control.observer_require(now_ms>=deadline AND c->'requestId'='null'::jsonb AND c->'httpStatusCode'='null'::jsonb AND c->'errorCode'='null'::jsonb,'ABANDONED'); END IF;
   IF c->>'outcome' IN('success','invalid-response') THEN PERFORM meri_host_control.observer_facts(e,r); END IF;
  END IF;
  IF stage<>'termination' AND (c='null'::jsonb OR c->>'outcome' IN('transport-unknown','abandoned')) AND now_ms<(ctx->>'deadlineMs')::numeric THEN active_reads:=active_reads+1; END IF;
  count_at:=count_at+1;
 END LOOP;
 PERFORM meri_host_control.observer_require(term_count<=1 AND active_reads<=4 AND meri_host_control.observer_size(t)+pending*8188+CASE WHEN fence='null'::jsonb THEN 4096 ELSE 0 END<=524288,'JOURNAL_BUDGET');
END $$;

CREATE FUNCTION meri_host_control.observer_resources(r jsonb, phase text, s jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE j jsonb:=r->'native_physical_observations_json';e jsonb;i jsonb;v jsonb;n jsonb;nic jsonb;ids jsonb;count_i integer:=0;count_v integer:=0;count_n integer:=0;latest numeric:=0;id text;scan jsonb;
BEGIN
 PERFORM meri_host_control.observer_require(meri_host_control.observer_object(s,ARRAY['instanceId','rootVolumeId','networkInterfaceIds','preObservationEventIds','completedAtMs','discovery'])
  AND s->>'instanceId'~'^i-([0-9a-f]{8}|[0-9a-f]{17})$' AND s->>'rootVolumeId'~'^vol-([0-9a-f]{8}|[0-9a-f]{17})$'
  AND meri_host_control.observer_strings(s->'networkInterfaceIds','^eni-([0-9a-f]{8}|[0-9a-f]{17})$',1,16,true)
  AND meri_host_control.observer_strings(s->'preObservationEventIds','^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',3,18)
  AND meri_host_control.observer_int(s->'completedAtMs',1),'RESOURCE_SET');
 FOR id IN SELECT value FROM jsonb_array_elements_text(s->'preObservationEventIds') LOOP
  e:=meri_host_control.observer_event(j,id);
  PERFORM meri_host_control.observer_require(e->>'phase'=phase AND e->>'stage'='capture' AND e#>>'{completion,outcome}'='success','PREOBSERVATION');
  latest:=greatest(latest,(e#>>'{completion,completedAtMs}')::numeric);
  CASE e#>>'{request,api}' WHEN 'DescribeInstances' THEN count_i:=count_i+1;i:=e;
   WHEN 'DescribeVolumes' THEN count_v:=count_v+1;v:=e;
   WHEN 'DescribeNetworkInterfaces' THEN count_n:=count_n+1;
   ELSE PERFORM meri_host_control.observer_require(false,'PREOBSERVATION_KIND');END CASE;
 END LOOP;
 PERFORM meri_host_control.observer_require(count_i=1 AND count_v=1 AND count_n=jsonb_array_length(i#>'{completion,facts,networkInterfaces}')
  AND s->'instanceId'=i#>'{completion,facts,instanceId}' AND s->'rootVolumeId'=i#>'{completion,facts,root,volumeId}'
  AND s->'rootVolumeId'=v#>'{completion,facts,volumeId}' AND s->'instanceId'=v#>'{completion,facts,attachment,instanceId}'
  AND (s->>'completedAtMs')::numeric=latest AND s->'instanceId'=r#>'{observed_instance_json,instanceId}'
  AND (r->'host_identity_json'='null'::jsonb OR s->'instanceId'=r#>'{host_identity_json,instanceId}'),'RESOURCE_JOIN');
 SELECT jsonb_agg(value->'id' ORDER BY value->>'id' COLLATE "C") INTO ids FROM jsonb_array_elements(i#>'{completion,facts,networkInterfaces}');
 PERFORM meri_host_control.observer_require(ids=s->'networkInterfaceIds','RESOURCE_ENIS');
 FOR nic IN SELECT value FROM jsonb_array_elements(i#>'{completion,facts,networkInterfaces}') LOOP
  SELECT value INTO n FROM jsonb_array_elements(j->'entries') WHERE s->'preObservationEventIds' ? (value->>'operationId') AND value#>>'{request,api}'='DescribeNetworkInterfaces' AND value#>'{request,networkInterfaceId}'=nic->'id';
  PERFORM meri_host_control.observer_require(n#>'{completion,facts,attachment,instanceId}'=s->'instanceId' AND n#>'{completion,facts,attachment,attachmentId}'=nic#>'{attachment,attachmentId}','RESOURCE_ATTACHMENT');
 END LOOP;
 IF s->'discovery'='null'::jsonb THEN
  PERFORM meri_host_control.observer_require(NOT EXISTS(SELECT FROM jsonb_array_elements(j->'entries') entry WHERE entry->>'phase'=phase AND entry->>'stage'='discovery' AND (entry->>'startedAtMs')::numeric<=(i->>'startedAtMs')::numeric),'DISCOVERY_RETAINED');
 ELSE
  scan:=meri_host_control.observer_discovery(j,phase,s#>>'{discovery,scanId}',s->>'instanceId',(i->>'startedAtMs')::numeric);
  PERFORM meri_host_control.observer_require(s->'discovery'=scan,'DISCOVERY_SET');
 END IF;
END $$;

CREATE FUNCTION meri_host_control.observer_history_event(events jsonb,id jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT e FROM jsonb_array_elements(events) e WHERE e->'historyEventId'=id $$;
CREATE FUNCTION meri_host_control.observer_managed(r jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE j jsonb:=r->'native_physical_observations_json';w jsonb:=r#>'{declaration_json,watchdog}';session text;e jsonb;h jsonb;events jsonb;attempts jsonb;scheduled jsonb;ids jsonb;marker jsonb;entered jsonb;capture jsonb;cursor_event jsonb;step text;kind text;name text;after_ms numeric;token jsonb;prior_id numeric;pages integer;describes integer;found boolean:=false;
BEGIN
 FOR session IN SELECT DISTINCT value->>'sessionId' FROM jsonb_array_elements(j->'entries') WHERE value->>'stage'='provenance' LOOP
  BEGIN
   events:='[]';attempts:='[]';scheduled:='[]';ids:='[]';token:='null';prior_id:=0;pages:=0;describes:=0;
   FOR e IN SELECT value FROM jsonb_array_elements(j->'entries') WHERE value->>'phase'='managed' AND value->>'stage'='provenance' AND value->>'sessionId'=session AND value#>>'{completion,outcome}'='success'
    AND (value#>>'{completion,completedAtMs}')::numeric<=(value->>'callDeadlineMs')::numeric AND (value#>>'{completion,completedAtMs}')::numeric<=(w->>'cleanupCeilingMs')::numeric LOOP
    IF e#>>'{request,api}'='DescribeExecution' THEN describes:=describes+1;CONTINUE; END IF;
    PERFORM meri_host_control.observer_require(e#>'{request,nextToken}'=token AND (pages=0 OR token<>'null'::jsonb),'HISTORY_PAGE_CHAIN');
    FOR h IN SELECT value FROM jsonb_array_elements(e#>'{completion,facts,events}') LOOP
     PERFORM meri_host_control.observer_require((h->>'historyEventId')::numeric>prior_id,'HISTORY_PAGE_ORDER');
     events:=events||jsonb_build_array(h);ids:=ids||jsonb_build_array(h->'historyEventId');prior_id:=(h->>'historyEventId')::numeric;
    END LOOP;
    token:=e#>'{completion,facts,nextToken}';pages:=pages+1;
   END LOOP;
   PERFORM meri_host_control.observer_require(describes>0 AND pages BETWEEN 1 AND 5 AND token='null'::jsonb,'AUTHENTICATED_HISTORY');
   FOR marker IN SELECT value FROM jsonb_array_elements(events) WHERE value->>'kind'='state-exited' AND value->>'taskStateName'='MarkManagedAttempt' LOOP
    entered:=meri_host_control.observer_history_event(events,marker->'previousEventId');capture:=meri_host_control.observer_history_event(events,entered->'previousEventId');
    PERFORM meri_host_control.observer_require(entered->>'kind'='state-entered' AND entered->>'taskStateName'='MarkManagedAttempt' AND entered->'outcomeDigest'=marker->'outcomeDigest'
     AND capture->>'kind'='state-exited' AND capture->>'taskStateName'='CaptureManagedAttempt' AND capture->'outcomeDigest'=marker->'outcomeDigest'
     AND (capture->>'atMs')::numeric<=(entered->>'atMs')::numeric AND (entered->>'atMs')::numeric<=(marker->>'atMs')::numeric
     AND NOT EXISTS(SELECT FROM jsonb_array_elements(attempts) a WHERE a->'instanceId'=marker->'instanceId'),'MARKER_LINEAGE');
    attempts:=attempts||jsonb_build_array(jsonb_build_object('instanceId',marker->'instanceId','attemptId',marker->'attemptId','attemptedAtMs',marker->'attemptedAtMs','historyEventId',marker->'historyEventId'));
   END LOOP;
   PERFORM meri_host_control.observer_require(jsonb_array_length(attempts)<=16,'ATTEMPT_COUNT');
   FOR h IN SELECT value FROM jsonb_array_elements(events) WHERE value->>'kind'='task-scheduled' LOOP
    PERFORM meri_host_control.observer_require(h->>'taskResource'='arn:aws:states:::aws-sdk:ec2:terminateInstances' AND h->'instanceId'<>'null'::jsonb
     AND h->>'outcomeDigest'=meri_host_control.observer_hash('{"InstanceIds":['||to_json(h->>'instanceId')::text||']}'),'SCHEDULED_REQUEST');
    cursor_event:=meri_host_control.observer_history_event(events,h->'previousEventId');after_ms:=(h->>'atMs')::numeric;
    FOREACH step IN ARRAY ARRAY['state-entered:TerminateOwned','state-exited:TerminateBudget','state-entered:TerminateBudget','state-exited:MarkManagedAttempt'] LOOP
     kind:=split_part(step,':',1);name:=split_part(step,':',2);
     PERFORM meri_host_control.observer_require(cursor_event->>'kind'=kind AND cursor_event->>'taskStateName'=name AND (cursor_event->>'atMs')::numeric<=after_ms,'SCHEDULED_LINEAGE');
     after_ms:=(cursor_event->>'atMs')::numeric;
     IF name='MarkManagedAttempt' THEN
      PERFORM meri_host_control.observer_require(cursor_event->'instanceId'=h->'instanceId' AND cursor_event->'attemptId'=h->'attemptId' AND (h->>'atMs')::numeric<(w->>'cleanupCeilingMs')::numeric
       AND (h->>'atMs')::numeric>=(cursor_event->>'attemptedAtMs')::numeric AND NOT EXISTS(SELECT FROM jsonb_array_elements(scheduled) x WHERE x->'instanceId'=h->'instanceId'),'SCHEDULED_ATTEMPT');
      scheduled:=scheduled||jsonb_build_array(jsonb_build_object('instanceId',h->'instanceId','attemptId',h->'attemptId','atMs',h->'atMs','historyEventId',h->'historyEventId'));
     ELSE cursor_event:=meri_host_control.observer_history_event(events,cursor_event->'previousEventId');END IF;
    END LOOP;
   END LOOP;
   IF r#>'{native_physical_dispatch_json,managed}'=jsonb_build_object('executionArn',w->'executionArn','inputSha256',w->'inputSha256','attempts',attempts)
    AND r#>'{native_physical_dispatch_result_json,managed}'=jsonb_build_object('executionArn',w->'executionArn','historyEventIds',ids) THEN RETURN scheduled; END IF;
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
 END LOOP;
 PERFORM meri_host_control.observer_require(false,'MANAGED_PROVENANCE');RETURN NULL;
END $$;

CREATE FUNCTION meri_host_control.observer_verified(r jsonb,phase text,result_value jsonb,dispatch_ms numeric) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE j jsonb:=r->'native_physical_observations_json';s jsonb:=r->'native_physical_resources_json'->phase;ctx jsonb:=r->'native_physical_context_json'->phase;
 terminal jsonb;e jsonb;c jsonb;resource text;kind text;expected text[];count_at integer;total integer:=0;after_ms numeric;ids jsonb:=result_value->'evidenceEventIds';
BEGIN
 terminal:=meri_host_control.observer_event(j,ids->>0);
 PERFORM meri_host_control.observer_require(dispatch_ms IS NOT NULL AND jsonb_typeof(s)='object' AND terminal->>'phase'=phase AND terminal->>'stage'='absence'
  AND terminal#>>'{completion,outcome}'='success' AND terminal#>>'{completion,facts,state}'='terminated' AND terminal#>'{completion,facts,instanceId}'=s->'instanceId'
  AND (terminal->>'startedAtMs')::numeric>=dispatch_ms AND (terminal->>'startedAtMs')::numeric>=(ctx->>'startedAtMs')::numeric
  AND (s->>'completedAtMs')::numeric<=dispatch_ms AND (terminal#>>'{completion,completedAtMs}')::numeric<=(ctx->>'deadlineMs')::numeric,'VERIFIED_TERMINAL');
 expected:=ARRAY[s->>'rootVolumeId']||ARRAY(SELECT value FROM jsonb_array_elements_text(s->'networkInterfaceIds'));
 FOREACH resource IN ARRAY expected LOOP
  count_at:=0;after_ms:=(terminal#>>'{completion,completedAtMs}')::numeric;kind:=CASE WHEN resource=s->>'rootVolumeId' THEN 'volumeId' ELSE 'networkInterfaceId' END;
  FOR e IN SELECT meri_host_control.observer_event(j,x.value) FROM jsonb_array_elements_text(ids) WITH ORDINALITY x(value,n) WHERE x.n>1 ORDER BY x.n LOOP
   IF e->'request'->>kind IS DISTINCT FROM resource THEN CONTINUE; END IF;c:=e->'completion';
   PERFORM meri_host_control.observer_require(e->>'phase'=phase AND e->>'stage'='absence' AND (e->>'startedAtMs')::numeric>after_ms
    AND (c->>'completedAtMs')::numeric<=(ctx->>'deadlineMs')::numeric AND (c->>'completedAtMs')::numeric<=(e->>'callDeadlineMs')::numeric
    AND (c->>'outcome'='service-error' AND c->'httpStatusCode'='400'::jsonb AND c->>'errorCode'=CASE kind WHEN 'volumeId' THEN 'InvalidVolume.NotFound' ELSE 'InvalidNetworkInterfaceID.NotFound' END
     OR kind='volumeId' AND c->>'outcome'='success' AND c->'httpStatusCode'='200'::jsonb AND c#>>'{facts,state}'='deleted' AND c#>>'{facts,volumeId}'=resource),'CAUSAL_ABSENCE');
   after_ms:=(c->>'completedAtMs')::numeric;count_at:=count_at+1;total:=total+1;
  END LOOP;
  PERFORM meri_host_control.observer_require(count_at>=2,'ABSENCE_CONFIRMATIONS');
 END LOOP;
 PERFORM meri_host_control.observer_require(total=jsonb_array_length(ids)-1,'ABSENCE_SCOPE');
END $$;

CREATE OR REPLACE FUNCTION meri_host_control.guard_allocation() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
DECLARE purpose text;step text;o jsonb;n jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 purpose:=COALESCE((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])->'allocation_json'->>'hostMode','legacy');
 IF TG_OP='INSERT' THEN
  IF purpose='native-processing' THEN
   IF (NEW.state<>'reserved' OR NEW.dispatch_started_at_ms IS NOT NULL OR NEW.observed_instance_json IS NOT NULL
    OR NEW.bootstrap_prepare_json IS NOT NULL OR NEW.bootstrap_install_json IS NOT NULL
    OR NEW.teardown_json IS NOT NULL OR NEW.teardown_sha256 IS NOT NULL
    OR NEW.declaration_json IS NULL OR NEW.declaration_sha256 IS NULL
    OR jsonb_typeof(NEW.declaration_json->'bootstrapSpec') IS DISTINCT FROM 'object'
    OR NEW.declaration_json->'bootstrapSpec'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-spec/1'
    OR NEW.host_identity_json IS NOT NULL OR NEW.host_identity_sha256 IS NOT NULL
    OR NEW.endpoint_json IS NOT NULL OR NEW.record_sha256 IS NOT NULL OR NEW.client_cert_sha256 IS NOT NULL
    OR NEW.client_dns_name IS NOT NULL OR NEW.client_cert_not_after_ms IS NOT NULL
    OR NEW.server_cert_not_after_ms IS NOT NULL) IS TRUE
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
  ELSE
   IF NEW.state<>'active' OR NEW.declaration_json IS NOT NULL OR NEW.declaration_sha256 IS NOT NULL
    OR NEW.dispatch_started_at_ms IS NOT NULL OR NEW.observed_instance_json IS NOT NULL
    OR NEW.bootstrap_prepare_json IS NOT NULL OR NEW.bootstrap_install_json IS NOT NULL
    OR NEW.teardown_json IS NOT NULL OR NEW.teardown_sha256 IS NOT NULL
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 -- Tombstones are fully immutable: any byte change, including receipt, refuses.
 IF OLD.state IN ('refused','terminated') AND (to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical']) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Identity/lease/owner/declaration/credential are ALWAYS immutable.
 IF ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  IS DISTINCT FROM ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Physical fill is allowed ONLY on dispatching/unknown -> active.
 IF ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  IS DISTINCT FROM ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  AND NOT(OLD.state IN ('dispatching','unknown') AND NEW.state='active')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Admitted/terminal physical data is immutable; only state and a valid teardown may change.
 IF OLD.state IN ('active','revoked','quarantined','terminated') AND
  ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','teardown_json','teardown_sha256']) IS DISTINCT FROM
  ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','teardown_json','teardown_sha256'])
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Allowed state transitions. No dispatching/unknown -> terminated before a real absence proof.
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
   (OLD.state='reserved' AND NEW.state IN ('dispatching','refused')) OR
   (OLD.state='dispatching' AND NEW.state IN ('unknown','active')) OR
   (OLD.state='unknown' AND NEW.state='active') OR
   (OLD.state='active' AND NEW.state IN ('revoked','quarantined','terminated')) OR
   (OLD.state IN ('revoked','quarantined') AND NEW.state='terminated')) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Native new-lineage dispatching/unknown/active rows must carry the original dispatch timestamp.
 IF purpose='native-processing' AND NEW.declaration_json IS NOT NULL AND NEW.state IN ('dispatching','unknown','active') AND NEW.dispatch_started_at_ms IS NULL
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Active new-lineage rows must carry the observed instance that matches the physical identity.
 IF purpose='native-processing' AND NEW.state='active' AND NEW.declaration_json IS NOT NULL AND
  (NEW.observed_instance_json IS NULL OR NEW.observed_instance_json->>'instanceId' IS DISTINCT FROM NEW.host_identity_json->>'instanceId')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 -- Native activation requires BOTH retained successful bootstrap operations with public custody.
 IF purpose='native-processing' AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND
  (NEW.bootstrap_prepare_json IS NULL OR NEW.bootstrap_install_json IS NULL
   OR jsonb_typeof(NEW.bootstrap_prepare_json)<>'object' OR jsonb_typeof(NEW.bootstrap_install_json)<>'object'
   OR NEW.bootstrap_prepare_json->>'state' IS DISTINCT FROM 'succeeded'
   OR NEW.bootstrap_install_json->>'state' IS DISTINCT FROM 'succeeded'
   OR NEW.bootstrap_prepare_json->>'step' IS DISTINCT FROM 'prepare'
   OR NEW.bootstrap_install_json->>'step' IS DISTINCT FROM 'install'
   OR NEW.bootstrap_prepare_json->'commandId'='null'::jsonb
   OR NEW.bootstrap_install_json->'commandId'='null'::jsonb
   OR NEW.bootstrap_prepare_json->'observation'='null'::jsonb
   OR NEW.bootstrap_install_json->'observation'='null'::jsonb) IS TRUE
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_BOOTSTRAP_REQUIRED'; END IF;
 -- Public cross-record custody joins for native activation (JS owns canonical hashing/crypto proof).
 IF purpose='native-processing' AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND (
  NEW.bootstrap_prepare_json->'observation'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-prepare/1'
  OR NEW.bootstrap_install_json->'observation'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-install/1'
  OR NEW.bootstrap_prepare_json->'observation'->>'operationId' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'dispatchId'
  OR NEW.bootstrap_install_json->'observation'->>'operationId' IS DISTINCT FROM NEW.bootstrap_install_json->>'dispatchId'
  OR NEW.bootstrap_prepare_json->'observation'->>'requestSha256' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'requestSha256'
  OR NEW.bootstrap_install_json->'observation'->>'requestSha256' IS DISTINCT FROM NEW.bootstrap_install_json->>'requestSha256'
  OR NEW.bootstrap_prepare_json->'observation'->>'bootId' IS DISTINCT FROM NEW.host_identity_json->>'bootId'
  OR NEW.bootstrap_install_json->'observation'->>'bootId' IS DISTINCT FROM NEW.host_identity_json->>'bootId'
  OR NEW.bootstrap_install_json->'observation'->>'prepareOperationId' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'dispatchId'
  OR NEW.bootstrap_install_json->'observation'->>'prepareRequestSha256' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'requestSha256'
  OR NEW.bootstrap_prepare_json->'observation'->'scope' IS DISTINCT FROM NEW.bootstrap_install_json->'observation'->'scope'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'allocation' IS DISTINCT FROM NEW.allocation_json
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'originalBinding' IS DISTINCT FROM NEW.original_binding_json
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'ownerInstanceId' IS DISTINCT FROM NEW.owner_instance_id::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'declarationSha256' IS DISTINCT FROM NEW.declaration_sha256::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'instanceId' IS DISTINCT FROM NEW.observed_instance_json->>'instanceId'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'address' IS DISTINCT FROM NEW.endpoint_json->>'address'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'port' IS DISTINCT FROM NEW.endpoint_json->>'port'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'serverName' IS DISTINCT FROM NEW.endpoint_json->>'serverName'
  OR NEW.bootstrap_install_json->'observation'->>'hostCertificateSha256' IS DISTINCT FROM NEW.client_cert_sha256::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'imageDigest' IS DISTINCT FROM NEW.declaration_json->>'imageDigest'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'sourceCommit' IS DISTINCT FROM NEW.declaration_json->>'sourceCommit'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'bootstrapSha256' IS DISTINCT FROM NEW.declaration_json->>'bootstrapSha256'
  OR ((NEW.bootstrap_prepare_json->'request')-ARRAY['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds','Parameters','TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']) IS DISTINCT FROM '{}'::jsonb
  OR ((NEW.bootstrap_install_json->'request')-ARRAY['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds','Parameters','TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']) IS DISTINCT FROM '{}'::jsonb
  OR NEW.bootstrap_prepare_json->'request'->>'TimeoutSeconds' IS DISTINCT FROM '30'
  OR NEW.bootstrap_install_json->'request'->>'TimeoutSeconds' IS DISTINCT FROM '30'
  OR NEW.bootstrap_prepare_json->'request'->>'MaxConcurrency' IS DISTINCT FROM '1'
  OR NEW.bootstrap_install_json->'request'->>'MaxConcurrency' IS DISTINCT FROM '1'
  OR NEW.bootstrap_prepare_json->'request'->>'MaxErrors' IS DISTINCT FROM '0'
  OR NEW.bootstrap_install_json->'request'->>'MaxErrors' IS DISTINCT FROM '0'
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload'->0) IS DISTINCT FROM 'string'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload'->0) IS DISTINCT FROM 'string'
  OR (NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload'->>0) !~ '^[A-Za-z0-9_-]+$'
  OR (NEW.bootstrap_install_json->'request'->'Parameters'->'Payload'->>0) !~ '^[A-Za-z0-9_-]+$'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'name'
  OR NEW.bootstrap_install_json->'request'->>'DocumentName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'name'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentVersion' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'version'
  OR NEW.bootstrap_install_json->'request'->>'DocumentVersion' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'version'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentHash' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'sha256'
  OR NEW.bootstrap_install_json->'request'->>'DocumentHash' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'sha256'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentHashType' IS DISTINCT FROM 'Sha256'
  OR NEW.bootstrap_install_json->'request'->>'DocumentHashType' IS DISTINCT FROM 'Sha256'
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request') IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request') IS DISTINCT FROM 'object'
  OR NEW.bootstrap_prepare_json->'request'->'InstanceIds' IS DISTINCT FROM jsonb_build_array(NEW.observed_instance_json->>'instanceId')
  OR NEW.bootstrap_install_json->'request'->'InstanceIds' IS DISTINCT FROM jsonb_build_array(NEW.observed_instance_json->>'instanceId')
  OR NEW.bootstrap_prepare_json->'request'->>'Comment' IS DISTINCT FROM 'meri-native-prepare-'||(NEW.bootstrap_prepare_json->>'dispatchId')
  OR NEW.bootstrap_install_json->'request'->>'Comment' IS DISTINCT FROM 'meri-native-install-'||(NEW.bootstrap_install_json->>'dispatchId')
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters') IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters') IS DISTINCT FROM 'object'
  OR (NEW.bootstrap_prepare_json->'request'->'Parameters' ?& ARRAY['Payload']) IS NOT TRUE
  OR (NEW.bootstrap_install_json->'request'->'Parameters' ?& ARRAY['Payload']) IS NOT TRUE
  OR ((NEW.bootstrap_prepare_json->'request'->'Parameters')-ARRAY['Payload']) IS DISTINCT FROM '{}'::jsonb
  OR ((NEW.bootstrap_install_json->'request'->'Parameters')-ARRAY['Payload']) IS DISTINCT FROM '{}'::jsonb
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload') IS DISTINCT FROM 'array'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload') IS DISTINCT FROM 'array'
  OR (CASE WHEN jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload')='array'
   THEN jsonb_array_length(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload') ELSE -1 END) IS DISTINCT FROM 1
  OR (CASE WHEN jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload')='array'
   THEN jsonb_array_length(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload') ELSE -1 END) IS DISTINCT FROM 1
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'port' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'hostEndpoint'->>'port'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'serverName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'hostEndpoint'->>'serverName'
  OR (NEW.bootstrap_prepare_json->'observation'->'scope'->'source' ? 'nativeHelperSha256') IS DISTINCT FROM (NEW.declaration_json ? 'nativeHelperSha256')
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'nativeHelperSha256' IS DISTINCT FROM NEW.declaration_json->>'nativeHelperSha256'
  OR NEW.bootstrap_install_json->'observation'->>'serverCertificateSha256' IS DISTINCT FROM NEW.endpoint_json->>'serverFingerprintSha256'
 ) IS TRUE THEN RAISE EXCEPTION 'HOST_ALLOCATION_BOOTSTRAP_CUSTODY'; END IF;
 -- Dispatch timestamp once-only: only reserved->dispatching, positive, inside the original lease.
 IF NEW.dispatch_started_at_ms IS DISTINCT FROM OLD.dispatch_started_at_ms THEN
  IF OLD.dispatch_started_at_ms IS NOT NULL OR NEW.dispatch_started_at_ms IS NULL
   OR NOT(OLD.state='reserved' AND NEW.state='dispatching') OR NEW.dispatch_started_at_ms<1
   OR NEW.dispatch_started_at_ms>NEW.lease_deadline_ms THEN
   RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 END IF;
 -- Observed instance: bind once; a partially observed null address may fill once for the SAME instance.
 IF NEW.observed_instance_json IS DISTINCT FROM OLD.observed_instance_json THEN
  IF OLD.observed_instance_json IS NULL THEN
   IF NEW.observed_instance_json IS NULL OR OLD.state NOT IN ('dispatching','unknown')
    THEN RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
  ELSIF OLD.state IN ('dispatching','unknown')
   AND OLD.observed_instance_json->>'instanceId'=NEW.observed_instance_json->>'instanceId'
   AND OLD.observed_instance_json->'privateIp'='null'::jsonb
   AND NEW.observed_instance_json->'privateIp'<>'null'::jsonb
   AND jsonb_typeof(NEW.observed_instance_json->'privateIp')='string'
   AND (NEW.observed_instance_json-ARRAY['instanceId','privateIp'])='{}'::jsonb
  THEN NULL;
  ELSE RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 END IF;
 IF OLD.state IN ('reserved','refused') AND NEW.observed_instance_json IS NOT NULL THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 -- Refusal requires proven never-dispatched in BOTH old and new row.
 IF NEW.state='refused' AND OLD.state<>'refused' AND (OLD.state<>'reserved' OR NEW.dispatch_started_at_ms IS NOT NULL
  OR NEW.observed_instance_json IS NOT NULL OR NEW.bootstrap_prepare_json IS NOT NULL
  OR NEW.bootstrap_install_json IS NOT NULL OR NEW.teardown_json IS NOT NULL) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Bootstrap slots: bounded forward-only operations. Known fields never change/clear.
 FOR step IN SELECT unnest(ARRAY['prepare','install']) LOOP
  o:=CASE step WHEN 'prepare' THEN OLD.bootstrap_prepare_json ELSE OLD.bootstrap_install_json END;
  n:=CASE step WHEN 'prepare' THEN NEW.bootstrap_prepare_json ELSE NEW.bootstrap_install_json END;
  IF n IS NOT DISTINCT FROM o THEN CONTINUE; END IF;
  IF o IS NOT NULL AND n IS NULL THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
  IF (n IS NOT NULL AND jsonb_typeof(n)='object'
   AND (n ?& ARRAY['step','state','dispatchId','requestSha256','request','commandId','observation'])
   AND (n-ARRAY['step','state','dispatchId','requestSha256','request','commandId','observation'])='{}'::jsonb
   AND n->>'step'=step AND n->>'state' IN ('reserved','dispatching','unknown','succeeded','failed')
   AND n->>'dispatchId' ~ '^[0-9a-f]{64}$' AND n->>'requestSha256' ~ '^[0-9a-f]{64}$'
   AND jsonb_typeof(n->'request')='object'
   AND (n->'commandId' IS NULL OR n->'commandId'='null'::jsonb OR
    (jsonb_typeof(n->'commandId')='string' AND length(n->>'commandId') BETWEEN 1 AND 256))
   AND (n->'observation' IS NULL OR n->'observation'='null'::jsonb OR jsonb_typeof(n->'observation')='object')
   AND octet_length(n::text)<=65536) IS NOT TRUE
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  IF o IS NULL THEN
   IF n->>'state'<>'reserved' OR n->'commandId'<>'null'::jsonb OR n->'observation'<>'null'::jsonb
    OR OLD.state NOT IN ('dispatching','unknown','active')
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  ELSE
   IF n->>'step'<>o->>'step' OR n->>'dispatchId' IS DISTINCT FROM o->>'dispatchId'
    OR n->>'requestSha256' IS DISTINCT FROM o->>'requestSha256'
    OR n->'request' IS DISTINCT FROM o->'request' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->'commandId'<>'null'::jsonb AND n->'commandId' IS DISTINCT FROM o->'commandId' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->'observation'<>'null'::jsonb AND n->'observation' IS DISTINCT FROM o->'observation' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->>'state' IN ('succeeded','failed') AND n IS DISTINCT FROM o THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF n->>'state' IS DISTINCT FROM o->>'state' AND NOT (
    (o->>'state'='reserved' AND n->>'state' IN ('dispatching','failed')) OR
    (o->>'state'='dispatching' AND n->>'state' IN ('unknown','succeeded','failed')) OR
    (o->>'state'='unknown' AND n->>'state' IN ('succeeded','failed'))) THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
   IF o->>'state'='reserved' AND n->'commandId'<>'null'::jsonb THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
   IF n->'observation'<>'null'::jsonb AND (n->>'commandId' IS NULL OR n->>'commandId'='' OR n->>'state'<>'succeeded') THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  END IF;
 END LOOP;
 IF NEW.bootstrap_install_json IS NOT NULL AND (NEW.bootstrap_prepare_json IS NULL
  OR jsonb_typeof(NEW.bootstrap_prepare_json)<>'object'
  OR NEW.bootstrap_prepare_json->>'state'<>'succeeded'
  OR NEW.bootstrap_prepare_json->'observation' IS NULL
  OR NEW.bootstrap_prepare_json->'observation'='null'::jsonb
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'observation')<>'object') THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION meri_host_control.guard_native_observer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb:=to_jsonb(NEW);old_r jsonb;names text[]:=ARRAY['context','resources','dispatch','dispatch_result','observations','result'];limits integer[]:=ARRAY[32768,262144,16384,16384,524288,65536];
 name text;prefix text;v jsonb;old_v jsonb;t text;digest text;idx integer:=0;phase text;c jsonb;s jsonb;claim jsonb;outcome jsonb;e jsonb;old_phase jsonb;new_phase jsonb;ref text;
 now_ms numeric:=floor(extract(epoch FROM clock_timestamp())*1000);is_v2 boolean;all_null boolean:=true;scheduled jsonb;dispatch_ms numeric;attempt jsonb;uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
 IF TG_OP='UPDATE' THEN old_r:=to_jsonb(OLD); END IF;
 is_v2:=coalesce(NEW.declaration_json->>'schema'='meri-native-provisioning-declaration/2',false);
 FOREACH name IN ARRAY names LOOP
  idx:=idx+1;prefix:='native_physical_'||name;v:=r->(prefix||'_json');t:=r->>(prefix||'_canonical');digest:=r->>(prefix||'_sha256');
  IF v='null'::jsonb THEN PERFORM meri_host_control.observer_require(t IS NULL AND digest IS NULL,'TRIPLET_NULL');
  ELSE
   all_null:=false;
   PERFORM meri_host_control.observer_require(jsonb_typeof(v)='object' AND t IS NOT NULL AND digest~'^[0-9a-f]{64}$'
    AND meri_host_control.observer_size(t)<=limits[idx] AND t::jsonb=v AND meri_host_control.observer_hash(t)=digest,'TRIPLET_INTEGRITY');
  END IF;
  IF TG_OP='UPDATE' AND (NOT is_v2 OR OLD.state IN('terminated','refused') OR OLD.state='reserved') THEN
   PERFORM meri_host_control.observer_require((r->(prefix||'_json')) IS NOT DISTINCT FROM (old_r->(prefix||'_json')) AND (r->(prefix||'_sha256')) IS NOT DISTINCT FROM (old_r->(prefix||'_sha256')) AND (r->(prefix||'_canonical')) IS NOT DISTINCT FROM (old_r->(prefix||'_canonical')),'TERMINAL_OR_RESERVED_IMMUTABLE');
  END IF;
 END LOOP;
 IF NOT is_v2 THEN PERFORM meri_host_control.observer_require(all_null,'OLD_PROTOCOL');RETURN NEW; END IF;
 PERFORM meri_host_control.observer_require(NEW.allocation_json->>'hostMode'='native-processing' AND NEW.native_physical_context_json IS NOT NULL,'V2_CONTEXT_REQUIRED');
 PERFORM meri_host_control.observer_context(r);
 IF TG_OP='INSERT' THEN
  PERFORM meri_host_control.observer_require(NEW.state='reserved' AND NEW.native_physical_context_json->'ordinary'='null'::jsonb
   AND NEW.native_physical_resources_json IS NULL AND NEW.native_physical_dispatch_json IS NULL AND NEW.native_physical_dispatch_result_json IS NULL
   AND NEW.native_physical_observations_json IS NULL AND NEW.native_physical_result_json IS NULL,'RESERVE_ONLY');RETURN NEW;
 END IF;
 PERFORM meri_host_control.observer_require(OLD.declaration_json->>'schema'='meri-native-provisioning-declaration/2' AND OLD.native_physical_context_json IS NOT NULL,'NO_RETROFIT');
 FOREACH name IN ARRAY names LOOP
  IF name='observations' THEN CONTINUE; END IF;
  prefix:='native_physical_'||name;v:=r->(prefix||'_json');old_v:=old_r->(prefix||'_json');
  IF v='null'::jsonb THEN PERFORM meri_host_control.observer_require(old_v='null'::jsonb,'SLOT_ERASE');CONTINUE; END IF;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(v,ARRAY['schema','ordinary','managed']) AND v->>'schema'=CASE name
   WHEN 'context' THEN 'meri-native-physical-contexts/2' WHEN 'resources' THEN 'meri-native-physical-resource-sets/2' WHEN 'dispatch' THEN 'meri-native-physical-dispatches/2'
   WHEN 'dispatch_result' THEN 'meri-native-physical-dispatch-results/2' WHEN 'result' THEN 'meri-native-physical-results/2' END,'SLOT_ENVELOPE');
  FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
   old_phase:=coalesce(old_v->phase,'null'::jsonb);new_phase:=v->phase;
   IF old_phase<>'null'::jsonb THEN
    IF phase='managed' AND name IN('dispatch','dispatch_result') THEN
     IF name='dispatch' THEN
      PERFORM meri_host_control.observer_require(new_phase->'executionArn'=old_phase->'executionArn' AND new_phase->'inputSha256'=old_phase->'inputSha256','MANAGED_APPEND');
      FOR attempt IN SELECT value FROM jsonb_array_elements(old_phase->'attempts') LOOP
       PERFORM meri_host_control.observer_require(EXISTS(SELECT FROM jsonb_array_elements(new_phase->'attempts') x WHERE x=attempt),'MANAGED_ATTEMPT_IMMUTABLE');
      END LOOP;
     ELSE PERFORM meri_host_control.observer_require(new_phase->'executionArn'=old_phase->'executionArn' AND NOT EXISTS(SELECT FROM jsonb_array_elements(old_phase->'historyEventIds') WITH ORDINALITY x(value,n) WHERE new_phase->'historyEventIds'->(x.n::int-1) IS DISTINCT FROM x.value),'MANAGED_OUTCOME_APPEND'); END IF;
    ELSE PERFORM meri_host_control.observer_require(new_phase=old_phase AND meri_host_control.observer_raw(r->>(prefix||'_canonical'),ARRAY[phase])=meri_host_control.observer_raw(old_r->>(prefix||'_canonical'),ARRAY[phase]),'PHASE_IMMUTABLE'); END IF;
   END IF;
   IF old_r->'native_physical_result_json'->phase IS NOT NULL AND old_r->'native_physical_result_json'->phase<>'null'::jsonb THEN
    PERFORM meri_host_control.observer_require(new_phase=old_phase,'FINAL_PHASE_FROZEN');
   END IF;
  END LOOP;
 END LOOP;
 IF OLD.native_physical_context_json->'ordinary'='null'::jsonb AND NEW.native_physical_context_json->'ordinary'<>'null'::jsonb THEN
  PERFORM meri_host_control.observer_require(NEW.state IN('dispatching','unknown','active','revoked','quarantined') AND (NEW.native_physical_context_json#>>'{ordinary,startedAtMs}')::numeric BETWEEN floor(extract(epoch FROM transaction_timestamp())*1000) AND now_ms,'ORDINARY_START');
 END IF;
 PERFORM meri_host_control.observer_journal(r,old_r,TG_OP,now_ms);
 FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
  c:=NEW.native_physical_context_json->phase;s:=NEW.native_physical_resources_json->phase;
  IF s IS NOT NULL AND s<>'null'::jsonb THEN
   PERFORM meri_host_control.observer_require(jsonb_typeof(c)='object','RESOURCE_CONTEXT');PERFORM meri_host_control.observer_resources(r,phase,s);
  END IF;
 END LOOP;
 claim:=NEW.native_physical_dispatch_json->'ordinary';
 IF claim IS NOT NULL AND claim<>'null'::jsonb THEN
  c:=NEW.native_physical_context_json->'ordinary';s:=NEW.native_physical_resources_json->'ordinary';
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(claim,ARRAY['contextSha256','resourcesSha256','dispatchId','ownerProcessId','requestSha256','instanceId','claimedAtMs'])
   AND jsonb_typeof(c)='object' AND jsonb_typeof(s)='object' AND claim->>'dispatchId'~uuid_pattern AND claim->>'ownerProcessId'~uuid_pattern
   AND claim->>'contextSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_context_canonical,ARRAY['ordinary']))
   AND claim->>'resourcesSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_resources_canonical,ARRAY['ordinary']))
   AND claim->'instanceId'=s->'instanceId' AND claim->>'requestSha256'=meri_host_control.observer_hash('{"InstanceIds":['||to_json(s->>'instanceId')::text||']}')
   AND meri_host_control.observer_int(claim->'claimedAtMs',1) AND (claim->>'claimedAtMs')::numeric>=(s->>'completedAtMs')::numeric AND (claim->>'claimedAtMs')::numeric<(c->>'deadlineMs')::numeric,'ORDINARY_CLAIM');
  SELECT value INTO e FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') WHERE value->>'stage'='termination';
  PERFORM meri_host_control.observer_require(e->>'phase'='ordinary' AND e->'operationId'=claim->'dispatchId' AND e#>'{request,dispatchId}'=claim->'dispatchId' AND e#>'{request,instanceId}'=claim->'instanceId' AND e->'startedAtMs'=claim->'claimedAtMs','CLAIM_EVENT');
 ELSE PERFORM meri_host_control.observer_require(NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->>'stage'='termination'),'CLAIM_REQUIRED'); END IF;
 outcome:=NEW.native_physical_dispatch_result_json->'ordinary';
 IF outcome IS NOT NULL AND outcome<>'null'::jsonb THEN
  e:=meri_host_control.observer_event(NEW.native_physical_observations_json,outcome->>'eventId');
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(outcome,ARRAY['dispatchId','eventId']) AND outcome->'dispatchId'=claim->'dispatchId' AND e->>'stage'='termination' AND e#>'{request,dispatchId}'=claim->'dispatchId' AND e->'completion'<>'null'::jsonb,'DISPATCH_OUTCOME');
 END IF;
 PERFORM meri_host_control.observer_require((coalesce(NEW.native_physical_dispatch_json->'managed','null'::jsonb)='null'::jsonb)=(coalesce(NEW.native_physical_dispatch_result_json->'managed','null'::jsonb)='null'::jsonb),'MANAGED_PAIR');
 IF NEW.native_physical_dispatch_json->'managed' IS NOT NULL AND NEW.native_physical_dispatch_json->'managed'<>'null'::jsonb THEN scheduled:=meri_host_control.observer_managed(r); END IF;
 FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
  outcome:=NEW.native_physical_result_json->phase;IF outcome IS NULL OR outcome='null'::jsonb THEN CONTINUE;END IF;
  c:=NEW.native_physical_context_json->phase;s:=NEW.native_physical_resources_json->phase;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(outcome,ARRAY['contextSha256','resourcesSha256','evidenceEventIds','status','reason','finalizedAtMs'])
   AND jsonb_typeof(c)='object' AND outcome->>'contextSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_context_canonical,ARRAY[phase]))
   AND (s IS NULL OR s='null'::jsonb)=(outcome->'resourcesSha256'='null'::jsonb)
   AND (s IS NULL OR s='null'::jsonb OR outcome->>'resourcesSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_resources_canonical,ARRAY[phase])))
   AND meri_host_control.observer_int(outcome->'finalizedAtMs',1) AND (outcome->>'finalizedAtMs')::numeric<=now_ms
   AND meri_host_control.observer_strings(outcome->'evidenceEventIds',uuid_pattern)
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->>'phase'=phase AND entry->'completion'='null'::jsonb),'PHASE_RESULT');
  FOR ref IN SELECT value FROM jsonb_array_elements_text(outcome->'evidenceEventIds') LOOP PERFORM meri_host_control.observer_require(meri_host_control.observer_event(NEW.native_physical_observations_json,ref) IS NOT NULL,'RESULT_REFERENCE');END LOOP;
  IF outcome->>'status'='verified-absent' THEN
   PERFORM meri_host_control.observer_require(outcome->'reason'='null'::jsonb,'VERIFIED_REASON');
   IF phase='ordinary' THEN dispatch_ms:=(claim->>'claimedAtMs')::numeric;
   ELSE SELECT (x->>'atMs')::numeric INTO dispatch_ms FROM jsonb_array_elements(scheduled) x WHERE x->'instanceId'=s->'instanceId';END IF;
   PERFORM meri_host_control.observer_verified(r,phase,outcome,dispatch_ms);
  ELSE
   PERFORM meri_host_control.observer_require(outcome->>'status'='unknown-final' AND outcome->>'reason' IN('deadline','discovery-incomplete','no-owned-instance','multiple-owned-instances','custody-conflict','preobservation-missing','metadata-missing','operation-unknown','budget-exhausted','superseded-by-full-teardown')
    AND ((outcome->>'finalizedAtMs')::numeric>=(c->>'deadlineMs')::numeric OR outcome->>'reason' IN('custody-conflict','budget-exhausted','multiple-owned-instances','superseded-by-full-teardown')),'UNKNOWN_RESULT');
   IF outcome->>'reason'='superseded-by-full-teardown' THEN PERFORM meri_host_control.observer_require(NEW.native_physical_observations_json->'closedForFullTeardown'<>'null'::jsonb AND NEW.native_physical_result_json#>>'{ordinary,status}'='verified-absent','SUPERSEDED_FENCE'); END IF;
  END IF;
 END LOOP;
 IF NEW.state='terminated' THEN
  PERFORM meri_host_control.observer_require(NEW.native_physical_observations_json#>>'{closedForFullTeardown,receiptSha256}'=NEW.teardown_sha256 AND NEW.native_physical_result_json#>>'{ordinary,status}'='verified-absent'
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->'completion'='null'::jsonb)
   AND NEW.native_physical_result_json->'managed'<>'null'::jsonb,'FULL_TEARDOWN');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER native_observer_guard BEFORE INSERT OR UPDATE ON meri_host_control.host_allocations FOR EACH ROW EXECUTE FUNCTION meri_host_control.guard_native_observer();
-- The source writes superseded-M then genuine full teardown in the same transaction.
-- Do not allow that intermediate result to survive a commit without termination.
CREATE FUNCTION meri_host_control.observer_full_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r meri_host_control.host_allocations;
BEGIN
 SELECT * INTO STRICT r FROM meri_host_control.host_allocations WHERE host_id=NEW.host_id AND generation=NEW.generation;
 IF r.native_physical_result_json#>>'{managed,reason}'='superseded-by-full-teardown' OR r.native_physical_result_json#>>'{ordinary,reason}'='superseded-by-full-teardown' THEN
  PERFORM meri_host_control.observer_require(r.state='terminated','FULL_COMMIT_REQUIRED');
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER native_observer_full_commit AFTER INSERT OR UPDATE ON meri_host_control.host_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION meri_host_control.observer_full_commit();

-- Strip actual default function grants on NEW helpers only; preserve old grants.
DO $acl$
DECLARE f record; g record;
BEGIN
 FOR f IN SELECT p.oid,p.proowner,p.proacl,p.oid::regprocedure::text signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='meri_host_control' AND p.proname=ANY(ARRAY['observer_require','observer_object','observer_int','observer_strings','observer_raw','observer_hash','observer_size','observer_event','observer_context','observer_request','observer_facts','observer_discovery','observer_journal','observer_resources','observer_history_event','observer_managed','observer_verified','guard_native_observer','observer_full_commit']) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
  FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) WHERE grantee<>0 AND grantee<>f.proowner LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.signature,pg_get_userbyid(g.grantee));
  END LOOP;
 END LOOP;
END $acl$;
GRANT UPDATE(native_physical_context_json,native_physical_context_sha256,native_physical_context_canonical,native_physical_resources_json,native_physical_resources_sha256,native_physical_resources_canonical,native_physical_dispatch_json,native_physical_dispatch_sha256,native_physical_dispatch_canonical,native_physical_dispatch_result_json,native_physical_dispatch_result_sha256,native_physical_dispatch_result_canonical,native_physical_observations_json,native_physical_observations_sha256,native_physical_observations_canonical,native_physical_result_json,native_physical_result_sha256,native_physical_result_canonical) ON meri_host_control.host_allocations TO meri_host_allocator;
COMMIT;
