# Application adapter independent review

Base: `ad0bdfeb830fee11f1f39c4a8a7037215595c4cf`. Reviewer branch: `review/meri-application-adapters-20261013`; separate author `gateway_author`. Criteria frozen before candidate inspection.

Own only new `apps/control/action-host/application-adapters/*-independent.test.mjs`, this task, matching review report and `docs/qualification/candidates/application-adapters-20261013/reviewer/**`. No production/shared/frontend/Capiro edits, delegation, installs, native identity/provider/DB/cloud calls or private evidence access. Local source checks use inert owned ports and bounded captures; live integration remains unqualified.

Acceptance criteria:

- Inspect the approved literal API and actual existing session/host/Capiro boundaries. Reuse canonical validators, lifetimes, HTTP handling and owners; adapter composition must perform concrete work without a second policy or approval engine.
- Native credentials are verified only by trusted verifier; no decoded-token, header, body, selector or supplied receipt may establish tenant/actor/run/client authority. Context comes from current authoritative owners, and explicit hints only select an allowed exact context.
- Closed inert receipts correlate full identity digest, principal/revisions, current binding/client/scopes, and fresh checked/expiry times. Reject extra fields, substituted owner facts, malformed/Proxy/getter values without side effects or credential disclosure.
- Use the existing opaque session owner and host flow. Verify current revocation/expiry/fence/policy changes, stable session scope and original/current provenance. Pending operations must recheck authority and membership after awaits.
- Propagate one shrinking original cutoff through verification, context, host/execution and release. Late owner results cannot start new work or release stale authority; cancellation and known UNKNOWN/STORED_NOT_RELEASED/RESULT_NOT_RELEASED outcomes retain existing meaning.
- Imports/default construction are inert. Fixed endpoints/configuration and bounded transport apply if HTTP is introduced. No listener, credential logging, unbounded retries or disposal of borrowed dependencies.
- Exercise actual accepted application/session composition using synthetic boundary ports. Preserve meaningful negatives and immutable failing source/raw outputs before repairs; never alter original tests to hide a defect.
- Compare exact final source and allowed original-path changes; public package, catalog, existing contracts and approval semantics stay unchanged unless separately root allocated. Verify raw hashes and physical exit of owned processes; delete only reviewer-owned temporary dependencies.

A final ACCEPT_SOURCE requires an exact coherent source freeze, independent meaningful checks and concise evidence. It does not qualify live Capiro/native identity, deployment, database persistence or current customer policy.
