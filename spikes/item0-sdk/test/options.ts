import type {Options, SessionStore, McpHttpServerConfig, Query} from '@anthropic-ai/claude-agent-sdk';
import {InMemorySessionStore, forkSession, importSessionToStore, getSessionMessages} from '@anthropic-ai/claude-agent-sdk';
import {sdkOptions} from '../run.mjs';
import type {TaskCreateInput, TaskUpdateInput, TaskGetInput, TaskListInput} from '@anthropic-ai/claude-agent-sdk/sdk-tools';
const store: SessionStore = new InMemorySessionStore();
const mcp: McpHttpServerConfig = {type: 'http', url: 'http://127.0.0.1/mcp', headers: {Authorization: 'Bearer synthetic'}, alwaysLoad: true};
const options: Options = sdkOptions({model: 'synthetic', work: '/scratch', question: {scope: 'synthetic', id: 'seed'}},
  {plugin: '/scratch/plugin', store, mcp, controller: new AbortController(), configDirectory: '/scratch/config'});
const resume: Options = {...options, resume: 'synthetic-session', forkSession: true, sessionStoreFlush: 'batched'};
const stop = (query: Query) => query.interrupt();
void [resume, stop, forkSession, getSessionMessages, importSessionToStore];
const createTask: TaskCreateInput = {subject: 'Prepare synthetic brief', description: 'Save and verify the brief'};
const updateTask: TaskUpdateInput = {taskId: 'synthetic-task', status: 'in_progress'};
const completeTask: TaskUpdateInput = {...updateTask, status: 'completed'};
const getTask: TaskGetInput = {taskId: updateTask.taskId};
const listTasks: TaskListInput = {};
// @ts-expect-error The native tool requires an exact task ID.
const missingTaskId: TaskUpdateInput = {status: 'completed'};
// @ts-expect-error A guessed legacy status is not part of the pinned native API.
const invalidTaskStatus: TaskUpdateInput = {taskId: 'synthetic-task', status: 'done'};
void [createTask, completeTask, getTask, listTasks, missingTaskId, invalidTaskStatus];
