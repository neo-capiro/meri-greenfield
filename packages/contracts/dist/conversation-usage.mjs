// Generated browser recorded usage boundary.
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

// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

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

// usage-generated:./generated-validator.mjs
var validateRequest = validate33;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate33.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.conversationId !== void 0) {
              let data1 = data.conversationId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runId !== void 0) {
                let data2 = data.runId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
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
var validateResponse = validate34;
var schema35 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.conversation-usage/1" }, "conversationId": { "type": "string", "format": "uuid" }, "runId": { "type": "string", "format": "uuid" }, "recording": { "enum": ["not-recorded", "recorded"] }, "usage": { "anyOf": [{ "$ref": "#/$defs/RecordedUsage" }, { "type": "null" }] }, "toolAudit": { "anyOf": [{ "$ref": "#/$defs/RecordedToolAudit" }, { "type": "null" }] } }, "required": ["schemaVersion", "conversationId", "runId", "recording", "usage", "toolAudit"], "additionalProperties": false };
var schema36 = { "type": "object", "properties": { "status": { "enum": ["recorded", "unavailable"] }, "reason": { "anyOf": [{ "enum": ["configuration_mismatch", "result_unavailable", "baseline_mismatch", "baseline_unavailable", "baseline_configuration_mismatch", "lineage_unavailable", "counters_reset", "estimate_mismatch", "rates_unavailable", "amount_out_of_range"] }, { "type": "null" }] }, "currency": { "const": "USD" }, "runDelta": { "anyOf": [{ "$ref": "#/$defs/UsageRunDelta" }, { "type": "null" }] }, "cumulative": { "anyOf": [{ "$ref": "#/$defs/UsageCumulative" }, { "type": "null" }] }, "providerBilledUsd": { "type": "null" } }, "required": ["status", "reason", "currency", "runDelta", "cumulative", "providerBilledUsd"], "additionalProperties": false };
var func1 = require_ucs2length().default;
var pattern4 = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$", "u");
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.modelCounters === void 0 && (missing0 = "modelCounters")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "modelCounters")) {
            validate25.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.modelCounters !== void 0) {
              let data1 = data.modelCounters;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (Array.isArray(data1)) {
                  if (data1.length > 32) {
                    validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                    return false;
                  } else {
                    if (data1.length < 1) {
                      validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                      return false;
                    } else {
                      var valid1 = true;
                      const len0 = data1.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data2 = data1[i0];
                        const _errs6 = errors2;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                            let missing1;
                            if (data2.model === void 0 && (missing1 = "model") || data2.inputTokens === void 0 && (missing1 = "inputTokens") || data2.outputTokens === void 0 && (missing1 = "outputTokens") || data2.cacheReadInputTokens === void 0 && (missing1 = "cacheReadInputTokens") || data2.cacheCreationInputTokens === void 0 && (missing1 = "cacheCreationInputTokens") || data2.webSearchRequests === void 0 && (missing1 = "webSearchRequests")) {
                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                              return false;
                            } else {
                              const _errs9 = errors2;
                              for (const key1 in data2) {
                                if (!(key1 === "model" || key1 === "inputTokens" || key1 === "outputTokens" || key1 === "cacheReadInputTokens" || key1 === "cacheCreationInputTokens" || key1 === "webSearchRequests")) {
                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs9 === errors2) {
                                if (data2.model !== void 0) {
                                  let data3 = data2.model;
                                  const _errs10 = errors2;
                                  if (errors2 === _errs10) {
                                    if (typeof data3 === "string") {
                                      if (func1(data3) > 200) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data3) < 1) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        } else {
                                          if (!pattern4.test(data3)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                            return false;
                                          }
                                        }
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid3 = _errs10 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data2.inputTokens !== void 0) {
                                    let data4 = data2.inputTokens;
                                    const _errs12 = errors2;
                                    if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs12) {
                                      if (typeof data4 == "number" && isFinite(data4)) {
                                        if (data4 > 9007199254740991 || isNaN(data4)) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data4 < 0 || isNaN(data4)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid3 = _errs12 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data2.outputTokens !== void 0) {
                                      let data5 = data2.outputTokens;
                                      const _errs14 = errors2;
                                      if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs14) {
                                        if (typeof data5 == "number" && isFinite(data5)) {
                                          if (data5 > 9007199254740991 || isNaN(data5)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data5 < 0 || isNaN(data5)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid3 = _errs14 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data2.cacheReadInputTokens !== void 0) {
                                        let data6 = data2.cacheReadInputTokens;
                                        const _errs16 = errors2;
                                        if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs16) {
                                          if (typeof data6 == "number" && isFinite(data6)) {
                                            if (data6 > 9007199254740991 || isNaN(data6)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data6 < 0 || isNaN(data6)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data2.cacheCreationInputTokens !== void 0) {
                                          let data7 = data2.cacheCreationInputTokens;
                                          const _errs18 = errors2;
                                          if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs18) {
                                            if (typeof data7 == "number" && isFinite(data7)) {
                                              if (data7 > 9007199254740991 || isNaN(data7)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data7 < 0 || isNaN(data7)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid3 = _errs18 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data2.webSearchRequests !== void 0) {
                                            let data8 = data2.webSearchRequests;
                                            const _errs20 = errors2;
                                            if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs20) {
                                              if (typeof data8 == "number" && isFinite(data8)) {
                                                if (data8 > 9007199254740991 || isNaN(data8)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data8 < 0 || isNaN(data8)) {
                                                    validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid3 = _errs20 === errors2;
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
                          } else {
                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid1 = _errs6 === errors2;
                        if (!valid1) {
                          break;
                        }
                      }
                    }
                  }
                } else {
                  validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema40 = { "type": "object", "properties": { "sdk": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "cli": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "provider": { "enum": ["bedrock", "claude-api"] }, "cacheWriteTtl": { "enum": ["5m", "1h"] }, "priceRevision": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" } }, "required": ["sdk", "cli", "provider", "cacheWriteTtl", "priceRevision"], "additionalProperties": false };
var schema41 = { "type": "object", "properties": { "model": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "inputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "outputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheReadInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheCreationInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "webSearchRequests": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "sdkEstimateUsd": { "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, "provider": { "enum": ["bedrock", "firstParty", "unknown"] }, "costBasis": { "enum": ["list", "unknown"] } }, "required": ["model", "inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "sdkEstimateUsd", "provider", "costBasis"], "additionalProperties": false };
var func7 = Object.prototype.hasOwnProperty;
var pattern5 = new RegExp("^\\d+\\.\\d+\\.\\d+$", "u");
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
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.basis === void 0 && (missing0 = "basis") || data.models === void 0 && (missing0 = "models")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "basis" || key0 === "models")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate27.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.basis !== void 0) {
              let data1 = data.basis;
              const _errs4 = errors2;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sdk === void 0 && (missing1 = "sdk") || data1.cli === void 0 && (missing1 = "cli") || data1.provider === void 0 && (missing1 = "provider") || data1.cacheWriteTtl === void 0 && (missing1 = "cacheWriteTtl") || data1.priceRevision === void 0 && (missing1 = "priceRevision")) {
                    validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "sdk" || key1 === "cli" || key1 === "provider" || key1 === "cacheWriteTtl" || key1 === "priceRevision")) {
                        validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.sdk !== void 0) {
                        let data2 = data1.sdk;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (func1(data2) > 64) {
                              validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                              return false;
                            } else {
                              if (!pattern5.test(data2)) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                return false;
                              }
                            }
                          } else {
                            validate27.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.cli !== void 0) {
                          let data3 = data1.cli;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 64) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                                return false;
                              } else {
                                if (!pattern5.test(data3)) {
                                  validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                  return false;
                                }
                              }
                            } else {
                              validate27.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.provider !== void 0) {
                            let data4 = data1.provider;
                            const _errs12 = errors2;
                            if (!(data4 === "bedrock" || data4 === "claude-api")) {
                              validate27.errors = [{ instancePath: instancePath + "/basis/provider", schemaPath: "#/$defs/UsageBasis/properties/provider/enum", keyword: "enum", params: { allowedValues: schema40.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.cacheWriteTtl !== void 0) {
                              let data5 = data1.cacheWriteTtl;
                              const _errs13 = errors2;
                              if (!(data5 === "5m" || data5 === "1h")) {
                                validate27.errors = [{ instancePath: instancePath + "/basis/cacheWriteTtl", schemaPath: "#/$defs/UsageBasis/properties/cacheWriteTtl/enum", keyword: "enum", params: { allowedValues: schema40.properties.cacheWriteTtl.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.priceRevision !== void 0) {
                                let data6 = data1.priceRevision;
                                const _errs14 = errors2;
                                if (errors2 === _errs14) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 200) {
                                      validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      } else {
                                        if (!pattern4.test(data6)) {
                                          validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                          return false;
                                        }
                                      }
                                    }
                                  } else {
                                    validate27.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs14 === errors2;
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
                  validate27.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.models !== void 0) {
                let data7 = data.models;
                const _errs16 = errors2;
                if (errors2 === _errs16) {
                  if (Array.isArray(data7)) {
                    if (data7.length > 32) {
                      validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                      return false;
                    } else {
                      if (data7.length < 1) {
                        validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid3 = true;
                        const len0 = data7.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data8 = data7[i0];
                          const _errs18 = errors2;
                          const _errs19 = errors2;
                          if (errors2 === _errs19) {
                            if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                              let missing2;
                              if (data8.model === void 0 && (missing2 = "model") || data8.inputTokens === void 0 && (missing2 = "inputTokens") || data8.outputTokens === void 0 && (missing2 = "outputTokens") || data8.cacheReadInputTokens === void 0 && (missing2 = "cacheReadInputTokens") || data8.cacheCreationInputTokens === void 0 && (missing2 = "cacheCreationInputTokens") || data8.webSearchRequests === void 0 && (missing2 = "webSearchRequests") || data8.sdkEstimateUsd === void 0 && (missing2 = "sdkEstimateUsd") || data8.provider === void 0 && (missing2 = "provider") || data8.costBasis === void 0 && (missing2 = "costBasis")) {
                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                return false;
                              } else {
                                const _errs21 = errors2;
                                for (const key2 in data8) {
                                  if (!func7.call(schema41.properties, key2)) {
                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs21 === errors2) {
                                  if (data8.model !== void 0) {
                                    let data9 = data8.model;
                                    const _errs22 = errors2;
                                    if (errors2 === _errs22) {
                                      if (typeof data9 === "string") {
                                        if (func1(data9) > 200) {
                                          validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func1(data9) < 1) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern4.test(data9)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid5 = _errs22 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data8.inputTokens !== void 0) {
                                      let data10 = data8.inputTokens;
                                      const _errs24 = errors2;
                                      if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs24) {
                                        if (typeof data10 == "number" && isFinite(data10)) {
                                          if (data10 > 9007199254740991 || isNaN(data10)) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data10 < 0 || isNaN(data10)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid5 = _errs24 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data8.outputTokens !== void 0) {
                                        let data11 = data8.outputTokens;
                                        const _errs26 = errors2;
                                        if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                          validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs26) {
                                          if (typeof data11 == "number" && isFinite(data11)) {
                                            if (data11 > 9007199254740991 || isNaN(data11)) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data11 < 0 || isNaN(data11)) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid5 = _errs26 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data8.cacheReadInputTokens !== void 0) {
                                          let data12 = data8.cacheReadInputTokens;
                                          const _errs28 = errors2;
                                          if (!(typeof data12 == "number" && (!(data12 % 1) && !isNaN(data12)) && isFinite(data12))) {
                                            validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs28) {
                                            if (typeof data12 == "number" && isFinite(data12)) {
                                              if (data12 > 9007199254740991 || isNaN(data12)) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data12 < 0 || isNaN(data12)) {
                                                  validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid5 = _errs28 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data8.cacheCreationInputTokens !== void 0) {
                                            let data13 = data8.cacheCreationInputTokens;
                                            const _errs30 = errors2;
                                            if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs30) {
                                              if (typeof data13 == "number" && isFinite(data13)) {
                                                if (data13 > 9007199254740991 || isNaN(data13)) {
                                                  validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data13 < 0 || isNaN(data13)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid5 = _errs30 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data8.webSearchRequests !== void 0) {
                                              let data14 = data8.webSearchRequests;
                                              const _errs32 = errors2;
                                              if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                                                validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs32) {
                                                if (typeof data14 == "number" && isFinite(data14)) {
                                                  if (data14 > 9007199254740991 || isNaN(data14)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data14 < 0 || isNaN(data14)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid5 = _errs32 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data8.sdkEstimateUsd !== void 0) {
                                                let data15 = data8.sdkEstimateUsd;
                                                const _errs34 = errors2;
                                                if (errors2 === _errs34) {
                                                  if (typeof data15 == "number" && isFinite(data15)) {
                                                    if (data15 > 9007199254740992e-6 || isNaN(data15)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                                                      return false;
                                                    } else {
                                                      if (data15 < 0 || isNaN(data15)) {
                                                        validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs34 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data8.provider !== void 0) {
                                                  let data16 = data8.provider;
                                                  const _errs36 = errors2;
                                                  if (!(data16 === "bedrock" || data16 === "firstParty" || data16 === "unknown")) {
                                                    validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/provider", schemaPath: "#/$defs/UsageModelEstimate/properties/provider/enum", keyword: "enum", params: { allowedValues: schema41.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                                    return false;
                                                  }
                                                  var valid5 = _errs36 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data8.costBasis !== void 0) {
                                                    let data17 = data8.costBasis;
                                                    const _errs37 = errors2;
                                                    if (!(data17 === "list" || data17 === "unknown")) {
                                                      validate27.errors = [{ instancePath: instancePath + "/models/" + i0 + "/costBasis", schemaPath: "#/$defs/UsageModelEstimate/properties/costBasis/enum", keyword: "enum", params: { allowedValues: schema41.properties.costBasis.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
                                                    }
                                                    var valid5 = _errs37 === errors2;
                                                  } else {
                                                    var valid5 = true;
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
                              validate27.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid3 = _errs18 === errors2;
                          if (!valid3) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate27.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs16 === errors2;
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
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.status === void 0 && (missing0 = "status") || data.reason === void 0 && (missing0 = "reason") || data.currency === void 0 && (missing0 = "currency") || data.runDelta === void 0 && (missing0 = "runDelta") || data.cumulative === void 0 && (missing0 = "cumulative") || data.providerBilledUsd === void 0 && (missing0 = "providerBilledUsd")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "status" || key0 === "reason" || key0 === "currency" || key0 === "runDelta" || key0 === "cumulative" || key0 === "providerBilledUsd")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.status !== void 0) {
            let data0 = data.status;
            const _errs2 = errors2;
            if (!(data0 === "recorded" || data0 === "unavailable")) {
              validate24.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/enum", keyword: "enum", params: { allowedValues: schema36.properties.status.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.reason !== void 0) {
              let data1 = data.reason;
              const _errs3 = errors2;
              const _errs4 = errors2;
              let valid1 = false;
              const _errs5 = errors2;
              if (!(data1 === "configuration_mismatch" || data1 === "result_unavailable" || data1 === "baseline_mismatch" || data1 === "baseline_unavailable" || data1 === "baseline_configuration_mismatch" || data1 === "lineage_unavailable" || data1 === "counters_reset" || data1 === "estimate_mismatch" || data1 === "rates_unavailable" || data1 === "amount_out_of_range")) {
                const err0 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema36.properties.reason.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors2++;
              }
              var _valid0 = _errs5 === errors2;
              valid1 = valid1 || _valid0;
              const _errs6 = errors2;
              if (data1 !== null) {
                const err1 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors2++;
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err2 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
                validate24.errors = vErrors;
                return false;
              } else {
                errors2 = _errs4;
                if (vErrors !== null) {
                  if (_errs4) {
                    vErrors.length = _errs4;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.currency !== void 0) {
                const _errs8 = errors2;
                if ("USD" !== data.currency) {
                  validate24.errors = [{ instancePath: instancePath + "/currency", schemaPath: "#/properties/currency/const", keyword: "const", params: { allowedValue: "USD" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.runDelta !== void 0) {
                  let data3 = data.runDelta;
                  const _errs9 = errors2;
                  const _errs10 = errors2;
                  let valid2 = false;
                  const _errs11 = errors2;
                  if (!validate25(data3, { instancePath: instancePath + "/runDelta", parentData: data, parentDataProperty: "runDelta", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                    errors2 = vErrors.length;
                  }
                  var _valid1 = _errs11 === errors2;
                  valid2 = valid2 || _valid1;
                  const _errs12 = errors2;
                  if (data3 !== null) {
                    const err3 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var _valid1 = _errs12 === errors2;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err4 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                    validate24.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs10;
                    if (vErrors !== null) {
                      if (_errs10) {
                        vErrors.length = _errs10;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs9 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.cumulative !== void 0) {
                    let data4 = data.cumulative;
                    const _errs14 = errors2;
                    const _errs15 = errors2;
                    let valid3 = false;
                    const _errs16 = errors2;
                    if (!validate27(data4, { instancePath: instancePath + "/cumulative", parentData: data, parentDataProperty: "cumulative", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid2 = _errs16 === errors2;
                    valid3 = valid3 || _valid2;
                    const _errs17 = errors2;
                    if (data4 !== null) {
                      const err5 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    }
                    var _valid2 = _errs17 === errors2;
                    valid3 = valid3 || _valid2;
                    if (!valid3) {
                      const err6 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                      validate24.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs15;
                      if (vErrors !== null) {
                        if (_errs15) {
                          vErrors.length = _errs15;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs14 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.providerBilledUsd !== void 0) {
                      const _errs19 = errors2;
                      if (data.providerBilledUsd !== null) {
                        validate24.errors = [{ instancePath: instancePath + "/providerBilledUsd", schemaPath: "#/properties/providerBilledUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                        return false;
                      }
                      var valid0 = _errs19 === errors2;
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
    } else {
      validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors2 === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema43 = { "type": "object", "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "executionOutcome": { "enum": ["completed", "failed"] }, "durationMs": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] } }, "required": ["name", "executionOutcome", "durationMs"], "additionalProperties": false };
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
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.coverage === void 0 && (missing0 = "coverage") || data.partial === void 0 && (missing0 = "partial") || data.omitted === void 0 && (missing0 = "omitted") || data.tools === void 0 && (missing0 = "tools")) {
        validate30.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "coverage" || key0 === "partial" || key0 === "omitted" || key0 === "tools")) {
            validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.coverage !== void 0) {
            const _errs2 = errors2;
            if ("recorded-hooks-only" !== data.coverage) {
              validate30.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/const", keyword: "const", params: { allowedValue: "recorded-hooks-only" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partial !== void 0) {
              const _errs3 = errors2;
              if (typeof data.partial !== "boolean") {
                validate30.errors = [{ instancePath: instancePath + "/partial", schemaPath: "#/properties/partial/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                return false;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.omitted !== void 0) {
                let data2 = data.omitted;
                const _errs5 = errors2;
                if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                  validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors2 === _errs5) {
                  if (typeof data2 == "number" && isFinite(data2)) {
                    if (data2 > 9007199254740991 || isNaN(data2)) {
                      validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                        return false;
                      }
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.tools !== void 0) {
                  let data3 = data.tools;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (Array.isArray(data3)) {
                      if (data3.length > 128) {
                        validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                        return false;
                      } else {
                        var valid1 = true;
                        const len0 = data3.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data4 = data3[i0];
                          const _errs9 = errors2;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                              let missing1;
                              if (data4.name === void 0 && (missing1 = "name") || data4.executionOutcome === void 0 && (missing1 = "executionOutcome") || data4.durationMs === void 0 && (missing1 = "durationMs")) {
                                validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs12 = errors2;
                                for (const key1 in data4) {
                                  if (!(key1 === "name" || key1 === "executionOutcome" || key1 === "durationMs")) {
                                    validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs12 === errors2) {
                                  if (data4.name !== void 0) {
                                    let data5 = data4.name;
                                    const _errs13 = errors2;
                                    if (errors2 === _errs13) {
                                      if (typeof data5 === "string") {
                                        if (func1(data5) > 200) {
                                          validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func1(data5) < 1) {
                                            validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern4.test(data5)) {
                                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs13 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data4.executionOutcome !== void 0) {
                                      let data6 = data4.executionOutcome;
                                      const _errs15 = errors2;
                                      if (!(data6 === "completed" || data6 === "failed")) {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/executionOutcome", schemaPath: "#/$defs/RecordedToolOutcome/properties/executionOutcome/enum", keyword: "enum", params: { allowedValues: schema43.properties.executionOutcome.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid3 = _errs15 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data4.durationMs !== void 0) {
                                        let data7 = data4.durationMs;
                                        const _errs16 = errors2;
                                        const _errs17 = errors2;
                                        let valid4 = false;
                                        const _errs18 = errors2;
                                        if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                          const err0 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err0];
                                          } else {
                                            vErrors.push(err0);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs18) {
                                          if (typeof data7 == "number" && isFinite(data7)) {
                                            if (data7 > 9007199254740991 || isNaN(data7)) {
                                              const err1 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err1];
                                              } else {
                                                vErrors.push(err1);
                                              }
                                              errors2++;
                                            } else {
                                              if (data7 < 0 || isNaN(data7)) {
                                                const err2 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                if (vErrors === null) {
                                                  vErrors = [err2];
                                                } else {
                                                  vErrors.push(err2);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var _valid0 = _errs18 === errors2;
                                        valid4 = valid4 || _valid0;
                                        const _errs20 = errors2;
                                        if (data7 !== null) {
                                          const err3 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err3];
                                          } else {
                                            vErrors.push(err3);
                                          }
                                          errors2++;
                                        }
                                        var _valid0 = _errs20 === errors2;
                                        valid4 = valid4 || _valid0;
                                        if (!valid4) {
                                          const err4 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors2++;
                                          validate30.errors = vErrors;
                                          return false;
                                        } else {
                                          errors2 = _errs17;
                                          if (vErrors !== null) {
                                            if (_errs17) {
                                              vErrors.length = _errs17;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                          if (!valid1) {
                            break;
                          }
                        }
                      }
                    } else {
                      validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                      return false;
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate30.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate30.errors = vErrors;
  return errors2 === 0;
}
validate30.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.recording === void 0 && (missing0 = "recording") || data.usage === void 0 && (missing0 = "usage") || data.toolAudit === void 0 && (missing0 = "toolAudit")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId" || key0 === "recording" || key0 === "usage" || key0 === "toolAudit")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate34.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.conversationId !== void 0) {
              let data1 = data.conversationId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runId !== void 0) {
                let data2 = data.runId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.recording !== void 0) {
                  let data3 = data.recording;
                  const _errs7 = errors2;
                  if (!(data3 === "not-recorded" || data3 === "recorded")) {
                    validate34.errors = [{ instancePath: instancePath + "/recording", schemaPath: "#/properties/recording/enum", keyword: "enum", params: { allowedValues: schema35.properties.recording.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.usage !== void 0) {
                    let data4 = data.usage;
                    const _errs8 = errors2;
                    const _errs9 = errors2;
                    let valid1 = false;
                    const _errs10 = errors2;
                    if (!validate24(data4, { instancePath: instancePath + "/usage", parentData: data, parentDataProperty: "usage", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid0 = _errs10 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs11 = errors2;
                    if (data4 !== null) {
                      const err0 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs11 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err1 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                      validate34.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs9;
                      if (vErrors !== null) {
                        if (_errs9) {
                          vErrors.length = _errs9;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs8 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.toolAudit !== void 0) {
                      let data5 = data.toolAudit;
                      const _errs13 = errors2;
                      const _errs14 = errors2;
                      let valid2 = false;
                      const _errs15 = errors2;
                      if (!validate30(data5, { instancePath: instancePath + "/toolAudit", parentData: data, parentDataProperty: "toolAudit", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
                        errors2 = vErrors.length;
                      }
                      var _valid1 = _errs15 === errors2;
                      valid2 = valid2 || _valid1;
                      const _errs16 = errors2;
                      if (data5 !== null) {
                        const err2 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                      var _valid1 = _errs16 === errors2;
                      valid2 = valid2 || _valid1;
                      if (!valid2) {
                        const err3 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors2++;
                        validate34.errors = vErrors;
                        return false;
                      } else {
                        errors2 = _errs14;
                        if (vErrors !== null) {
                          if (_errs14) {
                            vErrors.length = _errs14;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs13 === errors2;
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
    } else {
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors2 === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// conversation-history/protocol.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationHistoryVersion = "1.1.0";
var HISTORY_PATHS = freeze({ list: "/api/conversations/list", transcript: "/api/conversations/transcript", nextTurn: "/api/conversations/next-turn", summaries: "/api/conversations/summaries", manage: "/api/conversations/manage" });
var historyDomainErrorStatuses = freeze({ CONVERSATION_REQUEST_INVALID: 400, CONVERSATION_CURSOR_INVALID: 400, CONVERSATION_NOT_FOUND: 404, CONVERSATION_TURN_CONFLICT: 409, CONVERSATION_MANAGEMENT_CONFLICT: 409, CONVERSATION_RESTORE_EXPIRED: 410, CONVERSATION_STORE_CORRUPT: 500, CONVERSATION_TURN_UNAVAILABLE: 503, CONVERSATION_UNAVAILABLE: 503 });
var historyErrorStatuses = freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], ...Object.fromEntries(Object.entries(historyDomainErrorStatuses).map(([code, status]) => [code, [status]])) });
var conversationHistoryMetadata = freeze({
  packageVersion: "0.1.15",
  historyVersion: conversationHistoryVersion,
  schemaId: "urn:meri:conversation-history:1.1.0",
  routes: Object.fromEntries(Object.entries(HISTORY_PATHS).map(([route, path]) => [route, { method: "POST", path }])),
  authentication: { owner: "native identity and current Core membership", header: "authorization", scheme: "Bearer", serverSideCredentialOnly: true, validationGrantsAuthority: false },
  limits: { requestBytes: 131072, responseBytes: 2097152, pageItems: 100 },
  defaults: { limit: 50, after: 0, before: null },
  cursor: { transcript: "conversation sequence", runLocal: "UIEvent.sequence", translation: "conversation sequence = sequenceBase + UIEvent.sequence" },
  promptIdentity: "conversationId + promptLineage.logicalRequestId",
  turnRecovery: "same sourceRunId returns same targetBinding; retain exact submit requestId/prompt",
  errorOutcomes: ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED"],
  errorStatuses: historyErrorStatuses
});

// conversation-usage/protocol.mjs
var CONVERSATION_USAGE_SCHEMA = "meri.conversation-usage/1";
var CONVERSATION_USAGE_PATH = "/api/conversations/usage";
var usageUnavailableReasons = Object.freeze([
  "configuration_mismatch",
  "result_unavailable",
  "baseline_mismatch",
  "baseline_unavailable",
  "baseline_configuration_mismatch",
  "lineage_unavailable",
  "counters_reset",
  "estimate_mismatch",
  "rates_unavailable",
  "amount_out_of_range"
]);
var usageCounterNames = Object.freeze(["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests"]);
var conversationUsageErrors = Object.freeze({
  ...historyErrorStatuses,
  USAGE_REQUEST_INVALID: Object.freeze([400]),
  USAGE_RECORD_CORRUPT: Object.freeze([500]),
  USAGE_UNAVAILABLE: Object.freeze([503])
});
var conversationUsageMetadata = Object.freeze({
  version: "1.0.0",
  packageVersion: "0.1.15",
  schemaId: "urn:meri:conversation-usage:1.0.0",
  path: CONVERSATION_USAGE_PATH,
  method: "POST",
  requestBytes: 4096,
  responseBytes: 131072,
  maxModels: 32,
  maxTools: 128,
  authentication: "current native product bearer and Core access",
  currency: "USD",
  money: "recorded SDK estimate; provider billing unavailable",
  counters: "original token/cache-token counts and web-search request counts",
  durationUnit: "milliseconds; null means unknown",
  cumulativeScope: "SDK query pipeline including subagents/compaction and prior resumed/forked usage",
  runScope: "existing accounting run delta",
  tools: "recorded post-tool execution outcomes only; not external-effect confirmation",
  coverage: "recorded hooks only; omitted count is explicit",
  correlation: "none with UI tool.call requestId, source references or other rows",
  identifiers: "bounded inert text; never links, commands or authority"
});

// conversation-usage/semantics.mjs
var ConversationUsageResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ConversationUsageResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new ConversationUsageResponseError(code);
};
function assertUsageResponseSemantics(value, request) {
  if (value.conversationId !== request.conversationId || value.runId !== request.runId) fail2("USAGE_REQUEST_MISMATCH");
  if (value.recording === "not-recorded") {
    if (value.usage !== null || value.toolAudit !== null) fail2("INVALID_USAGE_RECORDING");
    return value;
  }
  const usage = value.usage, audit = value.toolAudit;
  if (usage === null || audit === null || audit.partial !== audit.omitted > 0) fail2("INVALID_USAGE_RECORDING");
  if (usage.status === "recorded" ? usage.reason !== null || usage.runDelta === null || usage.cumulative === null : usage.reason === null) fail2("INVALID_USAGE_STATUS");
  const cumulative = usage.cumulative?.models ?? [], delta = usage.runDelta?.modelCounters ?? [];
  for (const entries of [cumulative, delta]) if (new Set(entries.map((m) => m.model)).size !== entries.length) fail2("DUPLICATE_USAGE_MODEL");
  if (usage.runDelta !== null) {
    if (usage.cumulative === null || delta.length !== cumulative.length || usage.runDelta.sdkEstimateUsd > usage.cumulative.sdkEstimateUsd + 1e-12) fail2("INVALID_USAGE_DELTA");
    for (const model of delta) {
      const original = cumulative.find((m) => m.model === model.model);
      if (!original || usageCounterNames.some((key) => model[key] > original[key])) fail2("INVALID_USAGE_DELTA");
    }
  }
  return value;
}

// conversation-usage/conversation-usage-receiver.mjs
var admitted = /* @__PURE__ */ new WeakMap();
var parse = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
};
function receiveConversationUsageRequest(bytes) {
  const value = parse(bytes, conversationUsageMetadata.requestBytes);
  if (!validateRequest(value)) fail2("USAGE_REQUEST_INVALID");
  admitted.set(value, structuredClone(value));
  return value;
}
function receiveConversationUsageResponse(status, bytes, request) {
  const expected = admitted.get(request);
  if (!expected) fail2("UNADMITTED_REQUEST");
  const value = parse(bytes, conversationUsageMetadata.responseBytes);
  if (status !== 200) {
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !value.error || Object.keys(value.error).length !== 1 || typeof value.error.code !== "string" || !Object.hasOwn(conversationUsageErrors, value.error.code) || !conversationUsageErrors[value.error.code].includes(status)) fail2("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateResponse(value)) fail2("INVALID_USAGE_RESPONSE");
  return assertUsageResponseSemantics(value, expected);
}
export {
  CONVERSATION_USAGE_PATH,
  CONVERSATION_USAGE_SCHEMA,
  ConversationUsageResponseError,
  conversationUsageErrors,
  conversationUsageMetadata,
  receiveConversationUsageRequest,
  receiveConversationUsageResponse,
  usageCounterNames,
  usageUnavailableReasons
};
