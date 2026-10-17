/** Actual user application/service/document and membership gate over SYNTHETIC token/Core facts and in-memory storage.
 * No PostgreSQL, deployed Core endpoint, runtime mount, migration or notification-delivery evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {receiveUserPreferencesRequest as request,receiveUserPreferencesResponse as receive,UserPreferencesResponseError,USER_PREFERENCE_DEFAULTS,USER_PREFERENCE_THEMES,USER_PREFERENCE_DENSITIES,USER_PREFERENCE_NOTIFICATIONS,userPreferencesMetadata,userPreferencesPaths} from '../dist/user-preferences-application.mjs';
import {userPreferencesDocument,userPreferencesDocumentFailure,USER_PREFERENCES_DOCUMENT_SCHEMA} from '../user-preferences-application/document.mjs';
import {createMembershipGate} from '../../../apps/control/product-access/membership.mjs';
import {ProductError,productFailure} from '../../../apps/control/product-access/errors.mjs';
import {userPreferences,timezone,tenantSettings} from '../../../apps/control/settings/documents.mjs';
import {createUserPreferencesService} from '../../../apps/control/settings/user-service.mjs';
import {createUserPreferencesApplication} from '../../../apps/control/settings/user-application/index.mjs';
import {USER_PREFERENCES_LIMITS,userPreferencesUnavailable} from '../../../apps/control/settings/user-application/protocol.mjs';
import {createSettingsStoreDouble,PLATFORM} from '../../../apps/control/settings/test/fixtures.mjs';
const json=JSON.stringify,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,owner={tenantId:'tenant-one',actorId:'actor-1'},prefs=over=>({...structuredClone(USER_PREFERENCE_DEFAULTS),...over});
function setup(){
 const state={now:Date.parse('2026-10-17T12:00:00.000Z'),removed:false,revision:'m1',clientIds:[id(901)],reads:0,verifications:0};
 const store=createSettingsStoreDouble(),rawSave=store.save.bind(store);store.save=async value=>{const result=await rawSave(value);if(state.afterSave)await state.afterSave(value);return result;};
 const gate=createMembershipGate({now:()=>state.now,limits:{maxRequestMs:1000,maxFactBytes:65536},async verifyToken({credential}){state.verifications++;assert.equal(credential,'synthetic-native');return {...owner,checkedAtMs:state.now,expiresAtMs:state.now+10000};},async readMembership(){state.reads++;return {...owner,status:state.removed?'removed':'active',role:'member',permissions:[],clientIds:state.clientIds,membershipRevision:state.revision,checkedAtMs:state.now,expiresAtMs:state.now+10000};}});
 let next=100;const service=createUserPreferencesService({store,newId:()=>id(next++)}),app=createUserPreferencesApplication({gate,service,now:()=>state.now,limits:USER_PREFERENCES_LIMITS});
 const call=(route,body)=>app.handle(new Request('https://meri.invalid'+userPreferencesPaths[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-native'},body:json(body)}));
 const read=async()=>{const response=await call('read',{}),value=await receive('read',response.status,await response.text(),{owner});return value;};
 const save=async(expectedRevision,preferences)=>{const body=await request('save',json({expectedRevision,preferences})),response=await call('save',body),value=await receive('save',response.status,await response.text(),{owner,request:body});return {body,value,status:response.status};};
 return {state,store,call,read,save};
}
test('actual API defaults, complete save, readback, audit and stale revision are admitted',async()=>{
 const c=setup(),initial=await c.read();assert.deepEqual(initial,{owner,revision:0,preferences:USER_PREFERENCE_DEFAULTS});assert.equal(c.state.reads,2);
 const saved=await c.save(0,prefs({theme:'dark',density:'compact',timezone:'America/New_York',defaultClientId:id(901)}));assert.equal(saved.status,200);assert.equal(saved.value.revision,1);assert.deepEqual((await c.read()).preferences,saved.body.preferences);
 assert.equal(c.store.audit.length,1);assert.equal(c.store.audit[0].actorId,owner.actorId);assert.deepEqual(c.store.audit[0].changedFields,['defaultClientId','density','theme','timezone']);
 const conflict=await c.save(0,prefs({theme:'light'}));assert.equal(conflict.status,409);assert.deepEqual(conflict.value,{error:{code:'SETTINGS_REVISION_CONFLICT'}});assert.equal(c.store.audit.length,1);
 assert(Object.isFrozen(saved.value.preferences.notifications));assert.throws(()=>{saved.value.preferences.notifications.runCompleted=false;},TypeError);
});
test('removed client is withheld on later read while revision stays intact',async()=>{const c=setup();await c.save(0,prefs({defaultClientId:id(901)}));c.state.clientIds=[];const read=await c.read();assert.equal(read.revision,1);assert.equal(read.preferences.defaultClientId,null);});
test('unknown saved commit can only be reconciled by a separate read',async()=>{
 const c=setup();c.state.afterSave=()=>{throw new ProductError('SETTINGS_COMMIT_UNKNOWN','UNKNOWN');};const out=await c.save(0,prefs({theme:'dark'}));assert.equal(out.status,503);assert.deepEqual(out.value,{error:{code:'SETTINGS_COMMIT_UNKNOWN',outcome:'UNKNOWN'}});
 c.state.afterSave=null;const reconciled=await c.read();assert.equal(reconciled.revision,1);assert.equal(reconciled.preferences.theme,'dark');assert.equal(c.store.audit.length,1);
});
test('saved result withheld after current membership changes stays explicit',async()=>{
 const c=setup();c.state.afterSave=()=>{c.state.revision='m2';};const out=await c.save(0,prefs({theme:'light'}));assert.equal(out.status,409);assert.deepEqual(out.value,{error:{code:'MEMBERSHIP_CHANGED',outcome:'RESULT_NOT_RELEASED'}});assert.equal(c.store.audit.length,1);
});
test('actual field/refusal errors and unavailable handoff use exact public vocabulary',async()=>{
 const c=setup(),invalid={expectedRevision:0,preferences:prefs({theme:'neon'})},response=await c.call('save',invalid);
 const admitted=await receive('save',response.status,await response.text(),{owner,request:{...invalid,preferences:prefs()}});assert.deepEqual(admitted,{error:{code:'SETTINGS_FIELD_INVALID',field:'theme'}});
 const refused=await c.save(0,prefs({defaultClientId:id(902)}));assert.equal(refused.status,403);assert.deepEqual(refused.value,{error:{code:'SETTINGS_CLIENT_REFUSED'}});
 const unavailable=userPreferencesUnavailable();assert.deepEqual(await receive('read',unavailable.status,await unavailable.text(),{owner}),{error:{code:'USER_PREFERENCES_UNAVAILABLE'}});
});
test('schema, public defaults and vocabulary derive from the canonical document owner',async()=>{
 const schema=JSON.parse(await readFile(new URL('../dist/user-preferences-application.schema.json',import.meta.url),'utf8'));assert.deepEqual(schema.$defs.UserPreferences,USER_PREFERENCES_DOCUMENT_SCHEMA);
 assert.deepEqual(USER_PREFERENCE_THEMES,['system','light','dark']);assert.deepEqual(USER_PREFERENCE_DENSITIES,['comfortable','compact']);assert.deepEqual(USER_PREFERENCE_NOTIFICATIONS,['runCompleted','approvalRequested','memoryReviewed']);assert.deepEqual(userPreferencesDocument(USER_PREFERENCE_DEFAULTS),USER_PREFERENCE_DEFAULTS);
 assert(Object.isFrozen(USER_PREFERENCE_DEFAULTS.notifications));assert.equal(userPreferencesMetadata.limits.requestBytes,8192);assert.equal(userPreferencesMetadata.limits.responseBytes,16384);
});
test('server canonical document bridge preserves normalization, field codes and tenant timezone semantics',()=>{
 const client='abcdefab-0000-4000-8000-000000000901',principal={clientIds:[client]};assert.equal(userPreferences(prefs({defaultClientId:client.toUpperCase()}),principal).defaultClientId,client);
 const cases=[['theme','neon','theme'],['density','dense','density'],['timezone','US/Eastern','timezone'],['timezone',17,'timezone'],['notifications',{},'notifications'],['notifications',{runCompleted:true,approvalRequested:17,memoryReviewed:true},'notifications.approvalRequested'],['defaultClientId','not-uuid','defaultClientId']];
 for(const [key,value,field]of cases){assert.throws(()=>userPreferences(prefs({[key]:value}),principal),error=>productFailure(error)?.code==='SETTINGS_FIELD_INVALID'&&productFailure(error).field===field);assert.throws(()=>userPreferencesDocument(prefs({[key]:value})),error=>userPreferencesDocumentFailure(error)?.field===field);}
 assert.throws(()=>userPreferences({...prefs(),unknown:true},principal),error=>productFailure(error)?.code==='SETTINGS_DOCUMENT_INVALID');assert.throws(()=>timezone('US/Eastern','defaultTimezone'),error=>productFailure(error)?.field==='defaultTimezone');
 assert.throws(()=>timezone('US/Eastern'),error=>productFailure(error)?.field===null);
 assert.equal(tenantSettings({defaultTimezone:'UTC',capabilityPolicy:{}},PLATFORM).defaultTimezone,'UTC');
 let touched=0;assert.throws(()=>userPreferences({get theme(){touched++;return 'dark';}},principal));assert.equal(touched,0);
});
const badRequests=[{expectedRevision:-1,preferences:prefs()},{expectedRevision:Number.MAX_SAFE_INTEGER,preferences:prefs()},{expectedRevision:'0',preferences:prefs()},{expectedRevision:0,preferences:{theme:'dark'}},{expectedRevision:0,preferences:prefs({timezone:'US/Eastern'})},{expectedRevision:0,preferences:prefs({timezone:'UTC+1'})},{expectedRevision:0,preferences:prefs({defaultClientId:'ABCDEFAB-0000-4000-8000-000000000901'})},{expectedRevision:0,preferences:prefs(),owner}];
for(const [i,value]of badRequests.entries())test('request rejects noncanonical save '+i,async()=>{await assert.rejects(request('save',json(value)),UserPreferencesResponseError);});
test('read request is exactly empty and route/text primitives never coerce',async()=>{
 for(const value of [{tenantId:owner.tenantId},[],null,1])await assert.rejects(request('read',json(value)),UserPreferencesResponseError);
 let touched=0;const hostile=new Proxy({},{get(){touched++;throw Error('trap');}});await assert.rejects(request('read',hostile),UserPreferencesResponseError);await assert.rejects(request({[Symbol.toPrimitive](){touched++;return 'read';}},'{}'),UserPreferencesResponseError);assert.equal(touched,0);
});
test('text ingress enforces UTF8 byte caps, inert keys, finite numbers, Unicode and depth',async()=>{
 for(const value of ['{','null','1e999','{"__proto__":{}}','{"constructor":0}','"\\ud800"','"\ud800"','['.repeat(66)+'0'+']'.repeat(66),' '.repeat(8193),'"'+'é'.repeat(4096)+'"'])await assert.rejects(request('read',value),UserPreferencesResponseError);
 await assert.rejects(receive('read',200,' '.repeat(16385),{owner}),UserPreferencesResponseError);
});
const responseMutations={foreignTenant:v=>{v.owner.tenantId='foreign';},foreignActor:v=>{v.owner.actorId='other';},negativeRevision:v=>{v.revision=-1;},unsafeRevision:v=>{v.revision=Number.MAX_SAFE_INTEGER+1;},unknownPreference:v=>{v.preferences.extra=true;},noncanonicalZone:v=>{v.preferences.timezone='US/Eastern';},unknownEnvelope:v=>{v.approved=true;},incompleteDocument:v=>{delete v.preferences.density;}};
for(const [name,mutate]of Object.entries(responseMutations))test('response rejects '+name,async()=>{const value={owner:structuredClone(owner),revision:1,preferences:prefs()};mutate(value);await assert.rejects(receive('read',200,json(value),{owner}),UserPreferencesResponseError);});
test('save response must match next captured revision and exact complete document',async()=>{
 const captured=await request('save',json({expectedRevision:7,preferences:prefs({theme:'dark'})}));
 for(const value of [{owner,revision:7,preferences:captured.preferences},{owner,revision:9,preferences:captured.preferences},{owner,revision:8,preferences:prefs({theme:'light'})}])await assert.rejects(receive('save',200,json(value),{owner,request:captured}),UserPreferencesResponseError);
 const admitted=await receive('save',200,json({owner,revision:8,preferences:captured.preferences}),{owner,request:captured});assert.equal(admitted.revision,8);
});
test('independent expectation is mandatory, closed and accessor-free',async()=>{
 const text=json({owner,revision:0,preferences:prefs()});for(const expectation of [undefined,{owner,request:{}},{owner:{...owner,role:'admin'}},{owner:{...owner,tenantId:'other'}}])await assert.rejects(receive('read',200,text,expectation),UserPreferencesResponseError);
 await assert.rejects(receive('save',200,text,{owner}),UserPreferencesResponseError);let touched=0;await assert.rejects(receive('read',200,text,{get owner(){touched++;return owner;}}),UserPreferencesResponseError);assert.equal(touched,0);
});
test('error statuses/vocabulary/optional field and uncertainty stay closed',async()=>{
 for(const [code,status]of Object.entries(userPreferencesMetadata.errorStatuses))assert.equal((await receive('read',status,json({error:{code}}),{owner})).error.code,code);
 for(const outcome of ['UNKNOWN','RESULT_NOT_RELEASED'])assert.equal((await receive('read',503,json({error:{code:'SETTINGS_COMMIT_UNKNOWN',outcome}}),{owner})).error.outcome,outcome);
 for(const [status,value]of [[200,{error:{code:'SETTINGS_UNAVAILABLE'}}],[502,{error:{code:'SETTINGS_UNAVAILABLE'}}],[503,{error:{code:'NOT_REAL'}}],[503,{error:{code:'SETTINGS_COMMIT_UNKNOWN',outcome:'STORED_NOT_RELEASED'}}],[400,{error:{code:'INVALID_REQUEST',field:'secret value'}}],[502,{error:{code:'PRODUCT_UNAVAILABLE',field:'theme'}}],[503,{error:{code:'SETTINGS_UNAVAILABLE',message:'private'}}]])await assert.rejects(receive('read',status,json(value),{owner}),UserPreferencesResponseError);
});
test('distribution is self-contained and sources bind canonical document/status owners',async()=>{
 const source=await readFile(new URL('../dist/user-preferences-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/user-preferences-application.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.browserImports,[]);assert(!/from ['"](?:node:|ajv|canonicalize)/u.test(source));for(const path of ['user-preferences-application/document.mjs','../../apps/control/settings/user-application/protocol.mjs','../../apps/control/product-access/errors.mjs'])assert(metadata.sources.some(source=>source.path===path));
});
