# Pilot CountTokens fee addendum

**The CountTokens API fee unknown is resolved as documented $0. The pilot remains unapproved.** AWS explicitly states that CountTokens incurs no charges. This addendum preserves the sealed pilot packet/report at `9e08fc64471a28e2249dc5d7c5f48fbc8589e2b1` unchanged. [AWS token-counting guide](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html).

AWS's Sonnet 4.6 card lists token counting on `bedrock-runtime`, excludes `bedrock-mantle`, and identifies `us.anthropic.claude-sonnet-4-6`. The general guide warns that some CRIS-only models differ. These are documentation findings; exact profile/request/account compatibility remains UNRUN. No endpoint substitution or code change is proposed. [AWS model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html).

Preserve **18 inference +18 CountTokens =36 maximum provider operations**, including failed/uncertain attempts, and the **$0.75 proposed inference cap, still unapproved**. Eighteen documented-free count attempts add $0 API fees. Existing estimated inference $0.183744 and maximum $0.551232 at proposed admitted rates are unchanged; neither is an all-in account bill. Effective account rates, permissions, other costs, actual human prompts and runtime admission remain separate prerequisites. No historical allowance is reused.

The [bounded decision overlay](../../qualification/candidates/action-host-20261013/pilot-addendum/decision.json) identifies only the earlier fee-unknown clauses it supersedes. No original artifact, endpoint, model, counter, implementation, gate or authorization changed.

Public docs were read on 2026-10-13 through the web tool. Two direct GETs were proxy-denied403; [failure metadata](../../qualification/candidates/action-host-20261013/pilot-addendum/public-retrievals.json) is preserved without bypass or retry. [Documentation findings](../../qualification/candidates/action-host-20261013/pilot-addendum/documentation-findings.json) bind the retained short observation artifact, its locators and SHA256. These authored observations are not raw HTML or a complete rendered response; full bodies are not retained. No raw HTTP success or provider/account/model action is claimed.

Offline verification checks exact sealed packet preservation, immutable source boundaries, capture identity, unchanged limits and Decimal arithmetic. Independent review is documentation/provenance/arithmetic only. This slice creates no runtime process, service, dependency installation or native evidence.

Verification: 40/40 offline checks passed; all sealed pilot bytes and original source entries are preserved. Direct-public-GET proxy failures remain explicit. The initial addendum58ed238c recorded a non-retained combined response hash; the final packet replaces that with the hash of retained short observations, avoiding an unauditable content-identity claim. No runtime check was run.
