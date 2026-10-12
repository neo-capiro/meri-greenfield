// Projected registry descriptions only: no query compiler, row access or SQL.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const DATASET_METADATA_OPERATION_IDS = Object.freeze(['list_global_datasets']);
export function createDatasetMetadataValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Dataset metadata configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function datasetMetadataInputDefinition(id) {
    if (!DATASET_METADATA_OPERATION_IDS.includes(id)) fail('Unknown dataset metadata operation');
    return 'DatasetMetadataListInput';
  }
  function datasetMetadataOutputDefinition(id) {
    datasetMetadataInputDefinition(id);
    return 'DatasetMetadataListOutput';
  }
  function validateDatasetMetadataShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown dataset metadata definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (definition !== 'DatasetMetadataListOutput') return value;
    const at = Date.parse(data.generatedAt);
    if (!Number.isFinite(at) || new Date(at).toISOString() !== data.generatedAt)
      fail('Dataset metadata requires a canonical comparable JSON date');
    const keys = new Set();
    for (const dataset of data.datasets) {
      if (keys.has(dataset.key)) fail('Duplicate dataset metadata key');
      keys.add(dataset.key);
      const names = new Set();
      for (const field of dataset.fields) {
        if (names.has(field.name)) fail('Duplicate dataset metadata field');
        names.add(field.name);
        if (field.aggregatable !== (field.type === 'number')) fail('Dataset metadata aggregate flag mismatch');
      }
    }
    return value;
  }
  function normalizeDatasetMetadataInput(id, request) {
    const input = snapshotOperationData(request);
    validateDatasetMetadataShape(datasetMetadataInputDefinition(id), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({
      authoritative: false, sourceConnected: false, producerQualified: false, absenceEvidence: false,
      sourceScope: 'dataset-registry-metadata', queryAuthorized: false, rowAccessAuthorized: false,
      registrySnapshotQualified: false,
    })});
  }
  function assertDatasetMetadataOutput(id, value, request) {
    normalizeDatasetMetadataInput(id, request);
    validateDatasetMetadataShape(datasetMetadataOutputDefinition(id), value);
    // Descriptions/flags are data, never query authority. Exact registry-version
    // identity and completeness require an independently qualified source adapter.
    return value;
  }
  return Object.freeze({datasetMetadataSchemaId: schema.$id, DATASET_METADATA_OPERATION_IDS,
    datasetMetadataInputDefinition, datasetMetadataOutputDefinition,
    normalizeDatasetMetadataInput, validateDatasetMetadataShape, assertDatasetMetadataOutput});
}
