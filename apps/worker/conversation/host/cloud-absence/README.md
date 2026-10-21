# D005 EC2 physical teardown port

## Source outline

`wire.mjs` decodes the EC2 SDK v3 response shapes from **successful, exact-ID** calls. It first binds an instance to the immutable allocation by account, region, image, subnet, security group and the host/allocation tags. It extracts the sole root EBS volume and every delete-on-termination ENI, then requires a second exact-ID read of those resources before any mutation. An EC2 `TerminateInstances` response can establish only a request acknowledgement. `port.mjs` owns the one-attempt termination and bounded, independent post-request reads. Neither module imports an AWS client, discovers credentials, starts a job, or changes infrastructure when imported.

`createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,ec2,...})` supplies the `host.destroy` and `host.observeAbsent` methods consumed by `createConversationHostTeardown`. The caller must be the trusted control owner and must authenticate the immutable allocation, exact EC2 caller/account/region, and `expected` deployment facts. The injected `ec2` functions take AWS SDK v3 style arguments (`InstanceIds`, `VolumeIds`, `NetworkInterfaceIds`) and return their unmodified successful response objects. They must use narrowly scoped role credentials. This source does not install that role or issue credentials.

State is one-use. A timeout, malformed/contradictory read, thrown Describe error, absent API port, uncertain termination acknowledgement, or cancellation sticks at UNKNOWN. The adapter never retries `TerminateInstances`, never substitutes an empty list or a `NotFound` exception for physical absence, and never returns a VERIFIED absence receipt from the currently unqualified EC2 wire. `observeAbsent` may return a diagnostic `meri-d005-physical-absence/1` receipt with `rootVolumeAbsent:false` and `networkInterfacesAbsent:false`; the teardown coordinator therefore remains UNKNOWN. This is intentional until a separately measured, reviewed **positive** exact-ID root and ENI absence wire can be implemented. A local instance `terminated` observation is not enough.

The independent managed watchdog remains the authoritative backstop for worker death and late provisioning. It must be armed before host create and prove original-ceiling cleanup and late-create reconciliation. This guest/control adapter cannot provide those guarantees. Do not activate the host from these source tests.

Focused source check: `node --test apps/worker/conversation/host/cloud-absence/*.test.mjs`. No live EC2 call is made.
