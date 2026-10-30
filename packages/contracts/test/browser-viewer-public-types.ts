import {
  BROWSER_VIEWER_SCHEMA, receiveBrowserViewerRequest, receiveBrowserViewerResponse,
  browserViewerPng, type BrowserViewerContext, type BrowserViewerEvent,
} from '@capiro/meri-contracts/browser-viewer';
declare const bytes: Uint8Array;
declare const context: BrowserViewerContext;
const request = receiveBrowserViewerRequest('frame', bytes);
const response = receiveBrowserViewerResponse('frame', 200, bytes, request, context);
if (!('error' in response)) {
  const pixels: Uint8Array = browserViewerPng(response.frame);
  const schema: typeof BROWSER_VIEWER_SCHEMA = response.schema;
  void [pixels, schema];
}
const event: BrowserViewerEvent = {type:'text',text:'example'};
void event;
// @ts-expect-error resume belongs to the canonical lifecycle, not the viewer
receiveBrowserViewerRequest('resume', bytes);
// @ts-expect-error no clipboard, file transfer or remote script commands
const unsupported: BrowserViewerEvent = {type:'clipboard',text:'example'};
void unsupported;
