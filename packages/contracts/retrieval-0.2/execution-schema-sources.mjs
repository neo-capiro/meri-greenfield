/** Canonical non-retrieval domain schema locations; no runtime registration. */
export const executionSchemaSources = Object.freeze([
  Object.freeze({group:'artifacts',path:'../artifacts-0.2/artifact.schema.json',
    exposed:Object.freeze(['WordRequest','ExcelRequest','PowerpointRequest','AnalysisRequest',
      'ArtifactCreatedResult','ArtifactOperationResult'])}),
  Object.freeze({group:'command-tools',path:'../commands-0.2/tool-interface.schema.json',
    exposed:Object.freeze(['TaskCreateToolRequest','TaskCreateToolResult','TaskUpdateToolRequest','TaskUpdateToolResult',
      'ArtifactFileToolRequest','ArtifactFileToolResult','MemoryProposeToolRequest','MemoryProposeToolResult'])}),
  Object.freeze({group:'schedule-tools',path:'../schedules-0.2/tool-interface.schema.json',
    exposed:Object.freeze(['ScheduleTaskRequest','UpdateScheduledTaskRequest','CancelScheduledTaskRequest',
      'ListScheduledTasksRequest','ScheduleMutationOutput','ListScheduledTasksOutput'])}),
]);
export const executionSchemaDependencies = Object.freeze([
  '../commands-0.2/task-create.schema.json','../commands-0.2/task-update.schema.json',
  '../commands-0.2/artifact-file.schema.json','../commands-0.2/memory-propose.schema.json',
  '../schedules-0.2/lifecycle.schema.json','../schedules-0.2/inspection.schema.json',
]);
