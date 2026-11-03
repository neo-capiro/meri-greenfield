/** Offline case composition using the existing material renderer, Stage3 sizing and
 * task compiler. Nothing here publishes, starts tasks, registers targets or invokes a run. */
import {createHash} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';
import {composeOperatorMaterial,validateOperatorMaterial} from '../../../apps/runtime/operator-material.mjs';
import {operatorCaseNames,createOperatorControlAdmission} from '../../../apps/runtime/operator-control-configuration.mjs';
import {composeOperatorCallbackMaterial} from './operator-callback-material.mjs';
import {STAGE3_SIZING} from './stage3-bindings.mjs';
import {PATHS} from './render-material.mjs';
import {synthesizeOperatorCaseTasks} from '../manifest.mjs';
const ACCOUNT='967807252336',REGION='us-east-1',sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('OPERATOR_CASE_BINDING_REFUSED');},same=(a,b)=>hash(a)===hash(b);
function bytes(role,path){const f=role.bundle.files.find(f=>f.path===path);if(!f)fail();return Buffer.from(f.base64,'base64');}
function roles(rendered){
 if(!same(Object.keys(rendered.roles).sort(),['control','temporal-worker']))fail();
 for(const [name,r] of Object.entries(rendered.roles)){
  validateStaticProductDelivery(r);
  if(r.expected.role!==name||!same(r.config,JSON.parse(bytes(r,r.configPath))))fail();
 }
 return [rendered.roles.control,rendered.roles['temporal-worker']];
}
function edgeOf(raw,caseId){
 const e=own(raw,['CaseControlSecurityGroupId','CaseClientSecurityGroupId','ControlPrivateTargetGroupArn','HostListenerTargetGroupArn']);
 if(e.CaseControlSecurityGroupId===e.CaseClientSecurityGroupId||![e.CaseControlSecurityGroupId,e.CaseClientSecurityGroupId].every(x=>/^sg-[a-f0-9]{8,17}$/u.test(x))||
  !e.ControlPrivateTargetGroupArn.startsWith(`arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT}:targetgroup/meri-case-${caseId}-8082/`))fail();
 return e;
}
/** Feed this into the existing renderOperatorCaseMaterial --stage3 shape. Names
 * are fresh case families, never the ordinary Stage3 families or services. */
export function operatorCaseStage3Input({caseId,deployment,edge,revisions}){
 const n=operatorCaseNames(caseId),e=edgeOf(edge,caseId),cluster=deployment.clusterArn.split('/').at(-1);
 own(revisions,['control','temporal-worker']);
 if(Object.values(revisions).some(v=>!Number.isSafeInteger(v)||v<1))fail();
 const names={control:n.control,'temporal-worker':n.worker};
 return {schemaVersion:1,
  taskDefinitions:Object.fromEntries(Object.entries(names).map(([role,name])=>[role,`arn:aws:ecs:${REGION}:${ACCOUNT}:task-definition/${name}:${revisions[role]}`])),
  services:Object.fromEntries(Object.entries(names).map(([role,name])=>[role,`arn:aws:ecs:${REGION}:${ACCOUNT}:service/${cluster}/${name}`])),
  network:{control:{subnets:[...deployment.privateSubnetIds],securityGroups:[e.CaseControlSecurityGroupId,deployment.foundation.DbClientSecurityGroupId]},
   'temporal-worker':{subnets:[...deployment.privateSubnetIds],securityGroups:[e.CaseClientSecurityGroupId,deployment.foundation.DbClientSecurityGroupId]}}};
}
/** The capability remains process-local. The protected descriptor contains only
 * the reviewed selection, public native declaration and exact configuration pins. */
export function composeOperatorCaseStartup({caseId,rendered,observerMaterial,selection,expiresAtMs,productionControlCapabilitySha256}){
 const [control,worker]=roles(rendered),sourceCommit=control.expected.sourceCommit,imageDigest=control.expected.imageDigest;
 if(worker.expected.sourceCommit!==sourceCommit||worker.expected.imageDigest!==imageDigest||!same(control.config.temporal,worker.config.temporal))fail();
 const controlCapability=bytes(control,control.config.native.capabilityFile);
 if(!controlCapability.equals(bytes(worker,worker.config.native.capabilityFile)))fail();
 const callback=composeOperatorCallbackMaterial({material:observerMaterial,controlCapability,productionControlCapabilitySha256});
 if(!same(worker.config.nativeProvisioning,observerMaterial.native.worker))fail();
 const {address,namespace,taskQueue}=control.config.temporal;
 const descriptor={schema:'meri-operator-control-startup/1',caseId,sourceCommit,selection,expiresAtMs,
  material:{native:{control:observerMaterial.native.control,worker:observerMaterial.native.worker},configuration:observerMaterial.configuration,retainUntilMs:observerMaterial.retainUntilMs},
  configurationSha256:hash(control.config),controlCapabilitySha256:callback.controlCapabilitySha256,temporal:{address,namespace,taskQueue}};
 // Validate the real renderer-to-startup seam without retaining or using an admission.
 createOperatorControlAdmission(descriptor,control.config,controlCapability,sourceCommit).revoke();
 return {control:composeOperatorMaterial({role:'control',sourceCommit,imageDigest,descriptor}),
  temporalWorker:composeOperatorMaterial({role:'temporal-worker',sourceCommit,imageDigest,descriptor:callback}),
  agentcore:composeOperatorMaterial({role:'agentcore',sourceCommit,imageDigest,descriptor:callback})};
}
/** Ordinary readbacks are public identities/hashes, never credentials. Case-role
 * material is generated separately, and no ordinary bundle is rewritten. */
export function compileOperatorCaseBindings({caseId,deployment,rendered,startup,edge,versions,operatorSecrets,production,network}){
 const n=operatorCaseNames(caseId),e=edgeOf(edge,caseId),[control,worker]=roles(rendered),d=deployment,f=d.foundation;
 own(production,['temporal','secretArns','trafficSecurityGroupIds','targetGroupArns','runtimeArn','controlCaSha256','controlCapabilitySha256']);
 own(network,['temporalFrontendSecurityGroupId']);own(versions,['control','temporal-worker','operator-control','operator-worker']);own(operatorSecrets,['control','temporal-worker']);
 const t=control.config.temporal,wt=worker.config.temporal;
 if(t.taskQueue!==n.queue||!same(t,wt)||t.taskQueue===production.temporal.taskQueue||t.namespace!==production.temporal.namespace||t.address!==production.temporal.address||
  !control.config.agentcore.runtimeArn.startsWith(`arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT}:runtime/${n.runtime}-`)||control.config.agentcore.runtimeArn===production.runtimeArn||
  control.config.browserActivation?.state!=='held'||worker.expected.sourceCommit!==d.images.nodeRuntimeSourceCommit||control.expected.sourceCommit!==d.images.nodeRuntimeSourceCommit||
  control.expected.imageDigest!==d.images.nodeRuntime.split('@')[1]||worker.expected.imageDigest!==control.expected.imageDigest)fail();
 const callback=JSON.parse(validateOperatorMaterial(startup.temporalWorker).bytes),admission=JSON.parse(validateOperatorMaterial(startup.control).bytes);
 if(!same(callback,JSON.parse(validateOperatorMaterial(startup.agentcore).bytes)))fail();
 if(admission.caseId!==caseId||admission.configurationSha256!==hash(control.config)||callback.controlCapabilitySha256!==admission.controlCapabilitySha256||
  callback.controlCapabilitySha256!==sha(bytes(control,control.config.native.capabilityFile).toString('utf8').trim())||
  callback.controlCapabilitySha256===production.controlCapabilitySha256||sha(callback.caCertificate)===production.controlCaSha256||
  callback.nativeProvisioningSha256!==hash(worker.config.nativeProvisioning))fail();
 for(const spec of Object.values(startup)){const x=validateOperatorMaterial(spec).expected;if(x.sourceCommit!==control.expected.sourceCommit||x.imageDigest!==control.expected.imageDigest)fail();}
 const secretArns=[d.secrets['control/material'],d.secrets['worker/material'],operatorSecrets.control,operatorSecrets['temporal-worker']];
 if(new Set(secretArns).size!==4||secretArns.some(a=>production.secretArns.includes(a))||
  [e.CaseControlSecurityGroupId,e.CaseClientSecurityGroupId].some(s=>production.trafficSecurityGroupIds.includes(s))||
  production.trafficSecurityGroupIds.includes(f.DbClientSecurityGroupId)||[e.CaseControlSecurityGroupId,e.CaseClientSecurityGroupId].includes(f.DbClientSecurityGroupId)||
  [e.ControlPrivateTargetGroupArn,e.HostListenerTargetGroupArn].some(a=>production.targetGroupArns.includes(a)))fail();
 for(const [key,suffix] of [['ControlExecutionRoleArn','control-execution'],['WorkerExecutionRoleArn','worker-execution']])
  if(f[key]!==`arn:aws:iam::${ACCOUNT}:role/MeriCase-${caseId}-${suffix}`)fail();
 for(const v of Object.values(versions))if(!/^[A-Za-z0-9-]{32,64}$/u.test(v))fail();
 const delivery=(arn,version,expected)=>({valueFrom:`${arn}:::${version}`,expected});
 const app={account:ACCOUNT,region:REGION,enabled:false,sourceCommit:d.images.nodeRuntimeSourceCommit,clusterArn:d.clusterArn,imageUri:d.images.nodeRuntime,
  materialDelivery:{control:delivery(secretArns[0],versions.control,control.expected),temporalWorker:delivery(secretArns[1],versions['temporal-worker'],worker.expected)},
  executionRoleArns:{control:f.ControlExecutionRoleArn,temporalWorker:f.WorkerExecutionRoleArn},logGroupNames:{control:f.ControlLogGroupName,temporalWorker:f.WorkerLogGroupName},
  controlTaskRoleArn:f.ControlTaskRoleArn,workerTaskRoleArn:f.WorkerTaskRoleArn,runtimeUser:'1000:1000',sizing:structuredClone(STAGE3_SIZING),
  network:{privateSubnetIds:[...d.privateSubnetIds],controlSecurityGroupIds:[e.CaseControlSecurityGroupId,f.DbClientSecurityGroupId],workerSecurityGroupIds:[e.CaseClientSecurityGroupId,f.DbClientSecurityGroupId]},
  controlPrivateTargetGroupArn:e.ControlPrivateTargetGroupArn,controlHostListenerTargetGroupArn:e.HostListenerTargetGroupArn};
 const operator={caseId,delivery:{control:delivery(secretArns[2],versions['operator-control'],startup.control.expected),temporalWorker:delivery(secretArns[3],versions['operator-worker'],startup.temporalWorker.expected)}};
 const template=synthesizeOperatorCaseTasks(app,operator),resources=template.Resources;
 const sg=/^sg-[a-f0-9]{8,17}$/u;
 const hostSecurityGroupIds=worker.config.nativeProvisioning.browserDeployment.placement.securityGroupIds;
 if(!sg.test(network.temporalFrontendSecurityGroupId)||!Array.isArray(hostSecurityGroupIds)||!hostSecurityGroupIds.length||hostSecurityGroupIds.some(s=>!sg.test(s)))fail();
 // Existing native transports, same ports; fresh case groups do not inherit
 // ordinary traffic groups merely to acquire their egress or Temporal ingress.
 const rule=(id,type,groupId,port,peer)=>resources[id]={Type:`AWS::EC2::SecurityGroup${type}`,Properties:{GroupId:groupId,IpProtocol:'tcp',FromPort:port,ToPort:port,...peer}};
 for(const [name,group] of [['Control',e.CaseControlSecurityGroupId],['Worker',e.CaseClientSecurityGroupId]]){
  rule(`${name}Https`,'Egress',group,443,{CidrIp:'0.0.0.0/0'});
  rule(`${name}Temporal`,'Egress',group,7233,{DestinationSecurityGroupId:network.temporalFrontendSecurityGroupId});
  rule(`TemporalFromCase${name}`,'Ingress',network.temporalFrontendSecurityGroupId,7233,{SourceSecurityGroupId:group});
 }
 hostSecurityGroupIds.forEach((host,i)=>{
  rule(`ControlToHost${i}`,'Egress',e.CaseControlSecurityGroupId,9444,{DestinationSecurityGroupId:host});
  rule(`HostFromControl${i}`,'Ingress',host,9444,{SourceSecurityGroupId:e.CaseControlSecurityGroupId});
  rule(`ControlFromHost${i}`,'Ingress',e.CaseControlSecurityGroupId,8443,{SourceSecurityGroupId:host});
 });
 return {stackName:`${n.prefix}-tasks`,app,operator,template,
  execution:{mode:'once-only-run-task',cluster:d.clusterArn,count:1,control:{family:n.control,securityGroups:app.network.controlSecurityGroupIds},worker:{family:n.worker,securityGroups:app.network.workerSecurityGroupIds},subnets:d.privateSubnetIds,
   targetGroups:{private8082:e.ControlPrivateTargetGroupArn,host8443:e.HostListenerTargetGroupArn},automaticReplacement:false}};
}
