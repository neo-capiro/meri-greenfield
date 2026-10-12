"""Derive field-level facts from pinned private text/data; execute no private code."""
import hashlib
import json
from pathlib import Path
import re
import sys

PINS = {
    'NativeMetadata.cs': (6163, 'f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c'),
    'candidate-hash-and-paths.json': (60160, '1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84'),
    'collect.ps1': (23776, '729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1'),
}


def main(directory):
    inputs = {}
    for name, (size, digest) in PINS.items():
        raw = (Path(directory) / name).read_bytes()
        if len(raw) != size or hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError('pinned member identity mismatch: ' + name)
        inputs[name] = raw
    # Read only field identities from the exact Same expression. The expression
    # itself never enters output, a compiled unit or an execution namespace.
    same_line = inputs['NativeMetadata.cs'].decode('utf-8-sig').splitlines()[68]
    equality = r'a\.([A-Za-z_]\w*)\s*==\s*b\.([A-Za-z_]\w*)'
    pairs = re.findall(equality, same_line)
    skeleton = re.sub(equality, 'EQ', same_line).strip()
    if skeleton != 'return ' + ' && '.join(['EQ'] * 13) + ';' or any(a != b for a, b in pairs):
        raise ValueError('reviewed equality structure changed')
    fields = [left for left, _ in pairs]
    value = json.loads(inputs['candidate-hash-and-paths.json'])
    def differing(left, right, selected):
        return [field for field in selected if left[field] != right[field]]
    identity_fields = ['VolumeSerialHex', 'FileId128Hex', 'Attributes', 'ReparseTag', 'Directory', 'DeletePending']
    rows = []
    for role in ('executable', 'root', 'Lib', 'DLLs'):
        before, after = value['before'][role], value['after'][role]
        eligible = before['passed'] is True and after['passed'] is True and len(before['entries']) == len(after['entries'])
        differences = [differing(a, b, fields) for a, b in zip(before['entries'], after['entries'], strict=True)]
        identity = eligible and all(not differing(a, b, identity_fields) for a, b in zip(before['entries'], after['entries'], strict=True))
        rows.append({'role': role, 'entryCount': len(differences), 'sameFailedFieldsByAncestor': differences,
                     'identityAndPlainMetadataStable': identity,
                     'allRecordedFieldsIncludingTimesStable': eligible and not any(differences)})
    hashed = value['hash']
    before, during, after = (hashed[name] for name in ('OpenedBefore', 'NamedDuring', 'OpenedAfter'))
    relationships = [
        ('opened-before/opened-after', before, after),
        ('opened-before/named-during', before, during),
        ('named-before/opened-before', value['before']['executable']['entries'][-1], before),
        ('opened-after/named-after', after, value['after']['executable']['entries'][-1]),
    ]
    related = [{'pair': name, 'sameFailedFields': differing(a, b, fields)} for name, a, b in relationships]
    opened_stable = not related[0]['sameFailedFields'] and hashed['BytesRead'] == before['Size']
    named_stable = not related[1]['sameFailedFields']
    hash_stable = opened_stable and named_stable and not related[2]['sameFailedFields'] and not related[3]['sameFailedFields']
    identity_stable = all(row['identityAndPlainMetadataStable'] for row in rows)
    all_stable = all(row['allRecordedFieldsIncludingTimesStable'] for row in rows)
    outcomes = {'OpenedStable': opened_stable, 'NamedMatchesOpened': named_stable,
                'executableBeforeOpenedAfterStable': hash_stable,
                'pathIdentityAndPlainMetadataStable': identity_stable,
                'allRecordedPathFieldsStable': all_stable,
                'boundedHashObservationAccepted': hashed is not None and hash_stable and identity_stable and all_stable}
    reported = {name: (hashed[name] if name in hashed else value[name]) for name in outcomes}
    report = {'inputs': [{'name': name, 'bytes': size, 'sha256': digest} for name, (size, digest) in PINS.items()],
              'method': 'Private source text field extraction and JSON arithmetic only; no source compilation/import/execution',
              'sameComparedFields': fields,
              'sameOmittedEntryFields': sorted(set(before) - set(fields)),
              'roleComparisons': rows, 'executableRelationships': related,
              'recomputedOutcomes': outcomes, 'reportedOutcomesMatch': outcomes == reported,
              'recordedBeforeAfterPassedAreInputs': True,
              'nativeMetadataObservationsIndependentlyRecreated': False,
              'nativeExecution': False, 'accessTimeWaiver': False, 'runtimeAdmission': False}
    print(json.dumps(report, indent=2))
    return 0 if outcomes == reported and outcomes['boundedHashObservationAccepted'] is False else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
