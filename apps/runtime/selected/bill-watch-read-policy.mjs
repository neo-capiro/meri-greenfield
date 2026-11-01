/** The selected successor promises stored state status only. Enforce that promise at
 * the existing native dispatch owner, using its persisted run, never tool arguments. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {inspectStateBillSelector} from '../../../packages/contracts/retrieval-0.2/state-bill-identity.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';

const same=(a,b)=>hash(a)===hash(b),deny=code=>{throw nativeReadFault(code);};
export function createBillWatchReadPolicy({store,binding}){
 return async function assertReadArguments({request,current,signal,check}){
  if(request.operation.id!=='get_state_bill_status')return;
  if(typeof store?.read!=='function')deny('UNAVAILABLE');
  const verify=()=>{signal?.throwIfAborted();check();};let saved;
  try{saved=await store.read(binding,{after:0,limit:1},verify);verify();}catch{verify();deny('UNAVAILABLE');}
  let selected;
  try{
   saved=data(saved);
   if(!same(saved.run.binding,binding)||!same(saved.run.scopes,current.scopes)||!['queued','starting','running'].includes(saved.run.state)||
    !saved.request||typeof saved.request!=='object'||Array.isArray(saved.request)||!Object.hasOwn(saved.request,'skill'))deny('ACCESS_DENIED');
   if(saved.request.skill!==null){selected=selectSkill(saved.request.skill.skillId,saved.request.skill.skillVersion);if(!same(selected.pin,saved.request.skill))deny('ACCESS_DENIED');}
  }catch{deny('ACCESS_DENIED');}
  // Ordinary reads and explicit older selections keep their existing semantics: the promise is enforced for every
  // installed Bill Watch version whose manifest allows the stored state status read, not for one version literal.
  if(selected?.pin.skillId!=='quick_skill.bill_watch'||!selected.manifest.allowedOperations.some(op=>op.id==='get_state_bill_status'))return;
  if(current.selectedClientId===null||!current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId===current.selectedClientId))deny('ACCESS_DENIED');
  try{const args=own(request.arguments,['billId']),selector=inspectStateBillSelector(args.billId);
   if(selector.kind!=='canonical'||selector.key!==args.billId)deny('INVALID_ARGUMENTS');
  }catch{deny('INVALID_ARGUMENTS');}
 };
}
