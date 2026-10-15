# Exact Node bundled-zlib evidence — HOLD

Official origin: `docker.io/library/node`, Node24.21.0 Trixie-slim, Linux/amd64. Index `sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`; platform manifest `sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`; config `sha256:04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f`. Exact `/usr/local/bin/node`:126595440bytes, SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`. Verification followed official OCI digest chains, not an independently verified release-archive PGP chain. Do not substitute an unverified mirror.

Local analysis read ELF bytes as data. `zlibVersion` at virtual0x1a04f90/file23089040 points to1.3.2.1-motley; `Cr_z_zlibVersion` at0x27cc4c0/file37536960 points to1.3.0.1-motley. The second component's exact owner/call path is unresolved. Version strings alone are not fixes.

The independent Linux validator subsequently reported exact binary-hash verification, actual `process.versions.zlib = 1.3.2.1-motley-8002e91`, and formal disassembly of the complete490-byte `gz_write`. It confirms the missing reset stores on the error path. This paragraph records the parent's independent result; this Windows executor did not execute the inspected ELF or produce that Linux disassembly log. Raw diagnostic logs remain with the validator; this summary is the nonsensitive result, not invented raw evidence.

The [upstream fix](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148) resets both `state->strm.avail_in = 0` and `state->strm.next_in = state->in` after the relevant `gz_comp` error. [Node24.21 tagged gzwrite.c](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/zlib/gzwrite.c) lacks those assignments; [zlib.h](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/zlib/zlib.h), [BUILD.gn](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/zlib/BUILD.gn) and [README.chromium](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/zlib/README.chromium) establish bundled/source attribution. The bounded Node24.22 tagged-source comparison also lacked that branch fix. A newer tag or numeric motley version is insufficient remedy evidence. No exploit trigger, general API exploitability or absence of equivalent mitigation elsewhere is asserted.

## Reproduce only in a separately authorized existing isolated validator

The complete metadata probe is [readonly-node-probe.mjs](readonly-node-probe.mjs). It hashes its actual executable and records platform/architecture/Node/zlib versions. It does not materialize an image or invoke providers. Use an already supplied exact binary and approved installed disassembler:

```sh
"$VALIDATION_NODE_BIN" readonly-node-probe.mjs
objdump -d -M intel --start-address=0x19fe320 --stop-address=0x19fe50a "$VALIDATION_NODE_BIN"
objdump -d -M intel --disassemble=zlibVersion "$VALIDATION_NODE_BIN"
objdump -d -M intel --disassemble=Cr_z_zlibVersion "$VALIDATION_NODE_BIN"
```

Range `[0x19fe320,0x19fe50a)` is all490bytes. Relevant call0x19fe46d targets `gz_comp`0x19fe040; compare EAX with-1 at0x19fe485; inspect the error path from0x19fe48a toward0x19fe420/0x19fe422 for both reset assignments. Related symbols: `gzwrite`0x19fe510, `gzvprintf`0x19fe7e0. Initial256-byte truncation was corrected before this review. Stop if binary/source identity differs.

Removing Debian zlib payloads cannot remove this bundled Node code. The minimal-root draft remains HOLD, unmaterialized/unbuilt/unadmitted. A future official Node24 fixed candidate must be independently pinned, source/binary compared, ABI/runtime-qualified, fully inventoried and scanned; zero High/Critical policy is unchanged.
