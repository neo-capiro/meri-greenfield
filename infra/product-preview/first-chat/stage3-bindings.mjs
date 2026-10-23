/** Meri first-chat preview, Stage 3: the exact, validator-passing bindings for the three CloudFormation sources, built
 * mechanically from reviewed inputs. Pure: no AWS call, no file read, no secret. Importing this module performs no IO.
 *
 *  (a) infra/product-preview/manifest.mjs synthesizeProductPreview  -> stack meri-first-chat-app   (control, temporal-worker, runner)
 *  (b) infra/product-preview/model-proxy-template.mjs (plan v2)     -> stack meri-first-chat-model (model proxy, budget owner)
 *  (c) infra/product-preview/first-chat-issuer-service.mjs          -> stack meri-first-chat-issuer (existing; re-rendered material)
 *
 * Inputs (all non-secret):
 *  deployment         first-chat/deployment-inputs.json (images, subnets, cluster, secret ARNs, foundation and private-edge copies)
 *  foundationOutputs  first-chat/foundation-outputs.json (must equal deployment.foundation)
 *  privateEdgeOutputs the private-edge stack outputs {ControlPrivateOrigin, ControlPrivateTargetGroupArn, PrivateAlbSecurityGroupId}
 *  renderSummary      <render out>/summary.json from render-material.mjs
 *  renderedExpected   {<role>: <render out>/<role>/expected.json} for the five material roles
 *  secretVersions     {<role>: VersionId} returned by PutSecretValue of <render out>/<role>/bundle.json
 *  imageScans         {proxy, nodeRuntime}: sha256 of each image's reviewed build/scan receipt (model-proxy plan v2 pins them)
 *  liveAppTemplate    `aws cloudformation get-template --stack-name meri-first-chat-app --stage Original` TemplateBody (public 8080 group)
 *
 * The render input stage3.json and these bindings derive every family, service, network set and role from ONE place
 * (stage3RenderInput / the constants below), so the issuer's and owner's pins and the task definitions cannot drift. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ROLES,PATHS} from './render-material.mjs';
import {CONTROL_NODE_CA_FILE} from '../../../apps/runtime/control-ca-bundle.mjs';
import {synthesizeProductPreview} from '../manifest.mjs';
import {ISSUER_SERVICE,BINDING_SCHEMA as ISSUER_SCHEMA,synthesizeFirstChatIssuerServiceTemplate} from '../first-chat-issuer-service.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
export const STAGE3_STACKS=Object.freeze({app:'meri-first-chat-app',issuer:'meri-first-chat-issuer'});
/** CloudFormation TemplateBody limit; a larger template goes through the build bucket (aws cloudformation deploy --s3-bucket). */
export const TEMPLATE_BODY_LIMIT=51200;
export const TEMPLATE_BUCKET=Object.freeze({bucket:'meri-greenfield-qual-build-967807252336-us-east-1',prefix:'cfn'});
/** Task-definition families and service names. manifest.mjs and first-chat-issuer-service.mjs fix them. */
export const STAGE3_FAMILIES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker',
 'temporal-issuer':ISSUER_SERVICE.family,runner:'meri-product-preview-runner'});
export const STAGE3_SERVICES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker',
 'temporal-issuer':ISSUER_SERVICE.serviceName});
/** Approved change set Stage 5 sizing: control and worker 0.5 vCPU / 1 GiB, runner 1 vCPU / 2 GiB; Fargate minimum ephemeral storage. */
export const STAGE3_SIZING=Object.freeze({control:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21}),
 temporalWorker:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21}),runner:Object.freeze({cpu:1024,memoryMiB:2048,ephemeralStorageGiB:21})});
/** Existing, reused: the shared interface-endpoint SG (foundation-binding.json endpointSecurityGroupId) and no bedrock-runtime endpoint (NAT). */
export const STAGE3_EXISTING=Object.freeze({endpointSecurityGroupId:'sg-01def4e5c0fe44d4a',bedrockRuntimeEndpoint:null,
 runnerExecutionRoleName:'MeriPreview-runner-execution',runnerTaskRoleName:'MeriPreview-runner-task'});
/** Deployment-inputs secret key of each material role (Secrets Manager ARN under deployment.secrets). */
export const MATERIAL_SECRET_KEYS=Object.freeze({control:'control/material','temporal-worker':'worker/material','temporal-issuer':'issuer/material'});
const PRIVATE_EDGE_KEYS=Object.freeze({ControlPrivateOrigin:'controlPrivateOrigin',ControlPrivateTargetGroupArn:'controlPrivateTargetGroupArn',PrivateAlbSecurityGroupId:'privateAlbSecurityGroupId'});

export const fail=(detail)=>{throw Object.assign(Error(`STAGE3_BINDING_REFUSED: ${detail}`),{code:'STAGE3_BINDING_REFUSED'});};
const hex64=/^[a-f0-9]{64}$/u,versionId=/^[A-Za-z0-9-]{32,64}$/u;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
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

/** Every Stage 3 ENI set, from the foundation outputs. Control carries the issuer-client and db-client markers, the worker the
 * issuer-client marker. The runner has its own group. The runner's RunTask
 * names exactly one subnet (apps/runtime/config.mjs takes subnets[0]). */
export function stage3Network(deployment,foundation){
 const f=foundation,subnets=[...deployment.privateSubnetIds];
 return {control:{subnets,securityGroups:[f.ControlSecurityGroupId,f.IssuerClientSecurityGroupId,f.DbClientSecurityGroupId]},
  'temporal-worker':{subnets:[...subnets],securityGroups:[f.WorkerSecurityGroupId,f.IssuerClientSecurityGroupId]},
  runner:{subnet:subnets[0],securityGroups:[f.RunnerSecurityGroupId]}};
}

/** Next revision per family from the observed latest ARNs ('None' or absent: the family is new, revision 1). A family's revision
 * counter never reuses a number, so the operator passes the highest revision seen across ACTIVE and INACTIVE listings. */
export function nextRevisions(latestArns){
 const next={};
 for(const [role,family] of Object.entries(STAGE3_FAMILIES)){
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
 const cluster=clusterName(deployment);
 record(revisions,'revisions',Object.keys(STAGE3_FAMILIES));
 for(const [role,n] of Object.entries(revisions))if(!Number.isSafeInteger(n)||n<1)fail(`revisions.${role}`);
 return {schemaVersion:1,
  taskDefinitions:Object.fromEntries(Object.entries(STAGE3_FAMILIES).map(([role,family])=>[role,taskDefinitionArn(family,revisions[role])])),
  services:Object.fromEntries(Object.entries(STAGE3_SERVICES).map(([role,name])=>[role,serviceArn(cluster,name)])),
  network:stage3Network(deployment,foundationOutputs)};
}

function checkFoundation(deployment,foundationOutputs){
 if(deployment?.schemaVersion!==1||deployment.account!==ACCOUNT||deployment.region!==REGION)fail('deployment account/region/schemaVersion');
 // CloudFormation may return other outputs; every consumed binding must match.
 for(const [key,value] of Object.entries(deployment.foundation))if(!same(value,foundationOutputs[key]))
  fail(`foundationOutputs.${key} differs from deployment-inputs.json foundation`);
 if(foundationOutputs.RunnerExecutionRoleArn!==`arn:aws:iam::${ACCOUNT}:role/${STAGE3_EXISTING.runnerExecutionRoleName}`)
  fail('the runner execution role must be MeriPreview-runner-execution');
 if(foundationOutputs.RunnerTaskRoleArn!==`arn:aws:iam::${ACCOUNT}:role/${STAGE3_EXISTING.runnerTaskRoleName}`)
  fail('the runner task role must be MeriPreview-runner-task');
}

/** Builds the application and issuer bindings. Every one is then passed through its own renderer (see synthesizeStage3). */
export function buildStage3Bindings({deployment,foundationOutputs,privateEdgeOutputs,renderSummary,renderedExpected,secretVersions,imageScans,liveAppTemplate}){
 const d=deployment,f=foundationOutputs;
 checkFoundation(d,f);
 record(privateEdgeOutputs,'privateEdgeOutputs',Object.keys(PRIVATE_EDGE_KEYS));
 for(const [output,key] of Object.entries(PRIVATE_EDGE_KEYS))if(privateEdgeOutputs[output]!==d.privateEdge[key])fail(`privateEdgeOutputs.${output} differs from deployment-inputs.json privateEdge.${key}`);
 record(renderedExpected,'renderedExpected',ROLES);record(secretVersions,'secretVersions',ROLES);
 record(imageScans,'imageScans',['nodeRuntime']);
 for(const key of ['nodeRuntime'])if(!hex64.test(imageScans[key]))fail(`imageScans.${key} must be 64 hex`);
 const s=renderSummary;
 if(s?.schemaVersion!==1||!s.roles||!s.runnerPoststart||!s.worker||!s.taskDefinitionConfigPins)fail('renderSummary is not a render-material summary');
 const images=d.images,cluster=clusterName(d);
 // The rendered summary and each expected.json must be the same render, for these images.
 for(const role of ROLES){
  const e=renderedExpected[role],r=s.roles[role];
  if(!r||!e||e.materialContractSha256!==r.materialContractSha256||!same(e.sha256ByPath,r.sha256ByPath)||e.imageDigest!==r.imageDigest||e.role!==role)fail(`${role} expected.json is not the summarized render`);
  const [image,commit]=[images.nodeRuntime,images.nodeRuntimeSourceCommit];
  if(e.imageDigest!==digestOf(image)||e.sourceCommit!==commit)fail(`${role} material is not bound to ${image}`);
  if(e.sha256ByPath[r.configPath]!==r.configSha256)fail(`${role} config pin`);
  if(!versionId.test(secretVersions[role]))fail(`secretVersions.${role} must be a Secrets Manager VersionId`);
  const family=STAGE3_FAMILIES[role];
  if(!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task-definition/${family}:[1-9][0-9]*$`,'u').test(r.taskDefinitionArn??''))fail(`${role} was rendered for ${r.taskDefinitionArn}, not family ${family}`);
 }
 const material=role=>({valueFrom:`${d.secrets[MATERIAL_SECRET_KEYS[role]]}:::${secretVersions[role]}`,expected:structuredClone(renderedExpected[role])});
 for(const role of ROLES)if(typeof d.secrets[MATERIAL_SECRET_KEYS[role]]!=='string')fail(`deployment.secrets.${MATERIAL_SECRET_KEYS[role]}`);
 const net=stage3Network(d,f);

 // (a) control, temporal-worker and the runner task definition.
 const control=renderedExpected.control.sha256ByPath,poststart=s.runnerPoststart;
 const ca=Buffer.from(poststart.MERI_POSTSTART_CA_BASE64??'','base64');
 if(poststart.MERI_POSTSTART_CONTROL_ORIGIN!==privateEdgeOutputs.ControlPrivateOrigin||sha(ca)!==poststart.MERI_POSTSTART_CA_SHA256||control[PATHS.controlCa]!==poststart.MERI_POSTSTART_CA_SHA256)
  fail('runner poststart CA/origin is not the rendered control-ca.pem at the private edge origin');
 if(s.worker.NODE_EXTRA_CA_CERTS!==PATHS.issuerCa)fail('rendered worker NODE_EXTRA_CA_CERTS is not the issuer CA file');
 if(s.control?.NODE_EXTRA_CA_CERTS!==CONTROL_NODE_CA_FILE)fail('rendered control NODE_EXTRA_CA_CERTS is not the composite CA file');
 if(!hex64.test(poststart.MERI_RUNNER_SHA256??''))fail('runner sha256');
 const writer=role=>{const pins=renderedExpected[role].sha256ByPath,paths=[PATHS.issuerJwks,PATHS.issuerCa,PATHS.issuerClientCa];
  if(paths.some(path=>!hex64.test(pins[path]??'')))fail(`${role} material lacks a token-writer file`);
  return {status:'HOLD',initialTokenState:'absent',tokenFile:'/run/meri-temporal/token.json',publicKey:{manifestFile:PATHS.issuerJwks},tls:{issuerCaFile:PATHS.issuerCa},
   bootstrap:{clientCaFile:PATHS.issuerClientCa,identityDirectory:'/run/meri-temporal/identity',clientKeyFile:'/run/meri-temporal/identity/client-key.pem',
    clientCertFile:'/run/meri-temporal/identity/client-cert.pem',initialIdentityState:'absent'},sha256ByPath:Object.fromEntries(paths.map(path=>[path,pins[path]]))};};
 const app={account:ACCOUNT,region:REGION,enabled:false,sourceCommit:images.nodeRuntimeSourceCommit,
  materialDelivery:{control:material('control'),temporalWorker:material('temporal-worker')},
  runnerPoststart:{controlOrigin:poststart.MERI_POSTSTART_CONTROL_ORIGIN,controlCaFile:PATHS.controlCa,controlCaBase64:poststart.MERI_POSTSTART_CA_BASE64,controlCaSha256:poststart.MERI_POSTSTART_CA_SHA256},
  clusterArn:d.clusterArn,imageUri:images.nodeRuntime,
  executionRoleArns:{control:f.ControlExecutionRoleArn,temporalWorker:f.WorkerExecutionRoleArn,runner:f.RunnerExecutionRoleArn},
  logGroupNames:{control:f.ControlLogGroupName,temporalWorker:f.WorkerLogGroupName,runner:f.RunnerLogGroupName},
  controlTaskRoleArn:f.ControlTaskRoleArn,runnerTaskRoleArn:f.RunnerTaskRoleArn,runtimeUser:'1000:1000',runnerSha256:poststart.MERI_RUNNER_SHA256,
  network:{privateSubnetIds:[...d.privateSubnetIds],controlSecurityGroupIds:[...net.control.securityGroups],
   workerSecurityGroupIds:[...net['temporal-worker'].securityGroups],runnerSecurityGroupIds:[...net.runner.securityGroups]},
  sizing:structuredClone(STAGE3_SIZING),
  // The stacks are live: control keeps the public 8080 target group its live service is attached to, plus the private 8082 one.
  controlTargetGroupArn:liveControlTargetGroup(liveAppTemplate),controlPrivateTargetGroupArn:privateEdgeOutputs.ControlPrivateTargetGroupArn,
  temporalTokenWriters:{control:writer('control'),temporalWorker:writer('temporal-worker')}};

 const pins=s.taskDefinitionConfigPins;

 // (b) the existing issuer service, re-rendered: the Node runtime image and the new issuer material version, still desired 1.
 const issuer={schema:ISSUER_SCHEMA,account:ACCOUNT,region:REGION,
  placement:{clusterArn:d.clusterArn,vpcId:d.vpcId,privateSubnetIds:[...d.privateSubnetIds]},
  image:{uri:images.nodeRuntime,sourceCommit:images.nodeRuntimeSourceCommit},
  roles:{executionRoleArn:f.IssuerExecutionRoleArn,taskRoleArn:f.IssuerTaskRoleArn},logGroupName:f.IssuerLogGroupName,
  serviceDiscovery:{issuerRegistryArn:f.IssuerDiscoveryServiceArn},
  network:{issuerSecurityGroupId:f.IssuerSecurityGroupId,dbClientSecurityGroupId:f.DbClientSecurityGroupId},
  material:material('temporal-issuer'),startup:{configSha256:pins.issuerConfigSha256},desiredCount:1};

 const expectedTaskDefinitions=Object.fromEntries([...ROLES.map(role=>[role,s.roles[role].taskDefinitionArn]),['runner',s.wiring?.runner?.family]]);
 if(!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task-definition/${STAGE3_FAMILIES.runner}:[1-9][0-9]*$`,'u').test(expectedTaskDefinitions.runner??''))fail('runner task definition in the render summary');
 return {stacks:{...STAGE3_STACKS},app,issuer,expectedTaskDefinitions,
  services:Object.fromEntries(Object.entries(STAGE3_SERVICES).map(([role,name])=>[role,serviceArn(cluster,name)]))};
}

/** The public 8080 target group the LIVE control service is attached to (`get-template --stage Original` of the app stack). */
export function liveControlTargetGroup(liveAppTemplate){
 const groups=liveAppTemplate?.Resources?.controlService?.Properties?.LoadBalancers;
 const publicGroup=Array.isArray(groups)?groups.filter(g=>g?.ContainerPort===8080):[];
 if(publicGroup.length!==1||typeof publicGroup[0].TargetGroupArn!=='string')fail('the live app template must attach control to exactly one public 8080 target group');
 return publicGroup[0].TargetGroupArn;
}

/** Update the issuer, then control/worker/runner. The issuer admits
 * only the control/worker revisions it pins, so the app update must follow the issuer gate immediately. */
export const STAGE3_DEPLOY_ORDER=Object.freeze(['issuer','app']);

/** The renderers declare DesiredCount 0, the safe value for a first create. Both stacks are live, and CloudFormation applies a
 * declared 0 on update, so the update keeps every service serving: issuer, control and worker at one task. Control runs exactly
 * one task (poststart nonces are process-local): stop-then-start (max 100 / min 0), which ECS refuses while AZ rebalancing is
 * ENABLED, and it starts only after the runner task definition it launches exists. */
export function applyLiveServiceProfile(templates){
 const service=(template,id)=>{const r=template.Resources?.[id];if(r?.Type!=='AWS::ECS::Service')fail(`template lacks service ${id}`);return r;};
 for(const id of ['controlService','temporalWorkerService'])service(templates.app,id).Properties.DesiredCount=1;
 const control=service(templates.app,'controlService');
 if(templates.app.Resources.runnerTask?.Type!=='AWS::ECS::TaskDefinition')fail('template lacks runnerTask');
 Object.assign(control.Properties,{DeploymentConfiguration:{MaximumPercent:100,MinimumHealthyPercent:0},AvailabilityZoneRebalancing:'DISABLED'});
 control.DependsOn=['runnerTask'];
 if(service(templates.issuer,'TemporalIssuerService').Properties.DesiredCount!==1)fail('the issuer service must stay at one task');
 return templates;
}

/** Each binding through its own renderer and validator, then the live-service profile. Throws the renderer's own refusal code. */
export function synthesizeStage3(bindings){
 const templates=applyLiveServiceProfile({app:synthesizeProductPreview(bindings.app),issuer:synthesizeFirstChatIssuerServiceTemplate(bindings.issuer)});
 const bodies=Object.fromEntries(Object.entries(templates).map(([key,template])=>[key,JSON.stringify(template)]));
 return {templates,bodies,sizes:Object.fromEntries(Object.entries(bodies).map(([key,body])=>[key,{bytes:Buffer.byteLength(body,'utf8'),viaS3:Buffer.byteLength(body,'utf8')>TEMPLATE_BODY_LIMIT}]))};
}
