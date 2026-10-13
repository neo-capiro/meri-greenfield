# Narrow final binder replay and outer configuration finding

Reviewed author source `086cb8960a8cd314d97b484198660c171d63272f`, tree `05f5f71e3eb93cd0096f0b14d16ea6b011d87dae`.

The prior four findings are repaired. All39 prior independent controls plus three new authority-accessor/Proxy, captured-owner revocation and pre-effect substitution controls pass; with16 author controls, the capture is58/58. The exact pre-outer-counterexample test file is retained. Full distribution generated/type/public check passes, including71 public controls. Production diff whitespace passes. The immutable context digest and original receiver/call preservation behave correctly.

Decision remains **HOLD** on one newly confirmed safe-initialization gap identified during final coordination: the private binder reads outer `artifactOptions.context/authority` and spreads other ports before canonical constructor descriptor admission. Getters on context, authority or executor are each invoked; a Proxy get trap is invoked. The no-trap control observed4 invocations instead of0. The unchanged public constructor normally refuses these objects before evaluating their values. Trusted configuration is still required, but the new boundary should preserve that existing inert configuration discipline.

Capture an inert own-descriptor copy of the outer options before reading/spreading its ports, rejecting Proxy/accessor/hidden/symbol fields with the existing boundary. Preserve original borrowed port references and authority receiver. This needs no duplicate canonical config schema, package/generator change, policy, route or source-semantic adjustment. The reviewer changed only assigned independent tests/evidence and preserved the failure.

Existing source-only limits, private attachment approval, native DB/runtime/SDK/Temporal gates and separate artifact visual review remain unchanged. Historical failures remain historical; no whole-plan closure is claimed.
