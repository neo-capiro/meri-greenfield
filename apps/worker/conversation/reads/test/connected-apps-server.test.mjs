/**
 * Connected-apps reads through the ACTUAL SDK read surface (SCRUM-155).
 *
 * The mail suite proves the same `meri_reads` mount for the mail family. This proves the family the
 * connector library depends on: the SDK MCP server registers `list_connected_app_reads` and
 * `read_connected_app` only when the run's policy names the `connected-apps` family AND the current
 * availability snapshot grants both operations to this binding/tenant, then returns the canonical
 * provider page with a delivery-bound receipt.
 *
 * Everything is synthetic: no provider, no Core, no network. The port is the same two-method seam
 * the worker uses for the gateway (readAvailability / execute), and the page shape is the one Core's
 * ConnectedAppReadService returns.
 */
import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../../../../../packages/contracts/retrieval-0.3/catalog.json" with {type: "json"};
import {canonicalSha256} from "../../../../../packages/contracts/validate.mjs";
import {generalReadFixture, mountReads, SESSION} from "./fixture.mjs";

const OPERATIONS = Object.freeze([
  Object.freeze({id: "list_connected_app_reads", version: "0.2.0"}),
  Object.freeze({id: "read_connected_app", version: "0.2.0"}),
]);
const BARE = ["list_connected_app_reads", "read_connected_app"];
const TOOLS = BARE.map((name) => `mcp__meri_reads__${name}`);
const CATALOG_SHA = canonicalSha256(catalog);

/** The installed + discovery-granted snapshot the runtime requires before it mounts anything. */
function snapshot(f, {operations = OPERATIONS, binding = f.binding} = {}) {
  const at = f.now();
  return {
    installation: {
      installationId: SESSION,
      baseCatalogSha256: CATALOG_SHA,
      executionCatalogSha256: "b".repeat(64),
      operations,
      checkedAtMs: at,
      expiresAtMs: at + 5000,
    },
    discovery: {
      binding,
      policyRevision: f.policy,
      operations,
      checkedAtMs: at,
      expiresAtMs: at + 5000,
    },
  };
}

const capability = {
  connectionId: "77777777-7777-4777-8777-777777777777",
  provider: "slack",
  tool: "search_messages",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {query: {type: "string"}},
    required: ["query"],
  },
};
capability.schemaHash = canonicalSha256(capability.inputSchema);

const listPage = {
  operation: "list_connected_app_reads",
  clientId: null,
  observedAt: "2026-10-29T12:00:00.000Z",
  status: "ok",
  untrusted: true,
  complete: false,
  scope: "current_connection_catalog",
  managedAvailability: "ok",
  capabilities: [capability],
};
const readPage = {
  operation: "read_connected_app",
  clientId: null,
  connectionId: capability.connectionId,
  provider: capability.provider,
  tool: capability.tool,
  schemaHash: capability.schemaHash,
  observedAt: "2026-10-29T12:00:00.000Z",
  status: "ok",
  untrusted: true,
  scope: "connection_permissions",
  completeness: "provider_page",
  reason: null,
  content: "Untrusted provider text",
  providerResult: {content: [{type: "text", text: "Quarterly plan"}]},
};

function port(f, {revoked = false, pages = {}} = {}) {
  const calls = [];
  // The runtime validates the port with a closed two-method boundary, so `calls` must not live on it.
  const seam = {
    async readAvailability() {
      if (revoked) throw Error("READ_AVAILABILITY_REFUSED");
      return snapshot(f);
    },
    async execute(call) {
      calls.push(call);
      const page =
        call.operation.id === "list_connected_app_reads"
          ? (pages.list ?? listPage)
          : (pages.read ?? readPage);
      // The production port returns the gateway envelope around the canonical page.
      return JSON.stringify({binding: f.binding, operation: call.operation, result: page});
    },
  };
  return {calls, seam};
}

test("mounts exactly the two connected-apps reads for the connected-apps family", async () => {
  const f = await generalReadFixture();
  const {seam, calls} = port(f);
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["connected-apps"]},
    port: seam,
  });
  assert.ok(mounted, "the family reads mount when the snapshot grants them");
  try {
    assert.deepEqual([...mounted.runtime.sdkOptions.allowedTools].sort(), TOOLS);
    const list = await mounted.client.listTools();
    assert.deepEqual(list.tools.map((t) => t.name).sort(), BARE);
    assert.equal(calls.length, 0, "listing reads executes nothing");
  } finally {
    await mounted.close();
  }
});

test("an approved connected read returns the canonical page with one delivery receipt", async () => {
  const f = await generalReadFixture();
  const {seam, calls} = port(f);
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["connected-apps"]},
    port: seam,
  });
  assert.ok(mounted);
  try {
    const args = {
      clientId: null,
      connectionId: capability.connectionId,
      provider: capability.provider,
      tool: capability.tool,
      schemaHash: capability.schemaHash,
      arguments: {query: "quarterly"},
    };
    const result = await mounted.call("read_connected_app", args, {toolUseId: "toolu_connected"});
    assert.equal(result.isError, undefined);
    const page = JSON.parse(result.content[0].text);
    assert.deepEqual(page.result, readPage);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].operation, {id: "read_connected_app", version: "0.2.0"});
    assert.deepEqual(calls[0].arguments, args);
    const receipts = mounted.runtime.receipts();
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].deliveryId, "sdk:" + canonicalSha256({
      binding: f.binding,
      sessionId: SESSION,
      toolUseId: "toolu_connected",
    }));
    assert.equal(receipts[0].resultSha256, canonicalSha256(page));
  } finally {
    await mounted.close();
  }
});

test("no server is mounted when the run's policy does not name the family", async () => {
  const f = await generalReadFixture();
  const {seam, calls} = port(f);
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["mail"]},
    port: seam,
  });
  assert.equal(mounted, null);
  assert.equal(calls.length, 0, "no grant: the gateway seam is never called");
});

test("a revoked availability snapshot mounts nothing", async () => {
  const f = await generalReadFixture();
  const {seam, calls} = port(f, {revoked: true});
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["connected-apps"]},
    port: seam,
  });
  assert.equal(mounted, null);
  assert.equal(calls.length, 0);
});

test("a snapshot granted to another tenant/actor mounts nothing", async () => {
  const f = await generalReadFixture();
  let foreign = 0;
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["connected-apps"]},
    port: {
      async readAvailability() {
        foreign += 1;
        return snapshot(f, {
          binding: {...f.binding, actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
        });
      },
      async execute() {
        throw Error("execute must not run for a foreign binding");
      },
    },
  });
  assert.equal(mounted, null);
  assert.equal(foreign, 1);
});

test("the profile mount needs the explicit activeReadOperations grant", async () => {
  const f = await generalReadFixture();
  const {seam} = port(f);
  const granted = await mountReads(f, {
    policy: {
      generalReads: true,
      readFamilies: ["connected-apps"],
      activeReadOperations: [...OPERATIONS],
    },
    port: seam,
    mount: "profile",
  });
  assert.ok(granted, "the product profile mount exposes the granted operations");
  try {
    assert.deepEqual([...granted.runtime.sdkOptions.allowedTools].sort(), TOOLS);
  } finally {
    await granted.close();
  }
  // The same family selection without activeReadOperations contributes no tool at all.
  assert.equal(
    await mountReads(f, {
      policy: {generalReads: true, readFamilies: ["connected-apps"]},
      port: seam,
      mount: "profile",
    }),
    null,
  );
});

test("the server exposes only the operations the snapshot granted", async () => {
  const f = await generalReadFixture();
  const {seam} = port(f);
  const mounted = await mountReads(f, {
    policy: {generalReads: true, readFamilies: ["connected-apps"]},
    port: {
      async readAvailability() {
        return snapshot(f, {operations: [{id: "list_connected_app_reads", version: "0.2.0"}]});
      },
      async execute(call) {
        return seam.execute(call);
      },
    },
  });
  assert.ok(mounted);
  try {
    assert.deepEqual([...mounted.runtime.sdkOptions.allowedTools].sort(), [
      "mcp__meri_reads__list_connected_app_reads",
    ]);
  } finally {
    await mounted.close();
  }
});

/** Mid-run availability transitions (M12). A grant narrowed, revoked, expired, moved to another actor or re-issued
 * under another policy revision is refused by the control reads owner from its own fresh snapshot and current
 * authority on every execute (apps/runtime/test/reads-execution.test.mjs proves it before any source call); the worker
 * does not re-read availability. The worker still never widens: a read that was not mounted cannot be added later. */
test("mid-run: a widened grant never adds a read that was not mounted",async()=>{
 const f=await generalReadFixture();
 let first=true;const calls=[];
 const mounted=await mountReads(f,{policy:{generalReads:true,readFamilies:["connected-apps"]},port:{
  async readAvailability(){if(first){first=false;return snapshot(f,{operations:[OPERATIONS[0]]});}return snapshot(f);},
  async execute(call){calls.push(call);return JSON.stringify({binding:f.binding,operation:call.operation,result:listPage});},
 }});
 assert.ok(mounted);
 try{
  assert.deepEqual((await mounted.client.listTools()).tools.map(t=>t.name),["list_connected_app_reads"]);
  const denied=await mounted.call("read_connected_app",{clientId:null,connectionId:capability.connectionId,provider:capability.provider,tool:capability.tool,schemaHash:capability.schemaHash,arguments:{query:"q"}});
  assert.match(denied.denied,/correlation unavailable/u);
  const forced=await mounted.client.callTool({name:"read_connected_app",arguments:{arguments:{clientId:null}}});assert.equal(forced.isError,true);
  assert.equal(calls.length,0);
 }finally{await mounted.close();}
});

test("a disconnected or reauthorization page reaches the model with precise guidance and no secret",async()=>{
 const f=await generalReadFixture();
 for(const [status,reason,expected] of [["disconnected","connection_disconnected",/connect it under Connected apps/u],["permission_required","connection_permission_required",/reconnect it under Connected apps/u]]){
  const page={...readPage,status,reason,content:null,providerResult:null};
  const mounted=await mountReads(f,{policy:{generalReads:true,readFamilies:["connected-apps"]},port:port(f,{pages:{read:page}}).seam});
  assert.ok(mounted);
  try{
   const result=await mounted.call("read_connected_app",{clientId:null,connectionId:capability.connectionId,provider:capability.provider,tool:capability.tool,schemaHash:capability.schemaHash,arguments:{query:"quarterly"}});
   assert.equal(result.isError,undefined);assert.equal(result.content.length,2);
   assert.deepEqual(JSON.parse(result.content[0].text).result,page);
   assert.match(result.content[1].text,/^Notice: /u);assert.match(result.content[1].text,expected);assert.match(result.content[1].text,/Do not retry this call\.$/u);
   assert.equal(/SYNTHETIC|https?:|token/u.test(result.content[1].text),false);
   assert.equal(mounted.runtime.receipts()[0].resultSha256,canonicalSha256(JSON.parse(result.content[0].text)));
  }finally{await mounted.close();}
 }
 const empty=await mountReads(f,{policy:{generalReads:true,readFamilies:["connected-apps"]},port:port(f,{pages:{list:{...listPage,status:"unavailable",managedAvailability:"no_eligible",capabilities:[]}}}).seam});
 assert.ok(empty);
 try{const result=await empty.call("list_connected_app_reads",{clientId:null});assert.equal(result.isError,undefined);assert.equal(result.content.length,2);assert.match(result.content[1].text,/No connected app is usable/u);}
 finally{await empty.close();}
});
