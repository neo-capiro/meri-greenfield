import {receiveUploadRequest,receiveUploadResponse,receiveUploadDownload,type AdmittedUploadReceipt} from '@capiro/meri-contracts/uploads-application';
const request=receiveUploadRequest('status',new Uint8Array()),receipt=receiveUploadResponse('status',200,new Uint8Array(),request);
if(!('error' in receipt)){
 const admitted:AdmittedUploadReceipt=receipt;
 void receiveUploadDownload(new Response(),receiveUploadRequest('read',new Uint8Array()),admitted);
 // @ts-expect-error plain wire receipts do not carry local integrity admission
 void receiveUploadDownload(new Response(),receiveUploadRequest('read',new Uint8Array()),{uploadId:'x'});
 // @ts-expect-error a status request cannot become an original byte read
 void receiveUploadDownload(new Response(),request,admitted);
}
