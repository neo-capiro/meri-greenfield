import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {synthesizeFirstChatFoundation} from '../first-chat-foundation.mjs';
import {sourceEgressResource,patchLiveFoundation,diffTemplates,assertOnlyOneAddition,INLINE_TEMPLATE_LIMIT} from './foundation-egress-patch.mjs';
import {BROWSER_HOST_LISTENER_PORT} from '../../browser-host/provisioned-stack.mjs';

const binding=()=>JSON.parse(readFileSync(new URL('./foundation-binding.json',import.meta.url),'utf8'));
const withoutKey=()=>{const {browserHostSecurityGroupId,...rest}=binding();void browserHostSecurityGroupId;return rest;};
/** A stand-in for the live stack: the committed source without the rule, drifted the way the real one is (a resource the source
 * no longer has, and a resource whose body differs). The patch must leave all of that exactly as it is. */
const live=()=>{
 const t=structuredClone(synthesizeFirstChatFoundation(withoutKey()));
 t.Resources.IssuerSigningKey={Type:'AWS::KMS::Key',Properties:{Description:'retained live only'}};
 const policy=Object.entries(t.Resources).find(([,r])=>r.Type==='AWS::IAM::Policy');policy[1].Properties.PolicyName='drifted-live-name';
 return t;
};

test('the committed binding carries the browser host group and the source adds exactly one standalone egress for the listener port',()=>{
 assert.match(binding().browserHostSecurityGroupId,/^sg-[0-9a-f]{8,17}$/u);
 const rule=sourceEgressResource(binding());
 assert.equal(rule.resource.Type,'AWS::EC2::SecurityGroupEgress');
 assert.equal(rule.resource.Properties.FromPort,BROWSER_HOST_LISTENER_PORT);assert.equal(rule.resource.Properties.ToPort,BROWSER_HOST_LISTENER_PORT);
 assert.equal(rule.resource.Properties.DestinationSecurityGroupId,binding().browserHostSecurityGroupId);assert.equal(rule.resource.Properties.IpProtocol,'tcp');
 assert.equal(synthesizeFirstChatFoundation(withoutKey()).Resources[rule.ownerLogicalId].Properties.GroupName,'meri-preview-control');
});

test('without the key the foundation synthesis is byte-identical to before, and the key itself is validated',()=>{
 const base=synthesizeFirstChatFoundation(withoutKey());
 assert.equal(Object.values(base.Resources).some(r=>r.Type==='AWS::EC2::SecurityGroupEgress'&&r.Properties.FromPort===BROWSER_HOST_LISTENER_PORT),false);
 for(const bad of ['x','vpc-0123456789abcdef0',binding().endpointSecurityGroupId,binding().albSecurityGroupId,binding().auroraSecurityGroupId,5])
  assert.throws(()=>synthesizeFirstChatFoundation({...withoutKey(),browserHostSecurityGroupId:bad}),/FIRST_CHAT_FOUNDATION_BINDING_REFUSED/u);
 assert.throws(()=>synthesizeFirstChatFoundation({...binding(),extra:1}),/FIRST_CHAT_FOUNDATION_BINDING_REFUSED/u);
});

test('the patched live template differs from live by exactly one added resource, whatever else has drifted',()=>{
 const l=live(),result=patchLiveFoundation(l,binding());
 assert.deepEqual(result.diff,{added:[result.logicalId],removed:[],modified:[],sectionsChanged:[]});assertOnlyOneAddition(result.diff);
 assert.deepEqual(result.template.Resources.IssuerSigningKey,l.Resources.IssuerSigningKey);
 assert.equal(result.template.Resources[result.logicalId].Properties.DestinationSecurityGroupId,binding().browserHostSecurityGroupId);
 assert.deepEqual(l,live(),'the input template is not mutated');
 // The added resource is the very one the source synthesizes, so a later source-driven foundation agrees with live.
 assert.deepEqual(result.template.Resources[result.logicalId],synthesizeFirstChatFoundation(binding()).Resources[result.logicalId]);
 assert.ok(Buffer.byteLength(JSON.stringify(result.template))<INLINE_TEMPLATE_LIMIT);
});

test('the patch refuses a live template that already has the rule, lacks the control group, or a binding without the key',()=>{
 const rule=sourceEgressResource(binding());
 const already=live();already.Resources.OtherName=structuredClone(rule.resource);
 assert.throws(()=>patchLiveFoundation(already,binding()),{code:'FOUNDATION_EGRESS_PATCH_REFUSED'});
 const sameId=live();sameId.Resources[rule.logicalId]={Type:'AWS::EC2::SecurityGroupEgress',Properties:{}};
 assert.throws(()=>patchLiveFoundation(sameId,binding()),{code:'FOUNDATION_EGRESS_PATCH_REFUSED'});
 const noOwner=live();delete noOwner.Resources[rule.ownerLogicalId];
 assert.throws(()=>patchLiveFoundation(noOwner,binding()),{code:'FOUNDATION_EGRESS_PATCH_REFUSED'});
 assert.throws(()=>patchLiveFoundation(live(),withoutKey()),{code:'FOUNDATION_EGRESS_PATCH_REFUSED'});
 const extra=patchLiveFoundation(live(),binding()).template;extra.Resources.Another={Type:'AWS::SNS::Topic',Properties:{}};
 assert.throws(()=>assertOnlyOneAddition(diffTemplates(live(),extra)),{code:'FOUNDATION_EGRESS_PATCH_REFUSED'});
});

test('the CLI writes a new compact patched template and reports the one expected addition; it never overwrites',()=>{
 const dir=mkdtempSync(join(tmpdir(),'egress-')),liveFile=join(dir,'live.json'),bindingFile=join(dir,'binding.json'),out=join(dir,'patched.json');
 writeFileSync(liveFile,JSON.stringify(live(),null,1));writeFileSync(bindingFile,JSON.stringify(binding()));
 const script=fileURLToPath(new URL('./foundation-egress-patch.mjs',import.meta.url));
 const r=spawnSync(process.execPath,[script,'--live',liveFile,'--binding',bindingFile,'--out',out],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const summary=JSON.parse(r.stdout);assert.equal(summary.inlineTemplateAllowed,true);assert.equal(summary.diff.added.length,1);assert.deepEqual(summary.diff.removed,[]);
 assert.equal(JSON.parse(readFileSync(out,'utf8')).Resources[summary.logicalId].Type,'AWS::EC2::SecurityGroupEgress');
 assert.notEqual(spawnSync(process.execPath,[script,'--live',liveFile,'--binding',bindingFile,'--out',out],{encoding:'utf8'}).status,0);
});
