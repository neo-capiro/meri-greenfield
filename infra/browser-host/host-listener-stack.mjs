// @ts-check
/** Static CloudFormation source for the host-to-Control currentness path of the provisioned (native and browser-only) hosts.
 * Hosts verify the pinned listener at `bootstrapSpec.control.endpoint = {address:<private IP>, port:443, serverName}`, and a
 * Fargate task address changes on every deployment, so the one stable private address is an INTERNAL Network Load Balancer
 * with a fixed private IPv4 in one private subnet: TCP passthrough (the host mTLS handshake, client certificate included,
 * terminates in Control, never at the load balancer), cross-zone so a Control task in any zone is reachable. The load
 * balancer carries its own security group: hosts reach it on 443 only from the host security group; it reaches Control's
 * host-listener port only, and Control accepts that port only from it. The ECS service registration of Control (the
 * container port mapping and the `LoadBalancers` entry on the service) comes from the app stack: `stage3-deploy.mjs bindings
 * --host-listener-outputs` attaches the control container port to this stack's target group. No AWS client, secret
 * or deploy action lives here. */
import {CONTROL_HOST_LISTENER_PORT} from '../../apps/runtime/browser-host-configuration.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='HOST_LISTENER_TEMPLATE_REFUSED';
const ID=prefix=>new RegExp(`^${prefix}-[0-9a-f]{8,17}$`,'u');
const IPV4=/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u;
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};
export const HOST_LISTENER_PORT=443;

/** @param {unknown} raw */
export function validateHostListenerInput(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail(REFUSED);
 let v;
 try{v=own(raw,['controlPort','controlSecurityGroupId','hostSecurityGroupId','privateIpv4Address','subnetId','vpcId'],['caseId']);}
 catch{fail(REFUSED);}
 const isCase=Object.hasOwn(v,'caseId');
 if(isCase&&(typeof v.caseId!=='string'||!/^[a-f0-9]{12}$/u.test(v.caseId)))fail(REFUSED);
 const octets=typeof v.privateIpv4Address==='string'?v.privateIpv4Address.split('.').map(Number):[];
 const port=v.controlPort;
 if(typeof v.vpcId!=='string'||!ID('vpc').test(v.vpcId)||typeof v.subnetId!=='string'||!ID('subnet').test(v.subnetId)||
  typeof v.controlSecurityGroupId!=='string'||!ID('sg').test(v.controlSecurityGroupId)||typeof v.hostSecurityGroupId!=='string'||
  !ID('sg').test(v.hostSecurityGroupId)||v.hostSecurityGroupId===v.controlSecurityGroupId||
  typeof v.privateIpv4Address!=='string'||!IPV4.test(v.privateIpv4Address)||octets.length!==4||octets.some(o=>!Number.isInteger(o)||o>255)||
  port!==CONTROL_HOST_LISTENER_PORT)fail(REFUSED);   // the one port the rendered `browserHosts.bind` listens on
 return Object.freeze({vpcId:v.vpcId,subnetId:v.subnetId,privateIpv4Address:v.privateIpv4Address,controlSecurityGroupId:v.controlSecurityGroupId,
  hostSecurityGroupId:v.hostSecurityGroupId,controlPort:port,...(isCase?{caseId:v.caseId}:{})});
}

/** @param {unknown} input */
export function compileHostListenerTemplate(input){
 const b=validateHostListenerInput(input);
 // Same 12-hex identity/prefix as the isolated operator case. The short suffix stays within both ELB name limits;
 // case names cannot select ordinary or callback targets. Placement/SG ownership still comes from reviewed input.
 const name=Object.hasOwn(b,'caseId')?`meri-case-${b.caseId}-host`:'meri-preview-host-control';
 const tags=[{Key:'Project',Value:'meri-greenfield'},{Key:'meri',Value:'first-chat-preview'},{Key:'MeriHostPurpose',Value:'host-to-control-listener'}];
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri host-to-Control listener: internal TCP passthrough load balancer with one fixed private address, its own security group, and the Control ingress rule for it.',
  Resources:{
   HostListenerSecurityGroup:{Type:'AWS::EC2::SecurityGroup',Properties:{
    VpcId:b.vpcId,GroupDescription:'Meri host-to-Control listener: hosts in, Control host-listener port out',
    SecurityGroupIngress:[{IpProtocol:'tcp',FromPort:HOST_LISTENER_PORT,ToPort:HOST_LISTENER_PORT,SourceSecurityGroupId:b.hostSecurityGroupId,
     Description:'Provisioned hosts to the listener'}],
    SecurityGroupEgress:[{IpProtocol:'tcp',FromPort:b.controlPort,ToPort:b.controlPort,DestinationSecurityGroupId:b.controlSecurityGroupId,
     Description:'Listener to the Control host-listener port'}],Tags:tags}},
   ControlFromHostListener:{Type:'AWS::EC2::SecurityGroupIngress',Properties:{
    GroupId:b.controlSecurityGroupId,IpProtocol:'tcp',FromPort:b.controlPort,ToPort:b.controlPort,
    SourceSecurityGroupId:{Ref:'HostListenerSecurityGroup'},Description:'Host listener load balancer to the Control host-listener port'}},
   HostListenerLoadBalancer:{Type:'AWS::ElasticLoadBalancingV2::LoadBalancer',Properties:{
    Name:name,Type:'network',Scheme:'internal',IpAddressType:'ipv4',
    SubnetMappings:[{SubnetId:b.subnetId,PrivateIPv4Address:b.privateIpv4Address}],SecurityGroups:[{Ref:'HostListenerSecurityGroup'}],
    LoadBalancerAttributes:[{Key:'load_balancing.cross_zone.enabled',Value:'true'},{Key:'deletion_protection.enabled',Value:'true'}],Tags:tags}},
   HostListenerTargetGroup:{Type:'AWS::ElasticLoadBalancingV2::TargetGroup',Properties:{
    Name:name,TargetType:'ip',Protocol:'TCP',Port:b.controlPort,VpcId:b.vpcId,
    HealthCheckProtocol:'TCP',HealthCheckPort:'traffic-port',HealthCheckIntervalSeconds:10,HealthyThresholdCount:2,UnhealthyThresholdCount:2,
    TargetGroupAttributes:[{Key:'preserve_client_ip.enabled',Value:'false'},{Key:'proxy_protocol_v2.enabled',Value:'false'},
     {Key:'deregistration_delay.timeout_seconds',Value:'30'},{Key:'deregistration_delay.connection_termination.enabled',Value:'true'}],Tags:tags}},
   HostListener:{Type:'AWS::ElasticLoadBalancingV2::Listener',Properties:{
    LoadBalancerArn:{Ref:'HostListenerLoadBalancer'},Protocol:'TCP',Port:HOST_LISTENER_PORT,
    DefaultActions:[{Type:'forward',TargetGroupArn:{Ref:'HostListenerTargetGroup'}}]}},
  },
  Outputs:{
   HostListenerAddress:{Value:b.privateIpv4Address,Description:'bootstrapSpec.control.endpoint.address (port 443)'},
   HostListenerTargetGroupArn:{Value:{Ref:'HostListenerTargetGroup'},Description:'Attach the Control service container port to this target group with the control rollout'},
   HostListenerSecurityGroupId:{Value:{Ref:'HostListenerSecurityGroup'}},
   HostListenerLoadBalancerArn:{Value:{Ref:'HostListenerLoadBalancer'}},
  },
 });
}
