/** Canonical non-retrieval domain schema locations; no runtime registration. */
export const executionSchemaSources = Object.freeze([
  Object.freeze({group:'artifacts',path:'../artifacts-0.2/artifact.schema.json',
    exposed:Object.freeze(['WordRequest','ExcelRequest','PowerpointRequest','AnalysisRequest',
      'ArtifactCreatedResult','ArtifactOperationResult'])}),
]);
export const executionSchemaDependencies = Object.freeze([]);
