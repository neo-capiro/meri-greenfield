import type {Options, SessionStore, McpHttpServerConfig, Query} from '@anthropic-ai/claude-agent-sdk';
import {InMemorySessionStore, forkSession, importSessionToStore, getSessionMessages} from '@anthropic-ai/claude-agent-sdk';
import {sdkOptions} from '../run.mjs';
const store: SessionStore = new InMemorySessionStore();
const mcp: McpHttpServerConfig = {type: 'http', url: 'http://127.0.0.1/mcp', headers: {Authorization: 'Bearer synthetic'}, alwaysLoad: true};
const options: Options = sdkOptions({model: 'synthetic', work: '/scratch', question: {scope: 'synthetic', id: 'seed'}},
  {plugin: '/scratch/plugin', store, mcp, controller: new AbortController(), configDirectory: '/scratch/config'});
const resume: Options = {...options, resume: 'synthetic-session', forkSession: true, sessionStoreFlush: 'batched'};
const stop = (query: Query) => query.interrupt();
void [resume, stop, forkSession, getSessionMessages, importSessionToStore];
