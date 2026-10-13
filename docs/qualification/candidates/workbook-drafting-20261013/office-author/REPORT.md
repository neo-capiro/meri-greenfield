# XLSX recalculation repair — author handoff

Source freeze: `1c3cfb9c97681415286236edd21a829e51b565eb`.
Additional tests: `458352c965b97ee3c374d2f8f95d45027bb1ef0a`.
Base: `305648bc` from the isolated workbook source repository.

The canonical LibreOffice transformer now writes a fixed, trusted Calc configuration only for XLSX conversion. The owned temporary profile sets `Formula/Load/OOXMLRecalcMode` to0 before the existing bounded process starts. The executable, arguments, caller deadline, output limits, receipts and finally cleanup are unchanged. There is no user-selectable profile, new formula engine, UNO option, package, network setting, or renderer qualification claim. DOCX→PDF creates no new Calc configuration and retains its exact argument contract.

## Actual diagnosis

The [official Calc configuration schema](https://raw.githubusercontent.com/LibreOffice/core/master/officecfg/registry/schema/org/openoffice/Office/Calc.xcs) defines0 as always recalculate and1 as never, with1 as the upstream default. The repair was confirmed by actual local execution rather than inferred from that documentation.

The exact parent original workbook is6,002 bytes and retained unchanged. Before repair, the canonical transformer exited successfully but D4 still had cached value0 instead of2050. An independently generated XlsxWriter workbook reproduced the same stale-cache failure. Their full input/output workbook copies, formula/literal/cache observations and process receipts are retained under `before-artifacts/`; initial source and failed assertions are frozen at `53955873`. Initial controls:1/3 PASS,2 expected cached-value failures.

After the fixed profile, the same three assertions pass. D4 recalculates to2050; the independent dependent formula recalculates to4100. All worksheet cell coordinates, formula expressions, literal values and cell types compare exactly against input; literal `=1+1` remains a string. Selected formatting checks remain intact. Input buffers and the parent's original bytes retain their exact SHA. The output artifacts and observations are retained under `repaired-artifacts/` and `final-artifacts/`.

## Final verification

- Author7/7 PASS in22.148 seconds: real parent/independent XLSX conversion, formula/cache/literal checks, exact unchanged Word arguments, XLSX-only owned profile with0600 file/0700 directory, Word no-XML behavior, child-failure cleanup, and pre-cancel cleanup without a child.
- Independent reviewer7/7 PASS against exact1c3cfb9c in22.153 seconds; original stale-cache and absent-profile failures retained independently. No remaining source defect reported.
- Source audit:11,567 original entries;11,566 unchanged. Only `apps/artifacts/office-transform.mjs` changed. Original tests, artifact generators, contracts, migrations and PR53 remain untouched.
- All27 recorded author capture/Python/LibreOffice/probe groups are freshly physically absent. Passing tests completed awaited temporary-directory removal, and canonical conversion leaves no profile/input/output directory in the borrowed root. No dependency links or installations were made; no other owner's resource was disposed.

`upstream.json` records the primary source and local LibreOffice build metadata. `audit.json`, `cleanup.json`, raw captures and the manifest bind exact source, original/output bytes and observed results. Source imports remain inert. No original assertion was altered; additional profile/cleanup tests were appended in the new allocated test file.

## Integration and limits

Ordered commits: `50b8861b` outline/original input → `53955873` real baseline failure → `1c3cfb9c` profile repair and actual pass → `458352c9` added isolation/cleanup tests and final pass → final metadata packet. Source is in `/tmp/meri-workbook-office-author-20261013`, branch `task/meri-workbook-office-20261013`.

Run `node --test apps/artifacts/test/office-recalc.test.mjs` with the installed local Python and soffice paths used in that file. Set the test-only `OFFICE_EVIDENCE_DIR` to retain a new run's artifacts/receipts without overwriting previous evidence. The bounded capture script is provided in this packet.

These are synthetic local workbook observations. Receipts still state `nativeQualification:false`, `sandboxQualified:false` and `formulaEquivalence:'unqualified'`. Tested formulas are not proof of universal Excel equivalence, native sandbox/network containment, deployment or G1. No native infrastructure, real database, customer, model, cloud or paid-provider action was performed.
