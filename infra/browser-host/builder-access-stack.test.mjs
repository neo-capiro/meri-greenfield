import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBuilderAccessTemplate,validateBuilderAccessInput} from './builder-access-stack.mjs';
import {compileBrowserHostRegistryTemplate,BROWSER_HOST_REPOSITORY} from './registry-stack.mjs';

const role='MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H';

test('one inline policy on the existing builder role, naming only the browser host repository',()=>{
 const t=compileBuilderAccessTemplate({builderRoleName:role});
 assert.deepEqual(Object.keys(t.Resources),['BrowserHostImagePush']);
 const p=t.Resources.BrowserHostImagePush.Properties;
 assert.equal(t.Resources.BrowserHostImagePush.Type,'AWS::IAM::Policy');assert.deepEqual(p.Roles,[role]);
 for(const s of p.PolicyDocument.Statement){
  assert.equal(s.Effect,'Allow');
  assert.equal(s.Resource,`arn:aws:ecr:us-east-1:967807252336:repository/${BROWSER_HOST_REPOSITORY}`);
  assert.equal(JSON.stringify(s).includes('*'),false,'no wildcard resource or action');
 }
 assert.equal(JSON.stringify(t).includes('GetAuthorizationToken'),false,'the token right is already on the role; nothing wider is added');
 assert.equal(/iam:|s3:|kms:|ecr:Delete|ecr:Batch(Delete|Put)/u.test(JSON.stringify(t)),false);
});
test('the repository is the one the registry stack creates',()=>{
 const repo=compileBrowserHostRegistryTemplate().Resources.BrowserHostRepository.Properties.RepositoryName;
 assert.equal(JSON.stringify(compileBuilderAccessTemplate({builderRoleName:role})).includes(`repository/${repo}`),true);
});
test('the input is closed and exact',()=>{
 for(const bad of [{},{builderRoleName:'other-role'},{builderRoleName:role,extra:1},{builderRoleName:`${role}x`},null])
  assert.throws(()=>validateBuilderAccessInput(bad),{code:'BROWSER_HOST_BUILDER_ACCESS_REFUSED'});
});
