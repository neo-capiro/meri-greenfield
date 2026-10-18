import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBrowserHostSourceProposal,HOST_ACTIVATION_BLOCKERS} from './render.mjs';
import {HOST_PROPOSAL_SCHEMA,validateHostProposalBinding} from './binding.mjs';

const id='12e5d15a-46f8-4188-8052-5d35bc5d2a85';
const hash='a'.repeat(64);
const fixture=()=>({
 allocation:{tenantId:'tenant-one',conversationId:id,hostId:'26b43f6a-e709-4f07-9a67-388a641d4b77',generation:1,leaseDeadlineMs:1792425600000},
 source:{sourceCommit:'b'.repeat(40),imageUri:`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/runtime@sha256:${hash}`,
  imageConfigSha256:hash,bootstrapSha256:'c'.repeat(64),seccompSha256:'d'.repeat(64)},
 network:{vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',controlSecurityGroupId:'sg-0123456789abcdef0'},
 host:{amiId:'ami-0123456789abcdef0',amiOwner:'591542846629',architecture:'x86_64',instanceType:'t3.large',rootVolumeGiB:30},
});
const refused=input=>assert.throws(()=>compileBrowserHostSourceProposal(input),{code:'BROWSER_HOST_PROPOSAL_REFUSED'});

test('one exact conversation allocation renders inert and keeps every unqualified gate visible',()=>{
 const raw=fixture(),p=compileBrowserHostSourceProposal(raw);
 assert.equal(p.schema,HOST_PROPOSAL_SCHEMA);
 assert.deepEqual([p.kind,p.runtimeEnabled,p.deployable,p.launchAdmitted,p.activation],['source-data-only',false,false,false,'held']);
 assert.equal(Object.hasOwn(p,'Resources'),false);
 assert.equal(Object.hasOwn(p,'Parameters'),false);
 assert.equal(Object.hasOwn(p,'Conditions'),false);
 assert.equal(p.binding.allocation.conversationId,id);
 assert.equal(p.instance.allocation.reuseAcrossConversations,false);
 assert.equal(p.instance.instance.associatePublicIpAddress,false);
 assert.deepEqual(p.instance.worker.addedCapabilities,[]);
 assert.equal(p.instance.worker.privileged,false);
 assert.equal(p.network.browserCompartment.proxyEndpoint,'http://127.0.0.1:<run-port>');
 assert.deepEqual(p.network.browserCompartment.directRoutes,[]);
 assert.equal(p.network.hostSecurityGroup.insufficientWithoutNamespaceAndFirewall,true);
 assert.equal(p.network.evidence.directBypassProbesPassed,false);
 assert.equal(p.network.evidence.tlsCoalescingEnforced,false);
 assert.equal(p.watchdog.definition.StartAt,'SourceOnlyRefusal');
 assert.equal(p.watchdog.definition.States.SourceOnlyRefusal.Type,'Fail');
 assert.equal(p.watchdog.positiveRootVolumeAbsenceQualified,false);
 assert.equal(p.watchdog.launchAdmitted,false);
 assert.equal(p.blockers,HOST_ACTIVATION_BLOCKERS);
 assert.equal(p.blockers.length,8);
 raw.allocation.tenantId='another-tenant';raw.network.vpcId='vpc-fffffffffffffffff';
 assert.equal(p.binding.allocation.tenantId,'tenant-one');
 assert.equal(p.network.vpcId,'vpc-0123456789abcdef0');
});

test('binding refuses admission switches, accessors, identity and image ambiguity',()=>{
 refused({...fixture(),runtimeEnabled:true});
 const nested=fixture();nested.allocation={...nested.allocation,launchAdmitted:true};refused(nested);
 const accessor=fixture();Object.defineProperty(accessor.source,'imageUri',{get(){throw Error('accessed');},enumerable:true});refused(accessor);
 const symbol=fixture();symbol.network[Symbol('extra')]=1;refused(symbol);
 for(const change of [
  raw=>{raw.allocation.generation=0;},
  raw=>{raw.allocation.conversationId='another-conversation';},
  raw=>{raw.source.imageUri=raw.source.imageUri.replace('967807252336','000000000000');},
  raw=>{raw.source.seccompSha256='invalid';},
  raw=>{raw.network.controlSecurityGroupId='0.0.0.0/0';},
  raw=>{raw.host.architecture='arm64';},
  raw=>{raw.host.amiId='ami-latest';},
 ]){const raw=fixture();change(raw);refused(raw);}
 assert.equal(validateHostProposalBinding(fixture()).schema,HOST_PROPOSAL_SCHEMA);
});
