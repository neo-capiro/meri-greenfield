# Qualified fixture compatibility repair

Pinned base: PR49 `b5243ae164f68c7591b039e8365d9897390543d2`. This branch is a sibling of document workflow PR50 and changes only the qualified application's source compatibility boundary. G1 stays OPEN; source review does not establish native runtime acceptance.

The native owner reported two concrete blockers: client dial `127.0.0.1:55432` differs from the observed server `172.17.0.2:5432`, and the owned database contains 25 evidence namespaces that must remain intact. No native pins, private packet, database contents, SQL execution or container execution are needed in this source lane.

The author owns the schema contract, fixed lifecycle bridge, Python lifecycle admission, schema preservation module, focused tests and narrowly allocated scripted fixture helpers. The independent reviewer owns new compatibility controls and its evidence/report. Integration owns this task, the integration report, source/blob packet, regression captures and publication. All roles use separate worktrees from the pinned base; original assertions, branches, migration bytes and failure records remain preserved.

Implementation outline:

- Keep `host`/`port` as the exact client dial tuple. Optional paired numeric `serverAddress`/`serverPort` bind the observed engine endpoint. Retain database/user, system identifier, startup, version and durability checks, and preserve these facts in lifecycle admission hashes.
- Add an optional closed `schemaScope` with explicit namespace names and owners. The existing descriptor retains strict empty-database installation behavior. Public relations stay empty before installation; canonical namespaces must be absent before installation and owned correctly afterward.
- Snapshot supported declared namespace catalog metadata before and after installation and bind its fingerprint into reconstruction. Do not inspect rows or sequence values. Refuse unsupported object classes explicitly. Reuse all six original migrations and canonical transaction, budget and deadline owners.
- Review mapped endpoint success and mismatch refusal, 25 declared namespaces, wrong/missing namespace or owner, canonical collisions, metadata mutation, unsupported objects, legacy behavior, Node/Python shape parity and terminal unknown outcomes. Run relevant original regression controls without weakening them.

Authorized external actions are Git source publication and a new draft PR only. No runtime, deployment, cloud image, infrastructure, provider or customer-data action is authorized here. The native owner will qualify the reviewed source against its private fixture and report any unsupported metadata class separately.
