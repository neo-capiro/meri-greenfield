#!/usr/bin/env bash
# READ-ONLY. Independent ECR scan gate on the exact product digest (the build already gated it; this re-reads it).
#   Any HIGH or CRITICAL           -> STOP. Do not feed the Meri kit. Bases and pins are fixed, so a finding is apk
#                                     snapshot/CVE-feed drift and needs a base decision, not a waiver.
#   Only MEDIUM/LOW/INFORMATIONAL  -> HOLD (the serving 734a20ec had zero findings). Continue only on an explicit
#                                     decision: ACCEPT_NON_HIGH_FINDINGS=1 bash 03-scan-gate.sh
#   Zero findings                  -> PASS (state/scan-gate.pass)
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

digest="$(need product-digest)"
rm -f scan-gate.pass
aws ecr wait image-scan-complete --repository-name "$REPOSITORY_NAME" --image-id "imageDigest=$digest"
aws ecr describe-images --repository-name "$REPOSITORY_NAME" --image-ids "imageDigest=$digest" --output json > ecr-image.json
aws ecr describe-image-scan-findings --repository-name "$REPOSITORY_NAME" --image-id "imageDigest=$digest" --output json > ecr-scan.json
python3 -I -B - "$digest" "$COMMIT" "${ACCEPT_NON_HIGH_FINDINGS:-}" <<'EOF'
import datetime, json, sys
digest, commit, accept = sys.argv[1:]
img = json.load(open("ecr-image.json"))["imageDetails"]; scan = json.load(open("ecr-scan.json"))
assert len(img) == 1 and img[0]["imageDigest"] == digest and any(t.startswith(f"proxy-product-{commit}-") for t in img[0].get("imageTags", [])), "image detail"
assert scan["imageId"]["imageDigest"] == digest and scan["imageScanStatus"]["status"] == "COMPLETE", "scan not COMPLETE"
f = scan["imageScanFindings"]; assert "nextToken" not in scan and "nextToken" not in f, "paginated findings"
when = lambda v: v if isinstance(v, (int, float)) else datetime.datetime.fromisoformat(v).timestamp()
assert when(f["imageScanCompletedAt"]) >= when(img[0]["imagePushedAt"]), "scan predates push"
counts = f.get("findingSeverityCounts") or {}
rows = [(x["severity"], x["name"], {a["key"]: a["value"] for a in x.get("attributes", [])}.get("package_name")) for x in f.get("findings", [])]
for r in rows: print("\t".join(map(str, r)))
print("counts", json.dumps(counts))
if counts.get("HIGH") or counts.get("CRITICAL") or any(r[0] in ("HIGH", "CRITICAL") for r in rows):
    sys.exit("STOP: HIGH/CRITICAL findings on the product image. Do not feed the Meri kit")
if rows and accept != "1":
    sys.exit("HOLD: non-HIGH findings (serving image had none). Re-run with ACCEPT_NON_HIGH_FINDINGS=1 only on an explicit decision")
open("scan-gate.pass", "w").write(("ACCEPTED_NON_HIGH " + json.dumps(counts) if rows else "ZERO_FINDINGS") + "\n")
print("SCAN_GATE_PASS", open("scan-gate.pass").read().strip())
EOF
