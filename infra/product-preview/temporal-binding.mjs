/** Closed, offline binding for the disabled self-hosted Temporal preview. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pins from '../../apps/control/qualification-temporal/component-pins.json' with {type:'json'};
import fixture from '../../apps/control/qualification-temporal/deployment.fixture.json' with {type:'json'};

export const TEMPORAL_ROLES=Object.freeze(['frontend','history','matching','internal-worker','internal-frontend']);
export const TEMPORAL_PORTS=Object.freeze({frontend:[7233,6933,7243],history:[7234,6934],matching:[7235,6935],'internal-worker':[7239,6939],'internal-frontend':[7236,6936,7246]});
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
export function versionedSecretKey(secretVersionArn,key){
 const pos=secretVersionArn.lastIndexOf(':::');
 if(pos<0||!id.test(key))fail();
 return `${secretVersionArn.slice(0,pos)}:${key}::${secretVersionArn.slice(pos+3)}`;
}
export function validateTemporalPreviewBinding(value){
 validateTemporalFixture();
 const b=closed(value,['account','region','enabled','placement','clusterArn','vpcId','subnets','privateDnsName','serverImageUri','upstreamServerImageDigest','launchSourceCommit','launchContractSha256','logGroupName','executionRoleArn','taskRoleArns','network','auth','database']);
 const placement=closed(b.placement,['kind','reviewSha256']);
 if(placement.kind!=='independent-meri-vpc'||!hex64.test(placement.reviewSha256)||b.vpcId==='vpc-0ac26cfac7ed972be')fail();
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
 const n=closed(b.network,['clientSecurityGroupIds','issuerSecurityGroupId','endpointSecurityGroupIds','migrationSecurityGroupId']);
 if(n.clientSecurityGroupIds?.length!==2)fail();
 distinct(n.clientSecurityGroupIds,2,/^sg-[a-f0-9]{8,17}$/u);
 distinct(n.endpointSecurityGroupIds,1,/^sg-[a-f0-9]{8,17}$/u);
 if(![n.issuerSecurityGroupId,n.migrationSecurityGroupId].every(x=>/^sg-[a-f0-9]{8,17}$/u.test(x))||
    new Set([...n.clientSecurityGroupIds,...n.endpointSecurityGroupIds,n.issuerSecurityGroupId,n.migrationSecurityGroupId]).size!==n.clientSecurityGroupIds.length+n.endpointSecurityGroupIds.length+2)fail();
 const a=closed(b.auth,['issuer','jwksUrl','issuerCaSha256','audience','namespace','taskQueue','materialSecretVersionByRole']);
 let issuer,jwks;try{issuer=new URL(a.issuer);jwks=new URL(a.jwksUrl);}catch{fail();}
 if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.search||issuer.hash||issuer.pathname!=='/'||!hex64.test(a.issuerCaSha256)||
    jwks.protocol!=='https:'||jwks.origin!==issuer.origin||jwks.pathname!=='/.well-known/jwks.json'||jwks.search||jwks.hash||
    a.audience!==fixture.roles.frontend.externalAudience||a.namespace!==fixture.namespaces.primary||!id.test(a.taskQueue))fail();
 closed(a.materialSecretVersionByRole,TEMPORAL_ROLES);
 for(const role of TEMPORAL_ROLES)secret(a.materialSecretVersionByRole[role],b.account,b.region);
 distinct(Object.values(a.materialSecretVersionByRole),5,/^arn:aws:secretsmanager:/u);
 const d=closed(b.database,['kmsKeyArn','masterSecretVersionArn','masterUsername','primarySecretVersionArn','visibilitySecretVersionArn','instanceClass','storageGiB','backupDays','rdsCaSha256','migrationPlanSha256']);
 if(!new RegExp(`^arn:aws:kms:${b.region}:${b.account}:key/[a-f0-9-]{36}$`,'u').test(d.kmsKeyArn)||
    !/^[a-z][a-z0-9_]{0,62}$/u.test(d.masterUsername)||!/^db\.[a-z0-9]+\.[a-z0-9]+$/u.test(d.instanceClass)||
    !Number.isInteger(d.storageGiB)||d.storageGiB<100||d.storageGiB>1000||!Number.isInteger(d.backupDays)||d.backupDays<7||d.backupDays>35||
    !hex64.test(d.rdsCaSha256)||!hex64.test(d.migrationPlanSha256))fail();
 for(const key of ['masterSecretVersionArn','primarySecretVersionArn','visibilitySecretVersionArn'])secret(d[key],b.account,b.region);
 distinct([d.masterSecretVersionArn,d.primarySecretVersionArn,d.visibilitySecretVersionArn],3,/^arn:aws:secretsmanager:/u);
 if(pins.server.version!=='1.32.1'||pins.postgres.majorVersion!==16||pins.postgres.candidateMinorVersion!=='16.15'||pins.postgres.plugin!=='postgres12'||
    pins.postgres.schemaPrimaryVersion!=='1.19'||pins.postgres.schemaVisibilityVersion!=='1.14'||fixture.historyShards!==128||
    fixture.database.newResources!==true||fixture.database.encrypted!==true||fixture.database.multiAz!==true||
    fixture.roles.frontend.claimMapper!=='default'||fixture.roles.frontend.authorizer!=='default'||fixture.roles['internal-frontend'].ingress!=='internode'||
    TEMPORAL_ROLES.some(role=>fixture.roles[role]?.replicas!==2||fixture.roles[role]?.mtls?.requireClientAuth!==true||
      !Number.isSafeInteger(fixture.provisionalSizing?.perRole?.[role]?.dbConnections)||fixture.provisionalSizing.perRole[role].dbConnections<2||
      fixture.provisionalSizing.perRole[role].dbConnections%2!==0))fail();
 return b;
}
