import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {synthesizeFirstChatPrivateEdge,synthesizeOperatorPrivateEdge,validatePrivateEdgeBinding,CONTROL_PRIVATE_ORIGIN} from './first-chat-private-edge.mjs';

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

test('the private load balancer group carries no inline ingress, so rules other stacks add for their own clients are never reconciled away',()=>{
 const t=synthesizeFirstChatPrivateEdge(binding());
 const groups=Object.entries(t.Resources).filter(([,r])=>r.Type==='AWS::EC2::SecurityGroup');
 assert.ok(groups.length>=1);
 for(const [id,group] of groups)assert.equal(Object.hasOwn(group.Properties,'SecurityGroupIngress'),false,`${id} must not carry inline ingress`);
});
test('ordinary edge output equals the retained afca3ed5 production template',()=>{
 // Captured from the exact base module and independently deep-compared with the new constructor.
 assert.equal(createHash('sha256').update(JSON.stringify(synthesizeFirstChatPrivateEdge(binding()))).digest('hex'),
  '2dafa0fb3b5beb13f971073d265317408c3a11e7fa5e01ccf73d5477fc68ec42');
});
const caseBinding=()=>({caseId:'a123456789ab',vpcId:binding().vpcId,privateSubnetIds:binding().privateSubnetIds,
 certificateArn:binding().certificateArn.replace('6c790931','7c790931'),productionCertificateArn:binding().certificateArn});
test('case edge owns distinct groups and empty target group, reuses 8082 front, and never creates shared DNS',()=>{
 const b=caseBinding(),t=synthesizeOperatorPrivateEdge(b),next=synthesizeOperatorPrivateEdge({...b,caseId:'b123456789ab'});
 assert.ok(!Object.values(t.Resources).some(r=>r.Type.startsWith('AWS::Route53::')));
 assert.equal(of(t,'AWS::EC2::SecurityGroup').length,3);
 assert.ok(!JSON.stringify(t).includes('"sg-'),'no external security-group IDs are accepted');
 assert.ok(!JSON.stringify(t).includes('meri-preview-control'));
 const names=x=>Object.values(x.Resources).flatMap(r=>[r.Properties.Name,r.Properties.GroupName].filter(Boolean));
 assert.ok(names(t).every(n=>!names(next).includes(n)));assert.ok(names(t).every(n=>n.includes(b.caseId)));
 const [tg]=of(t,'AWS::ElasticLoadBalancingV2::TargetGroup');assert.equal(tg.Targets,undefined);assert.equal(tg.Port,8082);
 const [alb]=of(t,'AWS::ElasticLoadBalancingV2::LoadBalancer');assert.equal(alb.Scheme,'internal');
 assert.ok(alb.LoadBalancerAttributes.some(a=>a.Key==='routing.http.xff_header_processing.mode'&&a.Value==='append'));
 assert.deepEqual(of(t,'AWS::ElasticLoadBalancingV2::ListenerRule')[0].Conditions[0].HostHeaderConfig.Values,['control.meri-preview.internal']);
 for(const key of ['CaseControlSecurityGroupId','CaseClientSecurityGroupId','CasePrivateAlbArn','CasePrivateAlbDnsName','CaseCertificateArn','ControlPrivateTargetGroupArn'])assert.ok(t.Outputs[key]);
});
test('case edge refuses production cert, external group/target/DNS inputs and ambiguous names',()=>{
 for(const mutate of [b=>b.certificateArn=b.productionCertificateArn,b=>b.caseId='../shared',b=>b.controlSecurityGroupId=binding().controlSecurityGroupId,
  b=>b.targets=['10.0.0.1'],b=>b.hostedZoneId='shared',b=>b.privateSubnetIds=[]]){
  const b=caseBinding();mutate(b);assert.throws(()=>synthesizeOperatorPrivateEdge(b));
 }
});
