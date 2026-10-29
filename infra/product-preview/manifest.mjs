/** Offline, disabled ECS preview source. Binding values come from a separately reviewed inventory. */
import {App, Stack, CfnOutput, CfnDeletionPolicy, BootstraplessSynthesizer, aws_ecs as ecs} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import {parseStaticProductMaterialExpected} from '../../apps/runtime/material-init.mjs';
import {CONTROL_NODE_CA_FILE} from '../../apps/runtime/control-ca-bundle.mjs';

const ACCOUNT='967807252336', REGION='us-east-1';
const hex64=/^[a-f0-9]{64}$/u,SUBNET=/^subnet-[a-f0-9]{8,17}$/u,SECURITY_GROUP=/^sg-[a-f0-9]{8,17}$/u;
const fail=()=>{throw Error('PRODUCT_PREVIEW_BINDING_REFUSED');};
function ids(value,pattern,max){
 if(!Array.isArray(value)||value.length<1||value.length>max||new Set(value).size!==value.length||
    !value.every(x=>typeof x==='string'&&pattern.test(x)))fail();
 return value;
}
const sameSet=(left,right)=>left.length===right.length&&left.every(x=>right.includes(x));
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
const roleNames=Object.freeze({control:'control',temporalWorker:'temporal-worker',scheduleWorker:'schedule-worker'});
const taskRoles=b=>['control','temporalWorker',...(b.materialDelivery?.scheduleWorker===undefined?[]:['scheduleWorker'])];
function material(value,b){
 const m=record(value,taskRoles(b));
 if(typeof b.sourceCommit!=='string'||!/^[a-f0-9]{40}$/u.test(b.sourceCommit))fail();
 const secretVersion=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}:::[A-Za-z0-9-]{32,64}$/u;
 for(const [role,spec] of Object.entries(m)){
  record(spec,['valueFrom','expected']);
  if(!secretVersion.test(spec.valueFrom))fail();
  let expected;try{expected=parseStaticProductMaterialExpected(spec.expected);}catch{fail();}
  if(Buffer.byteLength(JSON.stringify(expected),'utf8')>8192)fail();
  if(expected.role!==roleNames[role]||expected.runtimeUser!==b.runtimeUser||
     expected.sourceCommit!==b.sourceCommit||expected.imageDigest!==`sha256:${b.imageUri.split('@sha256:')[1]}`)fail();
 }
 if(new Set(Object.values(m).map(x=>x.valueFrom)).size!==Object.keys(m).length)fail();
 return m;
}
// Both services reach the same private control endpoint through this pinned material file.
const PRIVATE_CONTROL_CA_FILE='/run/meri/control-ca.pem';
function privateControlTrust(b){
 const control=b.materialDelivery.control.expected.sha256ByPath[PRIVATE_CONTROL_CA_FILE];
 if(!hex64.test(control??'')||taskRoles(b).some(role=>b.materialDelivery[role].expected.sha256ByPath[PRIVATE_CONTROL_CA_FILE]!==control))fail();
}
const ROLE_ARN=/^arn:aws:iam::967807252336:role\/[A-Za-z0-9_+=,.@/-]{1,512}$/u,LOG_GROUP=/^\/[A-Za-z0-9_./-]{1,511}$/u;
/** Shared or distinct per-service execution roles and log groups. AgentCore
 * owns the SDK runtime independently of these control and Temporal services. */
function perRole(b,single,map,pattern,forbidden){
 if((b[single]===undefined)===(b[map]===undefined))fail();
 const roles=taskRoles(b),values=b[single]!==undefined?[b[single]]:roles.map(role=>record(b[map],roles)[role]);
 if(values.some(v=>typeof v!=='string'||!pattern.test(v)||v===forbidden)||new Set(values).size!==values.length)fail();
}
const roleValue=(b,single,map,role)=>b[single]??b[map][role];
// Public search target for control only: the documented MCP invocation endpoint and the exposed tool name.
const GATEWAY_HOST=/^[a-z0-9-]{1,63}\.gateway\.bedrock-agentcore\.us-east-1\.amazonaws\.com$/u;
function controlWebSearch(value){
 if(value===undefined)return undefined;
 const v=record(value,['gatewayUrl','toolName','region']);
 let url;try{url=new URL(v.gatewayUrl);}catch{fail();}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    url.pathname!=='/mcp'||v.gatewayUrl!==url.origin+'/mcp'||!GATEWAY_HOST.test(url.hostname))fail();
 if(!/^[A-Za-z0-9_-]{1,64}$/u.test(v.toolName)||v.region!==REGION)fail();
 return v;
}
function validate(value){
 const b=record(value,['account','region','enabled','materialDelivery','clusterArn','imageUri','controlTaskRoleArn','runtimeUser','network','sizing'],
  ['executionRoleArn','executionRoleArns','logGroupName','logGroupNames','controlTargetGroupArn','controlPrivateTargetGroupArn','sourceCommit','controlWebSearch']);
 if(b.account!==ACCOUNT||b.region!==REGION||b.enabled!==false||
    !/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(b.clusterArn)||
    !new RegExp(`^${ACCOUNT}\\.dkr\\.ecr\\.${REGION}\\.amazonaws\\.com\\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$`).test(b.imageUri)||
    !ROLE_ARN.test(b.controlTaskRoleArn)||
    b.runtimeUser!=='1000:1000'||
    b.sourceCommit!==undefined&&!/^[a-f0-9]{40}$/u.test(b.sourceCommit))fail();
 perRole(b,'executionRoleArn','executionRoleArns',ROLE_ARN,b.controlTaskRoleArn);
 perRole(b,'logGroupName','logGroupNames',LOG_GROUP);
 const targetGroup=/^arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup\/[A-Za-z0-9_-]{1,32}\/[a-f0-9]{16}$/u;
 if([b.controlTargetGroupArn,b.controlPrivateTargetGroupArn].some(arn=>arn!==undefined&&!targetGroup.test(arn))||
    b.controlTargetGroupArn!==undefined&&b.controlTargetGroupArn===b.controlPrivateTargetGroupArn)fail();
 // Each service's awsvpcConfiguration uses these lists verbatim. Control and worker ENIs legitimately differ
 // (e.g. control also carries the db-client marker), so each role has its own set; identical sets refuse.
 const schedule=taskRoles(b).includes('scheduleWorker');
 const n=record(b.network,['privateSubnetIds','controlSecurityGroupIds','workerSecurityGroupIds',...(schedule?['scheduleSecurityGroupIds']:[])]);
 ids(n.privateSubnetIds,SUBNET,3);
 for(const key of ['controlSecurityGroupIds','workerSecurityGroupIds',...(schedule?['scheduleSecurityGroupIds']:[])])ids(n[key],SECURITY_GROUP,5);
 if(sameSet(n.controlSecurityGroupIds,n.workerSecurityGroupIds))fail();
 const s=record(b.sizing,taskRoles(b));
 for(const value of Object.values(s))sized(value);
 material(b.materialDelivery,b);
 privateControlTrust(b);
 // Optional control-only public search binding; validated here and nowhere rendered elsewhere.
 const search=controlWebSearch(b.controlWebSearch);
 return search===undefined?b:{...b,controlWebSearch:search};
}

const command=Object.freeze({control:['control','--config','/run/meri/control.json'],temporalWorker:['temporal-worker','--config','/run/meri/worker.json'],scheduleWorker:['schedule-worker','--config','/run/meri/schedule-worker.json']});
function health(port){return {command:['CMD','node','-e',`fetch('http://127.0.0.1:${port}/health/live').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))`],interval:30,timeout:5,retries:3,startPeriod:60};}
function task(stack,b,role,port){
 const name=roleNames[role],databaseTrust=role==='control'||role==='scheduleWorker';
 const delivery=material(b.materialDelivery,b)[role];
 const portMappings=role==='control'?[{containerPort:8080,protocol:'tcp'},{containerPort:8082,protocol:'tcp'}]:[{containerPort:port,protocol:'tcp'}];
 const c={name,image:b.imageUri,essential:true,user:b.runtimeUser,privileged:false,readonlyRootFilesystem:true,stopTimeout:60,
  entryPoint:['node','apps/runtime/cli.mjs'],command:command[role],
  environment:[{name:'MERI_PRODUCT_PREVIEW_REQUIRED',value:'1'},
   {name:'NODE_EXTRA_CA_CERTS',value:databaseTrust?CONTROL_NODE_CA_FILE:PRIVATE_CONTROL_CA_FILE},
   // Public search settings reach control only, and only when the deployment supplies the binding.
   ...(role==='control'&&b.controlWebSearch?[{name:'MERI_WEB_SEARCH_GATEWAY_ENDPOINT',value:b.controlWebSearch.gatewayUrl},
    {name:'MERI_WEB_SEARCH_TOOL',value:b.controlWebSearch.toolName},
    {name:'MERI_WEB_SEARCH_REGION',value:b.controlWebSearch.region}]:[])],
  portMappings,linuxParameters:{capabilities:{drop:['ALL']}},
  mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false},
   {sourceVolume:'material',containerPath:'/run/meri',readOnly:true}],
  dependsOn:[{containerName:'material-init',condition:'SUCCESS'}],
  logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':roleValue(b,'logGroupName','logGroupNames',role),'awslogs-region':REGION,'awslogs-stream-prefix':`product-preview-${name}`,'mode':'blocking'}},
  healthCheck:health(port)};
 const init={name:'material-init',image:b.imageUri,essential:false,user:b.runtimeUser,privileged:false,readonlyRootFilesystem:true,
  entryPoint:['node','apps/runtime/material-init-cli.mjs'],command:databaseTrust?['write','--control-node-ca']:['write'],linuxParameters:{capabilities:{drop:['ALL']}},
  environment:[{name:'MERI_STATIC_MATERIAL_EXPECTED',value:JSON.stringify(delivery.expected)}],
  secrets:[{name:'MERI_STATIC_MATERIAL_BUNDLE',valueFrom:delivery.valueFrom}],
  mountPoints:[{sourceVolume:'material',containerPath:'/run/meri',readOnly:false},...(databaseTrust?[{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}]:[])],
  logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':roleValue(b,'logGroupName','logGroupNames',role),'awslogs-region':REGION,'awslogs-stream-prefix':`product-preview-${name}-init`,'mode':'blocking'}}};
 const size=b.sizing[role];
 const definition=new ecs.CfnTaskDefinition(stack,`${role}Task`,{family:`meri-product-preview-${name}`,networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],
  cpu:String(size.cpu),memory:String(size.memoryMiB),ephemeralStorage:{sizeInGiB:size.ephemeralStorageGiB},
  runtimePlatform:{cpuArchitecture:'ARM64',operatingSystemFamily:'LINUX'},executionRoleArn:roleValue(b,'executionRoleArn','executionRoleArns',role),
  ...(role==='control'?{taskRoleArn:b.controlTaskRoleArn}:{}),
  volumes:[{name:'workspace'},{name:'tmp'},{name:'material'}],containerDefinitions:[init,c]});
 definition.cfnOptions.updateReplacePolicy=CfnDeletionPolicy.RETAIN;
 return definition;
}
function service(stack,b,role,definition,securityGroupIds){
 const name=roleNames[role];
 // The internal ALB's 8082 target group (controlPrivateTargetGroupArn) is how AgentCore and the worker
 // reach control-private, so control needs no Cloud Map registration. The public 8080 target group is optional
 // and is supplied only at Stage 6 (public exposure); either may be absent independently.
 const targets=role==='control'?[b.controlTargetGroupArn&&{containerName:'control',containerPort:8080,targetGroupArn:b.controlTargetGroupArn},
  b.controlPrivateTargetGroupArn&&{containerName:'control',containerPort:8082,targetGroupArn:b.controlPrivateTargetGroupArn}].filter(Boolean):[];
 return new ecs.CfnService(stack,`${role}Service`,{serviceName:`meri-product-preview-${name}`,cluster:b.clusterArn,taskDefinition:definition.ref,
  desiredCount:0,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,
  networkConfiguration:{awsvpcConfiguration:{subnets:[...b.network.privateSubnetIds],securityGroups:[...securityGroupIds],assignPublicIp:'DISABLED'}},
  ...(targets.length?{loadBalancers:targets}:{})});
}

/** Returns source data only. No lookup, build, AWS client, deployment, or file materialization is performed. */
export function synthesizeProductPreview(binding){
 const b=validate(binding),app=new App({context:{'aws:cdk:version-reporting':false}}),stack=new Stack(app,'MeriProductPreview',{env:{account:ACCOUNT,region:REGION},synthesizer:new BootstraplessSynthesizer()});
 const control=task(stack,b,'control',8080),worker=task(stack,b,'temporalWorker',8081);
 service(stack,b,'control',control,b.network.controlSecurityGroupIds);
 service(stack,b,'temporalWorker',worker,b.network.workerSecurityGroupIds);
 new CfnOutput(stack,'ControlTaskDefinitionArn',{value:control.ref});
 new CfnOutput(stack,'TemporalWorkerTaskDefinitionArn',{value:worker.ref});
 if(taskRoles(b).includes('scheduleWorker')){
  const schedule=task(stack,b,'scheduleWorker',8083);
  service(stack,b,'scheduleWorker',schedule,b.network.scheduleSecurityGroupIds);
  new CfnOutput(stack,'ScheduleWorkerTaskDefinitionArn',{value:schedule.ref});
 }
 const template=Template.fromStack(stack).toJSON();
 template.Description=`Meri shared control and Temporal worker${taskRoles(b).includes('scheduleWorker')?' plus schedule dispatch':''} with pinned native TLS material; AgentCore hosts SDK sessions.`;
 template.Metadata={AWSToolsMetrics:{AWSAgentToolkit:'aws-cloudformation@3'}};
 for(const id of taskRoles(b).map(role=>`${role}Task`))template.Resources[id].Metadata={
  'com.aws.cloudformation.Context':{why:'Deliver immutable native TLS and private control trust to the service.',must:'Keep nonroot, read-only app material, exact secret versions and no mutable token-writer volume.'}};
 return template;
}
