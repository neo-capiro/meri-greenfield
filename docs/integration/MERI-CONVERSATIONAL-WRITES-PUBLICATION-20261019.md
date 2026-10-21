# Conversational write publication receipt

Repository: `neo-capiro/meri-greenfield`.
Branch: `codex/meri-conversational-writes-20261019`.
Draft review: https://github.com/neo-capiro/meri-greenfield/pull/190
Exact base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.

Published complete material commit: **`8e9d28885bb05d597533356efd73baf402220e3d`**.
Complete material tree: `50f7e8348700485e880107740aad8cedd3756a66`.
This receipt is a later documentation-only commit; the current PR head identifies it. It changes no executable source, test, qualification input or result.

The authorized GitHub workflow published three coherent review slices. Complete tree equality was checked before each commit was created. Connector publication records different commit metadata from local authoring; source trees match exactly:

| Local receiving checkpoint | Published commit | Complete tree |
| --- | --- | --- |
| `9f72b7c4771c3b0a42d945c0222a2c6496c4aa94` | `ceccea0526682c645aebb3b3eca1238f6f3dd42b` | `7329b562f86df831bac4758ccfadcd379a0d2fa8` |
| `2290468b4fa99988a94fe22b49d119e1227b0a6d` | `f4320e6be9b93a5c43dc9e0cd27b32348a9aa856` | `4f31d709da4968344d9997eaae527c5cf2e02795` |
| `fc13e0cb06c48a5192d663c760fc80603cd7e553` | `8e9d28885bb05d597533356efd73baf402220e3d` | `50f7e8348700485e880107740aad8cedd3756a66` |

Coherent tested source is `927537b76a6be3f09866d9dda0a3b9f129e70b0e`. Its executable/test bytes match the published material; later differences are reports/evidence only. The final affected suite passes **1,067 cases**, with zero failures and two existing opt-in LibreOffice skips. Runtime types and all 66 changed module syntax checks pass. Exact commands, source hashes and retained failures are in `conversational-writes-evidence-20261019/`.

PR189 is separate, with requested signed research-source correction **`e82d199fc88f8493fab6845770218a8ded29d41d`**, complete tree `61c29a15c80c243cc9cc6ddf2248715e36c5f1e2`; fetched remote bytes matched its reviewed local correction tree. Its affected tests pass 290/290. Neither PR was merged or folded into the other. Frozen PR175/PR188 heads remain unchanged.

Use the published consolidated branch, [handoff](MERI-CONVERSATIONAL-WRITES-HANDOFF-20261019.md) and [dependency contracts](MERI-WRITE-DEPENDENCIES-20261019.md). Do not pick individual unpublished local lane pins as though they were remote integration points. Current Core greenfield custody, native memory/filing execution, attachment registration, sandbox/runtime/image and frontend decision dependencies remain explicit. No build, deployment, migration, credential change, paid provider, live database or production effect was performed or qualified.
