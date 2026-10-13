// Generated browser receiving boundary; no authority.
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
  const bytes = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
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
async function digest(bytes) {
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, "0")).join("");
}

// conversation-lifecycle/conversation-lifecycle-receiver.mjs
import { createConversationCursor } from "./conversation-application.mjs";

// conversation-generated:./generated-validator.mjs
var validateControlRequest = validate30;
var pattern4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var pattern5 = new RegExp("\\S", "u");
var pattern6 = new RegExp("^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$", "u");
var pattern12 = new RegExp("^[a-f0-9]{64}$", "u");
var func1 = require_ucs2length().default;
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.controlId === void 0 && (missing0 = "controlId") || data.intent === void 0 && (missing0 = "intent") || data.text === void 0 && (missing0 = "text")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      } else {
        const _errs3 = errors2;
        for (const key0 in data) {
          if (!(key0 === "controlId" || key0 === "intent" || key0 === "text")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors2++;
            break;
          }
        }
        if (_errs3 === errors2) {
          if (data.controlId !== void 0) {
            let data0 = data.controlId;
            const _errs4 = errors2;
            if (errors2 === _errs4) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  const err2 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/0/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
              } else {
                const err3 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/0/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
              }
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.intent !== void 0) {
              const _errs6 = errors2;
              if ("steer" !== data.intent) {
                const err4 = { instancePath: instancePath + "/intent", schemaPath: "#/oneOf/0/properties/intent/const", keyword: "const", params: { allowedValue: "steer" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors2++;
              }
              var valid1 = _errs6 === errors2;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.text !== void 0) {
                let data2 = data.text;
                const _errs7 = errors2;
                const _errs9 = errors2;
                if (typeof data2 === "string") {
                  if (!pattern5.test(data2)) {
                    const err5 = { instancePath: instancePath + "/text", schemaPath: "#/oneOf/0/properties/text/allOf/0/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
                    if (vErrors === null) {
                      vErrors = [err5];
                    } else {
                      vErrors.push(err5);
                    }
                    errors2++;
                  }
                }
                var valid2 = _errs9 === errors2;
                if (valid2) {
                  const _errs10 = errors2;
                  if (typeof data2 === "string") {
                    if (!pattern6.test(data2)) {
                      const err6 = { instancePath: instancePath + "/text", schemaPath: "#/oneOf/0/properties/text/allOf/1/pattern", keyword: "pattern", params: { pattern: "^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$" }, message: 'must match pattern "^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$"' };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                    }
                  }
                  var valid2 = _errs10 === errors2;
                }
                if (errors2 === _errs7) {
                  if (typeof data2 === "string") {
                    if (func1(data2) > 1e5) {
                      const err7 = { instancePath: instancePath + "/text", schemaPath: "#/oneOf/0/properties/text/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                      if (vErrors === null) {
                        vErrors = [err7];
                      } else {
                        vErrors.push(err7);
                      }
                      errors2++;
                    } else {
                      if (func1(data2) < 1) {
                        const err8 = { instancePath: instancePath + "/text", schemaPath: "#/oneOf/0/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err8];
                        } else {
                          vErrors.push(err8);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err9 = { instancePath: instancePath + "/text", schemaPath: "#/oneOf/0/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err9];
                    } else {
                      vErrors.push(err9);
                    }
                    errors2++;
                  }
                }
                var valid1 = _errs7 === errors2;
              } else {
                var valid1 = true;
              }
            }
          }
        }
      }
    } else {
      const err10 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs11 = errors2;
  if (errors2 === _errs11) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.controlId === void 0 && (missing1 = "controlId") || data.intent === void 0 && (missing1 = "intent")) {
        const err11 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors2++;
      } else {
        const _errs13 = errors2;
        for (const key1 in data) {
          if (!(key1 === "controlId" || key1 === "intent")) {
            const err12 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors2++;
            break;
          }
        }
        if (_errs13 === errors2) {
          if (data.controlId !== void 0) {
            let data3 = data.controlId;
            const _errs14 = errors2;
            if (errors2 === _errs14) {
              if (typeof data3 === "string") {
                if (!pattern4.test(data3)) {
                  const err13 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/1/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                  if (vErrors === null) {
                    vErrors = [err13];
                  } else {
                    vErrors.push(err13);
                  }
                  errors2++;
                }
              } else {
                const err14 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/1/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors2++;
              }
            }
            var valid3 = _errs14 === errors2;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.intent !== void 0) {
              const _errs16 = errors2;
              if ("pause" !== data.intent) {
                const err15 = { instancePath: instancePath + "/intent", schemaPath: "#/oneOf/1/properties/intent/const", keyword: "const", params: { allowedValue: "pause" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors2++;
              }
              var valid3 = _errs16 === errors2;
            } else {
              var valid3 = true;
            }
          }
        }
      }
    } else {
      const err16 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors2++;
    }
  }
  var _valid0 = _errs11 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs17 = errors2;
    if (errors2 === _errs17) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.controlId === void 0 && (missing2 = "controlId") || data.intent === void 0 && (missing2 = "intent") || data.proposalId === void 0 && (missing2 = "proposalId")) {
          const err17 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors2++;
        } else {
          const _errs19 = errors2;
          for (const key2 in data) {
            if (!(key2 === "controlId" || key2 === "intent" || key2 === "proposalId")) {
              const err18 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors2++;
              break;
            }
          }
          if (_errs19 === errors2) {
            if (data.controlId !== void 0) {
              let data5 = data.controlId;
              const _errs20 = errors2;
              if (errors2 === _errs20) {
                if (typeof data5 === "string") {
                  if (!pattern4.test(data5)) {
                    const err19 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/2/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors2++;
                  }
                } else {
                  const err20 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/2/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err20];
                  } else {
                    vErrors.push(err20);
                  }
                  errors2++;
                }
              }
              var valid4 = _errs20 === errors2;
            } else {
              var valid4 = true;
            }
            if (valid4) {
              if (data.intent !== void 0) {
                const _errs22 = errors2;
                if ("approval.wait" !== data.intent) {
                  const err21 = { instancePath: instancePath + "/intent", schemaPath: "#/oneOf/2/properties/intent/const", keyword: "const", params: { allowedValue: "approval.wait" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err21];
                  } else {
                    vErrors.push(err21);
                  }
                  errors2++;
                }
                var valid4 = _errs22 === errors2;
              } else {
                var valid4 = true;
              }
              if (valid4) {
                if (data.proposalId !== void 0) {
                  let data7 = data.proposalId;
                  const _errs23 = errors2;
                  if (errors2 === _errs23) {
                    if (typeof data7 === "string") {
                      if (!pattern4.test(data7)) {
                        const err22 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/2/properties/proposalId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err22];
                        } else {
                          vErrors.push(err22);
                        }
                        errors2++;
                      }
                    } else {
                      const err23 = { instancePath: instancePath + "/proposalId", schemaPath: "#/oneOf/2/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err23];
                      } else {
                        vErrors.push(err23);
                      }
                      errors2++;
                    }
                  }
                  var valid4 = _errs23 === errors2;
                } else {
                  var valid4 = true;
                }
              }
            }
          }
        }
      } else {
        const err24 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors2++;
      }
    }
    var _valid0 = _errs17 === errors2;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs25 = errors2;
      if (errors2 === _errs25) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing3;
          if (data.controlId === void 0 && (missing3 = "controlId") || data.intent === void 0 && (missing3 = "intent") || data.checkpointId === void 0 && (missing3 = "checkpointId") || data.checkpointSha256 === void 0 && (missing3 = "checkpointSha256")) {
            const err25 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors2++;
          } else {
            const _errs27 = errors2;
            for (const key3 in data) {
              if (!(key3 === "controlId" || key3 === "intent" || key3 === "checkpointId" || key3 === "checkpointSha256")) {
                const err26 = { instancePath, schemaPath: "#/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors2++;
                break;
              }
            }
            if (_errs27 === errors2) {
              if (data.controlId !== void 0) {
                let data8 = data.controlId;
                const _errs28 = errors2;
                if (errors2 === _errs28) {
                  if (typeof data8 === "string") {
                    if (!pattern4.test(data8)) {
                      const err27 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/3/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err27];
                      } else {
                        vErrors.push(err27);
                      }
                      errors2++;
                    }
                  } else {
                    const err28 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/3/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err28];
                    } else {
                      vErrors.push(err28);
                    }
                    errors2++;
                  }
                }
                var valid5 = _errs28 === errors2;
              } else {
                var valid5 = true;
              }
              if (valid5) {
                if (data.intent !== void 0) {
                  const _errs30 = errors2;
                  if ("resume" !== data.intent) {
                    const err29 = { instancePath: instancePath + "/intent", schemaPath: "#/oneOf/3/properties/intent/const", keyword: "const", params: { allowedValue: "resume" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err29];
                    } else {
                      vErrors.push(err29);
                    }
                    errors2++;
                  }
                  var valid5 = _errs30 === errors2;
                } else {
                  var valid5 = true;
                }
                if (valid5) {
                  if (data.checkpointId !== void 0) {
                    let data10 = data.checkpointId;
                    const _errs31 = errors2;
                    if (errors2 === _errs31) {
                      if (typeof data10 === "string") {
                        if (!pattern4.test(data10)) {
                          const err30 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/oneOf/3/properties/checkpointId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                          if (vErrors === null) {
                            vErrors = [err30];
                          } else {
                            vErrors.push(err30);
                          }
                          errors2++;
                        }
                      } else {
                        const err31 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/oneOf/3/properties/checkpointId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err31];
                        } else {
                          vErrors.push(err31);
                        }
                        errors2++;
                      }
                    }
                    var valid5 = _errs31 === errors2;
                  } else {
                    var valid5 = true;
                  }
                  if (valid5) {
                    if (data.checkpointSha256 !== void 0) {
                      let data11 = data.checkpointSha256;
                      const _errs33 = errors2;
                      if (errors2 === _errs33) {
                        if (typeof data11 === "string") {
                          if (!pattern12.test(data11)) {
                            const err32 = { instancePath: instancePath + "/checkpointSha256", schemaPath: "#/oneOf/3/properties/checkpointSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                            if (vErrors === null) {
                              vErrors = [err32];
                            } else {
                              vErrors.push(err32);
                            }
                            errors2++;
                          }
                        } else {
                          const err33 = { instancePath: instancePath + "/checkpointSha256", schemaPath: "#/oneOf/3/properties/checkpointSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err33];
                          } else {
                            vErrors.push(err33);
                          }
                          errors2++;
                        }
                      }
                      var valid5 = _errs33 === errors2;
                    } else {
                      var valid5 = true;
                    }
                  }
                }
              }
            }
          }
        } else {
          const err34 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors2++;
        }
      }
      var _valid0 = _errs25 === errors2;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs35 = errors2;
        if (errors2 === _errs35) {
          if (data && typeof data == "object" && !Array.isArray(data)) {
            let missing4;
            if (data.controlId === void 0 && (missing4 = "controlId") || data.intent === void 0 && (missing4 = "intent") || data.checkpointId === void 0 && (missing4 = "checkpointId") || data.checkpointSha256 === void 0 && (missing4 = "checkpointSha256")) {
              const err35 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors2++;
            } else {
              const _errs37 = errors2;
              for (const key4 in data) {
                if (!(key4 === "controlId" || key4 === "intent" || key4 === "checkpointId" || key4 === "checkpointSha256")) {
                  const err36 = { instancePath, schemaPath: "#/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                  if (vErrors === null) {
                    vErrors = [err36];
                  } else {
                    vErrors.push(err36);
                  }
                  errors2++;
                  break;
                }
              }
              if (_errs37 === errors2) {
                if (data.controlId !== void 0) {
                  let data12 = data.controlId;
                  const _errs38 = errors2;
                  if (errors2 === _errs38) {
                    if (typeof data12 === "string") {
                      if (!pattern4.test(data12)) {
                        const err37 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/4/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err37];
                        } else {
                          vErrors.push(err37);
                        }
                        errors2++;
                      }
                    } else {
                      const err38 = { instancePath: instancePath + "/controlId", schemaPath: "#/oneOf/4/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err38];
                      } else {
                        vErrors.push(err38);
                      }
                      errors2++;
                    }
                  }
                  var valid6 = _errs38 === errors2;
                } else {
                  var valid6 = true;
                }
                if (valid6) {
                  if (data.intent !== void 0) {
                    const _errs40 = errors2;
                    if ("fork" !== data.intent) {
                      const err39 = { instancePath: instancePath + "/intent", schemaPath: "#/oneOf/4/properties/intent/const", keyword: "const", params: { allowedValue: "fork" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err39];
                      } else {
                        vErrors.push(err39);
                      }
                      errors2++;
                    }
                    var valid6 = _errs40 === errors2;
                  } else {
                    var valid6 = true;
                  }
                  if (valid6) {
                    if (data.checkpointId !== void 0) {
                      let data14 = data.checkpointId;
                      const _errs41 = errors2;
                      if (errors2 === _errs41) {
                        if (typeof data14 === "string") {
                          if (!pattern4.test(data14)) {
                            const err40 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/oneOf/4/properties/checkpointId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                            if (vErrors === null) {
                              vErrors = [err40];
                            } else {
                              vErrors.push(err40);
                            }
                            errors2++;
                          }
                        } else {
                          const err41 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/oneOf/4/properties/checkpointId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err41];
                          } else {
                            vErrors.push(err41);
                          }
                          errors2++;
                        }
                      }
                      var valid6 = _errs41 === errors2;
                    } else {
                      var valid6 = true;
                    }
                    if (valid6) {
                      if (data.checkpointSha256 !== void 0) {
                        let data15 = data.checkpointSha256;
                        const _errs43 = errors2;
                        if (errors2 === _errs43) {
                          if (typeof data15 === "string") {
                            if (!pattern12.test(data15)) {
                              const err42 = { instancePath: instancePath + "/checkpointSha256", schemaPath: "#/oneOf/4/properties/checkpointSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err42];
                              } else {
                                vErrors.push(err42);
                              }
                              errors2++;
                            }
                          } else {
                            const err43 = { instancePath: instancePath + "/checkpointSha256", schemaPath: "#/oneOf/4/properties/checkpointSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err43];
                            } else {
                              vErrors.push(err43);
                            }
                            errors2++;
                          }
                        }
                        var valid6 = _errs43 === errors2;
                      } else {
                        var valid6 = true;
                      }
                    }
                  }
                }
              }
            }
          } else {
            const err44 = { instancePath, schemaPath: "#/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors2++;
          }
        }
        var _valid0 = _errs35 === errors2;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err45 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err45];
    } else {
      vErrors.push(err45);
    }
    errors2++;
    validate30.errors = vErrors;
    return false;
  } else {
    errors2 = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate30.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate30.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateControlReceipt = validate31;
var schema35 = { "type": "object", "properties": { "controlId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "intent": { "enum": ["steer", "pause", "approval.wait", "resume", "fork"] }, "sourceBinding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "inputSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "state": { "enum": ["PENDING", "DISPATCHING", "APPLIED", "UNKNOWN"] }, "checkpointId": { "anyOf": [{ "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, { "type": "null" }] }, "targetBinding": { "anyOf": [{ "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, { "type": "null" }] }, "admissionReceiptId": { "anyOf": [{ "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, { "type": "null" }] }, "retirementReceiptId": { "anyOf": [{ "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, { "type": "null" }] }, "replayed": { "type": "boolean" } }, "required": ["controlId", "intent", "sourceBinding", "inputSha256", "state", "checkpointId", "targetBinding", "admissionReceiptId", "retirementReceiptId", "replayed"], "additionalProperties": false };
var func3 = Object.prototype.hasOwnProperty;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.controlId === void 0 && (missing0 = "controlId") || data.intent === void 0 && (missing0 = "intent") || data.sourceBinding === void 0 && (missing0 = "sourceBinding") || data.inputSha256 === void 0 && (missing0 = "inputSha256") || data.state === void 0 && (missing0 = "state") || data.checkpointId === void 0 && (missing0 = "checkpointId") || data.targetBinding === void 0 && (missing0 = "targetBinding") || data.admissionReceiptId === void 0 && (missing0 = "admissionReceiptId") || data.retirementReceiptId === void 0 && (missing0 = "retirementReceiptId") || data.replayed === void 0 && (missing0 = "replayed")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func3.call(schema35.properties, key0)) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.controlId !== void 0) {
            let data0 = data.controlId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate31.errors = [{ instancePath: instancePath + "/controlId", schemaPath: "#/properties/controlId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate31.errors = [{ instancePath: instancePath + "/controlId", schemaPath: "#/properties/controlId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.intent !== void 0) {
              let data1 = data.intent;
              const _errs4 = errors2;
              if (!(data1 === "steer" || data1 === "pause" || data1 === "approval.wait" || data1 === "resume" || data1 === "fork")) {
                validate31.errors = [{ instancePath: instancePath + "/intent", schemaPath: "#/properties/intent/enum", keyword: "enum", params: { allowedValues: schema35.properties.intent.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sourceBinding !== void 0) {
                let data2 = data.sourceBinding;
                const _errs5 = errors2;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
                      validate31.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate31.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs8 === errors2) {
                        if (data2.tenantId !== void 0) {
                          let data3 = data2.tenantId;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 128) {
                                validate31.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate31.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate31.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data2.actorId !== void 0) {
                            let data4 = data2.actorId;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (typeof data4 === "string") {
                                if (func1(data4) > 128) {
                                  validate31.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate31.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate31.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data2.conversationId !== void 0) {
                              let data5 = data2.conversationId;
                              const _errs13 = errors2;
                              if (errors2 === _errs13) {
                                if (errors2 === _errs13) {
                                  if (typeof data5 === "string") {
                                    if (!formats0.test(data5)) {
                                      validate31.errors = [{ instancePath: instancePath + "/sourceBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate31.errors = [{ instancePath: instancePath + "/sourceBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data2.runId !== void 0) {
                                let data6 = data2.runId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (errors2 === _errs15) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        validate31.errors = [{ instancePath: instancePath + "/sourceBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/sourceBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data2.attemptId !== void 0) {
                                  let data7 = data2.attemptId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (errors2 === _errs17) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate31.errors = [{ instancePath: instancePath + "/sourceBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate31.errors = [{ instancePath: instancePath + "/sourceBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data2.workerId !== void 0) {
                                    let data8 = data2.workerId;
                                    const _errs19 = errors2;
                                    if (errors2 === _errs19) {
                                      if (errors2 === _errs19) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate31.errors = [{ instancePath: instancePath + "/sourceBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate31.errors = [{ instancePath: instancePath + "/sourceBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid2 = _errs19 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data2.writerFence !== void 0) {
                                      let data9 = data2.writerFence;
                                      const _errs21 = errors2;
                                      if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                                        validate31.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate31.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate31.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid2 = _errs21 === errors2;
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
                    validate31.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.inputSha256 !== void 0) {
                  let data10 = data.inputSha256;
                  const _errs23 = errors2;
                  if (errors2 === _errs23) {
                    if (typeof data10 === "string") {
                      if (!pattern12.test(data10)) {
                        validate31.errors = [{ instancePath: instancePath + "/inputSha256", schemaPath: "#/properties/inputSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                        return false;
                      }
                    } else {
                      validate31.errors = [{ instancePath: instancePath + "/inputSha256", schemaPath: "#/properties/inputSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.state !== void 0) {
                    let data11 = data.state;
                    const _errs25 = errors2;
                    if (!(data11 === "PENDING" || data11 === "DISPATCHING" || data11 === "APPLIED" || data11 === "UNKNOWN")) {
                      validate31.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/enum", keyword: "enum", params: { allowedValues: schema35.properties.state.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs25 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.checkpointId !== void 0) {
                      let data12 = data.checkpointId;
                      const _errs26 = errors2;
                      const _errs27 = errors2;
                      let valid3 = false;
                      const _errs28 = errors2;
                      if (errors2 === _errs28) {
                        if (typeof data12 === "string") {
                          if (!pattern4.test(data12)) {
                            const err0 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          }
                        } else {
                          const err1 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs28 === errors2;
                      valid3 = valid3 || _valid0;
                      const _errs30 = errors2;
                      if (data12 !== null) {
                        const err2 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                      var _valid0 = _errs30 === errors2;
                      valid3 = valid3 || _valid0;
                      if (!valid3) {
                        const err3 = { instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors2++;
                        validate31.errors = vErrors;
                        return false;
                      } else {
                        errors2 = _errs27;
                        if (vErrors !== null) {
                          if (_errs27) {
                            vErrors.length = _errs27;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs26 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.targetBinding !== void 0) {
                        let data13 = data.targetBinding;
                        const _errs32 = errors2;
                        const _errs33 = errors2;
                        let valid4 = false;
                        const _errs34 = errors2;
                        const _errs35 = errors2;
                        if (errors2 === _errs35) {
                          if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
                            let missing2;
                            if (data13.tenantId === void 0 && (missing2 = "tenantId") || data13.actorId === void 0 && (missing2 = "actorId") || data13.conversationId === void 0 && (missing2 = "conversationId") || data13.runId === void 0 && (missing2 = "runId") || data13.attemptId === void 0 && (missing2 = "attemptId") || data13.workerId === void 0 && (missing2 = "workerId") || data13.writerFence === void 0 && (missing2 = "writerFence")) {
                              const err4 = { instancePath: instancePath + "/targetBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            } else {
                              const _errs37 = errors2;
                              for (const key2 in data13) {
                                if (!(key2 === "tenantId" || key2 === "actorId" || key2 === "conversationId" || key2 === "runId" || key2 === "attemptId" || key2 === "workerId" || key2 === "writerFence")) {
                                  const err5 = { instancePath: instancePath + "/targetBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err5];
                                  } else {
                                    vErrors.push(err5);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs37 === errors2) {
                                if (data13.tenantId !== void 0) {
                                  let data14 = data13.tenantId;
                                  const _errs38 = errors2;
                                  if (errors2 === _errs38) {
                                    if (typeof data14 === "string") {
                                      if (func1(data14) > 128) {
                                        const err6 = { instancePath: instancePath + "/targetBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err6];
                                        } else {
                                          vErrors.push(err6);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data14) < 1) {
                                          const err7 = { instancePath: instancePath + "/targetBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err7];
                                          } else {
                                            vErrors.push(err7);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err8 = { instancePath: instancePath + "/targetBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err8];
                                      } else {
                                        vErrors.push(err8);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid6 = _errs38 === errors2;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data13.actorId !== void 0) {
                                    let data15 = data13.actorId;
                                    const _errs40 = errors2;
                                    if (errors2 === _errs40) {
                                      if (typeof data15 === "string") {
                                        if (func1(data15) > 128) {
                                          const err9 = { instancePath: instancePath + "/targetBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err9];
                                          } else {
                                            vErrors.push(err9);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data15) < 1) {
                                            const err10 = { instancePath: instancePath + "/targetBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err10];
                                            } else {
                                              vErrors.push(err10);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err11 = { instancePath: instancePath + "/targetBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err11];
                                        } else {
                                          vErrors.push(err11);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid6 = _errs40 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data13.conversationId !== void 0) {
                                      let data16 = data13.conversationId;
                                      const _errs42 = errors2;
                                      if (errors2 === _errs42) {
                                        if (errors2 === _errs42) {
                                          if (typeof data16 === "string") {
                                            if (!formats0.test(data16)) {
                                              const err12 = { instancePath: instancePath + "/targetBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                              if (vErrors === null) {
                                                vErrors = [err12];
                                              } else {
                                                vErrors.push(err12);
                                              }
                                              errors2++;
                                            }
                                          } else {
                                            const err13 = { instancePath: instancePath + "/targetBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err13];
                                            } else {
                                              vErrors.push(err13);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid6 = _errs42 === errors2;
                                    } else {
                                      var valid6 = true;
                                    }
                                    if (valid6) {
                                      if (data13.runId !== void 0) {
                                        let data17 = data13.runId;
                                        const _errs44 = errors2;
                                        if (errors2 === _errs44) {
                                          if (errors2 === _errs44) {
                                            if (typeof data17 === "string") {
                                              if (!formats0.test(data17)) {
                                                const err14 = { instancePath: instancePath + "/targetBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                if (vErrors === null) {
                                                  vErrors = [err14];
                                                } else {
                                                  vErrors.push(err14);
                                                }
                                                errors2++;
                                              }
                                            } else {
                                              const err15 = { instancePath: instancePath + "/targetBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err15];
                                              } else {
                                                vErrors.push(err15);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid6 = _errs44 === errors2;
                                      } else {
                                        var valid6 = true;
                                      }
                                      if (valid6) {
                                        if (data13.attemptId !== void 0) {
                                          let data18 = data13.attemptId;
                                          const _errs46 = errors2;
                                          if (errors2 === _errs46) {
                                            if (errors2 === _errs46) {
                                              if (typeof data18 === "string") {
                                                if (!formats0.test(data18)) {
                                                  const err16 = { instancePath: instancePath + "/targetBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err16];
                                                  } else {
                                                    vErrors.push(err16);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err17 = { instancePath: instancePath + "/targetBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err17];
                                                } else {
                                                  vErrors.push(err17);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                          var valid6 = _errs46 === errors2;
                                        } else {
                                          var valid6 = true;
                                        }
                                        if (valid6) {
                                          if (data13.workerId !== void 0) {
                                            let data19 = data13.workerId;
                                            const _errs48 = errors2;
                                            if (errors2 === _errs48) {
                                              if (errors2 === _errs48) {
                                                if (typeof data19 === "string") {
                                                  if (!formats0.test(data19)) {
                                                    const err18 = { instancePath: instancePath + "/targetBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err18];
                                                    } else {
                                                      vErrors.push(err18);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err19 = { instancePath: instancePath + "/targetBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err19];
                                                  } else {
                                                    vErrors.push(err19);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                            var valid6 = _errs48 === errors2;
                                          } else {
                                            var valid6 = true;
                                          }
                                          if (valid6) {
                                            if (data13.writerFence !== void 0) {
                                              let data20 = data13.writerFence;
                                              const _errs50 = errors2;
                                              if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
                                                const err20 = { instancePath: instancePath + "/targetBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                if (vErrors === null) {
                                                  vErrors = [err20];
                                                } else {
                                                  vErrors.push(err20);
                                                }
                                                errors2++;
                                              }
                                              if (errors2 === _errs50) {
                                                if (typeof data20 == "number" && isFinite(data20)) {
                                                  if (data20 > 9007199254740991 || isNaN(data20)) {
                                                    const err21 = { instancePath: instancePath + "/targetBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                    if (vErrors === null) {
                                                      vErrors = [err21];
                                                    } else {
                                                      vErrors.push(err21);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    if (data20 < 1 || isNaN(data20)) {
                                                      const err22 = { instancePath: instancePath + "/targetBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                      if (vErrors === null) {
                                                        vErrors = [err22];
                                                      } else {
                                                        vErrors.push(err22);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid6 = _errs50 === errors2;
                                            } else {
                                              var valid6 = true;
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
                            const err23 = { instancePath: instancePath + "/targetBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err23];
                            } else {
                              vErrors.push(err23);
                            }
                            errors2++;
                          }
                        }
                        var _valid1 = _errs34 === errors2;
                        valid4 = valid4 || _valid1;
                        const _errs52 = errors2;
                        if (data13 !== null) {
                          const err24 = { instancePath: instancePath + "/targetBinding", schemaPath: "#/properties/targetBinding/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err24];
                          } else {
                            vErrors.push(err24);
                          }
                          errors2++;
                        }
                        var _valid1 = _errs52 === errors2;
                        valid4 = valid4 || _valid1;
                        if (!valid4) {
                          const err25 = { instancePath: instancePath + "/targetBinding", schemaPath: "#/properties/targetBinding/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err25];
                          } else {
                            vErrors.push(err25);
                          }
                          errors2++;
                          validate31.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs33;
                          if (vErrors !== null) {
                            if (_errs33) {
                              vErrors.length = _errs33;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs32 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.admissionReceiptId !== void 0) {
                          let data21 = data.admissionReceiptId;
                          const _errs54 = errors2;
                          const _errs55 = errors2;
                          let valid7 = false;
                          const _errs56 = errors2;
                          if (errors2 === _errs56) {
                            if (typeof data21 === "string") {
                              if (!pattern4.test(data21)) {
                                const err26 = { instancePath: instancePath + "/admissionReceiptId", schemaPath: "#/properties/admissionReceiptId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                if (vErrors === null) {
                                  vErrors = [err26];
                                } else {
                                  vErrors.push(err26);
                                }
                                errors2++;
                              }
                            } else {
                              const err27 = { instancePath: instancePath + "/admissionReceiptId", schemaPath: "#/properties/admissionReceiptId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err27];
                              } else {
                                vErrors.push(err27);
                              }
                              errors2++;
                            }
                          }
                          var _valid2 = _errs56 === errors2;
                          valid7 = valid7 || _valid2;
                          const _errs58 = errors2;
                          if (data21 !== null) {
                            const err28 = { instancePath: instancePath + "/admissionReceiptId", schemaPath: "#/properties/admissionReceiptId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                            if (vErrors === null) {
                              vErrors = [err28];
                            } else {
                              vErrors.push(err28);
                            }
                            errors2++;
                          }
                          var _valid2 = _errs58 === errors2;
                          valid7 = valid7 || _valid2;
                          if (!valid7) {
                            const err29 = { instancePath: instancePath + "/admissionReceiptId", schemaPath: "#/properties/admissionReceiptId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err29];
                            } else {
                              vErrors.push(err29);
                            }
                            errors2++;
                            validate31.errors = vErrors;
                            return false;
                          } else {
                            errors2 = _errs55;
                            if (vErrors !== null) {
                              if (_errs55) {
                                vErrors.length = _errs55;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs54 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.retirementReceiptId !== void 0) {
                            let data22 = data.retirementReceiptId;
                            const _errs60 = errors2;
                            const _errs61 = errors2;
                            let valid8 = false;
                            const _errs62 = errors2;
                            if (errors2 === _errs62) {
                              if (typeof data22 === "string") {
                                if (!pattern4.test(data22)) {
                                  const err30 = { instancePath: instancePath + "/retirementReceiptId", schemaPath: "#/properties/retirementReceiptId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err30];
                                  } else {
                                    vErrors.push(err30);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err31 = { instancePath: instancePath + "/retirementReceiptId", schemaPath: "#/properties/retirementReceiptId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err31];
                                } else {
                                  vErrors.push(err31);
                                }
                                errors2++;
                              }
                            }
                            var _valid3 = _errs62 === errors2;
                            valid8 = valid8 || _valid3;
                            const _errs64 = errors2;
                            if (data22 !== null) {
                              const err32 = { instancePath: instancePath + "/retirementReceiptId", schemaPath: "#/properties/retirementReceiptId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err32];
                              } else {
                                vErrors.push(err32);
                              }
                              errors2++;
                            }
                            var _valid3 = _errs64 === errors2;
                            valid8 = valid8 || _valid3;
                            if (!valid8) {
                              const err33 = { instancePath: instancePath + "/retirementReceiptId", schemaPath: "#/properties/retirementReceiptId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                              if (vErrors === null) {
                                vErrors = [err33];
                              } else {
                                vErrors.push(err33);
                              }
                              errors2++;
                              validate31.errors = vErrors;
                              return false;
                            } else {
                              errors2 = _errs61;
                              if (vErrors !== null) {
                                if (_errs61) {
                                  vErrors.length = _errs61;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid0 = _errs60 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.replayed !== void 0) {
                              const _errs66 = errors2;
                              if (typeof data.replayed !== "boolean") {
                                validate31.errors = [{ instancePath: instancePath + "/replayed", schemaPath: "#/properties/replayed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                return false;
                              }
                              var valid0 = _errs66 === errors2;
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
      }
    } else {
      validate31.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors2 === 0;
}
validate31.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateInspectionRequest = validate32;
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.checkpointId === void 0 && (missing0 = "checkpointId")) {
        validate32.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "checkpointId")) {
            validate32.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.checkpointId !== void 0) {
            let data0 = data.checkpointId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate32.errors = [{ instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate32.errors = [{ instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate32.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate32.errors = vErrors;
  return errors2 === 0;
}
validate32.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateInspectionReceipt = validate33;
function validate33(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.checkpointId === void 0 && (missing0 = "checkpointId") || data.checkpointSha256 === void 0 && (missing0 = "checkpointSha256") || data.sourceBinding === void 0 && (missing0 = "sourceBinding") || data.lastEventSequence === void 0 && (missing0 = "lastEventSequence")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "checkpointId" || key0 === "checkpointSha256" || key0 === "sourceBinding" || key0 === "lastEventSequence")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.checkpointId !== void 0) {
            let data0 = data.checkpointId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate33.errors = [{ instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate33.errors = [{ instancePath: instancePath + "/checkpointId", schemaPath: "#/properties/checkpointId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.checkpointSha256 !== void 0) {
              let data1 = data.checkpointSha256;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern12.test(data1)) {
                    validate33.errors = [{ instancePath: instancePath + "/checkpointSha256", schemaPath: "#/properties/checkpointSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate33.errors = [{ instancePath: instancePath + "/checkpointSha256", schemaPath: "#/properties/checkpointSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sourceBinding !== void 0) {
                let data2 = data.sourceBinding;
                const _errs6 = errors2;
                const _errs7 = errors2;
                if (errors2 === _errs7) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
                      validate33.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs9 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate33.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs9 === errors2) {
                        if (data2.tenantId !== void 0) {
                          let data3 = data2.tenantId;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 128) {
                                validate33.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate33.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate33.errors = [{ instancePath: instancePath + "/sourceBinding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data2.actorId !== void 0) {
                            let data4 = data2.actorId;
                            const _errs12 = errors2;
                            if (errors2 === _errs12) {
                              if (typeof data4 === "string") {
                                if (func1(data4) > 128) {
                                  validate33.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate33.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate33.errors = [{ instancePath: instancePath + "/sourceBinding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data2.conversationId !== void 0) {
                              let data5 = data2.conversationId;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (errors2 === _errs14) {
                                  if (typeof data5 === "string") {
                                    if (!formats0.test(data5)) {
                                      validate33.errors = [{ instancePath: instancePath + "/sourceBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate33.errors = [{ instancePath: instancePath + "/sourceBinding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid2 = _errs14 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data2.runId !== void 0) {
                                let data6 = data2.runId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (errors2 === _errs16) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        validate33.errors = [{ instancePath: instancePath + "/sourceBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate33.errors = [{ instancePath: instancePath + "/sourceBinding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data2.attemptId !== void 0) {
                                  let data7 = data2.attemptId;
                                  const _errs18 = errors2;
                                  if (errors2 === _errs18) {
                                    if (errors2 === _errs18) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate33.errors = [{ instancePath: instancePath + "/sourceBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate33.errors = [{ instancePath: instancePath + "/sourceBinding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data2.workerId !== void 0) {
                                    let data8 = data2.workerId;
                                    const _errs20 = errors2;
                                    if (errors2 === _errs20) {
                                      if (errors2 === _errs20) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate33.errors = [{ instancePath: instancePath + "/sourceBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate33.errors = [{ instancePath: instancePath + "/sourceBinding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid2 = _errs20 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data2.writerFence !== void 0) {
                                      let data9 = data2.writerFence;
                                      const _errs22 = errors2;
                                      if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                                        validate33.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs22) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate33.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate33.errors = [{ instancePath: instancePath + "/sourceBinding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid2 = _errs22 === errors2;
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
                    validate33.errors = [{ instancePath: instancePath + "/sourceBinding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.lastEventSequence !== void 0) {
                  let data10 = data.lastEventSequence;
                  const _errs24 = errors2;
                  if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                    validate33.errors = [{ instancePath: instancePath + "/lastEventSequence", schemaPath: "#/properties/lastEventSequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs24) {
                    if (typeof data10 == "number" && isFinite(data10)) {
                      if (data10 > 9007199254740991 || isNaN(data10)) {
                        validate33.errors = [{ instancePath: instancePath + "/lastEventSequence", schemaPath: "#/properties/lastEventSequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data10 < 1 || isNaN(data10)) {
                          validate33.errors = [{ instancePath: instancePath + "/lastEventSequence", schemaPath: "#/properties/lastEventSequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs24 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors2 === 0;
}
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateError = validate34;
var schema44 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["NOT_FOUND", "METHOD_NOT_ALLOWED", "SESSION_REFUSED", "UNSUPPORTED_MEDIA_TYPE", "LIFECYCLE_INPUT_REFUSED", "REQUEST_TOO_LARGE", "SESSION_CHANGED", "SCOPE_REFUSED", "STALE_WRITER", "LIFECYCLE_REPLAY_REFUSED", "LIFECYCLE_STATE_REFUSED", "CHECKPOINT_REFUSED", "APPROVAL_REFUSED", "CANCELLED", "DEADLINE", "LIFECYCLE_EFFECT_UNKNOWN"] }, "outcome": { "enum": ["NOT_DISPATCHED", "UNKNOWN"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate34.evaluated;
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
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate34.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate34.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (!(data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "SESSION_REFUSED" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "LIFECYCLE_INPUT_REFUSED" || data1 === "REQUEST_TOO_LARGE" || data1 === "SESSION_CHANGED" || data1 === "SCOPE_REFUSED" || data1 === "STALE_WRITER" || data1 === "LIFECYCLE_REPLAY_REFUSED" || data1 === "LIFECYCLE_STATE_REFUSED" || data1 === "CHECKPOINT_REFUSED" || data1 === "APPROVAL_REFUSED" || data1 === "CANCELLED" || data1 === "DEADLINE" || data1 === "LIFECYCLE_EFFECT_UNKNOWN")) {
                        validate34.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema44.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
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
                          validate34.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema44.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
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
                validate34.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors2 === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// conversation-lifecycle/protocol.mjs
var freeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};
var lifecycleErrorStatuses = freeze({ NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], SESSION_REFUSED: [401, 403], UNSUPPORTED_MEDIA_TYPE: [415], LIFECYCLE_INPUT_REFUSED: [400], REQUEST_TOO_LARGE: [413], SESSION_CHANGED: [403], SCOPE_REFUSED: [403], STALE_WRITER: [403], LIFECYCLE_REPLAY_REFUSED: [409], LIFECYCLE_STATE_REFUSED: [409], CHECKPOINT_REFUSED: [409], APPROVAL_REFUSED: [409], CANCELLED: [408], DEADLINE: [408], LIFECYCLE_EFFECT_UNKNOWN: [502] });
var conversationLifecycleMetadata = freeze({ packageVersion: "0.1.4", schemaId: "urn:meri:conversation-lifecycle:0.1.0", wireContractVersion: "0.1.0", routes: { control: { method: "POST", path: "/api/conversations/control" }, inspect: { method: "POST", path: "/api/conversations/checkpoints/inspect" } }, authentication: { owner: "same current authenticated opaque session", header: "authorization", scheme: "Bearer", validationGrantsAuthority: false }, control: { idempotency: "exact immutable controlId/input/source binding", unknown: "do not automatically resend SDK messages; current owner reconciliation required", resume: "new run/attempt/worker, same conversation, higher fence", fork: "new conversation/run/attempt/worker, independent positive fence; original preserved", target: "receipt is a selector; obtain a fresh existing-owner session" }, inspection: { projection: ["checkpointId", "checkpointSha256", "sourceBinding", "lastEventSequence"], authority: "current owner reads retained APPLIED checkpoint and verifies exact trusted immutable readback", view: "refresh admitted history before inspecting a later checkpoint" }, approval: { wait: "references existing immutable proposal; existing action approval routes retain authority", continuation: "inherited approval is context only; target mutation requires fresh proposal/current approval" }, existingOwners: { cancel: "/api/conversations/cancel", events: "/api/conversations/events", reconnect: "/api/conversations/events/{conversationId}/stream", approval: "existing action-application" }, limits: { requestBytes: 131072, responseBytes: 131072 }, errorStatuses: lifecycleErrorStatuses });

// conversation-lifecycle/conversation-lifecycle-receiver.mjs
var ConversationLifecycleResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ConversationLifecycleResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new ConversationLifecycleResponseError(code);
};
var same = (a, b) => canonicalize(a) === canonicalize(b);
var requests = /* @__PURE__ */ new WeakMap();
var validators = { control: validateControlRequest, inspect: validateInspectionRequest };
function routeValidator(route) {
  if (typeof route !== "string" || !Object.hasOwn(validators, route)) fail2("INVALID_ROUTE");
  return validators[route];
}
var parse = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch (e) {
    fail2(e.code ?? "INVALID_BYTES");
  }
};
function receiveConversationLifecycleRequest(route, bytes) {
  const request = parse(bytes, conversationLifecycleMetadata.limits.requestBytes);
  if (!routeValidator(route)(request)) fail2("INVALID_REQUEST");
  requests.set(request, route);
  return request;
}
async function receiveConversationLifecycleResponse(route, httpStatus, bytes, request, currentView) {
  routeValidator(route);
  if (requests.get(request) !== route) fail2("UNADMITTED_REQUEST");
  try {
    createConversationCursor(currentView);
  } catch {
    fail2("UNADMITTED_VIEW");
  }
  if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) fail2("INVALID_STATUS");
  const result = parse(bytes, conversationLifecycleMetadata.limits.responseBytes);
  if (httpStatus !== 200) {
    if (!validateError(result) || !lifecycleErrorStatuses[result.error.code].includes(httpStatus) || result.error.outcome !== (httpStatus === 502 ? "UNKNOWN" : "NOT_DISPATCHED")) fail2("INVALID_ERROR_RESPONSE");
    return result;
  }
  if (!(route === "control" ? validateControlReceipt : validateInspectionReceipt)(result)) fail2("INVALID_RESPONSE");
  if (!same(result.sourceBinding, currentView.run.binding)) fail2("VIEW_MISMATCH");
  if (route === "inspect") {
    if (result.checkpointId !== request.checkpointId || result.lastEventSequence > currentView.lastSequence) fail2("CHECKPOINT_MISMATCH");
    return result;
  }
  if (result.controlId !== request.controlId || result.intent !== request.intent || result.inputSha256 !== await digest(new TextEncoder().encode(canonicalize(request)))) fail2("REQUEST_MISMATCH");
  if (["resume", "fork"].includes(request.intent) && result.checkpointId !== null && result.checkpointId !== request.checkpointId) fail2("CHECKPOINT_MISMATCH");
  const source = result.sourceBinding, target = result.targetBinding;
  if (target !== null) {
    if (!["resume", "fork"].includes(request.intent) || target.tenantId !== source.tenantId || target.actorId !== source.actorId || ["runId", "attemptId", "workerId"].some((k) => target[k] === source[k]) || result.admissionReceiptId === null) fail2("TARGET_MISMATCH");
    if (request.intent === "resume" && (target.conversationId !== source.conversationId || target.writerFence <= source.writerFence || result.retirementReceiptId === null) || request.intent === "fork" && (target.conversationId === source.conversationId || result.retirementReceiptId !== null)) fail2("TARGET_MISMATCH");
  }
  if (["resume", "fork"].includes(request.intent) && result.state === "APPLIED" && (target === null || result.checkpointId === null || result.admissionReceiptId === null || request.intent === "resume" && result.retirementReceiptId === null)) fail2("TARGET_MISMATCH");
  if (!["resume", "fork"].includes(request.intent) && (target !== null || result.admissionReceiptId !== null || result.retirementReceiptId !== null)) fail2("TARGET_MISMATCH");
  return result;
}
export {
  ConversationLifecycleResponseError,
  conversationLifecycleMetadata,
  receiveConversationLifecycleRequest,
  receiveConversationLifecycleResponse
};
