import subprocess,json,hashlib,pathlib,re
root=pathlib.Path('/workspace/meri-research-evidence-scope-20261012'); out=root/'docs/qualification/candidates/backend-execution-20261012/research-evidence-scope'; cap=pathlib.Path('/workspace/capirov2')
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
refs={'frozen':'fd8765ec01d292013758606204f2c9d886cd31c1','observed':'4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'}
files={
'packages/shared/src/research-portfolios.ts':'51-98;372-445;721-806',
'apps/api/prisma/schema.prisma':'ResearchPortfolio* models;15231-15260;15575-15661;15937-15970;16284ff',
'apps/api/src/research-portfolios/research-portfolio-access.ts':'14-59',
'apps/api/src/research-portfolios/research-portfolio-meri-scope.service.ts':'64-113;115-165',
'apps/api/src/research-portfolios/research-portfolio-meri-tools.service.ts':'69-116;145-165;220-234',
'apps/api/src/research-portfolios/research-portfolios.service.ts':'member/detail DTO projections and current access policy',
'apps/api/src/research-portfolios/research-portfolios.controller.ts':'118-129;185-221;review/annual route metadata',
'apps/api/src/research-portfolios/research-portfolio-review.service.ts':'69-107;662-669;770-868;1147-1338;1519-1547;1818-1841',
'apps/api/src/research-portfolios/research-portfolio-analytics.service.ts':'64-95;133-150;315-333;364-417',
'apps/api/src/research-portfolios/research-portfolio-phase11.service.ts':'185-198;current-fit read versus refresh boundary',
'apps/api/src/research-portfolios/research-portfolio-output.service.ts':'475-492;artifact download is a separate byte boundary',
'apps/api/src/research-portfolios/ResearchPortfolioMeriAdapters.contract.spec.ts':'current scope/tool parameter contract assertions',
'apps/api/src/research-portfolios/research-portfolios.schema.contract.spec.ts':'persisted carrier schema assertions',
'apps/api/src/meri/meri-tools.service.ts':'880 request;2625 delegation',
'apps/api/src/meri/meri-research-evidence.helpers.ts':'10-67 request;76-275 scope/coverage;278-308 projection',
'apps/api/src/meri/meri-research-evidence.helpers.spec.ts':'71-360 scope, snapshot, cursor, hash and withdrawal cases',
'apps/api/src/meri/meri-research-handoff.ts':'immutable attachment and handoff types',
'apps/api/src/meri/meri-bizdev-tools.service.ts':'159-191;397-448 prospect evidence scope/projection',
'apps/api/src/business-development/bizdev-meri-scope.service.ts':'server selected prospect scope',
'apps/api/src/business-development/bizdev-evidence.types.ts':'prospect evidence envelope types'
}
rows=[]
for path,locators in files.items():
 row={'path':path,'locators':locators,'inspection':'Schema/policy/typed projection/reference assertions only; no copied private implementation or source body.'}
 for key,ref in refs.items():
  data=git(cap,'show',ref+':'+path);row[key]={'ref':ref,'blob':git(cap,'rev-parse',ref+':'+path).decode().strip(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 row['changed']=row['frozen']['blob']!=row['observed']['blob'];rows.append(row)
(out/'source-reference-identities.json').write_text(json.dumps(rows,indent=2)+'\n')
schema=git(cap,'show',refs['frozen']+':apps/api/prisma/schema.prisma').decode(); carriers=[]
for m in re.finditer(r'^model (ResearchPortfolio\w*) \{\n(.*?)^\}',schema,re.M|re.S):
 fields=[]
 for line in m.group(2).splitlines():
  parts=line.strip().split()
  if len(parts)>=2 and not parts[0].startswith(('@','//')) and re.search('evidence|source|snapshot|payload|envelope|basis|input|manifest|claims|provenance|hash',parts[0],re.I):
   if parts[1].startswith('ResearchPortfolio'):continue
   fields.append({'name':parts[0],'prismaType':parts[1]})
 if fields:carriers.append({'model':m.group(1),'line':schema[:m.start()].count('\n')+1,'fields':fields})
(out/'storage-field-census.json').write_text(json.dumps({'scope':'Name/type census of source/evidence/payload/basis/hash-like scalar fields in ResearchPortfolio-prefixed Prisma models. This is not a source exposure allowlist or proof that every JSON field is evidence.','source':refs['frozen'],'models':carriers},indent=2)+'\n')
localrefs=[('3406ed7e01af3aef85aeebc00fc49f6f41002bc5','docs/coordination/DECISIONS.md','D011 lines9-13'),('c558b153','docs/CAPABILITY-SCOPE.md','scope rule and ledger row62'),('e14564e6ca4747fe97cf911ede3c816a295ba59c','docs/coordination/reports/CODEX-R2-ADOPTION.md','scope/discrepancies lines11-17'),('e14564e6ca4747fe97cf911ede3c816a295ba59c','docs/coordination/r2/capabilities.json','records:Current native tools row27'),('1f7bf122','docs/plans/MERI-DEPLOYMENT.md','authority22;new implementations191'),('1f7bf122','packages/contracts/retrieval-0.2/research-portfolio.schema.json','exact existing definitions'),('1f7bf122','packages/contracts/retrieval-0.2/research-portfolio-validation.mjs','context44-68/results70-116'),('1f7bf122','packages/contracts/retrieval-0.2/business-development.schema.json','prospect evidence definitions'),('1f7bf122','packages/contracts/retrieval-0.2/business-development-validation.mjs','prospect evidence qualifier'),('1f7bf122','packages/contracts/retrieval-0.2/catalog.json','original get_research_evidence pending/null')]
rows=[]
for ref,path,locators in localrefs:
 ref=git(root,'rev-parse',ref).decode().strip();data=git(root,'show',ref+':'+path);rows.append({'ref':ref,'path':path,'locators':locators,'blob':git(root,'rev-parse',ref+':'+path).decode().strip(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(out/'authority-and-reuse-identities.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps({'pairedReferences':len(files),'drift':sum(r['changed'] for r in json.loads((out/'source-reference-identities.json').read_text())),'storageModels':len(carriers),'authorityReferences':len(rows)}))
