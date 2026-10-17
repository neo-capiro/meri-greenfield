import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate,createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createTemporalIssuerEntrypoint,parseTemporalIssuerEntrypointConfiguration} from './entrypoint.mjs';

const ACCOUNT='967807252336',REGION='us-east-1',KID='meri-issuer-test-v1';
const KEY_ARN=`arn:aws:kms:${REGION}:${ACCOUNT}:key/11111111-1111-4111-8111-111111111111`;
const cluster=`arn:aws:ecs:${REGION}:${ACCOUNT}:cluster/meri-preview`;
const keypair=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
const publicParts=keypair.publicKey.export({format:'jwk'});
const publicJwk={kty:'RSA',kid:KID,alg:'RS256',use:'sig',n:publicParts.n,e:publicParts.e};
const publicJwkSha256=createHash('sha256').update(JSON.stringify(publicJwk),'utf8').digest('hex');
const DER=keypair.publicKey.export({format:'der',type:'spki'});
const now=()=>1792240496000;
const len=n=>n<128?Buffer.from([n]):n<256?Buffer.from([0x81,n]):Buffer.from([0x82,n>>8,n&255]);
const der=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),len(bytes.length),bytes]);};
const oid=hex=>der(0x06,Buffer.from(hex,'hex'));
const algorithm=Buffer.from('300d06092a864886f70d01010b0500','hex');
const extension=(name,inner)=>der(0x30,oid(name),Buffer.from([0x01,0x01,0xff]),der(0x04,inner));
function time(ms){const iso=new Date(ms).toISOString();return der(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'));}
const caName=der(0x30,der(0x31,der(0x30,oid('550403'),der(0x0c,Buffer.from('Test Temporal CA')))));
const caExtensions=der(0xa3,der(0x30,
 extension('551d13',der(0x30,Buffer.from([0x01,0x01,0xff]))),
 extension('551d0f',Buffer.from('03020106','hex'))));
const caTbs=der(0x30,der(0xa0,Buffer.from([0x02,0x01,0x02])),der(0x02,Buffer.from([1])),
 algorithm,caName,der(0x30,time(now()-60000),time(now()+3600000)),caName,DER,caExtensions);
const caDer=der(0x30,caTbs,algorithm,der(0x03,Buffer.from([0]),sign('sha256',caTbs,keypair.privateKey)));
const caPem=Buffer.from(`-----BEGIN CERTIFICATE-----\n${caDer.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`);
const caKeyPem=Buffer.from(keypair.privateKey.export({type:'pkcs8',format:'pem'}));
const caPin=createHash('sha256').update(new X509Certificate(caPem).raw).digest('hex');
const materialFor=path=>Buffer.from(path.endsWith('/client-ca.pem')?caPem:
 path.endsWith('/client-ca.key')?caKeyPem:'test-only-'+path.split('/').at(-1));
class GetPublicKeyCommand{constructor(input){this.input=input;}}
class SignCommand{constructor(input){this.input=input;}}
const kmsCommands={GetPublicKeyCommand,SignCommand};

function rolePin(role){
 const name=role==='control'?'control':'worker';
 return {subject:`meri-temporal-${name}:v1`,workloadPrincipal:`meri-workload-${name}:v1`,
  peerSubjectCn:`meri-temporal-${name}`,peerUriBase:`spiffe://issuer.meri.internal/temporal/${name}/`,
  serviceArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:service/meri-preview/meri-${name}`,
  taskDefinitionArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:task-definition/meri-${name}:7`,
  containerName:`meri-${name}`,
  imageUri:`${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/meri/${name}@sha256:${'b'.repeat(64)}`,
  taskRoleArn:`arn:aws:iam::${ACCOUNT}:role/meri-${name}-task`,
  executionRoleArn:`arn:aws:iam::${ACCOUNT}:role/meri-${name}-execution`,revision:'revision-17'};
}
function configuration(){
 return {schemaVersion:1,startupTimeoutMs:30000,registrationRole:'test_issuer_role',
  service:{schemaVersion:1,issuerOrigin:'https://issuer.meri.internal:8445',kid:KID,namespace:'meri',
   audience:'meri-temporal',maxRequestMs:5000,bootstrapMaxRequestMs:10000,
   maxBodyBytes:4096,currentnessLeaseMs:20000},
  taskAuthority:{schemaVersion:1,clusterArn:cluster,vpcId:'vpc-12345678',
   privateSubnetIds:['subnet-12345678'],securityGroupIds:['sg-12345678'],maxLeaseMs:10000,
   roles:{control:rolePin('control'),'temporal-worker':rolePin('temporal-worker')}},
  signer:{schemaVersion:1,keyArn:KEY_ARN,kid:KID,publicJwk,publicJwkSha256},
  listen:{host:'0.0.0.0',port:8445},
  tls:{keyFile:'/run/meri/server.key',
   certFile:'/run/meri/server.crt',caFile:'/run/meri/client-ca.pem'},
  bootstrap:{caKeyFile:'/run/meri/client-ca.key',caSha256:caPin}};
}
const registration={async probe(){return {schemaVersion:1,state:'READY'};},
 async readCurrent(){return {state:'REVOKED'};},
 async readTaskCurrent(){return {schemaVersion:1,state:'ABSENT',certificateSha256:null};},
 async registerCurrent(){throw Error('unused');}};
function setup({publicReply,readMaterial,serviceFactory,registrationPort=registration,
 settings=configuration()}={}){
 const events=[];
 const fakeKms={async send(command){events.push('kms');
  if(!(command instanceof GetPublicKeyCommand))throw Error('unexpected command');
  return publicReply??{KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
   SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER};}};
 const awsClients={ecs:{async send(){events.push('ecs');throw Error('unused');}},
  ec2:{async send(){events.push('ec2');throw Error('unused');}},kms:fakeKms};
 const material=readMaterial??(async path=>{events.push('material:'+path.split('/').at(-1));
  return materialFor(path);});
 const createService=serviceFactory??(()=>{
  let listening=false;
  return {async listen({tls,host,port}){
   events.push('listen');assert.equal(host,'0.0.0.0');assert.equal(port,8445);
   assert.equal(tls.key.toString(),'test-only-server.key');
   assert.equal(tls.cert.toString(),'test-only-server.crt');
   assert.deepEqual(tls.ca,caPem);listening=true;
  },async close(){events.push('close');listening=false;
   return {schemaVersion:1,state:'CLEAN',listenerStopped:true,pendingRequests:0};},
   available(){return listening;}};
 });
 const entrypoint=createTemporalIssuerEntrypoint({configuration:settings,
  serviceTaskRegistration:registrationPort,awsClients,readMaterial:material,now,
  kmsCommands,serviceFactory:createService});
 return {entrypoint,events};
}

test('closed configuration joins exact KMS kid, private bind, lease, and owner-only material paths',()=>{
 const parsed=parseTemporalIssuerEntrypointConfiguration(configuration());
 assert.equal(parsed.signer.kid,KID);
 assert.equal(createTemporalIssuerEntrypoint({configuration:parsed,
  serviceTaskRegistration:registration,awsClients:{ecs:{send(){}},ec2:{send(){}},kms:{send(){}}}}).available(),false);
 const variants=[
  {...configuration(),extra:true},
  {...configuration(),startupTimeoutMs:120001},
  {...configuration(),listen:{host:'0.0.0.0',port:443}},
  {...configuration(),listen:{host:'8.8.8.8',port:8445}},
  {...configuration(),listen:{host:'10.0.1.42',port:8445}},
  {...configuration(),listen:{host:'0.0.0.0',port:8443}},
  {...configuration(),tls:{...configuration().tls,keyFile:'/tmp/issuer.key'}},
  {...configuration(),tls:{...configuration().tls,keyFile:'/run/meri-temporal/issuer/server.key'}},
  {...configuration(),tls:{...configuration().tls,keyFile:'/run/meri/nested/server.key'}},
  {...configuration(),bootstrap:{...configuration().bootstrap,caKeyFile:'/run/meri/nested/client-ca.key'}},
  {...configuration(),tls:{...configuration().tls,keyFile:configuration().tls.certFile}},
  {...configuration(),bootstrap:{...configuration().bootstrap,caKeyFile:configuration().tls.caFile}},
  {...configuration(),bootstrap:{...configuration().bootstrap,caSha256:'X'.repeat(64)}},
  {...configuration(),registrationRole:'Not-A-Database-Role'},
  {...configuration(),service:{...configuration().service,bootstrapMaxRequestMs:2999}},
  {...configuration(),service:{...configuration().service,bootstrapMaxRequestMs:14001}},
  {...configuration(),service:{...configuration().service,issuerOrigin:'https://issuer.meri.internal'}},
  {...configuration(),service:{...configuration().service,issuerOrigin:'https://issuer.meri.internal:443'}},
  {...configuration(),signer:{...configuration().signer,kid:'wrong-kid'}},
  {...configuration(),taskAuthority:{...configuration().taskAuthority,maxLeaseMs:20001}},
  {...configuration(),taskAuthority:{...configuration().taskAuthority,
   clusterArn:cluster.replace(ACCOUNT,'123456789012'),
   roles:Object.fromEntries(Object.entries(configuration().taskAuthority.roles).map(([role,pin])=>
    [role,Object.fromEntries(Object.entries(pin).map(([key,value])=>
     [key,typeof value==='string'?value.replaceAll(ACCOUNT,'123456789012'):value]))]))}},
 ];
 for(const variant of variants)assert.throws(()=>parseTemporalIssuerEntrypointConfiguration(variant),
  {code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
});

test('missing named durable registration refuses before secret IO or KMS client use',()=>{
 let touched=false;
 assert.throws(()=>createTemporalIssuerEntrypoint({configuration:configuration(),
  serviceTaskRegistration:null,awsClients:{ecs:{send(){touched=true;}},ec2:{send(){touched=true;}},
   kms:{send(){touched=true;}}},readMaterial(){touched=true;}}),
 {code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.equal(touched,false);
 assert.throws(()=>createTemporalIssuerEntrypoint({configuration:configuration(),
  serviceTaskRegistration:registration,registrationPool:{connect(){touched=true;}},
  awsClients:{ecs:{send(){touched=true;}},ec2:{send(){touched=true;}},kms:{send(){touched=true;}}},
  readMaterial(){touched=true;}}),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.equal(touched,false);
});

test('primary registration probe gates all TLS material and bootstrap startup',async()=>{
 const {entrypoint,events}=setup({registrationPort:{...registration,
  async probe(){throw Error('missing registration migration');}}});
 await assert.rejects(entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.deepEqual(events,['kms']);assert.equal(entrypoint.available(),false);
 const malformed=setup({registrationPort:{...registration,
  async probe(){return {schemaVersion:1,state:'READY',extra:true};}}});
 await assert.rejects(malformed.entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.deepEqual(malformed.events,['kms']);
});

test('CA DER pin is checked before owner-only CA key read or listener',async()=>{
 const settings={...configuration(),bootstrap:{...configuration().bootstrap,caSha256:'0'.repeat(64)}};
 const {entrypoint,events}=setup({settings});
 await assert.rejects(entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.deepEqual(events,['kms','material:server.key','material:server.crt',
  'material:client-ca.pem']);
 assert.equal(entrypoint.available(),false);
});

test('borrowed primary Pool composes PG registration, task proof, and bootstrap owner',async()=>{
 const queries=[],borrowed=[];let ended=false,bootstrap;
 const pool={async connect(){const client={async query(statement){
   const sql=typeof statement==='string'?statement:statement.text;queries.push(sql);
   if(sql==='SELECT pg_is_in_recovery() AS standby')return {rows:[{standby:false}]};
   if(sql.includes('has_schema_privilege(current_user'))return {rows:[{
    session_role:'test_issuer_role',current_role:'test_issuer_role',
    superuser:false,bypass_rls:false,create_db:false,create_role:false,
    inherit_role:false,table_owner:'test_schema_owner',schema_owner:'test_schema_owner',
    table_owner_member:false,schema_owner_member:false,table_owner_set:false,schema_owner_set:false,
    role_membership:false,public_schema_acl:false,public_table_acl:false,public_column_acl:false,
    other_schema_acl:false,other_table_acl:false,other_column_acl:false,
    issuer_schema_grant_option:false,issuer_table_grant_option:false,issuer_column_grant_option:false,
    schema_create:false,table_update:false,table_delete:false,table_truncate:false,
    table_trigger:false,table_references:false,column_references:false,
    unexpected_column_update:false,
    schema_usage:true,table_select:true,table_insert:true,cert_update:true,
    expiry_update:true,proof_update:true,generation_update:true,timestamp_update:true,
    revoke_update:true}]};
   if(sql.includes(' LIMIT 0'))return {rows:[]};
   return {rows:[]};},release(){borrowed.push('released');}};return client;},
  async end(){ended=true;}};
 const sdk={ecs:{send(){}},ec2:{send(){}},kms:{async send(command){
  assert.ok(command instanceof GetPublicKeyCommand);
  return {KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
   SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER};}}};
 let listening=false;
 const entrypoint=createTemporalIssuerEntrypoint({configuration:configuration(),registrationPool:pool,
  awsClients:sdk,readMaterial:async path=>materialFor(path),now,kmsCommands,
  serviceFactory:options=>{bootstrap=options.bootstrapOwner;
   assert.equal(typeof bootstrap.challenge,'function');
   assert.equal(typeof bootstrap.redeem,'function');
   assert.equal(bootstrap.available(),true);
   assert.equal(typeof options.taskAuthority.readCurrent,'function');
   return {async listen(){listening=true;},async close(){listening=false;
    return {schemaVersion:1,state:'CLEAN',listenerStopped:true,pendingRequests:0};},
    available(){return listening;}};}});
 assert.deepEqual(await entrypoint.start(),{available:true});
 assert.equal(entrypoint.available(),true);
 assert.ok(queries.some(statement=>statement.includes('meri_service_identity.service_task_registrations LIMIT 0')));
 assert.deepEqual(borrowed,['released']);
 await entrypoint.close();assert.equal(bootstrap.available(),false);
 assert.equal(ended,false);assert.equal(entrypoint.available(),false);
});

test('KMS public pin precedes sequential TLS reads and listener; close stops availability',async()=>{
 const {entrypoint,events}=setup();
 assert.equal(new X509Certificate(caPem).ca,true);
 assert.equal(/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END CERTIFICATE-----\r?\n?$/u.test(caPem.toString()),true);
 assert.equal(entrypoint.available(),false);
 assert.deepEqual(await entrypoint.start(),{available:true});
 assert.deepEqual(events,['kms','material:server.key','material:server.crt',
  'material:client-ca.pem','material:client-ca.key','listen']);
 assert.equal(entrypoint.available(),true);
 await entrypoint.close();assert.equal(entrypoint.available(),false);
 assert.equal(events.at(-1),'close');
 await assert.rejects(entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
});

test('wrong KMS public key refuses before any TLS read or listen',async()=>{
 const {entrypoint,events}=setup({publicReply:{KeyId:KEY_ARN,KeySpec:'RSA_2048',
  KeyUsage:'SIGN_VERIFY',SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:Buffer.alloc(270)}});
 await assert.rejects(entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.deepEqual(events,['kms']);assert.equal(entrypoint.available(),false);
});

test('close during an unsettled KMS startup read reports the raw startup and child operation',async()=>{
 let entered,release;
 const started=new Promise(resolve=>{entered=resolve;});
 const pending=new Promise(resolve=>{release=resolve;});
 const sdk={ecs:{send(){}},ec2:{send(){}},kms:{send(){entered();return pending;}}};
 const entrypoint=createTemporalIssuerEntrypoint({configuration:configuration(),
  serviceTaskRegistration:registration,awsClients:sdk,readMaterial:async path=>materialFor(path),
  now,kmsCommands,serviceFactory:()=>{throw Error('must not construct service');}});
 const startup=entrypoint.start();await started;
 await assert.rejects(entrypoint.close(),error=>
  error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&
  error.receipt.childReceipts.signer.pendingOperations>0);
 await assert.rejects(startup,{code:'TEMPORAL_ISSUER_CLEANUP_UNKNOWN'});
 release({KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
  SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(entrypoint.available(),false);
});

test('a stopped listener with pending raw service work is still CLEANUP_UNKNOWN',async()=>{
 const {entrypoint}=setup({serviceFactory:()=>({async listen(){},available(){return true;},
  async close(){return Object.freeze({schemaVersion:1,state:'CLEANUP_UNKNOWN',
   listenerStopped:true,pendingRequests:1});}})});
 await entrypoint.start();
 await assert.rejects(entrypoint.close(),error=>
  error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&
  error.receipt.listenerStopped===true&&error.receipt.pendingServiceOperations===1);
});

test('listener failure wipes every loaded buffer and closes; no readiness remains',async()=>{
 const material=[];
 const {entrypoint,events}=setup({readMaterial:async path=>{
  const bytes=materialFor(path);material.push(bytes);return bytes;
 },serviceFactory:()=>({async listen(){events.push('listen');throw Error('cannot bind');},
  async close(){events.push('close');return {schemaVersion:1,state:'CLEAN',
   listenerStopped:true,pendingRequests:0};},available(){return false;}})});
 await assert.rejects(entrypoint.start(),{code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});
 assert.equal(material.length,4);
 for(const bytes of material)assert.deepEqual(bytes,Buffer.alloc(bytes.length));
 assert.deepEqual(events,['kms','listen','close']);assert.equal(entrypoint.available(),false);
});

test('close while material is pending refuses late material and wipes it',async()=>{
 let release,entered;
 const started=new Promise(resolve=>{entered=resolve;});
 const pending=new Promise(resolve=>{release=resolve;});
 const late=Buffer.from('late-private-material');
 const {entrypoint,events}=setup({readMaterial:async()=>{entered();return pending;}});
 const start=entrypoint.start();await started;
 await assert.rejects(entrypoint.close(),error=>
  error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&error.receipt.pendingMaterial===1);
 await assert.rejects(start,{code:'TEMPORAL_ISSUER_CLEANUP_UNKNOWN'});
 release(late);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(late,Buffer.alloc(late.length));
 assert.deepEqual(events,['kms']);assert.equal(entrypoint.available(),false);
});

test('a bounded startup deadline aborts a stalled material read without opening a listener',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const material=Buffer.from('late-private-after-deadline');
 const {entrypoint,events}=setup({readMaterial:()=>pending});
 // Exercise the parsed deadline using a fresh instance, preserving the same
 // normal configuration and named registration requirement.
 const c={...configuration(),startupTimeoutMs:5};
 const timed=createTemporalIssuerEntrypoint({configuration:c,serviceTaskRegistration:registration,
  awsClients:{ecs:{send(){}},ec2:{send(){}},kms:{async send(command){
   assert.ok(command instanceof GetPublicKeyCommand);
   return {KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
    SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER};}}},
  readMaterial:()=>pending,now,kmsCommands,
  serviceFactory:()=>({async listen(){throw Error('must not listen');},
   async close(){return {schemaVersion:1,state:'CLEAN',listenerStopped:true,pendingRequests:0};},
   available(){return false;}})});
 await assert.rejects(timed.start(),error=>
  error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&error.receipt.pendingMaterial===1);
 assert.equal(timed.available(),false);
 release(material);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(material,Buffer.alloc(material.length));
 await assert.rejects(timed.close(),{code:'TEMPORAL_ISSUER_CLEANUP_UNKNOWN'});
 assert.deepEqual(await entrypoint.close(),{schemaVersion:1,state:'CLEAN',listenerStopped:true,
  pendingStartup:0,pendingMaterial:0,pendingExternalOperations:0,pendingServiceOperations:0,
  childReceipts:{},cleanupErrors:[]});assert.deepEqual(events,[]);
});

test('a throwing service close still settles concurrent close with one result',async()=>{
 const destroyed=[];
 const sdk={ecs:{send(){},destroy(){destroyed.push('ecs');}},
  ec2:{send(){},destroy(){destroyed.push('ec2');}},
  kms:{async send(command){assert.ok(command instanceof GetPublicKeyCommand);
   return {KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
    SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER};},
   destroy(){destroyed.push('kms');}}};
 // A borrowed test SDK is not owned by the entrypoint and must not be destroyed.
 let closes=0;
 const entrypoint=createTemporalIssuerEntrypoint({configuration:configuration(),
  serviceTaskRegistration:registration,awsClients:sdk,
  readMaterial:async path=>materialFor(path),now,kmsCommands,
  serviceFactory:()=>({async listen(){},async close(){closes++;throw Error('close failed');},
   available(){return true;}})});
 await entrypoint.start();
 const first=entrypoint.close(),second=entrypoint.close();
 assert.equal(first,second);
 await assert.rejects(first,error=>error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&
  error.receipt.cleanupErrors.includes('service'));
 assert.equal(closes,1);assert.deepEqual(destroyed,[]);
 assert.equal(entrypoint.available(),false);
});

test('deadline wipes TLS immediately and re-closes a listener that finishes opening late',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const material=[];let listening=false,closeCalls=0,listenEntered;
 const entered=new Promise(resolve=>{listenEntered=resolve;});
 const sdk={ecs:{send(){}},ec2:{send(){}},kms:{async send(command){
  assert.ok(command instanceof GetPublicKeyCommand);
  return {KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
   SigningAlgorithms:['RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER};}}};
 const entrypoint=createTemporalIssuerEntrypoint({configuration:{...configuration(),startupTimeoutMs:5},
  serviceTaskRegistration:registration,awsClients:sdk,now,kmsCommands,
  readMaterial:async path=>{const bytes=materialFor(path);material.push(bytes);return bytes;},
  serviceFactory:()=>({async listen(){listenEntered();await pending;listening=true;},
   async close(){closeCalls++;listening=false;
    return {schemaVersion:1,state:'CLEAN',listenerStopped:true,pendingRequests:0};},
    available(){return listening;}})});
 const startup=entrypoint.start();await entered;
 await assert.rejects(startup,error=>error.code==='TEMPORAL_ISSUER_CLEANUP_UNKNOWN'&&
  error.receipt.pendingStartup===1);
 assert.equal(material.length,4);
 for(const bytes of material)assert.deepEqual(bytes,Buffer.alloc(bytes.length));
 assert.equal(listening,false);assert.equal(entrypoint.available(),false);
 release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(listening,false);assert.ok(closeCalls>=2);
 await assert.rejects(entrypoint.close(),{code:'TEMPORAL_ISSUER_CLEANUP_UNKNOWN'});
 assert.equal(entrypoint.available(),false);
});
