/** Browser enablement through the existing material path: the committed `features.browserPlatform` destination list,
 * `features.browserActivation` (held or evidence-bearing open), and the control-to-host router rendered from the native
 * host material. The rendered browser blocks then boot the REAL control assembly (synthetic pool/Temporal/candidate/
 * listeners, as in browser-host-control-startup.test.mjs) and the browser-host family is composed. The runner side of the
 * same path is proven next to its owners: agentcore-candidate.test.mjs (admission settings carry `browser.enabled`) and
 * agentcore-query.test.mjs (that setting alone mounts the native browser port). Needs MERI_REVIEW_SOURCE_ROOT and Python
 * `cryptography`; no live readback, host or network is involved. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRenderFixture} from './render-material.fixture.mjs';
import {nativeProcessingInputs} from './native-processing-material.fixture.mjs';
import {renderMaterial,readBrowserActivationEvidence} from './render-material.mjs';
import {NATIVE_PATHS} from './native-processing-material.mjs';
import {configurationMaxBytes,validateConfiguration} from '../../../apps/runtime/config.mjs';
import {compileBrowserPlatform} from '../../../apps/runtime/product-ports/browser-policy.mjs';
import {isPublicOrigin} from '../../../apps/worker/conversation/browser/public-web.mjs';
import {EGRESS_REQUIREMENTS_SHA256,BROWSER_ACTIVATION_RENDER_VERIFICATION} from '../../../apps/worker/conversation/browser/activation.mjs';
import {startControl,assembleControl} from '../../../apps/runtime/control.mjs';
import {agentcoreControlFixture} from '../../../apps/runtime/test/agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../../../apps/runtime/product-ports/capability-policy.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const fixture=createRenderFixture();after(()=>fixture.cleanup());
const committed=JSON.parse(await readFile(join(here,'deployment-inputs.json'),'utf8')).features.browserPlatform;
const EVIDENCE=Buffer.from('# Synthetic browser egress evidence record (test bytes only)\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
const OPEN=Object.freeze({state:'open',evidence:'docs/qualification/browser-egress/BROWSER-EGRESS-EVIDENCE-20261101.md',evidenceSha256:sha(EVIDENCE),requirementsSha256:EGRESS_REQUIREMENTS_SHA256});
const receiptFor=i=>({schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:i.deployment.images.nodeRuntimeSourceCommit,renderedAtMs:i.nowMs,evidenceSha256:OPEN.evidenceSha256,requirementsSha256:OPEN.requirementsSha256});
// Render inputs plus the evidence bytes the CLI reads from the source root; renderMaterial itself never touches the filesystem.
// nowMs is taken after the fixture issued its short-lived native client leaf, which is valid only from that moment on.
const withNative=async change=>{const i=await nativeProcessingInputs(fixture);change?.(i);return {...i,browserEvidence:EVIDENCE,nowMs:Date.now()};};

test('the committed browserPlatform renders into control as the runtime compiles it, with only canonical https origins, beside the native router',async()=>{
 const i=await withNative(v=>{v.deployment.features.browserPlatform=structuredClone(committed);v.deployment.features.browserActivation=structuredClone(OPEN);});
 const r=renderMaterial(i),c=r.roles.control.config,spec=i.deployment.features.nativeProcessing.deployment.bootstrapSpec.control;
 assert.deepEqual(c.browserPlatform,structuredClone(compileBrowserPlatform({browserPlatform:committed})));
 assert.ok(committed.maximum.allowedOrigins.length>0);
 for(const policy of [committed.maximum,committed.defaults,...Object.values(committed.roleCeilings)])for(const origin of policy.allowedOrigins)assert.ok(isPublicOrigin(origin)&&origin.startsWith('https://'),origin);
 assert.deepEqual(Object.keys(committed.roleCeilings).sort(),['capiro_admin','standard_user','user_admin']);
 assert.deepEqual(c.browserActivation,{...OPEN,renderVerification:receiptFor(i)},'the control record carries the renderer\'s verification receipt');
 assert.deepEqual(r.summary.features.browserActivation,{state:'open',evidence:OPEN.evidence,evidenceSha256:OPEN.evidenceSha256,evidenceVerified:true});
 // The router pins the SAME control-to-host identity the native inspection host already uses: same client leaf and key,
 // same issuer root for the host certificates, same client name.
 const t=c.uploads.native.host.tls;
 assert.deepEqual(c.browserHosts,{enabled:true,tls:{privateClient:{clientName:spec.clientName,certFile:NATIVE_PATHS.controlClientCertificate,keyFile:NATIVE_PATHS.controlClientKey,caFile:NATIVE_PATHS.issuerCaCertificate}}});
 assert.deepEqual(c.browserHosts.tls.privateClient,{clientName:t.clientName,certFile:t.certPath,keyFile:t.keyPath,caFile:t.caPath});
 assert.equal(c.browserHosts.bind,undefined,'the host-currentness listener is not rendered: its material and network path are deployment decisions (runbook)');
 for(const key of ['browserPlatform','browserActivation','browserHosts'])assert.ok(r.summary.features.controlKeys.includes(key),key);
 assert.ok(Buffer.byteLength(r.roles.control.configBytes)<=configurationMaxBytes('control'));
 assert.equal(r.roles['temporal-worker'].config.browserActivation,undefined);assert.equal(r.roles['temporal-worker'].config.browserPlatform,undefined);
 // Held renders as exactly {state:'held'}; absent renders nothing; the router follows the native family, not the record.
 const {browserEvidence:_h,...heldInputs}=await withNative(v=>{v.deployment.features.browserActivation={state:'held'};});const held=renderMaterial(heldInputs).roles.control.config;
 assert.deepEqual(held.browserActivation,{state:'held'});assert.ok(held.browserHosts);
 const {browserEvidence:_a,...absentInputs}=await withNative();const absent=renderMaterial(absentInputs).roles.control.config;
 assert.equal(absent.browserActivation,undefined);assert.ok(absent.browserHosts);
 assert.doesNotThrow(()=>validateConfiguration(c,'control'));
});

test('an open record refuses without the evidence bytes, with a wrong hash, with a missing file, without the native family, with another requirement digest or malformed; a widening or malformed platform refuses',async()=>{
 // Evidence verification: bytes are mandatory for an open record, must hash to evidenceSha256, and are a mistake without one.
 for(const [label,change] of [['no bytes',i=>{delete i.browserEvidence;}],['wrong hash',i=>{i.browserEvidence=Buffer.from('a different file');}],['bytes with a held record',i=>{i.deployment.features.browserActivation={state:'held'};}]]){
  const i=await withNative(v=>{v.deployment.features.browserActivation=structuredClone(OPEN);});change(i);
  assert.throws(()=>renderMaterial(i),{code:'RENDER_INPUT_REFUSED'},label);
 }
 // A pre-verified control record (with the receipt) is not a deployment input.
 const preVerified=await withNative(v=>{v.deployment.features.browserActivation={...OPEN,renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:v.deployment.images.nodeRuntimeSourceCommit,renderedAtMs:1,evidenceSha256:OPEN.evidenceSha256,requirementsSha256:OPEN.requirementsSha256}};});
 assert.throws(()=>renderMaterial(preVerified),{code:'RENDER_INPUT_REFUSED'});
 // The CLI reader: the exact repository path under the source root, refusing a missing file, an escape and a non-file.
 const root=await mkdtemp(join(tmpdir(),'meri-browser-evidence-'));
 try{
  await assert.rejects(readBrowserActivationEvidence(root,OPEN.evidence),{code:'RENDER_INPUT_REFUSED'},'missing evidence file refuses');
  await writeFile(join(root,'record.md'),EVIDENCE);
  assert.deepEqual(await readBrowserActivationEvidence(root,'record.md'),EVIDENCE);
  await assert.rejects(readBrowserActivationEvidence(root,'../record.md'),{code:'RENDER_INPUT_REFUSED'});
  await assert.rejects(readBrowserActivationEvidence(root,'.'),{code:'RENDER_INPUT_REFUSED'});
  await writeFile(join(root,'empty.md'),'');await assert.rejects(readBrowserActivationEvidence(root,'empty.md'),{code:'RENDER_INPUT_REFUSED'});
 }finally{await rm(root,{recursive:true,force:true});}
 const plain=await fixture.render(i=>{i.deployment.features={browserPlatform:structuredClone(committed)};});
 assert.equal(plain.roles.control.config.browserHosts,undefined,'no native family, no router');
 assert.deepEqual(plain.roles.control.config.browserPlatform,structuredClone(compileBrowserPlatform({browserPlatform:committed})));
 await assert.rejects(fixture.render(i=>{i.deployment.features={browserActivation:structuredClone(OPEN)};},{browserEvidence:EVIDENCE}),{code:'RENDER_INPUT_REFUSED'},'open without the native family');
 assert.deepEqual((await fixture.render(i=>{i.deployment.features={browserActivation:{state:'held'}};})).roles.control.config.browserActivation,{state:'held'});
 for(const bad of [{...OPEN,requirementsSha256:'b'.repeat(64)},{state:'open'},{state:'held',evidence:'x'},{...OPEN,evidence:'../x'}]){
  const i=await withNative(v=>{v.deployment.features.browserActivation=bad;});
  assert.throws(()=>renderMaterial(i),{code:'RENDER_INPUT_REFUSED'},JSON.stringify(bad));
 }
 const widening=structuredClone(committed);widening.defaults.allowedOrigins=[...widening.defaults.allowedOrigins,'https://unlisted.example'];
 await assert.rejects(fixture.render(i=>{i.deployment.features={browserPlatform:widening};}),{code:'RENDER_INPUT_REFUSED'});
 const malformed=structuredClone(committed);malformed.maximum.allowedOrigins=['https://records.example/path'];
 await assert.rejects(fixture.render(i=>{i.deployment.features={browserPlatform:malformed};}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(fixture.render(i=>{i.deployment.features={browserPlatform:{maximum:{enabled:true}}};}),{code:'RENDER_INPUT_REFUSED'});
});

/** The startup harness of browser-host-control-startup.test.mjs: every side-effecting default replaced, nothing else. */
function harness(blocks,material){
 const configuration=structuredClone(agentcoreControlFixture().configuration);delete configuration.taskRouter;
 configuration.capabilityPlatform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 Object.assign(configuration,blocks);
 const events=[],reads=[],controller=new AbortController();let assembly;
 const close=name=>async()=>{events.push('close:'+name);};
 const pool={async connect(){assert.fail('no transaction client in the startup harness');},
  async query(sql){events.push('schema');assert.ok(sql.startsWith("SELECT to_regclass('meri_conversations.runs')"));
   return {rows:[{runs:'meri_conversations.runs',events:'meri_conversations.events',controls:'meri_conversations.controls',selected_outputs:'meri_conversations.selected_outputs',initial_inputs:'meri_conversations.initial_inputs'}]};},end:close('pool')};
 const connection={async withDeadline(_at,operation){return operation();},async withAbortSignal(_signal,operation){return operation();},workflowService:{async describeNamespace(){return {};}},close:close('connection')};
 const native={async readiness(){},async call(){return {};}};
 const candidate={execution:{authenticate(){assert.fail('no private execution');}},native,
  readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:Date.now(),expiresAtMs:Date.now()+60000}),
  productPorts:Object.freeze({browserHostCore:{readCurrent:async()=>({})}}),application:{async handle(){return null;}},bindApplication(){},close:close('candidate')};
 const owners={
  async readMaterial(path){reads.push(path);
   if(path===configuration.database.connectionFile)return Buffer.from('postgresql://database.synthetic.invalid/meri?sslmode=verify-full');
   if(path===configuration.native.capabilityFile)return Buffer.from('synthetic-control-startup-only-long-credential');
   if(material.has(path))return material.get(path);
   assert.fail('unexpected material '+path);},
  async tls(){return {synthetic:true};},
  createPool(options){pool.options=options;return pool;},async connect(){return connection;},createClient(){return {workflow:{async start(){return {}},getHandle(){return {}}}};},
  async startCandidate(){return candidate;},
  assemble(options){assembly=assembleControl(options);return assembly;},
  async listen(options){const role=options.configuration.http.port===configuration.privateHttp?.port?'private':'public';events.push('listen:'+role);
   return {address:{address:'127.0.0.1',port:options.configuration.http.port},close:close(role+'-listener')};},
 };
 return {configuration,events,reads,assembly:()=>assembly,start:()=>startControl(configuration,{signal:controller.signal,testOwners:owners})};
}

test('a control booted from the rendered browser blocks composes the browser-host router over the native material, held or open; open without the router refuses',async()=>{
 const i=await withNative(v=>{v.deployment.features.browserPlatform=structuredClone(committed);v.deployment.features.browserActivation=structuredClone(OPEN);});
 const rendered=renderMaterial(i),c=rendered.roles.control.config;
 const material=new Map(rendered.roles.control.bundle.files.filter(f=>Object.values(NATIVE_PATHS).includes(f.path)).map(f=>[f.path,Buffer.from(f.base64,'base64')]));
 for(const state of ['open','held']){
  const blocks={browserHosts:c.browserHosts,browserPlatform:c.browserPlatform,browserActivation:state==='open'?c.browserActivation:{state:'held'}};
  const f=harness(blocks,material);
  const runtime=await f.start();
  try{
   assert.deepEqual(f.events.filter(e=>e.startsWith('listen:')),['listen:private','listen:public']);
   for(const path of [NATIVE_PATHS.controlClientCertificate,NATIVE_PATHS.controlClientKey,NATIVE_PATHS.issuerCaCertificate])assert.ok(f.reads.includes(path),path);
   const a=f.assembly();
   assert.ok(a.browserHosts,'the browser-host family is composed');
   assert.deepEqual(a.browserHosts.state(),{mounted:true,closed:false,listener:null,siteWorkflows:false,browserApproval:false},'router only: no listener was declared');
   assert.equal(typeof a.browserHosts.browserHosts.executeBrowserOperation,'function','the port control\'s browser operations and the runner\'s browser-prepare route use');
   assert.equal(typeof a.browserHosts.currentness.readFacts,'function');
   assert.equal(a.productReadiness().owners.find(o=>o.name==='browser.hosts')?.state,'composed','product readiness reports the composed browser-host family');
  }finally{await runtime.close();}
  assert.ok(f.events.includes('close:pool'),state);
 }
 // The runtime validator refuses the open record without the router the renderer binds to the native family.
 const {browserHosts,...noRouter}=c;
 assert.throws(()=>validateConfiguration(noRouter,'control'),{code:'BROWSER_ACTIVATION_CONFIGURATION'});
});
