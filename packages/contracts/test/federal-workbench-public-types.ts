import {
  receiveFederalSource, receiveFederalRequest, receiveFederalResponse,
  type FederalCompilerSource, type FederalSelection, type AdmittedFederalRequest,
  type AdmittedFederalReview, type FederalPublication, type FederalImportResult, type FederalSourceEnvelope,
  type FederalApproval, type FederalHistory, type FederalError,
} from '@capiro/meri-contracts/federal-workbench';

declare const bytes: Uint8Array;
declare const selection: FederalSelection;
declare const review: AdmittedFederalReview;
declare const publication: FederalPublication;
declare const envelope: FederalSourceEnvelope;
const imported = receiveFederalResponse('federal-import', 200, bytes,
  receiveFederalRequest('federal-import', bytes));
imported.then(value => {
  if (!('error' in value)) {
    const result: Readonly<FederalImportResult> = value;
    const source: FederalCompilerSource = result.source;
    void source;
  }
});
const source: Promise<Readonly<FederalCompilerSource>> = receiveFederalSource(bytes);
const request: AdmittedFederalRequest<'federal-prepare'> = receiveFederalRequest('federal-prepare', bytes);
const published = receiveFederalResponse('federal-publish', 200, bytes,
  receiveFederalRequest('federal-publish', bytes), review);
// An approval is a review response whose approval names the approved revision; history lists each revision's state.
const approved = receiveFederalResponse('federal-approve', 200, bytes, receiveFederalRequest('federal-approve', bytes));
approved.then(value => {
  if (!('error' in value)) {
    const approval: FederalApproval | null = value.approval;
    void approval;
  }
});
const history = receiveFederalResponse('federal-history', 422, bytes, receiveFederalRequest('federal-history', bytes));
history.then(value => {
  if ('error' in value) {
    const refusal: Readonly<FederalError> = value;
    const operationId: string | null | undefined = refusal.error.operationId;
    void operationId;
  } else {
    const page: Readonly<FederalHistory> = value;
    const approval: FederalApproval | null = page.revisions[0].approval;
    void approval;
  }
});
// @ts-expect-error Plain data has not passed the public receiver.
const unadmitted: AdmittedFederalRequest<'federal-prepare'> = {selection};
// @ts-expect-error Unknown routes cannot bypass request validation.
receiveFederalRequest('federal-reject', bytes);
void [source, request, published, publication, unadmitted, imported, envelope, approved, history];

// The parser discriminant narrows the declared nested source locations.
declare const nestedOrFlat: FederalCompilerSource;
if (nestedOrFlat.parserVersion === 'federal-scoped-text/2' || nestedOrFlat.parserVersion === 'federal-uslm-xml/1') {
  const ancestors: string[] = nestedOrFlat.scopes[0].ancestorPath;
  void ancestors;
}
