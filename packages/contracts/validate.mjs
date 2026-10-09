import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import canonicalize from 'canonicalize';

export const contractVersion = '0.1.0';
const schema = JSON.parse(readFileSync(new URL('./meri.schema.json', import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(schema);
const validators = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));

export function validateShape(name, value) {
  const validator = validators.get(name);
  if (!validator) throw new Error(`Unknown contract ${name}`);
  if (!validator(value)) throw new Error(`${name}: ${ajv.errorsText(validator.errors)}`);
  return value;
}

export function canonicalSha256(value) {
  const bytes = canonicalize(value);
  if (typeof bytes !== 'string') throw new Error('Value is not canonical JSON');
  return createHash('sha256').update(bytes, 'utf8').digest('hex');
}

export function assertWorkspacePaths(manifest) {
  validateShape('WorkspaceManifest', manifest);
  const seen = new Set();
  for (const { path } of manifest.entries) {
    // Freeze portable POSIX relative paths; reject rather than normalize hostile input.
    const parts = path.split('/');
    if (path.startsWith('/') || path.includes('\\') || /[\x00-\x1f\x7f:]/u.test(path) || parts.some(p => !p || p === '.' || p === '..')) {
      throw new Error(`Unsafe workspace path: ${JSON.stringify(path)}`);
    }
    const normalized = path.normalize('NFC');
    if (normalized !== path || seen.has(normalized)) throw new Error('Conflicting workspace paths');
    seen.add(normalized);
  }
  for (const path of seen) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      if (seen.has(parts.slice(0, i).join('/'))) throw new Error('Conflicting workspace file ancestor');
    }
  }
}

export function assertProposalIntegrity(proposal) {
  validateShape('ApprovalProposal', proposal);
  if (canonicalSha256(proposal.command) !== proposal.commandSha256) throw new Error('Immutable command hash mismatch');
  if (Date.parse(proposal.expiresAt) <= Date.parse(proposal.createdAt)) throw new Error('Invalid approval lifetime');
  if (proposal.requiredApprover.tenantId !== proposal.command.binding.tenantId) throw new Error('Cross-tenant approval');
}

export function assertCommandExecution(proposal, execution) {
  assertProposalIntegrity(proposal);
  validateShape('CommandExecutionRequest', execution);
  if (execution.proposalId !== proposal.proposalId || execution.commandSha256 !== proposal.commandSha256 || execution.idempotencyKey !== proposal.command.idempotencyKey) {
    throw new Error('Execution intent mismatch');
  }
  for (const key of ['tenantId','actorId','conversationId','runId']) {
    if (execution.executorBinding[key] !== proposal.command.binding[key]) throw new Error('Execution stable binding mismatch');
  }
  // Current attempt/worker/fence come from the trusted executor, preserving the
  // immutable original producer provenance across approval-wait recovery.
}

// These helpers check protocol structure only. They grant no authorization,
// prove no persistence, and cannot substitute for gateway/broker checks.
