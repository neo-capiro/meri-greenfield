import test from 'node:test';import assert from 'node:assert/strict';
import {objectivePlannerActivities} from './registration.mjs';
test('default worker receives no continuation activity or new execution owner',()=>{assert.deepEqual(objectivePlannerActivities(undefined),{});});
test('optional composition admits only the two continuation activities',()=>{const methods={inspectObjectivePlanner:async()=>{},prepareObjectivePlanner:async()=>{}};assert.deepEqual(objectivePlannerActivities(methods),methods);for(const v of [{...methods,executeConversation:async()=>{}},{...methods,prepareObjectivePlanner:null},{inspectObjectivePlanner:async()=>{}}])assert.throws(()=>objectivePlannerActivities(v));});
