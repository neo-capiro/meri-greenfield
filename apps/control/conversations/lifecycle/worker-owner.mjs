/** Trusted worker ports compose the same authenticated lifecycle service. */
import {own,bounded,validateShape,fail} from '../boundary.mjs';
export function createLifecycleRunOwner(configuration){
 const {service,credentialForBinding}=own(configuration,['service','credentialForBinding']);
 if(typeof credentialForBinding!=='function'||['loadForExecution','publish','nextControls','claimControl','ackControl','recordCheckpoint'].some(k=>typeof service?.[k]!=='function'))fail('LIFECYCLE_CONFIGURATION');
 async function invoke(method,args,required,optional=[]){
  own(args,required,[...optional,'signal']);validateShape('RunBinding',args.binding);
  const credential=await credentialForBinding({binding:args.binding,signal:args.signal});
  if(typeof credential!=='string'||!credential||credential.length>4096)fail('SESSION_REFUSED');
  return service[method]({...args,credential});
 }
 return Object.freeze({
  load:args=>invoke('loadForExecution',args,['binding']),
  append:args=>invoke('publish',args,['binding','event']),
  async nextControls(args){const page=bounded(await invoke('nextControls',args,['binding'],['after']));own(page,['controls','nextControlSequence']);
   if(!Array.isArray(page.controls)||page.controls.length>100||!Number.isSafeInteger(page.nextControlSequence)||page.nextControlSequence<0)fail('LIFECYCLE_REFUSED');
   // The activity advances only through consumed sequences. Remaining rows
   // are selected again on its next read; no command is skipped or delivered here.
   return page.controls.slice(0,32);
  },
  claimControl:args=>invoke('claimControl',args,['binding','input']),
  ackControl:args=>invoke('ackControl',args,['binding','input']),
  recordCheckpoint:args=>invoke('recordCheckpoint',args,['binding','input'])
 });
}
