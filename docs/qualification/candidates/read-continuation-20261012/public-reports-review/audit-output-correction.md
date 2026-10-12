# Audit receipt filename correction

Initial verify-source.py wrote source-audit.json, then the successful capture
helper used that same label for its command receipt. All41 checks passed and the
complete audit result remains verbatim in source-audit.stdout.bin; no source or
check result was lost. A subsequent summary read expected sourceTree in the
receipt and raised KeyError. Preserve this original script/receipt in Git and
change only the generated result filename to source-preservation.json before
rerunning the same41 checks. This is a reviewer evidence-path correction, not a
production defect or a changed assertion.
