import {
 SELECTED_TAB_SCHEMA, receiveSelectedTabMessage, selectedTabOriginal, createSelectedTabShare,
 type SelectedTabShare, type SelectedTabApplicationMessage, type AdmittedSelectedTab,
} from '@capiro/meri-contracts/selected-tab-application';
const application:AdmittedSelectedTab<SelectedTabApplicationMessage>=await receiveSelectedTabMessage('application','{}');
if(application.type==='pair'){const account:string=application.labels.account;void account;}
const extension=await receiveSelectedTabMessage('extension','{}');
if(extension.type==='share'){
 const schema:typeof SELECTED_TAB_SCHEMA=extension.schema;
 const original:Uint8Array=selectedTabOriginal(extension);void [schema,original];
}
declare const plain:SelectedTabShare;
// @ts-expect-error structurally valid data is not an admitted share
selectedTabOriginal(plain);
// @ts-expect-error application messages cannot be used as share originals
selectedTabOriginal(application);
// @ts-expect-error direction is closed
receiveSelectedTabMessage('any','{}');
const produced:AdmittedSelectedTab<SelectedTabShare>=await createSelectedTabShare(plain);
void produced;
