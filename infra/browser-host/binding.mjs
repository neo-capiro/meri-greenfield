// @ts-check
/** Closed, inert owner DATA for one D005 host allocation. These values are pins to review, not authority to launch. */
export const HOST_PROPOSAL_SCHEMA='meri-browser-host-source-proposal/1';
export const HOST_REGION='us-east-1';
export const HOST_ACCOUNT='967807252336';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA=/^[0-9a-f]{64}$/u;
const COMMIT=/^[0-9a-f]{40}$/u;
const AWS_ID=/^(?:vpc|subnet|sg)-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u;
const AMI=/^ami-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u;
const IMAGE=new RegExp(`^${HOST_ACCOUNT}\\.dkr\\.ecr\\.${HOST_REGION}\\.amazonaws\\.com\\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[0-9a-f]{64}$`,'u');
const fail=()=>{throw Object.assign(new Error('BROWSER_HOST_PROPOSAL_REFUSED'),{code:'BROWSER_HOST_PROPOSAL_REFUSED'});};
/** Copy only own plain data, refusing accessors, symbols, inherited names and extension fields. */
function fields(value,names){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==names.length||names.some(name=>!Object.hasOwn(descriptors,name)||!Object.hasOwn(descriptors[name],'value')||!descriptors[name].enumerable))fail();
 return Object.fromEntries(names.map(name=>[name,descriptors[name].value]));
}
const isUuid=v=>typeof v==='string'&&UUID.test(v);
const isSha=v=>typeof v==='string'&&SHA.test(v);
const isAwsId=v=>typeof v==='string'&&AWS_ID.test(v);
/** @param {unknown} input */
export function validateHostProposalBinding(input){
 const top=fields(input,['allocation','source','network','host']);
 const a=fields(top.allocation,['tenantId','conversationId','hostId','generation','leaseDeadlineMs']);
 const s=fields(top.source,['sourceCommit','imageUri','imageConfigSha256','bootstrapSha256','seccompSha256']);
 const n=fields(top.network,['vpcId','subnetId','controlSecurityGroupId']);
 const h=fields(top.host,['amiId','amiOwner','architecture','instanceType','rootVolumeGiB']);
 if(typeof a.tenantId!=='string'||a.tenantId.length<1||a.tenantId.length>128||/[\x00-\x1f\x7f]/u.test(a.tenantId)||
    !isUuid(a.conversationId)||!isUuid(a.hostId)||!Number.isSafeInteger(a.generation)||a.generation<1||
    !Number.isSafeInteger(a.leaseDeadlineMs)||a.leaseDeadlineMs<1700000000000||a.leaseDeadlineMs>4102444800000)fail();
 if(typeof s.sourceCommit!=='string'||!COMMIT.test(s.sourceCommit)||typeof s.imageUri!=='string'||!IMAGE.test(s.imageUri)||
    !isSha(s.imageConfigSha256)||!isSha(s.bootstrapSha256)||!isSha(s.seccompSha256))fail();
 if(![n.vpcId,n.subnetId,n.controlSecurityGroupId].every(isAwsId)||!n.vpcId.startsWith('vpc-')||
    !n.subnetId.startsWith('subnet-')||!n.controlSecurityGroupId.startsWith('sg-'))fail();
 if(typeof h.amiId!=='string'||!AMI.test(h.amiId)||typeof h.amiOwner!=='string'||!/^[0-9]{12}$/u.test(h.amiOwner)||
    h.architecture!=='x86_64'||typeof h.instanceType!=='string'||!/^[a-z][0-9a-z]*\.[a-z0-9]+$/u.test(h.instanceType)||
    !Number.isSafeInteger(h.rootVolumeGiB)||h.rootVolumeGiB<8||h.rootVolumeGiB>1024)fail();
 return Object.freeze({schema:HOST_PROPOSAL_SCHEMA,allocation:Object.freeze(a),source:Object.freeze(s),network:Object.freeze(n),host:Object.freeze(h)});
}
