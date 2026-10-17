# Personal user preferences

`createUserPreferencesFeature({enabled:false})` is inert and returns null. Enabled composition accepts a borrowed PostgreSQL pool,
the existing current native membership gate, clock/id owners and optional limits. It composes the canonical settings PostgreSQL store,
user service and bounded product Fetch application. User methods require no tenant/platform capability owner. The service owns no
listener and never closes borrowed resources.

The new `createUserPreferencesService` is also reused by the existing full settings service, preserving one canonical user owner.
Settings document validation, current client eligibility, revision CAS and content-free audit stay with those original owners.
The store derives changed paths from its locked prior document, not an earlier service read; canonical defaults preserve the first-save
baseline. User and tenant saves no longer perform that redundant pre-read, so a read-only transaction cannot masquerade as an uncertain write.
The complete document is saved; absent fields do not reset silently. Native identity and current membership determine the tenant/actor.
Current membership is rechecked before release, including after an acknowledged save.

POST `/api/settings/user/read` accepts `{}`. POST `/api/settings/user/save` accepts `{expectedRevision,preferences}`.
Success is `{owner:{tenantId,actorId},revision,preferences}`. The response owner is independently correlated by the frontend public
receiver. `SETTINGS_REVISION_CONFLICT` requires an explicit reload. `SETTINGS_COMMIT_UNKNOWN` / `UNKNOWN` never means failure or success;
reconcile by reading the current document and preserving the attempted revision/document. An acknowledged save withheld after access
loss reports `RESULT_NOT_RELEASED`. No automatic mutation or blind retry is provided.

## Shipping integration handoff

Current parent coordination assigns first-shipment image qualification, service deployment/integration and live acceptance to dot.
The earlier proposed Fable transfer was canceled. This independent branch does not edit shared runtime bindings, shipping pins,
gateways or image/deployment sources.

The shipping integrator may compose this feature from its trusted product-ports factory using that factory's borrowed pool, clock and
canonical `conversationMembership` gate. A later independently reviewed runtime change must capture an optional application handle
and route only the two exact paths above, behind its source-enabled readiness gate. Absent or disabled composition must call the
declared `userPreferencesUnavailable()` closed 503. The application itself still rejects query strings, non-POST, encoded/non-JSON,
oversized input, stale native identity, changed membership and all tenant/admin settings paths.

The settings DDL remains proposal-only. Table allocation, migration, privileges, restore/retention and real PostgreSQL qualification
are shipping prerequisites. This source neither allocates nor applies a migration and establishes no live persistence. Appearance
preview, notification delivery and default-client selection are separate consumers; stored values alone do not establish those effects.
