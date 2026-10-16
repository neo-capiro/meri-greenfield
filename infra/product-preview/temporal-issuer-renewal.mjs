/** Nonsecret, unmounted contract for the future trusted JWT renewal owner. No minting or file write here. */
import {validateTemporalPreviewBinding} from './temporal-binding.mjs';

const fail=()=>{throw Error('TEMPORAL_ISSUER_RENEWAL_REFUSED');};
const record=(value,keys)=>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
};

/** A required contract for integration review, never activation evidence or a credential. */
export function validateTemporalIssuerRenewal(binding,contract){
 let b;try{b=validateTemporalPreviewBinding(binding);}catch{fail();}
 const c=record(contract,['schemaVersion','status','issuer','jwksUrl','audience','namespace','taskQueue',
  'maxTokenLifetimeMs','refreshMs','issuerServiceTaskRoleArn','roles']);
 if(c.schemaVersion!==1||c.status!=='unmounted'||c.issuer!==b.auth.issuer||
    c.jwksUrl!==b.auth.jwksUrl||c.audience!==b.auth.audience||
    c.namespace!==b.auth.namespace||c.taskQueue!==b.auth.taskQueue||
    !Number.isSafeInteger(c.maxTokenLifetimeMs)||c.maxTokenLifetimeMs<30000||c.maxTokenLifetimeMs>300000||
    !Number.isSafeInteger(c.refreshMs)||c.refreshMs<1000||c.refreshMs>=c.maxTokenLifetimeMs/2||
    typeof c.issuerServiceTaskRoleArn!=='string'||
    !new RegExp(`^arn:aws:iam::${b.account}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`,'u').test(c.issuerServiceTaskRoleArn)||
    Object.values(b.taskRoleArns).includes(c.issuerServiceTaskRoleArn)||
    c.issuerServiceTaskRoleArn===b.executionRoleArn)fail();
 const roles=record(c.roles,['control','temporalWorker']);
 for(const role of Object.values(roles)){
  record(role,['subject','namespaceRole','tokenFile','workloadPrincipal','delivery']);
  if(typeof role.subject!=='string'||!/^[a-zA-Z0-9._:-]{1,128}$/u.test(role.subject)||
     role.namespaceRole!=='write'||role.tokenFile!=='/run/meri/temporal-token.json'||
     typeof role.workloadPrincipal!=='string'||
     !/^[a-zA-Z0-9._:-]{1,128}$/u.test(role.workloadPrincipal)||
     role.delivery!=='task-local-atomic-owner-only-file')fail();
 }
 if(roles.control.subject===roles.temporalWorker.subject||
    roles.control.workloadPrincipal===roles.temporalWorker.workloadPrincipal)fail();
 return Object.freeze({schemaVersion:1,status:'unmounted',issuer:c.issuer,audience:c.audience,
  namespace:c.namespace,taskQueue:c.taskQueue,maxTokenLifetimeMs:c.maxTokenLifetimeMs,refreshMs:c.refreshMs});
}
