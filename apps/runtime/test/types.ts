import type {WorkerOptions, NativeConnectionOptions} from '@temporalio/worker';
import type {ConnectionOptions} from '@temporalio/client';
import type {TLSConfig} from '@temporalio/client';
const tls:TLSConfig={serverRootCACertificate:Buffer.from('synthetic'),clientCertPair:{crt:Buffer.from('synthetic'),key:Buffer.from('synthetic')}};
const native:NativeConnectionOptions={address:'temporal.example.invalid:7233',tls};
const client:ConnectionOptions={address:'temporal.example.invalid:7233',tls,connectTimeout:3000};
const worker:WorkerOptions={connection:undefined,namespace:'meri-preview',taskQueue:'meri-conversations-v1',workflowsPath:'/opt/meri/apps/control/conversations/workflow.ts',activities:{executeConversation:async()=>({state:'completed'})},shutdownGraceTime:5000,shutdownForceTime:6000};
void [native,client,worker];
