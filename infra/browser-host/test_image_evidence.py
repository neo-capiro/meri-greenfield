import importlib.util
import json
import pathlib
import itertools
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('image_evidence', pathlib.Path(__file__).with_name('image-evidence.py'))
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)

H1, H2, H3 = 'a' * 64, 'b' * 64, 'c' * 64
COMMIT = 'd' * 40
DIGEST = 'sha256:' + 'e' * 64
CHROME = '/opt/meri/browsers/chromium-1247/chrome-linux/chrome'


class Case(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = pathlib.Path(self.tmp.name)
        self.counter = itertools.count()

    def write(self, name, text):
        path = self.dir / name
        path.write_text(text, encoding='utf-8')
        return str(path)

    def files(self, **over):
        helper = over.get('helper', f'{H1}  {ev.LAUNCHER}\n{H2}  {ev.RELAY_LAUNCHER}\n{H3}  {ev.BOOTSTRAP}\n')
        return dict(
            helper=self.write('helper.txt', helper),
            rehash=self.write('rehash.txt', over.get('rehash', helper)),
            chromium=self.write('chromium.txt', over.get('chromium', f'{"f" * 64}  {CHROME}\n')),
            packages=self.write('packages.txt', over.get('packages', 'libnss3=2:3.110-1\nca-certificates=20250419\n')),
            node=self.write('node.txt', over.get('node', 'v24.22.1\n')),
            playwright=self.write('pw.txt', over.get('playwright', '0.0.83 1.64.0-alpha-1790635538000\n')),
            out=str(self.dir / ('out-%d.json' % next(self.counter))),
        )

    def run_hashes(self, **over):
        files = self.files(**over)
        argv = ['hashes']
        for key, value in files.items():
            argv += ['--' + key, value]
        ev.main(argv)
        return json.loads(pathlib.Path(files['out']).read_text())

    def inspect_json(self, **over):
        image = {'Id': DIGEST, 'Os': 'linux', 'Architecture': 'arm64', 'Size': 1_500_000_000,
                 'Config': {'User': '', 'Entrypoint': list(ev.ENTRYPOINT), 'Cmd': None,
                            'Env': ['PLAYWRIGHT_BROWSERS_PATH=/opt/meri/browsers'],
                            'Labels': {'org.opencontainers.image.revision': COMMIT}}}
        for key, value in over.items():
            if key == 'Config':
                image['Config'].update(value)
            else:
                image[key] = value
        return self.write('inspect.json', json.dumps([image]))

    def test_hashes_become_the_three_deployment_pins(self):
        out = self.run_hashes()
        self.assertEqual((out['helperSha256'], out['nativeHostRelayHelperSha256'], out['programSha256']), (H1, H2, H3))
        self.assertEqual(out['chromiumFiles'], [{'path': CHROME, 'sha256': 'f' * 64}])
        self.assertEqual(out['osPackageCount'], 2)

    def test_hashes_refuse_drift_and_shape(self):
        two = f'{H1}  {ev.LAUNCHER}\n{H2}  {ev.RELAY_LAUNCHER}\n'
        same = f'{H1}  {ev.LAUNCHER}\n{H1}  {ev.RELAY_LAUNCHER}\n{H3}  {ev.BOOTSTRAP}\n'
        drift = f'{H1}  {ev.LAUNCHER}\n{H2}  {ev.RELAY_LAUNCHER}\n{"0" * 64}  {ev.BOOTSTRAP}\n'
        cases = ({'helper': two, 'rehash': two}, {'helper': same, 'rehash': same}, {'rehash': drift}, {'node': 'v24.0.0\n'},
                 {'playwright': '0.0.84 1.64.0-alpha-1790635538000\n'}, {'packages': ''}, {'packages': 'bad line\n'},
                 {'chromium': f'{"f" * 64}  /opt/meri/browsers/other\n'}, {'helper': 'nonsense\n'})
        for over in cases:
            with self.assertRaises((AssertionError, ValueError)):
                self.run_hashes(**over)

    def test_inspect_accepts_the_arm64_root_host_image_only(self):
        self.assertEqual(ev.inspect_image(self.inspect_json(), COMMIT), DIGEST)
        cases = ({'Architecture': 'amd64'}, {'Os': 'windows'}, {'Size': 5 * 1024 ** 3}, {'Config': {'User': '1000:1000'}},
                 {'Config': {'Entrypoint': ['node']}}, {'Config': {'Cmd': ['x']}},
                 {'Config': {'Labels': {'org.opencontainers.image.revision': 'f' * 40}}}, {'Config': {'Env': []}})
        for over in cases:
            with self.assertRaises(AssertionError):
                ev.inspect_image(self.inspect_json(**over), COMMIT)

    def test_chromium_path_is_exactly_one_chrome(self):
        self.assertEqual(ev.chromium_path(self.files()['chromium']), CHROME)
        two = f'{H1}  {CHROME}\n{H2}  /opt/meri/browsers/chromium-1247/other/chrome\n'
        with self.assertRaises(AssertionError):
            ev.chromium_path(self.write('two.txt', two))
        # The headless shell a headless launch runs is recorded beside it and becomes a pinned file too.
        shell = '/opt/meri/browsers/chromium_headless_shell-1247/chrome-headless-shell-linux-arm64/chrome-headless-shell'
        both = f'{H1}  {CHROME}\n{H2}  {shell}\n'
        self.assertEqual(ev.chromium_path(self.write('both.txt', both)), CHROME)
        self.assertEqual(self.run_hashes(chromium=both)['chromiumFiles'],
                         [{'path': CHROME, 'sha256': H1}, {'path': shell, 'sha256': H2}])

    def scan(self, counts, findings=(), status='COMPLETE'):
        return self.write('scan.json', json.dumps({'repositoryName': 'meri-greenfield/browser-host', 'imageId': {'imageDigest': DIGEST},
            'imageScanStatus': {'status': status}, 'imageScanFindings': {'findingSeverityCounts': counts, 'findings': list(findings)}}))

    def run_result(self, scan):
        files = self.files()
        argv = ['hashes']
        for key, value in files.items():
            argv += ['--' + key, value]
        ev.main(argv)
        out = self.dir / 'result.json'
        if out.exists():
            out.unlink()
        ev.main(['result', '--scan', scan, '--hashes', files['out'], '--digest', DIGEST, '--repository', 'meri-greenfield/browser-host',
                 '--commit', COMMIT, '--source-version', 'v1', '--image-id', DIGEST, '--out', str(out)])
        return json.loads(out.read_text())

    def test_result_requires_zero_high_and_critical_and_records_the_rest(self):
        body = self.run_result(self.scan({'MEDIUM': 1}, [{'name': 'CVE-2026-0001', 'severity': 'MEDIUM'}]))
        self.assertEqual(body['findingSeverityCounts'], {'MEDIUM': 1})
        self.assertEqual(body['otherFindingsForDecisionRecord'], [{'name': 'CVE-2026-0001', 'severity': 'MEDIUM'}])
        self.assertEqual(body['hashes']['programSha256'], H3)
        for scan in (self.scan({'HIGH': 1}), self.scan({'CRITICAL': 2}), self.scan({}, status='FAILED')):
            with self.assertRaises(AssertionError):
                self.run_result(scan)

    def test_digest_needs_the_tag_and_a_sha256_digest(self):
        good = self.write('good.json', json.dumps({'imageDetails': [{'imageTags': ['t'], 'imageDigest': DIGEST}]}))
        self.assertEqual(ev.described_digest(good, 't'), DIGEST)
        for rows in ([], [{'imageTags': ['other'], 'imageDigest': DIGEST}], [{'imageTags': ['t'], 'imageDigest': 'sha1:x'}]):
            with self.assertRaises(AssertionError):
                ev.described_digest(self.write('bad.json', json.dumps({'imageDetails': rows})), 't')


if __name__ == '__main__':
    unittest.main()
