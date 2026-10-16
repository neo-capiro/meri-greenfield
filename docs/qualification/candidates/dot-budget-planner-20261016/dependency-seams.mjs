// SYNTHETIC control-flow evidence only: canonical JSON, public schemas, SDK and canonical preparer implementations are UNRUN.
import {mock} from 'node:test';
import {createHash} from 'node:crypto';
const root=new URL('../../../../',import.meta.url),url=path=>new URL(path,root).href;
mock.module(url('packages/contracts/validate.mjs'),{namedExports:{canonicalSha256:v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),validateShape:(_name,v)=>v,assertProposalIntegrity:()=>{}}});
mock.module(url('apps/control/intents/command-preparer.mjs'),{namedExports:{COMMAND_INTENT_OPERATIONS:{create_task:'task.create'}}});
mock.module(url('apps/control/intents/schedule-preparer.mjs'),{namedExports:{SCHEDULE_INTENT_OPERATIONS:['schedule_task','update_scheduled_task','cancel_scheduled_task']}});
mock.module(url('apps/control/intents/document-preparer.mjs'),{namedExports:{DOCUMENT_INTENT_OPERATIONS:['create_word','create_excel']}});
