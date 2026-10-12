# Independent client registry family review

**ACCEPT_SOURCE** for registry family freeze
`56a917f59e849630f50933e31703a2c7c262be1d` **with mandatory author repair**
`deba2c13c612845b4f65e38c263982c698bb4361`. Reviewed composite:
`8f44407cbd2f4529e89ebff8547efadb58847c2a`, tree
`01b19b6a51f55bdd49878227940f15aade642876`. The unrepaired freeze remains
**HOLD** for the description bound below. This verdict covers the private family
and canonical loader only; catalog/gateway integration and runtime remain unaccepted.

Criteria were frozen in review-only commit
`63bfb5dc9abe397c35704c98f211b0bf78866f2d`. The reviewer wrote no production
repair: the author supplied the repair, cherry-picked as `8f44407` for replay.
Exact source hashes are retained in
[preservation audit](../../qualification/candidates/capability-next-20261012/registry-review/preservation-audit.stdout.bin).

## Finding and verification

The first independent replay was **68 pass / 1 fail**. A description containing
101 astral characters occupies 202 UTF-16 code units but passed JSON Schema's
200-code-point bound. Immutable producer helper `summarizeText` measures JavaScript
string length and limits the projection to 200 UTF-16 units. The author added a
semantic length check for exact and candidate projections; null handling and the
schema remain unchanged. Original raw failure and exact initial test bytes are
retained. The original 69 controls then passed unchanged.

Final maintained replay: **76/76** (68 independent + 8 author). It covers exact
trim/UTF-16 selector behavior including split surrogates, stable caller input,
unsupported authority, getter/proxy refusal before execution, required nullable
fields, privacy projection, signed integer limits, duplicate/exact candidate
identity, candidate count, Unicode descriptions and inert guidance. The initial
unbound-registration characterization moved to preservation evidence because
root owns the later binding; the Unicode control was strengthened for both
branches. No failing behavior assertion was removed or weakened.

Reference AST/data audit: **21/21**. All three private reference blobs match
Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` and are unchanged at observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Inspected source metadata:

- `apps/api/src/meri/meri-tools.service.ts`: lookup at line 9045, local `LdaPick`
  at 10267, selector helpers at 9942/9948, summary helper at 10285.
- `apps/api/prisma/schema.prisma`: tenant-client string projection and LDA
  signed integer/string/null scalar declarations.
- `apps/api/src/meri/meri-tools.create-client.spec.ts`: four lookup outcome
  calls at lines 86, 96, 109 and 117.

Only field/type/line/hash findings were retained; private bodies were neither
published nor imported, compiled or executed. Two audit attempts were **20/21**
because the reviewer's AST walker omitted the identifier-call form used by bound
lookup test functions. Exact checkers and failures remain; the corrected walker
recognizes the actual call form. This was a reviewer tooling defect.

Preservation audit: **47/47**. Public 0.1, existing private schemas, catalog,
registry, resolver, original 139 rows/15 descriptors, locks, runtime paths, R2
inventory/plan and RC1/main references remain unchanged. The family is still
unbound, with native row pending/null, in this reviewed composite. The separate
integration reviewer must qualify root's binding and resulting counts.

Authored whitespace checking found a redundant final blank line in the reviewer
test. The current test was corrected without behavior changes. Both failed
checks remain; only the exact preserved pre-fix snapshot has a whitespace
attribute exemption so its failure bytes stay intact.

## Limits and cleanup

The selected wire projection contains no provenance/snapshot/coverage envelope.
Empty candidates and null matches cannot prove absence, source health, freshness
or completeness. Guidance can mention creation but remains reported text; it
creates no approval or write authority. Tenant membership alone cannot authorize
client visibility. Real adapters and the gateway must enforce current tenant,
client and public-registry source policy and preserve upstream failures.

The direct output function is a structural/relational validator for data; bounded
inert JSON admission remains the canonical resolver's responsibility at later
binding. It does not itself establish authorization or immutable source proof.
No source adapter, enabled handler, model loop or activation was added.

All local captures exited and their owned process groups were absent. Existing
copied dependencies were borrowed unchanged; no install or network operation
ran. No native fixtures, runtime/services, database/provider/cloud action or
customer data were used. Source connectivity stays disabled; G1 remains OPEN
and G2–G7 unentered.
