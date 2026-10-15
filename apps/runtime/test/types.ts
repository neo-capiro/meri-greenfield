import type {WorkerOptions, NativeConnectionOptions, NativeConnection} from '@temporalio/worker';
import type {ConnectionOptions, Connection} from '@temporalio/client';
import type {TLSConfig} from '@temporalio/client';
import {createTemporalAuthorization} from '../temporal-authorization.mjs';
const tls:TLSConfig={serverRootCACertificate:Buffer.from('synthetic'),clientCertPair:{crt:Buffer.from('synthetic'),key:Buffer.from('synthetic')}};
const native:NativeConnectionOptions={address:'temporal.example.invalid:7233',tls};
const client:ConnectionOptions={address:'temporal.example.invalid:7233',tls,connectTimeout:3000};
const worker:WorkerOptions={connection:undefined,namespace:'meri-preview',taskQueue:'meri-conversations-v1',workflowsPath:'/opt/meri/apps/control/conversations/workflow.ts',activities:{executeConversation:async()=>({state:'completed'})},shutdownGraceTime:5000,shutdownForceTime:6000};
void [native,client,worker];

// S4 compile assertions against the pinned 1.24.0 declarations: the client accepts the provider's synchronous `apiKey` callback
// (ConnectionOptions.apiKey: string | (() => string)), the worker accepts the initial string (NativeConnectionOptions.apiKey) and
// rotates through NativeConnection.setApiKey(string): Promise<void>; the attached-connection port is exactly that method.
const authorization=createTemporalAuthorization({configuration:{tokenFile:'/run/meri/temporal-token.json',namespace:'meri-preview',audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid',refreshMs:5000,maxLifetimeMs:600000},reader:{async read(){return {token:'x'.repeat(32),expiresAtMs:0,claims:{namespace:'meri-preview',audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid'}};}}});
const clientWithKey:ConnectionOptions={address:'temporal.example.invalid:7233',tls,apiKey:authorization.apiKey};
const nativeWithKey:NativeConnectionOptions={address:'temporal.example.invalid:7233',tls,apiKey:authorization.apiKey()};
declare const nativeConnection:NativeConnection;declare const clientConnection:Connection;
const rotation:Promise<void>=nativeConnection.setApiKey(authorization.apiKey());
clientConnection.setApiKey(authorization.apiKey);
authorization.attach({setApiKey:(apiKey:string)=>nativeConnection.setApiKey(apiKey)});
authorization.attach(nativeConnection);
const healthy:boolean=authorization.healthy();
void [clientWithKey,nativeWithKey,rotation,healthy];
