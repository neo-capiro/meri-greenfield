// Explicit continuation delta; historical descriptors/callbacks remain compared.
export const verticalOperationIds=Object.freeze(['get_research_evidence','create_word','create_excel','create_powerpoint','run_analysis','create_task','update_task','save_memory','save_chat_attachments','schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task']);
export function schemaRelativePath(group){
 const external={artifacts:'../artifacts-0.2/artifact.schema.json','command-tools':'../commands-0.2/tool-interface.schema.json','schedule-tools':'../schedules-0.2/tool-interface.schema.json'};
 return external[group]??`../retrieval-0.2/${group}.schema.json`;
}
