import assert from 'node:assert/strict';
// Explicit continuation delta; historical descriptors/callbacks remain compared.
export const verticalOperationIds=Object.freeze(['get_research_evidence','create_word','create_excel','create_powerpoint','run_analysis','create_task','update_task','save_memory','save_chat_attachments','schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task']);
export function schemaRelativePath(group){
 const external={artifacts:'../artifacts-0.2/artifact.schema.json','command-tools':'../commands-0.2/tool-interface.schema.json','schedule-tools':'../schedules-0.2/tool-interface.schema.json'};
 return external[group]??`../retrieval-0.2/${group}.schema.json`;
}

export const portfolioBoundaryBefore='Proposed authorized Research Portfolio record/evidence/history read only; owner/client/grant policies and source inclusion require explicit acceptance; management workflow parity deferred.';
export const portfolioBoundaryAfter='D011/R2 selected projected evidence: exact authorized review and retained snapshot plus current annual continuity. Raw member and unrestricted older-history exposure unavailable; no Portfolio management workflow parity.';
export const portfolioLimitationBefore='get_research_evidence is a separate pending Clio/portfolio scope issue and is not covered by this binding.';
export const portfolioLimitationAfter='Projected Portfolio evidence has its own get_research_evidence binding; this detail/changes operation does not return it.';
export function expectedVerticalBoundary(id,boundary){if(id!=='get_research_evidence')return boundary;assert.equal(boundary,portfolioBoundaryBefore);return portfolioBoundaryAfter;}
export function expectedVerticalDescriptor(row){
 if(!['get_research_portfolio','get_research_portfolio_changes'].includes(row.operation.id))return row;
 assert.equal(row.limitations.at(-1),portfolioLimitationBefore);
 return {...row,limitations:[...row.limitations.slice(0,-1),portfolioLimitationAfter]};
}
export function priorVerticalDescriptor(row){
 if(!['get_research_portfolio','get_research_portfolio_changes'].includes(row.operation.id))return row;
 assert.equal(row.limitations.at(-1),portfolioLimitationAfter);
 return {...row,limitations:[...row.limitations.slice(0,-1),portfolioLimitationBefore]};
}
export const verticalDispatchProfiles=Object.freeze([
 ...['schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task'].map(id=>[id,'schedule-execution/1']),
 ...['create_task','update_task','save_memory','save_chat_attachments'].map(id=>[id,'command-execution/1']),
 ...['create_word','create_excel','create_powerpoint','run_analysis'].map(id=>[id,'artifact-execution/1']),
 ['get_research_evidence','portfolio-evidence/1'],
]);
