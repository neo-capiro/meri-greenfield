// Generated original input boundary; imports the genuine0.1.7 input module. No authority.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length2 = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length2++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length2;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length2, i, keys;
        if (Array.isArray(a)) {
          length2 = a.length;
          if (length2 != b.length) return false;
          for (i = length2; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length2 = keys.length;
        if (length2 !== Object.keys(b).length) return false;
        for (i = length2; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length2; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// document-application/boundary.mjs
var errors = /* @__PURE__ */ new WeakSet();
var DocumentResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "DocumentResponseError";
    this.code = code;
    errors.add(this);
  }
};
var isFailure = (error) => errors.has(error);
var fail = (code) => {
  throw new DocumentResponseError(code);
};
var typed = Object.getPrototypeOf(Uint8Array.prototype);
var get = (name) => Object.getOwnPropertyDescriptor(typed, name).get;
var tag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag).get;
var length = get("byteLength");
var offset = get("byteOffset");
var buffer = get("buffer");
var ordinaryBuffer = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
function copyBytes(value, cap) {
  try {
    if (tag.call(value) !== "Uint8Array") fail("INVALID_BYTES");
    const n = length.call(value), b = buffer.call(value), o = offset.call(value);
    ordinaryBuffer.call(b);
    if (n > cap) fail("BYTE_LIMIT");
    const copy = new Uint8Array(n);
    Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
    return copy;
  } catch (error) {
    if (isFailure(error)) throw error;
    fail("INVALID_BYTES");
  }
}
function parseBytes(value, cap) {
  const bytes2 = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes2);
    data = JSON.parse(text);
  } catch {
    fail("INVALID_JSON_UTF8");
  }
  const stack = [[data, 0]], objects = [];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > 1e5 || depth > 64) fail("JSON_LIMIT");
    if (typeof v === "number" && !Number.isFinite(v)) fail("INVALID_NUMBER");
    if (typeof v === "string" && !v.isWellFormed()) fail("INVALID_UNICODE");
    if (v && typeof v === "object") {
      objects.push(v);
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k)) fail("DANGEROUS_KEY");
        stack.push([x, depth + 1]);
      }
    }
  }
  for (const v of objects) Object.freeze(v);
  return data;
}
async function digest(bytes2) {
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes2);
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, "0")).join("");
}

// initial-input-generated:./generated-validator.mjs
var validateAllocatedResponse = validate27;
var schema33 = { "type": "object", "properties": { "allocation": { "$ref": "#/$defs/ConversationInitialInputAllocation" }, "state": { "enum": ["RESERVED", "ACCEPTED"] }, "created": { "type": "boolean" } }, "required": ["allocation", "state", "created"], "additionalProperties": false };
var schema34 = { "type": "object", "properties": { "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "maxItems": 100, "uniqueItems": true }, "versions": { "$ref": "#/$defs/Canonical_RuntimeVersions_7edb8efc" }, "selectedClientId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "requestId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "inputSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "requestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "allocatedAtMs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "expiresAtMs": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "required": ["binding", "scopes", "versions", "selectedClientId", "requestId", "inputSha256", "requestSha256", "allocatedAtMs", "expiresAtMs"], "additionalProperties": false };
var schema36 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var pattern4 = new RegExp("^sha256:[a-f0-9]{64}$", "u");
var pattern5 = new RegExp("^[0-9]+\\.[0-9]+\\.[0-9]+$", "u");
var pattern7 = new RegExp("^[a-f0-9]{64}$", "u");
var pattern8 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.binding === void 0 && (missing0 = "binding") || data.scopes === void 0 && (missing0 = "scopes") || data.versions === void 0 && (missing0 = "versions") || data.selectedClientId === void 0 && (missing0 = "selectedClientId") || data.requestId === void 0 && (missing0 = "requestId") || data.inputSha256 === void 0 && (missing0 = "inputSha256") || data.requestSha256 === void 0 && (missing0 = "requestSha256") || data.allocatedAtMs === void 0 && (missing0 = "allocatedAtMs") || data.expiresAtMs === void 0 && (missing0 = "expiresAtMs")) {
        validate23.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema34.properties, key0)) {
            validate23.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.binding !== void 0) {
            let data0 = data.binding;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId") || data0.conversationId === void 0 && (missing1 = "conversationId") || data0.runId === void 0 && (missing1 = "runId") || data0.attemptId === void 0 && (missing1 = "attemptId") || data0.workerId === void 0 && (missing1 = "workerId") || data0.writerFence === void 0 && (missing1 = "writerFence")) {
                  validate23.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs5 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                      validate23.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors2) {
                    if (data0.tenantId !== void 0) {
                      let data1 = data0.tenantId;
                      const _errs6 = errors2;
                      if (errors2 === _errs6) {
                        if (typeof data1 === "string") {
                          if (func2(data1) > 128) {
                            validate23.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                            return false;
                          } else {
                            if (func2(data1) < 1) {
                              validate23.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          }
                        } else {
                          validate23.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                      var valid2 = _errs6 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.actorId !== void 0) {
                        let data2 = data0.actorId;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (func2(data2) > 128) {
                              validate23.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func2(data2) < 1) {
                                validate23.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate23.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.conversationId !== void 0) {
                          let data3 = data0.conversationId;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (errors2 === _errs10) {
                              if (typeof data3 === "string") {
                                if (!formats0.test(data3)) {
                                  validate23.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                  return false;
                                }
                              } else {
                                validate23.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data0.runId !== void 0) {
                            let data4 = data0.runId;
                            const _errs12 = errors2;
                            if (errors2 === _errs12) {
                              if (errors2 === _errs12) {
                                if (typeof data4 === "string") {
                                  if (!formats0.test(data4)) {
                                    validate23.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate23.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data0.attemptId !== void 0) {
                              let data5 = data0.attemptId;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (errors2 === _errs14) {
                                  if (typeof data5 === "string") {
                                    if (!formats0.test(data5)) {
                                      validate23.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate23.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid2 = _errs14 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data0.workerId !== void 0) {
                                let data6 = data0.workerId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (errors2 === _errs16) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        validate23.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate23.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data0.writerFence !== void 0) {
                                  let data7 = data0.writerFence;
                                  const _errs18 = errors2;
                                  if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                    validate23.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors2 === _errs18) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 9007199254740991 || isNaN(data7)) {
                                        validate23.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          validate23.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                          return false;
                                        }
                                      }
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                validate23.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.scopes !== void 0) {
              let data8 = data.scopes;
              const _errs20 = errors2;
              if (errors2 === _errs20) {
                if (Array.isArray(data8)) {
                  if (data8.length > 100) {
                    validate23.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" }];
                    return false;
                  } else {
                    if (data8.length < 1) {
                      validate23.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                      return false;
                    } else {
                      var valid3 = true;
                      const len0 = data8.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data9 = data8[i0];
                        const _errs22 = errors2;
                        const _errs23 = errors2;
                        if (errors2 === _errs23) {
                          if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                            let missing2;
                            if (data9.tenantId === void 0 && (missing2 = "tenantId") || data9.kind === void 0 && (missing2 = "kind") || data9.resourceId === void 0 && (missing2 = "resourceId") || data9.policyRevision === void 0 && (missing2 = "policyRevision")) {
                              validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                              return false;
                            } else {
                              const _errs25 = errors2;
                              for (const key2 in data9) {
                                if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                  validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs25 === errors2) {
                                if (data9.tenantId !== void 0) {
                                  let data10 = data9.tenantId;
                                  const _errs26 = errors2;
                                  if (errors2 === _errs26) {
                                    if (typeof data10 === "string") {
                                      if (func2(data10) > 128) {
                                        validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func2(data10) < 1) {
                                          validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid5 = _errs26 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data9.kind !== void 0) {
                                    let data11 = data9.kind;
                                    const _errs28 = errors2;
                                    if (typeof data11 !== "string") {
                                      validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                    if (!(data11 === "tenant" || data11 === "client" || data11 === "mailbox" || data11 === "memory" || data11 === "document" || data11 === "private-user" || data11 === "public")) {
                                      validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema36.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                      return false;
                                    }
                                    var valid5 = _errs28 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data9.resourceId !== void 0) {
                                      let data12 = data9.resourceId;
                                      const _errs30 = errors2;
                                      if (errors2 === _errs30) {
                                        if (typeof data12 === "string") {
                                          if (func2(data12) > 256) {
                                            validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data12) < 1) {
                                              validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid5 = _errs30 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data9.policyRevision !== void 0) {
                                        let data13 = data9.policyRevision;
                                        const _errs32 = errors2;
                                        if (errors2 === _errs32) {
                                          if (typeof data13 === "string") {
                                            if (func2(data13) > 128) {
                                              validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func2(data13) < 1) {
                                                validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid5 = _errs32 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate23.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid3 = _errs22 === errors2;
                        if (!valid3) {
                          break;
                        }
                      }
                      if (valid3) {
                        let i1 = data8.length;
                        let j0;
                        if (i1 > 1) {
                          outer0: for (; i1--; ) {
                            for (j0 = i1; j0--; ) {
                              if (func0(data8[i1], data8[j0])) {
                                validate23.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                return false;
                                break outer0;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate23.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs20 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.versions !== void 0) {
                let data14 = data.versions;
                const _errs34 = errors2;
                const _errs35 = errors2;
                if (errors2 === _errs35) {
                  if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                    let missing3;
                    if (data14.imageDigest === void 0 && (missing3 = "imageDigest") || data14.sdk === void 0 && (missing3 = "sdk") || data14.cli === void 0 && (missing3 = "cli") || data14.contracts === void 0 && (missing3 = "contracts") || data14.skillsDigest === void 0 && (missing3 = "skillsDigest") || data14.checkpointFormat === void 0 && (missing3 = "checkpointFormat")) {
                      validate23.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                      return false;
                    } else {
                      const _errs37 = errors2;
                      for (const key3 in data14) {
                        if (!(key3 === "imageDigest" || key3 === "sdk" || key3 === "cli" || key3 === "contracts" || key3 === "skillsDigest" || key3 === "checkpointFormat")) {
                          validate23.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs37 === errors2) {
                        if (data14.imageDigest !== void 0) {
                          let data15 = data14.imageDigest;
                          const _errs38 = errors2;
                          if (errors2 === _errs38) {
                            if (typeof data15 === "string") {
                              if (func2(data15) < 1) {
                                validate23.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              } else {
                                if (!pattern4.test(data15)) {
                                  validate23.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/pattern", keyword: "pattern", params: { pattern: "^sha256:[a-f0-9]{64}$" }, message: 'must match pattern "^sha256:[a-f0-9]{64}$"' }];
                                  return false;
                                }
                              }
                            } else {
                              validate23.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid8 = _errs38 === errors2;
                        } else {
                          var valid8 = true;
                        }
                        if (valid8) {
                          if (data14.sdk !== void 0) {
                            let data16 = data14.sdk;
                            const _errs40 = errors2;
                            if (errors2 === _errs40) {
                              if (typeof data16 === "string") {
                                if (!pattern5.test(data16)) {
                                  validate23.errors = [{ instancePath: instancePath + "/versions/sdk", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/sdk/pattern", keyword: "pattern", params: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }, message: 'must match pattern "^[0-9]+\\.[0-9]+\\.[0-9]+$"' }];
                                  return false;
                                }
                              } else {
                                validate23.errors = [{ instancePath: instancePath + "/versions/sdk", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/sdk/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid8 = _errs40 === errors2;
                          } else {
                            var valid8 = true;
                          }
                          if (valid8) {
                            if (data14.cli !== void 0) {
                              let data17 = data14.cli;
                              const _errs42 = errors2;
                              if (errors2 === _errs42) {
                                if (typeof data17 === "string") {
                                  if (!pattern5.test(data17)) {
                                    validate23.errors = [{ instancePath: instancePath + "/versions/cli", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/cli/pattern", keyword: "pattern", params: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }, message: 'must match pattern "^[0-9]+\\.[0-9]+\\.[0-9]+$"' }];
                                    return false;
                                  }
                                } else {
                                  validate23.errors = [{ instancePath: instancePath + "/versions/cli", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/cli/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid8 = _errs42 === errors2;
                            } else {
                              var valid8 = true;
                            }
                            if (valid8) {
                              if (data14.contracts !== void 0) {
                                const _errs44 = errors2;
                                if ("0.1.0" !== data14.contracts) {
                                  validate23.errors = [{ instancePath: instancePath + "/versions/contracts", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/contracts/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
                                  return false;
                                }
                                var valid8 = _errs44 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data14.skillsDigest !== void 0) {
                                  let data19 = data14.skillsDigest;
                                  const _errs45 = errors2;
                                  if (errors2 === _errs45) {
                                    if (typeof data19 === "string") {
                                      if (!pattern7.test(data19)) {
                                        validate23.errors = [{ instancePath: instancePath + "/versions/skillsDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/skillsDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate23.errors = [{ instancePath: instancePath + "/versions/skillsDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/skillsDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid8 = _errs45 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data14.checkpointFormat !== void 0) {
                                    const _errs47 = errors2;
                                    if ("0.1.0" !== data14.checkpointFormat) {
                                      validate23.errors = [{ instancePath: instancePath + "/versions/checkpointFormat", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/checkpointFormat/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
                                      return false;
                                    }
                                    var valid8 = _errs47 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate23.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs34 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.selectedClientId !== void 0) {
                  let data21 = data.selectedClientId;
                  const _errs48 = errors2;
                  if (errors2 === _errs48) {
                    if (typeof data21 === "string") {
                      if (!pattern8.test(data21)) {
                        validate23.errors = [{ instancePath: instancePath + "/selectedClientId", schemaPath: "#/properties/selectedClientId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                        return false;
                      }
                    } else {
                      validate23.errors = [{ instancePath: instancePath + "/selectedClientId", schemaPath: "#/properties/selectedClientId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs48 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.requestId !== void 0) {
                    let data22 = data.requestId;
                    const _errs50 = errors2;
                    if (errors2 === _errs50) {
                      if (typeof data22 === "string") {
                        if (!pattern8.test(data22)) {
                          validate23.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                          return false;
                        }
                      } else {
                        validate23.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid0 = _errs50 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.inputSha256 !== void 0) {
                      let data23 = data.inputSha256;
                      const _errs52 = errors2;
                      if (errors2 === _errs52) {
                        if (typeof data23 === "string") {
                          if (!pattern7.test(data23)) {
                            validate23.errors = [{ instancePath: instancePath + "/inputSha256", schemaPath: "#/properties/inputSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                            return false;
                          }
                        } else {
                          validate23.errors = [{ instancePath: instancePath + "/inputSha256", schemaPath: "#/properties/inputSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                      var valid0 = _errs52 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.requestSha256 !== void 0) {
                        let data24 = data.requestSha256;
                        const _errs54 = errors2;
                        if (errors2 === _errs54) {
                          if (typeof data24 === "string") {
                            if (!pattern7.test(data24)) {
                              validate23.errors = [{ instancePath: instancePath + "/requestSha256", schemaPath: "#/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                              return false;
                            }
                          } else {
                            validate23.errors = [{ instancePath: instancePath + "/requestSha256", schemaPath: "#/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs54 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.allocatedAtMs !== void 0) {
                          let data25 = data.allocatedAtMs;
                          const _errs56 = errors2;
                          if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                            validate23.errors = [{ instancePath: instancePath + "/allocatedAtMs", schemaPath: "#/properties/allocatedAtMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors2 === _errs56) {
                            if (typeof data25 == "number" && isFinite(data25)) {
                              if (data25 > 9007199254740991 || isNaN(data25)) {
                                validate23.errors = [{ instancePath: instancePath + "/allocatedAtMs", schemaPath: "#/properties/allocatedAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data25 < 0 || isNaN(data25)) {
                                  validate23.errors = [{ instancePath: instancePath + "/allocatedAtMs", schemaPath: "#/properties/allocatedAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid0 = _errs56 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.expiresAtMs !== void 0) {
                            let data26 = data.expiresAtMs;
                            const _errs58 = errors2;
                            if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                              validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors2 === _errs58) {
                              if (typeof data26 == "number" && isFinite(data26)) {
                                if (data26 > 9007199254740991 || isNaN(data26)) {
                                  validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data26 < 1 || isNaN(data26)) {
                                    validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid0 = _errs58 === errors2;
                          } else {
                            var valid0 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate23.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors2 === 0;
}
validate23.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.allocation === void 0 && (missing0 = "allocation") || data.state === void 0 && (missing0 = "state") || data.created === void 0 && (missing0 = "created")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "allocation" || key0 === "state" || key0 === "created")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.allocation !== void 0) {
            const _errs2 = errors2;
            if (!validate23(data.allocation, { instancePath: instancePath + "/allocation", parentData: data, parentDataProperty: "allocation", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.state !== void 0) {
              let data1 = data.state;
              const _errs3 = errors2;
              if (!(data1 === "RESERVED" || data1 === "ACCEPTED")) {
                validate27.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/enum", keyword: "enum", params: { allowedValues: schema33.properties.state.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.created !== void 0) {
                const _errs4 = errors2;
                if (typeof data.created !== "boolean") {
                  validate27.errors = [{ instancePath: instancePath + "/created", schemaPath: "#/properties/created/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                  return false;
                }
                var valid0 = _errs4 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors2 === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateError = validate29;
var schema39 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["NOT_FOUND", "METHOD_NOT_ALLOWED", "INVALID_REQUEST", "SESSION_REFUSED", "SCOPE_REFUSED", "SESSION_CHANGED", "STALE_WRITER", "INITIAL_INPUT_CONFLICT", "INITIAL_INPUT_ALREADY_EXISTS", "INITIAL_INPUT_EXPIRED", "DEADLINE", "CANCELLED", "INITIAL_INPUT_REQUIRED", "INITIAL_INPUT_CORRUPT", "INITIAL_INPUT_UNAVAILABLE", "REQUEST_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE"] }, "outcome": { "enum": ["NOT_DISPATCHED", "UNKNOWN"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate29(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.error === void 0 && (missing0 = "error")) {
        validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.error !== void 0) {
            let data0 = data.error;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.code === void 0 && (missing1 = "code") || data0.outcome === void 0 && (missing1 = "outcome")) {
                  validate29.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate29.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (!(data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "INVALID_REQUEST" || data1 === "SESSION_REFUSED" || data1 === "SCOPE_REFUSED" || data1 === "SESSION_CHANGED" || data1 === "STALE_WRITER" || data1 === "INITIAL_INPUT_CONFLICT" || data1 === "INITIAL_INPUT_ALREADY_EXISTS" || data1 === "INITIAL_INPUT_EXPIRED" || data1 === "DEADLINE" || data1 === "CANCELLED" || data1 === "INITIAL_INPUT_REQUIRED" || data1 === "INITIAL_INPUT_CORRUPT" || data1 === "INITIAL_INPUT_UNAVAILABLE" || data1 === "REQUEST_TOO_LARGE" || data1 === "UNSUPPORTED_MEDIA_TYPE")) {
                        validate29.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema39.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid1 = _errs5 === errors2;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        let data2 = data0.outcome;
                        const _errs6 = errors2;
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN")) {
                          validate29.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema39.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs6 === errors2;
                      } else {
                        var valid1 = true;
                      }
                    }
                  }
                }
              } else {
                validate29.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate29.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate29.errors = vErrors;
  return errors2 === 0;
}
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// node_modules/canonicalize/lib/canonicalize.js
function serializeString(value) {
  if (!value.isWellFormed()) {
    throw new Error("Lone surrogate is not allowed");
  }
  return JSON.stringify(value);
}
function serializePrimitive(value) {
  switch (typeof value) {
    case "number":
      if (isNaN(value)) {
        throw new Error("NaN is not allowed");
      }
      if (!isFinite(value)) {
        throw new Error("Infinity is not allowed");
      }
      return JSON.stringify(value);
    case "string":
      return serializeString(value);
    case "boolean":
      return value ? "true" : "false";
    default:
      return JSON.stringify(value);
  }
}
function enterValue(value, seen) {
  let wrappers = null;
  while (value !== null && typeof value === "object" && typeof value.toJSON === "function") {
    if (seen.has(value)) {
      throw new Error("Circular reference detected");
    }
    seen.add(value);
    (wrappers ??= []).push(value);
    value = value.toJSON();
  }
  if (value instanceof Number || value instanceof String || value instanceof Boolean) {
    value = value.valueOf();
  }
  if (value === null || typeof value !== "object") {
    if (wrappers !== null) {
      for (const wrapper of wrappers) seen.delete(wrapper);
    }
    return serializePrimitive(value);
  }
  if (seen.has(value)) {
    throw new Error("Circular reference detected");
  }
  seen.add(value);
  return {
    container: value,
    // null marks an array frame; object frames carry their sorted keys.
    // `sort()`'s default comparator orders by UTF-16 code unit, which is the
    // order JCS requires.
    keys: Array.isArray(value) ? null : Object.keys(value).sort(),
    // Next child to serialize; the frame resumes here after a nested
    // container's subtree completes.
    index: 0,
    // Whether no member has been emitted yet (controls comma placement).
    first: true,
    // toJSON wrappers to release from `seen` when this frame completes.
    wrappers
  };
}
function canonicalize(object) {
  if (object === null || typeof object !== "object") {
    return serializePrimitive(object);
  }
  const seen = /* @__PURE__ */ new Set();
  const root = enterValue(object, seen);
  if (typeof root !== "object") {
    return root;
  }
  let result = root.keys === null ? "[" : "{";
  const stack = [root];
  outer:
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const container = frame.container;
      if (frame.keys === null) {
        while (frame.index < container.length) {
          const i = frame.index++;
          if (i > 0) {
            result += ",";
          }
          const element = container[i];
          const value = element === void 0 || typeof element === "symbol" || typeof element === "function" ? null : element;
          if (value === null || typeof value !== "object") {
            result += serializePrimitive(value);
            continue;
          }
          const child = enterValue(value, seen);
          if (typeof child !== "object") {
            result += child === void 0 ? "null" : child;
            continue;
          }
          result += child.keys === null ? "[" : "{";
          stack.push(child);
          continue outer;
        }
        result += "]";
      } else {
        const keys = frame.keys;
        while (frame.index < keys.length) {
          const key = keys[frame.index++];
          const value = container[key];
          if (value === void 0 || typeof value === "symbol" || typeof value === "function") {
            continue;
          }
          if (value === null || typeof value !== "object") {
            if (frame.first) {
              frame.first = false;
            } else {
              result += ",";
            }
            result += serializeString(key) + ":" + serializePrimitive(value);
            continue;
          }
          const child = enterValue(value, seen);
          if (child === void 0) {
            continue;
          }
          if (frame.first) {
            frame.first = false;
          } else {
            result += ",";
          }
          result += serializeString(key) + ":";
          if (typeof child !== "object") {
            result += child;
            continue;
          }
          result += child.keys === null ? "[" : "{";
          stack.push(child);
          continue outer;
        }
        result += "}";
      }
      seen.delete(container);
      if (frame.wrappers !== null) {
        for (const wrapper of frame.wrappers) seen.delete(wrapper);
      }
      stack.pop();
    }
  return result;
}

// conversation-initial-input/semantics.mjs
import { receiveConversationInputRequest, receiveConversationInputResponse } from "./conversation-input.mjs";

// conversation-initial-input/protocol.mjs
import { conversationInputMetadata } from "./conversation-input.mjs";
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationInitialInputVersion = "1.0.0";
var conversationInitialInputPath = "/api/conversations/input/allocate";
var initialInputErrorStatuses = freeze({
  NOT_FOUND: [404],
  METHOD_NOT_ALLOWED: [405],
  INVALID_REQUEST: [400],
  SESSION_REFUSED: [401, 403],
  SCOPE_REFUSED: [403],
  SESSION_CHANGED: [403],
  STALE_WRITER: [403],
  INITIAL_INPUT_CONFLICT: [409],
  INITIAL_INPUT_ALREADY_EXISTS: [409],
  INITIAL_INPUT_EXPIRED: [408],
  DEADLINE: [408],
  CANCELLED: [408],
  INITIAL_INPUT_REQUIRED: [503],
  INITIAL_INPUT_CORRUPT: [503],
  INITIAL_INPUT_UNAVAILABLE: [503],
  REQUEST_TOO_LARGE: [413],
  UNSUPPORTED_MEDIA_TYPE: [415]
});
var initialInputUnknownCodes = Object.freeze(["DEADLINE", "CANCELLED", "INITIAL_INPUT_UNAVAILABLE", "INITIAL_INPUT_CORRUPT", "INITIAL_INPUT_REQUIRED"]);
var initialInputErrorOutcomes = freeze(Object.fromEntries(Object.keys(initialInputErrorStatuses).map((code) => [code, initialInputUnknownCodes.includes(code) ? "UNKNOWN" : "NOT_DISPATCHED"])));
var conversationInitialInputMetadata = freeze({
  packageVersion: "0.1.9",
  initialInputVersion: conversationInitialInputVersion,
  schemaId: "urn:meri:conversation-initial-input:1.0.0",
  routes: { allocate: { method: "POST", path: conversationInitialInputPath, response: "json" } },
  authentication: { ...conversationInputMetadata.authentication },
  limits: { requestBytes: 131072, responseBytes: 131072, maxRequestMs: 12e3 },
  bridge: { owner: "accepted conversation-input receiver", responseBytes: conversationInputMetadata.limits.responseBytes, viewOwner: "conversationInputView" },
  recovery: "only the exact retained immutable request with its genuine allocation proof; digests, UNKNOWN and absence do not create input authority",
  errorOutcomes: ["NOT_DISPATCHED", "UNKNOWN"],
  errorOutcomeByCode: initialInputErrorOutcomes,
  errorStatuses: initialInputErrorStatuses
});

// conversation-initial-input/semantics.mjs
var ConversationInitialInputResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ConversationInitialInputResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new ConversationInitialInputResponseError(code);
};
var requests = /* @__PURE__ */ new WeakMap();
var proofs = /* @__PURE__ */ new WeakMap();
var bytes = (value) => new TextEncoder().encode(value);
var same = (left, right) => canonicalize(left) === canonicalize(right);
var contextKeys = ["tenantId", "actorId", "conversationId", "runId", "clientId"];
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
async function hash(value) {
  const encoded = canonicalize(value);
  if (typeof encoded !== "string") fail2("INVALID_CANONICAL_INPUT");
  return digest(bytes(encoded));
}
function initialInputContext(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail2("INITIAL_INPUT_CONTEXT_INVALID");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), context = {};
    if (keys.length !== contextKeys.length || keys.some((key) => typeof key !== "string" || !contextKeys.includes(key))) fail2("INITIAL_INPUT_CONTEXT_INVALID");
    for (const key of contextKeys) {
      const d = descriptors[key];
      if (!d || !d.enumerable || !Object.hasOwn(d, "value") || typeof d.value !== "string") fail2("INITIAL_INPUT_CONTEXT_INVALID");
      context[key] = d.value;
    }
    if (["tenantId", "actorId"].some((key) => !context[key] || context[key].length > 128) || ["conversationId", "runId", "clientId"].some((key) => !uuid.test(context[key]))) fail2("INITIAL_INPUT_CONTEXT_INVALID");
    return Object.freeze(context);
  } catch (error) {
    if (error instanceof ConversationInitialInputResponseError) throw error;
    fail2("INITIAL_INPUT_CONTEXT_INVALID");
  }
}
function active(allocation, now) {
  const at = now();
  if (!Number.isSafeInteger(at) || at < allocation.allocatedAtMs || at >= allocation.expiresAtMs) fail2("INITIAL_INPUT_EXPIRED");
}
function facts(allocation) {
  const { binding, scopes, selectedClientId, allocatedAtMs, expiresAtMs } = allocation;
  if (binding.writerFence !== 1 || !Number.isSafeInteger(allocatedAtMs) || allocatedAtMs < 0 || !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= allocatedAtMs || scopes.some((scope) => scope.tenantId !== binding.tenantId || scope.policyRevision !== scopes[0].policyRevision) || new Set(scopes.map((scope) => canonicalize(scope))).size !== scopes.length || !scopes.some((scope) => scope.kind === "client" && scope.resourceId === selectedClientId)) fail2("INITIAL_INPUT_FACTS_MISMATCH");
}
function contextMatches(allocation, context) {
  const binding = allocation.binding;
  if (["tenantId", "actorId", "conversationId", "runId"].some((key) => binding[key] !== context[key]) || allocation.selectedClientId !== context.clientId) fail2("INITIAL_INPUT_CONTEXT_MISMATCH");
}
async function correlateInitialInputReceipt(receipt, request, { now = Date.now } = {}) {
  const allocation = receipt.allocation;
  facts(allocation);
  if (receipt.created && receipt.state !== "RESERVED") fail2("INITIAL_INPUT_STATE_MISMATCH");
  if (allocation.requestId !== request.requestId || allocation.inputSha256 !== await hash(request)) fail2("INITIAL_INPUT_REQUEST_MISMATCH");
  active(allocation, now);
  return receipt;
}
function receiveConversationInitialInputRequest(utf8Bytes) {
  const request = receiveConversationInputRequest(utf8Bytes);
  requests.set(request, { allocation: null, state: null, context: null });
  return request;
}
async function admitInitialInputResponse(status, receipt, request, expectedContext, { now = Date.now } = {}) {
  const record = requests.get(request);
  if (!record) fail2("UNADMITTED_INITIAL_INPUT_REQUEST");
  const context = initialInputContext(expectedContext);
  if (record.context && !same(record.context, context)) fail2("INITIAL_INPUT_CONTEXT_MISMATCH");
  if (!Number.isInteger(status) || status < 100 || status > 599) fail2("INVALID_STATUS");
  if (status !== 200) {
    const { code, outcome } = receipt.error;
    if (!Object.hasOwn(initialInputErrorStatuses, code) || !initialInputErrorStatuses[code].includes(status) || outcome === "UNKNOWN" && !initialInputUnknownCodes.includes(code)) fail2("INVALID_INITIAL_INPUT_ERROR");
    return receipt;
  }
  await correlateInitialInputReceipt(receipt, request, { now });
  contextMatches(receipt.allocation, context);
  if (record.context && !same(record.context, context) || record.allocation && !same(record.allocation, receipt.allocation)) fail2("INITIAL_INPUT_RECEIPT_DRIFT");
  if (record.allocation && (receipt.created || record.state === "ACCEPTED" && receipt.state !== "ACCEPTED")) fail2("INITIAL_INPUT_STATE_MISMATCH");
  active(receipt.allocation, now);
  record.allocation ??= receipt.allocation;
  record.context ??= context;
  record.state = receipt.state;
  proofs.set(receipt, { request, context, allocation: record.allocation });
  return receipt;
}
async function receiveAllocatedConversationInputResponse(status, utf8Bytes, request, expectedContext, allocationReceipt) {
  const proof = proofs.get(allocationReceipt), record = requests.get(request), context = initialInputContext(expectedContext);
  if (!proof || !record || proof.request !== request || !same(proof.context, context) || !same(record.allocation, proof.allocation)) fail2("UNADMITTED_INITIAL_INPUT_PROOF");
  active(proof.allocation, Date.now);
  const receipt = await receiveConversationInputResponse(status, utf8Bytes, request, expectedContext);
  if (Object.hasOwn(receipt, "error")) return receipt;
  const allocation = proof.allocation;
  if (!same(receipt.run.binding, allocation.binding) || !same(receipt.run.scopes, allocation.scopes) || !same(receipt.run.versions, allocation.versions) || receipt.request.requestId !== allocation.requestId || await hash(receipt.request) !== allocation.requestSha256) fail2("INITIAL_INPUT_ADMISSION_MISMATCH");
  active(allocation, Date.now);
  return receipt;
}

// conversation-initial-input/conversation-initial-input-receiver.mjs
async function receiveConversationInitialInputResponse(status, utf8Bytes, request, expectedContext) {
  let receipt;
  try {
    receipt = parseBytes(utf8Bytes, conversationInitialInputMetadata.limits.responseBytes);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
  if (!(status === 200 ? validateAllocatedResponse : validateError)(receipt)) fail2("INVALID_INITIAL_INPUT_RESPONSE");
  return admitInitialInputResponse(status, receipt, request, expectedContext);
}
export {
  ConversationInitialInputResponseError,
  conversationInitialInputMetadata,
  conversationInitialInputPath,
  conversationInitialInputVersion,
  receiveAllocatedConversationInputResponse,
  receiveConversationInitialInputRequest,
  receiveConversationInitialInputResponse
};
