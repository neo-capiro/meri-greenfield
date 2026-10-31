/** Canonical non-retrieval domain schema locations; no runtime registration. */
export const executionSchemaSources = Object.freeze([
  Object.freeze({group:'artifacts',path:'../artifacts-0.2/artifact.schema.json',
    exposed:Object.freeze(['WordRequest','ExcelRequest','PowerpointRequest','AnalysisRequest',
      'ArtifactCreatedResult','ArtifactOperationResult'])}),
  Object.freeze({group:'command-tools',path:'../commands-0.2/tool-interface.schema.json',
    exposed:Object.freeze(['MailSendToolRequest','MailSendToolResult','TaskCreateToolRequest','TaskCreateToolResult','TaskUpdateToolRequest','TaskUpdateToolResult',
      'ArtifactFileToolRequest','ArtifactFileToolResult','MemoryProposeToolRequest','MemoryProposeToolResult'])}),
  Object.freeze({group:'schedule-tools',path:'../schedules-0.2/tool-interface.schema.json',
    exposed:Object.freeze(['ScheduleTaskRequest','UpdateScheduledTaskRequest','CancelScheduledTaskRequest',
      'ListScheduledTasksRequest','ScheduleMutationOutput','ListScheduledTasksOutput'])}),
  // Disjoint successors. `exposed` is deliberately empty for both: these definitions share their names
  // with the 0.2 family above, and the shared `validatorRefs` name space must keep resolving every
  // existing name to the exact version it resolved to before. Their groups are addressed explicitly
  // (group + definition) instead, and their documents still load for descriptor byte-pin resolution.
  Object.freeze({group:'client-record-action-03',path:'../retrieval-0.3/client-record-action.schema.json',
    exposed:Object.freeze([])}),
  Object.freeze({group:'schedule-tools-v3',path:'../schedules-0.3/tool-interface.schema.json',
    exposed:Object.freeze([])}),
  Object.freeze({group:'capiro-data-v3',path:'../retrieval-0.3/capiro-data.schema.json',
    exposed:Object.freeze([])}),
  Object.freeze({group:'capiro-data-v4',path:'../retrieval-0.4/capiro-data.schema.json',
    exposed:Object.freeze([])}),
]);
export const executionSchemaDependencies = Object.freeze([
  '../commands-0.2/mail-send.schema.json','../commands-0.2/task-create.schema.json','../commands-0.2/task-update.schema.json',
  '../commands-0.2/artifact-file.schema.json','../commands-0.2/memory-propose.schema.json',
  '../schedules-0.2/lifecycle.schema.json','../schedules-0.2/inspection.schema.json',
  '../schedules-0.3/lifecycle.schema.json','../schedules-0.3/inspection.schema.json',
]);
