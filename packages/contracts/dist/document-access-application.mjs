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

// document-access-generated:./generated-validator.mjs
var validateInspectRequest = validate35;
var pattern4 = new RegExp("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$", "u");
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
      if (data.versionId === void 0 && (missing0 = "versionId")) {
        validate35.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId")) {
            validate35.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (!pattern4.test(data0)) {
                  validate35.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" }, message: 'must match pattern "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate35.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
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
var validateDownloadRequest = validate36;
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
      if (data.versionId === void 0 && (missing0 = "versionId")) {
        validate36.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId")) {
            validate36.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (!pattern4.test(data0)) {
                  validate36.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" }, message: 'must match pattern "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"' }];
                  return false;
                }
              } else {
                validate36.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
var validateInspection = validate37;
var schema37 = { "type": "object", "properties": { "version": { "$ref": "#/$defs/DocumentVersion" }, "inspection": { "oneOf": [{ "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "txt" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" } }, "required": ["encoding", "whitespace"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "docx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "paragraphs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "tables": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "pictures": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["paragraphs", "tables", "pictures"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "xlsx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "sheets": { "type": "array", "items": { "type": "string" }, "maxItems": 30 }, "formulas": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "formulaCache": { "enum": ["unverified-zero-placeholder; recalculation required", "removed/unverified; recalculation required"] }, "revisionMethod": { "const": "openpyxl typed-cell replacement" } }, "required": ["sheets", "formulas", "formulaCache"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "pptx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "slides": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "editable": { "const": true }, "visualInspection": { "const": "pending" } }, "required": ["slides", "editable", "visualInspection"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "zip" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "rows": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "columns": { "type": "array", "items": { "type": "string" }, "maxItems": 200 }, "chart": { "type": "boolean" } }, "required": ["rows", "columns", "chart"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "pdf" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "conversionCompleted": { "const": true }, "renderInspection": { "const": "pending" }, "sourceDocxSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["conversionCompleted", "renderInspection", "sourceDocxSha256"], "additionalProperties": false }, "currentBytesVerified": { "const": true } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details", "currentBytesVerified"], "additionalProperties": false }] } }, "required": ["version", "inspection"], "additionalProperties": false };
var schema38 = { "allOf": [{ "$ref": "#/$defs/Canonical_ArtifactVersion_d54b8ac9" }, { "type": "object", "properties": { "generationStatus": { "const": "draft" }, "previewStatus": { "const": "pending" }, "filename": { "type": "string", "pattern": "^[A-Za-z0-9._ -]{1,125}$" }, "mimeType": { "enum": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain; charset=utf-8", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf", "application/zip"] } } }] };
var schema39 = { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "artifactId": { "type": "string", "format": "uuid" }, "versionId": { "type": "string", "format": "uuid" }, "parentVersionId": { "anyOf": [{ "type": "string", "format": "uuid" }, { "type": "null" }] }, "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "object": { "$ref": "#/$defs/Canonical_ObjectReference_a099bd1c" }, "filename": { "type": "string", "minLength": 1, "maxLength": 255 }, "mimeType": { "type": "string", "minLength": 1 }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "evidence": { "type": "array", "items": { "$ref": "#/$defs/Canonical_SourceEvidence_d9008775" } }, "generationStatus": { "type": "string", "enum": ["draft", "validated", "published", "failed"] }, "previewStatus": { "type": "string", "enum": ["pending", "validated", "unsupported", "failed"] }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": ["contractVersion", "artifactId", "versionId", "parentVersionId", "binding", "object", "filename", "mimeType", "scopes", "evidence", "generationStatus", "previewStatus", "createdAt"], "additionalProperties": false };
var schema42 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats16 = require_formats().fullFormats["date-time"];
var pattern6 = new RegExp("^[a-f0-9]{64}$", "u");
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
      if (data.objectId === void 0 && (missing0 = "objectId") || data.versionId === void 0 && (missing0 = "versionId") || data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "objectId" || key0 === "versionId" || key0 === "sha256" || key0 === "bytes" || key0 === "scopes")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                    validate27.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate27.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                  if (func2(data1) < 1) {
                    validate27.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate27.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    if (!pattern6.test(data2)) {
                      validate27.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate27.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate27.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs8) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 9007199254740991 || isNaN(data3)) {
                        validate27.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data3 < 0 || isNaN(data3)) {
                          validate27.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
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
                          validate27.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                  validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                          if (func2(data6) > 128) {
                                            validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data6) < 1) {
                                              validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema42.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                              if (func2(data8) > 256) {
                                                validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func2(data8) < 1) {
                                                  validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                if (func2(data9) > 128) {
                                                  validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data9) < 1) {
                                                    validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                validate27.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                    validate27.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                    return false;
                                    break outer0;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate27.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
      validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors2 === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema44 = { "type": "object", "properties": { "sourceId": { "type": "string", "minLength": 1 }, "recordId": { "type": "string", "minLength": 1 }, "sourceVersionId": { "type": "string", "minLength": 1 }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "sourceUpdatedAt": { "anyOf": [{ "type": "string", "format": "date-time", "pattern": "Z$" }, { "type": "null" }] }, "citationId": { "type": "string", "format": "uuid" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "contentSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "authorizationDecisionId"], "additionalProperties": false };
var pattern7 = new RegExp("Z$", "u");
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
      if (data.sourceId === void 0 && (missing0 = "sourceId") || data.recordId === void 0 && (missing0 = "recordId") || data.sourceVersionId === void 0 && (missing0 = "sourceVersionId") || data.observedAt === void 0 && (missing0 = "observedAt") || data.sourceUpdatedAt === void 0 && (missing0 = "sourceUpdatedAt") || data.citationId === void 0 && (missing0 = "citationId") || data.scopes === void 0 && (missing0 = "scopes") || data.contentSha256 === void 0 && (missing0 = "contentSha256") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
        validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema44.properties, key0)) {
            validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (func2(data0) < 1) {
                  validate29.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                  return false;
                }
              } else {
                validate29.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                  if (func2(data1) < 1) {
                    validate29.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate29.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    if (func2(data2) < 1) {
                      validate29.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  } else {
                    validate29.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!pattern7.test(data3)) {
                          validate29.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats16.validate(data3)) {
                            validate29.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate29.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                          if (!pattern7.test(data4)) {
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
                      validate29.errors = vErrors;
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
                              validate29.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate29.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              validate29.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                      validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                      return false;
                                    } else {
                                      const _errs23 = errors2;
                                      for (const key1 in data7) {
                                        if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                          validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                              if (func2(data8) > 128) {
                                                validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func2(data8) < 1) {
                                                  validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                              validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data9 === "tenant" || data9 === "client" || data9 === "mailbox" || data9 === "memory" || data9 === "document" || data9 === "private-user" || data9 === "public")) {
                                              validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema42.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                  if (func2(data10) > 256) {
                                                    validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func2(data10) < 1) {
                                                      validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                    if (func2(data11) > 128) {
                                                      validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func2(data11) < 1) {
                                                        validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate29.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                        validate29.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate29.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                              if (!pattern6.test(data12)) {
                                validate29.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate29.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate29.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate29.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate29.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate29.errors = vErrors;
  return errors2 === 0;
}
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate26.evaluated;
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
        validate26.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema39.properties, key0)) {
            validate26.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate26.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
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
                      validate26.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate26.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        validate26.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate26.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate26.errors = vErrors;
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
                          validate26.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs16 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate26.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                  if (func2(data5) > 128) {
                                    validate26.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func2(data5) < 1) {
                                      validate26.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate26.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    if (func2(data6) > 128) {
                                      validate26.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func2(data6) < 1) {
                                        validate26.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate26.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate26.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate26.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate26.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate26.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                              validate26.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate26.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                validate26.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate26.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate26.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs29) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate26.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate26.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                        validate26.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                      if (!validate27(data.object, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
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
                            if (func2(data13) > 255) {
                              validate26.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                              return false;
                            } else {
                              if (func2(data13) < 1) {
                                validate26.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate26.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              if (func2(data14) < 1) {
                                validate26.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            } else {
                              validate26.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate26.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                          validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                          return false;
                                        } else {
                                          const _errs41 = errors2;
                                          for (const key2 in data16) {
                                            if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                              validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
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
                                                  if (func2(data17) > 128) {
                                                    validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func2(data17) < 1) {
                                                      validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                  validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                                if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
                                                  validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema42.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                      if (func2(data19) > 256) {
                                                        validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func2(data19) < 1) {
                                                          validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                        if (func2(data20) > 128) {
                                                          validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func2(data20) < 1) {
                                                            validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate26.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                            validate26.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                            return false;
                                            break outer0;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate26.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                    if (!validate29(data21[i2], { instancePath: instancePath + "/evidence/" + i2, parentData: data21, parentDataProperty: i2, rootData, dynamicAnchors })) {
                                      vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
                                      errors2 = vErrors.length;
                                    }
                                    var valid8 = _errs52 === errors2;
                                    if (!valid8) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate26.errors = [{ instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                  validate26.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                if (!(data23 === "draft" || data23 === "validated" || data23 === "published" || data23 === "failed")) {
                                  validate26.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/enum", keyword: "enum", params: { allowedValues: schema39.properties.generationStatus.enum }, message: "must be equal to one of the allowed values" }];
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
                                    validate26.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  if (!(data24 === "pending" || data24 === "validated" || data24 === "unsupported" || data24 === "failed")) {
                                    validate26.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/enum", keyword: "enum", params: { allowedValues: schema39.properties.previewStatus.enum }, message: "must be equal to one of the allowed values" }];
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
                                          if (!pattern7.test(data25)) {
                                            validate26.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats16.validate(data25)) {
                                              validate26.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate26.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate26.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate26.errors = vErrors;
  return errors2 === 0;
}
validate26.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern11 = new RegExp("^[A-Za-z0-9._ -]{1,125}$", "u");
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
  const _errs0 = errors2;
  if (!validate26(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
    errors2 = vErrors.length;
  }
  var valid0 = _errs0 === errors2;
  if (valid0) {
    const _errs1 = errors2;
    if (errors2 === _errs1) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.generationStatus !== void 0) {
          const _errs3 = errors2;
          if ("draft" !== data.generationStatus) {
            validate25.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/allOf/1/properties/generationStatus/const", keyword: "const", params: { allowedValue: "draft" }, message: "must be equal to constant" }];
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
              validate25.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/allOf/1/properties/previewStatus/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" }];
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
                  if (!pattern11.test(data2)) {
                    validate25.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/allOf/1/properties/filename/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9._ -]{1,125}$" }, message: 'must match pattern "^[A-Za-z0-9._ -]{1,125}$"' }];
                    return false;
                  }
                } else {
                  validate25.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/allOf/1/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                if (!(data3 === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || data3 === "text/plain; charset=utf-8" || data3 === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || data3 === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || data3 === "application/pdf" || data3 === "application/zip")) {
                  validate25.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/allOf/1/properties/mimeType/enum", keyword: "enum", params: { allowedValues: schema38.allOf[1].properties.mimeType.enum }, message: "must be equal to one of the allowed values" }];
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
        validate25.errors = [{ instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
      }
    }
    var valid0 = _errs1 === errors2;
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate37(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate37.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.version === void 0 && (missing0 = "version") || data.inspection === void 0 && (missing0 = "inspection")) {
        validate37.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "version" || key0 === "inspection")) {
            validate37.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.version !== void 0) {
            const _errs2 = errors2;
            if (!validate25(data.version, { instancePath: instancePath + "/version", parentData: data, parentDataProperty: "version", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
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
                  if (data1.sha256 === void 0 && (missing1 = "sha256") || data1.bytes === void 0 && (missing1 = "bytes") || data1.format === void 0 && (missing1 = "format") || data1.nativeOpened === void 0 && (missing1 = "nativeOpened") || data1.rendered === void 0 && (missing1 = "rendered") || data1.recalculated === void 0 && (missing1 = "recalculated") || data1.members === void 0 && (missing1 = "members") || data1.details === void 0 && (missing1 = "details") || data1.currentBytesVerified === void 0 && (missing1 = "currentBytesVerified")) {
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
                      if (!func1.call(schema37.properties.inspection.oneOf[0].properties, key1)) {
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
                            if (!pattern6.test(data2)) {
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
                                                if (func2(data9) > 500) {
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
                                    if (valid2) {
                                      if (data1.currentBytesVerified !== void 0) {
                                        const _errs25 = errors2;
                                        if (true !== data1.currentBytesVerified) {
                                          const err20 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/0/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err20];
                                          } else {
                                            vErrors.push(err20);
                                          }
                                          errors2++;
                                        }
                                        var valid2 = _errs25 === errors2;
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
                  }
                } else {
                  const err21 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err21];
                  } else {
                    vErrors.push(err21);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs5 === errors2;
              if (_valid0) {
                valid1 = true;
                passing0 = 0;
                var props0 = true;
              }
              const _errs26 = errors2;
              if (errors2 === _errs26) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing3;
                  if (data1.sha256 === void 0 && (missing3 = "sha256") || data1.bytes === void 0 && (missing3 = "bytes") || data1.format === void 0 && (missing3 = "format") || data1.nativeOpened === void 0 && (missing3 = "nativeOpened") || data1.rendered === void 0 && (missing3 = "rendered") || data1.recalculated === void 0 && (missing3 = "recalculated") || data1.members === void 0 && (missing3 = "members") || data1.details === void 0 && (missing3 = "details") || data1.currentBytesVerified === void 0 && (missing3 = "currentBytesVerified")) {
                    const err22 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                      vErrors = [err22];
                    } else {
                      vErrors.push(err22);
                    }
                    errors2++;
                  } else {
                    const _errs28 = errors2;
                    for (const key3 in data1) {
                      if (!func1.call(schema37.properties.inspection.oneOf[1].properties, key3)) {
                        const err23 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err23];
                        } else {
                          vErrors.push(err23);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs28 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data14 = data1.sha256;
                        const _errs29 = errors2;
                        if (errors2 === _errs29) {
                          if (typeof data14 === "string") {
                            if (!pattern6.test(data14)) {
                              const err24 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/1/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err24];
                              } else {
                                vErrors.push(err24);
                              }
                              errors2++;
                            }
                          } else {
                            const err25 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/1/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err25];
                            } else {
                              vErrors.push(err25);
                            }
                            errors2++;
                          }
                        }
                        var valid5 = _errs29 === errors2;
                      } else {
                        var valid5 = true;
                      }
                      if (valid5) {
                        if (data1.bytes !== void 0) {
                          let data15 = data1.bytes;
                          const _errs31 = errors2;
                          if (!(typeof data15 == "number" && (!(data15 % 1) && !isNaN(data15)) && isFinite(data15))) {
                            const err26 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err26];
                            } else {
                              vErrors.push(err26);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs31) {
                            if (typeof data15 == "number" && isFinite(data15)) {
                              if (data15 > 9007199254740991 || isNaN(data15)) {
                                const err27 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err27];
                                } else {
                                  vErrors.push(err27);
                                }
                                errors2++;
                              } else {
                                if (data15 < 0 || isNaN(data15)) {
                                  const err28 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/1/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err28];
                                  } else {
                                    vErrors.push(err28);
                                  }
                                  errors2++;
                                }
                              }
                            }
                          }
                          var valid5 = _errs31 === errors2;
                        } else {
                          var valid5 = true;
                        }
                        if (valid5) {
                          if (data1.format !== void 0) {
                            const _errs33 = errors2;
                            if ("docx" !== data1.format) {
                              const err29 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/1/properties/format/const", keyword: "const", params: { allowedValue: "docx" }, message: "must be equal to constant" };
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
                            if (data1.nativeOpened !== void 0) {
                              const _errs34 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err30 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/1/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
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
                              if (data1.rendered !== void 0) {
                                const _errs35 = errors2;
                                if (false !== data1.rendered) {
                                  const err31 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/1/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
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
                                if (data1.recalculated !== void 0) {
                                  const _errs36 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err32 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/1/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err32];
                                    } else {
                                      vErrors.push(err32);
                                    }
                                    errors2++;
                                  }
                                  var valid5 = _errs36 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data1.members !== void 0) {
                                    let data20 = data1.members;
                                    const _errs37 = errors2;
                                    if (errors2 === _errs37) {
                                      if (Array.isArray(data20)) {
                                        if (data20.length > 5e3) {
                                          const err33 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/1/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                          if (vErrors === null) {
                                            vErrors = [err33];
                                          } else {
                                            vErrors.push(err33);
                                          }
                                          errors2++;
                                        } else {
                                          var valid6 = true;
                                          const len1 = data20.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            let data21 = data20[i1];
                                            const _errs39 = errors2;
                                            if (errors2 === _errs39) {
                                              if (typeof data21 === "string") {
                                                if (func2(data21) > 500) {
                                                  const err34 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/properties/inspection/oneOf/1/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err34];
                                                  } else {
                                                    vErrors.push(err34);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err35 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/properties/inspection/oneOf/1/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err35];
                                                } else {
                                                  vErrors.push(err35);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid6 = _errs39 === errors2;
                                            if (!valid6) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err36 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/1/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err36];
                                        } else {
                                          vErrors.push(err36);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid5 = _errs37 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data1.details !== void 0) {
                                      let data22 = data1.details;
                                      const _errs41 = errors2;
                                      if (errors2 === _errs41) {
                                        if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                                          let missing4;
                                          if (data22.paragraphs === void 0 && (missing4 = "paragraphs") || data22.tables === void 0 && (missing4 = "tables") || data22.pictures === void 0 && (missing4 = "pictures")) {
                                            const err37 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err37];
                                            } else {
                                              vErrors.push(err37);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs43 = errors2;
                                            for (const key4 in data22) {
                                              if (!(key4 === "paragraphs" || key4 === "tables" || key4 === "pictures")) {
                                                const err38 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err38];
                                                } else {
                                                  vErrors.push(err38);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs43 === errors2) {
                                              if (data22.paragraphs !== void 0) {
                                                let data23 = data22.paragraphs;
                                                const _errs44 = errors2;
                                                if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                                  const err39 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/paragraphs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                  if (vErrors === null) {
                                                    vErrors = [err39];
                                                  } else {
                                                    vErrors.push(err39);
                                                  }
                                                  errors2++;
                                                }
                                                if (errors2 === _errs44) {
                                                  if (typeof data23 == "number" && isFinite(data23)) {
                                                    if (data23 > 9007199254740991 || isNaN(data23)) {
                                                      const err40 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/paragraphs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                      if (vErrors === null) {
                                                        vErrors = [err40];
                                                      } else {
                                                        vErrors.push(err40);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (data23 < 0 || isNaN(data23)) {
                                                        const err41 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/paragraphs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                        if (vErrors === null) {
                                                          vErrors = [err41];
                                                        } else {
                                                          vErrors.push(err41);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  }
                                                }
                                                var valid7 = _errs44 === errors2;
                                              } else {
                                                var valid7 = true;
                                              }
                                              if (valid7) {
                                                if (data22.tables !== void 0) {
                                                  let data24 = data22.tables;
                                                  const _errs46 = errors2;
                                                  if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                                    const err42 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/tables/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                    if (vErrors === null) {
                                                      vErrors = [err42];
                                                    } else {
                                                      vErrors.push(err42);
                                                    }
                                                    errors2++;
                                                  }
                                                  if (errors2 === _errs46) {
                                                    if (typeof data24 == "number" && isFinite(data24)) {
                                                      if (data24 > 9007199254740991 || isNaN(data24)) {
                                                        const err43 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/tables/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                        if (vErrors === null) {
                                                          vErrors = [err43];
                                                        } else {
                                                          vErrors.push(err43);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        if (data24 < 0 || isNaN(data24)) {
                                                          const err44 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/tables/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                          if (vErrors === null) {
                                                            vErrors = [err44];
                                                          } else {
                                                            vErrors.push(err44);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid7 = _errs46 === errors2;
                                                } else {
                                                  var valid7 = true;
                                                }
                                                if (valid7) {
                                                  if (data22.pictures !== void 0) {
                                                    let data25 = data22.pictures;
                                                    const _errs48 = errors2;
                                                    if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                                                      const err45 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/pictures/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err45];
                                                      } else {
                                                        vErrors.push(err45);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs48) {
                                                      if (typeof data25 == "number" && isFinite(data25)) {
                                                        if (data25 > 9007199254740991 || isNaN(data25)) {
                                                          const err46 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/pictures/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err46];
                                                          } else {
                                                            vErrors.push(err46);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data25 < 0 || isNaN(data25)) {
                                                            const err47 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/properties/inspection/oneOf/1/properties/details/properties/pictures/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err47];
                                                            } else {
                                                              vErrors.push(err47);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid7 = _errs48 === errors2;
                                                  } else {
                                                    var valid7 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err48 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/1/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err48];
                                          } else {
                                            vErrors.push(err48);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid5 = _errs41 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data1.currentBytesVerified !== void 0) {
                                        const _errs50 = errors2;
                                        if (true !== data1.currentBytesVerified) {
                                          const err49 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/1/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err49];
                                          } else {
                                            vErrors.push(err49);
                                          }
                                          errors2++;
                                        }
                                        var valid5 = _errs50 === errors2;
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
                  const err50 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs26 === errors2;
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
                const _errs51 = errors2;
                if (errors2 === _errs51) {
                  if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                    let missing5;
                    if (data1.sha256 === void 0 && (missing5 = "sha256") || data1.bytes === void 0 && (missing5 = "bytes") || data1.format === void 0 && (missing5 = "format") || data1.nativeOpened === void 0 && (missing5 = "nativeOpened") || data1.rendered === void 0 && (missing5 = "rendered") || data1.recalculated === void 0 && (missing5 = "recalculated") || data1.members === void 0 && (missing5 = "members") || data1.details === void 0 && (missing5 = "details") || data1.currentBytesVerified === void 0 && (missing5 = "currentBytesVerified")) {
                      const err51 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                      if (vErrors === null) {
                        vErrors = [err51];
                      } else {
                        vErrors.push(err51);
                      }
                      errors2++;
                    } else {
                      const _errs53 = errors2;
                      for (const key5 in data1) {
                        if (!func1.call(schema37.properties.inspection.oneOf[2].properties, key5)) {
                          const err52 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err52];
                          } else {
                            vErrors.push(err52);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs53 === errors2) {
                        if (data1.sha256 !== void 0) {
                          let data27 = data1.sha256;
                          const _errs54 = errors2;
                          if (errors2 === _errs54) {
                            if (typeof data27 === "string") {
                              if (!pattern6.test(data27)) {
                                const err53 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/2/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                if (vErrors === null) {
                                  vErrors = [err53];
                                } else {
                                  vErrors.push(err53);
                                }
                                errors2++;
                              }
                            } else {
                              const err54 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/2/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err54];
                              } else {
                                vErrors.push(err54);
                              }
                              errors2++;
                            }
                          }
                          var valid8 = _errs54 === errors2;
                        } else {
                          var valid8 = true;
                        }
                        if (valid8) {
                          if (data1.bytes !== void 0) {
                            let data28 = data1.bytes;
                            const _errs56 = errors2;
                            if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                              const err55 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err55];
                              } else {
                                vErrors.push(err55);
                              }
                              errors2++;
                            }
                            if (errors2 === _errs56) {
                              if (typeof data28 == "number" && isFinite(data28)) {
                                if (data28 > 9007199254740991 || isNaN(data28)) {
                                  const err56 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                  if (vErrors === null) {
                                    vErrors = [err56];
                                  } else {
                                    vErrors.push(err56);
                                  }
                                  errors2++;
                                } else {
                                  if (data28 < 0 || isNaN(data28)) {
                                    const err57 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/2/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                    if (vErrors === null) {
                                      vErrors = [err57];
                                    } else {
                                      vErrors.push(err57);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                            }
                            var valid8 = _errs56 === errors2;
                          } else {
                            var valid8 = true;
                          }
                          if (valid8) {
                            if (data1.format !== void 0) {
                              const _errs58 = errors2;
                              if ("xlsx" !== data1.format) {
                                const err58 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/2/properties/format/const", keyword: "const", params: { allowedValue: "xlsx" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err58];
                                } else {
                                  vErrors.push(err58);
                                }
                                errors2++;
                              }
                              var valid8 = _errs58 === errors2;
                            } else {
                              var valid8 = true;
                            }
                            if (valid8) {
                              if (data1.nativeOpened !== void 0) {
                                const _errs59 = errors2;
                                if (false !== data1.nativeOpened) {
                                  const err59 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/2/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err59];
                                  } else {
                                    vErrors.push(err59);
                                  }
                                  errors2++;
                                }
                                var valid8 = _errs59 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data1.rendered !== void 0) {
                                  const _errs60 = errors2;
                                  if (false !== data1.rendered) {
                                    const err60 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/2/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err60];
                                    } else {
                                      vErrors.push(err60);
                                    }
                                    errors2++;
                                  }
                                  var valid8 = _errs60 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data1.recalculated !== void 0) {
                                    const _errs61 = errors2;
                                    if (false !== data1.recalculated) {
                                      const err61 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/2/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err61];
                                      } else {
                                        vErrors.push(err61);
                                      }
                                      errors2++;
                                    }
                                    var valid8 = _errs61 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data1.members !== void 0) {
                                      let data33 = data1.members;
                                      const _errs62 = errors2;
                                      if (errors2 === _errs62) {
                                        if (Array.isArray(data33)) {
                                          if (data33.length > 5e3) {
                                            const err62 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/2/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                            if (vErrors === null) {
                                              vErrors = [err62];
                                            } else {
                                              vErrors.push(err62);
                                            }
                                            errors2++;
                                          } else {
                                            var valid9 = true;
                                            const len2 = data33.length;
                                            for (let i2 = 0; i2 < len2; i2++) {
                                              let data34 = data33[i2];
                                              const _errs64 = errors2;
                                              if (errors2 === _errs64) {
                                                if (typeof data34 === "string") {
                                                  if (func2(data34) > 500) {
                                                    const err63 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/properties/inspection/oneOf/2/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err63];
                                                    } else {
                                                      vErrors.push(err63);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err64 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/properties/inspection/oneOf/2/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err64];
                                                  } else {
                                                    vErrors.push(err64);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid9 = _errs64 === errors2;
                                              if (!valid9) {
                                                break;
                                              }
                                            }
                                          }
                                        } else {
                                          const err65 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/2/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                          if (vErrors === null) {
                                            vErrors = [err65];
                                          } else {
                                            vErrors.push(err65);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid8 = _errs62 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data1.details !== void 0) {
                                        let data35 = data1.details;
                                        const _errs66 = errors2;
                                        if (errors2 === _errs66) {
                                          if (data35 && typeof data35 == "object" && !Array.isArray(data35)) {
                                            let missing6;
                                            if (data35.sheets === void 0 && (missing6 = "sheets") || data35.formulas === void 0 && (missing6 = "formulas") || data35.formulaCache === void 0 && (missing6 = "formulaCache")) {
                                              const err66 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                                              if (vErrors === null) {
                                                vErrors = [err66];
                                              } else {
                                                vErrors.push(err66);
                                              }
                                              errors2++;
                                            } else {
                                              const _errs68 = errors2;
                                              for (const key6 in data35) {
                                                if (!(key6 === "sheets" || key6 === "formulas" || key6 === "formulaCache" || key6 === "revisionMethod")) {
                                                  const err67 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                                  if (vErrors === null) {
                                                    vErrors = [err67];
                                                  } else {
                                                    vErrors.push(err67);
                                                  }
                                                  errors2++;
                                                  break;
                                                }
                                              }
                                              if (_errs68 === errors2) {
                                                if (data35.sheets !== void 0) {
                                                  let data36 = data35.sheets;
                                                  const _errs69 = errors2;
                                                  if (errors2 === _errs69) {
                                                    if (Array.isArray(data36)) {
                                                      if (data36.length > 30) {
                                                        const err68 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/sheets/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
                                                        if (vErrors === null) {
                                                          vErrors = [err68];
                                                        } else {
                                                          vErrors.push(err68);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        var valid11 = true;
                                                        const len3 = data36.length;
                                                        for (let i3 = 0; i3 < len3; i3++) {
                                                          const _errs71 = errors2;
                                                          if (typeof data36[i3] !== "string") {
                                                            const err69 = { instancePath: instancePath + "/inspection/details/sheets/" + i3, schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/sheets/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                            if (vErrors === null) {
                                                              vErrors = [err69];
                                                            } else {
                                                              vErrors.push(err69);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid11 = _errs71 === errors2;
                                                          if (!valid11) {
                                                            break;
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      const err70 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/sheets/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                      if (vErrors === null) {
                                                        vErrors = [err70];
                                                      } else {
                                                        vErrors.push(err70);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid10 = _errs69 === errors2;
                                                } else {
                                                  var valid10 = true;
                                                }
                                                if (valid10) {
                                                  if (data35.formulas !== void 0) {
                                                    let data38 = data35.formulas;
                                                    const _errs73 = errors2;
                                                    if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                                      const err71 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/formulas/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err71];
                                                      } else {
                                                        vErrors.push(err71);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs73) {
                                                      if (typeof data38 == "number" && isFinite(data38)) {
                                                        if (data38 > 9007199254740991 || isNaN(data38)) {
                                                          const err72 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/formulas/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err72];
                                                          } else {
                                                            vErrors.push(err72);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data38 < 0 || isNaN(data38)) {
                                                            const err73 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/formulas/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err73];
                                                            } else {
                                                              vErrors.push(err73);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid10 = _errs73 === errors2;
                                                  } else {
                                                    var valid10 = true;
                                                  }
                                                  if (valid10) {
                                                    if (data35.formulaCache !== void 0) {
                                                      let data39 = data35.formulaCache;
                                                      const _errs75 = errors2;
                                                      if (!(data39 === "unverified-zero-placeholder; recalculation required" || data39 === "removed/unverified; recalculation required")) {
                                                        const err74 = { instancePath: instancePath + "/inspection/details/formulaCache", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/formulaCache/enum", keyword: "enum", params: { allowedValues: schema37.properties.inspection.oneOf[2].properties.details.properties.formulaCache.enum }, message: "must be equal to one of the allowed values" };
                                                        if (vErrors === null) {
                                                          vErrors = [err74];
                                                        } else {
                                                          vErrors.push(err74);
                                                        }
                                                        errors2++;
                                                      }
                                                      var valid10 = _errs75 === errors2;
                                                    } else {
                                                      var valid10 = true;
                                                    }
                                                    if (valid10) {
                                                      if (data35.revisionMethod !== void 0) {
                                                        const _errs76 = errors2;
                                                        if ("openpyxl typed-cell replacement" !== data35.revisionMethod) {
                                                          const err75 = { instancePath: instancePath + "/inspection/details/revisionMethod", schemaPath: "#/properties/inspection/oneOf/2/properties/details/properties/revisionMethod/const", keyword: "const", params: { allowedValue: "openpyxl typed-cell replacement" }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err75];
                                                          } else {
                                                            vErrors.push(err75);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid10 = _errs76 === errors2;
                                                      } else {
                                                        var valid10 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err76 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/2/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                            if (vErrors === null) {
                                              vErrors = [err76];
                                            } else {
                                              vErrors.push(err76);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid8 = _errs66 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data1.currentBytesVerified !== void 0) {
                                          const _errs77 = errors2;
                                          if (true !== data1.currentBytesVerified) {
                                            const err77 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/2/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                            if (vErrors === null) {
                                              vErrors = [err77];
                                            } else {
                                              vErrors.push(err77);
                                            }
                                            errors2++;
                                          }
                                          var valid8 = _errs77 === errors2;
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
                    }
                  } else {
                    const err78 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err78];
                    } else {
                      vErrors.push(err78);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs51 === errors2;
                if (_valid0 && valid1) {
                  valid1 = false;
                  passing0 = [passing0, 2];
                } else {
                  if (_valid0) {
                    valid1 = true;
                    passing0 = 2;
                    if (props0 !== true) {
                      props0 = true;
                    }
                  }
                  const _errs78 = errors2;
                  if (errors2 === _errs78) {
                    if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                      let missing7;
                      if (data1.sha256 === void 0 && (missing7 = "sha256") || data1.bytes === void 0 && (missing7 = "bytes") || data1.format === void 0 && (missing7 = "format") || data1.nativeOpened === void 0 && (missing7 = "nativeOpened") || data1.rendered === void 0 && (missing7 = "rendered") || data1.recalculated === void 0 && (missing7 = "recalculated") || data1.members === void 0 && (missing7 = "members") || data1.details === void 0 && (missing7 = "details") || data1.currentBytesVerified === void 0 && (missing7 = "currentBytesVerified")) {
                        const err79 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                        if (vErrors === null) {
                          vErrors = [err79];
                        } else {
                          vErrors.push(err79);
                        }
                        errors2++;
                      } else {
                        const _errs80 = errors2;
                        for (const key7 in data1) {
                          if (!func1.call(schema37.properties.inspection.oneOf[3].properties, key7)) {
                            const err80 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err80];
                            } else {
                              vErrors.push(err80);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs80 === errors2) {
                          if (data1.sha256 !== void 0) {
                            let data42 = data1.sha256;
                            const _errs81 = errors2;
                            if (errors2 === _errs81) {
                              if (typeof data42 === "string") {
                                if (!pattern6.test(data42)) {
                                  const err81 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/3/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err81];
                                  } else {
                                    vErrors.push(err81);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err82 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/3/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err82];
                                } else {
                                  vErrors.push(err82);
                                }
                                errors2++;
                              }
                            }
                            var valid12 = _errs81 === errors2;
                          } else {
                            var valid12 = true;
                          }
                          if (valid12) {
                            if (data1.bytes !== void 0) {
                              let data43 = data1.bytes;
                              const _errs83 = errors2;
                              if (!(typeof data43 == "number" && (!(data43 % 1) && !isNaN(data43)) && isFinite(data43))) {
                                const err83 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err83];
                                } else {
                                  vErrors.push(err83);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs83) {
                                if (typeof data43 == "number" && isFinite(data43)) {
                                  if (data43 > 9007199254740991 || isNaN(data43)) {
                                    const err84 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err84];
                                    } else {
                                      vErrors.push(err84);
                                    }
                                    errors2++;
                                  } else {
                                    if (data43 < 0 || isNaN(data43)) {
                                      const err85 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/3/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                      if (vErrors === null) {
                                        vErrors = [err85];
                                      } else {
                                        vErrors.push(err85);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid12 = _errs83 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data1.format !== void 0) {
                                const _errs85 = errors2;
                                if ("pptx" !== data1.format) {
                                  const err86 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/3/properties/format/const", keyword: "const", params: { allowedValue: "pptx" }, message: "must be equal to constant" };
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
                                if (data1.nativeOpened !== void 0) {
                                  const _errs86 = errors2;
                                  if (false !== data1.nativeOpened) {
                                    const err87 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/3/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err87];
                                    } else {
                                      vErrors.push(err87);
                                    }
                                    errors2++;
                                  }
                                  var valid12 = _errs86 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                                if (valid12) {
                                  if (data1.rendered !== void 0) {
                                    const _errs87 = errors2;
                                    if (false !== data1.rendered) {
                                      const err88 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/3/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err88];
                                      } else {
                                        vErrors.push(err88);
                                      }
                                      errors2++;
                                    }
                                    var valid12 = _errs87 === errors2;
                                  } else {
                                    var valid12 = true;
                                  }
                                  if (valid12) {
                                    if (data1.recalculated !== void 0) {
                                      const _errs88 = errors2;
                                      if (false !== data1.recalculated) {
                                        const err89 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/3/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err89];
                                        } else {
                                          vErrors.push(err89);
                                        }
                                        errors2++;
                                      }
                                      var valid12 = _errs88 === errors2;
                                    } else {
                                      var valid12 = true;
                                    }
                                    if (valid12) {
                                      if (data1.members !== void 0) {
                                        let data48 = data1.members;
                                        const _errs89 = errors2;
                                        if (errors2 === _errs89) {
                                          if (Array.isArray(data48)) {
                                            if (data48.length > 5e3) {
                                              const err90 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/3/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                              if (vErrors === null) {
                                                vErrors = [err90];
                                              } else {
                                                vErrors.push(err90);
                                              }
                                              errors2++;
                                            } else {
                                              var valid13 = true;
                                              const len4 = data48.length;
                                              for (let i4 = 0; i4 < len4; i4++) {
                                                let data49 = data48[i4];
                                                const _errs91 = errors2;
                                                if (errors2 === _errs91) {
                                                  if (typeof data49 === "string") {
                                                    if (func2(data49) > 500) {
                                                      const err91 = { instancePath: instancePath + "/inspection/members/" + i4, schemaPath: "#/properties/inspection/oneOf/3/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err91];
                                                      } else {
                                                        vErrors.push(err91);
                                                      }
                                                      errors2++;
                                                    }
                                                  } else {
                                                    const err92 = { instancePath: instancePath + "/inspection/members/" + i4, schemaPath: "#/properties/inspection/oneOf/3/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err92];
                                                    } else {
                                                      vErrors.push(err92);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid13 = _errs91 === errors2;
                                                if (!valid13) {
                                                  break;
                                                }
                                              }
                                            }
                                          } else {
                                            const err93 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/3/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                            if (vErrors === null) {
                                              vErrors = [err93];
                                            } else {
                                              vErrors.push(err93);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid12 = _errs89 === errors2;
                                      } else {
                                        var valid12 = true;
                                      }
                                      if (valid12) {
                                        if (data1.details !== void 0) {
                                          let data50 = data1.details;
                                          const _errs93 = errors2;
                                          if (errors2 === _errs93) {
                                            if (data50 && typeof data50 == "object" && !Array.isArray(data50)) {
                                              let missing8;
                                              if (data50.slides === void 0 && (missing8 = "slides") || data50.editable === void 0 && (missing8 = "editable") || data50.visualInspection === void 0 && (missing8 = "visualInspection")) {
                                                const err94 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                                if (vErrors === null) {
                                                  vErrors = [err94];
                                                } else {
                                                  vErrors.push(err94);
                                                }
                                                errors2++;
                                              } else {
                                                const _errs95 = errors2;
                                                for (const key8 in data50) {
                                                  if (!(key8 === "slides" || key8 === "editable" || key8 === "visualInspection")) {
                                                    const err95 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                                    if (vErrors === null) {
                                                      vErrors = [err95];
                                                    } else {
                                                      vErrors.push(err95);
                                                    }
                                                    errors2++;
                                                    break;
                                                  }
                                                }
                                                if (_errs95 === errors2) {
                                                  if (data50.slides !== void 0) {
                                                    let data51 = data50.slides;
                                                    const _errs96 = errors2;
                                                    if (!(typeof data51 == "number" && (!(data51 % 1) && !isNaN(data51)) && isFinite(data51))) {
                                                      const err96 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/slides/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err96];
                                                      } else {
                                                        vErrors.push(err96);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs96) {
                                                      if (typeof data51 == "number" && isFinite(data51)) {
                                                        if (data51 > 9007199254740991 || isNaN(data51)) {
                                                          const err97 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/slides/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err97];
                                                          } else {
                                                            vErrors.push(err97);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data51 < 0 || isNaN(data51)) {
                                                            const err98 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/slides/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                                                    var valid14 = _errs96 === errors2;
                                                  } else {
                                                    var valid14 = true;
                                                  }
                                                  if (valid14) {
                                                    if (data50.editable !== void 0) {
                                                      const _errs98 = errors2;
                                                      if (true !== data50.editable) {
                                                        const err99 = { instancePath: instancePath + "/inspection/details/editable", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/editable/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                        if (vErrors === null) {
                                                          vErrors = [err99];
                                                        } else {
                                                          vErrors.push(err99);
                                                        }
                                                        errors2++;
                                                      }
                                                      var valid14 = _errs98 === errors2;
                                                    } else {
                                                      var valid14 = true;
                                                    }
                                                    if (valid14) {
                                                      if (data50.visualInspection !== void 0) {
                                                        const _errs99 = errors2;
                                                        if ("pending" !== data50.visualInspection) {
                                                          const err100 = { instancePath: instancePath + "/inspection/details/visualInspection", schemaPath: "#/properties/inspection/oneOf/3/properties/details/properties/visualInspection/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err100];
                                                          } else {
                                                            vErrors.push(err100);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid14 = _errs99 === errors2;
                                                      } else {
                                                        var valid14 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              const err101 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/3/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                              if (vErrors === null) {
                                                vErrors = [err101];
                                              } else {
                                                vErrors.push(err101);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid12 = _errs93 === errors2;
                                        } else {
                                          var valid12 = true;
                                        }
                                        if (valid12) {
                                          if (data1.currentBytesVerified !== void 0) {
                                            const _errs100 = errors2;
                                            if (true !== data1.currentBytesVerified) {
                                              const err102 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/3/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            }
                                            var valid12 = _errs100 === errors2;
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
                      const err103 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err103];
                      } else {
                        vErrors.push(err103);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs78 === errors2;
                  if (_valid0 && valid1) {
                    valid1 = false;
                    passing0 = [passing0, 3];
                  } else {
                    if (_valid0) {
                      valid1 = true;
                      passing0 = 3;
                      if (props0 !== true) {
                        props0 = true;
                      }
                    }
                    const _errs101 = errors2;
                    if (errors2 === _errs101) {
                      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                        let missing9;
                        if (data1.sha256 === void 0 && (missing9 = "sha256") || data1.bytes === void 0 && (missing9 = "bytes") || data1.format === void 0 && (missing9 = "format") || data1.nativeOpened === void 0 && (missing9 = "nativeOpened") || data1.rendered === void 0 && (missing9 = "rendered") || data1.recalculated === void 0 && (missing9 = "recalculated") || data1.members === void 0 && (missing9 = "members") || data1.details === void 0 && (missing9 = "details") || data1.currentBytesVerified === void 0 && (missing9 = "currentBytesVerified")) {
                          const err104 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/4/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                          if (vErrors === null) {
                            vErrors = [err104];
                          } else {
                            vErrors.push(err104);
                          }
                          errors2++;
                        } else {
                          const _errs103 = errors2;
                          for (const key9 in data1) {
                            if (!func1.call(schema37.properties.inspection.oneOf[4].properties, key9)) {
                              const err105 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err105];
                              } else {
                                vErrors.push(err105);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs103 === errors2) {
                            if (data1.sha256 !== void 0) {
                              let data55 = data1.sha256;
                              const _errs104 = errors2;
                              if (errors2 === _errs104) {
                                if (typeof data55 === "string") {
                                  if (!pattern6.test(data55)) {
                                    const err106 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/4/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                    if (vErrors === null) {
                                      vErrors = [err106];
                                    } else {
                                      vErrors.push(err106);
                                    }
                                    errors2++;
                                  }
                                } else {
                                  const err107 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/4/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err107];
                                  } else {
                                    vErrors.push(err107);
                                  }
                                  errors2++;
                                }
                              }
                              var valid15 = _errs104 === errors2;
                            } else {
                              var valid15 = true;
                            }
                            if (valid15) {
                              if (data1.bytes !== void 0) {
                                let data56 = data1.bytes;
                                const _errs106 = errors2;
                                if (!(typeof data56 == "number" && (!(data56 % 1) && !isNaN(data56)) && isFinite(data56))) {
                                  const err108 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/4/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err108];
                                  } else {
                                    vErrors.push(err108);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs106) {
                                  if (typeof data56 == "number" && isFinite(data56)) {
                                    if (data56 > 9007199254740991 || isNaN(data56)) {
                                      const err109 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/4/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                      if (vErrors === null) {
                                        vErrors = [err109];
                                      } else {
                                        vErrors.push(err109);
                                      }
                                      errors2++;
                                    } else {
                                      if (data56 < 0 || isNaN(data56)) {
                                        const err110 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/4/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                        if (vErrors === null) {
                                          vErrors = [err110];
                                        } else {
                                          vErrors.push(err110);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                }
                                var valid15 = _errs106 === errors2;
                              } else {
                                var valid15 = true;
                              }
                              if (valid15) {
                                if (data1.format !== void 0) {
                                  const _errs108 = errors2;
                                  if ("zip" !== data1.format) {
                                    const err111 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/4/properties/format/const", keyword: "const", params: { allowedValue: "zip" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err111];
                                    } else {
                                      vErrors.push(err111);
                                    }
                                    errors2++;
                                  }
                                  var valid15 = _errs108 === errors2;
                                } else {
                                  var valid15 = true;
                                }
                                if (valid15) {
                                  if (data1.nativeOpened !== void 0) {
                                    const _errs109 = errors2;
                                    if (false !== data1.nativeOpened) {
                                      const err112 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/4/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err112];
                                      } else {
                                        vErrors.push(err112);
                                      }
                                      errors2++;
                                    }
                                    var valid15 = _errs109 === errors2;
                                  } else {
                                    var valid15 = true;
                                  }
                                  if (valid15) {
                                    if (data1.rendered !== void 0) {
                                      const _errs110 = errors2;
                                      if (false !== data1.rendered) {
                                        const err113 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/4/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err113];
                                        } else {
                                          vErrors.push(err113);
                                        }
                                        errors2++;
                                      }
                                      var valid15 = _errs110 === errors2;
                                    } else {
                                      var valid15 = true;
                                    }
                                    if (valid15) {
                                      if (data1.recalculated !== void 0) {
                                        const _errs111 = errors2;
                                        if (false !== data1.recalculated) {
                                          const err114 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/4/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err114];
                                          } else {
                                            vErrors.push(err114);
                                          }
                                          errors2++;
                                        }
                                        var valid15 = _errs111 === errors2;
                                      } else {
                                        var valid15 = true;
                                      }
                                      if (valid15) {
                                        if (data1.members !== void 0) {
                                          let data61 = data1.members;
                                          const _errs112 = errors2;
                                          if (errors2 === _errs112) {
                                            if (Array.isArray(data61)) {
                                              if (data61.length > 5e3) {
                                                const err115 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/4/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                                if (vErrors === null) {
                                                  vErrors = [err115];
                                                } else {
                                                  vErrors.push(err115);
                                                }
                                                errors2++;
                                              } else {
                                                var valid16 = true;
                                                const len5 = data61.length;
                                                for (let i5 = 0; i5 < len5; i5++) {
                                                  let data62 = data61[i5];
                                                  const _errs114 = errors2;
                                                  if (errors2 === _errs114) {
                                                    if (typeof data62 === "string") {
                                                      if (func2(data62) > 500) {
                                                        const err116 = { instancePath: instancePath + "/inspection/members/" + i5, schemaPath: "#/properties/inspection/oneOf/4/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err116];
                                                        } else {
                                                          vErrors.push(err116);
                                                        }
                                                        errors2++;
                                                      }
                                                    } else {
                                                      const err117 = { instancePath: instancePath + "/inspection/members/" + i5, schemaPath: "#/properties/inspection/oneOf/4/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                      if (vErrors === null) {
                                                        vErrors = [err117];
                                                      } else {
                                                        vErrors.push(err117);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid16 = _errs114 === errors2;
                                                  if (!valid16) {
                                                    break;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err118 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/4/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                              if (vErrors === null) {
                                                vErrors = [err118];
                                              } else {
                                                vErrors.push(err118);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid15 = _errs112 === errors2;
                                        } else {
                                          var valid15 = true;
                                        }
                                        if (valid15) {
                                          if (data1.details !== void 0) {
                                            let data63 = data1.details;
                                            const _errs116 = errors2;
                                            if (errors2 === _errs116) {
                                              if (data63 && typeof data63 == "object" && !Array.isArray(data63)) {
                                                let missing10;
                                                if (data63.rows === void 0 && (missing10 = "rows") || data63.columns === void 0 && (missing10 = "columns") || data63.chart === void 0 && (missing10 = "chart")) {
                                                  const err119 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/4/properties/details/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                                                  if (vErrors === null) {
                                                    vErrors = [err119];
                                                  } else {
                                                    vErrors.push(err119);
                                                  }
                                                  errors2++;
                                                } else {
                                                  const _errs118 = errors2;
                                                  for (const key10 in data63) {
                                                    if (!(key10 === "rows" || key10 === "columns" || key10 === "chart")) {
                                                      const err120 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/4/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                                      if (vErrors === null) {
                                                        vErrors = [err120];
                                                      } else {
                                                        vErrors.push(err120);
                                                      }
                                                      errors2++;
                                                      break;
                                                    }
                                                  }
                                                  if (_errs118 === errors2) {
                                                    if (data63.rows !== void 0) {
                                                      let data64 = data63.rows;
                                                      const _errs119 = errors2;
                                                      if (!(typeof data64 == "number" && (!(data64 % 1) && !isNaN(data64)) && isFinite(data64))) {
                                                        const err121 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/rows/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err121];
                                                        } else {
                                                          vErrors.push(err121);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs119) {
                                                        if (typeof data64 == "number" && isFinite(data64)) {
                                                          if (data64 > 9007199254740991 || isNaN(data64)) {
                                                            const err122 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/rows/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err122];
                                                            } else {
                                                              vErrors.push(err122);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data64 < 0 || isNaN(data64)) {
                                                              const err123 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/rows/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err123];
                                                              } else {
                                                                vErrors.push(err123);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid17 = _errs119 === errors2;
                                                    } else {
                                                      var valid17 = true;
                                                    }
                                                    if (valid17) {
                                                      if (data63.columns !== void 0) {
                                                        let data65 = data63.columns;
                                                        const _errs121 = errors2;
                                                        if (errors2 === _errs121) {
                                                          if (Array.isArray(data65)) {
                                                            if (data65.length > 200) {
                                                              const err124 = { instancePath: instancePath + "/inspection/details/columns", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/columns/maxItems", keyword: "maxItems", params: { limit: 200 }, message: "must NOT have more than 200 items" };
                                                              if (vErrors === null) {
                                                                vErrors = [err124];
                                                              } else {
                                                                vErrors.push(err124);
                                                              }
                                                              errors2++;
                                                            } else {
                                                              var valid18 = true;
                                                              const len6 = data65.length;
                                                              for (let i6 = 0; i6 < len6; i6++) {
                                                                const _errs123 = errors2;
                                                                if (typeof data65[i6] !== "string") {
                                                                  const err125 = { instancePath: instancePath + "/inspection/details/columns/" + i6, schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/columns/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err125];
                                                                  } else {
                                                                    vErrors.push(err125);
                                                                  }
                                                                  errors2++;
                                                                }
                                                                var valid18 = _errs123 === errors2;
                                                                if (!valid18) {
                                                                  break;
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            const err126 = { instancePath: instancePath + "/inspection/details/columns", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/columns/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                            if (vErrors === null) {
                                                              vErrors = [err126];
                                                            } else {
                                                              vErrors.push(err126);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                        var valid17 = _errs121 === errors2;
                                                      } else {
                                                        var valid17 = true;
                                                      }
                                                      if (valid17) {
                                                        if (data63.chart !== void 0) {
                                                          const _errs125 = errors2;
                                                          if (typeof data63.chart !== "boolean") {
                                                            const err127 = { instancePath: instancePath + "/inspection/details/chart", schemaPath: "#/properties/inspection/oneOf/4/properties/details/properties/chart/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                                            if (vErrors === null) {
                                                              vErrors = [err127];
                                                            } else {
                                                              vErrors.push(err127);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid17 = _errs125 === errors2;
                                                        } else {
                                                          var valid17 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                const err128 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/4/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                                if (vErrors === null) {
                                                  vErrors = [err128];
                                                } else {
                                                  vErrors.push(err128);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid15 = _errs116 === errors2;
                                          } else {
                                            var valid15 = true;
                                          }
                                          if (valid15) {
                                            if (data1.currentBytesVerified !== void 0) {
                                              const _errs127 = errors2;
                                              if (true !== data1.currentBytesVerified) {
                                                const err129 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/4/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                if (vErrors === null) {
                                                  vErrors = [err129];
                                                } else {
                                                  vErrors.push(err129);
                                                }
                                                errors2++;
                                              }
                                              var valid15 = _errs127 === errors2;
                                            } else {
                                              var valid15 = true;
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
                        const err130 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err130];
                        } else {
                          vErrors.push(err130);
                        }
                        errors2++;
                      }
                    }
                    var _valid0 = _errs101 === errors2;
                    if (_valid0 && valid1) {
                      valid1 = false;
                      passing0 = [passing0, 4];
                    } else {
                      if (_valid0) {
                        valid1 = true;
                        passing0 = 4;
                        if (props0 !== true) {
                          props0 = true;
                        }
                      }
                      const _errs128 = errors2;
                      if (errors2 === _errs128) {
                        if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                          let missing11;
                          if (data1.sha256 === void 0 && (missing11 = "sha256") || data1.bytes === void 0 && (missing11 = "bytes") || data1.format === void 0 && (missing11 = "format") || data1.nativeOpened === void 0 && (missing11 = "nativeOpened") || data1.rendered === void 0 && (missing11 = "rendered") || data1.recalculated === void 0 && (missing11 = "recalculated") || data1.members === void 0 && (missing11 = "members") || data1.details === void 0 && (missing11 = "details") || data1.currentBytesVerified === void 0 && (missing11 = "currentBytesVerified")) {
                            const err131 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/5/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" };
                            if (vErrors === null) {
                              vErrors = [err131];
                            } else {
                              vErrors.push(err131);
                            }
                            errors2++;
                          } else {
                            const _errs130 = errors2;
                            for (const key11 in data1) {
                              if (!func1.call(schema37.properties.inspection.oneOf[5].properties, key11)) {
                                const err132 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err132];
                                } else {
                                  vErrors.push(err132);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs130 === errors2) {
                              if (data1.sha256 !== void 0) {
                                let data69 = data1.sha256;
                                const _errs131 = errors2;
                                if (errors2 === _errs131) {
                                  if (typeof data69 === "string") {
                                    if (!pattern6.test(data69)) {
                                      const err133 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/5/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                      if (vErrors === null) {
                                        vErrors = [err133];
                                      } else {
                                        vErrors.push(err133);
                                      }
                                      errors2++;
                                    }
                                  } else {
                                    const err134 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/properties/inspection/oneOf/5/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err134];
                                    } else {
                                      vErrors.push(err134);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid19 = _errs131 === errors2;
                              } else {
                                var valid19 = true;
                              }
                              if (valid19) {
                                if (data1.bytes !== void 0) {
                                  let data70 = data1.bytes;
                                  const _errs133 = errors2;
                                  if (!(typeof data70 == "number" && (!(data70 % 1) && !isNaN(data70)) && isFinite(data70))) {
                                    const err135 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/5/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err135];
                                    } else {
                                      vErrors.push(err135);
                                    }
                                    errors2++;
                                  }
                                  if (errors2 === _errs133) {
                                    if (typeof data70 == "number" && isFinite(data70)) {
                                      if (data70 > 9007199254740991 || isNaN(data70)) {
                                        const err136 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/5/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                        if (vErrors === null) {
                                          vErrors = [err136];
                                        } else {
                                          vErrors.push(err136);
                                        }
                                        errors2++;
                                      } else {
                                        if (data70 < 0 || isNaN(data70)) {
                                          const err137 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/properties/inspection/oneOf/5/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                          if (vErrors === null) {
                                            vErrors = [err137];
                                          } else {
                                            vErrors.push(err137);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                  var valid19 = _errs133 === errors2;
                                } else {
                                  var valid19 = true;
                                }
                                if (valid19) {
                                  if (data1.format !== void 0) {
                                    const _errs135 = errors2;
                                    if ("pdf" !== data1.format) {
                                      const err138 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/properties/inspection/oneOf/5/properties/format/const", keyword: "const", params: { allowedValue: "pdf" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err138];
                                      } else {
                                        vErrors.push(err138);
                                      }
                                      errors2++;
                                    }
                                    var valid19 = _errs135 === errors2;
                                  } else {
                                    var valid19 = true;
                                  }
                                  if (valid19) {
                                    if (data1.nativeOpened !== void 0) {
                                      const _errs136 = errors2;
                                      if (false !== data1.nativeOpened) {
                                        const err139 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/properties/inspection/oneOf/5/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err139];
                                        } else {
                                          vErrors.push(err139);
                                        }
                                        errors2++;
                                      }
                                      var valid19 = _errs136 === errors2;
                                    } else {
                                      var valid19 = true;
                                    }
                                    if (valid19) {
                                      if (data1.rendered !== void 0) {
                                        const _errs137 = errors2;
                                        if (false !== data1.rendered) {
                                          const err140 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/properties/inspection/oneOf/5/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err140];
                                          } else {
                                            vErrors.push(err140);
                                          }
                                          errors2++;
                                        }
                                        var valid19 = _errs137 === errors2;
                                      } else {
                                        var valid19 = true;
                                      }
                                      if (valid19) {
                                        if (data1.recalculated !== void 0) {
                                          const _errs138 = errors2;
                                          if (false !== data1.recalculated) {
                                            const err141 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/properties/inspection/oneOf/5/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                            if (vErrors === null) {
                                              vErrors = [err141];
                                            } else {
                                              vErrors.push(err141);
                                            }
                                            errors2++;
                                          }
                                          var valid19 = _errs138 === errors2;
                                        } else {
                                          var valid19 = true;
                                        }
                                        if (valid19) {
                                          if (data1.members !== void 0) {
                                            let data75 = data1.members;
                                            const _errs139 = errors2;
                                            if (errors2 === _errs139) {
                                              if (Array.isArray(data75)) {
                                                if (data75.length > 5e3) {
                                                  const err142 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/5/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                                  if (vErrors === null) {
                                                    vErrors = [err142];
                                                  } else {
                                                    vErrors.push(err142);
                                                  }
                                                  errors2++;
                                                } else {
                                                  var valid20 = true;
                                                  const len7 = data75.length;
                                                  for (let i7 = 0; i7 < len7; i7++) {
                                                    let data76 = data75[i7];
                                                    const _errs141 = errors2;
                                                    if (errors2 === _errs141) {
                                                      if (typeof data76 === "string") {
                                                        if (func2(data76) > 500) {
                                                          const err143 = { instancePath: instancePath + "/inspection/members/" + i7, schemaPath: "#/properties/inspection/oneOf/5/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                          if (vErrors === null) {
                                                            vErrors = [err143];
                                                          } else {
                                                            vErrors.push(err143);
                                                          }
                                                          errors2++;
                                                        }
                                                      } else {
                                                        const err144 = { instancePath: instancePath + "/inspection/members/" + i7, schemaPath: "#/properties/inspection/oneOf/5/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                        if (vErrors === null) {
                                                          vErrors = [err144];
                                                        } else {
                                                          vErrors.push(err144);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid20 = _errs141 === errors2;
                                                    if (!valid20) {
                                                      break;
                                                    }
                                                  }
                                                }
                                              } else {
                                                const err145 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/properties/inspection/oneOf/5/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                if (vErrors === null) {
                                                  vErrors = [err145];
                                                } else {
                                                  vErrors.push(err145);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid19 = _errs139 === errors2;
                                          } else {
                                            var valid19 = true;
                                          }
                                          if (valid19) {
                                            if (data1.details !== void 0) {
                                              let data77 = data1.details;
                                              const _errs143 = errors2;
                                              if (errors2 === _errs143) {
                                                if (data77 && typeof data77 == "object" && !Array.isArray(data77)) {
                                                  let missing12;
                                                  if (data77.conversionCompleted === void 0 && (missing12 = "conversionCompleted") || data77.renderInspection === void 0 && (missing12 = "renderInspection") || data77.sourceDocxSha256 === void 0 && (missing12 = "sourceDocxSha256")) {
                                                    const err146 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/5/properties/details/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" };
                                                    if (vErrors === null) {
                                                      vErrors = [err146];
                                                    } else {
                                                      vErrors.push(err146);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    const _errs145 = errors2;
                                                    for (const key12 in data77) {
                                                      if (!(key12 === "conversionCompleted" || key12 === "renderInspection" || key12 === "sourceDocxSha256")) {
                                                        const err147 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/5/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" };
                                                        if (vErrors === null) {
                                                          vErrors = [err147];
                                                        } else {
                                                          vErrors.push(err147);
                                                        }
                                                        errors2++;
                                                        break;
                                                      }
                                                    }
                                                    if (_errs145 === errors2) {
                                                      if (data77.conversionCompleted !== void 0) {
                                                        const _errs146 = errors2;
                                                        if (true !== data77.conversionCompleted) {
                                                          const err148 = { instancePath: instancePath + "/inspection/details/conversionCompleted", schemaPath: "#/properties/inspection/oneOf/5/properties/details/properties/conversionCompleted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err148];
                                                          } else {
                                                            vErrors.push(err148);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid21 = _errs146 === errors2;
                                                      } else {
                                                        var valid21 = true;
                                                      }
                                                      if (valid21) {
                                                        if (data77.renderInspection !== void 0) {
                                                          const _errs147 = errors2;
                                                          if ("pending" !== data77.renderInspection) {
                                                            const err149 = { instancePath: instancePath + "/inspection/details/renderInspection", schemaPath: "#/properties/inspection/oneOf/5/properties/details/properties/renderInspection/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" };
                                                            if (vErrors === null) {
                                                              vErrors = [err149];
                                                            } else {
                                                              vErrors.push(err149);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid21 = _errs147 === errors2;
                                                        } else {
                                                          var valid21 = true;
                                                        }
                                                        if (valid21) {
                                                          if (data77.sourceDocxSha256 !== void 0) {
                                                            let data80 = data77.sourceDocxSha256;
                                                            const _errs148 = errors2;
                                                            if (errors2 === _errs148) {
                                                              if (typeof data80 === "string") {
                                                                if (!pattern6.test(data80)) {
                                                                  const err150 = { instancePath: instancePath + "/inspection/details/sourceDocxSha256", schemaPath: "#/properties/inspection/oneOf/5/properties/details/properties/sourceDocxSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err150];
                                                                  } else {
                                                                    vErrors.push(err150);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              } else {
                                                                const err151 = { instancePath: instancePath + "/inspection/details/sourceDocxSha256", schemaPath: "#/properties/inspection/oneOf/5/properties/details/properties/sourceDocxSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                if (vErrors === null) {
                                                                  vErrors = [err151];
                                                                } else {
                                                                  vErrors.push(err151);
                                                                }
                                                                errors2++;
                                                              }
                                                            }
                                                            var valid21 = _errs148 === errors2;
                                                          } else {
                                                            var valid21 = true;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                } else {
                                                  const err152 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/properties/inspection/oneOf/5/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                                  if (vErrors === null) {
                                                    vErrors = [err152];
                                                  } else {
                                                    vErrors.push(err152);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid19 = _errs143 === errors2;
                                            } else {
                                              var valid19 = true;
                                            }
                                            if (valid19) {
                                              if (data1.currentBytesVerified !== void 0) {
                                                const _errs150 = errors2;
                                                if (true !== data1.currentBytesVerified) {
                                                  const err153 = { instancePath: instancePath + "/inspection/currentBytesVerified", schemaPath: "#/properties/inspection/oneOf/5/properties/currentBytesVerified/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err153];
                                                  } else {
                                                    vErrors.push(err153);
                                                  }
                                                  errors2++;
                                                }
                                                var valid19 = _errs150 === errors2;
                                              } else {
                                                var valid19 = true;
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
                          const err154 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err154];
                          } else {
                            vErrors.push(err154);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs128 === errors2;
                      if (_valid0 && valid1) {
                        valid1 = false;
                        passing0 = [passing0, 5];
                      } else {
                        if (_valid0) {
                          valid1 = true;
                          passing0 = 5;
                          if (props0 !== true) {
                            props0 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
              if (!valid1) {
                const err155 = { instancePath: instancePath + "/inspection", schemaPath: "#/properties/inspection/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                if (vErrors === null) {
                  vErrors = [err155];
                } else {
                  vErrors.push(err155);
                }
                errors2++;
                validate37.errors = vErrors;
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
          }
        }
      }
    } else {
      validate37.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate37.errors = vErrors;
  return errors2 === 0;
}
validate37.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateError = validate39;
var schema47 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["ACCESS_DENIED", "ARTIFACT_BUDGET_RESERVATION_UNKNOWN", "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN", "ARTIFACT_CANCELLED", "ARTIFACT_DEADLINE", "ARTIFACT_EFFECT_UNKNOWN", "ARTIFACT_PREVIEW_PENDING", "ARTIFACT_PREVIEW_UNSUPPORTED", "ARTIFACT_RENDERER_UNAVAILABLE", "CANCELLED", "DEADLINE", "DOCUMENT_CLOCK", "DOCUMENT_CONFIGURATION", "DOCUMENT_READ_BUDGET_REFUSED", "DOCUMENT_REFUSED", "DOCUMENT_RESPONSE_LIMIT", "DOCUMENT_RESULT_REFUSED", "INVALID_BODY", "INVALID_CONTENT_LENGTH", "INVALID_JSON", "INVALID_REQUEST", "METHOD_NOT_ALLOWED", "NOT_FOUND", "PREVIEW_UNAVAILABLE", "REQUEST_FAILED", "REQUEST_TOO_LARGE", "SESSION_REFUSED", "UNAUTHENTICATED", "UNAVAILABLE", "UNSUPPORTED_DOCUMENT_FORMAT", "UNSUPPORTED_MEDIA_TYPE"] }, "outcome": { "enum": ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED", "READ_UNAVAILABLE"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
function validate39(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate39.evaluated;
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
        validate39.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate39.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate39.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate39.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (!(data1 === "ACCESS_DENIED" || data1 === "ARTIFACT_BUDGET_RESERVATION_UNKNOWN" || data1 === "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN" || data1 === "ARTIFACT_CANCELLED" || data1 === "ARTIFACT_DEADLINE" || data1 === "ARTIFACT_EFFECT_UNKNOWN" || data1 === "ARTIFACT_PREVIEW_PENDING" || data1 === "ARTIFACT_PREVIEW_UNSUPPORTED" || data1 === "ARTIFACT_RENDERER_UNAVAILABLE" || data1 === "CANCELLED" || data1 === "DEADLINE" || data1 === "DOCUMENT_CLOCK" || data1 === "DOCUMENT_CONFIGURATION" || data1 === "DOCUMENT_READ_BUDGET_REFUSED" || data1 === "DOCUMENT_REFUSED" || data1 === "DOCUMENT_RESPONSE_LIMIT" || data1 === "DOCUMENT_RESULT_REFUSED" || data1 === "INVALID_BODY" || data1 === "INVALID_CONTENT_LENGTH" || data1 === "INVALID_JSON" || data1 === "INVALID_REQUEST" || data1 === "METHOD_NOT_ALLOWED" || data1 === "NOT_FOUND" || data1 === "PREVIEW_UNAVAILABLE" || data1 === "REQUEST_FAILED" || data1 === "REQUEST_TOO_LARGE" || data1 === "SESSION_REFUSED" || data1 === "UNAUTHENTICATED" || data1 === "UNAVAILABLE" || data1 === "UNSUPPORTED_DOCUMENT_FORMAT" || data1 === "UNSUPPORTED_MEDIA_TYPE")) {
                        validate39.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema47.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
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
                          validate39.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema47.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
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
                validate39.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate39.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate39.errors = vErrors;
  return errors2 === 0;
}
validate39.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// document-access-generated:./generated-status.mjs
var errorStatuses = { "ACCESS_DENIED": 403, "ARTIFACT_BUDGET_RESERVATION_UNKNOWN": 502, "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN": 502, "ARTIFACT_CANCELLED": 499, "ARTIFACT_DEADLINE": 408, "ARTIFACT_EFFECT_UNKNOWN": 502, "ARTIFACT_PREVIEW_PENDING": 409, "ARTIFACT_PREVIEW_UNSUPPORTED": 422, "ARTIFACT_RENDERER_UNAVAILABLE": 503, "CANCELLED": 499, "DEADLINE": 408, "DOCUMENT_CLOCK": 500, "DOCUMENT_CONFIGURATION": 500, "DOCUMENT_READ_BUDGET_REFUSED": 500, "DOCUMENT_REFUSED": 502, "DOCUMENT_RESPONSE_LIMIT": 413, "DOCUMENT_RESULT_REFUSED": 502, "INVALID_BODY": 400, "INVALID_CONTENT_LENGTH": 400, "INVALID_JSON": 400, "INVALID_REQUEST": 400, "METHOD_NOT_ALLOWED": 405, "NOT_FOUND": 404, "PREVIEW_UNAVAILABLE": 503, "REQUEST_FAILED": 502, "REQUEST_TOO_LARGE": 413, "SESSION_REFUSED": 403, "UNAUTHENTICATED": 401, "UNAVAILABLE": 503, "UNSUPPORTED_DOCUMENT_FORMAT": 422, "UNSUPPORTED_MEDIA_TYPE": 415 };

// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });

// document-access-application/schema.mjs
var DOCUMENT_ACCESS_SCHEMA_ID = "urn:meri:document-access-application:0.1.0";
var DOCUMENT_ACCESS_FORMATS = Object.freeze(Object.keys(ARTIFACT_MIME_TYPES));

// document-access-application/protocol.mjs
var documentAccessVersion = "0.1.0";
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var createDocumentAccessMetadata = ({ formats, mimeTypes, previewFormats, operationFormats, errorStatuses: errorStatuses2 }) => freeze({
  contractVersion: documentAccessVersion,
  schemaId: DOCUMENT_ACCESS_SCHEMA_ID,
  routes: { inspect: { method: "POST", path: "/api/documents/inspect", response: "json" }, download: { method: "POST", path: "/api/documents/download", response: "bytes" } },
  formats,
  mimeTypes,
  previewFormats,
  operationFormats,
  errorStatuses: errorStatuses2,
  semantics: {
    inspection: "structural facts about one exact stored version; nativeOpened, rendered and recalculated are always false, pptx visualInspection and pdf renderInspection are always pending, so no inspection describes a rendered or visually checked file",
    download: "a download is admitted only for a version this receiver admitted from an inspect answer in the same session of use; inspect first, never a link or bytes alone",
    preview: "previewFormats are the only formats the artifact preview owner will render (any other format answers ARTIFACT_PREVIEW_UNSUPPORTED); every previewFormat except pdf also needs a qualified converter or answers ARTIFACT_RENDERER_UNAVAILABLE; this contract carries no preview route and no renderer qualification",
    statuses: "the document application releases only generationStatus draft and previewStatus pending, so previewStatus never reports unsupported or validated here",
    composition: "a document application instance is composed with one operation descriptor (operationFormats) and answers DOCUMENT_RESULT_REFUSED for versions of formats outside it; which descriptor serves a conversation is a composition fact this contract cannot assert",
    integration: "isolated source contract; mounting, Core authority wiring and renderer qualification remain handoff work"
  }
});

// document-access-generated:./generated-protocol.mjs
var documentAccessMetadata = createDocumentAccessMetadata({ "formats": ["docx", "txt", "xlsx", "pptx", "pdf", "zip"], "mimeTypes": { "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt": "text/plain; charset=utf-8", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pdf": "application/pdf", "zip": "application/zip" }, "previewFormats": ["docx", "xlsx", "pptx", "pdf"], "operationFormats": { "create_word": ["docx", "txt"], "create_word_with_pdf": ["docx", "txt", "pdf"], "create_excel": ["xlsx"], "create_powerpoint": ["pptx"], "run_analysis": ["zip"] }, "errorStatuses": { "ACCESS_DENIED": 403, "ARTIFACT_BUDGET_RESERVATION_UNKNOWN": 502, "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN": 502, "ARTIFACT_CANCELLED": 499, "ARTIFACT_DEADLINE": 408, "ARTIFACT_EFFECT_UNKNOWN": 502, "ARTIFACT_PREVIEW_PENDING": 409, "ARTIFACT_PREVIEW_UNSUPPORTED": 422, "ARTIFACT_RENDERER_UNAVAILABLE": 503, "CANCELLED": 499, "DEADLINE": 408, "DOCUMENT_CLOCK": 500, "DOCUMENT_CONFIGURATION": 500, "DOCUMENT_READ_BUDGET_REFUSED": 500, "DOCUMENT_REFUSED": 502, "DOCUMENT_RESPONSE_LIMIT": 413, "DOCUMENT_RESULT_REFUSED": 502, "INVALID_BODY": 400, "INVALID_CONTENT_LENGTH": 400, "INVALID_JSON": 400, "INVALID_REQUEST": 400, "METHOD_NOT_ALLOWED": 405, "NOT_FOUND": 404, "PREVIEW_UNAVAILABLE": 503, "REQUEST_FAILED": 502, "REQUEST_TOO_LARGE": 413, "SESSION_REFUSED": 403, "UNAUTHENTICATED": 401, "UNAVAILABLE": 503, "UNSUPPORTED_DOCUMENT_FORMAT": 422, "UNSUPPORTED_MEDIA_TYPE": 415 } });

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
  if (redirected || status !== 200 || header("content-type") !== version.mimeType || header("content-disposition") !== `attachment; filename="${version.filename}"` || header("content-length") !== String(version.object.bytes) || header("cache-control") !== "no-store" || header("x-content-type-options") !== "nosniff" || header("content-encoding") !== null) fail("DOWNLOAD_HEADERS");
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

// document-access-application/document-access-application-receiver.mjs
var validators = Object.freeze({ inspect: validateInspectRequest, download: validateDownloadRequest });
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
  if (!validateInspection(result)) fail("INVALID_RESPONSE");
  const { version, inspection } = result;
  if (version.object.bytes > 16 * 1024 * 1024 || !same(version.scopes, version.object.scopes) || version.scopes.some((x) => x.tenantId !== version.binding.tenantId)) fail("VERSION_SCOPE_OR_SIZE");
  const scopeKeys = new Set(version.scopes.map(canonicalize));
  if (version.evidence.some((e) => e.scopes.some((s) => !scopeKeys.has(canonicalize(s))))) fail("EVIDENCE_SCOPE");
  if (inspection.sha256 !== version.object.sha256 || inspection.bytes !== version.object.bytes || version.mimeType !== ARTIFACT_MIME_TYPES[inspection.format] || !version.filename.endsWith("." + inspection.format)) fail("INSPECTION_MISMATCH");
  if (version.versionId !== request.versionId) fail("VERSION_MISMATCH");
  admittedVersions.add(version);
  return result;
}
export {
  DocumentResponseError,
  documentAccessMetadata,
  documentAccessVersion,
  receiveDocumentDownload,
  receiveDocumentRequest,
  receiveDocumentResponse
};
