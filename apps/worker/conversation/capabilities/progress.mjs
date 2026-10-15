// @ts-check
/** Display projection of SDK `task_progress` summaries. Only the model-generated one-line summary becomes a
 * message; raw subagent frames keep their `parent_tool_use_id` and are never displayed. */
/** @param {{policy:import('./policy.mjs').CapabilityPolicy|undefined,newId:()=>string}} ports @returns {(m:any)=>{messageId:string,text:string}[]} */
export function createProgressProjector({policy,newId}){
 if(!policy?.subagentProgress)return ()=>[];
 return function project(m){
  if(m?.type!=='system'||m.subtype!=='task_progress'||m.parent_tool_use_id||m.summary===undefined||m.summary===null)return [];
  if(typeof m.summary!=='string'||m.summary.length>2048||typeof m.task_id!=='string'||!m.task_id)throw Error('SDK_PROGRESS_REFUSED');
  const summary=m.summary.trim();if(!summary)return [];
  const type=typeof m.subagent_type==='string'&&policy.subagentTypes.includes(m.subagent_type)?m.subagent_type:'subagent';
  return [{messageId:newId(),text:`${type}: ${summary}`}];
 };
}
