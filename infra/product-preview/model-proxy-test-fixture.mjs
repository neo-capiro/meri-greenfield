/** Synthetic capiro-dev binding for the model proxy plan/template tests.
 * Network IDs are the 17 Oct 2026 live inventory; ARNs, digests and secrets are synthetic. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';

export const sha=(c)=>c.repeat(64);
const secret=name=>`arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/product-preview/${name}-AbC123:::${'1'.repeat(8)}-2222-3333-4444-${'5'.repeat(12)}`;
const ecr='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker';
export function expected({role,runtimeUser,sourceCommit,imageUri,configFile,configSha256}){
 const contract={schemaVersion:1,role,runtimeUser,sourceCommit,imageDigest:`sha256:${imageUri.split('@sha256:')[1]}`,
  sha256ByPath:{[configFile]:configSha256,'/run/meri/server-cert.pem':sha('d'),'/run/meri/server-key.pem':sha('e')}};
 return {...contract,materialContractSha256:canonicalSha256(contract)};
}
/** Recompute the contract digest after a test mutates an expected inventory. */
export function reseal(value){
 const {materialContractSha256,...contract}=value;
 return {...contract,materialContractSha256:canonicalSha256(contract)};
}
export function binding(){
 const proxyUri=`${ecr}@sha256:0f60986be72a6d90340e8994f54cad18ffde91db7510ad73598dec865fc73b80`;
 const nodeUri=`${ecr}@sha256:6617b23650cc8cce973beac90c13f7c8231ccf3fbab4d4b4c44b26aea35c180c`;
 const proxyCommit='a'.repeat(40),nodeCommit='b'.repeat(40),proxyConfig=sha('7'),ownerConfig=sha('8');
 return {schema:'meri.product-model-proxy.plan/2',account:'967807252336',region:'us-east-1',
  placement:{vpcId:'vpc-0ac26cfac7ed972be',clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev',
   privateSubnetIds:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19']},
  images:{proxy:{uri:proxyUri,sourceCommit:proxyCommit,litellmVersion:'1.104.2',
    upstreamDigest:'sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500',reviewedScanSha256:sha('c')},
   nodeRuntime:{uri:nodeUri,sourceCommit:nodeCommit,reviewedScanSha256:sha('f')}},
  roles:{proxyExecutionRoleArn:'arn:aws:iam::967807252336:role/meri-preview-proxy-exec',
   proxyTaskRoleArn:'arn:aws:iam::967807252336:role/meri-preview-proxy-task',
   ownerExecutionRoleArn:'arn:aws:iam::967807252336:role/meri-preview-owner-exec',
   ownerTaskRoleArn:'arn:aws:iam::967807252336:role/meri-preview-owner-task'},
  logGroups:{proxy:'/meri/product-preview/proxy',owner:'/meri/product-preview/owner'},
  serviceDiscovery:{proxyRegistryArn:'arn:aws:servicediscovery:us-east-1:967807252336:service/srv-aaaaaaaaaaaaaaaa',
   ownerRegistryArn:'arn:aws:servicediscovery:us-east-1:967807252336:service/srv-bbbbbbbbbbbbbbbb'},
  network:{proxySecurityGroupId:'sg-0aaaaaaaaaaaaaaa1',ownerSecurityGroupId:'sg-0aaaaaaaaaaaaaaa2',
   dbClientSecurityGroupId:'sg-0aaaaaaaaaaaaaaa3',runnerSecurityGroupIds:['sg-0aaaaaaaaaaaaaaa4'],
   endpointSecurityGroupId:'sg-01def4e5c0fe44d4a',
   s3Gateway:{endpointId:'vpce-0cdaa6b79d616aa1c',prefixListId:'pl-63a5400a'},bedrockRuntimeEndpoint:null},
  material:{
   proxy:{valueFrom:secret('proxy-material'),expected:expected({role:'model-proxy',runtimeUser:'10001:10001',
    sourceCommit:proxyCommit,imageUri:proxyUri,configFile:'/run/meri/proxy.json',configSha256:proxyConfig})},
   owner:{valueFrom:secret('owner-material'),expected:expected({role:'model-owner',runtimeUser:'1000:1000',
    sourceCommit:nodeCommit,imageUri:nodeUri,configFile:'/run/meri/owner.json',configSha256:ownerConfig})}},
  startup:{proxyConfigSha256:proxyConfig,ownerConfigSha256:ownerConfig},
  owner:{budgetNamespace:'meri_product_budget'}};
}
