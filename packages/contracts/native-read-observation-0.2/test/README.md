# Finite funding observation contract checks

Implementation outline: the adjacent schema owns exactly the five funding operation references and the closed observation/context shape. `validate.mjs` composes existing inert-data, canonical SHA/JSON and frozen funding-instant owners. Creation captures no clock and grants no access; every assert/encode/decode requires the actual fixed-route operation and original unwrapped request for correlation. The carrier is canonical UTF-8 JSON in strict unpadded base64url, capped at 2,048 decoded bytes.

Tests cover literal cross-repository canonical JSON/header/hash fixtures for all five operations, canonical instant compatibility, raw-body correlation, finite route/version scope, inert/hostile data, alternate JSON/base64 encodings, invalid UTF-8 and size bounds. The golden fixture is an agreement candidate for the Core wire owner, not evidence of installed Core admission, service identity, producer consumption or live qualification. Existing retrieval schemas, source time semantics and central exports remain unchanged.

Run only the focused adjacent test with Node 24, `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`. No dependencies, network calls or provider credentials are required.
