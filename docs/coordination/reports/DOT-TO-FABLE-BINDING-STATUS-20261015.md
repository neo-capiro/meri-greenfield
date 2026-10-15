# Fable binding-status supplement - historical retained evidence

Recorded 15 October 2026. **Evidence as of 2026-10-14 10:12 UTC, retained historically and relayed by the parent integration coordinator. This is not fresh verification of the latest Fable source, deployed revisions or AWS state.** Read alongside [the main completion packet](https://github.com/neo-capiro/meri-greenfield/blob/8bbe8405e03964072ed79be068d2d0a84cf71609/docs/coordination/reports/DOT-TO-FABLE-COMPLETION-INSTRUCTIONS-20261015.md) and [the pickup addendum](https://github.com/neo-capiro/meri-greenfield/blob/764d8a9d0784450f10f3c9de3212e20c74663bec/docs/coordination/reports/DOT-TO-FABLE-PICKUP-ADDENDUM-20261015.md).

| Binding | Historical evidence and remaining product dependency |
| --- | --- |
| Backend identity and context | Backend source implements `POST /api/clio/application-authority/identity` and `POST /api/clio/application-authority/context` using `TenantContext.userId`. Current deployed origin/revision and transport are unverified. |
| Product PostgreSQL | Endpoint, principals, TLS, selector and migration hashes are unbound. The stopped `127.0.0.1:55432` fixture is qualification only. The proposed runtime-preview database and secrets are not deployed bindings. Source migration allocation does not establish schema application or a runtime pool. |
| Temporal | Endpoint, namespace, task queue and TLS are unbound. |
| Runtime and task authority | Qualification ECS/ECR exists in the retained evidence, but no product image is admitted. Task grants, broker, verifier, provider and registration reader are unbound. |
| Model and budget | Historical selection `us.anthropic.claude-sonnet-4-6` and the $10 synthetic ceiling do not establish a product proxy route, model binding, budget or per-run capability/credential issuer. This supplement renews no allowance. |
| Frontend and preview session | Source routes `/api/action-followthrough/session` and `/api/conversations/submit` exist in the retained evidence; deployed trusted bootstrap, control, session and proxy bindings are unverified. |
| Storage and artifact output | Qualification storage exists in the retained evidence with versioning, KMS and public access blocked. Product principal, prefix, grants and output owner are unbound. Qualification storage does not supply a product artifact binding. |

Fixtures, proposed resources and source interfaces do not establish usable authenticated product infrastructure. Shipping and the relevant backend/frontend owners must return fresh, safe binding references, exact environment/source/image identities and tested behavior before live gates can pass. Keep dependent live tests UNRUN with these dependencies named; preserve the original qualification gates. No infrastructure, source implementation, credential, secret reference or private infrastructure ARN is published or changed by this supplement.
