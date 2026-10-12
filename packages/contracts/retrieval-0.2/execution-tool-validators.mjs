/** Deliberate contract composition; domain validators own their semantics. */
import { createArtifactValidators } from '../artifacts-0.2/artifact-validation.mjs';

export function createExecutionToolValidators({schemaShape,validatePublicShape,canonicalSha256}) {
  return Object.freeze({artifactValidators:createArtifactValidators({
    validateShape:(name,value)=>schemaShape('artifacts',name,value), validatePublicShape, canonicalSha256,
  })});
}
