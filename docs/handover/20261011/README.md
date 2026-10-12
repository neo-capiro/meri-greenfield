# Meri greenfield remote engineering handover

**Status: G0 accepted; G1 OPEN; G2–G7 unentered. Eight deployment gates total. No cutover has occurred.**

Start with the [remote pickup runbook](REMOTE-PICKUP.md) and [full detailed handover](Meri_Greenfield_Engineering_Handover_2026-10-11.md). Read/download the [Word handover](Meri_Greenfield_Engineering_Handover_2026-10-11.docx) or [PDF](Meri_Greenfield_Engineering_Handover_2026-10-11.pdf).

The handover covers all completed and unfinished work against W00–W11, G0–G7, R-01–R-12, REL-01–REL-09 and RG-01–RG-12; the full 139-capability disposition; 14 skill intents; 22 source domains; failure history, exact code states and remaining acceptance targets.

- [Adopted deployment plan R2](../../plans/MERI-DEPLOYMENT.md)
- [All 35 document/evidence references on GitHub](REFERENCE-INDEX.md)
- [Exact accepted, pending and SDK WIP source checkpoint manifest](REMOTE-CODE-MANIFEST.json)
- [Multiple Hermes workers, mandatory Codex validation, remote cleanup coordination and no dormant sessions](CONTINUATION-INSTRUCTIONS.md)
- [Published evidence status and private raw-capture limits](LOCAL-EVIDENCE-STATUS.md)
- [Document verification results](QA-RESULTS.json)

The next execution is on a remote server. The active cleanup execution is on another remote server, not the local PC; its current locator must be discovered and verified. Codex validates all Hermes work at each workstream/phase end, integrates only accepted candidates, and closes every owned worker session when the task ends.

Source checkpoints and documents are committed and pushed. Private raw captures/credentials are outside Git; secure evidence recovery is explicitly pending where required. Publication does not turn WIP, source checks or bounded experiments into gate acceptance.
