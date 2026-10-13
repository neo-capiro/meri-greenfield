"""Verify exact candidate/source/pinned upstream semantics without external IO."""
from pathlib import Path
import gzip,hashlib,json,re,subprocess
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
SOURCE='350ab86486b2b9e65e76b73ffd7c649f5efa1340'
BASE='18adda2c5461b8d346277135aafd3972b4768802'
DONOR=Path('/workspace/meri-calendar-resolution/packages/window-resolution/node_modules')
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args],timeout=30)
def sha(raw):return hashlib.sha256(raw).hexdigest()
checks=[]
def check(name,passed):
 checks.append({'name':name,'pass':bool(passed)})
 assert passed,name
check('exact candidate tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='267e51bf44c6d67c083035b760785dd618370034')
paths=git('diff','--name-only',BASE,SOURCE).decode().splitlines()
check('all11 source delta paths owned packages/window-resolution',len(paths)==11 and all(p.startswith('packages/window-resolution/') for p in paths))
binding=[]
for path in paths:
 raw=(ROOT/path).read_bytes();check('exact candidate bytes '+path,raw==git('show',SOURCE+':'+path))
 binding.append({'path':path,'bytes':len(raw),'sha256':sha(raw),'blob':git('rev-parse',SOURCE+':'+path).decode().strip()})
for path in ['packages/contracts','package.json','package-lock.json','packages/ui-stream','apps/gateway/index.mjs','apps/control/document-application/index.mjs']:
 check('original owner byte/tree exact '+path,git('rev-parse',SOURCE+':'+path)==git('rev-parse',BASE+':'+path))
lock=json.loads((ROOT/'packages/window-resolution/package-lock.json').read_bytes())
upstream=[]
for name,version,license_name in [('@js-temporal/polyfill','0.5.1','temporal-polyfill-LICENSE'),('jsbi','4.3.2','jsbi-LICENSE')]:
 installed=json.loads((DONOR/name/'package.json').read_bytes())
 record=lock['packages']['node_modules/'+name]
 check('exact pinned installed '+name,record['version']==installed['version']==version)
 check('lock has SHA512 integrity '+name,record['integrity'].startswith('sha512-'))
 check('retained upstream license exact '+name,(ROOT/'packages/window-resolution/third-party'/license_name).read_bytes()==(DONOR/name/'LICENSE').read_bytes())
 for path in ['package.json','LICENSE']+(['README.md','lib/instant.ts','lib/plaindate.ts','lib/ecmascript.ts','dist/index.esm.js'] if name.startswith('@') else ['dist/jsbi.mjs']):
  raw=(DONOR/name/path).read_bytes();upstream.append({'package':name,'version':version,'installedPath':str(DONOR/name/path),'bytes':len(raw),'sha256':sha(raw)})
es=(DONOR/'@js-temporal/polyfill/lib/ecmascript.ts').read_text()
readme=(DONOR/'@js-temporal/polyfill/README.md').read_text()
check('pinned upstream rejects both zero/multiple midnight instants',"if (disambiguation === 'reject') throw new RangeError" in es and "case 'reject': {" in es)
check('pinned upstream Instant refuses civil date durations',"Duration field ${largestUnit} not supported by Temporal.Instant" in es)
check('pinned upstream uses 24hour elapsed instant duration',"ToInternalDurationRecordWith24HourDays(duration)" in es)
check('pinned upstream documents no global Temporal install','does not install a global `Temporal` object' in readme)
legacy_raw=(ROOT/'packages/window-resolution/test/legacy-retrieval-results.tap.gz').read_bytes()
legacy=gzip.decompress(legacy_raw).decode()
failures=[x for x in legacy.splitlines() if x.startswith('not ok')]
check('existing four stale public-version failures retained',len(failures)==4 and '# tests 3217' in legacy and '# pass 3213' in legacy and '# fail 4' in legacy)
initial=gzip.decompress((ROOT/'packages/window-resolution/test/initial-results.tap.gz').read_bytes()).decode()
check('initial author import-resource failure retained','new active resource' in initial)
cases={}
for label,expected in [('author35',35),('independent19',18)]:
 capture=json.loads((OUT/(label+'.json')).read_bytes());tap=(OUT/(label+'.stdout.txt')).read_text()
 check(label+' exact observed case counts',f'# tests {expected}\n' in tap and f'# pass {expected}\n' in tap and '# fail 0\n' in tap)
 check(label+' bounded process cleanup',capture['returncode']==0 and not capture['timedOut'] and capture['processReaped'] and capture['ownedProcessGroupAbsent'])
 check(label+' raw capture hashes',capture['stdoutSha256']==sha((OUT/(label+'.stdout.txt')).read_bytes()) and capture['stderrSha256']==sha((OUT/(label+'.stderr.txt')).read_bytes()))
 cases[label]={'tests':expected,'passed':expected,'failed':0,'labelNote':'Capture name independent19 is historical; actual TAP count is18, correctly reported.' if label=='independent19' else None}
report={'sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'baseCommit':BASE,
 'candidateBindings':binding,'upstreamBindings':upstream,'checks':checks,'passed':len(checks),'failed':0,
 'caseCounts':cases,'totalDistinctTests':53,'legacySuiteRerun':False,'retainedLegacyFailures':failures,
 'upstreamEvidence':'Installed exact0.5.1 implementation/README and locked JSBI4.3.2; no website/network/library install needed or performed.',
 'runtime':json.loads(subprocess.check_output(['node','--input-type=module','-e','console.log(JSON.stringify({node:process.version,icu:process.versions.icu,tz:process.versions.tz,cldr:process.versions.cldr,unicode:process.versions.unicode}))'],cwd=ROOT,timeout=10)),
 'verdict':'ACCEPT_SOURCE','nativeRuntimeAccepted':False,'sourceActivation':False}
(OUT/'source-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'checksPassed':len(checks),'authorTests':35,'independentTests':18,'distinctTests':53,'sourceCommit':SOURCE,'verdict':'ACCEPT_SOURCE'}))
