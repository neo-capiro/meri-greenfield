# Canonical funding analysis reads

`explain_opportunity_match`, `compare_funding_opportunities`, and
`build_opportunity_action_plan` use the existing Core opportunity adapter and
the ordinary current tenant, member, selected-client, and client-wall owners.
The new `funding-analysis` family is read-only and requires a selected client.
It is available only in an approved capability profile and current installation.

All three preserve the original request and the private server `asOf`
observation. No model clock, provider fetch, scoring override, or task write is
accepted. Core returns its canonical recommendation, separate eligibility and
human decision, source reference, and exact matched values. Comparison preserves
each of the first five requested rows, including unsupported and missing rows,
and declares any omitted rows. The request limit is twenty references.
Program totals, grant bounds, and contract estimates remain separate fields.

Action plans retain the source/client identity, observation, stage, evidence,
unresolved prerequisites, due-date basis, and the composer's optional feasibility
and schedule. An action is a proposal; explicit acceptance in the existing Core
workflow remains necessary to create work. A returned fingerprint is a source
identifier, not authority or proof of exhaustive coverage.

The receiving schema refuses substitutions, invalid deadline arithmetic, missing
comparison rows, undeclared truncation, and task-status fields. Unknown deadline
values remain unknown. Native read discovery and execution now share current
catalog `0.2.25`; preserved operation descriptors and original skill asset pins
remain byte-identical.

Tests cover the actual SDK MCP/control/HTTP transport with synthetic source and
identity ports, and the exact observation carriers are also tested through the
Core HTTP controller. These checks do not constitute deployment, live source,
or provider qualification. The wider A6 graph and buyer-workspace work remains
separate and incomplete.
