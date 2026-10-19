# Closed native beta observation follow-up

Branch `fix/sdk-proxy-beta-observation-20261019`; base `9f54238c84dc03f0505ccac99be5652dbb2d16db`; commit `b3f55c901fe313d4c0be1d477490c19a54a8e6e7`.
Only `apps/gateway/model-proxy/product-request-owner.mjs` and its test changed (+68/-1 net). The Python owner independently confirmed matching parsing semantics.

The JS owner accepts only the two exact reviewed body beta enums, at most two unique values. A missing header is permitted. A present header must be nonempty, use only ASCII space/tab OWS, and carry the exact same set as the body. Duplicates, unknown/case variants, empty segments, mismatch and any body context_management key refuse. Duplicate headers and all x-amzn-bedrock-* feature headers remain refused. Signed bytes/headers are observed without rewriting; original peer, bearer, request identity, route/model, raw/native hashes, CountTokens, limits and budget ownership remain unchanged.

Verification on Node24.19.0: original owner checks **3/3**, expanded owner **5/5** (9 positive shapes and 43 no-SQL refusal shapes), affected five-file group **21/21**, zero skipped. Exact commands and log hashes are in EVIDENCE.json. The first baseline attempt omitted required MERI_REVIEW_SOURCE_ROOT; its setup failure is preserved separately from the corrected passing baseline.

These are local owner/bridge/codec/budget checks. They do not establish actual SDK structured_output, provider/header/CountTokens acceptance, real PostgreSQL or private owner HTTPS, product image or live chat. No provider call, deployment, Core change or publication occurred.
