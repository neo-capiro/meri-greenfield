"""Read-only Git, JSON, OOXML and PNG receipt audit. Never starts Office or imports app code."""
import hashlib,io,json,os,pathlib,struct,subprocess,zipfile,xml.etree.ElementTree as E
R=pathlib.Path(__file__).resolve().parents[5];H=pathlib.Path(__file__).parent
BASE='5bff1c5e58c1f766661f3710641202b36c4d7d9b';SOURCE='fd993f5105deda49a88973b42906df3e928ac829';PACKET='abe90a62fd8b1af1d31b49ab6c39809b5259f9b7'
P='docs/qualification/candidates/workbook-drafting-20261013/integration/';checks=[];identities=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def blob(ref,p):return git('show',ref+':'+p)
def sha(b):return hashlib.sha256(b).hexdigest()
def check(n,v):checks.append({'name':n,'pass':bool(v)});assert v,n
def read(p):
 b=(R/p).read_bytes();check('exact packet bytes '+p,b==blob(PACKET,p));identities.append({'path':p,'bytes':len(b),'sha256':sha(b)});return b
def j(p):return json.loads(read(p))
def tree(ref):return {p.decode():m.decode().split()[2] for x in git('ls-tree','-r','-z',ref).split(b'\0') if x for m,p in [x.split(b'\t',1)]}
baseline,source,packet=tree(BASE),tree(SOURCE),tree(PACKET)
paths=[p for p in source if p.startswith('apps/control/document-application/local/workbook/') or p.startswith('scripts/local-workbook/')]
sourceIdentities=[]
for p in paths:
 b=blob(SOURCE,p);sourceIdentities.append({'path':p,'bytes':len(b),'sha256':sha(b)});check('reviewed flow unchanged '+p,baseline.get(p)==source[p]==packet[p])
check('source unchanged after final capture',not git('diff',SOURCE,PACKET,'--','apps','packages','scripts'))
check('preserved all earlier integration evidence',all(packet.get(p)==h for p,h in baseline.items() if p.startswith(P)))
check('accepted Office source exact',blob(SOURCE,'apps/artifacts/office-transform.mjs')==blob('1c3cfb9c97681415286236edd21a829e51b565eb','apps/artifacts/office-transform.mjs'))
check('accepted column owner exact',blob(SOURCE,'apps/artifacts/python/office.py')==blob('07d9db0b988a8ff3f04ee3acc21951e5967dea81','apps/artifacts/python/office.py'))
for label,exitcode in [('initial-workbook',1),('recalculated-workbook',1),('readable-workbook',0),('workbook-cli',0)]:
 receipt=j(P+label+'.json');check(label+' capture bounded/closed',receipt['exitCode']==exitcode and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'] and receipt['sourceDiffBytes']==0)
 for x in receipt['streams']:
  b=read(x['path']);check(label+' raw hash',len(b)==x['bytes'] and sha(b)==x['sha256'])
 if label=='readable-workbook':final=receipt
check('final capture exact source',final['sourceHead']==SOURCE and final['durationSeconds']==46.366)
run=json.loads((R/(P+'readable-workbook.stdout.bin')).read_bytes());v=run['result']['versions'];check('typed local outcome',run['status']=='PASS' and run['mode']=='synthetic-local' and not run['nativeDatabase'] and not run['nativeQualified'] and not run['productionActivated'])
check('distinct immutable parented versions',len(v)==2 and v[0]['parentVersionId'] is None and v[1]['parentVersionId']==v[0]['versionId'] and v[1]['artifactId']==v[0]['artifactId'] and v[1]['versionId']!=v[0]['versionId'])
check('draft and pending retained',all(x['generationStatus']=='draft' and x['previewStatus']=='pending' for x in v))
check('cleanup final not intermediate stats',not run['cleanup']['failed'] and run['cleanup']['http']=={'closed':True,'listening':False,'activeSockets':0} and all(x['closed'] and x['cleanup']=={'executorDirectoriesAbsent':True,'storeRemoved':True} for x in run['cleanup']['fixtures']))
f=run['cleanup']['fixtures'];check('two real generations and isolated zero effects',f[0]['generations']==f[0]['settled']==f[0]['versionCharges']==2 and f[0]['unknown']==0 and f[0]['consumedMicroUsd']=='20' and f[1]['generations']==0 and f[1]['consumedMicroUsd']=='0')
check('explicit revocation and replay refusal',f[0]['revoked'] and run['result']['replayStatus']!=200)
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def cells(raw,sheet):
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():shared=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
  out={}
  for c in E.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).findall('.//s:c',ns):
   rawv=c.find('s:v',ns);text=None if rawv is None else rawv.text;kind=c.get('t');formula=c.find('s:f',ns)
   value=shared[int(text)] if kind=='s' else ''.join(c.find('s:is',ns).itertext()) if kind=='inlineStr' else text
   out[c.get('r')]={'kind':kind,'value':value,'formula':None if formula is None else formula.text}
  return out
processes=[]
for index,label in enumerate(['original','revision']):
 prefix=P+'readable-artifacts/'+label;raw=read(prefix+'.xlsx');trans=read(prefix+'-recalculated.xlsx');recalc=j(prefix+'-recalculation.json');visual=j(prefix+'-visual.json');pdf=read(prefix+'-preview.pdf')
 check(label+' source matches immutable version',sha(raw)==v[index]['object']['sha256'] and len(raw)==v[index]['object']['bytes'])
 check(label+' transform hashes exact',recalc['sourceSha256']==sha(raw) and recalc['receipt']['inputSha256']==sha(raw) and recalc['receipt']['outputSha256']==sha(trans) and recalc['inspection']['sha256']==sha(trans))
 check(label+' original is not recalculated replacement',raw!=trans and not recalc['receipt']['nativeQualification'] and recalc['receipt']['formulaEquivalence']=='unqualified')
 a,b,n=cells(raw,1),cells(trans,1),cells(trans,2);check(label+' XML editable hours and formulas',a['B2']['value']==str(10 if index==0 else 12) and a['D2']['formula']=='B2*C2' and a['D4']['formula']=='SUM(D2:D3)' and b['D4']['formula']=='SUM(D2:D3)')
 check(label+' XML recalculated totals',float(b['D4']['value'])==(2050 if index==0 else 2300))
 check(label+' literal formula text survives',n['A2']['value']=='=1+1' and n['A2']['formula'] is None and n['A2']['kind'] in ['s','inlineStr'])
 check(label+' PDF and page metadata',pdf.startswith(b'%PDF-') and len(pdf)==visual['visual']['bytes'] and sha(pdf)==visual['visual']['sha256'] and len(visual['visual']['pages'])==2)
 for page in visual['visual']['pages']:
  png=read(prefix+'-preview-'+str(page['page'])+'.png');check(label+' PNG '+str(page['page']),png[:8]==b'\x89PNG\r\n\x1a\n' and sha(png)==page['sha256'] and len(png)==page['bytes'] and struct.unpack('>II',png[16:24])==(page['width'],page['height']))
 text='\n'.join(p['text'] for p in visual['visual']['pages']);check(label+' retained text labels and value',all(x in text for x in ['Workstream','Documentation','Research','Total','=1+1',('2,050.00' if index==0 else '2,300.00')]))
 if index:check('revision note exact','Research hours revised from 10 to 12' in text)
 check(label+' final flow copy correlation',run['result']['copies'][index]['sourceSha256']==sha(raw) and run['result']['copies'][index]['visual']==visual['visual'])
 processes+=visual['processes']
processes+=run['result']['inspectionProcesses']+f[0]['processReceipts']
check('twelve settled actual process receipts',len(processes)==12 and all(p['exitCode']==0 and p['groupAbsent'] and p['leaderClosed'] and p['stdoutEnded'] and p['stderrEnded'] and not p['streamErrors'] and not p['sandboxQualified'] for p in processes))
observed=[]
for pid in sorted({p['pid'] for p in processes}|{final['ownedPidAndPgid'],json.loads((H/'source-checks.json').read_text())['ownedPidAndPgid']}):
 absent=False
 try:os.killpg(pid,0)
 except ProcessLookupError:absent=True
 check('owned recorded process group absent '+str(pid),absent);observed.append(pid)
check('initial cache failure remains', '0 !== 2050' in json.loads((R/(P+'initial-workbook.stdout.bin')).read_bytes())['failure']['message'])
check('intermediate clipping failure remains','Documentation' in json.loads((R/(P+'recalculated-workbook.stdout.bin')).read_bytes())['failure']['message'])
result={'verdict':'ACCEPT_SOURCE','source':SOURCE,'rootEvidence':PACKET,'checks':checks,'passed':len(checks),'failed':0,'sourceIdentities':sourceIdentities,'evidenceIdentities':identities,'freshAbsentGroups':observed,'visualReview':{'pagesViewed':['original-preview-1.png','original-preview-2.png','revision-preview-1.png','revision-preview-2.png'],'finding':'Full headers and Documentation visible; no observed clipping/overlap in these four fixed pages. Hours10→12, totals2050→2300 and literal=1+1/revision note are readable.','scope':'Fixed retained synthetic previews only; not arbitrary workbook or runtime qualification.'}}
(H/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0,'groupsAbsent':len(observed)}))
