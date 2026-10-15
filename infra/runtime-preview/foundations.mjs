import {ref,sub,attr,tags,string,identifier,template} from './common.mjs';

/** New preview resources inside verified dedicated Meri VPC; never update existing SG/policies. */
export function buildFoundations() {
  const Parameters={VpcId:identifier('VPC'),PrivateSubnetA:identifier('subnet'),PrivateSubnetB:identifier('subnet'),ImageEndpointGroupId:identifier('security group'),S3PrefixListId:string('Verified regional S3 managed prefix list.','^pl-[a-f0-9]+$'),AvailabilityZoneA:string('Verified first AZ.','^us-east-1[a-z]$'),AvailabilityZoneB:string('Verified distinct second AZ.','^us-east-1[a-z]$'),PublicSubnetCidrA:string('Reviewed unused /24 inside VPC; no default.','^[0-9.]+/24$'),PublicSubnetCidrB:string('Reviewed disjoint unused /24 inside VPC; no default.','^[0-9.]+/24$'),CallerCidr:string('Actual reviewed frontend/caller IPv4 range; no wildcard.','^[0-9.]+/(?:[1-9]|[12][0-9]|3[0-2])$'),PrivateZoneName:string('New Meri-owned namespace; no legacy zone.','^meri-runtime-preview\\.internal$')};
  const Resources={};
  for(const name of ['Control','Poller','Runner','Proxy','Relay','Temporal','Database','SecretsEndpoint','EcsEndpoint','BedrockEndpoint','Alb']) Resources[name+'Group']={Type:'AWS::EC2::SecurityGroup',Properties:{GroupDescription:'New isolated Meri preview '+name,VpcId:ref('VpcId'),Tags:tags(),SecurityGroupEgress:[{IpProtocol:'tcp',FromPort:9,ToPort:9,CidrIp:'127.0.0.1/32',Description:'Inert rule suppresses default allow-all; explicit egress follows.'}]}};
  const edge=(name,from,to,port)=>{
    Resources[name+'Out']={Type:'AWS::EC2::SecurityGroupEgress',Properties:{GroupId:ref(from+'Group'),IpProtocol:'tcp',FromPort:port,ToPort:port,DestinationSecurityGroupId:ref(to+'Group')}};
    Resources[name+'In']={Type:'AWS::EC2::SecurityGroupIngress',Properties:{GroupId:ref(to+'Group'),IpProtocol:'tcp',FromPort:port,ToPort:port,SourceSecurityGroupId:ref(from+'Group')}};
  };
  edge('PublicControl','Alb','Control',8443);edge('CurrentAuthority','Control','Relay',8443);
  edge('ControlTask','Control','Runner',8443);edge('TaskControl','Runner','Control',8443);edge('TaskProxy','Runner','Proxy',8443);
  edge('ControlTemporal','Control','Temporal',7233);edge('PollerTemporal','Poller','Temporal',7233);edge('PollerControl','Poller','Control',8443);
  for(const name of ['Control','Proxy','Temporal'])edge(name+'Database',name,'Database',5432);
  for(const name of ['Control','Poller','Proxy','Temporal','Runner','Relay']){
    edge(name+'SecretsEndpoint',name,'SecretsEndpoint',443);
    Resources[name+'ImageOut']={Type:'AWS::EC2::SecurityGroupEgress',Properties:{GroupId:ref(name+'Group'),IpProtocol:'tcp',FromPort:443,ToPort:443,DestinationSecurityGroupId:ref('ImageEndpointGroupId')}};
    Resources[name+'ImageLayersOut']={Type:'AWS::EC2::SecurityGroupEgress',Properties:{GroupId:ref(name+'Group'),IpProtocol:'tcp',FromPort:443,ToPort:443,DestinationPrefixListId:ref('S3PrefixListId')}};
  }
  edge('ControlEcsApi','Control','EcsEndpoint',443);edge('ProxyBedrockApi','Proxy','BedrockEndpoint',443);
  Resources.RelayInternetOut={Type:'AWS::EC2::SecurityGroupEgress',Properties:{GroupId:ref('RelayGroup'),IpProtocol:'tcp',FromPort:443,ToPort:443,CidrIp:'0.0.0.0/0',Description:'P1 approval: trusted exact-host TLS relay only; no arbitrary CONNECT.'}};
  Resources.PublicIngress={Type:'AWS::EC2::SecurityGroupIngress',Properties:{GroupId:ref('AlbGroup'),IpProtocol:'tcp',FromPort:443,ToPort:443,CidrIp:ref('CallerCidr')}};
  Resources.InternetGateway={Type:'AWS::EC2::InternetGateway',Properties:{Tags:tags()}};
  Resources.InternetAttachment={Type:'AWS::EC2::VPCGatewayAttachment',Properties:{VpcId:ref('VpcId'),InternetGatewayId:ref('InternetGateway')}};
  Resources.PublicRoutes={Type:'AWS::EC2::RouteTable',Properties:{VpcId:ref('VpcId'),Tags:tags()}};
  Resources.PublicDefaultRoute={Type:'AWS::EC2::Route',DependsOn:'InternetAttachment',Properties:{RouteTableId:ref('PublicRoutes'),DestinationCidrBlock:'0.0.0.0/0',GatewayId:ref('InternetGateway')}};
  for(const suffix of ['A','B']){
    Resources['PublicSubnet'+suffix]={Type:'AWS::EC2::Subnet',Properties:{VpcId:ref('VpcId'),CidrBlock:ref('PublicSubnetCidr'+suffix),AvailabilityZone:ref('AvailabilityZone'+suffix),MapPublicIpOnLaunch:false,Tags:tags()}};
    Resources['PublicRouteAssociation'+suffix]={Type:'AWS::EC2::SubnetRouteTableAssociation',Properties:{SubnetId:ref('PublicSubnet'+suffix),RouteTableId:ref('PublicRoutes')}};
  }
  const principals={Ecs:[sub('arn:${AWS::Partition}:iam::${AWS::AccountId}:role/meri-runtime-preview-control')],Bedrock:[sub('arn:${AWS::Partition}:iam::${AWS::AccountId}:role/meri-runtime-preview-proxy')],Secrets:['control','poller','proxy','temporal','runner','relay'].map(n=>sub('arn:${AWS::Partition}:iam::${AWS::AccountId}:role/meri-runtime-preview-'+n+'-execution'))};
  for(const [name,service] of [['Ecs','ecs'],['Secrets','secretsmanager'],['Bedrock','bedrock-runtime']])Resources[name+'Endpoint']={Type:'AWS::EC2::VPCEndpoint',Properties:{VpcId:ref('VpcId'),VpcEndpointType:'Interface',ServiceName:sub('com.amazonaws.${AWS::Region}.'+service),SubnetIds:[ref('PrivateSubnetA'),ref('PrivateSubnetB')],SecurityGroupIds:[ref(name+'EndpointGroup')],PrivateDnsEnabled:true,PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:'*',Action:name==='Ecs'?['ecs:RunTask','ecs:TagResource','ecs:DescribeTaskDefinition','ecs:DescribeTasks','ecs:ListTasks','ecs:StopTask']:name==='Bedrock'?['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream','bedrock:CountTokens']:['secretsmanager:GetSecretValue'],Resource:'*',Condition:{ArnEquals:{'aws:PrincipalArn':principals[name]}}}]}}};
  Resources.PrivateZone={Type:'AWS::ServiceDiscovery::PrivateDnsNamespace',Properties:{Name:ref('PrivateZoneName'),Vpc:ref('VpcId'),Description:'New preview-only namespace; no legacy DNS import.',Tags:tags()}};
  const Outputs=Object.fromEntries(['Control','Poller','Runner','Proxy','Relay','Temporal','Database','SecretsEndpoint','EcsEndpoint','BedrockEndpoint','Alb'].map(name=>[name+'Group',{Value:attr(name+'Group','GroupId')} ]));
  for(const name of ['PrivateZone','PublicSubnetA','PublicSubnetB'])Outputs[name]={Value:ref(name)};
  return template('P1 source-only new Meri preview network; existing dedicated references stay external.',Parameters,Resources,Outputs);
}
