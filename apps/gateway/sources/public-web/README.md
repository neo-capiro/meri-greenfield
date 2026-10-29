# Public-web native bindings

Implementation outline: this family owns two explicit native POST bindings and
source-shaped synthetic fixtures. The shared retained native handler owns current
authority checks, credential selection, bounded transport and the private result
carrier. Frozen receiving contracts own input normalization and output checks.
General-read integration owns installation and exposure; construction grants
neither. Empty retained context adds no URL or source authority.

The original flat requests are forwarded to the actual native producers, which
perform their own trim/cap/default pass. The gateway does not fetch result URLs,
choose search providers, parse HTML/PDF, or duplicate Core's SSRF protections.

Pinned source inspected: `neo-capiro/capiro-backend`
`b525032222515d636b0dae2d46e40c7c3d8b5528`,
`apps/api/src/meri/meri-tools.service.ts:6539-6704`,
`apps/api/src/meri/hardenedWebTransport.ts`,
`apps/api/src/meri/meri-web-pdf-worker.ts`, and
`apps/api/src/common/web-search.helpers.ts`. The fixed
`POST /api/clio/tools/search_public_web` and `scrape_web_page` routes use native
standard-user admission plus the internal service credential. Both require the
current `public_web` source and exact operation grant.

The native search owner selects configured Tavily/Serper and falls back to
DuckDuckGo. Results retain `contentStatus: discovered`, provider-specific fields,
returned counts and raw DuckDuckGo URL text. Discovery does not establish that a
result was fetched, safe to fetch, current, complete or authoritative.

The native page owner performs URL and credential checks before DNS, rejects
nonpublic or mixed DNS answers, pins a public address while retaining Host/TLS,
and revalidates every redirect. Its shared 10-second scope bounds DNS,
connections, at most five redirects, streaming and extraction. HTML is capped
at 5 MiB and PDF at 15 MiB; PDF parsing uses a separately bounded child process
with registered cleanup. These are inspected source properties, not live
qualification of egress, cancellation or process isolation.

Page results retain the final URL, raw-byte hash, normalized text, content type,
prefix coverage, truncation, and `public_url` / `available` /
`external_untrusted`. HTML truncated totals remain unknown; PDF totals and page
counts describe extraction. No `contentStatus: consulted` field is added. A
reported hash and correlated coverage do not independently verify original
bytes, full source coverage, freshness, DNS or redirect admission.

Tests cross real JSON bytes with synthetic native credentials and DTOs. They
make no product source/provider requests and confer no live qualification.

## Primary discovery through the AWS managed Web Search MCP target (SCRUM-237)

`primary-search.mjs` (with `aws-signing.mjs`) makes the approved AWS managed
`web-search` connector the preferred discovery path. That connector is an
AgentCore Gateway **MCP target**, so it supplies any model — including the
existing Claude-on-Bedrock loop — and is not the Claude SDK builtin `WebSearch`
(unsupported on current Bedrock) nor the model-specific Bedrock Responses server
tool. Discovery is one `tools/call` on the gateway's documented MCP invocation
endpoint (`…/mcp`, bound as given and never re-suffixed) using the stateless
MCP revision `2026-07-28`: `MCP-Protocol-Version` plus `Mcp-Method`/`Mcp-Name`
request-metadata headers and the matching `_meta` version/client fields in the
body, with no `initialize` handshake and therefore no extra gateway invocation.
Inbound authorization is IAM (SigV4, service `bedrock-agentcore`), so no
third-party search key exists and queries are served inside AWS. The caller is
the **control task role**, because the paid search is composed by control's read
family — not the AgentCore runtime role.

Two names are kept apart: the connector operation configured inside the target is
`WebSearch` (connector documentation), while the exposed gateway tool name is
whatever the target actually publishes — it may be prefixed and is only
established by a `tools/list` discovery receipt. A different exposed name is
bound through `MERI_WEB_SEARCH_TOOL`; nothing here asserts the two are equal.

Documented limits honoured here: `query` <= 200 characters, `maxResults` 1-25
(default 10), and the receiving-contract caps (12 rows, 180-character title,
320-character snippet). Row text is untrusted source material. A row is kept only
when it carries a byte-exact valid `http`/`https` locator of at most 2000
characters — the value is published unchanged, never truncated or repaired, and a
row without one is dropped — while an absent title, snippet or publication date
stays `null` rather than being inferred from the URL. Empty results are an honest
empty discovery. 401/403 fail as `ACCESS_DENIED` without retry, 400 as
`INVALID_ARGUMENTS`, 404 and malformed bodies as `INVALID_RESULT`, and an MCP
`result.isError: true` (tool execution error) as `UNAVAILABLE` instead of a
successful empty discovery. One lifetime covers credential acquisition, dispatch
and the bounded body read, so a stalled credential or an exhausted cutoff cannot
start a paid search, and responses are size-bounded and cancelled on exit.
Page consultation still uses the native Core owner; Playwright still owns page
interaction.

Retries are off by default (`maxAttempts: 1`): every attempt is a billable
gateway invocation plus a billable search. `maxAttempts: 2` is allowed and is the
ceiling. Official pricing read 29 October 2026 is USD 7 per 1000 searches plus
USD 0.005 per 1000 gateway invocations, i.e. 7005 microUSD per submitted
`tools/call`; `admission` on the producer reports `unitMicroUsd`, `maxAttempts`
and the resulting `maxMicroUsd` for the shared budget owner. Managed search is
not free, and an unknown outcome is not a charged-success claim.

Activation is a deployment fact on the **control** task: `MERI_WEB_SEARCH_GATEWAY_ENDPOINT`
(the documented `…/mcp` invocation endpoint), `MERI_WEB_SEARCH_TOOL` (the exposed
target's tool name, which may be prefixed) and `MERI_WEB_SEARCH_REGION` (or
`AWS_REGION`) must all be present and well shaped; anything partial or
origin-only leaves the family exactly as before and discovery keeps the
configured native Core route. `infra/product-preview/web-search-gateway.mjs` owns
the gateway, its service role (`bedrock-agentcore:InvokeGateway` on the gateway
ARN and `bedrock-agentcore:InvokeWebSearch` on the service-owned
`arn:aws:bedrock-agentcore:<region>:aws:tool/web-search.v1`), the control task
role's `InvokeGateway` grant on the exact gateway ARN, and the pinned-version
target request (`connectorId: "web-search"`, `version: "1.2.0"`, connector
operation `WebSearch`). CloudFormation's `ConnectorSource` has no version field,
so the target itself is created with the documented Control API request that
module emits. Wiring the three settings into the control task environment and
recording the first `tools/list` discovery receipt remain deployment
prerequisites; they are not part of this family's code.

The frozen receiving contract (`retrieval-0.2`) currently admits only `tavily`,
`serper` and `duckduckgo` providers, so an activated primary target fails closed
with `INVALID_RESULT` until `packages/contracts` (SCRUM-238) admits the
AWS-managed provider label and row shape. That contract change is the required
shared join, and this module's output already carries the exact fields it needs.


