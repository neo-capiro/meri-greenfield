// Generated upload receiving boundary.
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

// uploads-generated:./generated-validator.mjs
var validateInitiate = validate28;
var schema33 = { "type": "object", "properties": { "requestId": { "type": "string", "format": "uuid" }, "filename": { "type": "string", "minLength": 1, "maxLength": 255 }, "mimeType": { "enum": ["text/plain", "text/markdown", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg"] }, "bytes": { "type": "integer", "minimum": 1, "maximum": 10485760 }, "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["requestId", "filename", "mimeType", "bytes", "sha256"], "additionalProperties": false };
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var func1 = require_ucs2length().default;
var pattern4 = new RegExp("^[a-f0-9]{64}$", "u");
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors3 = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors3 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.filename === void 0 && (missing0 = "filename") || data.mimeType === void 0 && (missing0 = "mimeType") || data.bytes === void 0 && (missing0 = "bytes") || data.sha256 === void 0 && (missing0 = "sha256")) {
        validate28.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors3;
        for (const key0 in data) {
          if (!(key0 === "requestId" || key0 === "filename" || key0 === "mimeType" || key0 === "bytes" || key0 === "sha256")) {
            validate28.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors3) {
          if (data.requestId !== void 0) {
            let data0 = data.requestId;
            const _errs2 = errors3;
            if (errors3 === _errs2) {
              if (errors3 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate28.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate28.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors3;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.filename !== void 0) {
              let data1 = data.filename;
              const _errs4 = errors3;
              if (errors3 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 255) {
                    validate28.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate28.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate28.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors3;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.mimeType !== void 0) {
                let data2 = data.mimeType;
                const _errs6 = errors3;
                if (!(data2 === "text/plain" || data2 === "text/markdown" || data2 === "application/pdf" || data2 === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || data2 === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || data2 === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || data2 === "image/png" || data2 === "image/jpeg")) {
                  validate28.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/enum", keyword: "enum", params: { allowedValues: schema33.properties.mimeType.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs6 === errors3;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.bytes !== void 0) {
                  let data3 = data.bytes;
                  const _errs7 = errors3;
                  if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                    validate28.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors3 === _errs7) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 10485760 || isNaN(data3)) {
                        validate28.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 10485760 }, message: "must be <= 10485760" }];
                        return false;
                      } else {
                        if (data3 < 1 || isNaN(data3)) {
                          validate28.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs7 === errors3;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.sha256 !== void 0) {
                    let data4 = data.sha256;
                    const _errs9 = errors3;
                    if (errors3 === _errs9) {
                      if (typeof data4 === "string") {
                        if (!pattern4.test(data4)) {
                          validate28.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                          return false;
                        }
                      } else {
                        validate28.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid0 = _errs9 === errors3;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate28.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate28.errors = vErrors;
  return errors3 === 0;
}
validate28.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateId = validate29;
function validate29(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors3 = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors3 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.uploadId === void 0 && (missing0 = "uploadId")) {
        validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors3;
        for (const key0 in data) {
          if (!(key0 === "uploadId")) {
            validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors3) {
          if (data.uploadId !== void 0) {
            let data0 = data.uploadId;
            const _errs2 = errors3;
            if (errors3 === _errs2) {
              if (errors3 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate29.errors = [{ instancePath: instancePath + "/uploadId", schemaPath: "#/properties/uploadId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate29.errors = [{ instancePath: instancePath + "/uploadId", schemaPath: "#/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
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
  return errors3 === 0;
}
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateStatus = validate30;
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors3 = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors3;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors3;
  if (errors3 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.uploadId === void 0 && (missing0 = "uploadId")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors3++;
      } else {
        const _errs3 = errors3;
        for (const key0 in data) {
          if (!(key0 === "uploadId")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors3++;
            break;
          }
        }
        if (_errs3 === errors3) {
          if (data.uploadId !== void 0) {
            let data0 = data.uploadId;
            const _errs4 = errors3;
            if (errors3 === _errs4) {
              if (errors3 === _errs4) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    const err2 = { instancePath: instancePath + "/uploadId", schemaPath: "#/oneOf/0/properties/uploadId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors3++;
                  }
                } else {
                  const err3 = { instancePath: instancePath + "/uploadId", schemaPath: "#/oneOf/0/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err3];
                  } else {
                    vErrors.push(err3);
                  }
                  errors3++;
                }
              }
            }
          }
        }
      }
    } else {
      const err4 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors3++;
    }
  }
  var _valid0 = _errs1 === errors3;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors3;
  if (errors3 === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.requestId === void 0 && (missing1 = "requestId")) {
        const err5 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors3++;
      } else {
        const _errs8 = errors3;
        for (const key1 in data) {
          if (!(key1 === "requestId")) {
            const err6 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors3++;
            break;
          }
        }
        if (_errs8 === errors3) {
          if (data.requestId !== void 0) {
            let data1 = data.requestId;
            const _errs9 = errors3;
            if (errors3 === _errs9) {
              if (errors3 === _errs9) {
                if (typeof data1 === "string") {
                  if (!formats0.test(data1)) {
                    const err7 = { instancePath: instancePath + "/requestId", schemaPath: "#/oneOf/1/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors3++;
                  }
                } else {
                  const err8 = { instancePath: instancePath + "/requestId", schemaPath: "#/oneOf/1/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors3++;
                }
              }
            }
          }
        }
      }
    } else {
      const err9 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors3++;
    }
  }
  var _valid0 = _errs6 === errors3;
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
    const err10 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors3++;
    validate30.errors = vErrors;
    return false;
  } else {
    errors3 = _errs0;
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
  return errors3 === 0;
}
validate30.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateReceipt = validate31;
var schema39 = { "type": "object", "properties": { "uploadId": { "type": "string", "format": "uuid" }, "requestId": { "type": "string", "format": "uuid" }, "original": { "$ref": "#/$defs/UploadOriginal" }, "storageStatus": { "enum": ["awaiting_upload", "unknown", "stored", "removing", "removed"] }, "scanStatus": { "enum": ["pending", "clean", "infected", "unavailable"] }, "scanReason": { "anyOf": [{ "type": "string", "pattern": "^[A-Z][A-Z0-9_]{0,79}$" }, { "type": "null" }] }, "extraction": { "type": "object", "properties": { "status": { "enum": ["pending", "available", "partial", "unavailable", "blocked"] }, "limitations": { "type": "array", "maxItems": 17, "uniqueItems": true, "items": { "type": "string", "pattern": "^[A-Z][A-Z0-9_]{0,79}$" } } }, "required": ["status", "limitations"], "additionalProperties": false }, "originalBytesAvailable": { "type": "boolean" } }, "required": ["uploadId", "requestId", "original", "storageStatus", "scanStatus", "scanReason", "extraction", "originalBytesAvailable"], "additionalProperties": false };
var schema40 = { "type": "object", "properties": { "filename": { "type": "string", "minLength": 1, "maxLength": 255 }, "mimeType": { "enum": ["text/plain", "text/markdown", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg"] }, "bytes": { "type": "integer", "minimum": 1, "maximum": 10485760 }, "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "versionId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 1024, "pattern": "^[^\\u0000-\\u001f\\u007f]+$" }, { "type": "null" }] } }, "required": ["filename", "mimeType", "bytes", "sha256", "versionId"], "additionalProperties": false };
var pattern6 = new RegExp("^[^\\u0000-\\u001f\\u007f]+$", "u");
var pattern7 = new RegExp("^[A-Z][A-Z0-9_]{0,79}$", "u");
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors3 = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors3 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.uploadId === void 0 && (missing0 = "uploadId") || data.requestId === void 0 && (missing0 = "requestId") || data.original === void 0 && (missing0 = "original") || data.storageStatus === void 0 && (missing0 = "storageStatus") || data.scanStatus === void 0 && (missing0 = "scanStatus") || data.scanReason === void 0 && (missing0 = "scanReason") || data.extraction === void 0 && (missing0 = "extraction") || data.originalBytesAvailable === void 0 && (missing0 = "originalBytesAvailable")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors3;
        for (const key0 in data) {
          if (!(key0 === "uploadId" || key0 === "requestId" || key0 === "original" || key0 === "storageStatus" || key0 === "scanStatus" || key0 === "scanReason" || key0 === "extraction" || key0 === "originalBytesAvailable")) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors3) {
          if (data.uploadId !== void 0) {
            let data0 = data.uploadId;
            const _errs2 = errors3;
            if (errors3 === _errs2) {
              if (errors3 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate31.errors = [{ instancePath: instancePath + "/uploadId", schemaPath: "#/properties/uploadId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate31.errors = [{ instancePath: instancePath + "/uploadId", schemaPath: "#/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors3;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.requestId !== void 0) {
              let data1 = data.requestId;
              const _errs4 = errors3;
              if (errors3 === _errs4) {
                if (errors3 === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate31.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate31.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors3;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.original !== void 0) {
                let data2 = data.original;
                const _errs6 = errors3;
                const _errs7 = errors3;
                if (errors3 === _errs7) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.filename === void 0 && (missing1 = "filename") || data2.mimeType === void 0 && (missing1 = "mimeType") || data2.bytes === void 0 && (missing1 = "bytes") || data2.sha256 === void 0 && (missing1 = "sha256") || data2.versionId === void 0 && (missing1 = "versionId")) {
                      validate31.errors = [{ instancePath: instancePath + "/original", schemaPath: "#/$defs/UploadOriginal/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs9 = errors3;
                      for (const key1 in data2) {
                        if (!(key1 === "filename" || key1 === "mimeType" || key1 === "bytes" || key1 === "sha256" || key1 === "versionId")) {
                          validate31.errors = [{ instancePath: instancePath + "/original", schemaPath: "#/$defs/UploadOriginal/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs9 === errors3) {
                        if (data2.filename !== void 0) {
                          let data3 = data2.filename;
                          const _errs10 = errors3;
                          if (errors3 === _errs10) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 255) {
                                validate31.errors = [{ instancePath: instancePath + "/original/filename", schemaPath: "#/$defs/UploadOriginal/properties/filename/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate31.errors = [{ instancePath: instancePath + "/original/filename", schemaPath: "#/$defs/UploadOriginal/properties/filename/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate31.errors = [{ instancePath: instancePath + "/original/filename", schemaPath: "#/$defs/UploadOriginal/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors3;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data2.mimeType !== void 0) {
                            let data4 = data2.mimeType;
                            const _errs12 = errors3;
                            if (!(data4 === "text/plain" || data4 === "text/markdown" || data4 === "application/pdf" || data4 === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || data4 === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || data4 === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || data4 === "image/png" || data4 === "image/jpeg")) {
                              validate31.errors = [{ instancePath: instancePath + "/original/mimeType", schemaPath: "#/$defs/UploadOriginal/properties/mimeType/enum", keyword: "enum", params: { allowedValues: schema40.properties.mimeType.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid2 = _errs12 === errors3;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data2.bytes !== void 0) {
                              let data5 = data2.bytes;
                              const _errs13 = errors3;
                              if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                validate31.errors = [{ instancePath: instancePath + "/original/bytes", schemaPath: "#/$defs/UploadOriginal/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                return false;
                              }
                              if (errors3 === _errs13) {
                                if (typeof data5 == "number" && isFinite(data5)) {
                                  if (data5 > 10485760 || isNaN(data5)) {
                                    validate31.errors = [{ instancePath: instancePath + "/original/bytes", schemaPath: "#/$defs/UploadOriginal/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 10485760 }, message: "must be <= 10485760" }];
                                    return false;
                                  } else {
                                    if (data5 < 1 || isNaN(data5)) {
                                      validate31.errors = [{ instancePath: instancePath + "/original/bytes", schemaPath: "#/$defs/UploadOriginal/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                      return false;
                                    }
                                  }
                                }
                              }
                              var valid2 = _errs13 === errors3;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data2.sha256 !== void 0) {
                                let data6 = data2.sha256;
                                const _errs15 = errors3;
                                if (errors3 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (!pattern4.test(data6)) {
                                      validate31.errors = [{ instancePath: instancePath + "/original/sha256", schemaPath: "#/$defs/UploadOriginal/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                      return false;
                                    }
                                  } else {
                                    validate31.errors = [{ instancePath: instancePath + "/original/sha256", schemaPath: "#/$defs/UploadOriginal/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors3;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data2.versionId !== void 0) {
                                  let data7 = data2.versionId;
                                  const _errs17 = errors3;
                                  const _errs18 = errors3;
                                  let valid3 = false;
                                  const _errs19 = errors3;
                                  if (errors3 === _errs19) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 1024) {
                                        const err0 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 1024 }, message: "must NOT have more than 1024 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err0];
                                        } else {
                                          vErrors.push(err0);
                                        }
                                        errors3++;
                                      } else {
                                        if (func1(data7) < 1) {
                                          const err1 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err1];
                                          } else {
                                            vErrors.push(err1);
                                          }
                                          errors3++;
                                        } else {
                                          if (!pattern6.test(data7)) {
                                            const err2 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[^\\u0000-\\u001f\\u007f]+$" }, message: 'must match pattern "^[^\\u0000-\\u001f\\u007f]+$"' };
                                            if (vErrors === null) {
                                              vErrors = [err2];
                                            } else {
                                              vErrors.push(err2);
                                            }
                                            errors3++;
                                          }
                                        }
                                      }
                                    } else {
                                      const err3 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err3];
                                      } else {
                                        vErrors.push(err3);
                                      }
                                      errors3++;
                                    }
                                  }
                                  var _valid0 = _errs19 === errors3;
                                  valid3 = valid3 || _valid0;
                                  const _errs21 = errors3;
                                  if (data7 !== null) {
                                    const err4 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err4];
                                    } else {
                                      vErrors.push(err4);
                                    }
                                    errors3++;
                                  }
                                  var _valid0 = _errs21 === errors3;
                                  valid3 = valid3 || _valid0;
                                  if (!valid3) {
                                    const err5 = { instancePath: instancePath + "/original/versionId", schemaPath: "#/$defs/UploadOriginal/properties/versionId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                    if (vErrors === null) {
                                      vErrors = [err5];
                                    } else {
                                      vErrors.push(err5);
                                    }
                                    errors3++;
                                    validate31.errors = vErrors;
                                    return false;
                                  } else {
                                    errors3 = _errs18;
                                    if (vErrors !== null) {
                                      if (_errs18) {
                                        vErrors.length = _errs18;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid2 = _errs17 === errors3;
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
                    validate31.errors = [{ instancePath: instancePath + "/original", schemaPath: "#/$defs/UploadOriginal/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors3;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.storageStatus !== void 0) {
                  let data8 = data.storageStatus;
                  const _errs23 = errors3;
                  if (!(data8 === "awaiting_upload" || data8 === "unknown" || data8 === "stored" || data8 === "removing" || data8 === "removed")) {
                    validate31.errors = [{ instancePath: instancePath + "/storageStatus", schemaPath: "#/properties/storageStatus/enum", keyword: "enum", params: { allowedValues: schema39.properties.storageStatus.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs23 === errors3;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.scanStatus !== void 0) {
                    let data9 = data.scanStatus;
                    const _errs24 = errors3;
                    if (!(data9 === "pending" || data9 === "clean" || data9 === "infected" || data9 === "unavailable")) {
                      validate31.errors = [{ instancePath: instancePath + "/scanStatus", schemaPath: "#/properties/scanStatus/enum", keyword: "enum", params: { allowedValues: schema39.properties.scanStatus.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs24 === errors3;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.scanReason !== void 0) {
                      let data10 = data.scanReason;
                      const _errs25 = errors3;
                      const _errs26 = errors3;
                      let valid4 = false;
                      const _errs27 = errors3;
                      if (errors3 === _errs27) {
                        if (typeof data10 === "string") {
                          if (!pattern7.test(data10)) {
                            const err6 = { instancePath: instancePath + "/scanReason", schemaPath: "#/properties/scanReason/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[A-Z][A-Z0-9_]{0,79}$" }, message: 'must match pattern "^[A-Z][A-Z0-9_]{0,79}$"' };
                            if (vErrors === null) {
                              vErrors = [err6];
                            } else {
                              vErrors.push(err6);
                            }
                            errors3++;
                          }
                        } else {
                          const err7 = { instancePath: instancePath + "/scanReason", schemaPath: "#/properties/scanReason/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err7];
                          } else {
                            vErrors.push(err7);
                          }
                          errors3++;
                        }
                      }
                      var _valid1 = _errs27 === errors3;
                      valid4 = valid4 || _valid1;
                      const _errs29 = errors3;
                      if (data10 !== null) {
                        const err8 = { instancePath: instancePath + "/scanReason", schemaPath: "#/properties/scanReason/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err8];
                        } else {
                          vErrors.push(err8);
                        }
                        errors3++;
                      }
                      var _valid1 = _errs29 === errors3;
                      valid4 = valid4 || _valid1;
                      if (!valid4) {
                        const err9 = { instancePath: instancePath + "/scanReason", schemaPath: "#/properties/scanReason/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err9];
                        } else {
                          vErrors.push(err9);
                        }
                        errors3++;
                        validate31.errors = vErrors;
                        return false;
                      } else {
                        errors3 = _errs26;
                        if (vErrors !== null) {
                          if (_errs26) {
                            vErrors.length = _errs26;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs25 === errors3;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.extraction !== void 0) {
                        let data11 = data.extraction;
                        const _errs31 = errors3;
                        if (errors3 === _errs31) {
                          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                            let missing2;
                            if (data11.status === void 0 && (missing2 = "status") || data11.limitations === void 0 && (missing2 = "limitations")) {
                              validate31.errors = [{ instancePath: instancePath + "/extraction", schemaPath: "#/properties/extraction/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                              return false;
                            } else {
                              const _errs33 = errors3;
                              for (const key2 in data11) {
                                if (!(key2 === "status" || key2 === "limitations")) {
                                  validate31.errors = [{ instancePath: instancePath + "/extraction", schemaPath: "#/properties/extraction/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs33 === errors3) {
                                if (data11.status !== void 0) {
                                  let data12 = data11.status;
                                  const _errs34 = errors3;
                                  if (!(data12 === "pending" || data12 === "available" || data12 === "partial" || data12 === "unavailable" || data12 === "blocked")) {
                                    validate31.errors = [{ instancePath: instancePath + "/extraction/status", schemaPath: "#/properties/extraction/properties/status/enum", keyword: "enum", params: { allowedValues: schema39.properties.extraction.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                    return false;
                                  }
                                  var valid5 = _errs34 === errors3;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data11.limitations !== void 0) {
                                    let data13 = data11.limitations;
                                    const _errs35 = errors3;
                                    if (errors3 === _errs35) {
                                      if (Array.isArray(data13)) {
                                        if (data13.length > 17) {
                                          validate31.errors = [{ instancePath: instancePath + "/extraction/limitations", schemaPath: "#/properties/extraction/properties/limitations/maxItems", keyword: "maxItems", params: { limit: 17 }, message: "must NOT have more than 17 items" }];
                                          return false;
                                        } else {
                                          var valid6 = true;
                                          const len0 = data13.length;
                                          for (let i0 = 0; i0 < len0; i0++) {
                                            let data14 = data13[i0];
                                            const _errs37 = errors3;
                                            if (errors3 === _errs37) {
                                              if (typeof data14 === "string") {
                                                if (!pattern7.test(data14)) {
                                                  validate31.errors = [{ instancePath: instancePath + "/extraction/limitations/" + i0, schemaPath: "#/properties/extraction/properties/limitations/items/pattern", keyword: "pattern", params: { pattern: "^[A-Z][A-Z0-9_]{0,79}$" }, message: 'must match pattern "^[A-Z][A-Z0-9_]{0,79}$"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate31.errors = [{ instancePath: instancePath + "/extraction/limitations/" + i0, schemaPath: "#/properties/extraction/properties/limitations/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid6 = _errs37 === errors3;
                                            if (!valid6) {
                                              break;
                                            }
                                          }
                                          if (valid6) {
                                            let i1 = data13.length;
                                            let j0;
                                            if (i1 > 1) {
                                              const indices0 = {};
                                              for (; i1--; ) {
                                                let item0 = data13[i1];
                                                if (typeof item0 !== "string") {
                                                  continue;
                                                }
                                                if (typeof indices0[item0] == "number") {
                                                  j0 = indices0[item0];
                                                  validate31.errors = [{ instancePath: instancePath + "/extraction/limitations", schemaPath: "#/properties/extraction/properties/limitations/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                                  return false;
                                                  break;
                                                }
                                                indices0[item0] = i1;
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        validate31.errors = [{ instancePath: instancePath + "/extraction/limitations", schemaPath: "#/properties/extraction/properties/limitations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                        return false;
                                      }
                                    }
                                    var valid5 = _errs35 === errors3;
                                  } else {
                                    var valid5 = true;
                                  }
                                }
                              }
                            }
                          } else {
                            validate31.errors = [{ instancePath: instancePath + "/extraction", schemaPath: "#/properties/extraction/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid0 = _errs31 === errors3;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.originalBytesAvailable !== void 0) {
                          const _errs39 = errors3;
                          if (typeof data.originalBytesAvailable !== "boolean") {
                            validate31.errors = [{ instancePath: instancePath + "/originalBytesAvailable", schemaPath: "#/properties/originalBytesAvailable/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                            return false;
                          }
                          var valid0 = _errs39 === errors3;
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
    } else {
      validate31.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors3 === 0;
}
validate31.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateError = validate32;
var schema42 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["UPLOAD_ID", "UPLOAD_FILENAME", "UPLOAD_FORMAT", "UPLOAD_HASH", "UPLOAD_ENCODING", "UPLOAD_MAGIC", "UPLOAD_IMAGE_LIMIT", "UPLOAD_ACTIVE_CONTENT", "UPLOAD_RELATIONSHIP", "UPLOAD_ORIGINAL_MISMATCH", "INVALID_COMMAND", "INVALID_JSON", "INVALID_BODY", "INVALID_CONTENT_LENGTH", "INVALID_UTF8", "UPLOAD_ACCESS_DENIED", "ACCESS_DENIED", "UPLOAD_NOT_FOUND", "NOT_FOUND", "METHOD_NOT_ALLOWED", "DEADLINE", "UPLOAD_EXPIRED", "UPLOAD_REQUEST_CONFLICT", "UPLOAD_CHANGED", "UPLOAD_NOT_CLEAN", "UPLOAD_NOT_STORED", "UPLOAD_REMOVAL_UNCERTAIN", "UPLOAD_REMOVAL_HELD", "UPLOAD_SIZE", "REQUEST_TOO_LARGE", "CANCELLED", "UPLOAD_UNAVAILABLE", "UPLOAD_PUT_UNKNOWN", "UPLOAD_COMMIT_UNKNOWN"] }, "outcome": { "enum": ["NOT_DISPATCHED", "UNKNOWN", "READ_UNAVAILABLE"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors3 = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors3 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.error === void 0 && (missing0 = "error")) {
        validate32.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors3;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate32.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors3) {
          if (data.error !== void 0) {
            let data0 = data.error;
            const _errs2 = errors3;
            if (errors3 === _errs2) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.code === void 0 && (missing1 = "code") || data0.outcome === void 0 && (missing1 = "outcome")) {
                  validate32.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors3;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate32.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors3) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors3;
                      if (!(data1 === "UPLOAD_ID" || data1 === "UPLOAD_FILENAME" || data1 === "UPLOAD_FORMAT" || data1 === "UPLOAD_HASH" || data1 === "UPLOAD_ENCODING" || data1 === "UPLOAD_MAGIC" || data1 === "UPLOAD_IMAGE_LIMIT" || data1 === "UPLOAD_ACTIVE_CONTENT" || data1 === "UPLOAD_RELATIONSHIP" || data1 === "UPLOAD_ORIGINAL_MISMATCH" || data1 === "INVALID_COMMAND" || data1 === "INVALID_JSON" || data1 === "INVALID_BODY" || data1 === "INVALID_CONTENT_LENGTH" || data1 === "INVALID_UTF8" || data1 === "UPLOAD_ACCESS_DENIED" || data1 === "ACCESS_DENIED" || data1 === "UPLOAD_NOT_FOUND" || data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "DEADLINE" || data1 === "UPLOAD_EXPIRED" || data1 === "UPLOAD_REQUEST_CONFLICT" || data1 === "UPLOAD_CHANGED" || data1 === "UPLOAD_NOT_CLEAN" || data1 === "UPLOAD_NOT_STORED" || data1 === "UPLOAD_REMOVAL_UNCERTAIN" || data1 === "UPLOAD_REMOVAL_HELD" || data1 === "UPLOAD_SIZE" || data1 === "REQUEST_TOO_LARGE" || data1 === "CANCELLED" || data1 === "UPLOAD_UNAVAILABLE" || data1 === "UPLOAD_PUT_UNKNOWN" || data1 === "UPLOAD_COMMIT_UNKNOWN")) {
                        validate32.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema42.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid1 = _errs5 === errors3;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        let data2 = data0.outcome;
                        const _errs6 = errors3;
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN" || data2 === "READ_UNAVAILABLE")) {
                          validate32.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema42.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs6 === errors3;
                      } else {
                        var valid1 = true;
                      }
                    }
                  }
                }
              } else {
                validate32.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
  return errors3 === 0;
}
validate32.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// uploads-application/protocol.mjs
var uploadApplicationVersion = "1.0.0";
var UPLOAD_POLICY_VERSION = "upload-1";
var UPLOAD_LIMITS = Object.freeze({
  originalBytes: 10 * 1024 * 1024,
  zipEntries: 4096,
  expandedBytes: 64 * 1024 * 1024,
  compressionRatio: 100,
  pdfPages: 200,
  slides: 200,
  sheets: 50,
  rows: 1e5,
  columns: 1024,
  textCharacters: 2e6,
  imagePixels: 4e7,
  scanMs: 3e4,
  parseMs: 3e4,
  ocrMs: 9e4,
  ocrPages: 40,
  lowConfidence: 0.8
});
var UPLOAD_MIME = Object.freeze({
  txt: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
});
var uploadApplicationMetadata = Object.freeze({
  version: uploadApplicationVersion,
  schemaId: "urn:meri:uploads-application:1.0.0",
  requestBytes: 8192,
  responseBytes: 32768,
  originalBytes: UPLOAD_LIMITS.originalBytes,
  policyVersion: UPLOAD_POLICY_VERSION
});
var uploadRoutes = Object.freeze(["initiate", "complete", "status", "inspect", "read", "remove"]);
var uploadErrorStatuses = Object.freeze(Object.fromEntries([
  ...[
    "UPLOAD_ID",
    "UPLOAD_FILENAME",
    "UPLOAD_FORMAT",
    "UPLOAD_HASH",
    "UPLOAD_ENCODING",
    "UPLOAD_MAGIC",
    "UPLOAD_IMAGE_LIMIT",
    "UPLOAD_ACTIVE_CONTENT",
    "UPLOAD_RELATIONSHIP",
    "UPLOAD_ORIGINAL_MISMATCH",
    "INVALID_COMMAND",
    "INVALID_JSON",
    "INVALID_BODY",
    "INVALID_CONTENT_LENGTH",
    "INVALID_UTF8"
  ].map((code) => [code, 400]),
  ...["UPLOAD_ACCESS_DENIED", "ACCESS_DENIED"].map((code) => [code, 403]),
  ["UPLOAD_NOT_FOUND", 404],
  ["NOT_FOUND", 404],
  ["METHOD_NOT_ALLOWED", 405],
  ...["DEADLINE", "UPLOAD_EXPIRED"].map((code) => [code, 408]),
  ...["UPLOAD_REQUEST_CONFLICT", "UPLOAD_CHANGED", "UPLOAD_NOT_CLEAN", "UPLOAD_NOT_STORED", "UPLOAD_REMOVAL_UNCERTAIN", "UPLOAD_REMOVAL_HELD"].map((code) => [code, 409]),
  ...["UPLOAD_SIZE", "REQUEST_TOO_LARGE"].map((code) => [code, 413]),
  ["CANCELLED", 499],
  ...["UPLOAD_UNAVAILABLE", "UPLOAD_PUT_UNKNOWN", "UPLOAD_COMMIT_UNKNOWN"].map((code) => [code, 503])
]));
var uploadNotDispatchedErrors = Object.freeze([
  "UPLOAD_ID",
  "UPLOAD_FILENAME",
  "UPLOAD_FORMAT",
  "UPLOAD_SIZE",
  "UPLOAD_HASH",
  "UPLOAD_ORIGINAL_MISMATCH",
  "INVALID_COMMAND",
  "INVALID_JSON",
  "INVALID_BODY",
  "INVALID_CONTENT_LENGTH",
  "INVALID_UTF8",
  "REQUEST_TOO_LARGE",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED"
]);
function uploadDisposition(filename) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

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
    const copy2 = new Uint8Array(n);
    Uint8Array.prototype.set.call(copy2, new Uint8Array(b, o, n));
    return copy2;
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

// uploads-application/boundary.mjs
var errors2 = /* @__PURE__ */ new WeakSet();
var UploadResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "UploadResponseError";
    this.code = code;
    errors2.add(this);
  }
};
var fail2 = (code) => {
  throw new UploadResponseError(code);
};
var isFailure2 = (error) => errors2.has(error);
var parse = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch {
    fail2("INVALID_UPLOAD_BYTES");
  }
};
var copy = (bytes, cap) => {
  try {
    return copyBytes(bytes, cap);
  } catch {
    fail2("UPLOAD_BYTE_LIMIT");
  }
};
var requests = /* @__PURE__ */ new WeakMap();
var receipts = /* @__PURE__ */ new WeakSet();
function declaration(value) {
  const name = value.filename, format = /\.([a-z0-9]+)$/iu.exec(name)?.[1].toLowerCase();
  if (new TextEncoder().encode(name).length > 255 || /[\u0000-\u001f\u007f/\\]/u.test(name) || !name.trim() || !Object.hasOwn(UPLOAD_MIME, format) || value.mimeType !== UPLOAD_MIME[format]) fail2("INVALID_UPLOAD_DECLARATION");
}

// uploads-application/download.mjs
var get2 = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name).get;
async function receiveUploadDownload(response, request, receipt, { timeoutMs = 3e4, signal } = {}) {
  if (requests.get(request) !== "read" || !receipts.has(receipt) || request.uploadId !== receipt.uploadId || !receipt.originalBytesAvailable) fail2("UNADMITTED_UPLOAD_DOWNLOAD");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 6e4) fail2("UPLOAD_DOWNLOAD_OPTIONS");
  if (signal !== void 0) try {
    get2(AbortSignal.prototype, "aborted").call(signal);
  } catch {
    fail2("UPLOAD_DOWNLOAD_SIGNAL");
  }
  let body, headers, status, redirected;
  try {
    body = get2(Response.prototype, "body").call(response);
    headers = get2(Response.prototype, "headers").call(response);
    status = get2(Response.prototype, "status").call(response);
    redirected = get2(Response.prototype, "redirected").call(response);
  } catch {
    fail2("UPLOAD_DOWNLOAD_RESPONSE");
  }
  const header = (name) => Headers.prototype.get.call(headers, name), original = receipt.original;
  if (redirected || status !== 200 || header("content-type") !== original.mimeType || header("content-length") !== String(original.bytes) || header("content-disposition") !== uploadDisposition(original.filename) || header("x-meri-upload-id") !== receipt.uploadId || header("x-meri-upload-sha256") !== original.sha256 || header("x-meri-upload-version") !== encodeURIComponent(original.versionId) || header("cache-control") !== "no-store" || header("x-content-type-options") !== "nosniff" || header("content-encoding") !== null) fail2("UPLOAD_DOWNLOAD_HEADERS");
  let reader;
  try {
    reader = ReadableStream.prototype.getReader.call(body);
  } catch {
    fail2("UPLOAD_DOWNLOAD_BODY");
  }
  const deadline = Date.now() + timeoutMs;
  let abort, timer, done = false, stopReject;
  const stop = new Promise((_, reject) => {
    stopReject = reject;
  });
  stop.catch(() => {
  });
  const check = () => {
    if (signal && get2(AbortSignal.prototype, "aborted").call(signal)) fail2("UPLOAD_DOWNLOAD_CANCELLED");
    if (Date.now() >= deadline) fail2("UPLOAD_DOWNLOAD_DEADLINE");
  };
  const wait = async (action) => {
    check();
    const out = await Promise.race([action(), stop]);
    check();
    return out;
  };
  try {
    if (signal) {
      abort = () => stopReject(Error("cancelled"));
      EventTarget.prototype.addEventListener.call(signal, "abort", abort, { once: true });
    }
    timer = setTimeout(() => stopReject(Error("deadline")), timeoutMs);
    check();
    const bytes = new Uint8Array(original.bytes);
    let count = 0;
    for (; ; ) {
      const next = await wait(() => ReadableStreamDefaultReader.prototype.read.call(reader));
      if (next.done) {
        done = true;
        break;
      }
      const chunk = copy(next.value, Math.min(UPLOAD_LIMITS.originalBytes, bytes.length) - count);
      Uint8Array.prototype.set.call(bytes, chunk, count);
      count += chunk.length;
    }
    if (count !== original.bytes || await wait(() => digest(bytes)) !== original.sha256) fail2("UPLOAD_DOWNLOAD_INTEGRITY");
    return Object.freeze({ receipt, bytes });
  } catch (error) {
    if (isFailure2(error)) throw error;
    check();
    fail2("UPLOAD_DOWNLOAD_STREAM");
  } finally {
    clearTimeout(timer);
    if (signal && abort) EventTarget.prototype.removeEventListener.call(signal, "abort", abort);
    if (!done) try {
      Promise.resolve(ReadableStreamDefaultReader.prototype.cancel.call(reader)).catch(() => {
      });
    } catch {
    }
    try {
      ReadableStreamDefaultReader.prototype.releaseLock.call(reader);
    } catch {
    }
  }
}

// uploads-application/uploads-receiver.mjs
function receiveUploadRequest(route, bytes) {
  if (!uploadRoutes.includes(route)) fail2("INVALID_UPLOAD_ROUTE");
  const q = parse(bytes, uploadApplicationMetadata.requestBytes);
  if (!(route === "initiate" ? validateInitiate(q) : route === "status" ? validateStatus(q) : validateId(q))) fail2("INVALID_UPLOAD_REQUEST");
  if (route === "initiate") declaration(q);
  requests.set(q, route);
  return q;
}
function uploadRequestPath(route, request) {
  if (requests.get(request) !== route) fail2("UNADMITTED_UPLOAD_REQUEST");
  return route === "complete" ? "/api/uploads/original/" + request.uploadId : "/api/uploads/" + route;
}
function receiveUploadResponse(route, status, bytes, request) {
  if (!uploadRoutes.includes(route) || requests.get(request) !== route) fail2("UNADMITTED_UPLOAD_REQUEST");
  const result = parse(bytes, uploadApplicationMetadata.responseBytes);
  if (status !== 200) {
    if (!validateError(result) || uploadErrorStatuses[result.error.code] !== status) fail2("INVALID_UPLOAD_ERROR");
    const { code, outcome } = result.error;
    if (uploadNotDispatchedErrors.includes(code) ? outcome !== "NOT_DISPATCHED" : outcome === "NOT_DISPATCHED" ? code !== "UPLOAD_UNAVAILABLE" : ["status", "read"].includes(route) && outcome !== "READ_UNAVAILABLE") fail2("INVALID_UPLOAD_OUTCOME");
    return result;
  }
  if (route === "read") fail2("UPLOAD_BINARY_REQUIRED");
  if (!validateReceipt(result)) fail2("INVALID_UPLOAD_RECEIPT");
  declaration(result.original);
  if (route === "initiate" ? request.requestId !== result.requestId || ["filename", "mimeType", "bytes", "sha256"].some((key) => request[key] !== result.original[key]) : route === "status" && Object.hasOwn(request, "requestId") ? request.requestId !== result.requestId : request.uploadId !== result.uploadId) fail2("UPLOAD_CORRELATION");
  const { storageStatus: state, scanStatus: scan, extraction, original } = result;
  if (["awaiting_upload", "unknown"].includes(state) && (original.versionId !== null || scan !== "pending" || extraction.status !== "pending") || ["stored", "removing"].includes(state) && original.versionId === null || result.originalBytesAvailable !== (state === "stored" && scan === "clean") || result.scanReason === null !== ["pending", "clean"].includes(scan) || ["pending", "available"].includes(extraction.status) && extraction.limitations.length !== 0 || ["partial", "unavailable", "blocked"].includes(extraction.status) && extraction.limitations.length === 0 || ["available", "partial", "blocked"].includes(extraction.status) && scan !== "clean" || scan === "pending" !== (extraction.status === "pending") || state === "removed" && (scan !== "unavailable" || result.scanReason !== "UPLOAD_REMOVED" || extraction.status !== "unavailable" || extraction.limitations.length !== 1 || extraction.limitations[0] !== "UPLOAD_REMOVED")) fail2("UPLOAD_STATE_MISMATCH");
  receipts.add(result);
  return result;
}
async function receiveUploadOriginal(bytes, request, receipt) {
  if (requests.get(request) !== "complete" || !receipts.has(receipt) || request.uploadId !== receipt.uploadId) fail2("UNADMITTED_UPLOAD_RECEIPT");
  if (receipt.storageStatus !== "awaiting_upload") fail2("UPLOAD_ATTEMPT_ALREADY_ALLOCATED");
  const original = copy(bytes, uploadApplicationMetadata.originalBytes);
  if (original.length !== receipt.original.bytes || await digest(original) !== receipt.original.sha256) fail2("UPLOAD_ORIGINAL_MISMATCH");
  return original;
}
export {
  UPLOAD_LIMITS,
  UPLOAD_MIME,
  UPLOAD_POLICY_VERSION,
  UploadResponseError,
  receiveUploadDownload,
  receiveUploadOriginal,
  receiveUploadRequest,
  receiveUploadResponse,
  uploadApplicationMetadata,
  uploadApplicationVersion,
  uploadDisposition,
  uploadErrorStatuses,
  uploadNotDispatchedErrors,
  uploadRequestPath,
  uploadRoutes
};
