# REL-02 private catalog binding candidate

SOURCE_ONLY; ready for independent source review. This is not full REL-02,
G1, source activation, runtime, tenant authorization or release qualification.
No AWS write, provider/model request, SDK session, live source reader, remote
publication, merge or shared resource action occurred.

## Result and canonical ownership

The private 0.2 catalog now binds 13 existing typed operations: the original
three mail operations, three meeting operations, query_tasks,
search_capiro_data and five federal market operations. All 13 remain
`handler:null`, `availability:unimplemented`, `qualification:pending`, with
zero retries. The catalog version intentionally advances to 0.2.1; contract
and operation versions remain 0.2.0. All 139 original identities, dispositions
and boundaries are preserved: 96 selected, 43 deferred, 13 mapped and
83 selected still pending/unmapped. query_action_items remains pending with
no replacement: client-scoped reading does not close its unscoped legacy mode.
The original three mail descriptor objects and order are unchanged.

`catalog-validation.mjs` owns one operation/schema/callback registry and the
catalog preservation, alias, replacement, schema-definition, raw-byte hash and
availability guards. `validate.mjs` remains thin composition of the existing
canonical schema loader and family factories. `operation-contracts.mjs` owns
an immutable source-catalog snapshot, inert bounded JSON ownership and private
callback resolution. Existing mail, meeting, task, federal and data-search
factories remain the semantic owners; their bytes and all nine schema files
are unchanged. Public 0.1 exports, generated files, package metadata, locks,
runtime, image and infrastructure source are unchanged.

The new private export is:

```js
const contract = resolveOperationContract({id, version});
const normalized = contract.normalizeInput(parsedArguments, context);
// {request, input, metadata, argumentsSha256}; immutable, defaults before hash
contract.assertOutput(parsedOutput, {request: normalized.request, ...context});
```

The returned contract includes immutable `descriptor` and registry `binding`.
That binding is schema/callback metadata, not an authorization RunBinding.
Unknown references and versions refuse. Required contexts preserve native
semantics: task uses nowMs/actorId, upcoming meetings use nowMs, and continued
mail output uses previousPage where required. Native client-meeting inventory
and body modes retain distinct output validators. Federal output retains its
existing paging checks and its unproven total/freshness relations.

Opaque caller data rejects proxies before reflection, accessors, executable
values/toJSON, custom prototypes, cycles, hidden properties and sparse arrays
without executing them. Ownership uses bounded inspection before recursive
serialization: 100,000 nodes, 64 levels and a conservative 16 MiB encoding
budget. Iterative freezing does not spread wide arrays. These are intentional
new private admission limits, separate from narrower family rules and gateway
raw-request limits; conservative syntax accounting may refuse just below
16 MiB. Errors from this admission contain no caller values.

## Verification and preserved failures

- Final all-contract/Hermes suite: **201/201 pass**. All original 187 case bodies
  remain except exactly five approved registration characterizations; 14 new
  cases cover bindings, hash/definition drift, mappings, aliases, disabled
  metadata, contexts/defaults/digest ordering, canonical output modes,
  caller-code refusal, data ownership and deep/wide/byte bounds.
- Focused candidate suite: **14/14 pass**.
- Public distribution check: generated-byte verification, strict TypeScript
  checks and **7/7 public tests pass**.
- Source-preservation proof: all nine schema files and five family validator
  owners byte-exact; all other tracked base files outside the authorized
  catalog/loader/five characterization paths unchanged. All five original test
  files are retained, and bytes outside their authorized bodies are exact.
  Original pre-registration schema/semantic assertions and unavailable-skill
  manifest/assertion suffixes are preserved.

Raw captures retain every failure and its reason. The original three-only
catalog assertion failed intentionally on expansion. The first 11-case
resolver run found an actual source defect: client-meeting inventory selection
omits sourceId rather than setting null; the callback now delegates inventory
for undefined, and the same assertion passed. The first expanded root suite
was 194/198: four stale unregistered-contract expectations were migrated only
after explicit parent scope approval, retaining their other assertions. A new
calendar fixture initially used invalid scope kind `user`; it was corrected to
existing canonical `private-user`, with the invalid fixture and 12/13 failure
capture preserved. Three substantive later regressions raised the final suite
from 198 to 201; no case was removed or weakened to lower the count.

All checks used pinned local Node 24.19.0 and physical copies of the accepted
root/contracts dependency trees. No dependency install or lock modification
occurred; this is not a complete installed-tree attestation. Each raw command
receipt records argv, bounded timeout, replacement PATH/LANG/LC_ALL/TMPDIR
only, byte/hash identities and independently absent owned process group. This
was not an OS network sandbox. Owned temporary files were cleaned after checks;
borrowed shared resources were not disposed.

## Limits and next dispatch dependencies

Descriptor source requirements are **design-only prerequisites**, using
abstract source/domain labels, not verified current source IDs/endpoints or
producer principals. Dataset/domain name differences remain a qualification
issue. Capiro current actor IDs, memberships, grants, producer access and
credentials were not queried or invented. No reader exists or is activated by
these descriptors, and assertion success does not establish trustworthy data,
coverage, freshness, memory eligibility or a current authorization decision.

The gateway owner can consume this private resolver without guessing family
export names or duplicating the registry. Its current concrete availability
check must expose zero tools and call zero handlers. Real dispatch still needs
trusted raw JSON framing, current actor/member/client/mailbox/memory/source
policy checks, run-bound fencing, approved restricted producer principals and
readers, measured authoritative coverage/provenance, immutable snapshots and
cursors, decisive reads/revocation, and real SDK/proxy discovery. Memory
lifecycle/knowledge graph and the remaining 83 selected mappings are separate
unfinished work. Optional Decisions/JEV routing cannot supply authorization.

Diff whitespace inspection passes for source/docs after excluding immutable raw
stdout capture blobs. The unfiltered check reports trailing blank-line spaces
inside three original failed Node stdout streams; those exact evidence bytes
are intentionally retained rather than rewritten. This is disclosed evidence
formatting, not a suppressed source warning.
