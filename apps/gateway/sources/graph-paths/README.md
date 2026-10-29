# Native source-linked graph paths

`find_path_to@0.2.0` uses the fixed Core route `/api/clio/tools/find_path_to`.
The existing control owner checks current execution and native Core authority.
A client-scoped call must supply that exact client ID; General can omit it or
select a currently visible client. The final release check also withholds a
General result if the canonical Core client roster loses access during the read.
No credential, grant or separate graph authority is created.

Catalog 0.2.27 adds a closed input and result contract. The receiver checks exact
target and client identity, path continuity, source references, relationship
classification, depth and path limits, and partial coverage. Source text stays
untrusted. Oversized data fails rather than being silently clipped.

The Core fixture at `packages/contracts/test/fixtures/graph-paths.wire.json`
comes from the actual PostgreSQL-backed path reader with synthetic records in
`apps/api/src/meri/meri-graph-paths.postgres.spec.ts`. Tests exercise those exact
bytes through the receiver and the installed SDK MCP path over synthetic HTTP.
Core source: PR https://github.com/neo-capiro/capiro-backend/pull/259, integrated commit 270541798a4828d46bf3afe21abff4b28ce66890. Historical catalog descriptors remain unchanged.

The graph is current-only. A complete bounded search cannot prove that all
relationships are known or that a target is absent. Note mentions are thematic;
cache links are derived and always report bounded coverage. Cache reference keys
do not claim primary-document provenance, and legacy rounded aggregate labels
are not used as path evidence. Historical-window queries remain unsupported.

Source registration does not enable a deployment. Actual installation, current
source completeness and live acceptance still require qualification. No build,
deployment, provider/model call or independent review was performed in this slice.
