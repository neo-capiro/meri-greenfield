/** Review-only CloudFormation shape for the private product model proxy.
 * Every resource is behind an unsatisfiable condition. This module performs
 * no AWS lookup, credential read or deployment, and cannot enable a service.
 */
import {planPrivateModelProxy} from './model-proxy-plan.mjs';

const CONDITION='ProductProxyDisabled';
const PROFILE='arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6';
const FOUNDATIONS=['us-east-1','us-east-2','us-west-2'].map(region=>
 `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-sonnet-4-6`);
const ref=name=>({'Ref':name});
const getAtt=(name,attribute)=>({'Fn::GetAtt':[name,attribute]});
const resource=(type,properties)=>({Type:type,Condition:CONDITION,Properties:properties});
const roleName=arn=>arn.slice(arn.lastIndexOf('/')+1);
const secretArn=valueFrom=>valueFrom.slice(0,valueFrom.lastIndexOf(':::'));

export function synthesizeDisabledModelProxyTemplate(binding){
 const plan=planPrivateModelProxy(binding);
 const p=plan.placement,n=plan.network,m=plan.material,r=plan.roles;
 const role=roleName(r.proxyTaskRoleArn),execution=roleName(r.executionRoleArn);
 const rules={};
 let index=0;
 for(const edge of n.ingress){
  for(const from of edge.from){
   const name=`NetworkRule${++index}`;
   rules[name]=resource('AWS::EC2::SecurityGroupIngress',{
     GroupId:edge.to,IpProtocol:'tcp',FromPort:edge.port,ToPort:edge.port,
     SourceSecurityGroupId:from,Description:'Reviewed private model-proxy edge'
    });
  }
 }
 for(const edge of n.egress){
  for(const to of Array.isArray(edge.to)?edge.to:[edge.to]){
   const name=`NetworkRule${++index}`;
   rules[name]=resource('AWS::EC2::SecurityGroupEgress',{
    GroupId:edge.from,IpProtocol:'tcp',FromPort:edge.port,ToPort:edge.port,
    DestinationSecurityGroupId:to,Description:'Reviewed private model-proxy edge'
   });
  }
 }
 return structuredClone({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'DISABLED review shape only: Meri private model proxy; no resource can activate',
  Metadata:{SourceSchema:plan.schema,Enabled:false,OneBudgetOwner:plan.owner.budgetNamespace,
   ImageSourceCommit:plan.image.sourceCommit,ImageScanSha256:plan.image.reviewedScanSha256,
    RequiredBeforeEnable:['assembled image and pinned LiteLLM wire',
     'pinned server TLS, opaque bearer hash, direct socket IPv4 and fresh ECS task/ENI lease',
    'native bounded asynchronous admission and process-supervisor qualification',
    'scoped ECS/EC2 observer IAM and policy simulation',
    'authenticated Python-to-JavaScript owner capture','new SG default-egress proof',
    'exact IAM role trust and policy simulation','private endpoint/DNS conflict check',
    'S3 gateway route tables and prefix-list match current subnet inventory',
    'reviewed material issuer and exact secret versions','shipping approval']},
  Conditions:{[CONDITION]:{'Fn::Equals':['false','true']}},
  Resources:{
   ModelProxyLogGroup:resource('AWS::Logs::LogGroup',{
    LogGroupName:'/capiro/meri/product-model-proxy',RetentionInDays:14}),
   ModelProxyBedrockEndpoint:resource('AWS::EC2::VPCEndpoint',{
    VpcId:p.vpcId,ServiceName:'com.amazonaws.us-east-1.bedrock-runtime',
    VpcEndpointType:'Interface',PrivateDnsEnabled:true,
    SubnetIds:p.privateSubnetIds,SecurityGroupIds:[binding.network.bedrockEndpointSecurityGroupId]}),
   ModelProxyS3Gateway:resource('AWS::EC2::VPCEndpoint',{
    VpcId:p.vpcId,ServiceName:n.s3LayerPath.service,VpcEndpointType:'Gateway',
    RouteTableIds:n.s3LayerPath.routeTableIds,
    PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:'*',
     Action:'s3:GetObject',Resource:n.s3LayerPath.layerBucketArn}]}}),
   ModelProxyS3LayerEgress:resource('AWS::EC2::SecurityGroupEgress',{
    GroupId:binding.network.proxySecurityGroupId,IpProtocol:'tcp',FromPort:443,ToPort:443,
    DestinationPrefixListId:n.s3LayerPath.prefixListId,
    Description:'Only ECR image-layer S3 gateway prefix list'}),
   ModelProxyNlb:resource('AWS::ElasticLoadBalancingV2::LoadBalancer',{
    Type:'network',Scheme:'internal',IpAddressType:'ipv4',
    Subnets:p.privateSubnetIds,SecurityGroups:[binding.network.nlbSecurityGroupId]}),
   ModelProxyTargetGroup:resource('AWS::ElasticLoadBalancingV2::TargetGroup',{
    VpcId:p.vpcId,Protocol:'TCP',Port:8443,TargetType:'ip',
    HealthCheckProtocol:'TCP',HealthCheckPort:'8443',
    TargetGroupAttributes:[{Key:'preserve_client_ip.enabled',Value:'true'}]}),
   ModelProxyTcpListener:resource('AWS::ElasticLoadBalancingV2::Listener',{
    LoadBalancerArn:ref('ModelProxyNlb'),Protocol:'TCP',Port:443,
    DefaultActions:[{Type:'forward',TargetGroupArn:ref('ModelProxyTargetGroup')}]}),
   ModelProxyProviderPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[role],PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],
      Resource:PROFILE,Condition:{StringEquals:{'aws:RequestedRegion':'us-east-1'}}},
     {Effect:'Allow',Action:['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],
      Resource:FOUNDATIONS,Condition:{ArnEquals:{'bedrock:InferenceProfileArn':PROFILE}}},
     {Effect:'Allow',Action:'bedrock:CountTokens',Resource:FOUNDATIONS[0]},
     {Effect:'Allow',Action:'bedrock:GetInferenceProfile',Resource:PROFILE}
    ]}}),
   ModelProxyExecutionPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[execution],PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:'ecr:GetAuthorizationToken',Resource:'*'},
     {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:GetDownloadUrlForLayer','ecr:BatchGetImage'],
      Resource:`arn:aws:ecr:us-east-1:967807252336:repository/${plan.image.uri.split('/').slice(1).join('/').split('@')[0]}`},
     {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:getAtt('ModelProxyLogGroup','Arn')},
     {Effect:'Allow',Action:'secretsmanager:GetSecretValue',Resource:[
       secretArn(m.serverTls.valueFrom),secretArn(m.ownerBridgeClient.valueFrom)]}
    ]}}),
   ModelProxyTask:resource('AWS::ECS::TaskDefinition',{
    RequiresCompatibilities:['FARGATE'],NetworkMode:'awsvpc',Cpu:'1024',Memory:'2048',
    EphemeralStorage:{SizeInGiB:21},ExecutionRoleArn:r.executionRoleArn,TaskRoleArn:r.proxyTaskRoleArn,
    ContainerDefinitions:[{Name:'model-proxy',Image:plan.image.uri,Essential:true,
     User:'1000:1000',ReadonlyRootFilesystem:true,
     PortMappings:[{ContainerPort:8443,Protocol:'tcp'}],
     Environment:[{Name:'CAPIRO_PRODUCT_PROXY_ENABLED',Value:'false'},
      {Name:'CAPIRO_PRODUCT_BUDGET_OWNER',Value:plan.owner.budgetNamespace},
      {Name:'CAPIRO_PRODUCT_OWNER_ORIGIN',Value:plan.owner.fixedOrigin}],
     Secrets:[{Name:'CAPIRO_PROXY_SERVER_TLS',ValueFrom:m.serverTls.valueFrom},
      {Name:'CAPIRO_PROXY_OWNER_CLIENT',ValueFrom:m.ownerBridgeClient.valueFrom}],
     LogConfiguration:{LogDriver:'awslogs',Options:{'awslogs-group':ref('ModelProxyLogGroup'),
      'awslogs-region':'us-east-1','awslogs-stream-prefix':'model-proxy'}}}]}),
   ModelProxyService:{...resource('AWS::ECS::Service',{
    Cluster:p.clusterArn,TaskDefinition:ref('ModelProxyTask'),DesiredCount:0,
    LaunchType:'FARGATE',EnableExecuteCommand:false,
    NetworkConfiguration:{AwsvpcConfiguration:{AssignPublicIp:'DISABLED',
     Subnets:p.privateSubnetIds,SecurityGroups:[binding.network.proxySecurityGroupId]}},
    LoadBalancers:[{TargetGroupArn:ref('ModelProxyTargetGroup'),
     ContainerName:'model-proxy',ContainerPort:8443}]}),
    DependsOn:['ModelProxyTcpListener','ModelProxyProviderPolicy','ModelProxyExecutionPolicy']},
   ...rules,
  },
  Outputs:{},
 });
}
