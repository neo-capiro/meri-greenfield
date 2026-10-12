"""Offline identity/field metadata only. Never saves private source bodies."""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO='/workspace/capirov2'
PINS={'frozen':'fd8765ec01d292013758606204f2c9d886cd31c1','observed':'4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'}
REFS={
'apps/api/src/meri/meri-tools.service.ts':'2504-2566;4778-4859;5027-5233;5252-5257;8525-8604;10030-10048;10285-10289',
'apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts':'29-87',
'apps/intel-api/src/tracker/keywords/internal-workflow.controller.ts':'21-30',
'apps/intel-api/src/tracker/editorial/evidence.service.ts':'31-325;363-399',
'apps/intel-api/src/tracker/research/research.service.ts':'28-205;228-482',
'apps/intel-api/src/tracker/reports/report.service.ts':'41-45',
'apps/api/prisma/migrations/20280914030000_legiwatch_news_fiscal/migration.sql':'2-66',
'apps/api/prisma/migrations/20280913030000_legiwatch_research_evidence/migration.sql':'7-81',
'apps/intel-api/prisma/migrations/20260914030000_legiwatch_news_editorial/migration.sql':'1-7;19-24;46-58',
'apps/intel-api/src/tracker/editorial/publisher-coverage.ts':'1-172',
'packages/shared/src/legiwatch-query.ts':'1-28;138-220',
'packages/shared/src/legiwatch-phase8.ts':'1-108',
'packages/shared/src/legislative-research.ts':'243-274',
'apps/intel-api/src/tracker/folders/folder-tracker.service.ts':'82-113',
'packages/shared/src/funding-opportunities-v2.ts':'151-176',
'apps/api/src/funding-opportunities/funding-opportunity-v2-search.service.ts':'251-265',
'apps/api/src/program-element/program-element-read.service.ts':'60-144;218-320;450-547;950-1318;2850-2896',
'apps/api/src/meri/meri-defense-budget-tool.helpers.ts':'27-208',
'packages/shared/src/funding-claim.ts':'16-117',
'packages/shared/src/index.ts':'2435-2506',
'apps/api/src/common/meri-evidence-accuracy-flags.ts':'1-32',
'apps/api/src/program-element/budget-line-lineage.ts':'1-51',
'apps/api/src/program-element/models/conference-probability.service.ts':'1-85;192-248',
'apps/api/src/funding-opportunities/meri-opportunity-tools.adapter.ts':'35-85;190;205-250',
'packages/shared/src/schedule/deadline.ts':'1-73',
'apps/api/prisma/schema.prisma':'ProgramElement;ProgramElementYear;ProgramElementMilestone;SamOpportunity',
'apps/api/src/meri/analytics/query-spec-compiler.ts':'1-456',
'apps/api/src/meri/analytics/analytics-db.service.ts':'1-124',
'apps/api/src/meri/analytics/global-dataset-registry.ts':'23-75;331-347 (previous accepted dataset metadata dependency)',
'apps/api/src/funding-opportunities/meri-sam-source-freshness.spec.ts':'1-39 inspected assertions, not executed',
'apps/api/src/meri/analytics/analytics-db.service.spec.ts':'4-29 inspected assertions;31-83 test-name inventory, not executed',
'apps/api/src/meri/analytics/query-spec-compiler.spec.ts':'test-name inventory only, not executed',
'apps/api/src/meri/meri-defense-budget-tool.helpers.spec.ts':'test-name inventory only, not executed',
'apps/intel-api/src/tracker/editorial/publisher-coverage.spec.ts':'test-name inventory only, not executed',
'apps/intel-api/src/tracker/research/research-domain.spec.ts':'test-name inventory only, not executed',
}
def git(*args):return subprocess.check_output(['git','-C',REPO,*args])
def content(pin,path):return git('show',f'{pin}:{path}')
refs=[]
for path,locators in REFS.items():
 row={'path':path,'locators':locators}
 for label,pin in PINS.items():
  raw=content(pin,path);row[label]={'commit':pin,'blob':git('rev-parse',f'{pin}:{path}').decode().strip(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 row['changed']=row['frozen']['blob']!=row['observed']['blob'];refs.append(row)
(ROOT/'reference-identities.json').write_text(json.dumps({'scope':'Metadata identities only; no private source bodies','references':refs},indent=2)+'\n')
s=content(PINS['frozen'],'apps/api/prisma/schema.prisma').decode()
models={}
for name in ['ProgramElement','ProgramElementYear','ProgramElementMilestone','SamOpportunity']:
 match=re.search(r'^model '+name+r' \{(.*?)^\}',s,re.M|re.S);rows=[]
 for line in match[1].splitlines():
  words=line.strip().split()
  if len(words)<2 or words[1].rstrip('?[]') not in ['String','Int','Decimal','DateTime','Float','Boolean','Json']:continue
  native=re.search(r'@db\.(\w+)(?:\(([^)]*)\))?',line)
  rows.append({'field':words[0],'type':words[1].rstrip('?[]'),'nullable':'?' in words[1],'nativeType':native.group(0)[4:] if native else None})
 models[name]={'startLine':s[:match.start()].count('\n')+1,'fields':rows}
(ROOT/'scalar-inventory.json').write_text(json.dumps({'source':'apps/api/prisma/schema.prisma','pin':PINS['frozen'],'interpretation':'Stored scalar metadata; projections select/spread different subsets; Decimal wire adaptation remains explicit. No model relation bodies retained.','models':models},indent=2)+'\n')
print(json.dumps({'references':len(refs),'drift':[x['path'] for x in refs if x['changed']],'models':len(models),'scalarFields':sum(len(x['fields']) for x in models.values())}))

# Derived DDL column vocabulary only; no query or constraint bodies are retained.
tables={}
for path in REFS:
 if not path.endswith('/migration.sql'):continue
 raw=content(PINS['frozen'],path).decode()
 for m in re.finditer(r'CREATE TABLE (\w+) \((.*?)\);',raw,re.S):
  name,body=m.groups()
  if name not in {'legiwatch_news_observation','legiwatch_source_coverage','florida_budget_document','florida_budget_project','florida_budget_amount','florida_budget_event','florida_personnel_observation','intel_legiwatch_news_monitor','legal_reference','legal_text_revision','rule_notice_revision','legislative_legal_occurrence'}:continue
  columns=[]
  for part in re.split(r',(?=[A-Za-z_\s])',body):
   c=re.match(r'\s*(\w+)\s+(text|integer|boolean|jsonb|timestamptz|bytea|date)\b(.*)',part,re.S|re.I)
   if c:columns.append({'field':c[1],'type':c[2].lower(),'nullable':not bool(re.search(r'NOT NULL|PRIMARY KEY',c[3]))})
  tables[name]={'source':path,'startLine':raw[:m.start()].count('\n')+1,'columns':columns}
(ROOT/'ddl-field-inventory.json').write_text(json.dumps({'tables':tables,'limits':['Pinned CREATE TABLE column metadata; targeted read-only git grep found no explicit ALTER TABLE for these12 names in API/Intel migrations (exit1 no matches). This static search is not proof of deployed schema or absence of dynamically generated migration changes.','News source view adds is_current:boolean. Source view never implies all revisions are current.','Computed saved boolean and tracking_version nullable integer are added by query projection.','Legal reference LEFT JOIN makes every selected revision field nullable even if stored NOT NULL.']},indent=2)+'\n')
print(json.dumps({'ddlTables':len(tables),'ddlColumns':sum(len(x['columns']) for x in tables.values())}))
