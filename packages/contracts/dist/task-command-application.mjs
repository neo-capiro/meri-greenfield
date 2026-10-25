// Generated self-contained browser receiving boundary. No authority.
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
      const day2 = +matches[3];
      return month >= 1 && month <= 12 && day2 >= 1 && day2 <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
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

// task-command-generated:./generated-validator.mjs
var validateTaskUpdateRaw = validate56;
var schema33 = { "type": "object", "properties": { "taskId": { "type": "string" }, "title": { "type": ["string", "null"] }, "status": { "type": ["string", "null"] }, "dueDate": { "type": ["string", "null"] } }, "required": ["taskId"], "additionalProperties": false };
function validate56(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate56.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.taskId === void 0 && (missing0 = "taskId")) {
        validate56.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "taskId" || key0 === "title" || key0 === "status" || key0 === "dueDate")) {
            validate56.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.taskId !== void 0) {
            const _errs2 = errors2;
            if (typeof data.taskId !== "string") {
              validate56.errors = [{ instancePath: instancePath + "/taskId", schemaPath: "#/properties/taskId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.title !== void 0) {
              let data1 = data.title;
              const _errs4 = errors2;
              if (typeof data1 !== "string" && data1 !== null) {
                validate56.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: schema33.properties.title.type }, message: "must be string,null" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.status !== void 0) {
                let data2 = data.status;
                const _errs6 = errors2;
                if (typeof data2 !== "string" && data2 !== null) {
                  validate56.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/type", keyword: "type", params: { type: schema33.properties.status.type }, message: "must be string,null" }];
                  return false;
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.dueDate !== void 0) {
                  let data3 = data.dueDate;
                  const _errs8 = errors2;
                  if (typeof data3 !== "string" && data3 !== null) {
                    validate56.errors = [{ instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/type", keyword: "type", params: { type: schema33.properties.dueDate.type }, message: "must be string,null" }];
                    return false;
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate56.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate56.errors = vErrors;
  return errors2 === 0;
}
validate56.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskUpdateArguments = validate57;
var schema35 = { "type": "object", "properties": { "taskId": { "type": "string", "format": "uuid" }, "mode": { "const": "unconditional_patch" }, "patch": { "type": "object", "properties": { "title": { "type": "string", "minLength": 1, "maxLength": 240 }, "status": { "enum": ["todo", "in_progress", "done", "blocked", "canceled"] }, "dueDate": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": [], "additionalProperties": false, "minProperties": 1 } }, "required": ["taskId", "mode", "patch"], "additionalProperties": false };
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats2 = require_formats().fullFormats["date-time"];
var func1 = require_ucs2length().default;
var pattern4 = new RegExp("Z$", "u");
function validate57(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate57.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.taskId === void 0 && (missing0 = "taskId") || data.mode === void 0 && (missing0 = "mode") || data.patch === void 0 && (missing0 = "patch")) {
        validate57.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "taskId" || key0 === "mode" || key0 === "patch")) {
            validate57.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.taskId !== void 0) {
            let data0 = data.taskId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate57.errors = [{ instancePath: instancePath + "/taskId", schemaPath: "#/properties/taskId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate57.errors = [{ instancePath: instancePath + "/taskId", schemaPath: "#/properties/taskId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.mode !== void 0) {
              const _errs4 = errors2;
              if ("unconditional_patch" !== data.mode) {
                validate57.errors = [{ instancePath: instancePath + "/mode", schemaPath: "#/properties/mode/const", keyword: "const", params: { allowedValue: "unconditional_patch" }, message: "must be equal to constant" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.patch !== void 0) {
                let data2 = data.patch;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    if (Object.keys(data2).length < 1) {
                      validate57.errors = [{ instancePath: instancePath + "/patch", schemaPath: "#/properties/patch/minProperties", keyword: "minProperties", params: { limit: 1 }, message: "must NOT have fewer than 1 properties" }];
                      return false;
                    } else {
                      const _errs7 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "title" || key1 === "status" || key1 === "dueDate")) {
                          validate57.errors = [{ instancePath: instancePath + "/patch", schemaPath: "#/properties/patch/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs7 === errors2) {
                        if (data2.title !== void 0) {
                          let data3 = data2.title;
                          const _errs8 = errors2;
                          if (errors2 === _errs8) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 240) {
                                validate57.errors = [{ instancePath: instancePath + "/patch/title", schemaPath: "#/properties/patch/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate57.errors = [{ instancePath: instancePath + "/patch/title", schemaPath: "#/properties/patch/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate57.errors = [{ instancePath: instancePath + "/patch/title", schemaPath: "#/properties/patch/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs8 === errors2;
                        } else {
                          var valid1 = true;
                        }
                        if (valid1) {
                          if (data2.status !== void 0) {
                            let data4 = data2.status;
                            const _errs10 = errors2;
                            if (!(data4 === "todo" || data4 === "in_progress" || data4 === "done" || data4 === "blocked" || data4 === "canceled")) {
                              validate57.errors = [{ instancePath: instancePath + "/patch/status", schemaPath: "#/properties/patch/properties/status/enum", keyword: "enum", params: { allowedValues: schema35.properties.patch.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid1 = _errs10 === errors2;
                          } else {
                            var valid1 = true;
                          }
                          if (valid1) {
                            if (data2.dueDate !== void 0) {
                              let data5 = data2.dueDate;
                              const _errs11 = errors2;
                              if (errors2 === _errs11) {
                                if (errors2 === _errs11) {
                                  if (typeof data5 === "string") {
                                    if (!pattern4.test(data5)) {
                                      validate57.errors = [{ instancePath: instancePath + "/patch/dueDate", schemaPath: "#/properties/patch/properties/dueDate/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                      return false;
                                    } else {
                                      if (!formats2.validate(data5)) {
                                        validate57.errors = [{ instancePath: instancePath + "/patch/dueDate", schemaPath: "#/properties/patch/properties/dueDate/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate57.errors = [{ instancePath: instancePath + "/patch/dueDate", schemaPath: "#/properties/patch/properties/dueDate/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid1 = _errs11 === errors2;
                            } else {
                              var valid1 = true;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate57.errors = [{ instancePath: instancePath + "/patch", schemaPath: "#/properties/patch/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
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
      validate57.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate57.errors = vErrors;
  return errors2 === 0;
}
validate57.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskUpdateApprovalProposal = validate58;
var schema41 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func0 = require_equal().default;
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
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.commandId === void 0 && (missing0 = "commandId") || data.binding === void 0 && (missing0 = "binding") || data.action === void 0 && (missing0 = "action") || data.arguments === void 0 && (missing0 = "arguments") || data.attachments === void 0 && (missing0 = "attachments") || data.scopes === void 0 && (missing0 = "scopes") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "contractVersion" || key0 === "commandId" || key0 === "binding" || key0 === "action" || key0 === "arguments" || key0 === "attachments" || key0 === "scopes" || key0 === "idempotencyKey")) {
            validate25.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.2.0" !== data.contractVersion) {
              validate25.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandId !== void 0) {
              let data1 = data.commandId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate25.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate25.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.binding !== void 0) {
                let data2 = data.binding;
                const _errs5 = errors2;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
                      validate25.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate25.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                validate25.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate25.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate25.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate25.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate25.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate25.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate25.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate25.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate25.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate25.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate25.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate25.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate25.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate25.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate25.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate25.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                    validate25.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.action !== void 0) {
                  const _errs23 = errors2;
                  if ("task.update" !== data.action) {
                    validate25.errors = [{ instancePath: instancePath + "/action", schemaPath: "#/properties/action/const", keyword: "const", params: { allowedValue: "task.update" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.arguments !== void 0) {
                    let data11 = data.arguments;
                    const _errs24 = errors2;
                    const _errs25 = errors2;
                    if (errors2 === _errs25) {
                      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                        let missing2;
                        if (data11.taskId === void 0 && (missing2 = "taskId") || data11.mode === void 0 && (missing2 = "mode") || data11.patch === void 0 && (missing2 = "patch")) {
                          validate25.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                          return false;
                        } else {
                          const _errs27 = errors2;
                          for (const key2 in data11) {
                            if (!(key2 === "taskId" || key2 === "mode" || key2 === "patch")) {
                              validate25.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs27 === errors2) {
                            if (data11.taskId !== void 0) {
                              let data12 = data11.taskId;
                              const _errs28 = errors2;
                              if (errors2 === _errs28) {
                                if (errors2 === _errs28) {
                                  if (typeof data12 === "string") {
                                    if (!formats0.test(data12)) {
                                      validate25.errors = [{ instancePath: instancePath + "/arguments/taskId", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate25.errors = [{ instancePath: instancePath + "/arguments/taskId", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid4 = _errs28 === errors2;
                            } else {
                              var valid4 = true;
                            }
                            if (valid4) {
                              if (data11.mode !== void 0) {
                                const _errs30 = errors2;
                                if ("unconditional_patch" !== data11.mode) {
                                  validate25.errors = [{ instancePath: instancePath + "/arguments/mode", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/mode/const", keyword: "const", params: { allowedValue: "unconditional_patch" }, message: "must be equal to constant" }];
                                  return false;
                                }
                                var valid4 = _errs30 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data11.patch !== void 0) {
                                  let data14 = data11.patch;
                                  const _errs31 = errors2;
                                  if (errors2 === _errs31) {
                                    if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                                      if (Object.keys(data14).length < 1) {
                                        validate25.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/minProperties", keyword: "minProperties", params: { limit: 1 }, message: "must NOT have fewer than 1 properties" }];
                                        return false;
                                      } else {
                                        const _errs33 = errors2;
                                        for (const key3 in data14) {
                                          if (!(key3 === "title" || key3 === "status" || key3 === "dueDate")) {
                                            validate25.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs33 === errors2) {
                                          if (data14.title !== void 0) {
                                            let data15 = data14.title;
                                            const _errs34 = errors2;
                                            if (errors2 === _errs34) {
                                              if (typeof data15 === "string") {
                                                if (func1(data15) > 240) {
                                                  validate25.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data15) < 1) {
                                                    validate25.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate25.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid5 = _errs34 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data14.status !== void 0) {
                                              let data16 = data14.status;
                                              const _errs36 = errors2;
                                              if (!(data16 === "todo" || data16 === "in_progress" || data16 === "done" || data16 === "blocked" || data16 === "canceled")) {
                                                validate25.errors = [{ instancePath: instancePath + "/arguments/patch/status", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/status/enum", keyword: "enum", params: { allowedValues: schema35.properties.patch.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                                return false;
                                              }
                                              var valid5 = _errs36 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data14.dueDate !== void 0) {
                                                let data17 = data14.dueDate;
                                                const _errs37 = errors2;
                                                if (errors2 === _errs37) {
                                                  if (errors2 === _errs37) {
                                                    if (typeof data17 === "string") {
                                                      if (!pattern4.test(data17)) {
                                                        validate25.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                        return false;
                                                      } else {
                                                        if (!formats2.validate(data17)) {
                                                          validate25.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate25.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                                var valid5 = _errs37 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
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
                        validate25.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs24 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.attachments !== void 0) {
                      let data18 = data.attachments;
                      const _errs39 = errors2;
                      if (errors2 === _errs39) {
                        if (Array.isArray(data18)) {
                          if (data18.length > 0) {
                            validate25.errors = [{ instancePath: instancePath + "/attachments", schemaPath: "#/properties/attachments/maxItems", keyword: "maxItems", params: { limit: 0 }, message: "must NOT have more than 0 items" }];
                            return false;
                          }
                        } else {
                          validate25.errors = [{ instancePath: instancePath + "/attachments", schemaPath: "#/properties/attachments/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs39 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.scopes !== void 0) {
                        let data19 = data.scopes;
                        const _errs41 = errors2;
                        if (errors2 === _errs41) {
                          if (Array.isArray(data19)) {
                            if (data19.length < 1) {
                              validate25.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                              return false;
                            } else {
                              var valid6 = true;
                              const len0 = data19.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                let data20 = data19[i0];
                                const _errs43 = errors2;
                                const _errs44 = errors2;
                                if (errors2 === _errs44) {
                                  if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                    let missing3;
                                    if (data20.tenantId === void 0 && (missing3 = "tenantId") || data20.kind === void 0 && (missing3 = "kind") || data20.resourceId === void 0 && (missing3 = "resourceId") || data20.policyRevision === void 0 && (missing3 = "policyRevision")) {
                                      validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                      return false;
                                    } else {
                                      const _errs46 = errors2;
                                      for (const key4 in data20) {
                                        if (!(key4 === "tenantId" || key4 === "kind" || key4 === "resourceId" || key4 === "policyRevision")) {
                                          validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs46 === errors2) {
                                        if (data20.tenantId !== void 0) {
                                          let data21 = data20.tenantId;
                                          const _errs47 = errors2;
                                          if (errors2 === _errs47) {
                                            if (typeof data21 === "string") {
                                              if (func1(data21) > 128) {
                                                validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data21) < 1) {
                                                  validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid8 = _errs47 === errors2;
                                        } else {
                                          var valid8 = true;
                                        }
                                        if (valid8) {
                                          if (data20.kind !== void 0) {
                                            let data22 = data20.kind;
                                            const _errs49 = errors2;
                                            if (typeof data22 !== "string") {
                                              validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data22 === "tenant" || data22 === "client" || data22 === "mailbox" || data22 === "memory" || data22 === "document" || data22 === "private-user" || data22 === "public")) {
                                              validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema41.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid8 = _errs49 === errors2;
                                          } else {
                                            var valid8 = true;
                                          }
                                          if (valid8) {
                                            if (data20.resourceId !== void 0) {
                                              let data23 = data20.resourceId;
                                              const _errs51 = errors2;
                                              if (errors2 === _errs51) {
                                                if (typeof data23 === "string") {
                                                  if (func1(data23) > 256) {
                                                    validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data23) < 1) {
                                                      validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid8 = _errs51 === errors2;
                                            } else {
                                              var valid8 = true;
                                            }
                                            if (valid8) {
                                              if (data20.policyRevision !== void 0) {
                                                let data24 = data20.policyRevision;
                                                const _errs53 = errors2;
                                                if (errors2 === _errs53) {
                                                  if (typeof data24 === "string") {
                                                    if (func1(data24) > 128) {
                                                      validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func1(data24) < 1) {
                                                        validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid8 = _errs53 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate25.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid6 = _errs43 === errors2;
                                if (!valid6) {
                                  break;
                                }
                              }
                              if (valid6) {
                                let i1 = data19.length;
                                let j0;
                                if (i1 > 1) {
                                  outer0: for (; i1--; ) {
                                    for (j0 = i1; j0--; ) {
                                      if (func0(data19[i1], data19[j0])) {
                                        validate25.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate25.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid0 = _errs41 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.idempotencyKey !== void 0) {
                          let data25 = data.idempotencyKey;
                          const _errs55 = errors2;
                          if (errors2 === _errs55) {
                            if (typeof data25 === "string") {
                              if (func1(data25) > 128) {
                                validate25.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data25) < 1) {
                                  validate25.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate25.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs55 === errors2;
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
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern6 = new RegExp("^[a-f0-9]{64}$", "u");
function validate58(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
        validate58.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
            validate58.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate58.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate58.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.command !== void 0) {
              const _errs4 = errors2;
              if (!validate25(data.command, { instancePath: instancePath + "/command", parentData: data, parentDataProperty: "command", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (typeof data2 === "string") {
                    if (!pattern6.test(data2)) {
                      validate58.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate58.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.createdAt !== void 0) {
                  let data3 = data.createdAt;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (errors2 === _errs7) {
                      if (typeof data3 === "string") {
                        if (!pattern4.test(data3)) {
                          validate58.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats2.validate(data3)) {
                            validate58.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate58.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs9 = errors2;
                    if (errors2 === _errs9) {
                      if (errors2 === _errs9) {
                        if (typeof data4 === "string") {
                          if (!pattern4.test(data4)) {
                            validate58.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats2.validate(data4)) {
                              validate58.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate58.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs9 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.requiredApprover !== void 0) {
                      let data5 = data.requiredApprover;
                      const _errs11 = errors2;
                      const _errs12 = errors2;
                      if (errors2 === _errs12) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate58.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs14 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate58.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs14 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate58.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate58.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate58.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate58.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate58.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate58.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate58.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs11 === errors2;
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
      validate58.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate58.errors = vErrors;
  return errors2 === 0;
}
validate58.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskUpdateResult = validate60;
var schema44 = { "type": "object", "properties": { "id": { "type": "string", "format": "uuid" }, "title": { "type": "string" }, "status": { "enum": ["todo", "in_progress", "done", "blocked", "canceled"] }, "dueDate": { "anyOf": [{ "type": "string", "format": "date-time", "pattern": "Z$" }, { "type": "null" }] }, "clientId": { "anyOf": [{ "type": "string", "format": "uuid" }, { "type": "null" }] }, "updatedAt": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": ["id", "title", "status", "dueDate", "clientId", "updatedAt"], "additionalProperties": false };
function validate60(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate60.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.id === void 0 && (missing0 = "id") || data.title === void 0 && (missing0 = "title") || data.status === void 0 && (missing0 = "status") || data.dueDate === void 0 && (missing0 = "dueDate") || data.clientId === void 0 && (missing0 = "clientId") || data.updatedAt === void 0 && (missing0 = "updatedAt")) {
        validate60.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "id" || key0 === "title" || key0 === "status" || key0 === "dueDate" || key0 === "clientId" || key0 === "updatedAt")) {
            validate60.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.id !== void 0) {
            let data0 = data.id;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate60.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate60.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.title !== void 0) {
              const _errs4 = errors2;
              if (typeof data.title !== "string") {
                validate60.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.status !== void 0) {
                let data2 = data.status;
                const _errs6 = errors2;
                if (!(data2 === "todo" || data2 === "in_progress" || data2 === "done" || data2 === "blocked" || data2 === "canceled")) {
                  validate60.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/enum", keyword: "enum", params: { allowedValues: schema44.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.dueDate !== void 0) {
                  let data3 = data.dueDate;
                  const _errs7 = errors2;
                  const _errs8 = errors2;
                  let valid1 = false;
                  const _errs9 = errors2;
                  if (errors2 === _errs9) {
                    if (errors2 === _errs9) {
                      if (typeof data3 === "string") {
                        if (!pattern4.test(data3)) {
                          const err0 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        } else {
                          if (!formats2.validate(data3)) {
                            const err1 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors2++;
                          }
                        }
                      } else {
                        const err2 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                    }
                  }
                  var _valid0 = _errs9 === errors2;
                  valid1 = valid1 || _valid0;
                  const _errs11 = errors2;
                  if (data3 !== null) {
                    const err3 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var _valid0 = _errs11 === errors2;
                  valid1 = valid1 || _valid0;
                  if (!valid1) {
                    const err4 = { instancePath: instancePath + "/dueDate", schemaPath: "#/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                    validate60.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs8;
                    if (vErrors !== null) {
                      if (_errs8) {
                        vErrors.length = _errs8;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.clientId !== void 0) {
                    let data4 = data.clientId;
                    const _errs13 = errors2;
                    const _errs14 = errors2;
                    let valid2 = false;
                    const _errs15 = errors2;
                    if (errors2 === _errs15) {
                      if (errors2 === _errs15) {
                        if (typeof data4 === "string") {
                          if (!formats0.test(data4)) {
                            const err5 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors2++;
                          }
                        } else {
                          const err6 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err6];
                          } else {
                            vErrors.push(err6);
                          }
                          errors2++;
                        }
                      }
                    }
                    var _valid1 = _errs15 === errors2;
                    valid2 = valid2 || _valid1;
                    const _errs17 = errors2;
                    if (data4 !== null) {
                      const err7 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err7];
                      } else {
                        vErrors.push(err7);
                      }
                      errors2++;
                    }
                    var _valid1 = _errs17 === errors2;
                    valid2 = valid2 || _valid1;
                    if (!valid2) {
                      const err8 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err8];
                      } else {
                        vErrors.push(err8);
                      }
                      errors2++;
                      validate60.errors = vErrors;
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
                  if (valid0) {
                    if (data.updatedAt !== void 0) {
                      let data5 = data.updatedAt;
                      const _errs19 = errors2;
                      if (errors2 === _errs19) {
                        if (errors2 === _errs19) {
                          if (typeof data5 === "string") {
                            if (!pattern4.test(data5)) {
                              validate60.errors = [{ instancePath: instancePath + "/updatedAt", schemaPath: "#/properties/updatedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                              return false;
                            } else {
                              if (!formats2.validate(data5)) {
                                validate60.errors = [{ instancePath: instancePath + "/updatedAt", schemaPath: "#/properties/updatedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                return false;
                              }
                            }
                          } else {
                            validate60.errors = [{ instancePath: instancePath + "/updatedAt", schemaPath: "#/properties/updatedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
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
      validate60.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate60.errors = vErrors;
  return errors2 === 0;
}
validate60.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskCommandPrepareRequest = validate61;
function validate61(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.arguments === void 0 && (missing0 = "arguments")) {
        validate61.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "requestId" || key0 === "arguments")) {
            validate61.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.requestId !== void 0) {
            let data0 = data.requestId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate61.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate61.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.arguments !== void 0) {
              let data1 = data.arguments;
              const _errs4 = errors2;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.taskId === void 0 && (missing1 = "taskId")) {
                    validate61.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/TaskUpdateRaw/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "taskId" || key1 === "title" || key1 === "status" || key1 === "dueDate")) {
                        validate61.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/TaskUpdateRaw/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.taskId !== void 0) {
                        const _errs8 = errors2;
                        if (typeof data1.taskId !== "string") {
                          validate61.errors = [{ instancePath: instancePath + "/arguments/taskId", schemaPath: "#/$defs/TaskUpdateRaw/properties/taskId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.title !== void 0) {
                          let data3 = data1.title;
                          const _errs10 = errors2;
                          if (typeof data3 !== "string" && data3 !== null) {
                            validate61.errors = [{ instancePath: instancePath + "/arguments/title", schemaPath: "#/$defs/TaskUpdateRaw/properties/title/type", keyword: "type", params: { type: schema33.properties.title.type }, message: "must be string,null" }];
                            return false;
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.status !== void 0) {
                            let data4 = data1.status;
                            const _errs12 = errors2;
                            if (typeof data4 !== "string" && data4 !== null) {
                              validate61.errors = [{ instancePath: instancePath + "/arguments/status", schemaPath: "#/$defs/TaskUpdateRaw/properties/status/type", keyword: "type", params: { type: schema33.properties.status.type }, message: "must be string,null" }];
                              return false;
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.dueDate !== void 0) {
                              let data5 = data1.dueDate;
                              const _errs14 = errors2;
                              if (typeof data5 !== "string" && data5 !== null) {
                                validate61.errors = [{ instancePath: instancePath + "/arguments/dueDate", schemaPath: "#/$defs/TaskUpdateRaw/properties/dueDate/type", keyword: "type", params: { type: schema33.properties.dueDate.type }, message: "must be string,null" }];
                                return false;
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
                } else {
                  validate61.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/TaskUpdateRaw/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
      validate61.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate61.errors = vErrors;
  return errors2 === 0;
}
validate61.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskCommandExecuteRequest = validate62;
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
      if (data.proposalId === void 0 && (missing0 = "proposalId") || data.command === void 0 && (missing0 = "command") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.createdAt === void 0 && (missing0 = "createdAt") || data.expiresAt === void 0 && (missing0 = "expiresAt") || data.requiredApprover === void 0 && (missing0 = "requiredApprover")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposalId" || key0 === "command" || key0 === "commandSha256" || key0 === "createdAt" || key0 === "expiresAt" || key0 === "requiredApprover")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposalId !== void 0) {
            let data0 = data.proposalId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate34.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate34.errors = [{ instancePath: instancePath + "/proposalId", schemaPath: "#/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.command !== void 0) {
              const _errs4 = errors2;
              if (!validate25(data.command, { instancePath: instancePath + "/command", parentData: data, parentDataProperty: "command", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (typeof data2 === "string") {
                    if (!pattern6.test(data2)) {
                      validate34.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate34.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.createdAt !== void 0) {
                  let data3 = data.createdAt;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (errors2 === _errs7) {
                      if (typeof data3 === "string") {
                        if (!pattern4.test(data3)) {
                          validate34.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats2.validate(data3)) {
                            validate34.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate34.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.expiresAt !== void 0) {
                    let data4 = data.expiresAt;
                    const _errs9 = errors2;
                    if (errors2 === _errs9) {
                      if (errors2 === _errs9) {
                        if (typeof data4 === "string") {
                          if (!pattern4.test(data4)) {
                            validate34.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats2.validate(data4)) {
                              validate34.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate34.errors = [{ instancePath: instancePath + "/expiresAt", schemaPath: "#/properties/expiresAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs9 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.requiredApprover !== void 0) {
                      let data5 = data.requiredApprover;
                      const _errs11 = errors2;
                      const _errs12 = errors2;
                      if (errors2 === _errs12) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.actorId === void 0 && (missing1 = "actorId")) {
                            validate34.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                            return false;
                          } else {
                            const _errs14 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "tenantId" || key1 === "actorId")) {
                                validate34.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs14 === errors2) {
                              if (data5.tenantId !== void 0) {
                                let data6 = data5.tenantId;
                                const _errs15 = errors2;
                                if (errors2 === _errs15) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate34.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate34.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate34.errors = [{ instancePath: instancePath + "/requiredApprover/tenantId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.actorId !== void 0) {
                                  let data7 = data5.actorId;
                                  const _errs17 = errors2;
                                  if (errors2 === _errs17) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 128) {
                                        validate34.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data7) < 1) {
                                          validate34.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate34.errors = [{ instancePath: instancePath + "/requiredApprover/actorId", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs17 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        } else {
                          validate34.errors = [{ instancePath: instancePath + "/requiredApprover", schemaPath: "#/$defs/Canonical_Identity_aba0a4e9/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs11 === errors2;
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
function validate62(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate62.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.proposal === void 0 && (missing0 = "proposal")) {
        validate62.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "proposal")) {
            validate62.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.proposal !== void 0) {
            if (!validate34(data.proposal, { instancePath: instancePath + "/proposal", parentData: data, parentDataProperty: "proposal", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
              errors2 = vErrors.length;
            }
          }
        }
      }
    } else {
      validate62.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate62.errors = vErrors;
  return errors2 === 0;
}
validate62.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskCommandPrepareResponse = validate64;
function validate64(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate64.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.status === void 0 && (missing0 = "status") || data.proposal === void 0 && (missing0 = "proposal")) {
        validate64.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "status" || key0 === "proposal")) {
            validate64.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.status !== void 0) {
            const _errs2 = errors2;
            if ("approval_required" !== data.status) {
              validate64.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/const", keyword: "const", params: { allowedValue: "approval_required" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.proposal !== void 0) {
              const _errs3 = errors2;
              if (!validate34(data.proposal, { instancePath: instancePath + "/proposal", parentData: data, parentDataProperty: "proposal", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate64.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate64.errors = vErrors;
  return errors2 === 0;
}
validate64.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskCommandExecuteResponse = validate66;
var schema56 = { "type": "object", "properties": { "receiptId": { "type": "string", "format": "uuid" }, "commandId": { "type": "string", "format": "uuid" }, "commandSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "idempotencyKey": { "type": "string", "minLength": 1 }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "outcome": { "type": "string", "enum": ["succeeded", "denied", "failed", "indeterminate"] }, "sourceTransactionId": { "anyOf": [{ "type": "string", "minLength": 1 }, { "type": "null" }] }, "completedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["receiptId", "commandId", "commandSha256", "idempotencyKey", "binding", "outcome", "sourceTransactionId", "completedAt", "scopes", "authorizationDecisionId"], "additionalProperties": false };
var func26 = Object.prototype.hasOwnProperty;
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
      if (data.receiptId === void 0 && (missing0 = "receiptId") || data.commandId === void 0 && (missing0 = "commandId") || data.commandSha256 === void 0 && (missing0 = "commandSha256") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey") || data.binding === void 0 && (missing0 = "binding") || data.outcome === void 0 && (missing0 = "outcome") || data.sourceTransactionId === void 0 && (missing0 = "sourceTransactionId") || data.completedAt === void 0 && (missing0 = "completedAt") || data.scopes === void 0 && (missing0 = "scopes") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
        validate44.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func26.call(schema56.properties, key0)) {
            validate44.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.receiptId !== void 0) {
            let data0 = data.receiptId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate44.errors = [{ instancePath: instancePath + "/receiptId", schemaPath: "#/properties/receiptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate44.errors = [{ instancePath: instancePath + "/receiptId", schemaPath: "#/properties/receiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandId !== void 0) {
              let data1 = data.commandId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (errors2 === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate44.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate44.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.commandSha256 !== void 0) {
                let data2 = data.commandSha256;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (!pattern6.test(data2)) {
                      validate44.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate44.errors = [{ instancePath: instancePath + "/commandSha256", schemaPath: "#/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.idempotencyKey !== void 0) {
                  let data3 = data.idempotencyKey;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (typeof data3 === "string") {
                      if (func1(data3) < 1) {
                        validate44.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                        return false;
                      }
                    } else {
                      validate44.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.binding !== void 0) {
                    let data4 = data.binding;
                    const _errs10 = errors2;
                    const _errs11 = errors2;
                    if (errors2 === _errs11) {
                      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                        let missing1;
                        if (data4.tenantId === void 0 && (missing1 = "tenantId") || data4.actorId === void 0 && (missing1 = "actorId") || data4.conversationId === void 0 && (missing1 = "conversationId") || data4.runId === void 0 && (missing1 = "runId") || data4.attemptId === void 0 && (missing1 = "attemptId") || data4.workerId === void 0 && (missing1 = "workerId") || data4.writerFence === void 0 && (missing1 = "writerFence")) {
                          validate44.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs13 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate44.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs13 === errors2) {
                            if (data4.tenantId !== void 0) {
                              let data5 = data4.tenantId;
                              const _errs14 = errors2;
                              if (errors2 === _errs14) {
                                if (typeof data5 === "string") {
                                  if (func1(data5) > 128) {
                                    validate44.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func1(data5) < 1) {
                                      validate44.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate44.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid2 = _errs14 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data4.actorId !== void 0) {
                                let data6 = data4.actorId;
                                const _errs16 = errors2;
                                if (errors2 === _errs16) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate44.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate44.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate44.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs16 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data4.conversationId !== void 0) {
                                  let data7 = data4.conversationId;
                                  const _errs18 = errors2;
                                  if (errors2 === _errs18) {
                                    if (errors2 === _errs18) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate44.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate44.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid2 = _errs18 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data4.runId !== void 0) {
                                    let data8 = data4.runId;
                                    const _errs20 = errors2;
                                    if (errors2 === _errs20) {
                                      if (errors2 === _errs20) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate44.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate44.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid2 = _errs20 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data4.attemptId !== void 0) {
                                      let data9 = data4.attemptId;
                                      const _errs22 = errors2;
                                      if (errors2 === _errs22) {
                                        if (errors2 === _errs22) {
                                          if (typeof data9 === "string") {
                                            if (!formats0.test(data9)) {
                                              validate44.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate44.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                      }
                                      var valid2 = _errs22 === errors2;
                                    } else {
                                      var valid2 = true;
                                    }
                                    if (valid2) {
                                      if (data4.workerId !== void 0) {
                                        let data10 = data4.workerId;
                                        const _errs24 = errors2;
                                        if (errors2 === _errs24) {
                                          if (errors2 === _errs24) {
                                            if (typeof data10 === "string") {
                                              if (!formats0.test(data10)) {
                                                validate44.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate44.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                        }
                                        var valid2 = _errs24 === errors2;
                                      } else {
                                        var valid2 = true;
                                      }
                                      if (valid2) {
                                        if (data4.writerFence !== void 0) {
                                          let data11 = data4.writerFence;
                                          const _errs26 = errors2;
                                          if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                            validate44.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs26) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate44.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate44.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid2 = _errs26 === errors2;
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
                        validate44.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.outcome !== void 0) {
                      let data12 = data.outcome;
                      const _errs28 = errors2;
                      if (typeof data12 !== "string") {
                        validate44.errors = [{ instancePath: instancePath + "/outcome", schemaPath: "#/properties/outcome/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data12 === "succeeded" || data12 === "denied" || data12 === "failed" || data12 === "indeterminate")) {
                        validate44.errors = [{ instancePath: instancePath + "/outcome", schemaPath: "#/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema56.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs28 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.sourceTransactionId !== void 0) {
                        let data13 = data.sourceTransactionId;
                        const _errs30 = errors2;
                        const _errs31 = errors2;
                        let valid3 = false;
                        const _errs32 = errors2;
                        if (errors2 === _errs32) {
                          if (typeof data13 === "string") {
                            if (func1(data13) < 1) {
                              const err0 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err0];
                              } else {
                                vErrors.push(err0);
                              }
                              errors2++;
                            }
                          } else {
                            const err1 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors2++;
                          }
                        }
                        var _valid0 = _errs32 === errors2;
                        valid3 = valid3 || _valid0;
                        const _errs34 = errors2;
                        if (data13 !== null) {
                          const err2 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                        var _valid0 = _errs34 === errors2;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err3 = { instancePath: instancePath + "/sourceTransactionId", schemaPath: "#/properties/sourceTransactionId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors2++;
                          validate44.errors = vErrors;
                          return false;
                        } else {
                          errors2 = _errs31;
                          if (vErrors !== null) {
                            if (_errs31) {
                              vErrors.length = _errs31;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs30 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.completedAt !== void 0) {
                          let data14 = data.completedAt;
                          const _errs36 = errors2;
                          if (errors2 === _errs36) {
                            if (errors2 === _errs36) {
                              if (typeof data14 === "string") {
                                if (!pattern4.test(data14)) {
                                  validate44.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                  return false;
                                } else {
                                  if (!formats2.validate(data14)) {
                                    validate44.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                    return false;
                                  }
                                }
                              } else {
                                validate44.errors = [{ instancePath: instancePath + "/completedAt", schemaPath: "#/properties/completedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                          }
                          var valid0 = _errs36 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.scopes !== void 0) {
                            let data15 = data.scopes;
                            const _errs38 = errors2;
                            if (errors2 === _errs38) {
                              if (Array.isArray(data15)) {
                                if (data15.length < 1) {
                                  validate44.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                  return false;
                                } else {
                                  var valid4 = true;
                                  const len0 = data15.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    let data16 = data15[i0];
                                    const _errs40 = errors2;
                                    const _errs41 = errors2;
                                    if (errors2 === _errs41) {
                                      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                                        let missing2;
                                        if (data16.tenantId === void 0 && (missing2 = "tenantId") || data16.kind === void 0 && (missing2 = "kind") || data16.resourceId === void 0 && (missing2 = "resourceId") || data16.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                          validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                          return false;
                                        } else {
                                          const _errs43 = errors2;
                                          for (const key2 in data16) {
                                            if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                              validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs43 === errors2) {
                                            if (data16.tenantId !== void 0) {
                                              let data17 = data16.tenantId;
                                              const _errs44 = errors2;
                                              if (errors2 === _errs44) {
                                                if (typeof data17 === "string") {
                                                  if (func1(data17) > 128) {
                                                    validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data17) < 1) {
                                                      validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid6 = _errs44 === errors2;
                                            } else {
                                              var valid6 = true;
                                            }
                                            if (valid6) {
                                              if (data16.kind !== void 0) {
                                                let data18 = data16.kind;
                                                const _errs46 = errors2;
                                                if (typeof data18 !== "string") {
                                                  validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                                if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
                                                  validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema41.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                                  return false;
                                                }
                                                var valid6 = _errs46 === errors2;
                                              } else {
                                                var valid6 = true;
                                              }
                                              if (valid6) {
                                                if (data16.resourceId !== void 0) {
                                                  let data19 = data16.resourceId;
                                                  const _errs48 = errors2;
                                                  if (errors2 === _errs48) {
                                                    if (typeof data19 === "string") {
                                                      if (func1(data19) > 256) {
                                                        validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func1(data19) < 1) {
                                                          validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid6 = _errs48 === errors2;
                                                } else {
                                                  var valid6 = true;
                                                }
                                                if (valid6) {
                                                  if (data16.policyRevision !== void 0) {
                                                    let data20 = data16.policyRevision;
                                                    const _errs50 = errors2;
                                                    if (errors2 === _errs50) {
                                                      if (typeof data20 === "string") {
                                                        if (func1(data20) > 128) {
                                                          validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func1(data20) < 1) {
                                                            validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
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
                                      } else {
                                        validate44.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid4 = _errs40 === errors2;
                                    if (!valid4) {
                                      break;
                                    }
                                  }
                                  if (valid4) {
                                    let i1 = data15.length;
                                    let j0;
                                    if (i1 > 1) {
                                      outer0: for (; i1--; ) {
                                        for (j0 = i1; j0--; ) {
                                          if (func0(data15[i1], data15[j0])) {
                                            validate44.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                            return false;
                                            break outer0;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate44.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid0 = _errs38 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.authorizationDecisionId !== void 0) {
                              let data21 = data.authorizationDecisionId;
                              const _errs52 = errors2;
                              if (errors2 === _errs52) {
                                if (errors2 === _errs52) {
                                  if (typeof data21 === "string") {
                                    if (!formats0.test(data21)) {
                                      validate44.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate44.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid0 = _errs52 === errors2;
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
      validate44.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate44.errors = vErrors;
  return errors2 === 0;
}
validate44.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern19 = new RegExp("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$", "u");
function validate66(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate66.evaluated;
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
      if (data.status === void 0 && (missing0 = "status") || data.outcome === void 0 && (missing0 = "outcome")) {
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
          if (!(key0 === "status" || key0 === "outcome")) {
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
          if (data.status !== void 0) {
            const _errs4 = errors2;
            if ("observed" !== data.status) {
              const err2 = { instancePath: instancePath + "/status", schemaPath: "#/oneOf/0/properties/status/const", keyword: "const", params: { allowedValue: "observed" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors2++;
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.outcome !== void 0) {
              let data1 = data.outcome;
              const _errs5 = errors2;
              const _errs6 = errors2;
              let valid2 = false;
              let passing1 = null;
              const _errs7 = errors2;
              if (errors2 === _errs7) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.receipt === void 0 && (missing1 = "receipt") || data1.result === void 0 && (missing1 = "result")) {
                    const err3 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  } else {
                    const _errs9 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "receipt" || key1 === "result")) {
                        const err4 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err4];
                        } else {
                          vErrors.push(err4);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs9 === errors2) {
                      if (data1.receipt !== void 0) {
                        const _errs10 = errors2;
                        if (!validate44(data1.receipt, { instancePath: instancePath + "/outcome/receipt", parentData: data1, parentDataProperty: "receipt", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
                          errors2 = vErrors.length;
                        }
                        var valid3 = _errs10 === errors2;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.result !== void 0) {
                          let data3 = data1.result;
                          const _errs11 = errors2;
                          const _errs12 = errors2;
                          if (errors2 === _errs12) {
                            if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                              let missing2;
                              if (data3.id === void 0 && (missing2 = "id") || data3.title === void 0 && (missing2 = "title") || data3.status === void 0 && (missing2 = "status") || data3.dueDate === void 0 && (missing2 = "dueDate") || data3.clientId === void 0 && (missing2 = "clientId") || data3.updatedAt === void 0 && (missing2 = "updatedAt")) {
                                const err5 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err5];
                                } else {
                                  vErrors.push(err5);
                                }
                                errors2++;
                              } else {
                                const _errs14 = errors2;
                                for (const key2 in data3) {
                                  if (!(key2 === "id" || key2 === "title" || key2 === "status" || key2 === "dueDate" || key2 === "clientId" || key2 === "updatedAt")) {
                                    const err6 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err6];
                                    } else {
                                      vErrors.push(err6);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs14 === errors2) {
                                  if (data3.id !== void 0) {
                                    let data4 = data3.id;
                                    const _errs15 = errors2;
                                    if (errors2 === _errs15) {
                                      if (errors2 === _errs15) {
                                        if (typeof data4 === "string") {
                                          if (!formats0.test(data4)) {
                                            const err7 = { instancePath: instancePath + "/outcome/result/id", schemaPath: "#/$defs/TaskUpdateResult/properties/id/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                            if (vErrors === null) {
                                              vErrors = [err7];
                                            } else {
                                              vErrors.push(err7);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err8 = { instancePath: instancePath + "/outcome/result/id", schemaPath: "#/$defs/TaskUpdateResult/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err8];
                                          } else {
                                            vErrors.push(err8);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                    var valid5 = _errs15 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data3.title !== void 0) {
                                      const _errs17 = errors2;
                                      if (typeof data3.title !== "string") {
                                        const err9 = { instancePath: instancePath + "/outcome/result/title", schemaPath: "#/$defs/TaskUpdateResult/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err9];
                                        } else {
                                          vErrors.push(err9);
                                        }
                                        errors2++;
                                      }
                                      var valid5 = _errs17 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data3.status !== void 0) {
                                        let data6 = data3.status;
                                        const _errs19 = errors2;
                                        if (!(data6 === "todo" || data6 === "in_progress" || data6 === "done" || data6 === "blocked" || data6 === "canceled")) {
                                          const err10 = { instancePath: instancePath + "/outcome/result/status", schemaPath: "#/$defs/TaskUpdateResult/properties/status/enum", keyword: "enum", params: { allowedValues: schema44.properties.status.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err10];
                                          } else {
                                            vErrors.push(err10);
                                          }
                                          errors2++;
                                        }
                                        var valid5 = _errs19 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data3.dueDate !== void 0) {
                                          let data7 = data3.dueDate;
                                          const _errs20 = errors2;
                                          const _errs21 = errors2;
                                          let valid6 = false;
                                          const _errs22 = errors2;
                                          if (errors2 === _errs22) {
                                            if (errors2 === _errs22) {
                                              if (typeof data7 === "string") {
                                                if (!pattern4.test(data7)) {
                                                  const err11 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err11];
                                                  } else {
                                                    vErrors.push(err11);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!formats2.validate(data7)) {
                                                    const err12 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err12];
                                                    } else {
                                                      vErrors.push(err12);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              } else {
                                                const err13 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err13];
                                                } else {
                                                  vErrors.push(err13);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                          var _valid2 = _errs22 === errors2;
                                          valid6 = valid6 || _valid2;
                                          const _errs24 = errors2;
                                          if (data7 !== null) {
                                            const err14 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                            if (vErrors === null) {
                                              vErrors = [err14];
                                            } else {
                                              vErrors.push(err14);
                                            }
                                            errors2++;
                                          }
                                          var _valid2 = _errs24 === errors2;
                                          valid6 = valid6 || _valid2;
                                          if (!valid6) {
                                            const err15 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                            if (vErrors === null) {
                                              vErrors = [err15];
                                            } else {
                                              vErrors.push(err15);
                                            }
                                            errors2++;
                                          } else {
                                            errors2 = _errs21;
                                            if (vErrors !== null) {
                                              if (_errs21) {
                                                vErrors.length = _errs21;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid5 = _errs20 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data3.clientId !== void 0) {
                                            let data8 = data3.clientId;
                                            const _errs26 = errors2;
                                            const _errs27 = errors2;
                                            let valid7 = false;
                                            const _errs28 = errors2;
                                            if (errors2 === _errs28) {
                                              if (errors2 === _errs28) {
                                                if (typeof data8 === "string") {
                                                  if (!formats0.test(data8)) {
                                                    const err16 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err16];
                                                    } else {
                                                      vErrors.push(err16);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err17 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err17];
                                                  } else {
                                                    vErrors.push(err17);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                            var _valid3 = _errs28 === errors2;
                                            valid7 = valid7 || _valid3;
                                            const _errs30 = errors2;
                                            if (data8 !== null) {
                                              const err18 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                              if (vErrors === null) {
                                                vErrors = [err18];
                                              } else {
                                                vErrors.push(err18);
                                              }
                                              errors2++;
                                            }
                                            var _valid3 = _errs30 === errors2;
                                            valid7 = valid7 || _valid3;
                                            if (!valid7) {
                                              const err19 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                              if (vErrors === null) {
                                                vErrors = [err19];
                                              } else {
                                                vErrors.push(err19);
                                              }
                                              errors2++;
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
                                            var valid5 = _errs26 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data3.updatedAt !== void 0) {
                                              let data9 = data3.updatedAt;
                                              const _errs32 = errors2;
                                              if (errors2 === _errs32) {
                                                if (errors2 === _errs32) {
                                                  if (typeof data9 === "string") {
                                                    if (!pattern4.test(data9)) {
                                                      const err20 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                      if (vErrors === null) {
                                                        vErrors = [err20];
                                                      } else {
                                                        vErrors.push(err20);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (!formats2.validate(data9)) {
                                                        const err21 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                        if (vErrors === null) {
                                                          vErrors = [err21];
                                                        } else {
                                                          vErrors.push(err21);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err22 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err22];
                                                    } else {
                                                      vErrors.push(err22);
                                                    }
                                                    errors2++;
                                                  }
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
                                }
                              }
                            } else {
                              const err23 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err23];
                              } else {
                                vErrors.push(err23);
                              }
                              errors2++;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                      }
                    }
                  }
                } else {
                  const err24 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors2++;
                }
              }
              var _valid1 = _errs7 === errors2;
              if (_valid1) {
                valid2 = true;
                passing1 = 0;
                var props0 = true;
              }
              const _errs34 = errors2;
              if (errors2 === _errs34) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing3;
                  if (data1.execution === void 0 && (missing3 = "execution") || data1.result === void 0 && (missing3 = "result")) {
                    const err25 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                      vErrors = [err25];
                    } else {
                      vErrors.push(err25);
                    }
                    errors2++;
                  } else {
                    const _errs36 = errors2;
                    for (const key3 in data1) {
                      if (!(key3 === "execution" || key3 === "result")) {
                        const err26 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err26];
                        } else {
                          vErrors.push(err26);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs36 === errors2) {
                      if (data1.execution !== void 0) {
                        let data10 = data1.execution;
                        const _errs37 = errors2;
                        if (errors2 === _errs37) {
                          if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                            let missing4;
                            if (data10.kind === void 0 && (missing4 = "kind") || data10.proposalId === void 0 && (missing4 = "proposalId") || data10.commandSha256 === void 0 && (missing4 = "commandSha256") || data10.idempotencyKey === void 0 && (missing4 = "idempotencyKey") || data10.binding === void 0 && (missing4 = "binding") || data10.completedAt === void 0 && (missing4 = "completedAt") || data10.approvalDecisionSha256 === void 0 && (missing4 = "approvalDecisionSha256")) {
                              const err27 = { instancePath: instancePath + "/outcome/execution", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                              if (vErrors === null) {
                                vErrors = [err27];
                              } else {
                                vErrors.push(err27);
                              }
                              errors2++;
                            } else {
                              const _errs39 = errors2;
                              for (const key4 in data10) {
                                if (!(key4 === "kind" || key4 === "proposalId" || key4 === "commandSha256" || key4 === "idempotencyKey" || key4 === "binding" || key4 === "completedAt" || key4 === "approvalDecisionSha256")) {
                                  const err28 = { instancePath: instancePath + "/outcome/execution", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err28];
                                  } else {
                                    vErrors.push(err28);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs39 === errors2) {
                                if (data10.kind !== void 0) {
                                  const _errs40 = errors2;
                                  if ("native-task" !== data10.kind) {
                                    const err29 = { instancePath: instancePath + "/outcome/execution/kind", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/kind/const", keyword: "const", params: { allowedValue: "native-task" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors2++;
                                  }
                                  var valid9 = _errs40 === errors2;
                                } else {
                                  var valid9 = true;
                                }
                                if (valid9) {
                                  if (data10.proposalId !== void 0) {
                                    let data12 = data10.proposalId;
                                    const _errs41 = errors2;
                                    if (errors2 === _errs41) {
                                      if (errors2 === _errs41) {
                                        if (typeof data12 === "string") {
                                          if (!formats0.test(data12)) {
                                            const err30 = { instancePath: instancePath + "/outcome/execution/proposalId", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/proposalId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                            if (vErrors === null) {
                                              vErrors = [err30];
                                            } else {
                                              vErrors.push(err30);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err31 = { instancePath: instancePath + "/outcome/execution/proposalId", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/proposalId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err31];
                                          } else {
                                            vErrors.push(err31);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                    var valid9 = _errs41 === errors2;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data10.commandSha256 !== void 0) {
                                      let data13 = data10.commandSha256;
                                      const _errs43 = errors2;
                                      if (errors2 === _errs43) {
                                        if (typeof data13 === "string") {
                                          if (!pattern6.test(data13)) {
                                            const err32 = { instancePath: instancePath + "/outcome/execution/commandSha256", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/commandSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                            if (vErrors === null) {
                                              vErrors = [err32];
                                            } else {
                                              vErrors.push(err32);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err33 = { instancePath: instancePath + "/outcome/execution/commandSha256", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/commandSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err33];
                                          } else {
                                            vErrors.push(err33);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid9 = _errs43 === errors2;
                                    } else {
                                      var valid9 = true;
                                    }
                                    if (valid9) {
                                      if (data10.idempotencyKey !== void 0) {
                                        let data14 = data10.idempotencyKey;
                                        const _errs45 = errors2;
                                        if (errors2 === _errs45) {
                                          if (typeof data14 === "string") {
                                            if (func1(data14) < 1) {
                                              const err34 = { instancePath: instancePath + "/outcome/execution/idempotencyKey", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err34];
                                              } else {
                                                vErrors.push(err34);
                                              }
                                              errors2++;
                                            }
                                          } else {
                                            const err35 = { instancePath: instancePath + "/outcome/execution/idempotencyKey", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err35];
                                            } else {
                                              vErrors.push(err35);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid9 = _errs45 === errors2;
                                      } else {
                                        var valid9 = true;
                                      }
                                      if (valid9) {
                                        if (data10.binding !== void 0) {
                                          let data15 = data10.binding;
                                          const _errs47 = errors2;
                                          const _errs48 = errors2;
                                          if (errors2 === _errs48) {
                                            if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                              let missing5;
                                              if (data15.tenantId === void 0 && (missing5 = "tenantId") || data15.actorId === void 0 && (missing5 = "actorId") || data15.conversationId === void 0 && (missing5 = "conversationId") || data15.runId === void 0 && (missing5 = "runId") || data15.attemptId === void 0 && (missing5 = "attemptId") || data15.workerId === void 0 && (missing5 = "workerId") || data15.writerFence === void 0 && (missing5 = "writerFence")) {
                                                const err36 = { instancePath: instancePath + "/outcome/execution/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                                                if (vErrors === null) {
                                                  vErrors = [err36];
                                                } else {
                                                  vErrors.push(err36);
                                                }
                                                errors2++;
                                              } else {
                                                const _errs50 = errors2;
                                                for (const key5 in data15) {
                                                  if (!(key5 === "tenantId" || key5 === "actorId" || key5 === "conversationId" || key5 === "runId" || key5 === "attemptId" || key5 === "workerId" || key5 === "writerFence")) {
                                                    const err37 = { instancePath: instancePath + "/outcome/execution/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                                                    if (vErrors === null) {
                                                      vErrors = [err37];
                                                    } else {
                                                      vErrors.push(err37);
                                                    }
                                                    errors2++;
                                                    break;
                                                  }
                                                }
                                                if (_errs50 === errors2) {
                                                  if (data15.tenantId !== void 0) {
                                                    let data16 = data15.tenantId;
                                                    const _errs51 = errors2;
                                                    if (errors2 === _errs51) {
                                                      if (typeof data16 === "string") {
                                                        if (func1(data16) > 128) {
                                                          const err38 = { instancePath: instancePath + "/outcome/execution/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                          if (vErrors === null) {
                                                            vErrors = [err38];
                                                          } else {
                                                            vErrors.push(err38);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (func1(data16) < 1) {
                                                            const err39 = { instancePath: instancePath + "/outcome/execution/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                            if (vErrors === null) {
                                                              vErrors = [err39];
                                                            } else {
                                                              vErrors.push(err39);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      } else {
                                                        const err40 = { instancePath: instancePath + "/outcome/execution/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                        if (vErrors === null) {
                                                          vErrors = [err40];
                                                        } else {
                                                          vErrors.push(err40);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid11 = _errs51 === errors2;
                                                  } else {
                                                    var valid11 = true;
                                                  }
                                                  if (valid11) {
                                                    if (data15.actorId !== void 0) {
                                                      let data17 = data15.actorId;
                                                      const _errs53 = errors2;
                                                      if (errors2 === _errs53) {
                                                        if (typeof data17 === "string") {
                                                          if (func1(data17) > 128) {
                                                            const err41 = { instancePath: instancePath + "/outcome/execution/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                            if (vErrors === null) {
                                                              vErrors = [err41];
                                                            } else {
                                                              vErrors.push(err41);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (func1(data17) < 1) {
                                                              const err42 = { instancePath: instancePath + "/outcome/execution/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                              if (vErrors === null) {
                                                                vErrors = [err42];
                                                              } else {
                                                                vErrors.push(err42);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        } else {
                                                          const err43 = { instancePath: instancePath + "/outcome/execution/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                          if (vErrors === null) {
                                                            vErrors = [err43];
                                                          } else {
                                                            vErrors.push(err43);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                      var valid11 = _errs53 === errors2;
                                                    } else {
                                                      var valid11 = true;
                                                    }
                                                    if (valid11) {
                                                      if (data15.conversationId !== void 0) {
                                                        let data18 = data15.conversationId;
                                                        const _errs55 = errors2;
                                                        if (errors2 === _errs55) {
                                                          if (errors2 === _errs55) {
                                                            if (typeof data18 === "string") {
                                                              if (!formats0.test(data18)) {
                                                                const err44 = { instancePath: instancePath + "/outcome/execution/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                                if (vErrors === null) {
                                                                  vErrors = [err44];
                                                                } else {
                                                                  vErrors.push(err44);
                                                                }
                                                                errors2++;
                                                              }
                                                            } else {
                                                              const err45 = { instancePath: instancePath + "/outcome/execution/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                              if (vErrors === null) {
                                                                vErrors = [err45];
                                                              } else {
                                                                vErrors.push(err45);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                        var valid11 = _errs55 === errors2;
                                                      } else {
                                                        var valid11 = true;
                                                      }
                                                      if (valid11) {
                                                        if (data15.runId !== void 0) {
                                                          let data19 = data15.runId;
                                                          const _errs57 = errors2;
                                                          if (errors2 === _errs57) {
                                                            if (errors2 === _errs57) {
                                                              if (typeof data19 === "string") {
                                                                if (!formats0.test(data19)) {
                                                                  const err46 = { instancePath: instancePath + "/outcome/execution/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err46];
                                                                  } else {
                                                                    vErrors.push(err46);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              } else {
                                                                const err47 = { instancePath: instancePath + "/outcome/execution/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                if (vErrors === null) {
                                                                  vErrors = [err47];
                                                                } else {
                                                                  vErrors.push(err47);
                                                                }
                                                                errors2++;
                                                              }
                                                            }
                                                          }
                                                          var valid11 = _errs57 === errors2;
                                                        } else {
                                                          var valid11 = true;
                                                        }
                                                        if (valid11) {
                                                          if (data15.attemptId !== void 0) {
                                                            let data20 = data15.attemptId;
                                                            const _errs59 = errors2;
                                                            if (errors2 === _errs59) {
                                                              if (errors2 === _errs59) {
                                                                if (typeof data20 === "string") {
                                                                  if (!formats0.test(data20)) {
                                                                    const err48 = { instancePath: instancePath + "/outcome/execution/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err48];
                                                                    } else {
                                                                      vErrors.push(err48);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                } else {
                                                                  const err49 = { instancePath: instancePath + "/outcome/execution/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err49];
                                                                  } else {
                                                                    vErrors.push(err49);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              }
                                                            }
                                                            var valid11 = _errs59 === errors2;
                                                          } else {
                                                            var valid11 = true;
                                                          }
                                                          if (valid11) {
                                                            if (data15.workerId !== void 0) {
                                                              let data21 = data15.workerId;
                                                              const _errs61 = errors2;
                                                              if (errors2 === _errs61) {
                                                                if (errors2 === _errs61) {
                                                                  if (typeof data21 === "string") {
                                                                    if (!formats0.test(data21)) {
                                                                      const err50 = { instancePath: instancePath + "/outcome/execution/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                                      if (vErrors === null) {
                                                                        vErrors = [err50];
                                                                      } else {
                                                                        vErrors.push(err50);
                                                                      }
                                                                      errors2++;
                                                                    }
                                                                  } else {
                                                                    const err51 = { instancePath: instancePath + "/outcome/execution/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err51];
                                                                    } else {
                                                                      vErrors.push(err51);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                }
                                                              }
                                                              var valid11 = _errs61 === errors2;
                                                            } else {
                                                              var valid11 = true;
                                                            }
                                                            if (valid11) {
                                                              if (data15.writerFence !== void 0) {
                                                                let data22 = data15.writerFence;
                                                                const _errs63 = errors2;
                                                                if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                                                  const err52 = { instancePath: instancePath + "/outcome/execution/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err52];
                                                                  } else {
                                                                    vErrors.push(err52);
                                                                  }
                                                                  errors2++;
                                                                }
                                                                if (errors2 === _errs63) {
                                                                  if (typeof data22 == "number" && isFinite(data22)) {
                                                                    if (data22 > 9007199254740991 || isNaN(data22)) {
                                                                      const err53 = { instancePath: instancePath + "/outcome/execution/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                                      if (vErrors === null) {
                                                                        vErrors = [err53];
                                                                      } else {
                                                                        vErrors.push(err53);
                                                                      }
                                                                      errors2++;
                                                                    } else {
                                                                      if (data22 < 1 || isNaN(data22)) {
                                                                        const err54 = { instancePath: instancePath + "/outcome/execution/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                                        if (vErrors === null) {
                                                                          vErrors = [err54];
                                                                        } else {
                                                                          vErrors.push(err54);
                                                                        }
                                                                        errors2++;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid11 = _errs63 === errors2;
                                                              } else {
                                                                var valid11 = true;
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
                                              const err55 = { instancePath: instancePath + "/outcome/execution/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                              if (vErrors === null) {
                                                vErrors = [err55];
                                              } else {
                                                vErrors.push(err55);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid9 = _errs47 === errors2;
                                        } else {
                                          var valid9 = true;
                                        }
                                        if (valid9) {
                                          if (data10.completedAt !== void 0) {
                                            let data23 = data10.completedAt;
                                            const _errs65 = errors2;
                                            if (errors2 === _errs65) {
                                              if (typeof data23 === "string") {
                                                if (!pattern19.test(data23)) {
                                                  const err56 = { instancePath: instancePath + "/outcome/execution/completedAt", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/completedAt/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err56];
                                                  } else {
                                                    vErrors.push(err56);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err57 = { instancePath: instancePath + "/outcome/execution/completedAt", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/completedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err57];
                                                } else {
                                                  vErrors.push(err57);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid9 = _errs65 === errors2;
                                          } else {
                                            var valid9 = true;
                                          }
                                          if (valid9) {
                                            if (data10.approvalDecisionSha256 !== void 0) {
                                              let data24 = data10.approvalDecisionSha256;
                                              const _errs67 = errors2;
                                              if (errors2 === _errs67) {
                                                if (typeof data24 === "string") {
                                                  if (!pattern6.test(data24)) {
                                                    const err58 = { instancePath: instancePath + "/outcome/execution/approvalDecisionSha256", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/approvalDecisionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err58];
                                                    } else {
                                                      vErrors.push(err58);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err59 = { instancePath: instancePath + "/outcome/execution/approvalDecisionSha256", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/properties/approvalDecisionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err59];
                                                  } else {
                                                    vErrors.push(err59);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid9 = _errs67 === errors2;
                                            } else {
                                              var valid9 = true;
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
                            const err60 = { instancePath: instancePath + "/outcome/execution", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/properties/execution/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err60];
                            } else {
                              vErrors.push(err60);
                            }
                            errors2++;
                          }
                        }
                        var valid8 = _errs37 === errors2;
                      } else {
                        var valid8 = true;
                      }
                      if (valid8) {
                        if (data1.result !== void 0) {
                          let data25 = data1.result;
                          const _errs69 = errors2;
                          const _errs70 = errors2;
                          if (errors2 === _errs70) {
                            if (data25 && typeof data25 == "object" && !Array.isArray(data25)) {
                              let missing6;
                              if (data25.id === void 0 && (missing6 = "id") || data25.title === void 0 && (missing6 = "title") || data25.status === void 0 && (missing6 = "status") || data25.dueDate === void 0 && (missing6 = "dueDate") || data25.clientId === void 0 && (missing6 = "clientId") || data25.updatedAt === void 0 && (missing6 = "updatedAt")) {
                                const err61 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err61];
                                } else {
                                  vErrors.push(err61);
                                }
                                errors2++;
                              } else {
                                const _errs72 = errors2;
                                for (const key6 in data25) {
                                  if (!(key6 === "id" || key6 === "title" || key6 === "status" || key6 === "dueDate" || key6 === "clientId" || key6 === "updatedAt")) {
                                    const err62 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err62];
                                    } else {
                                      vErrors.push(err62);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs72 === errors2) {
                                  if (data25.id !== void 0) {
                                    let data26 = data25.id;
                                    const _errs73 = errors2;
                                    if (errors2 === _errs73) {
                                      if (errors2 === _errs73) {
                                        if (typeof data26 === "string") {
                                          if (!formats0.test(data26)) {
                                            const err63 = { instancePath: instancePath + "/outcome/result/id", schemaPath: "#/$defs/TaskUpdateResult/properties/id/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                            if (vErrors === null) {
                                              vErrors = [err63];
                                            } else {
                                              vErrors.push(err63);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err64 = { instancePath: instancePath + "/outcome/result/id", schemaPath: "#/$defs/TaskUpdateResult/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err64];
                                          } else {
                                            vErrors.push(err64);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                    var valid13 = _errs73 === errors2;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data25.title !== void 0) {
                                      const _errs75 = errors2;
                                      if (typeof data25.title !== "string") {
                                        const err65 = { instancePath: instancePath + "/outcome/result/title", schemaPath: "#/$defs/TaskUpdateResult/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err65];
                                        } else {
                                          vErrors.push(err65);
                                        }
                                        errors2++;
                                      }
                                      var valid13 = _errs75 === errors2;
                                    } else {
                                      var valid13 = true;
                                    }
                                    if (valid13) {
                                      if (data25.status !== void 0) {
                                        let data28 = data25.status;
                                        const _errs77 = errors2;
                                        if (!(data28 === "todo" || data28 === "in_progress" || data28 === "done" || data28 === "blocked" || data28 === "canceled")) {
                                          const err66 = { instancePath: instancePath + "/outcome/result/status", schemaPath: "#/$defs/TaskUpdateResult/properties/status/enum", keyword: "enum", params: { allowedValues: schema44.properties.status.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err66];
                                          } else {
                                            vErrors.push(err66);
                                          }
                                          errors2++;
                                        }
                                        var valid13 = _errs77 === errors2;
                                      } else {
                                        var valid13 = true;
                                      }
                                      if (valid13) {
                                        if (data25.dueDate !== void 0) {
                                          let data29 = data25.dueDate;
                                          const _errs78 = errors2;
                                          const _errs79 = errors2;
                                          let valid14 = false;
                                          const _errs80 = errors2;
                                          if (errors2 === _errs80) {
                                            if (errors2 === _errs80) {
                                              if (typeof data29 === "string") {
                                                if (!pattern4.test(data29)) {
                                                  const err67 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err67];
                                                  } else {
                                                    vErrors.push(err67);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!formats2.validate(data29)) {
                                                    const err68 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err68];
                                                    } else {
                                                      vErrors.push(err68);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              } else {
                                                const err69 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err69];
                                                } else {
                                                  vErrors.push(err69);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                          var _valid4 = _errs80 === errors2;
                                          valid14 = valid14 || _valid4;
                                          const _errs82 = errors2;
                                          if (data29 !== null) {
                                            const err70 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                            if (vErrors === null) {
                                              vErrors = [err70];
                                            } else {
                                              vErrors.push(err70);
                                            }
                                            errors2++;
                                          }
                                          var _valid4 = _errs82 === errors2;
                                          valid14 = valid14 || _valid4;
                                          if (!valid14) {
                                            const err71 = { instancePath: instancePath + "/outcome/result/dueDate", schemaPath: "#/$defs/TaskUpdateResult/properties/dueDate/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                            if (vErrors === null) {
                                              vErrors = [err71];
                                            } else {
                                              vErrors.push(err71);
                                            }
                                            errors2++;
                                          } else {
                                            errors2 = _errs79;
                                            if (vErrors !== null) {
                                              if (_errs79) {
                                                vErrors.length = _errs79;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid13 = _errs78 === errors2;
                                        } else {
                                          var valid13 = true;
                                        }
                                        if (valid13) {
                                          if (data25.clientId !== void 0) {
                                            let data30 = data25.clientId;
                                            const _errs84 = errors2;
                                            const _errs85 = errors2;
                                            let valid15 = false;
                                            const _errs86 = errors2;
                                            if (errors2 === _errs86) {
                                              if (errors2 === _errs86) {
                                                if (typeof data30 === "string") {
                                                  if (!formats0.test(data30)) {
                                                    const err72 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err72];
                                                    } else {
                                                      vErrors.push(err72);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err73 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err73];
                                                  } else {
                                                    vErrors.push(err73);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                            var _valid5 = _errs86 === errors2;
                                            valid15 = valid15 || _valid5;
                                            const _errs88 = errors2;
                                            if (data30 !== null) {
                                              const err74 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                              if (vErrors === null) {
                                                vErrors = [err74];
                                              } else {
                                                vErrors.push(err74);
                                              }
                                              errors2++;
                                            }
                                            var _valid5 = _errs88 === errors2;
                                            valid15 = valid15 || _valid5;
                                            if (!valid15) {
                                              const err75 = { instancePath: instancePath + "/outcome/result/clientId", schemaPath: "#/$defs/TaskUpdateResult/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                              if (vErrors === null) {
                                                vErrors = [err75];
                                              } else {
                                                vErrors.push(err75);
                                              }
                                              errors2++;
                                            } else {
                                              errors2 = _errs85;
                                              if (vErrors !== null) {
                                                if (_errs85) {
                                                  vErrors.length = _errs85;
                                                } else {
                                                  vErrors = null;
                                                }
                                              }
                                            }
                                            var valid13 = _errs84 === errors2;
                                          } else {
                                            var valid13 = true;
                                          }
                                          if (valid13) {
                                            if (data25.updatedAt !== void 0) {
                                              let data31 = data25.updatedAt;
                                              const _errs90 = errors2;
                                              if (errors2 === _errs90) {
                                                if (errors2 === _errs90) {
                                                  if (typeof data31 === "string") {
                                                    if (!pattern4.test(data31)) {
                                                      const err76 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                      if (vErrors === null) {
                                                        vErrors = [err76];
                                                      } else {
                                                        vErrors.push(err76);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (!formats2.validate(data31)) {
                                                        const err77 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                        if (vErrors === null) {
                                                          vErrors = [err77];
                                                        } else {
                                                          vErrors.push(err77);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err78 = { instancePath: instancePath + "/outcome/result/updatedAt", schemaPath: "#/$defs/TaskUpdateResult/properties/updatedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err78];
                                                    } else {
                                                      vErrors.push(err78);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              }
                                              var valid13 = _errs90 === errors2;
                                            } else {
                                              var valid13 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err79 = { instancePath: instancePath + "/outcome/result", schemaPath: "#/$defs/TaskUpdateResult/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err79];
                              } else {
                                vErrors.push(err79);
                              }
                              errors2++;
                            }
                          }
                          var valid8 = _errs69 === errors2;
                        } else {
                          var valid8 = true;
                        }
                      }
                    }
                  }
                } else {
                  const err80 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err80];
                  } else {
                    vErrors.push(err80);
                  }
                  errors2++;
                }
              }
              var _valid1 = _errs34 === errors2;
              if (_valid1 && valid2) {
                valid2 = false;
                passing1 = [passing1, 1];
              } else {
                if (_valid1) {
                  valid2 = true;
                  passing1 = 1;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
              }
              if (!valid2) {
                const err81 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/0/properties/outcome/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                if (vErrors === null) {
                  vErrors = [err81];
                } else {
                  vErrors.push(err81);
                }
                errors2++;
              } else {
                errors2 = _errs6;
                if (vErrors !== null) {
                  if (_errs6) {
                    vErrors.length = _errs6;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid1 = _errs5 === errors2;
            } else {
              var valid1 = true;
            }
          }
        }
      }
    } else {
      const err82 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err82];
      } else {
        vErrors.push(err82);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props1 = true;
  }
  const _errs92 = errors2;
  if (errors2 === _errs92) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing7;
      if (data.status === void 0 && (missing7 = "status") || data.outcome === void 0 && (missing7 = "outcome")) {
        const err83 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
        if (vErrors === null) {
          vErrors = [err83];
        } else {
          vErrors.push(err83);
        }
        errors2++;
      } else {
        const _errs94 = errors2;
        for (const key7 in data) {
          if (!(key7 === "status" || key7 === "outcome")) {
            const err84 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err84];
            } else {
              vErrors.push(err84);
            }
            errors2++;
            break;
          }
        }
        if (_errs94 === errors2) {
          if (data.status !== void 0) {
            const _errs95 = errors2;
            if ("indeterminate" !== data.status) {
              const err85 = { instancePath: instancePath + "/status", schemaPath: "#/oneOf/1/properties/status/const", keyword: "const", params: { allowedValue: "indeterminate" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err85];
              } else {
                vErrors.push(err85);
              }
              errors2++;
            }
            var valid16 = _errs95 === errors2;
          } else {
            var valid16 = true;
          }
          if (valid16) {
            if (data.outcome !== void 0) {
              const _errs96 = errors2;
              if (data.outcome !== null) {
                const err86 = { instancePath: instancePath + "/outcome", schemaPath: "#/oneOf/1/properties/outcome/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err86];
                } else {
                  vErrors.push(err86);
                }
                errors2++;
              }
              var valid16 = _errs96 === errors2;
            } else {
              var valid16 = true;
            }
          }
        }
      }
    } else {
      const err87 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err87];
      } else {
        vErrors.push(err87);
      }
      errors2++;
    }
  }
  var _valid0 = _errs92 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props1 !== true) {
        props1 = true;
      }
    }
  }
  if (!valid0) {
    const err88 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err88];
    } else {
      vErrors.push(err88);
    }
    errors2++;
    validate66.errors = vErrors;
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
  validate66.errors = vErrors;
  evaluated0.props = props1;
  return errors2 === 0;
}
validate66.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateTaskCommandErrorResponse = validate68;
var schema63 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "type": "string", "enum": ["ACCESS_DENIED", "APPLICATION_CLOCK", "APPLICATION_CONFIGURATION", "CANCELLED", "COMMAND_APPROVAL_REFUSED", "COMMAND_AUTHORITY_REFUSED", "COMMAND_COMMIT_UNCERTAIN", "COMMAND_OUTCOME_UNKNOWN", "COMMAND_PREPARATION_REFUSED", "COMMAND_REFUSED", "DEADLINE", "INVALID_BODY", "INVALID_CONTENT_LENGTH", "INVALID_JSON", "INVALID_REQUEST", "INVALID_UTF8", "LOOKUP_REPLAY", "LOOKUP_UNAVAILABLE", "METHOD_NOT_ALLOWED", "NOT_FOUND", "REQUEST_FAILED", "REQUEST_TOO_LARGE", "RESPONSE_TOO_LARGE", "SESSION_SCOPE_REFUSED", "TASK_COMMAND_UNAVAILABLE", "UNAUTHENTICATED", "UNAVAILABLE", "UNSUPPORTED_CONTENT_ENCODING", "UNSUPPORTED_MEDIA_TYPE"] }, "outcome": { "type": "string", "enum": ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED", "STORED_NOT_RELEASED", "NOT_STORED", "READ_UNAVAILABLE"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate68(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate68.evaluated;
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
        validate68.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate68.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate68.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate68.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (typeof data1 !== "string") {
                        validate68.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data1 === "ACCESS_DENIED" || data1 === "APPLICATION_CLOCK" || data1 === "APPLICATION_CONFIGURATION" || data1 === "CANCELLED" || data1 === "COMMAND_APPROVAL_REFUSED" || data1 === "COMMAND_AUTHORITY_REFUSED" || data1 === "COMMAND_COMMIT_UNCERTAIN" || data1 === "COMMAND_OUTCOME_UNKNOWN" || data1 === "COMMAND_PREPARATION_REFUSED" || data1 === "COMMAND_REFUSED" || data1 === "DEADLINE" || data1 === "INVALID_BODY" || data1 === "INVALID_CONTENT_LENGTH" || data1 === "INVALID_JSON" || data1 === "INVALID_REQUEST" || data1 === "INVALID_UTF8" || data1 === "LOOKUP_REPLAY" || data1 === "LOOKUP_UNAVAILABLE" || data1 === "METHOD_NOT_ALLOWED" || data1 === "NOT_FOUND" || data1 === "REQUEST_FAILED" || data1 === "REQUEST_TOO_LARGE" || data1 === "RESPONSE_TOO_LARGE" || data1 === "SESSION_SCOPE_REFUSED" || data1 === "TASK_COMMAND_UNAVAILABLE" || data1 === "UNAUTHENTICATED" || data1 === "UNAVAILABLE" || data1 === "UNSUPPORTED_CONTENT_ENCODING" || data1 === "UNSUPPORTED_MEDIA_TYPE")) {
                        validate68.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema63.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
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
                          validate68.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED" || data2 === "STORED_NOT_RELEASED" || data2 === "NOT_STORED" || data2 === "READ_UNAVAILABLE")) {
                          validate68.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema63.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid1 = _errs7 === errors2;
                      } else {
                        var valid1 = true;
                      }
                    }
                  }
                }
              } else {
                validate68.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate68.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate68.errors = vErrors;
  return errors2 === 0;
}
validate68.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskCommandExpectedBinding = validate69;
function validate69(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate69.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId")) {
        validate69.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId")) {
            validate69.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate69.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate69.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate69.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate69.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate69.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate69.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.conversationId !== void 0) {
                let data2 = data.conversationId;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (errors2 === _errs6) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate69.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate69.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.runId !== void 0) {
                  let data3 = data.runId;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (errors2 === _errs8) {
                      if (typeof data3 === "string") {
                        if (!formats0.test(data3)) {
                          validate69.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                          return false;
                        }
                      } else {
                        validate69.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate69.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate69.errors = vErrors;
  return errors2 === 0;
}
validate69.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskUpdateContext = validate70;
function validate70(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate70.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.binding === void 0 && (missing0 = "binding")) {
        validate70.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "binding")) {
            validate70.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.binding !== void 0) {
            let data0 = data.binding;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId") || data0.conversationId === void 0 && (missing1 = "conversationId") || data0.runId === void 0 && (missing1 = "runId") || data0.attemptId === void 0 && (missing1 = "attemptId") || data0.workerId === void 0 && (missing1 = "workerId") || data0.writerFence === void 0 && (missing1 = "writerFence")) {
                  validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs5 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                      validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                            validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                            return false;
                          } else {
                            if (func1(data1) < 1) {
                              validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          }
                        } else {
                          validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func1(data2) < 1) {
                                validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate70.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                  return false;
                                }
                              } else {
                                validate70.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate70.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate70.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate70.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate70.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate70.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate70.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors2 === _errs18) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 9007199254740991 || isNaN(data7)) {
                                        validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate70.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate70.errors = vErrors;
  return errors2 === 0;
}
validate70.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateTaskUpdateCommand = validate71;
function validate71(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate71.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.commandId === void 0 && (missing0 = "commandId") || data.binding === void 0 && (missing0 = "binding") || data.action === void 0 && (missing0 = "action") || data.arguments === void 0 && (missing0 = "arguments") || data.attachments === void 0 && (missing0 = "attachments") || data.scopes === void 0 && (missing0 = "scopes") || data.idempotencyKey === void 0 && (missing0 = "idempotencyKey")) {
        validate71.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "contractVersion" || key0 === "commandId" || key0 === "binding" || key0 === "action" || key0 === "arguments" || key0 === "attachments" || key0 === "scopes" || key0 === "idempotencyKey")) {
            validate71.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.2.0" !== data.contractVersion) {
              validate71.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.commandId !== void 0) {
              let data1 = data.commandId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate71.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate71.errors = [{ instancePath: instancePath + "/commandId", schemaPath: "#/properties/commandId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.binding !== void 0) {
                let data2 = data.binding;
                const _errs5 = errors2;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.tenantId === void 0 && (missing1 = "tenantId") || data2.actorId === void 0 && (missing1 = "actorId") || data2.conversationId === void 0 && (missing1 = "conversationId") || data2.runId === void 0 && (missing1 = "runId") || data2.attemptId === void 0 && (missing1 = "attemptId") || data2.workerId === void 0 && (missing1 = "workerId") || data2.writerFence === void 0 && (missing1 = "writerFence")) {
                      validate71.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate71.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                validate71.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate71.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate71.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate71.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate71.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate71.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate71.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate71.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate71.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate71.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate71.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate71.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate71.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate71.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate71.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate71.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate71.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                    validate71.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.action !== void 0) {
                  const _errs23 = errors2;
                  if ("task.update" !== data.action) {
                    validate71.errors = [{ instancePath: instancePath + "/action", schemaPath: "#/properties/action/const", keyword: "const", params: { allowedValue: "task.update" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.arguments !== void 0) {
                    let data11 = data.arguments;
                    const _errs24 = errors2;
                    const _errs25 = errors2;
                    if (errors2 === _errs25) {
                      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                        let missing2;
                        if (data11.taskId === void 0 && (missing2 = "taskId") || data11.mode === void 0 && (missing2 = "mode") || data11.patch === void 0 && (missing2 = "patch")) {
                          validate71.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                          return false;
                        } else {
                          const _errs27 = errors2;
                          for (const key2 in data11) {
                            if (!(key2 === "taskId" || key2 === "mode" || key2 === "patch")) {
                              validate71.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs27 === errors2) {
                            if (data11.taskId !== void 0) {
                              let data12 = data11.taskId;
                              const _errs28 = errors2;
                              if (errors2 === _errs28) {
                                if (errors2 === _errs28) {
                                  if (typeof data12 === "string") {
                                    if (!formats0.test(data12)) {
                                      validate71.errors = [{ instancePath: instancePath + "/arguments/taskId", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate71.errors = [{ instancePath: instancePath + "/arguments/taskId", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/taskId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid4 = _errs28 === errors2;
                            } else {
                              var valid4 = true;
                            }
                            if (valid4) {
                              if (data11.mode !== void 0) {
                                const _errs30 = errors2;
                                if ("unconditional_patch" !== data11.mode) {
                                  validate71.errors = [{ instancePath: instancePath + "/arguments/mode", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/mode/const", keyword: "const", params: { allowedValue: "unconditional_patch" }, message: "must be equal to constant" }];
                                  return false;
                                }
                                var valid4 = _errs30 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data11.patch !== void 0) {
                                  let data14 = data11.patch;
                                  const _errs31 = errors2;
                                  if (errors2 === _errs31) {
                                    if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                                      if (Object.keys(data14).length < 1) {
                                        validate71.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/minProperties", keyword: "minProperties", params: { limit: 1 }, message: "must NOT have fewer than 1 properties" }];
                                        return false;
                                      } else {
                                        const _errs33 = errors2;
                                        for (const key3 in data14) {
                                          if (!(key3 === "title" || key3 === "status" || key3 === "dueDate")) {
                                            validate71.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs33 === errors2) {
                                          if (data14.title !== void 0) {
                                            let data15 = data14.title;
                                            const _errs34 = errors2;
                                            if (errors2 === _errs34) {
                                              if (typeof data15 === "string") {
                                                if (func1(data15) > 240) {
                                                  validate71.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/maxLength", keyword: "maxLength", params: { limit: 240 }, message: "must NOT have more than 240 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data15) < 1) {
                                                    validate71.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate71.errors = [{ instancePath: instancePath + "/arguments/patch/title", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid5 = _errs34 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data14.status !== void 0) {
                                              let data16 = data14.status;
                                              const _errs36 = errors2;
                                              if (!(data16 === "todo" || data16 === "in_progress" || data16 === "done" || data16 === "blocked" || data16 === "canceled")) {
                                                validate71.errors = [{ instancePath: instancePath + "/arguments/patch/status", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/status/enum", keyword: "enum", params: { allowedValues: schema35.properties.patch.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                                return false;
                                              }
                                              var valid5 = _errs36 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data14.dueDate !== void 0) {
                                                let data17 = data14.dueDate;
                                                const _errs37 = errors2;
                                                if (errors2 === _errs37) {
                                                  if (errors2 === _errs37) {
                                                    if (typeof data17 === "string") {
                                                      if (!pattern4.test(data17)) {
                                                        validate71.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                        return false;
                                                      } else {
                                                        if (!formats2.validate(data17)) {
                                                          validate71.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate71.errors = [{ instancePath: instancePath + "/arguments/patch/dueDate", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/properties/dueDate/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                                var valid5 = _errs37 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate71.errors = [{ instancePath: instancePath + "/arguments/patch", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/properties/patch/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
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
                        validate71.errors = [{ instancePath: instancePath + "/arguments", schemaPath: "#/$defs/Canonical_TaskUpdateArguments_48509a7a/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs24 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.attachments !== void 0) {
                      let data18 = data.attachments;
                      const _errs39 = errors2;
                      if (errors2 === _errs39) {
                        if (Array.isArray(data18)) {
                          if (data18.length > 0) {
                            validate71.errors = [{ instancePath: instancePath + "/attachments", schemaPath: "#/properties/attachments/maxItems", keyword: "maxItems", params: { limit: 0 }, message: "must NOT have more than 0 items" }];
                            return false;
                          }
                        } else {
                          validate71.errors = [{ instancePath: instancePath + "/attachments", schemaPath: "#/properties/attachments/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs39 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.scopes !== void 0) {
                        let data19 = data.scopes;
                        const _errs41 = errors2;
                        if (errors2 === _errs41) {
                          if (Array.isArray(data19)) {
                            if (data19.length < 1) {
                              validate71.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                              return false;
                            } else {
                              var valid6 = true;
                              const len0 = data19.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                let data20 = data19[i0];
                                const _errs43 = errors2;
                                const _errs44 = errors2;
                                if (errors2 === _errs44) {
                                  if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                    let missing3;
                                    if (data20.tenantId === void 0 && (missing3 = "tenantId") || data20.kind === void 0 && (missing3 = "kind") || data20.resourceId === void 0 && (missing3 = "resourceId") || data20.policyRevision === void 0 && (missing3 = "policyRevision")) {
                                      validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                      return false;
                                    } else {
                                      const _errs46 = errors2;
                                      for (const key4 in data20) {
                                        if (!(key4 === "tenantId" || key4 === "kind" || key4 === "resourceId" || key4 === "policyRevision")) {
                                          validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs46 === errors2) {
                                        if (data20.tenantId !== void 0) {
                                          let data21 = data20.tenantId;
                                          const _errs47 = errors2;
                                          if (errors2 === _errs47) {
                                            if (typeof data21 === "string") {
                                              if (func1(data21) > 128) {
                                                validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data21) < 1) {
                                                  validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid8 = _errs47 === errors2;
                                        } else {
                                          var valid8 = true;
                                        }
                                        if (valid8) {
                                          if (data20.kind !== void 0) {
                                            let data22 = data20.kind;
                                            const _errs49 = errors2;
                                            if (typeof data22 !== "string") {
                                              validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data22 === "tenant" || data22 === "client" || data22 === "mailbox" || data22 === "memory" || data22 === "document" || data22 === "private-user" || data22 === "public")) {
                                              validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema41.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid8 = _errs49 === errors2;
                                          } else {
                                            var valid8 = true;
                                          }
                                          if (valid8) {
                                            if (data20.resourceId !== void 0) {
                                              let data23 = data20.resourceId;
                                              const _errs51 = errors2;
                                              if (errors2 === _errs51) {
                                                if (typeof data23 === "string") {
                                                  if (func1(data23) > 256) {
                                                    validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data23) < 1) {
                                                      validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid8 = _errs51 === errors2;
                                            } else {
                                              var valid8 = true;
                                            }
                                            if (valid8) {
                                              if (data20.policyRevision !== void 0) {
                                                let data24 = data20.policyRevision;
                                                const _errs53 = errors2;
                                                if (errors2 === _errs53) {
                                                  if (typeof data24 === "string") {
                                                    if (func1(data24) > 128) {
                                                      validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func1(data24) < 1) {
                                                        validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid8 = _errs53 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate71.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid6 = _errs43 === errors2;
                                if (!valid6) {
                                  break;
                                }
                              }
                              if (valid6) {
                                let i1 = data19.length;
                                let j0;
                                if (i1 > 1) {
                                  outer0: for (; i1--; ) {
                                    for (j0 = i1; j0--; ) {
                                      if (func0(data19[i1], data19[j0])) {
                                        validate71.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate71.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid0 = _errs41 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.idempotencyKey !== void 0) {
                          let data25 = data.idempotencyKey;
                          const _errs55 = errors2;
                          if (errors2 === _errs55) {
                            if (typeof data25 === "string") {
                              if (func1(data25) > 128) {
                                validate71.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data25) < 1) {
                                  validate71.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate71.errors = [{ instancePath: instancePath + "/idempotencyKey", schemaPath: "#/properties/idempotencyKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs55 === errors2;
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
      validate71.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate71.errors = vErrors;
  return errors2 === 0;
}
validate71.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateRunBinding = validate72;
function validate72(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate72.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.attemptId === void 0 && (missing0 = "attemptId") || data.workerId === void 0 && (missing0 = "workerId") || data.writerFence === void 0 && (missing0 = "writerFence")) {
        validate72.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId" || key0 === "attemptId" || key0 === "workerId" || key0 === "writerFence")) {
            validate72.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate72.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate72.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate72.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate72.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate72.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate72.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.conversationId !== void 0) {
                let data2 = data.conversationId;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (errors2 === _errs6) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate72.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate72.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.runId !== void 0) {
                  let data3 = data.runId;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (errors2 === _errs8) {
                      if (typeof data3 === "string") {
                        if (!formats0.test(data3)) {
                          validate72.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                          return false;
                        }
                      } else {
                        validate72.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.attemptId !== void 0) {
                    let data4 = data.attemptId;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (errors2 === _errs10) {
                        if (typeof data4 === "string") {
                          if (!formats0.test(data4)) {
                            validate72.errors = [{ instancePath: instancePath + "/attemptId", schemaPath: "#/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                            return false;
                          }
                        } else {
                          validate72.errors = [{ instancePath: instancePath + "/attemptId", schemaPath: "#/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs10 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.workerId !== void 0) {
                      let data5 = data.workerId;
                      const _errs12 = errors2;
                      if (errors2 === _errs12) {
                        if (errors2 === _errs12) {
                          if (typeof data5 === "string") {
                            if (!formats0.test(data5)) {
                              validate72.errors = [{ instancePath: instancePath + "/workerId", schemaPath: "#/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate72.errors = [{ instancePath: instancePath + "/workerId", schemaPath: "#/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                      }
                      var valid0 = _errs12 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.writerFence !== void 0) {
                        let data6 = data.writerFence;
                        const _errs14 = errors2;
                        if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                          validate72.errors = [{ instancePath: instancePath + "/writerFence", schemaPath: "#/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                          return false;
                        }
                        if (errors2 === _errs14) {
                          if (typeof data6 == "number" && isFinite(data6)) {
                            if (data6 > 9007199254740991 || isNaN(data6)) {
                              validate72.errors = [{ instancePath: instancePath + "/writerFence", schemaPath: "#/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                              return false;
                            } else {
                              if (data6 < 1 || isNaN(data6)) {
                                validate72.errors = [{ instancePath: instancePath + "/writerFence", schemaPath: "#/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                return false;
                              }
                            }
                          }
                        }
                        var valid0 = _errs14 === errors2;
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
      validate72.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate72.errors = vErrors;
  return errors2 === 0;
}
validate72.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validators = { TaskUpdateRaw: validateTaskUpdateRaw, TaskUpdateArguments: validateTaskUpdateArguments, TaskUpdateApprovalProposal: validateTaskUpdateApprovalProposal, TaskUpdateResult: validateTaskUpdateResult, TaskCommandPrepareRequest: validateTaskCommandPrepareRequest, TaskCommandExecuteRequest: validateTaskCommandExecuteRequest, TaskCommandPrepareResponse: validateTaskCommandPrepareResponse, TaskCommandExecuteResponse: validateTaskCommandExecuteResponse, TaskCommandErrorResponse: validateTaskCommandErrorResponse, TaskCommandExpectedBinding: validateTaskCommandExpectedBinding, TaskUpdateContext: validateTaskUpdateContext, TaskUpdateCommand: validateTaskUpdateCommand, RunBinding: validateRunBinding };

// task-command-generated:./generated-status.mjs
var errorStatuses = { "ACCESS_DENIED": 403, "APPLICATION_CLOCK": 500, "APPLICATION_CONFIGURATION": 500, "CANCELLED": 499, "COMMAND_APPROVAL_REFUSED": 409, "COMMAND_AUTHORITY_REFUSED": 502, "COMMAND_COMMIT_UNCERTAIN": 502, "COMMAND_OUTCOME_UNKNOWN": 502, "COMMAND_PREPARATION_REFUSED": 502, "COMMAND_REFUSED": 502, "DEADLINE": 408, "INVALID_BODY": 400, "INVALID_CONTENT_LENGTH": 400, "INVALID_JSON": 400, "INVALID_REQUEST": 400, "INVALID_UTF8": 400, "LOOKUP_REPLAY": 409, "LOOKUP_UNAVAILABLE": 502, "METHOD_NOT_ALLOWED": 405, "NOT_FOUND": 404, "REQUEST_FAILED": 502, "REQUEST_TOO_LARGE": 413, "RESPONSE_TOO_LARGE": 413, "SESSION_SCOPE_REFUSED": 403, "TASK_COMMAND_UNAVAILABLE": 503, "UNAUTHENTICATED": 401, "UNAVAILABLE": 502, "UNSUPPORTED_CONTENT_ENCODING": 415, "UNSUPPORTED_MEDIA_TYPE": 415 };
var errorOutcomes = ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED", "STORED_NOT_RELEASED", "NOT_STORED", "READ_UNAVAILABLE"];

// task-command-application/protocol.mjs
var taskCommandVersion = "0.1.0";
var taskCommandSchemaId = "urn:meri:task-command-application:0.1.0";
var taskCommandPaths = Object.freeze({ prepare: "/api/task-commands/prepare", execute: "/api/task-commands/execute" });
var taskCommandLimits = Object.freeze({ requestBytes: 16777216, responseBytes: 16777216, jsonNodes: 1e5, jsonDepth: 64 });
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var createTaskCommandMetadata = (errorStatuses2, errorOutcomes2) => freeze({
  contractVersion: taskCommandVersion,
  schemaId: taskCommandSchemaId,
  routes: { prepare: { method: "POST", path: taskCommandPaths.prepare, response: "json" }, execute: { method: "POST", path: taskCommandPaths.execute, response: "json" } },
  authentication: { scheme: "Bearer", authority: "trusted session resolution and current server approval/command owners", expectedContext: "independently authenticated tenantId, actorId, conversationId and runId" },
  limits: taskCommandLimits,
  errorStatuses: errorStatuses2,
  errorOutcomes: errorOutcomes2,
  semantics: { preparation: "approval_required is an immutable proposal, never approval", execution: "observed requires a succeeded receipt and matching task result; indeterminate is not success", expiry: "caller checks createdAt/expiresAt against a fresh clock before display and execution; server rechecks current authority", resume: "attemptId, workerId and writerFence may change within the same stable tenant/actor/conversation/run binding" }
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

// task-command-application/boundary.mjs
var TaskCommandResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "TaskCommandResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new TaskCommandResponseError(code);
};
function parseText(value, cap) {
  if (typeof value !== "string") fail2("TASK_COMMAND_JSON");
  if (value.length > cap) fail2("TASK_COMMAND_LIMIT");
  if (!value.isWellFormed()) fail2("TASK_COMMAND_JSON");
  try {
    return parseBytes(new TextEncoder().encode(value), cap);
  } catch (error) {
    fail2(["BYTE_LIMIT", "JSON_LIMIT"].includes(error.code) ? "TASK_COMMAND_LIMIT" : "TASK_COMMAND_JSON");
  }
}
function snapshotExpected(value) {
  const visit = (v, depth) => {
    if (depth > 64) fail2("TASK_COMMAND_EXPECTATION");
    if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(v))) fail2("TASK_COMMAND_EXPECTATION");
    const d = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v), out = array ? [] : {};
    for (const key of Reflect.ownKeys(d)) {
      if (array && key === "length") continue;
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !d[key].enumerable || !Object.hasOwn(d[key], "value")) fail2("TASK_COMMAND_EXPECTATION");
      out[key] = visit(d[key].value, depth + 1);
    }
    return out;
  };
  try {
    return parseText(JSON.stringify(visit(value, 0)), 16777216);
  } catch (error) {
    if (error instanceof TaskCommandResponseError) throw error;
    fail2("TASK_COMMAND_EXPECTATION");
  }
}

// task-command-application/normalizer-snapshot.mjs
var snapshotOperationData = (value) => value;

// commands-0.2/task-update-validation.mjs
var fail3 = () => {
  throw new Error("Invalid task update intent");
};
var instant = (value) => {
  const n = Date.parse(value);
  if (!Number.isSafeInteger(n) || new Date(n).toISOString() !== value) fail3();
  return n;
};
var day = (value) => {
  if (instant(value) % 864e5 !== 0) fail3();
  return value;
};
function createTaskUpdateValidators({ validateShape, validatePublicShape, canonicalSha256 }) {
  const same2 = (a, b) => canonicalSha256(a) === canonicalSha256(b);
  function context(value) {
    const c = snapshotOperationData(value);
    validateShape("TaskUpdateContext", c);
    return c;
  }
  function normalizeTaskUpdateInput(value, options) {
    context(options);
    const raw = snapshotOperationData(value);
    validateShape("TaskUpdateRaw", raw);
    const taskId = raw.taskId.trim().toLowerCase(), patch = {};
    if (raw.title?.trim()) {
      const title = raw.title.trim();
      if (title.length > 240) fail3();
      patch.title = title;
    }
    if (raw.status?.trim()) {
      const status = raw.status.trim().toLowerCase();
      patch.status = status === "open" ? "todo" : status;
    }
    if (raw.dueDate?.trim()) {
      const date = raw.dueDate.trim();
      patch.dueDate = day(date.length === 10 ? `${date}T00:00:00.000Z` : date);
    }
    const input = { taskId, mode: "unconditional_patch", patch };
    validateShape("TaskUpdateArguments", input);
    return input;
  }
  function assertTaskUpdateCommand(value, options) {
    const cmd = snapshotOperationData(value), c = context(options);
    validateShape("TaskUpdateCommand", cmd);
    if (!same2(cmd.binding, c.binding) || cmd.scopes.some((s) => s.tenantId !== cmd.binding.tenantId)) fail3();
    if (cmd.arguments.taskId !== cmd.arguments.taskId.toLowerCase()) fail3();
    const { title, dueDate } = cmd.arguments.patch;
    if (title !== void 0 && (title.trim() !== title || title.length > 240)) fail3();
    if (dueDate !== void 0) day(dueDate);
    return cmd;
  }
  function assertTaskUpdateProposal(value, options) {
    const p = snapshotOperationData(value);
    validateShape("TaskUpdateApprovalProposal", p);
    assertTaskUpdateCommand(p.command, options);
    if (canonicalSha256(p.command) !== p.commandSha256 || instant(p.expiresAt) <= instant(p.createdAt) || p.requiredApprover.tenantId !== p.command.binding.tenantId) fail3();
    return p;
  }
  function assertTaskUpdateExecution(proposalValue, value, options) {
    const p = assertTaskUpdateProposal(proposalValue, options), e = snapshotOperationData(value);
    validatePublicShape("CommandExecutionRequest", e);
    if (e.proposalId !== p.proposalId || e.commandSha256 !== p.commandSha256 || e.idempotencyKey !== p.command.idempotencyKey) fail3();
    for (const key of ["tenantId", "actorId", "conversationId", "runId"]) if (e.executorBinding[key] !== p.command.binding[key]) fail3();
    return e;
  }
  function assertTaskUpdateResult(value, commandValue, options) {
    const c = assertTaskUpdateCommand(commandValue, options), r = snapshotOperationData(value);
    validateShape("TaskUpdateResult", r);
    instant(r.updatedAt);
    if (r.dueDate !== null) day(r.dueDate);
    if (r.id.toLowerCase() !== c.arguments.taskId) fail3();
    for (const [key, v] of Object.entries(c.arguments.patch)) if (r[key] !== v) fail3();
    return r;
  }
  return Object.freeze({ normalizeTaskUpdateInput, assertTaskUpdateCommand, assertTaskUpdateProposal, assertTaskUpdateExecution, assertTaskUpdateResult });
}

// task-command-application/semantics.mjs
var same = (a, b) => canonicalize(a) === canonicalize(b);
var sha = async (value) => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalize(value)))), (byte) => byte.toString(16).padStart(2, "0")).join("");
var check = (name, value) => {
  if (!validators[name]?.(value)) fail2("TASK_COMMAND_SHAPE");
  return value;
};
var normalizer = createTaskUpdateValidators({ validateShape: check, validatePublicShape: check, canonicalSha256: () => fail2("TASK_COMMAND_INTERNAL") }).normalizeTaskUpdateInput;
var stableKeys = ["tenantId", "actorId", "conversationId", "runId"];
var instant2 = (value) => {
  const at = Date.parse(value);
  if (!Number.isSafeInteger(at) || new Date(at).toISOString() !== value) fail2("TASK_COMMAND_CORRELATION");
  return at;
};
var stable = (binding, expected) => {
  if (stableKeys.some((key) => binding[key] !== expected[key])) fail2("TASK_COMMAND_CORRELATION");
};
var scopes = (binding, values) => {
  if (values.some((scope) => scope.tenantId !== binding.tenantId)) fail2("TASK_COMMAND_CORRELATION");
};
function normalizeArguments(raw, binding) {
  try {
    return normalizer(raw, { binding });
  } catch {
    fail2("TASK_COMMAND_ARGUMENTS");
  }
}
async function proposal(value) {
  check("TaskUpdateApprovalProposal", value);
  const c = value.command;
  if (await sha(c) !== value.commandSha256 || value.requiredApprover.tenantId !== c.binding.tenantId || instant2(value.expiresAt) <= instant2(value.createdAt)) fail2("TASK_COMMAND_CORRELATION");
  scopes(c.binding, c.scopes);
  if (c.arguments.taskId !== c.arguments.taskId.toLowerCase() || !same(c.arguments, normalizeArguments({ taskId: c.arguments.taskId, ...c.arguments.patch }, c.binding))) fail2("TASK_COMMAND_CORRELATION");
  return value;
}
async function correlatePrepare(value, expectation) {
  const p = await proposal(value.proposal);
  stable(p.command.binding, expectation.binding);
  check("TaskCommandPrepareRequest", expectation.request);
  if (!same(p.command.arguments, normalizeArguments(expectation.request.arguments, p.command.binding))) fail2("TASK_COMMAND_CORRELATION");
}
async function correlateExecute(value, expectation) {
  const selected = await proposal(expectation.proposal);
  stable(selected.command.binding, expectation.binding);
  if (value.status === "indeterminate") return;
  if (value.outcome.execution?.kind === "native-task") {
    const { execution: e, result: result2 } = value.outcome, c2 = selected.command;
    if (e.proposalId !== selected.proposalId || e.commandSha256 !== selected.commandSha256 || e.idempotencyKey !== c2.idempotencyKey || !same(e.binding, c2.binding) || instant2(e.completedAt) < instant2(selected.createdAt) || result2.id.toLowerCase() !== c2.arguments.taskId) fail2("TASK_COMMAND_CORRELATION");
    instant2(result2.updatedAt);
    if (result2.dueDate !== null && instant2(result2.dueDate) % 864e5 !== 0) fail2("TASK_COMMAND_CORRELATION");
    for (const [key, value2] of Object.entries(c2.arguments.patch)) if (result2[key] !== value2) fail2("TASK_COMMAND_CORRELATION");
    return;
  }
  const { receipt, result } = value.outcome, c = selected.command;
  stable(receipt.binding, expectation.binding);
  scopes(receipt.binding, receipt.scopes);
  if (receipt.outcome !== "succeeded" || receipt.commandId !== c.commandId || receipt.commandSha256 !== selected.commandSha256 || receipt.idempotencyKey !== c.idempotencyKey || !same(receipt.scopes, c.scopes) || result.id.toLowerCase() !== c.arguments.taskId) fail2("TASK_COMMAND_CORRELATION");
  instant2(receipt.completedAt);
  instant2(result.updatedAt);
  if (result.dueDate !== null && instant2(result.dueDate) % 864e5 !== 0) fail2("TASK_COMMAND_CORRELATION");
  for (const [key, value2] of Object.entries(c.arguments.patch)) if (result[key] !== value2) fail2("TASK_COMMAND_CORRELATION");
}

// task-command-application/task-command-application-receiver.mjs
var taskCommandMetadata = createTaskCommandMetadata(errorStatuses, errorOutcomes);
var routes = Object.freeze({ prepare: { request: "TaskCommandPrepareRequest", response: "TaskCommandPrepareResponse" }, execute: { request: "TaskCommandExecuteRequest", response: "TaskCommandExecuteResponse" } });
var routeInfo = (route) => {
  if (typeof route !== "string" || !Object.hasOwn(routes, route)) fail2("TASK_COMMAND_ROUTE");
  return routes[route];
};
async function receiveTaskCommandRequest(route, jsonText) {
  const selected = routeInfo(route), value = parseText(jsonText, taskCommandLimits.requestBytes);
  check(selected.request, value);
  if (route === "execute") await proposal(value.proposal);
  return value;
}
async function receiveTaskCommandResponse(route, httpStatus, jsonText, expected) {
  const selected = routeInfo(route);
  if (!Number.isInteger(httpStatus)) fail2("TASK_COMMAND_STATUS");
  const expectation = snapshotExpected(expected);
  check("TaskCommandExpectedBinding", expectation?.binding);
  const keys = Object.keys(expectation);
  if (keys.length !== 2 || !keys.includes(route === "prepare" ? "request" : "proposal")) fail2("TASK_COMMAND_EXPECTATION");
  if (route === "prepare") check("TaskCommandPrepareRequest", expectation.request);
  else await proposal(expectation.proposal);
  const value = parseText(jsonText, taskCommandLimits.responseBytes);
  if (httpStatus !== 200) {
    if (!validators.TaskCommandErrorResponse(value) || errorStatuses[value.error.code] !== httpStatus) fail2("TASK_COMMAND_STATUS");
    return value;
  }
  check(selected.response, value);
  if (route === "prepare") await correlatePrepare(value, expectation);
  else await correlateExecute(value, expectation);
  return value;
}
export {
  TaskCommandResponseError,
  receiveTaskCommandRequest,
  receiveTaskCommandResponse,
  taskCommandMetadata,
  taskCommandPaths,
  taskCommandVersion
};
