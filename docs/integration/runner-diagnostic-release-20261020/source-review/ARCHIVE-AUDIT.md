# Runner diagnostic source seal and independent archive audit

Exact source: `2b4421f612f9fbb728d6da52927aac228d712d40`.
Exact tree: `3912782fd7d5c3f62c28b27ca29b1cb35bed033e`.
Checkout: `meri-runner-transport-diagnostic`.

**Canonical source sealing and independent archive verification passed. No
required Git objects are missing. No source/archive gate remains in this task.**

| Measurement | Result |
| --- | --- |
| Unique required commit/tree/blob objects checked | 17,505 |
| Unique blob objects | 16,159 |
| File members | 20,256 |
| Raw member bytes | 410,041,429 |
| Blob SHA1 identity checks | 20,256, all matched |
| Mode `100644` / `100755` members | 20,247 / 9 |
| Canonical manifest bytes | 4,126,760 |
| Canonical manifest SHA256 | `a986c0a4bf026cffc76b0eb689c95501c59d3369e652e71b37a496004e15f656` |
| Official ZIP bytes | 277,007,966 |
| Official ZIP SHA256 | `1c7d59d2419c00e4f74e02b0d0d0754819cf547a3224ee1d8673b376a65006f3` |
| Missing required Git objects | `[]` |

The canonical `infra/product-preview/image-build-source.py` was executed with
the pinned commit and the two newly allocated outputs under
`runner-diagnostic-build-packet`. It exited zero with empty stderr. Its SHA256
was verified as `c373ff556873823e1fd7cb5a00945ed2f70f41acb74c96d2d9756d0f12bf461d`.
No replacement sealer or ZIP implementation was used.

Git commands disabled lazy fetching and all network protocols using
`GIT_NO_LAZY_FETCH=1` and `protocol.allow=never`. The canonical command also
received the exact checkout's safe-directory setting through process-local Git
configuration. Repository configuration and source were not edited.

An independent raw `git cat-file --batch` pass verified every blob's SHA1 object
identity and measured SHA256 and size. Its canonical manifest matched both the
official Python encoder and the sealed manifest byte-for-byte. A separate
read-only archive pass matched every path, raw payload SHA256, size and mode.
ZIP ordering, exact commit comment, Unix creator, fixed 1980 timestamp,
DEFLATED compression and absence of directory entries passed.

The retained index and 44 APKs match their locked identities (45 files,
86,527,368 bytes), as do all four wheels (697,271 bytes). The canonical RDS CA
helper verified the bundle's exact identity and 114 certificate count. Runtime
architecture and source request pins are recorded in `source-inventory.json`.

Deliverables:

- `../runner-diagnostic-build-packet/product-source.zip`.
- `../runner-diagnostic-build-packet/product-source-members.json`.
- `source-inventory.json`: concise machine-readable handoff with artifact and source pins.
- `git-object-preflight.json`, `git-tree-files.json`, `raw-git-manifest-audit.json` and `expected-members-from-git.json`.
- `official-helper-and-public-inputs.json` and `official-archive-comparison.json`.
- `seal.stdout.json`, empty `seal.stderr.log`, and the audit scripts.

The packet author's existing `PREPARATION.md` and `prepare-build-packet.mjs`
were preserved. All task-owned processes exited successfully and the canonical
sealer removed its own temporary directory. No product tests, network, AWS,
upload, image build, credential or deployment action occurred. Source/archive
identity does not establish image or live runtime acceptance; the parent remains
the sole external build operator.
