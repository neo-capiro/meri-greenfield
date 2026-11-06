"""Bounded source regression for CVE-2026-113351 and CVE-2026-115506; physical ARM/scan gates remain required."""
import copy
import re
import tarfile
import unittest

from test_native_apk_index import DOCKERFILE, LOCK, PIP_REPO_DIR, REPO_DIR, ROOT, STAGED_NAMES


def require_fixed_expat(lock):
    rows = [p for p in lock['systemPackages'] if p['name'] == 'libexpat1']
    assert len(rows) == 1
    version = rows[0]['version']
    upstream, release = version.rsplit('-r', 1)
    assert tuple(map(int, upstream.split('.'))) >= (2, 10, 0), 'CVE-2026-113351/CVE-2026-115506 affected expat'
    return rows[0]


SUFFIX_RANK = {'alpha': -4, 'beta': -3, 'pre': -2, 'rc': -1, 'cvs': 1, 'svn': 2, 'git': 3, 'hg': 4, 'p': 5}
_TOKEN_PATTERNS = ((1, re.compile(r'\.(\d+)')), (2, re.compile(r'([a-z])')),
                   (3, re.compile(r'_([a-z]+)(\d*)')), (5, re.compile(r'-r(\d+)')))


def _version_tokens(version):
    """apk-tools version tokens: digit, letter, suffix, suffix number, revision, end."""
    match = re.match(r'(\d+)', version)
    tokens, rest = [(1, int(match.group(1)))], version[match.end():]
    while rest:
        for kind, pattern in _TOKEN_PATTERNS:
            match = pattern.match(rest)
            if match:
                break
        else:
            raise ValueError('unparsable apk version %r' % version)
        rest = rest[match.end():]
        if kind == 3:
            tokens.append((3, SUFFIX_RANK[match.group(1)]))
            if match.group(2):
                tokens.append((4, int(match.group(2))))
        elif kind == 2:
            tokens.append((2, ord(match.group(1))))
        else:
            tokens.append((kind, int(match.group(1))))
    return tokens + [(6, 0)]


def apk_version_greater(a, b):
    """True when apk orders version a above b (apk_version_compare token rules)."""
    for (ka, va), (kb, vb) in zip(_version_tokens(a), _version_tokens(b)):
        if ka == kb:
            if va != vb:
                return va > vb
            if ka == 6:
                return False
            continue
        if ka == 3 and va < 0:
            return False
        if kb == 3 and vb < 0:
            return True
        return ka < kb
    return False


def _index_entries(path):
    with tarfile.open(ROOT / path) as tar:
        member = [item for item in tar.getmembers() if item.name.endswith('APKINDEX')][0]
        body = tar.extractfile(member).read().decode('utf-8', 'replace')
    entries = {}
    for chunk in body.split('\n\n'):
        fields = dict((line[0], line[2:]) for line in chunk.splitlines() if len(line) > 2 and line[1] == ':')
        if 'P' in fields and 'V' in fields:
            entry = {'name': fields['P'], 'version': fields['V'], 'id': fields['P'] + '-' + fields['V'],
                     'depends': fields.get('D', '').split(), 'provides': fields.get('p', '').split()}
            entries[entry['id']] = entry
    return entries


_MERGED = {}


def merged_index():
    """Both signed indexes the first runtime install reads, with every capability spelling indexed."""
    if not _MERGED:
        provenance = LOCK['uploadNativeProvenance']
        entries = _index_entries(provenance['retainedSignedIndex']['path'])
        entries.update(_index_entries(provenance['fixedPipIndex']['path']))
        providers = {}
        for entry in entries.values():
            keys = {entry['name']}
            for token in entry['provides']:
                key = token.split('=')[0]
                keys |= {key, key.replace('so-ver:', 'so:')}
            for key in keys:
                providers.setdefault(key, []).append(entry)
        _MERGED.update(entries=entries, providers=providers)
    return _MERGED['entries'], _MERGED['providers']


def first_runtime_install(dockerfile):
    runtime = dockerfile.split(' AS runtime\n', 1)[1].replace(chr(92) + '\n', ' ')
    return next(line for line in runtime.splitlines() if 'apk add ' in line)


def resolve_first_install(install):
    """Resolve the first runtime install as apk selects: requested pins, then already selected or installed
    providers, otherwise the newest advertised provider. Returns the new package ids and selection problems."""
    entries, providers = merged_index()
    base = LOCK['uploadNativeProvenance']['expatSecurityCorrection']['firstInstallBase']['packages']
    request = install.split(' apk add ', 1)[1].split(' && ', 1)[0]
    requested = ['%s-%s' % pair for pair in re.findall(r' ([A-Za-z0-9_.+-]+)=([A-Za-z0-9_.+-]+)', request)]
    problems = ['%s is in neither signed index' % package for package in base + requested if package not in entries]
    selected = {entries[package]['name']: entries[package] for package in base if package in entries}
    for package in requested:
        if package in entries:
            selected[entries[package]['name']] = entries[package]
    queue = [package for package in requested if package in entries]
    chosen = set(queue)
    while queue:
        for dependency in entries[queue.pop(0)]['depends']:
            if dependency.startswith('!'):
                continue
            name, _operator, exact = re.match(r'([^=<>~]+)([=<>~]*)(.*)', dependency).groups()
            candidates = [entry for entry in providers.get(name, [])
                          if not exact or entry['name'] != name or entry['version'] == exact]
            if any(selected.get(entry['name']) is entry for entry in candidates):
                continue
            if not candidates:
                problems.append('nothing provides %s' % dependency)
                continue
            # A package carrying the requested name is preferred over packages that only provide it.
            candidates = [entry for entry in candidates if entry['name'] == name] or candidates
            if len({entry['name'] for entry in candidates}) > 1:
                problems.append('ambiguous provider for %s: %s'
                                % (dependency, sorted({entry['name'] for entry in candidates})))
            best = candidates[0]
            for entry in candidates[1:]:
                if apk_version_greater(entry['version'], best['version']):
                    best = entry
            if best['name'] in selected:
                problems.append('%s needs %s but %s is selected'
                                % (dependency, best['id'], selected[best['name']]['id']))
                continue
            selected[best['name']] = best
            chosen.add(best['id'])
            queue.append(best['id'])
    return chosen - set(base), problems


def index_record(path, name, version):
    with tarfile.open(ROOT / path) as tar:
        member = [item for item in tar.getmembers() if item.name.endswith('APKINDEX')][0]
        body = tar.extractfile(member).read().decode('utf-8', 'replace')
    for chunk in body.split('\n\n'):
        fields = dict((line[0], line[2:]) for line in chunk.splitlines() if len(line) > 2 and line[1] == ':')
        if fields.get('P') == name and fields.get('V') == version:
            return fields
    return None


class ExpatSecurityFix(unittest.TestCase):
    def test_the_fixed_library_is_staged_and_advertised_by_the_second_signed_index(self):
        row = require_fixed_expat(LOCK)
        correction = LOCK['uploadNativeProvenance']['expatSecurityCorrection']
        self.assertEqual({k: correction['package'][k] for k in ('name', 'version', 'sha256', 'bytes')},
                         {k: row[k] for k in ('name', 'version', 'sha256', 'bytes')})
        filename = 'libexpat1-%s.apk' % row['version']
        self.assertIn((row['source'], '%s/aarch64/%s' % (PIP_REPO_DIR, filename)), STAGED_NAMES)
        self.assertIn('ADD --checksum=sha256:%s %s ' % (row['sha256'], row['source']), DOCKERFILE)
        record = index_record(LOCK['uploadNativeProvenance']['fixedPipIndex']['path'], 'libexpat1', row['version'])
        self.assertIsNotNone(record, 'the second signed index does not advertise the fixed libexpat1')
        self.assertEqual(int(record['S']), row['bytes'])
        self.assertEqual(record['C'], correction['package']['indexChecksum'])

    def test_the_vulnerable_revision_is_no_longer_staged_for_the_runtime_image(self):
        runtime = [dest for _src, dest in STAGED_NAMES
                   if dest.startswith((REPO_DIR + '/', PIP_REPO_DIR + '/')) and '/libexpat1-' in dest]
        self.assertEqual(runtime, ['%s/aarch64/libexpat1-2.10.0-r0.apk' % PIP_REPO_DIR])

    def test_the_first_runtime_install_names_the_fixed_library_and_the_staged_pins(self):
        install = first_runtime_install(DOCKERFILE)
        version = require_fixed_expat(LOCK)['version']
        self.assertIn(' libexpat1=%s ' % version, install)
        self.assertIn('apk info -v | grep -qx libexpat1-%s ' % version, install)
        # The refreshed index also advertises unstaged libbz2-1 1.0.8-r29 and ncurses 6.6.20261031-r0.
        for pin in ('libbz2-1=1.0.8-r28', 'ncurses=6.6.20261024-r0', 'ncurses-terminfo-base=6.6.20261024-r0'):
            self.assertIn(' %s ' % pin, install)

    def test_the_whole_first_install_closure_resolves_to_staged_archives(self):
        """Resolve every dependency, not only the requested names, against both signed indexes and the
        observed base. Without the pins apk selects newer unstaged revisions the refreshed index advertises
        and fails with 'package mentioned in index not found'."""
        staged = {dest.rsplit('/', 1)[-1][:-4] for _src, dest in STAGED_NAMES
                  if dest.startswith((REPO_DIR + '/', PIP_REPO_DIR + '/'))}
        install = first_runtime_install(DOCKERFILE)
        chosen, problems = resolve_first_install(install)
        self.assertEqual(problems, [])
        self.assertEqual(sorted(chosen - staged), [])
        # The cut 10 build installed exactly this set, with libexpat1 now at its fixed revision.
        self.assertEqual(sorted(chosen), sorted([
            'glibc-2.44-locale-posix-2.44-r10', 'glibc-2.44-2.44-r10', 'ld-linux-2.44-2.44-r10',
            'ncurses-terminfo-base-6.6.20261024-r0', 'ncurses-6.6.20261024-r0', 'bash-5.3-r14',
            'libcrypt1-2.44-2.44-r10', 'glibc-2.44-iconv-2.44-r10', 'libatomic-16.2.0-r1', 'libstdc++-16.2.0-r1',
            'libuuid-2.42.4-r1', 'py3-pip-wheel-26.2.2-r2', 'libbz2-1-1.0.8-r28', 'libexpat1-2.10.0-r0',
            'libffi-3.8.0-r2', 'gdbm-1.26-r9', 'xz-5.8.4-r0', 'mpdecimal-4.0.1-r6', 'readline-8.3-r3',
            'sqlite-libs-3.54.1-r0', 'python-3.13-base-3.13.18_git20261030-r0', 'py3.13-setuptools-84.2.1-r0',
            'py3.13-pip-base-26.2.2-r2', 'py3.13-pip-26.2.2-r2', 'python-3.13-3.13.18_git20261030-r0']))
        # Negative controls: dropping a pin selects the newer unstaged revision. ncurses requires its exact
        # terminfo-base revision, so the pair drifts together.
        for pins, drifted in (([' ncurses=6.6.20261024-r0', ' ncurses-terminfo-base=6.6.20261024-r0'],
                               {'ncurses-6.6.20261031-r0', 'ncurses-terminfo-base-6.6.20261031-r0'}),
                              ([' libbz2-1=1.0.8-r28'], {'libbz2-1-1.0.8-r29'}),
                              ([' libuuid=2.42.4-r1'], {'libuuid-2.42.4-r2'})):
            unpinned_install = install
            for pin in pins:
                self.assertIn(pin + ' ', unpinned_install)
                unpinned_install = unpinned_install.replace(pin + ' ', ' ')
            unpinned, _ = resolve_first_install(unpinned_install)
            self.assertEqual(drifted - (unpinned - staged), set(), 'removing %s was not detected' % pins)

    def test_apk_version_order(self):
        self.assertTrue(apk_version_greater('6.6.20261031-r0', '6.6.20261024-r0'))
        self.assertTrue(apk_version_greater('6.6.20260418-r0', '6.6_p20251230-r7'))
        self.assertTrue(apk_version_greater('2.10.0-r0', '2.9.0-r1'))
        self.assertTrue(apk_version_greater('1.3.2.1-r0', '1.3.2.1_rc20260921-r1'))
        self.assertTrue(apk_version_greater('3.13.18_git20261030-r0', '3.13.18-r0'))
        self.assertFalse(apk_version_greater('1.0.8-r28', '1.0.8-r28'))

    def test_the_failed_version_is_rejected(self):
        old = copy.deepcopy(LOCK)
        for p in old['systemPackages']:
            if p['name'] == 'libexpat1':
                p['version'] = '2.9.0-r0'
        with self.assertRaisesRegex(AssertionError, 'CVE-2026-113351'):
            require_fixed_expat(old)


if __name__ == '__main__':
    unittest.main()
