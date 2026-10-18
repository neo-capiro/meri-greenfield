/** Focused synthetic public controls for the original-input allocation boundary. One process; no services, provider, compiler or child process. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,cp,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {receiveConversationInitialInputRequest as request,receiveConversationInitialInputResponse as receive,receiveAllocatedConversationInputResponse as receiveAllocated,conversationInitialInputMetadata as metadata,conversationInitialInputPath,ConversationInitialInputResponseError} from '@capiro/meri-contracts/conversation-initial-input';
import {conversationInputMetadata} from '@capiro/meri-contracts/conversation-input';
import {assertConversationInitialInputReceipt,assertInitialInputShape} from '../conversation-initial-input/validate.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha=value=>createHash('sha256').update(value).digest('hex');
const binding={tenantId:'synthetic-initial-input',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'p1'}];
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const input={requestId:id(6),prompt:'Hello'},context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const NOW=Date.now(),now=()=>NOW;
const allocated=(admitted,overrides={})=>({allocation:{binding:structuredClone(binding),scopes:structuredClone(scopes),versions:structuredClone(versions),selectedClientId:id(5),requestId:admitted.requestId,inputSha256:sha(canonicalize(admitted)),requestSha256:'c'.repeat(64),allocatedAtMs:NOW-1000,expiresAtMs:NOW+60000,...overrides},state:'RESERVED',created:true});

test('initial-input metadata preserves the allocate route, bounded limits and closed error outcomes',()=>{
 assert.equal(metadata.packageVersion,'0.1.10');assert.equal(metadata.initialInputVersion,'1.0.0');assert.equal(metadata.schemaId,'urn:meri:conversation-initial-input:1.0.0');
 assert.equal(metadata.routes.allocate.path,'/api/conversations/input/allocate');assert.equal(metadata.routes.allocate.method,'POST');assert.equal(conversationInitialInputPath,metadata.routes.allocate.path);
 assert.deepEqual(metadata.limits,{requestBytes:131072,responseBytes:131072,maxRequestMs:25000});assert.equal(metadata.bridge.responseBytes,conversationInputMetadata.limits.responseBytes);
 assert.deepEqual(metadata.authentication,conversationInputMetadata.authentication);assert.equal(metadata.authentication.validationGrantsAuthority,false);
 assert.deepEqual(metadata.errorOutcomes,['NOT_DISPATCHED','UNKNOWN']);assert.equal(metadata.errorOutcomeByCode.SESSION_REFUSED,'NOT_DISPATCHED');assert.equal(metadata.errorOutcomeByCode.DEADLINE,'UNKNOWN');
 for(const [code,outcome] of Object.entries(metadata.errorOutcomeByCode))assert.ok(Object.hasOwn(metadata.errorStatuses,code),code),assert.ok(metadata.errorOutcomes.includes(outcome),code);
 assert.ok(Object.isFrozen(metadata));assert.ok(Object.isFrozen(metadata.limits));assert.ok(Object.isFrozen(metadata.errorStatuses));
});
test('allocation receipt agrees across internal server assertion and public receiver',async()=>{
 const admitted=request(bytes(input)),body=allocated(admitted),received=await receive(200,bytes(body),admitted,context);
 assert.deepEqual(received,body);assert.deepEqual(Object.keys(received).sort(),['allocation','created','state']);
 assert.deepEqual(await assertConversationInitialInputReceipt(body,input,{now}),body);assert.deepEqual(assertInitialInputShape('ConversationInitialInputAllocatedResponse',body),body);
 for(const change of [v=>v.allocation.binding.writerFence=2,v=>v.allocation.requestId=id(7),v=>v.allocation.inputSha256='d'.repeat(64),v=>v.allocation.selectedClientId=id(8),v=>v.state='ACCEPTED',v=>delete v.allocation.expiresAtMs,v=>v.allocation.scopes=[]]){
  const invalid=allocated(request(bytes(input)));change(invalid);const fresh=request(bytes(input));await assert.rejects(receive(200,bytes(invalid),fresh,context),ConversationInitialInputResponseError);
 }
 await assert.rejects(receive(200,bytes(allocated(admitted,{expiresAtMs:NOW-1})),request(bytes(input)),context),/INITIAL_INPUT_EXPIRED|INITIAL_INPUT_FACTS_MISMATCH/u);
 await assert.rejects(receive(200,bytes(body),request(bytes(input)),{...context,clientId:id(9)}),/INITIAL_INPUT_CONTEXT_MISMATCH/u);
});
test('allocation errors are admitted only with their canonical status and outcome',async()=>{
 const admitted=request(bytes(input));
 assert.deepEqual(await receive(401,bytes({error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED'}}),admitted,context),{error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED'}});
 assert.deepEqual(await receive(408,bytes({error:{code:'DEADLINE',outcome:'UNKNOWN'}}),admitted,context),{error:{code:'DEADLINE',outcome:'UNKNOWN'}});
 await assert.rejects(receive(500,bytes({error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED'}}),admitted,context),/INVALID_INITIAL_INPUT_ERROR/u);
 await assert.rejects(receive(401,bytes({error:{code:'SESSION_REFUSED',outcome:'UNKNOWN'}}),admitted,context),/INVALID_INITIAL_INPUT_ERROR/u);
 await assert.rejects(receive(403,bytes({error:{code:'NOT_A_CODE',outcome:'NOT_DISPATCHED'}}),admitted,context),/INVALID_INITIAL_INPUT_RESPONSE/u);
 await assert.rejects(receive(200,bytes(allocated(admitted)),{requestId:id(6),prompt:'Hello'},context),/UNADMITTED_INITIAL_INPUT_REQUEST/u);
});
test('admitted input after allocation must carry the allocation proof and the same binding',async()=>{
 const admitted=request(bytes(input)),body=allocated(admitted),proof=await receive(200,bytes(body),admitted,context);
 const unproven=await receive(200,bytes(body),request(bytes(input)),context);
 await assert.rejects(receiveAllocated(200,bytes({}),admitted,context,unproven),/UNADMITTED_INITIAL_INPUT_PROOF/u);
 const error=await receiveAllocated(401,bytes({error:{code:'SESSION_REFUSED'}}),admitted,context,proof);assert.deepEqual(error,{error:{code:'SESSION_REFUSED'}});
});
test('initial-input generation records exact canonical provenance and one shared browser import',async()=>{
 const source=await readFile(new URL('../dist/conversation-initial-input.mjs',import.meta.url),'utf8');assert.match(source,/from ["']\.\/conversation-input\.mjs["']/u);assert.doesNotMatch(source,/from ["']node:|require\(["']node:/u);
 const evidence=JSON.parse(await readFile(new URL('../dist/conversation-initial-input.metadata.json',import.meta.url),'utf8'));assert.equal(evidence.packageVersion,'0.1.10');assert.equal(evidence.browserImports.length,1);assert.equal(evidence.browserImports[0].path,'./conversation-input.mjs');
 for(const row of evidence.sources){const raw=await readFile(new URL('../'+row.path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256,row.path);}
 assert.equal(evidence.browserImports[0].sha256,evidence.sources.find(row=>row.path==='dist/conversation-input.mjs').sha256);
});
test('offline public package resolves the allocation entrypoint and its schema only through declared exports',async()=>{
 const root=await mkdtemp(join(tmpdir(),'meri-initial-input-consumer-'));try{
  const pkg=join(root,'node_modules/@capiro/meri-contracts');await mkdir(pkg,{recursive:true});for(const path of ['package.json','dist'])await cp(new URL('../'+path,import.meta.url),join(pkg,path),{recursive:true});
  const resolver=createRequire(pathToFileURL(join(root,'consumer.cjs'))),installed=await import(pathToFileURL(resolver.resolve('@capiro/meri-contracts/conversation-initial-input')));
  const admitted=installed.receiveConversationInitialInputRequest(bytes(input)),body=allocated(admitted);assert.deepEqual(await installed.receiveConversationInitialInputResponse(200,bytes(body),admitted,context),body);
  assert.equal(installed.conversationInitialInputMetadata.packageVersion,'0.1.10');assert.equal(resolver.resolve('@capiro/meri-contracts/conversation-initial-input/schema'),join(pkg,'dist','conversation-initial-input.schema.json'));
  assert.throws(()=>resolver.resolve('@capiro/meri-contracts/conversation-initial-input/semantics.mjs'));assert.throws(()=>resolver.resolve('@capiro/meri-contracts/dist/conversation-initial-input.mjs'));
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected cleanup target');await rm(root,{recursive:true,force:true});}
});
