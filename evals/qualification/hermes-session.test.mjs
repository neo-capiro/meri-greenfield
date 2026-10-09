import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateShape,
  canonicalSha256,
  assertWorkspacePaths,
  assertProposalIntegrity,
} from '../../packages/contracts/validate.mjs';

// H00 qualification fixture. Synthetic data only. The test references the frozen
// 0.1.0 contracts read-only through the existing validator; it never edits them.
const fixture = JSON.parse(
  readFileSync(new URL('./hermes-session.fixture.json', import.meta.url), 'utf8'),
);
const clone = (value) => structuredClone(value);

test('fixture conforms to frozen 0.1.0 WorkspaceManifest and ApprovalProposal shapes', () => {
  validateShape('WorkspaceManifest', fixture.workspace);
  validateShape('ApprovalProposal', fixture.proposal);
});

test('accepts the portable workspace and the unchanged approved command', () => {
  assertWorkspacePaths(clone(fixture.workspace));
  assertProposalIntegrity(clone(fixture.proposal));
  // The stored hash must equal an independent canonicalization of the command,
  // proving the approved intent is byte-identical to what was hashed.
  assert.equal(canonicalSha256(fixture.proposal.command), fixture.proposal.commandSha256);
});

test('rejects traversal and non-portable workspace paths before restoration', () => {
  for (const path of [
    '../secret',
    '/etc/passwd',
    'C:/secret',
    'out\\secret',
    'a//b',
    'a/./b',
    'a/../b',
    'outputs/',
  ]) {
    const manifest = clone(fixture.workspace);
    manifest.entries[0].path = path;
    assert.throws(() => assertWorkspacePaths(manifest), /Unsafe/);
  }
});

test('rejects a mutated approved command argument', () => {
  const proposal = clone(fixture.proposal);
  proposal.command.arguments.title = 'Mutated after approval';
  assert.throws(() => assertProposalIntegrity(proposal), /hash mismatch/);
});

test('rejects a mutated attachment version', () => {
  const proposal = clone(fixture.proposal);
  proposal.command.attachments[0].versionId = 'v2';
  assert.throws(() => assertProposalIntegrity(proposal), /hash mismatch/);
});
