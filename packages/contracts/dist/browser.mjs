// Generated; validation checks structure only.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
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
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
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

// generated-validator.mjs
var validateUIEvent = validate26;
var schema33 = { "oneOf": [{ "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "run.status" }, "data": { "type": "object", "properties": { "state": { "type": "string", "enum": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"] }, "reasonCode": { "anyOf": [{ "type": "string", "minLength": 1 }, { "type": "null" }] } }, "required": ["state", "reasonCode"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "message.delta" }, "data": { "type": "object", "properties": { "messageId": { "type": "string", "format": "uuid" }, "text": { "type": "string", "minLength": 1 } }, "required": ["messageId", "text"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "tool.started" }, "data": { "type": "object", "properties": { "requestId": { "type": "string", "format": "uuid" }, "tool": { "type": "string", "minLength": 1 } }, "required": ["requestId", "tool"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "tool.completed" }, "data": { "type": "object", "properties": { "requestId": { "type": "string", "format": "uuid" }, "resultReference": { "type": "string", "format": "uuid" } }, "required": ["requestId", "resultReference"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "source.available" }, "data": { "$ref": "#/$defs/SourceEvidence" } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "approval.required" }, "data": { "type": "object", "properties": { "proposalId": { "type": "string", "format": "uuid" }, "commandSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "expiresAt": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": ["proposalId", "commandSha256", "expiresAt"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "artifact.available" }, "data": { "type": "object", "properties": { "artifactId": { "type": "string", "format": "uuid" }, "versionId": { "type": "string", "format": "uuid" } }, "required": ["artifactId", "versionId"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "checkpoint.verified" }, "data": { "type": "object", "properties": { "checkpointId": { "type": "string", "format": "uuid" } }, "required": ["checkpointId"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "usage.recorded" }, "data": { "type": "object", "properties": { "usageId": { "type": "string", "format": "uuid" } }, "required": ["usageId"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }, { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "eventId": { "type": "string", "format": "uuid" }, "binding": { "$ref": "#/$defs/RunBinding" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "type": { "const": "run.error" }, "data": { "type": "object", "properties": { "code": { "type": "string", "minLength": 1 }, "retryable": { "type": "boolean" }, "message": { "type": "string", "minLength": 1 } }, "required": ["code", "retryable", "message"], "additionalProperties": false } }, "required": ["contractVersion", "eventId", "binding", "sequence", "createdAt", "scopes", "type", "data"], "additionalProperties": false }] };
var schema35 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats10 = require_formats().fullFormats["date-time"];
var func1 = require_ucs2length().default;
var func0 = require_equal().default;
var pattern4 = new RegExp("Z$", "u");
var pattern11 = new RegExp("^[a-f0-9]{64}$", "u");
var schema44 = { "type": "object", "properties": { "sourceId": { "type": "string", "minLength": 1 }, "recordId": { "type": "string", "minLength": 1 }, "sourceVersionId": { "type": "string", "minLength": 1 }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "sourceUpdatedAt": { "anyOf": [{ "type": "string", "format": "date-time", "pattern": "Z$" }, { "type": "null" }] }, "citationId": { "type": "string", "format": "uuid" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope" }, "minItems": 1, "uniqueItems": true }, "contentSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "authorizationDecisionId"], "additionalProperties": false };
var func59 = Object.prototype.hasOwnProperty;
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.sourceId === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sourceId" }, message: "must have required property 'sourceId'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.recordId === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "recordId" }, message: "must have required property 'recordId'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.sourceVersionId === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sourceVersionId" }, message: "must have required property 'sourceVersionId'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.observedAt === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "observedAt" }, message: "must have required property 'observedAt'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.sourceUpdatedAt === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sourceUpdatedAt" }, message: "must have required property 'sourceUpdatedAt'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.citationId === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "citationId" }, message: "must have required property 'citationId'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.scopes === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.contentSha256 === void 0) {
      const err7 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "contentSha256" }, message: "must have required property 'contentSha256'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.authorizationDecisionId === void 0) {
      const err8 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "authorizationDecisionId" }, message: "must have required property 'authorizationDecisionId'" };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func59.call(schema44.properties, key0)) {
        const err9 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.sourceId !== void 0) {
      let data0 = data.sourceId;
      if (typeof data0 === "string") {
        if (func1(data0) < 1) {
          const err10 = { instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.recordId !== void 0) {
      let data1 = data.recordId;
      if (typeof data1 === "string") {
        if (func1(data1) < 1) {
          const err12 = { instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.sourceVersionId !== void 0) {
      let data2 = data.sourceVersionId;
      if (typeof data2 === "string") {
        if (func1(data2) < 1) {
          const err14 = { instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.observedAt !== void 0) {
      let data3 = data.observedAt;
      if (typeof data3 === "string") {
        if (!pattern4.test(data3)) {
          const err16 = { instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (!formats10.validate(data3)) {
          const err17 = { instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.sourceUpdatedAt !== void 0) {
      let data4 = data.sourceUpdatedAt;
      const _errs11 = errors;
      let valid1 = false;
      const _errs12 = errors;
      if (typeof data4 === "string") {
        if (!pattern4.test(data4)) {
          const err19 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!formats10.validate(data4)) {
          const err20 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      var _valid0 = _errs12 === errors;
      valid1 = valid1 || _valid0;
      const _errs14 = errors;
      if (data4 !== null) {
        const err22 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
      var _valid0 = _errs14 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err23 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      } else {
        errors = _errs11;
        if (vErrors !== null) {
          if (_errs11) {
            vErrors.length = _errs11;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.citationId !== void 0) {
      let data5 = data.citationId;
      if (typeof data5 === "string") {
        if (!formats0.test(data5)) {
          const err24 = { instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      } else {
        const err25 = { instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.scopes !== void 0) {
      let data6 = data.scopes;
      if (Array.isArray(data6)) {
        if (data6.length < 1) {
          const err26 = { instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data7 = data6[i0];
          if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
            if (data7.tenantId === void 0) {
              const err27 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data7.kind === void 0) {
              const err28 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
            if (data7.resourceId === void 0) {
              const err29 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
              if (vErrors === null) {
                vErrors = [err29];
              } else {
                vErrors.push(err29);
              }
              errors++;
            }
            if (data7.policyRevision === void 0) {
              const err30 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
            for (const key1 in data7) {
              if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                const err31 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err31];
                } else {
                  vErrors.push(err31);
                }
                errors++;
              }
            }
            if (data7.tenantId !== void 0) {
              let data8 = data7.tenantId;
              if (typeof data8 === "string") {
                if (func1(data8) > 128) {
                  const err32 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
                if (func1(data8) < 1) {
                  const err33 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err33];
                  } else {
                    vErrors.push(err33);
                  }
                  errors++;
                }
              } else {
                const err34 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
            if (data7.kind !== void 0) {
              let data9 = data7.kind;
              if (typeof data9 !== "string") {
                const err35 = { instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
              }
              if (!(data9 === "tenant" || data9 === "client" || data9 === "mailbox" || data9 === "memory" || data9 === "document" || data9 === "private-user" || data9 === "public")) {
                const err36 = { instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors++;
              }
            }
            if (data7.resourceId !== void 0) {
              let data10 = data7.resourceId;
              if (typeof data10 === "string") {
                if (func1(data10) > 256) {
                  const err37 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                  if (vErrors === null) {
                    vErrors = [err37];
                  } else {
                    vErrors.push(err37);
                  }
                  errors++;
                }
                if (func1(data10) < 1) {
                  const err38 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err38];
                  } else {
                    vErrors.push(err38);
                  }
                  errors++;
                }
              } else {
                const err39 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            }
            if (data7.policyRevision !== void 0) {
              let data11 = data7.policyRevision;
              if (typeof data11 === "string") {
                if (func1(data11) > 128) {
                  const err40 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
                if (func1(data11) < 1) {
                  const err41 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err41];
                  } else {
                    vErrors.push(err41);
                  }
                  errors++;
                }
              } else {
                const err42 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err42];
                } else {
                  vErrors.push(err42);
                }
                errors++;
              }
            }
          } else {
            const err43 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        let i1 = data6.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--; ) {
            for (j0 = i1; j0--; ) {
              if (func0(data6[i1], data6[j0])) {
                const err44 = { instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err45 = { instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.contentSha256 !== void 0) {
      let data12 = data.contentSha256;
      if (typeof data12 === "string") {
        if (!pattern11.test(data12)) {
          const err46 = { instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
      } else {
        const err47 = { instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
    if (data.authorizationDecisionId !== void 0) {
      let data13 = data.authorizationDecisionId;
      if (typeof data13 === "string") {
        if (!formats0.test(data13)) {
          const err48 = { instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
      } else {
        const err49 = { instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
  } else {
    const err50 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err50];
    } else {
      vErrors.push(err50);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.contractVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.eventId === void 0) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.binding === void 0) {
      const err2 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.sequence === void 0) {
      const err3 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err4 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.scopes === void 0) {
      const err5 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.type === void 0) {
      const err6 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.data === void 0) {
      const err7 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "contractVersion" || key0 === "eventId" || key0 === "binding" || key0 === "sequence" || key0 === "createdAt" || key0 === "scopes" || key0 === "type" || key0 === "data")) {
        const err8 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.contractVersion !== void 0) {
      if ("0.1.0" !== data.contractVersion) {
        const err9 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/0/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.eventId !== void 0) {
      let data1 = data.eventId;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err10 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/0/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/0/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.binding !== void 0) {
      let data2 = data.binding;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.tenantId === void 0) {
          const err12 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (data2.actorId === void 0) {
          const err13 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (data2.conversationId === void 0) {
          const err14 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data2.runId === void 0) {
          const err15 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (data2.attemptId === void 0) {
          const err16 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (data2.workerId === void 0) {
          const err17 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (data2.writerFence === void 0) {
          const err18 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        for (const key1 in data2) {
          if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
            const err19 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        if (data2.tenantId !== void 0) {
          let data3 = data2.tenantId;
          if (typeof data3 === "string") {
            if (func1(data3) > 128) {
              const err20 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (func1(data3) < 1) {
              const err21 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
          } else {
            const err22 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data2.actorId !== void 0) {
          let data4 = data2.actorId;
          if (typeof data4 === "string") {
            if (func1(data4) > 128) {
              const err23 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
            if (func1(data4) < 1) {
              const err24 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
          } else {
            const err25 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data2.conversationId !== void 0) {
          let data5 = data2.conversationId;
          if (typeof data5 === "string") {
            if (!formats0.test(data5)) {
              const err26 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
          } else {
            const err27 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        if (data2.runId !== void 0) {
          let data6 = data2.runId;
          if (typeof data6 === "string") {
            if (!formats0.test(data6)) {
              const err28 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          } else {
            const err29 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data2.attemptId !== void 0) {
          let data7 = data2.attemptId;
          if (typeof data7 === "string") {
            if (!formats0.test(data7)) {
              const err30 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
          } else {
            const err31 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
        }
        if (data2.workerId !== void 0) {
          let data8 = data2.workerId;
          if (typeof data8 === "string") {
            if (!formats0.test(data8)) {
              const err32 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
          } else {
            const err33 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data2.writerFence !== void 0) {
          let data9 = data2.writerFence;
          if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
            const err34 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
          if (typeof data9 == "number" && isFinite(data9)) {
            if (data9 > 9007199254740991 || isNaN(data9)) {
              const err35 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
            if (data9 < 1 || isNaN(data9)) {
              const err36 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
          }
        }
      } else {
        const err37 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.sequence !== void 0) {
      let data10 = data.sequence;
      if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
        const err38 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/0/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      if (typeof data10 == "number" && isFinite(data10)) {
        if (data10 > 9007199254740991 || isNaN(data10)) {
          const err39 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/0/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (data10 < 1 || isNaN(data10)) {
          const err40 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/0/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
      }
    }
    if (data.createdAt !== void 0) {
      let data11 = data.createdAt;
      if (typeof data11 === "string") {
        if (!pattern4.test(data11)) {
          const err41 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/0/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        if (!formats10.validate(data11)) {
          const err42 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/0/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
      } else {
        const err43 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/0/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.scopes !== void 0) {
      let data12 = data.scopes;
      if (Array.isArray(data12)) {
        if (data12.length < 1) {
          const err44 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/0/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        const len0 = data12.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data13 = data12[i0];
          if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
            if (data13.tenantId === void 0) {
              const err45 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            if (data13.kind === void 0) {
              const err46 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
            if (data13.resourceId === void 0) {
              const err47 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
              if (vErrors === null) {
                vErrors = [err47];
              } else {
                vErrors.push(err47);
              }
              errors++;
            }
            if (data13.policyRevision === void 0) {
              const err48 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
            for (const key2 in data13) {
              if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                const err49 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err49];
                } else {
                  vErrors.push(err49);
                }
                errors++;
              }
            }
            if (data13.tenantId !== void 0) {
              let data14 = data13.tenantId;
              if (typeof data14 === "string") {
                if (func1(data14) > 128) {
                  const err50 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
                if (func1(data14) < 1) {
                  const err51 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err51];
                  } else {
                    vErrors.push(err51);
                  }
                  errors++;
                }
              } else {
                const err52 = { instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err52];
                } else {
                  vErrors.push(err52);
                }
                errors++;
              }
            }
            if (data13.kind !== void 0) {
              let data15 = data13.kind;
              if (typeof data15 !== "string") {
                const err53 = { instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err53];
                } else {
                  vErrors.push(err53);
                }
                errors++;
              }
              if (!(data15 === "tenant" || data15 === "client" || data15 === "mailbox" || data15 === "memory" || data15 === "document" || data15 === "private-user" || data15 === "public")) {
                const err54 = { instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
              }
            }
            if (data13.resourceId !== void 0) {
              let data16 = data13.resourceId;
              if (typeof data16 === "string") {
                if (func1(data16) > 256) {
                  const err55 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
                if (func1(data16) < 1) {
                  const err56 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
              } else {
                const err57 = { instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err57];
                } else {
                  vErrors.push(err57);
                }
                errors++;
              }
            }
            if (data13.policyRevision !== void 0) {
              let data17 = data13.policyRevision;
              if (typeof data17 === "string") {
                if (func1(data17) > 128) {
                  const err58 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
                if (func1(data17) < 1) {
                  const err59 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                }
              } else {
                const err60 = { instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err60];
                } else {
                  vErrors.push(err60);
                }
                errors++;
              }
            }
          } else {
            const err61 = { instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err61];
            } else {
              vErrors.push(err61);
            }
            errors++;
          }
        }
        let i1 = data12.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--; ) {
            for (j0 = i1; j0--; ) {
              if (func0(data12[i1], data12[j0])) {
                const err62 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/0/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err62];
                } else {
                  vErrors.push(err62);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err63 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/0/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err63];
        } else {
          vErrors.push(err63);
        }
        errors++;
      }
    }
    if (data.type !== void 0) {
      if ("run.status" !== data.type) {
        const err64 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/0/properties/type/const", keyword: "const", params: { allowedValue: "run.status" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err64];
        } else {
          vErrors.push(err64);
        }
        errors++;
      }
    }
    if (data.data !== void 0) {
      let data19 = data.data;
      if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
        if (data19.state === void 0) {
          const err65 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/0/properties/data/required", keyword: "required", params: { missingProperty: "state" }, message: "must have required property 'state'" };
          if (vErrors === null) {
            vErrors = [err65];
          } else {
            vErrors.push(err65);
          }
          errors++;
        }
        if (data19.reasonCode === void 0) {
          const err66 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/0/properties/data/required", keyword: "required", params: { missingProperty: "reasonCode" }, message: "must have required property 'reasonCode'" };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        for (const key3 in data19) {
          if (!(key3 === "state" || key3 === "reasonCode")) {
            const err67 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/0/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err67];
            } else {
              vErrors.push(err67);
            }
            errors++;
          }
        }
        if (data19.state !== void 0) {
          let data20 = data19.state;
          if (typeof data20 !== "string") {
            const err68 = { instancePath: instancePath + "/data/state", schemaPath: "#/oneOf/0/properties/data/properties/state/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
          if (!(data20 === "queued" || data20 === "starting" || data20 === "running" || data20 === "waiting-for-approval" || data20 === "paused" || data20 === "completed" || data20 === "failed" || data20 === "cancelled")) {
            const err69 = { instancePath: instancePath + "/data/state", schemaPath: "#/oneOf/0/properties/data/properties/state/enum", keyword: "enum", params: { allowedValues: schema33.oneOf[0].properties.data.properties.state.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err69];
            } else {
              vErrors.push(err69);
            }
            errors++;
          }
        }
        if (data19.reasonCode !== void 0) {
          let data21 = data19.reasonCode;
          const _errs50 = errors;
          let valid10 = false;
          const _errs51 = errors;
          if (typeof data21 === "string") {
            if (func1(data21) < 1) {
              const err70 = { instancePath: instancePath + "/data/reasonCode", schemaPath: "#/oneOf/0/properties/data/properties/reasonCode/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err70];
              } else {
                vErrors.push(err70);
              }
              errors++;
            }
          } else {
            const err71 = { instancePath: instancePath + "/data/reasonCode", schemaPath: "#/oneOf/0/properties/data/properties/reasonCode/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err71];
            } else {
              vErrors.push(err71);
            }
            errors++;
          }
          var _valid1 = _errs51 === errors;
          valid10 = valid10 || _valid1;
          const _errs53 = errors;
          if (data21 !== null) {
            const err72 = { instancePath: instancePath + "/data/reasonCode", schemaPath: "#/oneOf/0/properties/data/properties/reasonCode/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
          var _valid1 = _errs53 === errors;
          valid10 = valid10 || _valid1;
          if (!valid10) {
            const err73 = { instancePath: instancePath + "/data/reasonCode", schemaPath: "#/oneOf/0/properties/data/properties/reasonCode/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          } else {
            errors = _errs50;
            if (vErrors !== null) {
              if (_errs50) {
                vErrors.length = _errs50;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err74 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/0/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
  } else {
    const err75 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err75];
    } else {
      vErrors.push(err75);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs55 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.contractVersion === void 0) {
      const err76 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
      if (vErrors === null) {
        vErrors = [err76];
      } else {
        vErrors.push(err76);
      }
      errors++;
    }
    if (data.eventId === void 0) {
      const err77 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
      if (vErrors === null) {
        vErrors = [err77];
      } else {
        vErrors.push(err77);
      }
      errors++;
    }
    if (data.binding === void 0) {
      const err78 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
      if (vErrors === null) {
        vErrors = [err78];
      } else {
        vErrors.push(err78);
      }
      errors++;
    }
    if (data.sequence === void 0) {
      const err79 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
      if (vErrors === null) {
        vErrors = [err79];
      } else {
        vErrors.push(err79);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err80 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
      if (vErrors === null) {
        vErrors = [err80];
      } else {
        vErrors.push(err80);
      }
      errors++;
    }
    if (data.scopes === void 0) {
      const err81 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
      if (vErrors === null) {
        vErrors = [err81];
      } else {
        vErrors.push(err81);
      }
      errors++;
    }
    if (data.type === void 0) {
      const err82 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err82];
      } else {
        vErrors.push(err82);
      }
      errors++;
    }
    if (data.data === void 0) {
      const err83 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
      if (vErrors === null) {
        vErrors = [err83];
      } else {
        vErrors.push(err83);
      }
      errors++;
    }
    for (const key4 in data) {
      if (!(key4 === "contractVersion" || key4 === "eventId" || key4 === "binding" || key4 === "sequence" || key4 === "createdAt" || key4 === "scopes" || key4 === "type" || key4 === "data")) {
        const err84 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err84];
        } else {
          vErrors.push(err84);
        }
        errors++;
      }
    }
    if (data.contractVersion !== void 0) {
      if ("0.1.0" !== data.contractVersion) {
        const err85 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/1/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err85];
        } else {
          vErrors.push(err85);
        }
        errors++;
      }
    }
    if (data.eventId !== void 0) {
      let data23 = data.eventId;
      if (typeof data23 === "string") {
        if (!formats0.test(data23)) {
          const err86 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/1/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
          if (vErrors === null) {
            vErrors = [err86];
          } else {
            vErrors.push(err86);
          }
          errors++;
        }
      } else {
        const err87 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/1/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err87];
        } else {
          vErrors.push(err87);
        }
        errors++;
      }
    }
    if (data.binding !== void 0) {
      let data24 = data.binding;
      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
        if (data24.tenantId === void 0) {
          const err88 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
          if (vErrors === null) {
            vErrors = [err88];
          } else {
            vErrors.push(err88);
          }
          errors++;
        }
        if (data24.actorId === void 0) {
          const err89 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data24.conversationId === void 0) {
          const err90 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data24.runId === void 0) {
          const err91 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data24.attemptId === void 0) {
          const err92 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        if (data24.workerId === void 0) {
          const err93 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
          if (vErrors === null) {
            vErrors = [err93];
          } else {
            vErrors.push(err93);
          }
          errors++;
        }
        if (data24.writerFence === void 0) {
          const err94 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
          if (vErrors === null) {
            vErrors = [err94];
          } else {
            vErrors.push(err94);
          }
          errors++;
        }
        for (const key5 in data24) {
          if (!(key5 === "tenantId" || key5 === "actorId" || key5 === "conversationId" || key5 === "runId" || key5 === "attemptId" || key5 === "workerId" || key5 === "writerFence")) {
            const err95 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data24.tenantId !== void 0) {
          let data25 = data24.tenantId;
          if (typeof data25 === "string") {
            if (func1(data25) > 128) {
              const err96 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
              if (vErrors === null) {
                vErrors = [err96];
              } else {
                vErrors.push(err96);
              }
              errors++;
            }
            if (func1(data25) < 1) {
              const err97 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err97];
              } else {
                vErrors.push(err97);
              }
              errors++;
            }
          } else {
            const err98 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err98];
            } else {
              vErrors.push(err98);
            }
            errors++;
          }
        }
        if (data24.actorId !== void 0) {
          let data26 = data24.actorId;
          if (typeof data26 === "string") {
            if (func1(data26) > 128) {
              const err99 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
              if (vErrors === null) {
                vErrors = [err99];
              } else {
                vErrors.push(err99);
              }
              errors++;
            }
            if (func1(data26) < 1) {
              const err100 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err100];
              } else {
                vErrors.push(err100);
              }
              errors++;
            }
          } else {
            const err101 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err101];
            } else {
              vErrors.push(err101);
            }
            errors++;
          }
        }
        if (data24.conversationId !== void 0) {
          let data27 = data24.conversationId;
          if (typeof data27 === "string") {
            if (!formats0.test(data27)) {
              const err102 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err102];
              } else {
                vErrors.push(err102);
              }
              errors++;
            }
          } else {
            const err103 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err103];
            } else {
              vErrors.push(err103);
            }
            errors++;
          }
        }
        if (data24.runId !== void 0) {
          let data28 = data24.runId;
          if (typeof data28 === "string") {
            if (!formats0.test(data28)) {
              const err104 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err104];
              } else {
                vErrors.push(err104);
              }
              errors++;
            }
          } else {
            const err105 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err105];
            } else {
              vErrors.push(err105);
            }
            errors++;
          }
        }
        if (data24.attemptId !== void 0) {
          let data29 = data24.attemptId;
          if (typeof data29 === "string") {
            if (!formats0.test(data29)) {
              const err106 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err106];
              } else {
                vErrors.push(err106);
              }
              errors++;
            }
          } else {
            const err107 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err107];
            } else {
              vErrors.push(err107);
            }
            errors++;
          }
        }
        if (data24.workerId !== void 0) {
          let data30 = data24.workerId;
          if (typeof data30 === "string") {
            if (!formats0.test(data30)) {
              const err108 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err108];
              } else {
                vErrors.push(err108);
              }
              errors++;
            }
          } else {
            const err109 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err109];
            } else {
              vErrors.push(err109);
            }
            errors++;
          }
        }
        if (data24.writerFence !== void 0) {
          let data31 = data24.writerFence;
          if (!(typeof data31 == "number" && (!(data31 % 1) && !isNaN(data31)) && isFinite(data31))) {
            const err110 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err110];
            } else {
              vErrors.push(err110);
            }
            errors++;
          }
          if (typeof data31 == "number" && isFinite(data31)) {
            if (data31 > 9007199254740991 || isNaN(data31)) {
              const err111 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
              if (vErrors === null) {
                vErrors = [err111];
              } else {
                vErrors.push(err111);
              }
              errors++;
            }
            if (data31 < 1 || isNaN(data31)) {
              const err112 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
              if (vErrors === null) {
                vErrors = [err112];
              } else {
                vErrors.push(err112);
              }
              errors++;
            }
          }
        }
      } else {
        const err113 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err113];
        } else {
          vErrors.push(err113);
        }
        errors++;
      }
    }
    if (data.sequence !== void 0) {
      let data32 = data.sequence;
      if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
        const err114 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/1/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err114];
        } else {
          vErrors.push(err114);
        }
        errors++;
      }
      if (typeof data32 == "number" && isFinite(data32)) {
        if (data32 > 9007199254740991 || isNaN(data32)) {
          const err115 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/1/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
          if (vErrors === null) {
            vErrors = [err115];
          } else {
            vErrors.push(err115);
          }
          errors++;
        }
        if (data32 < 1 || isNaN(data32)) {
          const err116 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/1/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err116];
          } else {
            vErrors.push(err116);
          }
          errors++;
        }
      }
    }
    if (data.createdAt !== void 0) {
      let data33 = data.createdAt;
      if (typeof data33 === "string") {
        if (!pattern4.test(data33)) {
          const err117 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/1/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
          if (vErrors === null) {
            vErrors = [err117];
          } else {
            vErrors.push(err117);
          }
          errors++;
        }
        if (!formats10.validate(data33)) {
          const err118 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/1/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err118];
          } else {
            vErrors.push(err118);
          }
          errors++;
        }
      } else {
        const err119 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/1/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err119];
        } else {
          vErrors.push(err119);
        }
        errors++;
      }
    }
    if (data.scopes !== void 0) {
      let data34 = data.scopes;
      if (Array.isArray(data34)) {
        if (data34.length < 1) {
          const err120 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/1/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err120];
          } else {
            vErrors.push(err120);
          }
          errors++;
        }
        const len1 = data34.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data35 = data34[i2];
          if (data35 && typeof data35 == "object" && !Array.isArray(data35)) {
            if (data35.tenantId === void 0) {
              const err121 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
              if (vErrors === null) {
                vErrors = [err121];
              } else {
                vErrors.push(err121);
              }
              errors++;
            }
            if (data35.kind === void 0) {
              const err122 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
              if (vErrors === null) {
                vErrors = [err122];
              } else {
                vErrors.push(err122);
              }
              errors++;
            }
            if (data35.resourceId === void 0) {
              const err123 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
              if (vErrors === null) {
                vErrors = [err123];
              } else {
                vErrors.push(err123);
              }
              errors++;
            }
            if (data35.policyRevision === void 0) {
              const err124 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
              if (vErrors === null) {
                vErrors = [err124];
              } else {
                vErrors.push(err124);
              }
              errors++;
            }
            for (const key6 in data35) {
              if (!(key6 === "tenantId" || key6 === "kind" || key6 === "resourceId" || key6 === "policyRevision")) {
                const err125 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err125];
                } else {
                  vErrors.push(err125);
                }
                errors++;
              }
            }
            if (data35.tenantId !== void 0) {
              let data36 = data35.tenantId;
              if (typeof data36 === "string") {
                if (func1(data36) > 128) {
                  const err126 = { instancePath: instancePath + "/scopes/" + i2 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err126];
                  } else {
                    vErrors.push(err126);
                  }
                  errors++;
                }
                if (func1(data36) < 1) {
                  const err127 = { instancePath: instancePath + "/scopes/" + i2 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err127];
                  } else {
                    vErrors.push(err127);
                  }
                  errors++;
                }
              } else {
                const err128 = { instancePath: instancePath + "/scopes/" + i2 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err128];
                } else {
                  vErrors.push(err128);
                }
                errors++;
              }
            }
            if (data35.kind !== void 0) {
              let data37 = data35.kind;
              if (typeof data37 !== "string") {
                const err129 = { instancePath: instancePath + "/scopes/" + i2 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err129];
                } else {
                  vErrors.push(err129);
                }
                errors++;
              }
              if (!(data37 === "tenant" || data37 === "client" || data37 === "mailbox" || data37 === "memory" || data37 === "document" || data37 === "private-user" || data37 === "public")) {
                const err130 = { instancePath: instancePath + "/scopes/" + i2 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err130];
                } else {
                  vErrors.push(err130);
                }
                errors++;
              }
            }
            if (data35.resourceId !== void 0) {
              let data38 = data35.resourceId;
              if (typeof data38 === "string") {
                if (func1(data38) > 256) {
                  const err131 = { instancePath: instancePath + "/scopes/" + i2 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                  if (vErrors === null) {
                    vErrors = [err131];
                  } else {
                    vErrors.push(err131);
                  }
                  errors++;
                }
                if (func1(data38) < 1) {
                  const err132 = { instancePath: instancePath + "/scopes/" + i2 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err132];
                  } else {
                    vErrors.push(err132);
                  }
                  errors++;
                }
              } else {
                const err133 = { instancePath: instancePath + "/scopes/" + i2 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err133];
                } else {
                  vErrors.push(err133);
                }
                errors++;
              }
            }
            if (data35.policyRevision !== void 0) {
              let data39 = data35.policyRevision;
              if (typeof data39 === "string") {
                if (func1(data39) > 128) {
                  const err134 = { instancePath: instancePath + "/scopes/" + i2 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err134];
                  } else {
                    vErrors.push(err134);
                  }
                  errors++;
                }
                if (func1(data39) < 1) {
                  const err135 = { instancePath: instancePath + "/scopes/" + i2 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err135];
                  } else {
                    vErrors.push(err135);
                  }
                  errors++;
                }
              } else {
                const err136 = { instancePath: instancePath + "/scopes/" + i2 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err136];
                } else {
                  vErrors.push(err136);
                }
                errors++;
              }
            }
          } else {
            const err137 = { instancePath: instancePath + "/scopes/" + i2, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err137];
            } else {
              vErrors.push(err137);
            }
            errors++;
          }
        }
        let i3 = data34.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--; ) {
            for (j1 = i3; j1--; ) {
              if (func0(data34[i3], data34[j1])) {
                const err138 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/1/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err138];
                } else {
                  vErrors.push(err138);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err139 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/1/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err139];
        } else {
          vErrors.push(err139);
        }
        errors++;
      }
    }
    if (data.type !== void 0) {
      if ("message.delta" !== data.type) {
        const err140 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/1/properties/type/const", keyword: "const", params: { allowedValue: "message.delta" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err140];
        } else {
          vErrors.push(err140);
        }
        errors++;
      }
    }
    if (data.data !== void 0) {
      let data41 = data.data;
      if (data41 && typeof data41 == "object" && !Array.isArray(data41)) {
        if (data41.messageId === void 0) {
          const err141 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/1/properties/data/required", keyword: "required", params: { missingProperty: "messageId" }, message: "must have required property 'messageId'" };
          if (vErrors === null) {
            vErrors = [err141];
          } else {
            vErrors.push(err141);
          }
          errors++;
        }
        if (data41.text === void 0) {
          const err142 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/1/properties/data/required", keyword: "required", params: { missingProperty: "text" }, message: "must have required property 'text'" };
          if (vErrors === null) {
            vErrors = [err142];
          } else {
            vErrors.push(err142);
          }
          errors++;
        }
        for (const key7 in data41) {
          if (!(key7 === "messageId" || key7 === "text")) {
            const err143 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/1/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err143];
            } else {
              vErrors.push(err143);
            }
            errors++;
          }
        }
        if (data41.messageId !== void 0) {
          let data42 = data41.messageId;
          if (typeof data42 === "string") {
            if (!formats0.test(data42)) {
              const err144 = { instancePath: instancePath + "/data/messageId", schemaPath: "#/oneOf/1/properties/data/properties/messageId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err144];
              } else {
                vErrors.push(err144);
              }
              errors++;
            }
          } else {
            const err145 = { instancePath: instancePath + "/data/messageId", schemaPath: "#/oneOf/1/properties/data/properties/messageId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err145];
            } else {
              vErrors.push(err145);
            }
            errors++;
          }
        }
        if (data41.text !== void 0) {
          let data43 = data41.text;
          if (typeof data43 === "string") {
            if (func1(data43) < 1) {
              const err146 = { instancePath: instancePath + "/data/text", schemaPath: "#/oneOf/1/properties/data/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err146];
              } else {
                vErrors.push(err146);
              }
              errors++;
            }
          } else {
            const err147 = { instancePath: instancePath + "/data/text", schemaPath: "#/oneOf/1/properties/data/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err147];
            } else {
              vErrors.push(err147);
            }
            errors++;
          }
        }
      } else {
        const err148 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/1/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err148];
        } else {
          vErrors.push(err148);
        }
        errors++;
      }
    }
  } else {
    const err149 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err149];
    } else {
      vErrors.push(err149);
    }
    errors++;
  }
  var _valid0 = _errs55 === errors;
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
    const _errs105 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.contractVersion === void 0) {
        const err150 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
        if (vErrors === null) {
          vErrors = [err150];
        } else {
          vErrors.push(err150);
        }
        errors++;
      }
      if (data.eventId === void 0) {
        const err151 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
        if (vErrors === null) {
          vErrors = [err151];
        } else {
          vErrors.push(err151);
        }
        errors++;
      }
      if (data.binding === void 0) {
        const err152 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
        if (vErrors === null) {
          vErrors = [err152];
        } else {
          vErrors.push(err152);
        }
        errors++;
      }
      if (data.sequence === void 0) {
        const err153 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
        if (vErrors === null) {
          vErrors = [err153];
        } else {
          vErrors.push(err153);
        }
        errors++;
      }
      if (data.createdAt === void 0) {
        const err154 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
        if (vErrors === null) {
          vErrors = [err154];
        } else {
          vErrors.push(err154);
        }
        errors++;
      }
      if (data.scopes === void 0) {
        const err155 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
        if (vErrors === null) {
          vErrors = [err155];
        } else {
          vErrors.push(err155);
        }
        errors++;
      }
      if (data.type === void 0) {
        const err156 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
        if (vErrors === null) {
          vErrors = [err156];
        } else {
          vErrors.push(err156);
        }
        errors++;
      }
      if (data.data === void 0) {
        const err157 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
        if (vErrors === null) {
          vErrors = [err157];
        } else {
          vErrors.push(err157);
        }
        errors++;
      }
      for (const key8 in data) {
        if (!(key8 === "contractVersion" || key8 === "eventId" || key8 === "binding" || key8 === "sequence" || key8 === "createdAt" || key8 === "scopes" || key8 === "type" || key8 === "data")) {
          const err158 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err158];
          } else {
            vErrors.push(err158);
          }
          errors++;
        }
      }
      if (data.contractVersion !== void 0) {
        if ("0.1.0" !== data.contractVersion) {
          const err159 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/2/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err159];
          } else {
            vErrors.push(err159);
          }
          errors++;
        }
      }
      if (data.eventId !== void 0) {
        let data45 = data.eventId;
        if (typeof data45 === "string") {
          if (!formats0.test(data45)) {
            const err160 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/2/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
            if (vErrors === null) {
              vErrors = [err160];
            } else {
              vErrors.push(err160);
            }
            errors++;
          }
        } else {
          const err161 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/2/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
          if (vErrors === null) {
            vErrors = [err161];
          } else {
            vErrors.push(err161);
          }
          errors++;
        }
      }
      if (data.binding !== void 0) {
        let data46 = data.binding;
        if (data46 && typeof data46 == "object" && !Array.isArray(data46)) {
          if (data46.tenantId === void 0) {
            const err162 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
            if (vErrors === null) {
              vErrors = [err162];
            } else {
              vErrors.push(err162);
            }
            errors++;
          }
          if (data46.actorId === void 0) {
            const err163 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
            if (vErrors === null) {
              vErrors = [err163];
            } else {
              vErrors.push(err163);
            }
            errors++;
          }
          if (data46.conversationId === void 0) {
            const err164 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
            if (vErrors === null) {
              vErrors = [err164];
            } else {
              vErrors.push(err164);
            }
            errors++;
          }
          if (data46.runId === void 0) {
            const err165 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
            if (vErrors === null) {
              vErrors = [err165];
            } else {
              vErrors.push(err165);
            }
            errors++;
          }
          if (data46.attemptId === void 0) {
            const err166 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
            if (vErrors === null) {
              vErrors = [err166];
            } else {
              vErrors.push(err166);
            }
            errors++;
          }
          if (data46.workerId === void 0) {
            const err167 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
            if (vErrors === null) {
              vErrors = [err167];
            } else {
              vErrors.push(err167);
            }
            errors++;
          }
          if (data46.writerFence === void 0) {
            const err168 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
            if (vErrors === null) {
              vErrors = [err168];
            } else {
              vErrors.push(err168);
            }
            errors++;
          }
          for (const key9 in data46) {
            if (!(key9 === "tenantId" || key9 === "actorId" || key9 === "conversationId" || key9 === "runId" || key9 === "attemptId" || key9 === "workerId" || key9 === "writerFence")) {
              const err169 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err169];
              } else {
                vErrors.push(err169);
              }
              errors++;
            }
          }
          if (data46.tenantId !== void 0) {
            let data47 = data46.tenantId;
            if (typeof data47 === "string") {
              if (func1(data47) > 128) {
                const err170 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                if (vErrors === null) {
                  vErrors = [err170];
                } else {
                  vErrors.push(err170);
                }
                errors++;
              }
              if (func1(data47) < 1) {
                const err171 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                if (vErrors === null) {
                  vErrors = [err171];
                } else {
                  vErrors.push(err171);
                }
                errors++;
              }
            } else {
              const err172 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err172];
              } else {
                vErrors.push(err172);
              }
              errors++;
            }
          }
          if (data46.actorId !== void 0) {
            let data48 = data46.actorId;
            if (typeof data48 === "string") {
              if (func1(data48) > 128) {
                const err173 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                if (vErrors === null) {
                  vErrors = [err173];
                } else {
                  vErrors.push(err173);
                }
                errors++;
              }
              if (func1(data48) < 1) {
                const err174 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                if (vErrors === null) {
                  vErrors = [err174];
                } else {
                  vErrors.push(err174);
                }
                errors++;
              }
            } else {
              const err175 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err175];
              } else {
                vErrors.push(err175);
              }
              errors++;
            }
          }
          if (data46.conversationId !== void 0) {
            let data49 = data46.conversationId;
            if (typeof data49 === "string") {
              if (!formats0.test(data49)) {
                const err176 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err176];
                } else {
                  vErrors.push(err176);
                }
                errors++;
              }
            } else {
              const err177 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err177];
              } else {
                vErrors.push(err177);
              }
              errors++;
            }
          }
          if (data46.runId !== void 0) {
            let data50 = data46.runId;
            if (typeof data50 === "string") {
              if (!formats0.test(data50)) {
                const err178 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err178];
                } else {
                  vErrors.push(err178);
                }
                errors++;
              }
            } else {
              const err179 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err179];
              } else {
                vErrors.push(err179);
              }
              errors++;
            }
          }
          if (data46.attemptId !== void 0) {
            let data51 = data46.attemptId;
            if (typeof data51 === "string") {
              if (!formats0.test(data51)) {
                const err180 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err180];
                } else {
                  vErrors.push(err180);
                }
                errors++;
              }
            } else {
              const err181 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err181];
              } else {
                vErrors.push(err181);
              }
              errors++;
            }
          }
          if (data46.workerId !== void 0) {
            let data52 = data46.workerId;
            if (typeof data52 === "string") {
              if (!formats0.test(data52)) {
                const err182 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err182];
                } else {
                  vErrors.push(err182);
                }
                errors++;
              }
            } else {
              const err183 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err183];
              } else {
                vErrors.push(err183);
              }
              errors++;
            }
          }
          if (data46.writerFence !== void 0) {
            let data53 = data46.writerFence;
            if (!(typeof data53 == "number" && (!(data53 % 1) && !isNaN(data53)) && isFinite(data53))) {
              const err184 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
              if (vErrors === null) {
                vErrors = [err184];
              } else {
                vErrors.push(err184);
              }
              errors++;
            }
            if (typeof data53 == "number" && isFinite(data53)) {
              if (data53 > 9007199254740991 || isNaN(data53)) {
                const err185 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                if (vErrors === null) {
                  vErrors = [err185];
                } else {
                  vErrors.push(err185);
                }
                errors++;
              }
              if (data53 < 1 || isNaN(data53)) {
                const err186 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                if (vErrors === null) {
                  vErrors = [err186];
                } else {
                  vErrors.push(err186);
                }
                errors++;
              }
            }
          }
        } else {
          const err187 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err187];
          } else {
            vErrors.push(err187);
          }
          errors++;
        }
      }
      if (data.sequence !== void 0) {
        let data54 = data.sequence;
        if (!(typeof data54 == "number" && (!(data54 % 1) && !isNaN(data54)) && isFinite(data54))) {
          const err188 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/2/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
          if (vErrors === null) {
            vErrors = [err188];
          } else {
            vErrors.push(err188);
          }
          errors++;
        }
        if (typeof data54 == "number" && isFinite(data54)) {
          if (data54 > 9007199254740991 || isNaN(data54)) {
            const err189 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/2/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
            if (vErrors === null) {
              vErrors = [err189];
            } else {
              vErrors.push(err189);
            }
            errors++;
          }
          if (data54 < 1 || isNaN(data54)) {
            const err190 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/2/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
            if (vErrors === null) {
              vErrors = [err190];
            } else {
              vErrors.push(err190);
            }
            errors++;
          }
        }
      }
      if (data.createdAt !== void 0) {
        let data55 = data.createdAt;
        if (typeof data55 === "string") {
          if (!pattern4.test(data55)) {
            const err191 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/2/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
            if (vErrors === null) {
              vErrors = [err191];
            } else {
              vErrors.push(err191);
            }
            errors++;
          }
          if (!formats10.validate(data55)) {
            const err192 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/2/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
            if (vErrors === null) {
              vErrors = [err192];
            } else {
              vErrors.push(err192);
            }
            errors++;
          }
        } else {
          const err193 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/2/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
          if (vErrors === null) {
            vErrors = [err193];
          } else {
            vErrors.push(err193);
          }
          errors++;
        }
      }
      if (data.scopes !== void 0) {
        let data56 = data.scopes;
        if (Array.isArray(data56)) {
          if (data56.length < 1) {
            const err194 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/2/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
            if (vErrors === null) {
              vErrors = [err194];
            } else {
              vErrors.push(err194);
            }
            errors++;
          }
          const len2 = data56.length;
          for (let i4 = 0; i4 < len2; i4++) {
            let data57 = data56[i4];
            if (data57 && typeof data57 == "object" && !Array.isArray(data57)) {
              if (data57.tenantId === void 0) {
                const err195 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                if (vErrors === null) {
                  vErrors = [err195];
                } else {
                  vErrors.push(err195);
                }
                errors++;
              }
              if (data57.kind === void 0) {
                const err196 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                if (vErrors === null) {
                  vErrors = [err196];
                } else {
                  vErrors.push(err196);
                }
                errors++;
              }
              if (data57.resourceId === void 0) {
                const err197 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                if (vErrors === null) {
                  vErrors = [err197];
                } else {
                  vErrors.push(err197);
                }
                errors++;
              }
              if (data57.policyRevision === void 0) {
                const err198 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                if (vErrors === null) {
                  vErrors = [err198];
                } else {
                  vErrors.push(err198);
                }
                errors++;
              }
              for (const key10 in data57) {
                if (!(key10 === "tenantId" || key10 === "kind" || key10 === "resourceId" || key10 === "policyRevision")) {
                  const err199 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                  if (vErrors === null) {
                    vErrors = [err199];
                  } else {
                    vErrors.push(err199);
                  }
                  errors++;
                }
              }
              if (data57.tenantId !== void 0) {
                let data58 = data57.tenantId;
                if (typeof data58 === "string") {
                  if (func1(data58) > 128) {
                    const err200 = { instancePath: instancePath + "/scopes/" + i4 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                    if (vErrors === null) {
                      vErrors = [err200];
                    } else {
                      vErrors.push(err200);
                    }
                    errors++;
                  }
                  if (func1(data58) < 1) {
                    const err201 = { instancePath: instancePath + "/scopes/" + i4 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err201];
                    } else {
                      vErrors.push(err201);
                    }
                    errors++;
                  }
                } else {
                  const err202 = { instancePath: instancePath + "/scopes/" + i4 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err202];
                  } else {
                    vErrors.push(err202);
                  }
                  errors++;
                }
              }
              if (data57.kind !== void 0) {
                let data59 = data57.kind;
                if (typeof data59 !== "string") {
                  const err203 = { instancePath: instancePath + "/scopes/" + i4 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err203];
                  } else {
                    vErrors.push(err203);
                  }
                  errors++;
                }
                if (!(data59 === "tenant" || data59 === "client" || data59 === "mailbox" || data59 === "memory" || data59 === "document" || data59 === "private-user" || data59 === "public")) {
                  const err204 = { instancePath: instancePath + "/scopes/" + i4 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                  if (vErrors === null) {
                    vErrors = [err204];
                  } else {
                    vErrors.push(err204);
                  }
                  errors++;
                }
              }
              if (data57.resourceId !== void 0) {
                let data60 = data57.resourceId;
                if (typeof data60 === "string") {
                  if (func1(data60) > 256) {
                    const err205 = { instancePath: instancePath + "/scopes/" + i4 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                    if (vErrors === null) {
                      vErrors = [err205];
                    } else {
                      vErrors.push(err205);
                    }
                    errors++;
                  }
                  if (func1(data60) < 1) {
                    const err206 = { instancePath: instancePath + "/scopes/" + i4 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err206];
                    } else {
                      vErrors.push(err206);
                    }
                    errors++;
                  }
                } else {
                  const err207 = { instancePath: instancePath + "/scopes/" + i4 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err207];
                  } else {
                    vErrors.push(err207);
                  }
                  errors++;
                }
              }
              if (data57.policyRevision !== void 0) {
                let data61 = data57.policyRevision;
                if (typeof data61 === "string") {
                  if (func1(data61) > 128) {
                    const err208 = { instancePath: instancePath + "/scopes/" + i4 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                    if (vErrors === null) {
                      vErrors = [err208];
                    } else {
                      vErrors.push(err208);
                    }
                    errors++;
                  }
                  if (func1(data61) < 1) {
                    const err209 = { instancePath: instancePath + "/scopes/" + i4 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err209];
                    } else {
                      vErrors.push(err209);
                    }
                    errors++;
                  }
                } else {
                  const err210 = { instancePath: instancePath + "/scopes/" + i4 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err210];
                  } else {
                    vErrors.push(err210);
                  }
                  errors++;
                }
              }
            } else {
              const err211 = { instancePath: instancePath + "/scopes/" + i4, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err211];
              } else {
                vErrors.push(err211);
              }
              errors++;
            }
          }
          let i5 = data56.length;
          let j2;
          if (i5 > 1) {
            outer2: for (; i5--; ) {
              for (j2 = i5; j2--; ) {
                if (func0(data56[i5], data56[j2])) {
                  const err212 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/2/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i5, j: j2 }, message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)" };
                  if (vErrors === null) {
                    vErrors = [err212];
                  } else {
                    vErrors.push(err212);
                  }
                  errors++;
                  break outer2;
                }
              }
            }
          }
        } else {
          const err213 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/2/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
          if (vErrors === null) {
            vErrors = [err213];
          } else {
            vErrors.push(err213);
          }
          errors++;
        }
      }
      if (data.type !== void 0) {
        if ("tool.started" !== data.type) {
          const err214 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/2/properties/type/const", keyword: "const", params: { allowedValue: "tool.started" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err214];
          } else {
            vErrors.push(err214);
          }
          errors++;
        }
      }
      if (data.data !== void 0) {
        let data63 = data.data;
        if (data63 && typeof data63 == "object" && !Array.isArray(data63)) {
          if (data63.requestId === void 0) {
            const err215 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/2/properties/data/required", keyword: "required", params: { missingProperty: "requestId" }, message: "must have required property 'requestId'" };
            if (vErrors === null) {
              vErrors = [err215];
            } else {
              vErrors.push(err215);
            }
            errors++;
          }
          if (data63.tool === void 0) {
            const err216 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/2/properties/data/required", keyword: "required", params: { missingProperty: "tool" }, message: "must have required property 'tool'" };
            if (vErrors === null) {
              vErrors = [err216];
            } else {
              vErrors.push(err216);
            }
            errors++;
          }
          for (const key11 in data63) {
            if (!(key11 === "requestId" || key11 === "tool")) {
              const err217 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/2/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err217];
              } else {
                vErrors.push(err217);
              }
              errors++;
            }
          }
          if (data63.requestId !== void 0) {
            let data64 = data63.requestId;
            if (typeof data64 === "string") {
              if (!formats0.test(data64)) {
                const err218 = { instancePath: instancePath + "/data/requestId", schemaPath: "#/oneOf/2/properties/data/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err218];
                } else {
                  vErrors.push(err218);
                }
                errors++;
              }
            } else {
              const err219 = { instancePath: instancePath + "/data/requestId", schemaPath: "#/oneOf/2/properties/data/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err219];
              } else {
                vErrors.push(err219);
              }
              errors++;
            }
          }
          if (data63.tool !== void 0) {
            let data65 = data63.tool;
            if (typeof data65 === "string") {
              if (func1(data65) < 1) {
                const err220 = { instancePath: instancePath + "/data/tool", schemaPath: "#/oneOf/2/properties/data/properties/tool/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                if (vErrors === null) {
                  vErrors = [err220];
                } else {
                  vErrors.push(err220);
                }
                errors++;
              }
            } else {
              const err221 = { instancePath: instancePath + "/data/tool", schemaPath: "#/oneOf/2/properties/data/properties/tool/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err221];
              } else {
                vErrors.push(err221);
              }
              errors++;
            }
          }
        } else {
          const err222 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/2/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err222];
          } else {
            vErrors.push(err222);
          }
          errors++;
        }
      }
    } else {
      const err223 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err223];
      } else {
        vErrors.push(err223);
      }
      errors++;
    }
    var _valid0 = _errs105 === errors;
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
      const _errs155 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.contractVersion === void 0) {
          const err224 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
          if (vErrors === null) {
            vErrors = [err224];
          } else {
            vErrors.push(err224);
          }
          errors++;
        }
        if (data.eventId === void 0) {
          const err225 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
          if (vErrors === null) {
            vErrors = [err225];
          } else {
            vErrors.push(err225);
          }
          errors++;
        }
        if (data.binding === void 0) {
          const err226 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
          if (vErrors === null) {
            vErrors = [err226];
          } else {
            vErrors.push(err226);
          }
          errors++;
        }
        if (data.sequence === void 0) {
          const err227 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
          if (vErrors === null) {
            vErrors = [err227];
          } else {
            vErrors.push(err227);
          }
          errors++;
        }
        if (data.createdAt === void 0) {
          const err228 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
          if (vErrors === null) {
            vErrors = [err228];
          } else {
            vErrors.push(err228);
          }
          errors++;
        }
        if (data.scopes === void 0) {
          const err229 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
          if (vErrors === null) {
            vErrors = [err229];
          } else {
            vErrors.push(err229);
          }
          errors++;
        }
        if (data.type === void 0) {
          const err230 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
          if (vErrors === null) {
            vErrors = [err230];
          } else {
            vErrors.push(err230);
          }
          errors++;
        }
        if (data.data === void 0) {
          const err231 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
          if (vErrors === null) {
            vErrors = [err231];
          } else {
            vErrors.push(err231);
          }
          errors++;
        }
        for (const key12 in data) {
          if (!(key12 === "contractVersion" || key12 === "eventId" || key12 === "binding" || key12 === "sequence" || key12 === "createdAt" || key12 === "scopes" || key12 === "type" || key12 === "data")) {
            const err232 = { instancePath, schemaPath: "#/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err232];
            } else {
              vErrors.push(err232);
            }
            errors++;
          }
        }
        if (data.contractVersion !== void 0) {
          if ("0.1.0" !== data.contractVersion) {
            const err233 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/3/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err233];
            } else {
              vErrors.push(err233);
            }
            errors++;
          }
        }
        if (data.eventId !== void 0) {
          let data67 = data.eventId;
          if (typeof data67 === "string") {
            if (!formats0.test(data67)) {
              const err234 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/3/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
              if (vErrors === null) {
                vErrors = [err234];
              } else {
                vErrors.push(err234);
              }
              errors++;
            }
          } else {
            const err235 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/3/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err235];
            } else {
              vErrors.push(err235);
            }
            errors++;
          }
        }
        if (data.binding !== void 0) {
          let data68 = data.binding;
          if (data68 && typeof data68 == "object" && !Array.isArray(data68)) {
            if (data68.tenantId === void 0) {
              const err236 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
              if (vErrors === null) {
                vErrors = [err236];
              } else {
                vErrors.push(err236);
              }
              errors++;
            }
            if (data68.actorId === void 0) {
              const err237 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
              if (vErrors === null) {
                vErrors = [err237];
              } else {
                vErrors.push(err237);
              }
              errors++;
            }
            if (data68.conversationId === void 0) {
              const err238 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
              if (vErrors === null) {
                vErrors = [err238];
              } else {
                vErrors.push(err238);
              }
              errors++;
            }
            if (data68.runId === void 0) {
              const err239 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
              if (vErrors === null) {
                vErrors = [err239];
              } else {
                vErrors.push(err239);
              }
              errors++;
            }
            if (data68.attemptId === void 0) {
              const err240 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
              if (vErrors === null) {
                vErrors = [err240];
              } else {
                vErrors.push(err240);
              }
              errors++;
            }
            if (data68.workerId === void 0) {
              const err241 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
              if (vErrors === null) {
                vErrors = [err241];
              } else {
                vErrors.push(err241);
              }
              errors++;
            }
            if (data68.writerFence === void 0) {
              const err242 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
              if (vErrors === null) {
                vErrors = [err242];
              } else {
                vErrors.push(err242);
              }
              errors++;
            }
            for (const key13 in data68) {
              if (!(key13 === "tenantId" || key13 === "actorId" || key13 === "conversationId" || key13 === "runId" || key13 === "attemptId" || key13 === "workerId" || key13 === "writerFence")) {
                const err243 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err243];
                } else {
                  vErrors.push(err243);
                }
                errors++;
              }
            }
            if (data68.tenantId !== void 0) {
              let data69 = data68.tenantId;
              if (typeof data69 === "string") {
                if (func1(data69) > 128) {
                  const err244 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err244];
                  } else {
                    vErrors.push(err244);
                  }
                  errors++;
                }
                if (func1(data69) < 1) {
                  const err245 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err245];
                  } else {
                    vErrors.push(err245);
                  }
                  errors++;
                }
              } else {
                const err246 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err246];
                } else {
                  vErrors.push(err246);
                }
                errors++;
              }
            }
            if (data68.actorId !== void 0) {
              let data70 = data68.actorId;
              if (typeof data70 === "string") {
                if (func1(data70) > 128) {
                  const err247 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                  if (vErrors === null) {
                    vErrors = [err247];
                  } else {
                    vErrors.push(err247);
                  }
                  errors++;
                }
                if (func1(data70) < 1) {
                  const err248 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err248];
                  } else {
                    vErrors.push(err248);
                  }
                  errors++;
                }
              } else {
                const err249 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err249];
                } else {
                  vErrors.push(err249);
                }
                errors++;
              }
            }
            if (data68.conversationId !== void 0) {
              let data71 = data68.conversationId;
              if (typeof data71 === "string") {
                if (!formats0.test(data71)) {
                  const err250 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err250];
                  } else {
                    vErrors.push(err250);
                  }
                  errors++;
                }
              } else {
                const err251 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err251];
                } else {
                  vErrors.push(err251);
                }
                errors++;
              }
            }
            if (data68.runId !== void 0) {
              let data72 = data68.runId;
              if (typeof data72 === "string") {
                if (!formats0.test(data72)) {
                  const err252 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err252];
                  } else {
                    vErrors.push(err252);
                  }
                  errors++;
                }
              } else {
                const err253 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err253];
                } else {
                  vErrors.push(err253);
                }
                errors++;
              }
            }
            if (data68.attemptId !== void 0) {
              let data73 = data68.attemptId;
              if (typeof data73 === "string") {
                if (!formats0.test(data73)) {
                  const err254 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err254];
                  } else {
                    vErrors.push(err254);
                  }
                  errors++;
                }
              } else {
                const err255 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err255];
                } else {
                  vErrors.push(err255);
                }
                errors++;
              }
            }
            if (data68.workerId !== void 0) {
              let data74 = data68.workerId;
              if (typeof data74 === "string") {
                if (!formats0.test(data74)) {
                  const err256 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err256];
                  } else {
                    vErrors.push(err256);
                  }
                  errors++;
                }
              } else {
                const err257 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err257];
                } else {
                  vErrors.push(err257);
                }
                errors++;
              }
            }
            if (data68.writerFence !== void 0) {
              let data75 = data68.writerFence;
              if (!(typeof data75 == "number" && (!(data75 % 1) && !isNaN(data75)) && isFinite(data75))) {
                const err258 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                if (vErrors === null) {
                  vErrors = [err258];
                } else {
                  vErrors.push(err258);
                }
                errors++;
              }
              if (typeof data75 == "number" && isFinite(data75)) {
                if (data75 > 9007199254740991 || isNaN(data75)) {
                  const err259 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                  if (vErrors === null) {
                    vErrors = [err259];
                  } else {
                    vErrors.push(err259);
                  }
                  errors++;
                }
                if (data75 < 1 || isNaN(data75)) {
                  const err260 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                  if (vErrors === null) {
                    vErrors = [err260];
                  } else {
                    vErrors.push(err260);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err261 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err261];
            } else {
              vErrors.push(err261);
            }
            errors++;
          }
        }
        if (data.sequence !== void 0) {
          let data76 = data.sequence;
          if (!(typeof data76 == "number" && (!(data76 % 1) && !isNaN(data76)) && isFinite(data76))) {
            const err262 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/3/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err262];
            } else {
              vErrors.push(err262);
            }
            errors++;
          }
          if (typeof data76 == "number" && isFinite(data76)) {
            if (data76 > 9007199254740991 || isNaN(data76)) {
              const err263 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/3/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
              if (vErrors === null) {
                vErrors = [err263];
              } else {
                vErrors.push(err263);
              }
              errors++;
            }
            if (data76 < 1 || isNaN(data76)) {
              const err264 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/3/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
              if (vErrors === null) {
                vErrors = [err264];
              } else {
                vErrors.push(err264);
              }
              errors++;
            }
          }
        }
        if (data.createdAt !== void 0) {
          let data77 = data.createdAt;
          if (typeof data77 === "string") {
            if (!pattern4.test(data77)) {
              const err265 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/3/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
              if (vErrors === null) {
                vErrors = [err265];
              } else {
                vErrors.push(err265);
              }
              errors++;
            }
            if (!formats10.validate(data77)) {
              const err266 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/3/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
              if (vErrors === null) {
                vErrors = [err266];
              } else {
                vErrors.push(err266);
              }
              errors++;
            }
          } else {
            const err267 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/3/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err267];
            } else {
              vErrors.push(err267);
            }
            errors++;
          }
        }
        if (data.scopes !== void 0) {
          let data78 = data.scopes;
          if (Array.isArray(data78)) {
            if (data78.length < 1) {
              const err268 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/3/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
              if (vErrors === null) {
                vErrors = [err268];
              } else {
                vErrors.push(err268);
              }
              errors++;
            }
            const len3 = data78.length;
            for (let i6 = 0; i6 < len3; i6++) {
              let data79 = data78[i6];
              if (data79 && typeof data79 == "object" && !Array.isArray(data79)) {
                if (data79.tenantId === void 0) {
                  const err269 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                  if (vErrors === null) {
                    vErrors = [err269];
                  } else {
                    vErrors.push(err269);
                  }
                  errors++;
                }
                if (data79.kind === void 0) {
                  const err270 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                  if (vErrors === null) {
                    vErrors = [err270];
                  } else {
                    vErrors.push(err270);
                  }
                  errors++;
                }
                if (data79.resourceId === void 0) {
                  const err271 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                  if (vErrors === null) {
                    vErrors = [err271];
                  } else {
                    vErrors.push(err271);
                  }
                  errors++;
                }
                if (data79.policyRevision === void 0) {
                  const err272 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                  if (vErrors === null) {
                    vErrors = [err272];
                  } else {
                    vErrors.push(err272);
                  }
                  errors++;
                }
                for (const key14 in data79) {
                  if (!(key14 === "tenantId" || key14 === "kind" || key14 === "resourceId" || key14 === "policyRevision")) {
                    const err273 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" };
                    if (vErrors === null) {
                      vErrors = [err273];
                    } else {
                      vErrors.push(err273);
                    }
                    errors++;
                  }
                }
                if (data79.tenantId !== void 0) {
                  let data80 = data79.tenantId;
                  if (typeof data80 === "string") {
                    if (func1(data80) > 128) {
                      const err274 = { instancePath: instancePath + "/scopes/" + i6 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                      if (vErrors === null) {
                        vErrors = [err274];
                      } else {
                        vErrors.push(err274);
                      }
                      errors++;
                    }
                    if (func1(data80) < 1) {
                      const err275 = { instancePath: instancePath + "/scopes/" + i6 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err275];
                      } else {
                        vErrors.push(err275);
                      }
                      errors++;
                    }
                  } else {
                    const err276 = { instancePath: instancePath + "/scopes/" + i6 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err276];
                    } else {
                      vErrors.push(err276);
                    }
                    errors++;
                  }
                }
                if (data79.kind !== void 0) {
                  let data81 = data79.kind;
                  if (typeof data81 !== "string") {
                    const err277 = { instancePath: instancePath + "/scopes/" + i6 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err277];
                    } else {
                      vErrors.push(err277);
                    }
                    errors++;
                  }
                  if (!(data81 === "tenant" || data81 === "client" || data81 === "mailbox" || data81 === "memory" || data81 === "document" || data81 === "private-user" || data81 === "public")) {
                    const err278 = { instancePath: instancePath + "/scopes/" + i6 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                    if (vErrors === null) {
                      vErrors = [err278];
                    } else {
                      vErrors.push(err278);
                    }
                    errors++;
                  }
                }
                if (data79.resourceId !== void 0) {
                  let data82 = data79.resourceId;
                  if (typeof data82 === "string") {
                    if (func1(data82) > 256) {
                      const err279 = { instancePath: instancePath + "/scopes/" + i6 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                      if (vErrors === null) {
                        vErrors = [err279];
                      } else {
                        vErrors.push(err279);
                      }
                      errors++;
                    }
                    if (func1(data82) < 1) {
                      const err280 = { instancePath: instancePath + "/scopes/" + i6 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err280];
                      } else {
                        vErrors.push(err280);
                      }
                      errors++;
                    }
                  } else {
                    const err281 = { instancePath: instancePath + "/scopes/" + i6 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err281];
                    } else {
                      vErrors.push(err281);
                    }
                    errors++;
                  }
                }
                if (data79.policyRevision !== void 0) {
                  let data83 = data79.policyRevision;
                  if (typeof data83 === "string") {
                    if (func1(data83) > 128) {
                      const err282 = { instancePath: instancePath + "/scopes/" + i6 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                      if (vErrors === null) {
                        vErrors = [err282];
                      } else {
                        vErrors.push(err282);
                      }
                      errors++;
                    }
                    if (func1(data83) < 1) {
                      const err283 = { instancePath: instancePath + "/scopes/" + i6 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err283];
                      } else {
                        vErrors.push(err283);
                      }
                      errors++;
                    }
                  } else {
                    const err284 = { instancePath: instancePath + "/scopes/" + i6 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err284];
                    } else {
                      vErrors.push(err284);
                    }
                    errors++;
                  }
                }
              } else {
                const err285 = { instancePath: instancePath + "/scopes/" + i6, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err285];
                } else {
                  vErrors.push(err285);
                }
                errors++;
              }
            }
            let i7 = data78.length;
            let j3;
            if (i7 > 1) {
              outer3: for (; i7--; ) {
                for (j3 = i7; j3--; ) {
                  if (func0(data78[i7], data78[j3])) {
                    const err286 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/3/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i7, j: j3 }, message: "must NOT have duplicate items (items ## " + j3 + " and " + i7 + " are identical)" };
                    if (vErrors === null) {
                      vErrors = [err286];
                    } else {
                      vErrors.push(err286);
                    }
                    errors++;
                    break outer3;
                  }
                }
              }
            }
          } else {
            const err287 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/3/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err287];
            } else {
              vErrors.push(err287);
            }
            errors++;
          }
        }
        if (data.type !== void 0) {
          if ("tool.completed" !== data.type) {
            const err288 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/3/properties/type/const", keyword: "const", params: { allowedValue: "tool.completed" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err288];
            } else {
              vErrors.push(err288);
            }
            errors++;
          }
        }
        if (data.data !== void 0) {
          let data85 = data.data;
          if (data85 && typeof data85 == "object" && !Array.isArray(data85)) {
            if (data85.requestId === void 0) {
              const err289 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/3/properties/data/required", keyword: "required", params: { missingProperty: "requestId" }, message: "must have required property 'requestId'" };
              if (vErrors === null) {
                vErrors = [err289];
              } else {
                vErrors.push(err289);
              }
              errors++;
            }
            if (data85.resultReference === void 0) {
              const err290 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/3/properties/data/required", keyword: "required", params: { missingProperty: "resultReference" }, message: "must have required property 'resultReference'" };
              if (vErrors === null) {
                vErrors = [err290];
              } else {
                vErrors.push(err290);
              }
              errors++;
            }
            for (const key15 in data85) {
              if (!(key15 === "requestId" || key15 === "resultReference")) {
                const err291 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/3/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err291];
                } else {
                  vErrors.push(err291);
                }
                errors++;
              }
            }
            if (data85.requestId !== void 0) {
              let data86 = data85.requestId;
              if (typeof data86 === "string") {
                if (!formats0.test(data86)) {
                  const err292 = { instancePath: instancePath + "/data/requestId", schemaPath: "#/oneOf/3/properties/data/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err292];
                  } else {
                    vErrors.push(err292);
                  }
                  errors++;
                }
              } else {
                const err293 = { instancePath: instancePath + "/data/requestId", schemaPath: "#/oneOf/3/properties/data/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err293];
                } else {
                  vErrors.push(err293);
                }
                errors++;
              }
            }
            if (data85.resultReference !== void 0) {
              let data87 = data85.resultReference;
              if (typeof data87 === "string") {
                if (!formats0.test(data87)) {
                  const err294 = { instancePath: instancePath + "/data/resultReference", schemaPath: "#/oneOf/3/properties/data/properties/resultReference/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err294];
                  } else {
                    vErrors.push(err294);
                  }
                  errors++;
                }
              } else {
                const err295 = { instancePath: instancePath + "/data/resultReference", schemaPath: "#/oneOf/3/properties/data/properties/resultReference/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err295];
                } else {
                  vErrors.push(err295);
                }
                errors++;
              }
            }
          } else {
            const err296 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/3/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err296];
            } else {
              vErrors.push(err296);
            }
            errors++;
          }
        }
      } else {
        const err297 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err297];
        } else {
          vErrors.push(err297);
        }
        errors++;
      }
      var _valid0 = _errs155 === errors;
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
        const _errs205 = errors;
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.contractVersion === void 0) {
            const err298 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
            if (vErrors === null) {
              vErrors = [err298];
            } else {
              vErrors.push(err298);
            }
            errors++;
          }
          if (data.eventId === void 0) {
            const err299 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
            if (vErrors === null) {
              vErrors = [err299];
            } else {
              vErrors.push(err299);
            }
            errors++;
          }
          if (data.binding === void 0) {
            const err300 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
            if (vErrors === null) {
              vErrors = [err300];
            } else {
              vErrors.push(err300);
            }
            errors++;
          }
          if (data.sequence === void 0) {
            const err301 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
            if (vErrors === null) {
              vErrors = [err301];
            } else {
              vErrors.push(err301);
            }
            errors++;
          }
          if (data.createdAt === void 0) {
            const err302 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
            if (vErrors === null) {
              vErrors = [err302];
            } else {
              vErrors.push(err302);
            }
            errors++;
          }
          if (data.scopes === void 0) {
            const err303 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
            if (vErrors === null) {
              vErrors = [err303];
            } else {
              vErrors.push(err303);
            }
            errors++;
          }
          if (data.type === void 0) {
            const err304 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
            if (vErrors === null) {
              vErrors = [err304];
            } else {
              vErrors.push(err304);
            }
            errors++;
          }
          if (data.data === void 0) {
            const err305 = { instancePath, schemaPath: "#/oneOf/4/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
            if (vErrors === null) {
              vErrors = [err305];
            } else {
              vErrors.push(err305);
            }
            errors++;
          }
          for (const key16 in data) {
            if (!(key16 === "contractVersion" || key16 === "eventId" || key16 === "binding" || key16 === "sequence" || key16 === "createdAt" || key16 === "scopes" || key16 === "type" || key16 === "data")) {
              const err306 = { instancePath, schemaPath: "#/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key16 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err306];
              } else {
                vErrors.push(err306);
              }
              errors++;
            }
          }
          if (data.contractVersion !== void 0) {
            if ("0.1.0" !== data.contractVersion) {
              const err307 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/4/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err307];
              } else {
                vErrors.push(err307);
              }
              errors++;
            }
          }
          if (data.eventId !== void 0) {
            let data89 = data.eventId;
            if (typeof data89 === "string") {
              if (!formats0.test(data89)) {
                const err308 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/4/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                if (vErrors === null) {
                  vErrors = [err308];
                } else {
                  vErrors.push(err308);
                }
                errors++;
              }
            } else {
              const err309 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/4/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err309];
              } else {
                vErrors.push(err309);
              }
              errors++;
            }
          }
          if (data.binding !== void 0) {
            let data90 = data.binding;
            if (data90 && typeof data90 == "object" && !Array.isArray(data90)) {
              if (data90.tenantId === void 0) {
                const err310 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                if (vErrors === null) {
                  vErrors = [err310];
                } else {
                  vErrors.push(err310);
                }
                errors++;
              }
              if (data90.actorId === void 0) {
                const err311 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                if (vErrors === null) {
                  vErrors = [err311];
                } else {
                  vErrors.push(err311);
                }
                errors++;
              }
              if (data90.conversationId === void 0) {
                const err312 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                if (vErrors === null) {
                  vErrors = [err312];
                } else {
                  vErrors.push(err312);
                }
                errors++;
              }
              if (data90.runId === void 0) {
                const err313 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                if (vErrors === null) {
                  vErrors = [err313];
                } else {
                  vErrors.push(err313);
                }
                errors++;
              }
              if (data90.attemptId === void 0) {
                const err314 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                if (vErrors === null) {
                  vErrors = [err314];
                } else {
                  vErrors.push(err314);
                }
                errors++;
              }
              if (data90.workerId === void 0) {
                const err315 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                if (vErrors === null) {
                  vErrors = [err315];
                } else {
                  vErrors.push(err315);
                }
                errors++;
              }
              if (data90.writerFence === void 0) {
                const err316 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                if (vErrors === null) {
                  vErrors = [err316];
                } else {
                  vErrors.push(err316);
                }
                errors++;
              }
              for (const key17 in data90) {
                if (!(key17 === "tenantId" || key17 === "actorId" || key17 === "conversationId" || key17 === "runId" || key17 === "attemptId" || key17 === "workerId" || key17 === "writerFence")) {
                  const err317 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key17 }, message: "must NOT have additional properties" };
                  if (vErrors === null) {
                    vErrors = [err317];
                  } else {
                    vErrors.push(err317);
                  }
                  errors++;
                }
              }
              if (data90.tenantId !== void 0) {
                let data91 = data90.tenantId;
                if (typeof data91 === "string") {
                  if (func1(data91) > 128) {
                    const err318 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                    if (vErrors === null) {
                      vErrors = [err318];
                    } else {
                      vErrors.push(err318);
                    }
                    errors++;
                  }
                  if (func1(data91) < 1) {
                    const err319 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err319];
                    } else {
                      vErrors.push(err319);
                    }
                    errors++;
                  }
                } else {
                  const err320 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err320];
                  } else {
                    vErrors.push(err320);
                  }
                  errors++;
                }
              }
              if (data90.actorId !== void 0) {
                let data92 = data90.actorId;
                if (typeof data92 === "string") {
                  if (func1(data92) > 128) {
                    const err321 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                    if (vErrors === null) {
                      vErrors = [err321];
                    } else {
                      vErrors.push(err321);
                    }
                    errors++;
                  }
                  if (func1(data92) < 1) {
                    const err322 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err322];
                    } else {
                      vErrors.push(err322);
                    }
                    errors++;
                  }
                } else {
                  const err323 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err323];
                  } else {
                    vErrors.push(err323);
                  }
                  errors++;
                }
              }
              if (data90.conversationId !== void 0) {
                let data93 = data90.conversationId;
                if (typeof data93 === "string") {
                  if (!formats0.test(data93)) {
                    const err324 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err324];
                    } else {
                      vErrors.push(err324);
                    }
                    errors++;
                  }
                } else {
                  const err325 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err325];
                  } else {
                    vErrors.push(err325);
                  }
                  errors++;
                }
              }
              if (data90.runId !== void 0) {
                let data94 = data90.runId;
                if (typeof data94 === "string") {
                  if (!formats0.test(data94)) {
                    const err326 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err326];
                    } else {
                      vErrors.push(err326);
                    }
                    errors++;
                  }
                } else {
                  const err327 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err327];
                  } else {
                    vErrors.push(err327);
                  }
                  errors++;
                }
              }
              if (data90.attemptId !== void 0) {
                let data95 = data90.attemptId;
                if (typeof data95 === "string") {
                  if (!formats0.test(data95)) {
                    const err328 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err328];
                    } else {
                      vErrors.push(err328);
                    }
                    errors++;
                  }
                } else {
                  const err329 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err329];
                  } else {
                    vErrors.push(err329);
                  }
                  errors++;
                }
              }
              if (data90.workerId !== void 0) {
                let data96 = data90.workerId;
                if (typeof data96 === "string") {
                  if (!formats0.test(data96)) {
                    const err330 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err330];
                    } else {
                      vErrors.push(err330);
                    }
                    errors++;
                  }
                } else {
                  const err331 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err331];
                  } else {
                    vErrors.push(err331);
                  }
                  errors++;
                }
              }
              if (data90.writerFence !== void 0) {
                let data97 = data90.writerFence;
                if (!(typeof data97 == "number" && (!(data97 % 1) && !isNaN(data97)) && isFinite(data97))) {
                  const err332 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                  if (vErrors === null) {
                    vErrors = [err332];
                  } else {
                    vErrors.push(err332);
                  }
                  errors++;
                }
                if (typeof data97 == "number" && isFinite(data97)) {
                  if (data97 > 9007199254740991 || isNaN(data97)) {
                    const err333 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                    if (vErrors === null) {
                      vErrors = [err333];
                    } else {
                      vErrors.push(err333);
                    }
                    errors++;
                  }
                  if (data97 < 1 || isNaN(data97)) {
                    const err334 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                    if (vErrors === null) {
                      vErrors = [err334];
                    } else {
                      vErrors.push(err334);
                    }
                    errors++;
                  }
                }
              }
            } else {
              const err335 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err335];
              } else {
                vErrors.push(err335);
              }
              errors++;
            }
          }
          if (data.sequence !== void 0) {
            let data98 = data.sequence;
            if (!(typeof data98 == "number" && (!(data98 % 1) && !isNaN(data98)) && isFinite(data98))) {
              const err336 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/4/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
              if (vErrors === null) {
                vErrors = [err336];
              } else {
                vErrors.push(err336);
              }
              errors++;
            }
            if (typeof data98 == "number" && isFinite(data98)) {
              if (data98 > 9007199254740991 || isNaN(data98)) {
                const err337 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/4/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                if (vErrors === null) {
                  vErrors = [err337];
                } else {
                  vErrors.push(err337);
                }
                errors++;
              }
              if (data98 < 1 || isNaN(data98)) {
                const err338 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/4/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                if (vErrors === null) {
                  vErrors = [err338];
                } else {
                  vErrors.push(err338);
                }
                errors++;
              }
            }
          }
          if (data.createdAt !== void 0) {
            let data99 = data.createdAt;
            if (typeof data99 === "string") {
              if (!pattern4.test(data99)) {
                const err339 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/4/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                if (vErrors === null) {
                  vErrors = [err339];
                } else {
                  vErrors.push(err339);
                }
                errors++;
              }
              if (!formats10.validate(data99)) {
                const err340 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/4/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                if (vErrors === null) {
                  vErrors = [err340];
                } else {
                  vErrors.push(err340);
                }
                errors++;
              }
            } else {
              const err341 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/4/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err341];
              } else {
                vErrors.push(err341);
              }
              errors++;
            }
          }
          if (data.scopes !== void 0) {
            let data100 = data.scopes;
            if (Array.isArray(data100)) {
              if (data100.length < 1) {
                const err342 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/4/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                if (vErrors === null) {
                  vErrors = [err342];
                } else {
                  vErrors.push(err342);
                }
                errors++;
              }
              const len4 = data100.length;
              for (let i8 = 0; i8 < len4; i8++) {
                let data101 = data100[i8];
                if (data101 && typeof data101 == "object" && !Array.isArray(data101)) {
                  if (data101.tenantId === void 0) {
                    const err343 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                    if (vErrors === null) {
                      vErrors = [err343];
                    } else {
                      vErrors.push(err343);
                    }
                    errors++;
                  }
                  if (data101.kind === void 0) {
                    const err344 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                    if (vErrors === null) {
                      vErrors = [err344];
                    } else {
                      vErrors.push(err344);
                    }
                    errors++;
                  }
                  if (data101.resourceId === void 0) {
                    const err345 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                    if (vErrors === null) {
                      vErrors = [err345];
                    } else {
                      vErrors.push(err345);
                    }
                    errors++;
                  }
                  if (data101.policyRevision === void 0) {
                    const err346 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                    if (vErrors === null) {
                      vErrors = [err346];
                    } else {
                      vErrors.push(err346);
                    }
                    errors++;
                  }
                  for (const key18 in data101) {
                    if (!(key18 === "tenantId" || key18 === "kind" || key18 === "resourceId" || key18 === "policyRevision")) {
                      const err347 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key18 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err347];
                      } else {
                        vErrors.push(err347);
                      }
                      errors++;
                    }
                  }
                  if (data101.tenantId !== void 0) {
                    let data102 = data101.tenantId;
                    if (typeof data102 === "string") {
                      if (func1(data102) > 128) {
                        const err348 = { instancePath: instancePath + "/scopes/" + i8 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                        if (vErrors === null) {
                          vErrors = [err348];
                        } else {
                          vErrors.push(err348);
                        }
                        errors++;
                      }
                      if (func1(data102) < 1) {
                        const err349 = { instancePath: instancePath + "/scopes/" + i8 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err349];
                        } else {
                          vErrors.push(err349);
                        }
                        errors++;
                      }
                    } else {
                      const err350 = { instancePath: instancePath + "/scopes/" + i8 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err350];
                      } else {
                        vErrors.push(err350);
                      }
                      errors++;
                    }
                  }
                  if (data101.kind !== void 0) {
                    let data103 = data101.kind;
                    if (typeof data103 !== "string") {
                      const err351 = { instancePath: instancePath + "/scopes/" + i8 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err351];
                      } else {
                        vErrors.push(err351);
                      }
                      errors++;
                    }
                    if (!(data103 === "tenant" || data103 === "client" || data103 === "mailbox" || data103 === "memory" || data103 === "document" || data103 === "private-user" || data103 === "public")) {
                      const err352 = { instancePath: instancePath + "/scopes/" + i8 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                      if (vErrors === null) {
                        vErrors = [err352];
                      } else {
                        vErrors.push(err352);
                      }
                      errors++;
                    }
                  }
                  if (data101.resourceId !== void 0) {
                    let data104 = data101.resourceId;
                    if (typeof data104 === "string") {
                      if (func1(data104) > 256) {
                        const err353 = { instancePath: instancePath + "/scopes/" + i8 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                        if (vErrors === null) {
                          vErrors = [err353];
                        } else {
                          vErrors.push(err353);
                        }
                        errors++;
                      }
                      if (func1(data104) < 1) {
                        const err354 = { instancePath: instancePath + "/scopes/" + i8 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err354];
                        } else {
                          vErrors.push(err354);
                        }
                        errors++;
                      }
                    } else {
                      const err355 = { instancePath: instancePath + "/scopes/" + i8 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err355];
                      } else {
                        vErrors.push(err355);
                      }
                      errors++;
                    }
                  }
                  if (data101.policyRevision !== void 0) {
                    let data105 = data101.policyRevision;
                    if (typeof data105 === "string") {
                      if (func1(data105) > 128) {
                        const err356 = { instancePath: instancePath + "/scopes/" + i8 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                        if (vErrors === null) {
                          vErrors = [err356];
                        } else {
                          vErrors.push(err356);
                        }
                        errors++;
                      }
                      if (func1(data105) < 1) {
                        const err357 = { instancePath: instancePath + "/scopes/" + i8 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err357];
                        } else {
                          vErrors.push(err357);
                        }
                        errors++;
                      }
                    } else {
                      const err358 = { instancePath: instancePath + "/scopes/" + i8 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err358];
                      } else {
                        vErrors.push(err358);
                      }
                      errors++;
                    }
                  }
                } else {
                  const err359 = { instancePath: instancePath + "/scopes/" + i8, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err359];
                  } else {
                    vErrors.push(err359);
                  }
                  errors++;
                }
              }
              let i9 = data100.length;
              let j4;
              if (i9 > 1) {
                outer4: for (; i9--; ) {
                  for (j4 = i9; j4--; ) {
                    if (func0(data100[i9], data100[j4])) {
                      const err360 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/4/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i9, j: j4 }, message: "must NOT have duplicate items (items ## " + j4 + " and " + i9 + " are identical)" };
                      if (vErrors === null) {
                        vErrors = [err360];
                      } else {
                        vErrors.push(err360);
                      }
                      errors++;
                      break outer4;
                    }
                  }
                }
              }
            } else {
              const err361 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/4/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
              if (vErrors === null) {
                vErrors = [err361];
              } else {
                vErrors.push(err361);
              }
              errors++;
            }
          }
          if (data.type !== void 0) {
            if ("source.available" !== data.type) {
              const err362 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/4/properties/type/const", keyword: "const", params: { allowedValue: "source.available" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err362];
              } else {
                vErrors.push(err362);
              }
              errors++;
            }
          }
          if (data.data !== void 0) {
            if (!validate23(data.data, { instancePath: instancePath + "/data", parentData: data, parentDataProperty: "data", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err363 = { instancePath, schemaPath: "#/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err363];
          } else {
            vErrors.push(err363);
          }
          errors++;
        }
        var _valid0 = _errs205 === errors;
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
          const _errs249 = errors;
          if (data && typeof data == "object" && !Array.isArray(data)) {
            if (data.contractVersion === void 0) {
              const err364 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
              if (vErrors === null) {
                vErrors = [err364];
              } else {
                vErrors.push(err364);
              }
              errors++;
            }
            if (data.eventId === void 0) {
              const err365 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
              if (vErrors === null) {
                vErrors = [err365];
              } else {
                vErrors.push(err365);
              }
              errors++;
            }
            if (data.binding === void 0) {
              const err366 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
              if (vErrors === null) {
                vErrors = [err366];
              } else {
                vErrors.push(err366);
              }
              errors++;
            }
            if (data.sequence === void 0) {
              const err367 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
              if (vErrors === null) {
                vErrors = [err367];
              } else {
                vErrors.push(err367);
              }
              errors++;
            }
            if (data.createdAt === void 0) {
              const err368 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
              if (vErrors === null) {
                vErrors = [err368];
              } else {
                vErrors.push(err368);
              }
              errors++;
            }
            if (data.scopes === void 0) {
              const err369 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
              if (vErrors === null) {
                vErrors = [err369];
              } else {
                vErrors.push(err369);
              }
              errors++;
            }
            if (data.type === void 0) {
              const err370 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
              if (vErrors === null) {
                vErrors = [err370];
              } else {
                vErrors.push(err370);
              }
              errors++;
            }
            if (data.data === void 0) {
              const err371 = { instancePath, schemaPath: "#/oneOf/5/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
              if (vErrors === null) {
                vErrors = [err371];
              } else {
                vErrors.push(err371);
              }
              errors++;
            }
            for (const key19 in data) {
              if (!(key19 === "contractVersion" || key19 === "eventId" || key19 === "binding" || key19 === "sequence" || key19 === "createdAt" || key19 === "scopes" || key19 === "type" || key19 === "data")) {
                const err372 = { instancePath, schemaPath: "#/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key19 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err372];
                } else {
                  vErrors.push(err372);
                }
                errors++;
              }
            }
            if (data.contractVersion !== void 0) {
              if ("0.1.0" !== data.contractVersion) {
                const err373 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/5/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err373];
                } else {
                  vErrors.push(err373);
                }
                errors++;
              }
            }
            if (data.eventId !== void 0) {
              let data109 = data.eventId;
              if (typeof data109 === "string") {
                if (!formats0.test(data109)) {
                  const err374 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/5/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                  if (vErrors === null) {
                    vErrors = [err374];
                  } else {
                    vErrors.push(err374);
                  }
                  errors++;
                }
              } else {
                const err375 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/5/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err375];
                } else {
                  vErrors.push(err375);
                }
                errors++;
              }
            }
            if (data.binding !== void 0) {
              let data110 = data.binding;
              if (data110 && typeof data110 == "object" && !Array.isArray(data110)) {
                if (data110.tenantId === void 0) {
                  const err376 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                  if (vErrors === null) {
                    vErrors = [err376];
                  } else {
                    vErrors.push(err376);
                  }
                  errors++;
                }
                if (data110.actorId === void 0) {
                  const err377 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                  if (vErrors === null) {
                    vErrors = [err377];
                  } else {
                    vErrors.push(err377);
                  }
                  errors++;
                }
                if (data110.conversationId === void 0) {
                  const err378 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                  if (vErrors === null) {
                    vErrors = [err378];
                  } else {
                    vErrors.push(err378);
                  }
                  errors++;
                }
                if (data110.runId === void 0) {
                  const err379 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                  if (vErrors === null) {
                    vErrors = [err379];
                  } else {
                    vErrors.push(err379);
                  }
                  errors++;
                }
                if (data110.attemptId === void 0) {
                  const err380 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                  if (vErrors === null) {
                    vErrors = [err380];
                  } else {
                    vErrors.push(err380);
                  }
                  errors++;
                }
                if (data110.workerId === void 0) {
                  const err381 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                  if (vErrors === null) {
                    vErrors = [err381];
                  } else {
                    vErrors.push(err381);
                  }
                  errors++;
                }
                if (data110.writerFence === void 0) {
                  const err382 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                  if (vErrors === null) {
                    vErrors = [err382];
                  } else {
                    vErrors.push(err382);
                  }
                  errors++;
                }
                for (const key20 in data110) {
                  if (!(key20 === "tenantId" || key20 === "actorId" || key20 === "conversationId" || key20 === "runId" || key20 === "attemptId" || key20 === "workerId" || key20 === "writerFence")) {
                    const err383 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key20 }, message: "must NOT have additional properties" };
                    if (vErrors === null) {
                      vErrors = [err383];
                    } else {
                      vErrors.push(err383);
                    }
                    errors++;
                  }
                }
                if (data110.tenantId !== void 0) {
                  let data111 = data110.tenantId;
                  if (typeof data111 === "string") {
                    if (func1(data111) > 128) {
                      const err384 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                      if (vErrors === null) {
                        vErrors = [err384];
                      } else {
                        vErrors.push(err384);
                      }
                      errors++;
                    }
                    if (func1(data111) < 1) {
                      const err385 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err385];
                      } else {
                        vErrors.push(err385);
                      }
                      errors++;
                    }
                  } else {
                    const err386 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err386];
                    } else {
                      vErrors.push(err386);
                    }
                    errors++;
                  }
                }
                if (data110.actorId !== void 0) {
                  let data112 = data110.actorId;
                  if (typeof data112 === "string") {
                    if (func1(data112) > 128) {
                      const err387 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                      if (vErrors === null) {
                        vErrors = [err387];
                      } else {
                        vErrors.push(err387);
                      }
                      errors++;
                    }
                    if (func1(data112) < 1) {
                      const err388 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err388];
                      } else {
                        vErrors.push(err388);
                      }
                      errors++;
                    }
                  } else {
                    const err389 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err389];
                    } else {
                      vErrors.push(err389);
                    }
                    errors++;
                  }
                }
                if (data110.conversationId !== void 0) {
                  let data113 = data110.conversationId;
                  if (typeof data113 === "string") {
                    if (!formats0.test(data113)) {
                      const err390 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err390];
                      } else {
                        vErrors.push(err390);
                      }
                      errors++;
                    }
                  } else {
                    const err391 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err391];
                    } else {
                      vErrors.push(err391);
                    }
                    errors++;
                  }
                }
                if (data110.runId !== void 0) {
                  let data114 = data110.runId;
                  if (typeof data114 === "string") {
                    if (!formats0.test(data114)) {
                      const err392 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err392];
                      } else {
                        vErrors.push(err392);
                      }
                      errors++;
                    }
                  } else {
                    const err393 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err393];
                    } else {
                      vErrors.push(err393);
                    }
                    errors++;
                  }
                }
                if (data110.attemptId !== void 0) {
                  let data115 = data110.attemptId;
                  if (typeof data115 === "string") {
                    if (!formats0.test(data115)) {
                      const err394 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err394];
                      } else {
                        vErrors.push(err394);
                      }
                      errors++;
                    }
                  } else {
                    const err395 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err395];
                    } else {
                      vErrors.push(err395);
                    }
                    errors++;
                  }
                }
                if (data110.workerId !== void 0) {
                  let data116 = data110.workerId;
                  if (typeof data116 === "string") {
                    if (!formats0.test(data116)) {
                      const err396 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err396];
                      } else {
                        vErrors.push(err396);
                      }
                      errors++;
                    }
                  } else {
                    const err397 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err397];
                    } else {
                      vErrors.push(err397);
                    }
                    errors++;
                  }
                }
                if (data110.writerFence !== void 0) {
                  let data117 = data110.writerFence;
                  if (!(typeof data117 == "number" && (!(data117 % 1) && !isNaN(data117)) && isFinite(data117))) {
                    const err398 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                    if (vErrors === null) {
                      vErrors = [err398];
                    } else {
                      vErrors.push(err398);
                    }
                    errors++;
                  }
                  if (typeof data117 == "number" && isFinite(data117)) {
                    if (data117 > 9007199254740991 || isNaN(data117)) {
                      const err399 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                      if (vErrors === null) {
                        vErrors = [err399];
                      } else {
                        vErrors.push(err399);
                      }
                      errors++;
                    }
                    if (data117 < 1 || isNaN(data117)) {
                      const err400 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                      if (vErrors === null) {
                        vErrors = [err400];
                      } else {
                        vErrors.push(err400);
                      }
                      errors++;
                    }
                  }
                }
              } else {
                const err401 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err401];
                } else {
                  vErrors.push(err401);
                }
                errors++;
              }
            }
            if (data.sequence !== void 0) {
              let data118 = data.sequence;
              if (!(typeof data118 == "number" && (!(data118 % 1) && !isNaN(data118)) && isFinite(data118))) {
                const err402 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/5/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                if (vErrors === null) {
                  vErrors = [err402];
                } else {
                  vErrors.push(err402);
                }
                errors++;
              }
              if (typeof data118 == "number" && isFinite(data118)) {
                if (data118 > 9007199254740991 || isNaN(data118)) {
                  const err403 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/5/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                  if (vErrors === null) {
                    vErrors = [err403];
                  } else {
                    vErrors.push(err403);
                  }
                  errors++;
                }
                if (data118 < 1 || isNaN(data118)) {
                  const err404 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/5/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                  if (vErrors === null) {
                    vErrors = [err404];
                  } else {
                    vErrors.push(err404);
                  }
                  errors++;
                }
              }
            }
            if (data.createdAt !== void 0) {
              let data119 = data.createdAt;
              if (typeof data119 === "string") {
                if (!pattern4.test(data119)) {
                  const err405 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/5/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                  if (vErrors === null) {
                    vErrors = [err405];
                  } else {
                    vErrors.push(err405);
                  }
                  errors++;
                }
                if (!formats10.validate(data119)) {
                  const err406 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/5/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                  if (vErrors === null) {
                    vErrors = [err406];
                  } else {
                    vErrors.push(err406);
                  }
                  errors++;
                }
              } else {
                const err407 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/5/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err407];
                } else {
                  vErrors.push(err407);
                }
                errors++;
              }
            }
            if (data.scopes !== void 0) {
              let data120 = data.scopes;
              if (Array.isArray(data120)) {
                if (data120.length < 1) {
                  const err408 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/5/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                  if (vErrors === null) {
                    vErrors = [err408];
                  } else {
                    vErrors.push(err408);
                  }
                  errors++;
                }
                const len5 = data120.length;
                for (let i10 = 0; i10 < len5; i10++) {
                  let data121 = data120[i10];
                  if (data121 && typeof data121 == "object" && !Array.isArray(data121)) {
                    if (data121.tenantId === void 0) {
                      const err409 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                      if (vErrors === null) {
                        vErrors = [err409];
                      } else {
                        vErrors.push(err409);
                      }
                      errors++;
                    }
                    if (data121.kind === void 0) {
                      const err410 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                      if (vErrors === null) {
                        vErrors = [err410];
                      } else {
                        vErrors.push(err410);
                      }
                      errors++;
                    }
                    if (data121.resourceId === void 0) {
                      const err411 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                      if (vErrors === null) {
                        vErrors = [err411];
                      } else {
                        vErrors.push(err411);
                      }
                      errors++;
                    }
                    if (data121.policyRevision === void 0) {
                      const err412 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                      if (vErrors === null) {
                        vErrors = [err412];
                      } else {
                        vErrors.push(err412);
                      }
                      errors++;
                    }
                    for (const key21 in data121) {
                      if (!(key21 === "tenantId" || key21 === "kind" || key21 === "resourceId" || key21 === "policyRevision")) {
                        const err413 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key21 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err413];
                        } else {
                          vErrors.push(err413);
                        }
                        errors++;
                      }
                    }
                    if (data121.tenantId !== void 0) {
                      let data122 = data121.tenantId;
                      if (typeof data122 === "string") {
                        if (func1(data122) > 128) {
                          const err414 = { instancePath: instancePath + "/scopes/" + i10 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                          if (vErrors === null) {
                            vErrors = [err414];
                          } else {
                            vErrors.push(err414);
                          }
                          errors++;
                        }
                        if (func1(data122) < 1) {
                          const err415 = { instancePath: instancePath + "/scopes/" + i10 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err415];
                          } else {
                            vErrors.push(err415);
                          }
                          errors++;
                        }
                      } else {
                        const err416 = { instancePath: instancePath + "/scopes/" + i10 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err416];
                        } else {
                          vErrors.push(err416);
                        }
                        errors++;
                      }
                    }
                    if (data121.kind !== void 0) {
                      let data123 = data121.kind;
                      if (typeof data123 !== "string") {
                        const err417 = { instancePath: instancePath + "/scopes/" + i10 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err417];
                        } else {
                          vErrors.push(err417);
                        }
                        errors++;
                      }
                      if (!(data123 === "tenant" || data123 === "client" || data123 === "mailbox" || data123 === "memory" || data123 === "document" || data123 === "private-user" || data123 === "public")) {
                        const err418 = { instancePath: instancePath + "/scopes/" + i10 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err418];
                        } else {
                          vErrors.push(err418);
                        }
                        errors++;
                      }
                    }
                    if (data121.resourceId !== void 0) {
                      let data124 = data121.resourceId;
                      if (typeof data124 === "string") {
                        if (func1(data124) > 256) {
                          const err419 = { instancePath: instancePath + "/scopes/" + i10 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                          if (vErrors === null) {
                            vErrors = [err419];
                          } else {
                            vErrors.push(err419);
                          }
                          errors++;
                        }
                        if (func1(data124) < 1) {
                          const err420 = { instancePath: instancePath + "/scopes/" + i10 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err420];
                          } else {
                            vErrors.push(err420);
                          }
                          errors++;
                        }
                      } else {
                        const err421 = { instancePath: instancePath + "/scopes/" + i10 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err421];
                        } else {
                          vErrors.push(err421);
                        }
                        errors++;
                      }
                    }
                    if (data121.policyRevision !== void 0) {
                      let data125 = data121.policyRevision;
                      if (typeof data125 === "string") {
                        if (func1(data125) > 128) {
                          const err422 = { instancePath: instancePath + "/scopes/" + i10 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                          if (vErrors === null) {
                            vErrors = [err422];
                          } else {
                            vErrors.push(err422);
                          }
                          errors++;
                        }
                        if (func1(data125) < 1) {
                          const err423 = { instancePath: instancePath + "/scopes/" + i10 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err423];
                          } else {
                            vErrors.push(err423);
                          }
                          errors++;
                        }
                      } else {
                        const err424 = { instancePath: instancePath + "/scopes/" + i10 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err424];
                        } else {
                          vErrors.push(err424);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err425 = { instancePath: instancePath + "/scopes/" + i10, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err425];
                    } else {
                      vErrors.push(err425);
                    }
                    errors++;
                  }
                }
                let i11 = data120.length;
                let j5;
                if (i11 > 1) {
                  outer5: for (; i11--; ) {
                    for (j5 = i11; j5--; ) {
                      if (func0(data120[i11], data120[j5])) {
                        const err426 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/5/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i11, j: j5 }, message: "must NOT have duplicate items (items ## " + j5 + " and " + i11 + " are identical)" };
                        if (vErrors === null) {
                          vErrors = [err426];
                        } else {
                          vErrors.push(err426);
                        }
                        errors++;
                        break outer5;
                      }
                    }
                  }
                }
              } else {
                const err427 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/5/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err427];
                } else {
                  vErrors.push(err427);
                }
                errors++;
              }
            }
            if (data.type !== void 0) {
              if ("approval.required" !== data.type) {
                const err428 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/5/properties/type/const", keyword: "const", params: { allowedValue: "approval.required" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err428];
                } else {
                  vErrors.push(err428);
                }
                errors++;
              }
            }
            if (data.data !== void 0) {
              let data127 = data.data;
              if (data127 && typeof data127 == "object" && !Array.isArray(data127)) {
                if (data127.proposalId === void 0) {
                  const err429 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/5/properties/data/required", keyword: "required", params: { missingProperty: "proposalId" }, message: "must have required property 'proposalId'" };
                  if (vErrors === null) {
                    vErrors = [err429];
                  } else {
                    vErrors.push(err429);
                  }
                  errors++;
                }
                if (data127.commandSha256 === void 0) {
                  const err430 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/5/properties/data/required", keyword: "required", params: { missingProperty: "commandSha256" }, message: "must have required property 'commandSha256'" };
                  if (vErrors === null) {
                    vErrors = [err430];
                  } else {
                    vErrors.push(err430);
                  }
                  errors++;
                }
                if (data127.expiresAt === void 0) {
                  const err431 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/5/properties/data/required", keyword: "required", params: { missingProperty: "expiresAt" }, message: "must have required property 'expiresAt'" };
                  if (vErrors === null) {
                    vErrors = [err431];
                  } else {
                    vErrors.push(err431);
                  }
                  errors++;
                }
                for (const key22 in data127) {
                  if (!(key22 === "proposalId" || key22 === "commandSha256" || key22 === "expiresAt")) {
                    const err432 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/5/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key22 }, message: "must NOT have additional properties" };
                    if (vErrors === null) {
                      vErrors = [err432];
                    } else {
                      vErrors.push(err432);
                    }
                    errors++;
                  }
                }
                if (data127.proposalId !== void 0) {
                  let data128 = data127.proposalId;
                  if (typeof data128 === "string") {
                    if (!formats0.test(data128)) {
                      const err433 = { instancePath: instancePath + "/data/proposalId", schemaPath: "#/oneOf/5/properties/data/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err433];
                      } else {
                        vErrors.push(err433);
                      }
                      errors++;
                    }
                  } else {
                    const err434 = { instancePath: instancePath + "/data/proposalId", schemaPath: "#/oneOf/5/properties/data/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err434];
                    } else {
                      vErrors.push(err434);
                    }
                    errors++;
                  }
                }
                if (data127.commandSha256 !== void 0) {
                  let data129 = data127.commandSha256;
                  if (typeof data129 === "string") {
                    if (!pattern11.test(data129)) {
                      const err435 = { instancePath: instancePath + "/data/commandSha256", schemaPath: "#/oneOf/5/properties/data/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                      if (vErrors === null) {
                        vErrors = [err435];
                      } else {
                        vErrors.push(err435);
                      }
                      errors++;
                    }
                  } else {
                    const err436 = { instancePath: instancePath + "/data/commandSha256", schemaPath: "#/oneOf/5/properties/data/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err436];
                    } else {
                      vErrors.push(err436);
                    }
                    errors++;
                  }
                }
                if (data127.expiresAt !== void 0) {
                  let data130 = data127.expiresAt;
                  if (typeof data130 === "string") {
                    if (!pattern4.test(data130)) {
                      const err437 = { instancePath: instancePath + "/data/expiresAt", schemaPath: "#/oneOf/5/properties/data/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                      if (vErrors === null) {
                        vErrors = [err437];
                      } else {
                        vErrors.push(err437);
                      }
                      errors++;
                    }
                    if (!formats10.validate(data130)) {
                      const err438 = { instancePath: instancePath + "/data/expiresAt", schemaPath: "#/oneOf/5/properties/data/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                      if (vErrors === null) {
                        vErrors = [err438];
                      } else {
                        vErrors.push(err438);
                      }
                      errors++;
                    }
                  } else {
                    const err439 = { instancePath: instancePath + "/data/expiresAt", schemaPath: "#/oneOf/5/properties/data/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err439];
                    } else {
                      vErrors.push(err439);
                    }
                    errors++;
                  }
                }
              } else {
                const err440 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/5/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err440];
                } else {
                  vErrors.push(err440);
                }
                errors++;
              }
            }
          } else {
            const err441 = { instancePath, schemaPath: "#/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err441];
            } else {
              vErrors.push(err441);
            }
            errors++;
          }
          var _valid0 = _errs249 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
            const _errs301 = errors;
            if (data && typeof data == "object" && !Array.isArray(data)) {
              if (data.contractVersion === void 0) {
                const err442 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
                if (vErrors === null) {
                  vErrors = [err442];
                } else {
                  vErrors.push(err442);
                }
                errors++;
              }
              if (data.eventId === void 0) {
                const err443 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
                if (vErrors === null) {
                  vErrors = [err443];
                } else {
                  vErrors.push(err443);
                }
                errors++;
              }
              if (data.binding === void 0) {
                const err444 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
                if (vErrors === null) {
                  vErrors = [err444];
                } else {
                  vErrors.push(err444);
                }
                errors++;
              }
              if (data.sequence === void 0) {
                const err445 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
                if (vErrors === null) {
                  vErrors = [err445];
                } else {
                  vErrors.push(err445);
                }
                errors++;
              }
              if (data.createdAt === void 0) {
                const err446 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
                if (vErrors === null) {
                  vErrors = [err446];
                } else {
                  vErrors.push(err446);
                }
                errors++;
              }
              if (data.scopes === void 0) {
                const err447 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
                if (vErrors === null) {
                  vErrors = [err447];
                } else {
                  vErrors.push(err447);
                }
                errors++;
              }
              if (data.type === void 0) {
                const err448 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
                if (vErrors === null) {
                  vErrors = [err448];
                } else {
                  vErrors.push(err448);
                }
                errors++;
              }
              if (data.data === void 0) {
                const err449 = { instancePath, schemaPath: "#/oneOf/6/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
                if (vErrors === null) {
                  vErrors = [err449];
                } else {
                  vErrors.push(err449);
                }
                errors++;
              }
              for (const key23 in data) {
                if (!(key23 === "contractVersion" || key23 === "eventId" || key23 === "binding" || key23 === "sequence" || key23 === "createdAt" || key23 === "scopes" || key23 === "type" || key23 === "data")) {
                  const err450 = { instancePath, schemaPath: "#/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key23 }, message: "must NOT have additional properties" };
                  if (vErrors === null) {
                    vErrors = [err450];
                  } else {
                    vErrors.push(err450);
                  }
                  errors++;
                }
              }
              if (data.contractVersion !== void 0) {
                if ("0.1.0" !== data.contractVersion) {
                  const err451 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/6/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err451];
                  } else {
                    vErrors.push(err451);
                  }
                  errors++;
                }
              }
              if (data.eventId !== void 0) {
                let data132 = data.eventId;
                if (typeof data132 === "string") {
                  if (!formats0.test(data132)) {
                    const err452 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/6/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                    if (vErrors === null) {
                      vErrors = [err452];
                    } else {
                      vErrors.push(err452);
                    }
                    errors++;
                  }
                } else {
                  const err453 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/6/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err453];
                  } else {
                    vErrors.push(err453);
                  }
                  errors++;
                }
              }
              if (data.binding !== void 0) {
                let data133 = data.binding;
                if (data133 && typeof data133 == "object" && !Array.isArray(data133)) {
                  if (data133.tenantId === void 0) {
                    const err454 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                    if (vErrors === null) {
                      vErrors = [err454];
                    } else {
                      vErrors.push(err454);
                    }
                    errors++;
                  }
                  if (data133.actorId === void 0) {
                    const err455 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                    if (vErrors === null) {
                      vErrors = [err455];
                    } else {
                      vErrors.push(err455);
                    }
                    errors++;
                  }
                  if (data133.conversationId === void 0) {
                    const err456 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                    if (vErrors === null) {
                      vErrors = [err456];
                    } else {
                      vErrors.push(err456);
                    }
                    errors++;
                  }
                  if (data133.runId === void 0) {
                    const err457 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                    if (vErrors === null) {
                      vErrors = [err457];
                    } else {
                      vErrors.push(err457);
                    }
                    errors++;
                  }
                  if (data133.attemptId === void 0) {
                    const err458 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                    if (vErrors === null) {
                      vErrors = [err458];
                    } else {
                      vErrors.push(err458);
                    }
                    errors++;
                  }
                  if (data133.workerId === void 0) {
                    const err459 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                    if (vErrors === null) {
                      vErrors = [err459];
                    } else {
                      vErrors.push(err459);
                    }
                    errors++;
                  }
                  if (data133.writerFence === void 0) {
                    const err460 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                    if (vErrors === null) {
                      vErrors = [err460];
                    } else {
                      vErrors.push(err460);
                    }
                    errors++;
                  }
                  for (const key24 in data133) {
                    if (!(key24 === "tenantId" || key24 === "actorId" || key24 === "conversationId" || key24 === "runId" || key24 === "attemptId" || key24 === "workerId" || key24 === "writerFence")) {
                      const err461 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key24 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err461];
                      } else {
                        vErrors.push(err461);
                      }
                      errors++;
                    }
                  }
                  if (data133.tenantId !== void 0) {
                    let data134 = data133.tenantId;
                    if (typeof data134 === "string") {
                      if (func1(data134) > 128) {
                        const err462 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                        if (vErrors === null) {
                          vErrors = [err462];
                        } else {
                          vErrors.push(err462);
                        }
                        errors++;
                      }
                      if (func1(data134) < 1) {
                        const err463 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err463];
                        } else {
                          vErrors.push(err463);
                        }
                        errors++;
                      }
                    } else {
                      const err464 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err464];
                      } else {
                        vErrors.push(err464);
                      }
                      errors++;
                    }
                  }
                  if (data133.actorId !== void 0) {
                    let data135 = data133.actorId;
                    if (typeof data135 === "string") {
                      if (func1(data135) > 128) {
                        const err465 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                        if (vErrors === null) {
                          vErrors = [err465];
                        } else {
                          vErrors.push(err465);
                        }
                        errors++;
                      }
                      if (func1(data135) < 1) {
                        const err466 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err466];
                        } else {
                          vErrors.push(err466);
                        }
                        errors++;
                      }
                    } else {
                      const err467 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err467];
                      } else {
                        vErrors.push(err467);
                      }
                      errors++;
                    }
                  }
                  if (data133.conversationId !== void 0) {
                    let data136 = data133.conversationId;
                    if (typeof data136 === "string") {
                      if (!formats0.test(data136)) {
                        const err468 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err468];
                        } else {
                          vErrors.push(err468);
                        }
                        errors++;
                      }
                    } else {
                      const err469 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err469];
                      } else {
                        vErrors.push(err469);
                      }
                      errors++;
                    }
                  }
                  if (data133.runId !== void 0) {
                    let data137 = data133.runId;
                    if (typeof data137 === "string") {
                      if (!formats0.test(data137)) {
                        const err470 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err470];
                        } else {
                          vErrors.push(err470);
                        }
                        errors++;
                      }
                    } else {
                      const err471 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err471];
                      } else {
                        vErrors.push(err471);
                      }
                      errors++;
                    }
                  }
                  if (data133.attemptId !== void 0) {
                    let data138 = data133.attemptId;
                    if (typeof data138 === "string") {
                      if (!formats0.test(data138)) {
                        const err472 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err472];
                        } else {
                          vErrors.push(err472);
                        }
                        errors++;
                      }
                    } else {
                      const err473 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err473];
                      } else {
                        vErrors.push(err473);
                      }
                      errors++;
                    }
                  }
                  if (data133.workerId !== void 0) {
                    let data139 = data133.workerId;
                    if (typeof data139 === "string") {
                      if (!formats0.test(data139)) {
                        const err474 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err474];
                        } else {
                          vErrors.push(err474);
                        }
                        errors++;
                      }
                    } else {
                      const err475 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err475];
                      } else {
                        vErrors.push(err475);
                      }
                      errors++;
                    }
                  }
                  if (data133.writerFence !== void 0) {
                    let data140 = data133.writerFence;
                    if (!(typeof data140 == "number" && (!(data140 % 1) && !isNaN(data140)) && isFinite(data140))) {
                      const err476 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                      if (vErrors === null) {
                        vErrors = [err476];
                      } else {
                        vErrors.push(err476);
                      }
                      errors++;
                    }
                    if (typeof data140 == "number" && isFinite(data140)) {
                      if (data140 > 9007199254740991 || isNaN(data140)) {
                        const err477 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                        if (vErrors === null) {
                          vErrors = [err477];
                        } else {
                          vErrors.push(err477);
                        }
                        errors++;
                      }
                      if (data140 < 1 || isNaN(data140)) {
                        const err478 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                        if (vErrors === null) {
                          vErrors = [err478];
                        } else {
                          vErrors.push(err478);
                        }
                        errors++;
                      }
                    }
                  }
                } else {
                  const err479 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err479];
                  } else {
                    vErrors.push(err479);
                  }
                  errors++;
                }
              }
              if (data.sequence !== void 0) {
                let data141 = data.sequence;
                if (!(typeof data141 == "number" && (!(data141 % 1) && !isNaN(data141)) && isFinite(data141))) {
                  const err480 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/6/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                  if (vErrors === null) {
                    vErrors = [err480];
                  } else {
                    vErrors.push(err480);
                  }
                  errors++;
                }
                if (typeof data141 == "number" && isFinite(data141)) {
                  if (data141 > 9007199254740991 || isNaN(data141)) {
                    const err481 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/6/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                    if (vErrors === null) {
                      vErrors = [err481];
                    } else {
                      vErrors.push(err481);
                    }
                    errors++;
                  }
                  if (data141 < 1 || isNaN(data141)) {
                    const err482 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/6/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                    if (vErrors === null) {
                      vErrors = [err482];
                    } else {
                      vErrors.push(err482);
                    }
                    errors++;
                  }
                }
              }
              if (data.createdAt !== void 0) {
                let data142 = data.createdAt;
                if (typeof data142 === "string") {
                  if (!pattern4.test(data142)) {
                    const err483 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/6/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                    if (vErrors === null) {
                      vErrors = [err483];
                    } else {
                      vErrors.push(err483);
                    }
                    errors++;
                  }
                  if (!formats10.validate(data142)) {
                    const err484 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/6/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                    if (vErrors === null) {
                      vErrors = [err484];
                    } else {
                      vErrors.push(err484);
                    }
                    errors++;
                  }
                } else {
                  const err485 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/6/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err485];
                  } else {
                    vErrors.push(err485);
                  }
                  errors++;
                }
              }
              if (data.scopes !== void 0) {
                let data143 = data.scopes;
                if (Array.isArray(data143)) {
                  if (data143.length < 1) {
                    const err486 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/6/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                    if (vErrors === null) {
                      vErrors = [err486];
                    } else {
                      vErrors.push(err486);
                    }
                    errors++;
                  }
                  const len6 = data143.length;
                  for (let i12 = 0; i12 < len6; i12++) {
                    let data144 = data143[i12];
                    if (data144 && typeof data144 == "object" && !Array.isArray(data144)) {
                      if (data144.tenantId === void 0) {
                        const err487 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                        if (vErrors === null) {
                          vErrors = [err487];
                        } else {
                          vErrors.push(err487);
                        }
                        errors++;
                      }
                      if (data144.kind === void 0) {
                        const err488 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                        if (vErrors === null) {
                          vErrors = [err488];
                        } else {
                          vErrors.push(err488);
                        }
                        errors++;
                      }
                      if (data144.resourceId === void 0) {
                        const err489 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                        if (vErrors === null) {
                          vErrors = [err489];
                        } else {
                          vErrors.push(err489);
                        }
                        errors++;
                      }
                      if (data144.policyRevision === void 0) {
                        const err490 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                        if (vErrors === null) {
                          vErrors = [err490];
                        } else {
                          vErrors.push(err490);
                        }
                        errors++;
                      }
                      for (const key25 in data144) {
                        if (!(key25 === "tenantId" || key25 === "kind" || key25 === "resourceId" || key25 === "policyRevision")) {
                          const err491 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key25 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err491];
                          } else {
                            vErrors.push(err491);
                          }
                          errors++;
                        }
                      }
                      if (data144.tenantId !== void 0) {
                        let data145 = data144.tenantId;
                        if (typeof data145 === "string") {
                          if (func1(data145) > 128) {
                            const err492 = { instancePath: instancePath + "/scopes/" + i12 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err492];
                            } else {
                              vErrors.push(err492);
                            }
                            errors++;
                          }
                          if (func1(data145) < 1) {
                            const err493 = { instancePath: instancePath + "/scopes/" + i12 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err493];
                            } else {
                              vErrors.push(err493);
                            }
                            errors++;
                          }
                        } else {
                          const err494 = { instancePath: instancePath + "/scopes/" + i12 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err494];
                          } else {
                            vErrors.push(err494);
                          }
                          errors++;
                        }
                      }
                      if (data144.kind !== void 0) {
                        let data146 = data144.kind;
                        if (typeof data146 !== "string") {
                          const err495 = { instancePath: instancePath + "/scopes/" + i12 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err495];
                          } else {
                            vErrors.push(err495);
                          }
                          errors++;
                        }
                        if (!(data146 === "tenant" || data146 === "client" || data146 === "mailbox" || data146 === "memory" || data146 === "document" || data146 === "private-user" || data146 === "public")) {
                          const err496 = { instancePath: instancePath + "/scopes/" + i12 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                          if (vErrors === null) {
                            vErrors = [err496];
                          } else {
                            vErrors.push(err496);
                          }
                          errors++;
                        }
                      }
                      if (data144.resourceId !== void 0) {
                        let data147 = data144.resourceId;
                        if (typeof data147 === "string") {
                          if (func1(data147) > 256) {
                            const err497 = { instancePath: instancePath + "/scopes/" + i12 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                            if (vErrors === null) {
                              vErrors = [err497];
                            } else {
                              vErrors.push(err497);
                            }
                            errors++;
                          }
                          if (func1(data147) < 1) {
                            const err498 = { instancePath: instancePath + "/scopes/" + i12 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err498];
                            } else {
                              vErrors.push(err498);
                            }
                            errors++;
                          }
                        } else {
                          const err499 = { instancePath: instancePath + "/scopes/" + i12 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err499];
                          } else {
                            vErrors.push(err499);
                          }
                          errors++;
                        }
                      }
                      if (data144.policyRevision !== void 0) {
                        let data148 = data144.policyRevision;
                        if (typeof data148 === "string") {
                          if (func1(data148) > 128) {
                            const err500 = { instancePath: instancePath + "/scopes/" + i12 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err500];
                            } else {
                              vErrors.push(err500);
                            }
                            errors++;
                          }
                          if (func1(data148) < 1) {
                            const err501 = { instancePath: instancePath + "/scopes/" + i12 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err501];
                            } else {
                              vErrors.push(err501);
                            }
                            errors++;
                          }
                        } else {
                          const err502 = { instancePath: instancePath + "/scopes/" + i12 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err502];
                          } else {
                            vErrors.push(err502);
                          }
                          errors++;
                        }
                      }
                    } else {
                      const err503 = { instancePath: instancePath + "/scopes/" + i12, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err503];
                      } else {
                        vErrors.push(err503);
                      }
                      errors++;
                    }
                  }
                  let i13 = data143.length;
                  let j6;
                  if (i13 > 1) {
                    outer6: for (; i13--; ) {
                      for (j6 = i13; j6--; ) {
                        if (func0(data143[i13], data143[j6])) {
                          const err504 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/6/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i13, j: j6 }, message: "must NOT have duplicate items (items ## " + j6 + " and " + i13 + " are identical)" };
                          if (vErrors === null) {
                            vErrors = [err504];
                          } else {
                            vErrors.push(err504);
                          }
                          errors++;
                          break outer6;
                        }
                      }
                    }
                  }
                } else {
                  const err505 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/6/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                  if (vErrors === null) {
                    vErrors = [err505];
                  } else {
                    vErrors.push(err505);
                  }
                  errors++;
                }
              }
              if (data.type !== void 0) {
                if ("artifact.available" !== data.type) {
                  const err506 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/6/properties/type/const", keyword: "const", params: { allowedValue: "artifact.available" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err506];
                  } else {
                    vErrors.push(err506);
                  }
                  errors++;
                }
              }
              if (data.data !== void 0) {
                let data150 = data.data;
                if (data150 && typeof data150 == "object" && !Array.isArray(data150)) {
                  if (data150.artifactId === void 0) {
                    const err507 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/6/properties/data/required", keyword: "required", params: { missingProperty: "artifactId" }, message: "must have required property 'artifactId'" };
                    if (vErrors === null) {
                      vErrors = [err507];
                    } else {
                      vErrors.push(err507);
                    }
                    errors++;
                  }
                  if (data150.versionId === void 0) {
                    const err508 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/6/properties/data/required", keyword: "required", params: { missingProperty: "versionId" }, message: "must have required property 'versionId'" };
                    if (vErrors === null) {
                      vErrors = [err508];
                    } else {
                      vErrors.push(err508);
                    }
                    errors++;
                  }
                  for (const key26 in data150) {
                    if (!(key26 === "artifactId" || key26 === "versionId")) {
                      const err509 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/6/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key26 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err509];
                      } else {
                        vErrors.push(err509);
                      }
                      errors++;
                    }
                  }
                  if (data150.artifactId !== void 0) {
                    let data151 = data150.artifactId;
                    if (typeof data151 === "string") {
                      if (!formats0.test(data151)) {
                        const err510 = { instancePath: instancePath + "/data/artifactId", schemaPath: "#/oneOf/6/properties/data/properties/artifactId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err510];
                        } else {
                          vErrors.push(err510);
                        }
                        errors++;
                      }
                    } else {
                      const err511 = { instancePath: instancePath + "/data/artifactId", schemaPath: "#/oneOf/6/properties/data/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err511];
                      } else {
                        vErrors.push(err511);
                      }
                      errors++;
                    }
                  }
                  if (data150.versionId !== void 0) {
                    let data152 = data150.versionId;
                    if (typeof data152 === "string") {
                      if (!formats0.test(data152)) {
                        const err512 = { instancePath: instancePath + "/data/versionId", schemaPath: "#/oneOf/6/properties/data/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err512];
                        } else {
                          vErrors.push(err512);
                        }
                        errors++;
                      }
                    } else {
                      const err513 = { instancePath: instancePath + "/data/versionId", schemaPath: "#/oneOf/6/properties/data/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err513];
                      } else {
                        vErrors.push(err513);
                      }
                      errors++;
                    }
                  }
                } else {
                  const err514 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/6/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err514];
                  } else {
                    vErrors.push(err514);
                  }
                  errors++;
                }
              }
            } else {
              const err515 = { instancePath, schemaPath: "#/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err515];
              } else {
                vErrors.push(err515);
              }
              errors++;
            }
            var _valid0 = _errs301 === errors;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = true;
                }
              }
              const _errs351 = errors;
              if (data && typeof data == "object" && !Array.isArray(data)) {
                if (data.contractVersion === void 0) {
                  const err516 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
                  if (vErrors === null) {
                    vErrors = [err516];
                  } else {
                    vErrors.push(err516);
                  }
                  errors++;
                }
                if (data.eventId === void 0) {
                  const err517 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
                  if (vErrors === null) {
                    vErrors = [err517];
                  } else {
                    vErrors.push(err517);
                  }
                  errors++;
                }
                if (data.binding === void 0) {
                  const err518 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
                  if (vErrors === null) {
                    vErrors = [err518];
                  } else {
                    vErrors.push(err518);
                  }
                  errors++;
                }
                if (data.sequence === void 0) {
                  const err519 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
                  if (vErrors === null) {
                    vErrors = [err519];
                  } else {
                    vErrors.push(err519);
                  }
                  errors++;
                }
                if (data.createdAt === void 0) {
                  const err520 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
                  if (vErrors === null) {
                    vErrors = [err520];
                  } else {
                    vErrors.push(err520);
                  }
                  errors++;
                }
                if (data.scopes === void 0) {
                  const err521 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
                  if (vErrors === null) {
                    vErrors = [err521];
                  } else {
                    vErrors.push(err521);
                  }
                  errors++;
                }
                if (data.type === void 0) {
                  const err522 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
                  if (vErrors === null) {
                    vErrors = [err522];
                  } else {
                    vErrors.push(err522);
                  }
                  errors++;
                }
                if (data.data === void 0) {
                  const err523 = { instancePath, schemaPath: "#/oneOf/7/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
                  if (vErrors === null) {
                    vErrors = [err523];
                  } else {
                    vErrors.push(err523);
                  }
                  errors++;
                }
                for (const key27 in data) {
                  if (!(key27 === "contractVersion" || key27 === "eventId" || key27 === "binding" || key27 === "sequence" || key27 === "createdAt" || key27 === "scopes" || key27 === "type" || key27 === "data")) {
                    const err524 = { instancePath, schemaPath: "#/oneOf/7/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key27 }, message: "must NOT have additional properties" };
                    if (vErrors === null) {
                      vErrors = [err524];
                    } else {
                      vErrors.push(err524);
                    }
                    errors++;
                  }
                }
                if (data.contractVersion !== void 0) {
                  if ("0.1.0" !== data.contractVersion) {
                    const err525 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/7/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err525];
                    } else {
                      vErrors.push(err525);
                    }
                    errors++;
                  }
                }
                if (data.eventId !== void 0) {
                  let data154 = data.eventId;
                  if (typeof data154 === "string") {
                    if (!formats0.test(data154)) {
                      const err526 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/7/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                      if (vErrors === null) {
                        vErrors = [err526];
                      } else {
                        vErrors.push(err526);
                      }
                      errors++;
                    }
                  } else {
                    const err527 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/7/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err527];
                    } else {
                      vErrors.push(err527);
                    }
                    errors++;
                  }
                }
                if (data.binding !== void 0) {
                  let data155 = data.binding;
                  if (data155 && typeof data155 == "object" && !Array.isArray(data155)) {
                    if (data155.tenantId === void 0) {
                      const err528 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                      if (vErrors === null) {
                        vErrors = [err528];
                      } else {
                        vErrors.push(err528);
                      }
                      errors++;
                    }
                    if (data155.actorId === void 0) {
                      const err529 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                      if (vErrors === null) {
                        vErrors = [err529];
                      } else {
                        vErrors.push(err529);
                      }
                      errors++;
                    }
                    if (data155.conversationId === void 0) {
                      const err530 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                      if (vErrors === null) {
                        vErrors = [err530];
                      } else {
                        vErrors.push(err530);
                      }
                      errors++;
                    }
                    if (data155.runId === void 0) {
                      const err531 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                      if (vErrors === null) {
                        vErrors = [err531];
                      } else {
                        vErrors.push(err531);
                      }
                      errors++;
                    }
                    if (data155.attemptId === void 0) {
                      const err532 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                      if (vErrors === null) {
                        vErrors = [err532];
                      } else {
                        vErrors.push(err532);
                      }
                      errors++;
                    }
                    if (data155.workerId === void 0) {
                      const err533 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                      if (vErrors === null) {
                        vErrors = [err533];
                      } else {
                        vErrors.push(err533);
                      }
                      errors++;
                    }
                    if (data155.writerFence === void 0) {
                      const err534 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                      if (vErrors === null) {
                        vErrors = [err534];
                      } else {
                        vErrors.push(err534);
                      }
                      errors++;
                    }
                    for (const key28 in data155) {
                      if (!(key28 === "tenantId" || key28 === "actorId" || key28 === "conversationId" || key28 === "runId" || key28 === "attemptId" || key28 === "workerId" || key28 === "writerFence")) {
                        const err535 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key28 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err535];
                        } else {
                          vErrors.push(err535);
                        }
                        errors++;
                      }
                    }
                    if (data155.tenantId !== void 0) {
                      let data156 = data155.tenantId;
                      if (typeof data156 === "string") {
                        if (func1(data156) > 128) {
                          const err536 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                          if (vErrors === null) {
                            vErrors = [err536];
                          } else {
                            vErrors.push(err536);
                          }
                          errors++;
                        }
                        if (func1(data156) < 1) {
                          const err537 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err537];
                          } else {
                            vErrors.push(err537);
                          }
                          errors++;
                        }
                      } else {
                        const err538 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err538];
                        } else {
                          vErrors.push(err538);
                        }
                        errors++;
                      }
                    }
                    if (data155.actorId !== void 0) {
                      let data157 = data155.actorId;
                      if (typeof data157 === "string") {
                        if (func1(data157) > 128) {
                          const err539 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                          if (vErrors === null) {
                            vErrors = [err539];
                          } else {
                            vErrors.push(err539);
                          }
                          errors++;
                        }
                        if (func1(data157) < 1) {
                          const err540 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err540];
                          } else {
                            vErrors.push(err540);
                          }
                          errors++;
                        }
                      } else {
                        const err541 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err541];
                        } else {
                          vErrors.push(err541);
                        }
                        errors++;
                      }
                    }
                    if (data155.conversationId !== void 0) {
                      let data158 = data155.conversationId;
                      if (typeof data158 === "string") {
                        if (!formats0.test(data158)) {
                          const err542 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err542];
                          } else {
                            vErrors.push(err542);
                          }
                          errors++;
                        }
                      } else {
                        const err543 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err543];
                        } else {
                          vErrors.push(err543);
                        }
                        errors++;
                      }
                    }
                    if (data155.runId !== void 0) {
                      let data159 = data155.runId;
                      if (typeof data159 === "string") {
                        if (!formats0.test(data159)) {
                          const err544 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err544];
                          } else {
                            vErrors.push(err544);
                          }
                          errors++;
                        }
                      } else {
                        const err545 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err545];
                        } else {
                          vErrors.push(err545);
                        }
                        errors++;
                      }
                    }
                    if (data155.attemptId !== void 0) {
                      let data160 = data155.attemptId;
                      if (typeof data160 === "string") {
                        if (!formats0.test(data160)) {
                          const err546 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err546];
                          } else {
                            vErrors.push(err546);
                          }
                          errors++;
                        }
                      } else {
                        const err547 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err547];
                        } else {
                          vErrors.push(err547);
                        }
                        errors++;
                      }
                    }
                    if (data155.workerId !== void 0) {
                      let data161 = data155.workerId;
                      if (typeof data161 === "string") {
                        if (!formats0.test(data161)) {
                          const err548 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err548];
                          } else {
                            vErrors.push(err548);
                          }
                          errors++;
                        }
                      } else {
                        const err549 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err549];
                        } else {
                          vErrors.push(err549);
                        }
                        errors++;
                      }
                    }
                    if (data155.writerFence !== void 0) {
                      let data162 = data155.writerFence;
                      if (!(typeof data162 == "number" && (!(data162 % 1) && !isNaN(data162)) && isFinite(data162))) {
                        const err550 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err550];
                        } else {
                          vErrors.push(err550);
                        }
                        errors++;
                      }
                      if (typeof data162 == "number" && isFinite(data162)) {
                        if (data162 > 9007199254740991 || isNaN(data162)) {
                          const err551 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                          if (vErrors === null) {
                            vErrors = [err551];
                          } else {
                            vErrors.push(err551);
                          }
                          errors++;
                        }
                        if (data162 < 1 || isNaN(data162)) {
                          const err552 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                          if (vErrors === null) {
                            vErrors = [err552];
                          } else {
                            vErrors.push(err552);
                          }
                          errors++;
                        }
                      }
                    }
                  } else {
                    const err553 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err553];
                    } else {
                      vErrors.push(err553);
                    }
                    errors++;
                  }
                }
                if (data.sequence !== void 0) {
                  let data163 = data.sequence;
                  if (!(typeof data163 == "number" && (!(data163 % 1) && !isNaN(data163)) && isFinite(data163))) {
                    const err554 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/7/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                    if (vErrors === null) {
                      vErrors = [err554];
                    } else {
                      vErrors.push(err554);
                    }
                    errors++;
                  }
                  if (typeof data163 == "number" && isFinite(data163)) {
                    if (data163 > 9007199254740991 || isNaN(data163)) {
                      const err555 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/7/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                      if (vErrors === null) {
                        vErrors = [err555];
                      } else {
                        vErrors.push(err555);
                      }
                      errors++;
                    }
                    if (data163 < 1 || isNaN(data163)) {
                      const err556 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/7/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                      if (vErrors === null) {
                        vErrors = [err556];
                      } else {
                        vErrors.push(err556);
                      }
                      errors++;
                    }
                  }
                }
                if (data.createdAt !== void 0) {
                  let data164 = data.createdAt;
                  if (typeof data164 === "string") {
                    if (!pattern4.test(data164)) {
                      const err557 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/7/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                      if (vErrors === null) {
                        vErrors = [err557];
                      } else {
                        vErrors.push(err557);
                      }
                      errors++;
                    }
                    if (!formats10.validate(data164)) {
                      const err558 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/7/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                      if (vErrors === null) {
                        vErrors = [err558];
                      } else {
                        vErrors.push(err558);
                      }
                      errors++;
                    }
                  } else {
                    const err559 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/7/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err559];
                    } else {
                      vErrors.push(err559);
                    }
                    errors++;
                  }
                }
                if (data.scopes !== void 0) {
                  let data165 = data.scopes;
                  if (Array.isArray(data165)) {
                    if (data165.length < 1) {
                      const err560 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/7/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                      if (vErrors === null) {
                        vErrors = [err560];
                      } else {
                        vErrors.push(err560);
                      }
                      errors++;
                    }
                    const len7 = data165.length;
                    for (let i14 = 0; i14 < len7; i14++) {
                      let data166 = data165[i14];
                      if (data166 && typeof data166 == "object" && !Array.isArray(data166)) {
                        if (data166.tenantId === void 0) {
                          const err561 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                          if (vErrors === null) {
                            vErrors = [err561];
                          } else {
                            vErrors.push(err561);
                          }
                          errors++;
                        }
                        if (data166.kind === void 0) {
                          const err562 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                          if (vErrors === null) {
                            vErrors = [err562];
                          } else {
                            vErrors.push(err562);
                          }
                          errors++;
                        }
                        if (data166.resourceId === void 0) {
                          const err563 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                          if (vErrors === null) {
                            vErrors = [err563];
                          } else {
                            vErrors.push(err563);
                          }
                          errors++;
                        }
                        if (data166.policyRevision === void 0) {
                          const err564 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                          if (vErrors === null) {
                            vErrors = [err564];
                          } else {
                            vErrors.push(err564);
                          }
                          errors++;
                        }
                        for (const key29 in data166) {
                          if (!(key29 === "tenantId" || key29 === "kind" || key29 === "resourceId" || key29 === "policyRevision")) {
                            const err565 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key29 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err565];
                            } else {
                              vErrors.push(err565);
                            }
                            errors++;
                          }
                        }
                        if (data166.tenantId !== void 0) {
                          let data167 = data166.tenantId;
                          if (typeof data167 === "string") {
                            if (func1(data167) > 128) {
                              const err566 = { instancePath: instancePath + "/scopes/" + i14 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                              if (vErrors === null) {
                                vErrors = [err566];
                              } else {
                                vErrors.push(err566);
                              }
                              errors++;
                            }
                            if (func1(data167) < 1) {
                              const err567 = { instancePath: instancePath + "/scopes/" + i14 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err567];
                              } else {
                                vErrors.push(err567);
                              }
                              errors++;
                            }
                          } else {
                            const err568 = { instancePath: instancePath + "/scopes/" + i14 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err568];
                            } else {
                              vErrors.push(err568);
                            }
                            errors++;
                          }
                        }
                        if (data166.kind !== void 0) {
                          let data168 = data166.kind;
                          if (typeof data168 !== "string") {
                            const err569 = { instancePath: instancePath + "/scopes/" + i14 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err569];
                            } else {
                              vErrors.push(err569);
                            }
                            errors++;
                          }
                          if (!(data168 === "tenant" || data168 === "client" || data168 === "mailbox" || data168 === "memory" || data168 === "document" || data168 === "private-user" || data168 === "public")) {
                            const err570 = { instancePath: instancePath + "/scopes/" + i14 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err570];
                            } else {
                              vErrors.push(err570);
                            }
                            errors++;
                          }
                        }
                        if (data166.resourceId !== void 0) {
                          let data169 = data166.resourceId;
                          if (typeof data169 === "string") {
                            if (func1(data169) > 256) {
                              const err571 = { instancePath: instancePath + "/scopes/" + i14 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                              if (vErrors === null) {
                                vErrors = [err571];
                              } else {
                                vErrors.push(err571);
                              }
                              errors++;
                            }
                            if (func1(data169) < 1) {
                              const err572 = { instancePath: instancePath + "/scopes/" + i14 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err572];
                              } else {
                                vErrors.push(err572);
                              }
                              errors++;
                            }
                          } else {
                            const err573 = { instancePath: instancePath + "/scopes/" + i14 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err573];
                            } else {
                              vErrors.push(err573);
                            }
                            errors++;
                          }
                        }
                        if (data166.policyRevision !== void 0) {
                          let data170 = data166.policyRevision;
                          if (typeof data170 === "string") {
                            if (func1(data170) > 128) {
                              const err574 = { instancePath: instancePath + "/scopes/" + i14 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                              if (vErrors === null) {
                                vErrors = [err574];
                              } else {
                                vErrors.push(err574);
                              }
                              errors++;
                            }
                            if (func1(data170) < 1) {
                              const err575 = { instancePath: instancePath + "/scopes/" + i14 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err575];
                              } else {
                                vErrors.push(err575);
                              }
                              errors++;
                            }
                          } else {
                            const err576 = { instancePath: instancePath + "/scopes/" + i14 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err576];
                            } else {
                              vErrors.push(err576);
                            }
                            errors++;
                          }
                        }
                      } else {
                        const err577 = { instancePath: instancePath + "/scopes/" + i14, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err577];
                        } else {
                          vErrors.push(err577);
                        }
                        errors++;
                      }
                    }
                    let i15 = data165.length;
                    let j7;
                    if (i15 > 1) {
                      outer7: for (; i15--; ) {
                        for (j7 = i15; j7--; ) {
                          if (func0(data165[i15], data165[j7])) {
                            const err578 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/7/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i15, j: j7 }, message: "must NOT have duplicate items (items ## " + j7 + " and " + i15 + " are identical)" };
                            if (vErrors === null) {
                              vErrors = [err578];
                            } else {
                              vErrors.push(err578);
                            }
                            errors++;
                            break outer7;
                          }
                        }
                      }
                    }
                  } else {
                    const err579 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/7/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                    if (vErrors === null) {
                      vErrors = [err579];
                    } else {
                      vErrors.push(err579);
                    }
                    errors++;
                  }
                }
                if (data.type !== void 0) {
                  if ("checkpoint.verified" !== data.type) {
                    const err580 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/7/properties/type/const", keyword: "const", params: { allowedValue: "checkpoint.verified" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err580];
                    } else {
                      vErrors.push(err580);
                    }
                    errors++;
                  }
                }
                if (data.data !== void 0) {
                  let data172 = data.data;
                  if (data172 && typeof data172 == "object" && !Array.isArray(data172)) {
                    if (data172.checkpointId === void 0) {
                      const err581 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/7/properties/data/required", keyword: "required", params: { missingProperty: "checkpointId" }, message: "must have required property 'checkpointId'" };
                      if (vErrors === null) {
                        vErrors = [err581];
                      } else {
                        vErrors.push(err581);
                      }
                      errors++;
                    }
                    for (const key30 in data172) {
                      if (!(key30 === "checkpointId")) {
                        const err582 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/7/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key30 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err582];
                        } else {
                          vErrors.push(err582);
                        }
                        errors++;
                      }
                    }
                    if (data172.checkpointId !== void 0) {
                      let data173 = data172.checkpointId;
                      if (typeof data173 === "string") {
                        if (!formats0.test(data173)) {
                          const err583 = { instancePath: instancePath + "/data/checkpointId", schemaPath: "#/oneOf/7/properties/data/properties/checkpointId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err583];
                          } else {
                            vErrors.push(err583);
                          }
                          errors++;
                        }
                      } else {
                        const err584 = { instancePath: instancePath + "/data/checkpointId", schemaPath: "#/oneOf/7/properties/data/properties/checkpointId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err584];
                        } else {
                          vErrors.push(err584);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err585 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/7/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err585];
                    } else {
                      vErrors.push(err585);
                    }
                    errors++;
                  }
                }
              } else {
                const err586 = { instancePath, schemaPath: "#/oneOf/7/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err586];
                } else {
                  vErrors.push(err586);
                }
                errors++;
              }
              var _valid0 = _errs351 === errors;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
                const _errs399 = errors;
                if (data && typeof data == "object" && !Array.isArray(data)) {
                  if (data.contractVersion === void 0) {
                    const err587 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
                    if (vErrors === null) {
                      vErrors = [err587];
                    } else {
                      vErrors.push(err587);
                    }
                    errors++;
                  }
                  if (data.eventId === void 0) {
                    const err588 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
                    if (vErrors === null) {
                      vErrors = [err588];
                    } else {
                      vErrors.push(err588);
                    }
                    errors++;
                  }
                  if (data.binding === void 0) {
                    const err589 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
                    if (vErrors === null) {
                      vErrors = [err589];
                    } else {
                      vErrors.push(err589);
                    }
                    errors++;
                  }
                  if (data.sequence === void 0) {
                    const err590 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
                    if (vErrors === null) {
                      vErrors = [err590];
                    } else {
                      vErrors.push(err590);
                    }
                    errors++;
                  }
                  if (data.createdAt === void 0) {
                    const err591 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
                    if (vErrors === null) {
                      vErrors = [err591];
                    } else {
                      vErrors.push(err591);
                    }
                    errors++;
                  }
                  if (data.scopes === void 0) {
                    const err592 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
                    if (vErrors === null) {
                      vErrors = [err592];
                    } else {
                      vErrors.push(err592);
                    }
                    errors++;
                  }
                  if (data.type === void 0) {
                    const err593 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
                    if (vErrors === null) {
                      vErrors = [err593];
                    } else {
                      vErrors.push(err593);
                    }
                    errors++;
                  }
                  if (data.data === void 0) {
                    const err594 = { instancePath, schemaPath: "#/oneOf/8/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
                    if (vErrors === null) {
                      vErrors = [err594];
                    } else {
                      vErrors.push(err594);
                    }
                    errors++;
                  }
                  for (const key31 in data) {
                    if (!(key31 === "contractVersion" || key31 === "eventId" || key31 === "binding" || key31 === "sequence" || key31 === "createdAt" || key31 === "scopes" || key31 === "type" || key31 === "data")) {
                      const err595 = { instancePath, schemaPath: "#/oneOf/8/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key31 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err595];
                      } else {
                        vErrors.push(err595);
                      }
                      errors++;
                    }
                  }
                  if (data.contractVersion !== void 0) {
                    if ("0.1.0" !== data.contractVersion) {
                      const err596 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/8/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err596];
                      } else {
                        vErrors.push(err596);
                      }
                      errors++;
                    }
                  }
                  if (data.eventId !== void 0) {
                    let data175 = data.eventId;
                    if (typeof data175 === "string") {
                      if (!formats0.test(data175)) {
                        const err597 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/8/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                        if (vErrors === null) {
                          vErrors = [err597];
                        } else {
                          vErrors.push(err597);
                        }
                        errors++;
                      }
                    } else {
                      const err598 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/8/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err598];
                      } else {
                        vErrors.push(err598);
                      }
                      errors++;
                    }
                  }
                  if (data.binding !== void 0) {
                    let data176 = data.binding;
                    if (data176 && typeof data176 == "object" && !Array.isArray(data176)) {
                      if (data176.tenantId === void 0) {
                        const err599 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                        if (vErrors === null) {
                          vErrors = [err599];
                        } else {
                          vErrors.push(err599);
                        }
                        errors++;
                      }
                      if (data176.actorId === void 0) {
                        const err600 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                        if (vErrors === null) {
                          vErrors = [err600];
                        } else {
                          vErrors.push(err600);
                        }
                        errors++;
                      }
                      if (data176.conversationId === void 0) {
                        const err601 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                        if (vErrors === null) {
                          vErrors = [err601];
                        } else {
                          vErrors.push(err601);
                        }
                        errors++;
                      }
                      if (data176.runId === void 0) {
                        const err602 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                        if (vErrors === null) {
                          vErrors = [err602];
                        } else {
                          vErrors.push(err602);
                        }
                        errors++;
                      }
                      if (data176.attemptId === void 0) {
                        const err603 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                        if (vErrors === null) {
                          vErrors = [err603];
                        } else {
                          vErrors.push(err603);
                        }
                        errors++;
                      }
                      if (data176.workerId === void 0) {
                        const err604 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                        if (vErrors === null) {
                          vErrors = [err604];
                        } else {
                          vErrors.push(err604);
                        }
                        errors++;
                      }
                      if (data176.writerFence === void 0) {
                        const err605 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                        if (vErrors === null) {
                          vErrors = [err605];
                        } else {
                          vErrors.push(err605);
                        }
                        errors++;
                      }
                      for (const key32 in data176) {
                        if (!(key32 === "tenantId" || key32 === "actorId" || key32 === "conversationId" || key32 === "runId" || key32 === "attemptId" || key32 === "workerId" || key32 === "writerFence")) {
                          const err606 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key32 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err606];
                          } else {
                            vErrors.push(err606);
                          }
                          errors++;
                        }
                      }
                      if (data176.tenantId !== void 0) {
                        let data177 = data176.tenantId;
                        if (typeof data177 === "string") {
                          if (func1(data177) > 128) {
                            const err607 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err607];
                            } else {
                              vErrors.push(err607);
                            }
                            errors++;
                          }
                          if (func1(data177) < 1) {
                            const err608 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err608];
                            } else {
                              vErrors.push(err608);
                            }
                            errors++;
                          }
                        } else {
                          const err609 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err609];
                          } else {
                            vErrors.push(err609);
                          }
                          errors++;
                        }
                      }
                      if (data176.actorId !== void 0) {
                        let data178 = data176.actorId;
                        if (typeof data178 === "string") {
                          if (func1(data178) > 128) {
                            const err610 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                            if (vErrors === null) {
                              vErrors = [err610];
                            } else {
                              vErrors.push(err610);
                            }
                            errors++;
                          }
                          if (func1(data178) < 1) {
                            const err611 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err611];
                            } else {
                              vErrors.push(err611);
                            }
                            errors++;
                          }
                        } else {
                          const err612 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err612];
                          } else {
                            vErrors.push(err612);
                          }
                          errors++;
                        }
                      }
                      if (data176.conversationId !== void 0) {
                        let data179 = data176.conversationId;
                        if (typeof data179 === "string") {
                          if (!formats0.test(data179)) {
                            const err613 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err613];
                            } else {
                              vErrors.push(err613);
                            }
                            errors++;
                          }
                        } else {
                          const err614 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err614];
                          } else {
                            vErrors.push(err614);
                          }
                          errors++;
                        }
                      }
                      if (data176.runId !== void 0) {
                        let data180 = data176.runId;
                        if (typeof data180 === "string") {
                          if (!formats0.test(data180)) {
                            const err615 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err615];
                            } else {
                              vErrors.push(err615);
                            }
                            errors++;
                          }
                        } else {
                          const err616 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err616];
                          } else {
                            vErrors.push(err616);
                          }
                          errors++;
                        }
                      }
                      if (data176.attemptId !== void 0) {
                        let data181 = data176.attemptId;
                        if (typeof data181 === "string") {
                          if (!formats0.test(data181)) {
                            const err617 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err617];
                            } else {
                              vErrors.push(err617);
                            }
                            errors++;
                          }
                        } else {
                          const err618 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err618];
                          } else {
                            vErrors.push(err618);
                          }
                          errors++;
                        }
                      }
                      if (data176.workerId !== void 0) {
                        let data182 = data176.workerId;
                        if (typeof data182 === "string") {
                          if (!formats0.test(data182)) {
                            const err619 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err619];
                            } else {
                              vErrors.push(err619);
                            }
                            errors++;
                          }
                        } else {
                          const err620 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err620];
                          } else {
                            vErrors.push(err620);
                          }
                          errors++;
                        }
                      }
                      if (data176.writerFence !== void 0) {
                        let data183 = data176.writerFence;
                        if (!(typeof data183 == "number" && (!(data183 % 1) && !isNaN(data183)) && isFinite(data183))) {
                          const err621 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                          if (vErrors === null) {
                            vErrors = [err621];
                          } else {
                            vErrors.push(err621);
                          }
                          errors++;
                        }
                        if (typeof data183 == "number" && isFinite(data183)) {
                          if (data183 > 9007199254740991 || isNaN(data183)) {
                            const err622 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                            if (vErrors === null) {
                              vErrors = [err622];
                            } else {
                              vErrors.push(err622);
                            }
                            errors++;
                          }
                          if (data183 < 1 || isNaN(data183)) {
                            const err623 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                            if (vErrors === null) {
                              vErrors = [err623];
                            } else {
                              vErrors.push(err623);
                            }
                            errors++;
                          }
                        }
                      }
                    } else {
                      const err624 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err624];
                      } else {
                        vErrors.push(err624);
                      }
                      errors++;
                    }
                  }
                  if (data.sequence !== void 0) {
                    let data184 = data.sequence;
                    if (!(typeof data184 == "number" && (!(data184 % 1) && !isNaN(data184)) && isFinite(data184))) {
                      const err625 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/8/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                      if (vErrors === null) {
                        vErrors = [err625];
                      } else {
                        vErrors.push(err625);
                      }
                      errors++;
                    }
                    if (typeof data184 == "number" && isFinite(data184)) {
                      if (data184 > 9007199254740991 || isNaN(data184)) {
                        const err626 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/8/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                        if (vErrors === null) {
                          vErrors = [err626];
                        } else {
                          vErrors.push(err626);
                        }
                        errors++;
                      }
                      if (data184 < 1 || isNaN(data184)) {
                        const err627 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/8/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                        if (vErrors === null) {
                          vErrors = [err627];
                        } else {
                          vErrors.push(err627);
                        }
                        errors++;
                      }
                    }
                  }
                  if (data.createdAt !== void 0) {
                    let data185 = data.createdAt;
                    if (typeof data185 === "string") {
                      if (!pattern4.test(data185)) {
                        const err628 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/8/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                        if (vErrors === null) {
                          vErrors = [err628];
                        } else {
                          vErrors.push(err628);
                        }
                        errors++;
                      }
                      if (!formats10.validate(data185)) {
                        const err629 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/8/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                        if (vErrors === null) {
                          vErrors = [err629];
                        } else {
                          vErrors.push(err629);
                        }
                        errors++;
                      }
                    } else {
                      const err630 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/8/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err630];
                      } else {
                        vErrors.push(err630);
                      }
                      errors++;
                    }
                  }
                  if (data.scopes !== void 0) {
                    let data186 = data.scopes;
                    if (Array.isArray(data186)) {
                      if (data186.length < 1) {
                        const err631 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/8/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                        if (vErrors === null) {
                          vErrors = [err631];
                        } else {
                          vErrors.push(err631);
                        }
                        errors++;
                      }
                      const len8 = data186.length;
                      for (let i16 = 0; i16 < len8; i16++) {
                        let data187 = data186[i16];
                        if (data187 && typeof data187 == "object" && !Array.isArray(data187)) {
                          if (data187.tenantId === void 0) {
                            const err632 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                            if (vErrors === null) {
                              vErrors = [err632];
                            } else {
                              vErrors.push(err632);
                            }
                            errors++;
                          }
                          if (data187.kind === void 0) {
                            const err633 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                            if (vErrors === null) {
                              vErrors = [err633];
                            } else {
                              vErrors.push(err633);
                            }
                            errors++;
                          }
                          if (data187.resourceId === void 0) {
                            const err634 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                            if (vErrors === null) {
                              vErrors = [err634];
                            } else {
                              vErrors.push(err634);
                            }
                            errors++;
                          }
                          if (data187.policyRevision === void 0) {
                            const err635 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                            if (vErrors === null) {
                              vErrors = [err635];
                            } else {
                              vErrors.push(err635);
                            }
                            errors++;
                          }
                          for (const key33 in data187) {
                            if (!(key33 === "tenantId" || key33 === "kind" || key33 === "resourceId" || key33 === "policyRevision")) {
                              const err636 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key33 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err636];
                              } else {
                                vErrors.push(err636);
                              }
                              errors++;
                            }
                          }
                          if (data187.tenantId !== void 0) {
                            let data188 = data187.tenantId;
                            if (typeof data188 === "string") {
                              if (func1(data188) > 128) {
                                const err637 = { instancePath: instancePath + "/scopes/" + i16 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                if (vErrors === null) {
                                  vErrors = [err637];
                                } else {
                                  vErrors.push(err637);
                                }
                                errors++;
                              }
                              if (func1(data188) < 1) {
                                const err638 = { instancePath: instancePath + "/scopes/" + i16 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                if (vErrors === null) {
                                  vErrors = [err638];
                                } else {
                                  vErrors.push(err638);
                                }
                                errors++;
                              }
                            } else {
                              const err639 = { instancePath: instancePath + "/scopes/" + i16 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err639];
                              } else {
                                vErrors.push(err639);
                              }
                              errors++;
                            }
                          }
                          if (data187.kind !== void 0) {
                            let data189 = data187.kind;
                            if (typeof data189 !== "string") {
                              const err640 = { instancePath: instancePath + "/scopes/" + i16 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err640];
                              } else {
                                vErrors.push(err640);
                              }
                              errors++;
                            }
                            if (!(data189 === "tenant" || data189 === "client" || data189 === "mailbox" || data189 === "memory" || data189 === "document" || data189 === "private-user" || data189 === "public")) {
                              const err641 = { instancePath: instancePath + "/scopes/" + i16 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err641];
                              } else {
                                vErrors.push(err641);
                              }
                              errors++;
                            }
                          }
                          if (data187.resourceId !== void 0) {
                            let data190 = data187.resourceId;
                            if (typeof data190 === "string") {
                              if (func1(data190) > 256) {
                                const err642 = { instancePath: instancePath + "/scopes/" + i16 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                if (vErrors === null) {
                                  vErrors = [err642];
                                } else {
                                  vErrors.push(err642);
                                }
                                errors++;
                              }
                              if (func1(data190) < 1) {
                                const err643 = { instancePath: instancePath + "/scopes/" + i16 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                if (vErrors === null) {
                                  vErrors = [err643];
                                } else {
                                  vErrors.push(err643);
                                }
                                errors++;
                              }
                            } else {
                              const err644 = { instancePath: instancePath + "/scopes/" + i16 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err644];
                              } else {
                                vErrors.push(err644);
                              }
                              errors++;
                            }
                          }
                          if (data187.policyRevision !== void 0) {
                            let data191 = data187.policyRevision;
                            if (typeof data191 === "string") {
                              if (func1(data191) > 128) {
                                const err645 = { instancePath: instancePath + "/scopes/" + i16 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                if (vErrors === null) {
                                  vErrors = [err645];
                                } else {
                                  vErrors.push(err645);
                                }
                                errors++;
                              }
                              if (func1(data191) < 1) {
                                const err646 = { instancePath: instancePath + "/scopes/" + i16 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                if (vErrors === null) {
                                  vErrors = [err646];
                                } else {
                                  vErrors.push(err646);
                                }
                                errors++;
                              }
                            } else {
                              const err647 = { instancePath: instancePath + "/scopes/" + i16 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err647];
                              } else {
                                vErrors.push(err647);
                              }
                              errors++;
                            }
                          }
                        } else {
                          const err648 = { instancePath: instancePath + "/scopes/" + i16, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err648];
                          } else {
                            vErrors.push(err648);
                          }
                          errors++;
                        }
                      }
                      let i17 = data186.length;
                      let j8;
                      if (i17 > 1) {
                        outer8: for (; i17--; ) {
                          for (j8 = i17; j8--; ) {
                            if (func0(data186[i17], data186[j8])) {
                              const err649 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/8/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i17, j: j8 }, message: "must NOT have duplicate items (items ## " + j8 + " and " + i17 + " are identical)" };
                              if (vErrors === null) {
                                vErrors = [err649];
                              } else {
                                vErrors.push(err649);
                              }
                              errors++;
                              break outer8;
                            }
                          }
                        }
                      }
                    } else {
                      const err650 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/8/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                      if (vErrors === null) {
                        vErrors = [err650];
                      } else {
                        vErrors.push(err650);
                      }
                      errors++;
                    }
                  }
                  if (data.type !== void 0) {
                    if ("usage.recorded" !== data.type) {
                      const err651 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/8/properties/type/const", keyword: "const", params: { allowedValue: "usage.recorded" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err651];
                      } else {
                        vErrors.push(err651);
                      }
                      errors++;
                    }
                  }
                  if (data.data !== void 0) {
                    let data193 = data.data;
                    if (data193 && typeof data193 == "object" && !Array.isArray(data193)) {
                      if (data193.usageId === void 0) {
                        const err652 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/8/properties/data/required", keyword: "required", params: { missingProperty: "usageId" }, message: "must have required property 'usageId'" };
                        if (vErrors === null) {
                          vErrors = [err652];
                        } else {
                          vErrors.push(err652);
                        }
                        errors++;
                      }
                      for (const key34 in data193) {
                        if (!(key34 === "usageId")) {
                          const err653 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/8/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key34 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err653];
                          } else {
                            vErrors.push(err653);
                          }
                          errors++;
                        }
                      }
                      if (data193.usageId !== void 0) {
                        let data194 = data193.usageId;
                        if (typeof data194 === "string") {
                          if (!formats0.test(data194)) {
                            const err654 = { instancePath: instancePath + "/data/usageId", schemaPath: "#/oneOf/8/properties/data/properties/usageId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err654];
                            } else {
                              vErrors.push(err654);
                            }
                            errors++;
                          }
                        } else {
                          const err655 = { instancePath: instancePath + "/data/usageId", schemaPath: "#/oneOf/8/properties/data/properties/usageId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err655];
                          } else {
                            vErrors.push(err655);
                          }
                          errors++;
                        }
                      }
                    } else {
                      const err656 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/8/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err656];
                      } else {
                        vErrors.push(err656);
                      }
                      errors++;
                    }
                  }
                } else {
                  const err657 = { instancePath, schemaPath: "#/oneOf/8/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err657];
                  } else {
                    vErrors.push(err657);
                  }
                  errors++;
                }
                var _valid0 = _errs399 === errors;
                if (_valid0 && valid0) {
                  valid0 = false;
                  passing0 = [passing0, 8];
                } else {
                  if (_valid0) {
                    valid0 = true;
                    passing0 = 8;
                    if (props0 !== true) {
                      props0 = true;
                    }
                  }
                  const _errs447 = errors;
                  if (data && typeof data == "object" && !Array.isArray(data)) {
                    if (data.contractVersion === void 0) {
                      const err658 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "contractVersion" }, message: "must have required property 'contractVersion'" };
                      if (vErrors === null) {
                        vErrors = [err658];
                      } else {
                        vErrors.push(err658);
                      }
                      errors++;
                    }
                    if (data.eventId === void 0) {
                      const err659 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "eventId" }, message: "must have required property 'eventId'" };
                      if (vErrors === null) {
                        vErrors = [err659];
                      } else {
                        vErrors.push(err659);
                      }
                      errors++;
                    }
                    if (data.binding === void 0) {
                      const err660 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "binding" }, message: "must have required property 'binding'" };
                      if (vErrors === null) {
                        vErrors = [err660];
                      } else {
                        vErrors.push(err660);
                      }
                      errors++;
                    }
                    if (data.sequence === void 0) {
                      const err661 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "sequence" }, message: "must have required property 'sequence'" };
                      if (vErrors === null) {
                        vErrors = [err661];
                      } else {
                        vErrors.push(err661);
                      }
                      errors++;
                    }
                    if (data.createdAt === void 0) {
                      const err662 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "createdAt" }, message: "must have required property 'createdAt'" };
                      if (vErrors === null) {
                        vErrors = [err662];
                      } else {
                        vErrors.push(err662);
                      }
                      errors++;
                    }
                    if (data.scopes === void 0) {
                      const err663 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "scopes" }, message: "must have required property 'scopes'" };
                      if (vErrors === null) {
                        vErrors = [err663];
                      } else {
                        vErrors.push(err663);
                      }
                      errors++;
                    }
                    if (data.type === void 0) {
                      const err664 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
                      if (vErrors === null) {
                        vErrors = [err664];
                      } else {
                        vErrors.push(err664);
                      }
                      errors++;
                    }
                    if (data.data === void 0) {
                      const err665 = { instancePath, schemaPath: "#/oneOf/9/required", keyword: "required", params: { missingProperty: "data" }, message: "must have required property 'data'" };
                      if (vErrors === null) {
                        vErrors = [err665];
                      } else {
                        vErrors.push(err665);
                      }
                      errors++;
                    }
                    for (const key35 in data) {
                      if (!(key35 === "contractVersion" || key35 === "eventId" || key35 === "binding" || key35 === "sequence" || key35 === "createdAt" || key35 === "scopes" || key35 === "type" || key35 === "data")) {
                        const err666 = { instancePath, schemaPath: "#/oneOf/9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key35 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err666];
                        } else {
                          vErrors.push(err666);
                        }
                        errors++;
                      }
                    }
                    if (data.contractVersion !== void 0) {
                      if ("0.1.0" !== data.contractVersion) {
                        const err667 = { instancePath: instancePath + "/contractVersion", schemaPath: "#/oneOf/9/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err667];
                        } else {
                          vErrors.push(err667);
                        }
                        errors++;
                      }
                    }
                    if (data.eventId !== void 0) {
                      let data196 = data.eventId;
                      if (typeof data196 === "string") {
                        if (!formats0.test(data196)) {
                          const err668 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/9/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err668];
                          } else {
                            vErrors.push(err668);
                          }
                          errors++;
                        }
                      } else {
                        const err669 = { instancePath: instancePath + "/eventId", schemaPath: "#/oneOf/9/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err669];
                        } else {
                          vErrors.push(err669);
                        }
                        errors++;
                      }
                    }
                    if (data.binding !== void 0) {
                      let data197 = data.binding;
                      if (data197 && typeof data197 == "object" && !Array.isArray(data197)) {
                        if (data197.tenantId === void 0) {
                          const err670 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                          if (vErrors === null) {
                            vErrors = [err670];
                          } else {
                            vErrors.push(err670);
                          }
                          errors++;
                        }
                        if (data197.actorId === void 0) {
                          const err671 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "actorId" }, message: "must have required property 'actorId'" };
                          if (vErrors === null) {
                            vErrors = [err671];
                          } else {
                            vErrors.push(err671);
                          }
                          errors++;
                        }
                        if (data197.conversationId === void 0) {
                          const err672 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "conversationId" }, message: "must have required property 'conversationId'" };
                          if (vErrors === null) {
                            vErrors = [err672];
                          } else {
                            vErrors.push(err672);
                          }
                          errors++;
                        }
                        if (data197.runId === void 0) {
                          const err673 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "runId" }, message: "must have required property 'runId'" };
                          if (vErrors === null) {
                            vErrors = [err673];
                          } else {
                            vErrors.push(err673);
                          }
                          errors++;
                        }
                        if (data197.attemptId === void 0) {
                          const err674 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "attemptId" }, message: "must have required property 'attemptId'" };
                          if (vErrors === null) {
                            vErrors = [err674];
                          } else {
                            vErrors.push(err674);
                          }
                          errors++;
                        }
                        if (data197.workerId === void 0) {
                          const err675 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "workerId" }, message: "must have required property 'workerId'" };
                          if (vErrors === null) {
                            vErrors = [err675];
                          } else {
                            vErrors.push(err675);
                          }
                          errors++;
                        }
                        if (data197.writerFence === void 0) {
                          const err676 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/required", keyword: "required", params: { missingProperty: "writerFence" }, message: "must have required property 'writerFence'" };
                          if (vErrors === null) {
                            vErrors = [err676];
                          } else {
                            vErrors.push(err676);
                          }
                          errors++;
                        }
                        for (const key36 in data197) {
                          if (!(key36 === "tenantId" || key36 === "actorId" || key36 === "conversationId" || key36 === "runId" || key36 === "attemptId" || key36 === "workerId" || key36 === "writerFence")) {
                            const err677 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key36 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err677];
                            } else {
                              vErrors.push(err677);
                            }
                            errors++;
                          }
                        }
                        if (data197.tenantId !== void 0) {
                          let data198 = data197.tenantId;
                          if (typeof data198 === "string") {
                            if (func1(data198) > 128) {
                              const err678 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                              if (vErrors === null) {
                                vErrors = [err678];
                              } else {
                                vErrors.push(err678);
                              }
                              errors++;
                            }
                            if (func1(data198) < 1) {
                              const err679 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err679];
                              } else {
                                vErrors.push(err679);
                              }
                              errors++;
                            }
                          } else {
                            const err680 = { instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err680];
                            } else {
                              vErrors.push(err680);
                            }
                            errors++;
                          }
                        }
                        if (data197.actorId !== void 0) {
                          let data199 = data197.actorId;
                          if (typeof data199 === "string") {
                            if (func1(data199) > 128) {
                              const err681 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                              if (vErrors === null) {
                                vErrors = [err681];
                              } else {
                                vErrors.push(err681);
                              }
                              errors++;
                            }
                            if (func1(data199) < 1) {
                              const err682 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err682];
                              } else {
                                vErrors.push(err682);
                              }
                              errors++;
                            }
                          } else {
                            const err683 = { instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err683];
                            } else {
                              vErrors.push(err683);
                            }
                            errors++;
                          }
                        }
                        if (data197.conversationId !== void 0) {
                          let data200 = data197.conversationId;
                          if (typeof data200 === "string") {
                            if (!formats0.test(data200)) {
                              const err684 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                              if (vErrors === null) {
                                vErrors = [err684];
                              } else {
                                vErrors.push(err684);
                              }
                              errors++;
                            }
                          } else {
                            const err685 = { instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err685];
                            } else {
                              vErrors.push(err685);
                            }
                            errors++;
                          }
                        }
                        if (data197.runId !== void 0) {
                          let data201 = data197.runId;
                          if (typeof data201 === "string") {
                            if (!formats0.test(data201)) {
                              const err686 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                              if (vErrors === null) {
                                vErrors = [err686];
                              } else {
                                vErrors.push(err686);
                              }
                              errors++;
                            }
                          } else {
                            const err687 = { instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err687];
                            } else {
                              vErrors.push(err687);
                            }
                            errors++;
                          }
                        }
                        if (data197.attemptId !== void 0) {
                          let data202 = data197.attemptId;
                          if (typeof data202 === "string") {
                            if (!formats0.test(data202)) {
                              const err688 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                              if (vErrors === null) {
                                vErrors = [err688];
                              } else {
                                vErrors.push(err688);
                              }
                              errors++;
                            }
                          } else {
                            const err689 = { instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err689];
                            } else {
                              vErrors.push(err689);
                            }
                            errors++;
                          }
                        }
                        if (data197.workerId !== void 0) {
                          let data203 = data197.workerId;
                          if (typeof data203 === "string") {
                            if (!formats0.test(data203)) {
                              const err690 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                              if (vErrors === null) {
                                vErrors = [err690];
                              } else {
                                vErrors.push(err690);
                              }
                              errors++;
                            }
                          } else {
                            const err691 = { instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err691];
                            } else {
                              vErrors.push(err691);
                            }
                            errors++;
                          }
                        }
                        if (data197.writerFence !== void 0) {
                          let data204 = data197.writerFence;
                          if (!(typeof data204 == "number" && (!(data204 % 1) && !isNaN(data204)) && isFinite(data204))) {
                            const err692 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err692];
                            } else {
                              vErrors.push(err692);
                            }
                            errors++;
                          }
                          if (typeof data204 == "number" && isFinite(data204)) {
                            if (data204 > 9007199254740991 || isNaN(data204)) {
                              const err693 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                              if (vErrors === null) {
                                vErrors = [err693];
                              } else {
                                vErrors.push(err693);
                              }
                              errors++;
                            }
                            if (data204 < 1 || isNaN(data204)) {
                              const err694 = { instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                              if (vErrors === null) {
                                vErrors = [err694];
                              } else {
                                vErrors.push(err694);
                              }
                              errors++;
                            }
                          }
                        }
                      } else {
                        const err695 = { instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err695];
                        } else {
                          vErrors.push(err695);
                        }
                        errors++;
                      }
                    }
                    if (data.sequence !== void 0) {
                      let data205 = data.sequence;
                      if (!(typeof data205 == "number" && (!(data205 % 1) && !isNaN(data205)) && isFinite(data205))) {
                        const err696 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/9/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err696];
                        } else {
                          vErrors.push(err696);
                        }
                        errors++;
                      }
                      if (typeof data205 == "number" && isFinite(data205)) {
                        if (data205 > 9007199254740991 || isNaN(data205)) {
                          const err697 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/9/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                          if (vErrors === null) {
                            vErrors = [err697];
                          } else {
                            vErrors.push(err697);
                          }
                          errors++;
                        }
                        if (data205 < 1 || isNaN(data205)) {
                          const err698 = { instancePath: instancePath + "/sequence", schemaPath: "#/oneOf/9/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                          if (vErrors === null) {
                            vErrors = [err698];
                          } else {
                            vErrors.push(err698);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data.createdAt !== void 0) {
                      let data206 = data.createdAt;
                      if (typeof data206 === "string") {
                        if (!pattern4.test(data206)) {
                          const err699 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/9/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                          if (vErrors === null) {
                            vErrors = [err699];
                          } else {
                            vErrors.push(err699);
                          }
                          errors++;
                        }
                        if (!formats10.validate(data206)) {
                          const err700 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/9/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                          if (vErrors === null) {
                            vErrors = [err700];
                          } else {
                            vErrors.push(err700);
                          }
                          errors++;
                        }
                      } else {
                        const err701 = { instancePath: instancePath + "/createdAt", schemaPath: "#/oneOf/9/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err701];
                        } else {
                          vErrors.push(err701);
                        }
                        errors++;
                      }
                    }
                    if (data.scopes !== void 0) {
                      let data207 = data.scopes;
                      if (Array.isArray(data207)) {
                        if (data207.length < 1) {
                          const err702 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/9/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                          if (vErrors === null) {
                            vErrors = [err702];
                          } else {
                            vErrors.push(err702);
                          }
                          errors++;
                        }
                        const len9 = data207.length;
                        for (let i18 = 0; i18 < len9; i18++) {
                          let data208 = data207[i18];
                          if (data208 && typeof data208 == "object" && !Array.isArray(data208)) {
                            if (data208.tenantId === void 0) {
                              const err703 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "tenantId" }, message: "must have required property 'tenantId'" };
                              if (vErrors === null) {
                                vErrors = [err703];
                              } else {
                                vErrors.push(err703);
                              }
                              errors++;
                            }
                            if (data208.kind === void 0) {
                              const err704 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                              if (vErrors === null) {
                                vErrors = [err704];
                              } else {
                                vErrors.push(err704);
                              }
                              errors++;
                            }
                            if (data208.resourceId === void 0) {
                              const err705 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "resourceId" }, message: "must have required property 'resourceId'" };
                              if (vErrors === null) {
                                vErrors = [err705];
                              } else {
                                vErrors.push(err705);
                              }
                              errors++;
                            }
                            if (data208.policyRevision === void 0) {
                              const err706 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/required", keyword: "required", params: { missingProperty: "policyRevision" }, message: "must have required property 'policyRevision'" };
                              if (vErrors === null) {
                                vErrors = [err706];
                              } else {
                                vErrors.push(err706);
                              }
                              errors++;
                            }
                            for (const key37 in data208) {
                              if (!(key37 === "tenantId" || key37 === "kind" || key37 === "resourceId" || key37 === "policyRevision")) {
                                const err707 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key37 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err707];
                                } else {
                                  vErrors.push(err707);
                                }
                                errors++;
                              }
                            }
                            if (data208.tenantId !== void 0) {
                              let data209 = data208.tenantId;
                              if (typeof data209 === "string") {
                                if (func1(data209) > 128) {
                                  const err708 = { instancePath: instancePath + "/scopes/" + i18 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err708];
                                  } else {
                                    vErrors.push(err708);
                                  }
                                  errors++;
                                }
                                if (func1(data209) < 1) {
                                  const err709 = { instancePath: instancePath + "/scopes/" + i18 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err709];
                                  } else {
                                    vErrors.push(err709);
                                  }
                                  errors++;
                                }
                              } else {
                                const err710 = { instancePath: instancePath + "/scopes/" + i18 + "/tenantId", schemaPath: "#/$defs/Scope/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err710];
                                } else {
                                  vErrors.push(err710);
                                }
                                errors++;
                              }
                            }
                            if (data208.kind !== void 0) {
                              let data210 = data208.kind;
                              if (typeof data210 !== "string") {
                                const err711 = { instancePath: instancePath + "/scopes/" + i18 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err711];
                                } else {
                                  vErrors.push(err711);
                                }
                                errors++;
                              }
                              if (!(data210 === "tenant" || data210 === "client" || data210 === "mailbox" || data210 === "memory" || data210 === "document" || data210 === "private-user" || data210 === "public")) {
                                const err712 = { instancePath: instancePath + "/scopes/" + i18 + "/kind", schemaPath: "#/$defs/Scope/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err712];
                                } else {
                                  vErrors.push(err712);
                                }
                                errors++;
                              }
                            }
                            if (data208.resourceId !== void 0) {
                              let data211 = data208.resourceId;
                              if (typeof data211 === "string") {
                                if (func1(data211) > 256) {
                                  const err713 = { instancePath: instancePath + "/scopes/" + i18 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err713];
                                  } else {
                                    vErrors.push(err713);
                                  }
                                  errors++;
                                }
                                if (func1(data211) < 1) {
                                  const err714 = { instancePath: instancePath + "/scopes/" + i18 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err714];
                                  } else {
                                    vErrors.push(err714);
                                  }
                                  errors++;
                                }
                              } else {
                                const err715 = { instancePath: instancePath + "/scopes/" + i18 + "/resourceId", schemaPath: "#/$defs/Scope/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err715];
                                } else {
                                  vErrors.push(err715);
                                }
                                errors++;
                              }
                            }
                            if (data208.policyRevision !== void 0) {
                              let data212 = data208.policyRevision;
                              if (typeof data212 === "string") {
                                if (func1(data212) > 128) {
                                  const err716 = { instancePath: instancePath + "/scopes/" + i18 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err716];
                                  } else {
                                    vErrors.push(err716);
                                  }
                                  errors++;
                                }
                                if (func1(data212) < 1) {
                                  const err717 = { instancePath: instancePath + "/scopes/" + i18 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err717];
                                  } else {
                                    vErrors.push(err717);
                                  }
                                  errors++;
                                }
                              } else {
                                const err718 = { instancePath: instancePath + "/scopes/" + i18 + "/policyRevision", schemaPath: "#/$defs/Scope/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err718];
                                } else {
                                  vErrors.push(err718);
                                }
                                errors++;
                              }
                            }
                          } else {
                            const err719 = { instancePath: instancePath + "/scopes/" + i18, schemaPath: "#/$defs/Scope/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err719];
                            } else {
                              vErrors.push(err719);
                            }
                            errors++;
                          }
                        }
                        let i19 = data207.length;
                        let j9;
                        if (i19 > 1) {
                          outer9: for (; i19--; ) {
                            for (j9 = i19; j9--; ) {
                              if (func0(data207[i19], data207[j9])) {
                                const err720 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/9/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i19, j: j9 }, message: "must NOT have duplicate items (items ## " + j9 + " and " + i19 + " are identical)" };
                                if (vErrors === null) {
                                  vErrors = [err720];
                                } else {
                                  vErrors.push(err720);
                                }
                                errors++;
                                break outer9;
                              }
                            }
                          }
                        }
                      } else {
                        const err721 = { instancePath: instancePath + "/scopes", schemaPath: "#/oneOf/9/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                        if (vErrors === null) {
                          vErrors = [err721];
                        } else {
                          vErrors.push(err721);
                        }
                        errors++;
                      }
                    }
                    if (data.type !== void 0) {
                      if ("run.error" !== data.type) {
                        const err722 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/9/properties/type/const", keyword: "const", params: { allowedValue: "run.error" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err722];
                        } else {
                          vErrors.push(err722);
                        }
                        errors++;
                      }
                    }
                    if (data.data !== void 0) {
                      let data214 = data.data;
                      if (data214 && typeof data214 == "object" && !Array.isArray(data214)) {
                        if (data214.code === void 0) {
                          const err723 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/9/properties/data/required", keyword: "required", params: { missingProperty: "code" }, message: "must have required property 'code'" };
                          if (vErrors === null) {
                            vErrors = [err723];
                          } else {
                            vErrors.push(err723);
                          }
                          errors++;
                        }
                        if (data214.retryable === void 0) {
                          const err724 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/9/properties/data/required", keyword: "required", params: { missingProperty: "retryable" }, message: "must have required property 'retryable'" };
                          if (vErrors === null) {
                            vErrors = [err724];
                          } else {
                            vErrors.push(err724);
                          }
                          errors++;
                        }
                        if (data214.message === void 0) {
                          const err725 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/9/properties/data/required", keyword: "required", params: { missingProperty: "message" }, message: "must have required property 'message'" };
                          if (vErrors === null) {
                            vErrors = [err725];
                          } else {
                            vErrors.push(err725);
                          }
                          errors++;
                        }
                        for (const key38 in data214) {
                          if (!(key38 === "code" || key38 === "retryable" || key38 === "message")) {
                            const err726 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/9/properties/data/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key38 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err726];
                            } else {
                              vErrors.push(err726);
                            }
                            errors++;
                          }
                        }
                        if (data214.code !== void 0) {
                          let data215 = data214.code;
                          if (typeof data215 === "string") {
                            if (func1(data215) < 1) {
                              const err727 = { instancePath: instancePath + "/data/code", schemaPath: "#/oneOf/9/properties/data/properties/code/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err727];
                              } else {
                                vErrors.push(err727);
                              }
                              errors++;
                            }
                          } else {
                            const err728 = { instancePath: instancePath + "/data/code", schemaPath: "#/oneOf/9/properties/data/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err728];
                            } else {
                              vErrors.push(err728);
                            }
                            errors++;
                          }
                        }
                        if (data214.retryable !== void 0) {
                          if (typeof data214.retryable !== "boolean") {
                            const err729 = { instancePath: instancePath + "/data/retryable", schemaPath: "#/oneOf/9/properties/data/properties/retryable/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                            if (vErrors === null) {
                              vErrors = [err729];
                            } else {
                              vErrors.push(err729);
                            }
                            errors++;
                          }
                        }
                        if (data214.message !== void 0) {
                          let data217 = data214.message;
                          if (typeof data217 === "string") {
                            if (func1(data217) < 1) {
                              const err730 = { instancePath: instancePath + "/data/message", schemaPath: "#/oneOf/9/properties/data/properties/message/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err730];
                              } else {
                                vErrors.push(err730);
                              }
                              errors++;
                            }
                          } else {
                            const err731 = { instancePath: instancePath + "/data/message", schemaPath: "#/oneOf/9/properties/data/properties/message/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err731];
                            } else {
                              vErrors.push(err731);
                            }
                            errors++;
                          }
                        }
                      } else {
                        const err732 = { instancePath: instancePath + "/data", schemaPath: "#/oneOf/9/properties/data/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err732];
                        } else {
                          vErrors.push(err732);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err733 = { instancePath, schemaPath: "#/oneOf/9/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err733];
                    } else {
                      vErrors.push(err733);
                    }
                    errors++;
                  }
                  var _valid0 = _errs447 === errors;
                  if (_valid0 && valid0) {
                    valid0 = false;
                    passing0 = [passing0, 9];
                  } else {
                    if (_valid0) {
                      valid0 = true;
                      passing0 = 9;
                      if (props0 !== true) {
                        props0 = true;
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
  if (!valid0) {
    const err734 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err734];
    } else {
      vErrors.push(err734);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate26.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate26.evaluated = { "dynamicProps": true, "dynamicItems": false };
export {
  validateUIEvent
};
