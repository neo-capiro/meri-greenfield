"""Independent offline packet admission checks; never import target modules."""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
PREFIX = 'docs/qualification/candidates/native-python-profile-20261012/author/'


def verify(root, packet, frozen):
    checks = []

    def need(value, label):
        if not value:
            raise ValueError(label)
        checks.append(label)

    need(packet['baseCommit'] == frozen['base'], 'preserved-base')
    need(packet['status'] == 'INCOMPLETE_SOURCE_REVIEW_ONLY_HOLD_EXECUTION', 'execution-hold')
    need(all(value is False for value in packet['authority'].values()), 'no-authority')
    need(all(value is False for value in packet['acceptance'].values()), 'no-admission')
    candidate = packet['candidate']
    need(candidate['role'] == 'EXISTING_ASTRAL_CPYTHON_3_11_15_X64_01', 'no-unestablished-host-role')
    need(candidate['hostIdentityPrivate'] is None and candidate['hostIdentityVerified'] is False, 'host-identity-unresolved')
    for field in ('executableBytes', 'executableSha256', 'distributorBuildProvenance'):
        need(candidate[field] is None, 'missing-' + field)
    need(candidate['actualRuntimeIdentityVerified'] is False, 'runtime-unobserved')
    need(candidate['reportedInterpreterExecutions'] == 0, 'reported-zero-executions')
    need(candidate['privateExecutablePathPublished'] is False, 'private-path-unpublished')
    receipt = packet['receipt']
    need(receipt['bytes'] == frozen['privateZip']['bytes'], 'reported-zip-bytes')
    need(receipt['sha256'] == frozen['privateZip']['sha256'], 'reported-zip-hash')
    need(receipt['materialized'] is False and receipt['libraryRetried'] is False, 'zip-not-retrieved')
    action = packet['nextAction']
    need(action['argvComplete'] is False and action['cwdPrivate'] is None, 'argv-unresolved')
    need(action['argv'][1:4] == ['-I', '-B', '-S'], 'isolated-flags')
    need(action['argv'][5] == '--repository' and action['argv'][7] == '--original-output', 'original-argument-roles')
    need(action['attempts'] == 1, 'one-attempt-only')
    need((action['cooperativeSeconds'], action['externalSeconds']) == (10, 15), 'distinct-deadline-types')
    need(action['sourceStdoutBytesMaximum'] == 32768, 'ancestor-stdout-cap')
    need(action['sourceStderrBytesMaximum'] is None, 'no-invented-source-stderr-cap')
    need(action['proposedExternalStderrBytesMaximum'] == 32768 and action['stderrPolicyReviewed'] is False, 'stderr-proposal-unreviewed')
    need(action['sourceChecksExecutableIdentity'] is False, 'executable-preflight-gap')
    for field in ('sourceSha256', 'sourceBytes', 'exactInvocation', 'privateReceiptSlot'):
        need(packet['supervisor'][field] is None, 'missing-supervisor-' + field)
    need(packet['supervisor']['reviewed'] is False, 'supervisor-unreviewed')
    need(set(('both-stream-EOFs', 'physical-exit', 'timeout', 'overflow', 'kill')) <= set(packet['supervisor']['require']), 'supervisor-required-observations')
    broader = packet['broaderMetadata']
    need(broader['sourceStdoutBytesMaximum'] == 1048576, 'broader-stdout-cap')
    need(broader['automatic'] is False and broader['separateAuthorityRequired'] is True, 'metadata-separate-authority')
    inventory = packet['selectedInventory']
    need((inventory['cooperativeSeconds'], inventory['maximumFileBytes'], inventory['maximumTotalBytes']) == (60, 16777216, 268435456), 'selected-inventory-bounds')
    need(inventory['fullRuntimeClosure'] is False and inventory['separateAuthorityRequired'] is True, 'inventory-limits')
    identities = json.loads((root / PREFIX / 'source-identities.json').read_text())
    need({row['path']: {'bytes': row['bytes'], 'sha256': row['sha256']} for row in identities['files']} == frozen['files'], 'independent-source-manifest-match')
    for name, identity in frozen['files'].items():
        raw = (root / name).read_bytes()
        need({'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()} == identity, 'immutable-source:' + name)
        ast.parse(raw)
        checks.append('source-parses-without-execution:' + name)
    for section in ('nextAction', 'broaderMetadata', 'selectedInventory'):
        row = packet[section]['source']
        need({key: row[key] for key in ('bytes', 'sha256')} == frozen['files'][row['path']], 'bound-source:' + section)
    reported = json.loads((root / PREFIX / 'parent-reported-candidate.json').read_text())
    need(reported == {key: packet[key] for key in ('candidate', 'receipt')}, 'reported-data-consistency')
    for path in (root / PREFIX).glob('*'):
        if path.suffix in ('.json', '.md', '.py'):
            need('\\Users\\' not in path.read_text() and '/Users/' not in path.read_text(), 'no-personal-path:' + path.name)
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    frozen = json.loads((HERE / 'frozen-inputs.json').read_text())
    packet = json.loads((args.source_root / PREFIX / 'profile-packet.json').read_text())
    passed = verify(args.source_root, packet, frozen)
    rejected = []
    changes = [('ancestor-cap-reuse', ('nextAction', 'sourceStdoutBytesMaximum'), 1048576),
               ('broader-cap-reuse', ('broaderMetadata', 'sourceStdoutBytesMaximum'), 32768),
               ('invented-execution-authority', ('authority', 'executionApproved'), True),
               ('invented-executable-hash', ('candidate', 'executableSha256'), '0' * 64),
               ('automatic-metadata', ('broaderMetadata', 'automatic'), True),
               ('invented-host-identity', ('candidate', 'hostIdentityVerified'), True)]
    for label, (section, field), value in changes:
        changed = copy.deepcopy(packet)
        changed[section][field] = value
        try:
            verify(args.source_root, changed, frozen)
        except ValueError:
            rejected.append(label)
        else:
            raise ValueError('negative-control-admitted:' + label)
    print(json.dumps({'status': 'PASS_SOURCE_PACKET_STATIC_ONLY', 'checksPassed': len(passed),
                      'negativeControlsRejected': rejected, 'checks': passed,
                      'targetModulesImported': False, 'nativeExecution': False,
                      'privateZipRead': False, 'subprocessesCreated': 0}, indent=2))


if __name__ == '__main__':
    main()
