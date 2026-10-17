/** Closed, offline binding for the disabled self-hosted Temporal preview. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pins from '../../apps/control/qualification-temporal/component-pins.json' with {type:'json'};
import fixture from '../../apps/control/qualification-temporal/deployment.fixture.json' with {type:'json'};
import {TEMPORAL_MIGRATION_PLAN_SHA256} from './temporal-migration-plan.mjs';

export const TEMPORAL_ROLES=Object.freeze(['frontend','history','matching','internal-worker','internal-frontend']);
export const TEMPORAL_PORTS=Object.freeze({frontend:[7233,6933,7243],history:[7234,6934],matching:[7235,6935],'internal-worker':[7239,6939],'internal-frontend':[7236,6936,7246]});
export const TEMPORAL_ISSUER_PORT=8445;
export const TEMPORAL_INTERFACE_ENDPOINTS=Object.freeze({
 ecrApi:'com.amazonaws.us-east-1.ecr.api',ecrDkr:'com.amazonaws.us-east-1.ecr.dkr',
 secretsManager:'com.amazonaws.us-east-1.secretsmanager',logs:'com.amazonaws.us-east-1.logs',kms:'com.amazonaws.us-east-1.kms'
});
// Fresh 2026-10-16 jump-cli DescribeDBClusters metadata, no secret lookup.
// The parent fixed existing Aurora use; this source creates no database instance.
export const TEMPORAL_EXISTING_DATABASE=Object.freeze({
 kind:'existing-aurora-postgresql',
 clusterArn:'arn:aws:rds:us-east-1:967807252336:cluster:capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv',
 endpoint:'capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv.cluster-csryw28ai752.us-east-1.rds.amazonaws.com',
 port:5432,securityGroupId:'sg-059b4e4de0b1dcca5',databaseVpcId:'vpc-0ac26cfac7ed972be',
 engine:'aurora-postgresql',engineVersion:'16.11'
});
const fail=()=>{throw Error('TEMPORAL_PREVIEW_BINDING_REFUSED');};
const hex64=/^[a-f0-9]{64}$/u;
const id=/^[a-zA-Z0-9._-]{1,128}$/u;
// The complete candidate fixture is a custody input, including role mapping,
// internode ingress, TLS policy, store split and trusted-worker authority.
// A changed fixture needs a new source review rather than silently changing a task.
const REVIEWED_FIXTURE_SHA256='1a35abfec39323ac8298453620eeb113323f035c3e36f0af56171f0e58a6ec6c';
const RENDERER_SHA256=createHash('sha256').update(readFileSync(new URL('./temporal-launch-render.mjs',import.meta.url))).digest('hex');
export function validateTemporalFixture(value=fixture){
 if(createHash('sha256').update(JSON.stringify(value)).digest('hex')!==REVIEWED_FIXTURE_SHA256)fail();
 return value;
}
function closed(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
}
function distinct(values,count,pattern){
 if(!Array.isArray(values)||values.length<count||new Set(values).size!==values.length||values.some(x=>typeof x!=='string'||!pattern.test(x)))fail();
 return values;
}
function secret(value,account,region){
 const match=typeof value==='string'&&value.match(new RegExp(`^arn:aws:secretsmanager:${region}:${account}:secret:([A-Za-z0-9/_+=.@-]{1,512}):::([A-Za-z0-9-]{32,64})$`,'u'));
 if(!match)fail();return value;
}
const secretBase=value=>value.slice(0,value.lastIndexOf(':::'));
export function versionedSecretKey(secretVersionArn,key){
 const pos=secretVersionArn.lastIndexOf(':::');
 if(pos<0||!id.test(key))fail();
 return `${secretVersionArn.slice(0,pos)}:${key}::${secretVersionArn.slice(pos+3)}`;
}
/** Unique interface-endpoint SG IDs in first-seen order (one when shared). */
export function temporalEndpointSecurityGroupIds(network){
 return [...new Set(Object.values(network.interfaceEndpoints).map(value=>value.securityGroupId))];
}
export function validateTemporalPreviewBinding(value){
 validateTemporalFixture();
 const b=closed(value,['account','region','enabled','activation','placement','clusterArn','vpcId','subnets','privateDnsName','serverImageUri','upstreamServerImageDigest','launchSourceCommit','launchContractSha256','logGroupName','executionRoleArn','taskRoleArns','network','auth','database']);
 const placement=closed(b.placement,['kind','reviewSha256']);
 if(placement.kind!=='existing-capiro-dev-vpc'||!hex64.test(placement.reviewSha256)||
    b.vpcId!==TEMPORAL_EXISTING_DATABASE.databaseVpcId||
    b.clusterArn!=='arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev')fail();
 // The launcher refuses unless MERI_TEMPORAL_ACTIVATION is exactly 'approved'.
 // No default: the reviewed binding must state the value it renders.
 if(!['approved','disabled'].includes(b.activation))fail();
 if(b.account!=='967807252336'||b.region!=='us-east-1'||b.enabled!==false||
    !/^arn:aws:ecs:us-east-1:967807252336:cluster\/[a-zA-Z0-9_-]{1,255}$/u.test(b.clusterArn)||
    !/^vpc-[a-f0-9]{8,17}$/u.test(b.vpcId)||!/^([a-z0-9-]+\.)+[a-z]{2,}$/u.test(b.privateDnsName)||
    !new RegExp(`^${b.account}\\.dkr\\.ecr\\.${b.region}\\.amazonaws\\.com\\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$`,'u').test(b.serverImageUri)||
    b.upstreamServerImageDigest!==pins.server.imageAmd64Digest||b.serverImageUri.endsWith(b.upstreamServerImageDigest)||
    !/^[a-f0-9]{40}$/u.test(b.launchSourceCommit)||b.launchContractSha256!==RENDERER_SHA256||
    !/^\/[a-zA-Z0-9_./-]{1,511}$/u.test(b.logGroupName))fail();
 if(!Array.isArray(b.subnets)||b.subnets.length<2||b.subnets.length>3)fail();
 const subnets=b.subnets.map(x=>closed(x,['id','availabilityZone']));
 distinct(subnets.map(x=>x.id),2,/^subnet-[a-f0-9]{8,17}$/u);
 distinct(subnets.map(x=>x.availabilityZone),2,/^us-east-1[a-z]$/u);
 const roleArn=new RegExp(`^arn:aws:iam::${b.account}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`,'u');
 if(!roleArn.test(b.executionRoleArn))fail();
 closed(b.taskRoleArns,TEMPORAL_ROLES);
 for(const role of TEMPORAL_ROLES)if(!roleArn.test(b.taskRoleArns[role])||b.taskRoleArns[role]===b.executionRoleArn)fail();
 distinct(Object.values(b.taskRoleArns),5,roleArn);
 const n=closed(b.network,['clientSecurityGroupIds','issuerSecurityGroupId','issuerClientSecurityGroupId','dbClientSecurityGroupId',
  'interfaceEndpoints','s3Gateway','taskRouteTableBySubnet','migrationSecurityGroupId']);
 if(n.clientSecurityGroupIds?.length!==2)fail();
 distinct(n.clientSecurityGroupIds,2,/^sg-[a-f0-9]{8,17}$/u);
 closed(n.interfaceEndpoints,Object.keys(TEMPORAL_INTERFACE_ENDPOINTS));
 const endpoints=Object.values(n.interfaceEndpoints).map(value=>closed(value,['endpointId','securityGroupId']));
 distinct(endpoints.map(value=>value.endpointId),5,/^vpce-[a-f0-9]{8,17}$/u);
 // capiro-dev interface endpoints share one SG; endpoint SGs may equal each
 // other, never a client, issuer, marker, migration or database SG.
 if(endpoints.some(value=>typeof value.securityGroupId!=='string'||!/^sg-[a-f0-9]{8,17}$/u.test(value.securityGroupId)))fail();
 const endpointGroups=temporalEndpointSecurityGroupIds(n);
 closed(n.s3Gateway,['endpointId','prefixListId']);
 if(!/^vpce-[a-f0-9]{8,17}$/u.test(n.s3Gateway.endpointId)||
    !/^pl-[a-f0-9]{8,17}$/u.test(n.s3Gateway.prefixListId)||
    endpoints.some(value=>value.endpointId===n.s3Gateway.endpointId))fail();
 closed(n.taskRouteTableBySubnet,subnets.map(value=>value.id));
 if(Object.values(n.taskRouteTableBySubnet).some(value=>typeof value!=='string'||!/^rtb-[a-f0-9]{8,17}$/u.test(value)))fail();
 const ownGroups=[n.issuerSecurityGroupId,n.migrationSecurityGroupId,n.issuerClientSecurityGroupId,n.dbClientSecurityGroupId];
 if(!ownGroups.every(x=>typeof x==='string'&&/^sg-[a-f0-9]{8,17}$/u.test(x)))fail();
 distinct([...n.clientSecurityGroupIds,...endpointGroups,...ownGroups],n.clientSecurityGroupIds.length+endpointGroups.length+ownGroups.length,/^sg-[a-f0-9]{8,17}$/u);
 const a=closed(b.auth,['issuer','jwksUrl','issuerCaSha256','audience','namespace','taskQueue','materialSecretVersionByRole']);
 let issuer,jwks;try{issuer=new URL(a.issuer);jwks=new URL(a.jwksUrl);}catch{fail();}
 if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.search||issuer.hash||issuer.pathname!=='/'||
    issuer.port!==String(TEMPORAL_ISSUER_PORT)||a.issuer!==issuer.origin+'/'||!hex64.test(a.issuerCaSha256)||
    jwks.protocol!=='https:'||a.jwksUrl!==issuer.origin+'/.well-known/jwks.json'||
    a.audience!==fixture.roles.frontend.externalAudience||a.namespace!==fixture.namespaces.primary||!id.test(a.taskQueue))fail();
 closed(a.materialSecretVersionByRole,TEMPORAL_ROLES);
 for(const role of TEMPORAL_ROLES)secret(a.materialSecretVersionByRole[role],b.account,b.region);
 const roleSecretBases=Object.values(a.materialSecretVersionByRole).map(secretBase);
 distinct(roleSecretBases,5,/^arn:aws:secretsmanager:/u);
 const d=closed(b.database,[...Object.keys(TEMPORAL_EXISTING_DATABASE),'primaryDatabase','visibilityDatabase',
  'primarySecretVersionArn','primaryUsername','visibilitySecretVersionArn','visibilityUsername','rdsCaSha256','migrationPlanSha256','grantsSha256']);
 if(Object.entries(TEMPORAL_EXISTING_DATABASE).some(([key,value])=>d[key]!==value)||
    d.primaryDatabase!=='temporal'||d.visibilityDatabase!=='temporal_visibility'||
    ![d.primaryUsername,d.visibilityUsername].every(x=>typeof x==='string'&&/^[a-z][a-z0-9_]{0,62}$/u.test(x))||
    d.primaryUsername===d.visibilityUsername||
    !hex64.test(d.rdsCaSha256)||!hex64.test(d.grantsSha256)||d.migrationPlanSha256!==TEMPORAL_MIGRATION_PLAN_SHA256||
    [...n.clientSecurityGroupIds,...endpointGroups,...ownGroups].includes(d.securityGroupId))fail();
 for(const key of ['primarySecretVersionArn','visibilitySecretVersionArn'])secret(d[key],b.account,b.region);
 const dbSecretBases=[d.primarySecretVersionArn,d.visibilitySecretVersionArn].map(secretBase);
 distinct(dbSecretBases,2,/^arn:aws:secretsmanager:/u);
 distinct([...roleSecretBases,...dbSecretBases],7,/^arn:aws:secretsmanager:/u);
 if(pins.server.version!=='1.32.1'||pins.postgres.majorVersion!==16||pins.postgres.candidateMinorVersion!=='16.15'||pins.postgres.plugin!=='postgres12'||
    pins.postgres.schemaPrimaryVersion!=='1.19'||pins.postgres.schemaVisibilityVersion!=='1.14'||fixture.historyShards!==128||
    // Historical fixture remains checksum-pinned; its newResources/instance
    // placement is not deployment authority for the selected existing Aurora.
    fixture.roles.frontend.claimMapper!=='default'||fixture.roles.frontend.authorizer!=='default'||fixture.roles['internal-frontend'].ingress!=='internode'||
    TEMPORAL_ROLES.some(role=>fixture.roles[role]?.replicas!==2||fixture.roles[role]?.mtls?.requireClientAuth!==true||
      !Number.isSafeInteger(fixture.provisionalSizing?.perRole?.[role]?.dbConnections)||fixture.provisionalSizing.perRole[role].dbConnections<2||
      fixture.provisionalSizing.perRole[role].dbConnections%2!==0))fail();
 return b;
}
