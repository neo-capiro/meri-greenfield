/** Canonical raw command selection to immutable intent/result correlation only. */
import { assertProposalIntegrity } from '../validate.mjs';
import { snapshotOperationData } from '../retrieval-0.2/operation-contracts.mjs';

const fail = () => { throw new Error('Invalid command tool correlation'); };
export function createCommandToolValidators({payloads, taskUpdate, intents, validateShape, canonicalSha256}) {
  const same = (a,b) => canonicalSha256(a) === canonicalSha256(b);
  // Actions are the canonical command vocabulary. Selected tool IDs and schema
  // bindings belong exclusively to the operation registry that invokes this API.
  function domain(action) {
    if (action === 'task.create') return {normalize:payloads.normalizeTaskCreateInput, check:payloads.assertTaskCreateCommand};
    if (action === 'task.update') return {normalize:taskUpdate.normalizeTaskUpdateInput, check:taskUpdate.assertTaskUpdateCommand};
    if (action === 'memory.propose') return {normalize:payloads.normalizeMemoryProposeInput, check:payloads.assertMemoryProposeCommand};
    if (action === 'artifact.file') return {normalize:payloads.normalizeArtifactFileInput, check:payloads.assertArtifactFileCommand};
    fail();
  }
  function context(value, requiredCommand=false) {
    const data = snapshotOperationData(value);
    if (!data || Array.isArray(data) || typeof data !== 'object' ||
        Object.keys(data).some(key => !['commandContext','command','proposal'].includes(key)) ||
        !Object.hasOwn(data,'commandContext') || (requiredCommand && !Object.hasOwn(data,'command'))) fail();
    return data;
  }
  function normalizeCommandToolInput(action, request, options) {
    const raw = snapshotOperationData(request), selected = context(options), owner = domain(action);
    const normalized = owner.normalize(raw,selected.commandContext);
    const input = action === 'artifact.file' ? normalized : {arguments:normalized, attachments:[]};
    if (Object.hasOwn(selected,'command')) {
      const command = owner.check(selected.command,selected.commandContext);
      if (command.action !== action || !same(command.arguments,input.arguments) || !same(command.attachments,input.attachments)) fail();
    }
    return {input:snapshotOperationData(input), metadata:null};
  }
  function assertCommandToolProposal(action, raw, request, options) {
    const selected = context(options), proposal = snapshotOperationData(raw);
    if (action === 'task.update') taskUpdate.assertTaskUpdateProposal(proposal,selected.commandContext);
    else assertProposalIntegrity(proposal);
    if (Object.hasOwn(selected,'command') && !same(selected.command,proposal.command)) fail();
    normalizeCommandToolInput(action,request,{commandContext:selected.commandContext,command:proposal.command});
    if (Object.hasOwn(selected,'proposal') && !same(selected.proposal,proposal)) fail();
    return proposal;
  }
  function assertCommandToolOutput(action, outputShape, raw, request, options) {
    const selected = context(options,true);
    normalizeCommandToolInput(action,request,selected);
    const result = snapshotOperationData(raw);
    validateShape(outputShape,result);
    if (result.status === 'approval_required') {
      if (!Object.hasOwn(selected,'proposal')) fail();
      result.proposal = assertCommandToolProposal(action,result.proposal,request,selected);
    }
    if (result.status === 'observed')
      result.outcome = intents.outcome(result.outcome,selected.command,selected.commandContext);
    // An indeterminate observation grants no retry, rollback, refund or effect
    // success. Historical readOutcome's absent state is not an execution result.
    return snapshotOperationData(result);
  }
  return Object.freeze({normalizeCommandToolInput,assertCommandToolProposal,assertCommandToolOutput});
}
