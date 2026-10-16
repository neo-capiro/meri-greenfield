/** Source-only, stopped Temporal deployment. No AWS lookup or deployment is performed. */
import {App,Stack,CfnOutput,BootstraplessSynthesizer,RemovalPolicy,aws_ec2 as ec2,aws_rds as rds,aws_ecs as ecs,aws_servicediscovery as discovery} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import fixture from '../../apps/control/qualification-temporal/deployment.fixture.json' with {type:'json'};
import pins from '../../apps/control/qualification-temporal/component-pins.json' with {type:'json'};
import {TEMPORAL_ROLES,TEMPORAL_PORTS,validateTemporalPreviewBinding,versionedSecretKey} from './temporal-binding.mjs';

const env=(name,value)=>({name,value:String(value)});
const secret=(name,arn,key)=>({name,valueFrom:versionedSecretKey(arn,key)});
const roleName=role=>role.replaceAll('-','');
function masterPasswordReference(arn){
 const at=arn.lastIndexOf(':::');
 return `{{resolve:secretsmanager:${arn.slice(0,at)}:SecretString:password::${arn.slice(at+3)}}}`;
}
function security(stack,b,vpc){
 const groups=Object.fromEntries(TEMPORAL_ROLES.map(role=>[role,new ec2.SecurityGroup(stack,`${roleName(role)}Sg`,{vpc,allowAllOutbound:false,description:`Meri Temporal ${role} only`})]));
 const db=new ec2.SecurityGroup(stack,'temporalDbSg',{vpc,allowAllOutbound:false,description:'Meri Temporal PostgreSQL only'});
 const clients=b.network.clientSecurityGroupIds.map((id,i)=>ec2.SecurityGroup.fromSecurityGroupId(stack,`temporalClient${i}`,id,{mutable:false}));
 const endpoints=b.network.endpointSecurityGroupIds.map((id,i)=>ec2.SecurityGroup.fromSecurityGroupId(stack,`temporalEndpoint${i}`,id,{mutable:false}));
 const issuer=ec2.SecurityGroup.fromSecurityGroupId(stack,'temporalIssuer',b.network.issuerSecurityGroupId,{mutable:false});
 const migration=ec2.SecurityGroup.fromSecurityGroupId(stack,'temporalMigration',b.network.migrationSecurityGroupId,{mutable:false});
 for(const role of TEMPORAL_ROLES){
  const group=groups[role];
  for(const [peer,other] of Object.entries(groups))for(const port of TEMPORAL_PORTS[peer])group.addEgressRule(other,ec2.Port.tcp(port),`Temporal ${peer} RPC or membership`);
  group.addEgressRule(db,ec2.Port.tcp(5432),'dedicated Temporal database');
  for(const endpoint of endpoints)group.addEgressRule(endpoint,ec2.Port.tcp(443),'reviewed AWS image/secret/log endpoint');
  group.addEgressRule(issuer,ec2.Port.tcp(443),'dedicated JWKS issuer');
  db.addIngressRule(group,ec2.Port.tcp(5432),`Temporal ${role} store access`);
  for(const port of TEMPORAL_PORTS[role])for(const other of Object.values(groups))group.addIngressRule(other,ec2.Port.tcp(port),'Temporal internode only');
 }
 for(const client of clients)groups.frontend.addIngressRule(client,ec2.Port.tcp(7233),'authenticated application client only');
 db.addIngressRule(migration,ec2.Port.tcp(5432),'separate ordered schema migration principal');
 return {groups,db};
}
function database(stack,b,sg){
 const subnetGroup=new rds.CfnDBSubnetGroup(stack,'temporalDbSubnets',{dbSubnetGroupDescription:'dedicated Meri Temporal private AZs',subnetIds:b.subnets.map(s=>s.id)});
 const d=b.database;
 const instance=new rds.CfnDBInstance(stack,'temporalDatabase',{
  dbInstanceIdentifier:'meri-product-preview-temporal',engine:'postgres',engineVersion:pins.postgres.candidateMinorVersion,
  dbInstanceClass:d.instanceClass,dbName:'temporal',masterUsername:d.masterUsername,masterUserPassword:masterPasswordReference(d.masterSecretVersionArn),
  allocatedStorage:String(d.storageGiB),storageType:'gp3',storageEncrypted:true,kmsKeyId:d.kmsKeyArn,multiAz:true,
  dbSubnetGroupName:subnetGroup.ref,vpcSecurityGroups:[sg.securityGroupId],publiclyAccessible:false,port:'5432',
  backupRetentionPeriod:d.backupDays,copyTagsToSnapshot:true,deletionProtection:true,autoMinorVersionUpgrade:false,
  enableIamDatabaseAuthentication:false
 });
 instance.applyRemovalPolicy(RemovalPolicy.RETAIN,{applyToUpdateReplacePolicy:true});
 return instance;
}
function roleSecrets(b,role){
 const material=b.auth.materialSecretVersionByRole[role],d=b.database;
 const result=[
  secret('POSTGRES_USER',d.primarySecretVersionArn,'username'),secret('POSTGRES_PWD',d.primarySecretVersionArn,'password'),
  secret('VISIBILITY_POSTGRES_USER',d.visibilitySecretVersionArn,'username'),secret('VISIBILITY_POSTGRES_PWD',d.visibilitySecretVersionArn,'password'),
  secret('MERI_TEMPORAL_INTERNODE_CERT_PEM',material,'internodeCert'),secret('MERI_TEMPORAL_INTERNODE_KEY_PEM',material,'internodeKey'),
  secret('MERI_TEMPORAL_INTERNODE_CA_PEM',material,'internodeCa'),secret('MERI_TEMPORAL_FRONTEND_CA_PEM',material,'frontendCa'),
  secret('MERI_TEMPORAL_RDS_CA_PEM',material,'rdsCa')
 ];
 if(role==='frontend')result.push(
  secret('MERI_TEMPORAL_FRONTEND_CERT_PEM',material,'frontendCert'),
  secret('MERI_TEMPORAL_FRONTEND_KEY_PEM',material,'frontendKey'),
  secret('MERI_TEMPORAL_CLIENT_CA_PEM',material,'clientCa')
 );
 return result;
}
function roleEnvironment(b,db,role){
 const host=db.attrEndpointAddress,auth=b.auth,d=b.database;
 const perStoreConnections=fixture.provisionalSizing.perRole[role].dbConnections/2;
 return [env('MERI_TEMPORAL_PREVIEW_REQUIRED','1'),env('MERI_TEMPORAL_ACTIVATION','disabled'),
  env('MERI_TEMPORAL_SERVICE_NAME',role),env('MERI_TEMPORAL_RENDER_DIR','/run/temporal'),env('MERI_TEMPORAL_LAUNCH_CONTRACT_SHA256',b.launchContractSha256),
  env('MERI_TEMPORAL_LAUNCH_SOURCE_COMMIT',b.launchSourceCommit),env('MERI_TEMPORAL_UPSTREAM_IMAGE_DIGEST',b.upstreamServerImageDigest),
  env('MERI_TEMPORAL_RDS_CA_SHA256',d.rdsCaSha256),env('MERI_TEMPORAL_ISSUER_CA_SHA256',auth.issuerCaSha256),
  env('MERI_TEMPORAL_MIGRATION_PLAN_SHA256',d.migrationPlanSha256),
  env('MERI_TEMPORAL_ROLE',fixture.roles[role].temporalRole),env('DB','postgres12'),env('DB_PORT','5432'),
  env('DBNAME','temporal'),env('VISIBILITY_DBNAME','temporal_visibility'),env('POSTGRES_SEEDS',host),env('VISIBILITY_POSTGRES_SEEDS',host),
  env('SQL_MAX_CONNS',perStoreConnections),env('SQL_MAX_IDLE_CONNS',perStoreConnections),
  env('SQL_VIS_MAX_CONNS',perStoreConnections),env('SQL_VIS_MAX_IDLE_CONNS',perStoreConnections),
  env('NUM_HISTORY_SHARDS',fixture.historyShards),env('SQL_TLS_ENABLED','true'),env('SQL_HOST_VERIFICATION','true'),
  env('SQL_HOST_NAME',host),env('TEMPORAL_TLS_REQUIRE_CLIENT_AUTH','true'),
  env('TEMPORAL_TLS_INTERNODE_DISABLE_HOST_VERIFICATION','false'),env('TEMPORAL_TLS_FRONTEND_DISABLE_HOST_VERIFICATION','false'),
  env('TEMPORAL_AUTH_AUTHORIZER','default'),env('TEMPORAL_AUTH_CLAIM_MAPPER','default'),env('TEMPORAL_JWT_KEY_SOURCE1',auth.jwksUrl),
  env('TEMPORAL_JWT_KEY_REFRESH',`${fixture.roles.frontend.keyRefreshSeconds}s`),env('TEMPORAL_AUTH_AUDIENCE',auth.audience),env('TEMPORAL_AUTH_ISSUER',auth.issuer),
  env('USE_INTERNAL_FRONTEND','true'),env('BIND_ON_IP','0.0.0.0'),env('TEMPORAL_NAMESPACE',auth.namespace),env('TEMPORAL_TASK_QUEUE',auth.taskQueue),
  env('TEMPORAL_TLS_INTERNODE_SERVER_NAME',`internode.${b.privateDnsName}`),
  env('TEMPORAL_TLS_FRONTEND_SERVER_NAME',`frontend.${b.privateDnsName}`)];
}
function roleResources(stack,b,db,groups,namespace,role){
 const source=fixture.provisionalSizing.perRole[role];
 const cpu=Number.parseInt(source.cpu,10)*1024,mem=Number.parseInt(source.memory,10);
 const task=new ecs.CfnTaskDefinition(stack,`${roleName(role)}Task`,{
  family:`meri-product-preview-temporal-${role}`,networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],
  cpu:String(cpu),memory:String(mem),runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},
  executionRoleArn:b.executionRoleArn,taskRoleArn:b.taskRoleArns[role],volumes:[{name:'rendered-config'},{name:'tmp'}],
  containerDefinitions:[{name:role,image:b.serverImageUri,essential:true,readonlyRootFilesystem:true,privileged:false,
   entryPoint:['/opt/meri/temporal-launch'],command:[fixture.roles[role].temporalRole],
   environment:roleEnvironment(b,db,role),secrets:roleSecrets(b,role),
   mountPoints:[{sourceVolume:'rendered-config',containerPath:'/run/temporal',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],
   portMappings:TEMPORAL_PORTS[role].map(containerPort=>({containerPort,protocol:'tcp'})),
   logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':b.logGroupName,'awslogs-region':b.region,'awslogs-stream-prefix':`temporal-${role}`,'mode':'blocking'}}}]
 });
 const registry=new discovery.CfnService(stack,`${roleName(role)}Discovery`,{
  name:role,namespaceId:namespace.attrId,dnsConfig:{namespaceId:namespace.attrId,dnsRecords:[{type:'A',ttl:10}],routingPolicy:'MULTIVALUE'},
  healthCheckCustomConfig:{failureThreshold:1}
 });
 new ecs.CfnService(stack,`${roleName(role)}Service`,{serviceName:`meri-product-preview-temporal-${role}`,cluster:b.clusterArn,
  taskDefinition:task.ref,desiredCount:0,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,
  networkConfiguration:{awsvpcConfiguration:{subnets:b.subnets.map(s=>s.id),securityGroups:[groups[role].securityGroupId],assignPublicIp:'DISABLED'}},
  serviceRegistries:[{registryArn:registry.attrArn}]
 });
}
/** Synthesizes CloudFormation JSON only. Never looks up, creates, starts, migrates, or contacts AWS. */
export function synthesizeTemporalPreview(binding){
 const b=validateTemporalPreviewBinding(binding);
 const app=new App({context:{'aws:cdk:version-reporting':false}});
 const stack=new Stack(app,'MeriTemporalPreview',{env:{account:b.account,region:b.region},synthesizer:new BootstraplessSynthesizer()});
 const vpc=ec2.Vpc.fromVpcAttributes(stack,'temporalVpc',{vpcId:b.vpcId,availabilityZones:b.subnets.map(s=>s.availabilityZone),privateSubnetIds:b.subnets.map(s=>s.id)});
 const {groups,db:dbSg}=security(stack,b,vpc),db=database(stack,b,dbSg);
 const namespace=new discovery.CfnPrivateDnsNamespace(stack,'temporalNamespace',{name:b.privateDnsName,vpc:b.vpcId});
 for(const role of TEMPORAL_ROLES)roleResources(stack,b,db,groups,namespace,role);
 new CfnOutput(stack,'TemporalFrontendAddress',{value:`frontend.${b.privateDnsName}:7233`});
 new CfnOutput(stack,'TemporalNamespace',{value:b.auth.namespace});
 new CfnOutput(stack,'TemporalTaskQueue',{value:b.auth.taskQueue});
 new CfnOutput(stack,'TemporalDatabaseEndpoint',{value:db.attrEndpointAddress});
 return Template.fromStack(stack).toJSON();
}
