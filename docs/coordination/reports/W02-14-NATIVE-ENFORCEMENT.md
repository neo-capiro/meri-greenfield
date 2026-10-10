# W02-14 owner checkpoint after Hermes phases 5 and 6

Status: **UNACCEPTED source candidate**. Codex completed the report and permanent compatibility regressions after inspecting two closed partial actual Hermes sessions. A distinct exact-commit actual review, independent primary checks and final-graph service validation remain required. No source integration, deployment, runtime/security acceptance or G1 promotion follows.

Actual session `20261010_013708_8bdb8f` implemented the three modules from base `c0623278707b033beec8e4e4640324d0fb3df9a1`. Phase5 ran05:37:06.405992-05:44:47.709636Z (30 turns), and explicitly inspected resume phase6 ran05:53:23.543559-05:59:19.819218Z (20 turns). Both reached turn caps without a commit or documentation completion. Both closed exit0 with empty process trees, readers finished, cleanup confirmed and no capture/cleanup errors. Owner snapshots preserve exact partial source, scratch and process streams: phase5 manifest `4c69cc914d265f363448e9b4ee964146307f6233358fcc9bf492fbbf0666b5ad`; phase6 manifest `1b7090120eb60012226fb663e46accd0e4b7aa3b6277b4b2c476b6e12271cb4a`. No automatic resume occurred.

The owner added permanent synthetic definition compatibility regressions and packaged the candidate after that closure. Their results are deliberately separate from the actual author's checks below. The owner did not change the three Hermes source modules during packaging. Prior rejected/partial candidates, owner findings and actual reports remain in Git and preserved private evidence; this report supersedes the old candidate4 report's current-status claims.

## Behavior and focused boundaries

`task-definition.mjs` now validates the exact ephemeralStorage object and each requiresAttributes object with explicit keys/types and separate documented name/value policies. Names allow slash/backslash; values additionally allow at signs, colons and interior spaces, with lengths1..128 and no edge spaces. Optional targetType is exactly container-instance. Raw task-definition objects remain retained and caller input unchanged. Metadata supplies no authority. [AWS Attribute](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Attribute.html).

`expressions.mjs` distinguishes absent optional details under pending/teardown from present malformed details. ATTACHED missing required facts, duplicate/wrong-type details and unsupported attachment kinds still contradict. Compatible and pending paths exclude conflicts against retained network pins. Positive network validation requires an ENI identifier with8or17 lowercase hex digits and dotted IPv4 with four octets0..255; fields are at most21/15ASCII characters. Both the compatible predicate and EC2 response predicate enforce this before RetainENI. This narrow reviewed policy bounds retention and may refuse unreviewed future formats. [AWS Attachment](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Attachment.html).

`workflow.mjs` retains first validated ENI/IP separately for each positive task ARN in owned/overflow ledgers. Later present conflicts cause sticky qualification failure; absent details remain inconclusive. Pins never overwrite first facts and qualification does not erase stop authority. Binding, task-definition validation, expression construction, workflow and infrastructure remain separate focused modules with no new framework or dependency.

## Actual author checks before owner test additions

All are local synthetic/cached-data checks. The author captured source before/after as identical and used60second canonical/120second harness bounds. Retained private files are in `.task-inputs/W02-14-hermes-repair-5/`; preserved immutable copies are in the owner's closed-partial6 snapshot. These are author results, not independent owner verification.

| Check | Observed result |
| --- | --- |
| Syntax, seven source/script files | exit0 |
| Canonical before owner additions |34 PASS, exit0 |
| Definition mutations plus documented Attribute cases |124 PASS, exit0 |
| Composed cases/probes, actual JSONata2.0.6 |50 PASS,293 parsed expressions,164053 evaluations, exit0 |
| Additional network cases and duplicated controls |21 PASS,30666 evaluations, exit0 |

Result SHA256: definition `fcd6f2ff832a3c8201d87f134ccb68f0f44689c56db13eb85206777691baf1c4`; composed `e57360b8735154e8f68b80c564c1879da6c8255426bb0a15b39473c47fcbbc6e`; network `87018fc985b8c99594fb6eecf7e906700993216e3207964b2cdd943dbaf8b111`.

The21-case network result includes duplicated instrumentation controls and prior cases; it is not21 unique new regressions. Its two-task assertions check ENI IDs, **not both retained IPs**, despite the author footer's broader claim. Global FAILED with multiple launch tasks does not isolate network-conflict causation. Independent primary checks must assert both fields per ARN, including overflow. An inconsistent short-ENI fixture was corrected in the fake EC2 response; the original capture preserves the failure and correction. Initial pending observations before the first DescribeENI/RetainENI are not proof of a contradiction against validated facts.

Phase4's old report said broad npm was not replayed, but its retained npm-check output contains repeated missing-ajv failures. Preserve that contradiction. No broad npm/AJV/install was run in phases5/6 or this owner packaging step.

## Bounds and remaining limits

Exact added serialized network fields are26bytes per null pair or58bytes per maximum pinned pair, at most580bytes across ten ledgers. Actual source bounds these values before retention. A separate read-only owner analysis extended earlier loose reachable-shape arithmetic to compact fallback163368bytes, combined retained variables186236bytes, final fallback output129236bytes and assembled PRE_STOP108135bytes. These conditional calculations require independent exact-candidate review of all reachable shapes, finite numbers, bounded raw/token retention and the serialization model; they are not an accepted full proof or measured maximal service execution.

The six-times serialized-length predicate is distinct from actual UTF8. The author did not finish the full finite whole-variable/fallback/output proof. Its741byte empty-ledger fallback probe with an out-of-contract40000character token does not establish legal maxima. Repeated conservative fallback preserves retained stop flags/identities and may obstruct terminal confirmation, yielding UNKNOWN; native deadlines and IAM still require qualification. No caps were raised and no stop identities dropped. Before-application merged-variable/every-Output instrumentation and negative controls need independent verification.

## Exact source bytes for this owner checkpoint

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `infra/native-enforcement/app.mjs` | 422 | `813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c` |
| `infra/native-enforcement/lib/binding.mjs` | 7772 | `a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007` |
| `infra/native-enforcement/lib/expressions.mjs` | 12917 | `e5a1931f3058e02e20bff10faf837b65eac11c226077e9a66d0501d323b4b648` |
| `infra/native-enforcement/lib/workflow.mjs` | 22681 | `884b11077ae34db9171d2d0aa2609ed3bef5017af47c39a03b0e51787b09ce01` |
| `infra/native-enforcement/lib/infrastructure.mjs` | 3625 | `6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0` |
| `infra/native-enforcement/lib/task-definition.mjs` | 7965 | `fbe770912afaa119c50a9e1681a691a605b94c8a6f9ebd686e3555ab9e9a36ad` |
| `scripts/test-native-enforcement.mjs` | 19056 | `72f18e61e76c2ab5e8f0663a36edfbafdd74bfda346f830ccdefff446fa50630` |

README/report hashes and commit are recorded externally to avoid circular self-hashes. The actual author checks used the earlier canonical script; the changed test file requires a new primary run. Runtime binding remains refusing. OriginalD720/C900, single consumed RunTask, no Retry/Map/Parallel,4+6 ledgers, pending-stop dispatch before terminal polling and the current-tag IAM policy decision remain unchanged.

Final-graph AWS syntax validation, TestState, actual wire casing/Context/error/deadline behavior, IAM/tag conditions, survival under controller kill, physical cleanup and native SDK/Office/browser gates remain open. The prior syntaxOK applies only to the old c062graph. Registered definitions grant no runtime admission.49 image findings/22 severe remain OPEN; Office DEFERRED; G1 OPEN; paid Bedrock inference$0/$10; current Meri untouched; no cutover.
