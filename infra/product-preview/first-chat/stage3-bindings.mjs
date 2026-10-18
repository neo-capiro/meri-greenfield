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
 *
 * The render input stage3.json and these bindings derive every family, service, network set and role from ONE place
 * (stage3RenderInput / the constants below), so the issuer's and owner's pins and the task definitions cannot drift. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ROLES,PATHS} from './render-material.mjs';
import {synthesizeProductPreview} from '../manifest.mjs';
import {MODEL_PROXY_SERVICES,MODEL_PROXY_EXISTING,LITELLM} from '../model-proxy-plan.mjs';
import {synthesizeModelProxyTemplate} from '../model-proxy-template.mjs';
import {ISSUER_SERVICE,BINDING_SCHEMA as ISSUER_SCHEMA,synthesizeFirstChatIssuerServiceTemplate} from '../first-chat-issuer-service.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
export const STAGE3_STACKS=Object.freeze({app:'meri-first-chat-app',model:'meri-first-chat-model',issuer:'meri-first-chat-issuer'});
/** CloudFormation TemplateBody limit; a larger template goes through the build bucket (aws cloudformation deploy --s3-bucket). */
export const TEMPLATE_BODY_LIMIT=51200;
export const TEMPLATE_BUCKET=Object.freeze({bucket:'meri-greenfield-qual-build-967807252336-us-east-1',prefix:'cfn'});
/** Task-definition families and service names. manifest.mjs, model-proxy-plan.mjs and first-chat-issuer-service.mjs fix them. */
export const STAGE3_FAMILIES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker',
 'temporal-issuer':ISSUER_SERVICE.family,'model-owner':MODEL_PROXY_SERVICES.owner.family,'model-proxy':MODEL_PROXY_SERVICES.proxy.family,runner:'meri-product-preview-runner'});
export const STAGE3_SERVICES=Object.freeze({control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker',
 'temporal-issuer':ISSUER_SERVICE.serviceName,'model-owner':MODEL_PROXY_SERVICES.owner.serviceName,'model-proxy':MODEL_PROXY_SERVICES.proxy.serviceName});
/** Approved change set Stage 5 sizing: control and worker 0.5 vCPU / 1 GiB, runner 1 vCPU / 2 GiB; Fargate minimum ephemeral storage. */
export const STAGE3_SIZING=Object.freeze({control:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21}),
 temporalWorker:Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21}),runner:Object.freeze({cpu:1024,memoryMiB:2048,ephemeralStorageGiB:21})});
/** Existing, reused: the shared interface-endpoint SG (foundation-binding.json endpointSecurityGroupId) and no bedrock-runtime endpoint (NAT). */
export const STAGE3_EXISTING=Object.freeze({endpointSecurityGroupId:'sg-01def4e5c0fe44d4a',bedrockRuntimeEndpoint:null,
 runnerExecutionRoleName:'MeriPreview-runner-execution',budgetNamespace:'meri_product_budget'});
const SECRET_KEYS=Object.freeze({control:'control/material','temporal-worker':'worker/material','temporal-issuer':'issuer/material','model-owner':'owner/material','model-proxy':'proxy/material'});
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
 * issuer-client marker, the owner the db-client marker; the proxy and runner carry only their own group. The runner's RunTask
 * names exactly one subnet (apps/runtime/config.mjs takes subnets[0]). */
export function stage3Network(deployment,foundation){
 const f=foundation,subnets=[...deployment.privateSubnetIds];
 return {control:{subnets,securityGroups:[f.ControlSecurityGroupId,f.IssuerClientSecurityGroupId,f.DbClientSecurityGroupId]},
  'temporal-worker':{subnets:[...subnets],securityGroups:[f.WorkerSecurityGroupId,f.IssuerClientSecurityGroupId]},
  'model-owner':{subnets:[...subnets],securityGroups:[f.OwnerSecurityGroupId,f.DbClientSecurityGroupId]},
  'model-proxy':{subnets:[...subnets],securityGroups:[f.ProxySecurityGroupId]},
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
 if(!same(deployment.foundation,foundationOutputs))fail('foundationOutputs differ from deployment-inputs.json foundation');
 if(foundationOutputs.RunnerExecutionRoleArn!==`arn:aws:iam::${ACCOUNT}:role/${STAGE3_EXISTING.runnerExecutionRoleName}`)
  fail('the runner execution role must be MeriPreview-runner-execution, the one role control may iam:PassRole');
}

/** Builds the three bindings. Every one is then passed through its own renderer (see synthesizeStage3). */
export function buildStage3Bindings({deployment,foundationOutputs,privateEdgeOutputs,renderSummary,renderedExpected,secretVersions,imageScans}){
 const d=deployment,f=foundationOutputs;
 checkFoundation(d,f);
 record(privateEdgeOutputs,'privateEdgeOutputs',Object.keys(PRIVATE_EDGE_KEYS));
 for(const [output,key] of Object.entries(PRIVATE_EDGE_KEYS))if(privateEdgeOutputs[output]!==d.privateEdge[key])fail(`privateEdgeOutputs.${output} differs from deployment-inputs.json privateEdge.${key}`);
 record(renderedExpected,'renderedExpected',ROLES);record(secretVersions,'secretVersions',ROLES);
 record(imageScans,'imageScans',['proxy','nodeRuntime']);
 for(const key of ['proxy','nodeRuntime'])if(!hex64.test(imageScans[key]))fail(`imageScans.${key} must be 64 hex`);
 const s=renderSummary;
 if(s?.schemaVersion!==1||!s.roles||!s.runnerPoststart||!s.worker||!s.taskDefinitionConfigPins)fail('renderSummary is not a render-material summary');
 const images=d.images,cluster=clusterName(d);
 // The rendered summary and each expected.json must be the same render, for these images.
 for(const role of ROLES){
  const e=renderedExpected[role],r=s.roles[role];
  if(!r||!e||e.materialContractSha256!==r.materialContractSha256||!same(e.sha256ByPath,r.sha256ByPath)||e.imageDigest!==r.imageDigest||e.role!==role)fail(`${role} expected.json is not the summarized render`);
  const [image,commit]=role==='model-proxy'?[images.proxy,images.proxySourceCommit]:[images.nodeRuntime,images.nodeRuntimeSourceCommit];
  if(e.imageDigest!==digestOf(image)||e.sourceCommit!==commit)fail(`${role} material is not bound to ${image}`);
  if(e.sha256ByPath[r.configPath]!==r.configSha256)fail(`${role} config pin`);
  if(!versionId.test(secretVersions[role]))fail(`secretVersions.${role} must be a Secrets Manager VersionId`);
  const family=STAGE3_FAMILIES[role];
  if(!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task-definition/${family}:[1-9][0-9]*$`,'u').test(r.taskDefinitionArn??''))fail(`${role} was rendered for ${r.taskDefinitionArn}, not family ${family}`);
 }
 const material=role=>({valueFrom:`${d.secrets[SECRET_KEYS[role]]}:::${secretVersions[role]}`,expected:structuredClone(renderedExpected[role])});
 for(const role of ROLES)if(typeof d.secrets[SECRET_KEYS[role]]!=='string')fail(`deployment.secrets.${SECRET_KEYS[role]}`);
 const net=stage3Network(d,f);

 // (a) control, temporal-worker and the runner task definition.
 const control=renderedExpected.control.sha256ByPath,poststart=s.runnerPoststart;
 const ca=Buffer.from(poststart.MERI_POSTSTART_CA_BASE64??'','base64');
 if(poststart.MERI_POSTSTART_CONTROL_ORIGIN!==privateEdgeOutputs.ControlPrivateOrigin||sha(ca)!==poststart.MERI_POSTSTART_CA_SHA256||control[PATHS.controlCa]!==poststart.MERI_POSTSTART_CA_SHA256)
  fail('runner poststart CA/origin is not the rendered control-ca.pem at the private edge origin');
 if(s.worker.NODE_EXTRA_CA_CERTS!==PATHS.issuerCa)fail('rendered worker NODE_EXTRA_CA_CERTS is not the issuer CA file');
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
  controlTaskRoleArn:f.ControlTaskRoleArn,runtimeUser:'1000:1000',runnerSha256:poststart.MERI_RUNNER_SHA256,
  network:{privateSubnetIds:[...d.privateSubnetIds],controlSecurityGroupIds:[...net.control.securityGroups],
   workerSecurityGroupIds:[...net['temporal-worker'].securityGroups],runnerSecurityGroupIds:[...net.runner.securityGroups]},
  sizing:structuredClone(STAGE3_SIZING),
  // Private 8082 only. The public 8080 target group (foundation ControlTargetGroupArn) is attached at Stage 6, never here.
  controlPrivateTargetGroupArn:privateEdgeOutputs.ControlPrivateTargetGroupArn,
  temporalTokenWriters:{control:writer('control'),temporalWorker:writer('temporal-worker')}};

 // (b) model proxy and budget owner, plan v2.
 const pins=s.taskDefinitionConfigPins;
 const model={schema:'meri.product-model-proxy.plan/2',account:ACCOUNT,region:REGION,
  placement:{vpcId:d.vpcId,clusterArn:d.clusterArn,privateSubnetIds:[...d.privateSubnetIds]},
  images:{proxy:{uri:images.proxy,sourceCommit:images.proxySourceCommit,litellmVersion:LITELLM.version,upstreamDigest:LITELLM.upstreamDigest,reviewedScanSha256:imageScans.proxy},
   nodeRuntime:{uri:images.nodeRuntime,sourceCommit:images.nodeRuntimeSourceCommit,reviewedScanSha256:imageScans.nodeRuntime}},
  roles:{proxyExecutionRoleArn:f.ProxyExecutionRoleArn,proxyTaskRoleArn:f.ProxyTaskRoleArn,ownerExecutionRoleArn:f.OwnerExecutionRoleArn,ownerTaskRoleArn:f.OwnerTaskRoleArn},
  logGroups:{proxy:f.ProxyLogGroupName,owner:f.OwnerLogGroupName},
  serviceDiscovery:{proxyRegistryArn:f.ProxyDiscoveryServiceArn,ownerRegistryArn:f.OwnerDiscoveryServiceArn},
  network:{proxySecurityGroupId:f.ProxySecurityGroupId,ownerSecurityGroupId:f.OwnerSecurityGroupId,dbClientSecurityGroupId:f.DbClientSecurityGroupId,
   runnerSecurityGroupIds:[f.RunnerSecurityGroupId],endpointSecurityGroupId:STAGE3_EXISTING.endpointSecurityGroupId,
   s3Gateway:{...MODEL_PROXY_EXISTING.s3Gateway},bedrockRuntimeEndpoint:STAGE3_EXISTING.bedrockRuntimeEndpoint},
  material:{proxy:material('model-proxy'),owner:material('model-owner')},
  startup:{proxyConfigSha256:pins.proxyConfigSha256,ownerConfigSha256:pins.MERI_PRODUCT_OWNER_CONFIG_SHA256},
  owner:{budgetNamespace:STAGE3_EXISTING.budgetNamespace}};
 if(model.placement.vpcId!==MODEL_PROXY_EXISTING.vpcId)fail('deployment.vpcId');
 if(!same(net['model-owner'].securityGroups,[f.OwnerSecurityGroupId,f.DbClientSecurityGroupId])||!same(net['model-proxy'].securityGroups,[f.ProxySecurityGroupId]))fail('owner/proxy ENI sets');

 // (c) the existing issuer service, re-rendered: the Node runtime image and the new issuer material version, still desired 1.
 const issuer={schema:ISSUER_SCHEMA,account:ACCOUNT,region:REGION,
  placement:{clusterArn:d.clusterArn,vpcId:d.vpcId,privateSubnetIds:[...d.privateSubnetIds]},
  image:{uri:images.nodeRuntime,sourceCommit:images.nodeRuntimeSourceCommit},
  roles:{executionRoleArn:f.IssuerExecutionRoleArn,taskRoleArn:f.IssuerTaskRoleArn},logGroupName:f.IssuerLogGroupName,
  serviceDiscovery:{issuerRegistryArn:f.IssuerDiscoveryServiceArn},
  network:{issuerSecurityGroupId:f.IssuerSecurityGroupId,dbClientSecurityGroupId:f.DbClientSecurityGroupId},
  material:material('temporal-issuer'),startup:{configSha256:pins.issuerConfigSha256},desiredCount:1};

 const expectedTaskDefinitions=Object.fromEntries([...ROLES.map(role=>[role,s.roles[role].taskDefinitionArn]),['runner',s.wiring?.runner?.family]]);
 if(!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task-definition/${STAGE3_FAMILIES.runner}:[1-9][0-9]*$`,'u').test(expectedTaskDefinitions.runner??''))fail('runner task definition in the render summary');
 return {stacks:{...STAGE3_STACKS},app,model,issuer,expectedTaskDefinitions,
  services:Object.fromEntries(Object.entries(STAGE3_SERVICES).map(([role,name])=>[role,serviceArn(cluster,name)]))};
}

/** Each binding through its own renderer and validator. Throws the renderer's own refusal code on any mismatch. */
export function synthesizeStage3(bindings){
 const templates={app:synthesizeProductPreview(bindings.app),model:synthesizeModelProxyTemplate(bindings.model),issuer:synthesizeFirstChatIssuerServiceTemplate(bindings.issuer)};
 const bodies=Object.fromEntries(Object.entries(templates).map(([key,template])=>[key,JSON.stringify(template)]));
 return {templates,bodies,sizes:Object.fromEntries(Object.entries(bodies).map(([key,body])=>[key,{bytes:Buffer.byteLength(body,'utf8'),viaS3:Buffer.byteLength(body,'utf8')>TEMPLATE_BODY_LIMIT}]))};
}
