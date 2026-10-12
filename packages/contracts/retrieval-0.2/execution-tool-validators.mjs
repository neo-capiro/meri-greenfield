/** Deliberate contract composition; domain validators own their semantics. */
import * as commandPayloads from '../commands-0.2/validate.mjs';
import {createCommandIntentValidator} from '../commands-0.2/execution-intent.mjs';
import {createCommandToolValidators} from '../commands-0.2/tool-interface-validation.mjs';
import { createArtifactValidators } from '../artifacts-0.2/artifact-validation.mjs';

export function createExecutionToolValidators({schemaShape,validatePublicShape,canonicalSha256}) {
  const taskUpdate=commandPayloads.taskUpdateValidators;
  const commandToolValidators=createCommandToolValidators({payloads:commandPayloads,taskUpdate,
    intents:createCommandIntentValidator({taskUpdate}),canonicalSha256,
    validateShape:(name,value)=>schemaShape('command-tools',name,value)});
  return Object.freeze({commandToolValidators,artifactValidators:createArtifactValidators({
    validateShape:(name,value)=>schemaShape('artifacts',name,value), validatePublicShape, canonicalSha256,
  })});
}
