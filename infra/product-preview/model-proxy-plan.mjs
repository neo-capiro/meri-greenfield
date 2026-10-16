/** Disabled, exact-input resource plan for the separate private model proxy.
 * This is review data, not a deployable stack, lookup, credential source, or
 * inference endpoint. A separate approved CloudFormation change set must bind
 * every input to fresh inventory before any AWS write.
 */
const ACCOUNT='967807252336',REGION='us-east-1';
const PROFILE=`arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/us.anthropic.claude-sonnet-4-6`;
const FOUNDATIONS=['us-east-1','us-east-2','us-west-2'].map(region=>
 `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-sonnet-4-6`);
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

export function planPrivateModelProxy(binding){
 const b=object(binding,['schema','enabled','account','region','placement','image','roles','network','material','owner']);
 if(b.schema!=='meri.product-model-proxy.plan/1'||b.enabled!==false||b.account!==ACCOUNT||b.region!==REGION)fail();
 const p=object(b.placement,['vpcId','clusterArn','privateSubnetIds']);
 match(p.vpcId,/^vpc-[a-f0-9]{8,17}$/u);
 match(p.clusterArn,/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]{1,255}$/u);
 ids(p.privateSubnetIds,/^subnet-[a-f0-9]{8,17}$/u,2,3);
 const image=object(b.image,['uri','sourceCommit','litellmVersion','upstreamDigest','reviewedScanSha256']);
 match(image.uri,/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/u);
 match(image.sourceCommit,/^[a-f0-9]{40}$/u);
 if(image.litellmVersion!=='1.104.2'||image.upstreamDigest!==
     'sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500')fail();
 match(image.reviewedScanSha256,/^[a-f0-9]{64}$/u);
 const role=object(b.roles,['executionRoleArn','proxyTaskRoleArn','runnerTaskRoleArn']);
 distinct(Object.values(role).map(value=>match(value,
  /^arn:aws:iam::967807252336:role\/[A-Za-z0-9_+=,.@/-]{1,512}$/u)));
 const n=object(b.network,['runnerSecurityGroupIds','nlbSecurityGroupId','proxySecurityGroupId',
                           'ownerSecurityGroupId','bedrockEndpointSecurityGroupId','platformEndpointSecurityGroupIds',
                           'privateSubnetRouteTables','s3PrefixListId']);
 const sg=/^sg-[a-f0-9]{8,17}$/u;
 ids(n.runnerSecurityGroupIds,sg);
 ids(n.platformEndpointSecurityGroupIds,sg,4,4);
 const routeTables=object(n.privateSubnetRouteTables,p.privateSubnetIds);
 const routeTableIds=[...new Set(Object.values(routeTables).map(value=>match(value,/^rtb-[a-f0-9]{8,17}$/u)))];
 match(n.s3PrefixListId,/^pl-[a-f0-9]{8,17}$/u);
 distinct([...n.runnerSecurityGroupIds,...n.platformEndpointSecurityGroupIds,
           n.nlbSecurityGroupId,n.proxySecurityGroupId,n.ownerSecurityGroupId,
           n.bedrockEndpointSecurityGroupId].map(value=>match(value,sg)));
  const m=object(b.material,['serverTls','ownerBridgeClient']);
 const secret=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}:::[A-Za-z0-9-]{32,64}$/u;
 const materials=Object.values(m).map(value=>{
  object(value,['valueFrom','contentSha256']);
  match(value.valueFrom,secret);match(value.contentSha256,/^[a-f0-9]{64}$/u);
  return value.valueFrom;
 });
 distinct(materials);
 const owner=object(b.owner,['fixedOrigin','currentRunPort','budgetNamespace']);
 match(owner.fixedOrigin,/^https:\/\/[a-z0-9.-]+:8444$/u);
 if(owner.currentRunPort!=='authenticated-private-bridge'||owner.budgetNamespace!=='meri_product_budget')fail();

 return freezeTree(structuredClone({
  schema:'meri.product-model-proxy.resources/1',enabled:false,
  placement:Object.freeze({clusterArn:p.clusterArn,vpcId:p.vpcId,privateSubnetIds:[...p.privateSubnetIds],
   taskDesiredCount:0,assignPublicIp:false,taskUser:'1000:1000',readonlyRootFilesystem:true,
   sizing:{cpu:1024,memoryMiB:2048,ephemeralStorageGiB:21}}),
  listener:Object.freeze({scheme:'internal',type:'network',protocol:'TCP',port:443,
   targetProtocol:'TCP',targetPort:8443,targetType:'ip',preserveClientIp:true,
    tlsTermination:'proxy-task-only',
    admissionProof:{bearer:'opaque-task-bound-sha256',source:'direct-tls-socket-ipv4',
     lease:'fresh-ecs-task-eni-current-join',recheck:['before-admission','before-provider-send']},
   healthCheck:'TCP:8443',
   name:'model-proxy.meri-native.capiro.ai'}),
  network:Object.freeze({
   ingress:[{from:n.runnerSecurityGroupIds,to:n.nlbSecurityGroupId,port:443,protocol:'tcp'},
            {from:[n.nlbSecurityGroupId],to:n.proxySecurityGroupId,port:8443,protocol:'tcp'},
            {from:[n.proxySecurityGroupId],to:n.bedrockEndpointSecurityGroupId,port:443,protocol:'tcp'},
            {from:[n.proxySecurityGroupId],to:n.ownerSecurityGroupId,port:8444,protocol:'tcp'},
            ...n.platformEndpointSecurityGroupIds.map(to=>({from:[n.proxySecurityGroupId],to,port:443,protocol:'tcp'}))],
   egress:[...n.runnerSecurityGroupIds.map(from=>({from,to:n.nlbSecurityGroupId,port:443,protocol:'tcp'})),
           {from:n.nlbSecurityGroupId,to:n.proxySecurityGroupId,port:8443,protocol:'tcp'},
           {from:n.proxySecurityGroupId,to:n.bedrockEndpointSecurityGroupId,port:443,protocol:'tcp'},
           {from:n.proxySecurityGroupId,to:n.ownerSecurityGroupId,port:8444,protocol:'tcp'},
           ...n.platformEndpointSecurityGroupIds.map(to=>({from:n.proxySecurityGroupId,to,port:443,protocol:'tcp'}))],
   bedrockVpcEndpointService:'com.amazonaws.us-east-1.bedrock-runtime',
   platformEndpointServices:['ecr.api','ecr.dkr','logs','secretsmanager'].map((service,index)=>({
    service:`com.amazonaws.us-east-1.${service}`,
    securityGroupId:n.platformEndpointSecurityGroupIds[index]})),
   s3LayerPath:{service:'com.amazonaws.us-east-1.s3',routeTableIds,
    prefixListId:n.s3PrefixListId,
    layerBucketArn:'arn:aws:s3:::prod-us-east-1-starport-layer-bucket/*'},
   requiresNoNatModelEgress:true,requiresNoRunnerBedrockEgress:true}),
  image:Object.freeze({...image}),roles:Object.freeze({...role}),material:Object.freeze({...m}),
  owner:Object.freeze({...owner}),
  iam:Object.freeze({proxyRole:{
   actions:['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],
   profile:PROFILE,profileSourceRegion:'us-east-1',foundations:FOUNDATIONS,
   foundationCondition:{'bedrock:InferenceProfileArn':PROFILE}},
   countTokens:{action:'bedrock:CountTokens',foundation:FOUNDATIONS[0]},
   getInferenceProfile:{action:'bedrock:GetInferenceProfile',resource:PROFILE},
   runnerProviderActions:[]}),
  routes:Object.freeze({public:[],worker:['POST /v1/messages?beta=true',
                                          'POST /v1/messages/count_tokens?beta=true'],
   management:[]}),
 }));
}
