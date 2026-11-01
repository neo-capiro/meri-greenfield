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

// document-generated:./generated-validator.mjs
var validateCreateRequest = validate79;
var pattern4 = new RegExp("^[A-Za-z0-9_.:@/-]{1,255}$", "u");
var schema34 = { "oneOf": [{ "type": "object", "properties": { "operation": { "const": "create_word" }, "format": { "enum": ["docx"] }, "title": { "type": "string", "minLength": 1, "maxLength": 200 }, "content": { "$ref": "#/$defs/Canonical_WordContent_58f3dc3c" } }, "required": ["operation", "format", "title", "content"], "additionalProperties": false }, { "type": "object", "properties": { "operation": { "const": "create_word" }, "format": { "const": "txt" }, "title": { "type": "string", "minLength": 1, "maxLength": 200 }, "content": { "type": "object", "properties": { "text": { "type": "string", "maxLength": 1e5 } }, "required": ["text"], "additionalProperties": false } }, "required": ["operation", "format", "title", "content"], "additionalProperties": false }, { "type": "object", "properties": { "operation": { "const": "create_word" }, "format": { "const": "xml" }, "title": { "type": "string", "minLength": 1, "maxLength": 200 }, "content": { "type": "object", "properties": { "text": { "type": "string", "maxLength": 1e5, "minLength": 1 } }, "required": ["text"], "additionalProperties": false } }, "required": ["operation", "format", "title", "content"], "additionalProperties": false }, { "type": "object", "properties": { "operation": { "const": "create_excel" }, "format": { "const": "xlsx" }, "title": { "type": "string", "minLength": 1, "maxLength": 200 }, "content": { "$ref": "#/$defs/Canonical_Workbook_470b7491" } }, "required": ["operation", "format", "title", "content"], "additionalProperties": false }] };
var func1 = require_ucs2length().default;
var schema40 = { "type": "object", "properties": { "kind": { "enum": ["bar", "line"] }, "title": { "type": "string", "minLength": 1, "maxLength": 200 }, "categories": { "type": "array", "items": { "type": "string", "maxLength": 1e5 }, "minItems": 1, "maxItems": 100 }, "series": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 200 }, "values": { "type": "array", "items": { "type": "number" }, "minItems": 1, "maxItems": 100 } }, "required": ["name", "values"], "additionalProperties": false }, "minItems": 1, "maxItems": 10 } }, "required": ["kind", "title", "categories", "series"], "additionalProperties": false };
var schema36 = { "type": "object", "properties": { "kind": { "const": "paragraph" }, "quoteDepth": { "type": "integer", "minimum": 1, "maximum": 8 }, "runs": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Run_4453fced" }, "minItems": 1, "maxItems": 100 }, "style": { "enum": ["Normal", "Title", "Heading 1", "Heading 2", "List Bullet"] } }, "required": ["kind", "runs"], "additionalProperties": false };
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
      if (data.kind === void 0 && (missing0 = "kind") || data.runs === void 0 && (missing0 = "runs")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "kind" || key0 === "quoteDepth" || key0 === "runs" || key0 === "style")) {
            validate25.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.kind !== void 0) {
            const _errs2 = errors2;
            if ("paragraph" !== data.kind) {
              validate25.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "paragraph" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.quoteDepth !== void 0) {
              let data1 = data.quoteDepth;
              const _errs3 = errors2;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
                validate25.errors = [{ instancePath: instancePath + "/quoteDepth", schemaPath: "#/properties/quoteDepth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                return false;
              }
              if (errors2 === _errs3) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 8 || isNaN(data1)) {
                    validate25.errors = [{ instancePath: instancePath + "/quoteDepth", schemaPath: "#/properties/quoteDepth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 8 }, message: "must be <= 8" }];
                    return false;
                  } else {
                    if (data1 < 1 || isNaN(data1)) {
                      validate25.errors = [{ instancePath: instancePath + "/quoteDepth", schemaPath: "#/properties/quoteDepth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runs !== void 0) {
                let data2 = data.runs;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (Array.isArray(data2)) {
                    if (data2.length > 100) {
                      validate25.errors = [{ instancePath: instancePath + "/runs", schemaPath: "#/properties/runs/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" }];
                      return false;
                    } else {
                      if (data2.length < 1) {
                        validate25.errors = [{ instancePath: instancePath + "/runs", schemaPath: "#/properties/runs/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid1 = true;
                        const len0 = data2.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data3 = data2[i0];
                          const _errs7 = errors2;
                          const _errs8 = errors2;
                          if (errors2 === _errs8) {
                            if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                              let missing1;
                              if (data3.text === void 0 && (missing1 = "text")) {
                                validate25.errors = [{ instancePath: instancePath + "/runs/" + i0, schemaPath: "#/$defs/Canonical_Run_4453fced/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs10 = errors2;
                                for (const key1 in data3) {
                                  if (!(key1 === "text" || key1 === "bold" || key1 === "italic" || key1 === "strike" || key1 === "underline")) {
                                    validate25.errors = [{ instancePath: instancePath + "/runs/" + i0, schemaPath: "#/$defs/Canonical_Run_4453fced/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs10 === errors2) {
                                  if (data3.text !== void 0) {
                                    let data4 = data3.text;
                                    const _errs11 = errors2;
                                    if (errors2 === _errs11) {
                                      if (typeof data4 === "string") {
                                        if (func1(data4) > 1e5) {
                                          validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/text", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/text/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                                          return false;
                                        }
                                      } else {
                                        validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/text", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs11 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data3.bold !== void 0) {
                                      const _errs13 = errors2;
                                      if (typeof data3.bold !== "boolean") {
                                        validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/bold", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/bold/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                        return false;
                                      }
                                      var valid3 = _errs13 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data3.italic !== void 0) {
                                        const _errs15 = errors2;
                                        if (typeof data3.italic !== "boolean") {
                                          validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/italic", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/italic/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                          return false;
                                        }
                                        var valid3 = _errs15 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data3.strike !== void 0) {
                                          const _errs17 = errors2;
                                          if (typeof data3.strike !== "boolean") {
                                            validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/strike", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/strike/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                            return false;
                                          }
                                          var valid3 = _errs17 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data3.underline !== void 0) {
                                            const _errs19 = errors2;
                                            if (typeof data3.underline !== "boolean") {
                                              validate25.errors = [{ instancePath: instancePath + "/runs/" + i0 + "/underline", schemaPath: "#/$defs/Canonical_Run_4453fced/properties/underline/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                              return false;
                                            }
                                            var valid3 = _errs19 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate25.errors = [{ instancePath: instancePath + "/runs/" + i0, schemaPath: "#/$defs/Canonical_Run_4453fced/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid1 = _errs7 === errors2;
                          if (!valid1) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate25.errors = [{ instancePath: instancePath + "/runs", schemaPath: "#/properties/runs/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.style !== void 0) {
                  let data9 = data.style;
                  const _errs21 = errors2;
                  if (!(data9 === "Normal" || data9 === "Title" || data9 === "Heading 1" || data9 === "Heading 2" || data9 === "List Bullet")) {
                    validate25.errors = [{ instancePath: instancePath + "/style", schemaPath: "#/properties/style/enum", keyword: "enum", params: { allowedValues: schema36.properties.style.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
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
    } else {
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern5 = new RegExp("^[A-Za-z0-9_-]{1,64}$", "u");
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
      if (data.blocks === void 0 && (missing0 = "blocks")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "blocks")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.blocks !== void 0) {
            let data0 = data.blocks;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (Array.isArray(data0)) {
                if (data0.length > 1e3) {
                  validate24.errors = [{ instancePath: instancePath + "/blocks", schemaPath: "#/properties/blocks/maxItems", keyword: "maxItems", params: { limit: 1e3 }, message: "must NOT have more than 1000 items" }];
                  return false;
                } else {
                  if (data0.length < 1) {
                    validate24.errors = [{ instancePath: instancePath + "/blocks", schemaPath: "#/properties/blocks/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                    return false;
                  } else {
                    var valid1 = true;
                    const len0 = data0.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      let data1 = data0[i0];
                      const _errs4 = errors2;
                      const _errs5 = errors2;
                      let valid2 = false;
                      let passing0 = null;
                      const _errs6 = errors2;
                      if (!validate25(data1, { instancePath: instancePath + "/blocks/" + i0, parentData: data0, parentDataProperty: i0, rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                        errors2 = vErrors.length;
                      }
                      var _valid0 = _errs6 === errors2;
                      if (_valid0) {
                        valid2 = true;
                        passing0 = 0;
                        var props0 = true;
                      }
                      const _errs7 = errors2;
                      const _errs8 = errors2;
                      if (errors2 === _errs8) {
                        if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                          let missing1;
                          if (data1.kind === void 0 && (missing1 = "kind") || data1.rows === void 0 && (missing1 = "rows")) {
                            const err0 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Table_02fd45f0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            const _errs10 = errors2;
                            for (const key1 in data1) {
                              if (!(key1 === "kind" || key1 === "rows")) {
                                const err1 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Table_02fd45f0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
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
                              if (data1.kind !== void 0) {
                                const _errs11 = errors2;
                                if ("table" !== data1.kind) {
                                  const err2 = { instancePath: instancePath + "/blocks/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/kind/const", keyword: "const", params: { allowedValue: "table" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err2];
                                  } else {
                                    vErrors.push(err2);
                                  }
                                  errors2++;
                                }
                                var valid4 = _errs11 === errors2;
                              } else {
                                var valid4 = true;
                              }
                              if (valid4) {
                                if (data1.rows !== void 0) {
                                  let data3 = data1.rows;
                                  const _errs12 = errors2;
                                  if (errors2 === _errs12) {
                                    if (Array.isArray(data3)) {
                                      if (data3.length > 1e3) {
                                        const err3 = { instancePath: instancePath + "/blocks/" + i0 + "/rows", schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/maxItems", keyword: "maxItems", params: { limit: 1e3 }, message: "must NOT have more than 1000 items" };
                                        if (vErrors === null) {
                                          vErrors = [err3];
                                        } else {
                                          vErrors.push(err3);
                                        }
                                        errors2++;
                                      } else {
                                        if (data3.length < 1) {
                                          const err4 = { instancePath: instancePath + "/blocks/" + i0 + "/rows", schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors2++;
                                        } else {
                                          var valid5 = true;
                                          const len1 = data3.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            let data4 = data3[i1];
                                            const _errs14 = errors2;
                                            if (errors2 === _errs14) {
                                              if (Array.isArray(data4)) {
                                                if (data4.length > 40) {
                                                  const err5 = { instancePath: instancePath + "/blocks/" + i0 + "/rows/" + i1, schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/items/maxItems", keyword: "maxItems", params: { limit: 40 }, message: "must NOT have more than 40 items" };
                                                  if (vErrors === null) {
                                                    vErrors = [err5];
                                                  } else {
                                                    vErrors.push(err5);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (data4.length < 1) {
                                                    const err6 = { instancePath: instancePath + "/blocks/" + i0 + "/rows/" + i1, schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/items/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                                                    if (vErrors === null) {
                                                      vErrors = [err6];
                                                    } else {
                                                      vErrors.push(err6);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    var valid6 = true;
                                                    const len2 = data4.length;
                                                    for (let i2 = 0; i2 < len2; i2++) {
                                                      let data5 = data4[i2];
                                                      const _errs16 = errors2;
                                                      if (errors2 === _errs16) {
                                                        if (typeof data5 === "string") {
                                                          if (func1(data5) > 1e5) {
                                                            const err7 = { instancePath: instancePath + "/blocks/" + i0 + "/rows/" + i1 + "/" + i2, schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/items/items/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                                                            if (vErrors === null) {
                                                              vErrors = [err7];
                                                            } else {
                                                              vErrors.push(err7);
                                                            }
                                                            errors2++;
                                                          }
                                                        } else {
                                                          const err8 = { instancePath: instancePath + "/blocks/" + i0 + "/rows/" + i1 + "/" + i2, schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/items/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                          if (vErrors === null) {
                                                            vErrors = [err8];
                                                          } else {
                                                            vErrors.push(err8);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                      var valid6 = _errs16 === errors2;
                                                      if (!valid6) {
                                                        break;
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                const err9 = { instancePath: instancePath + "/blocks/" + i0 + "/rows/" + i1, schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/items/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                if (vErrors === null) {
                                                  vErrors = [err9];
                                                } else {
                                                  vErrors.push(err9);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid5 = _errs14 === errors2;
                                            if (!valid5) {
                                              break;
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      const err10 = { instancePath: instancePath + "/blocks/" + i0 + "/rows", schemaPath: "#/$defs/Canonical_Table_02fd45f0/properties/rows/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                      if (vErrors === null) {
                                        vErrors = [err10];
                                      } else {
                                        vErrors.push(err10);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid4 = _errs12 === errors2;
                                } else {
                                  var valid4 = true;
                                }
                              }
                            }
                          }
                        } else {
                          const err11 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Table_02fd45f0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err11];
                          } else {
                            vErrors.push(err11);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs7 === errors2;
                      if (_valid0 && valid2) {
                        valid2 = false;
                        passing0 = [passing0, 1];
                      } else {
                        if (_valid0) {
                          valid2 = true;
                          passing0 = 1;
                          if (props0 !== true) {
                            props0 = true;
                          }
                        }
                        const _errs18 = errors2;
                        const _errs19 = errors2;
                        if (errors2 === _errs19) {
                          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                            let missing2;
                            if (data1.kind === void 0 && (missing2 = "kind") || data1.assetId === void 0 && (missing2 = "assetId") || data1.widthInches === void 0 && (missing2 = "widthInches") || data1.heightInches === void 0 && (missing2 = "heightInches")) {
                              const err12 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Image_1ed45a41/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                              if (vErrors === null) {
                                vErrors = [err12];
                              } else {
                                vErrors.push(err12);
                              }
                              errors2++;
                            } else {
                              const _errs21 = errors2;
                              for (const key2 in data1) {
                                if (!(key2 === "kind" || key2 === "assetId" || key2 === "widthInches" || key2 === "heightInches")) {
                                  const err13 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Image_1ed45a41/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err13];
                                  } else {
                                    vErrors.push(err13);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs21 === errors2) {
                                if (data1.kind !== void 0) {
                                  const _errs22 = errors2;
                                  if ("image" !== data1.kind) {
                                    const err14 = { instancePath: instancePath + "/blocks/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/kind/const", keyword: "const", params: { allowedValue: "image" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err14];
                                    } else {
                                      vErrors.push(err14);
                                    }
                                    errors2++;
                                  }
                                  var valid8 = _errs22 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data1.assetId !== void 0) {
                                    let data7 = data1.assetId;
                                    const _errs23 = errors2;
                                    if (errors2 === _errs23) {
                                      if (typeof data7 === "string") {
                                        if (!pattern5.test(data7)) {
                                          const err15 = { instancePath: instancePath + "/blocks/" + i0 + "/assetId", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/assetId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "^[A-Za-z0-9_-]{1,64}$"' };
                                          if (vErrors === null) {
                                            vErrors = [err15];
                                          } else {
                                            vErrors.push(err15);
                                          }
                                          errors2++;
                                        }
                                      } else {
                                        const err16 = { instancePath: instancePath + "/blocks/" + i0 + "/assetId", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/assetId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err16];
                                        } else {
                                          vErrors.push(err16);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid8 = _errs23 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data1.widthInches !== void 0) {
                                      let data8 = data1.widthInches;
                                      const _errs25 = errors2;
                                      if (errors2 === _errs25) {
                                        if (typeof data8 == "number" && isFinite(data8)) {
                                          if (data8 > 12 || isNaN(data8)) {
                                            const err17 = { instancePath: instancePath + "/blocks/" + i0 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/maximum", keyword: "maximum", params: { comparison: "<=", limit: 12 }, message: "must be <= 12" };
                                            if (vErrors === null) {
                                              vErrors = [err17];
                                            } else {
                                              vErrors.push(err17);
                                            }
                                            errors2++;
                                          } else {
                                            if (data8 <= 0 || isNaN(data8)) {
                                              const err18 = { instancePath: instancePath + "/blocks/" + i0 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/exclusiveMinimum", keyword: "exclusiveMinimum", params: { comparison: ">", limit: 0 }, message: "must be > 0" };
                                              if (vErrors === null) {
                                                vErrors = [err18];
                                              } else {
                                                vErrors.push(err18);
                                              }
                                              errors2++;
                                            }
                                          }
                                        } else {
                                          const err19 = { instancePath: instancePath + "/blocks/" + i0 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                          if (vErrors === null) {
                                            vErrors = [err19];
                                          } else {
                                            vErrors.push(err19);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid8 = _errs25 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data1.heightInches !== void 0) {
                                        let data9 = data1.heightInches;
                                        const _errs27 = errors2;
                                        if (errors2 === _errs27) {
                                          if (typeof data9 == "number" && isFinite(data9)) {
                                            if (data9 > 12 || isNaN(data9)) {
                                              const err20 = { instancePath: instancePath + "/blocks/" + i0 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/maximum", keyword: "maximum", params: { comparison: "<=", limit: 12 }, message: "must be <= 12" };
                                              if (vErrors === null) {
                                                vErrors = [err20];
                                              } else {
                                                vErrors.push(err20);
                                              }
                                              errors2++;
                                            } else {
                                              if (data9 <= 0 || isNaN(data9)) {
                                                const err21 = { instancePath: instancePath + "/blocks/" + i0 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/exclusiveMinimum", keyword: "exclusiveMinimum", params: { comparison: ">", limit: 0 }, message: "must be > 0" };
                                                if (vErrors === null) {
                                                  vErrors = [err21];
                                                } else {
                                                  vErrors.push(err21);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err22 = { instancePath: instancePath + "/blocks/" + i0 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                            if (vErrors === null) {
                                              vErrors = [err22];
                                            } else {
                                              vErrors.push(err22);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid8 = _errs27 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err23 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/$defs/Canonical_Image_1ed45a41/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err23];
                            } else {
                              vErrors.push(err23);
                            }
                            errors2++;
                          }
                        }
                        var _valid0 = _errs18 === errors2;
                        if (_valid0 && valid2) {
                          valid2 = false;
                          passing0 = [passing0, 2];
                        } else {
                          if (_valid0) {
                            valid2 = true;
                            passing0 = 2;
                            if (props0 !== true) {
                              props0 = true;
                            }
                          }
                          const _errs29 = errors2;
                          if (errors2 === _errs29) {
                            if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                              let missing3;
                              if (data1.kind === void 0 && (missing3 = "kind") || data1.chart === void 0 && (missing3 = "chart")) {
                                const err24 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/properties/blocks/items/oneOf/3/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err24];
                                } else {
                                  vErrors.push(err24);
                                }
                                errors2++;
                              } else {
                                const _errs31 = errors2;
                                for (const key3 in data1) {
                                  if (!(key3 === "kind" || key3 === "chart")) {
                                    const err25 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/properties/blocks/items/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err25];
                                    } else {
                                      vErrors.push(err25);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs31 === errors2) {
                                  if (data1.kind !== void 0) {
                                    const _errs32 = errors2;
                                    if ("chart" !== data1.kind) {
                                      const err26 = { instancePath: instancePath + "/blocks/" + i0 + "/kind", schemaPath: "#/properties/blocks/items/oneOf/3/properties/kind/const", keyword: "const", params: { allowedValue: "chart" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err26];
                                      } else {
                                        vErrors.push(err26);
                                      }
                                      errors2++;
                                    }
                                    var valid9 = _errs32 === errors2;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data1.chart !== void 0) {
                                      let data11 = data1.chart;
                                      const _errs33 = errors2;
                                      const _errs34 = errors2;
                                      if (errors2 === _errs34) {
                                        if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                                          let missing4;
                                          if (data11.kind === void 0 && (missing4 = "kind") || data11.title === void 0 && (missing4 = "title") || data11.categories === void 0 && (missing4 = "categories") || data11.series === void 0 && (missing4 = "series")) {
                                            const err27 = { instancePath: instancePath + "/blocks/" + i0 + "/chart", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err27];
                                            } else {
                                              vErrors.push(err27);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs36 = errors2;
                                            for (const key4 in data11) {
                                              if (!(key4 === "kind" || key4 === "title" || key4 === "categories" || key4 === "series")) {
                                                const err28 = { instancePath: instancePath + "/blocks/" + i0 + "/chart", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err28];
                                                } else {
                                                  vErrors.push(err28);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs36 === errors2) {
                                              if (data11.kind !== void 0) {
                                                let data12 = data11.kind;
                                                const _errs37 = errors2;
                                                if (!(data12 === "bar" || data12 === "line")) {
                                                  const err29 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/kind", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/kind/enum", keyword: "enum", params: { allowedValues: schema40.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                                                  if (vErrors === null) {
                                                    vErrors = [err29];
                                                  } else {
                                                    vErrors.push(err29);
                                                  }
                                                  errors2++;
                                                }
                                                var valid11 = _errs37 === errors2;
                                              } else {
                                                var valid11 = true;
                                              }
                                              if (valid11) {
                                                if (data11.title !== void 0) {
                                                  let data13 = data11.title;
                                                  const _errs38 = errors2;
                                                  if (errors2 === _errs38) {
                                                    if (typeof data13 === "string") {
                                                      if (func1(data13) > 200) {
                                                        const err30 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err30];
                                                        } else {
                                                          vErrors.push(err30);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        if (func1(data13) < 1) {
                                                          const err31 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                          if (vErrors === null) {
                                                            vErrors = [err31];
                                                          } else {
                                                            vErrors.push(err31);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                    } else {
                                                      const err32 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                      if (vErrors === null) {
                                                        vErrors = [err32];
                                                      } else {
                                                        vErrors.push(err32);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid11 = _errs38 === errors2;
                                                } else {
                                                  var valid11 = true;
                                                }
                                                if (valid11) {
                                                  if (data11.categories !== void 0) {
                                                    let data14 = data11.categories;
                                                    const _errs40 = errors2;
                                                    if (errors2 === _errs40) {
                                                      if (Array.isArray(data14)) {
                                                        if (data14.length > 100) {
                                                          const err33 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" };
                                                          if (vErrors === null) {
                                                            vErrors = [err33];
                                                          } else {
                                                            vErrors.push(err33);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data14.length < 1) {
                                                            const err34 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                                                            if (vErrors === null) {
                                                              vErrors = [err34];
                                                            } else {
                                                              vErrors.push(err34);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            var valid12 = true;
                                                            const len3 = data14.length;
                                                            for (let i3 = 0; i3 < len3; i3++) {
                                                              let data15 = data14[i3];
                                                              const _errs42 = errors2;
                                                              if (errors2 === _errs42) {
                                                                if (typeof data15 === "string") {
                                                                  if (func1(data15) > 1e5) {
                                                                    const err35 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/categories/" + i3, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/items/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err35];
                                                                    } else {
                                                                      vErrors.push(err35);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                } else {
                                                                  const err36 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/categories/" + i3, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err36];
                                                                  } else {
                                                                    vErrors.push(err36);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              }
                                                              var valid12 = _errs42 === errors2;
                                                              if (!valid12) {
                                                                break;
                                                              }
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        const err37 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                        if (vErrors === null) {
                                                          vErrors = [err37];
                                                        } else {
                                                          vErrors.push(err37);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid11 = _errs40 === errors2;
                                                  } else {
                                                    var valid11 = true;
                                                  }
                                                  if (valid11) {
                                                    if (data11.series !== void 0) {
                                                      let data16 = data11.series;
                                                      const _errs44 = errors2;
                                                      if (errors2 === _errs44) {
                                                        if (Array.isArray(data16)) {
                                                          if (data16.length > 10) {
                                                            const err38 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/maxItems", keyword: "maxItems", params: { limit: 10 }, message: "must NOT have more than 10 items" };
                                                            if (vErrors === null) {
                                                              vErrors = [err38];
                                                            } else {
                                                              vErrors.push(err38);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data16.length < 1) {
                                                              const err39 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                                                              if (vErrors === null) {
                                                                vErrors = [err39];
                                                              } else {
                                                                vErrors.push(err39);
                                                              }
                                                              errors2++;
                                                            } else {
                                                              var valid13 = true;
                                                              const len4 = data16.length;
                                                              for (let i4 = 0; i4 < len4; i4++) {
                                                                let data17 = data16[i4];
                                                                const _errs46 = errors2;
                                                                if (errors2 === _errs46) {
                                                                  if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                                                                    let missing5;
                                                                    if (data17.name === void 0 && (missing5 = "name") || data17.values === void 0 && (missing5 = "values")) {
                                                                      const err40 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                                                                      if (vErrors === null) {
                                                                        vErrors = [err40];
                                                                      } else {
                                                                        vErrors.push(err40);
                                                                      }
                                                                      errors2++;
                                                                    } else {
                                                                      const _errs48 = errors2;
                                                                      for (const key5 in data17) {
                                                                        if (!(key5 === "name" || key5 === "values")) {
                                                                          const err41 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                                                                          if (vErrors === null) {
                                                                            vErrors = [err41];
                                                                          } else {
                                                                            vErrors.push(err41);
                                                                          }
                                                                          errors2++;
                                                                          break;
                                                                        }
                                                                      }
                                                                      if (_errs48 === errors2) {
                                                                        if (data17.name !== void 0) {
                                                                          let data18 = data17.name;
                                                                          const _errs49 = errors2;
                                                                          if (errors2 === _errs49) {
                                                                            if (typeof data18 === "string") {
                                                                              if (func1(data18) > 200) {
                                                                                const err42 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                                                                if (vErrors === null) {
                                                                                  vErrors = [err42];
                                                                                } else {
                                                                                  vErrors.push(err42);
                                                                                }
                                                                                errors2++;
                                                                              } else {
                                                                                if (func1(data18) < 1) {
                                                                                  const err43 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                                                  if (vErrors === null) {
                                                                                    vErrors = [err43];
                                                                                  } else {
                                                                                    vErrors.push(err43);
                                                                                  }
                                                                                  errors2++;
                                                                                }
                                                                              }
                                                                            } else {
                                                                              const err44 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                              if (vErrors === null) {
                                                                                vErrors = [err44];
                                                                              } else {
                                                                                vErrors.push(err44);
                                                                              }
                                                                              errors2++;
                                                                            }
                                                                          }
                                                                          var valid14 = _errs49 === errors2;
                                                                        } else {
                                                                          var valid14 = true;
                                                                        }
                                                                        if (valid14) {
                                                                          if (data17.values !== void 0) {
                                                                            let data19 = data17.values;
                                                                            const _errs51 = errors2;
                                                                            if (errors2 === _errs51) {
                                                                              if (Array.isArray(data19)) {
                                                                                if (data19.length > 100) {
                                                                                  const err45 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" };
                                                                                  if (vErrors === null) {
                                                                                    vErrors = [err45];
                                                                                  } else {
                                                                                    vErrors.push(err45);
                                                                                  }
                                                                                  errors2++;
                                                                                } else {
                                                                                  if (data19.length < 1) {
                                                                                    const err46 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                                                                                    if (vErrors === null) {
                                                                                      vErrors = [err46];
                                                                                    } else {
                                                                                      vErrors.push(err46);
                                                                                    }
                                                                                    errors2++;
                                                                                  } else {
                                                                                    var valid15 = true;
                                                                                    const len5 = data19.length;
                                                                                    for (let i5 = 0; i5 < len5; i5++) {
                                                                                      let data20 = data19[i5];
                                                                                      const _errs53 = errors2;
                                                                                      if (!(typeof data20 == "number" && isFinite(data20))) {
                                                                                        const err47 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/values/" + i5, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/items/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                                                                        if (vErrors === null) {
                                                                                          vErrors = [err47];
                                                                                        } else {
                                                                                          vErrors.push(err47);
                                                                                        }
                                                                                        errors2++;
                                                                                      }
                                                                                      var valid15 = _errs53 === errors2;
                                                                                      if (!valid15) {
                                                                                        break;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                              } else {
                                                                                const err48 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                                                if (vErrors === null) {
                                                                                  vErrors = [err48];
                                                                                } else {
                                                                                  vErrors.push(err48);
                                                                                }
                                                                                errors2++;
                                                                              }
                                                                            }
                                                                            var valid14 = _errs51 === errors2;
                                                                          } else {
                                                                            var valid14 = true;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  } else {
                                                                    const err49 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                                                    if (vErrors === null) {
                                                                      vErrors = [err49];
                                                                    } else {
                                                                      vErrors.push(err49);
                                                                    }
                                                                    errors2++;
                                                                  }
                                                                }
                                                                var valid13 = _errs46 === errors2;
                                                                if (!valid13) {
                                                                  break;
                                                                }
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          const err50 = { instancePath: instancePath + "/blocks/" + i0 + "/chart/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                          if (vErrors === null) {
                                                            vErrors = [err50];
                                                          } else {
                                                            vErrors.push(err50);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                      var valid11 = _errs44 === errors2;
                                                    } else {
                                                      var valid11 = true;
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err51 = { instancePath: instancePath + "/blocks/" + i0 + "/chart", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err51];
                                          } else {
                                            vErrors.push(err51);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid9 = _errs33 === errors2;
                                    } else {
                                      var valid9 = true;
                                    }
                                  }
                                }
                              }
                            } else {
                              const err52 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/properties/blocks/items/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err52];
                              } else {
                                vErrors.push(err52);
                              }
                              errors2++;
                            }
                          }
                          var _valid0 = _errs29 === errors2;
                          if (_valid0 && valid2) {
                            valid2 = false;
                            passing0 = [passing0, 3];
                          } else {
                            if (_valid0) {
                              valid2 = true;
                              passing0 = 3;
                              if (props0 !== true) {
                                props0 = true;
                              }
                            }
                          }
                        }
                      }
                      if (!valid2) {
                        const err53 = { instancePath: instancePath + "/blocks/" + i0, schemaPath: "#/properties/blocks/items/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                        if (vErrors === null) {
                          vErrors = [err53];
                        } else {
                          vErrors.push(err53);
                        }
                        errors2++;
                        validate24.errors = vErrors;
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
                      var valid1 = _errs4 === errors2;
                      if (!valid1) {
                        break;
                      }
                    }
                  }
                }
              } else {
                validate24.errors = [{ instancePath: instancePath + "/blocks", schemaPath: "#/properties/blocks/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
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
var pattern6 = new RegExp("^=[A-Za-z0-9_$:.,+*/() -]{1,500}$", "u");
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
      const _errs1 = errors2;
      for (const key0 in data) {
        if (!(key0 === "value" || key0 === "formula" || key0 === "numberFormat")) {
          validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
          return false;
          break;
        }
      }
      if (_errs1 === errors2) {
        if (data.value !== void 0) {
          let data0 = data.value;
          const _errs2 = errors2;
          const _errs4 = errors2;
          let valid2 = false;
          const _errs5 = errors2;
          if (errors2 === _errs5) {
            if (typeof data0 === "string") {
              if (func1(data0) > 1e5) {
                const err0 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors2++;
              }
            } else {
              const err1 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
          if (!(typeof data0 == "number" && isFinite(data0))) {
            const err2 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors2++;
          }
          var _valid0 = _errs7 === errors2;
          valid2 = valid2 || _valid0;
          const _errs9 = errors2;
          if (typeof data0 !== "boolean") {
            const err3 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf/2/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors2++;
          }
          var _valid0 = _errs9 === errors2;
          valid2 = valid2 || _valid0;
          const _errs11 = errors2;
          if (data0 !== null) {
            const err4 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf/3/type", keyword: "type", params: { type: "null" }, message: "must be null" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors2++;
          }
          var _valid0 = _errs11 === errors2;
          valid2 = valid2 || _valid0;
          if (!valid2) {
            const err5 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Canonical_Scalar_ff4415f1/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors2++;
            validate30.errors = vErrors;
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
          var valid0 = _errs2 === errors2;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.formula !== void 0) {
            let data1 = data.formula;
            const _errs13 = errors2;
            if (errors2 === _errs13) {
              if (typeof data1 === "string") {
                if (!pattern6.test(data1)) {
                  validate30.errors = [{ instancePath: instancePath + "/formula", schemaPath: "#/properties/formula/pattern", keyword: "pattern", params: { pattern: "^=[A-Za-z0-9_$:.,+*/() -]{1,500}$" }, message: 'must match pattern "^=[A-Za-z0-9_$:.,+*/() -]{1,500}$"' }];
                  return false;
                }
              } else {
                validate30.errors = [{ instancePath: instancePath + "/formula", schemaPath: "#/properties/formula/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs13 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.numberFormat !== void 0) {
              let data2 = data.numberFormat;
              const _errs15 = errors2;
              if (errors2 === _errs15) {
                if (typeof data2 === "string") {
                  if (func1(data2) > 80) {
                    validate30.errors = [{ instancePath: instancePath + "/numberFormat", schemaPath: "#/properties/numberFormat/maxLength", keyword: "maxLength", params: { limit: 80 }, message: "must NOT have more than 80 characters" }];
                    return false;
                  }
                } else {
                  validate30.errors = [{ instancePath: instancePath + "/numberFormat", schemaPath: "#/properties/numberFormat/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs15 === errors2;
            } else {
              var valid0 = true;
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
      if (data.name === void 0 && (missing0 = "name") || data.rows === void 0 && (missing0 = "rows")) {
        validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "name" || key0 === "rows" || key0 === "charts" || key0 === "images")) {
            validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (func1(data0) > 31) {
                  validate29.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/maxLength", keyword: "maxLength", params: { limit: 31 }, message: "must NOT have more than 31 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate29.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate29.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.rows !== void 0) {
              let data1 = data.rows;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (Array.isArray(data1)) {
                  if (data1.length > 1e4) {
                    validate29.errors = [{ instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/maxItems", keyword: "maxItems", params: { limit: 1e4 }, message: "must NOT have more than 10000 items" }];
                    return false;
                  } else {
                    if (data1.length < 0) {
                      validate29.errors = [{ instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                      return false;
                    } else {
                      var valid1 = true;
                      const len0 = data1.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data2 = data1[i0];
                        const _errs6 = errors2;
                        if (errors2 === _errs6) {
                          if (Array.isArray(data2)) {
                            if (data2.length > 100) {
                              validate29.errors = [{ instancePath: instancePath + "/rows/" + i0, schemaPath: "#/properties/rows/items/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" }];
                              return false;
                            } else {
                              if (data2.length < 0) {
                                validate29.errors = [{ instancePath: instancePath + "/rows/" + i0, schemaPath: "#/properties/rows/items/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                                return false;
                              } else {
                                var valid2 = true;
                                const len1 = data2.length;
                                for (let i1 = 0; i1 < len1; i1++) {
                                  const _errs8 = errors2;
                                  if (!validate30(data2[i1], { instancePath: instancePath + "/rows/" + i0 + "/" + i1, parentData: data2, parentDataProperty: i1, rootData, dynamicAnchors })) {
                                    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
                                    errors2 = vErrors.length;
                                  }
                                  var valid2 = _errs8 === errors2;
                                  if (!valid2) {
                                    break;
                                  }
                                }
                              }
                            }
                          } else {
                            validate29.errors = [{ instancePath: instancePath + "/rows/" + i0, schemaPath: "#/properties/rows/items/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                  validate29.errors = [{ instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.charts !== void 0) {
                let data4 = data.charts;
                const _errs9 = errors2;
                if (errors2 === _errs9) {
                  if (Array.isArray(data4)) {
                    if (data4.length > 10) {
                      validate29.errors = [{ instancePath: instancePath + "/charts", schemaPath: "#/properties/charts/maxItems", keyword: "maxItems", params: { limit: 10 }, message: "must NOT have more than 10 items" }];
                      return false;
                    } else {
                      if (data4.length < 0) {
                        validate29.errors = [{ instancePath: instancePath + "/charts", schemaPath: "#/properties/charts/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                        return false;
                      } else {
                        var valid3 = true;
                        const len2 = data4.length;
                        for (let i2 = 0; i2 < len2; i2++) {
                          let data5 = data4[i2];
                          const _errs11 = errors2;
                          const _errs12 = errors2;
                          if (errors2 === _errs12) {
                            if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                              let missing1;
                              if (data5.kind === void 0 && (missing1 = "kind") || data5.title === void 0 && (missing1 = "title") || data5.categories === void 0 && (missing1 = "categories") || data5.series === void 0 && (missing1 = "series")) {
                                validate29.errors = [{ instancePath: instancePath + "/charts/" + i2, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs14 = errors2;
                                for (const key1 in data5) {
                                  if (!(key1 === "kind" || key1 === "title" || key1 === "categories" || key1 === "series")) {
                                    validate29.errors = [{ instancePath: instancePath + "/charts/" + i2, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs14 === errors2) {
                                  if (data5.kind !== void 0) {
                                    let data6 = data5.kind;
                                    const _errs15 = errors2;
                                    if (!(data6 === "bar" || data6 === "line")) {
                                      validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/kind", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/kind/enum", keyword: "enum", params: { allowedValues: schema40.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                      return false;
                                    }
                                    var valid5 = _errs15 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data5.title !== void 0) {
                                      let data7 = data5.title;
                                      const _errs16 = errors2;
                                      if (errors2 === _errs16) {
                                        if (typeof data7 === "string") {
                                          if (func1(data7) > 200) {
                                            validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data7) < 1) {
                                              validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/title", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid5 = _errs16 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data5.categories !== void 0) {
                                        let data8 = data5.categories;
                                        const _errs18 = errors2;
                                        if (errors2 === _errs18) {
                                          if (Array.isArray(data8)) {
                                            if (data8.length > 100) {
                                              validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" }];
                                              return false;
                                            } else {
                                              if (data8.length < 1) {
                                                validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                return false;
                                              } else {
                                                var valid6 = true;
                                                const len3 = data8.length;
                                                for (let i3 = 0; i3 < len3; i3++) {
                                                  let data9 = data8[i3];
                                                  const _errs20 = errors2;
                                                  if (errors2 === _errs20) {
                                                    if (typeof data9 === "string") {
                                                      if (func1(data9) > 1e5) {
                                                        validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/categories/" + i3, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/items/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                                                        return false;
                                                      }
                                                    } else {
                                                      validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/categories/" + i3, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid6 = _errs20 === errors2;
                                                  if (!valid6) {
                                                    break;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/categories", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/categories/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                            return false;
                                          }
                                        }
                                        var valid5 = _errs18 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data5.series !== void 0) {
                                          let data10 = data5.series;
                                          const _errs22 = errors2;
                                          if (errors2 === _errs22) {
                                            if (Array.isArray(data10)) {
                                              if (data10.length > 10) {
                                                validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/maxItems", keyword: "maxItems", params: { limit: 10 }, message: "must NOT have more than 10 items" }];
                                                return false;
                                              } else {
                                                if (data10.length < 1) {
                                                  validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                  return false;
                                                } else {
                                                  var valid7 = true;
                                                  const len4 = data10.length;
                                                  for (let i4 = 0; i4 < len4; i4++) {
                                                    let data11 = data10[i4];
                                                    const _errs24 = errors2;
                                                    if (errors2 === _errs24) {
                                                      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                                                        let missing2;
                                                        if (data11.name === void 0 && (missing2 = "name") || data11.values === void 0 && (missing2 = "values")) {
                                                          validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                                          return false;
                                                        } else {
                                                          const _errs26 = errors2;
                                                          for (const key2 in data11) {
                                                            if (!(key2 === "name" || key2 === "values")) {
                                                              validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                              return false;
                                                              break;
                                                            }
                                                          }
                                                          if (_errs26 === errors2) {
                                                            if (data11.name !== void 0) {
                                                              let data12 = data11.name;
                                                              const _errs27 = errors2;
                                                              if (errors2 === _errs27) {
                                                                if (typeof data12 === "string") {
                                                                  if (func1(data12) > 200) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                                    return false;
                                                                  } else {
                                                                    if (func1(data12) < 1) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                } else {
                                                                  validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/name", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                  return false;
                                                                }
                                                              }
                                                              var valid8 = _errs27 === errors2;
                                                            } else {
                                                              var valid8 = true;
                                                            }
                                                            if (valid8) {
                                                              if (data11.values !== void 0) {
                                                                let data13 = data11.values;
                                                                const _errs29 = errors2;
                                                                if (errors2 === _errs29) {
                                                                  if (Array.isArray(data13)) {
                                                                    if (data13.length > 100) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data13.length < 1) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                                        return false;
                                                                      } else {
                                                                        var valid9 = true;
                                                                        const len5 = data13.length;
                                                                        for (let i5 = 0; i5 < len5; i5++) {
                                                                          let data14 = data13[i5];
                                                                          const _errs31 = errors2;
                                                                          if (!(typeof data14 == "number" && isFinite(data14))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/values/" + i5, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/items/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                                                            return false;
                                                                          }
                                                                          var valid9 = _errs31 === errors2;
                                                                          if (!valid9) {
                                                                            break;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  } else {
                                                                    validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4 + "/values", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/properties/values/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid8 = _errs29 === errors2;
                                                              } else {
                                                                var valid8 = true;
                                                              }
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series/" + i4, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid7 = _errs24 === errors2;
                                                    if (!valid7) {
                                                      break;
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              validate29.errors = [{ instancePath: instancePath + "/charts/" + i2 + "/series", schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/properties/series/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                              return false;
                                            }
                                          }
                                          var valid5 = _errs22 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate29.errors = [{ instancePath: instancePath + "/charts/" + i2, schemaPath: "#/$defs/Canonical_Chart_b9b96b0e/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                          if (!valid3) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate29.errors = [{ instancePath: instancePath + "/charts", schemaPath: "#/properties/charts/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs9 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.images !== void 0) {
                  let data15 = data.images;
                  const _errs33 = errors2;
                  if (errors2 === _errs33) {
                    if (Array.isArray(data15)) {
                      if (data15.length > 10) {
                        validate29.errors = [{ instancePath: instancePath + "/images", schemaPath: "#/properties/images/maxItems", keyword: "maxItems", params: { limit: 10 }, message: "must NOT have more than 10 items" }];
                        return false;
                      } else {
                        if (data15.length < 0) {
                          validate29.errors = [{ instancePath: instancePath + "/images", schemaPath: "#/properties/images/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                          return false;
                        } else {
                          var valid10 = true;
                          const len6 = data15.length;
                          for (let i6 = 0; i6 < len6; i6++) {
                            let data16 = data15[i6];
                            const _errs35 = errors2;
                            const _errs36 = errors2;
                            if (errors2 === _errs36) {
                              if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                                let missing3;
                                if (data16.kind === void 0 && (missing3 = "kind") || data16.assetId === void 0 && (missing3 = "assetId") || data16.widthInches === void 0 && (missing3 = "widthInches") || data16.heightInches === void 0 && (missing3 = "heightInches")) {
                                  validate29.errors = [{ instancePath: instancePath + "/images/" + i6, schemaPath: "#/$defs/Canonical_Image_1ed45a41/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                  return false;
                                } else {
                                  const _errs38 = errors2;
                                  for (const key3 in data16) {
                                    if (!(key3 === "kind" || key3 === "assetId" || key3 === "widthInches" || key3 === "heightInches")) {
                                      validate29.errors = [{ instancePath: instancePath + "/images/" + i6, schemaPath: "#/$defs/Canonical_Image_1ed45a41/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs38 === errors2) {
                                    if (data16.kind !== void 0) {
                                      const _errs39 = errors2;
                                      if ("image" !== data16.kind) {
                                        validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/kind", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/kind/const", keyword: "const", params: { allowedValue: "image" }, message: "must be equal to constant" }];
                                        return false;
                                      }
                                      var valid12 = _errs39 === errors2;
                                    } else {
                                      var valid12 = true;
                                    }
                                    if (valid12) {
                                      if (data16.assetId !== void 0) {
                                        let data18 = data16.assetId;
                                        const _errs40 = errors2;
                                        if (errors2 === _errs40) {
                                          if (typeof data18 === "string") {
                                            if (!pattern5.test(data18)) {
                                              validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/assetId", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/assetId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "^[A-Za-z0-9_-]{1,64}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/assetId", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/assetId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid12 = _errs40 === errors2;
                                      } else {
                                        var valid12 = true;
                                      }
                                      if (valid12) {
                                        if (data16.widthInches !== void 0) {
                                          let data19 = data16.widthInches;
                                          const _errs42 = errors2;
                                          if (errors2 === _errs42) {
                                            if (typeof data19 == "number" && isFinite(data19)) {
                                              if (data19 > 12 || isNaN(data19)) {
                                                validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/maximum", keyword: "maximum", params: { comparison: "<=", limit: 12 }, message: "must be <= 12" }];
                                                return false;
                                              } else {
                                                if (data19 <= 0 || isNaN(data19)) {
                                                  validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/exclusiveMinimum", keyword: "exclusiveMinimum", params: { comparison: ">", limit: 0 }, message: "must be > 0" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/widthInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/widthInches/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                              return false;
                                            }
                                          }
                                          var valid12 = _errs42 === errors2;
                                        } else {
                                          var valid12 = true;
                                        }
                                        if (valid12) {
                                          if (data16.heightInches !== void 0) {
                                            let data20 = data16.heightInches;
                                            const _errs44 = errors2;
                                            if (errors2 === _errs44) {
                                              if (typeof data20 == "number" && isFinite(data20)) {
                                                if (data20 > 12 || isNaN(data20)) {
                                                  validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/maximum", keyword: "maximum", params: { comparison: "<=", limit: 12 }, message: "must be <= 12" }];
                                                  return false;
                                                } else {
                                                  if (data20 <= 0 || isNaN(data20)) {
                                                    validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/exclusiveMinimum", keyword: "exclusiveMinimum", params: { comparison: ">", limit: 0 }, message: "must be > 0" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate29.errors = [{ instancePath: instancePath + "/images/" + i6 + "/heightInches", schemaPath: "#/$defs/Canonical_Image_1ed45a41/properties/heightInches/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                                return false;
                                              }
                                            }
                                            var valid12 = _errs44 === errors2;
                                          } else {
                                            var valid12 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate29.errors = [{ instancePath: instancePath + "/images/" + i6, schemaPath: "#/$defs/Canonical_Image_1ed45a41/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid10 = _errs35 === errors2;
                            if (!valid10) {
                              break;
                            }
                          }
                        }
                      }
                    } else {
                      validate29.errors = [{ instancePath: instancePath + "/images", schemaPath: "#/properties/images/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                      return false;
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
    } else {
      validate29.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate29.errors = vErrors;
  return errors2 === 0;
}
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sheets === void 0 && (missing0 = "sheets")) {
        validate28.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sheets")) {
            validate28.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sheets !== void 0) {
            let data0 = data.sheets;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (Array.isArray(data0)) {
                if (data0.length > 30) {
                  validate28.errors = [{ instancePath: instancePath + "/sheets", schemaPath: "#/properties/sheets/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" }];
                  return false;
                } else {
                  if (data0.length < 1) {
                    validate28.errors = [{ instancePath: instancePath + "/sheets", schemaPath: "#/properties/sheets/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                    return false;
                  } else {
                    var valid1 = true;
                    const len0 = data0.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      const _errs4 = errors2;
                      if (!validate29(data0[i0], { instancePath: instancePath + "/sheets/" + i0, parentData: data0, parentDataProperty: i0, rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
                        errors2 = vErrors.length;
                      }
                      var valid1 = _errs4 === errors2;
                      if (!valid1) {
                        break;
                      }
                    }
                  }
                }
              } else {
                validate28.errors = [{ instancePath: instancePath + "/sheets", schemaPath: "#/properties/sheets/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
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
  return errors2 === 0;
}
validate28.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (errors2 === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.operation === void 0 && (missing0 = "operation") || data.format === void 0 && (missing0 = "format") || data.title === void 0 && (missing0 = "title") || data.content === void 0 && (missing0 = "content")) {
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
          if (!(key0 === "operation" || key0 === "format" || key0 === "title" || key0 === "content")) {
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
          if (data.operation !== void 0) {
            const _errs4 = errors2;
            if ("create_word" !== data.operation) {
              const err2 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/0/properties/operation/const", keyword: "const", params: { allowedValue: "create_word" }, message: "must be equal to constant" };
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
            if (data.format !== void 0) {
              const _errs5 = errors2;
              if (!(data.format === "docx")) {
                const err3 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/0/properties/format/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.format.enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
              }
              var valid1 = _errs5 === errors2;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.title !== void 0) {
                let data2 = data.title;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (func1(data2) > 200) {
                      const err4 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/0/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors2++;
                    } else {
                      if (func1(data2) < 1) {
                        const err5 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/0/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err5];
                        } else {
                          vErrors.push(err5);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err6 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/0/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err6];
                    } else {
                      vErrors.push(err6);
                    }
                    errors2++;
                  }
                }
                var valid1 = _errs6 === errors2;
              } else {
                var valid1 = true;
              }
              if (valid1) {
                if (data.content !== void 0) {
                  const _errs8 = errors2;
                  if (!validate24(data.content, { instancePath: instancePath + "/content", parentData: data, parentDataProperty: "content", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                    errors2 = vErrors.length;
                  }
                  var valid1 = _errs8 === errors2;
                } else {
                  var valid1 = true;
                }
              }
            }
          }
        }
      }
    } else {
      const err7 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
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
  const _errs9 = errors2;
  if (errors2 === _errs9) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.operation === void 0 && (missing1 = "operation") || data.format === void 0 && (missing1 = "format") || data.title === void 0 && (missing1 = "title") || data.content === void 0 && (missing1 = "content")) {
        const err8 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors2++;
      } else {
        const _errs11 = errors2;
        for (const key1 in data) {
          if (!(key1 === "operation" || key1 === "format" || key1 === "title" || key1 === "content")) {
            const err9 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors2++;
            break;
          }
        }
        if (_errs11 === errors2) {
          if (data.operation !== void 0) {
            const _errs12 = errors2;
            if ("create_word" !== data.operation) {
              const err10 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/1/properties/operation/const", keyword: "const", params: { allowedValue: "create_word" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors2++;
            }
            var valid2 = _errs12 === errors2;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.format !== void 0) {
              const _errs13 = errors2;
              if ("txt" !== data.format) {
                const err11 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/1/properties/format/const", keyword: "const", params: { allowedValue: "txt" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err11];
                } else {
                  vErrors.push(err11);
                }
                errors2++;
              }
              var valid2 = _errs13 === errors2;
            } else {
              var valid2 = true;
            }
            if (valid2) {
              if (data.title !== void 0) {
                let data6 = data.title;
                const _errs14 = errors2;
                if (errors2 === _errs14) {
                  if (typeof data6 === "string") {
                    if (func1(data6) > 200) {
                      const err12 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/1/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                      if (vErrors === null) {
                        vErrors = [err12];
                      } else {
                        vErrors.push(err12);
                      }
                      errors2++;
                    } else {
                      if (func1(data6) < 1) {
                        const err13 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/1/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                        if (vErrors === null) {
                          vErrors = [err13];
                        } else {
                          vErrors.push(err13);
                        }
                        errors2++;
                      }
                    }
                  } else {
                    const err14 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/1/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err14];
                    } else {
                      vErrors.push(err14);
                    }
                    errors2++;
                  }
                }
                var valid2 = _errs14 === errors2;
              } else {
                var valid2 = true;
              }
              if (valid2) {
                if (data.content !== void 0) {
                  let data7 = data.content;
                  const _errs16 = errors2;
                  if (errors2 === _errs16) {
                    if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                      let missing2;
                      if (data7.text === void 0 && (missing2 = "text")) {
                        const err15 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/1/properties/content/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                        if (vErrors === null) {
                          vErrors = [err15];
                        } else {
                          vErrors.push(err15);
                        }
                        errors2++;
                      } else {
                        const _errs18 = errors2;
                        for (const key2 in data7) {
                          if (!(key2 === "text")) {
                            const err16 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/1/properties/content/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err16];
                            } else {
                              vErrors.push(err16);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs18 === errors2) {
                          if (data7.text !== void 0) {
                            let data8 = data7.text;
                            const _errs19 = errors2;
                            if (errors2 === _errs19) {
                              if (typeof data8 === "string") {
                                if (func1(data8) > 1e5) {
                                  const err17 = { instancePath: instancePath + "/content/text", schemaPath: "#/oneOf/1/properties/content/properties/text/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err17];
                                  } else {
                                    vErrors.push(err17);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err18 = { instancePath: instancePath + "/content/text", schemaPath: "#/oneOf/1/properties/content/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err18];
                                } else {
                                  vErrors.push(err18);
                                }
                                errors2++;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err19 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/1/properties/content/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err19];
                      } else {
                        vErrors.push(err19);
                      }
                      errors2++;
                    }
                  }
                  var valid2 = _errs16 === errors2;
                } else {
                  var valid2 = true;
                }
              }
            }
          }
        }
      }
    } else {
      const err20 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors2++;
    }
  }
  var _valid0 = _errs9 === errors2;
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
    const _errs21 = errors2;
    if (errors2 === _errs21) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing3;
        if (data.operation === void 0 && (missing3 = "operation") || data.format === void 0 && (missing3 = "format") || data.title === void 0 && (missing3 = "title") || data.content === void 0 && (missing3 = "content")) {
          const err21 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors2++;
        } else {
          const _errs23 = errors2;
          for (const key3 in data) {
            if (!(key3 === "operation" || key3 === "format" || key3 === "title" || key3 === "content")) {
              const err22 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors2++;
              break;
            }
          }
          if (_errs23 === errors2) {
            if (data.operation !== void 0) {
              const _errs24 = errors2;
              if ("create_word" !== data.operation) {
                const err23 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/2/properties/operation/const", keyword: "const", params: { allowedValue: "create_word" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err23];
                } else {
                  vErrors.push(err23);
                }
                errors2++;
              }
              var valid4 = _errs24 === errors2;
            } else {
              var valid4 = true;
            }
            if (valid4) {
              if (data.format !== void 0) {
                const _errs25 = errors2;
                if ("xml" !== data.format) {
                  const err24 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/2/properties/format/const", keyword: "const", params: { allowedValue: "xml" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors2++;
                }
                var valid4 = _errs25 === errors2;
              } else {
                var valid4 = true;
              }
              if (valid4) {
                if (data.title !== void 0) {
                  let data11 = data.title;
                  const _errs26 = errors2;
                  if (errors2 === _errs26) {
                    if (typeof data11 === "string") {
                      if (func1(data11) > 200) {
                        const err25 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/2/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                        if (vErrors === null) {
                          vErrors = [err25];
                        } else {
                          vErrors.push(err25);
                        }
                        errors2++;
                      } else {
                        if (func1(data11) < 1) {
                          const err26 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/2/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err26];
                          } else {
                            vErrors.push(err26);
                          }
                          errors2++;
                        }
                      }
                    } else {
                      const err27 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/2/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err27];
                      } else {
                        vErrors.push(err27);
                      }
                      errors2++;
                    }
                  }
                  var valid4 = _errs26 === errors2;
                } else {
                  var valid4 = true;
                }
                if (valid4) {
                  if (data.content !== void 0) {
                    let data12 = data.content;
                    const _errs28 = errors2;
                    if (errors2 === _errs28) {
                      if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
                        let missing4;
                        if (data12.text === void 0 && (missing4 = "text")) {
                          const err28 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/2/properties/content/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                          if (vErrors === null) {
                            vErrors = [err28];
                          } else {
                            vErrors.push(err28);
                          }
                          errors2++;
                        } else {
                          const _errs30 = errors2;
                          for (const key4 in data12) {
                            if (!(key4 === "text")) {
                              const err29 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/2/properties/content/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err29];
                              } else {
                                vErrors.push(err29);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs30 === errors2) {
                            if (data12.text !== void 0) {
                              let data13 = data12.text;
                              const _errs31 = errors2;
                              if (errors2 === _errs31) {
                                if (typeof data13 === "string") {
                                  if (func1(data13) > 1e5) {
                                    const err30 = { instancePath: instancePath + "/content/text", schemaPath: "#/oneOf/2/properties/content/properties/text/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err30];
                                    } else {
                                      vErrors.push(err30);
                                    }
                                    errors2++;
                                  } else {
                                    if (func1(data13) < 1) {
                                      const err31 = { instancePath: instancePath + "/content/text", schemaPath: "#/oneOf/2/properties/content/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err31];
                                      } else {
                                        vErrors.push(err31);
                                      }
                                      errors2++;
                                    }
                                  }
                                } else {
                                  const err32 = { instancePath: instancePath + "/content/text", schemaPath: "#/oneOf/2/properties/content/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err32];
                                  } else {
                                    vErrors.push(err32);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err33 = { instancePath: instancePath + "/content", schemaPath: "#/oneOf/2/properties/content/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err33];
                        } else {
                          vErrors.push(err33);
                        }
                        errors2++;
                      }
                    }
                    var valid4 = _errs28 === errors2;
                  } else {
                    var valid4 = true;
                  }
                }
              }
            }
          }
        }
      } else {
        const err34 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors2++;
      }
    }
    var _valid0 = _errs21 === errors2;
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
      const _errs33 = errors2;
      if (errors2 === _errs33) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing5;
          if (data.operation === void 0 && (missing5 = "operation") || data.format === void 0 && (missing5 = "format") || data.title === void 0 && (missing5 = "title") || data.content === void 0 && (missing5 = "content")) {
            const err35 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors2++;
          } else {
            const _errs35 = errors2;
            for (const key5 in data) {
              if (!(key5 === "operation" || key5 === "format" || key5 === "title" || key5 === "content")) {
                const err36 = { instancePath, schemaPath: "#/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors2++;
                break;
              }
            }
            if (_errs35 === errors2) {
              if (data.operation !== void 0) {
                const _errs36 = errors2;
                if ("create_excel" !== data.operation) {
                  const err37 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/3/properties/operation/const", keyword: "const", params: { allowedValue: "create_excel" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err37];
                  } else {
                    vErrors.push(err37);
                  }
                  errors2++;
                }
                var valid6 = _errs36 === errors2;
              } else {
                var valid6 = true;
              }
              if (valid6) {
                if (data.format !== void 0) {
                  const _errs37 = errors2;
                  if ("xlsx" !== data.format) {
                    const err38 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/3/properties/format/const", keyword: "const", params: { allowedValue: "xlsx" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err38];
                    } else {
                      vErrors.push(err38);
                    }
                    errors2++;
                  }
                  var valid6 = _errs37 === errors2;
                } else {
                  var valid6 = true;
                }
                if (valid6) {
                  if (data.title !== void 0) {
                    let data16 = data.title;
                    const _errs38 = errors2;
                    if (errors2 === _errs38) {
                      if (typeof data16 === "string") {
                        if (func1(data16) > 200) {
                          const err39 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/3/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                          if (vErrors === null) {
                            vErrors = [err39];
                          } else {
                            vErrors.push(err39);
                          }
                          errors2++;
                        } else {
                          if (func1(data16) < 1) {
                            const err40 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/3/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err40];
                            } else {
                              vErrors.push(err40);
                            }
                            errors2++;
                          }
                        }
                      } else {
                        const err41 = { instancePath: instancePath + "/title", schemaPath: "#/oneOf/3/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err41];
                        } else {
                          vErrors.push(err41);
                        }
                        errors2++;
                      }
                    }
                    var valid6 = _errs38 === errors2;
                  } else {
                    var valid6 = true;
                  }
                  if (valid6) {
                    if (data.content !== void 0) {
                      const _errs40 = errors2;
                      if (!validate28(data.content, { instancePath: instancePath + "/content", parentData: data, parentDataProperty: "content", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                        errors2 = vErrors.length;
                      }
                      var valid6 = _errs40 === errors2;
                    } else {
                      var valid6 = true;
                    }
                  }
                }
              }
            }
          }
        } else {
          const err42 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors2++;
        }
      }
      var _valid0 = _errs33 === errors2;
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
      }
    }
  }
  if (!valid0) {
    const err43 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
    }
    errors2++;
    validate23.errors = vErrors;
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
  validate23.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate23.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate79(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate79.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.request === void 0 && (missing0 = "request")) {
        validate79.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "request")) {
            validate79.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate79.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_.:@/-]{1,255}$" }, message: 'must match pattern "^[A-Za-z0-9_.:@/-]{1,255}$"' }];
                  return false;
                }
              } else {
                validate79.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.request !== void 0) {
              const _errs4 = errors2;
              if (!validate23(data.request, { instancePath: instancePath + "/request", parentData: data, parentDataProperty: "request", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate79.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate79.errors = vErrors;
  return errors2 === 0;
}
validate79.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateReviseRequest = validate81;
var pattern9 = new RegExp("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$", "u");
function validate81(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate81.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.deliveryId === void 0 && (missing0 = "deliveryId") || data.baseVersionId === void 0 && (missing0 = "baseVersionId") || data.request === void 0 && (missing0 = "request")) {
        validate81.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "deliveryId" || key0 === "baseVersionId" || key0 === "request")) {
            validate81.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.deliveryId !== void 0) {
            let data0 = data.deliveryId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate81.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_.:@/-]{1,255}$" }, message: 'must match pattern "^[A-Za-z0-9_.:@/-]{1,255}$"' }];
                  return false;
                }
              } else {
                validate81.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.baseVersionId !== void 0) {
              let data1 = data.baseVersionId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern9.test(data1)) {
                    validate81.errors = [{ instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/pattern", keyword: "pattern", params: { pattern: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" }, message: 'must match pattern "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"' }];
                    return false;
                  }
                } else {
                  validate81.errors = [{ instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.request !== void 0) {
                const _errs6 = errors2;
                if (!validate23(data.request, { instancePath: instancePath + "/request", parentData: data, parentDataProperty: "request", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
                  errors2 = vErrors.length;
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
      validate81.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate81.errors = vErrors;
  return errors2 === 0;
}
validate81.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateInspectRequest = validate83;
function validate83(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate83.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.versionId === void 0 && (missing0 = "versionId")) {
        validate83.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId")) {
            validate83.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.versionId !== void 0) {
            let data0 = data.versionId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern9.test(data0)) {
                  validate83.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" }, message: 'must match pattern "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate83.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate83.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate83.errors = vErrors;
  return errors2 === 0;
}
validate83.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateDownloadRequest = validate84;
function validate84(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate84.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.versionId === void 0 && (missing0 = "versionId")) {
        validate84.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId")) {
            validate84.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.versionId !== void 0) {
            let data0 = data.versionId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern9.test(data0)) {
                  validate84.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" }, message: 'must match pattern "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate84.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate84.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate84.errors = vErrors;
  return errors2 === 0;
}
validate84.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateCreated = validate85;
var schema54 = { "type": "object", "properties": { "version": { "$ref": "#/$defs/DocumentVersion" }, "inspection": { "oneOf": [{ "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "txt" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" } }, "required": ["encoding", "whitespace"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "format": { "const": "xml" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 0 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" }, "wellFormed": { "const": true } }, "required": ["encoding", "whitespace", "wellFormed"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "docx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "paragraphs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "tables": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "pictures": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["paragraphs", "tables", "pictures"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "xlsx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "sheets": { "type": "array", "items": { "type": "string" }, "maxItems": 30 }, "formulas": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "formulaCache": { "enum": ["unverified-zero-placeholder; recalculation required", "removed/unverified; recalculation required"] }, "revisionMethod": { "const": "openpyxl typed-cell replacement" } }, "required": ["sheets", "formulas", "formulaCache"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }] }, "execution": { "$ref": "#/$defs/Canonical_ArtifactExecution_28c65a3e" } }, "required": ["version", "inspection", "execution"], "additionalProperties": false };
var schema55 = { "allOf": [{ "$ref": "#/$defs/Canonical_ArtifactVersion_7f9c56fa" }, { "type": "object", "properties": { "generationStatus": { "const": "draft" }, "previewStatus": { "const": "pending" }, "filename": { "type": "string", "pattern": "^[A-Za-z0-9._ -]{1,125}$" }, "mimeType": { "enum": ["text/plain; charset=utf-8", "application/xml; charset=utf-8", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] } } }] };
var schema57 = { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "artifactId": { "type": "string", "format": "uuid" }, "versionId": { "type": "string", "format": "uuid" }, "parentVersionId": { "anyOf": [{ "type": "string", "format": "uuid" }, { "type": "null" }] }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "object": { "$ref": "#/$defs/Canonical_ObjectReference_a099bd1c" }, "filename": { "type": "string", "minLength": 1, "maxLength": 255 }, "mimeType": { "type": "string", "minLength": 1 }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "evidence": { "type": "array", "items": { "$ref": "#/$defs/Canonical_SourceEvidence_d9008775" } }, "generationStatus": { "type": "string", "enum": ["draft", "validated", "published", "failed"] }, "previewStatus": { "type": "string", "enum": ["pending", "validated", "unsupported", "failed"] }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": ["contractVersion", "artifactId", "versionId", "parentVersionId", "binding", "object", "filename", "mimeType", "scopes", "evidence", "generationStatus", "previewStatus", "createdAt"], "additionalProperties": false };
var schema60 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func28 = Object.prototype.hasOwnProperty;
var func0 = require_equal().default;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats16 = require_formats().fullFormats["date-time"];
var pattern12 = new RegExp("^[a-f0-9]{64}$", "u");
function validate47(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate47.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.objectId === void 0 && (missing0 = "objectId") || data.versionId === void 0 && (missing0 = "versionId") || data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate47.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "objectId" || key0 === "versionId" || key0 === "sha256" || key0 === "bytes" || key0 === "scopes")) {
            validate47.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.objectId !== void 0) {
            let data0 = data.objectId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate47.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate47.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.versionId !== void 0) {
              let data1 = data.versionId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate47.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate47.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sha256 !== void 0) {
                let data2 = data.sha256;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate47.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate47.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.bytes !== void 0) {
                  let data3 = data.bytes;
                  const _errs8 = errors2;
                  if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                    validate47.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs8) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 9007199254740991 || isNaN(data3)) {
                        validate47.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data3 < 0 || isNaN(data3)) {
                          validate47.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.scopes !== void 0) {
                    let data4 = data.scopes;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (Array.isArray(data4)) {
                        if (data4.length < 1) {
                          validate47.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                          return false;
                        } else {
                          var valid1 = true;
                          const len0 = data4.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data5 = data4[i0];
                            const _errs12 = errors2;
                            const _errs13 = errors2;
                            if (errors2 === _errs13) {
                              if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                                let missing1;
                                if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.kind === void 0 && (missing1 = "kind") || data5.resourceId === void 0 && (missing1 = "resourceId") || data5.policyRevision === void 0 && (missing1 = "policyRevision")) {
                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs15 === errors2) {
                                    if (data5.tenantId !== void 0) {
                                      let data6 = data5.tenantId;
                                      const _errs16 = errors2;
                                      if (errors2 === _errs16) {
                                        if (typeof data6 === "string") {
                                          if (func1(data6) > 128) {
                                            validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data6) < 1) {
                                              validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid3 = _errs16 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data5.kind !== void 0) {
                                        let data7 = data5.kind;
                                        const _errs18 = errors2;
                                        if (typeof data7 !== "string") {
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid3 = _errs18 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data5.resourceId !== void 0) {
                                          let data8 = data5.resourceId;
                                          const _errs20 = errors2;
                                          if (errors2 === _errs20) {
                                            if (typeof data8 === "string") {
                                              if (func1(data8) > 256) {
                                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data8) < 1) {
                                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid3 = _errs20 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data5.policyRevision !== void 0) {
                                            let data9 = data5.policyRevision;
                                            const _errs22 = errors2;
                                            if (errors2 === _errs22) {
                                              if (typeof data9 === "string") {
                                                if (func1(data9) > 128) {
                                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data9) < 1) {
                                                    validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid3 = _errs22 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid1 = _errs12 === errors2;
                            if (!valid1) {
                              break;
                            }
                          }
                          if (valid1) {
                            let i1 = data4.length;
                            let j0;
                            if (i1 > 1) {
                              outer0: for (; i1--; ) {
                                for (j0 = i1; j0--; ) {
                                  if (func0(data4[i1], data4[j0])) {
                                    validate47.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                    return false;
                                    break outer0;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate47.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs10 === errors2;
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
      validate47.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate47.errors = vErrors;
  return errors2 === 0;
}
validate47.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema62 = { "type": "object", "properties": { "sourceId": { "type": "string", "minLength": 1 }, "recordId": { "type": "string", "minLength": 1 }, "sourceVersionId": { "type": "string", "minLength": 1 }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "sourceUpdatedAt": { "anyOf": [{ "type": "string", "format": "date-time", "pattern": "Z$" }, { "type": "null" }] }, "citationId": { "type": "string", "format": "uuid" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "contentSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "authorizationDecisionId"], "additionalProperties": false };
var pattern13 = new RegExp("Z$", "u");
function validate49(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sourceId === void 0 && (missing0 = "sourceId") || data.recordId === void 0 && (missing0 = "recordId") || data.sourceVersionId === void 0 && (missing0 = "sourceVersionId") || data.observedAt === void 0 && (missing0 = "observedAt") || data.sourceUpdatedAt === void 0 && (missing0 = "sourceUpdatedAt") || data.citationId === void 0 && (missing0 = "citationId") || data.scopes === void 0 && (missing0 = "scopes") || data.contentSha256 === void 0 && (missing0 = "contentSha256") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
        validate49.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func28.call(schema62.properties, key0)) {
            validate49.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sourceId !== void 0) {
            let data0 = data.sourceId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (func1(data0) < 1) {
                  validate49.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                  return false;
                }
              } else {
                validate49.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.recordId !== void 0) {
              let data1 = data.recordId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate49.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate49.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sourceVersionId !== void 0) {
                let data2 = data.sourceVersionId;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (func1(data2) < 1) {
                      validate49.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  } else {
                    validate49.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.observedAt !== void 0) {
                  let data3 = data.observedAt;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (errors2 === _errs8) {
                      if (typeof data3 === "string") {
                        if (!pattern13.test(data3)) {
                          validate49.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats16.validate(data3)) {
                            validate49.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate49.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.sourceUpdatedAt !== void 0) {
                    let data4 = data.sourceUpdatedAt;
                    const _errs10 = errors2;
                    const _errs11 = errors2;
                    let valid1 = false;
                    const _errs12 = errors2;
                    if (errors2 === _errs12) {
                      if (errors2 === _errs12) {
                        if (typeof data4 === "string") {
                          if (!pattern13.test(data4)) {
                            const err0 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (!formats16.validate(data4)) {
                              const err1 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors2++;
                            }
                          }
                        } else {
                          const err2 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                      }
                    }
                    var _valid0 = _errs12 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs14 = errors2;
                    if (data4 !== null) {
                      const err3 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err3];
                      } else {
                        vErrors.push(err3);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs14 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err4 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors2++;
                      validate49.errors = vErrors;
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
                    if (data.citationId !== void 0) {
                      let data5 = data.citationId;
                      const _errs16 = errors2;
                      if (errors2 === _errs16) {
                        if (errors2 === _errs16) {
                          if (typeof data5 === "string") {
                            if (!formats0.test(data5)) {
                              validate49.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate49.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                      }
                      var valid0 = _errs16 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.scopes !== void 0) {
                        let data6 = data.scopes;
                        const _errs18 = errors2;
                        if (errors2 === _errs18) {
                          if (Array.isArray(data6)) {
                            if (data6.length < 1) {
                              validate49.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                              return false;
                            } else {
                              var valid2 = true;
                              const len0 = data6.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                let data7 = data6[i0];
                                const _errs20 = errors2;
                                const _errs21 = errors2;
                                if (errors2 === _errs21) {
                                  if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                                    let missing1;
                                    if (data7.tenantId === void 0 && (missing1 = "tenantId") || data7.kind === void 0 && (missing1 = "kind") || data7.resourceId === void 0 && (missing1 = "resourceId") || data7.policyRevision === void 0 && (missing1 = "policyRevision")) {
                                      validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                      return false;
                                    } else {
                                      const _errs23 = errors2;
                                      for (const key1 in data7) {
                                        if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                          validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs23 === errors2) {
                                        if (data7.tenantId !== void 0) {
                                          let data8 = data7.tenantId;
                                          const _errs24 = errors2;
                                          if (errors2 === _errs24) {
                                            if (typeof data8 === "string") {
                                              if (func1(data8) > 128) {
                                                validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data8) < 1) {
                                                  validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid4 = _errs24 === errors2;
                                        } else {
                                          var valid4 = true;
                                        }
                                        if (valid4) {
                                          if (data7.kind !== void 0) {
                                            let data9 = data7.kind;
                                            const _errs26 = errors2;
                                            if (typeof data9 !== "string") {
                                              validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data9 === "tenant" || data9 === "client" || data9 === "mailbox" || data9 === "memory" || data9 === "document" || data9 === "private-user" || data9 === "public")) {
                                              validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid4 = _errs26 === errors2;
                                          } else {
                                            var valid4 = true;
                                          }
                                          if (valid4) {
                                            if (data7.resourceId !== void 0) {
                                              let data10 = data7.resourceId;
                                              const _errs28 = errors2;
                                              if (errors2 === _errs28) {
                                                if (typeof data10 === "string") {
                                                  if (func1(data10) > 256) {
                                                    validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data10) < 1) {
                                                      validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid4 = _errs28 === errors2;
                                            } else {
                                              var valid4 = true;
                                            }
                                            if (valid4) {
                                              if (data7.policyRevision !== void 0) {
                                                let data11 = data7.policyRevision;
                                                const _errs30 = errors2;
                                                if (errors2 === _errs30) {
                                                  if (typeof data11 === "string") {
                                                    if (func1(data11) > 128) {
                                                      validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func1(data11) < 1) {
                                                        validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid4 = _errs30 === errors2;
                                              } else {
                                                var valid4 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate49.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid2 = _errs20 === errors2;
                                if (!valid2) {
                                  break;
                                }
                              }
                              if (valid2) {
                                let i1 = data6.length;
                                let j0;
                                if (i1 > 1) {
                                  outer0: for (; i1--; ) {
                                    for (j0 = i1; j0--; ) {
                                      if (func0(data6[i1], data6[j0])) {
                                        validate49.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate49.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid0 = _errs18 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.contentSha256 !== void 0) {
                          let data12 = data.contentSha256;
                          const _errs32 = errors2;
                          if (errors2 === _errs32) {
                            if (typeof data12 === "string") {
                              if (!pattern12.test(data12)) {
                                validate49.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate49.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs32 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.authorizationDecisionId !== void 0) {
                            let data13 = data.authorizationDecisionId;
                            const _errs34 = errors2;
                            if (errors2 === _errs34) {
                              if (errors2 === _errs34) {
                                if (typeof data13 === "string") {
                                  if (!formats0.test(data13)) {
                                    validate49.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate49.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                            }
                            var valid0 = _errs34 === errors2;
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
      validate49.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate49.errors = vErrors;
  return errors2 === 0;
}
validate49.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate46(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.artifactId === void 0 && (missing0 = "artifactId") || data.versionId === void 0 && (missing0 = "versionId") || data.parentVersionId === void 0 && (missing0 = "parentVersionId") || data.binding === void 0 && (missing0 = "binding") || data.object === void 0 && (missing0 = "object") || data.filename === void 0 && (missing0 = "filename") || data.mimeType === void 0 && (missing0 = "mimeType") || data.scopes === void 0 && (missing0 = "scopes") || data.evidence === void 0 && (missing0 = "evidence") || data.generationStatus === void 0 && (missing0 = "generationStatus") || data.previewStatus === void 0 && (missing0 = "previewStatus") || data.createdAt === void 0 && (missing0 = "createdAt")) {
        validate46.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func28.call(schema57.properties, key0)) {
            validate46.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate46.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.artifactId !== void 0) {
              let data1 = data.artifactId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate46.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate46.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.versionId !== void 0) {
                let data2 = data.versionId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate46.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate46.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.parentVersionId !== void 0) {
                  let data3 = data.parentVersionId;
                  const _errs7 = errors2;
                  const _errs8 = errors2;
                  let valid1 = false;
                  const _errs9 = errors2;
                  if (errors2 === _errs9) {
                    if (errors2 === _errs9) {
                      if (typeof data3 === "string") {
                        if (!formats0.test(data3)) {
                          const err0 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/properties/parentVersionId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                      } else {
                        const err1 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/properties/parentVersionId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors2++;
                      }
                    }
                  }
                  var _valid0 = _errs9 === errors2;
                  valid1 = valid1 || _valid0;
                  const _errs11 = errors2;
                  if (data3 !== null) {
                    const err2 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/properties/parentVersionId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors2++;
                  }
                  var _valid0 = _errs11 === errors2;
                  valid1 = valid1 || _valid0;
                  if (!valid1) {
                    const err3 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/properties/parentVersionId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                    validate46.errors = vErrors;
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
                  if (data.binding !== void 0) {
                    let data4 = data.binding;
                    const _errs13 = errors2;
                    const _errs14 = errors2;
                    if (errors2 === _errs14) {
                      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                        let missing1;
                        if (data4.tenantId === void 0 && (missing1 = "tenantId") || data4.actorId === void 0 && (missing1 = "actorId") || data4.conversationId === void 0 && (missing1 = "conversationId") || data4.runId === void 0 && (missing1 = "runId") || data4.attemptId === void 0 && (missing1 = "attemptId") || data4.workerId === void 0 && (missing1 = "workerId") || data4.writerFence === void 0 && (missing1 = "writerFence")) {
                          validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs16 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs16 === errors2) {
                            if (data4.tenantId !== void 0) {
                              let data5 = data4.tenantId;
                              const _errs17 = errors2;
                              if (errors2 === _errs17) {
                                if (typeof data5 === "string") {
                                  if (func1(data5) > 128) {
                                    validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func1(data5) < 1) {
                                      validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid3 = _errs17 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data4.actorId !== void 0) {
                                let data6 = data4.actorId;
                                const _errs19 = errors2;
                                if (errors2 === _errs19) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid3 = _errs19 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data4.conversationId !== void 0) {
                                  let data7 = data4.conversationId;
                                  const _errs21 = errors2;
                                  if (errors2 === _errs21) {
                                    if (errors2 === _errs21) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate46.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate46.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid3 = _errs21 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data4.runId !== void 0) {
                                    let data8 = data4.runId;
                                    const _errs23 = errors2;
                                    if (errors2 === _errs23) {
                                      if (errors2 === _errs23) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate46.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate46.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid3 = _errs23 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data4.attemptId !== void 0) {
                                      let data9 = data4.attemptId;
                                      const _errs25 = errors2;
                                      if (errors2 === _errs25) {
                                        if (errors2 === _errs25) {
                                          if (typeof data9 === "string") {
                                            if (!formats0.test(data9)) {
                                              validate46.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate46.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                      }
                                      var valid3 = _errs25 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data4.workerId !== void 0) {
                                        let data10 = data4.workerId;
                                        const _errs27 = errors2;
                                        if (errors2 === _errs27) {
                                          if (errors2 === _errs27) {
                                            if (typeof data10 === "string") {
                                              if (!formats0.test(data10)) {
                                                validate46.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate46.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                        }
                                        var valid3 = _errs27 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data4.writerFence !== void 0) {
                                          let data11 = data4.writerFence;
                                          const _errs29 = errors2;
                                          if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                            validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs29) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid3 = _errs29 === errors2;
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
                        validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs13 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.object !== void 0) {
                      const _errs31 = errors2;
                      if (!validate47(data.object, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
                        errors2 = vErrors.length;
                      }
                      var valid0 = _errs31 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.filename !== void 0) {
                        let data13 = data.filename;
                        const _errs32 = errors2;
                        if (errors2 === _errs32) {
                          if (typeof data13 === "string") {
                            if (func1(data13) > 255) {
                              validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                              return false;
                            } else {
                              if (func1(data13) < 1) {
                                validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs32 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.mimeType !== void 0) {
                          let data14 = data.mimeType;
                          const _errs34 = errors2;
                          if (errors2 === _errs34) {
                            if (typeof data14 === "string") {
                              if (func1(data14) < 1) {
                                validate46.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            } else {
                              validate46.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs34 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.scopes !== void 0) {
                            let data15 = data.scopes;
                            const _errs36 = errors2;
                            if (errors2 === _errs36) {
                              if (Array.isArray(data15)) {
                                if (data15.length < 1) {
                                  validate46.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                  return false;
                                } else {
                                  var valid4 = true;
                                  const len0 = data15.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    let data16 = data15[i0];
                                    const _errs38 = errors2;
                                    const _errs39 = errors2;
                                    if (errors2 === _errs39) {
                                      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                                        let missing2;
                                        if (data16.tenantId === void 0 && (missing2 = "tenantId") || data16.kind === void 0 && (missing2 = "kind") || data16.resourceId === void 0 && (missing2 = "resourceId") || data16.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                          validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                          return false;
                                        } else {
                                          const _errs41 = errors2;
                                          for (const key2 in data16) {
                                            if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                              validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs41 === errors2) {
                                            if (data16.tenantId !== void 0) {
                                              let data17 = data16.tenantId;
                                              const _errs42 = errors2;
                                              if (errors2 === _errs42) {
                                                if (typeof data17 === "string") {
                                                  if (func1(data17) > 128) {
                                                    validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data17) < 1) {
                                                      validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid6 = _errs42 === errors2;
                                            } else {
                                              var valid6 = true;
                                            }
                                            if (valid6) {
                                              if (data16.kind !== void 0) {
                                                let data18 = data16.kind;
                                                const _errs44 = errors2;
                                                if (typeof data18 !== "string") {
                                                  validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                                if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
                                                  validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                                  return false;
                                                }
                                                var valid6 = _errs44 === errors2;
                                              } else {
                                                var valid6 = true;
                                              }
                                              if (valid6) {
                                                if (data16.resourceId !== void 0) {
                                                  let data19 = data16.resourceId;
                                                  const _errs46 = errors2;
                                                  if (errors2 === _errs46) {
                                                    if (typeof data19 === "string") {
                                                      if (func1(data19) > 256) {
                                                        validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func1(data19) < 1) {
                                                          validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid6 = _errs46 === errors2;
                                                } else {
                                                  var valid6 = true;
                                                }
                                                if (valid6) {
                                                  if (data16.policyRevision !== void 0) {
                                                    let data20 = data16.policyRevision;
                                                    const _errs48 = errors2;
                                                    if (errors2 === _errs48) {
                                                      if (typeof data20 === "string") {
                                                        if (func1(data20) > 128) {
                                                          validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func1(data20) < 1) {
                                                            validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid6 = _errs48 === errors2;
                                                  } else {
                                                    var valid6 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        validate46.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid4 = _errs38 === errors2;
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
                                            validate46.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                            return false;
                                            break outer0;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate46.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid0 = _errs36 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.evidence !== void 0) {
                              let data21 = data.evidence;
                              const _errs50 = errors2;
                              if (errors2 === _errs50) {
                                if (Array.isArray(data21)) {
                                  var valid8 = true;
                                  const len1 = data21.length;
                                  for (let i2 = 0; i2 < len1; i2++) {
                                    const _errs52 = errors2;
                                    if (!validate49(data21[i2], { instancePath: instancePath + "/evidence/" + i2, parentData: data21, parentDataProperty: i2, rootData, dynamicAnchors })) {
                                      vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
                                      errors2 = vErrors.length;
                                    }
                                    var valid8 = _errs52 === errors2;
                                    if (!valid8) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate46.errors = [{ instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                  return false;
                                }
                              }
                              var valid0 = _errs50 === errors2;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.generationStatus !== void 0) {
                                let data23 = data.generationStatus;
                                const _errs53 = errors2;
                                if (typeof data23 !== "string") {
                                  validate46.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                if (!(data23 === "draft" || data23 === "validated" || data23 === "published" || data23 === "failed")) {
                                  validate46.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/enum", keyword: "enum", params: { allowedValues: schema57.properties.generationStatus.enum }, message: "must be equal to one of the allowed values" }];
                                  return false;
                                }
                                var valid0 = _errs53 === errors2;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.previewStatus !== void 0) {
                                  let data24 = data.previewStatus;
                                  const _errs55 = errors2;
                                  if (typeof data24 !== "string") {
                                    validate46.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  if (!(data24 === "pending" || data24 === "validated" || data24 === "unsupported" || data24 === "failed")) {
                                    validate46.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/enum", keyword: "enum", params: { allowedValues: schema57.properties.previewStatus.enum }, message: "must be equal to one of the allowed values" }];
                                    return false;
                                  }
                                  var valid0 = _errs55 === errors2;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.createdAt !== void 0) {
                                    let data25 = data.createdAt;
                                    const _errs57 = errors2;
                                    if (errors2 === _errs57) {
                                      if (errors2 === _errs57) {
                                        if (typeof data25 === "string") {
                                          if (!pattern13.test(data25)) {
                                            validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats16.validate(data25)) {
                                              validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid0 = _errs57 === errors2;
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
          }
        }
      }
    } else {
      validate46.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate46.errors = vErrors;
  return errors2 === 0;
}
validate46.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema64 = { "type": "object", "properties": { "contractVersion": { "const": "0.2.0" }, "artifactId": { "$ref": "#/$defs/Canonical_artifactId_cc9f299e" }, "versionId": { "$ref": "#/$defs/Canonical_versionId_e4470a54" }, "parentVersionId": { "$ref": "#/$defs/Canonical_parentVersionId_116435a5" }, "binding": { "$ref": "#/$defs/Canonical_binding_ad882dea" }, "object": { "$ref": "#/$defs/Canonical_object_a3973f47" }, "filename": { "$ref": "#/$defs/Canonical_filename_f09421cc" }, "mimeType": { "$ref": "#/$defs/Canonical_mimeType_0837eb6f" }, "scopes": { "$ref": "#/$defs/Canonical_scopes_3d363e5b" }, "evidence": { "type": "array", "items": { "$ref": "#/$defs/Canonical_NativeSourceEvidence_cb9e6ba4" } }, "generationStatus": { "$ref": "#/$defs/Canonical_generationStatus_0b8d37a9" }, "previewStatus": { "$ref": "#/$defs/Canonical_previewStatus_fe162158" }, "createdAt": { "$ref": "#/$defs/Canonical_createdAt_38444d79" } }, "required": ["contractVersion", "artifactId", "versionId", "parentVersionId", "binding", "object", "filename", "mimeType", "scopes", "evidence", "generationStatus", "previewStatus", "createdAt"], "additionalProperties": false };
var schema86 = { "type": "string", "enum": ["draft", "validated", "published", "failed"] };
var schema87 = { "type": "string", "enum": ["pending", "validated", "unsupported", "failed"] };
function validate53(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate53.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.objectId === void 0 && (missing0 = "objectId") || data.versionId === void 0 && (missing0 = "versionId") || data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate53.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "objectId" || key0 === "versionId" || key0 === "sha256" || key0 === "bytes" || key0 === "scopes")) {
            validate53.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.objectId !== void 0) {
            let data0 = data.objectId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate53.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate53.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.versionId !== void 0) {
              let data1 = data.versionId;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate53.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate53.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sha256 !== void 0) {
                let data2 = data.sha256;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (!pattern12.test(data2)) {
                      validate53.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate53.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.bytes !== void 0) {
                  let data3 = data.bytes;
                  const _errs8 = errors2;
                  if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                    validate53.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs8) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 9007199254740991 || isNaN(data3)) {
                        validate53.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data3 < 0 || isNaN(data3)) {
                          validate53.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.scopes !== void 0) {
                    let data4 = data.scopes;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (Array.isArray(data4)) {
                        if (data4.length < 1) {
                          validate53.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                          return false;
                        } else {
                          var valid1 = true;
                          const len0 = data4.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data5 = data4[i0];
                            const _errs12 = errors2;
                            const _errs13 = errors2;
                            if (errors2 === _errs13) {
                              if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                                let missing1;
                                if (data5.tenantId === void 0 && (missing1 = "tenantId") || data5.kind === void 0 && (missing1 = "kind") || data5.resourceId === void 0 && (missing1 = "resourceId") || data5.policyRevision === void 0 && (missing1 = "policyRevision")) {
                                  validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs15 === errors2) {
                                    if (data5.tenantId !== void 0) {
                                      let data6 = data5.tenantId;
                                      const _errs16 = errors2;
                                      if (errors2 === _errs16) {
                                        if (typeof data6 === "string") {
                                          if (func1(data6) > 128) {
                                            validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data6) < 1) {
                                              validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid3 = _errs16 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data5.kind !== void 0) {
                                        let data7 = data5.kind;
                                        const _errs18 = errors2;
                                        if (typeof data7 !== "string") {
                                          validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid3 = _errs18 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data5.resourceId !== void 0) {
                                          let data8 = data5.resourceId;
                                          const _errs20 = errors2;
                                          if (errors2 === _errs20) {
                                            if (typeof data8 === "string") {
                                              if (func1(data8) > 256) {
                                                validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func1(data8) < 1) {
                                                  validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid3 = _errs20 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data5.policyRevision !== void 0) {
                                            let data9 = data5.policyRevision;
                                            const _errs22 = errors2;
                                            if (errors2 === _errs22) {
                                              if (typeof data9 === "string") {
                                                if (func1(data9) > 128) {
                                                  validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data9) < 1) {
                                                    validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid3 = _errs22 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate53.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid1 = _errs12 === errors2;
                            if (!valid1) {
                              break;
                            }
                          }
                          if (valid1) {
                            let i1 = data4.length;
                            let j0;
                            if (i1 > 1) {
                              outer0: for (; i1--; ) {
                                for (j0 = i1; j0--; ) {
                                  if (func0(data4[i1], data4[j0])) {
                                    validate53.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                    return false;
                                    break outer0;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate53.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs10 === errors2;
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
      validate53.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate53.errors = vErrors;
  return errors2 === 0;
}
validate53.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate55(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate55.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (Array.isArray(data)) {
      if (data.length < 1) {
        validate55.errors = [{ instancePath, schemaPath: "#/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
        return false;
      } else {
        var valid0 = true;
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data0 = data[i0];
          const _errs1 = errors2;
          const _errs2 = errors2;
          if (errors2 === _errs2) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              let missing0;
              if (data0.tenantId === void 0 && (missing0 = "tenantId") || data0.kind === void 0 && (missing0 = "kind") || data0.resourceId === void 0 && (missing0 = "resourceId") || data0.policyRevision === void 0 && (missing0 = "policyRevision")) {
                validate55.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
                return false;
              } else {
                const _errs4 = errors2;
                for (const key0 in data0) {
                  if (!(key0 === "tenantId" || key0 === "kind" || key0 === "resourceId" || key0 === "policyRevision")) {
                    validate55.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                  }
                }
                if (_errs4 === errors2) {
                  if (data0.tenantId !== void 0) {
                    let data1 = data0.tenantId;
                    const _errs5 = errors2;
                    if (errors2 === _errs5) {
                      if (typeof data1 === "string") {
                        if (func1(data1) > 128) {
                          validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                          return false;
                        } else {
                          if (func1(data1) < 1) {
                            validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                            return false;
                          }
                        }
                      } else {
                        validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid2 = _errs5 === errors2;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data0.kind !== void 0) {
                      let data2 = data0.kind;
                      const _errs7 = errors2;
                      if (typeof data2 !== "string") {
                        validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data2 === "tenant" || data2 === "client" || data2 === "mailbox" || data2 === "memory" || data2 === "document" || data2 === "private-user" || data2 === "public")) {
                        validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid2 = _errs7 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.resourceId !== void 0) {
                        let data3 = data0.resourceId;
                        const _errs9 = errors2;
                        if (errors2 === _errs9) {
                          if (typeof data3 === "string") {
                            if (func1(data3) > 256) {
                              validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                              return false;
                            } else {
                              if (func1(data3) < 1) {
                                validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs9 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.policyRevision !== void 0) {
                          let data4 = data0.policyRevision;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data4 === "string") {
                              if (func1(data4) > 128) {
                                validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data4) < 1) {
                                  validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate55.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs11 === errors2;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              validate55.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
              return false;
            }
          }
          var valid0 = _errs1 === errors2;
          if (!valid0) {
            break;
          }
        }
        if (valid0) {
          let i1 = data.length;
          let j0;
          if (i1 > 1) {
            outer0: for (; i1--; ) {
              for (j0 = i1; j0--; ) {
                if (func0(data[i1], data[j0])) {
                  validate55.errors = [{ instancePath, schemaPath: "#/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                  return false;
                  break outer0;
                }
              }
            }
          }
        }
      }
    } else {
      validate55.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
      return false;
    }
  }
  validate55.errors = vErrors;
  return errors2 === 0;
}
validate55.evaluated = { "items": true, "dynamicProps": false, "dynamicItems": false };
var schema75 = { "type": "object", "properties": { "sourceId": { "$ref": "#/$defs/Canonical_sourceId_fa5f0f45" }, "recordId": { "$ref": "#/$defs/Canonical_recordId_1173860d" }, "sourceVersionId": { "$ref": "#/$defs/Canonical_sourceVersionId_a5aa4b63" }, "observedAt": { "$ref": "#/$defs/Canonical_observedAt_fc731620" }, "sourceUpdatedAt": { "$ref": "#/$defs/Canonical_sourceUpdatedAt_4a76a197" }, "citationId": { "$ref": "#/$defs/Canonical_citationId_ae4e145b" }, "scopes": { "$ref": "#/$defs/Canonical_scopes_78e0eb49" }, "contentSha256": { "$ref": "#/$defs/Canonical_contentSha256_6b70d9f7" }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "binding"], "additionalProperties": false };
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
    if (Array.isArray(data)) {
      if (data.length < 1) {
        validate58.errors = [{ instancePath, schemaPath: "#/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
        return false;
      } else {
        var valid0 = true;
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data0 = data[i0];
          const _errs1 = errors2;
          const _errs2 = errors2;
          if (errors2 === _errs2) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              let missing0;
              if (data0.tenantId === void 0 && (missing0 = "tenantId") || data0.kind === void 0 && (missing0 = "kind") || data0.resourceId === void 0 && (missing0 = "resourceId") || data0.policyRevision === void 0 && (missing0 = "policyRevision")) {
                validate58.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
                return false;
              } else {
                const _errs4 = errors2;
                for (const key0 in data0) {
                  if (!(key0 === "tenantId" || key0 === "kind" || key0 === "resourceId" || key0 === "policyRevision")) {
                    validate58.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                  }
                }
                if (_errs4 === errors2) {
                  if (data0.tenantId !== void 0) {
                    let data1 = data0.tenantId;
                    const _errs5 = errors2;
                    if (errors2 === _errs5) {
                      if (typeof data1 === "string") {
                        if (func1(data1) > 128) {
                          validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                          return false;
                        } else {
                          if (func1(data1) < 1) {
                            validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                            return false;
                          }
                        }
                      } else {
                        validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid2 = _errs5 === errors2;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data0.kind !== void 0) {
                      let data2 = data0.kind;
                      const _errs7 = errors2;
                      if (typeof data2 !== "string") {
                        validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data2 === "tenant" || data2 === "client" || data2 === "mailbox" || data2 === "memory" || data2 === "document" || data2 === "private-user" || data2 === "public")) {
                        validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid2 = _errs7 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.resourceId !== void 0) {
                        let data3 = data0.resourceId;
                        const _errs9 = errors2;
                        if (errors2 === _errs9) {
                          if (typeof data3 === "string") {
                            if (func1(data3) > 256) {
                              validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                              return false;
                            } else {
                              if (func1(data3) < 1) {
                                validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs9 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.policyRevision !== void 0) {
                          let data4 = data0.policyRevision;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data4 === "string") {
                              if (func1(data4) > 128) {
                                validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data4) < 1) {
                                  validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate58.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs11 === errors2;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              validate58.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
              return false;
            }
          }
          var valid0 = _errs1 === errors2;
          if (!valid0) {
            break;
          }
        }
        if (valid0) {
          let i1 = data.length;
          let j0;
          if (i1 > 1) {
            outer0: for (; i1--; ) {
              for (j0 = i1; j0--; ) {
                if (func0(data[i1], data[j0])) {
                  validate58.errors = [{ instancePath, schemaPath: "#/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                  return false;
                  break outer0;
                }
              }
            }
          }
        }
      }
    } else {
      validate58.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
      return false;
    }
  }
  validate58.errors = vErrors;
  return errors2 === 0;
}
validate58.evaluated = { "items": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.sourceId === void 0 && (missing0 = "sourceId") || data.recordId === void 0 && (missing0 = "recordId") || data.sourceVersionId === void 0 && (missing0 = "sourceVersionId") || data.observedAt === void 0 && (missing0 = "observedAt") || data.sourceUpdatedAt === void 0 && (missing0 = "sourceUpdatedAt") || data.citationId === void 0 && (missing0 = "citationId") || data.scopes === void 0 && (missing0 = "scopes") || data.contentSha256 === void 0 && (missing0 = "contentSha256") || data.binding === void 0 && (missing0 = "binding")) {
        validate57.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func28.call(schema75.properties, key0)) {
            validate57.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sourceId !== void 0) {
            let data0 = data.sourceId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (func1(data0) < 1) {
                  validate57.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/$defs/Canonical_sourceId_fa5f0f45/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                  return false;
                }
              } else {
                validate57.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/$defs/Canonical_sourceId_fa5f0f45/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.recordId !== void 0) {
              let data1 = data.recordId;
              const _errs5 = errors2;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate57.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/$defs/Canonical_recordId_1173860d/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate57.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/$defs/Canonical_recordId_1173860d/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sourceVersionId !== void 0) {
                let data2 = data.sourceVersionId;
                const _errs8 = errors2;
                const _errs9 = errors2;
                if (errors2 === _errs9) {
                  if (typeof data2 === "string") {
                    if (func1(data2) < 1) {
                      validate57.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/$defs/Canonical_sourceVersionId_a5aa4b63/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  } else {
                    validate57.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/$defs/Canonical_sourceVersionId_a5aa4b63/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.observedAt !== void 0) {
                  let data3 = data.observedAt;
                  const _errs11 = errors2;
                  const _errs12 = errors2;
                  if (errors2 === _errs12) {
                    if (errors2 === _errs12) {
                      if (typeof data3 === "string") {
                        if (!pattern13.test(data3)) {
                          validate57.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/Canonical_observedAt_fc731620/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats16.validate(data3)) {
                            validate57.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/Canonical_observedAt_fc731620/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate57.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/Canonical_observedAt_fc731620/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs11 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.sourceUpdatedAt !== void 0) {
                    let data4 = data.sourceUpdatedAt;
                    const _errs14 = errors2;
                    const _errs16 = errors2;
                    let valid6 = false;
                    const _errs17 = errors2;
                    if (errors2 === _errs17) {
                      if (errors2 === _errs17) {
                        if (typeof data4 === "string") {
                          if (!pattern13.test(data4)) {
                            const err0 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/Canonical_sourceUpdatedAt_4a76a197/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (!formats16.validate(data4)) {
                              const err1 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/Canonical_sourceUpdatedAt_4a76a197/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors2++;
                            }
                          }
                        } else {
                          const err2 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/Canonical_sourceUpdatedAt_4a76a197/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors2++;
                        }
                      }
                    }
                    var _valid0 = _errs17 === errors2;
                    valid6 = valid6 || _valid0;
                    const _errs19 = errors2;
                    if (data4 !== null) {
                      const err3 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/Canonical_sourceUpdatedAt_4a76a197/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err3];
                      } else {
                        vErrors.push(err3);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs19 === errors2;
                    valid6 = valid6 || _valid0;
                    if (!valid6) {
                      const err4 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/Canonical_sourceUpdatedAt_4a76a197/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors2++;
                      validate57.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs16;
                      if (vErrors !== null) {
                        if (_errs16) {
                          vErrors.length = _errs16;
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
                    if (data.citationId !== void 0) {
                      let data5 = data.citationId;
                      const _errs21 = errors2;
                      const _errs22 = errors2;
                      if (errors2 === _errs22) {
                        if (errors2 === _errs22) {
                          if (typeof data5 === "string") {
                            if (!formats0.test(data5)) {
                              validate57.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/$defs/Canonical_citationId_ae4e145b/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate57.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/$defs/Canonical_citationId_ae4e145b/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                      }
                      var valid0 = _errs21 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.scopes !== void 0) {
                        const _errs24 = errors2;
                        if (!validate58(data.scopes, { instancePath: instancePath + "/scopes", parentData: data, parentDataProperty: "scopes", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate58.errors : vErrors.concat(validate58.errors);
                          errors2 = vErrors.length;
                        }
                        var valid0 = _errs24 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.contentSha256 !== void 0) {
                          let data7 = data.contentSha256;
                          const _errs25 = errors2;
                          const _errs26 = errors2;
                          if (errors2 === _errs26) {
                            if (typeof data7 === "string") {
                              if (!pattern12.test(data7)) {
                                validate57.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/$defs/Canonical_contentSha256_6b70d9f7/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate57.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/$defs/Canonical_contentSha256_6b70d9f7/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs25 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.binding !== void 0) {
                            let data8 = data.binding;
                            const _errs28 = errors2;
                            const _errs29 = errors2;
                            if (errors2 === _errs29) {
                              if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                                let missing1;
                                if (data8.tenantId === void 0 && (missing1 = "tenantId") || data8.actorId === void 0 && (missing1 = "actorId") || data8.conversationId === void 0 && (missing1 = "conversationId") || data8.runId === void 0 && (missing1 = "runId") || data8.attemptId === void 0 && (missing1 = "attemptId") || data8.workerId === void 0 && (missing1 = "workerId") || data8.writerFence === void 0 && (missing1 = "writerFence")) {
                                  validate57.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs31 = errors2;
                                  for (const key1 in data8) {
                                    if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                                      validate57.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs31 === errors2) {
                                    if (data8.tenantId !== void 0) {
                                      let data9 = data8.tenantId;
                                      const _errs32 = errors2;
                                      if (errors2 === _errs32) {
                                        if (typeof data9 === "string") {
                                          if (func1(data9) > 128) {
                                            validate57.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data9) < 1) {
                                              validate57.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate57.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid10 = _errs32 === errors2;
                                    } else {
                                      var valid10 = true;
                                    }
                                    if (valid10) {
                                      if (data8.actorId !== void 0) {
                                        let data10 = data8.actorId;
                                        const _errs34 = errors2;
                                        if (errors2 === _errs34) {
                                          if (typeof data10 === "string") {
                                            if (func1(data10) > 128) {
                                              validate57.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func1(data10) < 1) {
                                                validate57.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate57.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid10 = _errs34 === errors2;
                                      } else {
                                        var valid10 = true;
                                      }
                                      if (valid10) {
                                        if (data8.conversationId !== void 0) {
                                          let data11 = data8.conversationId;
                                          const _errs36 = errors2;
                                          if (errors2 === _errs36) {
                                            if (errors2 === _errs36) {
                                              if (typeof data11 === "string") {
                                                if (!formats0.test(data11)) {
                                                  validate57.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate57.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                          }
                                          var valid10 = _errs36 === errors2;
                                        } else {
                                          var valid10 = true;
                                        }
                                        if (valid10) {
                                          if (data8.runId !== void 0) {
                                            let data12 = data8.runId;
                                            const _errs38 = errors2;
                                            if (errors2 === _errs38) {
                                              if (errors2 === _errs38) {
                                                if (typeof data12 === "string") {
                                                  if (!formats0.test(data12)) {
                                                    validate57.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate57.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                            }
                                            var valid10 = _errs38 === errors2;
                                          } else {
                                            var valid10 = true;
                                          }
                                          if (valid10) {
                                            if (data8.attemptId !== void 0) {
                                              let data13 = data8.attemptId;
                                              const _errs40 = errors2;
                                              if (errors2 === _errs40) {
                                                if (errors2 === _errs40) {
                                                  if (typeof data13 === "string") {
                                                    if (!formats0.test(data13)) {
                                                      validate57.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate57.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                              var valid10 = _errs40 === errors2;
                                            } else {
                                              var valid10 = true;
                                            }
                                            if (valid10) {
                                              if (data8.workerId !== void 0) {
                                                let data14 = data8.workerId;
                                                const _errs42 = errors2;
                                                if (errors2 === _errs42) {
                                                  if (errors2 === _errs42) {
                                                    if (typeof data14 === "string") {
                                                      if (!formats0.test(data14)) {
                                                        validate57.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                        return false;
                                                      }
                                                    } else {
                                                      validate57.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                                var valid10 = _errs42 === errors2;
                                              } else {
                                                var valid10 = true;
                                              }
                                              if (valid10) {
                                                if (data8.writerFence !== void 0) {
                                                  let data15 = data8.writerFence;
                                                  const _errs44 = errors2;
                                                  if (!(typeof data15 == "number" && (!(data15 % 1) && !isNaN(data15)) && isFinite(data15))) {
                                                    validate57.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs44) {
                                                    if (typeof data15 == "number" && isFinite(data15)) {
                                                      if (data15 > 9007199254740991 || isNaN(data15)) {
                                                        validate57.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data15 < 1 || isNaN(data15)) {
                                                          validate57.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid10 = _errs44 === errors2;
                                                } else {
                                                  var valid10 = true;
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
                                validate57.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid0 = _errs28 === errors2;
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
      validate57.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate57.errors = vErrors;
  return errors2 === 0;
}
validate57.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate52(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate52.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.artifactId === void 0 && (missing0 = "artifactId") || data.versionId === void 0 && (missing0 = "versionId") || data.parentVersionId === void 0 && (missing0 = "parentVersionId") || data.binding === void 0 && (missing0 = "binding") || data.object === void 0 && (missing0 = "object") || data.filename === void 0 && (missing0 = "filename") || data.mimeType === void 0 && (missing0 = "mimeType") || data.scopes === void 0 && (missing0 = "scopes") || data.evidence === void 0 && (missing0 = "evidence") || data.generationStatus === void 0 && (missing0 = "generationStatus") || data.previewStatus === void 0 && (missing0 = "previewStatus") || data.createdAt === void 0 && (missing0 = "createdAt")) {
        validate52.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func28.call(schema64.properties, key0)) {
            validate52.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.2.0" !== data.contractVersion) {
              validate52.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.artifactId !== void 0) {
              let data1 = data.artifactId;
              const _errs3 = errors2;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (errors2 === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate52.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/$defs/Canonical_artifactId_cc9f299e/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate52.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/$defs/Canonical_artifactId_cc9f299e/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.versionId !== void 0) {
                let data2 = data.versionId;
                const _errs6 = errors2;
                const _errs7 = errors2;
                if (errors2 === _errs7) {
                  if (errors2 === _errs7) {
                    if (typeof data2 === "string") {
                      if (!formats0.test(data2)) {
                        validate52.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/Canonical_versionId_e4470a54/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate52.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/Canonical_versionId_e4470a54/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.parentVersionId !== void 0) {
                  let data3 = data.parentVersionId;
                  const _errs9 = errors2;
                  const _errs11 = errors2;
                  let valid4 = false;
                  const _errs12 = errors2;
                  if (errors2 === _errs12) {
                    if (errors2 === _errs12) {
                      if (typeof data3 === "string") {
                        if (!formats0.test(data3)) {
                          const err0 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/Canonical_parentVersionId_116435a5/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                      } else {
                        const err1 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/Canonical_parentVersionId_116435a5/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors2++;
                      }
                    }
                  }
                  var _valid0 = _errs12 === errors2;
                  valid4 = valid4 || _valid0;
                  const _errs14 = errors2;
                  if (data3 !== null) {
                    const err2 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/Canonical_parentVersionId_116435a5/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors2++;
                  }
                  var _valid0 = _errs14 === errors2;
                  valid4 = valid4 || _valid0;
                  if (!valid4) {
                    const err3 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/Canonical_parentVersionId_116435a5/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                    validate52.errors = vErrors;
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
                  var valid0 = _errs9 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.binding !== void 0) {
                    let data4 = data.binding;
                    const _errs16 = errors2;
                    const _errs17 = errors2;
                    if (errors2 === _errs17) {
                      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                        let missing1;
                        if (data4.tenantId === void 0 && (missing1 = "tenantId") || data4.actorId === void 0 && (missing1 = "actorId") || data4.conversationId === void 0 && (missing1 = "conversationId") || data4.runId === void 0 && (missing1 = "runId") || data4.attemptId === void 0 && (missing1 = "attemptId") || data4.workerId === void 0 && (missing1 = "workerId") || data4.writerFence === void 0 && (missing1 = "writerFence")) {
                          validate52.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_binding_ad882dea/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs19 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate52.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_binding_ad882dea/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs19 === errors2) {
                            if (data4.tenantId !== void 0) {
                              let data5 = data4.tenantId;
                              const _errs20 = errors2;
                              if (errors2 === _errs20) {
                                if (typeof data5 === "string") {
                                  if (func1(data5) > 128) {
                                    validate52.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func1(data5) < 1) {
                                      validate52.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate52.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid6 = _errs20 === errors2;
                            } else {
                              var valid6 = true;
                            }
                            if (valid6) {
                              if (data4.actorId !== void 0) {
                                let data6 = data4.actorId;
                                const _errs22 = errors2;
                                if (errors2 === _errs22) {
                                  if (typeof data6 === "string") {
                                    if (func1(data6) > 128) {
                                      validate52.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func1(data6) < 1) {
                                        validate52.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate52.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid6 = _errs22 === errors2;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data4.conversationId !== void 0) {
                                  let data7 = data4.conversationId;
                                  const _errs24 = errors2;
                                  if (errors2 === _errs24) {
                                    if (errors2 === _errs24) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate52.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate52.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid6 = _errs24 === errors2;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data4.runId !== void 0) {
                                    let data8 = data4.runId;
                                    const _errs26 = errors2;
                                    if (errors2 === _errs26) {
                                      if (errors2 === _errs26) {
                                        if (typeof data8 === "string") {
                                          if (!formats0.test(data8)) {
                                            validate52.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate52.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid6 = _errs26 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data4.attemptId !== void 0) {
                                      let data9 = data4.attemptId;
                                      const _errs28 = errors2;
                                      if (errors2 === _errs28) {
                                        if (errors2 === _errs28) {
                                          if (typeof data9 === "string") {
                                            if (!formats0.test(data9)) {
                                              validate52.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate52.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                      }
                                      var valid6 = _errs28 === errors2;
                                    } else {
                                      var valid6 = true;
                                    }
                                    if (valid6) {
                                      if (data4.workerId !== void 0) {
                                        let data10 = data4.workerId;
                                        const _errs30 = errors2;
                                        if (errors2 === _errs30) {
                                          if (errors2 === _errs30) {
                                            if (typeof data10 === "string") {
                                              if (!formats0.test(data10)) {
                                                validate52.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate52.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                        }
                                        var valid6 = _errs30 === errors2;
                                      } else {
                                        var valid6 = true;
                                      }
                                      if (valid6) {
                                        if (data4.writerFence !== void 0) {
                                          let data11 = data4.writerFence;
                                          const _errs32 = errors2;
                                          if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                            validate52.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs32) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate52.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate52.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_binding_ad882dea/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid6 = _errs32 === errors2;
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
                        validate52.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_binding_ad882dea/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid0 = _errs16 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.object !== void 0) {
                      const _errs34 = errors2;
                      if (!validate53(data.object, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate53.errors : vErrors.concat(validate53.errors);
                        errors2 = vErrors.length;
                      }
                      var valid0 = _errs34 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.filename !== void 0) {
                        let data13 = data.filename;
                        const _errs35 = errors2;
                        const _errs36 = errors2;
                        if (errors2 === _errs36) {
                          if (typeof data13 === "string") {
                            if (func1(data13) > 255) {
                              validate52.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/Canonical_filename_f09421cc/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                              return false;
                            } else {
                              if (func1(data13) < 1) {
                                validate52.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/Canonical_filename_f09421cc/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate52.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/Canonical_filename_f09421cc/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs35 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.mimeType !== void 0) {
                          let data14 = data.mimeType;
                          const _errs38 = errors2;
                          const _errs39 = errors2;
                          if (errors2 === _errs39) {
                            if (typeof data14 === "string") {
                              if (func1(data14) < 1) {
                                validate52.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/$defs/Canonical_mimeType_0837eb6f/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            } else {
                              validate52.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/$defs/Canonical_mimeType_0837eb6f/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs38 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.scopes !== void 0) {
                            const _errs41 = errors2;
                            if (!validate55(data.scopes, { instancePath: instancePath + "/scopes", parentData: data, parentDataProperty: "scopes", rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate55.errors : vErrors.concat(validate55.errors);
                              errors2 = vErrors.length;
                            }
                            var valid0 = _errs41 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.evidence !== void 0) {
                              let data16 = data.evidence;
                              const _errs42 = errors2;
                              if (errors2 === _errs42) {
                                if (Array.isArray(data16)) {
                                  var valid9 = true;
                                  const len0 = data16.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    const _errs44 = errors2;
                                    if (!validate57(data16[i0], { instancePath: instancePath + "/evidence/" + i0, parentData: data16, parentDataProperty: i0, rootData, dynamicAnchors })) {
                                      vErrors = vErrors === null ? validate57.errors : vErrors.concat(validate57.errors);
                                      errors2 = vErrors.length;
                                    }
                                    var valid9 = _errs44 === errors2;
                                    if (!valid9) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate52.errors = [{ instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                  return false;
                                }
                              }
                              var valid0 = _errs42 === errors2;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.generationStatus !== void 0) {
                                let data18 = data.generationStatus;
                                const _errs45 = errors2;
                                if (typeof data18 !== "string") {
                                  validate52.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/$defs/Canonical_generationStatus_0b8d37a9/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                if (!(data18 === "draft" || data18 === "validated" || data18 === "published" || data18 === "failed")) {
                                  validate52.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/$defs/Canonical_generationStatus_0b8d37a9/enum", keyword: "enum", params: { allowedValues: schema86.enum }, message: "must be equal to one of the allowed values" }];
                                  return false;
                                }
                                var valid0 = _errs45 === errors2;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.previewStatus !== void 0) {
                                  let data19 = data.previewStatus;
                                  const _errs48 = errors2;
                                  if (typeof data19 !== "string") {
                                    validate52.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/$defs/Canonical_previewStatus_fe162158/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  if (!(data19 === "pending" || data19 === "validated" || data19 === "unsupported" || data19 === "failed")) {
                                    validate52.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/$defs/Canonical_previewStatus_fe162158/enum", keyword: "enum", params: { allowedValues: schema87.enum }, message: "must be equal to one of the allowed values" }];
                                    return false;
                                  }
                                  var valid0 = _errs48 === errors2;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.createdAt !== void 0) {
                                    let data20 = data.createdAt;
                                    const _errs51 = errors2;
                                    const _errs52 = errors2;
                                    if (errors2 === _errs52) {
                                      if (errors2 === _errs52) {
                                        if (typeof data20 === "string") {
                                          if (!pattern13.test(data20)) {
                                            validate52.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_38444d79/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats16.validate(data20)) {
                                              validate52.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_38444d79/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate52.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_38444d79/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
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
      validate52.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate52.errors = vErrors;
  return errors2 === 0;
}
validate52.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (!validate46(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors2;
  if (!validate52(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate52.errors : vErrors.concat(validate52.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs2 === errors2;
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
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors2++;
    validate45.errors = vErrors;
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
  validate45.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate45.evaluated = { "dynamicProps": true, "dynamicItems": false };
var pattern22 = new RegExp("^[A-Za-z0-9._ -]{1,125}$", "u");
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
  const _errs0 = errors2;
  if (!validate45(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate45.errors : vErrors.concat(validate45.errors);
    errors2 = vErrors.length;
  } else {
    var props0 = validate45.evaluated.props;
  }
  var valid0 = _errs0 === errors2;
  if (valid0) {
    const _errs1 = errors2;
    if (errors2 === _errs1) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.generationStatus !== void 0) {
          const _errs3 = errors2;
          if ("draft" !== data.generationStatus) {
            validate44.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/allOf/1/properties/generationStatus/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
            return false;
          }
          var valid1 = _errs3 === errors2;
        } else {
          var valid1 = true;
        }
        if (valid1) {
          if (data.previewStatus !== void 0) {
            const _errs4 = errors2;
            if ("pending" !== data.previewStatus) {
              validate44.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/allOf/1/properties/previewStatus/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" }];
              return false;
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.filename !== void 0) {
              let data2 = data.filename;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (typeof data2 === "string") {
                  if (!pattern22.test(data2)) {
                    validate44.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/allOf/1/properties/filename/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9._ -]{1,125}$" }, message: 'must match pattern "^[A-Za-z0-9._ -]{1,125}$"' }];
                    return false;
                  }
                } else {
                  validate44.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/allOf/1/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid1 = _errs5 === errors2;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.mimeType !== void 0) {
                let data3 = data.mimeType;
                const _errs7 = errors2;
                if (!(data3 === "text/plain; charset=utf-8" || data3 === "application/xml; charset=utf-8" || data3 === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || data3 === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
                  validate44.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/allOf/1/properties/mimeType/enum", keyword: "enum", params: { allowedValues: schema55.allOf[1].properties.mimeType.enum }, message: "must be equal to one of the allowed values" }];
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
        validate44.errors = [{ instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
      }
    }
    var valid0 = _errs1 === errors2;
    if (valid0) {
      if (props0 !== true) {
        props0 = props0 || {};
        props0.generationStatus = true;
        props0.previewStatus = true;
        props0.filename = true;
        props0.mimeType = true;
      }
    }
  }
  validate44.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate44.evaluated = { "dynamicProps": true, "dynamicItems": false };
var pattern28 = new RegExp("^sdk:[a-f0-9]{64}$", "u");
var pattern30 = new RegExp("^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", "u");
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
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  const _errs2 = errors2;
  if (errors2 === _errs2) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestSha256 === void 0 && (missing0 = "requestSha256") || data.authorizationReceiptId === void 0 && (missing0 = "authorizationReceiptId") || data.budgetTicketId === void 0 && (missing0 = "budgetTicketId") || data.objectCommitted === void 0 && (missing0 = "objectCommitted") || data.versionCommitted === void 0 && (missing0 = "versionCommitted") || data.nativeQualified === void 0 && (missing0 = "nativeQualified")) {
        const err0 = { instancePath, schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors2++;
      } else {
        const _errs4 = errors2;
        for (const key0 in data) {
          if (!(key0 === "requestSha256" || key0 === "authorizationReceiptId" || key0 === "budgetTicketId" || key0 === "objectCommitted" || key0 === "versionCommitted" || key0 === "nativeQualified")) {
            const err1 = { instancePath, schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors2++;
            break;
          }
        }
        if (_errs4 === errors2) {
          if (data.requestSha256 !== void 0) {
            let data0 = data.requestSha256;
            const _errs5 = errors2;
            if (errors2 === _errs5) {
              if (typeof data0 === "string") {
                if (!pattern12.test(data0)) {
                  const err2 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
              } else {
                const err3 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors2++;
              }
            }
            var valid2 = _errs5 === errors2;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.authorizationReceiptId !== void 0) {
              let data1 = data.authorizationReceiptId;
              const _errs7 = errors2;
              if (errors2 === _errs7) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    const err4 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/authorizationReceiptId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                  }
                } else {
                  const err5 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/authorizationReceiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err5];
                  } else {
                    vErrors.push(err5);
                  }
                  errors2++;
                }
              }
              var valid2 = _errs7 === errors2;
            } else {
              var valid2 = true;
            }
            if (valid2) {
              if (data.budgetTicketId !== void 0) {
                let data2 = data.budgetTicketId;
                const _errs9 = errors2;
                if (errors2 === _errs9) {
                  if (typeof data2 === "string") {
                    if (func1(data2) < 1) {
                      const err6 = { instancePath: instancePath + "/budgetTicketId", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/budgetTicketId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                    }
                  } else {
                    const err7 = { instancePath: instancePath + "/budgetTicketId", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/budgetTicketId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                }
                var valid2 = _errs9 === errors2;
              } else {
                var valid2 = true;
              }
              if (valid2) {
                if (data.objectCommitted !== void 0) {
                  const _errs11 = errors2;
                  if (true !== data.objectCommitted) {
                    const err8 = { instancePath: instancePath + "/objectCommitted", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/objectCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err8];
                    } else {
                      vErrors.push(err8);
                    }
                    errors2++;
                  }
                  var valid2 = _errs11 === errors2;
                } else {
                  var valid2 = true;
                }
                if (valid2) {
                  if (data.versionCommitted !== void 0) {
                    const _errs12 = errors2;
                    if (true !== data.versionCommitted) {
                      const err9 = { instancePath: instancePath + "/versionCommitted", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/versionCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err9];
                      } else {
                        vErrors.push(err9);
                      }
                      errors2++;
                    }
                    var valid2 = _errs12 === errors2;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data.nativeQualified !== void 0) {
                      const _errs13 = errors2;
                      if (false !== data.nativeQualified) {
                        const err10 = { instancePath: instancePath + "/nativeQualified", schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/properties/nativeQualified/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err10];
                        } else {
                          vErrors.push(err10);
                        }
                        errors2++;
                      }
                      var valid2 = _errs13 === errors2;
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
      const err11 = { instancePath, schemaPath: "#/$defs/Canonical_LegacyArtifactExecution_4afe1663/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
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
  const _errs14 = errors2;
  const _errs15 = errors2;
  if (errors2 === _errs15) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.kind === void 0 && (missing1 = "kind") || data.invocationId === void 0 && (missing1 = "invocationId") || data.requestSha256 === void 0 && (missing1 = "requestSha256") || data.authorizationReceiptId === void 0 && (missing1 = "authorizationReceiptId") || data.objectCommitted === void 0 && (missing1 = "objectCommitted") || data.versionCommitted === void 0 && (missing1 = "versionCommitted") || data.nativeQualified === void 0 && (missing1 = "nativeQualified")) {
        const err12 = { instancePath, schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors2++;
      } else {
        const _errs17 = errors2;
        for (const key1 in data) {
          if (!(key1 === "kind" || key1 === "invocationId" || key1 === "requestSha256" || key1 === "authorizationReceiptId" || key1 === "objectCommitted" || key1 === "versionCommitted" || key1 === "nativeQualified")) {
            const err13 = { instancePath, schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors2++;
            break;
          }
        }
        if (_errs17 === errors2) {
          if (data.kind !== void 0) {
            const _errs18 = errors2;
            if ("native-document" !== data.kind) {
              const err14 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/kind/const", keyword: "const", params: { allowedValue: "native-document" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors2++;
            }
            var valid4 = _errs18 === errors2;
          } else {
            var valid4 = true;
          }
          if (valid4) {
            if (data.invocationId !== void 0) {
              let data7 = data.invocationId;
              const _errs19 = errors2;
              if (errors2 === _errs19) {
                if (typeof data7 === "string") {
                  if (!pattern28.test(data7)) {
                    const err15 = { instancePath: instancePath + "/invocationId", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/invocationId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                    if (vErrors === null) {
                      vErrors = [err15];
                    } else {
                      vErrors.push(err15);
                    }
                    errors2++;
                  }
                } else {
                  const err16 = { instancePath: instancePath + "/invocationId", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/invocationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors2++;
                }
              }
              var valid4 = _errs19 === errors2;
            } else {
              var valid4 = true;
            }
            if (valid4) {
              if (data.requestSha256 !== void 0) {
                let data8 = data.requestSha256;
                const _errs21 = errors2;
                if (errors2 === _errs21) {
                  if (typeof data8 === "string") {
                    if (!pattern12.test(data8)) {
                      const err17 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                      if (vErrors === null) {
                        vErrors = [err17];
                      } else {
                        vErrors.push(err17);
                      }
                      errors2++;
                    }
                  } else {
                    const err18 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err18];
                    } else {
                      vErrors.push(err18);
                    }
                    errors2++;
                  }
                }
                var valid4 = _errs21 === errors2;
              } else {
                var valid4 = true;
              }
              if (valid4) {
                if (data.authorizationReceiptId !== void 0) {
                  let data9 = data.authorizationReceiptId;
                  const _errs23 = errors2;
                  if (errors2 === _errs23) {
                    if (typeof data9 === "string") {
                      if (!pattern30.test(data9)) {
                        const err19 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/authorizationReceiptId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err19];
                        } else {
                          vErrors.push(err19);
                        }
                        errors2++;
                      }
                    } else {
                      const err20 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/authorizationReceiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err20];
                      } else {
                        vErrors.push(err20);
                      }
                      errors2++;
                    }
                  }
                  var valid4 = _errs23 === errors2;
                } else {
                  var valid4 = true;
                }
                if (valid4) {
                  if (data.objectCommitted !== void 0) {
                    const _errs25 = errors2;
                    if (true !== data.objectCommitted) {
                      const err21 = { instancePath: instancePath + "/objectCommitted", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/objectCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err21];
                      } else {
                        vErrors.push(err21);
                      }
                      errors2++;
                    }
                    var valid4 = _errs25 === errors2;
                  } else {
                    var valid4 = true;
                  }
                  if (valid4) {
                    if (data.versionCommitted !== void 0) {
                      const _errs26 = errors2;
                      if (true !== data.versionCommitted) {
                        const err22 = { instancePath: instancePath + "/versionCommitted", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/versionCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err22];
                        } else {
                          vErrors.push(err22);
                        }
                        errors2++;
                      }
                      var valid4 = _errs26 === errors2;
                    } else {
                      var valid4 = true;
                    }
                    if (valid4) {
                      if (data.nativeQualified !== void 0) {
                        const _errs27 = errors2;
                        if (false !== data.nativeQualified) {
                          const err23 = { instancePath: instancePath + "/nativeQualified", schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/properties/nativeQualified/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                          if (vErrors === null) {
                            vErrors = [err23];
                          } else {
                            vErrors.push(err23);
                          }
                          errors2++;
                        }
                        var valid4 = _errs27 === errors2;
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
      const err24 = { instancePath, schemaPath: "#/$defs/Canonical_NativeArtifactExecution_26204926/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors2++;
    }
  }
  var _valid0 = _errs14 === errors2;
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
    const err25 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors2++;
    validate64.errors = vErrors;
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
  validate64.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate64.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate85(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate85.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.version === void 0 && (missing0 = "version") || data.inspection === void 0 && (missing0 = "inspection") || data.execution === void 0 && (missing0 = "execution")) {
        validate85.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "version" || key0 === "inspection" || key0 === "execution")) {
            validate85.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.version !== void 0) {
            const _errs2 = errors2;
            if (!validate44(data.version, { instancePath: instancePath + "/version", parentData: data, parentDataProperty: "version", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.inspection !== void 0) {
              let data1 = data.inspection;
              const _errs3 = errors2;
              const _errs4 = errors2;
              let valid1 = false;
              let passing0 = null;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sha256 === void 0 && (missing1 = "sha256") || data1.bytes === void 0 && (missing1 = "bytes") || data1.format === void 0 && (missing1 = "format") || data1.nativeOpened === void 0 && (missing1 = "nativeOpened") || data1.rendered === void 0 && (missing1 = "rendered") || data1.recalculated === void 0 && (missing1 = "recalculated") || data1.members === void 0 && (missing1 = "members") || data1.details === void 0 && (missing1 = "details")) {
                    const err0 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "sha256" || key1 === "bytes" || key1 === "format" || key1 === "nativeOpened" || key1 === "rendered" || key1 === "recalculated" || key1 === "members" || key1 === "details")) {
                        const err1 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data2 = data1.sha256;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (!pattern12.test(data2)) {
                              const err2 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/0/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors2++;
                            }
                          } else {
                            const err3 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/0/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.bytes !== void 0) {
                          let data3 = data1.bytes;
                          const _errs10 = errors2;
                          if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                            const err4 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/0/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs10) {
                            if (typeof data3 == "number" && isFinite(data3)) {
                              if (data3 > 9007199254740991 || isNaN(data3)) {
                                const err5 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/0/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err5];
                                } else {
                                  vErrors.push(err5);
                                }
                                errors2++;
                              } else {
                                if (data3 < 0 || isNaN(data3)) {
                                  const err6 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/0/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err6];
                                  } else {
                                    vErrors.push(err6);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.format !== void 0) {
                            const _errs12 = errors2;
                            if ("txt" !== data1.format) {
                              const err7 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/0/properties/format/const", keyword: "const", params: { allowedValue: "txt" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err7];
                              } else {
                                vErrors.push(err7);
                              }
                              errors2++;
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs13 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err8 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/0/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err8];
                                } else {
                                  vErrors.push(err8);
                                }
                                errors2++;
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.rendered !== void 0) {
                                const _errs14 = errors2;
                                if (false !== data1.rendered) {
                                  const err9 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/0/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err9];
                                  } else {
                                    vErrors.push(err9);
                                  }
                                  errors2++;
                                }
                                var valid2 = _errs14 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data1.recalculated !== void 0) {
                                  const _errs15 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err10 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/0/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err10];
                                    } else {
                                      vErrors.push(err10);
                                    }
                                    errors2++;
                                  }
                                  var valid2 = _errs15 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data1.members !== void 0) {
                                    let data8 = data1.members;
                                    const _errs16 = errors2;
                                    if (errors2 === _errs16) {
                                      if (Array.isArray(data8)) {
                                        if (data8.length > 5e3) {
                                          const err11 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/0/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                          if (vErrors === null) {
                                            vErrors = [err11];
                                          } else {
                                            vErrors.push(err11);
                                          }
                                          errors2++;
                                        } else {
                                          var valid3 = true;
                                          const len0 = data8.length;
                                          for (let i0 = 0; i0 < len0; i0++) {
                                            let data9 = data8[i0];
                                            const _errs18 = errors2;
                                            if (errors2 === _errs18) {
                                              if (typeof data9 === "string") {
                                                if (func1(data9) > 500) {
                                                  const err12 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/properties/inspection/oneOf/0/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err12];
                                                  } else {
                                                    vErrors.push(err12);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err13 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/properties/inspection/oneOf/0/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err13];
                                                } else {
                                                  vErrors.push(err13);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid3 = _errs18 === errors2;
                                            if (!valid3) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err14 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/0/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err14];
                                        } else {
                                          vErrors.push(err14);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid2 = _errs16 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data1.details !== void 0) {
                                      let data10 = data1.details;
                                      const _errs20 = errors2;
                                      if (errors2 === _errs20) {
                                        if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                                          let missing2;
                                          if (data10.encoding === void 0 && (missing2 = "encoding") || data10.whitespace === void 0 && (missing2 = "whitespace")) {
                                            const err15 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/0/properties/details/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err15];
                                            } else {
                                              vErrors.push(err15);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs22 = errors2;
                                            for (const key2 in data10) {
                                              if (!(key2 === "encoding" || key2 === "whitespace")) {
                                                const err16 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/0/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err16];
                                                } else {
                                                  vErrors.push(err16);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs22 === errors2) {
                                              if (data10.encoding !== void 0) {
                                                const _errs23 = errors2;
                                                if ("UTF-8" !== data10.encoding) {
                                                  const err17 = { instancePath: instancePath + "/inspection/details/encoding", schemaPath: "#/properties/inspection/oneOf/0/properties/details/properties/encoding/const", keyword: "const", params: { allowedValue: "UTF-8" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err17];
                                                  } else {
                                                    vErrors.push(err17);
                                                  }
                                                  errors2++;
                                                }
                                                var valid4 = _errs23 === errors2;
                                              } else {
                                                var valid4 = true;
                                              }
                                              if (valid4) {
                                                if (data10.whitespace !== void 0) {
                                                  const _errs24 = errors2;
                                                  if ("unchanged" !== data10.whitespace) {
                                                    const err18 = { instancePath: instancePath + "/inspection/details/whitespace", schemaPath: "#/properties/inspection/oneOf/0/properties/details/properties/whitespace/const", keyword: "const", params: { allowedValue: "unchanged" }, message: "must be equal to constant" };
                                                    if (vErrors === null) {
                                                      vErrors = [err18];
                                                    } else {
                                                      vErrors.push(err18);
                                                    }
                                                    errors2++;
                                                  }
                                                  var valid4 = _errs24 === errors2;
                                                } else {
                                                  var valid4 = true;
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err19 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/0/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err19];
                                          } else {
                                            vErrors.push(err19);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid2 = _errs20 === errors2;
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
                  }
                } else {
                  const err20 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err20];
                  } else {
                    vErrors.push(err20);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs5 === errors2;
              if (_valid0) {
                valid1 = true;
                passing0 = 0;
                var props1 = true;
              }
              const _errs25 = errors2;
              if (errors2 === _errs25) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing3;
                  if (data1.sha256 === void 0 && (missing3 = "sha256") || data1.bytes === void 0 && (missing3 = "bytes") || data1.format === void 0 && (missing3 = "format") || data1.nativeOpened === void 0 && (missing3 = "nativeOpened") || data1.rendered === void 0 && (missing3 = "rendered") || data1.recalculated === void 0 && (missing3 = "recalculated") || data1.members === void 0 && (missing3 = "members") || data1.details === void 0 && (missing3 = "details")) {
                    const err21 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                      vErrors = [err21];
                    } else {
                      vErrors.push(err21);
                    }
                    errors2++;
                  } else {
                    const _errs27 = errors2;
                    for (const key3 in data1) {
                      if (!(key3 === "sha256" || key3 === "bytes" || key3 === "format" || key3 === "nativeOpened" || key3 === "rendered" || key3 === "recalculated" || key3 === "members" || key3 === "details")) {
                        const err22 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err22];
                        } else {
                          vErrors.push(err22);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs27 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data13 = data1.sha256;
                        const _errs28 = errors2;
                        if (errors2 === _errs28) {
                          if (typeof data13 === "string") {
                            if (!pattern12.test(data13)) {
                              const err23 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/1/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err23];
                              } else {
                                vErrors.push(err23);
                              }
                              errors2++;
                            }
                          } else {
                            const err24 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/1/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err24];
                            } else {
                              vErrors.push(err24);
                            }
                            errors2++;
                          }
                        }
                        var valid5 = _errs28 === errors2;
                      } else {
                        var valid5 = true;
                      }
                      if (valid5) {
                        if (data1.bytes !== void 0) {
                          let data14 = data1.bytes;
                          const _errs30 = errors2;
                          if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                            const err25 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err25];
                            } else {
                              vErrors.push(err25);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs30) {
                            if (typeof data14 == "number" && isFinite(data14)) {
                              if (data14 > 9007199254740991 || isNaN(data14)) {
                                const err26 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err26];
                                } else {
                                  vErrors.push(err26);
                                }
                                errors2++;
                              } else {
                                if (data14 < 1 || isNaN(data14)) {
                                  const err27 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err27];
                                  } else {
                                    vErrors.push(err27);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                          var valid5 = _errs30 === errors2;
                        } else {
                          var valid5 = true;
                        }
                        if (valid5) {
                          if (data1.format !== void 0) {
                            const _errs32 = errors2;
                            if ("xml" !== data1.format) {
                              const err28 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/1/properties/format/const", keyword: "const", params: { allowedValue: "xml" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err28];
                              } else {
                                vErrors.push(err28);
                              }
                              errors2++;
                            }
                            var valid5 = _errs32 === errors2;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs33 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err29 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/1/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err29];
                                } else {
                                  vErrors.push(err29);
                                }
                                errors2++;
                              }
                              var valid5 = _errs33 === errors2;
                            } else {
                              var valid5 = true;
                            }
                            if (valid5) {
                              if (data1.rendered !== void 0) {
                                const _errs34 = errors2;
                                if (false !== data1.rendered) {
                                  const err30 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/1/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err30];
                                  } else {
                                    vErrors.push(err30);
                                  }
                                  errors2++;
                                }
                                var valid5 = _errs34 === errors2;
                              } else {
                                var valid5 = true;
                              }
                              if (valid5) {
                                if (data1.recalculated !== void 0) {
                                  const _errs35 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err31 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/1/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err31];
                                    } else {
                                      vErrors.push(err31);
                                    }
                                    errors2++;
                                  }
                                  var valid5 = _errs35 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data1.members !== void 0) {
                                    let data19 = data1.members;
                                    const _errs36 = errors2;
                                    if (errors2 === _errs36) {
                                      if (Array.isArray(data19)) {
                                        if (data19.length > 0) {
                                          const err32 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/1/properties/members/maxItems", keyword: "maxItems", params: { limit: 0 }, message: "must NOT have more than 0 items" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                        } else {
                                          var valid6 = true;
                                          const len1 = data19.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            let data20 = data19[i1];
                                            const _errs38 = errors2;
                                            if (errors2 === _errs38) {
                                              if (typeof data20 === "string") {
                                                if (func1(data20) > 500) {
                                                  const err33 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/properties/inspection/oneOf/1/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err33];
                                                  } else {
                                                    vErrors.push(err33);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err34 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/properties/inspection/oneOf/1/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err34];
                                                } else {
                                                  vErrors.push(err34);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid6 = _errs38 === errors2;
                                            if (!valid6) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err35 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/1/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err35];
                                        } else {
                                          vErrors.push(err35);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid5 = _errs36 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data1.details !== void 0) {
                                      let data21 = data1.details;
                                      const _errs40 = errors2;
                                      if (errors2 === _errs40) {
                                        if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
                                          let missing4;
                                          if (data21.encoding === void 0 && (missing4 = "encoding") || data21.whitespace === void 0 && (missing4 = "whitespace") || data21.wellFormed === void 0 && (missing4 = "wellFormed")) {
                                            const err36 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err36];
                                            } else {
                                              vErrors.push(err36);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs42 = errors2;
                                            for (const key4 in data21) {
                                              if (!(key4 === "encoding" || key4 === "whitespace" || key4 === "wellFormed")) {
                                                const err37 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err37];
                                                } else {
                                                  vErrors.push(err37);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs42 === errors2) {
                                              if (data21.encoding !== void 0) {
                                                const _errs43 = errors2;
                                                if ("UTF-8" !== data21.encoding) {
                                                  const err38 = { instancePath: instancePath + "/inspection/details/encoding", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/encoding/const", keyword: "const", params: { allowedValue: "UTF-8" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err38];
                                                  } else {
                                                    vErrors.push(err38);
                                                  }
                                                  errors2++;
                                                }
                                                var valid7 = _errs43 === errors2;
                                              } else {
                                                var valid7 = true;
                                              }
                                              if (valid7) {
                                                if (data21.whitespace !== void 0) {
                                                  const _errs44 = errors2;
                                                  if ("unchanged" !== data21.whitespace) {
                                                    const err39 = { instancePath: instancePath + "/inspection/details/whitespace", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/whitespace/const", keyword: "const", params: { allowedValue: "unchanged" }, message: "must be equal to constant" };
                                                    if (vErrors === null) {
                                                      vErrors = [err39];
                                                    } else {
                                                      vErrors.push(err39);
                                                    }
                                                    errors2++;
                                                  }
                                                  var valid7 = _errs44 === errors2;
                                                } else {
                                                  var valid7 = true;
                                                }
                                                if (valid7) {
                                                  if (data21.wellFormed !== void 0) {
                                                    const _errs45 = errors2;
                                                    if (true !== data21.wellFormed) {
                                                      const err40 = { instancePath: instancePath + "/inspection/details/wellFormed", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/wellFormed/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                      if (vErrors === null) {
                                                        vErrors = [err40];
                                                      } else {
                                                        vErrors.push(err40);
                                                      }
                                                      errors2++;
                                                    }
                                                    var valid7 = _errs45 === errors2;
                                                  } else {
                                                    var valid7 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err41 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err41];
                                          } else {
                                            vErrors.push(err41);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid5 = _errs40 === errors2;
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
                } else {
                  const err42 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
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
                  if (props1 !== true) {
                    props1 = true;
                  }
                }
                const _errs46 = errors2;
                if (errors2 === _errs46) {
                  if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                    let missing5;
                    if (data1.sha256 === void 0 && (missing5 = "sha256") || data1.bytes === void 0 && (missing5 = "bytes") || data1.format === void 0 && (missing5 = "format") || data1.nativeOpened === void 0 && (missing5 = "nativeOpened") || data1.rendered === void 0 && (missing5 = "rendered") || data1.recalculated === void 0 && (missing5 = "recalculated") || data1.members === void 0 && (missing5 = "members") || data1.details === void 0 && (missing5 = "details")) {
                      const err43 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                      if (vErrors === null) {
                        vErrors = [err43];
                      } else {
                        vErrors.push(err43);
                      }
                      errors2++;
                    } else {
                      const _errs48 = errors2;
                      for (const key5 in data1) {
                        if (!(key5 === "sha256" || key5 === "bytes" || key5 === "format" || key5 === "nativeOpened" || key5 === "rendered" || key5 === "recalculated" || key5 === "members" || key5 === "details")) {
                          const err44 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err44];
                          } else {
                            vErrors.push(err44);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs48 === errors2) {
                        if (data1.sha256 !== void 0) {
                          let data25 = data1.sha256;
                          const _errs49 = errors2;
                          if (errors2 === _errs49) {
                            if (typeof data25 === "string") {
                              if (!pattern12.test(data25)) {
                                const err45 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/2/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                if (vErrors === null) {
                                  vErrors = [err45];
                                } else {
                                  vErrors.push(err45);
                                }
                                errors2++;
                              }
                            } else {
                              const err46 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/2/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err46];
                              } else {
                                vErrors.push(err46);
                              }
                              errors2++;
                            }
                          }
                          var valid8 = _errs49 === errors2;
                        } else {
                          var valid8 = true;
                        }
                        if (valid8) {
                          if (data1.bytes !== void 0) {
                            let data26 = data1.bytes;
                            const _errs51 = errors2;
                            if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                              const err47 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err47];
                              } else {
                                vErrors.push(err47);
                              }
                              errors2++;
                            }
                            if (errors2 === _errs51) {
                              if (typeof data26 == "number" && isFinite(data26)) {
                                if (data26 > 9007199254740991 || isNaN(data26)) {
                                  const err48 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                  if (vErrors === null) {
                                    vErrors = [err48];
                                  } else {
                                    vErrors.push(err48);
                                  }
                                  errors2++;
                                } else {
                                  if (data26 < 0 || isNaN(data26)) {
                                    const err49 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                    if (vErrors === null) {
                                      vErrors = [err49];
                                    } else {
                                      vErrors.push(err49);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                            }
                            var valid8 = _errs51 === errors2;
                          } else {
                            var valid8 = true;
                          }
                          if (valid8) {
                            if (data1.format !== void 0) {
                              const _errs53 = errors2;
                              if ("docx" !== data1.format) {
                                const err50 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/2/properties/format/const", keyword: "const", params: { allowedValue: "docx" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err50];
                                } else {
                                  vErrors.push(err50);
                                }
                                errors2++;
                              }
                              var valid8 = _errs53 === errors2;
                            } else {
                              var valid8 = true;
                            }
                            if (valid8) {
                              if (data1.nativeOpened !== void 0) {
                                const _errs54 = errors2;
                                if (false !== data1.nativeOpened) {
                                  const err51 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/2/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err51];
                                  } else {
                                    vErrors.push(err51);
                                  }
                                  errors2++;
                                }
                                var valid8 = _errs54 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data1.rendered !== void 0) {
                                  const _errs55 = errors2;
                                  if (false !== data1.rendered) {
                                    const err52 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/2/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err52];
                                    } else {
                                      vErrors.push(err52);
                                    }
                                    errors2++;
                                  }
                                  var valid8 = _errs55 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data1.recalculated !== void 0) {
                                    const _errs56 = errors2;
                                    if (false !== data1.recalculated) {
                                      const err53 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/2/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err53];
                                      } else {
                                        vErrors.push(err53);
                                      }
                                      errors2++;
                                    }
                                    var valid8 = _errs56 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data1.members !== void 0) {
                                      let data31 = data1.members;
                                      const _errs57 = errors2;
                                      if (errors2 === _errs57) {
                                        if (Array.isArray(data31)) {
                                          if (data31.length > 5e3) {
                                            const err54 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/2/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                            if (vErrors === null) {
                                              vErrors = [err54];
                                            } else {
                                              vErrors.push(err54);
                                            }
                                            errors2++;
                                          } else {
                                            var valid9 = true;
                                            const len2 = data31.length;
                                            for (let i2 = 0; i2 < len2; i2++) {
                                              let data32 = data31[i2];
                                              const _errs59 = errors2;
                                              if (errors2 === _errs59) {
                                                if (typeof data32 === "string") {
                                                  if (func1(data32) > 500) {
                                                    const err55 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/properties/inspection/oneOf/2/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err55];
                                                    } else {
                                                      vErrors.push(err55);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err56 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/properties/inspection/oneOf/2/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err56];
                                                  } else {
                                                    vErrors.push(err56);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid9 = _errs59 === errors2;
                                              if (!valid9) {
                                                break;
                                              }
                                            }
                                          }
                                        } else {
                                          const err57 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/2/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                          if (vErrors === null) {
                                            vErrors = [err57];
                                          } else {
                                            vErrors.push(err57);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid8 = _errs57 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data1.details !== void 0) {
                                        let data33 = data1.details;
                                        const _errs61 = errors2;
                                        if (errors2 === _errs61) {
                                          if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
                                            let missing6;
                                            if (data33.paragraphs === void 0 && (missing6 = "paragraphs") || data33.tables === void 0 && (missing6 = "tables") || data33.pictures === void 0 && (missing6 = "pictures")) {
                                              const err58 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                                              if (vErrors === null) {
                                                vErrors = [err58];
                                              } else {
                                                vErrors.push(err58);
                                              }
                                              errors2++;
                                            } else {
                                              const _errs63 = errors2;
                                              for (const key6 in data33) {
                                                if (!(key6 === "paragraphs" || key6 === "tables" || key6 === "pictures")) {
                                                  const err59 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                                  if (vErrors === null) {
                                                    vErrors = [err59];
                                                  } else {
                                                    vErrors.push(err59);
                                                  }
                                                  errors2++;
                                                  break;
                                                }
                                              }
                                              if (_errs63 === errors2) {
                                                if (data33.paragraphs !== void 0) {
                                                  let data34 = data33.paragraphs;
                                                  const _errs64 = errors2;
                                                  if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                                                    const err60 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/paragraphs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                    if (vErrors === null) {
                                                      vErrors = [err60];
                                                    } else {
                                                      vErrors.push(err60);
                                                    }
                                                    errors2++;
                                                  }
                                                  if (errors2 === _errs64) {
                                                    if (typeof data34 == "number" && isFinite(data34)) {
                                                      if (data34 > 9007199254740991 || isNaN(data34)) {
                                                        const err61 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/paragraphs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                        if (vErrors === null) {
                                                          vErrors = [err61];
                                                        } else {
                                                          vErrors.push(err61);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        if (data34 < 0 || isNaN(data34)) {
                                                          const err62 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/paragraphs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                          if (vErrors === null) {
                                                            vErrors = [err62];
                                                          } else {
                                                            vErrors.push(err62);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid10 = _errs64 === errors2;
                                                } else {
                                                  var valid10 = true;
                                                }
                                                if (valid10) {
                                                  if (data33.tables !== void 0) {
                                                    let data35 = data33.tables;
                                                    const _errs66 = errors2;
                                                    if (!(typeof data35 == "number" && (!(data35 % 1) && !isNaN(data35)) && isFinite(data35))) {
                                                      const err63 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/tables/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err63];
                                                      } else {
                                                        vErrors.push(err63);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs66) {
                                                      if (typeof data35 == "number" && isFinite(data35)) {
                                                        if (data35 > 9007199254740991 || isNaN(data35)) {
                                                          const err64 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/tables/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err64];
                                                          } else {
                                                            vErrors.push(err64);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data35 < 0 || isNaN(data35)) {
                                                            const err65 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/tables/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err65];
                                                            } else {
                                                              vErrors.push(err65);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid10 = _errs66 === errors2;
                                                  } else {
                                                    var valid10 = true;
                                                  }
                                                  if (valid10) {
                                                    if (data33.pictures !== void 0) {
                                                      let data36 = data33.pictures;
                                                      const _errs68 = errors2;
                                                      if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                                        const err66 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/pictures/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err66];
                                                        } else {
                                                          vErrors.push(err66);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs68) {
                                                        if (typeof data36 == "number" && isFinite(data36)) {
                                                          if (data36 > 9007199254740991 || isNaN(data36)) {
                                                            const err67 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/pictures/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err67];
                                                            } else {
                                                              vErrors.push(err67);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data36 < 0 || isNaN(data36)) {
                                                              const err68 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/pictures/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err68];
                                                              } else {
                                                                vErrors.push(err68);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid10 = _errs68 === errors2;
                                                    } else {
                                                      var valid10 = true;
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err69 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                            if (vErrors === null) {
                                              vErrors = [err69];
                                            } else {
                                              vErrors.push(err69);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid8 = _errs61 === errors2;
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
                      }
                    }
                  } else {
                    const err70 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err70];
                    } else {
                      vErrors.push(err70);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs46 === errors2;
                if (_valid0 && valid1) {
                  valid1 = false;
                  passing0 = [passing0, 2];
                } else {
                  if (_valid0) {
                    valid1 = true;
                    passing0 = 2;
                    if (props1 !== true) {
                      props1 = true;
                    }
                  }
                  const _errs70 = errors2;
                  if (errors2 === _errs70) {
                    if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                      let missing7;
                      if (data1.sha256 === void 0 && (missing7 = "sha256") || data1.bytes === void 0 && (missing7 = "bytes") || data1.format === void 0 && (missing7 = "format") || data1.nativeOpened === void 0 && (missing7 = "nativeOpened") || data1.rendered === void 0 && (missing7 = "rendered") || data1.recalculated === void 0 && (missing7 = "recalculated") || data1.members === void 0 && (missing7 = "members") || data1.details === void 0 && (missing7 = "details")) {
                        const err71 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                        if (vErrors === null) {
                          vErrors = [err71];
                        } else {
                          vErrors.push(err71);
                        }
                        errors2++;
                      } else {
                        const _errs72 = errors2;
                        for (const key7 in data1) {
                          if (!(key7 === "sha256" || key7 === "bytes" || key7 === "format" || key7 === "nativeOpened" || key7 === "rendered" || key7 === "recalculated" || key7 === "members" || key7 === "details")) {
                            const err72 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err72];
                            } else {
                              vErrors.push(err72);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs72 === errors2) {
                          if (data1.sha256 !== void 0) {
                            let data37 = data1.sha256;
                            const _errs73 = errors2;
                            if (errors2 === _errs73) {
                              if (typeof data37 === "string") {
                                if (!pattern12.test(data37)) {
                                  const err73 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/3/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err73];
                                  } else {
                                    vErrors.push(err73);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err74 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/3/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err74];
                                } else {
                                  vErrors.push(err74);
                                }
                                errors2++;
                              }
                            }
                            var valid11 = _errs73 === errors2;
                          } else {
                            var valid11 = true;
                          }
                          if (valid11) {
                            if (data1.bytes !== void 0) {
                              let data38 = data1.bytes;
                              const _errs75 = errors2;
                              if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                const err75 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err75];
                                } else {
                                  vErrors.push(err75);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs75) {
                                if (typeof data38 == "number" && isFinite(data38)) {
                                  if (data38 > 9007199254740991 || isNaN(data38)) {
                                    const err76 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err76];
                                    } else {
                                      vErrors.push(err76);
                                    }
                                    errors2++;
                                  } else {
                                    if (data38 < 0 || isNaN(data38)) {
                                      const err77 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                      if (vErrors === null) {
                                        vErrors = [err77];
                                      } else {
                                        vErrors.push(err77);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid11 = _errs75 === errors2;
                            } else {
                              var valid11 = true;
                            }
                            if (valid11) {
                              if (data1.format !== void 0) {
                                const _errs77 = errors2;
                                if ("xlsx" !== data1.format) {
                                  const err78 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/3/properties/format/const", keyword: "const", params: { allowedValue: "xlsx" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err78];
                                  } else {
                                    vErrors.push(err78);
                                  }
                                  errors2++;
                                }
                                var valid11 = _errs77 === errors2;
                              } else {
                                var valid11 = true;
                              }
                              if (valid11) {
                                if (data1.nativeOpened !== void 0) {
                                  const _errs78 = errors2;
                                  if (false !== data1.nativeOpened) {
                                    const err79 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/3/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err79];
                                    } else {
                                      vErrors.push(err79);
                                    }
                                    errors2++;
                                  }
                                  var valid11 = _errs78 === errors2;
                                } else {
                                  var valid11 = true;
                                }
                                if (valid11) {
                                  if (data1.rendered !== void 0) {
                                    const _errs79 = errors2;
                                    if (false !== data1.rendered) {
                                      const err80 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/3/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err80];
                                      } else {
                                        vErrors.push(err80);
                                      }
                                      errors2++;
                                    }
                                    var valid11 = _errs79 === errors2;
                                  } else {
                                    var valid11 = true;
                                  }
                                  if (valid11) {
                                    if (data1.recalculated !== void 0) {
                                      const _errs80 = errors2;
                                      if (false !== data1.recalculated) {
                                        const err81 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/3/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err81];
                                        } else {
                                          vErrors.push(err81);
                                        }
                                        errors2++;
                                      }
                                      var valid11 = _errs80 === errors2;
                                    } else {
                                      var valid11 = true;
                                    }
                                    if (valid11) {
                                      if (data1.members !== void 0) {
                                        let data43 = data1.members;
                                        const _errs81 = errors2;
                                        if (errors2 === _errs81) {
                                          if (Array.isArray(data43)) {
                                            if (data43.length > 5e3) {
                                              const err82 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/3/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                              if (vErrors === null) {
                                                vErrors = [err82];
                                              } else {
                                                vErrors.push(err82);
                                              }
                                              errors2++;
                                            } else {
                                              var valid12 = true;
                                              const len3 = data43.length;
                                              for (let i3 = 0; i3 < len3; i3++) {
                                                let data44 = data43[i3];
                                                const _errs83 = errors2;
                                                if (errors2 === _errs83) {
                                                  if (typeof data44 === "string") {
                                                    if (func1(data44) > 500) {
                                                      const err83 = { instancePath: instancePath + "/inspection/members/" + i3, schemaPath: "#/properties/inspection/oneOf/3/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err83];
                                                      } else {
                                                        vErrors.push(err83);
                                                      }
                                                      errors2++;
                                                    }
                                                  } else {
                                                    const err84 = { instancePath: instancePath + "/inspection/members/" + i3, schemaPath: "#/properties/inspection/oneOf/3/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err84];
                                                    } else {
                                                      vErrors.push(err84);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid12 = _errs83 === errors2;
                                                if (!valid12) {
                                                  break;
                                                }
                                              }
                                            }
                                          } else {
                                            const err85 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/3/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                            if (vErrors === null) {
                                              vErrors = [err85];
                                            } else {
                                              vErrors.push(err85);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid11 = _errs81 === errors2;
                                      } else {
                                        var valid11 = true;
                                      }
                                      if (valid11) {
                                        if (data1.details !== void 0) {
                                          let data45 = data1.details;
                                          const _errs85 = errors2;
                                          if (errors2 === _errs85) {
                                            if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
                                              let missing8;
                                              if (data45.sheets === void 0 && (missing8 = "sheets") || data45.formulas === void 0 && (missing8 = "formulas") || data45.formulaCache === void 0 && (missing8 = "formulaCache")) {
                                                const err86 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                                if (vErrors === null) {
                                                  vErrors = [err86];
                                                } else {
                                                  vErrors.push(err86);
                                                }
                                                errors2++;
                                              } else {
                                                const _errs87 = errors2;
                                                for (const key8 in data45) {
                                                  if (!(key8 === "sheets" || key8 === "formulas" || key8 === "formulaCache" || key8 === "revisionMethod")) {
                                                    const err87 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                                    if (vErrors === null) {
                                                      vErrors = [err87];
                                                    } else {
                                                      vErrors.push(err87);
                                                    }
                                                    errors2++;
                                                    break;
                                                  }
                                                }
                                                if (_errs87 === errors2) {
                                                  if (data45.sheets !== void 0) {
                                                    let data46 = data45.sheets;
                                                    const _errs88 = errors2;
                                                    if (errors2 === _errs88) {
                                                      if (Array.isArray(data46)) {
                                                        if (data46.length > 30) {
                                                          const err88 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/sheets/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
                                                          if (vErrors === null) {
                                                            vErrors = [err88];
                                                          } else {
                                                            vErrors.push(err88);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          var valid14 = true;
                                                          const len4 = data46.length;
                                                          for (let i4 = 0; i4 < len4; i4++) {
                                                            const _errs90 = errors2;
                                                            if (typeof data46[i4] !== "string") {
                                                              const err89 = { instancePath: instancePath + "/inspection/details/sheets/" + i4, schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/sheets/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                              if (vErrors === null) {
                                                                vErrors = [err89];
                                                              } else {
                                                                vErrors.push(err89);
                                                              }
                                                              errors2++;
                                                            }
                                                            var valid14 = _errs90 === errors2;
                                                            if (!valid14) {
                                                              break;
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        const err90 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/sheets/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                        if (vErrors === null) {
                                                          vErrors = [err90];
                                                        } else {
                                                          vErrors.push(err90);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid13 = _errs88 === errors2;
                                                  } else {
                                                    var valid13 = true;
                                                  }
                                                  if (valid13) {
                                                    if (data45.formulas !== void 0) {
                                                      let data48 = data45.formulas;
                                                      const _errs92 = errors2;
                                                      if (!(typeof data48 == "number" && (!(data48 % 1) && !isNaN(data48)) && isFinite(data48))) {
                                                        const err91 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/formulas/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err91];
                                                        } else {
                                                          vErrors.push(err91);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs92) {
                                                        if (typeof data48 == "number" && isFinite(data48)) {
                                                          if (data48 > 9007199254740991 || isNaN(data48)) {
                                                            const err92 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/formulas/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err92];
                                                            } else {
                                                              vErrors.push(err92);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data48 < 0 || isNaN(data48)) {
                                                              const err93 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/formulas/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err93];
                                                              } else {
                                                                vErrors.push(err93);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid13 = _errs92 === errors2;
                                                    } else {
                                                      var valid13 = true;
                                                    }
                                                    if (valid13) {
                                                      if (data45.formulaCache !== void 0) {
                                                        let data49 = data45.formulaCache;
                                                        const _errs94 = errors2;
                                                        if (!(data49 === "unverified-zero-placeholder; recalculation required" || data49 === "removed/unverified; recalculation required")) {
                                                          const err94 = { instancePath: instancePath + "/inspection/details/formulaCache", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/formulaCache/enum", keyword: "enum", params: { allowedValues: schema54.properties.inspection.oneOf[3].properties.details.properties.formulaCache.enum }, message: "must be equal to one of the allowed values" };
                                                          if (vErrors === null) {
                                                            vErrors = [err94];
                                                          } else {
                                                            vErrors.push(err94);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid13 = _errs94 === errors2;
                                                      } else {
                                                        var valid13 = true;
                                                      }
                                                      if (valid13) {
                                                        if (data45.revisionMethod !== void 0) {
                                                          const _errs95 = errors2;
                                                          if ("openpyxl typed-cell replacement" !== data45.revisionMethod) {
                                                            const err95 = { instancePath: instancePath + "/inspection/details/revisionMethod", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/revisionMethod/const", keyword: "const", params: { allowedValue: "openpyxl typed-cell replacement" }, message: "must be equal to constant" };
                                                            if (vErrors === null) {
                                                              vErrors = [err95];
                                                            } else {
                                                              vErrors.push(err95);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid13 = _errs95 === errors2;
                                                        } else {
                                                          var valid13 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              const err96 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                              if (vErrors === null) {
                                                vErrors = [err96];
                                              } else {
                                                vErrors.push(err96);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid11 = _errs85 === errors2;
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
                      }
                    } else {
                      const err97 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err97];
                      } else {
                        vErrors.push(err97);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs70 === errors2;
                  if (_valid0 && valid1) {
                    valid1 = false;
                    passing0 = [passing0, 3];
                  } else {
                    if (_valid0) {
                      valid1 = true;
                      passing0 = 3;
                      if (props1 !== true) {
                        props1 = true;
                      }
                    }
                  }
                }
              }
              if (!valid1) {
                const err98 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                if (vErrors === null) {
                  vErrors = [err98];
                } else {
                  vErrors.push(err98);
                }
                errors2++;
                validate85.errors = vErrors;
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
              if (data.execution !== void 0) {
                const _errs96 = errors2;
                if (!validate64(data.execution, { instancePath: instancePath + "/execution", parentData: data, parentDataProperty: "execution", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate64.errors : vErrors.concat(validate64.errors);
                  errors2 = vErrors.length;
                }
                var valid0 = _errs96 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate85.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate85.errors = vErrors;
  return errors2 === 0;
}
validate85.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateInspection = validate88;
var schema93 = { "oneOf": [{ "type": "object", "properties": { "version": { "$ref": "#/$defs/DocumentVersion" }, "inspection": { "oneOf": [{ "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "txt" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" } }, "required": ["encoding", "whitespace"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "format": { "const": "xml" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 0 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" }, "wellFormed": { "const": true } }, "required": ["encoding", "whitespace", "wellFormed"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "docx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "paragraphs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "tables": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "pictures": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["paragraphs", "tables", "pictures"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "xlsx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "sheets": { "type": "array", "items": { "type": "string" }, "maxItems": 30 }, "formulas": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "formulaCache": { "enum": ["unverified-zero-placeholder; recalculation required", "removed/unverified; recalculation required"] }, "revisionMethod": { "const": "openpyxl typed-cell replacement" } }, "required": ["sheets", "formulas", "formulaCache"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }] } }, "required": ["version", "inspection"], "additionalProperties": false }, { "type": "object", "properties": { "kind": { "const": "native-file" }, "version": { "$ref": "#/$defs/NativeArtifactFileMetadata" }, "integrity": { "$ref": "#/$defs/Canonical_integrity_52ed1e31" } }, "required": ["kind", "version", "integrity"], "additionalProperties": false }] };
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
    if (Array.isArray(data)) {
      if (data.length < 1) {
        validate72.errors = [{ instancePath, schemaPath: "#/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
        return false;
      } else {
        var valid0 = true;
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data0 = data[i0];
          const _errs1 = errors2;
          const _errs2 = errors2;
          if (errors2 === _errs2) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              let missing0;
              if (data0.tenantId === void 0 && (missing0 = "tenantId") || data0.kind === void 0 && (missing0 = "kind") || data0.resourceId === void 0 && (missing0 = "resourceId") || data0.policyRevision === void 0 && (missing0 = "policyRevision")) {
                validate72.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
                return false;
              } else {
                const _errs4 = errors2;
                for (const key0 in data0) {
                  if (!(key0 === "tenantId" || key0 === "kind" || key0 === "resourceId" || key0 === "policyRevision")) {
                    validate72.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                  }
                }
                if (_errs4 === errors2) {
                  if (data0.tenantId !== void 0) {
                    let data1 = data0.tenantId;
                    const _errs5 = errors2;
                    if (errors2 === _errs5) {
                      if (typeof data1 === "string") {
                        if (func1(data1) > 128) {
                          validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                          return false;
                        } else {
                          if (func1(data1) < 1) {
                            validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                            return false;
                          }
                        }
                      } else {
                        validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid2 = _errs5 === errors2;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data0.kind !== void 0) {
                      let data2 = data0.kind;
                      const _errs7 = errors2;
                      if (typeof data2 !== "string") {
                        validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data2 === "tenant" || data2 === "client" || data2 === "mailbox" || data2 === "memory" || data2 === "document" || data2 === "private-user" || data2 === "public")) {
                        validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema60.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid2 = _errs7 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.resourceId !== void 0) {
                        let data3 = data0.resourceId;
                        const _errs9 = errors2;
                        if (errors2 === _errs9) {
                          if (typeof data3 === "string") {
                            if (func1(data3) > 256) {
                              validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                              return false;
                            } else {
                              if (func1(data3) < 1) {
                                validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs9 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.policyRevision !== void 0) {
                          let data4 = data0.policyRevision;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data4 === "string") {
                              if (func1(data4) > 128) {
                                validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data4) < 1) {
                                  validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate72.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs11 === errors2;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              validate72.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
              return false;
            }
          }
          var valid0 = _errs1 === errors2;
          if (!valid0) {
            break;
          }
        }
        if (valid0) {
          let i1 = data.length;
          let j0;
          if (i1 > 1) {
            outer0: for (; i1--; ) {
              for (j0 = i1; j0--; ) {
                if (func0(data[i1], data[j0])) {
                  validate72.errors = [{ instancePath, schemaPath: "#/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                  return false;
                  break outer0;
                }
              }
            }
          }
        }
      }
    } else {
      validate72.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
      return false;
    }
  }
  validate72.errors = vErrors;
  return errors2 === 0;
}
validate72.evaluated = { "items": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.versionId === void 0 && (missing0 = "versionId") || data.binding === void 0 && (missing0 = "binding") || data.manifestId === void 0 && (missing0 = "manifestId") || data.path === void 0 && (missing0 = "path") || data.object === void 0 && (missing0 = "object") || data.scopes === void 0 && (missing0 = "scopes") || data.createdAt === void 0 && (missing0 = "createdAt")) {
        validate70.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId" || key0 === "binding" || key0 === "manifestId" || key0 === "path" || key0 === "object" || key0 === "scopes" || key0 === "createdAt")) {
            validate70.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.versionId !== void 0) {
            let data0 = data.versionId;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (errors2 === _errs3) {
                if (typeof data0 === "string") {
                  if (!formats0.test(data0)) {
                    validate70.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/Canonical_objectId_9e74be34/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate70.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/Canonical_objectId_9e74be34/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.binding !== void 0) {
              let data1 = data.binding;
              const _errs5 = errors2;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.tenantId === void 0 && (missing1 = "tenantId") || data1.actorId === void 0 && (missing1 = "actorId") || data1.conversationId === void 0 && (missing1 = "conversationId") || data1.runId === void 0 && (missing1 = "runId") || data1.attemptId === void 0 && (missing1 = "attemptId") || data1.workerId === void 0 && (missing1 = "workerId") || data1.writerFence === void 0 && (missing1 = "writerFence")) {
                    validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs8 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                        validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs8 === errors2) {
                      if (data1.tenantId !== void 0) {
                        let data2 = data1.tenantId;
                        const _errs9 = errors2;
                        if (errors2 === _errs9) {
                          if (typeof data2 === "string") {
                            if (func1(data2) > 128) {
                              validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func1(data2) < 1) {
                                validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate70.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid3 = _errs9 === errors2;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.actorId !== void 0) {
                          let data3 = data1.actorId;
                          const _errs11 = errors2;
                          if (errors2 === _errs11) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 128) {
                                validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate70.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data1.conversationId !== void 0) {
                            let data4 = data1.conversationId;
                            const _errs13 = errors2;
                            if (errors2 === _errs13) {
                              if (errors2 === _errs13) {
                                if (typeof data4 === "string") {
                                  if (!formats0.test(data4)) {
                                    validate70.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate70.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data1.runId !== void 0) {
                              let data5 = data1.runId;
                              const _errs15 = errors2;
                              if (errors2 === _errs15) {
                                if (errors2 === _errs15) {
                                  if (typeof data5 === "string") {
                                    if (!formats0.test(data5)) {
                                      validate70.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate70.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                              }
                              var valid3 = _errs15 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data1.attemptId !== void 0) {
                                let data6 = data1.attemptId;
                                const _errs17 = errors2;
                                if (errors2 === _errs17) {
                                  if (errors2 === _errs17) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.test(data6)) {
                                        validate70.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate70.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid3 = _errs17 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data1.workerId !== void 0) {
                                  let data7 = data1.workerId;
                                  const _errs19 = errors2;
                                  if (errors2 === _errs19) {
                                    if (errors2 === _errs19) {
                                      if (typeof data7 === "string") {
                                        if (!formats0.test(data7)) {
                                          validate70.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate70.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                  }
                                  var valid3 = _errs19 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data1.writerFence !== void 0) {
                                    let data8 = data1.writerFence;
                                    const _errs21 = errors2;
                                    if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                      validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs21) {
                                      if (typeof data8 == "number" && isFinite(data8)) {
                                        if (data8 > 9007199254740991 || isNaN(data8)) {
                                          validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data8 < 1 || isNaN(data8)) {
                                            validate70.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid3 = _errs21 === errors2;
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
                  validate70.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.manifestId !== void 0) {
                let data9 = data.manifestId;
                const _errs23 = errors2;
                const _errs24 = errors2;
                if (errors2 === _errs24) {
                  if (errors2 === _errs24) {
                    if (typeof data9 === "string") {
                      if (!formats0.test(data9)) {
                        validate70.errors = [{ instancePath: instancePath + "/manifestId", schemaPath: "#/$defs/Canonical_manifestId_d0d1dc64/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate70.errors = [{ instancePath: instancePath + "/manifestId", schemaPath: "#/$defs/Canonical_manifestId_d0d1dc64/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs23 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.path !== void 0) {
                  let data10 = data.path;
                  const _errs26 = errors2;
                  const _errs27 = errors2;
                  if (errors2 === _errs27) {
                    if (typeof data10 === "string") {
                      if (func1(data10) > 4096) {
                        validate70.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/$defs/Canonical_path_79796d02/maxLength", keyword: "maxLength", params: { limit: 4096 }, message: "must NOT have more than 4096 characters" }];
                        return false;
                      } else {
                        if (func1(data10) < 1) {
                          validate70.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/$defs/Canonical_path_79796d02/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                          return false;
                        }
                      }
                    } else {
                      validate70.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/$defs/Canonical_path_79796d02/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs26 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.object !== void 0) {
                    let data11 = data.object;
                    const _errs29 = errors2;
                    const _errs30 = errors2;
                    if (!validate47(data11, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
                      errors2 = vErrors.length;
                    }
                    var valid6 = _errs30 === errors2;
                    if (valid6) {
                      const _errs31 = errors2;
                      if (errors2 === _errs31) {
                        if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
                          if (data11.bytes !== void 0) {
                            let data12 = data11.bytes;
                            const _errs33 = errors2;
                            if (!(typeof data12 == "number" && (!(data12 % 1) && !isNaN(data12)) && isFinite(data12))) {
                              validate70.errors = [{ instancePath: instancePath + "/object/bytes", schemaPath: "#/properties/object/allOf/1/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors2 === _errs33) {
                              if (typeof data12 == "number" && isFinite(data12)) {
                                if (data12 > 8388608 || isNaN(data12)) {
                                  validate70.errors = [{ instancePath: instancePath + "/object/bytes", schemaPath: "#/properties/object/allOf/1/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 8388608 }, message: "must be <= 8388608" }];
                                  return false;
                                }
                              }
                            }
                          }
                        } else {
                          validate70.errors = [{ instancePath: instancePath + "/object", schemaPath: "#/properties/object/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid6 = _errs31 === errors2;
                    }
                    var valid0 = _errs29 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.scopes !== void 0) {
                      const _errs35 = errors2;
                      if (!validate72(data.scopes, { instancePath: instancePath + "/scopes", parentData: data, parentDataProperty: "scopes", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate72.errors : vErrors.concat(validate72.errors);
                        errors2 = vErrors.length;
                      }
                      var valid0 = _errs35 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.createdAt !== void 0) {
                        let data14 = data.createdAt;
                        const _errs36 = errors2;
                        const _errs37 = errors2;
                        if (errors2 === _errs37) {
                          if (errors2 === _errs37) {
                            if (typeof data14 === "string") {
                              if (!pattern13.test(data14)) {
                                validate70.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_ede7c864/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                return false;
                              } else {
                                if (!formats16.validate(data14)) {
                                  validate70.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_ede7c864/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                  return false;
                                }
                              }
                            } else {
                              validate70.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/Canonical_createdAt_ede7c864/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                        }
                        var valid0 = _errs36 === errors2;
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
      validate70.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate70.errors = vErrors;
  return errors2 === 0;
}
validate70.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate75(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate75.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.currentBytesVerified === void 0 && (missing0 = "currentBytesVerified")) {
        validate75.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sha256" || key0 === "bytes" || key0 === "currentBytesVerified")) {
            validate75.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sha256 !== void 0) {
            let data0 = data.sha256;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (typeof data0 === "string") {
                if (!pattern12.test(data0)) {
                  validate75.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/$defs/Canonical_sha256_a23d638d/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                  return false;
                }
              } else {
                validate75.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/$defs/Canonical_sha256_a23d638d/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.bytes !== void 0) {
              let data1 = data.bytes;
              const _errs5 = errors2;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
                validate75.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                return false;
              }
              if (errors2 === _errs5) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 8388608 || isNaN(data1)) {
                    validate75.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 8388608 }, message: "must be <= 8388608" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate75.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
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
              if (data.currentBytesVerified !== void 0) {
                const _errs7 = errors2;
                if (true !== data.currentBytesVerified) {
                  validate75.errors = [{ instancePath: instancePath + "/currentBytesVerified", schemaPath: "#/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs7 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate75.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate75.errors = vErrors;
  return errors2 === 0;
}
validate75.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate88(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate88.evaluated;
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
      if (data.version === void 0 && (missing0 = "version") || data.inspection === void 0 && (missing0 = "inspection")) {
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
          if (!(key0 === "version" || key0 === "inspection")) {
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
          if (data.version !== void 0) {
            const _errs4 = errors2;
            if (!validate44(data.version, { instancePath: instancePath + "/version", parentData: data, parentDataProperty: "version", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
              errors2 = vErrors.length;
            }
            var valid1 = _errs4 === errors2;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.inspection !== void 0) {
              let data1 = data.inspection;
              const _errs5 = errors2;
              const _errs6 = errors2;
              let valid2 = false;
              let passing1 = null;
              const _errs7 = errors2;
              if (errors2 === _errs7) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sha256 === void 0 && (missing1 = "sha256") || data1.bytes === void 0 && (missing1 = "bytes") || data1.format === void 0 && (missing1 = "format") || data1.nativeOpened === void 0 && (missing1 = "nativeOpened") || data1.rendered === void 0 && (missing1 = "rendered") || data1.recalculated === void 0 && (missing1 = "recalculated") || data1.members === void 0 && (missing1 = "members") || data1.details === void 0 && (missing1 = "details") || data1.currentBytesVerified === void 0 && (missing1 = "currentBytesVerified")) {
                    const err2 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors2++;
                  } else {
                    const _errs9 = errors2;
                    for (const key1 in data1) {
                      if (!func28.call(schema93.oneOf[0].properties.inspection.oneOf[0].properties, key1)) {
                        const err3 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs9 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data2 = data1.sha256;
                        const _errs10 = errors2;
                        if (errors2 === _errs10) {
                          if (typeof data2 === "string") {
                            if (!pattern12.test(data2)) {
                              const err4 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            }
                          } else {
                            const err5 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors2++;
                          }
                        }
                        var valid3 = _errs10 === errors2;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.bytes !== void 0) {
                          let data3 = data1.bytes;
                          const _errs12 = errors2;
                          if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                            const err6 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err6];
                            } else {
                              vErrors.push(err6);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs12) {
                            if (typeof data3 == "number" && isFinite(data3)) {
                              if (data3 > 9007199254740991 || isNaN(data3)) {
                                const err7 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err7];
                                } else {
                                  vErrors.push(err7);
                                }
                                errors2++;
                              } else {
                                if (data3 < 0 || isNaN(data3)) {
                                  const err8 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err8];
                                  } else {
                                    vErrors.push(err8);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                          var valid3 = _errs12 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data1.format !== void 0) {
                            const _errs14 = errors2;
                            if ("txt" !== data1.format) {
                              const err9 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/format/const", keyword: "const", params: { allowedValue: "txt" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors2++;
                            }
                            var valid3 = _errs14 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs15 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err10 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err10];
                                } else {
                                  vErrors.push(err10);
                                }
                                errors2++;
                              }
                              var valid3 = _errs15 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data1.rendered !== void 0) {
                                const _errs16 = errors2;
                                if (false !== data1.rendered) {
                                  const err11 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err11];
                                  } else {
                                    vErrors.push(err11);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs16 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data1.recalculated !== void 0) {
                                  const _errs17 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err12 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err12];
                                    } else {
                                      vErrors.push(err12);
                                    }
                                    errors2++;
                                  }
                                  var valid3 = _errs17 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data1.members !== void 0) {
                                    let data8 = data1.members;
                                    const _errs18 = errors2;
                                    if (errors2 === _errs18) {
                                      if (Array.isArray(data8)) {
                                        if (data8.length > 5e3) {
                                          const err13 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                          if (vErrors === null) {
                                            vErrors = [err13];
                                          } else {
                                            vErrors.push(err13);
                                          }
                                          errors2++;
                                        } else {
                                          var valid4 = true;
                                          const len0 = data8.length;
                                          for (let i0 = 0; i0 < len0; i0++) {
                                            let data9 = data8[i0];
                                            const _errs20 = errors2;
                                            if (errors2 === _errs20) {
                                              if (typeof data9 === "string") {
                                                if (func1(data9) > 500) {
                                                  const err14 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err14];
                                                  } else {
                                                    vErrors.push(err14);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err15 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err15];
                                                } else {
                                                  vErrors.push(err15);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid4 = _errs20 === errors2;
                                            if (!valid4) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err16 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err16];
                                        } else {
                                          vErrors.push(err16);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid3 = _errs18 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data1.details !== void 0) {
                                      let data10 = data1.details;
                                      const _errs22 = errors2;
                                      if (errors2 === _errs22) {
                                        if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                                          let missing2;
                                          if (data10.encoding === void 0 && (missing2 = "encoding") || data10.whitespace === void 0 && (missing2 = "whitespace")) {
                                            const err17 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/details/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err17];
                                            } else {
                                              vErrors.push(err17);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs24 = errors2;
                                            for (const key2 in data10) {
                                              if (!(key2 === "encoding" || key2 === "whitespace")) {
                                                const err18 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err18];
                                                } else {
                                                  vErrors.push(err18);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs24 === errors2) {
                                              if (data10.encoding !== void 0) {
                                                const _errs25 = errors2;
                                                if ("UTF-8" !== data10.encoding) {
                                                  const err19 = { instancePath: instancePath + "/inspection/details/encoding", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/details/properties/encoding/const", keyword: "const", params: { allowedValue: "UTF-8" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err19];
                                                  } else {
                                                    vErrors.push(err19);
                                                  }
                                                  errors2++;
                                                }
                                                var valid5 = _errs25 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data10.whitespace !== void 0) {
                                                  const _errs26 = errors2;
                                                  if ("unchanged" !== data10.whitespace) {
                                                    const err20 = { instancePath: instancePath + "/inspection/details/whitespace", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/details/properties/whitespace/const", keyword: "const", params: { allowedValue: "unchanged" }, message: "must be equal to constant" };
                                                    if (vErrors === null) {
                                                      vErrors = [err20];
                                                    } else {
                                                      vErrors.push(err20);
                                                    }
                                                    errors2++;
                                                  }
                                                  var valid5 = _errs26 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err21 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err21];
                                          } else {
                                            vErrors.push(err21);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid3 = _errs22 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data1.currentBytesVerified !== void 0) {
                                        const _errs27 = errors2;
                                        if (true !== data1.currentBytesVerified) {
                                          const err22 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err22];
                                          } else {
                                            vErrors.push(err22);
                                          }
                                          errors2++;
                                        }
                                        var valid3 = _errs27 === errors2;
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
                    }
                  }
                } else {
                  const err23 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors2++;
                }
              }
              var _valid1 = _errs7 === errors2;
              if (_valid1) {
                valid2 = true;
                passing1 = 0;
                var props1 = true;
              }
              const _errs28 = errors2;
              if (errors2 === _errs28) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing3;
                  if (data1.sha256 === void 0 && (missing3 = "sha256") || data1.bytes === void 0 && (missing3 = "bytes") || data1.format === void 0 && (missing3 = "format") || data1.nativeOpened === void 0 && (missing3 = "nativeOpened") || data1.rendered === void 0 && (missing3 = "rendered") || data1.recalculated === void 0 && (missing3 = "recalculated") || data1.members === void 0 && (missing3 = "members") || data1.details === void 0 && (missing3 = "details") || data1.currentBytesVerified === void 0 && (missing3 = "currentBytesVerified")) {
                    const err24 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                      vErrors = [err24];
                    } else {
                      vErrors.push(err24);
                    }
                    errors2++;
                  } else {
                    const _errs30 = errors2;
                    for (const key3 in data1) {
                      if (!func28.call(schema93.oneOf[0].properties.inspection.oneOf[1].properties, key3)) {
                        const err25 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err25];
                        } else {
                          vErrors.push(err25);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs30 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data14 = data1.sha256;
                        const _errs31 = errors2;
                        if (errors2 === _errs31) {
                          if (typeof data14 === "string") {
                            if (!pattern12.test(data14)) {
                              const err26 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err26];
                              } else {
                                vErrors.push(err26);
                              }
                              errors2++;
                            }
                          } else {
                            const err27 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err27];
                            } else {
                              vErrors.push(err27);
                            }
                            errors2++;
                          }
                        }
                        var valid6 = _errs31 === errors2;
                      } else {
                        var valid6 = true;
                      }
                      if (valid6) {
                        if (data1.bytes !== void 0) {
                          let data15 = data1.bytes;
                          const _errs33 = errors2;
                          if (!(typeof data15 == "number" && (!(data15 % 1) && !isNaN(data15)) && isFinite(data15))) {
                            const err28 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err28];
                            } else {
                              vErrors.push(err28);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs33) {
                            if (typeof data15 == "number" && isFinite(data15)) {
                              if (data15 > 9007199254740991 || isNaN(data15)) {
                                const err29 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err29];
                                } else {
                                  vErrors.push(err29);
                                }
                                errors2++;
                              } else {
                                if (data15 < 1 || isNaN(data15)) {
                                  const err30 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err30];
                                  } else {
                                    vErrors.push(err30);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                          var valid6 = _errs33 === errors2;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data1.format !== void 0) {
                            const _errs35 = errors2;
                            if ("xml" !== data1.format) {
                              const err31 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/format/const", keyword: "const", params: { allowedValue: "xml" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err31];
                              } else {
                                vErrors.push(err31);
                              }
                              errors2++;
                            }
                            var valid6 = _errs35 === errors2;
                          } else {
                            var valid6 = true;
                          }
                          if (valid6) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs36 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err32 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err32];
                                } else {
                                  vErrors.push(err32);
                                }
                                errors2++;
                              }
                              var valid6 = _errs36 === errors2;
                            } else {
                              var valid6 = true;
                            }
                            if (valid6) {
                              if (data1.rendered !== void 0) {
                                const _errs37 = errors2;
                                if (false !== data1.rendered) {
                                  const err33 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err33];
                                  } else {
                                    vErrors.push(err33);
                                  }
                                  errors2++;
                                }
                                var valid6 = _errs37 === errors2;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data1.recalculated !== void 0) {
                                  const _errs38 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err34 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err34];
                                    } else {
                                      vErrors.push(err34);
                                    }
                                    errors2++;
                                  }
                                  var valid6 = _errs38 === errors2;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data1.members !== void 0) {
                                    let data20 = data1.members;
                                    const _errs39 = errors2;
                                    if (errors2 === _errs39) {
                                      if (Array.isArray(data20)) {
                                        if (data20.length > 0) {
                                          const err35 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/members/maxItems", keyword: "maxItems", params: { limit: 0 }, message: "must NOT have more than 0 items" };
                                          if (vErrors === null) {
                                            vErrors = [err35];
                                          } else {
                                            vErrors.push(err35);
                                          }
                                          errors2++;
                                        } else {
                                          var valid7 = true;
                                          const len1 = data20.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            let data21 = data20[i1];
                                            const _errs41 = errors2;
                                            if (errors2 === _errs41) {
                                              if (typeof data21 === "string") {
                                                if (func1(data21) > 500) {
                                                  const err36 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err36];
                                                  } else {
                                                    vErrors.push(err36);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err37 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err37];
                                                } else {
                                                  vErrors.push(err37);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid7 = _errs41 === errors2;
                                            if (!valid7) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err38 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err38];
                                        } else {
                                          vErrors.push(err38);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid6 = _errs39 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data1.details !== void 0) {
                                      let data22 = data1.details;
                                      const _errs43 = errors2;
                                      if (errors2 === _errs43) {
                                        if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                                          let missing4;
                                          if (data22.encoding === void 0 && (missing4 = "encoding") || data22.whitespace === void 0 && (missing4 = "whitespace") || data22.wellFormed === void 0 && (missing4 = "wellFormed")) {
                                            const err39 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err39];
                                            } else {
                                              vErrors.push(err39);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs45 = errors2;
                                            for (const key4 in data22) {
                                              if (!(key4 === "encoding" || key4 === "whitespace" || key4 === "wellFormed")) {
                                                const err40 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err40];
                                                } else {
                                                  vErrors.push(err40);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs45 === errors2) {
                                              if (data22.encoding !== void 0) {
                                                const _errs46 = errors2;
                                                if ("UTF-8" !== data22.encoding) {
                                                  const err41 = { instancePath: instancePath + "/inspection/details/encoding", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/properties/encoding/const", keyword: "const", params: { allowedValue: "UTF-8" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err41];
                                                  } else {
                                                    vErrors.push(err41);
                                                  }
                                                  errors2++;
                                                }
                                                var valid8 = _errs46 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                              if (valid8) {
                                                if (data22.whitespace !== void 0) {
                                                  const _errs47 = errors2;
                                                  if ("unchanged" !== data22.whitespace) {
                                                    const err42 = { instancePath: instancePath + "/inspection/details/whitespace", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/properties/whitespace/const", keyword: "const", params: { allowedValue: "unchanged" }, message: "must be equal to constant" };
                                                    if (vErrors === null) {
                                                      vErrors = [err42];
                                                    } else {
                                                      vErrors.push(err42);
                                                    }
                                                    errors2++;
                                                  }
                                                  var valid8 = _errs47 === errors2;
                                                } else {
                                                  var valid8 = true;
                                                }
                                                if (valid8) {
                                                  if (data22.wellFormed !== void 0) {
                                                    const _errs48 = errors2;
                                                    if (true !== data22.wellFormed) {
                                                      const err43 = { instancePath: instancePath + "/inspection/details/wellFormed", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/properties/wellFormed/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                      if (vErrors === null) {
                                                        vErrors = [err43];
                                                      } else {
                                                        vErrors.push(err43);
                                                      }
                                                      errors2++;
                                                    }
                                                    var valid8 = _errs48 === errors2;
                                                  } else {
                                                    var valid8 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err44 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err44];
                                          } else {
                                            vErrors.push(err44);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid6 = _errs43 === errors2;
                                    } else {
                                      var valid6 = true;
                                    }
                                    if (valid6) {
                                      if (data1.currentBytesVerified !== void 0) {
                                        const _errs49 = errors2;
                                        if (true !== data1.currentBytesVerified) {
                                          const err45 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err45];
                                          } else {
                                            vErrors.push(err45);
                                          }
                                          errors2++;
                                        }
                                        var valid6 = _errs49 === errors2;
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
                    }
                  }
                } else {
                  const err46 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err46];
                  } else {
                    vErrors.push(err46);
                  }
                  errors2++;
                }
              }
              var _valid1 = _errs28 === errors2;
              if (_valid1 && valid2) {
                valid2 = false;
                passing1 = [passing1, 1];
              } else {
                if (_valid1) {
                  valid2 = true;
                  passing1 = 1;
                  if (props1 !== true) {
                    props1 = true;
                  }
                }
                const _errs50 = errors2;
                if (errors2 === _errs50) {
                  if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                    let missing5;
                    if (data1.sha256 === void 0 && (missing5 = "sha256") || data1.bytes === void 0 && (missing5 = "bytes") || data1.format === void 0 && (missing5 = "format") || data1.nativeOpened === void 0 && (missing5 = "nativeOpened") || data1.rendered === void 0 && (missing5 = "rendered") || data1.recalculated === void 0 && (missing5 = "recalculated") || data1.members === void 0 && (missing5 = "members") || data1.details === void 0 && (missing5 = "details") || data1.currentBytesVerified === void 0 && (missing5 = "currentBytesVerified")) {
                      const err47 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                      if (vErrors === null) {
                        vErrors = [err47];
                      } else {
                        vErrors.push(err47);
                      }
                      errors2++;
                    } else {
                      const _errs52 = errors2;
                      for (const key5 in data1) {
                        if (!func28.call(schema93.oneOf[0].properties.inspection.oneOf[2].properties, key5)) {
                          const err48 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err48];
                          } else {
                            vErrors.push(err48);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs52 === errors2) {
                        if (data1.sha256 !== void 0) {
                          let data27 = data1.sha256;
                          const _errs53 = errors2;
                          if (errors2 === _errs53) {
                            if (typeof data27 === "string") {
                              if (!pattern12.test(data27)) {
                                const err49 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                if (vErrors === null) {
                                  vErrors = [err49];
                                } else {
                                  vErrors.push(err49);
                                }
                                errors2++;
                              }
                            } else {
                              const err50 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err50];
                              } else {
                                vErrors.push(err50);
                              }
                              errors2++;
                            }
                          }
                          var valid9 = _errs53 === errors2;
                        } else {
                          var valid9 = true;
                        }
                        if (valid9) {
                          if (data1.bytes !== void 0) {
                            let data28 = data1.bytes;
                            const _errs55 = errors2;
                            if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                              const err51 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err51];
                              } else {
                                vErrors.push(err51);
                              }
                              errors2++;
                            }
                            if (errors2 === _errs55) {
                              if (typeof data28 == "number" && isFinite(data28)) {
                                if (data28 > 9007199254740991 || isNaN(data28)) {
                                  const err52 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                  if (vErrors === null) {
                                    vErrors = [err52];
                                  } else {
                                    vErrors.push(err52);
                                  }
                                  errors2++;
                                } else {
                                  if (data28 < 0 || isNaN(data28)) {
                                    const err53 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                    if (vErrors === null) {
                                      vErrors = [err53];
                                    } else {
                                      vErrors.push(err53);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                            }
                            var valid9 = _errs55 === errors2;
                          } else {
                            var valid9 = true;
                          }
                          if (valid9) {
                            if (data1.format !== void 0) {
                              const _errs57 = errors2;
                              if ("docx" !== data1.format) {
                                const err54 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/format/const", keyword: "const", params: { allowedValue: "docx" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err54];
                                } else {
                                  vErrors.push(err54);
                                }
                                errors2++;
                              }
                              var valid9 = _errs57 === errors2;
                            } else {
                              var valid9 = true;
                            }
                            if (valid9) {
                              if (data1.nativeOpened !== void 0) {
                                const _errs58 = errors2;
                                if (false !== data1.nativeOpened) {
                                  const err55 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err55];
                                  } else {
                                    vErrors.push(err55);
                                  }
                                  errors2++;
                                }
                                var valid9 = _errs58 === errors2;
                              } else {
                                var valid9 = true;
                              }
                              if (valid9) {
                                if (data1.rendered !== void 0) {
                                  const _errs59 = errors2;
                                  if (false !== data1.rendered) {
                                    const err56 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err56];
                                    } else {
                                      vErrors.push(err56);
                                    }
                                    errors2++;
                                  }
                                  var valid9 = _errs59 === errors2;
                                } else {
                                  var valid9 = true;
                                }
                                if (valid9) {
                                  if (data1.recalculated !== void 0) {
                                    const _errs60 = errors2;
                                    if (false !== data1.recalculated) {
                                      const err57 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err57];
                                      } else {
                                        vErrors.push(err57);
                                      }
                                      errors2++;
                                    }
                                    var valid9 = _errs60 === errors2;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data1.members !== void 0) {
                                      let data33 = data1.members;
                                      const _errs61 = errors2;
                                      if (errors2 === _errs61) {
                                        if (Array.isArray(data33)) {
                                          if (data33.length > 5e3) {
                                            const err58 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                            if (vErrors === null) {
                                              vErrors = [err58];
                                            } else {
                                              vErrors.push(err58);
                                            }
                                            errors2++;
                                          } else {
                                            var valid10 = true;
                                            const len2 = data33.length;
                                            for (let i2 = 0; i2 < len2; i2++) {
                                              let data34 = data33[i2];
                                              const _errs63 = errors2;
                                              if (errors2 === _errs63) {
                                                if (typeof data34 === "string") {
                                                  if (func1(data34) > 500) {
                                                    const err59 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err59];
                                                    } else {
                                                      vErrors.push(err59);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err60 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err60];
                                                  } else {
                                                    vErrors.push(err60);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid10 = _errs63 === errors2;
                                              if (!valid10) {
                                                break;
                                              }
                                            }
                                          }
                                        } else {
                                          const err61 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                          if (vErrors === null) {
                                            vErrors = [err61];
                                          } else {
                                            vErrors.push(err61);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid9 = _errs61 === errors2;
                                    } else {
                                      var valid9 = true;
                                    }
                                    if (valid9) {
                                      if (data1.details !== void 0) {
                                        let data35 = data1.details;
                                        const _errs65 = errors2;
                                        if (errors2 === _errs65) {
                                          if (data35 && typeof data35 == "object" && !Array.isArray(data35)) {
                                            let missing6;
                                            if (data35.paragraphs === void 0 && (missing6 = "paragraphs") || data35.tables === void 0 && (missing6 = "tables") || data35.pictures === void 0 && (missing6 = "pictures")) {
                                              const err62 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                                              if (vErrors === null) {
                                                vErrors = [err62];
                                              } else {
                                                vErrors.push(err62);
                                              }
                                              errors2++;
                                            } else {
                                              const _errs67 = errors2;
                                              for (const key6 in data35) {
                                                if (!(key6 === "paragraphs" || key6 === "tables" || key6 === "pictures")) {
                                                  const err63 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                                  if (vErrors === null) {
                                                    vErrors = [err63];
                                                  } else {
                                                    vErrors.push(err63);
                                                  }
                                                  errors2++;
                                                  break;
                                                }
                                              }
                                              if (_errs67 === errors2) {
                                                if (data35.paragraphs !== void 0) {
                                                  let data36 = data35.paragraphs;
                                                  const _errs68 = errors2;
                                                  if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                                    const err64 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/paragraphs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                    if (vErrors === null) {
                                                      vErrors = [err64];
                                                    } else {
                                                      vErrors.push(err64);
                                                    }
                                                    errors2++;
                                                  }
                                                  if (errors2 === _errs68) {
                                                    if (typeof data36 == "number" && isFinite(data36)) {
                                                      if (data36 > 9007199254740991 || isNaN(data36)) {
                                                        const err65 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/paragraphs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                        if (vErrors === null) {
                                                          vErrors = [err65];
                                                        } else {
                                                          vErrors.push(err65);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        if (data36 < 0 || isNaN(data36)) {
                                                          const err66 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/paragraphs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                          if (vErrors === null) {
                                                            vErrors = [err66];
                                                          } else {
                                                            vErrors.push(err66);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid11 = _errs68 === errors2;
                                                } else {
                                                  var valid11 = true;
                                                }
                                                if (valid11) {
                                                  if (data35.tables !== void 0) {
                                                    let data37 = data35.tables;
                                                    const _errs70 = errors2;
                                                    if (!(typeof data37 == "number" && (!(data37 % 1) && !isNaN(data37)) && isFinite(data37))) {
                                                      const err67 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/tables/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err67];
                                                      } else {
                                                        vErrors.push(err67);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs70) {
                                                      if (typeof data37 == "number" && isFinite(data37)) {
                                                        if (data37 > 9007199254740991 || isNaN(data37)) {
                                                          const err68 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/tables/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err68];
                                                          } else {
                                                            vErrors.push(err68);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data37 < 0 || isNaN(data37)) {
                                                            const err69 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/tables/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err69];
                                                            } else {
                                                              vErrors.push(err69);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid11 = _errs70 === errors2;
                                                  } else {
                                                    var valid11 = true;
                                                  }
                                                  if (valid11) {
                                                    if (data35.pictures !== void 0) {
                                                      let data38 = data35.pictures;
                                                      const _errs72 = errors2;
                                                      if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                                        const err70 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/pictures/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err70];
                                                        } else {
                                                          vErrors.push(err70);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs72) {
                                                        if (typeof data38 == "number" && isFinite(data38)) {
                                                          if (data38 > 9007199254740991 || isNaN(data38)) {
                                                            const err71 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/pictures/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err71];
                                                            } else {
                                                              vErrors.push(err71);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data38 < 0 || isNaN(data38)) {
                                                              const err72 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/properties/pictures/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err72];
                                                              } else {
                                                                vErrors.push(err72);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid11 = _errs72 === errors2;
                                                    } else {
                                                      var valid11 = true;
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err73 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                            if (vErrors === null) {
                                              vErrors = [err73];
                                            } else {
                                              vErrors.push(err73);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid9 = _errs65 === errors2;
                                      } else {
                                        var valid9 = true;
                                      }
                                      if (valid9) {
                                        if (data1.currentBytesVerified !== void 0) {
                                          const _errs74 = errors2;
                                          if (true !== data1.currentBytesVerified) {
                                            const err74 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                            if (vErrors === null) {
                                              vErrors = [err74];
                                            } else {
                                              vErrors.push(err74);
                                            }
                                            errors2++;
                                          }
                                          var valid9 = _errs74 === errors2;
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
                      }
                    }
                  } else {
                    const err75 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err75];
                    } else {
                      vErrors.push(err75);
                    }
                    errors2++;
                  }
                }
                var _valid1 = _errs50 === errors2;
                if (_valid1 && valid2) {
                  valid2 = false;
                  passing1 = [passing1, 2];
                } else {
                  if (_valid1) {
                    valid2 = true;
                    passing1 = 2;
                    if (props1 !== true) {
                      props1 = true;
                    }
                  }
                  const _errs75 = errors2;
                  if (errors2 === _errs75) {
                    if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                      let missing7;
                      if (data1.sha256 === void 0 && (missing7 = "sha256") || data1.bytes === void 0 && (missing7 = "bytes") || data1.format === void 0 && (missing7 = "format") || data1.nativeOpened === void 0 && (missing7 = "nativeOpened") || data1.rendered === void 0 && (missing7 = "rendered") || data1.recalculated === void 0 && (missing7 = "recalculated") || data1.members === void 0 && (missing7 = "members") || data1.details === void 0 && (missing7 = "details") || data1.currentBytesVerified === void 0 && (missing7 = "currentBytesVerified")) {
                        const err76 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                        if (vErrors === null) {
                          vErrors = [err76];
                        } else {
                          vErrors.push(err76);
                        }
                        errors2++;
                      } else {
                        const _errs77 = errors2;
                        for (const key7 in data1) {
                          if (!func28.call(schema93.oneOf[0].properties.inspection.oneOf[3].properties, key7)) {
                            const err77 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err77];
                            } else {
                              vErrors.push(err77);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs77 === errors2) {
                          if (data1.sha256 !== void 0) {
                            let data40 = data1.sha256;
                            const _errs78 = errors2;
                            if (errors2 === _errs78) {
                              if (typeof data40 === "string") {
                                if (!pattern12.test(data40)) {
                                  const err78 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err78];
                                  } else {
                                    vErrors.push(err78);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err79 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err79];
                                } else {
                                  vErrors.push(err79);
                                }
                                errors2++;
                              }
                            }
                            var valid12 = _errs78 === errors2;
                          } else {
                            var valid12 = true;
                          }
                          if (valid12) {
                            if (data1.bytes !== void 0) {
                              let data41 = data1.bytes;
                              const _errs80 = errors2;
                              if (!(typeof data41 == "number" && (!(data41 % 1) && !isNaN(data41)) && isFinite(data41))) {
                                const err80 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err80];
                                } else {
                                  vErrors.push(err80);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs80) {
                                if (typeof data41 == "number" && isFinite(data41)) {
                                  if (data41 > 9007199254740991 || isNaN(data41)) {
                                    const err81 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err81];
                                    } else {
                                      vErrors.push(err81);
                                    }
                                    errors2++;
                                  } else {
                                    if (data41 < 0 || isNaN(data41)) {
                                      const err82 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                      if (vErrors === null) {
                                        vErrors = [err82];
                                      } else {
                                        vErrors.push(err82);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid12 = _errs80 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data1.format !== void 0) {
                                const _errs82 = errors2;
                                if ("xlsx" !== data1.format) {
                                  const err83 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/format/const", keyword: "const", params: { allowedValue: "xlsx" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err83];
                                  } else {
                                    vErrors.push(err83);
                                  }
                                  errors2++;
                                }
                                var valid12 = _errs82 === errors2;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data1.nativeOpened !== void 0) {
                                  const _errs83 = errors2;
                                  if (false !== data1.nativeOpened) {
                                    const err84 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err84];
                                    } else {
                                      vErrors.push(err84);
                                    }
                                    errors2++;
                                  }
                                  var valid12 = _errs83 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                                if (valid12) {
                                  if (data1.rendered !== void 0) {
                                    const _errs84 = errors2;
                                    if (false !== data1.rendered) {
                                      const err85 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err85];
                                      } else {
                                        vErrors.push(err85);
                                      }
                                      errors2++;
                                    }
                                    var valid12 = _errs84 === errors2;
                                  } else {
                                    var valid12 = true;
                                  }
                                  if (valid12) {
                                    if (data1.recalculated !== void 0) {
                                      const _errs85 = errors2;
                                      if (false !== data1.recalculated) {
                                        const err86 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err86];
                                        } else {
                                          vErrors.push(err86);
                                        }
                                        errors2++;
                                      }
                                      var valid12 = _errs85 === errors2;
                                    } else {
                                      var valid12 = true;
                                    }
                                    if (valid12) {
                                      if (data1.members !== void 0) {
                                        let data46 = data1.members;
                                        const _errs86 = errors2;
                                        if (errors2 === _errs86) {
                                          if (Array.isArray(data46)) {
                                            if (data46.length > 5e3) {
                                              const err87 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                              if (vErrors === null) {
                                                vErrors = [err87];
                                              } else {
                                                vErrors.push(err87);
                                              }
                                              errors2++;
                                            } else {
                                              var valid13 = true;
                                              const len3 = data46.length;
                                              for (let i3 = 0; i3 < len3; i3++) {
                                                let data47 = data46[i3];
                                                const _errs88 = errors2;
                                                if (errors2 === _errs88) {
                                                  if (typeof data47 === "string") {
                                                    if (func1(data47) > 500) {
                                                      const err88 = { instancePath: instancePath + "/inspection/members/" + i3, schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err88];
                                                      } else {
                                                        vErrors.push(err88);
                                                      }
                                                      errors2++;
                                                    }
                                                  } else {
                                                    const err89 = { instancePath: instancePath + "/inspection/members/" + i3, schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err89];
                                                    } else {
                                                      vErrors.push(err89);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid13 = _errs88 === errors2;
                                                if (!valid13) {
                                                  break;
                                                }
                                              }
                                            }
                                          } else {
                                            const err90 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                            if (vErrors === null) {
                                              vErrors = [err90];
                                            } else {
                                              vErrors.push(err90);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid12 = _errs86 === errors2;
                                      } else {
                                        var valid12 = true;
                                      }
                                      if (valid12) {
                                        if (data1.details !== void 0) {
                                          let data48 = data1.details;
                                          const _errs90 = errors2;
                                          if (errors2 === _errs90) {
                                            if (data48 && typeof data48 == "object" && !Array.isArray(data48)) {
                                              let missing8;
                                              if (data48.sheets === void 0 && (missing8 = "sheets") || data48.formulas === void 0 && (missing8 = "formulas") || data48.formulaCache === void 0 && (missing8 = "formulaCache")) {
                                                const err91 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                                if (vErrors === null) {
                                                  vErrors = [err91];
                                                } else {
                                                  vErrors.push(err91);
                                                }
                                                errors2++;
                                              } else {
                                                const _errs92 = errors2;
                                                for (const key8 in data48) {
                                                  if (!(key8 === "sheets" || key8 === "formulas" || key8 === "formulaCache" || key8 === "revisionMethod")) {
                                                    const err92 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                                    if (vErrors === null) {
                                                      vErrors = [err92];
                                                    } else {
                                                      vErrors.push(err92);
                                                    }
                                                    errors2++;
                                                    break;
                                                  }
                                                }
                                                if (_errs92 === errors2) {
                                                  if (data48.sheets !== void 0) {
                                                    let data49 = data48.sheets;
                                                    const _errs93 = errors2;
                                                    if (errors2 === _errs93) {
                                                      if (Array.isArray(data49)) {
                                                        if (data49.length > 30) {
                                                          const err93 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/sheets/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
                                                          if (vErrors === null) {
                                                            vErrors = [err93];
                                                          } else {
                                                            vErrors.push(err93);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          var valid15 = true;
                                                          const len4 = data49.length;
                                                          for (let i4 = 0; i4 < len4; i4++) {
                                                            const _errs95 = errors2;
                                                            if (typeof data49[i4] !== "string") {
                                                              const err94 = { instancePath: instancePath + "/inspection/details/sheets/" + i4, schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/sheets/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                              if (vErrors === null) {
                                                                vErrors = [err94];
                                                              } else {
                                                                vErrors.push(err94);
                                                              }
                                                              errors2++;
                                                            }
                                                            var valid15 = _errs95 === errors2;
                                                            if (!valid15) {
                                                              break;
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        const err95 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/sheets/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                        if (vErrors === null) {
                                                          vErrors = [err95];
                                                        } else {
                                                          vErrors.push(err95);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid14 = _errs93 === errors2;
                                                  } else {
                                                    var valid14 = true;
                                                  }
                                                  if (valid14) {
                                                    if (data48.formulas !== void 0) {
                                                      let data51 = data48.formulas;
                                                      const _errs97 = errors2;
                                                      if (!(typeof data51 == "number" && (!(data51 % 1) && !isNaN(data51)) && isFinite(data51))) {
                                                        const err96 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/formulas/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err96];
                                                        } else {
                                                          vErrors.push(err96);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs97) {
                                                        if (typeof data51 == "number" && isFinite(data51)) {
                                                          if (data51 > 9007199254740991 || isNaN(data51)) {
                                                            const err97 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/formulas/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err97];
                                                            } else {
                                                              vErrors.push(err97);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data51 < 0 || isNaN(data51)) {
                                                              const err98 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/formulas/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err98];
                                                              } else {
                                                                vErrors.push(err98);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid14 = _errs97 === errors2;
                                                    } else {
                                                      var valid14 = true;
                                                    }
                                                    if (valid14) {
                                                      if (data48.formulaCache !== void 0) {
                                                        let data52 = data48.formulaCache;
                                                        const _errs99 = errors2;
                                                        if (!(data52 === "unverified-zero-placeholder; recalculation required" || data52 === "removed/unverified; recalculation required")) {
                                                          const err99 = { instancePath: instancePath + "/inspection/details/formulaCache", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/formulaCache/enum", keyword: "enum", params: { allowedValues: schema93.oneOf[0].properties.inspection.oneOf[3].properties.details.properties.formulaCache.enum }, message: "must be equal to one of the allowed values" };
                                                          if (vErrors === null) {
                                                            vErrors = [err99];
                                                          } else {
                                                            vErrors.push(err99);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid14 = _errs99 === errors2;
                                                      } else {
                                                        var valid14 = true;
                                                      }
                                                      if (valid14) {
                                                        if (data48.revisionMethod !== void 0) {
                                                          const _errs100 = errors2;
                                                          if ("openpyxl typed-cell replacement" !== data48.revisionMethod) {
                                                            const err100 = { instancePath: instancePath + "/inspection/details/revisionMethod", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/properties/revisionMethod/const", keyword: "const", params: { allowedValue: "openpyxl typed-cell replacement" }, message: "must be equal to constant" };
                                                            if (vErrors === null) {
                                                              vErrors = [err100];
                                                            } else {
                                                              vErrors.push(err100);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid14 = _errs100 === errors2;
                                                        } else {
                                                          var valid14 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              const err101 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                              if (vErrors === null) {
                                                vErrors = [err101];
                                              } else {
                                                vErrors.push(err101);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid12 = _errs90 === errors2;
                                        } else {
                                          var valid12 = true;
                                        }
                                        if (valid12) {
                                          if (data1.currentBytesVerified !== void 0) {
                                            const _errs101 = errors2;
                                            if (true !== data1.currentBytesVerified) {
                                              const err102 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            }
                                            var valid12 = _errs101 === errors2;
                                          } else {
                                            var valid12 = true;
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
                      const err103 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err103];
                      } else {
                        vErrors.push(err103);
                      }
                      errors2++;
                    }
                  }
                  var _valid1 = _errs75 === errors2;
                  if (_valid1 && valid2) {
                    valid2 = false;
                    passing1 = [passing1, 3];
                  } else {
                    if (_valid1) {
                      valid2 = true;
                      passing1 = 3;
                      if (props1 !== true) {
                        props1 = true;
                      }
                    }
                  }
                }
              }
              if (!valid2) {
                const err104 = { instancePath: instancePath + "/inspection", schemaPath: "#/oneOf/0/properties/inspection/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                if (vErrors === null) {
                  vErrors = [err104];
                } else {
                  vErrors.push(err104);
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
      const err105 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err105];
      } else {
        vErrors.push(err105);
      }
      errors2++;
    }
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props2 = true;
  }
  const _errs102 = errors2;
  if (errors2 === _errs102) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing9;
      if (data.kind === void 0 && (missing9 = "kind") || data.version === void 0 && (missing9 = "version") || data.integrity === void 0 && (missing9 = "integrity")) {
        const err106 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
        if (vErrors === null) {
          vErrors = [err106];
        } else {
          vErrors.push(err106);
        }
        errors2++;
      } else {
        const _errs104 = errors2;
        for (const key9 in data) {
          if (!(key9 === "kind" || key9 === "version" || key9 === "integrity")) {
            const err107 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err107];
            } else {
              vErrors.push(err107);
            }
            errors2++;
            break;
          }
        }
        if (_errs104 === errors2) {
          if (data.kind !== void 0) {
            const _errs105 = errors2;
            if ("native-file" !== data.kind) {
              const err108 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "native-file" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err108];
              } else {
                vErrors.push(err108);
              }
              errors2++;
            }
            var valid16 = _errs105 === errors2;
          } else {
            var valid16 = true;
          }
          if (valid16) {
            if (data.version !== void 0) {
              const _errs106 = errors2;
              if (!validate70(data.version, { instancePath: instancePath + "/version", parentData: data, parentDataProperty: "version", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate70.errors : vErrors.concat(validate70.errors);
                errors2 = vErrors.length;
              }
              var valid16 = _errs106 === errors2;
            } else {
              var valid16 = true;
            }
            if (valid16) {
              if (data.integrity !== void 0) {
                const _errs107 = errors2;
                if (!validate75(data.integrity, { instancePath: instancePath + "/integrity", parentData: data, parentDataProperty: "integrity", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate75.errors : vErrors.concat(validate75.errors);
                  errors2 = vErrors.length;
                }
                var valid16 = _errs107 === errors2;
              } else {
                var valid16 = true;
              }
            }
          }
        }
      }
    } else {
      const err109 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err109];
      } else {
        vErrors.push(err109);
      }
      errors2++;
    }
  }
  var _valid0 = _errs102 === errors2;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props2 !== true) {
        props2 = true;
      }
    }
  }
  if (!valid0) {
    const err110 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err110];
    } else {
      vErrors.push(err110);
    }
    errors2++;
    validate88.errors = vErrors;
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
  validate88.errors = vErrors;
  evaluated0.props = props2;
  return errors2 === 0;
}
validate88.evaluated = { "dynamicProps": true, "dynamicItems": false };
var validateError = validate92;
var schema105 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["ACCESS_DENIED", "ARTIFACT_BUDGET_RESERVATION_UNKNOWN", "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN", "ARTIFACT_CANCELLED", "ARTIFACT_DEADLINE", "ARTIFACT_EFFECT_UNKNOWN", "ARTIFACT_PREVIEW_PENDING", "ARTIFACT_PREVIEW_UNSUPPORTED", "ARTIFACT_RENDERER_UNAVAILABLE", "ARTIFACT_STALE_PARENT", "CANCELLED", "CONFLICT", "DEADLINE", "DOCUMENT_CLOCK", "DOCUMENT_CONFIGURATION", "DOCUMENT_REFUSED", "DOCUMENT_RESPONSE_LIMIT", "DOCUMENT_RESULT_REFUSED", "INVALID_BODY", "INVALID_CONTENT_LENGTH", "INVALID_JSON", "INVALID_REQUEST", "METHOD_NOT_ALLOWED", "NOT_FOUND", "PREVIEW_UNAVAILABLE", "REQUEST_FAILED", "REQUEST_TOO_LARGE", "SESSION_REFUSED", "UNAUTHENTICATED", "UNAVAILABLE", "UNSUPPORTED_DOCUMENT_FORMAT", "UNSUPPORTED_MEDIA_TYPE"] }, "outcome": { "enum": ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED", "READ_UNAVAILABLE"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate92(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate92.evaluated;
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
        validate92.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate92.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate92.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate92.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (!(data1 === "ACCESS_DENIED" || data1 === "ARTIFACT_BUDGET_RESERVATION_UNKNOWN" || data1 === "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN" || data1 === "ARTIFACT_CANCELLED" || data1 === "ARTIFACT_DEADLINE" || data1 === "ARTIFACT_EFFECT_UNKNOWN" || data1 === "ARTIFACT_PREVIEW_PENDING" || data1 === "ARTIFACT_PREVIEW_UNSUPPORTED" || data1 === "ARTIFACT_RENDERER_UNAVAILABLE" || data1 === "ARTIFACT_STALE_PARENT" || data1 === "CANCELLED" || data1 === "CONFLICT" || data1 === "DEADLINE" || data1 === "DOCUMENT_CLOCK" || data1 === "DOCUMENT_CONFIGURATION" || data1 === "DOCUMENT_REFUSED" || data1 === "DOCUMENT_RESPONSE_LIMIT" || data1 === "DOCUMENT_RESULT_REFUSED" || data1 === "INVALID_BODY" || data1 === "INVALID_CONTENT_LENGTH" || data1 === "INVALID_JSON" || data1 === "INVALID_REQUEST" || data1 === "METHOD_NOT_ALLOWED" || data1 === "NOT_FOUND" || data1 === "PREVIEW_UNAVAILABLE" || data1 === "REQUEST_FAILED" || data1 === "REQUEST_TOO_LARGE" || data1 === "SESSION_REFUSED" || data1 === "UNAUTHENTICATED" || data1 === "UNAVAILABLE" || data1 === "UNSUPPORTED_DOCUMENT_FORMAT" || data1 === "UNSUPPORTED_MEDIA_TYPE")) {
                        validate92.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema105.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
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
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED" || data2 === "READ_UNAVAILABLE")) {
                          validate92.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema105.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
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
                validate92.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate92.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate92.errors = vErrors;
  return errors2 === 0;
}
validate92.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// document-generated:./generated-status.mjs
var errorStatuses = { "ACCESS_DENIED": 403, "ARTIFACT_BUDGET_RESERVATION_UNKNOWN": 502, "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN": 502, "ARTIFACT_CANCELLED": 499, "ARTIFACT_DEADLINE": 408, "ARTIFACT_EFFECT_UNKNOWN": 502, "ARTIFACT_PREVIEW_PENDING": 409, "ARTIFACT_PREVIEW_UNSUPPORTED": 422, "ARTIFACT_RENDERER_UNAVAILABLE": 503, "ARTIFACT_STALE_PARENT": 409, "CANCELLED": 499, "CONFLICT": 409, "DEADLINE": 408, "DOCUMENT_CLOCK": 500, "DOCUMENT_CONFIGURATION": 500, "DOCUMENT_REFUSED": 502, "DOCUMENT_RESPONSE_LIMIT": 413, "DOCUMENT_RESULT_REFUSED": 502, "INVALID_BODY": 400, "INVALID_CONTENT_LENGTH": 400, "INVALID_JSON": 400, "INVALID_REQUEST": 400, "METHOD_NOT_ALLOWED": 405, "NOT_FOUND": 404, "PREVIEW_UNAVAILABLE": 503, "REQUEST_FAILED": 502, "REQUEST_TOO_LARGE": 413, "SESSION_REFUSED": 403, "UNAUTHENTICATED": 401, "UNAVAILABLE": 503, "UNSUPPORTED_DOCUMENT_FORMAT": 422, "UNSUPPORTED_MEDIA_TYPE": 415 };

// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xml: "application/xml; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });
var artifactFilename = (request) => (request.title.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim().slice(0, 120) || "artifact") + "." + request.format;
function nativeArtifactBasename(path) {
  if (typeof path !== "string" || !path.isWellFormed() || path.length < 1 || path.length > 4096 || path.normalize("NFC") !== path || /[\\\x00-\x1f\x7f:]/u.test(path) || path.split("/").some((part) => !part || part === "." || part === ".." || part.length > 128)) throw Error("NATIVE_ARTIFACT_PATH");
  return path.split("/").at(-1);
}
function nativeArtifactFilename(path) {
  return nativeArtifactBasename(path).replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim().slice(0, 120) || "file";
}
function nativeArtifactDisposition(path) {
  const name = nativeArtifactBasename(path), safe = nativeArtifactFilename(path), base = `attachment; filename="${safe}"`;
  return name === safe ? base : base + "; filename*=UTF-8''" + encodeURIComponent(name).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
}
function assertNativeArtifactInspectionCorrelations(result) {
  const { version, integrity } = result;
  nativeArtifactBasename(version.path);
  if (version.versionId !== version.object.objectId || ["null", "pending"].includes(version.object.versionId) || version.object.bytes > 8388608 || canonicalize(version.scopes) !== canonicalize(version.object.scopes) || version.scopes.some((scope) => scope.tenantId !== version.binding.tenantId) || integrity.sha256 !== version.object.sha256 || integrity.bytes !== version.object.bytes) throw Error("NATIVE_ARTIFACT_CORRELATION");
  return result;
}
function assertNativeArtifactEvidenceBinding(binding, evidence) {
  for (const item of evidence) if (Object.hasOwn(item, "binding") && ["tenantId", "actorId", "conversationId"].some((key) => item.binding[key] !== binding[key])) throw Error("NATIVE_ARTIFACT_EVIDENCE_BINDING");
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
var admittedRequests = /* @__PURE__ */ new WeakMap();
var admittedVersions = /* @__PURE__ */ new WeakSet();
var admittedNativeVersions = /* @__PURE__ */ new WeakSet();
function admitNativeInspection(result, request) {
  try {
    assertNativeArtifactInspectionCorrelations(result);
  } catch {
    fail("NATIVE_FILE_MISMATCH");
  }
  if (result.version.versionId !== request.versionId) fail("VERSION_MISMATCH");
  admittedVersions.add(result.version);
  admittedNativeVersions.add(result.version);
  return result;
}

// document-application/download.mjs
var getter = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name).get;
async function receiveDocumentDownload(response, version, { maxBytes = 16 * 1024 * 1024, timeoutMs = 3e4, signal } = {}) {
  if (!admittedVersions.has(version)) fail("UNADMITTED_VERSION");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 16 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 6e4) fail("INVALID_DOWNLOAD_OPTIONS");
  if (version.object.bytes > maxBytes) fail("BYTE_LIMIT");
  if (signal !== void 0) {
    try {
      getter(AbortSignal.prototype, "aborted").call(signal);
    } catch {
      fail("INVALID_SIGNAL");
    }
  }
  let body, headers, status, redirected;
  try {
    body = getter(Response.prototype, "body").call(response);
    headers = getter(Response.prototype, "headers").call(response);
    status = getter(Response.prototype, "status").call(response);
    redirected = getter(Response.prototype, "redirected").call(response);
  } catch {
    fail("INVALID_RESPONSE_OBJECT");
  }
  const header = (name) => Headers.prototype.get.call(headers, name);
  const native = admittedNativeVersions.has(version), mime = native ? "application/octet-stream" : version.mimeType, disposition = native ? nativeArtifactDisposition(version.path) : `attachment; filename="${version.filename}"`;
  if (redirected || status !== 200 || header("content-type") !== mime || header("content-disposition") !== disposition || header("content-length") !== String(version.object.bytes) || header("cache-control") !== "no-store" || header("x-content-type-options") !== "nosniff" || header("content-encoding") !== null) fail("DOWNLOAD_HEADERS");
  let reader;
  try {
    reader = ReadableStream.prototype.getReader.call(body);
  } catch {
    fail("INVALID_DOWNLOAD_BODY");
  }
  let timer, abort, done = false, closed = false;
  const started = Date.now(), end = started + timeoutMs;
  let rejectStop;
  const stop = new Promise((_, reject) => {
    rejectStop = reject;
  });
  stop.catch(() => {
  });
  const check = () => {
    if (signal && getter(AbortSignal.prototype, "aborted").call(signal)) fail("DOWNLOAD_CANCELLED");
    if (Date.now() >= end) fail("DOWNLOAD_DEADLINE");
  };
  const wait = async (action) => {
    check();
    const result = await Promise.race([action(), stop]);
    check();
    return result;
  };
  try {
    if (signal) {
      try {
        getter(AbortSignal.prototype, "aborted").call(signal);
      } catch {
        fail("INVALID_SIGNAL");
      }
      abort = () => rejectStop(new Error("cancelled"));
      EventTarget.prototype.addEventListener.call(signal, "abort", abort, { once: true });
    }
    timer = setTimeout(() => rejectStop(new Error("deadline")), timeoutMs);
    check();
    const bytes = new Uint8Array(version.object.bytes);
    let observed = 0;
    while (true) {
      const part = await wait(() => ReadableStreamDefaultReader.prototype.read.call(reader));
      if (part.done) {
        done = true;
        break;
      }
      const chunk = copyBytes(part.value, Math.min(maxBytes, bytes.length) - observed);
      observed += chunk.length;
      Uint8Array.prototype.set.call(bytes, chunk, observed - chunk.length);
    }
    if (observed !== bytes.length) fail("DOWNLOAD_LENGTH");
    if (await wait(() => digest(bytes)) !== version.object.sha256) fail("DOWNLOAD_HASH");
    closed = true;
    return Object.freeze({ version, bytes });
  } catch (error) {
    if (isFailure(error)) throw error;
    if (signal && getter(AbortSignal.prototype, "aborted").call(signal)) fail("DOWNLOAD_CANCELLED");
    if (Date.now() >= end) fail("DOWNLOAD_DEADLINE");
    fail("DOWNLOAD_STREAM");
  } finally {
    clearTimeout(timer);
    if (signal && abort) EventTarget.prototype.removeEventListener.call(signal, "abort", abort);
    if (!done && !closed) {
      try {
        Promise.resolve(ReadableStreamDefaultReader.prototype.cancel.call(reader)).catch(() => {
        });
      } catch {
      }
    }
    try {
      ReadableStreamDefaultReader.prototype.releaseLock.call(reader);
    } catch {
    }
  }
}

// document-application/document-application-receiver.mjs
var validators = Object.freeze({ create: validateCreateRequest, revise: validateReviseRequest, inspect: validateInspectRequest, download: validateDownloadRequest });
var same = (a, b) => canonicalize(a) === canonicalize(b);
function routeValidator(route) {
  if (typeof route !== "string" || !Object.hasOwn(validators, route)) fail("INVALID_ROUTE");
  return validators[route];
}
function receiveDocumentRequest(route, utf8Bytes) {
  const validate = routeValidator(route), request = parseBytes(utf8Bytes, 2 * 1024 * 1024);
  if (!validate(request)) fail("INVALID_REQUEST");
  admittedRequests.set(request, route);
  return request;
}
async function receiveDocumentResponse(route, httpStatus, utf8Bytes, request) {
  routeValidator(route);
  if (admittedRequests.get(request) !== route) fail("UNADMITTED_REQUEST");
  if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) fail("INVALID_STATUS");
  const result = parseBytes(utf8Bytes, 16 * 1024 * 1024);
  if (httpStatus !== 200) {
    if (!validateError(result) || errorStatuses[result.error.code] !== httpStatus) fail("INVALID_ERROR_RESPONSE");
    return result;
  }
  if (route === "download") fail("BINARY_RESPONSE_REQUIRED");
  if (!(route === "inspect" ? validateInspection : validateCreated)(result)) fail("INVALID_RESPONSE");
  if (result.kind === "native-file") return admitNativeInspection(result, request);
  const { version, inspection } = result;
  try {
    assertNativeArtifactEvidenceBinding(version.binding, version.evidence);
  } catch {
    fail("EVIDENCE_BINDING");
  }
  if (version.object.bytes > 16 * 1024 * 1024 || !same(version.scopes, version.object.scopes) || version.scopes.some((x) => x.tenantId !== version.binding.tenantId)) fail("VERSION_SCOPE_OR_SIZE");
  const scopeKeys = new Set(version.scopes.map(canonicalize));
  if (version.evidence.some((e) => e.scopes.some((s) => !scopeKeys.has(canonicalize(s))))) fail("EVIDENCE_SCOPE");
  if (inspection.sha256 !== version.object.sha256 || inspection.bytes !== version.object.bytes || version.mimeType !== ARTIFACT_MIME_TYPES[inspection.format] || !version.filename.endsWith("." + inspection.format)) fail("INSPECTION_MISMATCH");
  if (route === "inspect") {
    if (version.versionId !== request.versionId) fail("VERSION_MISMATCH");
  } else {
    if (version.parentVersionId !== (route === "revise" ? request.baseVersionId : null) || inspection.format !== request.request.format || version.filename !== artifactFilename(request.request)) fail("REQUEST_MISMATCH");
  }
  admittedVersions.add(version);
  return result;
}
export {
  DocumentResponseError,
  receiveDocumentDownload,
  receiveDocumentRequest,
  receiveDocumentResponse
};
