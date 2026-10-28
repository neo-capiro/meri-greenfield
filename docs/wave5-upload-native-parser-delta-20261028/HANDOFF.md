# Native upload parser and containment correction — 28 October 2026

## 1. Base and scope
Successor of reviewed `989fbadedad9fabe8d26fabc5267b006b1dbc8d9` / tree `d63c8cd914c59186612e678c14319d4faf95eddf`. Correct only N1–N3 in `WAVE5-UPLOAD-NATIVE-FINAL-SOURCE-HERMES-REVIEW.txt` (SHA5536c4dd...). Original source/reviews remain immutable. No CONTROL/config, package, Dockerfile, lock, public schema, registry or migration edit.

## 2. Work ownership
The supplemental author returned an honest partial checkpoint after its budget: one uncommitted path predicate, no tests or commit. That report remains at `outputs/WAVE5-UPLOAD-NATIVE-PARSER-DELTA-AUTHOR-HANDOFF.txt`. After its actual terminal exit0, A5 completed the four source/test paths in this owned branch. The partial report is not source readiness evidence.

## 3. Configuration failure receipt
Native child exit3 now yields the fixed content-free `NATIVE_EXTRACTOR_CONFIGURATION` limitation. Generic nonzero runtime failures stay `EXTRACTOR_UNAVAILABLE`. Child stderr/payload details are not released in the product receipt. The existing child parser mapping still distinguishes installed-but-broken symbols from absent libraries.

## 4. Definition containment
Use Node's host-specific `path.relative` semantics to require a strict descendant of the declared definitions root. Reject same-root, sibling-prefix and normalized `..` escapes. A backslash is not treated as a separator on POSIX. The canonical definition store still owns immutable snapshot identity and signed-CVD verification; this does not replace those checks or assert physical filesystem qualification.

## 5. Malformed image classification
The pinned parser exception roster includes `PIL.UnidentifiedImageError`, deliberately caught before generic OSError. Pillow image `verify()` SyntaxError is mapped only around that parser operation to `PARSER_ERROR`; unrelated filesystem/tool errors remain unavailable. Pixel/page/OCR/Office limits, inert hyperlinks and all previous package pins remain unchanged.

## 6. Focused evidence
Windows Node24.22.1: `node --test apps/runtime/uploads/test/native-inspection.test.mjs` →13/13 exit0, including no child dispatch for invalid directory and no detail disclosure for exit3. Python3.14.7: `python -m unittest discover -s apps/control/uploads/native/test -p test_extract.py` →29 tests, exit0, one explicit lxml DOCX-path skip. Actual installed Pillow13.0.0 malformed PNG/JPEG bytes and valid PNG with corrupted IDAT CRC produce parser refusal before OCR. Missing original text remains runtime-unavailable; missing installed Pillow symbol is configuration failure. Logs: orchestrator `work/wave5-native-parser-delta-node-final.log` and `wave5-native-parser-delta-python-final.log`.

## 7. Earlier failures
Preserve the first attempt logs: the new worktree had no AJV dependency link; an old test asserted all parser errors were outside OSError, which is false for Pillow. Reused the exact root-lock-qualified owned runtime integration node_modules without mutation, and corrected that assertion while adding real malformed-image coverage. No dependency installation or lock change occurred in this source continuation.

## 8. Limits
POSIX-specific backslash assertion is conditional and has not run on the Windows author host. Native ARM image, actual signed-definition refresh, ClamAV/Tesseract/Poppler corpus, ABI, observed sandbox and serving task qualification remain owed. The real CONTROL startup join is a separate source worker. These checks do not establish native availability or full MM12 completion.

## 9. Next owner
Independent Hermes reviews this bounded correction. Compose it with the separately frozen CONTROL join before the coordinated local native build/corpus and Release-owned host qualification. No push, package release, target operation or live cleanup here.
