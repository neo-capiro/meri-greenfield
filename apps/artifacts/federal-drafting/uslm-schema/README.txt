Pinned USLM 2.1.0 schema validator

Origin: https://github.com/usgpo/uslm at immutable commit
100338992150c276aae5544d01d9b821a27eb383. Original LICENSE.md is retained.
The 12 XSD files are unchanged upstream bytes. manifest.json is canonical JSON
(keys sorted, compact separators, terminal LF), containing their SHA256, byte
length, upstream path and Git blob hash plus the original license. Its exact
SHA256 is pinned in schema_validator.py. Runtime identity excludes test fixtures.
Official test fixture origin: bill-version-samples-september-2024/BILLS-114hres99eh.xml
at the same commit; SHA256 65d38cfd185dc6976eb85abd7bfebdef0f873d2edb313e857449b37baa4a0dc1.

Protocol: run schema_validator.py without arguments. Read one UTF-8 JSON request
from stdin with exactly text and sha256 (lowercase SHA256 of exact UTF-8 text bytes).
Success exits 0 and returns {profile:"uslm-2.1.0",schemaSha256,sourceSha256,bytes,valid:true}.
Refusal exits 1 and returns only {valid:false,code}; diagnostics never contain input.
--help prints usage; any other argument refuses. No input path/URL/schema/profile
is accepted. The caller owns process deadline, cancellation and output bounds.

Source limit: 128 KiB encoded UTF-8, preserving a leading BOM in source hashing.
JSON transport limit admits worst-case six-byte escapes per source byte. Reject
invalid scalars, non-UTF8 declaration, malformed XML, DTD/entity declarations,
unsupported namespace/root and schema-invalid input. Supported roots are bill and
resolution in http://schemas.gpo.gov/xml/uslm. Declaration-token checking is
conservative and also rejects their literal appearance inside comments/CDATA.
XSD compilation resolves only the exact pinned in-memory closure, including the
explicit https://www.senate.gov/schemas/uslm-meta-senate.xsd alias; every other
resolution refuses. Document xsi:schemaLocation is ignored as authority, and no
document external resources are fetched. Stylesheets are not applied; XInclude
is not invoked. No schema asset is reopened after its bytes are authenticated.

Runtime dependency: existing lxml 6.1.3. Task-local Windows checks do not qualify
the ARM64 runtime image. Schema validity makes no claim of legal validity, source
authenticity, required business content or renderer fidelity. In particular the
official XSD permits main to be absent, while meta is required.

Tests: python -m unittest discover -s test -p "test_*.py" -v (from this directory).
