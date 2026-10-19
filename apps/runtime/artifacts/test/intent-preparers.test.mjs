/** SOURCE-ONLY: real runtime/document/intent/session/budget/artifact owners with scripted identity, ledger and local bytes.
 * TXT generation uses the real bounded executor. This is not Core, PostgreSQL, object-store or exact-image qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createLocalDocumentFixture} from '../../../control/document-application/local/fixture.mjs';
import {mount,delivery} from '../../../control/intents/test/fixture.mjs';
import {createRuntimeDocumentIntentPreparers} from '../intent-preparers.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs';
const spec={operation:'create_word',format:'txt',title:'Conversation draft',content:{text:'A durable conversation draft.\n'}};
const code=(wanted,effect)=>error=>error?.code===wanted&&(effect===undefined||error.effect===effect);
async function fixture(t,operation='create_word'){
 process.env.MERI_REVIEW_SOURCE_ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation,...(operation==='create_powerpoint'?{pptxModulePath}:{})});t.after(()=>f.close());
 const original=await f.sessions.issue({identityCredential:f.nativeCredential});
 const state={resolved:[],issued:[],revoked:[],reads:0,resolve:null,onCurrent:null,native:null};
 const sessions={
  async issueDerived(call){state.issued.push(call);return f.sessions.issueDerived(call);},
  authenticateSession:call=>f.sessions.authenticateSession(call),
  async readCurrentState(call){state.reads++;const value=await f.sessions.readCurrentState(call);return state.onCurrent?state.onCurrent(value):value;},
  revoke(credential){state.revoked.push(credential);return f.sessions.revoke(credential);},
 };
 const nativeCredentials={nativeCredentialFor(call){return state.native?state.native(call):f.sessions.nativeCredentialFor(call);}};
 const current=async(credential,signal)=>{const authentication=await sessions.authenticateSession({credential,signal}),value=await sessions.readCurrentState({authentication,signal});if(hash(value.binding)!==hash(f.artifactOptions.context.binding)||hash(value.scopes)!==hash(f.artifactOptions.context.scopes))throw Error('ACCESS_DENIED');};
 const optionsOwner={async resolve(call){state.resolved.push(call);if(state.resolve)return state.resolve(call);
  await current(call.credential,call.signal);
  return {documentOptions:{sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true},async recheck(check){await current(call.credential,check.signal);}};
 }};
 const config={binding:f.artifactOptions.context.binding,selectedClientId:f.selectedClientId,sessions,optionsOwner,nativeCredentials,now:f.now,limits:f.limits};
 const preparers=createRuntimeDocumentIntentPreparers(config),word=preparers.find(p=>p.operation.id==='create_word');
 const prepare=(arguments_=spec,extra={})=>word.prepare({arguments:arguments_,deliveryId:delivery(1),...extra});
 return {f,state,sessions,nativeCredentials,optionsOwner,config,preparers,word,prepare,original};
}

test('missing production owners and an owner without derived-session support omit the route without work',async t=>{
 const h=await fixture(t);
 for(const key of ['sessions','optionsOwner','nativeCredentials']){const c={...h.config};delete c[key];assert.deepEqual(createRuntimeDocumentIntentPreparers(c),[]);}
 assert.deepEqual(createRuntimeDocumentIntentPreparers({...h.config,sessions:{issue(){assert.fail('no fallback');}}}),[]);
 assert.equal(h.state.issued.length,0);assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);
 assert.throws(()=>createRuntimeDocumentIntentPreparers({...h.config,selectedClientId:'model-client'}),code('INTENT_CONFIGURATION'));
});

test('borrowed port accessors and proxies cannot execute during trusted bridge capture',async t=>{
 const h=await fixture(t);let touched=0;
 const accessor={};Object.defineProperty(accessor,'issueDerived',{enumerable:true,get(){touched++;return ()=>{};}});
 assert.throws(()=>createRuntimeDocumentIntentPreparers({...h.config,sessions:accessor}),code('INTENT_CONFIGURATION'));
 assert.throws(()=>createRuntimeDocumentIntentPreparers({...h.config,sessions:new Proxy(h.sessions,{getOwnPropertyDescriptor(){touched++;return undefined;}})}),code('INTENT_CONFIGURATION'));
 assert.equal(touched,0);assert.equal(h.state.issued.length,0);assert.equal(h.state.resolved.length,0);
});

test('Word intent traverses the real runtime application and durable owner; replay generates once and cleans only its own sessions',async t=>{
 const h=await fixture(t),first=await h.prepare();
 assert.equal(first.status,'draft');assert.equal(first.version.generationStatus,'draft');assert.equal(first.version.parentVersionId,null);
 assert.deepEqual(first.version.binding,h.config.binding);assert.deepEqual(first.version.scopes,h.f.artifactOptions.context.scopes);
 const replay=await h.prepare();assert.deepEqual(replay,first);assert.equal(h.f.stats().generations,1);assert.equal(h.f.stats().versionCharges,1);
 assert.equal(h.state.issued.length,2);assert.equal(h.state.revoked.length,2);assert.equal(h.f.sessions.status().sessions,1);
 assert.ok(h.state.resolved.every(call=>call.intent==='create'&&call.body.deliveryId===delivery(1)&&call.body.baseVersionId===undefined));
 assert.ok(h.state.revoked.every(credential=>credential!==h.original.credential));
 await h.f.sessions.authenticateSession({credential:h.original.credential});
});

test('Excel intent uses its own admitted descriptor and durable generation through the same runtime application',async t=>{
 const h=await fixture(t,'create_excel'),excel=h.preparers.find(p=>p.operation.id==='create_excel');
 const request={operation:'create_excel',format:'xlsx',title:'Conversation workbook',content:{sheets:[{name:'Data',rows:[[{value:'A'}],[{value:3}]]}]}};
 const result=await excel.prepare({arguments:request,deliveryId:delivery(2)});
 assert.equal(result.status,'draft');assert.equal(result.version.mimeType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 assert.deepEqual(result.version.binding,h.config.binding);assert.equal(h.f.stats().generations,1);assert.equal(h.f.stats().versionCharges,1);assert.equal(h.f.sessions.status().sessions,1);
});

test('PowerPoint intent uses the fixed generator through canonical document admission',async t=>{
 const h=await fixture(t,'create_powerpoint'),preparer=h.preparers.find(p=>p.operation.id==='create_powerpoint');
 const request={operation:'create_powerpoint',format:'pptx',title:'Conversation slides',content:{slides:[{title:'Review',bullets:['Confirm current evidence']}]}};
 const result=await preparer.prepare({arguments:request,deliveryId:delivery(3)});
 assert.equal(preparer.owner,'document');assert.equal(result.status,'draft');assert.equal(result.version.filename,'Conversation slides.pptx');
 const bytes=await h.f.artifactOptions.objects.get(result.version.object),zip=await JSZip.loadAsync(bytes);
 assert.ok(zip.file('ppt/presentation.xml'));assert.equal(h.f.stats().generations,1);assert.equal(h.f.stats().versionCharges,1);assert.equal(h.f.sessions.status().sessions,1);
});

test('typed analysis enters the same canonical runtime application and exposes ZIP only',async t=>{
 const h=await fixture(t,'run_analysis'),analysis=h.preparers.find(p=>p.operation.id==='run_analysis');
 const request={operation:'run_analysis',format:'zip',title:'Conversation analysis',content:{tables:[{name:'data',columns:['amount'],rows:[[2],[5]]}],source:'data',steps:[{kind:'derive',name:'projected',left:'amount',operator:'multiply',right:3}]}};
 const call={arguments:request,deliveryId:delivery(4)},result=await analysis.prepare(call);
 assert.equal(analysis.owner,'artifact');assert.deepEqual(analysis.formats,['zip']);assert.equal(result.status,'draft');assert.equal(result.version.mimeType,'application/zip');
 assert.deepEqual(await analysis.prepare(call),result);assert.equal(h.f.stats().generations,1);assert.equal(h.f.stats().versionCharges,1);
 const bytes=await h.f.artifactOptions.objects.get(result.version.object),zip=await JSZip.loadAsync(bytes),material=JSON.parse(await zip.file('result.json').async('string'));
 assert.deepEqual(material.data,[[2,6],[5,15]]);assert.equal(material.semantics.codeExecution,false);
 const object=result.version.object,dispatched=h.state.resolved.length;
 await assert.rejects(analysis.prepare({arguments:{operation:'run_analysis',format:'sandbox',title:'Unavailable sandbox',content:{program:object,inputs:[],outputs:['facts.json']}},deliveryId:delivery(5)}),code('UNAVAILABLE','none'));
 assert.equal(h.state.resolved.length,dispatched);assert.equal(h.f.sessions.status().sessions,1);
});

test('canonical request validation rejects authority arguments, other operations and unadmitted formats without dispatch',async t=>{
 const h=await fixture(t);
 for(const raw of [{...spec,context:{binding:h.config.binding}},{...spec,operation:'create_excel'},{...spec,format:'pdf'}])await assert.rejects(h.prepare(raw),code('INVALID_ARGUMENTS','none'));
 assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,1);
});

test('unavailable and expired native credentials stop before any derived session or runtime resolution',async t=>{
 const h=await fixture(t);
 h.state.native=()=>{throw Error('no current session');};await assert.rejects(h.prepare(),code('UNAVAILABLE','none'));
 h.state.native=()=>({credential:h.f.nativeCredential,expiresAtMs:h.f.now()});await assert.rejects(h.prepare(),code('UNAVAILABLE','none'));
 assert.equal(h.state.issued.length,0);assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);
});

test('the complete run binding and selected-client receipt are checked before runtime dispatch',async t=>{
 const h=await fixture(t);
 for(const change of [value=>({...value,binding:{...value.binding,attemptId:'00000000-0000-4000-8000-000000000099'}}),value=>({...value,selectedClientId:'00000000-0000-4000-8000-000000000099'}),value=>({...value,scopes:[]})]){
  h.state.onCurrent=change;await assert.rejects(h.prepare(),code('ACCESS_DENIED','none'));
 }
 assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,1);
});

test('current identity revocation before preparation performs no runtime work',async t=>{
 const h=await fixture(t);h.f.revoke();await assert.rejects(h.prepare(),code('ACCESS_DENIED','none'));
 assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,1);
});

test('native credential replacement during current checks refuses before runtime work and revokes its derived session',async t=>{
 const h=await fixture(t);let lookups=0;
 h.state.native=()=>({credential:++lookups===1?h.f.nativeCredential:'different-current-credential',expiresAtMs:h.f.now()+10000});
 await assert.rejects(h.prepare(),code('ACCESS_DENIED','none'));
 assert.equal(h.state.resolved.length,0);assert.equal(h.state.revoked.length,1);assert.equal(h.f.sessions.status().sessions,1);
});

test('revoking the original session cannot be masked by the derived session',async t=>{
 const h=await fixture(t);let checked=false;
 h.state.onCurrent=value=>{if(!checked){checked=true;h.f.sessions.revoke(h.original.credential);}return value;};
 await assert.rejects(h.prepare(),code('UNAVAILABLE','none'));
 assert.equal(h.state.resolved.length,0);assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,0);
});

test('runtime refusal after dispatch is UNKNOWN, while a cancelled pre-dispatch request has no effect',async t=>{
 const h=await fixture(t);h.state.resolve=async()=>null;
 await assert.rejects(h.prepare(),code('UNKNOWN','unknown'));
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(h.prepare(spec,{signal:cancelled.signal}),error=>['DEADLINE','CANCELLED'].includes(error?.code)&&error.effect==='none');
 assert.equal(h.state.resolved.length,1);assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,1);
});

test('a post-generation identity denial withholds the result and durable intent replay never generates again',async t=>{
 const h=await fixture(t),execute=h.f.artifactOptions.executor.execute;
 h.f.artifactOptions.executor.execute=async call=>{const value=await execute(call);h.f.revoke();return value;};
 const m=mount({binding:h.config.binding,preparers:[h.word],now:h.f.now,scopes:h.f.artifactOptions.context.scopes}).mount;
 const call={operation:h.word.operation,arguments:spec,deliveryId:delivery(9)};
 await assert.rejects(m.prepare(call),code('UNKNOWN'));await assert.rejects(m.prepare(call),code('UNKNOWN'));
 assert.equal(h.f.stats().generations,1);assert.equal(h.state.issued.length,1);assert.equal(h.state.revoked.length,1);
});

test('original-session revocation after generation withholds the draft even while its derived session remains valid',async t=>{
 const h=await fixture(t),execute=h.f.artifactOptions.executor.execute;
 h.f.artifactOptions.executor.execute=async call=>{const result=await execute(call);h.f.sessions.revoke(h.original.credential);return result;};
 await assert.rejects(h.prepare(),code('UNKNOWN','unknown'));
 assert.equal(h.f.stats().generations,1);assert.equal(h.f.sessions.status().sessions,0);assert.equal(h.state.revoked.length,1);
});

test('the trusted runtime retention gate stops suppressed conversation generation',async t=>{
 const h=await fixture(t),subjects=[];
 const preparer=createRuntimeDocumentIntentPreparers({...h.config,retention:{async assertServable(subject){subjects.push(subject);throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}}}).find(p=>p.operation.id==='create_word');
 await assert.rejects(preparer.prepare({arguments:spec,deliveryId:delivery(6)}),code('UNKNOWN','unknown'));
 assert.ok(subjects.length>0);assert.ok(subjects.every(subject=>subject.tenantId===h.config.binding.tenantId));
 assert.equal(h.f.stats().generations,0);assert.equal(h.f.sessions.status().sessions,1);
});

test('all derived-session operations are bounded by the originating native relay expiry',async t=>{
 const h=await fixture(t),expiry=h.f.now()+10000;h.state.native=()=>({credential:h.f.nativeCredential,expiresAtMs:expiry});
 h.state.resolve=async()=>null;await assert.rejects(h.prepare(),code('UNKNOWN','unknown'));
 assert.equal(h.state.issued.length,1);assert.ok(h.state.issued[0].deadlineMs<=expiry);assert.equal(h.state.revoked.length,1);
});
