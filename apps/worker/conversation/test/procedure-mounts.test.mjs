/** Wave5 MO01/ST16: a selected procedure intersects the mounted read surface. The mounted set is the profile's own
 * fixed active reads (never a policy), and the intersection can only remove a read — it never adds a tool, widens an
 * effect or grants access. An absent procedure leaves the mount exactly as it was. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../../../runtime/product-ports/capability-policy.mjs';
import {createProfileMounts} from '../capabilities/mounts.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {resolveCapabilityPolicy} from '../capabilities/policy-resolution.mjs';
import {familyReads,profileReads} from '../reads/availability.mjs';
import {readToolName} from '../reads/tools.mjs';
import {readOperationSpellings} from '../reads/vocabulary.mjs';
import {narrowProcedureTools} from '../procedures/guidance.mjs';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};

const PROFILE=resolveCapabilityPolicy({platform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM,tenant:{},role:'standard_user'});
const ACTIVE_ROWS=familyReads().filter(row=>!/[^a-z0-9_.]/u.test(row.operation.id)).slice(0,3);
const ACTIVE=ACTIVE_ROWS.map(row=>row.operation);
const POLICY=assertCapabilityPolicy({...PROFILE,skillPlugin:false,skillNames:null,workspaceTools:false,activeReadOperations:ACTIVE});
const readPort=operations=>({async readAvailability(){const at=Date.now();return {
 installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},
 discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}});
const mounted=operations=>createProfileMounts({policy:POLICY,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,generalReads:readPort(operations)});
const quiet=async fn=>{const original=process.emitWarning;process.emitWarning=(warning,...rest)=>{if(String(warning).includes('canUseTool will not be invoked'))return;return original.call(process,warning,...rest);};try{return await fn();}finally{process.emitWarning=original;}};

test('a procedure narrows the mounted read surface and never widens it',async()=>{
 await quiet(async()=>{
  assert.equal(ACTIVE_ROWS.length,3,'fixture has three canonical reads');
  const mountedNames=profileReads({policy:POLICY}).map(row=>row.operation);
  assert.deepEqual(mountedNames,ACTIVE);
  const base=await mounted(ACTIVE);
  try{
   assert.deepEqual(base.reads.available,ACTIVE);
   const baseline=[...base.reads.sdkOptions.allowedTools];
   assert.equal(baseline.length,ACTIVE.length);
   // One granted read (in both spellings this catalog uses) keeps exactly that read and nothing else. The mount's own
   // advertised list is the profile's fixed list; the read the procedure did not grant is not available to the run, and
   // the run's SDK list is intersected from it by the activity (narrowProcedureTools), so nothing wider is ever used.
   for(const granted of [ACTIVE[0].id,ACTIVE[0].id.replaceAll('.','_')]){
    const narrowed=await createProfileMounts({policy:POLICY,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,generalReads:readPort(ACTIVE),procedure:{allowedTools:[granted]}});
    try{
     assert.deepEqual(narrowed.reads.available,[ACTIVE[0]],granted);
     assert.ok(narrowed.reads.sdkOptions.allowedTools.every(name=>baseline.includes(name)),'the mounted list is never widened');
    }finally{await narrowed.reads.close();}
   }
   // A grant outside the mounted surface cannot add a mount: the narrower set is empty, never wider.
   const unknown=await createProfileMounts({policy:POLICY,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,generalReads:readPort(ACTIVE),procedure:{allowedTools:['shell_exec']}});
   try{assert.deepEqual(unknown.reads.available,[]);}finally{await unknown.reads.close();}
   // The canonical seam: Core projects a capability to the read's DECLARED catalog alias (`mail.read` -> `list_emails`),
   // never to the dotted id or the SDK spelling. The same grant must still resolve to exactly that one read, both for
   // the run's available surface and for the SDK list the activity narrows.
   const mailRow=ACTIVE_ROWS.find(row=>row.operation.id==='mail.list_messages');
   assert.ok(mailRow,'the mounted surface includes the canonical mail list read');
   const alias=catalog.operations.find(descriptor=>descriptor.operation.id===mailRow.operation.id).aliases[0];
   assert.equal(alias,'list_emails','the catalog alias is the name Core projects for the mail.read capability');
   const spellings=readOperationSpellings(mailRow.operation.id);
   assert.ok(spellings.has(alias)&&spellings.has(mailRow.operation.id)&&spellings.has(mailRow.operation.id.replaceAll('.','_')),'one operation, its SDK spelling and its declared alias resolve together');
   for(const granted of [alias,mailRow.operation.id,mailRow.operation.id.replaceAll('.','_')]){
    const narrowed=await createProfileMounts({policy:POLICY,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,generalReads:readPort(ACTIVE),procedure:{allowedTools:[granted]}});
    try{assert.deepEqual(narrowed.reads.available,[mailRow.operation],granted);}finally{await narrowed.reads.close();}
   }
   // And the activity's own SDK-list narrowing keeps the granted entry under the alias spelling while removing the
   // ungranted mounted reads; every surviving name is one the mount already advertised.
   const kept=narrowProcedureTools(baseline,[alias]);
   assert.deepEqual(kept,[readToolName(mailRow)],'the granted read survives under its SDK name and the others do not');
   assert.ok(kept.every(name=>baseline.includes(name)),'the SDK list is never widened');
   assert.deepEqual(narrowProcedureTools(baseline,['shell_exec']),[],'a grant that names no mounted read leaves nothing auto-allowed rather than re-admitting the list');
   assert.deepEqual(narrowProcedureTools(baseline,[ACTIVE[0].id,ACTIVE[1].id,ACTIVE[2].id]),baseline,'granting every mounted read leaves the list unchanged');
  }finally{await base.reads.close();}
 });
});
