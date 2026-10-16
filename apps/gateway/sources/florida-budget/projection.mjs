/** Explicit projection of current Core/Intel stored rows. No historical cutoff or cross-window join. */
import schema from '../../../../packages/contracts/retrieval-0.2/florida-budget.schema.json' with {type:'json'};
import {ownFields} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const defs=schema.$defs;
function row(type,value){
 const definition=defs[type];
 if(!value||typeof value!=='object'||Array.isArray(value))deny('INVALID_RESULT');
 const fields=ownFields(value,definition.required,Object.keys(value).filter(k=>!definition.required.includes(k)));
 // Core uses p.* / e.*. Preserve declared fields and opaque observations while
 // withholding extra database columns; never slice row arrays or rewrite IDs.
 return Object.fromEntries(Object.keys(definition.properties).filter(k=>Object.hasOwn(fields,k)).map(k=>[k,fields[k]]));
}
export function projectFloridaBudget(value,context){
 const outer=ownFields(value,['tool','generatedAt','result','authority']);
 if(outer.tool!=='get_florida_budget_project'||typeof outer.generatedAt!=='string'||!Number.isFinite(Date.parse(outer.generatedAt))||typeof outer.authority!=='string')deny('INVALID_RESULT');
 const raw=row('FloridaBudgetResult',outer.result);
 if(typeof raw.notice!=='string')deny('INVALID_RESULT');
 const result={...raw,projects:raw.projects.map(value=>{const p=row('FloridaBudgetProject',value);
   return {...p,recentAmounts:p.recentAmounts.map(v=>row('FloridaBudgetRecentAmount',v))};}),
  documents:raw.documents.map(v=>row('FloridaBudgetDocument',v)),amounts:raw.amounts.map(v=>row('FloridaBudgetAmount',v)),
  events:raw.events.map(v=>row('FloridaBudgetEvent',v)),notice:defs.FloridaBudgetNotice.const};
 // asOf labels this observation. It does not alter any producer SQL window.
 return {tool:outer.tool,generatedAt:context.asOf,result,authority:defs.FloridaBudgetAuthority.const};
}
