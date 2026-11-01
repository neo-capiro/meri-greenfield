// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xml: "application/xml; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

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
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
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
var validateReceipt = validate23;
var pattern4 = new RegExp("^action_session_[A-Za-z0-9_-]{43}$", "u");
var pattern5 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var pattern11 = new RegExp("\\S", "u");
var pattern12 = new RegExp("^[0-9a-f]{64}$", "u");
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
          if (!(key0 === "credential" || key0 === "expiresAtMs" || key0 === "context" || key0 === "initialRunRebind")) {
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
                const _errs7 = errors2;
                let valid1 = false;
                let passing0 = null;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.selectedClientId === void 0 && (missing1 = "selectedClientId")) {
                      const err0 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    } else {
                      const _errs10 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "selectedClientId")) {
                          const err1 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs10 === errors2) {
                        if (data2.tenantId !== void 0) {
                          let data3 = data2.tenantId;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 256) {
                                const err2 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/0/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                if (vErrors === null) {
                                  vErrors = [err2];
                                } else {
                                  vErrors.push(err2);
                                }
                                errors2++;
                              } else {
                                if (func1(data3) < 1) {
                                  const err3 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/0/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err3];
                                  } else {
                                    vErrors.push(err3);
                                  }
                                  errors2++;
                                }
                              }
                            } else {
                              const err4 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/0/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            }
                          }
                          var valid2 = _errs11 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data2.actorId !== void 0) {
                            let data4 = data2.actorId;
                            const _errs13 = errors2;
                            if (errors2 === _errs13) {
                              if (typeof data4 === "string") {
                                if (func1(data4) > 256) {
                                  const err5 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/0/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err5];
                                  } else {
                                    vErrors.push(err5);
                                  }
                                  errors2++;
                                } else {
                                  if (func1(data4) < 1) {
                                    const err6 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/0/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err6];
                                    } else {
                                      vErrors.push(err6);
                                    }
                                    errors2++;
                                  }
                                }
                              } else {
                                const err7 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/0/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err7];
                                } else {
                                  vErrors.push(err7);
                                }
                                errors2++;
                              }
                            }
                            var valid2 = _errs13 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data2.conversationId !== void 0) {
                              let data5 = data2.conversationId;
                              const _errs15 = errors2;
                              if (errors2 === _errs15) {
                                if (typeof data5 === "string") {
                                  if (!pattern5.test(data5)) {
                                    const err8 = { instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/oneOf/0/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                    if (vErrors === null) {
                                      vErrors = [err8];
                                    } else {
                                      vErrors.push(err8);
                                    }
                                    errors2++;
                                  }
                                } else {
                                  const err9 = { instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/oneOf/0/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err9];
                                  } else {
                                    vErrors.push(err9);
                                  }
                                  errors2++;
                                }
                              }
                              var valid2 = _errs15 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data2.runId !== void 0) {
                                let data6 = data2.runId;
                                const _errs17 = errors2;
                                if (errors2 === _errs17) {
                                  if (typeof data6 === "string") {
                                    if (!pattern5.test(data6)) {
                                      const err10 = { instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/oneOf/0/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                      if (vErrors === null) {
                                        vErrors = [err10];
                                      } else {
                                        vErrors.push(err10);
                                      }
                                      errors2++;
                                    }
                                  } else {
                                    const err11 = { instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/oneOf/0/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err11];
                                    } else {
                                      vErrors.push(err11);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid2 = _errs17 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data2.selectedClientId !== void 0) {
                                  let data7 = data2.selectedClientId;
                                  const _errs19 = errors2;
                                  const _errs20 = errors2;
                                  let valid3 = false;
                                  const _errs21 = errors2;
                                  if (errors2 === _errs21) {
                                    if (typeof data7 === "string") {
                                      if (!pattern5.test(data7)) {
                                        const err12 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/oneOf/0/properties/selectedClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                        if (vErrors === null) {
                                          vErrors = [err12];
                                        } else {
                                          vErrors.push(err12);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err13 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/oneOf/0/properties/selectedClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err13];
                                      } else {
                                        vErrors.push(err13);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var _valid1 = _errs21 === errors2;
                                  valid3 = valid3 || _valid1;
                                  const _errs23 = errors2;
                                  if (data7 !== null) {
                                    const err14 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/oneOf/0/properties/selectedClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err14];
                                    } else {
                                      vErrors.push(err14);
                                    }
                                    errors2++;
                                  }
                                  var _valid1 = _errs23 === errors2;
                                  valid3 = valid3 || _valid1;
                                  if (!valid3) {
                                    const err15 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/oneOf/0/properties/selectedClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                    if (vErrors === null) {
                                      vErrors = [err15];
                                    } else {
                                      vErrors.push(err15);
                                    }
                                    errors2++;
                                  } else {
                                    errors2 = _errs20;
                                    if (vErrors !== null) {
                                      if (_errs20) {
                                        vErrors.length = _errs20;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid2 = _errs19 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err16 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err16];
                    } else {
                      vErrors.push(err16);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs8 === errors2;
                if (_valid0) {
                  valid1 = true;
                  passing0 = 0;
                  var props0 = true;
                }
                const _errs25 = errors2;
                if (errors2 === _errs25) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing2;
                    if (data2.tenantId === void 0 && (missing2 = "tenantId") || data2.actorId === void 0 && (missing2 = "actorId") || data2.conversationId === void 0 && (missing2 = "conversationId") || data2.runId === void 0 && (missing2 = "runId") || data2.selectedClientId === void 0 && (missing2 = "selectedClientId") || data2.scopeKind === void 0 && (missing2 = "scopeKind") || data2.scope === void 0 && (missing2 = "scope")) {
                      const err17 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                      if (vErrors === null) {
                        vErrors = [err17];
                      } else {
                        vErrors.push(err17);
                      }
                      errors2++;
                    } else {
                      const _errs27 = errors2;
                      for (const key2 in data2) {
                        if (!(key2 === "tenantId" || key2 === "actorId" || key2 === "conversationId" || key2 === "runId" || key2 === "selectedClientId" || key2 === "scopeKind" || key2 === "scope")) {
                          const err18 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err18];
                          } else {
                            vErrors.push(err18);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs27 === errors2) {
                        if (data2.tenantId !== void 0) {
                          let data8 = data2.tenantId;
                          const _errs28 = errors2;
                          if (errors2 === _errs28) {
                            if (typeof data8 === "string") {
                              if (func1(data8) > 256) {
                                const err19 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/1/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                if (vErrors === null) {
                                  vErrors = [err19];
                                } else {
                                  vErrors.push(err19);
                                }
                                errors2++;
                              } else {
                                if (func1(data8) < 1) {
                                  const err20 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/1/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err20];
                                  } else {
                                    vErrors.push(err20);
                                  }
                                  errors2++;
                                }
                              }
                            } else {
                              const err21 = { instancePath: instancePath + "/context/tenantId", schemaPath: "#/properties/context/oneOf/1/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err21];
                              } else {
                                vErrors.push(err21);
                              }
                              errors2++;
                            }
                          }
                          var valid4 = _errs28 === errors2;
                        } else {
                          var valid4 = true;
                        }
                        if (valid4) {
                          if (data2.actorId !== void 0) {
                            let data9 = data2.actorId;
                            const _errs30 = errors2;
                            if (errors2 === _errs30) {
                              if (typeof data9 === "string") {
                                if (func1(data9) > 256) {
                                  const err22 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/1/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err22];
                                  } else {
                                    vErrors.push(err22);
                                  }
                                  errors2++;
                                } else {
                                  if (func1(data9) < 1) {
                                    const err23 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/1/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err23];
                                    } else {
                                      vErrors.push(err23);
                                    }
                                    errors2++;
                                  }
                                }
                              } else {
                                const err24 = { instancePath: instancePath + "/context/actorId", schemaPath: "#/properties/context/oneOf/1/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err24];
                                } else {
                                  vErrors.push(err24);
                                }
                                errors2++;
                              }
                            }
                            var valid4 = _errs30 === errors2;
                          } else {
                            var valid4 = true;
                          }
                          if (valid4) {
                            if (data2.conversationId !== void 0) {
                              let data10 = data2.conversationId;
                              const _errs32 = errors2;
                              if (errors2 === _errs32) {
                                if (typeof data10 === "string") {
                                  if (!pattern5.test(data10)) {
                                    const err25 = { instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/oneOf/1/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                    if (vErrors === null) {
                                      vErrors = [err25];
                                    } else {
                                      vErrors.push(err25);
                                    }
                                    errors2++;
                                  }
                                } else {
                                  const err26 = { instancePath: instancePath + "/context/conversationId", schemaPath: "#/properties/context/oneOf/1/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err26];
                                  } else {
                                    vErrors.push(err26);
                                  }
                                  errors2++;
                                }
                              }
                              var valid4 = _errs32 === errors2;
                            } else {
                              var valid4 = true;
                            }
                            if (valid4) {
                              if (data2.runId !== void 0) {
                                let data11 = data2.runId;
                                const _errs34 = errors2;
                                if (errors2 === _errs34) {
                                  if (typeof data11 === "string") {
                                    if (!pattern5.test(data11)) {
                                      const err27 = { instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/oneOf/1/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                      if (vErrors === null) {
                                        vErrors = [err27];
                                      } else {
                                        vErrors.push(err27);
                                      }
                                      errors2++;
                                    }
                                  } else {
                                    const err28 = { instancePath: instancePath + "/context/runId", schemaPath: "#/properties/context/oneOf/1/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err28];
                                    } else {
                                      vErrors.push(err28);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid4 = _errs34 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data2.selectedClientId !== void 0) {
                                  const _errs36 = errors2;
                                  if (data2.selectedClientId !== null) {
                                    const err29 = { instancePath: instancePath + "/context/selectedClientId", schemaPath: "#/properties/context/oneOf/1/properties/selectedClientId/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors2++;
                                  }
                                  var valid4 = _errs36 === errors2;
                                } else {
                                  var valid4 = true;
                                }
                                if (valid4) {
                                  if (data2.scopeKind !== void 0) {
                                    const _errs38 = errors2;
                                    if ("research_portfolio" !== data2.scopeKind) {
                                      const err30 = { instancePath: instancePath + "/context/scopeKind", schemaPath: "#/properties/context/oneOf/1/properties/scopeKind/const", keyword: "const", params: { allowedValue: "research_portfolio" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err30];
                                      } else {
                                        vErrors.push(err30);
                                      }
                                      errors2++;
                                    }
                                    var valid4 = _errs38 === errors2;
                                  } else {
                                    var valid4 = true;
                                  }
                                  if (valid4) {
                                    if (data2.scope !== void 0) {
                                      let data14 = data2.scope;
                                      const _errs39 = errors2;
                                      if (errors2 === _errs39) {
                                        if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                                          let missing3;
                                          if (data14.kind === void 0 && (missing3 = "kind") || data14.researchPortfolioId === void 0 && (missing3 = "researchPortfolioId") || data14.researchPortfolioName === void 0 && (missing3 = "researchPortfolioName") || data14.researchPortfolioRevision === void 0 && (missing3 = "researchPortfolioRevision") || data14.scopeVersion === void 0 && (missing3 = "scopeVersion")) {
                                            const err31 = { instancePath: instancePath + "/context/scope", schemaPath: "#/properties/context/oneOf/1/properties/scope/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err31];
                                            } else {
                                              vErrors.push(err31);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs41 = errors2;
                                            for (const key3 in data14) {
                                              if (!(key3 === "kind" || key3 === "researchPortfolioId" || key3 === "researchPortfolioName" || key3 === "researchPortfolioRevision" || key3 === "scopeVersion")) {
                                                const err32 = { instancePath: instancePath + "/context/scope", schemaPath: "#/properties/context/oneOf/1/properties/scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err32];
                                                } else {
                                                  vErrors.push(err32);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs41 === errors2) {
                                              if (data14.kind !== void 0) {
                                                const _errs42 = errors2;
                                                if ("research_portfolio" !== data14.kind) {
                                                  const err33 = { instancePath: instancePath + "/context/scope/kind", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/kind/const", keyword: "const", params: { allowedValue: "research_portfolio" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err33];
                                                  } else {
                                                    vErrors.push(err33);
                                                  }
                                                  errors2++;
                                                }
                                                var valid5 = _errs42 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data14.researchPortfolioId !== void 0) {
                                                  let data16 = data14.researchPortfolioId;
                                                  const _errs43 = errors2;
                                                  if (errors2 === _errs43) {
                                                    if (typeof data16 === "string") {
                                                      if (!pattern5.test(data16)) {
                                                        const err34 = { instancePath: instancePath + "/context/scope/researchPortfolioId", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                                        if (vErrors === null) {
                                                          vErrors = [err34];
                                                        } else {
                                                          vErrors.push(err34);
                                                        }
                                                        errors2++;
                                                      }
                                                    } else {
                                                      const err35 = { instancePath: instancePath + "/context/scope/researchPortfolioId", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                      if (vErrors === null) {
                                                        vErrors = [err35];
                                                      } else {
                                                        vErrors.push(err35);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid5 = _errs43 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data14.researchPortfolioName !== void 0) {
                                                    let data17 = data14.researchPortfolioName;
                                                    const _errs45 = errors2;
                                                    if (errors2 === _errs45) {
                                                      if (typeof data17 === "string") {
                                                        if (func1(data17) > 200) {
                                                          const err36 = { instancePath: instancePath + "/context/scope/researchPortfolioName", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioName/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                                          if (vErrors === null) {
                                                            vErrors = [err36];
                                                          } else {
                                                            vErrors.push(err36);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (func1(data17) < 1) {
                                                            const err37 = { instancePath: instancePath + "/context/scope/researchPortfolioName", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioName/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                            if (vErrors === null) {
                                                              vErrors = [err37];
                                                            } else {
                                                              vErrors.push(err37);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (!pattern11.test(data17)) {
                                                              const err38 = { instancePath: instancePath + "/context/scope/researchPortfolioName", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioName/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
                                                              if (vErrors === null) {
                                                                vErrors = [err38];
                                                              } else {
                                                                vErrors.push(err38);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        const err39 = { instancePath: instancePath + "/context/scope/researchPortfolioName", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioName/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                        if (vErrors === null) {
                                                          vErrors = [err39];
                                                        } else {
                                                          vErrors.push(err39);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid5 = _errs45 === errors2;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data14.researchPortfolioRevision !== void 0) {
                                                      let data18 = data14.researchPortfolioRevision;
                                                      const _errs47 = errors2;
                                                      if (!(typeof data18 == "number" && (!(data18 % 1) && !isNaN(data18)) && isFinite(data18))) {
                                                        const err40 = { instancePath: instancePath + "/context/scope/researchPortfolioRevision", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioRevision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err40];
                                                        } else {
                                                          vErrors.push(err40);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs47) {
                                                        if (typeof data18 == "number" && isFinite(data18)) {
                                                          if (data18 > 9007199254740991 || isNaN(data18)) {
                                                            const err41 = { instancePath: instancePath + "/context/scope/researchPortfolioRevision", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err41];
                                                            } else {
                                                              vErrors.push(err41);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data18 < 0 || isNaN(data18)) {
                                                              const err42 = { instancePath: instancePath + "/context/scope/researchPortfolioRevision", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/researchPortfolioRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err42];
                                                              } else {
                                                                vErrors.push(err42);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid5 = _errs47 === errors2;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data14.scopeVersion !== void 0) {
                                                        let data19 = data14.scopeVersion;
                                                        const _errs49 = errors2;
                                                        if (errors2 === _errs49) {
                                                          if (typeof data19 === "string") {
                                                            if (!pattern12.test(data19)) {
                                                              const err43 = { instancePath: instancePath + "/context/scope/scopeVersion", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/scopeVersion/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
                                                              if (vErrors === null) {
                                                                vErrors = [err43];
                                                              } else {
                                                                vErrors.push(err43);
                                                              }
                                                              errors2++;
                                                            }
                                                          } else {
                                                            const err44 = { instancePath: instancePath + "/context/scope/scopeVersion", schemaPath: "#/properties/context/oneOf/1/properties/scope/properties/scopeVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                            if (vErrors === null) {
                                                              vErrors = [err44];
                                                            } else {
                                                              vErrors.push(err44);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                        var valid5 = _errs49 === errors2;
                                                      } else {
                                                        var valid5 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err45 = { instancePath: instancePath + "/context/scope", schemaPath: "#/properties/context/oneOf/1/properties/scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err45];
                                          } else {
                                            vErrors.push(err45);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid4 = _errs39 === errors2;
                                    } else {
                                      var valid4 = true;
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
                    const err46 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err46];
                    } else {
                      vErrors.push(err46);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs25 === errors2;
                if (_valid0 && valid1) {
                  valid1 = false;
                  passing0 = [passing0, 1];
                } else {
                  if (_valid0) {
                    valid1 = true;
                    passing0 = 1;
                    if (props0 !== true) {
                      props0 = true;
                    }
                  }
                }
                if (!valid1) {
                  const err47 = { instancePath: instancePath + "/context", schemaPath: "#/properties/context/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors2++;
                  validate23.errors = vErrors;
                  return false;
                } else {
                  errors2 = _errs7;
                  if (vErrors !== null) {
                    if (_errs7) {
                      vErrors.length = _errs7;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.initialRunRebind !== void 0) {
                  let data20 = data.initialRunRebind;
                  const _errs51 = errors2;
                  if (errors2 === _errs51) {
                    if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                      let missing4;
                      if (data20.sourceRunId === void 0 && (missing4 = "sourceRunId") || data20.targetRunId === void 0 && (missing4 = "targetRunId")) {
                        validate23.errors = [{ instancePath: instancePath + "/initialRunRebind", schemaPath: "#/properties/initialRunRebind/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                        return false;
                      } else {
                        const _errs53 = errors2;
                        for (const key4 in data20) {
                          if (!(key4 === "sourceRunId" || key4 === "targetRunId")) {
                            validate23.errors = [{ instancePath: instancePath + "/initialRunRebind", schemaPath: "#/properties/initialRunRebind/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                            return false;
                            break;
                          }
                        }
                        if (_errs53 === errors2) {
                          if (data20.sourceRunId !== void 0) {
                            let data21 = data20.sourceRunId;
                            const _errs54 = errors2;
                            if (errors2 === _errs54) {
                              if (typeof data21 === "string") {
                                if (!pattern5.test(data21)) {
                                  validate23.errors = [{ instancePath: instancePath + "/initialRunRebind/sourceRunId", schemaPath: "#/properties/initialRunRebind/properties/sourceRunId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                  return false;
                                }
                              } else {
                                validate23.errors = [{ instancePath: instancePath + "/initialRunRebind/sourceRunId", schemaPath: "#/properties/initialRunRebind/properties/sourceRunId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid6 = _errs54 === errors2;
                          } else {
                            var valid6 = true;
                          }
                          if (valid6) {
                            if (data20.targetRunId !== void 0) {
                              let data22 = data20.targetRunId;
                              const _errs56 = errors2;
                              if (errors2 === _errs56) {
                                if (typeof data22 === "string") {
                                  if (!pattern5.test(data22)) {
                                    validate23.errors = [{ instancePath: instancePath + "/initialRunRebind/targetRunId", schemaPath: "#/properties/initialRunRebind/properties/targetRunId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                    return false;
                                  }
                                } else {
                                  validate23.errors = [{ instancePath: instancePath + "/initialRunRebind/targetRunId", schemaPath: "#/properties/initialRunRebind/properties/targetRunId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid6 = _errs56 === errors2;
                            } else {
                              var valid6 = true;
                            }
                          }
                        }
                      }
                    } else {
                      validate23.errors = [{ instancePath: instancePath + "/initialRunRebind", schemaPath: "#/properties/initialRunRebind/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid0 = _errs51 === errors2;
                } else {
                  var valid0 = true;
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
    const _errs29 = errors2;
    if (errors2 === _errs29) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.tenantId === void 0 && (missing2 = "tenantId") || data.actorId === void 0 && (missing2 = "actorId") || data.conversationId === void 0 && (missing2 = "conversationId") || data.selectedClientId === void 0 && (missing2 = "selectedClientId") || data.scopeKind === void 0 && (missing2 = "scopeKind") || data.scope === void 0 && (missing2 = "scope")) {
          const err31 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors2++;
        } else {
          const _errs31 = errors2;
          for (const key2 in data) {
            if (!(key2 === "tenantId" || key2 === "actorId" || key2 === "conversationId" || key2 === "runId" || key2 === "selectedClientId" || key2 === "scopeKind" || key2 === "scope")) {
              const err32 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors2++;
              break;
            }
          }
          if (_errs31 === errors2) {
            if (data.tenantId !== void 0) {
              let data12 = data.tenantId;
              const _errs32 = errors2;
              if (errors2 === _errs32) {
                if (typeof data12 === "string") {
                  if (func1(data12) > 256) {
                    const err33 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/2/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                    if (vErrors === null) {
                      vErrors = [err33];
                    } else {
                      vErrors.push(err33);
                    }
                    errors2++;
                  } else {
                    if (func1(data12) < 1) {
                      const err34 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/2/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err34];
                      } else {
                        vErrors.push(err34);
                      }
                      errors2++;
                    }
                  }
                } else {
                  const err35 = { instancePath: instancePath + "/tenantId", schemaPath: "#/oneOf/2/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err35];
                  } else {
                    vErrors.push(err35);
                  }
                  errors2++;
                }
              }
              var valid3 = _errs32 === errors2;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.actorId !== void 0) {
                let data13 = data.actorId;
                const _errs34 = errors2;
                if (errors2 === _errs34) {
                  if (typeof data13 === "string") {
                    if (func1(data13) > 256) {
                      const err36 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/2/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                      if (vErrors === null) {
                        vErrors = [err36];
                      } else {
                        vErrors.push(err36);
                      }
                      errors2++;
                    } else {
                      if (func1(data13) < 1) {
                        const err37 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/2/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err37];
                        } else {
                          vErrors.push(err37);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err38 = { instancePath: instancePath + "/actorId", schemaPath: "#/oneOf/2/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err38];
                    } else {
                      vErrors.push(err38);
                    }
                    errors2++;
                  }
                }
                var valid3 = _errs34 === errors2;
              } else {
                var valid3 = true;
              }
              if (valid3) {
                if (data.conversationId !== void 0) {
                  let data14 = data.conversationId;
                  const _errs36 = errors2;
                  if (errors2 === _errs36) {
                    if (typeof data14 === "string") {
                      if (!pattern5.test(data14)) {
                        const err39 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/2/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err39];
                        } else {
                          vErrors.push(err39);
                        }
                        errors2++;
                      }
                    } else {
                      const err40 = { instancePath: instancePath + "/conversationId", schemaPath: "#/oneOf/2/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err40];
                      } else {
                        vErrors.push(err40);
                      }
                      errors2++;
                    }
                  }
                  var valid3 = _errs36 === errors2;
                } else {
                  var valid3 = true;
                }
                if (valid3) {
                  if (data.runId !== void 0) {
                    let data15 = data.runId;
                    const _errs38 = errors2;
                    if (errors2 === _errs38) {
                      if (typeof data15 === "string") {
                        if (!pattern5.test(data15)) {
                          const err41 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/2/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                          if (vErrors === null) {
                            vErrors = [err41];
                          } else {
                            vErrors.push(err41);
                          }
                          errors2++;
                        }
                      } else {
                        const err42 = { instancePath: instancePath + "/runId", schemaPath: "#/oneOf/2/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err42];
                        } else {
                          vErrors.push(err42);
                        }
                        errors2++;
                      }
                    }
                    var valid3 = _errs38 === errors2;
                  } else {
                    var valid3 = true;
                  }
                  if (valid3) {
                    if (data.selectedClientId !== void 0) {
                      const _errs40 = errors2;
                      if (data.selectedClientId !== null) {
                        const err43 = { instancePath: instancePath + "/selectedClientId", schemaPath: "#/oneOf/2/properties/selectedClientId/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err43];
                        } else {
                          vErrors.push(err43);
                        }
                        errors2++;
                      }
                      var valid3 = _errs40 === errors2;
                    } else {
                      var valid3 = true;
                    }
                    if (valid3) {
                      if (data.scopeKind !== void 0) {
                        const _errs42 = errors2;
                        if ("research_portfolio" !== data.scopeKind) {
                          const err44 = { instancePath: instancePath + "/scopeKind", schemaPath: "#/oneOf/2/properties/scopeKind/const", keyword: "const", params: { allowedValue: "research_portfolio" }, message: "must be equal to constant" };
                          if (vErrors === null) {
                            vErrors = [err44];
                          } else {
                            vErrors.push(err44);
                          }
                          errors2++;
                        }
                        var valid3 = _errs42 === errors2;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data.scope !== void 0) {
                          let data18 = data.scope;
                          const _errs43 = errors2;
                          if (errors2 === _errs43) {
                            if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                              let missing3;
                              if (data18.kind === void 0 && (missing3 = "kind") || data18.researchPortfolioId === void 0 && (missing3 = "researchPortfolioId") || data18.researchPortfolioName === void 0 && (missing3 = "researchPortfolioName") || data18.researchPortfolioRevision === void 0 && (missing3 = "researchPortfolioRevision") || data18.scopeVersion === void 0 && (missing3 = "scopeVersion")) {
                                const err45 = { instancePath: instancePath + "/scope", schemaPath: "#/oneOf/2/properties/scope/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err45];
                                } else {
                                  vErrors.push(err45);
                                }
                                errors2++;
                              } else {
                                const _errs45 = errors2;
                                for (const key3 in data18) {
                                  if (!(key3 === "kind" || key3 === "researchPortfolioId" || key3 === "researchPortfolioName" || key3 === "researchPortfolioRevision" || key3 === "scopeVersion")) {
                                    const err46 = { instancePath: instancePath + "/scope", schemaPath: "#/oneOf/2/properties/scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err46];
                                    } else {
                                      vErrors.push(err46);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs45 === errors2) {
                                  if (data18.kind !== void 0) {
                                    const _errs46 = errors2;
                                    if ("research_portfolio" !== data18.kind) {
                                      const err47 = { instancePath: instancePath + "/scope/kind", schemaPath: "#/oneOf/2/properties/scope/properties/kind/const", keyword: "const", params: { allowedValue: "research_portfolio" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err47];
                                      } else {
                                        vErrors.push(err47);
                                      }
                                      errors2++;
                                    }
                                    var valid4 = _errs46 === errors2;
                                  } else {
                                    var valid4 = true;
                                  }
                                  if (valid4) {
                                    if (data18.researchPortfolioId !== void 0) {
                                      let data20 = data18.researchPortfolioId;
                                      const _errs47 = errors2;
                                      if (errors2 === _errs47) {
                                        if (typeof data20 === "string") {
                                          if (!pattern5.test(data20)) {
                                            const err48 = { instancePath: instancePath + "/scope/researchPortfolioId", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err49 = { instancePath: instancePath + "/scope/researchPortfolioId", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err49];
                                          } else {
                                            vErrors.push(err49);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid4 = _errs47 === errors2;
                                    } else {
                                      var valid4 = true;
                                    }
                                    if (valid4) {
                                      if (data18.researchPortfolioName !== void 0) {
                                        let data21 = data18.researchPortfolioName;
                                        const _errs49 = errors2;
                                        if (errors2 === _errs49) {
                                          if (typeof data21 === "string") {
                                            if (func1(data21) > 200) {
                                              const err50 = { instancePath: instancePath + "/scope/researchPortfolioName", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioName/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err50];
                                              } else {
                                                vErrors.push(err50);
                                              }
                                              errors2++;
                                            } else {
                                              if (func1(data21) < 1) {
                                                const err51 = { instancePath: instancePath + "/scope/researchPortfolioName", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioName/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err51];
                                                } else {
                                                  vErrors.push(err51);
                                                }
                                                errors2++;
                                              } else {
                                                if (!pattern11.test(data21)) {
                                                  const err52 = { instancePath: instancePath + "/scope/researchPortfolioName", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioName/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err52];
                                                  } else {
                                                    vErrors.push(err52);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          } else {
                                            const err53 = { instancePath: instancePath + "/scope/researchPortfolioName", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioName/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err53];
                                            } else {
                                              vErrors.push(err53);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid4 = _errs49 === errors2;
                                      } else {
                                        var valid4 = true;
                                      }
                                      if (valid4) {
                                        if (data18.researchPortfolioRevision !== void 0) {
                                          let data22 = data18.researchPortfolioRevision;
                                          const _errs51 = errors2;
                                          if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                            const err54 = { instancePath: instancePath + "/scope/researchPortfolioRevision", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioRevision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err54];
                                            } else {
                                              vErrors.push(err54);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs51) {
                                            if (typeof data22 == "number" && isFinite(data22)) {
                                              if (data22 > 9007199254740991 || isNaN(data22)) {
                                                const err55 = { instancePath: instancePath + "/scope/researchPortfolioRevision", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err55];
                                                } else {
                                                  vErrors.push(err55);
                                                }
                                                errors2++;
                                              } else {
                                                if (data22 < 0 || isNaN(data22)) {
                                                  const err56 = { instancePath: instancePath + "/scope/researchPortfolioRevision", schemaPath: "#/oneOf/2/properties/scope/properties/researchPortfolioRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                  if (vErrors === null) {
                                                    vErrors = [err56];
                                                  } else {
                                                    vErrors.push(err56);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var valid4 = _errs51 === errors2;
                                        } else {
                                          var valid4 = true;
                                        }
                                        if (valid4) {
                                          if (data18.scopeVersion !== void 0) {
                                            let data23 = data18.scopeVersion;
                                            const _errs53 = errors2;
                                            if (errors2 === _errs53) {
                                              if (typeof data23 === "string") {
                                                if (!pattern12.test(data23)) {
                                                  const err57 = { instancePath: instancePath + "/scope/scopeVersion", schemaPath: "#/oneOf/2/properties/scope/properties/scopeVersion/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err57];
                                                  } else {
                                                    vErrors.push(err57);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err58 = { instancePath: instancePath + "/scope/scopeVersion", schemaPath: "#/oneOf/2/properties/scope/properties/scopeVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err58];
                                                } else {
                                                  vErrors.push(err58);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid4 = _errs53 === errors2;
                                          } else {
                                            var valid4 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err59 = { instancePath: instancePath + "/scope", schemaPath: "#/oneOf/2/properties/scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err59];
                              } else {
                                vErrors.push(err59);
                              }
                              errors2++;
                            }
                          }
                          var valid3 = _errs43 === errors2;
                        } else {
                          var valid3 = true;
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
        const err60 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors2++;
      }
    }
    var _valid0 = _errs29 === errors2;
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
    }
  }
  if (!valid0) {
    const err61 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err61];
    } else {
      vErrors.push(err61);
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

// session-receipt/validate.mjs
function validSessionReceipt(value, at, { general = false, research = false } = {}) {
  return Number.isSafeInteger(at) && at >= 0 && validateReceipt(value) && value.expiresAtMs > at && (value.context.scopeKind === "research_portfolio" ? research : general || value.context.selectedClientId !== null) && value.context.tenantId.length <= 256 && value.context.actorId.length <= 256;
}

// conversation-session/receive.mjs
var conversationSessionVersion = "1.1.0";
var conversationSessionMetadata = Object.freeze({ packageVersion: "0.1.43", sessionVersion: conversationSessionVersion, responseBytes: 4096, scopeSource: "Core explicit immutable capture; Research is disjoint from General and null grants neither", authority: "validation grants no authority" });
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
function receiveConversationSessionExpectedContext(utf8Bytes) {
  try {
    const expected = parseBytes(utf8Bytes, 4096);
    if (!validateExpected(expected)) refuse();
    if (expected.scopeKind !== "research_portfolio") parseBytes(utf8Bytes, 2048);
    return expected;
  } catch {
    refuse();
  }
}
function receiveConversationSessionReceipt(utf8Bytes, expectedContextBytes, at) {
  try {
    const receipt = parseBytes(utf8Bytes, 4096), expected = receiveConversationSessionExpectedContext(expectedContextBytes);
    if (!validSessionReceipt(receipt, at, { general: true, research: true })) refuse();
    const research = expected.scopeKind === "research_portfolio";
    if (research !== (receipt.context.scopeKind === "research_portfolio")) refuse();
    if (research) {
      if (Object.keys(expected.scope).some((key) => expected.scope[key] !== receipt.context.scope[key])) refuse();
    }
    const keys = ["tenantId", "actorId", "conversationId", "runId", "selectedClientId"], rebind = receipt.initialRunRebind;
    if (rebind) {
      if (keys.some((key) => !Object.hasOwn(expected, key)) || keys.filter((key) => key !== "runId").some((key) => expected[key] !== receipt.context[key]) || expected.runId !== rebind.sourceRunId || receipt.context.runId !== rebind.targetRunId || rebind.sourceRunId === rebind.targetRunId) refuse();
    } else for (const key of keys) if (Object.hasOwn(expected, key) && receipt.context[key] !== expected[key]) refuse();
    return receipt;
  } catch {
    refuse();
  }
}
export {
  ConversationSessionResponseError,
  conversationSessionMetadata,
  conversationSessionVersion,
  receiveConversationSessionExpectedContext,
  receiveConversationSessionReceipt
};
