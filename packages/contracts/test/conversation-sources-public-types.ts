import {receiveBillTextSourceRequest,receiveBillTextSourceResponse,receiveNativeBillTextSourceEvent,type BillTextSourceReadRequest,type NativeBillTextSourceEvent} from '@capiro/meri-contracts/conversation-sources';
const bytes=new Uint8Array();
const request=receiveBillTextSourceRequest(bytes);
const input:BillTextSourceReadRequest=request;
const event:NativeBillTextSourceEvent=receiveNativeBillTextSourceEvent(bytes);
const version:'0.2.0'=event.data.operation.version;
void receiveBillTextSourceResponse(200,bytes,request);void input;void version;
// @ts-expect-error Plain input cannot replace admitted bytes.
void receiveBillTextSourceResponse(200,bytes,input);
// @ts-expect-error Native proof does not invent a legacy authorization decision.
void event.data.authorizationDecisionId;
