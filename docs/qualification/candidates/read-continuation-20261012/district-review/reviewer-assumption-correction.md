# Preserved reviewer assumption failure

The initial frozen 27-group independent suite passed26/failed1 against stable prefreeze hashes. The failure at line66 expected current-context Scope.resourceId equality with the selected client entity. This was an unsupported reviewer assumption: existing canonical assertSubject checks scope tenant and policy lineage, but does not require each scope resource to equal an entity ID. The family is a shape/lineage validator, not a grant decision engine. No production repair was requested.

The corrected control explicitly characterizes this existing structural limit, then requires exact returned subject equality and retains scope tenant/policy mismatch refusals. Original assertion survives in commit2cbe6fe and raw prefreeze output; it is not reported as a passing negative. Current source-owner actor membership, client wall, grant and live flags remain independent requirements before connectivity.
