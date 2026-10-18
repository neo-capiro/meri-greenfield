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
