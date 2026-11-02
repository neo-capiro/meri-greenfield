"""Offline readers for the browser-only host image build (infra/browser-host/image-build.sh). Standard library only; run with
`python3 -I -B -S`. Each subcommand validates one recorded fact and either prints it or writes the build result; any
mismatch raises, which fails the build. Nothing here calls a network, a model, a database or a deployment."""
import argparse
import hashlib
import json
import re
import sys

HEX64 = re.compile(r'^[0-9a-f]{64}$')
SHA_LINE = re.compile(r'^([0-9a-f]{64})  (/[A-Za-z0-9._/@+-]+)$')
LAUNCHER = '/opt/meri/meri-host-launcher'
RELAY_LAUNCHER = '/opt/meri/meri-host-relay-launcher'
BOOTSTRAP = '/opt/meri/apps/runtime/native-processing-host/protected-bootstrap.mjs'
CHROME = re.compile(r'^/opt/meri/browsers/chromium-[0-9]+/[A-Za-z0-9._/-]+/chrome$')
NODE_VERSION = 'v24.22.1'
PLAYWRIGHT_MCP = '0.0.83'
PLAYWRIGHT_CORE = '1.64.0-alpha-1790635538000'
ENTRYPOINT = ['node', '/opt/meri/apps/runtime/browser-host-service/host.mjs']
MAX_IMAGE_BYTES = 4 * 1024 ** 3


def read(path):
    with open(path, 'rb') as handle:
        return handle.read()


def sha_lines(path):
    rows = []
    for line in read(path).decode('utf-8').splitlines():
        match = SHA_LINE.match(line)
        if not match:
            raise ValueError('malformed sha256sum line in ' + path)
        rows.append((match.group(2), match.group(1)))
    if not rows:
        raise ValueError('empty hash file ' + path)
    return rows


def inspect_image(inspect_path, commit):
    rows = json.loads(read(inspect_path))
    assert len(rows) == 1
    image = rows[0]
    config = image['Config']
    assert image['Id'].startswith('sha256:') and HEX64.match(image['Id'][7:])
    assert image['Os'] == 'linux' and image['Architecture'] == 'arm64' and 0 < image['Size'] <= MAX_IMAGE_BYTES
    assert config['Labels']['org.opencontainers.image.revision'] == commit
    assert config.get('User', '') in ('', 'root', '0', '0:0'), 'the host service runs as root by design'
    assert config['Entrypoint'] == ENTRYPOINT and not config.get('Cmd')
    assert 'PLAYWRIGHT_BROWSERS_PATH=/opt/meri/browsers' in config['Env']
    return image['Id']


def chromium_path(path):
    rows = sha_lines(path)
    paths = [p for p, _ in rows if p.endswith('/chrome')]
    assert len(paths) == 1 and CHROME.match(paths[0]), 'exactly one chrome executable is recorded'
    return paths[0]


def hashes(args):
    recorded = dict(sha_lines(args.helper))
    assert set(recorded) == {LAUNCHER, RELAY_LAUNCHER, BOOTSTRAP}, 'the build records exactly the two helpers and the bootstrap program'
    assert dict(sha_lines(args.rehash)) == recorded, 'the recorded hashes are not the bytes the image carries'
    assert recorded[LAUNCHER] != recorded[RELAY_LAUNCHER], 'the two helper pins must differ'
    chromium = sha_lines(args.chromium)
    chromium_path(args.chromium)
    packages = read(args.packages).decode('utf-8').splitlines()
    assert packages and all(re.fullmatch(r'[A-Za-z0-9.+:_-]+=[A-Za-z0-9.+:~_-]+', line) for line in packages)
    assert read(args.node).decode().strip() == NODE_VERSION
    assert read(args.playwright).decode().strip() == PLAYWRIGHT_MCP + ' ' + PLAYWRIGHT_CORE
    result = {
        'helperSha256': recorded[LAUNCHER],
        'nativeHostRelayHelperSha256': recorded[RELAY_LAUNCHER],
        'programSha256': recorded[BOOTSTRAP],
        'chromiumFiles': [{'path': p, 'sha256': h} for p, h in chromium],
        'osPackageCount': len(packages),
        'osPackagesSha256': hashlib.sha256(read(args.packages)).hexdigest(),
        'nodeVersion': NODE_VERSION,
        'playwrightMcpVersion': PLAYWRIGHT_MCP,
        'playwrightCoreVersion': PLAYWRIGHT_CORE,
    }
    with open(args.out, 'x') as out:
        json.dump(result, out, indent=1, sort_keys=True)
        out.write('\n')


def described_digest(path, tag):
    rows = json.loads(read(path))['imageDetails']
    assert len(rows) == 1
    row = rows[0]
    assert tag in row['imageTags'] and re.fullmatch(r'sha256:[0-9a-f]{64}', row['imageDigest'])
    return row['imageDigest']


def result(args):
    scan = json.loads(read(args.scan))
    assert scan['repositoryName'] == args.repository and scan['imageId']['imageDigest'] == args.digest
    assert scan['imageScanStatus']['status'] == 'COMPLETE'
    counts = scan['imageScanFindings']['findingSeverityCounts']
    assert isinstance(counts, dict) and all(type(n) is int and n >= 0 for n in counts.values())
    assert counts.get('HIGH', 0) == 0 and counts.get('CRITICAL', 0) == 0, '0 HIGH/CRITICAL required'
    assert re.fullmatch(r'sha256:[0-9a-f]{64}', args.image_id) and re.fullmatch(r'[0-9a-f]{40}', args.commit)
    other = sorted({(f.get('name', ''), f.get('severity', '')) for f in scan['imageScanFindings'].get('findings', [])})[:200]
    body = {
        'sourceCommit': args.commit,
        'sourceVersion': args.source_version,
        'imageDigest': args.digest,
        'imageId': args.image_id,
        'repository': args.repository,
        'platform': 'linux/arm64',
        'scanStatus': 'COMPLETE',
        'findingSeverityCounts': counts,
        'otherFindingsForDecisionRecord': [{'name': n, 'severity': s} for n, s in other],
        'hashes': json.loads(read(args.hashes)),
    }
    with open(args.out, 'x') as out:
        json.dump(body, out, indent=1, sort_keys=True)
        out.write('\n')


def main(argv):
    parser = argparse.ArgumentParser(prog='image-evidence.py')
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('inspect'); p.add_argument('--inspect', required=True); p.add_argument('--commit', required=True)
    p = sub.add_parser('chromium-path'); p.add_argument('--chromium', required=True)
    p = sub.add_parser('hashes')
    for name in ('helper', 'rehash', 'chromium', 'packages', 'node', 'playwright', 'out'):
        p.add_argument('--' + name, required=True)
    p = sub.add_parser('digest'); p.add_argument('--described', required=True); p.add_argument('--tag', required=True)
    p = sub.add_parser('result')
    for name in ('scan', 'hashes', 'digest', 'repository', 'commit', 'source-version', 'image-id', 'out'):
        p.add_argument('--' + name, required=True)
    args = parser.parse_args(argv)
    if args.command == 'inspect':
        print(inspect_image(args.inspect, args.commit))
    elif args.command == 'chromium-path':
        print(chromium_path(args.chromium))
    elif args.command == 'hashes':
        hashes(args)
    elif args.command == 'digest':
        print(described_digest(args.described, args.tag))
    else:
        result(args)


if __name__ == '__main__':
    main(sys.argv[1:])
