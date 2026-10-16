import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {TEMPORAL_MIGRATION_PLAN_SHA256} from './temporal-migration-plan.mjs';
import {TEMPORAL_ROLES,TEMPORAL_INTERFACE_ENDPOINTS} from './temporal-binding.mjs';
import {inspectTemporalProductJoin} from './temporal-product-join.mjs';

const account='967807252336',region='us-east-1',sha='a'.repeat(64),sourceCommit='c'.repeat(40);
const roleSecret=(name,n)=>`arn:aws:secretsmanager:${region}:${account}:secret:meri/temporal/${name}-ABC123:::${String(n).repeat(32)}`;
const controlCa=Buffer.from('synthetic public CA'),controlCaSha=createHash('sha256').update(controlCa).digest('hex');
function temporal(){return {
 account,region,enabled:false,placement:{kind:'independent-meri-vpc',reviewSha256:sha},
 clusterArn:`arn:aws:ecs:${region}:${account}:cluster/meri-temporal`,vpcId:'vpc-1234abcd',
 subnets:[{id:'subnet-11111111',availabilityZone:'us-east-1a'},{id:'subnet-22222222',availabilityZone:'us-east-1b'}],
 privateDnsName:'temporal.meri.internal',serverImageUri:`${account}.dkr.ecr.${region}.amazonaws.com/meri/temporal@sha256:${sha}`,
 upstreamServerImageDigest:'sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e',
 launchSourceCommit:sourceCommit,
 launchContractSha256:createHash('sha256').update(readFileSync(new URL('./temporal-launch-render.mjs',import.meta.url))).digest('hex'),
 logGroupName:'/meri/temporal',executionRoleArn:`arn:aws:iam::${account}:role/temporal-execution`,
 taskRoleArns:Object.fromEntries(TEMPORAL_ROLES.map((x,i)=>[x,`arn:aws:iam::${account}:role/temporal-${i}`])),
 network:{clientSecurityGroupIds:['sg-1234abcd','sg-5678abcd'],issuerSecurityGroupId:'sg-33333333',
  interfaceEndpoints:Object.fromEntries(Object.keys(TEMPORAL_INTERFACE_ENDPOINTS).map((name,i)=>[name,
   {endpointId:`vpce-${String(i+1).repeat(8)}`,securityGroupId:`sg-${String(i+4).repeat(8)}`}])) ,
  s3Gateway:{endpointId:'vpce-99999999',prefixListId:'pl-11111111'},
  taskRouteTableBySubnet:{'subnet-11111111':'rtb-11111111','subnet-22222222':'rtb-22222222'},
  migrationSecurityGroupId:'sg-aaaaaaaa'},
 auth:{issuer:'https://issuer.meri.internal/',jwksUrl:'https://issuer.meri.internal/.well-known/jwks.json',
  issuerCaSha256:sha,audience:'meri-temporal',namespace:'meri',taskQueue:'meri-conversations',
  materialSecretVersionByRole:Object.fromEntries(TEMPORAL_ROLES.map((x,i)=>[x,roleSecret(x,i+1)]))},
 database:{kmsKeyArn:`arn:aws:kms:${region}:${account}:key/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
  masterSecretVersionArn:roleSecret('master',6),masterUsername:'temporal_admin',
  primarySecretVersionArn:roleSecret('primary',7),primaryUsername:'temporal_primary',
  visibilitySecretVersionArn:roleSecret('visibility',8),visibilityUsername:'temporal_visibility',
  instanceClass:'db.m6g.large',storageGiB:100,backupDays:7,rdsCaSha256:sha,
  migrationPlanSha256:TEMPORAL_MIGRATION_PLAN_SHA256}
};}
function expected(role){const x={schemaVersion:1,role:role==='control'?'control':'temporal-worker',runtimeUser:'1000:1000',
 sourceCommit,imageDigest:`sha256:${sha}`,sha256ByPath:{
  [`/run/meri/${role==='control'?'control':'worker'}.json`]:'d'.repeat(64),
  '/run/meri/temporal-ca.pem':'e'.repeat(64),
  ...(role==='control'?{'/run/meri/control-ca.pem':controlCaSha}:{})}};
 return {...x,materialContractSha256:canonicalSha256(x)};
}
function product(){return {
 account,region,enabled:false,sourceCommit,
 materialDelivery:{control:{valueFrom:roleSecret('product-control',9),expected:expected('control')},
  temporalWorker:{valueFrom:roleSecret('product-worker',1),expected:expected('temporalWorker')}},
 runnerPoststart:{controlOrigin:'https://private-control.example.invalid',controlCaFile:'/run/meri/control-ca.pem',
  controlCaBase64:controlCa.toString('base64'),controlCaSha256:controlCaSha},
 clusterArn:`arn:aws:ecs:${region}:${account}:cluster/meri-product`,
 imageUri:`${account}.dkr.ecr.${region}.amazonaws.com/meri/product@sha256:${sha}`,
 logGroupName:'/meri/product',executionRoleArn:`arn:aws:iam::${account}:role/product-execution`,
 controlTaskRoleArn:`arn:aws:iam::${account}:role/product-control`,runtimeUser:'1000:1000',runnerSha256:sha,
 network:{privateSubnetId:'subnet-abcdef12',controlSecurityGroupId:'sg-1234abcd',
  workerSecurityGroupId:'sg-5678abcd',runnerSecurityGroupIds:['sg-abcd1234']},
 sizing:{control:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},
  temporalWorker:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},
  runner:{cpu:1024,memoryMiB:2048,ephemeralStorageGiB:50}}
};}
function renewal(t){const role=name=>({subject:`meri-${name}:v1`,namespaceRole:'write',
 tokenFile:'/run/meri/temporal-token.json',workloadPrincipal:`meri-workload-${name}:v1`,
 delivery:'task-local-atomic-owner-only-file'});
 return {schemaVersion:1,status:'unmounted',issuer:t.auth.issuer,jwksUrl:t.auth.jwksUrl,audience:t.auth.audience,
  namespace:t.auth.namespace,taskQueue:t.auth.taskQueue,maxTokenLifetimeMs:60000,refreshMs:10000,
  issuerServiceTaskRoleArn:`arn:aws:iam::${account}:role/meri-temporal-issuer`,
  roles:{control:role('control'),temporalWorker:role('worker')}};
}
function projection(p,t){return Object.fromEntries(['control','temporalWorker'].map(role=>[role,{
 configSha256:p.materialDelivery[role].expected.sha256ByPath[`/run/meri/${role==='control'?'control':'worker'}.json`],
 address:`frontend.${t.privateDnsName}:7233`,namespace:t.auth.namespace,taskQueue:t.auth.taskQueue,
 tlsServerName:`frontend.${t.privateDnsName}`,tlsCaFile:'/run/meri/temporal-ca.pem',tlsCaSha256:'e'.repeat(64),
 issuer:t.auth.issuer,audience:t.auth.audience,tokenFile:'/run/meri/temporal-token.json',
 refreshMs:10000,maxLifetimeMs:60000}]));}

test('cross-template source join stays HOLD with exact SG, config, TLS and issuer pins',()=>{
 const p=product(),t=temporal(),input={productBinding:p,temporalBinding:t,runtimeProjection:projection(p,t),
  productSubnetReadback:{SubnetId:p.network.privateSubnetId,VpcId:'vpc-abcdef12',RouteTableId:'rtb-abcdef12'},
  issuerRenewal:renewal(t)};
 const receipt=inspectTemporalProductJoin(input);
 assert.equal(receipt.status,'HOLD');assert.equal(receipt.frontendAddress,'frontend.temporal.meri.internal:7233');
 for(const mutate of [
  x=>{x.productBinding.network.workerSecurityGroupId='sg-99999999';},
  x=>{x.productSubnetReadback.VpcId=x.temporalBinding.vpcId;},
  x=>{x.runtimeProjection.control.audience='other';},
  x=>{x.runtimeProjection.temporalWorker.tlsCaSha256='f'.repeat(64);},
  x=>{x.issuerRenewal.issuerServiceTaskRoleArn=x.productBinding.controlTaskRoleArn;},
  x=>{x.issuerRenewal.issuerServiceTaskRoleArn=x.productBinding.executionRoleArn;},
  x=>{x.issuerRenewal.roles.control.namespaceRole='worker';}
 ]){const copy=structuredClone(input);mutate(copy);assert.throws(()=>inspectTemporalProductJoin(copy),/TEMPORAL_PRODUCT_JOIN_REFUSED/u);}
});
