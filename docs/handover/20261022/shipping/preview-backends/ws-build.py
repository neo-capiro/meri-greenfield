"""Start the capiro-preview-workspace image build for a new pinned source archive by re-rendering the buildspec
of the build that produced the serving ca4de503 image (only the four source pins change)."""
import json, subprocess
AWS = ['aws', '--profile', 'capiro-dev', '--region', 'us-east-1', '--output', 'json']
run = lambda *a: json.loads(subprocess.run(AWS + list(a), check=True, capture_output=True, text=True).stdout)
sha, digest, version = open('ws-build-source.txt').read().split()
spec = run('codebuild', 'batch-get-builds', '--ids', 'capiro-preview-workspace:d04ab98c-119a-44f2-a55f-c1d520aa7db1')['builds'][0]['source']['buildspec']
old = {'SOURCE_SHA': 'ca4de503fb6ec09caf0daf8b976a0f649c6b9665',
       'SOURCE_KEY': 'inputs/core-ca4de503fb6ec09caf0daf8b976a0f649c6b9665-lf.zip',
       'SOURCE_VERSION_ID': 'jjSSiIkKfoZiEGLY4DjUfzZNIrYEX.wc',
       'ARCHIVE_SHA256': '95208dbbffaed4bf3894d861601747764a6105a4f27211158e095e49423e796f'}
new = {'SOURCE_SHA': sha, 'SOURCE_KEY': f'inputs/core-{sha}-lf.zip', 'SOURCE_VERSION_ID': version, 'ARCHIVE_SHA256': digest}
for k in old:
    line = f'{k}={old[k]}'
    assert spec.count(line) == 1, k
    spec = spec.replace(line, f'{k}={new[k]}')
spec = spec.replace('placeholders are workspace', f'source {sha[:8]}; placeholders are workspace')
open('ws-buildspec.yml', 'w', newline='\n').write(spec)
b = run('codebuild', 'start-build', '--project-name', 'capiro-preview-workspace', '--buildspec-override', spec)['build']
print(b['id'], b['buildStatus'])
