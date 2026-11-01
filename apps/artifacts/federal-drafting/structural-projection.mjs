/** Deterministic source-bound Word projections for the explicit decoded-USLM profile. Unsupported rendering
 * leaves exact source amendments available; no fallback flattening is labelled structural fidelity. */
import {projectUslmWord} from './structural-word.mjs';
export const FEDERAL_STRUCTURAL_PROFILE='uslm-word/1';
export function federalStructuralProjection(source,outputs,removed){
 const originalChanges=[],revisedChanges=[];let before=0,after=0;
 for(const segment of outputs.segments){
  if(segment.kind==='delete')originalChanges.push({start:before,end:before+segment.text.length});
  if(segment.kind==='insert')revisedChanges.push({start:after,end:after+segment.text.length});
  if(segment.kind!=='insert')before+=segment.text.length;
  if(segment.kind!=='delete')after+=segment.text.length;
 }
 try{return {profile:FEDERAL_STRUCTURAL_PROFILE,status:'supported',
  consolidated:removed?null:projectUslmWord(outputs.consolidated),
  original:projectUslmWord(source.text,{changes:originalChanges,mark:'strike'}),
  revised:removed?null:projectUslmWord(outputs.consolidated,{changes:revisedChanges,mark:'underline'})};}
 catch(error){
  if(!['DRAFT_STRUCTURAL_UNSUPPORTED','DRAFT_OUTPUT_LIMIT'].includes(error?.code))throw error;
  return {profile:FEDERAL_STRUCTURAL_PROFILE,status:'unsupported',code:error.code};
 }
}
