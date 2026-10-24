/** Closed runtime deployment selection. No task definitions, grants or per-run PKI. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';

const refused=()=>{throw Object.assign(Error('AGENTCORE_CONFIGURATION'),{code:'AGENTCORE_CONFIGURATION'});};
export function compileAgentCoreConfiguration(value){
 const c=data(own(value,['runtimeArn','runtimeVersion','qualifier','identity','policyRevision','runWindowMs','maxOutputBytes'],['approvedReads']));
 if(!/^arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime\/meri_preview-[A-Za-z0-9]+$/u.test(c.runtimeArn)||
  !/^[1-9][0-9]*$/u.test(c.runtimeVersion)||c.qualifier!=='preview'||
  typeof c.policyRevision!=='string'||!c.policyRevision||c.policyRevision.length>256||
  !Number.isSafeInteger(c.runWindowMs)||c.runWindowMs<60000||c.runWindowMs>28800000||
  !Number.isSafeInteger(c.maxOutputBytes)||c.maxOutputBytes<1||c.maxOutputBytes>1048576)refused();
 const i=own(c.identity,['origin']),url=new URL(i.origin);
 if(url.origin!==i.origin||url.protocol!=='https:'||url.username||url.password)refused();
 if(c.approvedReads!==undefined)assertNativeReadConfiguration(c.approvedReads);
 return Object.freeze(c);
}
