// Private payload structure and correlation only. No command execution or grants.
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {validateShape as validatePublicShape, canonicalSha256} from '../validate.mjs';
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
import {createTaskCreateValidators} from './task-create-validation.mjs';
import {createArtifactFileValidators} from './artifact-file-validation.mjs';
import {createMemoryProposeValidators} from './memory-propose-validation.mjs';

export const contractVersion = '0.2.0';
const ajv = new Ajv({strict: true, allErrors: true});
addFormats(ajv);
const readSchema = relative => JSON.parse(readFileSync(new URL(relative, import.meta.url)));
ajv.addSchema(readSchema('../meri.schema.json'));
const schemas = ['task-create', 'artifact-file', 'memory-propose'].map(group => readSchema(`./${group}.schema.json`));
for (const schema of schemas) ajv.addSchema(schema);
const validators = new Map();
for (const schema of schemas) {
  for (const name of Object.keys(schema.$defs)) {
    if (validators.has(name)) throw new Error(`Duplicate private command definition ${name}`);
    validators.set(name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`}));
  }
}

// Shape checks do not imply the stronger named command/result correlations below.
export function validateCommandShape(name, value) {
  if (typeof name !== 'string' || !validators.has(name))
    throw new Error('Unknown private command definition');
  const data = snapshotOperationData(value), check = validators.get(name);
  if (!check(data)) throw new Error(`${name}: ${ajv.errorsText(check.errors)}`);
  return data;
}

const dependencies = {validateShape: validateCommandShape, validatePublicShape, canonicalSha256};
export const {normalizeTaskCreateInput, assertTaskCreateCommand, assertTaskCreateResult} =
  createTaskCreateValidators(dependencies);
export const {normalizeArtifactFileInput, assertArtifactFileCommand, assertArtifactFileResult,
  assertArtifactFileReceipt, assertArtifactFileVersion} = createArtifactFileValidators(dependencies);
export const {normalizeMemoryProposeInput, assertMemoryProposeCommand, assertMemoryProposeResult} =
  createMemoryProposeValidators(dependencies);
