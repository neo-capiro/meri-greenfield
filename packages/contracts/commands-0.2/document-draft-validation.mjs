/** Selected-document approval correlation. Actual source preparation and approval remain their canonical owners' responsibility. */
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
const fail=()=>{throw new Error('Invalid document draft intent');};
const instant=value=>{const n=Date.parse(value);if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)fail();return n;};
export function createDocumentDraftValidators({validateShape,canonicalSha256}) {
 const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
 function context(value) {
  const c=snapshotOperationData(value);validateShape('DocumentDraftContext',c);
  if(c.scopes.some(scope=>scope.tenantId!==c.binding.tenantId))fail();return c;
 }
 function argumentsData(value) {
  const args=snapshotOperationData(value);validateShape('DocumentDraftArguments',args);
  if(args.title.trim()!==args.title||args.title.length>200||args.baseVersionId!==null&&args.baseVersionId.toLowerCase()!==args.baseVersionId)fail();
  return args;
 }
 function normalizeDocumentDraftInput(value,options) {
  context(options);return argumentsData(value);
 }
 function assertDocumentDraftCommand(value,options) {
  const command=snapshotOperationData(value),c=context(options);validateShape('DocumentDraftCommand',command);
  argumentsData(command.arguments);
  if(!same(command.binding,c.binding)||!same(command.scopes,c.scopes))fail();return command;
 }
 function assertDocumentDraftProposal(value,options) {
  const p=snapshotOperationData(value);validateShape('DocumentDraftApprovalProposal',p);assertDocumentDraftCommand(p.command,options);
  if(canonicalSha256(p.command)!==p.commandSha256||instant(p.expiresAt)<=instant(p.createdAt)||p.requiredApprover.tenantId!==p.command.binding.tenantId)fail();
  return p;
 }
 return Object.freeze({normalizeDocumentDraftInput,assertDocumentDraftCommand,assertDocumentDraftProposal});
}
