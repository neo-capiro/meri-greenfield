import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileHostListenerTemplate,validateHostListenerInput,HOST_LISTENER_PORT} from './host-listener-stack.mjs';
import {CONTROL_HOST_LISTENER_PORT} from '../../apps/runtime/browser-host-configuration.mjs';
import {compileProvisionedBrowserHostTemplate} from './provisioned-stack.mjs';

const input=()=>({vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',privateIpv4Address:'10.42.7.250',
 controlSecurityGroupId:'sg-0123456789abcdef0',hostSecurityGroupId:'sg-0fedcba9876543210',controlPort:CONTROL_HOST_LISTENER_PORT});

test('an internal TCP passthrough load balancer with one fixed private address and its own security group',()=>{
 const t=compileHostListenerTemplate(input());
 assert.deepEqual(Object.keys(t.Resources).sort(),['ControlFromHostListener','HostListener','HostListenerLoadBalancer','HostListenerSecurityGroup','HostListenerTargetGroup']);
 const lb=t.Resources.HostListenerLoadBalancer.Properties;
 assert.equal(lb.Type,'network');assert.equal(lb.Scheme,'internal');assert.equal(lb.IpAddressType,'ipv4');
 assert.deepEqual(lb.SubnetMappings,[{SubnetId:'subnet-0123456789abcdef0',PrivateIPv4Address:'10.42.7.250'}]);
 assert.deepEqual(lb.SecurityGroups,[{Ref:'HostListenerSecurityGroup'}]);
 assert.equal(lb.LoadBalancerAttributes.find(a=>a.Key==='load_balancing.cross_zone.enabled').Value,'true');
 assert.equal(lb.LoadBalancerAttributes.find(a=>a.Key==='deletion_protection.enabled').Value,'true');
 const listener=t.Resources.HostListener.Properties;
 assert.equal(listener.Protocol,'TCP');assert.equal(listener.Port,443,'TCP passthrough: the mTLS handshake terminates in Control, never at the balancer');
 assert.equal(JSON.stringify(t).includes('Certificates'),false);assert.equal(JSON.stringify(t).includes('SslPolicy'),false);
 const tg=t.Resources.HostListenerTargetGroup.Properties;
 assert.equal(tg.Protocol,'TCP');assert.equal(tg.TargetType,'ip');assert.equal(tg.Port,CONTROL_HOST_LISTENER_PORT);
 assert.equal(tg.TargetGroupAttributes.find(a=>a.Key==='preserve_client_ip.enabled').Value,'false');
 assert.equal(t.Outputs.HostListenerAddress.Value,'10.42.7.250');
});
test('hosts reach the listener on 443 only from the host group; the listener reaches Control on one port; Control accepts only that',()=>{
 const t=compileHostListenerTemplate(input());
 const sg=t.Resources.HostListenerSecurityGroup.Properties;
 assert.deepEqual(sg.SecurityGroupIngress.map(r=>[r.IpProtocol,r.FromPort,r.ToPort,r.SourceSecurityGroupId]),[['tcp',443,443,'sg-0fedcba9876543210']]);
 assert.deepEqual(sg.SecurityGroupEgress.map(r=>[r.IpProtocol,r.FromPort,r.ToPort,r.DestinationSecurityGroupId]),[['tcp',8443,8443,'sg-0123456789abcdef0']]);
 const control=t.Resources.ControlFromHostListener.Properties;
 assert.deepEqual([control.GroupId,control.FromPort,control.ToPort,control.SourceSecurityGroupId],['sg-0123456789abcdef0',8443,8443,{Ref:'HostListenerSecurityGroup'}]);
 assert.equal(JSON.stringify(t).includes('CidrIp'),false,'no CIDR rule anywhere');
});
test('the host group of the static stack may reach the listener: its egress covers TCP 443',()=>{
 const host=compileProvisionedBrowserHostTemplate({vpcId:'vpc-0123456789abcdef0',vpcCidr:'10.42.0.0/16',controlSecurityGroupId:'sg-0123456789abcdef0',
  imageRepository:'meri-greenfield/browser-host',logGroupName:'/meri-greenfield/browser-host'}).Resources.BrowserHostSecurityGroup.Properties;
 assert.equal(host.SecurityGroupEgress.some(r=>r.IpProtocol==='tcp'&&r.FromPort<=HOST_LISTENER_PORT&&r.ToPort>=HOST_LISTENER_PORT),true);
});
test('the Control port is exactly the rendered host-currentness listener port',()=>{
 for(const port of [80,443,1023,8080,8082,8083,70000,'8443',8443.5])
  assert.throws(()=>validateHostListenerInput({...input(),controlPort:port}),{code:'HOST_LISTENER_TEMPLATE_REFUSED'});
});
test('the input is closed and exact',()=>{
 for(const bad of [{...input(),extra:true},{...input(),vpcId:'sg-0123456789abcdef0'},{...input(),subnetId:'vpc-0123456789abcdef0'},
  {...input(),privateIpv4Address:'8.8.8.8'},{...input(),privateIpv4Address:'10.42.7.999'},{...input(),hostSecurityGroupId:'sg-0123456789abcdef0'},
  {...input(),controlSecurityGroupId:'subnet-0123456789abcdef0'}])
  assert.throws(()=>validateHostListenerInput(bad),{code:'HOST_LISTENER_TEMPLATE_REFUSED'});
 assert.throws(()=>compileHostListenerTemplate(null),{code:'HOST_LISTENER_TEMPLATE_REFUSED'});
});

test('omitting case identity preserves the accepted ordinary template bytes',()=>{
 // Recorded from accepted source 5c594d52 before this change, using the unchanged input fixture above.
 const bytes=JSON.stringify(compileHostListenerTemplate(input()));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'8b85fdae54769dec3857068892dcff5ea698a1aca9e5db0f17f7a6749016ddbc');
 assert.deepEqual(validateHostListenerInput(input()),input());
});

test('omitted case identity ignores an ambient inherited caseId',()=>{
 const prior=Object.getOwnPropertyDescriptor(Object.prototype,'caseId');
 try{
  Object.defineProperty(Object.prototype,'caseId',{value:'NOT-A-VALID-CASE',configurable:true});
  assert.equal(Object.hasOwn(validateHostListenerInput(input()),'caseId'),false);
  const t=compileHostListenerTemplate(input());
  for(const id of ['HostListenerLoadBalancer','HostListenerTargetGroup'])
   assert.equal(t.Resources[id].Properties.Name,'meri-preview-host-control');
  assert.equal(createHash('sha256').update(JSON.stringify(t)).digest('hex'),'8b85fdae54769dec3857068892dcff5ea698a1aca9e5db0f17f7a6749016ddbc');
 }finally{
  if(prior)Object.defineProperty(Object.prototype,'caseId',prior);
  else Reflect.deleteProperty(Object.prototype,'caseId');
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype,'caseId'),prior);
 }
});

test('case identity changes only the two physical names and isolates them from ordinary and callback resources',()=>{
 const ordinary=compileHostListenerTemplate(input()),names=[];
 for(const caseId of ['a123456789ab','b123456789ab']){
  const t=compileHostListenerTemplate({...input(),caseId}),copy=structuredClone(t),name=`meri-case-${caseId}-host`;
  assert.equal(validateHostListenerInput({...input(),caseId}).caseId,caseId);
  for(const id of ['HostListenerLoadBalancer','HostListenerTargetGroup']){
   assert.equal(t.Resources[id].Properties.Name,name);
   assert.match(name,/^[a-zA-Z0-9][a-zA-Z0-9-]{0,30}[a-zA-Z0-9]$/u);
   assert.notEqual(name,ordinary.Resources[id].Properties.Name);
   copy.Resources[id].Properties.Name=ordinary.Resources[id].Properties.Name;
  }
  for(const suffix of ['alb','8082','control','worker'])assert.notEqual(name,`meri-case-${caseId}-${suffix}`);
  assert.deepEqual(copy,ordinary,'same private placement, scoped SGs, TCP443 passthrough to mandatory8443, new empty TG and outputs');
  assert.equal(Object.hasOwn(t.Resources.HostListenerTargetGroup.Properties,'Targets'),false);
  names.push(name);
 }
 assert.equal(new Set(names).size,2);
});

test('malformed case identity, ordinary naming overrides and changed network boundaries fail closed',()=>{
 const refused={code:'HOST_LISTENER_TEMPLATE_REFUSED'},caseInput={...input(),caseId:'a123456789ab'};
 for(const caseId of [undefined,null,'',false,123456789012,{},[],new String('a123456789ab'),'preview','meri-preview-host-control','a123456789a','a123456789abc','A123456789AB','a123456789ag','a123456789ab\n'])
  assert.throws(()=>compileHostListenerTemplate({...input(),caseId}),refused);
 for(const extra of ['loadBalancerName','targetGroupName','targetGroupArn','HostListenerTargetGroupArn'])
  assert.throws(()=>compileHostListenerTemplate({...caseInput,[extra]:'meri-preview-host-control'}),refused);
 for(const change of [{controlPort:8082},{controlPort:443},{privateIpv4Address:'8.8.8.8'},
  {hostSecurityGroupId:input().controlSecurityGroupId},{subnetId:input().vpcId}])
  assert.throws(()=>compileHostListenerTemplate({...caseInput,...change}),refused);
 assert.throws(()=>compileHostListenerTemplate(Object.assign(Object.create({caseId:'a123456789ab'}),input())),refused);
 assert.throws(()=>compileHostListenerTemplate({...caseInput,[Symbol('name')]:'meri-preview-host-control'}),refused);
 const accessor={...input()};Object.defineProperty(accessor,'caseId',{enumerable:true,get(){throw Error('must not read accessor');}});
 assert.throws(()=>compileHostListenerTemplate(accessor),refused);
});
