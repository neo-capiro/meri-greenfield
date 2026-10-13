"""Copy the exact prior whole-plan assessment and append finite source subcriteria only."""
import hashlib,json,pathlib,subprocess
here=pathlib.Path(__file__).resolve().parent
root=here.parents[3]
prior=root/'docs/qualification/candidates/next-adapters-20261013/reconciliation.json'
data=json.loads(prior.read_text())
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
data['schema']='meri.workflow-batch-reconciliation/1'
data['baseline']={'pullRequest':61,'commit':'1c79a912b6589ccd1004c12a9981bc146d79e8bc','tree':'cbf2fccab64962e41e4c739eb207b4fad63c5b87','assessmentSha256':hashlib.sha256(prior.read_bytes()).hexdigest()}
data['assessedSourceCommit']=source
source_criteria={'description':'Six additional configured passive HTTP adapters and canonical handlers implement current-eligibility-bound search_memory, managed-mapping Monday reads, profile sections, stored documents, entity candidates and contacts. Current gateway derives trusted contexts and rechecks authority/budget before effects and release. Native producers, actual eligibility/mapping predicates, source authenticity and activation remain unqualified.',
 'source':['apps/gateway/sources/client-knowledge/','apps/gateway/sources/client-evidence/','apps/gateway/sources/identity-contacts/','apps/gateway/dispatch/projection-read-context.mjs','apps/gateway/test/passive-projections-integration.test.mjs'],'acceptance':'BOUNDED_IMPLEMENTED_SOURCE_ONLY','closesWholeCriterion':False}
brief_criteria={'description':'Original quick_skill.mail_history@1.0.0 compiles exact authorized mail body sections into an editable DOCX with source/version/hash/scope-bound excerpts, candidate identity/contact limitations, required-source coverage and unverified interpretations. Existing artifact routes retain exact immutable base, original bytes and provenance; local current gateway and artifact lifecycle tests plus independently opened original/revised pages supply source acceptance only.',
 'source':['apps/control/document-application/mail-history/','apps/gateway/test/mail-history-gateway-flow.test.mjs'],'acceptance':'BOUNDED_IMPLEMENTED_SOURCE_ONLY','closesWholeCriterion':False}
for row in data['records']:
 if row['id'] in ['W02','W03','W05','G1','G2','G4','REL-05','RG-12']:
  row.setdefault('completedBoundedSubcriteria',[]).append({'description':'Parent confirms the native owner already qualified actual local PR57 migrations/persistence, three-pool and commit/client-crash behavior. Existing accepted pins remain untouched and these unchanged tests were not rerun by this batch. Deployed product/runtime foundation acceptance remains separate and open.','acceptance':'EXISTING_NATIVE_OWNER_LOCAL_ACCEPTANCE','closesWholeCriterion':False})
 if row['id'] in ['W04','R-02','R-04','R-05','REL-03']:
  row.setdefault('completedBoundedSubcriteria',[]).append(source_criteria)
 if row['id'] in ['W07','R-03','R-04','R-05','R-07','R-08','REL-04']:
  row.setdefault('completedBoundedSubcriteria',[]).append(brief_criteria)
 if row['id']=='W04':
  row['missingImplementation']=[
   'Selected-domain adapters remain incomplete outside the published bounded source increments; all-source continuation/snapshot/freshness producers and complete required-source joins remain missing.',
   'Memory recall and selected client/profile/document/entity/contact transport callbacks are implemented; actual approved eligibility, managed board mapping, stored source querying and full roster/portfolio families require their native producer owners and qualification.',
   'Complete selected-source two-tenant/within-tenant wall and measured revocation fixtures remain incomplete.',
   'Native source producers must adopt the reviewed safe UTF16 boundary helper/protocol and qualify their exact snapshots/current access; broader selected-domain Unicode continuation remains domain-specific.']
 # Exact current rows are verified, historical opaque original serialization remains unverified.
 loc=row.get('originalLocator')
 if loc:
  plan=(root/loc['path']).read_bytes();lines=plan.decode().splitlines()
  assert hashlib.sha256(plan).hexdigest()==loc['planSha256']
  assert lines[loc['line']-1]==row['originalRequirement']
  assert hashlib.sha256(row['originalRequirement'].encode()).hexdigest()==loc['rowSha256']
data['boundedBatch']=[{'units':6,'owner':'apps/gateway/sources/{client-knowledge,client-evidence,identity-contacts}/','outcome':source_criteria['description']},{'units':1,'owner':'apps/control/document-application/mail-history/','outcome':brief_criteria['description']}]
data['counts'].update({'boundedImplementationUnits':7,'boundedMissingBefore':7,'boundedMissingAfter':0})
data['assessmentCorrections']='Prior reports remain immutable. New subcriteria identify implemented supporting transport callbacks and one Mail History artifact workflow. Current native producers, original full skill promises, client/roster/portfolio families, SDK/UI/native durability and qualification remain explicitly open. No whole criterion changed class. The mail Unicode paging defect is repaired by canonical safe boundaries with exact UTF16 positions and actual-end cursor progress. Native adoption/qualification remains separate.'
data['preservation']='Public0.1.3 package/export/generated bytes unchanged from PR61. Six metadata-only private binding dispatch profiles added; every old callback and descriptor remains exact. Canonical private mail validation intentionally uses the reviewed complete-scalar boundary helper with unchanged DTO/schema/normalization digest. Catalog0.2.15 remains97 unimplemented/pending/null. Original14 skill assets and protected native pins unchanged; Claude Agent SDK, Temporal and AI SDK owners preserved.'
data['reviewedCheckpoints']={'production':{'commit':'d34a47b07c27ac5c55e9c4281991ae1657c1a723','tree':'c5f63a48fd23e09442d94429cfb9972b7a96782a','artifactReview':'fb9a3d3795004c59e17757b5a1497b0a21b19969'},'testSuccessor':{'commit':'9d1bf92a08ea07ad49d63e80ade8249598060635','tree':'c9a6ed124ba143e8ab0c772939609a6313cc9a07','sourceReview':'755c9f814992a2fa681195055a2a25bd5eb3bc09'},'rootFinalTests':{'contracts':4216,'integration':1256,'distinctTotal':5472,'publicReceivingRepeatedSubset':125}}
data['externalDependencies']=[item.replace('Protected PostgreSQL/Temporal/storage/source native qualification by existing owners; no competing fixtures.','Native PostgreSQL local qualification already completed by its owner; deployed product PostgreSQL/Temporal/storage/source integration still needs its own acceptance. No competing fixtures or repeated completed native tests.') for item in data['externalDependencies']]
data['privateTransfer']={'approvedArtifacts':['runner-source-v5.tar','AUTHOR-RECEIPT-v5.json'],'destination':'approved private chat transfer to NEOMART','status':'BLOCKED_LIBRARY_HTTP401','scope':'Exact reviewed pair only; no new grants, other private artifacts or alternate egress.'}
data['runtimeAcceptance']='HOLD; local source/adversarial/DOCX review does not qualify native runtime or close all51 remaining requirements.'
assert len(data['records'])==53 and data['counts']['wholeOpenAfter']==51
(here/'reconciliation.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'assessedSource':source,'counts':data['counts']}))
