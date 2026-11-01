// Generated self-contained browser receiver. No authority or deployment acceptance.
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

// user-preferences-generated:./generated-validator.mjs
var validateUserPreferences = validate31;
var schema33 = { "type": "object", "properties": { "defaultModel": { "anyOf": [{ "type": "object", "properties": { "provider": { "enum": ["bedrock", "claude-api"] }, "modelId": { "type": "string", "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, "effort": { "anyOf": [{ "type": "null" }, { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }] } }, "required": ["provider", "modelId", "effort"], "additionalProperties": false }, { "type": "null" }] }, "theme": { "type": "string", "enum": ["system", "light", "dark"] }, "density": { "type": "string", "enum": ["comfortable", "compact"] }, "timezone": { "type": ["string", "null"], "maxLength": 64 }, "notifications": { "type": "object", "properties": { "runCompleted": { "type": "boolean" }, "approvalRequested": { "type": "boolean" }, "memoryReviewed": { "type": "boolean" } }, "required": ["runCompleted", "approvalRequested", "memoryReviewed"], "additionalProperties": false }, "defaultClientId": { "anyOf": [{ "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, { "type": "null" }] } }, "required": ["defaultModel", "theme", "density", "timezone", "notifications", "defaultClientId"], "additionalProperties": false };
var pattern4 = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$", "u");
var pattern5 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var func1 = require_ucs2length().default;
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
      if (data.defaultModel === void 0 && (missing0 = "defaultModel") || data.theme === void 0 && (missing0 = "theme") || data.density === void 0 && (missing0 = "density") || data.timezone === void 0 && (missing0 = "timezone") || data.notifications === void 0 && (missing0 = "notifications") || data.defaultClientId === void 0 && (missing0 = "defaultClientId")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "defaultModel" || key0 === "theme" || key0 === "density" || key0 === "timezone" || key0 === "notifications" || key0 === "defaultClientId")) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.defaultModel !== void 0) {
            let data0 = data.defaultModel;
            const _errs2 = errors2;
            const _errs3 = errors2;
            let valid1 = false;
            const _errs4 = errors2;
            if (errors2 === _errs4) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.provider === void 0 && (missing1 = "provider") || data0.modelId === void 0 && (missing1 = "modelId") || data0.effort === void 0 && (missing1 = "effort")) {
                  const err0 = { instancePath: instancePath + "/defaultModel", schemaPath: "#/properties/defaultModel/anyOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors2++;
                } else {
                  const _errs6 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "provider" || key1 === "modelId" || key1 === "effort")) {
                      const err1 = { instancePath: instancePath + "/defaultModel", schemaPath: "#/properties/defaultModel/anyOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                      break;
                    }
                  }
                  if (_errs6 === errors2) {
                    if (data0.provider !== void 0) {
                      let data1 = data0.provider;
                      const _errs7 = errors2;
                      if (!(data1 === "bedrock" || data1 === "claude-api")) {
                        const err2 = { instancePath: instancePath + "/defaultModel/provider", schemaPath: "#/properties/defaultModel/anyOf/0/properties/provider/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.provider.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                      var valid2 = _errs7 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.modelId !== void 0) {
                        let data2 = data0.modelId;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (!pattern4.test(data2)) {
                              const err3 = { instancePath: instancePath + "/defaultModel/modelId", schemaPath: "#/properties/defaultModel/anyOf/0/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' };
                              if (vErrors === null) {
                                vErrors = [err3];
                              } else {
                                vErrors.push(err3);
                              }
                              errors2++;
                            }
                          } else {
                            const err4 = { instancePath: instancePath + "/defaultModel/modelId", schemaPath: "#/properties/defaultModel/anyOf/0/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.effort !== void 0) {
                          let data3 = data0.effort;
                          const _errs10 = errors2;
                          const _errs11 = errors2;
                          let valid3 = false;
                          const _errs12 = errors2;
                          if (data3 !== null) {
                            const err5 = { instancePath: instancePath + "/defaultModel/effort", schemaPath: "#/properties/defaultModel/anyOf/0/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs12 === errors2;
                          valid3 = valid3 || _valid1;
                          const _errs14 = errors2;
                          if (typeof data3 !== "string") {
                            const err6 = { instancePath: instancePath + "/defaultModel/effort", schemaPath: "#/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err6];
                            } else {
                              vErrors.push(err6);
                            }
                            errors2++;
                          }
                          if (!(data3 === "low" || data3 === "medium" || data3 === "high" || data3 === "xhigh" || data3 === "max")) {
                            const err7 = { instancePath: instancePath + "/defaultModel/effort", schemaPath: "#/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err7];
                            } else {
                              vErrors.push(err7);
                            }
                            errors2++;
                          }
                          var _valid1 = _errs14 === errors2;
                          valid3 = valid3 || _valid1;
                          if (!valid3) {
                            const err8 = { instancePath: instancePath + "/defaultModel/effort", schemaPath: "#/properties/defaultModel/anyOf/0/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err8];
                            } else {
                              vErrors.push(err8);
                            }
                            errors2++;
                          } else {
                            errors2 = _errs11;
                            if (vErrors !== null) {
                              if (_errs11) {
                                vErrors.length = _errs11;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                }
              } else {
                const err9 = { instancePath: instancePath + "/defaultModel", schemaPath: "#/properties/defaultModel/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err9];
                } else {
                  vErrors.push(err9);
                }
                errors2++;
              }
            }
            var _valid0 = _errs4 === errors2;
            valid1 = valid1 || _valid0;
            const _errs16 = errors2;
            if (data0 !== null) {
              const err10 = { instancePath: instancePath + "/defaultModel", schemaPath: "#/properties/defaultModel/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors2++;
            }
            var _valid0 = _errs16 === errors2;
            valid1 = valid1 || _valid0;
            if (!valid1) {
              const err11 = { instancePath: instancePath + "/defaultModel", schemaPath: "#/properties/defaultModel/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors2++;
              validate31.errors = vErrors;
              return false;
            } else {
              errors2 = _errs3;
              if (vErrors !== null) {
                if (_errs3) {
                  vErrors.length = _errs3;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.theme !== void 0) {
              let data4 = data.theme;
              const _errs18 = errors2;
              if (typeof data4 !== "string") {
                validate31.errors = [{ instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              if (!(data4 === "system" || data4 === "light" || data4 === "dark")) {
                validate31.errors = [{ instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/enum", keyword: "enum", params: { allowedValues: schema33.properties.theme.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs18 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.density !== void 0) {
                let data5 = data.density;
                const _errs20 = errors2;
                if (typeof data5 !== "string") {
                  validate31.errors = [{ instancePath: instancePath + "/density", schemaPath: "#/properties/density/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                if (!(data5 === "comfortable" || data5 === "compact")) {
                  validate31.errors = [{ instancePath: instancePath + "/density", schemaPath: "#/properties/density/enum", keyword: "enum", params: { allowedValues: schema33.properties.density.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs20 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.timezone !== void 0) {
                  let data6 = data.timezone;
                  const _errs22 = errors2;
                  if (typeof data6 !== "string" && data6 !== null) {
                    validate31.errors = [{ instancePath: instancePath + "/timezone", schemaPath: "#/properties/timezone/type", keyword: "type", params: { type: schema33.properties.timezone.type }, message: "must be string,null" }];
                    return false;
                  }
                  if (errors2 === _errs22) {
                    if (typeof data6 === "string") {
                      if (func1(data6) > 64) {
                        validate31.errors = [{ instancePath: instancePath + "/timezone", schemaPath: "#/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs22 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.notifications !== void 0) {
                    let data7 = data.notifications;
                    const _errs24 = errors2;
                    if (errors2 === _errs24) {
                      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                        let missing2;
                        if (data7.runCompleted === void 0 && (missing2 = "runCompleted") || data7.approvalRequested === void 0 && (missing2 = "approvalRequested") || data7.memoryReviewed === void 0 && (missing2 = "memoryReviewed")) {
                          validate31.errors = [{ instancePath: instancePath + "/notifications", schemaPath: "#/properties/notifications/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                          return false;
                        } else {
                          const _errs26 = errors2;
                          for (const key2 in data7) {
                            if (!(key2 === "runCompleted" || key2 === "approvalRequested" || key2 === "memoryReviewed")) {
                              validate31.errors = [{ instancePath: instancePath + "/notifications", schemaPath: "#/properties/notifications/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs26 === errors2) {
                            if (data7.runCompleted !== void 0) {
                              const _errs27 = errors2;
                              if (typeof data7.runCompleted !== "boolean") {
                                validate31.errors = [{ instancePath: instancePath + "/notifications/runCompleted", schemaPath: "#/properties/notifications/properties/runCompleted/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                return false;
                              }
                              var valid4 = _errs27 === errors2;
                            } else {
                              var valid4 = true;
                            }
                            if (valid4) {
                              if (data7.approvalRequested !== void 0) {
                                const _errs29 = errors2;
                                if (typeof data7.approvalRequested !== "boolean") {
                                  validate31.errors = [{ instancePath: instancePath + "/notifications/approvalRequested", schemaPath: "#/properties/notifications/properties/approvalRequested/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                  return false;
                                }
                                var valid4 = _errs29 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data7.memoryReviewed !== void 0) {
                                  const _errs31 = errors2;
                                  if (typeof data7.memoryReviewed !== "boolean") {
                                    validate31.errors = [{ instancePath: instancePath + "/notifications/memoryReviewed", schemaPath: "#/properties/notifications/properties/memoryReviewed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                    return false;
                                  }
                                  var valid4 = _errs31 === errors2;
                                } else {
                                  var valid4 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate31.errors = [{ instancePath: instancePath + "/notifications", schemaPath: "#/properties/notifications/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs24 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.defaultClientId !== void 0) {
                      let data11 = data.defaultClientId;
                      const _errs33 = errors2;
                      const _errs34 = errors2;
                      let valid5 = false;
                      const _errs35 = errors2;
                      if (errors2 === _errs35) {
                        if (typeof data11 === "string") {
                          if (!pattern5.test(data11)) {
                            const err12 = { instancePath: instancePath + "/defaultClientId", schemaPath: "#/properties/defaultClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                            if (vErrors === null) {
                              vErrors = [err12];
                            } else {
                              vErrors.push(err12);
                            }
                            errors2++;
                          }
                        } else {
                          const err13 = { instancePath: instancePath + "/defaultClientId", schemaPath: "#/properties/defaultClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err13];
                          } else {
                            vErrors.push(err13);
                          }
                          errors2++;
                        }
                      }
                      var _valid2 = _errs35 === errors2;
                      valid5 = valid5 || _valid2;
                      const _errs37 = errors2;
                      if (data11 !== null) {
                        const err14 = { instancePath: instancePath + "/defaultClientId", schemaPath: "#/properties/defaultClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err14];
                        } else {
                          vErrors.push(err14);
                        }
                        errors2++;
                      }
                      var _valid2 = _errs37 === errors2;
                      valid5 = valid5 || _valid2;
                      if (!valid5) {
                        const err15 = { instancePath: instancePath + "/defaultClientId", schemaPath: "#/properties/defaultClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err15];
                        } else {
                          vErrors.push(err15);
                        }
                        errors2++;
                        validate31.errors = vErrors;
                        return false;
                      } else {
                        errors2 = _errs34;
                        if (vErrors !== null) {
                          if (_errs34) {
                            vErrors.length = _errs34;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs33 === errors2;
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
      validate31.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors2 === 0;
}
validate31.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateUserPreferencesOwner = validate32;
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
      if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId")) {
        validate32.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "tenantId" || key0 === "actorId")) {
            validate32.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.tenantId !== void 0) {
            let data0 = data.tenantId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (func1(data0) > 128) {
                  validate32.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate32.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate32.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.actorId !== void 0) {
              let data1 = data.actorId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 128) {
                    validate32.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate32.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate32.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate32.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate32.errors = vErrors;
  return errors2 === 0;
}
validate32.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateUserPreferencesReadRequest = validate33;
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
      for (const key0 in data) {
        validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
        return false;
        break;
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
var validateUserPreferencesSaveRequest = validate34;
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
      if (data.expectedRevision === void 0 && (missing0 = "expectedRevision") || data.preferences === void 0 && (missing0 = "preferences")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "expectedRevision" || key0 === "preferences")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.expectedRevision !== void 0) {
            let data0 = data.expectedRevision;
            const _errs2 = errors2;
            if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
              validate34.errors = [{ instancePath: instancePath + "/expectedRevision", schemaPath: "#/properties/expectedRevision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
              return false;
            }
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740990 || isNaN(data0)) {
                  validate34.errors = [{ instancePath: instancePath + "/expectedRevision", schemaPath: "#/properties/expectedRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740990 }, message: "must be <= 9007199254740990" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate34.errors = [{ instancePath: instancePath + "/expectedRevision", schemaPath: "#/properties/expectedRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.preferences !== void 0) {
              let data1 = data.preferences;
              const _errs4 = errors2;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.defaultModel === void 0 && (missing1 = "defaultModel") || data1.theme === void 0 && (missing1 = "theme") || data1.density === void 0 && (missing1 = "density") || data1.timezone === void 0 && (missing1 = "timezone") || data1.notifications === void 0 && (missing1 = "notifications") || data1.defaultClientId === void 0 && (missing1 = "defaultClientId")) {
                    validate34.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "defaultModel" || key1 === "theme" || key1 === "density" || key1 === "timezone" || key1 === "notifications" || key1 === "defaultClientId")) {
                        validate34.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.defaultModel !== void 0) {
                        let data2 = data1.defaultModel;
                        const _errs8 = errors2;
                        const _errs9 = errors2;
                        let valid3 = false;
                        const _errs10 = errors2;
                        if (errors2 === _errs10) {
                          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                            let missing2;
                            if (data2.provider === void 0 && (missing2 = "provider") || data2.modelId === void 0 && (missing2 = "modelId") || data2.effort === void 0 && (missing2 = "effort")) {
                              const err0 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                              if (vErrors === null) {
                                vErrors = [err0];
                              } else {
                                vErrors.push(err0);
                              }
                              errors2++;
                            } else {
                              const _errs12 = errors2;
                              for (const key2 in data2) {
                                if (!(key2 === "provider" || key2 === "modelId" || key2 === "effort")) {
                                  const err1 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err1];
                                  } else {
                                    vErrors.push(err1);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs12 === errors2) {
                                if (data2.provider !== void 0) {
                                  let data3 = data2.provider;
                                  const _errs13 = errors2;
                                  if (!(data3 === "bedrock" || data3 === "claude-api")) {
                                    const err2 = { instancePath: instancePath + "/preferences/defaultModel/provider", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/provider/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.provider.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err2];
                                    } else {
                                      vErrors.push(err2);
                                    }
                                    errors2++;
                                  }
                                  var valid4 = _errs13 === errors2;
                                } else {
                                  var valid4 = true;
                                }
                                if (valid4) {
                                  if (data2.modelId !== void 0) {
                                    let data4 = data2.modelId;
                                    const _errs14 = errors2;
                                    if (errors2 === _errs14) {
                                      if (typeof data4 === "string") {
                                        if (!pattern4.test(data4)) {
                                          const err3 = { instancePath: instancePath + "/preferences/defaultModel/modelId", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' };
                                          if (vErrors === null) {
                                            vErrors = [err3];
                                          } else {
                                            vErrors.push(err3);
                                          }
                                          errors2++;
                                        }
                                      } else {
                                        const err4 = { instancePath: instancePath + "/preferences/defaultModel/modelId", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err4];
                                        } else {
                                          vErrors.push(err4);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid4 = _errs14 === errors2;
                                  } else {
                                    var valid4 = true;
                                  }
                                  if (valid4) {
                                    if (data2.effort !== void 0) {
                                      let data5 = data2.effort;
                                      const _errs16 = errors2;
                                      const _errs17 = errors2;
                                      let valid5 = false;
                                      const _errs18 = errors2;
                                      if (data5 !== null) {
                                        const err5 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                        if (vErrors === null) {
                                          vErrors = [err5];
                                        } else {
                                          vErrors.push(err5);
                                        }
                                        errors2++;
                                      }
                                      var _valid1 = _errs18 === errors2;
                                      valid5 = valid5 || _valid1;
                                      const _errs20 = errors2;
                                      if (typeof data5 !== "string") {
                                        const err6 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err6];
                                        } else {
                                          vErrors.push(err6);
                                        }
                                        errors2++;
                                      }
                                      if (!(data5 === "low" || data5 === "medium" || data5 === "high" || data5 === "xhigh" || data5 === "max")) {
                                        const err7 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                        if (vErrors === null) {
                                          vErrors = [err7];
                                        } else {
                                          vErrors.push(err7);
                                        }
                                        errors2++;
                                      }
                                      var _valid1 = _errs20 === errors2;
                                      valid5 = valid5 || _valid1;
                                      if (!valid5) {
                                        const err8 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                        if (vErrors === null) {
                                          vErrors = [err8];
                                        } else {
                                          vErrors.push(err8);
                                        }
                                        errors2++;
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
                                      var valid4 = _errs16 === errors2;
                                    } else {
                                      var valid4 = true;
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err9 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err9];
                            } else {
                              vErrors.push(err9);
                            }
                            errors2++;
                          }
                        }
                        var _valid0 = _errs10 === errors2;
                        valid3 = valid3 || _valid0;
                        const _errs22 = errors2;
                        if (data2 !== null) {
                          const err10 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err10];
                          } else {
                            vErrors.push(err10);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs22 === errors2;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err11 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err11];
                          } else {
                            vErrors.push(err11);
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
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.theme !== void 0) {
                          let data6 = data1.theme;
                          const _errs24 = errors2;
                          if (typeof data6 !== "string") {
                            validate34.errors = [{ instancePath: instancePath + "/preferences/theme", schemaPath: "#/$defs/UserPreferences/properties/theme/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                          if (!(data6 === "system" || data6 === "light" || data6 === "dark")) {
                            validate34.errors = [{ instancePath: instancePath + "/preferences/theme", schemaPath: "#/$defs/UserPreferences/properties/theme/enum", keyword: "enum", params: { allowedValues: schema33.properties.theme.enum }, message: "must be equal to one of the allowed values" }];
                            return false;
                          }
                          var valid2 = _errs24 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.density !== void 0) {
                            let data7 = data1.density;
                            const _errs26 = errors2;
                            if (typeof data7 !== "string") {
                              validate34.errors = [{ instancePath: instancePath + "/preferences/density", schemaPath: "#/$defs/UserPreferences/properties/density/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                            if (!(data7 === "comfortable" || data7 === "compact")) {
                              validate34.errors = [{ instancePath: instancePath + "/preferences/density", schemaPath: "#/$defs/UserPreferences/properties/density/enum", keyword: "enum", params: { allowedValues: schema33.properties.density.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid2 = _errs26 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.timezone !== void 0) {
                              let data8 = data1.timezone;
                              const _errs28 = errors2;
                              if (typeof data8 !== "string" && data8 !== null) {
                                validate34.errors = [{ instancePath: instancePath + "/preferences/timezone", schemaPath: "#/$defs/UserPreferences/properties/timezone/type", keyword: "type", params: { type: schema33.properties.timezone.type }, message: "must be string,null" }];
                                return false;
                              }
                              if (errors2 === _errs28) {
                                if (typeof data8 === "string") {
                                  if (func1(data8) > 64) {
                                    validate34.errors = [{ instancePath: instancePath + "/preferences/timezone", schemaPath: "#/$defs/UserPreferences/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                                    return false;
                                  }
                                }
                              }
                              var valid2 = _errs28 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.notifications !== void 0) {
                                let data9 = data1.notifications;
                                const _errs30 = errors2;
                                if (errors2 === _errs30) {
                                  if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                                    let missing3;
                                    if (data9.runCompleted === void 0 && (missing3 = "runCompleted") || data9.approvalRequested === void 0 && (missing3 = "approvalRequested") || data9.memoryReviewed === void 0 && (missing3 = "memoryReviewed")) {
                                      validate34.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                      return false;
                                    } else {
                                      const _errs32 = errors2;
                                      for (const key3 in data9) {
                                        if (!(key3 === "runCompleted" || key3 === "approvalRequested" || key3 === "memoryReviewed")) {
                                          validate34.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs32 === errors2) {
                                        if (data9.runCompleted !== void 0) {
                                          const _errs33 = errors2;
                                          if (typeof data9.runCompleted !== "boolean") {
                                            validate34.errors = [{ instancePath: instancePath + "/preferences/notifications/runCompleted", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/runCompleted/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                            return false;
                                          }
                                          var valid6 = _errs33 === errors2;
                                        } else {
                                          var valid6 = true;
                                        }
                                        if (valid6) {
                                          if (data9.approvalRequested !== void 0) {
                                            const _errs35 = errors2;
                                            if (typeof data9.approvalRequested !== "boolean") {
                                              validate34.errors = [{ instancePath: instancePath + "/preferences/notifications/approvalRequested", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/approvalRequested/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                              return false;
                                            }
                                            var valid6 = _errs35 === errors2;
                                          } else {
                                            var valid6 = true;
                                          }
                                          if (valid6) {
                                            if (data9.memoryReviewed !== void 0) {
                                              const _errs37 = errors2;
                                              if (typeof data9.memoryReviewed !== "boolean") {
                                                validate34.errors = [{ instancePath: instancePath + "/preferences/notifications/memoryReviewed", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/memoryReviewed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                return false;
                                              }
                                              var valid6 = _errs37 === errors2;
                                            } else {
                                              var valid6 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate34.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs30 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data1.defaultClientId !== void 0) {
                                  let data13 = data1.defaultClientId;
                                  const _errs39 = errors2;
                                  const _errs40 = errors2;
                                  let valid7 = false;
                                  const _errs41 = errors2;
                                  if (errors2 === _errs41) {
                                    if (typeof data13 === "string") {
                                      if (!pattern5.test(data13)) {
                                        const err12 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                        if (vErrors === null) {
                                          vErrors = [err12];
                                        } else {
                                          vErrors.push(err12);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err13 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err13];
                                      } else {
                                        vErrors.push(err13);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var _valid2 = _errs41 === errors2;
                                  valid7 = valid7 || _valid2;
                                  const _errs43 = errors2;
                                  if (data13 !== null) {
                                    const err14 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err14];
                                    } else {
                                      vErrors.push(err14);
                                    }
                                    errors2++;
                                  }
                                  var _valid2 = _errs43 === errors2;
                                  valid7 = valid7 || _valid2;
                                  if (!valid7) {
                                    const err15 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                    if (vErrors === null) {
                                      vErrors = [err15];
                                    } else {
                                      vErrors.push(err15);
                                    }
                                    errors2++;
                                    validate34.errors = vErrors;
                                    return false;
                                  } else {
                                    errors2 = _errs40;
                                    if (vErrors !== null) {
                                      if (_errs40) {
                                        vErrors.length = _errs40;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid2 = _errs39 === errors2;
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
                  validate34.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors2 === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateUserPreferencesResponse = validate35;
var schema42 = { "type": "object", "properties": { "owner": { "$ref": "#/$defs/UserPreferencesOwner" }, "revision": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "preferences": { "$ref": "#/$defs/UserPreferences" }, "modelCatalog": { "type": "object", "properties": { "defaultSelection": { "type": "object", "properties": { "provider": { "enum": ["bedrock", "claude-api"] }, "modelId": { "type": "string", "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, "effort": { "anyOf": [{ "type": "null" }, { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }] } }, "required": ["provider", "modelId", "effort"], "additionalProperties": false }, "models": { "type": "array", "minItems": 1, "maxItems": 128, "items": { "type": "object", "properties": { "provider": { "enum": ["bedrock", "claude-api"] }, "modelId": { "type": "string", "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, "label": { "type": "string", "minLength": 1, "maxLength": 200 }, "efforts": { "type": "array", "items": { "anyOf": [{ "type": "null" }, { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }] }, "minItems": 1, "maxItems": 6, "uniqueItems": true }, "available": { "type": "boolean" }, "unavailableReason": { "enum": [null, "provider_unconfigured", "model_unqualified"] } }, "required": ["provider", "modelId", "label", "efforts", "available", "unavailableReason"], "additionalProperties": false } } }, "required": ["defaultSelection", "models"], "additionalProperties": false } }, "required": ["owner", "revision", "preferences", "modelCatalog"], "additionalProperties": false };
var func0 = require_equal().default;
function validate35(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate35.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.owner === void 0 && (missing0 = "owner") || data.revision === void 0 && (missing0 = "revision") || data.preferences === void 0 && (missing0 = "preferences") || data.modelCatalog === void 0 && (missing0 = "modelCatalog")) {
        validate35.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "owner" || key0 === "revision" || key0 === "preferences" || key0 === "modelCatalog")) {
            validate35.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.owner !== void 0) {
            let data0 = data.owner;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId")) {
                  validate35.errors = [{ instancePath: instancePath + "/owner", schemaPath: "#/$defs/UserPreferencesOwner/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs5 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "tenantId" || key1 === "actorId")) {
                      validate35.errors = [{ instancePath: instancePath + "/owner", schemaPath: "#/$defs/UserPreferencesOwner/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                          if (func1(data1) > 128) {
                            validate35.errors = [{ instancePath: instancePath + "/owner/tenantId", schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                            return false;
                          } else {
                            if (func1(data1) < 1) {
                              validate35.errors = [{ instancePath: instancePath + "/owner/tenantId", schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          }
                        } else {
                          validate35.errors = [{ instancePath: instancePath + "/owner/tenantId", schemaPath: "#/$defs/UserPreferencesOwner/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                            if (func1(data2) > 128) {
                              validate35.errors = [{ instancePath: instancePath + "/owner/actorId", schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func1(data2) < 1) {
                                validate35.errors = [{ instancePath: instancePath + "/owner/actorId", schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate35.errors = [{ instancePath: instancePath + "/owner/actorId", schemaPath: "#/$defs/UserPreferencesOwner/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                    }
                  }
                }
              } else {
                validate35.errors = [{ instancePath: instancePath + "/owner", schemaPath: "#/$defs/UserPreferencesOwner/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.revision !== void 0) {
              let data3 = data.revision;
              const _errs10 = errors2;
              if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                validate35.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                return false;
              }
              if (errors2 === _errs10) {
                if (typeof data3 == "number" && isFinite(data3)) {
                  if (data3 > 9007199254740991 || isNaN(data3)) {
                    validate35.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data3 < 0 || isNaN(data3)) {
                      validate35.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs10 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.preferences !== void 0) {
                let data4 = data.preferences;
                const _errs12 = errors2;
                const _errs13 = errors2;
                if (errors2 === _errs13) {
                  if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                    let missing2;
                    if (data4.defaultModel === void 0 && (missing2 = "defaultModel") || data4.theme === void 0 && (missing2 = "theme") || data4.density === void 0 && (missing2 = "density") || data4.timezone === void 0 && (missing2 = "timezone") || data4.notifications === void 0 && (missing2 = "notifications") || data4.defaultClientId === void 0 && (missing2 = "defaultClientId")) {
                      validate35.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                      return false;
                    } else {
                      const _errs15 = errors2;
                      for (const key2 in data4) {
                        if (!(key2 === "defaultModel" || key2 === "theme" || key2 === "density" || key2 === "timezone" || key2 === "notifications" || key2 === "defaultClientId")) {
                          validate35.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs15 === errors2) {
                        if (data4.defaultModel !== void 0) {
                          let data5 = data4.defaultModel;
                          const _errs16 = errors2;
                          const _errs17 = errors2;
                          let valid5 = false;
                          const _errs18 = errors2;
                          if (errors2 === _errs18) {
                            if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                              let missing3;
                              if (data5.provider === void 0 && (missing3 = "provider") || data5.modelId === void 0 && (missing3 = "modelId") || data5.effort === void 0 && (missing3 = "effort")) {
                                const err0 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err0];
                                } else {
                                  vErrors.push(err0);
                                }
                                errors2++;
                              } else {
                                const _errs20 = errors2;
                                for (const key3 in data5) {
                                  if (!(key3 === "provider" || key3 === "modelId" || key3 === "effort")) {
                                    const err1 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err1];
                                    } else {
                                      vErrors.push(err1);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs20 === errors2) {
                                  if (data5.provider !== void 0) {
                                    let data6 = data5.provider;
                                    const _errs21 = errors2;
                                    if (!(data6 === "bedrock" || data6 === "claude-api")) {
                                      const err2 = { instancePath: instancePath + "/preferences/defaultModel/provider", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/provider/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.provider.enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err2];
                                      } else {
                                        vErrors.push(err2);
                                      }
                                      errors2++;
                                    }
                                    var valid6 = _errs21 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data5.modelId !== void 0) {
                                      let data7 = data5.modelId;
                                      const _errs22 = errors2;
                                      if (errors2 === _errs22) {
                                        if (typeof data7 === "string") {
                                          if (!pattern4.test(data7)) {
                                            const err3 = { instancePath: instancePath + "/preferences/defaultModel/modelId", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' };
                                            if (vErrors === null) {
                                              vErrors = [err3];
                                            } else {
                                              vErrors.push(err3);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err4 = { instancePath: instancePath + "/preferences/defaultModel/modelId", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid6 = _errs22 === errors2;
                                    } else {
                                      var valid6 = true;
                                    }
                                    if (valid6) {
                                      if (data5.effort !== void 0) {
                                        let data8 = data5.effort;
                                        const _errs24 = errors2;
                                        const _errs25 = errors2;
                                        let valid7 = false;
                                        const _errs26 = errors2;
                                        if (data8 !== null) {
                                          const err5 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err5];
                                          } else {
                                            vErrors.push(err5);
                                          }
                                          errors2++;
                                        }
                                        var _valid1 = _errs26 === errors2;
                                        valid7 = valid7 || _valid1;
                                        const _errs28 = errors2;
                                        if (typeof data8 !== "string") {
                                          const err6 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err6];
                                          } else {
                                            vErrors.push(err6);
                                          }
                                          errors2++;
                                        }
                                        if (!(data8 === "low" || data8 === "medium" || data8 === "high" || data8 === "xhigh" || data8 === "max")) {
                                          const err7 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema33.properties.defaultModel.anyOf[0].properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err7];
                                          } else {
                                            vErrors.push(err7);
                                          }
                                          errors2++;
                                        }
                                        var _valid1 = _errs28 === errors2;
                                        valid7 = valid7 || _valid1;
                                        if (!valid7) {
                                          const err8 = { instancePath: instancePath + "/preferences/defaultModel/effort", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err8];
                                          } else {
                                            vErrors.push(err8);
                                          }
                                          errors2++;
                                        } else {
                                          errors2 = _errs25;
                                          if (vErrors !== null) {
                                            if (_errs25) {
                                              vErrors.length = _errs25;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid6 = _errs24 === errors2;
                                      } else {
                                        var valid6 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err9 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors2++;
                            }
                          }
                          var _valid0 = _errs18 === errors2;
                          valid5 = valid5 || _valid0;
                          const _errs30 = errors2;
                          if (data5 !== null) {
                            const err10 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                            if (vErrors === null) {
                              vErrors = [err10];
                            } else {
                              vErrors.push(err10);
                            }
                            errors2++;
                          }
                          var _valid0 = _errs30 === errors2;
                          valid5 = valid5 || _valid0;
                          if (!valid5) {
                            const err11 = { instancePath: instancePath + "/preferences/defaultModel", schemaPath: "#/$defs/UserPreferences/properties/defaultModel/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err11];
                            } else {
                              vErrors.push(err11);
                            }
                            errors2++;
                            validate35.errors = vErrors;
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
                          var valid4 = _errs16 === errors2;
                        } else {
                          var valid4 = true;
                        }
                        if (valid4) {
                          if (data4.theme !== void 0) {
                            let data9 = data4.theme;
                            const _errs32 = errors2;
                            if (typeof data9 !== "string") {
                              validate35.errors = [{ instancePath: instancePath + "/preferences/theme", schemaPath: "#/$defs/UserPreferences/properties/theme/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                            if (!(data9 === "system" || data9 === "light" || data9 === "dark")) {
                              validate35.errors = [{ instancePath: instancePath + "/preferences/theme", schemaPath: "#/$defs/UserPreferences/properties/theme/enum", keyword: "enum", params: { allowedValues: schema33.properties.theme.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid4 = _errs32 === errors2;
                          } else {
                            var valid4 = true;
                          }
                          if (valid4) {
                            if (data4.density !== void 0) {
                              let data10 = data4.density;
                              const _errs34 = errors2;
                              if (typeof data10 !== "string") {
                                validate35.errors = [{ instancePath: instancePath + "/preferences/density", schemaPath: "#/$defs/UserPreferences/properties/density/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              if (!(data10 === "comfortable" || data10 === "compact")) {
                                validate35.errors = [{ instancePath: instancePath + "/preferences/density", schemaPath: "#/$defs/UserPreferences/properties/density/enum", keyword: "enum", params: { allowedValues: schema33.properties.density.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                              }
                              var valid4 = _errs34 === errors2;
                            } else {
                              var valid4 = true;
                            }
                            if (valid4) {
                              if (data4.timezone !== void 0) {
                                let data11 = data4.timezone;
                                const _errs36 = errors2;
                                if (typeof data11 !== "string" && data11 !== null) {
                                  validate35.errors = [{ instancePath: instancePath + "/preferences/timezone", schemaPath: "#/$defs/UserPreferences/properties/timezone/type", keyword: "type", params: { type: schema33.properties.timezone.type }, message: "must be string,null" }];
                                  return false;
                                }
                                if (errors2 === _errs36) {
                                  if (typeof data11 === "string") {
                                    if (func1(data11) > 64) {
                                      validate35.errors = [{ instancePath: instancePath + "/preferences/timezone", schemaPath: "#/$defs/UserPreferences/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid4 = _errs36 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data4.notifications !== void 0) {
                                  let data12 = data4.notifications;
                                  const _errs38 = errors2;
                                  if (errors2 === _errs38) {
                                    if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
                                      let missing4;
                                      if (data12.runCompleted === void 0 && (missing4 = "runCompleted") || data12.approvalRequested === void 0 && (missing4 = "approvalRequested") || data12.memoryReviewed === void 0 && (missing4 = "memoryReviewed")) {
                                        validate35.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                        return false;
                                      } else {
                                        const _errs40 = errors2;
                                        for (const key4 in data12) {
                                          if (!(key4 === "runCompleted" || key4 === "approvalRequested" || key4 === "memoryReviewed")) {
                                            validate35.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs40 === errors2) {
                                          if (data12.runCompleted !== void 0) {
                                            const _errs41 = errors2;
                                            if (typeof data12.runCompleted !== "boolean") {
                                              validate35.errors = [{ instancePath: instancePath + "/preferences/notifications/runCompleted", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/runCompleted/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                              return false;
                                            }
                                            var valid8 = _errs41 === errors2;
                                          } else {
                                            var valid8 = true;
                                          }
                                          if (valid8) {
                                            if (data12.approvalRequested !== void 0) {
                                              const _errs43 = errors2;
                                              if (typeof data12.approvalRequested !== "boolean") {
                                                validate35.errors = [{ instancePath: instancePath + "/preferences/notifications/approvalRequested", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/approvalRequested/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                return false;
                                              }
                                              var valid8 = _errs43 === errors2;
                                            } else {
                                              var valid8 = true;
                                            }
                                            if (valid8) {
                                              if (data12.memoryReviewed !== void 0) {
                                                const _errs45 = errors2;
                                                if (typeof data12.memoryReviewed !== "boolean") {
                                                  validate35.errors = [{ instancePath: instancePath + "/preferences/notifications/memoryReviewed", schemaPath: "#/$defs/UserPreferences/properties/notifications/properties/memoryReviewed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                  return false;
                                                }
                                                var valid8 = _errs45 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate35.errors = [{ instancePath: instancePath + "/preferences/notifications", schemaPath: "#/$defs/UserPreferences/properties/notifications/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
                                  }
                                  var valid4 = _errs38 === errors2;
                                } else {
                                  var valid4 = true;
                                }
                                if (valid4) {
                                  if (data4.defaultClientId !== void 0) {
                                    let data16 = data4.defaultClientId;
                                    const _errs47 = errors2;
                                    const _errs48 = errors2;
                                    let valid9 = false;
                                    const _errs49 = errors2;
                                    if (errors2 === _errs49) {
                                      if (typeof data16 === "string") {
                                        if (!pattern5.test(data16)) {
                                          const err12 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                          if (vErrors === null) {
                                            vErrors = [err12];
                                          } else {
                                            vErrors.push(err12);
                                          }
                                          errors2++;
                                        }
                                      } else {
                                        const err13 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err13];
                                        } else {
                                          vErrors.push(err13);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var _valid2 = _errs49 === errors2;
                                    valid9 = valid9 || _valid2;
                                    const _errs51 = errors2;
                                    if (data16 !== null) {
                                      const err14 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err14];
                                      } else {
                                        vErrors.push(err14);
                                      }
                                      errors2++;
                                    }
                                    var _valid2 = _errs51 === errors2;
                                    valid9 = valid9 || _valid2;
                                    if (!valid9) {
                                      const err15 = { instancePath: instancePath + "/preferences/defaultClientId", schemaPath: "#/$defs/UserPreferences/properties/defaultClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err15];
                                      } else {
                                        vErrors.push(err15);
                                      }
                                      errors2++;
                                      validate35.errors = vErrors;
                                      return false;
                                    } else {
                                      errors2 = _errs48;
                                      if (vErrors !== null) {
                                        if (_errs48) {
                                          vErrors.length = _errs48;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid4 = _errs47 === errors2;
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
                  } else {
                    validate35.errors = [{ instancePath: instancePath + "/preferences", schemaPath: "#/$defs/UserPreferences/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs12 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.modelCatalog !== void 0) {
                  let data17 = data.modelCatalog;
                  const _errs53 = errors2;
                  if (errors2 === _errs53) {
                    if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                      let missing5;
                      if (data17.defaultSelection === void 0 && (missing5 = "defaultSelection") || data17.models === void 0 && (missing5 = "models")) {
                        validate35.errors = [{ instancePath: instancePath + "/modelCatalog", schemaPath: "#/properties/modelCatalog/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                        return false;
                      } else {
                        const _errs55 = errors2;
                        for (const key5 in data17) {
                          if (!(key5 === "defaultSelection" || key5 === "models")) {
                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog", schemaPath: "#/properties/modelCatalog/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                            return false;
                            break;
                          }
                        }
                        if (_errs55 === errors2) {
                          if (data17.defaultSelection !== void 0) {
                            let data18 = data17.defaultSelection;
                            const _errs56 = errors2;
                            if (errors2 === _errs56) {
                              if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                let missing6;
                                if (data18.provider === void 0 && (missing6 = "provider") || data18.modelId === void 0 && (missing6 = "modelId") || data18.effort === void 0 && (missing6 = "effort")) {
                                  validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                  return false;
                                } else {
                                  const _errs58 = errors2;
                                  for (const key6 in data18) {
                                    if (!(key6 === "provider" || key6 === "modelId" || key6 === "effort")) {
                                      validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs58 === errors2) {
                                    if (data18.provider !== void 0) {
                                      let data19 = data18.provider;
                                      const _errs59 = errors2;
                                      if (!(data19 === "bedrock" || data19 === "claude-api")) {
                                        validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection/provider", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/provider/enum", keyword: "enum", params: { allowedValues: schema42.properties.modelCatalog.properties.defaultSelection.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid11 = _errs59 === errors2;
                                    } else {
                                      var valid11 = true;
                                    }
                                    if (valid11) {
                                      if (data18.modelId !== void 0) {
                                        let data20 = data18.modelId;
                                        const _errs60 = errors2;
                                        if (errors2 === _errs60) {
                                          if (typeof data20 === "string") {
                                            if (!pattern4.test(data20)) {
                                              validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection/modelId", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection/modelId", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid11 = _errs60 === errors2;
                                      } else {
                                        var valid11 = true;
                                      }
                                      if (valid11) {
                                        if (data18.effort !== void 0) {
                                          let data21 = data18.effort;
                                          const _errs62 = errors2;
                                          const _errs63 = errors2;
                                          let valid12 = false;
                                          const _errs64 = errors2;
                                          if (data21 !== null) {
                                            const err16 = { instancePath: instancePath + "/modelCatalog/defaultSelection/effort", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                            if (vErrors === null) {
                                              vErrors = [err16];
                                            } else {
                                              vErrors.push(err16);
                                            }
                                            errors2++;
                                          }
                                          var _valid3 = _errs64 === errors2;
                                          valid12 = valid12 || _valid3;
                                          const _errs66 = errors2;
                                          if (typeof data21 !== "string") {
                                            const err17 = { instancePath: instancePath + "/modelCatalog/defaultSelection/effort", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err17];
                                            } else {
                                              vErrors.push(err17);
                                            }
                                            errors2++;
                                          }
                                          if (!(data21 === "low" || data21 === "medium" || data21 === "high" || data21 === "xhigh" || data21 === "max")) {
                                            const err18 = { instancePath: instancePath + "/modelCatalog/defaultSelection/effort", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema42.properties.modelCatalog.properties.defaultSelection.properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                            if (vErrors === null) {
                                              vErrors = [err18];
                                            } else {
                                              vErrors.push(err18);
                                            }
                                            errors2++;
                                          }
                                          var _valid3 = _errs66 === errors2;
                                          valid12 = valid12 || _valid3;
                                          if (!valid12) {
                                            const err19 = { instancePath: instancePath + "/modelCatalog/defaultSelection/effort", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                            if (vErrors === null) {
                                              vErrors = [err19];
                                            } else {
                                              vErrors.push(err19);
                                            }
                                            errors2++;
                                            validate35.errors = vErrors;
                                            return false;
                                          } else {
                                            errors2 = _errs63;
                                            if (vErrors !== null) {
                                              if (_errs63) {
                                                vErrors.length = _errs63;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid11 = _errs62 === errors2;
                                        } else {
                                          var valid11 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate35.errors = [{ instancePath: instancePath + "/modelCatalog/defaultSelection", schemaPath: "#/properties/modelCatalog/properties/defaultSelection/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid10 = _errs56 === errors2;
                          } else {
                            var valid10 = true;
                          }
                          if (valid10) {
                            if (data17.models !== void 0) {
                              let data22 = data17.models;
                              const _errs68 = errors2;
                              if (errors2 === _errs68) {
                                if (Array.isArray(data22)) {
                                  if (data22.length > 128) {
                                    validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models", schemaPath: "#/properties/modelCatalog/properties/models/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                                    return false;
                                  } else {
                                    if (data22.length < 1) {
                                      validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models", schemaPath: "#/properties/modelCatalog/properties/models/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                      return false;
                                    } else {
                                      var valid13 = true;
                                      const len0 = data22.length;
                                      for (let i0 = 0; i0 < len0; i0++) {
                                        let data23 = data22[i0];
                                        const _errs70 = errors2;
                                        if (errors2 === _errs70) {
                                          if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
                                            let missing7;
                                            if (data23.provider === void 0 && (missing7 = "provider") || data23.modelId === void 0 && (missing7 = "modelId") || data23.label === void 0 && (missing7 = "label") || data23.efforts === void 0 && (missing7 = "efforts") || data23.available === void 0 && (missing7 = "available") || data23.unavailableReason === void 0 && (missing7 = "unavailableReason")) {
                                              validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0, schemaPath: "#/properties/modelCatalog/properties/models/items/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                                              return false;
                                            } else {
                                              const _errs72 = errors2;
                                              for (const key7 in data23) {
                                                if (!(key7 === "provider" || key7 === "modelId" || key7 === "label" || key7 === "efforts" || key7 === "available" || key7 === "unavailableReason")) {
                                                  validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0, schemaPath: "#/properties/modelCatalog/properties/models/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs72 === errors2) {
                                                if (data23.provider !== void 0) {
                                                  let data24 = data23.provider;
                                                  const _errs73 = errors2;
                                                  if (!(data24 === "bedrock" || data24 === "claude-api")) {
                                                    validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/provider", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/provider/enum", keyword: "enum", params: { allowedValues: schema42.properties.modelCatalog.properties.models.items.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                                    return false;
                                                  }
                                                  var valid14 = _errs73 === errors2;
                                                } else {
                                                  var valid14 = true;
                                                }
                                                if (valid14) {
                                                  if (data23.modelId !== void 0) {
                                                    let data25 = data23.modelId;
                                                    const _errs74 = errors2;
                                                    if (errors2 === _errs74) {
                                                      if (typeof data25 === "string") {
                                                        if (!pattern4.test(data25)) {
                                                          validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/modelId", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' }];
                                                          return false;
                                                        }
                                                      } else {
                                                        validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/modelId", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid14 = _errs74 === errors2;
                                                  } else {
                                                    var valid14 = true;
                                                  }
                                                  if (valid14) {
                                                    if (data23.label !== void 0) {
                                                      let data26 = data23.label;
                                                      const _errs76 = errors2;
                                                      if (errors2 === _errs76) {
                                                        if (typeof data26 === "string") {
                                                          if (func1(data26) > 200) {
                                                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/label", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/label/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                            return false;
                                                          } else {
                                                            if (func1(data26) < 1) {
                                                              validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/label", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/label/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                              return false;
                                                            }
                                                          }
                                                        } else {
                                                          validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/label", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid14 = _errs76 === errors2;
                                                    } else {
                                                      var valid14 = true;
                                                    }
                                                    if (valid14) {
                                                      if (data23.efforts !== void 0) {
                                                        let data27 = data23.efforts;
                                                        const _errs78 = errors2;
                                                        if (errors2 === _errs78) {
                                                          if (Array.isArray(data27)) {
                                                            if (data27.length > 6) {
                                                              validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/maxItems", keyword: "maxItems", params: { limit: 6 }, message: "must NOT have more than 6 items" }];
                                                              return false;
                                                            } else {
                                                              if (data27.length < 1) {
                                                                validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                                return false;
                                                              } else {
                                                                var valid15 = true;
                                                                const len1 = data27.length;
                                                                for (let i1 = 0; i1 < len1; i1++) {
                                                                  let data28 = data27[i1];
                                                                  const _errs80 = errors2;
                                                                  const _errs81 = errors2;
                                                                  let valid16 = false;
                                                                  const _errs82 = errors2;
                                                                  if (data28 !== null) {
                                                                    const err20 = { instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts/" + i1, schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/items/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err20];
                                                                    } else {
                                                                      vErrors.push(err20);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                  var _valid4 = _errs82 === errors2;
                                                                  valid16 = valid16 || _valid4;
                                                                  const _errs84 = errors2;
                                                                  if (typeof data28 !== "string") {
                                                                    const err21 = { instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts/" + i1, schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/items/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err21];
                                                                    } else {
                                                                      vErrors.push(err21);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                  if (!(data28 === "low" || data28 === "medium" || data28 === "high" || data28 === "xhigh" || data28 === "max")) {
                                                                    const err22 = { instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts/" + i1, schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/items/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema42.properties.modelCatalog.properties.models.items.properties.efforts.items.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err22];
                                                                    } else {
                                                                      vErrors.push(err22);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                  var _valid4 = _errs84 === errors2;
                                                                  valid16 = valid16 || _valid4;
                                                                  if (!valid16) {
                                                                    const err23 = { instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts/" + i1, schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/items/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err23];
                                                                    } else {
                                                                      vErrors.push(err23);
                                                                    }
                                                                    errors2++;
                                                                    validate35.errors = vErrors;
                                                                    return false;
                                                                  } else {
                                                                    errors2 = _errs81;
                                                                    if (vErrors !== null) {
                                                                      if (_errs81) {
                                                                        vErrors.length = _errs81;
                                                                      } else {
                                                                        vErrors = null;
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid15 = _errs80 === errors2;
                                                                  if (!valid15) {
                                                                    break;
                                                                  }
                                                                }
                                                                if (valid15) {
                                                                  let i2 = data27.length;
                                                                  let j0;
                                                                  if (i2 > 1) {
                                                                    outer0: for (; i2--; ) {
                                                                      for (j0 = i2; j0--; ) {
                                                                        if (func0(data27[i2], data27[j0])) {
                                                                          validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/uniqueItems", keyword: "uniqueItems", params: { i: i2, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)" }];
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
                                                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/efforts", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/efforts/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid14 = _errs78 === errors2;
                                                      } else {
                                                        var valid14 = true;
                                                      }
                                                      if (valid14) {
                                                        if (data23.available !== void 0) {
                                                          const _errs86 = errors2;
                                                          if (typeof data23.available !== "boolean") {
                                                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/available", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/available/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                            return false;
                                                          }
                                                          var valid14 = _errs86 === errors2;
                                                        } else {
                                                          var valid14 = true;
                                                        }
                                                        if (valid14) {
                                                          if (data23.unavailableReason !== void 0) {
                                                            let data30 = data23.unavailableReason;
                                                            const _errs88 = errors2;
                                                            if (!(data30 === null || data30 === "provider_unconfigured" || data30 === "model_unqualified")) {
                                                              validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0 + "/unavailableReason", schemaPath: "#/properties/modelCatalog/properties/models/items/properties/unavailableReason/enum", keyword: "enum", params: { allowedValues: schema42.properties.modelCatalog.properties.models.items.properties.unavailableReason.enum }, message: "must be equal to one of the allowed values" }];
                                                              return false;
                                                            }
                                                            var valid14 = _errs88 === errors2;
                                                          } else {
                                                            var valid14 = true;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models/" + i0, schemaPath: "#/properties/modelCatalog/properties/models/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid13 = _errs70 === errors2;
                                        if (!valid13) {
                                          break;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate35.errors = [{ instancePath: instancePath + "/modelCatalog/models", schemaPath: "#/properties/modelCatalog/properties/models/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                  return false;
                                }
                              }
                              var valid10 = _errs68 === errors2;
                            } else {
                              var valid10 = true;
                            }
                          }
                        }
                      }
                    } else {
                      validate35.errors = [{ instancePath: instancePath + "/modelCatalog", schemaPath: "#/properties/modelCatalog/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid0 = _errs53 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate35.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate35.errors = vErrors;
  return errors2 === 0;
}
validate35.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateUserPreferencesErrorResponse = validate36;
var schema46 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "type": "string", "enum": ["INVALID_REQUEST", "UNAUTHENTICATED", "ACCESS_DENIED", "MEMBERSHIP_REVOKED", "NOT_FOUND", "METHOD_NOT_ALLOWED", "DEADLINE", "MEMBERSHIP_CHANGED", "REQUEST_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "CANCELLED", "PRODUCT_UNAVAILABLE", "SETTINGS_REQUEST_INVALID", "SETTINGS_DOCUMENT_INVALID", "SETTINGS_FIELD_INVALID", "SETTINGS_CLIENT_REFUSED", "SETTINGS_REVISION_CONFLICT", "SETTINGS_STORE_UNAVAILABLE", "SETTINGS_STORE_STATE", "SETTINGS_COMMIT_UNKNOWN", "SETTINGS_UNAVAILABLE", "USER_PREFERENCES_UNAVAILABLE"] }, "outcome": { "type": "string", "enum": ["UNKNOWN", "RESULT_NOT_RELEASED"] }, "field": { "type": "string", "pattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" } }, "required": ["code"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
var pattern12 = new RegExp("^[A-Za-z][A-Za-z0-9_.-]{0,127}$", "u");
function validate36(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate36.evaluated;
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
        validate36.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate36.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (data0.code === void 0 && (missing1 = "code")) {
                  validate36.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome" || key1 === "field")) {
                      validate36.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (typeof data1 !== "string") {
                        validate36.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data1 === "INVALID_REQUEST" || data1 === "UNAUTHENTICATED" || data1 === "ACCESS_DENIED" || data1 === "MEMBERSHIP_REVOKED" || data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "DEADLINE" || data1 === "MEMBERSHIP_CHANGED" || data1 === "REQUEST_TOO_LARGE" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "CANCELLED" || data1 === "PRODUCT_UNAVAILABLE" || data1 === "SETTINGS_REQUEST_INVALID" || data1 === "SETTINGS_DOCUMENT_INVALID" || data1 === "SETTINGS_FIELD_INVALID" || data1 === "SETTINGS_CLIENT_REFUSED" || data1 === "SETTINGS_REVISION_CONFLICT" || data1 === "SETTINGS_STORE_UNAVAILABLE" || data1 === "SETTINGS_STORE_STATE" || data1 === "SETTINGS_COMMIT_UNKNOWN" || data1 === "SETTINGS_UNAVAILABLE" || data1 === "USER_PREFERENCES_UNAVAILABLE")) {
                        validate36.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema46.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid1 = _errs5 === errors2;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        let data2 = data0.outcome;
                        const _errs7 = errors2;
                        if (typeof data2 !== "string") {
                          validate36.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED")) {
                          validate36.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema46.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs7 === errors2;
                      } else {
                        var valid1 = true;
                      }
                      if (valid1) {
                        if (data0.field !== void 0) {
                          let data3 = data0.field;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (!pattern12.test(data3)) {
                                validate36.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"' }];
                                return false;
                              }
                            } else {
                              validate36.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                        } else {
                          var valid1 = true;
                        }
                      }
                    }
                  }
                }
              } else {
                validate36.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate36.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate36.errors = vErrors;
  return errors2 === 0;
}
validate36.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validators = { UserPreferences: validateUserPreferences, UserPreferencesOwner: validateUserPreferencesOwner, UserPreferencesReadRequest: validateUserPreferencesReadRequest, UserPreferencesSaveRequest: validateUserPreferencesSaveRequest, UserPreferencesResponse: validateUserPreferencesResponse, UserPreferencesErrorResponse: validateUserPreferencesErrorResponse };

// model-selection.mjs
var MODEL_PROVIDERS = Object.freeze(["bedrock", "claude-api"]);
var MODEL_EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
var HISTORICAL_MODEL_SELECTION = Object.freeze({ provider: "bedrock", modelId: "us.anthropic.claude-sonnet-4-6", effort: null });
var id = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" };
var effort = { anyOf: [{ type: "null" }, { type: "string", enum: MODEL_EFFORTS }] };
var MODEL_SELECTION_SCHEMA = Object.freeze({ type: "object", properties: { provider: { enum: MODEL_PROVIDERS }, modelId: id, effort }, required: ["provider", "modelId", "effort"], additionalProperties: false });
var MODEL_CATALOG_SCHEMA = Object.freeze({ type: "object", properties: { defaultSelection: MODEL_SELECTION_SCHEMA, models: { type: "array", minItems: 1, maxItems: 128, items: { type: "object", properties: { provider: { enum: MODEL_PROVIDERS }, modelId: id, label: { type: "string", minLength: 1, maxLength: 200 }, efforts: { type: "array", items: effort, minItems: 1, maxItems: 6, uniqueItems: true }, available: { type: "boolean" }, unavailableReason: { enum: [null, "provider_unconfigured", "model_unqualified"] } }, required: ["provider", "modelId", "label", "efforts", "available", "unavailableReason"], additionalProperties: false } } }, required: ["defaultSelection", "models"], additionalProperties: false });
var fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
function fields(value, names) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("MODEL_SELECTION_INVALID");
  const d = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(d);
  if (keys.length !== names.length || keys.some((k) => typeof k !== "string" || !names.includes(k) || !d[k].enumerable || !Object.hasOwn(d[k], "value"))) fail("MODEL_SELECTION_INVALID");
  return Object.fromEntries(names.map((k) => [k, d[k].value]));
}
var modelId = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/u.test(value);
function assertModelSelection(value) {
  const s = fields(value, ["provider", "modelId", "effort"]);
  if (!MODEL_PROVIDERS.includes(s.provider) || !modelId(s.modelId) || s.effort !== null && !MODEL_EFFORTS.includes(s.effort)) fail("MODEL_SELECTION_INVALID");
  return Object.freeze(s);
}
function assertModelCatalog(value) {
  const c = fields(value, ["defaultSelection", "models"]), defaultSelection = assertModelSelection(c.defaultSelection);
  if (!Array.isArray(c.models) || c.models.length < 1 || c.models.length > 128) fail("MODEL_CATALOG_INVALID");
  const seen = /* @__PURE__ */ new Set(), models = c.models.map((raw) => {
    const m = fields(raw, ["provider", "modelId", "label", "efforts", "available", "unavailableReason"]), key = m.provider + "\0" + m.modelId;
    if (!MODEL_PROVIDERS.includes(m.provider) || !modelId(m.modelId) || seen.has(key) || typeof m.label !== "string" || !m.label.trim() || m.label.length > 200 || !Array.isArray(m.efforts) || m.efforts.length < 1 || m.efforts.length > 6 || new Set(m.efforts).size !== m.efforts.length || m.efforts.some((e) => e !== null && !MODEL_EFFORTS.includes(e)) || typeof m.available !== "boolean" || (m.available ? m.unavailableReason !== null : !["provider_unconfigured", "model_unqualified"].includes(m.unavailableReason))) fail("MODEL_CATALOG_INVALID");
    seen.add(key);
    return Object.freeze({ ...m, efforts: Object.freeze([...m.efforts]) });
  });
  const row = models.find((m) => m.provider === defaultSelection.provider && m.modelId === defaultSelection.modelId);
  if (!row?.available || !row.efforts.includes(defaultSelection.effort)) fail("MODEL_CATALOG_INVALID");
  return Object.freeze({ defaultSelection, models: Object.freeze(models) });
}

// user-preferences-application/document.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var USER_PREFERENCE_THEMES = Object.freeze(["system", "light", "dark"]);
var USER_PREFERENCE_DENSITIES = Object.freeze(["comfortable", "compact"]);
var USER_PREFERENCE_NOTIFICATIONS = Object.freeze(["runCompleted", "approvalRequested", "memoryReviewed"]);
var USER_PREFERENCE_UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
var uuid = new RegExp(USER_PREFERENCE_UUID_PATTERN, "u");
var failures = /* @__PURE__ */ new WeakMap();
var UserPreferencesDocumentError = class extends Error {
  constructor(code, field2 = null) {
    super(code);
    this.name = "UserPreferencesDocumentError";
    failures.set(this, Object.freeze({ code, field: field2 }));
  }
};
var userPreferencesDocumentFailure = (error) => failures.get(error) ?? null;
var fail2 = (code, field2) => {
  throw new UserPreferencesDocumentError(code, field2);
};
var field = (name) => fail2("SETTINGS_FIELD_INVALID", name);
function closed(value, keys, code, name) {
  try {
    if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail2(code, name);
    const descriptors = Object.getOwnPropertyDescriptors(value), ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.length !== keys.length || keys.some((key) => !Object.hasOwn(descriptors, key)) || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key) || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail2(code, name);
    return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
  } catch (error) {
    if (userPreferencesDocumentFailure(error)) throw error;
    fail2(code, name);
  }
}
function userPreferencesTimezone(value, name = "timezone") {
  if (typeof value !== "string" || value.length > 64) field(name);
  let resolved;
  try {
    resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    field(name);
  }
  if (resolved !== value && !(value === "UTC" && resolved === "UTC")) field(name);
  return value;
}
var fields2 = {
  defaultModel: { schema: { anyOf: [MODEL_SELECTION_SCHEMA, { type: "null" }] }, default: null, parse: (value) => {
    if (value === null) return null;
    try {
      return assertModelSelection(value);
    } catch {
      field("defaultModel");
    }
  } },
  theme: { schema: { type: "string", enum: USER_PREFERENCE_THEMES }, default: "system", parse: (value) => {
    if (!USER_PREFERENCE_THEMES.includes(value)) field("theme");
    return value;
  } },
  density: { schema: { type: "string", enum: USER_PREFERENCE_DENSITIES }, default: "comfortable", parse: (value) => {
    if (!USER_PREFERENCE_DENSITIES.includes(value)) field("density");
    return value;
  } },
  timezone: { schema: { type: ["string", "null"], maxLength: 64 }, default: null, parse: (value) => value === null ? null : userPreferencesTimezone(value) },
  notifications: { schema: { type: "object", properties: Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map((name) => [name, { type: "boolean" }])), required: USER_PREFERENCE_NOTIFICATIONS, additionalProperties: false }, default: Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map((name) => [name, true])), parse: (value) => {
    const n = closed(value, USER_PREFERENCE_NOTIFICATIONS, "SETTINGS_FIELD_INVALID", "notifications");
    for (const key of USER_PREFERENCE_NOTIFICATIONS) if (typeof n[key] !== "boolean") field("notifications." + key);
    return Object.freeze(n);
  } },
  defaultClientId: { schema: { anyOf: [{ type: "string", pattern: USER_PREFERENCE_UUID_PATTERN }, { type: "null" }] }, default: null, parse: (value) => {
    if (value === null) return null;
    if (typeof value !== "string" || !uuid.test(value.toLowerCase())) field("defaultClientId");
    return value.toLowerCase();
  } }
};
var USER_PREFERENCE_FIELDS = Object.freeze(Object.keys(fields2));
var USER_PREFERENCE_DEFAULTS = freeze(Object.fromEntries(Object.entries(fields2).map(([name, definition]) => [name, definition.default])));
var USER_PREFERENCES_DOCUMENT_SCHEMA = freeze({ type: "object", properties: Object.fromEntries(Object.entries(fields2).map(([name, definition]) => [name, definition.schema])), required: USER_PREFERENCE_FIELDS, additionalProperties: false });
function userPreferencesDocument(value) {
  const input = closed(value, USER_PREFERENCE_FIELDS, "SETTINGS_DOCUMENT_INVALID");
  return Object.freeze(Object.fromEntries(Object.entries(fields2).map(([name, definition]) => [name, definition.parse(input[name])])));
}

// user-preferences-application/schema.mjs
var USER_PREFERENCES_SCHEMA_ID = "urn:meri:user-preferences-application:0.1.0";

// user-preferences-application/protocol.mjs
var userPreferencesVersion = "0.1.0";
var freeze2 = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze2);
    Object.freeze(value);
  }
  return value;
};
var createUserPreferencesMetadata = ({ paths, limits, errorStatuses, errorOutcomes }) => freeze2({
  contractVersion: userPreferencesVersion,
  schemaId: USER_PREFERENCES_SCHEMA_ID,
  routes: Object.fromEntries(Object.entries(paths).map(([route, path]) => [route, { method: "POST", path, response: "json" }])),
  authentication: { scheme: "Bearer", expectedOwner: "independently current Core tenantId and actorId; never response owner or Clerk identity" },
  limits: { requestBytes: limits.maxRequestBytes, responseBytes: limits.maxResponseBytes, requestMs: limits.maxRequestMs, jsonDepth: 64, jsonNodes: 1e5 },
  errorStatuses,
  errorOutcomes,
  semantics: { document: "complete canonical user preferences; unknown fields refuse", save: "captured expectedRevision plus one and exact captured document", uncertainty: "UNKNOWN and RESULT_NOT_RELEASED require read-only reconciliation; never blind retry", membership: "server owns current membership and default-client eligibility", integration: "isolated source contract; runtime mounting and persistence qualification remain handoff work" }
});

// user-preferences-generated:./generated-protocol.mjs
var userPreferencesPaths = Object.freeze({ "read": "/api/settings/user/read", "save": "/api/settings/user/save" });
var userPreferencesMetadata = createUserPreferencesMetadata({ "paths": { "read": "/api/settings/user/read", "save": "/api/settings/user/save" }, "limits": { "maxRequestMs": 1e4, "maxRequestBytes": 8192, "maxResponseBytes": 16384 }, "errorStatuses": { "INVALID_REQUEST": 400, "UNAUTHENTICATED": 401, "ACCESS_DENIED": 403, "MEMBERSHIP_REVOKED": 403, "NOT_FOUND": 404, "METHOD_NOT_ALLOWED": 405, "DEADLINE": 408, "MEMBERSHIP_CHANGED": 409, "REQUEST_TOO_LARGE": 413, "UNSUPPORTED_MEDIA_TYPE": 415, "CANCELLED": 499, "PRODUCT_UNAVAILABLE": 502, "SETTINGS_REQUEST_INVALID": 400, "SETTINGS_DOCUMENT_INVALID": 400, "SETTINGS_FIELD_INVALID": 400, "SETTINGS_CLIENT_REFUSED": 403, "SETTINGS_REVISION_CONFLICT": 409, "SETTINGS_STORE_UNAVAILABLE": 503, "SETTINGS_STORE_STATE": 500, "SETTINGS_COMMIT_UNKNOWN": 503, "SETTINGS_UNAVAILABLE": 503, "USER_PREFERENCES_UNAVAILABLE": 503 }, "errorOutcomes": ["UNKNOWN", "RESULT_NOT_RELEASED"], "fieldPattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" });

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
var fail3 = (code) => {
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
    if (tag.call(value) !== "Uint8Array") fail3("INVALID_BYTES");
    const n = length.call(value), b = buffer.call(value), o = offset.call(value);
    ordinaryBuffer.call(b);
    if (n > cap) fail3("BYTE_LIMIT");
    const copy = new Uint8Array(n);
    Uint8Array.prototype.set.call(copy, new Uint8Array(b, o, n));
    return copy;
  } catch (error) {
    if (isFailure(error)) throw error;
    fail3("INVALID_BYTES");
  }
}
function parseBytes(value, cap) {
  const bytes = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    data = JSON.parse(text);
  } catch {
    fail3("INVALID_JSON_UTF8");
  }
  const stack = [[data, 0]], objects = [];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > 1e5 || depth > 64) fail3("JSON_LIMIT");
    if (typeof v === "number" && !Number.isFinite(v)) fail3("INVALID_NUMBER");
    if (typeof v === "string" && !v.isWellFormed()) fail3("INVALID_UNICODE");
    if (v && typeof v === "object") {
      objects.push(v);
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k)) fail3("DANGEROUS_KEY");
        stack.push([x, depth + 1]);
      }
    }
  }
  for (const v of objects) Object.freeze(v);
  return data;
}

// user-preferences-application/boundary.mjs
var UserPreferencesResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "UserPreferencesResponseError";
    this.code = code;
  }
};
var fail4 = (code) => {
  throw new UserPreferencesResponseError(code);
};
function parseText(value, cap) {
  if (typeof value !== "string") fail4("USER_PREFERENCES_JSON");
  if (value.length > cap) fail4("USER_PREFERENCES_LIMIT");
  if (!value.isWellFormed()) fail4("USER_PREFERENCES_JSON");
  try {
    return parseBytes(new TextEncoder().encode(value), cap);
  } catch (error) {
    fail4(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "USER_PREFERENCES_LIMIT" : "USER_PREFERENCES_JSON");
  }
}
function expectedData(value, cap) {
  let nodes = 0;
  const visit = (v, depth) => {
    if (++nodes > 1e5 || depth > 64) fail4("USER_PREFERENCES_EXPECTATION");
    if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(v))) fail4("USER_PREFERENCES_EXPECTATION");
    const descriptors = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v), out = array ? [] : {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (array && key === "length") continue;
      const d = descriptors[key];
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !d.enumerable || !Object.hasOwn(d, "value")) fail4("USER_PREFERENCES_EXPECTATION");
      out[key] = visit(d.value, depth + 1);
    }
    return out;
  };
  try {
    return parseText(JSON.stringify(visit(value, 0)), cap);
  } catch (error) {
    if (error instanceof UserPreferencesResponseError) throw error;
    fail4("USER_PREFERENCES_EXPECTATION");
  }
}

// user-preferences-application/user-preferences-receiver.mjs
var routes = Object.freeze({ read: "UserPreferencesReadRequest", save: "UserPreferencesSaveRequest" });
var selected = (route) => {
  if (typeof route !== "string" || !Object.hasOwn(routes, route)) fail4("USER_PREFERENCES_ROUTE");
  return routes[route];
};
var check = (name, value) => {
  if (!validators[name](value)) fail4("USER_PREFERENCES_SHAPE");
};
var same = (a, b) => canonicalize(a) === canonicalize(b);
function document(value) {
  try {
    if (!same(value, userPreferencesDocument(value))) fail4("USER_PREFERENCES_DOCUMENT");
  } catch {
    fail4("USER_PREFERENCES_DOCUMENT");
  }
}
async function receiveUserPreferencesRequest(route, jsonText) {
  const name = selected(route), value = parseText(jsonText, userPreferencesMetadata.limits.requestBytes);
  check(name, value);
  if (route === "save") document(value.preferences);
  return value;
}
async function receiveUserPreferencesResponse(route, httpStatus, jsonText, expected) {
  const name = selected(route);
  if (!Number.isInteger(httpStatus)) fail4("USER_PREFERENCES_STATUS");
  const expectation = expectedData(expected, userPreferencesMetadata.limits.requestBytes), keys = Object.keys(expectation ?? {}), required = route === "save" ? ["owner", "request"] : ["owner"];
  if (keys.length !== required.length || required.some((key) => !keys.includes(key))) fail4("USER_PREFERENCES_EXPECTATION");
  check("UserPreferencesOwner", expectation.owner);
  if (route === "save") {
    check(name, expectation.request);
    document(expectation.request.preferences);
  }
  const value = parseText(jsonText, userPreferencesMetadata.limits.responseBytes);
  if (httpStatus !== 200) {
    check("UserPreferencesErrorResponse", value);
    if (userPreferencesMetadata.errorStatuses[value.error.code] !== httpStatus || httpStatus === 502 && Object.hasOwn(value.error, "field")) fail4("USER_PREFERENCES_STATUS");
    return value;
  }
  check("UserPreferencesResponse", value);
  document(value.preferences);
  try {
    assertModelCatalog(value.modelCatalog);
  } catch {
    fail4("USER_PREFERENCES_DOCUMENT");
  }
  if (!same(value.owner, expectation.owner) || route === "save" && (value.revision !== expectation.request.expectedRevision + 1 || !same(value.preferences, expectation.request.preferences))) fail4("USER_PREFERENCES_CORRELATION");
  return value;
}
export {
  USER_PREFERENCE_DEFAULTS,
  USER_PREFERENCE_DENSITIES,
  USER_PREFERENCE_NOTIFICATIONS,
  USER_PREFERENCE_THEMES,
  UserPreferencesResponseError,
  receiveUserPreferencesRequest,
  receiveUserPreferencesResponse,
  userPreferencesMetadata,
  userPreferencesPaths,
  userPreferencesVersion
};
