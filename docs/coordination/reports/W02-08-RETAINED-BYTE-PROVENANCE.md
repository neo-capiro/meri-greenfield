# Image refresh retained-byte provenance

Independent Codex read-only audit, 9 October 2026. This records public artifact byte checks while the real Hermes image completion writer continues; it does not accept mutable recipe, pins or test drafts.

Retained Node registry objects are mutually bound by their actual bytes:

| Object | Bytes | SHA256 |
| --- | --- | --- |
| node24.21.0-trixie-slim index | 5177 | 173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66 |
| linux/amd64 manifest selected by that index | 1923 | c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63 |
| config referenced by that manifest | 6769 | 04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f |

The config declares linux/amd64 and `NODE_VERSION=24.21.0`; no configured User is present. This is upstream metadata, not the final nonroot worker configuration. No signature or layer verification was performed here.

All seven retained wheel files match the filename, size and SHA256 in their exact official PyPI metadata and are non-yanked: python-docx1.2.0, XlsxWriter3.2.9, openpyxl3.1.5, pypdf6.20.0, lxml6.1.3, et_xmlfile2.0.0 and typing_extensions4.16.0. The lxml wheel is the CPython3.13 manylinux_2_26/2_28 x86_64 artifact, SHA256 `d85dfab42dd672f87a7f76e9de7172962aee69fa12044f0d6e1a23cbd53fb80e`. The byte audit is retained privately as `.task-inputs/image-retained-bytes-audit.json` with its stdlib-only verifier.

The owner also inspected each wheel's actual METADATA and retained license/author files, including British `LICENCE` spellings. Metadata declares MIT (python-docx/openpyxl/et_xmlfile), BSD-2-Clause (XlsxWriter), BSD-3-Clause (pypdf/lxml) and PSF-2.0 (typing_extensions). et_xmlfile additionally includes its Python-derived license and author notices; lxml includes its separate LICENSES file. Exact notice paths, lengths and hashes are retained in `.task-inputs/image-wheel-notices-audit.json`. This is a notice inventory, not a complete transitive license or bundled-library vulnerability audit.

Previously retained main/security Packages.xz byte hashes and lengths matched their Release entries; 35 direct package versions and 16 exact-version dependency edges were available and coherent in those metadata. Actual signed apt resolution, deb bytes, final installed/bundled package inventory, Linux compatibility, image scan/disposition, sandbox and native probes remain unrun for this candidate. Inventory acceptance remains blocked by the four independently reproduced cases in W02-08-INVENTORY-INDEPENDENT-AUDIT. The existing image's 2 critical / 13 high findings remain unresolved; no exception is granted by metadata consistency.
