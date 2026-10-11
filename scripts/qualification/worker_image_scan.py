"""Offline, pinned basic ECR scan preparation; never grants image admission.

CLI exit codes: 0 = complete HOLD scaffold (or help), 2 = refused input.
No AWS call, filesystem write, applicability decision or package fix occurs.
"""
import argparse
from collections import Counter
from pathlib import Path
import sys

if __name__ == '__main__':
    # Only the reviewed sibling owners are needed under Python -I -B -S.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import worker_image_collect as evidence
from worker_image_publish import ACCOUNT, REPOSITORY, SHA as IMAGE_SHA

MAX_SCAN_BYTES = 8 * 1024 * 1024
MAX_REPORT_BYTES = 64 * 1024 * 1024
MAX_FINDINGS = 10000
SEVERITIES = ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNDEFINED')
FINDING_FIELDS = {'name', 'description', 'uri', 'severity', 'attributes'}
STRING_BOUNDS = {'name': 4096, 'description': 262144, 'uri': 16384}
RESPONSE_FIELDS = {'registryId', 'repositoryName', 'imageId', 'imageScanStatus',
                   'imageScanFindings', 'nextToken', 'NextToken'}
SCAN_FIELDS = {'findings', 'findingSeverityCounts', 'imageScanCompletedAt',
               'vulnerabilitySourceUpdatedAt', 'enhancedFindings'}


def validate_pins(expected_sha256, image_digest):
    """Validate external byte/image bindings before inspecting input bytes."""
    evidence.need(type(expected_sha256) is str and evidence.SHA.fullmatch(expected_sha256),
                  'external scan SHA-256 required')
    evidence.need(type(image_digest) is str and IMAGE_SHA.fullmatch(image_digest),
                  'exact immutable image digest required')


def bounded_string(value, limit):
    evidence.need(type(value) is str and len(value) <= limit, 'bounded scan string')
    # Reject unpaired surrogates rather than emitting invalid Unicode evidence.
    value.encode('utf-8', errors='strict')


def finding_row(value, index):
    """Retain the complete supported basic finding, with observed attrs only."""
    evidence.need(type(value) is dict and set(value) <= FINDING_FIELDS,
                  'supported basic finding fields')
    severity = value.get('severity')
    evidence.need(type(severity) is str and severity in SEVERITIES, 'finding severity')
    for field, bound in STRING_BOUNDS.items():
        if field in value:
            bounded_string(value[field], bound)
    attributes = value.get('attributes', [])
    evidence.need(type(attributes) is list and len(attributes) <= 50, 'bounded basic attributes')
    observed = {}
    for attribute in attributes:
        evidence.need(type(attribute) is dict and set(attribute) == {'key', 'value'},
                      'basic attribute key/value')
        bounded_string(attribute['key'], 4096)
        bounded_string(attribute['value'], 262144)
        evidence.need(attribute['key'] not in observed, 'ambiguous duplicate attribute')
        observed[attribute['key']] = attribute['value']
    # Attribute order does not make a repeated finding a different row.
    identity = dict(value)
    if 'attributes' in value:
        identity['attributes'] = sorted(attributes, key=lambda row: row['key'])
    row = {
        'index': index,
        'rawFinding': value,
        'observedProvider': {'name': observed.get('package_name'),
                             'version': observed.get('package_version')},
        'disposition': {'status': 'OPEN', 'vendorApplicability': None,
                        'supportedFix': None, 'embeddedCopyCoverage': None,
                        'ownerDecision': None},
    }
    return row, evidence.digest(evidence.encoded(identity))


def analyze_basic_scan(raw, *, expected_sha256, image_digest):
    """Produce a HOLD scaffold from complete externally pinned basic bytes.

    Structural completeness does not authenticate an AWS response, establish
    current vulnerability coverage, or close findings omitted by a later scan.
    """
    validate_pins(expected_sha256, image_digest)
    evidence.need(type(raw) is bytes and 0 < len(raw) <= MAX_SCAN_BYTES, 'bounded raw scan bytes')
    evidence.need(evidence.digest(raw) == expected_sha256, 'external scan byte identity')
    value = evidence.loads(raw)
    evidence.need(type(value) is dict and set(value) <= RESPONSE_FIELDS, 'supported basic scan object')
    evidence.need(value.get('registryId') == ACCOUNT and value.get('repositoryName') == REPOSITORY,
                  'approved ECR registry and repository')
    image_id = value.get('imageId')
    evidence.need(type(image_id) is dict and set(image_id) <= {'imageDigest', 'imageTag'}
                  and image_id.get('imageDigest') == image_digest,
                  'exact scan image digest')
    if 'imageTag' in image_id:
        bounded_string(image_id['imageTag'], 4096)
    status = value.get('imageScanStatus')
    evidence.need(type(status) is dict and set(status) <= {'status', 'description'}
                  and status.get('status') == 'COMPLETE', 'completed basic scan')
    if 'description' in status:
        bounded_string(status['description'], 262144)
    evidence.need(value.get('nextToken') is None, 'complete unpaginated scan response required')
    # CLI aggregates may spell their continuation token differently. Never
    # accept one as evidence that no results remain.
    evidence.need(value.get('NextToken') is None, 'complete CLI scan response required')
    scan = value.get('imageScanFindings')
    evidence.need(type(scan) is dict and set(scan) <= SCAN_FIELDS, 'supported basic scan findings object')
    for name in ('imageScanCompletedAt', 'vulnerabilitySourceUpdatedAt'):
        if name in scan:
            timestamp = scan[name]
            if type(timestamp) is str:
                bounded_string(timestamp, 4096)
            else:
                evidence.need(type(timestamp) in (int, float) and timestamp >= 0,
                              'recorded scan timestamp')
    enhanced = scan.get('enhancedFindings', [])
    evidence.need(type(enhanced) is list and enhanced == [], 'enhanced scans are not supported')
    findings = scan.get('findings')
    evidence.need(type(findings) is list and len(findings) <= MAX_FINDINGS, 'complete bounded findings')
    counts = scan.get('findingSeverityCounts')
    evidence.need(type(counts) is dict and set(counts) <= set(SEVERITIES), 'known severity counts')
    evidence.need(all(type(count) is int and 0 <= count <= MAX_FINDINGS for count in counts.values()),
                  'bounded integer severity counts')
    rows, identities = [], set()
    for index, finding in enumerate(findings):
        row, identity = finding_row(finding, index)
        evidence.need(identity not in identities, 'duplicate finding row')
        identities.add(identity)
        rows.append(row)
    actual = Counter(row['rawFinding']['severity'] for row in rows)
    normalized = {severity: counts.get(severity, 0) for severity in SEVERITIES}
    evidence.need(normalized == {severity: actual[severity] for severity in SEVERITIES},
                  'all returned rows reconcile with severity counts')
    result = {
        'schema': 'meri-worker-basic-scan-preparation/1',
        'status': 'SOURCE_ONLY_HOLD',
        'scanEvidenceComplete': True,
        'scanAdmitted': False, 'runtimeAdmitted': False, 'g1Admitted': False,
        'evidence': {'bytes': len(raw), 'sha256': expected_sha256,
                     'registryId': ACCOUNT, 'repositoryName': REPOSITORY,
                     'imageDigest': image_digest},
        'scanMetadata': {key: item for key, item in scan.items()
                         if key not in ('findings', 'enhancedFindings')},
        'rawResponseMetadata': {key: item for key, item in value.items()
                                if key != 'imageScanFindings'},
        'findingCount': len(rows), 'severityCounts': normalized, 'findings': rows,
        'limitations': [
            'External byte pins do not authenticate the service origin or prove freshness.',
            'Every finding requires separate vendor, applicability and owner disposition.',
            'OS scan completeness does not establish bundled-component or notice closure.',
            'Previously unresolved findings remain obligations even if a later scan omits them.',
            'Zero findings grant no security, runtime or G1 admission.',
        ],
    }
    evidence.need(len(evidence.encoded(result)) <= MAX_REPORT_BYTES, 'bounded scan preparation output')
    return result


def prepare_file(scan_response, *, expected_sha256, image_digest):
    """Validate all CLI bindings before the canonical stable read performs I/O."""
    validate_pins(expected_sha256, image_digest)
    evidence.need(type(scan_response) is str and 0 < len(scan_response) <= 4096,
                  'bounded absolute scan path')
    path = Path(scan_response)
    evidence.need(path.is_absolute() and '..' not in path.parts, 'absolute plain scan path')
    raw = evidence.read(path, MAX_SCAN_BYTES)
    return analyze_basic_scan(raw, expected_sha256=expected_sha256, image_digest=image_digest)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--scan-response', required=True, help='absolute path to retained complete basic ECR JSON')
    parser.add_argument('--scan-sha256', required=True, help='externally verified SHA-256 of the exact response bytes')
    parser.add_argument('--image-digest', required=True, help='reviewed exact sha256: image digest')
    args = parser.parse_args(argv)
    result = prepare_file(args.scan_response, expected_sha256=args.scan_sha256,
                          image_digest=args.image_digest)
    print(evidence.encoded(result).decode('ascii'), end='')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('Basic scan preparation refused; retain original evidence. No admission granted.', file=sys.stderr)
        raise SystemExit(2) from None
