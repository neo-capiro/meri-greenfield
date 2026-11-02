import test from 'node:test';
import assert from 'node:assert/strict';
import {compileNativeWorkerRoleTemplate,compileNativeObserverPrerequisitesTemplate,validateNativeObserverPrerequisitesInput,
 NATIVE_WORKER_TASK_ROLE_NAME,NATIVE_OBSERVER_LOG_GROUP} from './native-prerequisites.mjs';

const input=()=>({vpcId:'vpc-0123456789abcdef0',privateAlbSecurityGroupId:'sg-0123456789abcdef0',endpointSecurityGroupId:'sg-0fedcba9876543210'});

test('the worker task role is trust only, with the foundation ECS trust, and no inline or managed policy',()=>{
 const role=compileNativeWorkerRoleTemplate().Resources.NativeWorkerTaskRole;
 assert.equal(role.Properties.RoleName,NATIVE_WORKER_TASK_ROLE_NAME);
 assert.equal(Object.hasOwn(role.Properties,'Policies'),false);assert.equal(Object.hasOwn(role.Properties,'ManagedPolicyArns'),false);
 const [statement]=role.Properties.AssumeRolePolicyDocument.Statement;
 assert.deepEqual(statement.Principal,{Service:'ecs-tasks.amazonaws.com'});
 assert.deepEqual(statement.Condition,{StringEquals:{'aws:SourceAccount':'967807252336'},ArnLike:{'aws:SourceArn':'arn:aws:ecs:us-east-1:967807252336:*'}});
 assert.notEqual(NATIVE_WORKER_TASK_ROLE_NAME,'MeriPreview-control-task','the renderer refuses the control task role');
});
test('the observer prerequisites hold a rotating key, a retained log group, a no-ingress group and one private load balancer rule',()=>{
 const t=compileNativeObserverPrerequisitesTemplate(input());
 assert.deepEqual(Object.keys(t.Resources).sort(),['NativeObserverKey','NativeObserverKeyAlias','NativeObserverLogGroup','NativeObserverSecurityGroup','PrivateAlbFromNativeObserver']);
 assert.equal(t.Resources.NativeObserverKey.Properties.EnableKeyRotation,true);
 assert.equal(t.Resources.NativeObserverKey.DeletionPolicy,'Retain');
 assert.equal(t.Resources.NativeObserverLogGroup.Properties.LogGroupName,NATIVE_OBSERVER_LOG_GROUP);
 const sg=t.Resources.NativeObserverSecurityGroup.Properties;
 assert.equal(Object.hasOwn(sg,'SecurityGroupIngress'),false,'the bridge accepts no inbound connection');
 assert.deepEqual(sg.SecurityGroupEgress.map(r=>[r.IpProtocol,r.FromPort,r.ToPort,r.DestinationSecurityGroupId]),
  [['tcp',443,443,'sg-0123456789abcdef0'],['tcp',443,443,'sg-0fedcba9876543210']]);
 const rule=t.Resources.PrivateAlbFromNativeObserver.Properties;
 assert.deepEqual([rule.GroupId,rule.FromPort,rule.ToPort,rule.SourceSecurityGroupId],['sg-0123456789abcdef0',443,443,{Ref:'NativeObserverSecurityGroup'}]);
 assert.equal(JSON.stringify(t).includes('CidrIp'),false);
 assert.equal(/SecretString|password|BEGIN|PRIVATE KEY/iu.test(JSON.stringify(t.Resources)),false,'no key material in any template');
});
test('the observer log group, key and group outputs are the inputs the observer template names',()=>{
 const t=compileNativeObserverPrerequisitesTemplate(input());
 assert.deepEqual(Object.keys(t.Outputs).sort(),['NativeObserverKeyArn','NativeObserverLogGroupName','NativeObserverSecurityGroupId']);
 assert.match(NATIVE_OBSERVER_LOG_GROUP,/^\/[A-Za-z0-9/._-]{1,500}$/u);
});
test('the input is closed and exact',()=>{
 for(const bad of [{...input(),extra:1},{...input(),vpcId:'sg-0123456789abcdef0'},{...input(),endpointSecurityGroupId:'vpc-0123456789abcdef0'},
  {...input(),endpointSecurityGroupId:'sg-0123456789abcdef0'},{vpcId:'vpc-0123456789abcdef0'}])
  assert.throws(()=>validateNativeObserverPrerequisitesInput(bad),{code:'NATIVE_PREREQUISITES_TEMPLATE_REFUSED'});
 assert.throws(()=>compileNativeObserverPrerequisitesTemplate(null),{code:'NATIVE_PREREQUISITES_TEMPLATE_REFUSED'});
});
