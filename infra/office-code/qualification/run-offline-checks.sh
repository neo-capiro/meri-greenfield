#!/bin/sh
# Offline fidelity checks for the three affected Office cases.
# Usage: run-offline-checks.sh <corpus-inputs-dir> <saved-artifacts-dir> <output-dir>
# Read-only on both inputs; writes only JSON reports into <output-dir>.
#
# mode (4th argument):
#   fixed   the saved artifacts come from the fixed candidate; the chart
#           workbooks must be preserved (exit 0 required).
#   prefix  the saved artifacts are the retained pre-fix saves; the chart
#           checks must FAIL them.  This is the sensitivity control for the
#           checker over real evidence.
set -eu
corpus=${1:?corpus inputs directory}
saved=${2:?saved artifacts directory}
out=${3:?output directory}
mode=${4:-fixed}
case "$mode" in fixed|prefix) ;; *) echo "mode must be fixed or prefix" >&2; exit 2;; esac
cd "$(dirname -- "$0")"
python=${PYTHON:-python}
mkdir -p "$out"
failed=0

for id in pptx-03 pptx-04; do
  if "$python" chart-workbook-fidelity.py \
      --original "$corpus/$id.pptx" --saved "$saved/$id.pptx" \
      --json "$out/chart-$id.json"; then
    status=0
    echo "PASS chart-workbook $id"
  else
    status=1
    echo "DIFFERENCE chart-workbook $id"
  fi
  if [ "$mode" = prefix ]; then
    # A pre-fix save must be rejected, otherwise the check cannot detect the loss.
    [ "$status" -eq 1 ] || failed=$((failed + 1))
  else
    [ "$status" -eq 0 ] || failed=$((failed + 1))
  fi
done

if "$python" currency-semantics-check.py \
    --original "$corpus/xlsx-02.xlsx" --saved "$saved/xlsx-02.xlsx" \
    --json "$out/currency-xlsx-02.json"; then
  echo "PASS number-format-equivalence xlsx-02"
else
  echo "DIFFERENCE number-format-equivalence xlsx-02"
  failed=$((failed + 1))
fi

if "$python" currency-semantics-check.py --self-test >"$out/currency-self-test.txt"; then
  echo "PASS number-format rejection controls"
else
  echo "FAIL number-format rejection controls"
  failed=$((failed + 1))
fi

echo "cases failed: $failed"
test "$failed" -eq 0
