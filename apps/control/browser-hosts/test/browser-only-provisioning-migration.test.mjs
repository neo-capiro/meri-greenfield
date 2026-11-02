/** 0008 is a derivation: the pinned 0006 trigger bodies and the 0005/0006/0007 constraints with the native-processing
 * purpose gates widened to the two provisioned purposes, and nothing else. This recomputes that derivation from the
 * predecessor files and compares it byte for byte with the shipped 0008. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const read=name=>readFileSync(fileURLToPath(new URL(`../migrations/${name}`,import.meta.url)),'utf8');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const BOTH="('native-processing','browser-only')";
const body=(name,s)=>{const i=s.indexOf(name);const j=s.indexOf('$$',i)+2;return s.slice(j,s.indexOf('$$;',j));};
const m5=read('0005_native_pre_effect.sql'),m6=read('0006_native_observer_journal.sql'),m7=read('0007_native_cleanup_certificate_window.sql'),m8=read('0008_browser_only_provisioning.sql');

test('0008 pins the exact 0006 trigger bodies it replaces and the constraints it widens',()=>{
 assert.equal(sha(body('FUNCTION meri_host_control.guard_allocation()',m6)),'ee96403bf8406b9b98e15db632f77ce39cb84ceba6c7088b18ebbd95e7536367');
 assert.equal(sha(body('FUNCTION meri_host_control.guard_native_observer()',m6)),'24b998630c9116f54bc7efaf236fc45fae7a0b6a67c2d8094f3bc15361ba5883');
 for(const pin of ['ee96403bf8406b9b98e15db632f77ce39cb84ceba6c7088b18ebbd95e7536367','24b998630c9116f54bc7efaf236fc45fae7a0b6a67c2d8094f3bc15361ba5883',
  "conname IN ('native_physical_phase','native_declaration_shape','host_allocation_certificate_window','host_teardown_receipt','host_allocation_placement'))<>5",
  "LIKE '%browser-only%'"])assert.ok(m8.includes(pin),pin.slice(0,40));
 assert.match(m8,/^BEGIN;\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='60s';\nLOCK TABLE meri_host_control.host_allocations IN ACCESS EXCLUSIVE MODE;/mu);
 assert.match(m8,/COMMIT;\n$/u);
 assert.doesNotMatch(m8,/CREATE ROLE|GRANT |DROP TABLE|DELETE FROM|DROP TRIGGER|CREATE TRIGGER/u,'the triggers keep their bindings; only the function bodies change');
});
test('guard_allocation in 0008 is the 0006 body with exactly its five native purpose gates widened',()=>{
 const g6=body('FUNCTION meri_host_control.guard_allocation()',m6),g8=body('FUNCTION meri_host_control.guard_allocation()',m8);
 assert.equal(g6.split("IF purpose='native-processing' THEN").length-1,1);
 assert.equal(g6.split("IF purpose='native-processing' AND").length-1,4);
 const derived=g6.replaceAll("IF purpose='native-processing' THEN",`IF purpose IN ${BOTH} THEN`).replaceAll("IF purpose='native-processing' AND",`IF purpose IN ${BOTH} AND`);
 assert.equal(g8,derived);
 assert.equal(g8.includes("purpose='native-processing'"),false);
 // The legacy insert branch is untouched: a row without hostMode is still inserted only as active.
 assert.ok(g8.includes("  ELSE\n   IF NEW.state<>'active' OR NEW.declaration_json IS NOT NULL"));
});
test('guard_native_observer in 0008 is the 0006 body with V2_CONTEXT_REQUIRED widened and nothing else',()=>{
 const o6=body('FUNCTION meri_host_control.guard_native_observer()',m6),o8=body('FUNCTION meri_host_control.guard_native_observer()',m8);
 const old="observer_require(NEW.allocation_json->>'hostMode'='native-processing' AND NEW.native_physical_context_json IS NOT NULL,'V2_CONTEXT_REQUIRED')";
 assert.equal(o6.split(old).length-1,1);
 assert.equal(o8,o6.replace(old,`observer_require(NEW.allocation_json->>'hostMode' IN ${BOTH} AND NEW.native_physical_context_json IS NOT NULL,'V2_CONTEXT_REQUIRED')`));
 assert.ok(m8.includes('LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$'+o8),'definer and search_path are preserved');
 assert.ok(m8.includes("RETURNS trigger LANGUAGE plpgsql\n SET search_path=pg_catalog AS $$"+body('FUNCTION meri_host_control.guard_allocation()',m8)),'guard_allocation stays invoker and pinned to pg_catalog');
});
test('the three widened constraints are the predecessor definitions with the purpose predicate widened',()=>{
 const slice=(s,start,end)=>{const i=s.indexOf(start);return s.slice(i,s.indexOf(end,i)+end.length);};
 const phase5=slice(m5," ADD CONSTRAINT native_physical_phase CHECK(("," ) IS TRUE);"),phase8=slice(m8," ADD CONSTRAINT native_physical_phase CHECK(("," ) IS TRUE);");
 assert.equal(phase8,phase5.replace("AND allocation_json->>'hostMode'='native-processing')",`AND allocation_json->>'hostMode' IN ${BOTH})`));
 const decl6=slice(m6," ADD CONSTRAINT native_declaration_shape CHECK(("," ) IS TRUE);"),decl8=slice(m8," ADD CONSTRAINT native_declaration_shape CHECK(("," ) IS TRUE);");
 assert.equal(decl8,decl6.replace("(allocation_json->>'hostMode' IS DISTINCT FROM 'native-processing'\n   AND declaration_json IS NULL AND declaration_sha256 IS NULL)",
  `((allocation_json->>'hostMode' IS NULL OR allocation_json->>'hostMode' NOT IN ${BOTH})\n   AND declaration_json IS NULL AND declaration_sha256 IS NULL)`)
  .replace("(allocation_json->>'hostMode'='native-processing'\n   AND jsonb_typeof(declaration_json)='object'",`(allocation_json->>'hostMode' IN ${BOTH}\n   AND jsonb_typeof(declaration_json)='object'`));
 assert.ok(decl8.includes("(allocation_json->>'hostMode'='native-processing' AND declaration_json IS NULL AND declaration_sha256 IS NULL\n   AND state IN ('active','revoked','quarantined','terminated')"),'historical native rows keep their own branch');
 const win7=slice(m7,"ADD CONSTRAINT host_allocation_certificate_window CHECK (","\n);"),win8=slice(m8,"ADD CONSTRAINT host_allocation_certificate_window CHECK (","\n);");
 assert.equal(win8,win7.replace("AND allocation_json->>'hostMode'='native-processing'\n",`AND allocation_json->>'hostMode' IN ${BOTH}\n`));
 for(const name of ['native_physical_phase','native_declaration_shape','host_allocation_certificate_window'])
  assert.equal(m8.split(`DROP CONSTRAINT ${name};`).length-1,1,name);
 // The teardown receipt shape and the placement vocabulary are not touched: browser-only already had both in 0004.
 assert.equal(m8.includes('host_teardown_receipt CHECK'),false);assert.equal(m8.includes('host_allocation_placement CHECK'),false);
});
