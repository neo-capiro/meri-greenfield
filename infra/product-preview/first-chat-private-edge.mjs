/** Stage 2b: the private TLS front for control's private 8082 listener. Control's private HTTP requires an
 * x-forwarded-for proxy hop and its callers (runner poststart, temporal-worker native client) speak HTTPS to
 * one pinned private origin, so an internal ALB terminates TLS with the imported control-private leaf
 * (signed by the Meri preview server CA) and forwards to 8082. Source only: no AWS calls. */
import {App,Stack,CfnOutput,BootstraplessSynthesizer,aws_ec2 as ec2,aws_elasticloadbalancingv2 as elbv2,aws_route53 as route53} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

const ACCOUNT='967807252336',REGION='us-east-1',ZONE='meri-preview.internal',HOST=`control.${ZONE}`;
const fail=()=>{throw Error('FIRST_CHAT_PRIVATE_EDGE_BINDING_REFUSED');};
const sg=/^sg-[a-f0-9]{8,17}$/u;
function closed(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    keys.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!keys.includes(k)))fail();
 return value;
}
export const CONTROL_PRIVATE_ORIGIN=`https://${HOST}`;
export function validatePrivateEdgeBinding(value){
 const b=closed(value,['vpcId','privateSubnetIds','certificateArn','controlSecurityGroupId','clientSecurityGroupIds']);
 if(!/^vpc-[a-f0-9]{8,17}$/u.test(b.vpcId)||!Array.isArray(b.privateSubnetIds)||b.privateSubnetIds.length<2||
    !b.privateSubnetIds.every(s=>/^subnet-[a-f0-9]{8,17}$/u.test(s))||new Set(b.privateSubnetIds).size!==b.privateSubnetIds.length||
    !new RegExp(`^arn:aws:acm:${REGION}:${ACCOUNT}:certificate/[a-f0-9-]{36}$`,'u').test(b.certificateArn)||!sg.test(b.controlSecurityGroupId)||
    !Array.isArray(b.clientSecurityGroupIds)||b.clientSecurityGroupIds.length<1||b.clientSecurityGroupIds.length>4||!b.clientSecurityGroupIds.every(x=>sg.test(x))||
    new Set(b.clientSecurityGroupIds).size!==b.clientSecurityGroupIds.length)fail();
 return b;
}
export function synthesizeFirstChatPrivateEdge(binding){
 const b=validatePrivateEdgeBinding(binding),app=new App({context:{'aws:cdk:version-reporting':false}});
 const stack=new Stack(app,'MeriFirstChatPrivateEdge',{env:{account:ACCOUNT,region:REGION},synthesizer:new BootstraplessSynthesizer()});
 const vpc=ec2.Vpc.fromVpcAttributes(stack,'Vpc',{vpcId:b.vpcId,availabilityZones:b.privateSubnetIds.map((_,i)=>`${REGION}${'abc'[i]}`),privateSubnetIds:b.privateSubnetIds});
 const control=ec2.SecurityGroup.fromSecurityGroupId(stack,'ControlSg',b.controlSecurityGroupId,{mutable:false});
 const albSg=new ec2.SecurityGroup(stack,'PrivateAlbSg',{vpc,allowAllOutbound:false,securityGroupName:'meri-preview-control-private-alb',description:'Meri control private TLS front'});
 b.clientSecurityGroupIds.forEach((id,i)=>{
  const client=ec2.SecurityGroup.fromSecurityGroupId(stack,`Client${i}`,id,{mutable:false});
  albSg.addIngressRule(client,ec2.Port.tcp(443),'pinned private control origin');
  new ec2.CfnSecurityGroupEgress(stack,`Client${i}ToPrivateAlb`,{groupId:id,ipProtocol:'tcp',fromPort:443,toPort:443,destinationSecurityGroupId:albSg.securityGroupId,description:'private control origin'});
 });
 albSg.addEgressRule(control,ec2.Port.tcp(8082),'forward to control private listener');
 new ec2.CfnSecurityGroupIngress(stack,'ControlFromPrivateAlb',{groupId:b.controlSecurityGroupId,ipProtocol:'tcp',fromPort:8082,toPort:8082,sourceSecurityGroupId:albSg.securityGroupId,description:'private TLS front'});
 const alb=new elbv2.CfnLoadBalancer(stack,'PrivateAlb',{name:'meri-preview-control-private',scheme:'internal',type:'application',ipAddressType:'ipv4',
  subnets:b.privateSubnetIds,securityGroups:[albSg.securityGroupId],
  loadBalancerAttributes:[{key:'routing.http.drop_invalid_header_fields.enabled',value:'true'},{key:'routing.http.xff_header_processing.mode',value:'append'},{key:'idle_timeout.timeout_seconds',value:'120'}]});
 const tg=new elbv2.CfnTargetGroup(stack,'ControlPrivateTargetGroup',{name:'meri-preview-control-8082',targetType:'ip',protocol:'HTTP',port:8082,vpcId:b.vpcId,
  healthCheckProtocol:'HTTP',healthCheckPath:'/health/live',healthCheckPort:'8082',healthCheckIntervalSeconds:15,healthyThresholdCount:2,unhealthyThresholdCount:3,
  matcher:{httpCode:'200'},targetGroupAttributes:[{key:'deregistration_delay.timeout_seconds',value:'30'}]});
 const listener=new elbv2.CfnListener(stack,'PrivateHttps',{loadBalancerArn:alb.ref,port:443,protocol:'HTTPS',sslPolicy:'ELBSecurityPolicy-TLS13-1-2-2021-06',
  certificates:[{certificateArn:b.certificateArn}],defaultActions:[{type:'fixed-response',fixedResponseConfig:{statusCode:'404',contentType:'application/json',messageBody:'{"error":"not_found"}'}}]});
 new elbv2.CfnListenerRule(stack,'PrivateHostForward',{listenerArn:listener.ref,priority:1,conditions:[{field:'host-header',hostHeaderConfig:{values:[HOST]}}],
  actions:[{type:'forward',targetGroupArn:tg.ref}]});
 const zone=new route53.CfnHostedZone(stack,'PrivateZone',{name:ZONE,vpcs:[{vpcId:b.vpcId,vpcRegion:REGION}],hostedZoneConfig:{comment:'Meri preview private origins'}});
 new route53.CfnRecordSet(stack,'ControlAlias',{hostedZoneId:zone.ref,name:`${HOST}.`,type:'A',aliasTarget:{dnsName:alb.attrDnsName,hostedZoneId:alb.attrCanonicalHostedZoneId,evaluateTargetHealth:false}});
 new CfnOutput(stack,'ControlPrivateOrigin',{value:CONTROL_PRIVATE_ORIGIN});
 new CfnOutput(stack,'ControlPrivateTargetGroupArn',{value:tg.ref});
 new CfnOutput(stack,'PrivateAlbSecurityGroupId',{value:albSg.securityGroupId});
 return Template.fromStack(stack).toJSON();
}
