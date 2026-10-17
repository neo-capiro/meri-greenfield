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

Dot owns first-shipment image qualification, service deployment/integration and live acceptance. This continuation implements runtime
source composition on its separate feature branch; shipping pins, deployment settings and image recipes remain untouched.

The control-only configuration declaration `userPreferences: {enabled: true}` composes the feature in `assembleControl` using the
control's borrowed pool, clock and captured canonical `conversationMembership` gate. Absent/false declarations remain inert. A declared
enabled feature without native membership or either required settings relation refuses startup before listeners open. The runtime
adapter opens only after its bounded schema readiness check, preserves serving through healthy pending checks, closes on the latest
failed check, and cannot reopen after retirement. It never closes the borrowed pool. Readiness names `settings.userPreferences` separately.

Only the two exact paths above reach the public application; the private listener and neighboring tenant/admin paths exclude them.
Absent, disabled or unready composition calls `userPreferencesUnavailable()` closed 503. The canonical application still rejects query
strings, non-POST, encoded/non-JSON, oversized input, stale native identity and changed membership. The frontend separately requires
`MERI_USER_PREFERENCES_ENABLED=true`; no flag or readiness row establishes deployed qualification or authority.

The existing reserved migration `apps/control/settings/migrations/0001_settings.sql` is adopted byte-exact from owner B's source
`cf639d4707df0060524218c65d941834ed7ea2e3`, blob `048a834c4335f97aa5f8691afc3c310188ec4388`; no duplicate ID/schema is invented.
Applying it, runtime privileges, restore/retention and real PostgreSQL qualification remain separate prerequisites. This source neither
allocates nor applies a migration and establishes no live persistence. The guarded qualification suite requires the separately allocated
loopback task-owned PostgreSQL window before setup or execution; defaults skip explicitly. Appearance
preview, notification delivery and default-client selection are separate consumers; stored values alone do not establish those effects.
