import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileNativeWorkerRoleTemplate,compileNativeObserverPrerequisitesTemplate,validateNativeObserverPrerequisitesInput,
 NATIVE_WORKER_TASK_ROLE_NAME,NATIVE_OBSERVER_LOG_GROUP,NATIVE_OBSERVER_KEY_ALIAS} from './native-prerequisites.mjs';

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

test('case prerequisites: omitted identity preserves accepted ordinary bytes and exports',()=>{
 // Recorded from accepted 664a75f5 before this change, with the unchanged synthetic fixture above.
 for(const raw of [input(),Object.assign(Object.create(null),input())]){
  const bytes=JSON.stringify(compileNativeObserverPrerequisitesTemplate(raw));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'1a3c72531485c150fbbcfb4722e4f499be85c8d2e0d333cbf6dbb65c65333413');
  assert.deepEqual(validateNativeObserverPrerequisitesInput(raw),input());
 }
 assert.equal(NATIVE_OBSERVER_KEY_ALIAS,'alias/meri-greenfield/native-observer');
 assert.equal(NATIVE_OBSERVER_LOG_GROUP,'/meri-greenfield/native-observer');
 assert.equal(NATIVE_WORKER_TASK_ROLE_NAME,'MeriPreview-native-worker-task');
});

test('case prerequisites: distinct names preserve resources, retention, security and output references',()=>{
 const ordinary=compileNativeObserverPrerequisitesTemplate(input()),aliases=[],logs=[];
 for(const caseId of ['a123456789ab','b123456789ab','000000000000','ffffffffffff']){
  const t=compileNativeObserverPrerequisitesTemplate({...input(),caseId}),copy=structuredClone(t);
  const alias=`alias/meri-case-${caseId}/native-observer`,log=`/meri-case-${caseId}/native-observer`;
  assert.equal(t.Resources.NativeObserverKeyAlias.Properties.AliasName,alias);
  assert.equal(t.Resources.NativeObserverLogGroup.Properties.LogGroupName,log);
  assert.notEqual(alias,NATIVE_OBSERVER_KEY_ALIAS);assert.notEqual(log,NATIVE_OBSERVER_LOG_GROUP);
  assert.deepEqual(t.Resources.NativeObserverKeyAlias.Properties.TargetKeyId,{Ref:'NativeObserverKey'});
  assert.deepEqual(t.Outputs.NativeObserverKeyArn.Value,{'Fn::GetAtt':['NativeObserverKey','Arn']});
  assert.deepEqual(t.Outputs.NativeObserverLogGroupName.Value,{Ref:'NativeObserverLogGroup'});
  assert.equal(t.Resources[t.Outputs.NativeObserverLogGroupName.Value.Ref].Properties.LogGroupName,log);
  for(const id of ['NativeObserverKey','NativeObserverLogGroup']){
   assert.equal(t.Resources[id].DeletionPolicy,'Retain');assert.equal(t.Resources[id].UpdateReplacePolicy,'Retain');
  }
  assert.equal(t.Resources.NativeObserverLogGroup.Properties.RetentionInDays,30);
  copy.Resources.NativeObserverKeyAlias.Properties.AliasName=NATIVE_OBSERVER_KEY_ALIAS;
  copy.Resources.NativeObserverLogGroup.Properties.LogGroupName=NATIVE_OBSERVER_LOG_GROUP;
  assert.deepEqual(copy,ordinary,'only two physical names change; all five resources, key policy/rotation, SG edges and logical outputs remain');
  aliases.push(alias);logs.push(log);
 }
 assert.equal(new Set(aliases).size,4);assert.equal(new Set(logs).size,4);
});

test('case prerequisites: invalid own identity and name or ARN overrides refuse without getters',()=>{
 const refused={code:'NATIVE_PREREQUISITES_TEMPLATE_REFUSED'},valid={...input(),caseId:'a123456789ab'};
 for(const caseId of [undefined,null,false,123456789012,{},[],new String('a123456789ab'),'','preview','a123456789a','a123456789abc','A123456789AB','a123456789ag','a123456789ab\n'])
  assert.throws(()=>compileNativeObserverPrerequisitesTemplate({...input(),caseId}),refused);
 for(const key of ['keyAlias','logGroupName','kmsKeyArn','roleName'])
  assert.throws(()=>compileNativeObserverPrerequisitesTemplate({...valid,[key]:'ordinary-override'}),refused);
 assert.throws(()=>compileNativeObserverPrerequisitesTemplate({...valid,endpointSecurityGroupId:valid.privateAlbSecurityGroupId}),refused);
 assert.throws(()=>compileNativeObserverPrerequisitesTemplate({...valid,vpcId:valid.privateAlbSecurityGroupId}),refused);
 for(const key of ['caseId','vpcId']){
  let reads=0;const getter={...input()};Object.defineProperty(getter,key,{enumerable:true,get(){reads++;return 'a123456789ab';}});
  assert.throws(()=>compileNativeObserverPrerequisitesTemplate(getter),refused);assert.equal(reads,0);
 }
 const hidden={...input()};Object.defineProperty(hidden,'caseId',{value:'a123456789ab'});
 assert.throws(()=>compileNativeObserverPrerequisitesTemplate(hidden),refused);
 assert.throws(()=>compileNativeObserverPrerequisitesTemplate(Object.assign(Object.create({caseId:'a123456789ab'}),input())),refused);
});

test('case prerequisites: ambient inherited values and getters never select names or replace own validation',()=>{
 const prior=Object.getOwnPropertyDescriptor(Object.prototype,'caseId');let reads=0;
 for(const inherited of [{value:'NOT-A-VALID-CASE'},{get(){reads++;throw Error('inherited caseId must not be read');}}]){
  try{
   Object.defineProperty(Object.prototype,'caseId',{...inherited,configurable:true});
   assert.equal(Object.hasOwn(validateNativeObserverPrerequisitesInput(input()),'caseId'),false);
   const ordinary=compileNativeObserverPrerequisitesTemplate(input());
   assert.equal(createHash('sha256').update(JSON.stringify(ordinary)).digest('hex'),'1a3c72531485c150fbbcfb4722e4f499be85c8d2e0d333cbf6dbb65c65333413');
   const ownCase=compileNativeObserverPrerequisitesTemplate({...input(),caseId:'a123456789ab'});
   assert.equal(ownCase.Resources.NativeObserverKeyAlias.Properties.AliasName,'alias/meri-case-a123456789ab/native-observer');
   assert.equal(ownCase.Resources.NativeObserverLogGroup.Properties.LogGroupName,'/meri-case-a123456789ab/native-observer');
   assert.throws(()=>compileNativeObserverPrerequisitesTemplate({...input(),caseId:undefined}),{code:'NATIVE_PREREQUISITES_TEMPLATE_REFUSED'});
   assert.equal(reads,0);
  }finally{
   if(prior)Object.defineProperty(Object.prototype,'caseId',prior);else Reflect.deleteProperty(Object.prototype,'caseId');
   assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype,'caseId'),prior);
  }
 }
});
