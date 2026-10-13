# Native authority and SDK session source outline

Base: `efacbfd9b599e458250f9bb624a72626f4e769d2`. Owned paths initially: new `apps/runtime/native-authority/**` only. Activation stays disabled. No protected database, identity/provider, model, AWS, credential, permission, or security-setting operation is part of this source task.

## Existing owners and source constraints

- Clerk and current tenant/user membership remain authoritative outside Meri. Capiro auth source is read-only reference; it is not imported or copied. The actual `GET /me` and `/me/memberships` routes expose profiles, not the required bounded client-wall/context receipt.
- `createActionSessionOwner` remains the one process-local opaque application-session owner. It must continue to call current native identity/context, retain immutable context, and deny expiry/revocation/replacement.
- `createCapiroApplicationAuthorityClient` and `createApplicationContextAdapters` already own the fixed proposed native identity/context wire and its join to a current Meri run.
- `createPostgresAdmittedRunOwner` owns current persisted run/grant/fence/policy/allocation checks; source task must reuse it rather than duplicate authorization SQL or mint a parallel grant ledger.
- `FixtureRegistry` owns only the partial `sdk-interruption-fixture-v1` certificate/admission experiment. Its methods and receipts are not a product identity/task authority or SDK SessionStore.
- SDK `0.3.295` owns SessionStore entry semantics. Existing `bound-session-store.mjs` and `session-store-data.mjs` own inert opaque JSON, exact key/subpath binding, bounded queues, and the no-more-dispatch uncertainty barrier. UI conversation events are a separate store.

## Proposed interfaces awaiting integration allocation

1. A fixed `/v1/identity/verify` and `/v1/context/resolve` provider composition should adapt the EXISTING canonical authority client/context owner, never create identity/membership from selector IDs. Its receipts keep existing closed principal/revision/time/hash/binding/scope shapes. Parent subsequently confirmed that newer backend identity/context routes and native pair tests exist. The local reference below is stale; current backend pin/schema is awaited, so no competing identity API is implemented.
2. `/v1/worker/authorize` must bind actual presented task capability to current canonical persisted admission/grant, full binding, policy, permitted operation and input hash, and current native identity/client authorization before and after. Reusing a fixture grant as a product capability or inferring scopes from task/client IDs is forbidden. Provider service authentication remains a separate existing native-owner gate.
3. Durable SessionStore needs exact owner-registered `{projectKey,sessionId}` and opaque permitted subpaths; `load`, `append` and `listSubkeys` preserve supported transcript entries and UUID-less markers. A worker request is never session registration or new authority.
4. Proposed private append wire requires retained `appendId`, `expectedOffset`, and `entriesSha256` in addition to exact binding/key/entries. Identical UUID-less batches cannot be distinguished as replay versus a legitimate next append from bytes alone. UNKNOWN must not cause automatic resend or a second SDK writer.
5. Proposed canonical admission extension: an internal `withCurrentAllocation({binding,signal,deadlineMs?}, effect)` using the SAME admitted owner's lease and locks for currentness/effect checks. A read-only `currentAllocation` snapshot outside another transaction is insufficient for atomic session fence admission. Root owns allocation of that shared owner change and the product migration ID; no shared code or migration is changed here.

Dependency direction is provider HTTP -> canonical current owner/context -> durable session storage; model worker has only its exact task capability and receives no source database/provider/admin credentials. No new agent loop, orchestration engine, Clerk wrapper, auth ledger or callback boolean proof is proposed.

## Decisive blockers discovered

- Initial absence observation applies ONLY to local Capiro reference `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Parent corrected that newer backend identity/context routes and native pair tests already exist. Current backend pin/response schema is pending; treat this as a mapping investigation, not proof of a missing actual API. Do not create another authority endpoint.
- Runtime `/v1/worker/authorize` is currently a required provider contract with synthetic test replies, not an implemented product native task-authentication issuer.
- Runtime runner forwards only SessionStore load/append. Trusted SDK session-key registration, subagent-key enumeration, retained append identity, and same-transaction native fence/current-allocation checks are not wired.

## Verification and checkpoint

Inspect the complete committed capability inventory and R-01 through R-12 requirements. Focus this increment on N-054/N-072/N-074/N-075/N-254 through N-267 and R-02/R-07/RG-07/RG-12; it does not close the whole plan. Local actual Fetch/upstream SDK/SQL-protocol controls should cover inert imports, closed bytes, current actor/tenant/client/scope/fence/policy/expiry/input-hash coherence, parked-port revocation, foreign keys/subpaths, opaque duplicates, UUID replay/conflicts, commit UNKNOWN, bounded cancellation, and owned cleanup. No synthetic reply establishes native acceptance. Preserve failures and record exact source pins and resource cleanup. First concrete interface/source checkpoint is bounded to 25 minutes.
