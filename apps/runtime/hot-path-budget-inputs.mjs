/** Composition input only. Turn roots are carried from rendered or admitted configuration. */
import {hotPathBudgets} from '../../packages/runtime/hot-path-budgets.mjs';

export function runtimeHotPathBudgets(configuration){
 const candidate=configuration?.nativeCandidate;
 let runWindowMs=configuration?.runWindowMs??candidate?.multiRun?.runWindowMs;
 if(runWindowMs===undefined&&candidate?.allocationJson!==undefined){
  let allocation;try{allocation=JSON.parse(candidate.allocationJson);}catch{}
  const seconds=allocation?.budgets?.maxRuntimeSeconds;
  if(Number.isSafeInteger(seconds)&&seconds>0)runWindowMs=Math.min(seconds*1000,86400000);
 }
 // No production-shaped fallback: a worker/runner without the rendered turn root refuses before I/O.
 return hotPathBudgets({limits:configuration?.limits,runWindowMs,
  originalExpiresAtMs:configuration?.remoteTask?.original?.expiresAtMs??configuration?.bootstrap?.expiresAtMs});
}
