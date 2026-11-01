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

const removal: FederalSelection['operations'][number] = {id:'remove',kind:'remove_source_text',expectedSourceSha256:'0'.repeat(64),expectedTextSha256:'0'.repeat(64),dependsOn:[]};
if (removal.kind === 'remove_source_text') {
  const sourceHash: string = removal.expectedSourceSha256;
  // @ts-expect-error Whole-source removal is not a scope text amendment.
  removal.scopeId;
  void sourceHash;
}
if ('resultKind' in review.prepared.draft && review.prepared.draft.resultKind === 'source-text-removed') {
  const empty: '' = review.prepared.draft.outputs.consolidated;
  void empty;
}

if (nestedOrFlat.parserVersion === 'federal-uslm-xml/2' || nestedOrFlat.parserVersion === 'federal-uslm-xml/3') {
  const profile: 'uslm-2.1.0' = nestedOrFlat.validation.profile;
  const valid: true = nestedOrFlat.validation.valid;
  const ancestors: string[] = nestedOrFlat.scopes[0].ancestorPath;
  void [profile, valid, ancestors];
} else {
  // @ts-expect-error Earlier parser profiles carry no schema-validity receipt.
  nestedOrFlat.validation;
}
if (nestedOrFlat.parserVersion === 'federal-uslm-xml/3') {
  const decoded: string | undefined = nestedOrFlat.scopes[0].textRun?.decoded;
  const rawStart: number | undefined = nestedOrFlat.scopes[0].textRun?.spans[0].rawStart;
  void [decoded, rawStart];
}
if (review.prepared.draft.structuralProjection?.status === 'supported') {
  const block = review.prepared.draft.structuralProjection.original.blocks[0];
  const mapping = review.prepared.draft.structuralProjection.original.mapping[0];
  if (mapping.kind === 'run') { const index: number = mapping.runIndex; void index; }
  void block;
}
if (publication.structuralReceipt) {
  const profile: 'uslm-word/1' = publication.structuralReceipt.profile;
  const specHash: string = publication.structuralReceipt.specSha256;
  void [profile, specHash];
}
if (review.prepared.schemaValidation) {
  const sourceHash: string = review.prepared.schemaValidation.source.sourceSha256;
  const valid: true | undefined = review.prepared.schemaValidation.consolidated?.valid;
  void [sourceHash, valid];
}
