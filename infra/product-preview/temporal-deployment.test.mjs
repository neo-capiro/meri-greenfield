import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {synthesizeTemporalPreview} from './temporal-deployment.mjs';
import {TEMPORAL_ROLES,TEMPORAL_PORTS,validateTemporalFixture} from './temporal-binding.mjs';
import fixture from '../../apps/control/qualification-temporal/deployment.fixture.json' with {type:'json'};
import pins from '../../apps/control/qualification-temporal/component-pins.json' with {type:'json'};

const account='967807252336',region='us-east-1',sha='a'.repeat(64);
const rendererSha=createHash('sha256').update(readFileSync(new URL('./temporal-launch-render.mjs',import.meta.url))).digest('hex');
const version=(name,n)=>`arn:aws:secretsmanager:${region}:${account}:secret:meri/temporal/${name}-ABC123:::${String(n).repeat(32)}`;
function binding(){return {
 account,region,enabled:false,placement:{kind:'independent-meri-vpc',reviewSha256:sha},clusterArn:`arn:aws:ecs:${region}:${account}:cluster/meri-product-preview`,vpcId:'vpc-1234abcd',
 subnets:[{id:'subnet-1234abcd',availabilityZone:'us-east-1a'},{id:'subnet-abcd1234',availabilityZone:'us-east-1b'}],
 privateDnsName:'temporal.meri.internal',serverImageUri:`${account}.dkr.ecr.${region}.amazonaws.com/meri/temporal-server@sha256:${sha}`,
 upstreamServerImageDigest:pins.server.imageAmd64Digest,launchSourceCommit:'c'.repeat(40),launchContractSha256:rendererSha,logGroupName:'/meri/temporal-preview',
 executionRoleArn:`arn:aws:iam::${account}:role/meri-temporal-execution`,
 taskRoleArns:Object.fromEntries(TEMPORAL_ROLES.map((r,i)=>[r,`arn:aws:iam::${account}:role/meri-temporal-${i}`])),
 network:{clientSecurityGroupIds:['sg-11111111','sg-22222222'],issuerSecurityGroupId:'sg-33333333',endpointSecurityGroupIds:['sg-44444444'],migrationSecurityGroupId:'sg-55555555'},
 auth:{issuer:'https://issuer.meri.internal/',jwksUrl:'https://issuer.meri.internal/.well-known/jwks.json',issuerCaSha256:sha,audience:'meri-temporal',namespace:'meri',taskQueue:'meri-conversations',
  materialSecretVersionByRole:Object.fromEntries(TEMPORAL_ROLES.map((r,i)=>[r,version(r,i+1)]))},
 database:{kmsKeyArn:`arn:aws:kms:${region}:${account}:key/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,masterSecretVersionArn:version('master',6),
  masterUsername:'temporal_admin',primarySecretVersionArn:version('primary',7),visibilitySecretVersionArn:version('visibility',8),
  instanceClass:'db.m6g.large',storageGiB:100,backupDays:7,rdsCaSha256:sha,migrationPlanSha256:'b'.repeat(64)}
};}
const resources=(template,type)=>Object.values(template.Resources).filter(x=>x.Type===type).map(x=>x.Properties);
const task=(template,role)=>resources(template,'AWS::ECS::TaskDefinition').find(x=>x.Family===`meri-product-preview-temporal-${role}`);

test('fully bound synthesis emits five stopped private roles and one independent encrypted PG16 store',()=>{
 const b=binding(),t=synthesizeTemporalPreview(b);
 assert.equal(resources(t,'AWS::ECS::Service').length,5);
 assert.equal(resources(t,'AWS::ECS::TaskDefinition').length,5);
 assert.equal(resources(t,'AWS::ServiceDiscovery::PrivateDnsNamespace').length,1);
 assert.equal(resources(t,'AWS::ServiceDiscovery::Service').length,5);
 assert.equal(resources(t,'AWS::RDS::DBInstance').length,1);
 const db=resources(t,'AWS::RDS::DBInstance')[0];
 assert.equal(t.Outputs.TemporalFrontendAddress.Value,'frontend.temporal.meri.internal:7233');
 assert.equal(t.Outputs.TemporalNamespace.Value,'meri');assert.equal(t.Outputs.TemporalTaskQueue.Value,'meri-conversations');
 assert.equal(db.Engine,'postgres');assert.equal(db.EngineVersion,'16.15');assert.equal(db.DBName,'temporal');
 assert.equal(db.MultiAZ,true);assert.equal(db.StorageEncrypted,true);assert.equal(db.PubliclyAccessible,false);
 assert.equal(db.DeletionProtection,true);assert.equal(db.KmsKeyId,b.database.kmsKeyArn);
 assert.match(db.MasterUserPassword,/^\{\{resolve:secretsmanager:.*:SecretString:password::6{32}\}\}$/u);
 for(const s of resources(t,'AWS::ECS::Service')){
  assert.equal(s.DesiredCount,0);assert.equal(s.PlatformVersion,'1.4.0');assert.equal(s.EnableExecuteCommand,false);
  assert.equal(s.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp,'DISABLED');
  assert.deepEqual(s.NetworkConfiguration.AwsvpcConfiguration.Subnets,b.subnets.map(x=>x.id));
  assert.equal(s.ServiceRegistries.length,1);
 }
 for(const role of TEMPORAL_ROLES){
  const definition=task(t,role),container=definition.ContainerDefinitions[0];
  assert.equal(definition.ExecutionRoleArn,b.executionRoleArn);assert.equal(definition.TaskRoleArn,b.taskRoleArns[role]);
  assert.equal(container.Image,b.serverImageUri);assert.deepEqual(container.PortMappings.map(x=>x.ContainerPort),TEMPORAL_PORTS[role]);
  assert.deepEqual(container.EntryPoint,['/opt/meri/temporal-launch']);
  assert.equal(container.Privileged,false);assert.equal(container.ReadonlyRootFilesystem,true);
  assert.deepEqual(definition.Volumes.map(x=>x.Name),['rendered-config','tmp']);
  assert.deepEqual(container.MountPoints.map(x=>x.ContainerPath),['/run/temporal','/tmp']);
  assert.equal(container.Secrets.length,role==='frontend'?12:9);
  if(role!=='frontend')assert(!container.Secrets.some(x=>x.Name==='MERI_TEMPORAL_FRONTEND_KEY_PEM'));
  assert(container.Secrets.every(x=>x.ValueFrom.includes('::'+x.ValueFrom.slice(-32))));
  const env=Object.fromEntries(container.Environment.map(x=>[x.Name,x.Value]));
  assert.equal(env.NUM_HISTORY_SHARDS,'128');assert.equal(env.DB,'postgres12');assert.equal(env.SQL_HOST_VERIFICATION,'true');
  assert.equal(env.TEMPORAL_TLS_REQUIRE_CLIENT_AUTH,'true');assert.equal(env.TEMPORAL_AUTH_AUTHORIZER,'default');
  assert.equal(env.TEMPORAL_AUTH_CLAIM_MAPPER,'default');assert.equal(env.TEMPORAL_JWT_KEY_SOURCE1,b.auth.jwksUrl);
  assert.equal(env.TEMPORAL_JWT_KEY_REFRESH,'300s');assert.equal(env.MERI_TEMPORAL_RENDER_DIR,'/run/temporal');
  assert.equal(env.MERI_TEMPORAL_ACTIVATION,'disabled');assert.equal(env.MERI_TEMPORAL_SERVICE_NAME,role);
  assert.equal(env.USE_INTERNAL_FRONTEND,'true');assert.equal(env.TEMPORAL_NAMESPACE,'meri');
  assert.equal(env.TEMPORAL_TASK_QUEUE,'meri-conversations');
  assert.equal(Number(env.SQL_MAX_CONNS)+Number(env.SQL_VIS_MAX_CONNS),role==='history'?40:20);
 }
 assert.equal(JSON.stringify(t).includes('password":"'),false,'no plaintext credential in source template');
});

test('the exact reviewed fixture refuses changes to role and trust decisions',()=>{
 assert.equal(validateTemporalFixture(structuredClone(fixture)).roles['internal-worker'].temporalRole,'worker');
 for(const change of [
  x=>{x.roles['internal-worker'].temporalRole='frontend';},
  x=>{x.roles['internal-frontend'].ingress='external';},
  x=>{x.roles.frontend.mtls.requireClientAuth=false;},
  x=>{x.database.separateRoles=false;},
  x=>{x.trustedApplicationWorkers.namespaceRole='worker';},
  x=>{x.publicClientOverride=true;}
 ]){const copy=structuredClone(fixture);change(copy);assert.throws(()=>validateTemporalFixture(copy),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
});

test('network creates role-specific security groups with no unrestricted egress',()=>{
 const t=synthesizeTemporalPreview(binding()),groups=resources(t,'AWS::EC2::SecurityGroup');
 assert.equal(groups.length,6);
 const egress=resources(t,'AWS::EC2::SecurityGroupEgress');
 assert(egress.length>0);
 assert(!egress.some(x=>x.CidrIp==='0.0.0.0/0'||x.CidrIpv6==='::/0'));
 const ingress=resources(t,'AWS::EC2::SecurityGroupIngress');
 assert(ingress.some(x=>x.FromPort===5432&&x.ToPort===5432));
 assert(ingress.some(x=>x.FromPort===7233&&x.ToPort===7233));
 assert(!ingress.some(x=>x.CidrIp==='0.0.0.0/0'||x.CidrIpv6==='::/0'));
});

test('missing or contradictory authority and network inputs refuse before synthesis',()=>{
 const changes=[
  x=>{x.enabled=true;},x=>{delete x.enabled;},x=>{x.account='000000000000';},
  x=>{x.placement.kind='reuse-capiro-dev';},x=>{x.vpcId='vpc-0ac26cfac7ed972be';},
  x=>{x.subnets[1].availabilityZone=x.subnets[0].availabilityZone;},x=>{x.subnets=[x.subnets[0]];},
  x=>{x.serverImageUri=x.serverImageUri.replace('@sha256:','-mutable:');},
  x=>{x.upstreamServerImageDigest='sha256:'+sha;},x=>{x.launchSourceCommit='';},
  x=>{x.taskRoleArns.history=x.taskRoleArns.frontend;},x=>{x.taskRoleArns.matching=x.executionRoleArn;},
  x=>{x.auth.materialSecretVersionByRole.history=x.auth.materialSecretVersionByRole.frontend;},
  x=>{x.auth.materialSecretVersionByRole.frontend=x.auth.materialSecretVersionByRole.frontend.replace(/:::[^:]+$/u,'');},
  x=>{x.auth.issuer='http://issuer.meri.internal/';},x=>{x.auth.jwksUrl='https://foreign.internal/.well-known/jwks.json';},
  x=>{x.auth.audience='';},x=>{x.auth.namespace='default';},x=>{x.auth.taskQueue='';},
  x=>{x.database.primarySecretVersionArn=x.database.visibilitySecretVersionArn;},
  x=>{x.database.kmsKeyArn='';},x=>{x.database.backupDays=0;},x=>{x.database.rdsCaFile='';},
  x=>{x.network.issuerSecurityGroupId=x.network.clientSecurityGroupIds[0];},
  x=>{x.network.clientSecurityGroupIds.push('sg-66666666');},
  x=>{x.extra='unexpected';}
 ];
 for(const change of changes){const b=binding();change(b);assert.throws(()=>synthesizeTemporalPreview(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
});
