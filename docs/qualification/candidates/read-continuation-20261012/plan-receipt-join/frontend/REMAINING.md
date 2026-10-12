# Remaining source and design findings

The nine-finding follow-up leaves the following eighteen original findings open. These retain their original bounded row mappings and separate native prerequisites in `evidence/triage/REMAINING-18.json`. None is relabeled backend-only to conceal a source or design gap. Completed P1 work and this follow-up do not grant blanket acceptance to the 337-row inventory.

| Finding | Priority | Kind | Remaining requirement |
| --- | --- | --- | --- |
| CI-01 | P2 | source | Saved client detail fields have no on-screen read-only profile surface |
| CI-02 | P2 | source | Client view switcher omits search and the specified per-view keyboard shortcuts |
| CI-03 | P3 | design | Account team retains a generic stacked form instead of the designed roster |
| CI-04 | P3 | design | Intake choice groups use one three-column grid for distinct designed layouts |
| CP-04 | P2 | design | Facilities entry opens a standalone editor instead of the designed management dialog |
| CP-05 | P2 | design | Overview timeline retains a generic dot list instead of the designed grouped activity feed |
| CP-06 | P2 | design | Files toolbar and results header do not follow the supplied Files composition |
| CR-05 | P2 | source and design | Client Agenda omits lifecycle triage filters and state columns |
| CR-06 | P2 | source and design | Meeting workspace loses identity context across tabs and always enters Information |
| CR-08 | P2 | source | Prep and attachment share/unshare are missing |
| CR-09 | P2 | source | Client-shared meeting materials feed has no Portfolio consumer |
| CR-10 | P3 | design | Email composer omits the designed rich-text formatting controls |
| OWI-F03 | P2 | design | Registrations dialog omits the authored divided row layout |
| OWI-F04 | P2 | design | Mobile capabilities retains full desktop cards instead of the compact authored list |
| MS06 | P2 | source and design | Modules meeting detail omits supplied join link and designed split view |
| MS07 | P2 | design | Workspace desktop filters expand to three full-width rows |
| MS08 | P2 | source and design | Planner All tasks lacks the authored client grouping and scope controls |
| MS09 | P3 | design | Public Planner form loses the designed title and validation hierarchy |

Four are source findings, four combine source and design, and ten are design findings. MS07–MS09 are supplementary Modules findings without assigned original Portfolio row IDs; their product scope remains intact.

Native follow-up uses the finite checks and prerequisites in `evidence/triage/STAGING-CHECKS.json`. Seven checks are read-first and require a qualified image, known service versions/origins, provisioned synthetic actors/roles/tenants/clients and current authorized identity. N06 can verify local Undo without a paid model operation; a real rewrite needs separate authorization. N09 needs separately approved disposable files, a bounded DELETE count and storage-effect verification. No native setup, request, mutation, provider message, model workload, deployment or AWS action was performed in this follow-up.
