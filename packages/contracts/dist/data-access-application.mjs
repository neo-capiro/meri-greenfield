// Generated self-contained browser receiving boundary. No authority or deployment acceptance.
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

// data-access-generated:./generated-validator.mjs
var validateDataAccessClientId = validate40;
var pattern4 = new RegExp("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", "u");
function validate40(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate40.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors2;
  let valid0 = false;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (typeof data === "string") {
      if (!pattern4.test(data)) {
        const err0 = { instancePath, schemaPath: "#/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      }
    } else {
      const err1 = { instancePath, schemaPath: "#/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  valid0 = valid0 || _valid0;
  const _errs3 = errors2;
  if (data !== null) {
    const err2 = { instancePath, schemaPath: "#/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors2++;
  }
  var _valid0 = _errs3 === errors2;
  valid0 = valid0 || _valid0;
  if (!valid0) {
    const err3 = { instancePath, schemaPath: "#/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors2++;
    validate40.errors = vErrors;
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
  validate40.errors = vErrors;
  return errors2 === 0;
}
validate40.evaluated = { "dynamicProps": false, "dynamicItems": false };
var validateDataAccessRequest = validate41;
function validate41(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate41.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.clientId === void 0 && (missing0 = "clientId")) {
        validate41.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "clientId")) {
            validate41.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.clientId !== void 0) {
            let data0 = data.clientId;
            const _errs4 = errors2;
            let valid2 = false;
            const _errs5 = errors2;
            if (errors2 === _errs5) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  const err0 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors2++;
                }
              } else {
                const err1 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors2++;
              }
            }
            var _valid0 = _errs5 === errors2;
            valid2 = valid2 || _valid0;
            const _errs7 = errors2;
            if (data0 !== null) {
              const err2 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors2++;
            }
            var _valid0 = _errs7 === errors2;
            valid2 = valid2 || _valid0;
            if (!valid2) {
              const err3 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors2++;
              validate41.errors = vErrors;
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
          }
        }
      }
    } else {
      validate41.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate41.errors = vErrors;
  return errors2 === 0;
}
validate41.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateDataAccessState = validate42;
var schema38 = { "enum": ["not_installed", "policy_off", "client_required", "available"] };
function validate42(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate42.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!(data === "not_installed" || data === "policy_off" || data === "client_required" || data === "available")) {
    validate42.errors = [{ instancePath, schemaPath: "#/enum", keyword: "enum", params: { allowedValues: schema38.enum }, message: "must be equal to one of the allowed values" }];
    return false;
  }
  validate42.errors = vErrors;
  return errors2 === 0;
}
validate42.evaluated = { "dynamicProps": false, "dynamicItems": false };
var validateDataAccessFamily = validate43;
var schema40 = { "type": "object", "properties": { "family": { "type": "string", "pattern": "^[a-z][a-z0-9-]{0,63}$" }, "covers": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 240 }, { "type": "null" }] }, "freshness": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 260 }, { "type": "null" }] }, "structured": { "type": "boolean" }, "clientScope": { "enum": ["required", "optional"] }, "state": { "$ref": "#/$defs/DataAccessState" }, "requires": { "anyOf": [{ "enum": ["mailbox"] }, { "type": "null" }] } }, "required": ["family", "covers", "freshness", "structured", "clientScope", "state", "requires"], "additionalProperties": false };
var pattern6 = new RegExp("^[a-z][a-z0-9-]{0,63}$", "u");
var func1 = require_ucs2length().default;
function validate43(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate43.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.family === void 0 && (missing0 = "family") || data.covers === void 0 && (missing0 = "covers") || data.freshness === void 0 && (missing0 = "freshness") || data.structured === void 0 && (missing0 = "structured") || data.clientScope === void 0 && (missing0 = "clientScope") || data.state === void 0 && (missing0 = "state") || data.requires === void 0 && (missing0 = "requires")) {
        validate43.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "family" || key0 === "covers" || key0 === "freshness" || key0 === "structured" || key0 === "clientScope" || key0 === "state" || key0 === "requires")) {
            validate43.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.family !== void 0) {
            let data0 = data.family;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern6.test(data0)) {
                  validate43.errors = [{ instancePath: instancePath + "/family", schemaPath: "#/properties/family/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{0,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{0,63}$"' }];
                  return false;
                }
              } else {
                validate43.errors = [{ instancePath: instancePath + "/family", schemaPath: "#/properties/family/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.covers !== void 0) {
              let data1 = data.covers;
              const _errs4 = errors2;
              const _errs5 = errors2;
              let valid1 = false;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 240) {
                    const err0 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  } else {
                    if (func1(data1) < 1) {
                      const err1 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                    }
                  }
                } else {
                  const err2 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              const _errs8 = errors2;
              if (data1 !== null) {
                const err3 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
              }
              var _valid0 = _errs8 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err4 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors2++;
                validate43.errors = vErrors;
                return false;
              } else {
                errors2 = _errs5;
                if (vErrors !== null) {
                  if (_errs5) {
                    vErrors.length = _errs5;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.freshness !== void 0) {
                let data2 = data.freshness;
                const _errs10 = errors2;
                const _errs11 = errors2;
                let valid2 = false;
                const _errs12 = errors2;
                if (errors2 === _errs12) {
                  if (typeof data2 === "string") {
                    if (func1(data2) > 260) {
                      const err5 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 260 }, message: "must NOT have more than 260 characters" };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    } else {
                      if (func1(data2) < 1) {
                        const err6 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err7 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                }
                var _valid1 = _errs12 === errors2;
                valid2 = valid2 || _valid1;
                const _errs14 = errors2;
                if (data2 !== null) {
                  const err8 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors2++;
                }
                var _valid1 = _errs14 === errors2;
                valid2 = valid2 || _valid1;
                if (!valid2) {
                  const err9 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err9];
                  } else {
                    vErrors.push(err9);
                  }
                  errors2++;
                  validate43.errors = vErrors;
                  return false;
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
                var valid0 = _errs10 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.structured !== void 0) {
                  const _errs16 = errors2;
                  if (typeof data.structured !== "boolean") {
                    validate43.errors = [{ instancePath: instancePath + "/structured", schemaPath: "#/properties/structured/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs16 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.clientScope !== void 0) {
                    let data4 = data.clientScope;
                    const _errs18 = errors2;
                    if (!(data4 === "required" || data4 === "optional")) {
                      validate43.errors = [{ instancePath: instancePath + "/clientScope", schemaPath: "#/properties/clientScope/enum", keyword: "enum", params: { allowedValues: schema40.properties.clientScope.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs18 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.state !== void 0) {
                      let data5 = data.state;
                      const _errs19 = errors2;
                      if (!(data5 === "not_installed" || data5 === "policy_off" || data5 === "client_required" || data5 === "available")) {
                        validate43.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/$defs/DataAccessState/enum", keyword: "enum", params: { allowedValues: schema38.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs19 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.requires !== void 0) {
                        let data6 = data.requires;
                        const _errs21 = errors2;
                        const _errs22 = errors2;
                        let valid4 = false;
                        const _errs23 = errors2;
                        if (!(data6 === "mailbox")) {
                          const err10 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema40.properties.requires.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                          if (vErrors === null) {
                            vErrors = [err10];
                          } else {
                            vErrors.push(err10);
                          }
                          errors2++;
                        }
                        var _valid2 = _errs23 === errors2;
                        valid4 = valid4 || _valid2;
                        const _errs24 = errors2;
                        if (data6 !== null) {
                          const err11 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err11];
                          } else {
                            vErrors.push(err11);
                          }
                          errors2++;
                        }
                        var _valid2 = _errs24 === errors2;
                        valid4 = valid4 || _valid2;
                        if (!valid4) {
                          const err12 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err12];
                          } else {
                            vErrors.push(err12);
                          }
                          errors2++;
                          validate43.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs22;
                          if (vErrors !== null) {
                            if (_errs22) {
                              vErrors.length = _errs22;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs21 === errors2;
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
    } else {
      validate43.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate43.errors = vErrors;
  return errors2 === 0;
}
validate43.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateDataAccessRelation = validate44;
var schema43 = { "type": "object", "properties": { "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,63}$" }, "source": { "enum": ["public", "client_records"] }, "state": { "$ref": "#/$defs/DataAccessState" } }, "required": ["name", "source", "state"], "additionalProperties": false };
var pattern7 = new RegExp("^[a-z][a-z0-9_]{0,63}$", "u");
function validate44(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = "name") || data.source === void 0 && (missing0 = "source") || data.state === void 0 && (missing0 = "state")) {
        validate44.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "name" || key0 === "source" || key0 === "state")) {
            validate44.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.name !== void 0) {
            let data0 = data.name;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern7.test(data0)) {
                  validate44.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_]{0,63}$" }, message: 'must match pattern "^[a-z][a-z0-9_]{0,63}$"' }];
                  return false;
                }
              } else {
                validate44.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.source !== void 0) {
              let data1 = data.source;
              const _errs4 = errors2;
              if (!(data1 === "public" || data1 === "client_records")) {
                validate44.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/properties/source/enum", keyword: "enum", params: { allowedValues: schema43.properties.source.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.state !== void 0) {
                let data2 = data.state;
                const _errs5 = errors2;
                if (!(data2 === "not_installed" || data2 === "policy_off" || data2 === "client_required" || data2 === "available")) {
                  validate44.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/$defs/DataAccessState/enum", keyword: "enum", params: { allowedValues: schema38.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
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
      validate44.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate44.errors = vErrors;
  return errors2 === 0;
}
validate44.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateDataAccessResponse = validate45;
var pattern8 = new RegExp("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$", "u");
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
      if (data.family === void 0 && (missing0 = "family") || data.covers === void 0 && (missing0 = "covers") || data.freshness === void 0 && (missing0 = "freshness") || data.structured === void 0 && (missing0 = "structured") || data.clientScope === void 0 && (missing0 = "clientScope") || data.state === void 0 && (missing0 = "state") || data.requires === void 0 && (missing0 = "requires")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "family" || key0 === "covers" || key0 === "freshness" || key0 === "structured" || key0 === "clientScope" || key0 === "state" || key0 === "requires")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.family !== void 0) {
            let data0 = data.family;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern6.test(data0)) {
                  validate34.errors = [{ instancePath: instancePath + "/family", schemaPath: "#/properties/family/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{0,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{0,63}$"' }];
                  return false;
                }
              } else {
                validate34.errors = [{ instancePath: instancePath + "/family", schemaPath: "#/properties/family/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.covers !== void 0) {
              let data1 = data.covers;
              const _errs4 = errors2;
              const _errs5 = errors2;
              let valid1 = false;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 240) {
                    const err0 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  } else {
                    if (func1(data1) < 1) {
                      const err1 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                    }
                  }
                } else {
                  const err2 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              const _errs8 = errors2;
              if (data1 !== null) {
                const err3 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
              }
              var _valid0 = _errs8 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err4 = { instancePath: instancePath + "/covers", schemaPath: "#/properties/covers/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors2++;
                validate34.errors = vErrors;
                return false;
              } else {
                errors2 = _errs5;
                if (vErrors !== null) {
                  if (_errs5) {
                    vErrors.length = _errs5;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.freshness !== void 0) {
                let data2 = data.freshness;
                const _errs10 = errors2;
                const _errs11 = errors2;
                let valid2 = false;
                const _errs12 = errors2;
                if (errors2 === _errs12) {
                  if (typeof data2 === "string") {
                    if (func1(data2) > 260) {
                      const err5 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 260 }, message: "must NOT have more than 260 characters" };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    } else {
                      if (func1(data2) < 1) {
                        const err6 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err7 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                }
                var _valid1 = _errs12 === errors2;
                valid2 = valid2 || _valid1;
                const _errs14 = errors2;
                if (data2 !== null) {
                  const err8 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors2++;
                }
                var _valid1 = _errs14 === errors2;
                valid2 = valid2 || _valid1;
                if (!valid2) {
                  const err9 = { instancePath: instancePath + "/freshness", schemaPath: "#/properties/freshness/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err9];
                  } else {
                    vErrors.push(err9);
                  }
                  errors2++;
                  validate34.errors = vErrors;
                  return false;
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
                var valid0 = _errs10 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.structured !== void 0) {
                  const _errs16 = errors2;
                  if (typeof data.structured !== "boolean") {
                    validate34.errors = [{ instancePath: instancePath + "/structured", schemaPath: "#/properties/structured/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs16 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.clientScope !== void 0) {
                    let data4 = data.clientScope;
                    const _errs18 = errors2;
                    if (!(data4 === "required" || data4 === "optional")) {
                      validate34.errors = [{ instancePath: instancePath + "/clientScope", schemaPath: "#/properties/clientScope/enum", keyword: "enum", params: { allowedValues: schema40.properties.clientScope.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs18 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.state !== void 0) {
                      let data5 = data.state;
                      const _errs19 = errors2;
                      if (!(data5 === "not_installed" || data5 === "policy_off" || data5 === "client_required" || data5 === "available")) {
                        validate34.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/$defs/DataAccessState/enum", keyword: "enum", params: { allowedValues: schema38.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs19 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.requires !== void 0) {
                        let data6 = data.requires;
                        const _errs21 = errors2;
                        const _errs22 = errors2;
                        let valid4 = false;
                        const _errs23 = errors2;
                        if (!(data6 === "mailbox")) {
                          const err10 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema40.properties.requires.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                          if (vErrors === null) {
                            vErrors = [err10];
                          } else {
                            vErrors.push(err10);
                          }
                          errors2++;
                        }
                        var _valid2 = _errs23 === errors2;
                        valid4 = valid4 || _valid2;
                        const _errs24 = errors2;
                        if (data6 !== null) {
                          const err11 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err11];
                          } else {
                            vErrors.push(err11);
                          }
                          errors2++;
                        }
                        var _valid2 = _errs24 === errors2;
                        valid4 = valid4 || _valid2;
                        if (!valid4) {
                          const err12 = { instancePath: instancePath + "/requires", schemaPath: "#/properties/requires/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err12];
                          } else {
                            vErrors.push(err12);
                          }
                          errors2++;
                          validate34.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs22;
                          if (vErrors !== null) {
                            if (_errs22) {
                              vErrors.length = _errs22;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs21 === errors2;
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
    } else {
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors2 === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.name === void 0 && (missing0 = "name") || data.source === void 0 && (missing0 = "source") || data.state === void 0 && (missing0 = "state")) {
        validate36.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "name" || key0 === "source" || key0 === "state")) {
            validate36.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.name !== void 0) {
            let data0 = data.name;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern7.test(data0)) {
                  validate36.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_]{0,63}$" }, message: 'must match pattern "^[a-z][a-z0-9_]{0,63}$"' }];
                  return false;
                }
              } else {
                validate36.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.source !== void 0) {
              let data1 = data.source;
              const _errs4 = errors2;
              if (!(data1 === "public" || data1 === "client_records")) {
                validate36.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/properties/source/enum", keyword: "enum", params: { allowedValues: schema43.properties.source.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.state !== void 0) {
                let data2 = data.state;
                const _errs5 = errors2;
                if (!(data2 === "not_installed" || data2 === "policy_off" || data2 === "client_required" || data2 === "available")) {
                  validate36.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/$defs/DataAccessState/enum", keyword: "enum", params: { allowedValues: schema38.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
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
      validate36.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate36.errors = vErrors;
  return errors2 === 0;
}
validate36.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate45(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate45.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.checkedAt === void 0 && (missing0 = "checkedAt") || data.clientId === void 0 && (missing0 = "clientId") || data.generalReads === void 0 && (missing0 = "generalReads") || data.families === void 0 && (missing0 = "families") || data.relations === void 0 && (missing0 = "relations")) {
        validate45.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "checkedAt" || key0 === "clientId" || key0 === "generalReads" || key0 === "families" || key0 === "relations")) {
            validate45.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.data-access/1" !== data.schemaVersion) {
              validate45.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.data-access/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.checkedAt !== void 0) {
              let data1 = data.checkedAt;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (typeof data1 === "string") {
                  if (!pattern8.test(data1)) {
                    validate45.errors = [{ instancePath: instancePath + "/checkedAt", schemaPath: "#/properties/checkedAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' }];
                    return false;
                  }
                } else {
                  validate45.errors = [{ instancePath: instancePath + "/checkedAt", schemaPath: "#/properties/checkedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.clientId !== void 0) {
                let data2 = data.clientId;
                const _errs5 = errors2;
                const _errs7 = errors2;
                let valid2 = false;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (typeof data2 === "string") {
                    if (!pattern4.test(data2)) {
                      const err0 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"' };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                  } else {
                    const err1 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err1];
                    } else {
                      vErrors.push(err1);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs8 === errors2;
                valid2 = valid2 || _valid0;
                const _errs10 = errors2;
                if (data2 !== null) {
                  const err2 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
                var _valid0 = _errs10 === errors2;
                valid2 = valid2 || _valid0;
                if (!valid2) {
                  const err3 = { instancePath: instancePath + "/clientId", schemaPath: "#/$defs/DataAccessClientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err3];
                  } else {
                    vErrors.push(err3);
                  }
                  errors2++;
                  validate45.errors = vErrors;
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
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.generalReads !== void 0) {
                  const _errs12 = errors2;
                  if (typeof data.generalReads !== "boolean") {
                    validate45.errors = [{ instancePath: instancePath + "/generalReads", schemaPath: "#/properties/generalReads/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs12 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.families !== void 0) {
                    let data4 = data.families;
                    const _errs14 = errors2;
                    if (errors2 === _errs14) {
                      if (Array.isArray(data4)) {
                        if (data4.length > 256) {
                          validate45.errors = [{ instancePath: instancePath + "/families", schemaPath: "#/properties/families/maxItems", keyword: "maxItems", params: { limit: 256 }, message: "must NOT have more than 256 items" }];
                          return false;
                        } else {
                          var valid3 = true;
                          const len0 = data4.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            const _errs16 = errors2;
                            if (!validate34(data4[i0], { instancePath: instancePath + "/families/" + i0, parentData: data4, parentDataProperty: i0, rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
                              errors2 = vErrors.length;
                            }
                            var valid3 = _errs16 === errors2;
                            if (!valid3) {
                              break;
                            }
                          }
                        }
                      } else {
                        validate45.errors = [{ instancePath: instancePath + "/families", schemaPath: "#/properties/families/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs14 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.relations !== void 0) {
                      let data6 = data.relations;
                      const _errs17 = errors2;
                      if (errors2 === _errs17) {
                        if (Array.isArray(data6)) {
                          if (data6.length > 256) {
                            validate45.errors = [{ instancePath: instancePath + "/relations", schemaPath: "#/properties/relations/maxItems", keyword: "maxItems", params: { limit: 256 }, message: "must NOT have more than 256 items" }];
                            return false;
                          } else {
                            var valid4 = true;
                            const len1 = data6.length;
                            for (let i1 = 0; i1 < len1; i1++) {
                              const _errs19 = errors2;
                              if (!validate36(data6[i1], { instancePath: instancePath + "/relations/" + i1, parentData: data6, parentDataProperty: i1, rootData, dynamicAnchors })) {
                                vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
                                errors2 = vErrors.length;
                              }
                              var valid4 = _errs19 === errors2;
                              if (!valid4) {
                                break;
                              }
                            }
                          }
                        } else {
                          validate45.errors = [{ instancePath: instancePath + "/relations", schemaPath: "#/properties/relations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs17 === errors2;
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
      validate45.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate45.errors = vErrors;
  return errors2 === 0;
}
validate45.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateDataAccessErrorResponse = validate48;
var schema53 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "type": "string", "enum": ["INVALID_REQUEST", "UNAUTHENTICATED", "ACCESS_DENIED", "MEMBERSHIP_REVOKED", "NOT_FOUND", "METHOD_NOT_ALLOWED", "DEADLINE", "MEMBERSHIP_CHANGED", "REQUEST_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "CANCELLED", "PRODUCT_UNAVAILABLE", "DATA_ACCESS_REQUEST_INVALID", "DATA_ACCESS_CLIENT_REFUSED", "DATA_ACCESS_POLICY_UNAVAILABLE", "DATA_ACCESS_UNAVAILABLE"] }, "outcome": { "enum": ["NOT_DISPATCHED"] }, "field": { "type": "string", "pattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" } }, "required": ["code"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
var pattern12 = new RegExp("^[A-Za-z][A-Za-z0-9_.-]{0,127}$", "u");
function validate48(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate48.evaluated;
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
        validate48.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate48.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate48.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome" || key1 === "field")) {
                      validate48.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (typeof data1 !== "string") {
                        validate48.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data1 === "INVALID_REQUEST" || data1 === "UNAUTHENTICATED" || data1 === "ACCESS_DENIED" || data1 === "MEMBERSHIP_REVOKED" || data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "DEADLINE" || data1 === "MEMBERSHIP_CHANGED" || data1 === "REQUEST_TOO_LARGE" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "CANCELLED" || data1 === "PRODUCT_UNAVAILABLE" || data1 === "DATA_ACCESS_REQUEST_INVALID" || data1 === "DATA_ACCESS_CLIENT_REFUSED" || data1 === "DATA_ACCESS_POLICY_UNAVAILABLE" || data1 === "DATA_ACCESS_UNAVAILABLE")) {
                        validate48.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema53.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid1 = _errs5 === errors2;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        const _errs7 = errors2;
                        if (!(data0.outcome === "NOT_DISPATCHED")) {
                          validate48.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema53.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs7 === errors2;
                      } else {
                        var valid1 = true;
                      }
                      if (valid1) {
                        if (data0.field !== void 0) {
                          let data3 = data0.field;
                          const _errs8 = errors2;
                          if (errors2 === _errs8) {
                            if (typeof data3 === "string") {
                              if (!pattern12.test(data3)) {
                                validate48.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"' }];
                                return false;
                              }
                            } else {
                              validate48.errors = [{ instancePath: instancePath + "/error/field", schemaPath: "#/properties/error/properties/field/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs8 === errors2;
                        } else {
                          var valid1 = true;
                        }
                      }
                    }
                  }
                }
              } else {
                validate48.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate48.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate48.errors = vErrors;
  return errors2 === 0;
}
validate48.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validators = { DataAccessClientId: validateDataAccessClientId, DataAccessRequest: validateDataAccessRequest, DataAccessState: validateDataAccessState, DataAccessFamily: validateDataAccessFamily, DataAccessRelation: validateDataAccessRelation, DataAccessResponse: validateDataAccessResponse, DataAccessErrorResponse: validateDataAccessErrorResponse };

// data-access-application/schema.mjs
var DATA_ACCESS_SCHEMA_ID = "urn:meri:data-access-application:0.1.0";
var DATA_ACCESS_SCHEMA_VERSION = "meri.data-access/1";

// data-access-application/protocol.mjs
var dataAccessVersion = "0.1.0";
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var createDataAccessMetadata = ({ path, limits, errorStatuses, states, requirements }) => freeze({
  contractVersion: dataAccessVersion,
  schemaId: DATA_ACCESS_SCHEMA_ID,
  schemaVersion: DATA_ACCESS_SCHEMA_VERSION,
  routes: { read: { method: "POST", path, response: "json" } },
  authentication: { scheme: "Bearer", authority: "native session admitted by Core membership on every request; tenant, actor, role and clients come only from that admission, never from the body" },
  limits: { requestBytes: limits.maxRequestBytes, responseBytes: limits.maxResponseBytes, requestMs: limits.maxRequestMs, jsonDepth: 64, jsonNodes: 1e5 },
  errorStatuses,
  states,
  requirements,
  semantics: {
    read: "a read-only view over the registry of constructible read families, the control's installed read operations and the member's resolved capability policy (platform, tenant, role) for the named client or General; it reads no source and changes no policy",
    state: "not_installed: no operation of the family is in this installation; policy_off: the resolved policy does not admit the family or none of its installed operations is active; client_required: the family needs a selected client and the request named none; available: a run for this member would list the family (every gate still applies on each call)",
    requires: "mailbox means the family answers only through a mailbox connection the member owns; the caller reads their own connections to say whether one is connected",
    relations: "the relation names the describe path publishes; public relations follow the best SQL family state, client_records relations also need a selected client",
    correlation: "an answer is admitted only against the captured request: it describes the same client, lists each family and relation once, and its families are sorted"
  }
});

// data-access-generated:./generated-protocol.mjs
var dataAccessMetadata = createDataAccessMetadata({ "path": "/api/data-access/read", "limits": { "maxRequestMs": 3e4, "maxRequestBytes": 1024, "maxResponseBytes": 1048576 }, "errorStatuses": { "INVALID_REQUEST": 400, "UNAUTHENTICATED": 401, "ACCESS_DENIED": 403, "MEMBERSHIP_REVOKED": 403, "NOT_FOUND": 404, "METHOD_NOT_ALLOWED": 405, "DEADLINE": 408, "MEMBERSHIP_CHANGED": 409, "REQUEST_TOO_LARGE": 413, "UNSUPPORTED_MEDIA_TYPE": 415, "CANCELLED": 499, "PRODUCT_UNAVAILABLE": 502, "DATA_ACCESS_REQUEST_INVALID": 400, "DATA_ACCESS_CLIENT_REFUSED": 403, "DATA_ACCESS_POLICY_UNAVAILABLE": 503, "DATA_ACCESS_UNAVAILABLE": 503 }, "states": ["not_installed", "policy_off", "client_required", "available"], "requirements": ["mailbox"], "fieldPattern": "^[A-Za-z][A-Za-z0-9_.-]{0,127}$" });

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

// data-access-application/data-access-application-receiver.mjs
var DataAccessResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "DataAccessResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new DataAccessResponseError(code);
};
var freeze2 = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze2);
    Object.freeze(value);
  }
  return value;
};
function parseText(value, cap) {
  if (typeof value !== "string") fail2("DATA_ACCESS_JSON");
  if (value.length > cap) fail2("DATA_ACCESS_LIMIT");
  if (!value.isWellFormed()) fail2("DATA_ACCESS_JSON");
  try {
    return parseBytes(new TextEncoder().encode(value), cap);
  } catch (error) {
    fail2(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "DATA_ACCESS_LIMIT" : "DATA_ACCESS_JSON");
  }
}
var check = (name, value) => {
  if (!validators[name](value)) fail2("DATA_ACCESS_SHAPE");
  return value;
};
function receiveDataAccessRequest(jsonText) {
  return freeze2(check("DataAccessRequest", parseText(jsonText, dataAccessMetadata.limits.requestBytes)));
}
function receiveDataAccessResponse(httpStatus, jsonText, request) {
  if (!Number.isInteger(httpStatus)) fail2("DATA_ACCESS_STATUS");
  const expected = check("DataAccessRequest", parseText(JSON.stringify(request), dataAccessMetadata.limits.requestBytes));
  const value = parseText(jsonText, dataAccessMetadata.limits.responseBytes);
  if (httpStatus !== 200) {
    check("DataAccessErrorResponse", value);
    if (dataAccessMetadata.errorStatuses[value.error.code] !== httpStatus || httpStatus === 502 && Object.hasOwn(value.error, "field")) fail2("DATA_ACCESS_STATUS");
    return freeze2(value);
  }
  check("DataAccessResponse", value);
  if (value.clientId !== expected.clientId) fail2("DATA_ACCESS_CORRELATION");
  const families = value.families.map((row) => row.family);
  if (new Set(families).size !== families.length || families.some((family, index) => index > 0 && family <= families[index - 1])) fail2("DATA_ACCESS_CORRELATION");
  const relations = value.relations.map((row) => row.source + "/" + row.name);
  if (new Set(relations).size !== relations.length) fail2("DATA_ACCESS_CORRELATION");
  if (value.generalReads === false && [...value.families, ...value.relations].some((row) => row.state === "available" || row.state === "client_required")) fail2("DATA_ACCESS_CORRELATION");
  return freeze2(value);
}
export {
  DataAccessResponseError,
  dataAccessMetadata,
  dataAccessVersion,
  receiveDataAccessRequest,
  receiveDataAccessResponse
};
