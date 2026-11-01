/** SYNTHETIC: the data-access family over the real reader, routes, product transport, settings store statements (scripted pool)
 * and capability resolver, with a fake Core membership gate. Not PostgreSQL, Core or a live installation. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDataAccessFamily} from '../data-access.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../capability-policy.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {createSettingsPoolFixture} from '../../../control/settings/test/postgres-store-fixture.mjs';
import {DATA_ACCESS_PATH} from '../../../control/data-access/protocol.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const reads={schemaVersion:1,enabled:true,operations:[{id:'describe_capiro_data',version:'0.5.0'},{id:'query_capiro_data',version:'0.5.0'},{id:'query_action_items',version:'0.2.0'}],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
/** The deployed platform record names its active read operations (`infra/product-preview/.../deployment-inputs.json`); the proposed
 * preview profile alone activates none, exactly as the gateway would list none. */
const profile=record=>({...record,activeReadOperations:reads.operations}),platform={maximum:profile(PROPOSED_PREVIEW_CAPABILITY_PLATFORM.maximum),defaults:profile(PROPOSED_PREVIEW_CAPABILITY_PLATFORM.defaults),
 roleCeilings:Object.fromEntries(Object.entries(PROPOSED_PREVIEW_CAPABILITY_PLATFORM.roleCeilings).map(([role,record])=>[role,profile(record)]))};
const base={limits:{startupMs:1000,shutdownMs:1000,requestMs:25000,requestBytes:131072},native:{maxResponseBytes:2097152},reads:{enabled:true},capabilityPlatform:platform,agentcore:{approvedReads:reads}};
const principal=(over={})=>Object.freeze({tenantId:'tenant-one',actorId:'actor-1',role:'standard_user',permissions:[],clientIds:[id(901)],membershipRevision:'m1',...over});
const gate=current=>Object.freeze({async admit(){return {principal:current(),expiresAtMs:Date.now()+60000};},async recheck({principal:p}){return p;}});
const post=(body={clientId:null})=>new Request('https://control.example'+DATA_ACCESS_PATH,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer native-session'},body:JSON.stringify(body)});
const tenantRead=/^SELECT \* FROM meri_settings\.tenant_settings WHERE tenant_id=\$1$/u;
/** One tenant-settings read per request: absent row inherits the platform defaults; a saved policy narrows. */
const tenantScript=(document=null)=>({steps:[{match:tenantRead,rows:document===null?[]:[{revision:1,document,document_sha256:canonicalSha256(document),monthly_cap_micro_usd:null,sdk_max_turns:20,sdk_max_budget_micro_usd:2000000}]}]});
/** The family factory as `createProductPortsFactory` calls it (index.mjs itself loads every family, including the artifact storage owners). */
function compose({configuration=base,pool,membership}={}){
 const result=createDataAccessFamily(Object.freeze({configuration,pool:pool??{},client:{},native:{},now:Date.now,canonicalProductPorts:membership?{conversationMembership:membership}:{}}));
 return Object.fromEntries(Object.entries(result.ports).filter(([,value])=>value!==undefined));
}

test('typed reads off, no installation or no membership owner compose no port; readiness names the gap',()=>{
 const untouched=new Proxy({},{get(){throw Error('pool touched');}});
 assert.deepEqual(compose({configuration:{...base,reads:{enabled:false}},pool:untouched,membership:gate(principal)}),{});
 assert.deepEqual(compose({configuration:{...base,agentcore:{}},pool:untouched,membership:gate(principal)}),{});
 assert.deepEqual(compose({pool:untouched}),{});
 // Readiness reads the captured port names (`captureRuntimePorts` → `configuredOwners`); the capture itself loads the artifact
 // storage owners, so readiness is checked here on the names it would see.
 assert.equal(productReadiness({ports:{configuredOwners:[]},retention:null,sourceEnabled:false}).owners.find(o=>o.name==='data-access.application').state,'unavailable');
 const idle=createSettingsPoolFixture([]),ports=compose({pool:idle.pool,membership:gate(principal)});assert.deepEqual(Object.keys(ports),['dataAccessApplication']);assert.equal(idle.connections(),0,'composition opens no connection');
 assert.equal(productReadiness({ports:{configuredOwners:Object.keys(ports)},retention:null,sourceEnabled:false}).owners.find(o=>o.name==='data-access.application').state,'composed');
});
test('an admitted member reads the installed families against platform and saved tenant policy for a held client or General',async()=>{
 const sql=createSettingsPoolFixture([tenantScript(),tenantScript({defaultTimezone:'UTC',capabilityPolicy:{capabilities:{readFamilies:['capiro-data-v5']}}}),tenantScript()]);
 const {dataAccessApplication:app}=compose({pool:sql.pool,membership:gate(principal)});
 const first=await app.handle(post({clientId:id(901)}));assert.equal(first.status,200);const page=await first.json();
 assert.equal(page.clientId,id(901));assert.equal(page.generalReads,true);
 const by=Object.fromEntries(page.families.map(row=>[row.family,row]));
 assert.equal(by['capiro-data-v5'].state,'available');assert.equal(by['operational-reads'].state,'available');assert.equal(by['capiro-data'].state,'not_installed');assert.equal(by.mail.state,'not_installed');
 assert(page.relations.every(r=>r.state==='available'));
 const narrowed=await (await app.handle(post({clientId:null}))).json();
 const narrowedBy=Object.fromEntries(narrowed.families.map(row=>[row.family,row]));
 assert.equal(narrowedBy['capiro-data-v5'].state,'available');assert.equal(narrowedBy['operational-reads'].state,'policy_off','the saved tenant policy narrows the family away');
 assert.deepEqual(narrowed.relations.filter(r=>r.source==='client_records').map(r=>r.state),narrowed.relations.filter(r=>r.source==='client_records').map(()=>'client_required'));
 const refused=await app.handle(post({clientId:id(902)}));assert.equal(refused.status,403);assert.deepEqual(await refused.json(),{error:{code:'DATA_ACCESS_CLIENT_REFUSED',field:'clientId'}});
 assert.equal(sql.calls.filter(c=>tenantRead.test(c.sql)).length,2,'a refused client never reads settings');
 const invalid=await app.handle(post({}));assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.code,'DATA_ACCESS_REQUEST_INVALID');
 const method=await app.handle(new Request('https://control.example'+DATA_ACCESS_PATH));assert.equal(method.status,405);
});
test('a settings store failure answers a closed 503 and discloses nothing',async()=>{
 const sql=createSettingsPoolFixture([{steps:[{match:tenantRead,error:true}]}]);
 const {dataAccessApplication:app}=compose({pool:sql.pool,membership:gate(principal)});
 const down=await app.handle(post());assert.equal(down.status,503);assert.deepEqual(await down.json(),{error:{code:'DATA_ACCESS_POLICY_UNAVAILABLE'}});
});
