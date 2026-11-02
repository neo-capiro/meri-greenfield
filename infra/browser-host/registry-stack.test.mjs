import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBrowserHostRegistryTemplate,BROWSER_HOST_REPOSITORY} from './registry-stack.mjs';
import {compileProvisionedBrowserHostTemplate} from './provisioned-stack.mjs';

test('one immutable, scan-on-push repository with platform encryption, retained on stack deletion',()=>{
 const t=compileBrowserHostRegistryTemplate();
 assert.deepEqual(Object.keys(t.Resources),['BrowserHostRepository']);
 const r=t.Resources.BrowserHostRepository;
 assert.equal(r.Type,'AWS::ECR::Repository');assert.equal(r.DeletionPolicy,'Retain');assert.equal(r.UpdateReplacePolicy,'Retain');
 assert.equal(r.Properties.RepositoryName,BROWSER_HOST_REPOSITORY);
 assert.equal(r.Properties.ImageTagMutability,'IMMUTABLE');assert.equal(r.Properties.ImageScanningConfiguration.ScanOnPush,true);
 assert.deepEqual(r.Properties.EncryptionConfiguration,{EncryptionType:'AES256'});
 assert.equal(Object.hasOwn(r.Properties,'RepositoryPolicyText'),false,'no resource policy: only the account and the instance role identity policy reach it');
 assert.equal(Object.isFrozen(t.Resources),true);
});
test('the repository name is the one the instance role of the static host stack may pull',()=>{
 const role=compileProvisionedBrowserHostTemplate({vpcId:'vpc-0123456789abcdef0',vpcCidr:'10.42.0.0/16',controlSecurityGroupId:'sg-0123456789abcdef0',
  imageRepository:BROWSER_HOST_REPOSITORY,logGroupName:'/meri-greenfield/browser-host'}).Resources.BrowserHostRole.Properties;
 assert.equal(role.Policies[0].PolicyDocument.Statement[1].Resource.endsWith(`repository/${BROWSER_HOST_REPOSITORY}`),true);
 assert.equal(JSON.stringify(role).includes('kms:'),false,'AES256 repository: the pull role needs no key grant');
});
test('the lifecycle rule expires by count only, never by age',()=>{
 const rule=JSON.parse(compileBrowserHostRegistryTemplate().Resources.BrowserHostRepository.Properties.LifecyclePolicy.LifecyclePolicyText).rules[0];
 assert.equal(rule.selection.countType,'imageCountMoreThan');assert.equal(rule.selection.countNumber,30);
});
