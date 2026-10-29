/** Offline application bindings from reviewed deployment inputs, material envelopes and live app readback.
 * The application stack contains control and temporal-worker. AgentCore and the native TLS Temporal
 * cluster are separately qualified prerequisites. An explicit routines workflow adds the existing schedule-worker role. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ROLES,PATHS,deploymentRoles} from './render-material.mjs';
import {CONTROL_NODE_CA_FILE} from '../../../apps/runtime/control-ca-bundle.mjs';
import {synthesizeProductPreview} from '../manifest.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
export const STAGE3_STACKS=Object.freeze({app:'meri-first-chat-app'});
/** CloudFormation TemplateBody limit; a larger template goes through the build bucket (aws cloudformation deploy --s3-bucket). */
export const TEMPLATE_BODY_LIMIT=51200;
export const TEMPLATE_BUCKET=Object.freeze({bucket:'meri-greenfield-qual-build-967807252336-us-east-1',prefix:'cfn'});
/** Task-definition families and service names. manifest.mjs fixes them. */
export const STAGE3_FAMILIES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker'});
export const STAGE3_SERVICES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker'});
export const ALL_STAGE3_FAMILIES=Object.freeze({...STAGE3_FAMILIES,'schedule-worker':'meri-product-preview-schedule-worker'});
const familiesFor=roles=>Object.fromEntries(roles.map(role=>[role,ALL_STAGE3_FAMILIES[role]]));
/** Approved change set Stage 5 sizing: control and worker 0.5 vCPU / 1 GiB, Fargate minimum ephemeral storage. */
export const STAGE3_SIZING=Object.freeze({control:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21}),
 temporalWorker:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21})});
/** Existing, reused: the shared interface-endpoint SG (foundation-binding.json endpointSecurityGroupId) and no bedrock-runtime endpoint (NAT). */
export const STAGE3_EXISTING=Object.freeze({endpointSecurityGroupId:'sg-01def4e5c0fe44d4a',bedrockRuntimeEndpoint:null});
/** Deployment-inputs secret key of each material role (Secrets Manager ARN under deployment.secrets). */
export const MATERIAL_SECRET_KEYS=Object.freeze({control:'control/material','temporal-worker':'worker/material','schedule-worker':'schedule/material'});
const PRIVATE_EDGE_KEYS=Object.freeze({ControlPrivateOrigin:'controlPrivateOrigin',ControlPrivateTargetGroupArn:'controlPrivateTargetGroupArn',PrivateAlbSecurityGroupId:'privateAlbSecurityGroupId'});
/** Stage 6 public search (SCRUM-237): the two string outputs that bind control to the provisioned gateway.
 * `GatewayUrl` is the documented MCP invocation endpoint (…/mcp) and `TargetToolName` is the tool name the
 * gateway actually exposes (from `tools/list`), which may be prefixed. Absent inputs keep today's behaviour. */
export const WEB_SEARCH_OUTPUT_KEYS=Object.freeze(['GatewayUrl','TargetToolName']);
const GATEWAY_HOST=/^[a-z0-9-]{1,63}\.gateway\.bedrock-agentcore\.us-east-1\.amazonaws\.com$/u,TOOL_NAME=/^[A-Za-z0-9_-]{1,64}$/u;

export const fail=(detail)=>{throw Object.assign(Error(`STAGE3_BINDING_REFUSED: ${detail}`),{code:'STAGE3_BINDING_REFUSED'});};
const hex64=/^[a-f0-9]{64}$/u,versionId=/^[A-Za-z0-9-]{32,64}$/u;
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
function record(value,name,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value))fail(`${name} must be an object`);
 const actual=Object.keys(value).sort(),expected=[...keys].sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))fail(`${name} must have exactly ${expected.join(',')}`);
 return value;
}
const digestOf=uri=>`sha256:${String(uri).split('@sha256:')[1]}`;
const serviceArn=(cluster,name)=>`arn:aws:ecs:${REGION}:${ACCOUNT}:service/${cluster}/${name}`;
const taskDefinitionArn=(family,revision)=>`arn:aws:ecs:${REGION}:${ACCOUNT}:task-definition/${family}:${revision}`;
function clusterName(deployment){const m=/^arn:aws:ecs:us-east-1:967807252336:cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(deployment?.clusterArn??'');if(!m)fail('deployment.clusterArn');return m[1];}

/** Existing service groups and the control DB marker. AgentCore has separate placement. */
export function stage3Network(deployment,foundation){
 const f=foundation,subnets=[...deployment.privateSubnetIds];
 return {control:{subnets,securityGroups:[f.ControlSecurityGroupId,f.DbClientSecurityGroupId]},
  'temporal-worker':{subnets:[...subnets],securityGroups:[f.WorkerSecurityGroupId]},
  ...(deploymentRoles(deployment).includes('schedule-worker')?{'schedule-worker':{subnets:[...subnets],securityGroups:[f.WorkerSecurityGroupId,f.DbClientSecurityGroupId]}}:{})};
}

/** Next revision per family from the observed latest ARNs ('None' or absent: the family is new, revision 1). A family's revision
 * counter never reuses a number, so the operator passes the highest revision seen across ACTIVE and INACTIVE listings. */
export function nextRevisions(latestArns,{roles=ROLES}={}){
 const next={};
 for(const [role,family] of Object.entries(familiesFor(roles))){
  let max=0;
  for(const arn of latestArns[role]??[]){
   if(arn==='None'||arn===null)continue;
   const m=/^arn:aws:ecs:us-east-1:967807252336:task-definition\/([A-Za-z0-9_-]+):([1-9][0-9]*)$/u.exec(arn);
   if(!m||m[1]!==family)fail(`observed ${arn} is not a revision of ${family}`);
   max=Math.max(max,Number(m[2]));
  }
  next[role]=max+1;
 }
 return next;
}

/** render-material.mjs --stage3 input. `revisions` names the revision each family WILL get when its stack registers it once. */
export function stage3RenderInput({deployment,foundationOutputs,revisions}){
 checkFoundation(deployment,foundationOutputs);
 const cluster=clusterName(deployment),families=familiesFor(deploymentRoles(deployment));
 record(revisions,'revisions',Object.keys(families));
 for(const [role,n] of Object.entries(revisions))if(!Number.isSafeInteger(n)||n<1)fail(`revisions.${role}`);
 return {schemaVersion:1,
  taskDefinitions:Object.fromEntries(Object.entries(families).map(([role,family])=>[role,taskDefinitionArn(family,revisions[role])])),
  services:Object.fromEntries(Object.entries(families).map(([role,name])=>[role,serviceArn(cluster,name)])),
  network:stage3Network(deployment,foundationOutputs)};
}

function checkFoundation(deployment,foundationOutputs){
 if(deployment?.schemaVersion!==1||deployment.account!==ACCOUNT||deployment.region!==REGION)fail('deployment account/region/schemaVersion');
 // CloudFormation may return other outputs; every consumed binding must match.
 for(const [key,value] of Object.entries(deployment.foundation))if(!same(value,foundationOutputs[key]))
  fail(`foundationOutputs.${key} differs from deployment-inputs.json foundation`);

}

/** Optional control-only public search binding from the deployed gateway's string outputs.
 * The real outputs object also carries GatewayArn/GatewayId/versions; only these two are consumed. */
export function webSearchBinding(outputs){
 if(outputs===undefined||outputs===null)return undefined;
 if(typeof outputs!=='object'||Array.isArray(outputs))fail('webSearchOutputs must be an object of stack outputs');
 const gatewayUrl=outputs.GatewayUrl,toolName=outputs.TargetToolName;
 if(typeof gatewayUrl!=='string'||typeof toolName!=='string')fail('webSearchOutputs must contain string GatewayUrl and TargetToolName outputs');
 if(!TOOL_NAME.test(toolName))fail('webSearchOutputs.TargetToolName must be a 1..64 tool identifier');
 let url;try{url=new URL(gatewayUrl);}catch{fail('webSearchOutputs.GatewayUrl must be a URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    url.pathname!=='/mcp'||gatewayUrl!==url.origin+'/mcp')fail('webSearchOutputs.GatewayUrl must be the documented https …/mcp invocation endpoint');
 if(!GATEWAY_HOST.test(url.hostname))fail('webSearchOutputs.GatewayUrl is not an AgentCore gateway endpoint in this region');
 return Object.freeze({gatewayUrl,toolName,region:REGION});
}

/** Builds the application binding, then passes it through its renderer (see synthesizeStage3). */
export function buildStage3Bindings({deployment,foundationOutputs,privateEdgeOutputs,renderSummary,renderedExpected,secretVersions,imageScans,liveAppTemplate,webSearchOutputs}){
 const d=deployment,f=foundationOutputs,roles=deploymentRoles(d),schedule=roles.includes('schedule-worker');
 checkFoundation(d,f);
 record(privateEdgeOutputs,'privateEdgeOutputs',Object.keys(PRIVATE_EDGE_KEYS));
 for(const [output,key] of Object.entries(PRIVATE_EDGE_KEYS))if(privateEdgeOutputs[output]!==d.privateEdge[key])fail(`privateEdgeOutputs.${output} differs from deployment-inputs.json privateEdge.${key}`);
 record(renderedExpected,'renderedExpected',roles);record(secretVersions,'secretVersions',roles);
 record(imageScans,'imageScans',['nodeRuntime']);
 for(const key of ['nodeRuntime'])if(!hex64.test(imageScans[key]))fail(`imageScans.${key} must be 64 hex`);
 const s=renderSummary;
 if(s?.schemaVersion!==1||!s.roles||!s.agentcore||!s.worker||!s.taskDefinitionConfigPins)fail('renderSummary is not a render-material summary');
 record(s.roles,'renderSummary.roles',roles);
 const images=d.images,cluster=clusterName(d);
 // The rendered summary and each expected.json must be the same render, for these images.
 for(const role of roles){
  const e=renderedExpected[role],r=s.roles[role];
  if(!r||!e||e.materialContractSha256!==r.materialContractSha256||!same(e.sha256ByPath,r.sha256ByPath)||e.imageDigest!==r.imageDigest||e.role!==role)fail(`${role} expected.json is not the summarized render`);
  const [image,commit]=[images.nodeRuntime,images.nodeRuntimeSourceCommit];
  if(e.imageDigest!==digestOf(image)||e.sourceCommit!==commit)fail(`${role} material is not bound to ${image}`);
  if(e.sha256ByPath[r.configPath]!==r.configSha256)fail(`${role} config pin`);
  if(!versionId.test(secretVersions[role]))fail(`secretVersions.${role} must be a Secrets Manager VersionId`);
  const family=ALL_STAGE3_FAMILIES[role];
  if(!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task-definition/${family}:[1-9][0-9]*$`,'u').test(r.taskDefinitionArn??''))fail(`${role} was rendered for ${r.taskDefinitionArn}, not family ${family}`);
 }
 const material=role=>({valueFrom:`${d.secrets[MATERIAL_SECRET_KEYS[role]]}:::${secretVersions[role]}`,expected:structuredClone(renderedExpected[role])});
 for(const role of roles)if(typeof d.secrets[MATERIAL_SECRET_KEYS[role]]!=='string')fail(`deployment.secrets.${MATERIAL_SECRET_KEYS[role]}`);
 const net=stage3Network(d,f);
 const controlWebSearch=webSearchBinding(webSearchOutputs);

 // (a) the existing control and Temporal worker services; SDK compute is the separately qualified AgentCore runtime.
 for(const key of ['runtimeArn','runtimeVersion','qualifier'])if(s.agentcore[key]!==d.agentcore?.[key])fail('rendered AgentCore '+key+' differs from deployment');
 if(s.worker.NODE_EXTRA_CA_CERTS!==PATHS.serverCa)fail('rendered worker NODE_EXTRA_CA_CERTS is not the private control CA file');
 if(s.control?.NODE_EXTRA_CA_CERTS!==CONTROL_NODE_CA_FILE)fail('rendered control NODE_EXTRA_CA_CERTS is not the composite CA file');
 if(schedule&&s.schedule?.NODE_EXTRA_CA_CERTS!==CONTROL_NODE_CA_FILE)fail('rendered schedule NODE_EXTRA_CA_CERTS is not the composite CA file');
 if(roles.some(role=>renderedExpected.control.sha256ByPath[PATHS.serverCa]!==renderedExpected[role].sha256ByPath[PATHS.serverCa]))fail('control and worker private CA pins differ');
 const app={account:ACCOUNT,region:REGION,enabled:false,sourceCommit:images.nodeRuntimeSourceCommit,
  materialDelivery:{control:material('control'),temporalWorker:material('temporal-worker'),...(schedule?{scheduleWorker:material('schedule-worker')}:{})},
  clusterArn:d.clusterArn,imageUri:images.nodeRuntime,
  executionRoleArns:{control:f.ControlExecutionRoleArn,temporalWorker:f.WorkerExecutionRoleArn,...(schedule?{scheduleWorker:f.ScheduleExecutionRoleArn}:{})},
  logGroupNames:{control:f.ControlLogGroupName,temporalWorker:f.WorkerLogGroupName,...(schedule?{scheduleWorker:f.ScheduleLogGroupName}:{})},
  controlTaskRoleArn:f.ControlTaskRoleArn,runtimeUser:'1000:1000',
  network:{privateSubnetIds:[...d.privateSubnetIds],controlSecurityGroupIds:[...net.control.securityGroups],
   workerSecurityGroupIds:[...net['temporal-worker'].securityGroups],...(schedule?{scheduleSecurityGroupIds:[...net['schedule-worker'].securityGroups]}:{})},
  sizing:{...structuredClone(STAGE3_SIZING),...(schedule?{scheduleWorker:{...STAGE3_SIZING.temporalWorker}}:{})},
  // The stacks are live: control keeps the public 8080 target group its live service is attached to, plus the private 8082 one.
  controlTargetGroupArn:liveControlTargetGroup(liveAppTemplate),controlPrivateTargetGroupArn:privateEdgeOutputs.ControlPrivateTargetGroupArn,
  // Control-only public search; absent keeps the app binding byte-identical to today's.
  ...(controlWebSearch===undefined?{}:{controlWebSearch})};

 const expectedTaskDefinitions=Object.fromEntries(roles.map(role=>[role,s.roles[role].taskDefinitionArn]));
 return {stacks:{...STAGE3_STACKS},app,expectedTaskDefinitions,
  services:Object.fromEntries(Object.entries(familiesFor(roles)).map(([role,name])=>[role,serviceArn(cluster,name)]))};
}

/** The public 8080 target group the LIVE control service is attached to (`get-template --stage Original` of the app stack). */
export function liveControlTargetGroup(liveAppTemplate){
 const groups=liveAppTemplate?.Resources?.controlService?.Properties?.LoadBalancers;
 const publicGroup=Array.isArray(groups)?groups.filter(g=>g?.ContainerPort===8080):[];
 if(publicGroup.length!==1||typeof publicGroup[0].TargetGroupArn!=='string')fail('the live app template must attach control to exactly one public 8080 target group');
 return publicGroup[0].TargetGroupArn;
}

/** Qualify the native TLS Temporal cluster and selected AgentCore version before this app update. */
export const STAGE3_DEPLOY_ORDER=Object.freeze(['app']);

/** Preserve the two live services. Process-local public sessions require control stop-then-start. */
export function applyLiveServiceProfile(templates){
 const service=(template,id)=>{const r=template.Resources?.[id];if(r?.Type!=='AWS::ECS::Service')fail(`template lacks service ${id}`);return r;};
 for(const id of ['controlService','temporalWorkerService',...(templates.app.Resources.scheduleWorkerTask?['scheduleWorkerService']:[])])service(templates.app,id).Properties.DesiredCount=1;
 const control=service(templates.app,'controlService');
 Object.assign(control.Properties,{DeploymentConfiguration:{MaximumPercent:100,MinimumHealthyPercent:0},AvailabilityZoneRebalancing:'DISABLED'});
 return templates;
}

/** Each binding through its own renderer and validator, then the live-service profile. Throws the renderer's own refusal code. */
export function synthesizeStage3(bindings){
 const templates=applyLiveServiceProfile({app:synthesizeProductPreview(bindings.app)});
 const bodies=Object.fromEntries(Object.entries(templates).map(([key,template])=>[key,JSON.stringify(template)]));
 return {templates,bodies,sizes:Object.fromEntries(Object.entries(bodies).map(([key,body])=>[key,{bytes:Buffer.byteLength(body,'utf8'),viaS3:Buffer.byteLength(body,'utf8')>TEMPLATE_BODY_LIMIT}]))};
}
