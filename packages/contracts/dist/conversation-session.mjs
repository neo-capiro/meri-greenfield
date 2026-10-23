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

// session:validator
var validateReceipt = validate23;
var pattern4 = new RegExp("^action_session_[A-Za-z0-9_-]{43}$", "u");
var pattern5 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var func1 = require_ucs2length().default;
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
      if (data.credential === void 0 && (missing0 = "credential") || data.expiresAtMs === void 0 && (missing0 = "expiresAtMs") || data.context === void 0 && (missing0 = "context")) {
        validate23.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "credential" || key0 === "expiresAtMs" || key0 === "context")) {
            validate23.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.credential !== void 0) {
            let data0 = data.credential;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate23.errors = [{ instancePath: instancePath + "/credential", schemaPath: "#/properties/credential/pattern", keyword: "pattern", params: { pattern: "^action_session_[A-Za-z0-9_-]{43}$" }, message: 'must match pattern "^action_session_[A-Za-z0-9_-]{43}$"' }];
                  return false;
                }
              } else {
                validate23.errors = [{ instancePath: instancePath + "/credential", schemaPath: "#/properties/credential/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data1 = data.expiresAtMs;
              const _errs4 = errors2;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
                validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                return false;
              }
              if (errors2 === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 1 || isNaN(data1)) {
                      validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.context !== void 0) {
                let data2 = data.context;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.selectedClientId === void 0 && (missing1 = "selectedClientId")) {
                      validate23.errors = [{ instancePath: instancePath + "/context", schemaPath: "#/properties/context/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "selectedClientId")) {
                          validate23.errors = [{ instancePath: instancePath + "/context", schemaPath: "#/properties/context/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                              if (func1(data3) > 256) {
                                validate23.errors = [{ instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate23.errors = [{ instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate23.errors = [{ instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                        } else {
                          var valid1 = true;
                        }
                        if (valid1) {
                          if (data2.actorId !== void 0) {
                            let data4 = data2.actorId;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (typeof data4 === "string") {
                                if (func1(data4) > 256) {
                                  validate23.errors = [{ instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate23.errors = [{ instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate23.errors = [{ instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid1 = _errs11 === errors2;
                          } else {
                            var valid1 = true;
                          }
                          if (valid1) {
                            if (data2.conversationId !== void 0) {
                              let data5 = data2.conversationId;
                              const _errs13 = errors2;
                              if (errors2 === _errs13) {
                                if (typeof data5 === "string") {
                                  if (!pattern5.test(data5)) {
                                    validate23.errors = [{ instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                    return false;
                                  }
                                } else {
                                  validate23.errors = [{ instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid1 = _errs13 === errors2;
                            } else {
                              var valid1 = true;
                            }
                            if (valid1) {
                              if (data2.runId !== void 0) {
                                let data6 = data2.runId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (!pattern5.test(data6)) {
                                      validate23.errors = [{ instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                      return false;
                                    }
                                  } else {
                                    validate23.errors = [{ instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid1 = _errs15 === errors2;
                              } else {
                                var valid1 = true;
                              }
                              if (valid1) {
                                if (data2.selectedClientId !== void 0) {
                                  let data7 = data2.selectedClientId;
                                  const _errs17 = errors2;
                                  const _errs18 = errors2;
                                  let valid2 = false;
                                  const _errs19 = errors2;
                                  if (errors2 === _errs19) {
                                    if (typeof data7 === "string") {
                                      if (!pattern5.test(data7)) {
                                        const err0 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/properties/selectedClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                        if (vErrors === null) {
                                          vErrors = [err0];
                                        } else {
                                          vErrors.push(err0);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err1 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/properties/selectedClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err1];
                                      } else {
                                        vErrors.push(err1);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var _valid0 = _errs19 === errors2;
                                  valid2 = valid2 || _valid0;
                                  const _errs21 = errors2;
                                  if (data7 !== null) {
                                    const err2 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/properties/selectedClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err2];
                                    } else {
                                      vErrors.push(err2);
                                    }
                                    errors2++;
                                  }
                                  var _valid0 = _errs21 === errors2;
                                  valid2 = valid2 || _valid0;
                                  if (!valid2) {
                                    const err3 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/properties/selectedClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                    if (vErrors === null) {
                                      vErrors = [err3];
                                    } else {
                                      vErrors.push(err3);
                                    }
                                    errors2++;
                                    validate23.errors = vErrors;
                                    return false;
                                  } else {
                                    errors2 = _errs18;
                                    if (vErrors !== null) {
                                      if (_errs18) {
                                        vErrors.length = _errs18;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid1 = _errs17 === errors2;
                                } else {
                                  var valid1 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate23.errors = [{ instancePath: instancePath + "/context", schemaPath: "#/properties/context/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
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
var validateExpected = validate24;
function validate24(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate24.evaluated;
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
      if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.selectedClientId === void 0 && (missing0 = "selectedClientId") || data.scopeKind === void 0 && (missing0 = "scopeKind")) {
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
          if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId" || key0 === "selectedClientId" || key0 === "scopeKind")) {
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
          if (data.tenantId !== void 0) {
            let data0 = data.tenantId;
            const _errs4 = errors2;
            if (errors2 === _errs4) {
              if (typeof data0 === "string") {
                if (func1(data0) > 256) {
                  const err2 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/0/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                } else {
                  if (func1(data0) < 1) {
                    const err3 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/0/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                }
              } else {
                const err4 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/0/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors2++;
              }
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.actorId !== void 0) {
              let data1 = data.actorId;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 256) {
                    const err5 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/0/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                    if (vErrors === null) {
                      vErrors = [err5];
                    } else {
                      vErrors.push(err5);
                    }
                    errors2++;
                  } else {
                    if (func1(data1) < 1) {
                      const err6 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/0/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                    }
                  }
                } else {
                  const err7 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/0/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err7];
                  } else {
                    vErrors.push(err7);
                  }
                  errors2++;
                }
              }
              var valid1 = _errs6 === errors2;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.conversationId !== void 0) {
                let data2 = data.conversationId;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (typeof data2 === "string") {
                    if (!pattern5.test(data2)) {
                      const err8 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/0/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err8];
                      } else {
                        vErrors.push(err8);
                      }
                      errors2++;
                    }
                  } else {
                    const err9 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/0/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err9];
                    } else {
                      vErrors.push(err9);
                    }
                    errors2++;
                  }
                }
                var valid1 = _errs8 === errors2;
              } else {
                var valid1 = true;
              }
              if (valid1) {
                if (data.runId !== void 0) {
                  let data3 = data.runId;
                  const _errs10 = errors2;
                  if (errors2 === _errs10) {
                    if (typeof data3 === "string") {
                      if (!pattern5.test(data3)) {
                        const err10 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/0/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err10];
                        } else {
                          vErrors.push(err10);
                        }
                        errors2++;
                      }
                    } else {
                      const err11 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/0/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err11];
                      } else {
                        vErrors.push(err11);
                      }
                      errors2++;
                    }
                  }
                  var valid1 = _errs10 === errors2;
                } else {
                  var valid1 = true;
                }
                if (valid1) {
                  if (data.selectedClientId !== void 0) {
                    let data4 = data.selectedClientId;
                    const _errs12 = errors2;
                    if (errors2 === _errs12) {
                      if (typeof data4 === "string") {
                        if (!pattern5.test(data4)) {
                          const err12 = { instancePath: instancePath + "/selectedClientId", schemaPath: "#/oneOf/0/properties/selectedClientId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                          if (vErrors === null) {
                            vErrors = [err12];
                          } else {
                            vErrors.push(err12);
                          }
                          errors2++;
                        }
                      } else {
                        const err13 = { instancePath: instancePath + "/selectedClientId", schemaPath: "#/oneOf/0/properties/selectedClientId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err13];
                        } else {
                          vErrors.push(err13);
                        }
                        errors2++;
                      }
                    }
                    var valid1 = _errs12 === errors2;
                  } else {
                    var valid1 = true;
                  }
                  if (valid1) {
                    if (data.scopeKind !== void 0) {
                      const _errs14 = errors2;
                      if ("client" !== data.scopeKind) {
                        const err14 = { instancePath: instancePath + "/scopeKind", schemaPath: "#/oneOf/0/properties/scopeKind/const", keyword: "const", params: { allowedValue: "client" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err14];
                        } else {
                          vErrors.push(err14);
                        }
                        errors2++;
                      }
                      var valid1 = _errs14 === errors2;
                    } else {
                      var valid1 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      const err15 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
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
  const _errs15 = errors2;
  if (errors2 === _errs15) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.tenantId === void 0 && (missing1 = "tenantId") || data.actorId === void 0 && (missing1 = "actorId") || data.conversationId === void 0 && (missing1 = "conversationId") || data.selectedClientId === void 0 && (missing1 = "selectedClientId") || data.scopeKind === void 0 && (missing1 = "scopeKind")) {
        const err16 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors2++;
      } else {
        const _errs17 = errors2;
        for (const key1 in data) {
          if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "selectedClientId" || key1 === "scopeKind")) {
            const err17 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors2++;
            break;
          }
        }
        if (_errs17 === errors2) {
          if (data.tenantId !== void 0) {
            let data6 = data.tenantId;
            const _errs18 = errors2;
            if (errors2 === _errs18) {
              if (typeof data6 === "string") {
                if (func1(data6) > 256) {
                  const err18 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/1/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                  if (vErrors === null) {
                    vErrors = [err18];
                  } else {
                    vErrors.push(err18);
                  }
                  errors2++;
                } else {
                  if (func1(data6) < 1) {
                    const err19 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/1/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors2++;
                  }
                }
              } else {
                const err20 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/1/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err20];
                } else {
                  vErrors.push(err20);
                }
                errors2++;
              }
            }
            var valid2 = _errs18 === errors2;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.actorId !== void 0) {
              let data7 = data.actorId;
              const _errs20 = errors2;
              if (errors2 === _errs20) {
                if (typeof data7 === "string") {
                  if (func1(data7) > 256) {
                    const err21 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/1/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                    if (vErrors === null) {
                      vErrors = [err21];
                    } else {
                      vErrors.push(err21);
                    }
                    errors2++;
                  } else {
                    if (func1(data7) < 1) {
                      const err22 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/1/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err22];
                      } else {
                        vErrors.push(err22);
                      }
                      errors2++;
                    }
                  }
                } else {
                  const err23 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/1/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors2++;
                }
              }
              var valid2 = _errs20 === errors2;
            } else {
              var valid2 = true;
            }
            if (valid2) {
              if (data.conversationId !== void 0) {
                let data8 = data.conversationId;
                const _errs22 = errors2;
                if (errors2 === _errs22) {
                  if (typeof data8 === "string") {
                    if (!pattern5.test(data8)) {
                      const err24 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/1/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err24];
                      } else {
                        vErrors.push(err24);
                      }
                      errors2++;
                    }
                  } else {
                    const err25 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/1/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err25];
                    } else {
                      vErrors.push(err25);
                    }
                    errors2++;
                  }
                }
                var valid2 = _errs22 === errors2;
              } else {
                var valid2 = true;
              }
              if (valid2) {
                if (data.runId !== void 0) {
                  let data9 = data.runId;
                  const _errs24 = errors2;
                  if (errors2 === _errs24) {
                    if (typeof data9 === "string") {
                      if (!pattern5.test(data9)) {
                        const err26 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/1/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err26];
                        } else {
                          vErrors.push(err26);
                        }
                        errors2++;
                      }
                    } else {
                      const err27 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/1/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err27];
                      } else {
                        vErrors.push(err27);
                      }
                      errors2++;
                    }
                  }
                  var valid2 = _errs24 === errors2;
                } else {
                  var valid2 = true;
                }
                if (valid2) {
                  if (data.selectedClientId !== void 0) {
                    const _errs26 = errors2;
                    if (data.selectedClientId !== null) {
                      const err28 = { instancePath: instancePath + "/selectedClientId", schemaPath: "#/oneOf/1/properties/selectedClientId/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err28];
                      } else {
                        vErrors.push(err28);
                      }
                      errors2++;
                    }
                    var valid2 = _errs26 === errors2;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data.scopeKind !== void 0) {
                      const _errs28 = errors2;
                      if ("general" !== data.scopeKind) {
                        const err29 = { instancePath: instancePath + "/scopeKind", schemaPath: "#/oneOf/1/properties/scopeKind/const", keyword: "const", params: { allowedValue: "general" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err29];
                        } else {
                          vErrors.push(err29);
                        }
                        errors2++;
                      }
                      var valid2 = _errs28 === errors2;
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
    } else {
      const err30 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors2++;
    }
  }
  var _valid0 = _errs15 === errors2;
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
  }
  if (!valid0) {
    const err31 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err31];
    } else {
      vErrors.push(err31);
    }
    errors2++;
    validate24.errors = vErrors;
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
  validate24.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate24.evaluated = { "dynamicProps": true, "dynamicItems": false };

// conversation-session/receive.mjs
var conversationSessionVersion = "1.0.0";
var conversationSessionMetadata = Object.freeze({ packageVersion: "0.1.11", sessionVersion: conversationSessionVersion, responseBytes: 4096, scopeSource: "Core explicit immutable bootstrap receipt; null alone is not General eligibility", authority: "validation grants no authority" });
var ConversationSessionResponseError = class extends Error {
  constructor() {
    super("CONVERSATION_SESSION_REFUSED");
    this.name = "ConversationSessionResponseError";
    this.code = "CONVERSATION_SESSION_REFUSED";
  }
};
var refuse = () => {
  throw new ConversationSessionResponseError();
};
function receiveConversationSessionReceipt(utf8Bytes, expectedContextBytes, at) {
  try {
    const receipt = parseBytes(utf8Bytes, 4096), expected = parseBytes(expectedContextBytes, 2048);
    if (!validateReceipt(receipt) || !validateExpected(expected) || !Number.isSafeInteger(at) || at < 0 || receipt.expiresAtMs <= at) refuse();
    for (const key of ["tenantId", "actorId", "conversationId", "runId", "selectedClientId"]) if (Object.hasOwn(expected, key) && receipt.context[key] !== expected[key]) refuse();
    return receipt;
  } catch {
    refuse();
  }
}
export {
  ConversationSessionResponseError,
  conversationSessionMetadata,
  conversationSessionVersion,
  receiveConversationSessionReceipt
};
