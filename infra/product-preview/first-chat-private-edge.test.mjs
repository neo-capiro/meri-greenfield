import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeFirstChatPrivateEdge,validatePrivateEdgeBinding,CONTROL_PRIVATE_ORIGIN} from './first-chat-private-edge.mjs';

const binding=()=>({vpcId:'vpc-0ac26cfac7ed972be',privateSubnetIds:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19'],
 certificateArn:'arn:aws:acm:us-east-1:967807252336:certificate/6c790931-e953-41ac-acbe-51aff570f1ff',controlSecurityGroupId:'sg-05a350c100574b21f',
 clientSecurityGroupIds:['sg-098fc4f2ac89aa943','sg-00111cd0e475badfa','sg-05a350c100574b21f']});
const of=(t,type)=>Object.values(t.Resources).filter(r=>r.Type===type).map(r=>r.Properties);

test('binding is closed',()=>{
 assert.ok(validatePrivateEdgeBinding(binding()));
 for(const change of [b=>{b.extra=1;},b=>{b.certificateArn='arn:aws:acm:us-east-1:111111111111:certificate/x';},b=>{b.clientSecurityGroupIds=[];},b=>{b.privateSubnetIds=['subnet-0920665f91c905f01'];}]){
  const b=binding();change(b);assert.throws(()=>validatePrivateEdgeBinding(b),/FIRST_CHAT_PRIVATE_EDGE_BINDING_REFUSED/);}
});

test('internal-only TLS 1.3 front: host-matched forward to 8082, everything else 404, no CIDR ingress',()=>{
 const t=synthesizeFirstChatPrivateEdge(binding());
 const [alb]=of(t,'AWS::ElasticLoadBalancingV2::LoadBalancer');assert.equal(alb.Scheme,'internal');
 const [listener]=of(t,'AWS::ElasticLoadBalancingV2::Listener');
 assert.equal(listener.Protocol,'HTTPS');assert.equal(listener.SslPolicy,'ELBSecurityPolicy-TLS13-1-2-2021-06');assert.equal(listener.DefaultActions[0].Type,'fixed-response');assert.equal(listener.DefaultActions[0].FixedResponseConfig.StatusCode,'404');
 const [rule]=of(t,'AWS::ElasticLoadBalancingV2::ListenerRule');assert.deepEqual(rule.Conditions[0].HostHeaderConfig.Values,[new URL(CONTROL_PRIVATE_ORIGIN).hostname]);
 const [tg]=of(t,'AWS::ElasticLoadBalancingV2::TargetGroup');assert.equal(tg.Port,8082);
 const sgs=of(t,'AWS::EC2::SecurityGroup');assert.ok(sgs.every(g=>!(g.SecurityGroupIngress||[]).some(r=>r.CidrIp)&&!(g.SecurityGroupEgress||[]).some(r=>r.CidrIp)));
 assert.equal(of(t,'AWS::EC2::SecurityGroupEgress').length,4,'three client egress rules plus ALB to control');
 const [zone]=of(t,'AWS::Route53::HostedZone');assert.equal(zone.Name,'meri-preview.internal');assert.equal(zone.VPCs[0].VPCId,'vpc-0ac26cfac7ed972be');
});
