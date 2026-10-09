# Frozen schema byte hash correction

The first real Hermes UI session20261009_172411_d70282 stopped at40turns with four owned dependency/configuration files, no implementation or commit, clean process-tree/readers cleanup. Its upstream source/API observations are reconnaissance, not compatibility acceptance. It correctly reported a byte-hash discrepancy in the task brief.

Codex independently compared the exact frozen Git blob at7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3 with both checkouts. Authoritative packages/contracts/meri.schema.json is50043bytes, LF, SHA256 `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`. The original root checkout was52191bytes with2148CRLF and SHA256 `0bf7d88dcef83e139eb1788864249d6d5c9396497e192e547c8d87ec6cc2965a`. Replacing only CRLF with LF produces exactly the frozen blob. Git blob identity remains d7b3c22491ae81c5e875243754413aa7d35097e3; no schema definition, tag, version or protocol changed.

The owner task brief now binds Git LF bytes. Explicit implementation continuation preserves the four files and uses e3de878... for generated type/validator provenance. It must implement the actual composed writer/guarded transport/external Chat fixtures before acceptance. All UI runtime/deployed gates remain unrun.
