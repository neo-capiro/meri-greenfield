# Fresh US East pricing receipt - 15 October2026

Current public on-demand catalog quotes were retrieved08:12-08:22UTC through read-only AWS Pricing `GetProducts`. [normalized-rates.json](normalized-rates.json) contains28 selected product SKUs, exact rate dimensions/tier ranges, units, currency, effective dates, UTC read times and request/response/product-entry SHA256. Raw AWS response/error files remain outside Git; this directory contains normalized public pricing only. No credential values were inspected or created and no resources, trust, networking, migrations, image builds or model calls were changed.

The initial sandboxed request could not reach the endpoint. That was a transport failure, not an approval denial. After the parent confirmed the permitted ordinary read-approval route, the original read succeeded; [pricing-status.json](pricing-status.json) preserves the initial failure and explicit resolution. Successful broad first pages with pagination were narrowed for missing targets; only individual selected product entries are quoted, not a complete service catalog inventory.

## Rates and interpretation

| Item | Fresh catalog rate,USD | Unit/boundary |
| --- | --- | --- |
| Fargate Linux/x86 CPU |0.04048|vCPU-hour |
| Fargate Linux/x86 memory |0.004445|GiB-hour |
| Extra Fargate ephemeral |0.000111|GiB-hour above included20GiB |
| RDS PostgreSQL db.t4g.small Single-AZ |0.032|instance-hour |
| RDS PostgreSQL Single-AZ gp3 |0.115|GB-month; selected20GiB quantity |
| ALB / used LCU |0.0225 /0.008|ALB-hour / LCU-hour |
| Public IPv4 |0.005|address-hour |
| Interface PrivateLink |0.01 +0.01|endpoint-AZ-hour + first-tier GB processed |
| Logs Standard ingestion / storage |0.50 /0.03|GB ingested / GB-month retained |
| S3 Standard / PUT / GET |0.023 /0.000005 /0.0000004|first-tier GB-month / request / request |
| KMS customer-managed key / symmetric calls |1 /0.000003|key-month prorated hourly / request |
| Secrets Manager storage / calls |0.40 /0.000005|secret-month prorated / API request |
| Route53 hosted zone |0.50|first25 zones,full month even for24h |
| Public standard DNS / foundational DNS Firewall |0.40 /0.60|million queries,first tier |
| DNS Firewall custom domains |0.0005|domain-month prorated hourly |
| CodeBuild Linux x86 general1.small (actual project) |0.005|build minute,OnDemand-EC2 family;30min=0.15 |
| CodeBuild Linux x86 general1.medium (comparison only) |0.01|build minute,OnDemand-EC2 family; not the actual project |
| RDS charged backup/snapshot |0.095|GB-month beyond applicable free allocation |

These are current catalog observations, not account-specific negotiated quotes, quota/availability checks or capacity guarantees. RDS pricing describes PostgreSQL but does not bind engine major16/minor availability. The existing project's sanitized read-only metadata at2026-10-15T08:10:41.030912+00:00 confirms LINUX_CONTAINER/BUILD_GENERAL1_SMALL with timeout30minutes; receipt SHA256 `6e06c78028860a3b6db0e1334019cffb4fb892d7ed42c61c7a285d3f2682f75b`. The matching OnDemand-EC2 small SKU is `4Z79XP69AGHXE3C7`, read08:21:57UTC, effective2026-08-01; its rate dimension is `4Z79XP69AGHXE3C7.JRTCKXETXF.6YS6EN2CT7`. Docker/Sandbox families differ. The medium quote is retained only for comparison. No private project identifiers, ARN or environment values are published. Generic PrivateLink rates do not prove the three endpoint services exist or are absent in the chosen VPC/AZs. No new Resolver endpoints, Route53 Profiles, DNS Firewall Advanced or NAT is assumed. Their optional catalog entries are included so an unexpected addition cannot be treated as free.

The [Fargate page](https://aws.amazon.com/fargate/pricing/) has rounded per-second example inputs; use the fresh hourly catalog dimensions here for this calculation. It includes20GiB ephemeral storage and a one-minute Linux minimum. [Route53](https://aws.amazon.com/route53/pricing/) states hosted-zone fees are not prorated, private-zone queries/eligible ALB aliases have no extra authoritative-query fee, and foundational firewall domain storage is prorated. [KMS](https://aws.amazon.com/kms/pricing/) and [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/) define storage lifetime billing separately from requests. Raw API source hashes bind every quoted numeric rate; web links clarify billing semantics.

##24h allocation reconciliation and retained costs

[pilot-recalculation.json](pilot-recalculation.json) uses decimal arithmetic and explicit quantities. Five provisional services total3.25vCPU/6.5GiB for24h; the runner totals0.5task-hour at2vCPU/8GiB with50GiB ephemeral storage. RDS is20GiB Single-AZ; ALB is bounded to an assumed1LCU; three IPv4 addresses and three new interface services in two AZs are assumed only if needed.

Keeping the original conservative3USD build allowance and3USD ancillary allowance produces **13.286401USD,rounded13.29**, leaving11.713599USD of the approved25USD as planning headroom. The verified30minute small build itself quotes0.15USD; the allowance is not permission for more builds, retries or upsize. Low-usage Logs/S3/KMS/secrets/DNS/PrivateLink quantities are explicitly illustrative within the ancillary allowance,not measured consumption or a second cost addition. No free tier/credits/commitment discounts are assumed.

**DB deletion is not approved. P0 approves only the25USD allocation and temporary topology departure; irreversible deletion requires final human confirmation.** The following is a hypothetical cost scenario, not an executable cleanup plan. If P8 separately approves positive teardown of NEW ALB/endpoints/public IPs and DB after the encrypted final snapshot, an illustrative additional7days retaining a20GB charged snapshot,eight secrets,one new KMS key,1GB logs and1GB S3 adds **1.416033USD**, for **14.702434USD combined**. Exact retained sizes/counts/durations and shared-key dependencies still require owner binding. Two new hosted zones cost1USD upfront within the ancillary allowance; a month boundary or more zones changes this. Existing baseline costs remain separate. No retention rule is established by this example.

A retained-DB alternative avoids assuming deletion: once a separately authorized stop reaches `stopped`, seven days of20GiB provisioned gp3 storage plus the same secrets/key/log/S3 illustration adds **1.508088USD**, for **14.794489USD combined**, excluding chargeable backup. A further20GB of chargeable backup would add0.437260USD, bringing the combined illustration to **15.231749USD**. Applicable backup allowance, actual retention and separately approved network cleanup remain unbound. [AWS documents](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html) that stopped DBs retain storage/backup charges and restart automatically after seven consecutive stopped days. At the quoted rate, restarted DB compute adds0.032USD/hour or0.768USD/day. Stopping can take time; public IPv4 remains billable if present. No indefinite compute-free retention, scheduled re-stop loop, stop action or deletion is authorized by this cost example.

Failure to remove only NEW paid network resources changes the result materially: retaining six endpoint-AZ bindings,ALB at1LCU and three IPv4 addresses for another7days adds **17.724USD**, yielding **31.010401USD with the pilot**, before any other retained state/services. This exceeds25USD. Scaling ECS to zero does not stop these charges, and stopping RDS does not end storage/backup costs or permanently prevent automatic restart. P8 must bind exact deletion/retention and positive containment before P1-P8 execution can be approved; never delete existing shared/production resources to fit the allocation.

The25USD allocation and budget alarms are **not a hard invoice cap**. Actual remaining project allowance, workload/LCU/request quantities, inter-AZ/Internet transfer,taxes,CPU surplus credits,extended retention,service minima and failed cleanup remain action-time uncertainties. P0 authorizes no P1-P8 action or continuous hosting. **Model budget remains unapproved; no model spend is included or renewed.**
