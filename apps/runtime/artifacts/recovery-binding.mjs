/** One control-owned late binding, forwarding to the existing retention gate; no lock, fence or recovery loop of its own. */
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const refuse=code=>{throw Object.assign(Error(code),{code});};
export function createArtifactRecoveryBinding({journal}){
 storageMethod(journal,'exclusive');let assertServable,configured=false,required=false,owner=null,state='unavailable';
 const retention=Object.freeze({assertServable(...args){if(!assertServable)refuse('ARTIFACT_RECOVERY_UNAVAILABLE');return assertServable(...args);}});
 return Object.freeze({context:Object.freeze({journal,retention}),
  configure(value,needed){if(configured||typeof needed!=='boolean')refuse('PRODUCT_PORTS_CONFIGURATION');configured=true;required=needed;
   if(!required){if(value!==null)refuse('PRODUCT_PORTS_CONFIGURATION');state='not-required';return null;}
   if(value!==null){if(value.journal!==journal||value.retention!==retention||!['composed','disabled'].includes(value.state))refuse('PRODUCT_PORTS_CONFIGURATION');storageMethod(value,'recoverPrerequisitesExclusive');owner=value;state=value.state;}
   return async()=>{if(!assertServable||!owner||state!=='composed')refuse('ARTIFACT_RECOVERY_UNAVAILABLE');return owner.recoverPrerequisitesExclusive();};
  },
  bindRetention(gate){if(assertServable)refuse('PRODUCT_PORTS_CONFIGURATION');assertServable=storageMethod(gate,'assertServable');},
  state:()=>Object.freeze({required,state}),
 });
}
