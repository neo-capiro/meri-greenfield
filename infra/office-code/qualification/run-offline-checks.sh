#!/bin/sh
# Offline fidelity checks and control suites for the three affected cases.
#
# Usage: run-offline-checks.sh <corpus-inputs-dir> <saved-artifacts-dir> <output-dir> [fixed|prefix]
#        [--no-flows] [--no-controls]
#
# mode (4th argument):
#   fixed   the saved artifacts come from the fixed candidate; the chart
#           workbooks must be preserved (exit 0 required).
#   prefix  the saved artifacts are the retained pre-fix saves; the chart
#           checks must FAIL them. This is the sensitivity control over real
#           evidence.
#
# Read-only on the corpus and the saved artifacts; writes only into <output-dir>.
set -eu
corpus=${1:?corpus inputs directory}
saved=${2:?saved artifacts directory}
out=${3:?output directory}
mode=${4:-fixed}
case "$mode" in fixed|prefix) ;; *) echo "mode must be fixed or prefix" >&2; exit 2;; esac
shift 4 2>/dev/null || shift $#
controls=1
flows=1
for option in "$@"; do
  case "$option" in
    --no-controls) controls=0 ;;
    --no-flows) flows=0 ;;
    *) echo "unknown option $option" >&2; exit 2 ;;
  esac
done

cd "$(dirname -- "$0")"
python=${PYTHON:-python}
node=${NODE:-node}
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

if [ "$controls" -eq 1 ]; then
  if "$python" test-controls.py --corpus "$corpus" --saved-dir "$saved" \
      --scratch "$out/controls-scratch" >"$out/controls.txt" 2>&1; then
    echo "PASS checker control suites ($(grep -c '^PASS' "$out/controls.txt") controls)"
  else
    echo "FAIL checker control suites (see $out/controls.txt)"
    failed=$((failed + 1))
  fi
fi

if [ "$flows" -eq 1 ]; then
  if "$node" test-flows.mjs --scratch "$out/flows-scratch" >"$out/flows.txt" 2>&1; then
    echo "PASS inert flow controls ($(grep -c '^PASS' "$out/flows.txt") controls)"
  else
    echo "FAIL inert flow controls (see $out/flows.txt)"
    failed=$((failed + 1))
  fi
fi

echo "failures: $failed"
test "$failed" -eq 0
