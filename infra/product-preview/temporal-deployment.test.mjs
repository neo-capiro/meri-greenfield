import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {synthesizeTemporalPreview} from './temporal-deployment.mjs';
import {TEMPORAL_ROLES,TEMPORAL_PORTS,TEMPORAL_INTERFACE_ENDPOINTS,TEMPORAL_EXISTING_DATABASE,temporalEndpointSecurityGroupIds,validateTemporalFixture,validateTemporalPreviewBinding} from './temporal-binding.mjs';
import {TEMPORAL_MIGRATION_PLAN,TEMPORAL_MIGRATION_PLAN_SHA256} from './temporal-migration-plan.mjs';
import {validateTemporalNetworkReadback} from './temporal-network-readback.mjs';
import {validateTemporalIssuerRenewal} from './temporal-issuer-renewal.mjs';
import fixture from '../../apps/control/qualification-temporal/deployment.fixture.json' with {type:'json'};
import pins from '../../apps/control/qualification-temporal/component-pins.json' with {type:'json'};

const account='967807252336',region='us-east-1',sha='a'.repeat(64);
const rendererSha=createHash('sha256').update(readFileSync(new URL('./temporal-launch-render.mjs',import.meta.url))).digest('hex');
const version=(name,n)=>`arn:aws:secretsmanager:${region}:${account}:secret:meri/temporal/${name}-ABC123:::${String(n).repeat(32)}`;
function binding(){return {
 account,region,enabled:false,activation:'disabled',placement:{kind:'existing-capiro-dev-vpc',reviewSha256:sha},clusterArn:`arn:aws:ecs:${region}:${account}:cluster/capiro-dev`,vpcId:'vpc-0ac26cfac7ed972be',
 subnets:[{id:'subnet-1234abcd',availabilityZone:'us-east-1a'},{id:'subnet-abcd1234',availabilityZone:'us-east-1b'}],
 privateDnsName:'temporal.meri.internal',serverImageUri:`${account}.dkr.ecr.${region}.amazonaws.com/meri/temporal-server@sha256:${sha}`,
 upstreamServerImageDigest:pins.server.imageAmd64Digest,launchSourceCommit:'c'.repeat(40),launchContractSha256:rendererSha,logGroupName:'/meri/temporal-preview',
 executionRoleArn:`arn:aws:iam::${account}:role/meri-temporal-execution`,
 taskRoleArns:Object.fromEntries(TEMPORAL_ROLES.map((r,i)=>[r,`arn:aws:iam::${account}:role/meri-temporal-${i}`])),
 network:{clientSecurityGroupIds:['sg-11111111','sg-22222222'],issuerSecurityGroupId:'sg-33333333',
  interfaceEndpoints:Object.fromEntries(Object.keys(TEMPORAL_INTERFACE_ENDPOINTS).map((name,i)=>[name,{endpointId:`vpce-${String(i+1).repeat(8)}`,securityGroupId:`sg-${String(i+4).repeat(8)}`}])) ,
  s3Gateway:{endpointId:'vpce-99999999',prefixListId:'pl-11111111'},
  taskRouteTableBySubnet:{'subnet-1234abcd':'rtb-11111111','subnet-abcd1234':'rtb-22222222'},
  migrationSecurityGroupId:'sg-aaaaaaaa',issuerClientSecurityGroupId:'sg-bbbbbbbb',dbClientSecurityGroupId:'sg-cccccccc'},
 auth:{issuer:'https://issuer.meri.internal:8445/',jwksUrl:'https://issuer.meri.internal:8445/.well-known/jwks.json',issuerCaSha256:sha,audience:'meri-temporal',namespace:'meri',taskQueue:'meri-conversations',
  materialSecretVersionByRole:Object.fromEntries(TEMPORAL_ROLES.map((r,i)=>[r,version(r,i+1)]))},
 database:{...TEMPORAL_EXISTING_DATABASE,primaryDatabase:'temporal',visibilityDatabase:'temporal_visibility',
  primarySecretVersionArn:version('primary',7),primaryUsername:'temporal_primary',
  visibilitySecretVersionArn:version('visibility',8),visibilityUsername:'temporal_visibility',
  rdsCaSha256:sha,migrationPlanSha256:TEMPORAL_MIGRATION_PLAN_SHA256,grantsSha256:sha}
};}
const resources=(template,type)=>Object.values(template.Resources).filter(x=>x.Type===type).map(x=>x.Properties);
const task=(template,role)=>resources(template,'AWS::ECS::TaskDefinition').find(x=>x.Family===`meri-product-preview-temporal-${role}`);

test('fully bound synthesis emits five stopped private roles using the approved existing Aurora endpoint',()=>{
 const b=binding(),t=synthesizeTemporalPreview(b);
 assert.equal(resources(t,'AWS::ECS::Service').length,5);
 assert.equal(resources(t,'AWS::ECS::TaskDefinition').length,5);
 assert.equal(resources(t,'AWS::ServiceDiscovery::PrivateDnsNamespace').length,1);
 assert.equal(resources(t,'AWS::ServiceDiscovery::Service').length,5);
 assert.equal(resources(t,'AWS::RDS::DBInstance').length,0);
 assert.equal(resources(t,'AWS::RDS::DBCluster').length,0);
 assert.equal(resources(t,'AWS::RDS::DBSubnetGroup').length,0);
 assert.equal(t.Outputs.TemporalFrontendAddress.Value,'frontend.temporal.meri.internal:7233');
 assert.equal(t.Outputs.TemporalNamespace.Value,'meri');assert.equal(t.Outputs.TemporalTaskQueue.Value,'meri-conversations');
 assert.equal(t.Outputs.TemporalDatabaseEndpoint.Value,b.database.endpoint);
 assert.equal(t.Outputs.TemporalDatabaseClusterArn.Value,b.database.clusterArn);
 assert.equal(JSON.stringify(t).includes('MasterUser'),false);
 assert.equal(JSON.stringify(t).includes('resolve:secretsmanager'),false);
 for(const s of resources(t,'AWS::ECS::Service')){
  assert.equal(s.Cluster,'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev');
  assert.equal(s.DesiredCount,0);assert.equal(s.PlatformVersion,'1.4.0');assert.equal(s.EnableExecuteCommand,false);
  assert.equal(s.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp,'DISABLED');
  assert.deepEqual(s.NetworkConfiguration.AwsvpcConfiguration.Subnets,b.subnets.map(x=>x.id));
  assert.equal(s.ServiceRegistries.length,1);
  assert.equal(s.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups.length,3);
  assert.deepEqual(s.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups.slice(1),
   [b.network.issuerClientSecurityGroupId,b.network.dbClientSecurityGroupId]);
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
  assert.equal(env.TEMPORAL_AUTH_ISSUER,'https://issuer.meri.internal:8445/');
  assert.equal(env.TEMPORAL_JWT_KEY_REFRESH,'300s');assert.equal(env.MERI_TEMPORAL_RENDER_DIR,'/run/temporal');
  assert.equal(env.MERI_TEMPORAL_ACTIVATION,'disabled');assert.equal(env.MERI_TEMPORAL_SERVICE_NAME,role);
  assert.equal(env.MERI_TEMPORAL_PRIMARY_USERNAME_EXPECTED,b.database.primaryUsername);
  assert.equal(env.MERI_TEMPORAL_VISIBILITY_USERNAME_EXPECTED,b.database.visibilityUsername);
  assert.equal(env.MERI_TEMPORAL_DB_GRANTS_SHA256,b.database.grantsSha256);
  assert.equal(env.POSTGRES_SEEDS,b.database.endpoint);assert.equal(env.VISIBILITY_POSTGRES_SEEDS,b.database.endpoint);
  assert.equal(env.SQL_HOST_NAME,b.database.endpoint);assert.equal(env.DB_PORT,'5432');
  assert.equal(env.DBNAME,'temporal');assert.equal(env.VISIBILITY_DBNAME,'temporal_visibility');
  assert.equal(env.USE_INTERNAL_FRONTEND,'true');assert.equal(env.TEMPORAL_NAMESPACE,'meri');
  assert.equal(env.TEMPORAL_TASK_QUEUE,'meri-conversations');
  assert.equal(Number(env.SQL_MAX_CONNS)+Number(env.SQL_VIS_MAX_CONNS),role==='history'?40:20);
 }
 assert.equal(JSON.stringify(t).includes('password":"'),false,'no plaintext credential in source template');
});

test('existing capiro-dev placement requires its exact VPC, cluster and closed review receipt while disabled',()=>{
 const b=binding();
 assert.equal(validateTemporalPreviewBinding(b),b);
 assert.equal(b.enabled,false);
 const t=synthesizeTemporalPreview(b);
 assert.equal(resources(t,'AWS::ServiceDiscovery::PrivateDnsNamespace')[0].Vpc,'vpc-0ac26cfac7ed972be');
 assert(resources(t,'AWS::EC2::SecurityGroup').every(group=>group.VpcId==='vpc-0ac26cfac7ed972be'));
 for(const mutate of [
  x=>{x.placement.kind='independent-meri-vpc';},
  x=>{x.vpcId='vpc-1234abcd';},
  x=>{x.clusterArn=`arn:aws:ecs:${region}:${account}:cluster/meri-product-preview`;},
  x=>{delete x.placement;},x=>{delete x.placement.reviewSha256;},
  x=>{x.placement.reviewSha256='';},x=>{x.placement.reviewSha256='not-a-review-receipt';},
  x=>{x.placement.approved=true;},x=>{delete x.enabled;},x=>{x.enabled=true;}
 ]){const copy=structuredClone(b);mutate(copy);assert.throws(()=>synthesizeTemporalPreview(copy),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
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

test('migration plan binds the pinned ordered source stages without running SQL',()=>{
 assert.equal(TEMPORAL_MIGRATION_PLAN.serverImageAmd64Digest,pins.server.imageAmd64Digest);
 assert.equal(TEMPORAL_MIGRATION_PLAN.adminToolsImageAmd64Digest,pins.adminTools.imageAmd64Digest);
 assert.equal(TEMPORAL_MIGRATION_PLAN.isolatedQualificationPostgresVersion,pins.postgres.candidateMinorVersion);
 assert.equal(TEMPORAL_MIGRATION_PLAN.databaseKind,'existing-aurora-postgresql');
 assert.equal(TEMPORAL_MIGRATION_PLAN.observedEngineVersion,TEMPORAL_EXISTING_DATABASE.engineVersion);
 assert.equal(TEMPORAL_MIGRATION_PLAN.stages[0].action,'verify-existing-cluster-and-dedicated-database-owners');
 assert.equal(TEMPORAL_MIGRATION_PLAN.stages[1].action,'verify-dedicated-empty-or-exact-retained-schemas');
 assert.equal(TEMPORAL_MIGRATION_PLAN.stages[2].targetVersion,pins.postgres.schemaPrimaryVersion);
 assert.equal(TEMPORAL_MIGRATION_PLAN.stages[3].targetVersion,pins.postgres.schemaVisibilityVersion);
 assert.deepEqual(TEMPORAL_MIGRATION_PLAN.stages.map(x=>x.order),[1,2,3,4,5,6]);
 assert.equal(createHash('sha256').update(JSON.stringify(TEMPORAL_MIGRATION_PLAN),'utf8').digest('hex'),TEMPORAL_MIGRATION_PLAN_SHA256);
 const b=binding();b.database.migrationPlanSha256='b'.repeat(64);
 assert.throws(()=>synthesizeTemporalPreview(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);
});

test('network creates role-specific security groups with no unrestricted egress',()=>{
 const b=binding(),t=synthesizeTemporalPreview(b),groups=resources(t,'AWS::EC2::SecurityGroup');
 assert.equal(groups.length,5);
 const egress=resources(t,'AWS::EC2::SecurityGroupEgress');
 assert(egress.length>0);
 const issuerEgress=egress.filter(x=>x.DestinationSecurityGroupId===b.network.issuerSecurityGroupId);
 assert.equal(issuerEgress.length,5);
 assert(issuerEgress.every(x=>x.FromPort===8445&&x.ToPort===8445&&x.IpProtocol==='tcp'));
 const endpointIds=Object.values(b.network.interfaceEndpoints).map(x=>x.securityGroupId);
 const endpointEgress=egress.filter(x=>endpointIds.includes(x.DestinationSecurityGroupId));
 assert.equal(endpointEgress.length,25);
 assert(endpointEgress.every(x=>x.FromPort===443&&x.ToPort===443&&x.IpProtocol==='tcp'));
 assert(egress.some(x=>x.DestinationPrefixListId==='pl-11111111'&&x.FromPort===443));
 assert(!egress.some(x=>x.CidrIp==='0.0.0.0/0'||x.CidrIpv6==='::/0'));
 const ingress=resources(t,'AWS::EC2::SecurityGroupIngress');
 // Aurora and issuer ingress are foundation-owned via the dbClient/issuerClient markers.
 assert.equal(ingress.filter(x=>x.FromPort===5432||x.ToPort===5432).length,0);
 assert(!ingress.some(x=>[TEMPORAL_EXISTING_DATABASE.securityGroupId,b.network.issuerSecurityGroupId].includes(x.GroupId)));
 const dbEgress=egress.filter(x=>x.DestinationSecurityGroupId===TEMPORAL_EXISTING_DATABASE.securityGroupId);
 assert.equal(dbEgress.length,5);
 assert(dbEgress.every(x=>x.FromPort===5432&&x.ToPort===5432&&x.IpProtocol==='tcp'));
 assert(!groups.some(x=>x.GroupDescription==='Meri Temporal PostgreSQL only'));
 assert(ingress.some(x=>x.FromPort===7233&&x.ToPort===7233));
 assert(!ingress.some(x=>x.CidrIp==='0.0.0.0/0'||x.CidrIpv6==='::/0'));
});

test('issuer binding requires exact 8445 HTTPS issuer and same-origin fixed JWKS path',()=>{
 assert.equal(validateTemporalPreviewBinding(binding()).auth.issuer,'https://issuer.meri.internal:8445/');
 for(const suffix of ['',':443',':8443',':8446',':08445']){
  const b=binding();b.auth.issuer=`https://issuer.meri.internal${suffix}/`;
  b.auth.jwksUrl=`https://issuer.meri.internal${suffix}/.well-known/jwks.json`;
  assert.throws(()=>validateTemporalPreviewBinding(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);
 }
 for(const mutate of [
  x=>{x.auth.issuer='https://issuer.meri.internal:8445';},
  x=>{x.auth.issuer='https://issuer.meri.internal:8445/?extra=1';},
  x=>{x.auth.jwksUrl='https://issuer.meri.internal/.well-known/jwks.json';},
  x=>{x.auth.jwksUrl='https://issuer.meri.internal:8445/other';},
  x=>{x.auth.jwksUrl='https://user@issuer.meri.internal:8445/.well-known/jwks.json';},
  x=>{x.auth.jwksUrl='https://issuer.meri.internal:8445/.well-known/jwks.json?extra=1';}
 ]){const b=binding();mutate(b);assert.throws(()=>validateTemporalPreviewBinding(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
});

test('offline network readback joins exact private ECR, Logs, Secrets, KMS and S3 paths',()=>{
 const b=binding(),n=b.network,routeIds=Object.values(n.taskRouteTableBySubnet);
 const evidence={schemaVersion:1,vpc:{VpcId:b.vpcId,IsDefault:false},
  subnets:b.subnets.map(x=>({SubnetId:x.id,VpcId:b.vpcId,AvailabilityZone:x.availabilityZone,
   MapPublicIpOnLaunch:false})),
  routeTables:routeIds.map((id,i)=>({RouteTableId:id,VpcId:b.vpcId,Associations:[{
   RouteTableId:id,SubnetId:b.subnets[i].id,Main:false,AssociationState:{State:'associated'}}],Routes:[
   {GatewayId:'local',State:'active'},
   {DestinationPrefixListId:n.s3Gateway.prefixListId,GatewayId:n.s3Gateway.endpointId,State:'active'}]})),
  interfaceEndpoints:Object.entries(n.interfaceEndpoints).map(([name,x])=>({VpcEndpointId:x.endpointId,VpcId:b.vpcId,
   ServiceName:TEMPORAL_INTERFACE_ENDPOINTS[name],VpcEndpointType:'Interface',State:'available',PrivateDnsEnabled:true,
   SubnetIds:b.subnets.map(y=>y.id),Groups:[{GroupId:x.securityGroupId}]})),
  s3Gateway:{VpcEndpointId:n.s3Gateway.endpointId,VpcId:b.vpcId,ServiceName:'com.amazonaws.us-east-1.s3',
   VpcEndpointType:'Gateway',State:'available',RouteTableIds:routeIds},
  securityGroups:[...temporalEndpointSecurityGroupIds(n),n.issuerSecurityGroupId,n.migrationSecurityGroupId,
   n.issuerClientSecurityGroupId,n.dbClientSecurityGroupId].map(id=>({GroupId:id,VpcId:b.vpcId}))};
 assert.match(validateTemporalNetworkReadback(b,evidence).readbackSha256,/^[a-f0-9]{64}$/u);
 for(const mutate of [
  x=>{x.routeTables[0].Routes[1].GatewayId='vpce-deadbeef';},
  x=>{x.routeTables[0].Associations[0].SubnetId='subnet-deadbeef';},
  x=>{x.routeTables[1].Routes.push({DestinationCidrBlock:'0.0.0.0/0',GatewayId:'igw-deadbeef'});},
  x=>{x.interfaceEndpoints[0].PrivateDnsEnabled=false;},
  x=>{x.interfaceEndpoints[1].ServiceName='com.amazonaws.us-east-1.ecr.api';},
  x=>{x.s3Gateway.RouteTableIds.pop();},
  x=>{x.subnets[0].MapPublicIpOnLaunch=true;},
  x=>{x.securityGroups[0].VpcId='vpc-deadbeef';}
 ]){const copy=structuredClone(evidence);mutate(copy);assert.throws(()=>validateTemporalNetworkReadback(b,copy),/TEMPORAL_NETWORK_READBACK_REFUSED/u);}
});

test('unmounted issuer renewal contract binds distinct write subjects to an external broker role',()=>{
 const b=binding(),a=b.auth,role=(name)=>({subject:`meri-temporal-${name}:v1`,namespaceRole:'write',
  tokenFile:'/run/meri-temporal/token.json',workloadPrincipal:`meri-workload-${name}:v1`,
  delivery:'task-local-atomic-owner-only-file'});
 const spec={schemaVersion:1,status:'unmounted',issuer:a.issuer,jwksUrl:a.jwksUrl,audience:a.audience,
  namespace:a.namespace,taskQueue:a.taskQueue,maxTokenLifetimeMs:60000,refreshMs:10000,
  issuerServiceTaskRoleArn:`arn:aws:iam::${account}:role/meri-temporal-issuer`,
  roles:{control:role('control'),temporalWorker:role('worker')}};
 assert.equal(validateTemporalIssuerRenewal(b,spec).status,'unmounted');
 for(const mutate of [
  x=>{x.status='active';},x=>{x.issuer='https://other.internal/';},
  x=>{x.roles.temporalWorker.subject=x.roles.control.subject;},
  x=>{x.roles.temporalWorker.workloadPrincipal=x.roles.control.workloadPrincipal;},
  x=>{x.issuerServiceTaskRoleArn=b.taskRoleArns.frontend;},
  x=>{x.roles.control.namespaceRole='worker';},
  x=>{x.roles.control.tokenFile='/run/meri/static-token.json';},
  x=>{x.roles.control.tokenFile='/run/meri/temporal-token.json';},
  x=>{x.maxTokenLifetimeMs=60001;},
  x=>{x.maxTokenLifetimeMs=86400000;}
 ]){const copy=structuredClone(spec);mutate(copy);assert.throws(()=>validateTemporalIssuerRenewal(b,copy),/TEMPORAL_ISSUER_RENEWAL_REFUSED/u);}
});

test('missing or contradictory authority and network inputs refuse before synthesis',()=>{
 const changes=[
  x=>{x.enabled=true;},x=>{delete x.enabled;},x=>{x.account='000000000000';},
  x=>{x.placement.kind='reuse-capiro-dev';},x=>{x.vpcId='vpc-1234abcd';},
  x=>{x.subnets[1].availabilityZone=x.subnets[0].availabilityZone;},x=>{x.subnets=[x.subnets[0]];},
  x=>{x.serverImageUri=x.serverImageUri.replace('@sha256:','-mutable:');},
  x=>{x.upstreamServerImageDigest='sha256:'+sha;},x=>{x.launchSourceCommit='';},
  x=>{x.taskRoleArns.history=x.taskRoleArns.frontend;},x=>{x.taskRoleArns.matching=x.executionRoleArn;},
  x=>{x.auth.materialSecretVersionByRole.history=x.auth.materialSecretVersionByRole.frontend;},
  x=>{x.auth.materialSecretVersionByRole.history=x.auth.materialSecretVersionByRole.frontend.replace(/[^:]+$/u,'9'.repeat(32));},
  x=>{x.auth.materialSecretVersionByRole.frontend=x.auth.materialSecretVersionByRole.frontend.replace(/:::[^:]+$/u,'');},
  x=>{x.auth.issuer='http://issuer.meri.internal/';},x=>{x.auth.jwksUrl='https://foreign.internal/.well-known/jwks.json';},
  x=>{x.auth.audience='';},x=>{x.auth.namespace='default';},x=>{x.auth.taskQueue='';},
  x=>{x.database.primarySecretVersionArn=x.database.visibilitySecretVersionArn;},
  x=>{x.database.primarySecretVersionArn=x.database.visibilitySecretVersionArn.replace(/[^:]+$/u,'9'.repeat(32));},
  x=>{x.database.primarySecretVersionArn=x.auth.materialSecretVersionByRole.frontend.replace(/[^:]+$/u,'9'.repeat(32));},
  x=>{x.database.visibilityUsername=x.database.primaryUsername;},
  x=>{x.database.masterSecretVersionArn=version('master',6);},
  x=>{x.database.instanceClass='db.m6g.large';},x=>{x.database.storageGiB=100;},
  x=>{x.database.backupDays=7;},x=>{x.database.kmsKeyArn='';},x=>{x.database.rdsCaFile='';},
  x=>{x.database.kind='new-rds-postgresql';},x=>{x.database.clusterArn=x.database.clusterArn+'-foreign';},
  x=>{x.database.endpoint=x.database.endpoint.replace('.cluster-','.cluster-ro-');},
  x=>{x.database.port=5433;},x=>{x.database.securityGroupId='sg-deadbeef';},
  x=>{x.database.databaseVpcId='vpc-deadbeef';},x=>{x.database.engine='postgres';},
  x=>{x.database.engineVersion='16.15';},x=>{x.database.primaryDatabase='capiro';},
  x=>{x.database.visibilityDatabase='temporal';},x=>{x.database.grantsSha256='';},
  x=>{x.network.issuerSecurityGroupId=x.network.clientSecurityGroupIds[0];},
  x=>{x.network.clientSecurityGroupIds.push('sg-66666666');},
  x=>{x.network.interfaceEndpoints.ecrDkr.endpointId=x.network.interfaceEndpoints.ecrApi.endpointId;},
  x=>{x.network.interfaceEndpoints.logs.securityGroupId=x.network.issuerSecurityGroupId;},
  x=>{x.network.interfaceEndpoints.logs.securityGroupId=x.network.clientSecurityGroupIds[0];},
  x=>{x.network.interfaceEndpoints.kms.securityGroupId=x.network.migrationSecurityGroupId;},
  x=>{x.network.interfaceEndpoints.kms.securityGroupId=x.network.issuerClientSecurityGroupId;},
  x=>{x.network.interfaceEndpoints.kms.securityGroupId=x.network.dbClientSecurityGroupId;},
  x=>{x.network.interfaceEndpoints.kms.securityGroupId=x.database.securityGroupId;},
  x=>{x.network.interfaceEndpoints.kms.securityGroupId='sg-unreviewed';},
  x=>{x.network.issuerClientSecurityGroupId=x.network.dbClientSecurityGroupId;},
  x=>{x.network.issuerClientSecurityGroupId=x.network.issuerSecurityGroupId;},
  x=>{x.network.dbClientSecurityGroupId=x.database.securityGroupId;},
  x=>{x.network.dbClientSecurityGroupId=x.network.clientSecurityGroupIds[1];},
  x=>{delete x.network.issuerClientSecurityGroupId;},x=>{delete x.network.dbClientSecurityGroupId;},
  x=>{x.network.dbClientSecurityGroupId='';},
  x=>{x.network.s3Gateway.prefixListId='';},
  x=>{delete x.network.taskRouteTableBySubnet['subnet-abcd1234'];},
  x=>{x.extra='unexpected';}
 ];
 for(const change of changes){const b=binding();change(b);assert.throws(()=>synthesizeTemporalPreview(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
});

test('activation is a required binding value rendered verbatim into every role',()=>{
 for(const activation of ['approved','disabled']){
  const b=binding();b.activation=activation;
  const t=synthesizeTemporalPreview(b);
  for(const role of TEMPORAL_ROLES){
   const env=Object.fromEntries(task(t,role).ContainerDefinitions[0].Environment.map(x=>[x.Name,x.Value]));
   assert.equal(env.MERI_TEMPORAL_ACTIVATION,activation);
  }
 }
 for(const mutate of [x=>{delete x.activation;},x=>{x.activation='';},x=>{x.activation='Approved';},
  x=>{x.activation=true;},x=>{x.activation=null;},x=>{x.activation='enabled';}]){
  const b=binding();mutate(b);assert.throws(()=>synthesizeTemporalPreview(b),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);
 }
});

// Live capiro-dev inventory, 17 Oct 2026: every interface endpoint shares one SG.
const CAPIRO_DEV_ENDPOINTS={ecrApi:'vpce-05d276fd4858f600c',ecrDkr:'vpce-066228cdabaad7a96',
 secretsManager:'vpce-0cfdca671c055b395',logs:'vpce-0cfc2d02372c83f41',kms:'vpce-0129a64c28f36072a'};
const SHARED_ENDPOINT_SG='sg-01def4e5c0fe44d4a';
function capiroDevBinding(){
 const b=binding();
 b.subnets=[{id:'subnet-0920665f91c905f01',availabilityZone:'us-east-1a'},{id:'subnet-0e38bd390f8961fef',availabilityZone:'us-east-1b'},
  {id:'subnet-06db79cd21239de19',availabilityZone:'us-east-1c'}];
 b.network.interfaceEndpoints=Object.fromEntries(Object.entries(CAPIRO_DEV_ENDPOINTS).map(([name,endpointId])=>[name,{endpointId,securityGroupId:SHARED_ENDPOINT_SG}]));
 b.network.s3Gateway={endpointId:'vpce-0cdaa6b79d616aa1c',prefixListId:'pl-63a5400a'};
 b.network.taskRouteTableBySubnet={'subnet-0920665f91c905f01':'rtb-11111111','subnet-0e38bd390f8961fef':'rtb-22222222','subnet-06db79cd21239de19':'rtb-33333333'};
 return b;
}
function readback(b){
 const n=b.network,routeIds=[...new Set(Object.values(n.taskRouteTableBySubnet))];
 return {schemaVersion:1,vpc:{VpcId:b.vpcId,IsDefault:false},
  subnets:b.subnets.map(x=>({SubnetId:x.id,VpcId:b.vpcId,AvailabilityZone:x.availabilityZone,MapPublicIpOnLaunch:false})),
  routeTables:routeIds.map(id=>({RouteTableId:id,VpcId:b.vpcId,Associations:b.subnets.filter(x=>n.taskRouteTableBySubnet[x.id]===id).map(x=>({
   RouteTableId:id,SubnetId:x.id,Main:false,AssociationState:{State:'associated'}})),Routes:[
   {GatewayId:'local',State:'active'},{DestinationPrefixListId:n.s3Gateway.prefixListId,GatewayId:n.s3Gateway.endpointId,State:'active'}]})),
  interfaceEndpoints:Object.entries(n.interfaceEndpoints).map(([name,x])=>({VpcEndpointId:x.endpointId,VpcId:b.vpcId,
   ServiceName:TEMPORAL_INTERFACE_ENDPOINTS[name],VpcEndpointType:'Interface',State:'available',PrivateDnsEnabled:true,
   SubnetIds:b.subnets.map(y=>y.id),Groups:[{GroupId:x.securityGroupId}]})),
  s3Gateway:{VpcEndpointId:n.s3Gateway.endpointId,VpcId:b.vpcId,ServiceName:'com.amazonaws.us-east-1.s3',
   VpcEndpointType:'Gateway',State:'available',RouteTableIds:routeIds},
  securityGroups:[...temporalEndpointSecurityGroupIds(n),n.issuerSecurityGroupId,n.migrationSecurityGroupId,
   n.issuerClientSecurityGroupId,n.dbClientSecurityGroupId].map(id=>({GroupId:id,VpcId:b.vpcId}))};
}

test('one shared capiro-dev endpoint SG binds, dedupes egress and still needs distinct endpoint IDs',()=>{
 const b=capiroDevBinding();
 assert.equal(validateTemporalPreviewBinding(b),b);
 assert.deepEqual(temporalEndpointSecurityGroupIds(b.network),[SHARED_ENDPOINT_SG]);
 const t=synthesizeTemporalPreview(b),egress=resources(t,'AWS::EC2::SecurityGroupEgress');
 const endpointEgress=egress.filter(x=>x.DestinationSecurityGroupId===SHARED_ENDPOINT_SG);
 assert.equal(endpointEgress.length,5,'one 443 rule per role SG, not five duplicates per role');
 assert(endpointEgress.every(x=>x.FromPort===443&&x.ToPort===443&&x.IpProtocol==='tcp'));
 assert.equal(new Set(endpointEgress.map(x=>JSON.stringify(x.GroupId))).size,5);
 assert.equal(egress.filter(x=>x.DestinationPrefixListId==='pl-63a5400a'&&x.FromPort===443).length,5);
 assert.equal(egress.filter(x=>x.DestinationSecurityGroupId===b.network.issuerSecurityGroupId&&x.FromPort===8445&&x.ToPort===8445).length,5);
 assert.equal(egress.filter(x=>x.DestinationSecurityGroupId===TEMPORAL_EXISTING_DATABASE.securityGroupId&&x.FromPort===5432).length,5);
 assert(!egress.some(x=>x.CidrIp==='0.0.0.0/0'||x.CidrIpv6==='::/0'||
  x.DestinationSecurityGroupId===b.network.issuerSecurityGroupId&&x.FromPort!==8445));
 for(const service of resources(t,'AWS::ECS::Service'))
  assert.deepEqual(service.NetworkConfiguration.AwsvpcConfiguration.Subnets,b.subnets.map(x=>x.id));
 for(const mutate of [
  x=>{x.network.interfaceEndpoints.logs.endpointId=x.network.interfaceEndpoints.kms.endpointId;},
  x=>{x.network.interfaceEndpoints.logs.securityGroupId=x.network.issuerSecurityGroupId;},
  x=>{x.network.issuerClientSecurityGroupId=SHARED_ENDPOINT_SG;},
  x=>{x.network.dbClientSecurityGroupId=SHARED_ENDPOINT_SG;},
  x=>{x.network.migrationSecurityGroupId=SHARED_ENDPOINT_SG;},
  x=>{x.network.clientSecurityGroupIds[0]=SHARED_ENDPOINT_SG;}
 ]){const copy=structuredClone(b);mutate(copy);assert.throws(()=>validateTemporalPreviewBinding(copy),/TEMPORAL_PREVIEW_BINDING_REFUSED/u);}
});

test('shared endpoint SG readback needs one SG row, exact service names and each endpoint on the bound group',()=>{
 const b=capiroDevBinding(),evidence=readback(b);
 assert.equal(evidence.securityGroups.length,5);
 assert.match(validateTemporalNetworkReadback(b,evidence).readbackSha256,/^[a-f0-9]{64}$/u);
 for(const mutate of [
  x=>{x.securityGroups.push({GroupId:SHARED_ENDPOINT_SG,VpcId:b.vpcId});},
  x=>{x.securityGroups=x.securityGroups.filter(g=>g.GroupId!==b.network.dbClientSecurityGroupId);},
  x=>{x.interfaceEndpoints[2].Groups=[{GroupId:'sg-0123456789abcdef0'}];},
  x=>{x.interfaceEndpoints[2].Groups.push({GroupId:b.network.issuerSecurityGroupId});},
  x=>{x.interfaceEndpoints[3].ServiceName='com.amazonaws.us-east-1.sts';},
  x=>{x.interfaceEndpoints[4].VpcEndpointId='vpce-079ecbeb9a17f6188';},
  x=>{x.interfaceEndpoints.pop();}
 ]){const copy=structuredClone(evidence);mutate(copy);assert.throws(()=>validateTemporalNetworkReadback(b,copy),/TEMPORAL_NETWORK_READBACK_REFUSED/u);}
});
