/** Actual planning workbook create/revise/download flow over the canonical document interface. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectWorkbook,inspectWorkbookCopies,workbookCell} from './inspection.mjs';

const value = content => ({value: content});
const money = {numberFormat: '$#,##0.00'};
export const workbookDraft = () => ({operation: 'create_excel',format: 'xlsx',title: 'Synthetic project plan',content: {sheets: [
  {name: 'Plan',rows: [
    ['Workstream','Hours','Rate','Cost'].map(value),
    [value('Research'),value(10),{value: 125,...money},{formula: '=B2*C2',...money}],
    [value('Documentation'),value(8),{value: 100,...money},{formula: '=B3*C3',...money}],
    [value('Total'),value(null),value(null),{formula: '=SUM(D2:D3)',...money}],
  ]},
  {name: 'Notes',rows: [[value('Synthetic local planning only')],[value('=1+1')],[value('Revise assumptions before approval')]]},
]}});
export async function runLocalWorkbookFlow({fixture,send,pythonExecutable,sofficeExecutable,outputDirectory,reconstruct,checkIsolation,copyInspectionDeadlineMs}) {
  const json = async response => {const body = await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
  const session = await json(await send('/api/action-followthrough/session',{},fixture.nativeCredential));
  assert.notEqual(session.credential,fixture.nativeCredential);assert.notEqual(session.credential,fixture.credential);
  const call = (route,body) => send('/api/documents/'+route,body,session.credential);
  const forbidden = await call('create',{deliveryId: 'forged-context',request: workbookDraft(),context: fixture.artifactOptions.context});
  assert.notEqual(forbidden.status,200);assert.equal(fixture.stats().generations,0);
  const wrongFamily = await call('create',{deliveryId: 'wrong-family',request: {operation: 'create_word',format: 'txt',title: 'Wrong grant',content: {text: 'Refuse before effects'}}});
  assert.notEqual(wrongFamily.status,200);assert.equal(fixture.stats().generations,0);
  const first = await json(await call('create',{deliveryId: 'workbook-original',request: workbookDraft()}));
  assert.equal(first.version.parentVersionId,null);assert.equal(first.version.generationStatus,'draft');
  assert.equal(first.version.previewStatus,'pending');assert.equal(first.execution.nativeQualified,false);
  const revision = workbookDraft();revision.content.sheets[0].rows[1][1].value = 12;
  revision.content.sheets[1].rows[2][0].value = 'Research hours revised from 10 to 12';
  const second = await json(await call('revise',{deliveryId: 'workbook-revision',baseVersionId: first.version.versionId,request: revision}));
  assert.equal(second.version.artifactId,first.version.artifactId);assert.equal(second.version.parentVersionId,first.version.versionId);
  assert.notEqual(second.version.versionId,first.version.versionId);
  assert.equal(second.inspection.details.revisionMethod,'openpyxl typed-cell replacement');
  await reconstruct();
  const downloads = [],inspections = [],inspectionProcesses = [];
  for (const [index,version] of [first.version,second.version].entries()) {
    const inspected = await json(await call('inspect',{versionId: version.versionId}));
    assert.equal(inspected.inspection.currentBytesVerified,true);assert.equal(inspected.version.object.sha256,version.object.sha256);
    const response = await call('download',{versionId: version.versionId});assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),version.mimeType);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-disposition'),/\.xlsx"$/);
    const bytes = Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,version.object.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),version.object.sha256);downloads.push(bytes);
    const opened = await inspectWorkbook({bytes,pythonExecutable,directory: fixture.directory,deadlineMs: fixture.artifactOptions.context.deadlineMs});
    inspections.push(opened.inspection);inspectionProcesses.push(opened.process);
    assert.deepEqual(opened.inspection.sheets.map(sheet => sheet.name),['Plan','Notes']);
    assert.equal(workbookCell(opened.inspection,'Plan','B2').value,index ? 12 : 10);
    assert.equal(workbookCell(opened.inspection,'Plan','D2').value,'=B2*C2');
    assert.equal(workbookCell(opened.inspection,'Plan','D4').value,'=SUM(D2:D3)');
    assert.equal(workbookCell(opened.inspection,'Plan','D4').numberFormat,'$#,##0.00');
    assert.equal(workbookCell(opened.inspection,'Notes','A2').value,'=1+1');assert.equal(workbookCell(opened.inspection,'Notes','A2').kind,'s');
  }
  await checkIsolation({versionId: first.version.versionId,credential: session.credential});
  const replay = await call('create',{deliveryId: 'workbook-original',request: workbookDraft()});
  const recovered=await json(replay);assert.deepEqual(recovered.version,first.version);assert.equal(recovered.execution.budgetTicketId,first.execution.budgetTicketId);
  assert.equal(fixture.stats().generations,2);assert.equal(fixture.stats().settled,2);assert.equal(fixture.stats().consumedMicroUsd,'20');
  fixture.revoke();
  for (const version of [first.version,second.version]) assert.notEqual((await call('download',{versionId: version.versionId})).status,200);
  assert.notEqual((await call('create',{deliveryId: 'revoked-write',request: workbookDraft()})).status,200);
  assert.equal(fixture.stats().generations,2);
  // Authority is already revoked. These are independently bounded offline inspections
  // of bytes downloaded above, never a refreshed session, grant or artifact action.
  assert.ok(Number.isSafeInteger(copyInspectionDeadlineMs) && copyInspectionDeadlineMs > Date.now() && copyInspectionDeadlineMs <= Date.now()+90000);
  const copies = [];
  for (const [index,bytes] of downloads.entries()) copies.push(await inspectWorkbookCopies({bytes,label: index ? 'revision' : 'original',
    expectedTotal: index ? 2300 : 2050,pythonExecutable,sofficeExecutable,tempRoot: fixture.directory,outputDirectory,
    deadlineMs: copyInspectionDeadlineMs}));
  return {versions: [first.version,second.version],inspections,inspectionProcesses,copies,replayStatus: replay.status,
    invariants: {originalPreserved: true,revisionParentExact: true,downloadsVerified: true,reconstructedVersionsReadable: true,
      literalFormulaTextPreserved: true,formulaAndStylePreserved: true,localRecalculationVerified: true,localPdfRendered: true,
      independentStoresAndSessionsIsolated: true,wrongOperationRefusedBeforeEffects: true,revokedVersionsDenied: true},stats: fixture.stats()};
}
