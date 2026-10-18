// @ts-check
/** Strict source inputs for the enabled, closed-network D005 host template. */
import {createHash} from 'node:crypto';
import {HOST_ACCOUNT,HOST_REGION,validateHostProposalBinding} from './binding.mjs';
import {launchDeadlinePolicy} from './launch-deadline-policy.mjs';
import {closedHostStackPolicy} from './stack-update-policy.mjs';

export const WATCHDOG_INPUT_SCHEMA='meri-d005-host-watchdog-input/1';
export const REVIEW_DIGEST_ZERO='0'.repeat(64);
export const HOST_CEILING_MS=900_000;
const SHA=/^[0-9a-f]{64}$/u;
const ID=/^(?:sg|pl)-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u;
const KMS=new RegExp(`^arn:aws:kms:${HOST_REGION}:${HOST_ACCOUNT}:key/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,'u');
const LAMBDA=new RegExp(`^arn:aws:lambda:${HOST_REGION}:${HOST_ACCOUNT}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`,'u');
const MACHINE=new RegExp(`^arn:aws:states:${HOST_REGION}:${HOST_ACCOUNT}:stateMachine:([A-Za-z0-9_-]{1,80}):([1-9][0-9]*)$`,'u');
const fail=()=>{throw Object.assign(new Error('ENABLED_BROWSER_HOST_INPUT_REFUSED'),{code:'ENABLED_BROWSER_HOST_INPUT_REFUSED'});};

/** @param {unknown} value @param {string[]} names */
function fields(value,names){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const desc=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(desc).length!==names.length||names.some(n=>!Object.hasOwn(desc,n)||!Object.hasOwn(desc[n],'value')||!desc[n].enumerable))fail();
 return Object.fromEntries(names.map(n=>[n,desc[n].value]));
}
/** Deterministic JSON for reviewed DATA (the caller has already copied fields). */
export function canonicalJson(value){
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 fail();
}
export const sha256=value=>createHash('sha256').update(value).digest('hex');

/** @param {unknown} input */
export function validateEnabledHostInput(input){
 const top=fields(input,['proposal','privateNetwork','encryption','bootstrap','watchdog','launchGuard']);
 const proposal=validateHostProposalBinding(top.proposal);
 const n=fields(top.privateNetwork,['mode','ecrApiSecurityGroupId','ecrDockerSecurityGroupId','logsSecurityGroupId','s3GatewayPrefixListId']);
 const e=fields(top.encryption,['rootKmsKeyArn','logsKmsKeyArn']);
 const b=fields(top.bootstrap,['userDataBase64','nativeHelperSha256']);
 const w=fields(top.watchdog,['serviceTokenArn','providerCodeSha256','stateMachineVersionArn','definitionSha256','qualificationEvidenceSha256','executionArn','originalT0Ms']);
 const g=fields(top.launchGuard,['serviceRoleArn','policySha256','stackPolicySha256']);
 if(n.mode!=='closed-qualification'||![n.ecrApiSecurityGroupId,n.ecrDockerSecurityGroupId,n.logsSecurityGroupId].every(x=>typeof x==='string'&&x.startsWith('sg-')&&ID.test(x))||
    typeof n.s3GatewayPrefixListId!=='string'||!n.s3GatewayPrefixListId.startsWith('pl-')||!ID.test(n.s3GatewayPrefixListId))fail();
 if(new Set([proposal.network.controlSecurityGroupId,n.ecrApiSecurityGroupId,n.ecrDockerSecurityGroupId,n.logsSecurityGroupId]).size!==4)fail();
 if(![e.rootKmsKeyArn,e.logsKmsKeyArn].every(x=>typeof x==='string'&&KMS.test(x)))fail();
 if(typeof b.userDataBase64!=='string'||b.userDataBase64.length>22_000||!/^[A-Za-z0-9+/]+={0,2}$/u.test(b.userDataBase64)||
    typeof b.nativeHelperSha256!=='string'||!SHA.test(b.nativeHelperSha256))fail();
 const raw=Buffer.from(b.userDataBase64,'base64');
 if(raw.length===0||raw.length>16_384||raw.toString('base64')!==b.userDataBase64||sha256(raw)!==proposal.source.bootstrapSha256)fail();
 const match=typeof w.stateMachineVersionArn==='string'&&MACHINE.exec(w.stateMachineVersionArn);
 if(!match||typeof w.executionArn!=='string'||w.executionArn!==`arn:aws:states:${HOST_REGION}:${HOST_ACCOUNT}:execution:${match[1]}:${proposal.allocation.hostId}-g${proposal.allocation.generation}`||
    typeof w.serviceTokenArn!=='string'||!LAMBDA.test(w.serviceTokenArn)||
    typeof w.providerCodeSha256!=='string'||!SHA.test(w.providerCodeSha256)||
    typeof w.definitionSha256!=='string'||!SHA.test(w.definitionSha256)||
    typeof w.qualificationEvidenceSha256!=='string'||!SHA.test(w.qualificationEvidenceSha256)||
    !Number.isSafeInteger(w.originalT0Ms)||proposal.allocation.leaseDeadlineMs!==w.originalT0Ms+HOST_CEILING_MS)fail();
 if(proposal.host.instanceType!=='t3.large'||proposal.host.rootVolumeGiB!==30||proposal.host.amiOwner!=='591542846629')fail();
 if(proposal.allocation.generation>999999||
    g.serviceRoleArn!==`arn:aws:iam::${HOST_ACCOUNT}:role/MeriD005-${proposal.allocation.hostId}-g${proposal.allocation.generation}`||
    typeof g.policySha256!=='string'||g.policySha256!==sha256(canonicalJson(launchDeadlinePolicy(proposal.allocation.leaseDeadlineMs)))||
    typeof g.stackPolicySha256!=='string'||g.stackPolicySha256!==sha256(canonicalJson(closedHostStackPolicy())))fail();
 return Object.freeze({proposal,privateNetwork:Object.freeze(n),encryption:Object.freeze(e),
  bootstrap:Object.freeze(b),watchdog:Object.freeze(w),launchGuard:Object.freeze(g),
  allocationSha256:sha256(canonicalJson(proposal.allocation))});
}

/** Exact bytes the watchdog execution must have received before EC2 creation. */
export function expectedWatchdogInput(b,templateSha256){
 if(typeof templateSha256!=='string'||!SHA.test(templateSha256))fail();
 const a=b.proposal.allocation,s=b.proposal.source,w=b.watchdog;
 return Object.freeze({schema:WATCHDOG_INPUT_SCHEMA,hostId:a.hostId,generation:a.generation,
  allocationSha256:b.allocationSha256,sourceCommit:s.sourceCommit,imageUri:s.imageUri,
  imageConfigSha256:s.imageConfigSha256,bootstrapSha256:s.bootstrapSha256,
  nativeHelperSha256:b.bootstrap.nativeHelperSha256,templateSha256,
  originalT0Ms:w.originalT0Ms,deadlineMs:a.leaseDeadlineMs});
}
