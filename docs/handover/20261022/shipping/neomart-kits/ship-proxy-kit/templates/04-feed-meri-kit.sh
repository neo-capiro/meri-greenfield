#!/usr/bin/env bash
# LOCAL FILE EDITS ONLY (no AWS). Feeds the gated proxy image into a Meri first-chat ship kit made by
# C:/dev/fable/ship-kit/make-ship-kit.mjs, BEFORE that kit's step 04-image-readback:
#   baseline-C.deployment-inputs.json  images.proxy = <repository>@<product digest>, images.proxySourceCommit = <commit>
#   kit.json                           proxyScanSha256 = sha256 of the exact proxy-image-receipt.json bytes
# The Meri kit's 04 then writes deployment-inputs.candidate.json and image-scans.candidate.json from these, 12 renders
# the model-proxy role on this image (verify-rendered checks both digests), 14 pins reviewedScanSha256 in the bindings.
# Originals are kept as *.pre-proxy.json and the change is recorded in <meri kit>/proxy-feed.json.
# Usage: bash 04-feed-meri-kit.sh C:/dev/fable/ship-<meri sha8>
set -euo pipefail
source "$(dirname "$0")/kit.env"

MK="${1:?usage: 04-feed-meri-kit.sh <meri kit dir>}"; command -v cygpath >/dev/null && MK="$(cygpath -m "$MK")"
[ -s "$STATE/scan-gate.pass" ] || stop "03-scan-gate.sh has not passed"
digest="$(need product-digest)"; receipt_sha="$(need receipt-sha256)"
[ "$(sha256sum "$STATE/proxy-image-receipt.json" | cut -d' ' -f1)" = "$receipt_sha" ] || stop "receipt file changed since 02"
for f in kit.json baseline-C.deployment-inputs.json; do [ -s "$MK/$f" ] || stop "$MK/$f missing: not a Meri ship kit"; done
for f in deployment-inputs.candidate.json image-scans.candidate.json measurement-prepared proxy-feed.json; do
  [ ! -e "$MK/$f" ] || stop "$MK/$f exists: the Meri kit is past step 03 (or already fed). Make a new Meri kit and feed it before its 04"
done

# The Meri kit renders the proxy role from ITS commit's apps/proxy (config, pricing, startup pins): it must be the
# same tree this image was built from.
meri_commit="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["commit"])' "$MK/kit.json")"
git -C "$REPO" cat-file -e "$meri_commit^{commit}" 2>/dev/null || git -C "$REPO" fetch -q origin
[ "$(git -C "$REPO" rev-parse "$meri_commit:apps/proxy")" = "$(git -C "$REPO" rev-parse "$COMMIT:apps/proxy")" ] \
  || stop "Meri kit commit $meri_commit carries a different apps/proxy tree than proxy image commit $COMMIT"

cp "$MK/baseline-C.deployment-inputs.json" "$MK/baseline-C.deployment-inputs.pre-proxy.json"
cp "$MK/kit.json" "$MK/kit.pre-proxy.json"
python3 -I -B - "$MK" "$REPOSITORY_URI@$digest" "$COMMIT" "$receipt_sha" "$KIT_DIR" <<'EOF'
import datetime, json, sys
mk, image, commit, receipt_sha, proxy_kit = sys.argv[1:]
dep_path, kit_path = f"{mk}/baseline-C.deployment-inputs.json", f"{mk}/kit.json"
dep, kit = json.load(open(dep_path, encoding="utf-8")), json.load(open(kit_path, encoding="utf-8"))
before = {"proxy": dep["images"]["proxy"], "proxySourceCommit": dep["images"]["proxySourceCommit"], "proxyScanSha256": kit["proxyScanSha256"]}
dep["images"]["proxy"], dep["images"]["proxySourceCommit"] = image, commit
kit["proxyScanSha256"] = receipt_sha
open(dep_path, "w", encoding="utf-8", newline="\n").write(json.dumps(dep, indent=2) + "\n")
open(kit_path, "w", encoding="utf-8", newline="\n").write(json.dumps(kit, indent=2) + "\n")
after = {"proxy": image, "proxySourceCommit": commit, "proxyScanSha256": receipt_sha}
open(f"{mk}/proxy-feed.json", "x", encoding="utf-8").write(json.dumps({"schemaVersion": 1, "proxyKit": proxy_kit,
    "meriCommit": kit["commit"], "before": before, "after": after,
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, indent=2) + "\n")
print("FED", json.dumps(after))
EOF
echo "Next: run the Meri kit from its 01 as usual. Its 04 carries this proxy into deployment-inputs.candidate.json and image-scans.candidate.json."
