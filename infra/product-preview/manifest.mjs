/** Offline, disabled ECS preview source. Binding values come from a separately reviewed inventory. */
import {App, Stack, CfnOutput, BootstraplessSynthesizer, aws_ecs as ecs} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

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
function validate(value){
 const b=record(value,['account','region','enabled','materialDelivery','clusterArn','imageUri','logGroupName','executionRoleArn','controlTaskRoleArn','runtimeUser','network','sizing','runnerSha256'],['controlTargetGroupArn']);
 if(b.account!==ACCOUNT||b.region!==REGION||b.enabled!==false||b.materialDelivery!=='unmounted'||
    !/^arn:aws:ecs:us-east-1:967807252336:cluster\/meri-greenfield-product-[A-Za-z0-9_-]{1,224}$/u.test(b.clusterArn)||
    !new RegExp(`^${ACCOUNT}\\.dkr\\.ecr\\.${REGION}\\.amazonaws\\.com\\/meri-greenfield\\/product-[a-z0-9._/-]+@sha256:[a-f0-9]{64}$`).test(b.imageUri)||
    !/^\/meri-greenfield\/product-[A-Za-z0-9_./-]{1,480}$/u.test(b.logGroupName)||
    !/^arn:aws:iam::967807252336:role\/(?:MeriGreenfield-Product|meri-greenfield-product)[A-Za-z0-9_+=,.@/-]{1,480}$/u.test(b.executionRoleArn)||
    !/^arn:aws:iam::967807252336:role\/(?:MeriGreenfield-Product|meri-greenfield-product)[A-Za-z0-9_+=,.@/-]{1,480}$/u.test(b.controlTaskRoleArn)||
    b.executionRoleArn===b.controlTaskRoleArn||
    !/^[1-9][0-9]*:[1-9][0-9]*$/u.test(b.runtimeUser)||!hex64.test(b.runnerSha256))fail();
 if(b.controlTargetGroupArn!==undefined&&!/^arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup\/meri-product-[A-Za-z0-9_-]{1,19}\/[a-f0-9]{16}$/u.test(b.controlTargetGroupArn))fail();
 const n=record(b.network,['privateSubnetId','controlSecurityGroupId','workerSecurityGroupId','runnerSecurityGroupIds']);
 if(!/^subnet-[a-f0-9]+$/u.test(n.privateSubnetId)||
    ![n.controlSecurityGroupId,n.workerSecurityGroupId].every(x=>/^sg-[a-f0-9]+$/u.test(x))||
    !Array.isArray(n.runnerSecurityGroupIds)||n.runnerSecurityGroupIds.length<1||n.runnerSecurityGroupIds.length>5||
    new Set(n.runnerSecurityGroupIds).size!==n.runnerSecurityGroupIds.length||
    !n.runnerSecurityGroupIds.every(x=>/^sg-[a-f0-9]+$/u.test(x)))fail();
 const s=record(b.sizing,['control','temporalWorker','runner']);
 for(const value of Object.values(s))sized(value);
 return b;
}

const command=Object.freeze({control:['control','--config','/run/meri/control.json'],temporalWorker:['temporal-worker','--config','/run/meri/worker.json'],runner:['conversation-runner','--config','/run/meri/task.json']});
function health(port){return {command:['CMD','node','-e',`fetch('http://127.0.0.1:${port}/health/live').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))`],interval:30,timeout:5,retries:3,startPeriod:60};}
function task(stack,b,role,port){
 const name=role==='temporalWorker'?'temporal-worker':role;
 const c={name:role==='runner'?'worker':name,image:b.imageUri,essential:true,user:b.runtimeUser,privileged:false,readonlyRootFilesystem:true,stopTimeout:60,
  entryPoint:['node','apps/runtime/cli.mjs'],command:command[role],
  environment:role==='runner'?[{name:'MERI_RUNNER_SHA256',value:b.runnerSha256}]:[],
  portMappings:[{containerPort:port,protocol:'tcp'}],linuxParameters:{capabilities:{drop:['ALL']}},
  mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],
  logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':b.logGroupName,'awslogs-region':REGION,'awslogs-stream-prefix':`product-preview-${name}`,'mode':'blocking'}},
  ...(role==='runner'?{}:{healthCheck:health(port)})};
 const size=b.sizing[role];
 return new ecs.CfnTaskDefinition(stack,`${role}Task`,{family:`meri-product-preview-${name}`,networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],
  cpu:String(size.cpu),memory:String(size.memoryMiB),ephemeralStorage:{sizeInGiB:size.ephemeralStorageGiB},
  runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},executionRoleArn:b.executionRoleArn,
  ...(role==='control'?{taskRoleArn:b.controlTaskRoleArn}:{}),
  volumes:[{name:'workspace'},{name:'tmp'}],containerDefinitions:[c]});
}
function service(stack,b,role,definition,securityGroupId){
 const name=role==='temporalWorker'?'temporal-worker':role;
 return new ecs.CfnService(stack,`${role}Service`,{serviceName:`meri-product-preview-${name}`,cluster:b.clusterArn,taskDefinition:definition.ref,
  desiredCount:0,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,
  networkConfiguration:{awsvpcConfiguration:{subnets:[b.network.privateSubnetId],securityGroups:[securityGroupId],assignPublicIp:'DISABLED'}},
  ...(role==='control'&&b.controlTargetGroupArn?{loadBalancers:[{containerName:'control',containerPort:8080,targetGroupArn:b.controlTargetGroupArn}]}:{})});
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
