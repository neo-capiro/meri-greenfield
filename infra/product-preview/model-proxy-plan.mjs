/** Exact-input resource plan for the private product model proxy and its one
 * canonical budget owner in capiro-dev, per the approved
 * docs/shipping/20261017/FIRST-CHAT-CHANGE-SET.md (Stage 2 inputs, Stage 3
 * services at desired count 0).
 *
 * - Runner -> proxy is direct TCP 8443 to Cloud Map `proxy.meri.internal`; no NLB.
 * - The proxy reaches Bedrock through the existing NAT on TCP 443 unless the
 *   binding names an existing bedrock-runtime interface endpoint.
 * - The existing S3 gateway and the shared interface-endpoint SG are reused.
 * - The foundation stack owns every SG, SG rule, IAM role, log group and Cloud
 *   Map service; this plan takes their IDs and lists the rules they must hold.
 *
 * Review data only. This module performs no lookup, credential read, deployment
 * or inference, and an ECS service it describes never starts a task by itself.
 */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
const PROFILE=`arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/us.anthropic.claude-sonnet-4-6`;
const FOUNDATIONS=['us-east-1','us-east-2','us-west-2'].map(region=>
 `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-sonnet-4-6`);
/** Fresh 17 Oct 2026 read-only inventory; reused, never created here. */
export const MODEL_PROXY_EXISTING=Object.freeze({
 vpcId:'vpc-0ac26cfac7ed972be',vpcCidr:'10.40.0.0/16',
 clusterArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:cluster/capiro-dev`,
 s3Gateway:Object.freeze({endpointId:'vpce-0cdaa6b79d616aa1c',prefixListId:'pl-63a5400a'}),
 auroraSecurityGroupId:'sg-059b4e4de0b1dcca5',auroraPort:5432
});
export const MODEL_PROXY_SERVICES=Object.freeze({
 proxy:Object.freeze({serviceName:'meri-product-preview-proxy',family:'meri-product-preview-proxy',containerName:'model-proxy',
  materialRole:'model-proxy',runtimeUser:'10001:10001',port:8443,hostname:'proxy.meri.internal',configFile:'/run/meri/proxy.json'}),
 owner:Object.freeze({serviceName:'meri-product-preview-owner',family:'meri-product-preview-owner',containerName:'model-owner',
  materialRole:'model-owner',runtimeUser:'1000:1000',port:8444,hostname:'owner.meri.internal',configFile:'/run/meri/owner.json'})
});
// Stage 5 sizing in the approved change set: owner and proxy 0.5 vCPU / 1 GiB each.
const SIZING=Object.freeze({cpu:512,memoryMiB:1024,ephemeralStorageGiB:21});
const LITELLM=Object.freeze({version:'1.104.2',upstreamDigest:'sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500'});

const fail=()=>{throw Error('PRODUCT_MODEL_PROXY_BINDING_REFUSED');};
function object(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
}
function match(value,pattern){if(typeof value!=='string'||!pattern.test(value))fail();return value;}
function distinct(values){if(new Set(values).size!==values.length)fail();return values;}
function ids(values,pattern,min=1,max=5){
 if(!Array.isArray(values)||values.length<min||values.length>max)fail();
 return distinct(values.map(value=>match(value,pattern)));
}
function freezeTree(value){
 if(value!==null&&typeof value==='object'){
  for(const child of Object.values(value))freezeTree(child);
  Object.freeze(value);
 }
 return value;
}
const hex64=/^[a-f0-9]{64}$/u,commit=/^[a-f0-9]{40}$/u,sg=/^sg-[a-f0-9]{8,17}$/u;
const imageUri=/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/u;
const roleArn=/^arn:aws:iam::967807252336:role\/[A-Za-z0-9_+=,.@/-]{1,512}$/u;
const secretVersion=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}:::[A-Za-z0-9-]{32,64}$/u;
const registryArn=/^arn:aws:servicediscovery:us-east-1:967807252336:service\/srv-[a-z0-9]{8,64}$/u;
const logGroup=/^\/[A-Za-z0-9_./-]{1,511}$/u;
const materialPath=/^\/run\/meri\/[A-Za-z0-9._-]{1,128}$/u;
const digestOf=uri=>`sha256:${uri.split('@sha256:')[1]}`;
export const serviceArn=name=>`arn:aws:ecs:${REGION}:${ACCOUNT}:service/capiro-dev/${name}`;
export const repositoryArn=uri=>`arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${uri.slice(uri.indexOf('/')+1,uri.indexOf('@'))}`;

/** Same static material-init contract as manifest.mjs: exact-version bundle
 * secret plus an independently pinned expected inventory whose config entry
 * equals the container's startup config digest. */
function material(value,service,image,configSha256){
 const m=object(value,['valueFrom','expected']);match(m.valueFrom,secretVersion);
 const e=object(m.expected,['schemaVersion','role','runtimeUser','sourceCommit','imageDigest','materialContractSha256','sha256ByPath']);
 const paths=Object.keys(object(e.sha256ByPath,Object.keys(e.sha256ByPath??{})));
 if(e.schemaVersion!==1||e.role!==service.materialRole||e.runtimeUser!==service.runtimeUser||
    e.sourceCommit!==image.sourceCommit||e.imageDigest!==digestOf(image.uri)||!hex64.test(e.materialContractSha256)||
    paths.length<1||paths.length>20||paths.some(path=>!materialPath.test(path)||['/run/meri/.','/run/meri/..'].includes(path)||!hex64.test(e.sha256ByPath[path]))||
    e.sha256ByPath[service.configFile]!==configSha256||Buffer.byteLength(JSON.stringify(e),'utf8')>8192)fail();
 const {materialContractSha256,...contract}=e;
 if(canonicalSha256(contract)!==materialContractSha256)fail();
 return m;
}

export function planPrivateModelProxy(binding){
 const b=object(binding,['schema','account','region','placement','images','roles','logGroups','serviceDiscovery','network','material','startup','owner']);
 if(b.schema!=='meri.product-model-proxy.plan/2'||b.account!==ACCOUNT||b.region!==REGION)fail();
 const p=object(b.placement,['vpcId','clusterArn','privateSubnetIds']);
 if(p.vpcId!==MODEL_PROXY_EXISTING.vpcId||p.clusterArn!==MODEL_PROXY_EXISTING.clusterArn)fail();
 ids(p.privateSubnetIds,/^subnet-[a-f0-9]{8,17}$/u,2,3);

 const images=object(b.images,['proxy','nodeRuntime']);
 const proxyImage=object(images.proxy,['uri','sourceCommit','litellmVersion','upstreamDigest','reviewedScanSha256']);
 const nodeImage=object(images.nodeRuntime,['uri','sourceCommit','reviewedScanSha256']);
 match(proxyImage.uri,imageUri);match(nodeImage.uri,imageUri);
 match(proxyImage.sourceCommit,commit);match(nodeImage.sourceCommit,commit);
 match(proxyImage.reviewedScanSha256,hex64);match(nodeImage.reviewedScanSha256,hex64);
 if(proxyImage.litellmVersion!==LITELLM.version||proxyImage.upstreamDigest!==LITELLM.upstreamDigest||
    digestOf(proxyImage.uri)===digestOf(nodeImage.uri)||digestOf(proxyImage.uri)===LITELLM.upstreamDigest)fail();

 const role=object(b.roles,['proxyExecutionRoleArn','proxyTaskRoleArn','ownerExecutionRoleArn','ownerTaskRoleArn']);
 distinct(Object.values(role).map(value=>match(value,roleArn)));
 const logs=object(b.logGroups,['proxy','owner']);
 distinct(Object.values(logs).map(value=>match(value,logGroup)));
 const discovery=object(b.serviceDiscovery,['proxyRegistryArn','ownerRegistryArn']);
 distinct(Object.values(discovery).map(value=>match(value,registryArn)));

 const n=object(b.network,['proxySecurityGroupId','ownerSecurityGroupId','dbClientSecurityGroupId','runnerSecurityGroupIds',
  'endpointSecurityGroupId','s3Gateway','bedrockRuntimeEndpoint']);
 ids(n.runnerSecurityGroupIds,sg);
 object(n.s3Gateway,['endpointId','prefixListId']);
 if(n.s3Gateway.endpointId!==MODEL_PROXY_EXISTING.s3Gateway.endpointId||n.s3Gateway.prefixListId!==MODEL_PROXY_EXISTING.s3Gateway.prefixListId)fail();
 const bedrockEndpoint=n.bedrockRuntimeEndpoint===null?null:object(n.bedrockRuntimeEndpoint,['endpointId','securityGroupId']);
 if(bedrockEndpoint){
  match(bedrockEndpoint.endpointId,/^vpce-[a-f0-9]{8,17}$/u);match(bedrockEndpoint.securityGroupId,sg);
  if(bedrockEndpoint.endpointId===n.s3Gateway.endpointId)fail();
 }
 // The interface endpoints share one SG; a bedrock-runtime endpoint may share it too.
 // Every Meri SG and the shared Aurora SG stay distinct from each other and from it.
 const meriGroups=[n.proxySecurityGroupId,n.ownerSecurityGroupId,n.dbClientSecurityGroupId,...n.runnerSecurityGroupIds];
 distinct([...meriGroups,n.endpointSecurityGroupId,MODEL_PROXY_EXISTING.auroraSecurityGroupId].map(value=>match(value,sg)));
 if(bedrockEndpoint&&[...meriGroups,MODEL_PROXY_EXISTING.auroraSecurityGroupId].includes(bedrockEndpoint.securityGroupId))fail();

 const startup=object(b.startup,['proxyConfigSha256','ownerConfigSha256']);
 match(startup.proxyConfigSha256,hex64);match(startup.ownerConfigSha256,hex64);
 if(startup.proxyConfigSha256===startup.ownerConfigSha256)fail();
 const m=object(b.material,['proxy','owner']);
 material(m.proxy,MODEL_PROXY_SERVICES.proxy,proxyImage,startup.proxyConfigSha256);
 material(m.owner,MODEL_PROXY_SERVICES.owner,nodeImage,startup.ownerConfigSha256);
 if(m.proxy.valueFrom===m.owner.valueFrom||
    m.proxy.valueFrom.slice(0,m.proxy.valueFrom.lastIndexOf(':::'))===m.owner.valueFrom.slice(0,m.owner.valueFrom.lastIndexOf(':::')))fail();
 const owner=object(b.owner,['budgetNamespace']);
 if(owner.budgetNamespace!=='meri_product_budget')fail();

 const P=MODEL_PROXY_SERVICES.proxy,O=MODEL_PROXY_SERVICES.owner,S3=MODEL_PROXY_EXISTING.s3Gateway.prefixListId;
 const db=MODEL_PROXY_EXISTING.auroraSecurityGroupId,port=MODEL_PROXY_EXISTING.auroraPort;
 const rule=(groupId,toPort,peer,purpose)=>({groupId,protocol:'tcp',port:toPort,...peer,purpose});
 const rules={
  ingress:[
   ...n.runnerSecurityGroupIds.map(id=>rule(n.proxySecurityGroupId,P.port,{sourceSecurityGroupId:id},'runner to proxy TLS via proxy.meri.internal')),
   rule(n.ownerSecurityGroupId,O.port,{sourceSecurityGroupId:n.proxySecurityGroupId},'proxy to owner mTLS via owner.meri.internal'),
   rule(db,port,{sourceSecurityGroupId:n.dbClientSecurityGroupId},'dbClient marker to existing Aurora (one foundation rule)'),
   ...(bedrockEndpoint?[rule(bedrockEndpoint.securityGroupId,443,{sourceSecurityGroupId:n.proxySecurityGroupId},'proxy to bedrock-runtime endpoint')]:[])],
  egress:[
   ...n.runnerSecurityGroupIds.map(id=>rule(id,P.port,{destinationSecurityGroupId:n.proxySecurityGroupId},'runner to proxy TLS')),
   rule(n.proxySecurityGroupId,O.port,{destinationSecurityGroupId:n.ownerSecurityGroupId},'proxy to owner mTLS'),
   ...[n.proxySecurityGroupId,n.ownerSecurityGroupId].flatMap(id=>[
    rule(id,443,{destinationSecurityGroupId:n.endpointSecurityGroupId},'ECR, Logs, Secrets Manager interface endpoints'),
    rule(id,443,{destinationPrefixListId:S3},'existing S3 gateway for ECR image layers')]),
   rule(n.proxySecurityGroupId,443,{cidrIp:'0.0.0.0/0'},
    bedrockEndpoint?'ECS/EC2 API via NAT (no ECS endpoint)':'Bedrock Runtime and ECS/EC2 API via NAT (no bedrock or ECS endpoint)'),
   ...(bedrockEndpoint?[rule(n.proxySecurityGroupId,443,{destinationSecurityGroupId:bedrockEndpoint.securityGroupId},'bedrock-runtime endpoint')]:[]),
   rule(n.ownerSecurityGroupId,443,{cidrIp:'0.0.0.0/0'},'D6: ECS/EC2 API and Core native currentness via NAT'),
   rule(n.ownerSecurityGroupId,port,{destinationSecurityGroupId:db},'owner budget ledger on existing Aurora')]
 };

 const observer=Object.freeze({
  describeServices:[serviceArn(P.serviceName),serviceArn(O.serviceName)],
  describeTasks:`arn:aws:ecs:${REGION}:${ACCOUNT}:task/capiro-dev/*`,
  listTasks:{resource:'*',condition:{ArnEquals:{'ecs:cluster':MODEL_PROXY_EXISTING.clusterArn}}},
  unscoped:['ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces']});

 return freezeTree(structuredClone({
  schema:'meri.product-model-proxy.resources/2',desiredCount:0,
  placement:{clusterArn:p.clusterArn,vpcId:p.vpcId,privateSubnetIds:[...p.privateSubnetIds],
   assignPublicIp:false,platformVersion:'1.4.0',readonlyRootFilesystem:true,sizing:{...SIZING}},
  services:{
   proxy:{...P,serviceArn:serviceArn(P.serviceName),origin:`https://${P.hostname}:${P.port}`,image:proxyImage.uri,initImage:nodeImage.uri,
    securityGroupIds:[n.proxySecurityGroupId],registryArn:discovery.proxyRegistryArn,logGroupName:logs.proxy,
    executionRoleArn:role.proxyExecutionRoleArn,taskRoleArn:role.proxyTaskRoleArn,
    configSha256:startup.proxyConfigSha256,material:m.proxy},
   owner:{...O,serviceArn:serviceArn(O.serviceName),origin:`https://${O.hostname}:${O.port}`,image:nodeImage.uri,initImage:nodeImage.uri,
    securityGroupIds:[n.ownerSecurityGroupId,n.dbClientSecurityGroupId],registryArn:discovery.ownerRegistryArn,logGroupName:logs.owner,
    executionRoleArn:role.ownerExecutionRoleArn,taskRoleArn:role.ownerTaskRoleArn,
    configSha256:startup.ownerConfigSha256,material:m.owner}},
  listener:{transport:'direct-tcp',port:P.port,name:P.hostname,loadBalancer:null,
   tlsTermination:'proxy-task-only',
   admissionProof:{bearer:'opaque-task-bound-sha256',source:'direct-tls-socket-ipv4',
    lease:'fresh-ecs-task-eni-current-join',recheck:['before-admission','before-provider-send']}},
  network:{
   bedrockPath:bedrockEndpoint?{kind:'interface-endpoint',...bedrockEndpoint}:{kind:'nat',port:443},
   s3Gateway:{...MODEL_PROXY_EXISTING.s3Gateway,reused:true},
   endpointSecurityGroupId:n.endpointSecurityGroupId,
   foundationOwnedRules:rules,requiresNoRunnerBedrockEgress:true},
  images:{proxy:{...proxyImage},nodeRuntime:{...nodeImage}},roles:{...role},
  owner:{budgetNamespace:owner.budgetNamespace,origin:`https://${O.hostname}:${O.port}`},
  iam:{proxyRole:{
   actions:['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],
   profile:PROFILE,profileSourceRegion:'us-east-1',foundations:FOUNDATIONS,
   foundationCondition:{'bedrock:InferenceProfileArn':PROFILE}},
   countTokens:{action:'bedrock:CountTokens',foundation:FOUNDATIONS[0]},
   observer,observerRoles:['proxyTaskRoleArn','ownerTaskRoleArn'],
   runnerProviderActions:[]},
  routes:{public:[],worker:['POST /v1/messages?beta=true',
                            'POST /v1/messages/count_tokens?beta=true'],
   management:[]},
 }));
}
