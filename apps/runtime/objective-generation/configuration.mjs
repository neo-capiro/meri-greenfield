/** Closed opt-in declarations for the Objective generation runtime pieces. Absent means disabled; nothing is inferred.
 *   control         objectiveGeneration: {runs?:{enabled:boolean}, start?:{enabled:boolean, windowMs:int 60000..86400000}}
 *   temporal-worker objectiveGeneration: {runs?:{enabled:boolean}}
 * `runs` composes the private native operations (control) and the worker's `runs` port (worker); `start` composes the public
 * dispatcher route (start-application.mjs). Declaring either still leaves every step a definite no-op until its trusted owners
 * exist: Core's current-claim authority (runs), the Core generation credential owner (D7-3, activities `clientFor`). */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_GENERATION_CONFIGURATION'),{code:'OBJECTIVE_GENERATION_CONFIGURATION'});
function flag(value,extra=[]){const v=own(value,['enabled',...extra]);if(typeof v.enabled!=='boolean')throw fault();return v;}

export function compileObjectiveGenerationConfiguration(configuration,role){
 try{
  const raw=configuration?.objectiveGeneration;if(raw===undefined)return Object.freeze({runs:false,start:null});
  if(!['control','temporal-worker'].includes(role))throw fault();
  const c=own(raw,[],role==='control'?['runs','start']:['runs']);
  const runs=c.runs===undefined?false:flag(c.runs).enabled;
  let start=null;
  if(c.start!==undefined){const s=flag(c.start,['windowMs']);if(!Number.isSafeInteger(s.windowMs)||s.windowMs<60000||s.windowMs>86400000)throw fault();start=s.enabled?Object.freeze({windowMs:s.windowMs}):null;}
  return Object.freeze({runs,start});
 }catch{throw fault();}
}
