"""Prove reviewed literal/allowlist edits invert to all original test bytes."""
import difflib
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[5]
BASE='a3e946c1fa264ae7b33205f5b87804ee1ef75773'
TARGET=sys.argv[1]
IDS=['get_committee_roster','list_members','get_pe_contractors','get_pe_bills','get_pe_report_language','get_state_rule_status','get_certification_status','search_intel_articles','list_global_datasets','get_representation']
TAIL=', '+', '.join(json.dumps(x) for x in IDS)
PREFIX='// Explicit subsequent reviewed mappings; prior descriptors and original assertions are preserved.\nconst referenceIds = '+json.dumps(IDS)+';\n'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def undo_changed(line):
    line=line.replace(TAIL+'];','];')
    line=line.replace('&&!referenceIds.includes(row.operation.id)','').replace('&&!referenceIds.includes(x.operation.id)','')
    for name in ['additions','ids']:
        line=line.replace(f'({name}.includes(old.id)||referenceIds.includes(old.id))',f'{name}.includes(old.id)')
    line=re.sub(r'(\.length,\s*)56(?=\))',r'\g<1>46',line)
    line=re.sub(r'(\.size,\s*)56(?=\))',r'\g<1>46',line)
    line=re.sub(r'(\.length,\s*)55(?=\))',r'\g<1>45',line)
    line=re.sub(r'(\.length,\s*)41(?=\))',r'\g<1>51',line)
    line=line.replace("catalog.catalogVersion,'0.2.7'", "catalog.catalogVersion,'0.2.6'")
    if line.lstrip().startswith('test('):line=line.replace('all56','all46').replace('all 56','all 46')
    return line
paths=[p for p in git('diff','--name-only','--diff-filter=M',BASE,TARGET).decode().splitlines() if p.endswith('.test.mjs')]
checks=[]
for p in paths:
    before=git('show',BASE+':'+p).decode();after=git('show',TARGET+':'+p).decode()
    candidate=after.removeprefix(PREFIX);old_lines=before.splitlines(keepends=True);new_lines=candidate.splitlines(keepends=True);restored=[]
    for kind,a,b,c,d in difflib.SequenceMatcher(a=old_lines,b=new_lines,autojunk=False).get_opcodes():
        if kind=='equal':restored.extend(new_lines[c:d])
        else:restored.extend(undo_changed(line) for line in new_lines[c:d])
    checks.append({'path':p,'pass':''.join(restored)==before,'beforeSha256':hashlib.sha256(before.encode()).hexdigest(),'afterSha256':hashlib.sha256(after.encode()).hexdigest(),'scope':'Only specified10-ID allowlists, cardinalities46/45/51→56/55/41, catalog0.2.6→0.2.7 and corresponding test labels invert; all other bytes exact.'})
print(json.dumps({'source':TARGET,'base':BASE,'checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks)},indent=2))
raise SystemExit(0 if all(x['pass'] for x in checks) and len(checks)==15 else 1)
