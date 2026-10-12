# Worker image source preparation

**ACCEPT_SOURCE_PREPARATION and ACCEPT_SOURCE_EVIDENCE. Patched image: HOLD.
Build and runtime admission: HOLD.** No supported,
coherent patched dependency set has been established. This continuation retains
the unchanged source context, exact held-image evidence, current upstream leads,
dependency notices and independent review. It does not present an unchanged
recipe as a patched candidate. No recipe, dependency, original test, collector or
guard has been changed.

Base is preserved PR12 `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`, tree
`1f6ac35ad37531e790c2a19c9e310c7e618e6522`. The
[acceptance outline](../tasks/MERI-IMAGE-SOURCE-PREPARATION-20261012.md) records
exclusive ownership and criteria before any proposed implementation change.
Final integration and publication receipts accompany this report.

Reviewed freezes: context author `9aff2d9e1e125fe9e0fc4d2e7bef49d7ff623d53`,
upstream `07c45dcedf18517aa0049e24aca1c9f3b4b50b96`, independent image review
`86575d5d2d0e812ed18033512047fe421179b6d7`; license author
`839f3d43b4b24a6ca37b0b873ab90abd81b51725`, independent license review
`767468da397f3f757d68050a015d265373cb786c`. Original author/reviewer branches
are published separately to preserve these exact commits and criteria freezes.

## Exact identities and reproducibility

The author, independent reviewer and integration owner each assembled the
canonical context. All produced **53 members / 994,568 source bytes**, manifest
SHA-256 `94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f`.
The current assembler SHA-256 is
`48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`.
The source-only manifest sets `commitAuthority: false`. Repeated assembly proves
these source bytes; it does not prove reproducible OCI layers or installed
dependency resolution. See the [integration evidence](../../qualification/candidates/image-patch-20261012/integration/).

The historical held image is
`sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac`.
Its build source was `60941654423b4118989b7bfc772ad11b383972d0`, historical context
manifest `18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`.
The current source context is a different identity. Existing collector guards
still pin that historical context and assembler
`67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`.
Their refusals remain intact. No checksum-only update confers build authority.

The exact PR8 raw scan at `28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9` is
59,680 bytes, SHA-256
`3e7a92a7e8a876b5468b5495f3b415c8d0728ee8b28af69f21b175f60ea4e127`:
47 findings, **5 critical / 17 high / 17 medium / 7 low / 1 undefined**. It is a
preserved complete scan, not a newly requested scan. The held image must never
launch. Root independently matched the raw bytes, counts and image identity.
The preserved 325 binary-package rows and 26,901 inventory entries establish only
their declared scope; they do not supply every license body, source-package
mapping or proof that renamed/embedded implementations are absent.

## Security and dependency findings

The [upstream report](MERI-IMAGE-UPSTREAM-REVIEW-20261012.md) and
[matrix](../../qualification/candidates/image-patch-20261012/upstream/upstream-matrix.json)
retain **54 obligations: 47 current, five older, two historical krb5 findings**.
All remain OPEN. Omission from a later scan is not remediation.

Current Debian evidence still marks the observed stable GnuTLS versions
vulnerable for the held critical findings, with upstream assessment pending.
TIFF has an unstable-suite fix but no verified supported stable package for the
remaining critical row. These observations do not establish a coherent stable
patch set. Root independently checked [CVE-2026-88647](https://security-tracker.debian.org/tracker/CVE-2026-88647),
[CVE-2026-95210](https://security-tracker.debian.org/tracker/CVE-2026-95210) and
[CVE-2026-52490](https://security-tracker.debian.org/tracker/CVE-2026-52490).
The full matrix distinguishes released fixes, proposed patches, package-specific
reachability questions and unresolved cases. No cross-suite package mix,
required-package removal, runtime exception or replacement model loop is proposed.

Seventy bounded public HTTP attempts failed at the environment proxy, with zero
response bodies. Supported web-reader observations are retained separately and
are not represented as raw HTTP capture or signed package verification. The
signed InRelease-to-Packages-to-binary chain and compatible package resolution
remain unverified. These transport failures do not show vendor content is absent.

The [dependency/license report](MERI-IMAGE-LICENSE-EVIDENCE-20261012.md) verifies
133 exact archives: 126 unique registry npm archives and seven Python wheels,
156,633,085 compressed bytes. Linux eligibility covers 130 of 147 npm lock
locations, including the separately verified local public-contract archive.
Version/integrity agreement is evidence about those bytes, not complete binary
support, redistribution permission or vulnerability closure.

The lxml CPython 3.13 wheel contains headers identifying libxml2 2.14.6 and
libxslt 1.1.43; static ELF inspection found no corresponding dynamic library
dependencies. This is embedded-copy evidence, not an executed runtime version
probe. An apt update would not replace these wheel bytes. Exact package notices
are distinguished from metadata-only labels. Native Skia, browser/base-image
attribution and applicable commercial SDK terms retain explicit unresolved scope.
The standardwebhooks repository-root Apache notice and library MIT notice have
different scopes; exact-source MIT recovery is not proof of reproducible npm
packaging. See the [independent license review](MERI-IMAGE-LICENSE-REVIEW-20261012.md)
for the accepted evidence boundary.

## Verification and preserved failures

- Author: context tests **17/17**, worker package tests **197/197** passed.
  The initial package run had 93 passing tests and four missing-root-dependency
  module-load failures. An unchanged-lock installation with lifecycle scripts
  disabled resolved these; both failed output and rerun are retained.
- Independent reviewer: **14** frozen controls, **17** original context tests
  and **18** original scan tests passed. A receipt filename says 15; the actual
  measured independent control count is 14.
- Original build suite: **34 pass / 1 fail / 1 error**. The current-context hash
  mismatch and historical Windows executable guard remain unresolved and intact.
- Original inventory suite: **24 pass / 1 fail**. Its first output creation
  changes the scanned root directory's size. An independent precreated-output
  control explains the fixture self-mutation; original test/probe bytes remain
  unchanged and the failure remains visible.
- Upstream packet: **142** offline consistency checks passed. The initial local
  verifier path-index error is retained with its correction and rerun.
- License reviewer: **1,141** artifact checks and **16** supplemental checks
  passed. The initial reviewer macro-filter failure is preserved and corrected.
  Root independently replayed both sets on the integrated packet, and also
  replayed the 14 image controls, 142 upstream checks and held-input verifier.

The recipe's installed offline static suite reads three intentionally build-only
metadata files not copied into the image: component-pins.json, Dockerfile and
.dockerignore. Source COPY/data analysis documents that inconsistency. No image
was executed, so this is not an observed live probe failure. Any repair needs
coherent recipe/ignore/collector review; none is bundled here.

## Remaining G1 work and execution boundaries

Before any build proposal: establish the supported fix/applicability set,
authenticated exact package inputs, embedded-copy and notice closure, and review
the exact current Linux runner/executable/context binding. A separate owner must
approve a bounded infrastructure action/budget/security packet before spending
or changing cloud state. A future image still needs installed inventory, a fresh
complete scan, renderer/browser sandbox proof and required artifact behavior.

Task identity, expiry/revocation, durable budgets, actual-proxy SDK discovery,
native task-A/task-B checkpoint recovery and stale rejection, egress/watchdog/
teardown, Temporal durability and artifact inspection remain native gates. No
local fixture passes them. The paid-model allowance is still unreconciled.

The parent's original runner capture and subsequent metadata diagnostic both
refused; neither identifies the original failing stage. The metadata refusal is
recorded separately, without inferring a Windows bug or zero-byte stdlib cause.
The [ancestor-only refinement](MERI-NATIVE-ANCESTOR-DIAGNOSTIC-20261012.md) is
**ACCEPT_SOURCE**, independently reviewed at
`d1f0f90ab4d2836752dfd7bc436d5d996d100636` against author
`dc4a046028bdfb798dc2b1888721afc45f2e97a3`. Its 6,297-byte script has SHA-256
`9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd`.
It reports role, ancestor ordinal, separate symlink/reparse/non-directory
predicates and bounded numeric metadata, without private path strings or target
body reads. Original source and refusal evidence remain unchanged. Root replayed
all **17 independent** and **12 author** controls on the integrated bytes.

Execution remains with the local coordinator, who must bind receipt paths and
the reviewed hash under its existing **15-second external supervisor**:

```powershell
& '<EXACT_ORIGINAL_PYTHON_EXE>' -I -B -S '<REVIEWED_ANCESTOR_DIAGNOSTIC_ABSOLUTE_PATH>' --repository '<EXACT_ORIGINAL_REPOSITORY_ABSOLUTE_PATH>' --original-output '<EXACT_ORIGINAL_OUTPUT_ARGUMENT>'
```

The [independent review](MERI-NATIVE-ANCESTOR-DIAGNOSTIC-REVIEW-20261012.md)
explains the Windows API limit: Python can let the OS resolve reparse kinds other
than name-surrogate links. The script rejects unsafe returned metadata and makes
no application-level target body, directory-listing or network calls; it is not
a guarantee against native redirection, filesystem races or blocked syscalls.
No deterministic Windows compatibility defect or original collector cause is
established. Source acceptance does not authorize native execution.

No image build/push/launch, cloud mutation, provider message, model spend or
customer-data operation occurred. Source handlers remain unavailable. R2 scope
stays 139 capabilities: 96 selected, 43 deferred; 14 bound unavailable and 82
selected unmapped; 14 named skills unqualified. G0 is accepted, G1 OPEN and
G2–G7 unentered. Public 0.1/private 0.2 separation, SDK loop ownership, Temporal,
Aurora selection and frontend ownership remain unchanged.
