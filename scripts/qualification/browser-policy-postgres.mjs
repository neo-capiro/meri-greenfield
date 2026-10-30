/** Actual existing isolated PostgreSQL fixture. Settings service, HTTP mount,
 * policy resolver and SQL are real; native identity/Core membership are scripted.
 * No product database, reset, deployment or private browser content is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createSettingsFamily} from '../../apps/runtime/product-ports/settings.mjs';
import {createPostgresSettingsStore} from '../../apps/control/settings/postgres-store.mjs';
import {createSettingsService,TENANT_SETTINGS_PERMISSION} from '../../apps/control/settings/service.mjs';
import {createMembershipGate} from '../../apps/control/product-access/membership.mjs';
import {createConfiguredRunBrowserPolicy,DEFAULT_BROWSER_PLATFORM} from '../../apps/runtime/product-ports/browser-policy.mjs';
import {compileCapabilityPlatform} from '../../apps/runtime/product-ports/capability-policy.mjs';
import {TENANT_SETTINGS_PATHS} from '../../apps/control/settings/tenant-application/protocol.mjs';
if(process.env.MERI_HOST_ALLOCATIONS_PG_ATTEST!=='isolated-local')throw Error('BROWSER_POLICY_PG_ATTESTATION_REQUIRED');
const connection={host:'127.0.0.1',port:55487,database:'wave6_browser_custody_20261030',connectionTimeoutMillis:1500};
test('admin browser policy is revisioned, audited and current under the actual ordinary PostgreSQL role',async t=>{
 const adminPool=new pg.Pool({...connection,user:'office_fixture_admin',max:1});t.after(()=>adminPool.end());
 // Bring this existing isolated fixture up to the already shipped settings
 // grants. No new product grant or migration is introduced by this feature.
 await adminPool.query(await readFile(new URL('../../apps/control/settings/migrations/0002_tenant_settings_control_grants.sql',import.meta.url),'utf8'));
 await adminPool.query('GRANT INSERT ON meri_settings.settings_audit TO meri_control_runtime');
 await adminPool.query('GRANT USAGE ON SEQUENCE meri_settings.settings_audit_sequence_seq TO meri_control_runtime');
 const pool=new pg.Pool({...connection,user:'wave6_host_reader_20261030',max:4});t.after(()=>pool.end());
 const role=(await pool.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.deepEqual(role,{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolbypassrls:false});
 const tenantId='browser-policy-'+randomUUID(),actorId='admin-'+randomUUID();
 const binding={tenantId,actorId,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{kind:'private-user',tenantId,resourceId:actorId,policyRevision:'fixture-policy-1'}];
 const platform=structuredClone(DEFAULT_BROWSER_PLATFORM);for(const p of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)])p.allowedOrigins=['https://records.example','https://notices.example'];
 platform.roleCeilings.standard_user.allowedOrigins=['https://records.example'];
 const configuration={browserPlatform:platform,tenantSettings:{enabled:true},limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144}};
 const principal={tenantId,actorId,role:'user_admin',permissions:[TENANT_SETTINGS_PERMISSION],clientIds:[]};
 const gate=createMembershipGate({now:Date.now,limits:{maxRequestMs:5000,maxFactBytes:65536},
  async verifyToken({credential}){assert.ok(['admin','member','other'].includes(credential));return {tenantId:credential==='other'?tenantId+'-other':tenantId,actorId,checkedAtMs:Date.now(),expiresAtMs:Date.now()+10000};},
  async readMembership({tenantId:requestedTenant,credential}){return {tenantId:requestedTenant,actorId,status:'active',role:credential==='member'?'standard_user':'user_admin',permissions:credential==='member'?[]:[TENANT_SETTINGS_PERMISSION],clientIds:[],membershipRevision:'fixture-membership-1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+10000};}});
 const {settingsApplication}=createSettingsFamily({configuration,pool,canonicalProductPorts:{conversationMembership:gate}}).ports;
 const call=async(route,body={},credential='admin')=>{const response=await settingsApplication.handle(new Request('https://control.synthetic.invalid'+TENANT_SETTINGS_PATHS[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(body)}));return {status:response.status,value:await response.json()};};
 const base={defaultTimezone:'UTC',capabilityPolicy:{}},restriction={browser:{allowedOrigins:['https://records.example']}};
 const read=createConfiguredRunBrowserPolicy(configuration,{pool}),request={binding,scopes,actorRole:'user_admin'};
 assert.equal((await read(request)).allowedOrigins.length,2,'absent row uses approved defaults');
 assert.equal((await call('save',{expectedRevision:0,settings:{...base,browserPolicy:restriction}},'member')).status,403);
 assert.equal((await call('save',{expectedRevision:0,settings:{...base,browserPolicy:{browser:{allowedOrigins:['https://outside.example']}}}})).status,422);
 assert.equal((await call('save',{expectedRevision:0,settings:{...base,browserPolicy:restriction}})).status,200);
 assert.deepEqual((await read(request)).allowedOrigins,['https://records.example']);
 assert.equal((await call('read',{},'other')).value.revision,0,'foreign tenant does not read saved policy');
 assert.equal((await call('read',{},'member')).value.browserPolicy,undefined,'member receives only effective policy');
 assert.equal((await call('save',{expectedRevision:1,settings:{...base,defaultTimezone:'America/Chicago'}})).status,200);
 assert.deepEqual((await read(request)).allowedOrigins,['https://records.example'],'older client omission preserved');
 const store=createPostgresSettingsStore({pool}),observed=Promise.withResolvers(),resume=Promise.withResolvers();
 const service=createSettingsService({store:{...store,async read(input){const saved=await store.read(input);observed.resolve();await resume.promise;return saved;}},newId:randomUUID,readPlatformLimits:async()=>compileCapabilityPlatform(configuration),readBrowserPlatformLimits:async()=>platform});
 const old=service.saveTenant({principal,body:{expectedRevision:2,settings:base}});old.catch(()=>{});await observed.promise;
 assert.equal((await call('save',{expectedRevision:2,settings:{...base,browserPolicy:{browser:{enabled:false}}}})).status,200);
 resume.resolve();await assert.rejects(old,/SETTINGS_REVISION_CONFLICT/u);
 assert.deepEqual(await read(request),{enabled:false},'next decision sees committed disable');
 const saved=await call('read');assert.equal(saved.value.revision,3);
 const audit=await call('audit');assert.equal(audit.status,200);assert.equal(audit.value.entries.length,3);
 assert.ok(audit.value.entries[0].changedFields.includes('browserPolicy.browser'));
 assert.deepEqual(audit.value.entries[1].changedFields,['defaultTimezone']);
 assert.equal((await call('save',{expectedRevision:3,settings:{...base,browserPolicy:{}}})).status,200);
 assert.deepEqual((await read({...request,actorRole:'standard_user'})).allowedOrigins,['https://records.example'],'fresh role ceiling applies');
 assert.deepEqual((await read(request)).allowedOrigins,platform.defaults.allowedOrigins);
 await assert.rejects(pool.query('DELETE FROM meri_settings.tenant_settings WHERE tenant_id=$1',[tenantId]),e=>e.code==='42501');
 await assert.rejects(pool.query('UPDATE meri_settings.settings_audit SET actor_id=$1 WHERE tenant_id=$2',['changed',tenantId]),e=>e.code==='42501');
});
