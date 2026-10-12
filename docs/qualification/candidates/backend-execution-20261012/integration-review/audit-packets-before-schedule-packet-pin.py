"""Hash exact immutable family packets and their integrated correspondence."""
import hashlib
import json
import subprocess
import sys

target = sys.argv[1]
prefix = 'docs/qualification/candidates/backend-execution-20261012/'
packets = [
 ('client-knowledge/manifest.json', 'd0e317e8a2a996878c3c7f24577ef7f2d4c599e9'),
 ('client-knowledge-review/review-manifest.json', '709555c854ecda089a1421f013dddc06a7e43ee9'),
 ('public-legal/manifest.json', '9ce4cc63620b2817113bdb55c5922f1a71d148c4'),
 ('action-items-complete/manifest.json', 'cecffb15a7a4ca8974ac818fa0ec45b9f46e0c88'),
 ('action-items-complete-review/manifest.json', 'c522d3dfde2b7e932fc0c505c9660df2ab843334'),
 ('memory-propose/manifest.json', '907e7f05aff0c5433577dace76a8fb4a3cd037e0'),
 ('memory-propose-review/manifest.json', '68c4aca31f404cc47c089c422825517bec5236aa'),
 ('memory-proposal-source/manifest.json', 'ee568bef473884d930a54ab112fa32f9325eae0d'),
 ('memory-proposal-source-review/manifest.json', '45faf20bbfda4c26a4b24fb0c47b84868bb5c755'),
 ('dataset-metadata-handler/manifest.json', '3dbf6b796bacad59a5f1366c83ad7d9372125f5c'),
 ('dataset-metadata-handler-review/manifest.json', '8f2e9cfa5f23df23259e2ecbd27bc62edbd68648'),
 ('schedule-inspection/manifest.json', 'f6413801acf949141dea3bb86f7bcd5233eef3f5'),
 ('schedule-inspection-review/manifest.json', '2a21989e'),
 ('public-legal-review/complete-manifest.json', 'fb7fd02d2b38c1c64b315b3df8d43e053c2bbe6b'),
 ('integration/test-author-manifest.json', '36af89b921f37adcc15032b913d520bc9fbac25d'),
 ('raw-request-review/manifest.json', '10b79037683421d2e07ffbe17b98e8ab36d16cc6'),
]
checks = []
def blob(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path])
def sha(data):
    return hashlib.sha256(data).hexdigest()
def same(label, actual, expected):
    checks.append({'label': label, 'pass': actual == expected})
    if actual != expected:
        checks[-1].update(actual=actual, expected=expected)

counts = []
for relative, ref in packets:
    path = prefix + relative
    raw = blob(ref, path)
    same('manifest preserved ' + relative, sha(blob(target, path)), sha(raw))
    manifest = json.loads(raw)
    members = manifest['members'] if 'members' in manifest else manifest['entries']
    counts.append({'manifest': path, 'ref': ref, 'members': len(members), 'sha256': sha(raw)})
    for member in members:
        member_path = member['path']
        original = blob(ref, member_path)
        same('original packet member ' + relative + ':' + member_path,
             [len(original), sha(original)], [member['bytes'], member['sha256']])
        current = blob(target, member_path)
        if member_path == 'packages/runtime/operation-lifetime.mjs':
            same('documented sole EOF removal ' + relative, current, original[:-1])
        else:
            same('integrated packet member ' + relative + ':' + member_path,
                 [len(current), sha(current)], [len(original), sha(original)])

# The two-op manifest is historical, not a final six-op manifest. Verify it in its
# immutable review context; final reviewer-owned files are compared separately.
historical = prefix + 'public-legal-review/stage-two-manifest.json'
historical_ref = '35f4bf378c96df4d20fe8ca135ab5c7a8f62895e'
historical_raw = blob(historical_ref, historical)
same('historical public/legal manifest retained', sha(blob(target, historical)), sha(historical_raw))
for member in json.loads(historical_raw)['members']:
    data = blob(historical_ref, member['path'])
    same('historical two-op member ' + member['path'], [len(data), sha(data)], [member['bytes'], member['sha256']])
final_review = 'fb7fd02d2b38c1c64b315b3df8d43e053c2bbe6b'
review_paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', final_review,
    prefix + 'public-legal-review', 'docs/coordination/reports/CODEX-PUBLIC-LEGAL-REVIEW-20261012.md',
    'docs/coordination/tasks/CODEX-PUBLIC-LEGAL-REVIEW-20261012.md',
    'packages/contracts/test/retrieval-public-domain-independent.test.mjs',
    'packages/contracts/test/retrieval-research-legal-independent.test.mjs']).decode().splitlines()
for path in review_paths:
    same('final six-op reviewer correspondence ' + path, sha(blob(target, path)), sha(blob(final_review, path)))
failures = [row for row in checks if not row['pass']]
print(json.dumps({'scope': 'IMMUTABLE_PACKET_AUDIT_NOT_RUNTIME', 'target': target,
                  'checks': len(checks), 'passed': len(checks)-len(failures), 'failures': failures,
                  'packets': counts, 'finalPublicLegalReviewFiles': len(review_paths)}, indent=2))
raise SystemExit(1 if failures else 0)
