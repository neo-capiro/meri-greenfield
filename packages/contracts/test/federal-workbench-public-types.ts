import {
  receiveFederalSource, receiveFederalRequest, receiveFederalResponse,
  type FederalCompilerSource, type FederalSelection, type AdmittedFederalRequest,
  type AdmittedFederalReview, type FederalPublication,
} from '@capiro/meri-contracts/federal-workbench';

declare const bytes: Uint8Array;
declare const selection: FederalSelection;
declare const review: AdmittedFederalReview;
declare const publication: FederalPublication;
const source: Promise<Readonly<FederalCompilerSource>> = receiveFederalSource(bytes);
const request: AdmittedFederalRequest<'federal-prepare'> = receiveFederalRequest('federal-prepare', bytes);
const published = receiveFederalResponse('federal-publish', 200, bytes,
  receiveFederalRequest('federal-publish', bytes), review);
// @ts-expect-error Plain data has not passed the public receiver.
const unadmitted: AdmittedFederalRequest<'federal-prepare'> = {selection};
// @ts-expect-error Unknown routes cannot bypass request validation.
receiveFederalRequest('federal-approve', bytes);
void [source, request, published, publication, unadmitted];
