/** The data-access reader over the real registry (catalog, families, guidance, retained relation names) with a SYNTHETIC policy
 * resolver and installation. No PostgreSQL, Core, gateway or run is involved: this proves the composition, not a live read. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createDataAccessReader} from '../reader.mjs';
import {DATA_ACCESS_STATES,DATA_ACCESS_ERRORS} from '../protocol.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {READ_FAMILY_IDS} from '../../../worker/conversation/reads/families.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {RETAINED_PUBLIC_RELATIONS} from '../../../gateway/sources/capiro-data/handler.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../../../../packages/contracts/retrieval-0.2/capiro-data-validation.mjs';
const NOW=Date.UTC(2026,10,1,12),CLIENT='00000000-0000-4000-8000-000000000901';
const rows=familyReads(),ops=family=>rows.filter(row=>row.family===family).map(row=>row.operation);
const principal=(over={})=>({tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[CLIENT],membershipRevision:'m1',...over});
/** A policy that admits exactly the named families, with every installed operation active (the preview profile's shape). */
const policyFor=(families,installed)=>({generalReads:families.length>0,readFamilies:families,activeReadOperations:installed.filter(op=>families.includes(rows.find(row=>row.operation.id===op.id&&row.operation.version===op.version)?.family))});
function setup({installed=[...ops('mail'),...ops('capiro-data-v5'),...ops('action-items-complete'),...ops('public-reports')],families=['mail','capiro-data-v5','action-items-complete'],policy}={}){
 const calls=[];
 const reader=createDataAccessReader({installed,now:()=>NOW,async policyForActor(value){calls.push(value);if(policy==='down')throw Error('synthetic settings store unavailable');return policy===null?null:policyFor(families,installed);}});
 return {reader,calls,read:(request={clientId:null},who=principal())=>reader.read({principal:who,request})};
}
const code=c=>e=>e.message===c&&productFailure(e)?.code===c;

test('one row per constructible family from the registry, with guidance, installation and policy read as states',async()=>{
 const s=setup(),page=await s.read({clientId:CLIENT});
 assert.equal(page.schemaVersion,'meri.data-access/1');assert.equal(page.checkedAt,new Date(NOW).toISOString());assert.equal(page.clientId,CLIENT);assert.equal(page.generalReads,true);
 assert.deepEqual(page.families.map(row=>row.family),[...new Set(rows.map(row=>row.family))].sort(),'every constructible family, sorted, once');
 assert.deepEqual(s.calls,[{tenantId:'tenant',actorRole:'standard_user',signal:undefined}],'policy is resolved once for the admitted member');
 const by=Object.fromEntries(page.families.map(row=>[row.family,row]));
 assert.equal(by.mail.state,'available');assert.equal(by.mail.requires,'mailbox');assert.match(by.mail.covers,/mailbox/u);assert.equal(typeof by.mail.freshness,'string');assert.equal(by.mail.structured,false);
 assert.equal(by['capiro-data-v5'].state,'available');assert.equal(by['capiro-data-v5'].structured,true);assert.equal(Object.hasOwn(by['capiro-data-v5'],'operations'),false,'operation names never reach the wire');
 assert.equal(by['action-items-complete'].state,'available');assert.equal(by['action-items-complete'].clientScope,'required');
 assert.equal(by['public-reports'].state,'policy_off','installed but outside the member\'s readFamilies');
 assert.equal(by['federal-legislation'].state,'not_installed','in the registry, not in this installation');
 for(const row of page.families){assert(DATA_ACCESS_STATES.includes(row.state),row.family);assert(READ_FAMILY_IDS.includes(row.family));assert(row.covers===null||typeof row.covers==='string');assert(row.requires===null||row.requires==='mailbox');}
 assert(Object.isFrozen(page)&&Object.isFrozen(page.families[0]));
});
test('General (no client) turns client-required families and client_records relations into client_required; public relations follow the SQL family',async()=>{
 const s=setup(),general=await s.read({clientId:null});
 const by=Object.fromEntries(general.families.map(row=>[row.family,row]));
 assert.equal(by['action-items-complete'].state,'client_required');assert.equal(by.mail.state,'available','optional client scope stays available');
 assert.deepEqual(general.relations.filter(r=>r.source==='public').map(r=>[r.name,r.state]),RETAINED_PUBLIC_RELATIONS.map(name=>[name,'available']));
 assert.deepEqual(general.relations.filter(r=>r.source==='client_records').map(r=>r.state),RETAINED_CAPIRO_PRIVATE_RELATIONS.map(()=>'client_required'));
 const client=await s.read({clientId:CLIENT});assert(client.relations.every(r=>r.state==='available'));
 const noSql=setup({families:['mail']});assert((await noSql.read()).relations.every(r=>r.state==='policy_off'),'relations are off when every SQL family is off by policy');
 const uninstalled=setup({installed:ops('mail'),families:['mail','capiro-data-v5']});assert((await uninstalled.read()).relations.every(r=>r.state==='not_installed'));
});
test('a null policy reads every installed family as policy_off; a resolver failure refuses without a page',async()=>{
 const off=setup({policy:null}),page=await off.read();assert.equal(page.generalReads,false);
 assert(page.families.every(row=>row.state==='policy_off'||row.state==='not_installed'));assert(page.families.some(row=>row.state==='policy_off'));
 await assert.rejects(setup({policy:'down'}).read(),code('DATA_ACCESS_POLICY_UNAVAILABLE'));
 assert.equal(DATA_ACCESS_ERRORS.DATA_ACCESS_POLICY_UNAVAILABLE,503);
});
test('the client is described only when the current admission holds it; the request is closed',async()=>{
 const s=setup();
 await assert.rejects(s.read({clientId:CLIENT},principal({clientIds:[]})),e=>code('DATA_ACCESS_CLIENT_REFUSED')(e)&&productFailure(e).field==='clientId');
 await assert.rejects(s.read({clientId:'not-a-uuid'}),e=>code('DATA_ACCESS_REQUEST_INVALID')(e)&&productFailure(e).field==='clientId');
 await assert.rejects(s.read({}),code('DATA_ACCESS_REQUEST_INVALID'));
 await assert.rejects(s.read({clientId:null,tenantId:'other'}),code('DATA_ACCESS_REQUEST_INVALID'));
 assert.equal(s.calls.length,0,'nothing is resolved for a refused request');
 assert.throws(()=>createDataAccessReader({installed:'x',policyForActor(){},now:Date.now}),e=>e.message==='PRODUCT_CONFIGURATION');
});
