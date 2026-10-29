import {
  OFFICE_SCHEMA, receiveOfficeRequest, receiveOfficeResponse, receiveOfficeDownload,
  type OfficeSnapshot, type OfficeFailure, type OfficeVersion,
} from '@capiro/meri-contracts/office-application';

const read = receiveOfficeRequest('read', new Uint8Array());
const result: OfficeSnapshot | OfficeFailure = await receiveOfficeResponse('read', 200, new Uint8Array(), read);
if (!('error' in result)) {
  const schema: typeof OFFICE_SCHEMA = result.schema;
  const draft: string = result.draft.draftId;
  const edition: 'collabora-code' | undefined = result.launch?.edition;
  void [schema, draft, edition];
}
const inspect = receiveOfficeRequest('inspect', new Uint8Array());
const inspected = await receiveOfficeResponse('inspect', 200, new Uint8Array(), inspect);
if (!('error' in inspected)) {
  const version: OfficeVersion = inspected.document.version;
  const file = await receiveOfficeDownload(new Response(), version);
  const bytes: Uint8Array<ArrayBuffer> = file.bytes; void bytes;
}
// @ts-expect-error inspection does not carry a private draft selection
inspect.draftId;
// @ts-expect-error Save is WOPI PutFile, not a browser publication endpoint
receiveOfficeRequest('save', new Uint8Array());
