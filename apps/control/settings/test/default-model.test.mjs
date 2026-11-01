/** M4: personal default model save/read/restore under compare-and-set against the deployed first-chat catalog, through
 * the real settings service, document validators and the in-memory store double. No PostgreSQL or Core membership. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {productFailure} from '../../product-access/errors.mjs';
import {createSettingsService} from '../service.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../documents.mjs';
import {PLATFORM,createSettingsStoreDouble} from './fixtures.mjs';
const policy=JSON.parse(await readFile(new URL('../../../../infra/product-preview/first-chat/policy.json',import.meta.url),'utf8')),catalog=policy.models;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const member=()=>Object.freeze({tenantId:'tenant-one',actorId:'actor-1',role:'member',permissions:[],clientIds:[id(901)],membershipRevision:'m1'});
const SONNET=catalog.defaultSelection,OPUS={provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6',effort:null};
function setup(modelCatalog=catalog){let n=100;const store=createSettingsStoreDouble();return {store,service:createSettingsService({store,modelCatalog,readPlatformLimits:async()=>structuredClone(PLATFORM),newId:()=>id(n++)})};}
const prefs=over=>({...structuredClone(USER_PREFERENCE_DEFAULTS),notifications:{...USER_PREFERENCE_DEFAULTS.notifications},...over});
const failed=async(promise,code,field)=>assert.rejects(promise,e=>{const f=productFailure(e);return f?.code===code&&(field===undefined||f.field===field);});

test('save A/null with expectedRevision, read it back, then restore the original document at the current revision; a stale revision conflicts without overwriting',async()=>{
 const t=setup(),p=member();
 const original=await t.service.readUser({principal:p});assert.equal(original.revision,0);assert.equal(original.preferences.defaultModel,null);
 assert.deepEqual(original.modelCatalog,catalog,'the read carries the served catalog unchanged, pending rows excluded');
 const saved=await t.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs({defaultModel:SONNET,theme:'dark'})}});
 assert.equal(saved.revision,1);assert.deepEqual(saved.preferences.defaultModel,SONNET);
 const read=await t.service.readUser({principal:p});assert.equal(read.revision,1);assert.deepEqual(read.preferences.defaultModel,SONNET);assert.equal(read.preferences.theme,'dark','unrelated fields are preserved');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs(original.preferences)}}),'SETTINGS_REVISION_CONFLICT');
 assert.deepEqual((await t.service.readUser({principal:p})).preferences.defaultModel,SONNET,'a CAS conflict overwrites nothing');
 const restored=await t.service.saveUser({principal:p,body:{expectedRevision:read.revision,preferences:prefs({...original.preferences,theme:'dark'})}});
 assert.equal(restored.revision,2);assert.equal(restored.preferences.defaultModel,null);
 assert.deepEqual(t.store.audit.map(a=>a.changedFields),[['defaultModel.modelId','defaultModel.provider','theme'],['defaultModel.modelId','defaultModel.provider']],'the audit names the changed paths only');
});

test('an unqualified catalog row or pending effort cannot become a personal default; a Release flip admits it with no code change',async()=>{
 const t=setup(),p=member();
 for(const defaultModel of [OPUS,{...OPUS,effort:'high'},{...SONNET,effort:'high'},{...SONNET,effort:'max'},{provider:'claude-api',modelId:'claude-sonnet-4-6',effort:null}])
  await failed(t.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs({defaultModel})}}),'SETTINGS_FIELD_INVALID','defaultModel');
 assert.equal(t.store.docs.size,0);assert.equal(t.store.audit.length,0);
 const flipped=structuredClone(catalog);const opus=flipped.models.find(m=>m.modelId===OPUS.modelId);opus.available=true;opus.unavailableReason=null;
 const after=setup(flipped),saved=await after.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs({defaultModel:{...OPUS,effort:'max'}})}});
 assert.deepEqual(saved.preferences.defaultModel,{...OPUS,effort:'max'});
 await failed(after.service.saveUser({principal:p,body:{expectedRevision:1,preferences:prefs({defaultModel:{...SONNET,effort:'high'}})}}),'SETTINGS_FIELD_INVALID','defaultModel');
});
