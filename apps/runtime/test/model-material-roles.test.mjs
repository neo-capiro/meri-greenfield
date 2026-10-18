import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {compileProductMaterialPlan,productMaterialPolicy,productMaterialIdentity} from '../material-init-plan.mjs';
import {parseStaticProductMaterialExpected,validateStaticProductDelivery,materializeStaticProductMaterial} from '../material-init.mjs';
import {validateProductOwnerConfiguration} from '../../proxy/product/owner-entrypoint.mjs';
import {PRODUCT_PROXY_PRICING_REVISION} from '../../proxy/product/startup-config.mjs';
import {productControlFixture} from '../../proxy/product/test/control-fixture.mjs';
import {servicePairFixture} from '../../proxy/product/test/service-pair-fixture.mjs';
import {NOW} from '../../gateway/budget/product-scripted-fixture.mjs';

/** Synthetic, inert bytes only: no key generation, credential, listener or material filesystem IO (except the gated Linux test). */
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),refused={code:'PRODUCT_MATERIAL_REFUSED'};
const inert=path=>Buffer.from('SYNTHETIC INERT MATERIAL '+path);
function repin(expected){const {materialContractSha256:_,...contract}=expected;void _;expected.materialContractSha256=canonicalSha256(contract);return expected;}
function envelope(role,runtimeUser,material){
 const expected={schemaVersion:1,role,runtimeUser,sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),
  sha256ByPath:Object.fromEntries([...material].map(([path,bytes])=>[path,sha(bytes)]))};
 return {expected:repin(expected),bundle:{files:[...material].map(([path,bytes])=>({path,base64:bytes.toString('base64')}))}};
}

/** Same runtime shape as owner-entrypoint.test.mjs fixture(), relocated to the task-local /run/meri inventory. */
function ownerFixture(){
 const {configuration:control,clientId}=productControlFixture();
 control.nativeCandidate.multiRun.materialDirectory='/tmp/meri-material';
 const controlBytes=Buffer.from(JSON.stringify(control)),identityBytes=Buffer.from('synthetic-existing-native-session\n'),pair=servicePairFixture({now:NOW});
 const owner={schemaVersion:1,sourceEnabled:false,enabled:true,controlConfigurationFile:'/run/meri/control.json',controlConfigurationSha256:sha(controlBytes),nativeCredentialFileSha256:sha(identityBytes),
  tls:{origin:'https://owner.synthetic.invalid:8444',serverName:'owner.synthetic.invalid',caFile:'/run/meri/owner-ca.pem',certFile:'/run/meri/owner-cert.pem',keyFile:'/run/meri/owner-key.pem',certSha256:'a'.repeat(64),issuerSha256:'b'.repeat(64)},
  clientPolicy:{clientCertSha256:'c'.repeat(64),clientSubject:'proxy-task-v1',deploymentRevision:'preview-v1',issuerSha256:'b'.repeat(64),selectedClientId:clientId},
  serviceTasks:{...pair.pins,deploymentRevision:'preview-v1',proxyCertSha256:'c'.repeat(64)},
  pricing:{modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'d'.repeat(64),validUntilMs:NOW+60000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256},
  limits:{maxRequestMs:1000,maxFactBytes:131072,maxLeaseMs:30000}};
 return {owner,control,controlBytes,identityBytes};
}
function ownerDelivery({change,changeControl}={}){
 const f=ownerFixture();changeControl?.(f.control);
 if(changeControl){f.controlBytes=Buffer.from(JSON.stringify(f.control));f.owner.controlConfigurationSha256=sha(f.controlBytes);}
 change?.(f.owner,f);
 const material=new Map([['/run/meri/owner.json',Buffer.from(JSON.stringify(f.owner))],['/run/meri/control.json',f.controlBytes],
  [f.control.database.connectionFile,Buffer.from('postgres://synthetic@database.synthetic.invalid/meri?sslmode=verify-full')],
  [f.control.nativeCandidate.identity.credentialFile,f.identityBytes],
  ...['owner-ca.pem','owner-cert.pem','owner-key.pem'].map(name=>['/run/meri/'+name,inert(name)])]);
 return {...envelope('model-owner','1000:1000',material),...f};
}

/** JavaScript port of test_startup_config.configuration(); refs carry the real bytes' digests. */
const proxyNames={serverCertificate:'server.pem',serverPrivateKey:'server.key',ownerCa:'ca.pem',ownerCertificate:'client.pem',ownerPrivateKey:'client.key'};
function proxyConfiguration(){
 const ref=name=>({path:'/run/meri/'+name,sha256:sha(inert('/run/meri/'+name))}),pins=servicePairFixture({now:NOW}).pins;
 return {schemaVersion:1,enabled:true,deploymentRevision:pins.deploymentRevision,expiresAtMs:pins.expiresAtMs,pricingRevision:PRODUCT_PROXY_PRICING_REVISION,
  serverTls:{certificateFile:ref(proxyNames.serverCertificate),privateKeyFile:ref(proxyNames.serverPrivateKey),certificateSha256:'4'.repeat(64)},
  ownerPeer:{origin:'https://owner.invalid:8444',server_name:'owner.invalid',server_cert_sha256:pins.ownerCertSha256,server_issuer_sha256:'2'.repeat(64),
   client_cert_sha256:pins.proxyCertSha256,client_subject:'proxy-subject',max_exchange_ms:3000},
  ownerTls:{caFile:ref(proxyNames.ownerCa),certificateFile:ref(proxyNames.ownerCertificate),privateKeyFile:ref(proxyNames.ownerPrivateKey)},
  serviceTasks:pins};
}
function proxyDelivery(change){
 const c=proxyConfiguration();change?.(c);
 const refs=[c.serverTls.certificateFile,c.serverTls.privateKeyFile,c.ownerTls.caFile,c.ownerTls.certificateFile,c.ownerTls.privateKeyFile];
 const material=new Map([['/run/meri/proxy.json',Buffer.from(JSON.stringify(c))],...refs.map(ref=>[ref.path,inert(ref.path)])]);
 return {...envelope('model-proxy','10001:10001',material),configuration:c};
}
const ownerPlan=(f=ownerFixture(),user='1000:1000')=>compileProductMaterialPlan({role:'model-owner',configuration:f.owner,runtimeUser:user,controlConfiguration:f.control});
const proxyPlan=(c=proxyConfiguration(),user='10001:10001')=>compileProductMaterialPlan({role:'model-proxy',configuration:c,runtimeUser:user});

test('model-owner plan pins exactly owner.json, the control.json copy, the paths control.json names and owner TLS',()=>{
 const f=ownerFixture();assert.equal(validateProductOwnerConfiguration(f.owner).enabled,true,'the shared owner fixture is a valid owner configuration');
 const p=ownerPlan(f);
 assert.equal(productMaterialPolicy.configurationNames['model-owner'],'owner.json');
 assert.deepEqual(p.requiredFiles.map(file=>[file.path,file.purposes.join()]),[
  ['/run/meri/control.json','control-configuration'],['/run/meri/database','database-connection'],['/run/meri/identity','identity-capability'],
  ['/run/meri/owner-ca.pem','owner-tls-ca'],['/run/meri/owner-cert.pem','owner-tls-cert'],['/run/meri/owner-key.pem','owner-tls-key'],['/run/meri/owner.json','configuration']]);
 assert.equal(p.configurationPath,'/run/meri/owner.json');assert.equal(p.containerName,'model-owner');
 assert.deepEqual([p.runtimeUser,p.uid,p.gid,p.writerUser,p.writerUid,p.writerGid],['1000:1000',1000,1000,'1000:1000',1000,1000]);
 assert.deepEqual(p.requiredSha256ByPath,{'/run/meri/control.json':sha(f.controlBytes),'/run/meri/identity':sha(f.identityBytes)});
 assert.ok(p.requiredFiles.every(file=>file.mode==='0600'&&file.maxBytes===32768));assert.equal(p.directoryMode,'0700');
 assert.equal(p.dynamicMaterialDirectory,null);assert.equal(p.requiresTokenRotation,false);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.requiredSha256ByPath));
 const d=ownerDelivery(),receipt=validateStaticProductDelivery(d);
 assert.deepEqual(receipt,{ready:true,role:'model-owner',runtimeUser:'1000:1000',sourceCommit:d.expected.sourceCommit,imageDigest:d.expected.imageDigest,
  materialContractSha256:d.expected.materialContractSha256,configurationPath:'/run/meri/owner.json',fileCount:7});
 assert.equal(JSON.stringify(receipt).includes('synthetic'),false);
});

test('model-proxy plan pins proxy.json plus exactly the five {path,sha256} references, readable by uid 10001',()=>{
 const c=proxyConfiguration(),p=proxyPlan(c);
 assert.equal(productMaterialPolicy.configurationNames['model-proxy'],'proxy.json');
 assert.deepEqual(p.requiredFiles.map(file=>[file.path,file.purposes.join()]),[
  ['/run/meri/ca.pem','owner-tls-ca'],['/run/meri/client.key','owner-tls-key'],['/run/meri/client.pem','owner-tls-cert'],
  ['/run/meri/proxy.json','configuration'],['/run/meri/server.key','server-tls-key'],['/run/meri/server.pem','server-tls-cert']]);
 assert.deepEqual([p.runtimeUser,p.uid,p.gid,p.writerUser,p.writerUid,p.writerGid],['10001:10001',10001,10001,'0:0',0,0]);
 assert.deepEqual(p.requiredSha256ByPath,Object.fromEntries(Object.values(proxyNames).map(name=>['/run/meri/'+name,sha(inert('/run/meri/'+name))])));
 assert.equal(p.containerName,'model-proxy');assert.equal(p.configurationPath,'/run/meri/proxy.json');
 const d=proxyDelivery(),receipt=validateStaticProductDelivery(d);
 assert.deepEqual(receipt,{ready:true,role:'model-proxy',runtimeUser:'10001:10001',sourceCommit:d.expected.sourceCommit,imageDigest:d.expected.imageDigest,
  materialContractSha256:d.expected.materialContractSha256,configurationPath:'/run/meri/proxy.json',fileCount:6});
});

test('runtime user 10001:10001 is valid only for model-proxy, and each fixed role accepts only its own user',()=>{
 assert.deepEqual({...productMaterialIdentity('model-proxy','10001:10001')},{uid:10001,gid:10001,writerUser:'0:0',writerUid:0,writerGid:0});
 for(const user of ['1000:1000','0:0','10001:1000','1000:10001','10002:10002','10001'])assert.throws(()=>proxyPlan(proxyConfiguration(),user),refused);
 for(const user of ['10001:10001','1001:1001','1000:0','0:0'])assert.throws(()=>ownerPlan(ownerFixture(),user),refused);
 for(const role of ['control','temporal-worker','temporal-issuer','model-owner'])for(const user of ['10001:10001','10001:1000','1000:10001'])assert.throws(()=>productMaterialIdentity(role,user),refused);
 // Wrong uid in the independent envelope refuses before any delivery is fetched or validated.
 for(const [d,user] of [[proxyDelivery(),'1000:1000'],[proxyDelivery(),'0:0'],[ownerDelivery(),'10001:10001']]){
  d.expected.runtimeUser=user;repin(d.expected);
  assert.throws(()=>parseStaticProductMaterialExpected(d.expected),{code:'STATIC_INIT_EXPECTED_REFUSED'});
  assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_EXPECTED_REFUSED'});
 }
 // No Node role can be pinned to the proxy user either, even with a valid control inventory envelope.
 const d=ownerDelivery();d.expected.role='control';d.expected.runtimeUser='10001:10001';repin(d.expected);
 assert.throws(()=>parseStaticProductMaterialExpected(d.expected),{code:'STATIC_INIT_EXPECTED_REFUSED'});
});

test('missing or extra files refuse even when the envelope is fully repinned',()=>{
 for(const [make,victims] of [[ownerDelivery,['/run/meri/identity','/run/meri/owner-key.pem','extra']],[proxyDelivery,['/run/meri/server.key','/run/meri/ca.pem','extra']]])for(const victim of victims){
  const d=make();
  if(victim==='extra'){const bytes=inert('/run/meri/extra.key');d.bundle.files.push({path:'/run/meri/extra.key',base64:bytes.toString('base64')});d.expected.sha256ByPath['/run/meri/extra.key']=sha(bytes);}
  else{d.bundle.files=d.bundle.files.filter(f=>f.path!==victim);delete d.expected.sha256ByPath[victim];}
  repin(d.expected);assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_INVENTORY_REFUSED'},`${d.expected.role} ${victim}`);
 }
 // The owner's control.json companion is required before its plan can be compiled.
 const d=ownerDelivery();d.bundle.files=d.bundle.files.filter(f=>f.path!=='/run/meri/control.json');delete d.expected.sha256ByPath['/run/meri/control.json'];repin(d.expected);
 assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_INVENTORY_REFUSED'});
 const changed=proxyDelivery();changed.bundle.files.find(f=>f.path==='/run/meri/server.key').base64=Buffer.from('SYNTHETIC CHANGED').toString('base64');
 assert.throws(()=>validateStaticProductDelivery(changed),{code:'STATIC_INIT_CONTENT_REFUSED'});
});

test('owner configuration and its control.json copy are validated inside the plan',()=>{
 assert.throws(()=>compileProductMaterialPlan({role:'model-owner',configuration:ownerFixture().owner,runtimeUser:'1000:1000'}),refused,'control copy is required');
 assert.throws(()=>compileProductMaterialPlan({role:'model-proxy',configuration:proxyConfiguration(),runtimeUser:'10001:10001',controlConfiguration:ownerFixture().control}),refused);
 for(const [name,change,changeControl] of [
  ['disabled',o=>{o.enabled=false;}],['implicitly disabled',o=>{delete o.enabled;}],['source enabled',o=>{o.sourceEnabled=true;}],
  ['foreign control path',o=>{o.controlConfigurationFile='/run/meri/other-control.json';}],['nested control path',o=>{o.controlConfigurationFile='/run/meri/a/control.json';}],
  ['tls key outside',o=>{o.tls.keyFile='/run/secrets/owner-key.pem';}],['tls alias',o=>{o.tls.caFile=o.tls.certFile;}],
  ['tls on control',o=>{o.tls.keyFile='/run/meri/control.json';}],['tls on identity',o=>{o.tls.certFile='/run/meri/identity';}],['unknown field',o=>{o.callback='module';}],
  ['client mismatch',o=>{o.clientPolicy.selectedClientId='11111111-1111-4111-8111-000000000777';}],
  ['control port',null,c=>{c.http.port=9999;}],['control without router',null,c=>{delete c.taskRouter;}],
  ['dynamic initial runs off',null,c=>{c.nativeCandidate.multiRun.dynamicInitialRuns=false;}],
  ['database on owner config',null,c=>{c.database.connectionFile='/run/meri/owner.json';}],
 ]){
  const d=ownerDelivery({change:change??undefined,changeControl});
  assert.throws(()=>validateStaticProductDelivery(d),{code:'STATIC_INIT_REFUSED'},name);
 }
 // Paths control.json names must themselves be direct /run/meri children (the envelope would also refuse them).
 for(const path of ['/run/secrets/identity','/run/meri/nested/identity']){
  const f=ownerFixture();f.control.nativeCandidate.identity.credentialFile=path;assert.throws(()=>ownerPlan(f),refused,path);
 }
});

test('proxy configuration is validated inside the plan with the Python startup rules',()=>{
 for(const [name,change] of [
  ['disabled',c=>{c.enabled=false;}],['pricing',c=>{c.pricingRevision='f'.repeat(64);}],['schema',c=>{c.schemaVersion=2;}],['unknown field',c=>{c.callback='arbitrary.module';}],
  ['expiry type',c=>{c.expiresAtMs=true;}],['peer origin',c=>{c.ownerPeer.origin='http://owner.invalid:8444';}],['peer exchange',c=>{c.ownerPeer.max_exchange_ms=3001;}],
  ['pair schema',c=>{c.serviceTasks.schemaVersion=1;}],['pair cert',c=>{c.serviceTasks.ownerCertSha256='f'.repeat(64);}],['pair revision',c=>{c.serviceTasks.deploymentRevision='foreign';}],
  ['tls extra',c=>{c.ownerTls.password='secret';}],['traversal',c=>{c.ownerTls.privateKeyFile.path='/run/../outside';}],
  ['nested',c=>{c.serverTls.privateKeyFile.path='/run/meri/nested/server.key';}],['outside',c=>{c.serverTls.privateKeyFile.path='/run/secrets/server.key';}],
  ['alias',c=>{c.ownerTls.privateKeyFile={...c.serverTls.privateKeyFile};}],['on config',c=>{c.ownerTls.caFile.path='/run/meri/proxy.json';}],
  ['ref sha',c=>{c.ownerTls.caFile.sha256='invalid';}],
 ]){
  const c=proxyConfiguration();change(c);assert.throws(()=>proxyPlan(c),refused,name);
  // The same refusal holds through the delivery receiver when every envelope digest is consistent.
  if(!['traversal','nested','outside','on config','alias','ref sha'].includes(name))assert.throws(()=>validateStaticProductDelivery(proxyDelivery(change)),{code:'STATIC_INIT_REFUSED'},name);
 }
});

test('configuration digests must agree with the independently pinned delivered bytes',()=>{
 // Proxy: a reference whose sha differs from its delivered file refuses even though the envelope is internally consistent.
 const p=proxyDelivery(),key=p.bundle.files.find(f=>f.path==='/run/meri/client.key'),bytes=Buffer.from('SYNTHETIC OTHER KEY');
 key.base64=bytes.toString('base64');p.expected.sha256ByPath[key.path]=sha(bytes);repin(p.expected);
 assert.throws(()=>validateStaticProductDelivery(p),{code:'STATIC_INIT_CONTENT_REFUSED'});
 // Owner: controlConfigurationSha256 and nativeCredentialFileSha256 must name the delivered control copy and credential.
 for(const change of [o=>{o.controlConfigurationSha256='e'.repeat(64);},o=>{o.nativeCredentialFileSha256='e'.repeat(64);}]){
  assert.throws(()=>validateStaticProductDelivery(ownerDelivery({change})),{code:'STATIC_INIT_CONTENT_REFUSED'});
 }
 // Reformatted owner bytes are a different pinned configuration.
 const o=ownerDelivery(),cfg=o.bundle.files.find(f=>f.path==='/run/meri/owner.json');
 cfg.base64=Buffer.from(JSON.stringify(o.owner,null,1)).toString('base64');
 assert.throws(()=>validateStaticProductDelivery(o),{code:'STATIC_INIT_CONTENT_REFUSED'});
});

test('model roles refuse an unsupported host before any delivery effect',async()=>{
 let calls=0;
 for(const d of [proxyDelivery(),ownerDelivery()]){
  const delivery={async fetch(){calls++;return d.bundle;}};
  if(process.platform!=='linux')await assert.rejects(materializeStaticProductMaterial({expected:d.expected,delivery}),{code:'STATIC_INIT_PLATFORM_REFUSED'});
 }
 assert.equal(calls,0);
});

test('model-proxy root init stages, verifies and hands files and directory to 10001:10001',{skip:!(process.platform==='linux'&&process.getuid?.()===0&&process.getgid?.()===0)&&'UNRUN: requires Linux root (CAP_CHOWN) and a writable /run without /run/meri'},async()=>{
 const {existsSync,statSync,readdirSync,rmSync}=await import('node:fs');
 assert.equal(existsSync('/run/meri'),false,'test owns /run/meri only when it is absent');
 const d=proxyDelivery();
 try{
  const result=await materializeStaticProductMaterial({expected:d.expected,delivery:{async fetch(){return d.bundle;}}});
  assert.equal(result.receipt.fileCount,6);
  const dir=statSync('/run/meri');assert.deepEqual([dir.uid,dir.gid,dir.mode&0o7777],[10001,10001,0o700]);
  assert.deepEqual(readdirSync('/run/meri').sort(),Object.keys(d.expected.sha256ByPath).map(p=>p.slice(10)).sort());
  for(const path of Object.keys(d.expected.sha256ByPath)){const st=statSync(path);assert.deepEqual([st.uid,st.gid,st.mode&0o7777,st.nlink],[10001,10001,0o600,1]);}
 }finally{rmSync('/run/meri',{recursive:true,force:true});}
});
