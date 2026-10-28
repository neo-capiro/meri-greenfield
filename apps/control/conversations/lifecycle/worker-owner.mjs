/** Trusted worker ports compose the same authenticated lifecycle service. */
import {own,bounded,validateShape,fail} from '../boundary.mjs';
export function createLifecycleRunOwner(configuration){
 const {service,credentialForBinding}=own(configuration,['service','credentialForBinding']);
 if(typeof credentialForBinding!=='function'||['loadForExecution','publish','nextControls','claimControl','ackControl','recordCheckpoint','dispatchChild','settleChild'].some(k=>typeof service?.[k]!=='function'))fail('LIFECYCLE_CONFIGURATION');
 async function invoke(method,args,required,optional=[]){
  own(args,required,[...optional,'signal']);validateShape('RunBinding',args.binding);
  const credential=await credentialForBinding({binding:args.binding,signal:args.signal});
  if(typeof credential!=='string'||!credential||credential.length>4096)fail('SESSION_REFUSED');
  return service[method]({...args,credential});
 }
 return Object.freeze({
  load:args=>invoke('loadForExecution',args,['binding']),
  append:args=>invoke('publish',args,['binding','event']),
  ...(typeof service.readUploadSource==='function'?{readUploadSource:args=>invoke('readUploadSource',args,['binding','input'])}:{}),
  async nextControls(args){const page=bounded(await invoke('nextControls',args,['binding'],['after']));own(page,['controls','nextControlSequence']);
   if(!Array.isArray(page.controls)||page.controls.length>100||!Number.isSafeInteger(page.nextControlSequence)||page.nextControlSequence<0)fail('LIFECYCLE_REFUSED');
   // The activity advances only through consumed sequences. Remaining rows
   // are selected again on its next read; no command is skipped or delivered here.
   return page.controls.slice(0,32);
  },
  claimControl:args=>invoke('claimControl',args,['binding','input']),
  ackControl:args=>invoke('ackControl',args,['binding','input']),
  recordCheckpoint:args=>invoke('recordCheckpoint',args,['binding','input']),
  // Child assignment custody: the worker sees the persisted assignment identity, the recovered effect classification and
  // the result custody receipt, never a second child. Both answers are closed shapes.
  async dispatchChild(args){const value=bounded(await invoke('dispatchChild',args,['binding','input']));own(value,['replayed','effect','assignment']);
   if(typeof value.replayed!=='boolean'||!['none','unknown','committed'].includes(value.effect))fail('LIFECYCLE_REFUSED');
   own(value.assignment,['assignmentId','toolUseId','role','revision','dispatchedAtMs']);return value;},
  async settleChild(args){const value=bounded(await invoke('settleChild',args,['binding','input']));own(value,['replayed','receipt']);
   if(typeof value.replayed!=='boolean')fail('LIFECYCLE_REFUSED');
   own(value.receipt,['assignmentId','toolUseId','outcome','resultSha256','resultBytes','custody','revision','settledAtMs']);return value;}
  });
}
