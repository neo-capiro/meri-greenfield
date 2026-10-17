/** Offline, disabled ECS preview source. Binding values come from a separately reviewed inventory. */
import {App, Stack, CfnOutput, BootstraplessSynthesizer, aws_ecs as ecs} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import {parseStaticProductMaterialExpected} from '../../apps/runtime/material-init.mjs';
import {createHash} from 'node:crypto';

const ACCOUNT='967807252336', REGION='us-east-1';
const hex64=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Error('PRODUCT_PREVIEW_BINDING_REFUSED');};
function record(value,required,optional=[]){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...required,...optional].includes(key)))fail();
 return value;
}
function sized(value){
 const v=record(value,['cpu','memoryMiB','ephemeralStorageGiB']);
 const allowed={256:[512,1024,2048],512:[1024,2048,3072,4096],1024:[2048,3072,4096,5120,6144,7168,8192],2048:[4096,5120,6144,7168,8192,9216,10240,11264,12288,13312,14336,15360,16384]};
 const memoryAllowed=allowed[v.cpu]?.includes(v.memoryMiB)||v.cpu===4096&&Number.isInteger(v.memoryMiB)&&v.memoryMiB>=8192&&v.memoryMiB<=30720&&v.memoryMiB%1024===0;
 if(!memoryAllowed||!Number.isInteger(v.ephemeralStorageGiB)||v.ephemeralStorageGiB<21||v.ephemeralStorageGiB>200)fail();
 return v;
}
function material(value,b){
 const m=record(value,['control','temporalWorker']);
 if(typeof b.sourceCommit!=='string'||!/^[a-f0-9]{40}$/u.test(b.sourceCommit))fail();
 const secretVersion=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}:::[A-Za-z0-9-]{32,64}$/u;
 for(const [role,spec] of Object.entries(m)){
  record(spec,['valueFrom','expected']);
  if(!secretVersion.test(spec.valueFrom))fail();
  let expected;try{expected=parseStaticProductMaterialExpected(spec.expected);}catch{fail();}
  if(Buffer.byteLength(JSON.stringify(expected),'utf8')>8192)fail();
  if(expected.role!==(role==='temporalWorker'?'temporal-worker':role)||expected.runtimeUser!==b.runtimeUser||
     expected.sourceCommit!==b.sourceCommit||expected.imageDigest!==`sha256:${b.imageUri.split('@sha256:')[1]}`)fail();
 }
 if(m.control.valueFrom===m.temporalWorker.valueFrom)fail();
 return m;
}
function poststart(value,b){
 const p=record(value,['controlOrigin','controlCaFile','controlCaBase64','controlCaSha256']);
 let u;try{u=new URL(p.controlOrigin);}catch{fail();}
 if(u.protocol!=='https:'||u.origin!==p.controlOrigin||u.pathname!=='/'||u.search||u.hash||u.username||u.password||
    !/^\/run\/meri\/[A-Za-z0-9._-]{1,128}$/u.test(p.controlCaFile)||
    typeof p.controlCaBase64!=='string'||p.controlCaBase64.length<4||p.controlCaBase64.length>21848||!hex64.test(p.controlCaSha256))fail();
 const ca=Buffer.from(p.controlCaBase64,'base64');
 if(ca.length<1||ca.length>16384||ca.toString('base64')!==p.controlCaBase64||
    createHash('sha256').update(ca).digest('hex')!==p.controlCaSha256||
    b.materialDelivery.control.expected.sha256ByPath[p.controlCaFile]!==p.controlCaSha256)fail();
 return p;
}
/** Held filesystem ownership only. The issuer identity, public-key contents,
 * task-bound certificate and decoded runtime config still require independent
 * post-placement qualification. A descriptor never proves that authority. */
function tokenWriters(value,b){
 if(value===undefined)return null;
 const writers=record(value,['control','temporalWorker']);
 const dynamicRoot='/run/meri-temporal',obsoleteStatic=new Set(['/run/meri/temporal-token.json',
  '/run/meri/issuer-client.crt','/run/meri/issuer-client.key','/run/meri/issuer-client-cert.pem','/run/meri/issuer-client-key.pem']);
 for(const [role,value] of Object.entries(writers)){
  const writer=record(value,['status','initialTokenState','tokenFile','publicKey','tls','bootstrap','sha256ByPath']),
   publicKey=record(writer.publicKey,['manifestFile']),tls=record(writer.tls,['issuerCaFile']),
   bootstrap=record(writer.bootstrap,['clientCaFile','identityDirectory','clientKeyFile','clientCertFile','initialIdentityState']),
   paths=[publicKey.manifestFile,tls.issuerCaFile,bootstrap.clientCaFile],
   expected=b.materialDelivery[role].expected.sha256ByPath;
  if(writer.status!=='HOLD'||writer.initialTokenState!=='absent'||writer.tokenFile!=='/run/meri-temporal/token.json'||
     bootstrap.initialIdentityState!=='absent'||bootstrap.identityDirectory!=='/run/meri-temporal/identity'||
     bootstrap.clientKeyFile!=='/run/meri-temporal/identity/client-key.pem'||bootstrap.clientCertFile!=='/run/meri-temporal/identity/client-cert.pem'||
     paths.some(path=>typeof path!=='string'||!/^\/run\/meri\/[A-Za-z0-9._-]{1,128}$/u.test(path)||
      ['/run/meri/.','/run/meri/..','/run/meri/control.json','/run/meri/worker.json'].includes(path)||obsoleteStatic.has(path))||
     new Set(paths).size!==3||Object.keys(expected).some(path=>path===dynamicRoot||path.startsWith(dynamicRoot+'/')||obsoleteStatic.has(path)))fail();
  const pins=record(writer.sha256ByPath,paths);
  if(paths.some(path=>!hex64.test(pins[path])||pins[path]!==expected[path]))fail();
 }
 // One Meri preview server CA signs the control private origin (internal ALB), the model proxy and the issuer server
 // certificates. The worker trusts the control private origin through its issuer server CA file (NODE_EXTRA_CA_CERTS
 // below), so that file must be exactly the CA the runner poststart pins for the same origin.
 const worker=writers.temporalWorker;
 if(worker.sha256ByPath[worker.tls.issuerCaFile]!==b.runnerPoststart.controlCaSha256)fail();
 return writers;
}
function validate(value){
 const b=record(value,['account','region','enabled','materialDelivery','runnerPoststart','clusterArn','imageUri','logGroupName','executionRoleArn','controlTaskRoleArn','runtimeUser','network','sizing','runnerSha256'],['controlTargetGroupArn','controlPrivateTargetGroupArn','sourceCommit','temporalTokenWriters']);
 if(b.account!==ACCOUNT||b.region!==REGION||b.enabled!==false||
    !/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(b.clusterArn)||
    !new RegExp(`^${ACCOUNT}\\.dkr\\.ecr\\.${REGION}\\.amazonaws\\.com\\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$`).test(b.imageUri)||
    !/^\/[A-Za-z0-9_./-]{1,511}$/u.test(b.logGroupName)||
    !/^arn:aws:iam::967807252336:role\/[A-Za-z0-9_+=,.@/-]{1,512}$/u.test(b.executionRoleArn)||
    !/^arn:aws:iam::967807252336:role\/[A-Za-z0-9_+=,.@/-]{1,512}$/u.test(b.controlTaskRoleArn)||
    b.executionRoleArn===b.controlTaskRoleArn||
    b.runtimeUser!=='1000:1000'||!hex64.test(b.runnerSha256)||
    b.sourceCommit!==undefined&&!/^[a-f0-9]{40}$/u.test(b.sourceCommit))fail();
 const targetGroup=/^arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup\/[A-Za-z0-9_-]{1,32}\/[a-f0-9]{16}$/u;
 if([b.controlTargetGroupArn,b.controlPrivateTargetGroupArn].some(arn=>arn!==undefined&&!targetGroup.test(arn))||
    b.controlTargetGroupArn!==undefined&&b.controlTargetGroupArn===b.controlPrivateTargetGroupArn)fail();
 const n=record(b.network,['privateSubnetId','controlSecurityGroupId','workerSecurityGroupId','runnerSecurityGroupIds']);
 if(!/^subnet-[a-f0-9]+$/u.test(n.privateSubnetId)||
    ![n.controlSecurityGroupId,n.workerSecurityGroupId].every(x=>/^sg-[a-f0-9]+$/u.test(x))||
    !Array.isArray(n.runnerSecurityGroupIds)||n.runnerSecurityGroupIds.length<1||n.runnerSecurityGroupIds.length>5||
    new Set(n.runnerSecurityGroupIds).size!==n.runnerSecurityGroupIds.length||
    !n.runnerSecurityGroupIds.every(x=>/^sg-[a-f0-9]+$/u.test(x)))fail();
 const s=record(b.sizing,['control','temporalWorker','runner']);
 for(const value of Object.values(s))sized(value);
 material(b.materialDelivery,b);
 poststart(b.runnerPoststart,b);
 tokenWriters(b.temporalTokenWriters,b);
 return b;
}

const command=Object.freeze({control:['control','--config','/run/meri/control.json'],temporalWorker:['temporal-worker','--config','/run/meri/worker.json'],runner:['start']});
function health(port){return {command:['CMD','node','-e',`fetch('http://127.0.0.1:${port}/health/live').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))`],interval:30,timeout:5,retries:3,startPeriod:60};}
function task(stack,b,role,port){
 const name=role==='temporalWorker'?'temporal-worker':role;
 const delivery=role==='runner'?null:material(b.materialDelivery,b)[role];
 const tokenWriter=role==='runner'?null:b.temporalTokenWriters?.[role];
 const portMappings=role==='control'?[{containerPort:8080,protocol:'tcp'},{containerPort:8082,protocol:'tcp'}]:[{containerPort:port,protocol:'tcp'}];
 const c={name:role==='runner'?'worker':name,image:b.imageUri,essential:true,user:b.runtimeUser,privileged:false,readonlyRootFilesystem:true,stopTimeout:60,
  entryPoint:['node',role==='runner'?'apps/runtime/runner-poststart-cli.mjs':'apps/runtime/cli.mjs'],command:command[role],
  environment:role==='runner'?[{name:'MERI_RUNNER_SHA256',value:b.runnerSha256},{name:'MERI_PRODUCT_PREVIEW_REQUIRED',value:'1'},
   {name:'MERI_POSTSTART_CONTROL_ORIGIN',value:b.runnerPoststart.controlOrigin},
   {name:'MERI_POSTSTART_CA_BASE64',value:b.runnerPoststart.controlCaBase64},
   {name:'MERI_POSTSTART_CA_SHA256',value:b.runnerPoststart.controlCaSha256}]:[{name:'MERI_PRODUCT_PREVIEW_REQUIRED',value:'1'},
   // Replaces the image's RDS bundle (the worker has no database): Node reads it once at start, after material-init SUCCESS.
   ...(role==='temporalWorker'&&tokenWriter?[{name:'NODE_EXTRA_CA_CERTS',value:tokenWriter.tls.issuerCaFile}]:[])],
  portMappings,linuxParameters:{capabilities:{drop:['ALL']}},
  mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false},
   ...(delivery?[{sourceVolume:'material',containerPath:'/run/meri',readOnly:true}]:role==='runner'?[{sourceVolume:'material',containerPath:'/run/meri',readOnly:false}]:[]),
   ...(tokenWriter?[{sourceVolume:'temporal-token',containerPath:'/run/meri-temporal',readOnly:false}]:[])],
  ...(delivery?{dependsOn:[{containerName:'material-init',condition:'SUCCESS'}]}:{}),
  logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':b.logGroupName,'awslogs-region':REGION,'awslogs-stream-prefix':`product-preview-${name}`,'mode':'blocking'}},
  ...(role==='runner'?{}:{healthCheck:health(port)})};
 const init=delivery?{name:'material-init',image:b.imageUri,essential:false,user:b.runtimeUser,privileged:false,readonlyRootFilesystem:true,
  entryPoint:['node','apps/runtime/material-init-cli.mjs'],command:['write'],linuxParameters:{capabilities:{drop:['ALL']}},
  environment:[{name:'MERI_STATIC_MATERIAL_EXPECTED',value:JSON.stringify(delivery.expected)}],
  secrets:[{name:'MERI_STATIC_MATERIAL_BUNDLE',valueFrom:delivery.valueFrom}],
  mountPoints:[{sourceVolume:'material',containerPath:'/run/meri',readOnly:false}],
  logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':b.logGroupName,'awslogs-region':REGION,'awslogs-stream-prefix':`product-preview-${name}-init`,'mode':'blocking'}}}:null;
 const size=b.sizing[role];
 return new ecs.CfnTaskDefinition(stack,`${role}Task`,{family:`meri-product-preview-${name}`,networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],
  cpu:String(size.cpu),memory:String(size.memoryMiB),ephemeralStorage:{sizeInGiB:size.ephemeralStorageGiB},
  runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},executionRoleArn:b.executionRoleArn,
  ...(role==='control'?{taskRoleArn:b.controlTaskRoleArn}:{}),
  volumes:[{name:'workspace'},{name:'tmp'},...(delivery||role==='runner'?[{name:'material'}]:[]),...(tokenWriter?[{name:'temporal-token'}]:[])],containerDefinitions:[...(init?[init]:[]),c]});
}
function service(stack,b,role,definition,securityGroupId){
 const name=role==='temporalWorker'?'temporal-worker':role;
 const targets=role==='control'?[b.controlTargetGroupArn&&{containerName:'control',containerPort:8080,targetGroupArn:b.controlTargetGroupArn},
  b.controlPrivateTargetGroupArn&&{containerName:'control',containerPort:8082,targetGroupArn:b.controlPrivateTargetGroupArn}].filter(Boolean):[];
 return new ecs.CfnService(stack,`${role}Service`,{serviceName:`meri-product-preview-${name}`,cluster:b.clusterArn,taskDefinition:definition.ref,
  desiredCount:0,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,
  networkConfiguration:{awsvpcConfiguration:{subnets:[b.network.privateSubnetId],securityGroups:[securityGroupId],assignPublicIp:'DISABLED'}},
  ...(targets.length?{loadBalancers:targets}:{})});
}

/** Returns source data only. No lookup, build, AWS client, deployment, or file materialization is performed. */
export function synthesizeProductPreview(binding){
 const b=validate(binding),app=new App({context:{'aws:cdk:version-reporting':false}}),stack=new Stack(app,'MeriProductPreview',{env:{account:ACCOUNT,region:REGION},synthesizer:new BootstraplessSynthesizer()});
 const control=task(stack,b,'control',8080),worker=task(stack,b,'temporalWorker',8081),runner=task(stack,b,'runner',8080);
 service(stack,b,'control',control,b.network.controlSecurityGroupId);
 service(stack,b,'temporalWorker',worker,b.network.workerSecurityGroupId);
 new CfnOutput(stack,'RunnerTaskDefinitionArn',{value:runner.ref});
 new CfnOutput(stack,'RunnerClusterArn',{value:b.clusterArn});
 new CfnOutput(stack,'RunnerPrivateSubnetId',{value:b.network.privateSubnetId});
 new CfnOutput(stack,'RunnerSecurityGroupIds',{value:b.network.runnerSecurityGroupIds.join(',')});
 return Template.fromStack(stack).toJSON();
}
