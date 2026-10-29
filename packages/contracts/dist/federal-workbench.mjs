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

// federal:validator
var validateSource = validate67;
var schema33 = { "type": "object", "properties": { "documentId": { "type": "string", "minLength": 1, "maxLength": 512 }, "publisher": { "type": "string", "minLength": 1, "maxLength": 512 }, "sourceVersion": { "type": "string", "minLength": 1, "maxLength": 512 }, "sourceUrl": { "type": "string", "minLength": 1, "maxLength": 2048 }, "publishedAt": { "anyOf": [{ "type": "string", "format": "date" }, { "type": "null" }] }, "parserVersion": { "const": "federal-plain-text/1" }, "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "text": { "type": "string", "minLength": 1, "maxLength": 131072 }, "coverage": { "type": "object", "properties": { "complete": { "type": "boolean" }, "limitations": { "type": "array", "items": { "type": "string", "minLength": 1, "maxLength": 1e3 }, "minItems": 1, "maxItems": 32 } }, "required": ["complete", "limitations"], "additionalProperties": false }, "scopes": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, "label": { "type": "string", "minLength": 1, "maxLength": 512 }, "start": { "type": "integer", "minimum": 0 }, "end": { "type": "integer", "minimum": 1 }, "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["id", "label", "start", "end", "sha256"], "additionalProperties": false }, "minItems": 1, "maxItems": 128 } }, "required": ["documentId", "publisher", "sourceVersion", "sourceUrl", "publishedAt", "parserVersion", "sha256", "text", "coverage", "scopes"], "additionalProperties": false };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var formats0 = require_formats().fullFormats.date;
var pattern4 = new RegExp("^[a-f0-9]{64}$", "u");
var pattern5 = new RegExp("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$", "u");
function validate67(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate67.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.documentId === void 0 && (missing0 = "documentId") || data.publisher === void 0 && (missing0 = "publisher") || data.sourceVersion === void 0 && (missing0 = "sourceVersion") || data.sourceUrl === void 0 && (missing0 = "sourceUrl") || data.publishedAt === void 0 && (missing0 = "publishedAt") || data.parserVersion === void 0 && (missing0 = "parserVersion") || data.sha256 === void 0 && (missing0 = "sha256") || data.text === void 0 && (missing0 = "text") || data.coverage === void 0 && (missing0 = "coverage") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate67.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema33.properties, key0)) {
            validate67.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.documentId !== void 0) {
            let data0 = data.documentId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (func2(data0) > 512) {
                  validate67.errors = [{ instancePath: instancePath + "/documentId", schemaPath: "#/properties/documentId/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                  return false;
                } else {
                  if (func2(data0) < 1) {
                    validate67.errors = [{ instancePath: instancePath + "/documentId", schemaPath: "#/properties/documentId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate67.errors = [{ instancePath: instancePath + "/documentId", schemaPath: "#/properties/documentId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.publisher !== void 0) {
              let data1 = data.publisher;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func2(data1) > 512) {
                    validate67.errors = [{ instancePath: instancePath + "/publisher", schemaPath: "#/properties/publisher/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                    return false;
                  } else {
                    if (func2(data1) < 1) {
                      validate67.errors = [{ instancePath: instancePath + "/publisher", schemaPath: "#/properties/publisher/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate67.errors = [{ instancePath: instancePath + "/publisher", schemaPath: "#/properties/publisher/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.sourceVersion !== void 0) {
                let data2 = data.sourceVersion;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (typeof data2 === "string") {
                    if (func2(data2) > 512) {
                      validate67.errors = [{ instancePath: instancePath + "/sourceVersion", schemaPath: "#/properties/sourceVersion/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                      return false;
                    } else {
                      if (func2(data2) < 1) {
                        validate67.errors = [{ instancePath: instancePath + "/sourceVersion", schemaPath: "#/properties/sourceVersion/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                        return false;
                      }
                    }
                  } else {
                    validate67.errors = [{ instancePath: instancePath + "/sourceVersion", schemaPath: "#/properties/sourceVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.sourceUrl !== void 0) {
                  let data3 = data.sourceUrl;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (typeof data3 === "string") {
                      if (func2(data3) > 2048) {
                        validate67.errors = [{ instancePath: instancePath + "/sourceUrl", schemaPath: "#/properties/sourceUrl/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                        return false;
                      } else {
                        if (func2(data3) < 1) {
                          validate67.errors = [{ instancePath: instancePath + "/sourceUrl", schemaPath: "#/properties/sourceUrl/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                          return false;
                        }
                      }
                    } else {
                      validate67.errors = [{ instancePath: instancePath + "/sourceUrl", schemaPath: "#/properties/sourceUrl/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.publishedAt !== void 0) {
                    let data4 = data.publishedAt;
                    const _errs10 = errors2;
                    const _errs11 = errors2;
                    let valid1 = false;
                    const _errs12 = errors2;
                    if (errors2 === _errs12) {
                      if (errors2 === _errs12) {
                        if (typeof data4 === "string") {
                          if (!formats0.validate(data4)) {
                            const err0 = { instancePath: instancePath + "/publishedAt", schemaPath: "#/properties/publishedAt/anyOf/0/format", keyword: "format", params: { format: "date" }, message: 'must match format "date"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          }
                        } else {
                          const err1 = { instancePath: instancePath + "/publishedAt", schemaPath: "#/properties/publishedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                    valid1 = valid1 || _valid0;
                    const _errs14 = errors2;
                    if (data4 !== null) {
                      const err2 = { instancePath: instancePath + "/publishedAt", schemaPath: "#/properties/publishedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err2];
                      } else {
                        vErrors.push(err2);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs14 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err3 = { instancePath: instancePath + "/publishedAt", schemaPath: "#/properties/publishedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err3];
                      } else {
                        vErrors.push(err3);
                      }
                      errors2++;
                      validate67.errors = vErrors;
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
                    if (data.parserVersion !== void 0) {
                      const _errs16 = errors2;
                      if ("federal-plain-text/1" !== data.parserVersion) {
                        validate67.errors = [{ instancePath: instancePath + "/parserVersion", schemaPath: "#/properties/parserVersion/const", keyword: "const", params: { allowedValue: "federal-plain-text/1" }, message: "must be equal to constant" }];
                        return false;
                      }
                      var valid0 = _errs16 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.sha256 !== void 0) {
                        let data6 = data.sha256;
                        const _errs17 = errors2;
                        if (errors2 === _errs17) {
                          if (typeof data6 === "string") {
                            if (!pattern4.test(data6)) {
                              validate67.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                              return false;
                            }
                          } else {
                            validate67.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs17 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.text !== void 0) {
                          let data7 = data.text;
                          const _errs19 = errors2;
                          if (errors2 === _errs19) {
                            if (typeof data7 === "string") {
                              if (func2(data7) > 131072) {
                                validate67.errors = [{ instancePath: instancePath + "/text", schemaPath: "#/properties/text/maxLength", keyword: "maxLength", params: { limit: 131072 }, message: "must NOT have more than 131072 characters" }];
                                return false;
                              } else {
                                if (func2(data7) < 1) {
                                  validate67.errors = [{ instancePath: instancePath + "/text", schemaPath: "#/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate67.errors = [{ instancePath: instancePath + "/text", schemaPath: "#/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid0 = _errs19 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.coverage !== void 0) {
                            let data8 = data.coverage;
                            const _errs21 = errors2;
                            if (errors2 === _errs21) {
                              if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                                let missing1;
                                if (data8.complete === void 0 && (missing1 = "complete") || data8.limitations === void 0 && (missing1 = "limitations")) {
                                  validate67.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs23 = errors2;
                                  for (const key1 in data8) {
                                    if (!(key1 === "complete" || key1 === "limitations")) {
                                      validate67.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs23 === errors2) {
                                    if (data8.complete !== void 0) {
                                      const _errs24 = errors2;
                                      if (typeof data8.complete !== "boolean") {
                                        validate67.errors = [{ instancePath: instancePath + "/coverage/complete", schemaPath: "#/properties/coverage/properties/complete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                        return false;
                                      }
                                      var valid2 = _errs24 === errors2;
                                    } else {
                                      var valid2 = true;
                                    }
                                    if (valid2) {
                                      if (data8.limitations !== void 0) {
                                        let data10 = data8.limitations;
                                        const _errs26 = errors2;
                                        if (errors2 === _errs26) {
                                          if (Array.isArray(data10)) {
                                            if (data10.length > 32) {
                                              validate67.errors = [{ instancePath: instancePath + "/coverage/limitations", schemaPath: "#/properties/coverage/properties/limitations/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                                              return false;
                                            } else {
                                              if (data10.length < 1) {
                                                validate67.errors = [{ instancePath: instancePath + "/coverage/limitations", schemaPath: "#/properties/coverage/properties/limitations/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                return false;
                                              } else {
                                                var valid3 = true;
                                                const len0 = data10.length;
                                                for (let i0 = 0; i0 < len0; i0++) {
                                                  let data11 = data10[i0];
                                                  const _errs28 = errors2;
                                                  if (errors2 === _errs28) {
                                                    if (typeof data11 === "string") {
                                                      if (func2(data11) > 1e3) {
                                                        validate67.errors = [{ instancePath: instancePath + "/coverage/limitations/" + i0, schemaPath: "#/properties/coverage/properties/limitations/items/maxLength", keyword: "maxLength", params: { limit: 1e3 }, message: "must NOT have more than 1000 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func2(data11) < 1) {
                                                          validate67.errors = [{ instancePath: instancePath + "/coverage/limitations/" + i0, schemaPath: "#/properties/coverage/properties/limitations/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate67.errors = [{ instancePath: instancePath + "/coverage/limitations/" + i0, schemaPath: "#/properties/coverage/properties/limitations/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid3 = _errs28 === errors2;
                                                  if (!valid3) {
                                                    break;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate67.errors = [{ instancePath: instancePath + "/coverage/limitations", schemaPath: "#/properties/coverage/properties/limitations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                            return false;
                                          }
                                        }
                                        var valid2 = _errs26 === errors2;
                                      } else {
                                        var valid2 = true;
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate67.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid0 = _errs21 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.scopes !== void 0) {
                              let data12 = data.scopes;
                              const _errs30 = errors2;
                              if (errors2 === _errs30) {
                                if (Array.isArray(data12)) {
                                  if (data12.length > 128) {
                                    validate67.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                                    return false;
                                  } else {
                                    if (data12.length < 1) {
                                      validate67.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                      return false;
                                    } else {
                                      var valid4 = true;
                                      const len1 = data12.length;
                                      for (let i1 = 0; i1 < len1; i1++) {
                                        let data13 = data12[i1];
                                        const _errs32 = errors2;
                                        if (errors2 === _errs32) {
                                          if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
                                            let missing2;
                                            if (data13.id === void 0 && (missing2 = "id") || data13.label === void 0 && (missing2 = "label") || data13.start === void 0 && (missing2 = "start") || data13.end === void 0 && (missing2 = "end") || data13.sha256 === void 0 && (missing2 = "sha256")) {
                                              validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/properties/scopes/items/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                              return false;
                                            } else {
                                              const _errs34 = errors2;
                                              for (const key2 in data13) {
                                                if (!(key2 === "id" || key2 === "label" || key2 === "start" || key2 === "end" || key2 === "sha256")) {
                                                  validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/properties/scopes/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs34 === errors2) {
                                                if (data13.id !== void 0) {
                                                  let data14 = data13.id;
                                                  const _errs35 = errors2;
                                                  if (errors2 === _errs35) {
                                                    if (typeof data14 === "string") {
                                                      if (!pattern5.test(data14)) {
                                                        validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/id", schemaPath: "#/properties/scopes/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                                        return false;
                                                      }
                                                    } else {
                                                      validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/id", schemaPath: "#/properties/scopes/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid5 = _errs35 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data13.label !== void 0) {
                                                    let data15 = data13.label;
                                                    const _errs37 = errors2;
                                                    if (errors2 === _errs37) {
                                                      if (typeof data15 === "string") {
                                                        if (func2(data15) > 512) {
                                                          validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/label", schemaPath: "#/properties/scopes/items/properties/label/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func2(data15) < 1) {
                                                            validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/label", schemaPath: "#/properties/scopes/items/properties/label/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/label", schemaPath: "#/properties/scopes/items/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid5 = _errs37 === errors2;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data13.start !== void 0) {
                                                      let data16 = data13.start;
                                                      const _errs39 = errors2;
                                                      if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                                                        validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/start", schemaPath: "#/properties/scopes/items/properties/start/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs39) {
                                                        if (typeof data16 == "number" && isFinite(data16)) {
                                                          if (data16 < 0 || isNaN(data16)) {
                                                            validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/start", schemaPath: "#/properties/scopes/items/properties/start/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                      var valid5 = _errs39 === errors2;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data13.end !== void 0) {
                                                        let data17 = data13.end;
                                                        const _errs41 = errors2;
                                                        if (!(typeof data17 == "number" && (!(data17 % 1) && !isNaN(data17)) && isFinite(data17))) {
                                                          validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/end", schemaPath: "#/properties/scopes/items/properties/end/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs41) {
                                                          if (typeof data17 == "number" && isFinite(data17)) {
                                                            if (data17 < 1 || isNaN(data17)) {
                                                              validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/end", schemaPath: "#/properties/scopes/items/properties/end/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                        var valid5 = _errs41 === errors2;
                                                      } else {
                                                        var valid5 = true;
                                                      }
                                                      if (valid5) {
                                                        if (data13.sha256 !== void 0) {
                                                          let data18 = data13.sha256;
                                                          const _errs43 = errors2;
                                                          if (errors2 === _errs43) {
                                                            if (typeof data18 === "string") {
                                                              if (!pattern4.test(data18)) {
                                                                validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/sha256", schemaPath: "#/properties/scopes/items/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                return false;
                                                              }
                                                            } else {
                                                              validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1 + "/sha256", schemaPath: "#/properties/scopes/items/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid5 = _errs43 === errors2;
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
                                            validate67.errors = [{ instancePath: instancePath + "/scopes/" + i1, schemaPath: "#/properties/scopes/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid4 = _errs32 === errors2;
                                        if (!valid4) {
                                          break;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate67.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                  return false;
                                }
                              }
                              var valid0 = _errs30 === errors2;
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
      validate67.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate67.errors = vErrors;
  return errors2 === 0;
}
validate67.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validatePrepare = validate68;
var schema37 = { "type": "object", "properties": { "id": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, "kind": { "enum": ["replace", "insert", "delete"] }, "scopeId": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, "expectedScopeSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "expectedText": { "type": "string", "minLength": 1, "maxLength": 16384 }, "expectedTextSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "dependsOn": { "type": "array", "items": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, "minItems": 0, "maxItems": 64 }, "text": { "type": "string", "minLength": 1, "maxLength": 16384 }, "position": { "enum": ["before", "after"] } }, "required": ["id", "kind", "scopeId", "expectedScopeSha256", "expectedText", "expectedTextSha256", "dependsOn"], "additionalProperties": false };
var formats2 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
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
      if (data.versionId === void 0 && (missing0 = "versionId") || data.expectedArtifactSha256 === void 0 && (missing0 = "expectedArtifactSha256") || data.operations === void 0 && (missing0 = "operations")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId" || key0 === "expectedArtifactSha256" || key0 === "operations")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.versionId !== void 0) {
            let data0 = data.versionId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats2.test(data0)) {
                    validate24.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate24.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expectedArtifactSha256 !== void 0) {
              let data1 = data.expectedArtifactSha256;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern4.test(data1)) {
                    validate24.errors = [{ instancePath: instancePath + "/expectedArtifactSha256", schemaPath: "#/properties/expectedArtifactSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate24.errors = [{ instancePath: instancePath + "/expectedArtifactSha256", schemaPath: "#/properties/expectedArtifactSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operations !== void 0) {
                let data2 = data.operations;
                const _errs6 = errors2;
                if (errors2 === _errs6) {
                  if (Array.isArray(data2)) {
                    if (data2.length > 64) {
                      validate24.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/maxItems", keyword: "maxItems", params: { limit: 64 }, message: "must NOT have more than 64 items" }];
                      return false;
                    } else {
                      if (data2.length < 1) {
                        validate24.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid1 = true;
                        const len0 = data2.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data3 = data2[i0];
                          const _errs8 = errors2;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                              let missing1;
                              if (data3.id === void 0 && (missing1 = "id") || data3.kind === void 0 && (missing1 = "kind") || data3.scopeId === void 0 && (missing1 = "scopeId") || data3.expectedScopeSha256 === void 0 && (missing1 = "expectedScopeSha256") || data3.expectedText === void 0 && (missing1 = "expectedText") || data3.expectedTextSha256 === void 0 && (missing1 = "expectedTextSha256") || data3.dependsOn === void 0 && (missing1 = "dependsOn")) {
                                validate24.errors = [{ instancePath: instancePath + "/operations/" + i0, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs11 = errors2;
                                for (const key1 in data3) {
                                  if (!func1.call(schema37.properties, key1)) {
                                    validate24.errors = [{ instancePath: instancePath + "/operations/" + i0, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs11 === errors2) {
                                  if (data3.id !== void 0) {
                                    let data4 = data3.id;
                                    const _errs12 = errors2;
                                    if (errors2 === _errs12) {
                                      if (typeof data4 === "string") {
                                        if (!pattern5.test(data4)) {
                                          validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/id", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/id", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs12 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data3.kind !== void 0) {
                                      let data5 = data3.kind;
                                      const _errs14 = errors2;
                                      if (!(data5 === "replace" || data5 === "insert" || data5 === "delete")) {
                                        validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/kind", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/kind/enum", keyword: "enum", params: { allowedValues: schema37.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid3 = _errs14 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data3.scopeId !== void 0) {
                                        let data6 = data3.scopeId;
                                        const _errs15 = errors2;
                                        if (errors2 === _errs15) {
                                          if (typeof data6 === "string") {
                                            if (!pattern5.test(data6)) {
                                              validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/scopeId", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/scopeId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/scopeId", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/scopeId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid3 = _errs15 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data3.expectedScopeSha256 !== void 0) {
                                          let data7 = data3.expectedScopeSha256;
                                          const _errs17 = errors2;
                                          if (errors2 === _errs17) {
                                            if (typeof data7 === "string") {
                                              if (!pattern4.test(data7)) {
                                                validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedScopeSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedScopeSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedScopeSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedScopeSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid3 = _errs17 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data3.expectedText !== void 0) {
                                            let data8 = data3.expectedText;
                                            const _errs19 = errors2;
                                            if (errors2 === _errs19) {
                                              if (typeof data8 === "string") {
                                                if (func2(data8) > 16384) {
                                                  validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/maxLength", keyword: "maxLength", params: { limit: 16384 }, message: "must NOT have more than 16384 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data8) < 1) {
                                                    validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid3 = _errs19 === errors2;
                                          } else {
                                            var valid3 = true;
                                          }
                                          if (valid3) {
                                            if (data3.expectedTextSha256 !== void 0) {
                                              let data9 = data3.expectedTextSha256;
                                              const _errs21 = errors2;
                                              if (errors2 === _errs21) {
                                                if (typeof data9 === "string") {
                                                  if (!pattern4.test(data9)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedTextSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedTextSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/expectedTextSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedTextSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid3 = _errs21 === errors2;
                                            } else {
                                              var valid3 = true;
                                            }
                                            if (valid3) {
                                              if (data3.dependsOn !== void 0) {
                                                let data10 = data3.dependsOn;
                                                const _errs23 = errors2;
                                                if (errors2 === _errs23) {
                                                  if (Array.isArray(data10)) {
                                                    if (data10.length > 64) {
                                                      validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/maxItems", keyword: "maxItems", params: { limit: 64 }, message: "must NOT have more than 64 items" }];
                                                      return false;
                                                    } else {
                                                      if (data10.length < 0) {
                                                        validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                                                        return false;
                                                      } else {
                                                        var valid4 = true;
                                                        const len1 = data10.length;
                                                        for (let i1 = 0; i1 < len1; i1++) {
                                                          let data11 = data10[i1];
                                                          const _errs25 = errors2;
                                                          if (errors2 === _errs25) {
                                                            if (typeof data11 === "string") {
                                                              if (!pattern5.test(data11)) {
                                                                validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/dependsOn/" + i1, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/items/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                                                return false;
                                                              }
                                                            } else {
                                                              validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/dependsOn/" + i1, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid4 = _errs25 === errors2;
                                                          if (!valid4) {
                                                            break;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  } else {
                                                    validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                  }
                                                }
                                                var valid3 = _errs23 === errors2;
                                              } else {
                                                var valid3 = true;
                                              }
                                              if (valid3) {
                                                if (data3.text !== void 0) {
                                                  let data12 = data3.text;
                                                  const _errs27 = errors2;
                                                  if (errors2 === _errs27) {
                                                    if (typeof data12 === "string") {
                                                      if (func2(data12) > 16384) {
                                                        validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/maxLength", keyword: "maxLength", params: { limit: 16384 }, message: "must NOT have more than 16384 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func2(data12) < 1) {
                                                          validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid3 = _errs27 === errors2;
                                                } else {
                                                  var valid3 = true;
                                                }
                                                if (valid3) {
                                                  if (data3.position !== void 0) {
                                                    let data13 = data3.position;
                                                    const _errs29 = errors2;
                                                    if (!(data13 === "before" || data13 === "after")) {
                                                      validate24.errors = [{ instancePath: instancePath + "/operations/" + i0 + "/position", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/position/enum", keyword: "enum", params: { allowedValues: schema37.properties.position.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
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
                                }
                              }
                            } else {
                              validate24.errors = [{ instancePath: instancePath + "/operations/" + i0, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid1 = _errs8 === errors2;
                          if (!valid1) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate24.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
      validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors2 === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.selection === void 0 && (missing0 = "selection")) {
        validate68.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "selection")) {
            validate68.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.selection !== void 0) {
            if (!validate24(data.selection, { instancePath: instancePath + "/selection", parentData: data, parentDataProperty: "selection", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
              errors2 = vErrors.length;
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
var validateLoad = validate70;
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
      if (data.versionId === void 0 && (missing0 = "versionId") || data.expectedArtifactSha256 === void 0 && (missing0 = "expectedArtifactSha256")) {
        validate70.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "versionId" || key0 === "expectedArtifactSha256")) {
            validate70.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.versionId !== void 0) {
            let data0 = data.versionId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (errors2 === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats2.test(data0)) {
                    validate70.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate70.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expectedArtifactSha256 !== void 0) {
              let data1 = data.expectedArtifactSha256;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (!pattern4.test(data1)) {
                    validate70.errors = [{ instancePath: instancePath + "/expectedArtifactSha256", schemaPath: "#/properties/expectedArtifactSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate70.errors = [{ instancePath: instancePath + "/expectedArtifactSha256", schemaPath: "#/properties/expectedArtifactSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate70.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate70.errors = vErrors;
  return errors2 === 0;
}
validate70.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validatePublish = validate71;
var schema41 = { "type": "object", "properties": { "selection": { "$ref": "#/$defs/FederalSelection" }, "revisionSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "output": { "enum": ["draft", "operative", "consolidated", "redline"] }, "deliveryId": { "type": "string", "pattern": "^[A-Za-z0-9_.:@/-]{1,255}$" }, "baseVersionId": { "anyOf": [{ "type": "string", "format": "uuid" }, { "type": "null" }] }, "baseRevisionSha256": { "anyOf": [{ "type": "string", "pattern": "^[a-f0-9]{64}$" }, { "type": "null" }] } }, "required": ["selection", "revisionSha256", "output", "deliveryId", "baseVersionId", "baseRevisionSha256"], "additionalProperties": false };
var pattern15 = new RegExp("^[A-Za-z0-9_.:@/-]{1,255}$", "u");
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
      if (data.selection === void 0 && (missing0 = "selection") || data.revisionSha256 === void 0 && (missing0 = "revisionSha256") || data.output === void 0 && (missing0 = "output") || data.deliveryId === void 0 && (missing0 = "deliveryId") || data.baseVersionId === void 0 && (missing0 = "baseVersionId") || data.baseRevisionSha256 === void 0 && (missing0 = "baseRevisionSha256")) {
        validate71.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "selection" || key0 === "revisionSha256" || key0 === "output" || key0 === "deliveryId" || key0 === "baseVersionId" || key0 === "baseRevisionSha256")) {
            validate71.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.selection !== void 0) {
            const _errs2 = errors2;
            if (!validate24(data.selection, { instancePath: instancePath + "/selection", parentData: data, parentDataProperty: "selection", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.revisionSha256 !== void 0) {
              let data1 = data.revisionSha256;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (typeof data1 === "string") {
                  if (!pattern4.test(data1)) {
                    validate71.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                    return false;
                  }
                } else {
                  validate71.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.output !== void 0) {
                let data2 = data.output;
                const _errs5 = errors2;
                if (!(data2 === "draft" || data2 === "operative" || data2 === "consolidated" || data2 === "redline")) {
                  validate71.errors = [{ instancePath: instancePath + "/output", schemaPath: "#/properties/output/enum", keyword: "enum", params: { allowedValues: schema41.properties.output.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.deliveryId !== void 0) {
                  let data3 = data.deliveryId;
                  const _errs6 = errors2;
                  if (errors2 === _errs6) {
                    if (typeof data3 === "string") {
                      if (!pattern15.test(data3)) {
                        validate71.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_.:@/-]{1,255}$" }, message: 'must match pattern "^[A-Za-z0-9_.:@/-]{1,255}$"' }];
                        return false;
                      }
                    } else {
                      validate71.errors = [{ instancePath: instancePath + "/deliveryId", schemaPath: "#/properties/deliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs6 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.baseVersionId !== void 0) {
                    let data4 = data.baseVersionId;
                    const _errs8 = errors2;
                    const _errs9 = errors2;
                    let valid1 = false;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (errors2 === _errs10) {
                        if (typeof data4 === "string") {
                          if (!formats2.test(data4)) {
                            const err0 = { instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          }
                        } else {
                          const err1 = { instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                        }
                      }
                    }
                    var _valid0 = _errs10 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs12 = errors2;
                    if (data4 !== null) {
                      const err2 = { instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err2];
                      } else {
                        vErrors.push(err2);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs12 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err3 = { instancePath: instancePath + "/baseVersionId", schemaPath: "#/properties/baseVersionId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err3];
                      } else {
                        vErrors.push(err3);
                      }
                      errors2++;
                      validate71.errors = vErrors;
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
                    if (data.baseRevisionSha256 !== void 0) {
                      let data5 = data.baseRevisionSha256;
                      const _errs14 = errors2;
                      const _errs15 = errors2;
                      let valid2 = false;
                      const _errs16 = errors2;
                      if (errors2 === _errs16) {
                        if (typeof data5 === "string") {
                          if (!pattern4.test(data5)) {
                            const err4 = { instancePath: instancePath + "/baseRevisionSha256", schemaPath: "#/properties/baseRevisionSha256/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                        } else {
                          const err5 = { instancePath: instancePath + "/baseRevisionSha256", schemaPath: "#/properties/baseRevisionSha256/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err5];
                          } else {
                            vErrors.push(err5);
                          }
                          errors2++;
                        }
                      }
                      var _valid1 = _errs16 === errors2;
                      valid2 = valid2 || _valid1;
                      const _errs18 = errors2;
                      if (data5 !== null) {
                        const err6 = { instancePath: instancePath + "/baseRevisionSha256", schemaPath: "#/properties/baseRevisionSha256/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors2++;
                      }
                      var _valid1 = _errs18 === errors2;
                      valid2 = valid2 || _valid1;
                      if (!valid2) {
                        const err7 = { instancePath: instancePath + "/baseRevisionSha256", schemaPath: "#/properties/baseRevisionSha256/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err7];
                        } else {
                          vErrors.push(err7);
                        }
                        errors2++;
                        validate71.errors = vErrors;
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
var validateReview = validate73;
var schema46 = { "type": "object", "properties": { "parserVersion": { "const": "federal-plain-text/1" }, "source": { "$ref": "#/$defs/FederalDraftCompilerSource_449cfb6a" }, "operations": { "type": "array", "items": { "$ref": "#/$defs/FederalDraftOperation_ecfa206f" }, "minItems": 1, "maxItems": 64 }, "outputs": { "type": "object", "properties": { "operative": { "type": "string", "minLength": 1, "maxLength": 1048576 }, "consolidated": { "type": "string", "minLength": 1, "maxLength": 131072 }, "redline": { "type": "string", "minLength": 1, "maxLength": 1048576 }, "segments": { "type": "array", "items": { "$ref": "#/$defs/FederalDraftSegment_e752af1d" }, "minItems": 1, "maxItems": 512 } }, "required": ["operative", "consolidated", "redline", "segments"], "additionalProperties": false }, "findings": { "type": "array", "items": { "type": "object", "properties": { "category": { "enum": ["source-integrity", "exact-target", "numbering", "cross-references", "arithmetic", "substantive-law"] }, "status": { "enum": ["passed", "unresolved"] }, "location": { "type": "string", "minLength": 1, "maxLength": 512 }, "severity": { "enum": ["info", "review-required"] }, "operationId": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" } }, "required": ["category", "status", "location", "severity"], "additionalProperties": false }, "minItems": 1, "maxItems": 70 }, "outputHashes": { "type": "object", "properties": { "operative": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "consolidated": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "redline": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["operative", "consolidated", "redline"], "additionalProperties": false }, "revisionSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "approval": { "const": "unapproved" } }, "required": ["parserVersion", "source", "operations", "outputs", "findings", "outputHashes", "revisionSha256", "approval"], "additionalProperties": false };
var schema49 = { "type": "object", "properties": { "kind": { "enum": ["unchanged", "delete", "insert"] }, "text": { "type": "string", "minLength": 0, "maxLength": 131072 } }, "required": ["kind", "text"], "additionalProperties": false };
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
      if (data.parserVersion === void 0 && (missing0 = "parserVersion") || data.source === void 0 && (missing0 = "source") || data.operations === void 0 && (missing0 = "operations") || data.outputs === void 0 && (missing0 = "outputs") || data.findings === void 0 && (missing0 = "findings") || data.outputHashes === void 0 && (missing0 = "outputHashes") || data.revisionSha256 === void 0 && (missing0 = "revisionSha256") || data.approval === void 0 && (missing0 = "approval")) {
        validate36.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "parserVersion" || key0 === "source" || key0 === "operations" || key0 === "outputs" || key0 === "findings" || key0 === "outputHashes" || key0 === "revisionSha256" || key0 === "approval")) {
            validate36.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.parserVersion !== void 0) {
            const _errs2 = errors2;
            if ("federal-plain-text/1" !== data.parserVersion) {
              validate36.errors = [{ instancePath: instancePath + "/parserVersion", schemaPath: "#/properties/parserVersion/const", keyword: "const", params: { allowedValue: "federal-plain-text/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.source !== void 0) {
              let data1 = data.source;
              const _errs3 = errors2;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.documentId === void 0 && (missing1 = "documentId") || data1.publisher === void 0 && (missing1 = "publisher") || data1.sourceVersion === void 0 && (missing1 = "sourceVersion") || data1.sourceUrl === void 0 && (missing1 = "sourceUrl") || data1.publishedAt === void 0 && (missing1 = "publishedAt") || data1.parserVersion === void 0 && (missing1 = "parserVersion") || data1.sha256 === void 0 && (missing1 = "sha256") || data1.text === void 0 && (missing1 = "text") || data1.coverage === void 0 && (missing1 = "coverage") || data1.scopes === void 0 && (missing1 = "scopes")) {
                    validate36.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs6 = errors2;
                    for (const key1 in data1) {
                      if (!func1.call(schema33.properties, key1)) {
                        validate36.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors2) {
                      if (data1.documentId !== void 0) {
                        let data2 = data1.documentId;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (typeof data2 === "string") {
                            if (func2(data2) > 512) {
                              validate36.errors = [{ instancePath: instancePath + "/source/documentId", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/documentId/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                              return false;
                            } else {
                              if (func2(data2) < 1) {
                                validate36.errors = [{ instancePath: instancePath + "/source/documentId", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/documentId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate36.errors = [{ instancePath: instancePath + "/source/documentId", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/documentId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs7 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.publisher !== void 0) {
                          let data3 = data1.publisher;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (func2(data3) > 512) {
                                validate36.errors = [{ instancePath: instancePath + "/source/publisher", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publisher/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                                return false;
                              } else {
                                if (func2(data3) < 1) {
                                  validate36.errors = [{ instancePath: instancePath + "/source/publisher", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publisher/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate36.errors = [{ instancePath: instancePath + "/source/publisher", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publisher/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.sourceVersion !== void 0) {
                            let data4 = data1.sourceVersion;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (typeof data4 === "string") {
                                if (func2(data4) > 512) {
                                  validate36.errors = [{ instancePath: instancePath + "/source/sourceVersion", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceVersion/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                                  return false;
                                } else {
                                  if (func2(data4) < 1) {
                                    validate36.errors = [{ instancePath: instancePath + "/source/sourceVersion", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceVersion/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate36.errors = [{ instancePath: instancePath + "/source/sourceVersion", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.sourceUrl !== void 0) {
                              let data5 = data1.sourceUrl;
                              const _errs13 = errors2;
                              if (errors2 === _errs13) {
                                if (typeof data5 === "string") {
                                  if (func2(data5) > 2048) {
                                    validate36.errors = [{ instancePath: instancePath + "/source/sourceUrl", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceUrl/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                                    return false;
                                  } else {
                                    if (func2(data5) < 1) {
                                      validate36.errors = [{ instancePath: instancePath + "/source/sourceUrl", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceUrl/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate36.errors = [{ instancePath: instancePath + "/source/sourceUrl", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sourceUrl/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.publishedAt !== void 0) {
                                let data6 = data1.publishedAt;
                                const _errs15 = errors2;
                                const _errs16 = errors2;
                                let valid3 = false;
                                const _errs17 = errors2;
                                if (errors2 === _errs17) {
                                  if (errors2 === _errs17) {
                                    if (typeof data6 === "string") {
                                      if (!formats0.validate(data6)) {
                                        const err0 = { instancePath: instancePath + "/source/publishedAt", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publishedAt/anyOf/0/format", keyword: "format", params: { format: "date" }, message: 'must match format "date"' };
                                        if (vErrors === null) {
                                          vErrors = [err0];
                                        } else {
                                          vErrors.push(err0);
                                        }
                                        errors2++;
                                      }
                                    } else {
                                      const err1 = { instancePath: instancePath + "/source/publishedAt", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publishedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err1];
                                      } else {
                                        vErrors.push(err1);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var _valid0 = _errs17 === errors2;
                                valid3 = valid3 || _valid0;
                                const _errs19 = errors2;
                                if (data6 !== null) {
                                  const err2 = { instancePath: instancePath + "/source/publishedAt", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publishedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                  if (vErrors === null) {
                                    vErrors = [err2];
                                  } else {
                                    vErrors.push(err2);
                                  }
                                  errors2++;
                                }
                                var _valid0 = _errs19 === errors2;
                                valid3 = valid3 || _valid0;
                                if (!valid3) {
                                  const err3 = { instancePath: instancePath + "/source/publishedAt", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/publishedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                  if (vErrors === null) {
                                    vErrors = [err3];
                                  } else {
                                    vErrors.push(err3);
                                  }
                                  errors2++;
                                  validate36.errors = vErrors;
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
                                var valid2 = _errs15 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data1.parserVersion !== void 0) {
                                  const _errs21 = errors2;
                                  if ("federal-plain-text/1" !== data1.parserVersion) {
                                    validate36.errors = [{ instancePath: instancePath + "/source/parserVersion", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/parserVersion/const", keyword: "const", params: { allowedValue: "federal-plain-text/1" }, message: "must be equal to constant" }];
                                    return false;
                                  }
                                  var valid2 = _errs21 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data1.sha256 !== void 0) {
                                    let data8 = data1.sha256;
                                    const _errs22 = errors2;
                                    if (errors2 === _errs22) {
                                      if (typeof data8 === "string") {
                                        if (!pattern4.test(data8)) {
                                          validate36.errors = [{ instancePath: instancePath + "/source/sha256", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate36.errors = [{ instancePath: instancePath + "/source/sha256", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid2 = _errs22 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data1.text !== void 0) {
                                      let data9 = data1.text;
                                      const _errs24 = errors2;
                                      if (errors2 === _errs24) {
                                        if (typeof data9 === "string") {
                                          if (func2(data9) > 131072) {
                                            validate36.errors = [{ instancePath: instancePath + "/source/text", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/text/maxLength", keyword: "maxLength", params: { limit: 131072 }, message: "must NOT have more than 131072 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data9) < 1) {
                                              validate36.errors = [{ instancePath: instancePath + "/source/text", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate36.errors = [{ instancePath: instancePath + "/source/text", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid2 = _errs24 === errors2;
                                    } else {
                                      var valid2 = true;
                                    }
                                    if (valid2) {
                                      if (data1.coverage !== void 0) {
                                        let data10 = data1.coverage;
                                        const _errs26 = errors2;
                                        if (errors2 === _errs26) {
                                          if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                                            let missing2;
                                            if (data10.complete === void 0 && (missing2 = "complete") || data10.limitations === void 0 && (missing2 = "limitations")) {
                                              validate36.errors = [{ instancePath: instancePath + "/source/coverage", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                              return false;
                                            } else {
                                              const _errs28 = errors2;
                                              for (const key2 in data10) {
                                                if (!(key2 === "complete" || key2 === "limitations")) {
                                                  validate36.errors = [{ instancePath: instancePath + "/source/coverage", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs28 === errors2) {
                                                if (data10.complete !== void 0) {
                                                  const _errs29 = errors2;
                                                  if (typeof data10.complete !== "boolean") {
                                                    validate36.errors = [{ instancePath: instancePath + "/source/coverage/complete", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/complete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                    return false;
                                                  }
                                                  var valid4 = _errs29 === errors2;
                                                } else {
                                                  var valid4 = true;
                                                }
                                                if (valid4) {
                                                  if (data10.limitations !== void 0) {
                                                    let data12 = data10.limitations;
                                                    const _errs31 = errors2;
                                                    if (errors2 === _errs31) {
                                                      if (Array.isArray(data12)) {
                                                        if (data12.length > 32) {
                                                          validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                                                          return false;
                                                        } else {
                                                          if (data12.length < 1) {
                                                            validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                            return false;
                                                          } else {
                                                            var valid5 = true;
                                                            const len0 = data12.length;
                                                            for (let i0 = 0; i0 < len0; i0++) {
                                                              let data13 = data12[i0];
                                                              const _errs33 = errors2;
                                                              if (errors2 === _errs33) {
                                                                if (typeof data13 === "string") {
                                                                  if (func2(data13) > 1e3) {
                                                                    validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations/" + i0, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/items/maxLength", keyword: "maxLength", params: { limit: 1e3 }, message: "must NOT have more than 1000 characters" }];
                                                                    return false;
                                                                  } else {
                                                                    if (func2(data13) < 1) {
                                                                      validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations/" + i0, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                } else {
                                                                  validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations/" + i0, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                  return false;
                                                                }
                                                              }
                                                              var valid5 = _errs33 === errors2;
                                                              if (!valid5) {
                                                                break;
                                                              }
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        validate36.errors = [{ instancePath: instancePath + "/source/coverage/limitations", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/properties/limitations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                          } else {
                                            validate36.errors = [{ instancePath: instancePath + "/source/coverage", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid2 = _errs26 === errors2;
                                      } else {
                                        var valid2 = true;
                                      }
                                      if (valid2) {
                                        if (data1.scopes !== void 0) {
                                          let data14 = data1.scopes;
                                          const _errs35 = errors2;
                                          if (errors2 === _errs35) {
                                            if (Array.isArray(data14)) {
                                              if (data14.length > 128) {
                                                validate36.errors = [{ instancePath: instancePath + "/source/scopes", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                                                return false;
                                              } else {
                                                if (data14.length < 1) {
                                                  validate36.errors = [{ instancePath: instancePath + "/source/scopes", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                  return false;
                                                } else {
                                                  var valid6 = true;
                                                  const len1 = data14.length;
                                                  for (let i1 = 0; i1 < len1; i1++) {
                                                    let data15 = data14[i1];
                                                    const _errs37 = errors2;
                                                    if (errors2 === _errs37) {
                                                      if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                                        let missing3;
                                                        if (data15.id === void 0 && (missing3 = "id") || data15.label === void 0 && (missing3 = "label") || data15.start === void 0 && (missing3 = "start") || data15.end === void 0 && (missing3 = "end") || data15.sha256 === void 0 && (missing3 = "sha256")) {
                                                          validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                                          return false;
                                                        } else {
                                                          const _errs39 = errors2;
                                                          for (const key3 in data15) {
                                                            if (!(key3 === "id" || key3 === "label" || key3 === "start" || key3 === "end" || key3 === "sha256")) {
                                                              validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                              return false;
                                                              break;
                                                            }
                                                          }
                                                          if (_errs39 === errors2) {
                                                            if (data15.id !== void 0) {
                                                              let data16 = data15.id;
                                                              const _errs40 = errors2;
                                                              if (errors2 === _errs40) {
                                                                if (typeof data16 === "string") {
                                                                  if (!pattern5.test(data16)) {
                                                                    validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/id", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                                                    return false;
                                                                  }
                                                                } else {
                                                                  validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/id", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                  return false;
                                                                }
                                                              }
                                                              var valid7 = _errs40 === errors2;
                                                            } else {
                                                              var valid7 = true;
                                                            }
                                                            if (valid7) {
                                                              if (data15.label !== void 0) {
                                                                let data17 = data15.label;
                                                                const _errs42 = errors2;
                                                                if (errors2 === _errs42) {
                                                                  if (typeof data17 === "string") {
                                                                    if (func2(data17) > 512) {
                                                                      validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/label", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/label/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                                                                      return false;
                                                                    } else {
                                                                      if (func2(data17) < 1) {
                                                                        validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/label", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/label/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  } else {
                                                                    validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/label", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid7 = _errs42 === errors2;
                                                              } else {
                                                                var valid7 = true;
                                                              }
                                                              if (valid7) {
                                                                if (data15.start !== void 0) {
                                                                  let data18 = data15.start;
                                                                  const _errs44 = errors2;
                                                                  if (!(typeof data18 == "number" && (!(data18 % 1) && !isNaN(data18)) && isFinite(data18))) {
                                                                    validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/start", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/start/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs44) {
                                                                    if (typeof data18 == "number" && isFinite(data18)) {
                                                                      if (data18 < 0 || isNaN(data18)) {
                                                                        validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/start", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/start/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid7 = _errs44 === errors2;
                                                                } else {
                                                                  var valid7 = true;
                                                                }
                                                                if (valid7) {
                                                                  if (data15.end !== void 0) {
                                                                    let data19 = data15.end;
                                                                    const _errs46 = errors2;
                                                                    if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                                                                      validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/end", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/end/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs46) {
                                                                      if (typeof data19 == "number" && isFinite(data19)) {
                                                                        if (data19 < 1 || isNaN(data19)) {
                                                                          validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/end", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/end/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid7 = _errs46 === errors2;
                                                                  } else {
                                                                    var valid7 = true;
                                                                  }
                                                                  if (valid7) {
                                                                    if (data15.sha256 !== void 0) {
                                                                      let data20 = data15.sha256;
                                                                      const _errs48 = errors2;
                                                                      if (errors2 === _errs48) {
                                                                        if (typeof data20 === "string") {
                                                                          if (!pattern4.test(data20)) {
                                                                            validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/sha256", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1 + "/sha256", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
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
                                                          }
                                                        }
                                                      } else {
                                                        validate36.errors = [{ instancePath: instancePath + "/source/scopes/" + i1, schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid6 = _errs37 === errors2;
                                                    if (!valid6) {
                                                      break;
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              validate36.errors = [{ instancePath: instancePath + "/source/scopes", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                              return false;
                                            }
                                          }
                                          var valid2 = _errs35 === errors2;
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
                  }
                } else {
                  validate36.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/$defs/FederalDraftCompilerSource_449cfb6a/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.operations !== void 0) {
                let data21 = data.operations;
                const _errs50 = errors2;
                if (errors2 === _errs50) {
                  if (Array.isArray(data21)) {
                    if (data21.length > 64) {
                      validate36.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/maxItems", keyword: "maxItems", params: { limit: 64 }, message: "must NOT have more than 64 items" }];
                      return false;
                    } else {
                      if (data21.length < 1) {
                        validate36.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid8 = true;
                        const len2 = data21.length;
                        for (let i2 = 0; i2 < len2; i2++) {
                          let data22 = data21[i2];
                          const _errs52 = errors2;
                          const _errs53 = errors2;
                          if (errors2 === _errs53) {
                            if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                              let missing4;
                              if (data22.id === void 0 && (missing4 = "id") || data22.kind === void 0 && (missing4 = "kind") || data22.scopeId === void 0 && (missing4 = "scopeId") || data22.expectedScopeSha256 === void 0 && (missing4 = "expectedScopeSha256") || data22.expectedText === void 0 && (missing4 = "expectedText") || data22.expectedTextSha256 === void 0 && (missing4 = "expectedTextSha256") || data22.dependsOn === void 0 && (missing4 = "dependsOn")) {
                                validate36.errors = [{ instancePath: instancePath + "/operations/" + i2, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                return false;
                              } else {
                                const _errs55 = errors2;
                                for (const key4 in data22) {
                                  if (!func1.call(schema37.properties, key4)) {
                                    validate36.errors = [{ instancePath: instancePath + "/operations/" + i2, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs55 === errors2) {
                                  if (data22.id !== void 0) {
                                    let data23 = data22.id;
                                    const _errs56 = errors2;
                                    if (errors2 === _errs56) {
                                      if (typeof data23 === "string") {
                                        if (!pattern5.test(data23)) {
                                          validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/id", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/id", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid10 = _errs56 === errors2;
                                  } else {
                                    var valid10 = true;
                                  }
                                  if (valid10) {
                                    if (data22.kind !== void 0) {
                                      let data24 = data22.kind;
                                      const _errs58 = errors2;
                                      if (!(data24 === "replace" || data24 === "insert" || data24 === "delete")) {
                                        validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/kind", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/kind/enum", keyword: "enum", params: { allowedValues: schema37.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid10 = _errs58 === errors2;
                                    } else {
                                      var valid10 = true;
                                    }
                                    if (valid10) {
                                      if (data22.scopeId !== void 0) {
                                        let data25 = data22.scopeId;
                                        const _errs59 = errors2;
                                        if (errors2 === _errs59) {
                                          if (typeof data25 === "string") {
                                            if (!pattern5.test(data25)) {
                                              validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/scopeId", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/scopeId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/scopeId", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/scopeId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid10 = _errs59 === errors2;
                                      } else {
                                        var valid10 = true;
                                      }
                                      if (valid10) {
                                        if (data22.expectedScopeSha256 !== void 0) {
                                          let data26 = data22.expectedScopeSha256;
                                          const _errs61 = errors2;
                                          if (errors2 === _errs61) {
                                            if (typeof data26 === "string") {
                                              if (!pattern4.test(data26)) {
                                                validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedScopeSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedScopeSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedScopeSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedScopeSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid10 = _errs61 === errors2;
                                        } else {
                                          var valid10 = true;
                                        }
                                        if (valid10) {
                                          if (data22.expectedText !== void 0) {
                                            let data27 = data22.expectedText;
                                            const _errs63 = errors2;
                                            if (errors2 === _errs63) {
                                              if (typeof data27 === "string") {
                                                if (func2(data27) > 16384) {
                                                  validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/maxLength", keyword: "maxLength", params: { limit: 16384 }, message: "must NOT have more than 16384 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data27) < 1) {
                                                    validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedText", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedText/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid10 = _errs63 === errors2;
                                          } else {
                                            var valid10 = true;
                                          }
                                          if (valid10) {
                                            if (data22.expectedTextSha256 !== void 0) {
                                              let data28 = data22.expectedTextSha256;
                                              const _errs65 = errors2;
                                              if (errors2 === _errs65) {
                                                if (typeof data28 === "string") {
                                                  if (!pattern4.test(data28)) {
                                                    validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedTextSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedTextSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/expectedTextSha256", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/expectedTextSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid10 = _errs65 === errors2;
                                            } else {
                                              var valid10 = true;
                                            }
                                            if (valid10) {
                                              if (data22.dependsOn !== void 0) {
                                                let data29 = data22.dependsOn;
                                                const _errs67 = errors2;
                                                if (errors2 === _errs67) {
                                                  if (Array.isArray(data29)) {
                                                    if (data29.length > 64) {
                                                      validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/maxItems", keyword: "maxItems", params: { limit: 64 }, message: "must NOT have more than 64 items" }];
                                                      return false;
                                                    } else {
                                                      if (data29.length < 0) {
                                                        validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" }];
                                                        return false;
                                                      } else {
                                                        var valid11 = true;
                                                        const len3 = data29.length;
                                                        for (let i3 = 0; i3 < len3; i3++) {
                                                          let data30 = data29[i3];
                                                          const _errs69 = errors2;
                                                          if (errors2 === _errs69) {
                                                            if (typeof data30 === "string") {
                                                              if (!pattern5.test(data30)) {
                                                                validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/dependsOn/" + i3, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/items/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                                                return false;
                                                              }
                                                            } else {
                                                              validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/dependsOn/" + i3, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid11 = _errs69 === errors2;
                                                          if (!valid11) {
                                                            break;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  } else {
                                                    validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/dependsOn", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/dependsOn/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                  }
                                                }
                                                var valid10 = _errs67 === errors2;
                                              } else {
                                                var valid10 = true;
                                              }
                                              if (valid10) {
                                                if (data22.text !== void 0) {
                                                  let data31 = data22.text;
                                                  const _errs71 = errors2;
                                                  if (errors2 === _errs71) {
                                                    if (typeof data31 === "string") {
                                                      if (func2(data31) > 16384) {
                                                        validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/maxLength", keyword: "maxLength", params: { limit: 16384 }, message: "must NOT have more than 16384 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func2(data31) < 1) {
                                                          validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/text", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid10 = _errs71 === errors2;
                                                } else {
                                                  var valid10 = true;
                                                }
                                                if (valid10) {
                                                  if (data22.position !== void 0) {
                                                    let data32 = data22.position;
                                                    const _errs73 = errors2;
                                                    if (!(data32 === "before" || data32 === "after")) {
                                                      validate36.errors = [{ instancePath: instancePath + "/operations/" + i2 + "/position", schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/properties/position/enum", keyword: "enum", params: { allowedValues: schema37.properties.position.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
                                                    }
                                                    var valid10 = _errs73 === errors2;
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
                                }
                              }
                            } else {
                              validate36.errors = [{ instancePath: instancePath + "/operations/" + i2, schemaPath: "#/$defs/FederalDraftOperation_ecfa206f/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid8 = _errs52 === errors2;
                          if (!valid8) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate36.errors = [{ instancePath: instancePath + "/operations", schemaPath: "#/properties/operations/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs50 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.outputs !== void 0) {
                  let data33 = data.outputs;
                  const _errs74 = errors2;
                  if (errors2 === _errs74) {
                    if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
                      let missing5;
                      if (data33.operative === void 0 && (missing5 = "operative") || data33.consolidated === void 0 && (missing5 = "consolidated") || data33.redline === void 0 && (missing5 = "redline") || data33.segments === void 0 && (missing5 = "segments")) {
                        validate36.errors = [{ instancePath: instancePath + "/outputs", schemaPath: "#/properties/outputs/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                        return false;
                      } else {
                        const _errs76 = errors2;
                        for (const key5 in data33) {
                          if (!(key5 === "operative" || key5 === "consolidated" || key5 === "redline" || key5 === "segments")) {
                            validate36.errors = [{ instancePath: instancePath + "/outputs", schemaPath: "#/properties/outputs/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                            return false;
                            break;
                          }
                        }
                        if (_errs76 === errors2) {
                          if (data33.operative !== void 0) {
                            let data34 = data33.operative;
                            const _errs77 = errors2;
                            if (errors2 === _errs77) {
                              if (typeof data34 === "string") {
                                if (func2(data34) > 1048576) {
                                  validate36.errors = [{ instancePath: instancePath + "/outputs/operative", schemaPath: "#/properties/outputs/properties/operative/maxLength", keyword: "maxLength", params: { limit: 1048576 }, message: "must NOT have more than 1048576 characters" }];
                                  return false;
                                } else {
                                  if (func2(data34) < 1) {
                                    validate36.errors = [{ instancePath: instancePath + "/outputs/operative", schemaPath: "#/properties/outputs/properties/operative/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate36.errors = [{ instancePath: instancePath + "/outputs/operative", schemaPath: "#/properties/outputs/properties/operative/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                            }
                            var valid12 = _errs77 === errors2;
                          } else {
                            var valid12 = true;
                          }
                          if (valid12) {
                            if (data33.consolidated !== void 0) {
                              let data35 = data33.consolidated;
                              const _errs79 = errors2;
                              if (errors2 === _errs79) {
                                if (typeof data35 === "string") {
                                  if (func2(data35) > 131072) {
                                    validate36.errors = [{ instancePath: instancePath + "/outputs/consolidated", schemaPath: "#/properties/outputs/properties/consolidated/maxLength", keyword: "maxLength", params: { limit: 131072 }, message: "must NOT have more than 131072 characters" }];
                                    return false;
                                  } else {
                                    if (func2(data35) < 1) {
                                      validate36.errors = [{ instancePath: instancePath + "/outputs/consolidated", schemaPath: "#/properties/outputs/properties/consolidated/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate36.errors = [{ instancePath: instancePath + "/outputs/consolidated", schemaPath: "#/properties/outputs/properties/consolidated/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid12 = _errs79 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data33.redline !== void 0) {
                                let data36 = data33.redline;
                                const _errs81 = errors2;
                                if (errors2 === _errs81) {
                                  if (typeof data36 === "string") {
                                    if (func2(data36) > 1048576) {
                                      validate36.errors = [{ instancePath: instancePath + "/outputs/redline", schemaPath: "#/properties/outputs/properties/redline/maxLength", keyword: "maxLength", params: { limit: 1048576 }, message: "must NOT have more than 1048576 characters" }];
                                      return false;
                                    } else {
                                      if (func2(data36) < 1) {
                                        validate36.errors = [{ instancePath: instancePath + "/outputs/redline", schemaPath: "#/properties/outputs/properties/redline/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate36.errors = [{ instancePath: instancePath + "/outputs/redline", schemaPath: "#/properties/outputs/properties/redline/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid12 = _errs81 === errors2;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data33.segments !== void 0) {
                                  let data37 = data33.segments;
                                  const _errs83 = errors2;
                                  if (errors2 === _errs83) {
                                    if (Array.isArray(data37)) {
                                      if (data37.length > 512) {
                                        validate36.errors = [{ instancePath: instancePath + "/outputs/segments", schemaPath: "#/properties/outputs/properties/segments/maxItems", keyword: "maxItems", params: { limit: 512 }, message: "must NOT have more than 512 items" }];
                                        return false;
                                      } else {
                                        if (data37.length < 1) {
                                          validate36.errors = [{ instancePath: instancePath + "/outputs/segments", schemaPath: "#/properties/outputs/properties/segments/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                          return false;
                                        } else {
                                          var valid13 = true;
                                          const len4 = data37.length;
                                          for (let i4 = 0; i4 < len4; i4++) {
                                            let data38 = data37[i4];
                                            const _errs85 = errors2;
                                            const _errs86 = errors2;
                                            if (errors2 === _errs86) {
                                              if (data38 && typeof data38 == "object" && !Array.isArray(data38)) {
                                                let missing6;
                                                if (data38.kind === void 0 && (missing6 = "kind") || data38.text === void 0 && (missing6 = "text")) {
                                                  validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4, schemaPath: "#/$defs/FederalDraftSegment_e752af1d/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                  return false;
                                                } else {
                                                  const _errs88 = errors2;
                                                  for (const key6 in data38) {
                                                    if (!(key6 === "kind" || key6 === "text")) {
                                                      validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4, schemaPath: "#/$defs/FederalDraftSegment_e752af1d/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                                      return false;
                                                      break;
                                                    }
                                                  }
                                                  if (_errs88 === errors2) {
                                                    if (data38.kind !== void 0) {
                                                      let data39 = data38.kind;
                                                      const _errs89 = errors2;
                                                      if (!(data39 === "unchanged" || data39 === "delete" || data39 === "insert")) {
                                                        validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4 + "/kind", schemaPath: "#/$defs/FederalDraftSegment_e752af1d/properties/kind/enum", keyword: "enum", params: { allowedValues: schema49.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                                        return false;
                                                      }
                                                      var valid15 = _errs89 === errors2;
                                                    } else {
                                                      var valid15 = true;
                                                    }
                                                    if (valid15) {
                                                      if (data38.text !== void 0) {
                                                        let data40 = data38.text;
                                                        const _errs90 = errors2;
                                                        if (errors2 === _errs90) {
                                                          if (typeof data40 === "string") {
                                                            if (func2(data40) > 131072) {
                                                              validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4 + "/text", schemaPath: "#/$defs/FederalDraftSegment_e752af1d/properties/text/maxLength", keyword: "maxLength", params: { limit: 131072 }, message: "must NOT have more than 131072 characters" }];
                                                              return false;
                                                            } else {
                                                              if (func2(data40) < 0) {
                                                                validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4 + "/text", schemaPath: "#/$defs/FederalDraftSegment_e752af1d/properties/text/minLength", keyword: "minLength", params: { limit: 0 }, message: "must NOT have fewer than 0 characters" }];
                                                                return false;
                                                              }
                                                            }
                                                          } else {
                                                            validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4 + "/text", schemaPath: "#/$defs/FederalDraftSegment_e752af1d/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid15 = _errs90 === errors2;
                                                      } else {
                                                        var valid15 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                validate36.errors = [{ instancePath: instancePath + "/outputs/segments/" + i4, schemaPath: "#/$defs/FederalDraftSegment_e752af1d/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                return false;
                                              }
                                            }
                                            var valid13 = _errs85 === errors2;
                                            if (!valid13) {
                                              break;
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate36.errors = [{ instancePath: instancePath + "/outputs/segments", schemaPath: "#/properties/outputs/properties/segments/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                      return false;
                                    }
                                  }
                                  var valid12 = _errs83 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate36.errors = [{ instancePath: instancePath + "/outputs", schemaPath: "#/properties/outputs/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid0 = _errs74 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.findings !== void 0) {
                    let data41 = data.findings;
                    const _errs92 = errors2;
                    if (errors2 === _errs92) {
                      if (Array.isArray(data41)) {
                        if (data41.length > 70) {
                          validate36.errors = [{ instancePath: instancePath + "/findings", schemaPath: "#/properties/findings/maxItems", keyword: "maxItems", params: { limit: 70 }, message: "must NOT have more than 70 items" }];
                          return false;
                        } else {
                          if (data41.length < 1) {
                            validate36.errors = [{ instancePath: instancePath + "/findings", schemaPath: "#/properties/findings/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                            return false;
                          } else {
                            var valid16 = true;
                            const len5 = data41.length;
                            for (let i5 = 0; i5 < len5; i5++) {
                              let data42 = data41[i5];
                              const _errs94 = errors2;
                              if (errors2 === _errs94) {
                                if (data42 && typeof data42 == "object" && !Array.isArray(data42)) {
                                  let missing7;
                                  if (data42.category === void 0 && (missing7 = "category") || data42.status === void 0 && (missing7 = "status") || data42.location === void 0 && (missing7 = "location") || data42.severity === void 0 && (missing7 = "severity")) {
                                    validate36.errors = [{ instancePath: instancePath + "/findings/" + i5, schemaPath: "#/properties/findings/items/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                                    return false;
                                  } else {
                                    const _errs96 = errors2;
                                    for (const key7 in data42) {
                                      if (!(key7 === "category" || key7 === "status" || key7 === "location" || key7 === "severity" || key7 === "operationId")) {
                                        validate36.errors = [{ instancePath: instancePath + "/findings/" + i5, schemaPath: "#/properties/findings/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs96 === errors2) {
                                      if (data42.category !== void 0) {
                                        let data43 = data42.category;
                                        const _errs97 = errors2;
                                        if (!(data43 === "source-integrity" || data43 === "exact-target" || data43 === "numbering" || data43 === "cross-references" || data43 === "arithmetic" || data43 === "substantive-law")) {
                                          validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/category", schemaPath: "#/properties/findings/items/properties/category/enum", keyword: "enum", params: { allowedValues: schema46.properties.findings.items.properties.category.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid17 = _errs97 === errors2;
                                      } else {
                                        var valid17 = true;
                                      }
                                      if (valid17) {
                                        if (data42.status !== void 0) {
                                          let data44 = data42.status;
                                          const _errs98 = errors2;
                                          if (!(data44 === "passed" || data44 === "unresolved")) {
                                            validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/status", schemaPath: "#/properties/findings/items/properties/status/enum", keyword: "enum", params: { allowedValues: schema46.properties.findings.items.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid17 = _errs98 === errors2;
                                        } else {
                                          var valid17 = true;
                                        }
                                        if (valid17) {
                                          if (data42.location !== void 0) {
                                            let data45 = data42.location;
                                            const _errs99 = errors2;
                                            if (errors2 === _errs99) {
                                              if (typeof data45 === "string") {
                                                if (func2(data45) > 512) {
                                                  validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/location", schemaPath: "#/properties/findings/items/properties/location/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data45) < 1) {
                                                    validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/location", schemaPath: "#/properties/findings/items/properties/location/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/location", schemaPath: "#/properties/findings/items/properties/location/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid17 = _errs99 === errors2;
                                          } else {
                                            var valid17 = true;
                                          }
                                          if (valid17) {
                                            if (data42.severity !== void 0) {
                                              let data46 = data42.severity;
                                              const _errs101 = errors2;
                                              if (!(data46 === "info" || data46 === "review-required")) {
                                                validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/severity", schemaPath: "#/properties/findings/items/properties/severity/enum", keyword: "enum", params: { allowedValues: schema46.properties.findings.items.properties.severity.enum }, message: "must be equal to one of the allowed values" }];
                                                return false;
                                              }
                                              var valid17 = _errs101 === errors2;
                                            } else {
                                              var valid17 = true;
                                            }
                                            if (valid17) {
                                              if (data42.operationId !== void 0) {
                                                let data47 = data42.operationId;
                                                const _errs102 = errors2;
                                                if (errors2 === _errs102) {
                                                  if (typeof data47 === "string") {
                                                    if (!pattern5.test(data47)) {
                                                      validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/operationId", schemaPath: "#/properties/findings/items/properties/operationId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" }, message: 'must match pattern "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate36.errors = [{ instancePath: instancePath + "/findings/" + i5 + "/operationId", schemaPath: "#/properties/findings/items/properties/operationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid17 = _errs102 === errors2;
                                              } else {
                                                var valid17 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate36.errors = [{ instancePath: instancePath + "/findings/" + i5, schemaPath: "#/properties/findings/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid16 = _errs94 === errors2;
                              if (!valid16) {
                                break;
                              }
                            }
                          }
                        }
                      } else {
                        validate36.errors = [{ instancePath: instancePath + "/findings", schemaPath: "#/properties/findings/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs92 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.outputHashes !== void 0) {
                      let data48 = data.outputHashes;
                      const _errs104 = errors2;
                      if (errors2 === _errs104) {
                        if (data48 && typeof data48 == "object" && !Array.isArray(data48)) {
                          let missing8;
                          if (data48.operative === void 0 && (missing8 = "operative") || data48.consolidated === void 0 && (missing8 = "consolidated") || data48.redline === void 0 && (missing8 = "redline")) {
                            validate36.errors = [{ instancePath: instancePath + "/outputHashes", schemaPath: "#/properties/outputHashes/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                            return false;
                          } else {
                            const _errs106 = errors2;
                            for (const key8 in data48) {
                              if (!(key8 === "operative" || key8 === "consolidated" || key8 === "redline")) {
                                validate36.errors = [{ instancePath: instancePath + "/outputHashes", schemaPath: "#/properties/outputHashes/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs106 === errors2) {
                              if (data48.operative !== void 0) {
                                let data49 = data48.operative;
                                const _errs107 = errors2;
                                if (errors2 === _errs107) {
                                  if (typeof data49 === "string") {
                                    if (!pattern4.test(data49)) {
                                      validate36.errors = [{ instancePath: instancePath + "/outputHashes/operative", schemaPath: "#/properties/outputHashes/properties/operative/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                      return false;
                                    }
                                  } else {
                                    validate36.errors = [{ instancePath: instancePath + "/outputHashes/operative", schemaPath: "#/properties/outputHashes/properties/operative/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid18 = _errs107 === errors2;
                              } else {
                                var valid18 = true;
                              }
                              if (valid18) {
                                if (data48.consolidated !== void 0) {
                                  let data50 = data48.consolidated;
                                  const _errs109 = errors2;
                                  if (errors2 === _errs109) {
                                    if (typeof data50 === "string") {
                                      if (!pattern4.test(data50)) {
                                        validate36.errors = [{ instancePath: instancePath + "/outputHashes/consolidated", schemaPath: "#/properties/outputHashes/properties/consolidated/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate36.errors = [{ instancePath: instancePath + "/outputHashes/consolidated", schemaPath: "#/properties/outputHashes/properties/consolidated/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid18 = _errs109 === errors2;
                                } else {
                                  var valid18 = true;
                                }
                                if (valid18) {
                                  if (data48.redline !== void 0) {
                                    let data51 = data48.redline;
                                    const _errs111 = errors2;
                                    if (errors2 === _errs111) {
                                      if (typeof data51 === "string") {
                                        if (!pattern4.test(data51)) {
                                          validate36.errors = [{ instancePath: instancePath + "/outputHashes/redline", schemaPath: "#/properties/outputHashes/properties/redline/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate36.errors = [{ instancePath: instancePath + "/outputHashes/redline", schemaPath: "#/properties/outputHashes/properties/redline/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid18 = _errs111 === errors2;
                                  } else {
                                    var valid18 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate36.errors = [{ instancePath: instancePath + "/outputHashes", schemaPath: "#/properties/outputHashes/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs104 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.revisionSha256 !== void 0) {
                        let data52 = data.revisionSha256;
                        const _errs113 = errors2;
                        if (errors2 === _errs113) {
                          if (typeof data52 === "string") {
                            if (!pattern4.test(data52)) {
                              validate36.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                              return false;
                            }
                          } else {
                            validate36.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid0 = _errs113 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.approval !== void 0) {
                          const _errs115 = errors2;
                          if ("unapproved" !== data.approval) {
                            validate36.errors = [{ instancePath: instancePath + "/approval", schemaPath: "#/properties/approval/const", keyword: "const", params: { allowedValue: "unapproved" }, message: "must be equal to constant" }];
                            return false;
                          }
                          var valid0 = _errs115 === errors2;
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
      validate36.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate36.errors = vErrors;
  return errors2 === 0;
}
validate36.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.sourceArtifact === void 0 && (missing0 = "sourceArtifact") || data.draft === void 0 && (missing0 = "draft") || data.revisionSha256 === void 0 && (missing0 = "revisionSha256") || data.approval === void 0 && (missing0 = "approval")) {
        validate35.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sourceArtifact" || key0 === "draft" || key0 === "revisionSha256" || key0 === "approval")) {
            validate35.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sourceArtifact !== void 0) {
            let data0 = data.sourceArtifact;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.versionId === void 0 && (missing1 = "versionId") || data0.sha256 === void 0 && (missing1 = "sha256") || data0.specSha256 === void 0 && (missing1 = "specSha256")) {
                  validate35.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs5 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "versionId" || key1 === "sha256" || key1 === "specSha256")) {
                      validate35.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors2) {
                    if (data0.versionId !== void 0) {
                      let data1 = data0.versionId;
                      const _errs6 = errors2;
                      if (errors2 === _errs6) {
                        if (errors2 === _errs6) {
                          if (typeof data1 === "string") {
                            if (!formats2.test(data1)) {
                              validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/versionId", schemaPath: "#/$defs/FederalSourceArtifact/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/versionId", schemaPath: "#/$defs/FederalSourceArtifact/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                      }
                      var valid2 = _errs6 === errors2;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.sha256 !== void 0) {
                        let data2 = data0.sha256;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (!pattern4.test(data2)) {
                              validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/sha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                              return false;
                            }
                          } else {
                            validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/sha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.specSha256 !== void 0) {
                          let data3 = data0.specSha256;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (typeof data3 === "string") {
                              if (!pattern4.test(data3)) {
                                validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/specSha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/specSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate35.errors = [{ instancePath: instancePath + "/sourceArtifact/specSha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/specSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
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
                validate35.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.draft !== void 0) {
              const _errs12 = errors2;
              if (!validate36(data.draft, { instancePath: instancePath + "/draft", parentData: data, parentDataProperty: "draft", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs12 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.revisionSha256 !== void 0) {
                let data5 = data.revisionSha256;
                const _errs13 = errors2;
                if (errors2 === _errs13) {
                  if (typeof data5 === "string") {
                    if (!pattern4.test(data5)) {
                      validate35.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate35.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs13 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.approval !== void 0) {
                  const _errs15 = errors2;
                  if ("unapproved" !== data.approval) {
                    validate35.errors = [{ instancePath: instancePath + "/approval", schemaPath: "#/properties/approval/const", keyword: "const", params: { allowedValue: "unapproved" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs15 === errors2;
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
var schema51 = { "type": "object", "properties": { "contractVersion": { "const": "0.1.0" }, "artifactId": { "type": "string", "format": "uuid" }, "versionId": { "type": "string", "format": "uuid" }, "parentVersionId": { "anyOf": [{ "type": "string", "format": "uuid" }, { "type": "null" }] }, "binding": { "$ref": "#/$defs/RunBinding_84f2304c" }, "object": { "$ref": "#/$defs/ObjectReference_a099bd1c" }, "filename": { "type": "string", "minLength": 1, "maxLength": 255 }, "mimeType": { "type": "string", "minLength": 1 }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "evidence": { "type": "array", "items": { "$ref": "#/$defs/SourceEvidence_d9008775" } }, "generationStatus": { "type": "string", "enum": ["draft", "validated", "published", "failed"] }, "previewStatus": { "type": "string", "enum": ["pending", "validated", "unsupported", "failed"] }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" } }, "required": ["contractVersion", "artifactId", "versionId", "parentVersionId", "binding", "object", "filename", "mimeType", "scopes", "evidence", "generationStatus", "previewStatus", "createdAt"], "additionalProperties": false };
var schema54 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func0 = require_equal().default;
var formats28 = require_formats().fullFormats["date-time"];
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
      if (data.objectId === void 0 && (missing0 = "objectId") || data.versionId === void 0 && (missing0 = "versionId") || data.sha256 === void 0 && (missing0 = "sha256") || data.bytes === void 0 && (missing0 = "bytes") || data.scopes === void 0 && (missing0 = "scopes")) {
        validate41.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "objectId" || key0 === "versionId" || key0 === "sha256" || key0 === "bytes" || key0 === "scopes")) {
            validate41.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  if (!formats2.test(data0)) {
                    validate41.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                    return false;
                  }
                } else {
                  validate41.errors = [{ instancePath: instancePath + "/objectId", schemaPath: "#/properties/objectId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate41.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate41.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    if (!pattern4.test(data2)) {
                      validate41.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate41.errors = [{ instancePath: instancePath + "/sha256", schemaPath: "#/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate41.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs8) {
                    if (typeof data3 == "number" && isFinite(data3)) {
                      if (data3 > 9007199254740991 || isNaN(data3)) {
                        validate41.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data3 < 0 || isNaN(data3)) {
                          validate41.errors = [{ instancePath: instancePath + "/bytes", schemaPath: "#/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
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
                          validate41.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                  validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                            validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data6) < 1) {
                                              validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func2(data8) < 1) {
                                                  validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                  validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data9) < 1) {
                                                    validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                validate41.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                    validate41.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                    return false;
                                    break outer0;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate41.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
      validate41.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate41.errors = vErrors;
  return errors2 === 0;
}
validate41.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema56 = { "type": "object", "properties": { "sourceId": { "type": "string", "minLength": 1 }, "recordId": { "type": "string", "minLength": 1 }, "sourceVersionId": { "type": "string", "minLength": 1 }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "sourceUpdatedAt": { "anyOf": [{ "type": "string", "format": "date-time", "pattern": "Z$" }, { "type": "null" }] }, "citationId": { "type": "string", "format": "uuid" }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "contentSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "authorizationDecisionId": { "type": "string", "format": "uuid" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "authorizationDecisionId"], "additionalProperties": false };
var pattern34 = new RegExp("Z$", "u");
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
      if (data.sourceId === void 0 && (missing0 = "sourceId") || data.recordId === void 0 && (missing0 = "recordId") || data.sourceVersionId === void 0 && (missing0 = "sourceVersionId") || data.observedAt === void 0 && (missing0 = "observedAt") || data.sourceUpdatedAt === void 0 && (missing0 = "sourceUpdatedAt") || data.citationId === void 0 && (missing0 = "citationId") || data.scopes === void 0 && (missing0 = "scopes") || data.contentSha256 === void 0 && (missing0 = "contentSha256") || data.authorizationDecisionId === void 0 && (missing0 = "authorizationDecisionId")) {
        validate43.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema56.properties, key0)) {
            validate43.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate43.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                  return false;
                }
              } else {
                validate43.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/properties/sourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate43.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate43.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                      validate43.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  } else {
                    validate43.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/properties/sourceVersionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!pattern34.test(data3)) {
                          validate43.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats28.validate(data3)) {
                            validate43.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate43.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                          if (!pattern34.test(data4)) {
                            const err0 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/properties/sourceUpdatedAt/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (!formats28.validate(data4)) {
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
                    if (data.citationId !== void 0) {
                      let data5 = data.citationId;
                      const _errs16 = errors2;
                      if (errors2 === _errs16) {
                        if (errors2 === _errs16) {
                          if (typeof data5 === "string") {
                            if (!formats2.test(data5)) {
                              validate43.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate43.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/properties/citationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                      validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                      return false;
                                    } else {
                                      const _errs23 = errors2;
                                      for (const key1 in data7) {
                                        if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                          validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                                validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                return false;
                                              } else {
                                                if (func2(data8) < 1) {
                                                  validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                              validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            if (!(data9 === "tenant" || data9 === "client" || data9 === "mailbox" || data9 === "memory" || data9 === "document" || data9 === "private-user" || data9 === "public")) {
                                              validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                    validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func2(data10) < 1) {
                                                      validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                      validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                      return false;
                                                    } else {
                                                      if (func2(data11) < 1) {
                                                        validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate43.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                        validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                        return false;
                                        break outer0;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate43.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                              if (!pattern4.test(data12)) {
                                validate43.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate43.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/properties/contentSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  if (!formats2.test(data13)) {
                                    validate43.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate43.errors = [{ instancePath: instancePath + "/authorizationDecisionId", schemaPath: "#/properties/authorizationDecisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate43.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate43.errors = vErrors;
  return errors2 === 0;
}
validate43.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.artifactId === void 0 && (missing0 = "artifactId") || data.versionId === void 0 && (missing0 = "versionId") || data.parentVersionId === void 0 && (missing0 = "parentVersionId") || data.binding === void 0 && (missing0 = "binding") || data.object === void 0 && (missing0 = "object") || data.filename === void 0 && (missing0 = "filename") || data.mimeType === void 0 && (missing0 = "mimeType") || data.scopes === void 0 && (missing0 = "scopes") || data.evidence === void 0 && (missing0 = "evidence") || data.generationStatus === void 0 && (missing0 = "generationStatus") || data.previewStatus === void 0 && (missing0 = "previewStatus") || data.createdAt === void 0 && (missing0 = "createdAt")) {
        validate40.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema51.properties, key0)) {
            validate40.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate40.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
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
                    if (!formats2.test(data1)) {
                      validate40.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate40.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                      if (!formats2.test(data2)) {
                        validate40.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate40.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!formats2.test(data3)) {
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
                    validate40.errors = vErrors;
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
                          validate40.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs16 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate40.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                    validate40.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func2(data5) < 1) {
                                      validate40.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate40.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate40.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func2(data6) < 1) {
                                        validate40.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate40.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        if (!formats2.test(data7)) {
                                          validate40.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate40.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          if (!formats2.test(data8)) {
                                            validate40.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate40.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            if (!formats2.test(data9)) {
                                              validate40.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate40.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                              if (!formats2.test(data10)) {
                                                validate40.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate40.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate40.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs29) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate40.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate40.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                        validate40.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                      if (!validate41(data.object, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate41.errors : vErrors.concat(validate41.errors);
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
                              validate40.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                              return false;
                            } else {
                              if (func2(data13) < 1) {
                                validate40.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate40.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/properties/filename/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                validate40.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            } else {
                              validate40.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/properties/mimeType/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate40.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                                          validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                          return false;
                                        } else {
                                          const _errs41 = errors2;
                                          for (const key2 in data16) {
                                            if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                              validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
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
                                                    validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func2(data17) < 1) {
                                                      validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                  validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                                if (!(data18 === "tenant" || data18 === "client" || data18 === "mailbox" || data18 === "memory" || data18 === "document" || data18 === "private-user" || data18 === "public")) {
                                                  validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                        validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func2(data19) < 1) {
                                                          validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                          validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func2(data20) < 1) {
                                                            validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate40.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                                            validate40.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                            return false;
                                            break outer0;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate40.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                    if (!validate43(data21[i2], { instancePath: instancePath + "/evidence/" + i2, parentData: data21, parentDataProperty: i2, rootData, dynamicAnchors })) {
                                      vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
                                      errors2 = vErrors.length;
                                    }
                                    var valid8 = _errs52 === errors2;
                                    if (!valid8) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate40.errors = [{ instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                  validate40.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                if (!(data23 === "draft" || data23 === "validated" || data23 === "published" || data23 === "failed")) {
                                  validate40.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/properties/generationStatus/enum", keyword: "enum", params: { allowedValues: schema51.properties.generationStatus.enum }, message: "must be equal to one of the allowed values" }];
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
                                    validate40.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  if (!(data24 === "pending" || data24 === "validated" || data24 === "unsupported" || data24 === "failed")) {
                                    validate40.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/properties/previewStatus/enum", keyword: "enum", params: { allowedValues: schema51.properties.previewStatus.enum }, message: "must be equal to one of the allowed values" }];
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
                                          if (!pattern34.test(data25)) {
                                            validate40.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats28.validate(data25)) {
                                              validate40.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate40.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate40.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate40.errors = vErrors;
  return errors2 === 0;
}
validate40.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema58 = { "type": "object", "properties": { "contractVersion": { "const": "0.2.0" }, "artifactId": { "$ref": "#/$defs/artifactId_cc9f299e" }, "versionId": { "$ref": "#/$defs/versionId_e4470a54" }, "parentVersionId": { "$ref": "#/$defs/parentVersionId_116435a5" }, "binding": { "$ref": "#/$defs/binding_ad882dea" }, "object": { "$ref": "#/$defs/object_a3973f47" }, "filename": { "$ref": "#/$defs/filename_f09421cc" }, "mimeType": { "$ref": "#/$defs/mimeType_0837eb6f" }, "scopes": { "$ref": "#/$defs/scopes_3d363e5b" }, "evidence": { "type": "array", "items": { "$ref": "#/$defs/NativeSourceEvidence_cb9e6ba4" } }, "generationStatus": { "$ref": "#/$defs/generationStatus_0b8d37a9" }, "previewStatus": { "$ref": "#/$defs/previewStatus_fe162158" }, "createdAt": { "$ref": "#/$defs/createdAt_38444d79" } }, "required": ["contractVersion", "artifactId", "versionId", "parentVersionId", "binding", "object", "filename", "mimeType", "scopes", "evidence", "generationStatus", "previewStatus", "createdAt"], "additionalProperties": false };
var schema80 = { "type": "string", "enum": ["draft", "validated", "published", "failed"] };
var schema81 = { "type": "string", "enum": ["pending", "validated", "unsupported", "failed"] };
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
                  if (!formats2.test(data0)) {
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
                  if (func2(data1) < 1) {
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
                    if (!pattern4.test(data2)) {
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
                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs15 = errors2;
                                  for (const key1 in data5) {
                                    if (!(key1 === "tenantId" || key1 === "kind" || key1 === "resourceId" || key1 === "policyRevision")) {
                                      validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                            validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data6) < 1) {
                                              validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        if (!(data7 === "tenant" || data7 === "client" || data7 === "mailbox" || data7 === "memory" || data7 === "document" || data7 === "private-user" || data7 === "public")) {
                                          validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                return false;
                                              } else {
                                                if (func2(data8) < 1) {
                                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                  return false;
                                                }
                                              }
                                            } else {
                                              validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                  validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                  return false;
                                                } else {
                                                  if (func2(data9) < 1) {
                                                    validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                validate47.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
    if (Array.isArray(data)) {
      if (data.length < 1) {
        validate49.errors = [{ instancePath, schemaPath: "#/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                validate49.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
                return false;
              } else {
                const _errs4 = errors2;
                for (const key0 in data0) {
                  if (!(key0 === "tenantId" || key0 === "kind" || key0 === "resourceId" || key0 === "policyRevision")) {
                    validate49.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                        if (func2(data1) > 128) {
                          validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                          return false;
                        } else {
                          if (func2(data1) < 1) {
                            validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                            return false;
                          }
                        }
                      } else {
                        validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data2 === "tenant" || data2 === "client" || data2 === "mailbox" || data2 === "memory" || data2 === "document" || data2 === "private-user" || data2 === "public")) {
                        validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                            if (func2(data3) > 256) {
                              validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                              return false;
                            } else {
                              if (func2(data3) < 1) {
                                validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              if (func2(data4) > 128) {
                                validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func2(data4) < 1) {
                                  validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate49.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
              validate49.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                  validate49.errors = [{ instancePath, schemaPath: "#/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                  return false;
                  break outer0;
                }
              }
            }
          }
        }
      }
    } else {
      validate49.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
      return false;
    }
  }
  validate49.errors = vErrors;
  return errors2 === 0;
}
validate49.evaluated = { "items": true, "dynamicProps": false, "dynamicItems": false };
var schema69 = { "type": "object", "properties": { "sourceId": { "$ref": "#/$defs/sourceId_fa5f0f45" }, "recordId": { "$ref": "#/$defs/recordId_1173860d" }, "sourceVersionId": { "$ref": "#/$defs/sourceVersionId_a5aa4b63" }, "observedAt": { "$ref": "#/$defs/observedAt_fc731620" }, "sourceUpdatedAt": { "$ref": "#/$defs/sourceUpdatedAt_4a76a197" }, "citationId": { "$ref": "#/$defs/citationId_ae4e145b" }, "scopes": { "$ref": "#/$defs/scopes_78e0eb49" }, "contentSha256": { "$ref": "#/$defs/contentSha256_6b70d9f7" }, "binding": { "$ref": "#/$defs/RunBinding_84f2304c" } }, "required": ["sourceId", "recordId", "sourceVersionId", "observedAt", "sourceUpdatedAt", "citationId", "scopes", "contentSha256", "binding"], "additionalProperties": false };
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
    if (Array.isArray(data)) {
      if (data.length < 1) {
        validate52.errors = [{ instancePath, schemaPath: "#/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
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
                validate52.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
                return false;
              } else {
                const _errs4 = errors2;
                for (const key0 in data0) {
                  if (!(key0 === "tenantId" || key0 === "kind" || key0 === "resourceId" || key0 === "policyRevision")) {
                    validate52.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                        if (func2(data1) > 128) {
                          validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                          return false;
                        } else {
                          if (func2(data1) < 1) {
                            validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                            return false;
                          }
                        }
                      } else {
                        validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/tenantId", schemaPath: "#/$defs/Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data2 === "tenant" || data2 === "client" || data2 === "mailbox" || data2 === "memory" || data2 === "document" || data2 === "private-user" || data2 === "public")) {
                        validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/kind", schemaPath: "#/$defs/Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema54.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
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
                            if (func2(data3) > 256) {
                              validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                              return false;
                            } else {
                              if (func2(data3) < 1) {
                                validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/resourceId", schemaPath: "#/$defs/Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              if (func2(data4) > 128) {
                                validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func2(data4) < 1) {
                                  validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate52.errors = [{ instancePath: instancePath + "/" + i0 + "/policyRevision", schemaPath: "#/$defs/Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
              validate52.errors = [{ instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                  validate52.errors = [{ instancePath, schemaPath: "#/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                  return false;
                  break outer0;
                }
              }
            }
          }
        }
      }
    } else {
      validate52.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
      return false;
    }
  }
  validate52.errors = vErrors;
  return errors2 === 0;
}
validate52.evaluated = { "items": true, "dynamicProps": false, "dynamicItems": false };
function validate51(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate51.evaluated;
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
        validate51.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema69.properties, key0)) {
            validate51.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                if (func2(data0) < 1) {
                  validate51.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/$defs/sourceId_fa5f0f45/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                  return false;
                }
              } else {
                validate51.errors = [{ instancePath: instancePath + "/sourceId", schemaPath: "#/$defs/sourceId_fa5f0f45/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                  if (func2(data1) < 1) {
                    validate51.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/$defs/recordId_1173860d/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                } else {
                  validate51.errors = [{ instancePath: instancePath + "/recordId", schemaPath: "#/$defs/recordId_1173860d/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    if (func2(data2) < 1) {
                      validate51.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/$defs/sourceVersionId_a5aa4b63/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  } else {
                    validate51.errors = [{ instancePath: instancePath + "/sourceVersionId", schemaPath: "#/$defs/sourceVersionId_a5aa4b63/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!pattern34.test(data3)) {
                          validate51.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/observedAt_fc731620/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats28.validate(data3)) {
                            validate51.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/observedAt_fc731620/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate51.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/$defs/observedAt_fc731620/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                          if (!pattern34.test(data4)) {
                            const err0 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/sourceUpdatedAt_4a76a197/anyOf/0/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            if (!formats28.validate(data4)) {
                              const err1 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/sourceUpdatedAt_4a76a197/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors2++;
                            }
                          }
                        } else {
                          const err2 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/sourceUpdatedAt_4a76a197/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                      const err3 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/sourceUpdatedAt_4a76a197/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
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
                      const err4 = { instancePath: instancePath + "/sourceUpdatedAt", schemaPath: "#/$defs/sourceUpdatedAt_4a76a197/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors2++;
                      validate51.errors = vErrors;
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
                            if (!formats2.test(data5)) {
                              validate51.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/$defs/citationId_ae4e145b/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                              return false;
                            }
                          } else {
                            validate51.errors = [{ instancePath: instancePath + "/citationId", schemaPath: "#/$defs/citationId_ae4e145b/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!validate52(data.scopes, { instancePath: instancePath + "/scopes", parentData: data, parentDataProperty: "scopes", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate52.errors : vErrors.concat(validate52.errors);
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
                              if (!pattern4.test(data7)) {
                                validate51.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/$defs/contentSha256_6b70d9f7/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate51.errors = [{ instancePath: instancePath + "/contentSha256", schemaPath: "#/$defs/contentSha256_6b70d9f7/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate51.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                  return false;
                                } else {
                                  const _errs31 = errors2;
                                  for (const key1 in data8) {
                                    if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                                      validate51.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                          if (func2(data9) > 128) {
                                            validate51.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data9) < 1) {
                                              validate51.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate51.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            if (func2(data10) > 128) {
                                              validate51.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func2(data10) < 1) {
                                                validate51.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate51.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                if (!formats2.test(data11)) {
                                                  validate51.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate51.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                  if (!formats2.test(data12)) {
                                                    validate51.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate51.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                    if (!formats2.test(data13)) {
                                                      validate51.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate51.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                      if (!formats2.test(data14)) {
                                                        validate51.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                        return false;
                                                      }
                                                    } else {
                                                      validate51.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                                    validate51.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs44) {
                                                    if (typeof data15 == "number" && isFinite(data15)) {
                                                      if (data15 > 9007199254740991 || isNaN(data15)) {
                                                        validate51.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data15 < 1 || isNaN(data15)) {
                                                          validate51.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                                validate51.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
      validate51.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate51.errors = vErrors;
  return errors2 === 0;
}
validate51.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
          if (!func1.call(schema58.properties, key0)) {
            validate46.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.2.0" !== data.contractVersion) {
              validate46.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
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
                    if (!formats2.test(data1)) {
                      validate46.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/$defs/artifactId_cc9f299e/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate46.errors = [{ instancePath: instancePath + "/artifactId", schemaPath: "#/$defs/artifactId_cc9f299e/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                      if (!formats2.test(data2)) {
                        validate46.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/versionId_e4470a54/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate46.errors = [{ instancePath: instancePath + "/versionId", schemaPath: "#/$defs/versionId_e4470a54/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                        if (!formats2.test(data3)) {
                          const err0 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/parentVersionId_116435a5/anyOf/0/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                      } else {
                        const err1 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/parentVersionId_116435a5/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                    const err2 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/parentVersionId_116435a5/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
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
                    const err3 = { instancePath: instancePath + "/parentVersionId", schemaPath: "#/$defs/parentVersionId_116435a5/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                    validate46.errors = vErrors;
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
                          validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/binding_ad882dea/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                          return false;
                        } else {
                          const _errs19 = errors2;
                          for (const key1 in data4) {
                            if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                              validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/binding_ad882dea/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                  if (func2(data5) > 128) {
                                    validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/binding_ad882dea/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                    return false;
                                  } else {
                                    if (func2(data5) < 1) {
                                      validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/binding_ad882dea/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate46.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/binding_ad882dea/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    if (func2(data6) > 128) {
                                      validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/binding_ad882dea/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                      return false;
                                    } else {
                                      if (func2(data6) < 1) {
                                        validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/binding_ad882dea/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate46.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/binding_ad882dea/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        if (!formats2.test(data7)) {
                                          validate46.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/binding_ad882dea/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate46.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/binding_ad882dea/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          if (!formats2.test(data8)) {
                                            validate46.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/binding_ad882dea/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate46.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/binding_ad882dea/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            if (!formats2.test(data9)) {
                                              validate46.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/binding_ad882dea/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                              return false;
                                            }
                                          } else {
                                            validate46.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/binding_ad882dea/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                              if (!formats2.test(data10)) {
                                                validate46.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/binding_ad882dea/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                                return false;
                                              }
                                            } else {
                                              validate46.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/binding_ad882dea/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/binding_ad882dea/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs32) {
                                            if (typeof data11 == "number" && isFinite(data11)) {
                                              if (data11 > 9007199254740991 || isNaN(data11)) {
                                                validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/binding_ad882dea/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data11 < 1 || isNaN(data11)) {
                                                  validate46.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/binding_ad882dea/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                        validate46.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/binding_ad882dea/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                      if (!validate47(data.object, { instancePath: instancePath + "/object", parentData: data, parentDataProperty: "object", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
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
                            if (func2(data13) > 255) {
                              validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/filename_f09421cc/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                              return false;
                            } else {
                              if (func2(data13) < 1) {
                                validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/filename_f09421cc/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate46.errors = [{ instancePath: instancePath + "/filename", schemaPath: "#/$defs/filename_f09421cc/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              if (func2(data14) < 1) {
                                validate46.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/$defs/mimeType_0837eb6f/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            } else {
                              validate46.errors = [{ instancePath: instancePath + "/mimeType", schemaPath: "#/$defs/mimeType_0837eb6f/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                            if (!validate49(data.scopes, { instancePath: instancePath + "/scopes", parentData: data, parentDataProperty: "scopes", rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
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
                                    if (!validate51(data16[i0], { instancePath: instancePath + "/evidence/" + i0, parentData: data16, parentDataProperty: i0, rootData, dynamicAnchors })) {
                                      vErrors = vErrors === null ? validate51.errors : vErrors.concat(validate51.errors);
                                      errors2 = vErrors.length;
                                    }
                                    var valid9 = _errs44 === errors2;
                                    if (!valid9) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate46.errors = [{ instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
                                  validate46.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/$defs/generationStatus_0b8d37a9/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                if (!(data18 === "draft" || data18 === "validated" || data18 === "published" || data18 === "failed")) {
                                  validate46.errors = [{ instancePath: instancePath + "/generationStatus", schemaPath: "#/$defs/generationStatus_0b8d37a9/enum", keyword: "enum", params: { allowedValues: schema80.enum }, message: "must be equal to one of the allowed values" }];
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
                                    validate46.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/$defs/previewStatus_fe162158/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  if (!(data19 === "pending" || data19 === "validated" || data19 === "unsupported" || data19 === "failed")) {
                                    validate46.errors = [{ instancePath: instancePath + "/previewStatus", schemaPath: "#/$defs/previewStatus_fe162158/enum", keyword: "enum", params: { allowedValues: schema81.enum }, message: "must be equal to one of the allowed values" }];
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
                                          if (!pattern34.test(data20)) {
                                            validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/createdAt_38444d79/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats28.validate(data20)) {
                                              validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/createdAt_38444d79/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate46.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/$defs/createdAt_38444d79/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate46.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate46.errors = vErrors;
  return errors2 === 0;
}
validate46.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  if (!validate40(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate40.errors : vErrors.concat(validate40.errors);
    errors2 = vErrors.length;
  }
  var _valid0 = _errs1 === errors2;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors2;
  if (!validate46(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
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
    validate39.errors = vErrors;
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
  validate39.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate39.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate73(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate73.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schema === void 0 && (missing0 = "schema") || data.selection === void 0 && (missing0 = "selection") || data.prepared === void 0 && (missing0 = "prepared") || data.savedDraft === void 0 && (missing0 = "savedDraft")) {
        validate73.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schema" || key0 === "selection" || key0 === "prepared" || key0 === "savedDraft")) {
            validate73.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schema !== void 0) {
            const _errs2 = errors2;
            if ("meri.federal-review.v1" !== data.schema) {
              validate73.errors = [{ instancePath: instancePath + "/schema", schemaPath: "#/properties/schema/const", keyword: "const", params: { allowedValue: "meri.federal-review.v1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.selection !== void 0) {
              const _errs3 = errors2;
              if (!validate24(data.selection, { instancePath: instancePath + "/selection", parentData: data, parentDataProperty: "selection", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.prepared !== void 0) {
                const _errs4 = errors2;
                if (!validate35(data.prepared, { instancePath: instancePath + "/prepared", parentData: data, parentDataProperty: "prepared", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
                  errors2 = vErrors.length;
                }
                var valid0 = _errs4 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.savedDraft !== void 0) {
                  let data3 = data.savedDraft;
                  const _errs5 = errors2;
                  const _errs6 = errors2;
                  let valid1 = false;
                  const _errs7 = errors2;
                  if (!validate39(data3, { instancePath: instancePath + "/savedDraft", parentData: data, parentDataProperty: "savedDraft", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate39.errors : vErrors.concat(validate39.errors);
                    errors2 = vErrors.length;
                  }
                  var _valid0 = _errs7 === errors2;
                  valid1 = valid1 || _valid0;
                  const _errs8 = errors2;
                  if (data3 !== null) {
                    const err0 = { instancePath: instancePath + "/savedDraft", schemaPath: "#/properties/savedDraft/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  }
                  var _valid0 = _errs8 === errors2;
                  valid1 = valid1 || _valid0;
                  if (!valid1) {
                    const err1 = { instancePath: instancePath + "/savedDraft", schemaPath: "#/properties/savedDraft/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err1];
                    } else {
                      vErrors.push(err1);
                    }
                    errors2++;
                    validate73.errors = vErrors;
                    return false;
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
                  var valid0 = _errs5 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate73.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate73.errors = vErrors;
  return errors2 === 0;
}
validate73.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validatePublication = validate77;
var schema84 = { "type": "object", "properties": { "schema": { "const": "meri.federal-review.v1" }, "sourceArtifact": { "$ref": "#/$defs/FederalSourceArtifact" }, "revisionSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "output": { "enum": ["draft", "operative", "consolidated", "redline"] }, "review": { "enum": ["unapproved", "confirmed-for-export"] }, "publication": { "$ref": "#/$defs/ArtifactCreatedResult_183a755e" } }, "required": ["schema", "sourceArtifact", "revisionSha256", "output", "review", "publication"], "additionalProperties": false };
var schema87 = { "oneOf": [{ "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "txt" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "encoding": { "const": "UTF-8" }, "whitespace": { "const": "unchanged" } }, "required": ["encoding", "whitespace"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "docx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "paragraphs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "tables": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "pictures": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["paragraphs", "tables", "pictures"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "xlsx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "sheets": { "type": "array", "items": { "type": "string" }, "maxItems": 30 }, "formulas": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "formulaCache": { "enum": ["unverified-zero-placeholder; recalculation required", "removed/unverified; recalculation required"] }, "revisionMethod": { "const": "openpyxl typed-cell replacement" } }, "required": ["sheets", "formulas", "formulaCache"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "pptx" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "slides": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "editable": { "const": true }, "visualInspection": { "const": "pending" } }, "required": ["slides", "editable", "visualInspection"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "zip" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "rows": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "columns": { "type": "array", "items": { "type": "string" }, "maxItems": 200 }, "chart": { "type": "boolean" } }, "required": ["rows", "columns", "chart"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }, { "type": "object", "properties": { "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "bytes": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "format": { "const": "pdf" }, "nativeOpened": { "const": false }, "rendered": { "const": false }, "recalculated": { "const": false }, "members": { "type": "array", "items": { "type": "string", "maxLength": 500 }, "maxItems": 5e3 }, "details": { "type": "object", "properties": { "conversionCompleted": { "const": true }, "renderInspection": { "const": "pending" }, "sourceDocxSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["conversionCompleted", "renderInspection", "sourceDocxSha256"], "additionalProperties": false } }, "required": ["sha256", "bytes", "format", "nativeOpened", "rendered", "recalculated", "members", "details"], "additionalProperties": false }] };
var pattern54 = new RegExp("^sdk:[a-f0-9]{64}$", "u");
var pattern56 = new RegExp("^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", "u");
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
  const _errs0 = errors2;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors2;
  const _errs2 = errors2;
  if (errors2 === _errs2) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestSha256 === void 0 && (missing0 = "requestSha256") || data.authorizationReceiptId === void 0 && (missing0 = "authorizationReceiptId") || data.budgetTicketId === void 0 && (missing0 = "budgetTicketId") || data.objectCommitted === void 0 && (missing0 = "objectCommitted") || data.versionCommitted === void 0 && (missing0 = "versionCommitted") || data.nativeQualified === void 0 && (missing0 = "nativeQualified")) {
        const err0 = { instancePath, schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
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
            const err1 = { instancePath, schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
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
                if (!pattern4.test(data0)) {
                  const err2 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
              } else {
                const err3 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                  if (func2(data1) < 1) {
                    const err4 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/authorizationReceiptId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                  }
                } else {
                  const err5 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/authorizationReceiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                    if (func2(data2) < 1) {
                      const err6 = { instancePath: instancePath + "/budgetTicketId", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/budgetTicketId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                    }
                  } else {
                    const err7 = { instancePath: instancePath + "/budgetTicketId", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/budgetTicketId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                    const err8 = { instancePath: instancePath + "/objectCommitted", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/objectCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
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
                      const err9 = { instancePath: instancePath + "/versionCommitted", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/versionCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
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
                        const err10 = { instancePath: instancePath + "/nativeQualified", schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/properties/nativeQualified/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
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
      const err11 = { instancePath, schemaPath: "#/$defs/LegacyArtifactExecution_4afe1663/type", keyword: "type", params: { type: "object" }, message: "must be object" };
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
        const err12 = { instancePath, schemaPath: "#/$defs/NativeArtifactExecution_26204926/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
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
            const err13 = { instancePath, schemaPath: "#/$defs/NativeArtifactExecution_26204926/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
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
              const err14 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/kind/const", keyword: "const", params: { allowedValue: "native-document" }, message: "must be equal to constant" };
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
                  if (!pattern54.test(data7)) {
                    const err15 = { instancePath: instancePath + "/invocationId", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/invocationId/pattern", keyword: "pattern", params: { pattern: "^sdk:[a-f0-9]{64}$" }, message: 'must match pattern "^sdk:[a-f0-9]{64}$"' };
                    if (vErrors === null) {
                      vErrors = [err15];
                    } else {
                      vErrors.push(err15);
                    }
                    errors2++;
                  }
                } else {
                  const err16 = { instancePath: instancePath + "/invocationId", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/invocationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                    if (!pattern4.test(data8)) {
                      const err17 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                      if (vErrors === null) {
                        vErrors = [err17];
                      } else {
                        vErrors.push(err17);
                      }
                      errors2++;
                    }
                  } else {
                    const err18 = { instancePath: instancePath + "/requestSha256", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                      if (!pattern56.test(data9)) {
                        const err19 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/authorizationReceiptId/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$" }, message: 'must match pattern "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"' };
                        if (vErrors === null) {
                          vErrors = [err19];
                        } else {
                          vErrors.push(err19);
                        }
                        errors2++;
                      }
                    } else {
                      const err20 = { instancePath: instancePath + "/authorizationReceiptId", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/authorizationReceiptId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
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
                      const err21 = { instancePath: instancePath + "/objectCommitted", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/objectCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
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
                        const err22 = { instancePath: instancePath + "/versionCommitted", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/versionCommitted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
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
                          const err23 = { instancePath: instancePath + "/nativeQualified", schemaPath: "#/$defs/NativeArtifactExecution_26204926/properties/nativeQualified/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
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
      const err24 = { instancePath, schemaPath: "#/$defs/NativeArtifactExecution_26204926/type", keyword: "type", params: { type: "object" }, message: "must be object" };
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
    validate62.errors = vErrors;
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
  validate62.errors = vErrors;
  evaluated0.props = props0;
  return errors2 === 0;
}
validate62.evaluated = { "dynamicProps": true, "dynamicItems": false };
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
      if (data.version === void 0 && (missing0 = "version") || data.inspection === void 0 && (missing0 = "inspection") || data.execution === void 0 && (missing0 = "execution")) {
        validate60.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "version" || key0 === "inspection" || key0 === "execution")) {
            validate60.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.version !== void 0) {
            const _errs2 = errors2;
            if (!validate39(data.version, { instancePath: instancePath + "/version", parentData: data, parentDataProperty: "version", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate39.errors : vErrors.concat(validate39.errors);
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
              const _errs5 = errors2;
              let valid2 = false;
              let passing0 = null;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sha256 === void 0 && (missing1 = "sha256") || data1.bytes === void 0 && (missing1 = "bytes") || data1.format === void 0 && (missing1 = "format") || data1.nativeOpened === void 0 && (missing1 = "nativeOpened") || data1.rendered === void 0 && (missing1 = "rendered") || data1.recalculated === void 0 && (missing1 = "recalculated") || data1.members === void 0 && (missing1 = "members") || data1.details === void 0 && (missing1 = "details")) {
                    const err0 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors2++;
                  } else {
                    const _errs8 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "sha256" || key1 === "bytes" || key1 === "format" || key1 === "nativeOpened" || key1 === "rendered" || key1 === "recalculated" || key1 === "members" || key1 === "details")) {
                        const err1 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs8 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data2 = data1.sha256;
                        const _errs9 = errors2;
                        if (errors2 === _errs9) {
                          if (typeof data2 === "string") {
                            if (!pattern4.test(data2)) {
                              const err2 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors2++;
                            }
                          } else {
                            const err3 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                          }
                        }
                        var valid3 = _errs9 === errors2;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.bytes !== void 0) {
                          let data3 = data1.bytes;
                          const _errs11 = errors2;
                          if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                            const err4 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs11) {
                            if (typeof data3 == "number" && isFinite(data3)) {
                              if (data3 > 9007199254740991 || isNaN(data3)) {
                                const err5 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err5];
                                } else {
                                  vErrors.push(err5);
                                }
                                errors2++;
                              } else {
                                if (data3 < 0 || isNaN(data3)) {
                                  const err6 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                          var valid3 = _errs11 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data1.format !== void 0) {
                            const _errs13 = errors2;
                            if ("txt" !== data1.format) {
                              const err7 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/format/const", keyword: "const", params: { allowedValue: "txt" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err7];
                              } else {
                                vErrors.push(err7);
                              }
                              errors2++;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs14 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err8 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err8];
                                } else {
                                  vErrors.push(err8);
                                }
                                errors2++;
                              }
                              var valid3 = _errs14 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data1.rendered !== void 0) {
                                const _errs15 = errors2;
                                if (false !== data1.rendered) {
                                  const err9 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err9];
                                  } else {
                                    vErrors.push(err9);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs15 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data1.recalculated !== void 0) {
                                  const _errs16 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err10 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err10];
                                    } else {
                                      vErrors.push(err10);
                                    }
                                    errors2++;
                                  }
                                  var valid3 = _errs16 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data1.members !== void 0) {
                                    let data8 = data1.members;
                                    const _errs17 = errors2;
                                    if (errors2 === _errs17) {
                                      if (Array.isArray(data8)) {
                                        if (data8.length > 5e3) {
                                          const err11 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                          if (vErrors === null) {
                                            vErrors = [err11];
                                          } else {
                                            vErrors.push(err11);
                                          }
                                          errors2++;
                                        } else {
                                          var valid4 = true;
                                          const len0 = data8.length;
                                          for (let i0 = 0; i0 < len0; i0++) {
                                            let data9 = data8[i0];
                                            const _errs19 = errors2;
                                            if (errors2 === _errs19) {
                                              if (typeof data9 === "string") {
                                                if (func2(data9) > 500) {
                                                  const err12 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err12];
                                                  } else {
                                                    vErrors.push(err12);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err13 = { instancePath: instancePath + "/inspection/members/" + i0, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err13];
                                                } else {
                                                  vErrors.push(err13);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid4 = _errs19 === errors2;
                                            if (!valid4) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err14 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err14];
                                        } else {
                                          vErrors.push(err14);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid3 = _errs17 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data1.details !== void 0) {
                                      let data10 = data1.details;
                                      const _errs21 = errors2;
                                      if (errors2 === _errs21) {
                                        if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                                          let missing2;
                                          if (data10.encoding === void 0 && (missing2 = "encoding") || data10.whitespace === void 0 && (missing2 = "whitespace")) {
                                            const err15 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/details/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err15];
                                            } else {
                                              vErrors.push(err15);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs23 = errors2;
                                            for (const key2 in data10) {
                                              if (!(key2 === "encoding" || key2 === "whitespace")) {
                                                const err16 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err16];
                                                } else {
                                                  vErrors.push(err16);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs23 === errors2) {
                                              if (data10.encoding !== void 0) {
                                                const _errs24 = errors2;
                                                if ("UTF-8" !== data10.encoding) {
                                                  const err17 = { instancePath: instancePath + "/inspection/details/encoding", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/details/properties/encoding/const", keyword: "const", params: { allowedValue: "UTF-8" }, message: "must be equal to constant" };
                                                  if (vErrors === null) {
                                                    vErrors = [err17];
                                                  } else {
                                                    vErrors.push(err17);
                                                  }
                                                  errors2++;
                                                }
                                                var valid5 = _errs24 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data10.whitespace !== void 0) {
                                                  const _errs25 = errors2;
                                                  if ("unchanged" !== data10.whitespace) {
                                                    const err18 = { instancePath: instancePath + "/inspection/details/whitespace", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/details/properties/whitespace/const", keyword: "const", params: { allowedValue: "unchanged" }, message: "must be equal to constant" };
                                                    if (vErrors === null) {
                                                      vErrors = [err18];
                                                    } else {
                                                      vErrors.push(err18);
                                                    }
                                                    errors2++;
                                                  }
                                                  var valid5 = _errs25 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          const err19 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err19];
                                          } else {
                                            vErrors.push(err19);
                                          }
                                          errors2++;
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
                  }
                } else {
                  const err20 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err20];
                  } else {
                    vErrors.push(err20);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs6 === errors2;
              if (_valid0) {
                valid2 = true;
                passing0 = 0;
                var props1 = true;
              }
              const _errs26 = errors2;
              if (errors2 === _errs26) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing3;
                  if (data1.sha256 === void 0 && (missing3 = "sha256") || data1.bytes === void 0 && (missing3 = "bytes") || data1.format === void 0 && (missing3 = "format") || data1.nativeOpened === void 0 && (missing3 = "nativeOpened") || data1.rendered === void 0 && (missing3 = "rendered") || data1.recalculated === void 0 && (missing3 = "recalculated") || data1.members === void 0 && (missing3 = "members") || data1.details === void 0 && (missing3 = "details")) {
                    const err21 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                      vErrors = [err21];
                    } else {
                      vErrors.push(err21);
                    }
                    errors2++;
                  } else {
                    const _errs28 = errors2;
                    for (const key3 in data1) {
                      if (!(key3 === "sha256" || key3 === "bytes" || key3 === "format" || key3 === "nativeOpened" || key3 === "rendered" || key3 === "recalculated" || key3 === "members" || key3 === "details")) {
                        const err22 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err22];
                        } else {
                          vErrors.push(err22);
                        }
                        errors2++;
                        break;
                      }
                    }
                    if (_errs28 === errors2) {
                      if (data1.sha256 !== void 0) {
                        let data13 = data1.sha256;
                        const _errs29 = errors2;
                        if (errors2 === _errs29) {
                          if (typeof data13 === "string") {
                            if (!pattern4.test(data13)) {
                              const err23 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                              if (vErrors === null) {
                                vErrors = [err23];
                              } else {
                                vErrors.push(err23);
                              }
                              errors2++;
                            }
                          } else {
                            const err24 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err24];
                            } else {
                              vErrors.push(err24);
                            }
                            errors2++;
                          }
                        }
                        var valid6 = _errs29 === errors2;
                      } else {
                        var valid6 = true;
                      }
                      if (valid6) {
                        if (data1.bytes !== void 0) {
                          let data14 = data1.bytes;
                          const _errs31 = errors2;
                          if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                            const err25 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                            if (vErrors === null) {
                              vErrors = [err25];
                            } else {
                              vErrors.push(err25);
                            }
                            errors2++;
                          }
                          if (errors2 === _errs31) {
                            if (typeof data14 == "number" && isFinite(data14)) {
                              if (data14 > 9007199254740991 || isNaN(data14)) {
                                const err26 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                if (vErrors === null) {
                                  vErrors = [err26];
                                } else {
                                  vErrors.push(err26);
                                }
                                errors2++;
                              } else {
                                if (data14 < 0 || isNaN(data14)) {
                                  const err27 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                          var valid6 = _errs31 === errors2;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data1.format !== void 0) {
                            const _errs33 = errors2;
                            if ("docx" !== data1.format) {
                              const err28 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/format/const", keyword: "const", params: { allowedValue: "docx" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err28];
                              } else {
                                vErrors.push(err28);
                              }
                              errors2++;
                            }
                            var valid6 = _errs33 === errors2;
                          } else {
                            var valid6 = true;
                          }
                          if (valid6) {
                            if (data1.nativeOpened !== void 0) {
                              const _errs34 = errors2;
                              if (false !== data1.nativeOpened) {
                                const err29 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err29];
                                } else {
                                  vErrors.push(err29);
                                }
                                errors2++;
                              }
                              var valid6 = _errs34 === errors2;
                            } else {
                              var valid6 = true;
                            }
                            if (valid6) {
                              if (data1.rendered !== void 0) {
                                const _errs35 = errors2;
                                if (false !== data1.rendered) {
                                  const err30 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err30];
                                  } else {
                                    vErrors.push(err30);
                                  }
                                  errors2++;
                                }
                                var valid6 = _errs35 === errors2;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data1.recalculated !== void 0) {
                                  const _errs36 = errors2;
                                  if (false !== data1.recalculated) {
                                    const err31 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err31];
                                    } else {
                                      vErrors.push(err31);
                                    }
                                    errors2++;
                                  }
                                  var valid6 = _errs36 === errors2;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data1.members !== void 0) {
                                    let data19 = data1.members;
                                    const _errs37 = errors2;
                                    if (errors2 === _errs37) {
                                      if (Array.isArray(data19)) {
                                        if (data19.length > 5e3) {
                                          const err32 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                        } else {
                                          var valid7 = true;
                                          const len1 = data19.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            let data20 = data19[i1];
                                            const _errs39 = errors2;
                                            if (errors2 === _errs39) {
                                              if (typeof data20 === "string") {
                                                if (func2(data20) > 500) {
                                                  const err33 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err33];
                                                  } else {
                                                    vErrors.push(err33);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err34 = { instancePath: instancePath + "/inspection/members/" + i1, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err34];
                                                } else {
                                                  vErrors.push(err34);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid7 = _errs39 === errors2;
                                            if (!valid7) {
                                              break;
                                            }
                                          }
                                        }
                                      } else {
                                        const err35 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                          vErrors = [err35];
                                        } else {
                                          vErrors.push(err35);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid6 = _errs37 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data1.details !== void 0) {
                                      let data21 = data1.details;
                                      const _errs41 = errors2;
                                      if (errors2 === _errs41) {
                                        if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
                                          let missing4;
                                          if (data21.paragraphs === void 0 && (missing4 = "paragraphs") || data21.tables === void 0 && (missing4 = "tables") || data21.pictures === void 0 && (missing4 = "pictures")) {
                                            const err36 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                                            if (vErrors === null) {
                                              vErrors = [err36];
                                            } else {
                                              vErrors.push(err36);
                                            }
                                            errors2++;
                                          } else {
                                            const _errs43 = errors2;
                                            for (const key4 in data21) {
                                              if (!(key4 === "paragraphs" || key4 === "tables" || key4 === "pictures")) {
                                                const err37 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                                                if (vErrors === null) {
                                                  vErrors = [err37];
                                                } else {
                                                  vErrors.push(err37);
                                                }
                                                errors2++;
                                                break;
                                              }
                                            }
                                            if (_errs43 === errors2) {
                                              if (data21.paragraphs !== void 0) {
                                                let data22 = data21.paragraphs;
                                                const _errs44 = errors2;
                                                if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                                  const err38 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/paragraphs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                  if (vErrors === null) {
                                                    vErrors = [err38];
                                                  } else {
                                                    vErrors.push(err38);
                                                  }
                                                  errors2++;
                                                }
                                                if (errors2 === _errs44) {
                                                  if (typeof data22 == "number" && isFinite(data22)) {
                                                    if (data22 > 9007199254740991 || isNaN(data22)) {
                                                      const err39 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/paragraphs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                      if (vErrors === null) {
                                                        vErrors = [err39];
                                                      } else {
                                                        vErrors.push(err39);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (data22 < 0 || isNaN(data22)) {
                                                        const err40 = { instancePath: instancePath + "/inspection/details/paragraphs", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/paragraphs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                        if (vErrors === null) {
                                                          vErrors = [err40];
                                                        } else {
                                                          vErrors.push(err40);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  }
                                                }
                                                var valid8 = _errs44 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                              if (valid8) {
                                                if (data21.tables !== void 0) {
                                                  let data23 = data21.tables;
                                                  const _errs46 = errors2;
                                                  if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                                    const err41 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/tables/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                    if (vErrors === null) {
                                                      vErrors = [err41];
                                                    } else {
                                                      vErrors.push(err41);
                                                    }
                                                    errors2++;
                                                  }
                                                  if (errors2 === _errs46) {
                                                    if (typeof data23 == "number" && isFinite(data23)) {
                                                      if (data23 > 9007199254740991 || isNaN(data23)) {
                                                        const err42 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/tables/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                        if (vErrors === null) {
                                                          vErrors = [err42];
                                                        } else {
                                                          vErrors.push(err42);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        if (data23 < 0 || isNaN(data23)) {
                                                          const err43 = { instancePath: instancePath + "/inspection/details/tables", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/tables/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                          if (vErrors === null) {
                                                            vErrors = [err43];
                                                          } else {
                                                            vErrors.push(err43);
                                                          }
                                                          errors2++;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid8 = _errs46 === errors2;
                                                } else {
                                                  var valid8 = true;
                                                }
                                                if (valid8) {
                                                  if (data21.pictures !== void 0) {
                                                    let data24 = data21.pictures;
                                                    const _errs48 = errors2;
                                                    if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                                      const err44 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/pictures/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err44];
                                                      } else {
                                                        vErrors.push(err44);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs48) {
                                                      if (typeof data24 == "number" && isFinite(data24)) {
                                                        if (data24 > 9007199254740991 || isNaN(data24)) {
                                                          const err45 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/pictures/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err45];
                                                          } else {
                                                            vErrors.push(err45);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data24 < 0 || isNaN(data24)) {
                                                            const err46 = { instancePath: instancePath + "/inspection/details/pictures", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/properties/pictures/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err46];
                                                            } else {
                                                              vErrors.push(err46);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
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
                                          const err47 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                          if (vErrors === null) {
                                            vErrors = [err47];
                                          } else {
                                            vErrors.push(err47);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid6 = _errs41 === errors2;
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
                } else {
                  const err48 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors2++;
                }
              }
              var _valid0 = _errs26 === errors2;
              if (_valid0 && valid2) {
                valid2 = false;
                passing0 = [passing0, 1];
              } else {
                if (_valid0) {
                  valid2 = true;
                  passing0 = 1;
                  if (props1 !== true) {
                    props1 = true;
                  }
                }
                const _errs50 = errors2;
                if (errors2 === _errs50) {
                  if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                    let missing5;
                    if (data1.sha256 === void 0 && (missing5 = "sha256") || data1.bytes === void 0 && (missing5 = "bytes") || data1.format === void 0 && (missing5 = "format") || data1.nativeOpened === void 0 && (missing5 = "nativeOpened") || data1.rendered === void 0 && (missing5 = "rendered") || data1.recalculated === void 0 && (missing5 = "recalculated") || data1.members === void 0 && (missing5 = "members") || data1.details === void 0 && (missing5 = "details")) {
                      const err49 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                      if (vErrors === null) {
                        vErrors = [err49];
                      } else {
                        vErrors.push(err49);
                      }
                      errors2++;
                    } else {
                      const _errs52 = errors2;
                      for (const key5 in data1) {
                        if (!(key5 === "sha256" || key5 === "bytes" || key5 === "format" || key5 === "nativeOpened" || key5 === "rendered" || key5 === "recalculated" || key5 === "members" || key5 === "details")) {
                          const err50 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err50];
                          } else {
                            vErrors.push(err50);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs52 === errors2) {
                        if (data1.sha256 !== void 0) {
                          let data25 = data1.sha256;
                          const _errs53 = errors2;
                          if (errors2 === _errs53) {
                            if (typeof data25 === "string") {
                              if (!pattern4.test(data25)) {
                                const err51 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                if (vErrors === null) {
                                  vErrors = [err51];
                                } else {
                                  vErrors.push(err51);
                                }
                                errors2++;
                              }
                            } else {
                              const err52 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err52];
                              } else {
                                vErrors.push(err52);
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
                            let data26 = data1.bytes;
                            const _errs55 = errors2;
                            if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                              const err53 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err53];
                              } else {
                                vErrors.push(err53);
                              }
                              errors2++;
                            }
                            if (errors2 === _errs55) {
                              if (typeof data26 == "number" && isFinite(data26)) {
                                if (data26 > 9007199254740991 || isNaN(data26)) {
                                  const err54 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                  if (vErrors === null) {
                                    vErrors = [err54];
                                  } else {
                                    vErrors.push(err54);
                                  }
                                  errors2++;
                                } else {
                                  if (data26 < 0 || isNaN(data26)) {
                                    const err55 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                    if (vErrors === null) {
                                      vErrors = [err55];
                                    } else {
                                      vErrors.push(err55);
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
                              if ("xlsx" !== data1.format) {
                                const err56 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/format/const", keyword: "const", params: { allowedValue: "xlsx" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err56];
                                } else {
                                  vErrors.push(err56);
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
                                  const err57 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err57];
                                  } else {
                                    vErrors.push(err57);
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
                                    const err58 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err58];
                                    } else {
                                      vErrors.push(err58);
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
                                      const err59 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err59];
                                      } else {
                                        vErrors.push(err59);
                                      }
                                      errors2++;
                                    }
                                    var valid9 = _errs60 === errors2;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data1.members !== void 0) {
                                      let data31 = data1.members;
                                      const _errs61 = errors2;
                                      if (errors2 === _errs61) {
                                        if (Array.isArray(data31)) {
                                          if (data31.length > 5e3) {
                                            const err60 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                            if (vErrors === null) {
                                              vErrors = [err60];
                                            } else {
                                              vErrors.push(err60);
                                            }
                                            errors2++;
                                          } else {
                                            var valid10 = true;
                                            const len2 = data31.length;
                                            for (let i2 = 0; i2 < len2; i2++) {
                                              let data32 = data31[i2];
                                              const _errs63 = errors2;
                                              if (errors2 === _errs63) {
                                                if (typeof data32 === "string") {
                                                  if (func2(data32) > 500) {
                                                    const err61 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err61];
                                                    } else {
                                                      vErrors.push(err61);
                                                    }
                                                    errors2++;
                                                  }
                                                } else {
                                                  const err62 = { instancePath: instancePath + "/inspection/members/" + i2, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err62];
                                                  } else {
                                                    vErrors.push(err62);
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
                                          const err63 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                          if (vErrors === null) {
                                            vErrors = [err63];
                                          } else {
                                            vErrors.push(err63);
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
                                        let data33 = data1.details;
                                        const _errs65 = errors2;
                                        if (errors2 === _errs65) {
                                          if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
                                            let missing6;
                                            if (data33.sheets === void 0 && (missing6 = "sheets") || data33.formulas === void 0 && (missing6 = "formulas") || data33.formulaCache === void 0 && (missing6 = "formulaCache")) {
                                              const err64 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                                              if (vErrors === null) {
                                                vErrors = [err64];
                                              } else {
                                                vErrors.push(err64);
                                              }
                                              errors2++;
                                            } else {
                                              const _errs67 = errors2;
                                              for (const key6 in data33) {
                                                if (!(key6 === "sheets" || key6 === "formulas" || key6 === "formulaCache" || key6 === "revisionMethod")) {
                                                  const err65 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                                  if (vErrors === null) {
                                                    vErrors = [err65];
                                                  } else {
                                                    vErrors.push(err65);
                                                  }
                                                  errors2++;
                                                  break;
                                                }
                                              }
                                              if (_errs67 === errors2) {
                                                if (data33.sheets !== void 0) {
                                                  let data34 = data33.sheets;
                                                  const _errs68 = errors2;
                                                  if (errors2 === _errs68) {
                                                    if (Array.isArray(data34)) {
                                                      if (data34.length > 30) {
                                                        const err66 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/sheets/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
                                                        if (vErrors === null) {
                                                          vErrors = [err66];
                                                        } else {
                                                          vErrors.push(err66);
                                                        }
                                                        errors2++;
                                                      } else {
                                                        var valid12 = true;
                                                        const len3 = data34.length;
                                                        for (let i3 = 0; i3 < len3; i3++) {
                                                          const _errs70 = errors2;
                                                          if (typeof data34[i3] !== "string") {
                                                            const err67 = { instancePath: instancePath + "/inspection/details/sheets/" + i3, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/sheets/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                            if (vErrors === null) {
                                                              vErrors = [err67];
                                                            } else {
                                                              vErrors.push(err67);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid12 = _errs70 === errors2;
                                                          if (!valid12) {
                                                            break;
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      const err68 = { instancePath: instancePath + "/inspection/details/sheets", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/sheets/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                      if (vErrors === null) {
                                                        vErrors = [err68];
                                                      } else {
                                                        vErrors.push(err68);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid11 = _errs68 === errors2;
                                                } else {
                                                  var valid11 = true;
                                                }
                                                if (valid11) {
                                                  if (data33.formulas !== void 0) {
                                                    let data36 = data33.formulas;
                                                    const _errs72 = errors2;
                                                    if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                                      const err69 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/formulas/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err69];
                                                      } else {
                                                        vErrors.push(err69);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs72) {
                                                      if (typeof data36 == "number" && isFinite(data36)) {
                                                        if (data36 > 9007199254740991 || isNaN(data36)) {
                                                          const err70 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/formulas/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err70];
                                                          } else {
                                                            vErrors.push(err70);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data36 < 0 || isNaN(data36)) {
                                                            const err71 = { instancePath: instancePath + "/inspection/details/formulas", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/formulas/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err71];
                                                            } else {
                                                              vErrors.push(err71);
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
                                                  if (valid11) {
                                                    if (data33.formulaCache !== void 0) {
                                                      let data37 = data33.formulaCache;
                                                      const _errs74 = errors2;
                                                      if (!(data37 === "unverified-zero-placeholder; recalculation required" || data37 === "removed/unverified; recalculation required")) {
                                                        const err72 = { instancePath: instancePath + "/inspection/details/formulaCache", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/formulaCache/enum", keyword: "enum", params: { allowedValues: schema87.oneOf[2].properties.details.properties.formulaCache.enum }, message: "must be equal to one of the allowed values" };
                                                        if (vErrors === null) {
                                                          vErrors = [err72];
                                                        } else {
                                                          vErrors.push(err72);
                                                        }
                                                        errors2++;
                                                      }
                                                      var valid11 = _errs74 === errors2;
                                                    } else {
                                                      var valid11 = true;
                                                    }
                                                    if (valid11) {
                                                      if (data33.revisionMethod !== void 0) {
                                                        const _errs75 = errors2;
                                                        if ("openpyxl typed-cell replacement" !== data33.revisionMethod) {
                                                          const err73 = { instancePath: instancePath + "/inspection/details/revisionMethod", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/properties/revisionMethod/const", keyword: "const", params: { allowedValue: "openpyxl typed-cell replacement" }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err73];
                                                          } else {
                                                            vErrors.push(err73);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid11 = _errs75 === errors2;
                                                      } else {
                                                        var valid11 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            const err74 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                            if (vErrors === null) {
                                              vErrors = [err74];
                                            } else {
                                              vErrors.push(err74);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid9 = _errs65 === errors2;
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
                  } else {
                    const err75 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err75];
                    } else {
                      vErrors.push(err75);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs50 === errors2;
                if (_valid0 && valid2) {
                  valid2 = false;
                  passing0 = [passing0, 2];
                } else {
                  if (_valid0) {
                    valid2 = true;
                    passing0 = 2;
                    if (props1 !== true) {
                      props1 = true;
                    }
                  }
                  const _errs76 = errors2;
                  if (errors2 === _errs76) {
                    if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                      let missing7;
                      if (data1.sha256 === void 0 && (missing7 = "sha256") || data1.bytes === void 0 && (missing7 = "bytes") || data1.format === void 0 && (missing7 = "format") || data1.nativeOpened === void 0 && (missing7 = "nativeOpened") || data1.rendered === void 0 && (missing7 = "rendered") || data1.recalculated === void 0 && (missing7 = "recalculated") || data1.members === void 0 && (missing7 = "members") || data1.details === void 0 && (missing7 = "details")) {
                        const err76 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                        if (vErrors === null) {
                          vErrors = [err76];
                        } else {
                          vErrors.push(err76);
                        }
                        errors2++;
                      } else {
                        const _errs78 = errors2;
                        for (const key7 in data1) {
                          if (!(key7 === "sha256" || key7 === "bytes" || key7 === "format" || key7 === "nativeOpened" || key7 === "rendered" || key7 === "recalculated" || key7 === "members" || key7 === "details")) {
                            const err77 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err77];
                            } else {
                              vErrors.push(err77);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs78 === errors2) {
                          if (data1.sha256 !== void 0) {
                            let data39 = data1.sha256;
                            const _errs79 = errors2;
                            if (errors2 === _errs79) {
                              if (typeof data39 === "string") {
                                if (!pattern4.test(data39)) {
                                  const err78 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err78];
                                  } else {
                                    vErrors.push(err78);
                                  }
                                  errors2++;
                                }
                              } else {
                                const err79 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err79];
                                } else {
                                  vErrors.push(err79);
                                }
                                errors2++;
                              }
                            }
                            var valid13 = _errs79 === errors2;
                          } else {
                            var valid13 = true;
                          }
                          if (valid13) {
                            if (data1.bytes !== void 0) {
                              let data40 = data1.bytes;
                              const _errs81 = errors2;
                              if (!(typeof data40 == "number" && (!(data40 % 1) && !isNaN(data40)) && isFinite(data40))) {
                                const err80 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err80];
                                } else {
                                  vErrors.push(err80);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs81) {
                                if (typeof data40 == "number" && isFinite(data40)) {
                                  if (data40 > 9007199254740991 || isNaN(data40)) {
                                    const err81 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err81];
                                    } else {
                                      vErrors.push(err81);
                                    }
                                    errors2++;
                                  } else {
                                    if (data40 < 0 || isNaN(data40)) {
                                      const err82 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                              var valid13 = _errs81 === errors2;
                            } else {
                              var valid13 = true;
                            }
                            if (valid13) {
                              if (data1.format !== void 0) {
                                const _errs83 = errors2;
                                if ("pptx" !== data1.format) {
                                  const err83 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/format/const", keyword: "const", params: { allowedValue: "pptx" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err83];
                                  } else {
                                    vErrors.push(err83);
                                  }
                                  errors2++;
                                }
                                var valid13 = _errs83 === errors2;
                              } else {
                                var valid13 = true;
                              }
                              if (valid13) {
                                if (data1.nativeOpened !== void 0) {
                                  const _errs84 = errors2;
                                  if (false !== data1.nativeOpened) {
                                    const err84 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err84];
                                    } else {
                                      vErrors.push(err84);
                                    }
                                    errors2++;
                                  }
                                  var valid13 = _errs84 === errors2;
                                } else {
                                  var valid13 = true;
                                }
                                if (valid13) {
                                  if (data1.rendered !== void 0) {
                                    const _errs85 = errors2;
                                    if (false !== data1.rendered) {
                                      const err85 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err85];
                                      } else {
                                        vErrors.push(err85);
                                      }
                                      errors2++;
                                    }
                                    var valid13 = _errs85 === errors2;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data1.recalculated !== void 0) {
                                      const _errs86 = errors2;
                                      if (false !== data1.recalculated) {
                                        const err86 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err86];
                                        } else {
                                          vErrors.push(err86);
                                        }
                                        errors2++;
                                      }
                                      var valid13 = _errs86 === errors2;
                                    } else {
                                      var valid13 = true;
                                    }
                                    if (valid13) {
                                      if (data1.members !== void 0) {
                                        let data45 = data1.members;
                                        const _errs87 = errors2;
                                        if (errors2 === _errs87) {
                                          if (Array.isArray(data45)) {
                                            if (data45.length > 5e3) {
                                              const err87 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                              if (vErrors === null) {
                                                vErrors = [err87];
                                              } else {
                                                vErrors.push(err87);
                                              }
                                              errors2++;
                                            } else {
                                              var valid14 = true;
                                              const len4 = data45.length;
                                              for (let i4 = 0; i4 < len4; i4++) {
                                                let data46 = data45[i4];
                                                const _errs89 = errors2;
                                                if (errors2 === _errs89) {
                                                  if (typeof data46 === "string") {
                                                    if (func2(data46) > 500) {
                                                      const err88 = { instancePath: instancePath + "/inspection/members/" + i4, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err88];
                                                      } else {
                                                        vErrors.push(err88);
                                                      }
                                                      errors2++;
                                                    }
                                                  } else {
                                                    const err89 = { instancePath: instancePath + "/inspection/members/" + i4, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err89];
                                                    } else {
                                                      vErrors.push(err89);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid14 = _errs89 === errors2;
                                                if (!valid14) {
                                                  break;
                                                }
                                              }
                                            }
                                          } else {
                                            const err90 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                            if (vErrors === null) {
                                              vErrors = [err90];
                                            } else {
                                              vErrors.push(err90);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid13 = _errs87 === errors2;
                                      } else {
                                        var valid13 = true;
                                      }
                                      if (valid13) {
                                        if (data1.details !== void 0) {
                                          let data47 = data1.details;
                                          const _errs91 = errors2;
                                          if (errors2 === _errs91) {
                                            if (data47 && typeof data47 == "object" && !Array.isArray(data47)) {
                                              let missing8;
                                              if (data47.slides === void 0 && (missing8 = "slides") || data47.editable === void 0 && (missing8 = "editable") || data47.visualInspection === void 0 && (missing8 = "visualInspection")) {
                                                const err91 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                                if (vErrors === null) {
                                                  vErrors = [err91];
                                                } else {
                                                  vErrors.push(err91);
                                                }
                                                errors2++;
                                              } else {
                                                const _errs93 = errors2;
                                                for (const key8 in data47) {
                                                  if (!(key8 === "slides" || key8 === "editable" || key8 === "visualInspection")) {
                                                    const err92 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                                    if (vErrors === null) {
                                                      vErrors = [err92];
                                                    } else {
                                                      vErrors.push(err92);
                                                    }
                                                    errors2++;
                                                    break;
                                                  }
                                                }
                                                if (_errs93 === errors2) {
                                                  if (data47.slides !== void 0) {
                                                    let data48 = data47.slides;
                                                    const _errs94 = errors2;
                                                    if (!(typeof data48 == "number" && (!(data48 % 1) && !isNaN(data48)) && isFinite(data48))) {
                                                      const err93 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/properties/slides/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                      if (vErrors === null) {
                                                        vErrors = [err93];
                                                      } else {
                                                        vErrors.push(err93);
                                                      }
                                                      errors2++;
                                                    }
                                                    if (errors2 === _errs94) {
                                                      if (typeof data48 == "number" && isFinite(data48)) {
                                                        if (data48 > 9007199254740991 || isNaN(data48)) {
                                                          const err94 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/properties/slides/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                          if (vErrors === null) {
                                                            vErrors = [err94];
                                                          } else {
                                                            vErrors.push(err94);
                                                          }
                                                          errors2++;
                                                        } else {
                                                          if (data48 < 0 || isNaN(data48)) {
                                                            const err95 = { instancePath: instancePath + "/inspection/details/slides", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/properties/slides/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                            if (vErrors === null) {
                                                              vErrors = [err95];
                                                            } else {
                                                              vErrors.push(err95);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid15 = _errs94 === errors2;
                                                  } else {
                                                    var valid15 = true;
                                                  }
                                                  if (valid15) {
                                                    if (data47.editable !== void 0) {
                                                      const _errs96 = errors2;
                                                      if (true !== data47.editable) {
                                                        const err96 = { instancePath: instancePath + "/inspection/details/editable", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/properties/editable/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                        if (vErrors === null) {
                                                          vErrors = [err96];
                                                        } else {
                                                          vErrors.push(err96);
                                                        }
                                                        errors2++;
                                                      }
                                                      var valid15 = _errs96 === errors2;
                                                    } else {
                                                      var valid15 = true;
                                                    }
                                                    if (valid15) {
                                                      if (data47.visualInspection !== void 0) {
                                                        const _errs97 = errors2;
                                                        if ("pending" !== data47.visualInspection) {
                                                          const err97 = { instancePath: instancePath + "/inspection/details/visualInspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/properties/visualInspection/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err97];
                                                          } else {
                                                            vErrors.push(err97);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid15 = _errs97 === errors2;
                                                      } else {
                                                        var valid15 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              const err98 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                              if (vErrors === null) {
                                                vErrors = [err98];
                                              } else {
                                                vErrors.push(err98);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid13 = _errs91 === errors2;
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
                        }
                      }
                    } else {
                      const err99 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err99];
                      } else {
                        vErrors.push(err99);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs76 === errors2;
                  if (_valid0 && valid2) {
                    valid2 = false;
                    passing0 = [passing0, 3];
                  } else {
                    if (_valid0) {
                      valid2 = true;
                      passing0 = 3;
                      if (props1 !== true) {
                        props1 = true;
                      }
                    }
                    const _errs98 = errors2;
                    if (errors2 === _errs98) {
                      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                        let missing9;
                        if (data1.sha256 === void 0 && (missing9 = "sha256") || data1.bytes === void 0 && (missing9 = "bytes") || data1.format === void 0 && (missing9 = "format") || data1.nativeOpened === void 0 && (missing9 = "nativeOpened") || data1.rendered === void 0 && (missing9 = "rendered") || data1.recalculated === void 0 && (missing9 = "recalculated") || data1.members === void 0 && (missing9 = "members") || data1.details === void 0 && (missing9 = "details")) {
                          const err100 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                          if (vErrors === null) {
                            vErrors = [err100];
                          } else {
                            vErrors.push(err100);
                          }
                          errors2++;
                        } else {
                          const _errs100 = errors2;
                          for (const key9 in data1) {
                            if (!(key9 === "sha256" || key9 === "bytes" || key9 === "format" || key9 === "nativeOpened" || key9 === "rendered" || key9 === "recalculated" || key9 === "members" || key9 === "details")) {
                              const err101 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err101];
                              } else {
                                vErrors.push(err101);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs100 === errors2) {
                            if (data1.sha256 !== void 0) {
                              let data51 = data1.sha256;
                              const _errs101 = errors2;
                              if (errors2 === _errs101) {
                                if (typeof data51 === "string") {
                                  if (!pattern4.test(data51)) {
                                    const err102 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                    if (vErrors === null) {
                                      vErrors = [err102];
                                    } else {
                                      vErrors.push(err102);
                                    }
                                    errors2++;
                                  }
                                } else {
                                  const err103 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err103];
                                  } else {
                                    vErrors.push(err103);
                                  }
                                  errors2++;
                                }
                              }
                              var valid16 = _errs101 === errors2;
                            } else {
                              var valid16 = true;
                            }
                            if (valid16) {
                              if (data1.bytes !== void 0) {
                                let data52 = data1.bytes;
                                const _errs103 = errors2;
                                if (!(typeof data52 == "number" && (!(data52 % 1) && !isNaN(data52)) && isFinite(data52))) {
                                  const err104 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err104];
                                  } else {
                                    vErrors.push(err104);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs103) {
                                  if (typeof data52 == "number" && isFinite(data52)) {
                                    if (data52 > 9007199254740991 || isNaN(data52)) {
                                      const err105 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                      if (vErrors === null) {
                                        vErrors = [err105];
                                      } else {
                                        vErrors.push(err105);
                                      }
                                      errors2++;
                                    } else {
                                      if (data52 < 0 || isNaN(data52)) {
                                        const err106 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                        if (vErrors === null) {
                                          vErrors = [err106];
                                        } else {
                                          vErrors.push(err106);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                }
                                var valid16 = _errs103 === errors2;
                              } else {
                                var valid16 = true;
                              }
                              if (valid16) {
                                if (data1.format !== void 0) {
                                  const _errs105 = errors2;
                                  if ("zip" !== data1.format) {
                                    const err107 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/format/const", keyword: "const", params: { allowedValue: "zip" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err107];
                                    } else {
                                      vErrors.push(err107);
                                    }
                                    errors2++;
                                  }
                                  var valid16 = _errs105 === errors2;
                                } else {
                                  var valid16 = true;
                                }
                                if (valid16) {
                                  if (data1.nativeOpened !== void 0) {
                                    const _errs106 = errors2;
                                    if (false !== data1.nativeOpened) {
                                      const err108 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err108];
                                      } else {
                                        vErrors.push(err108);
                                      }
                                      errors2++;
                                    }
                                    var valid16 = _errs106 === errors2;
                                  } else {
                                    var valid16 = true;
                                  }
                                  if (valid16) {
                                    if (data1.rendered !== void 0) {
                                      const _errs107 = errors2;
                                      if (false !== data1.rendered) {
                                        const err109 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err109];
                                        } else {
                                          vErrors.push(err109);
                                        }
                                        errors2++;
                                      }
                                      var valid16 = _errs107 === errors2;
                                    } else {
                                      var valid16 = true;
                                    }
                                    if (valid16) {
                                      if (data1.recalculated !== void 0) {
                                        const _errs108 = errors2;
                                        if (false !== data1.recalculated) {
                                          const err110 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err110];
                                          } else {
                                            vErrors.push(err110);
                                          }
                                          errors2++;
                                        }
                                        var valid16 = _errs108 === errors2;
                                      } else {
                                        var valid16 = true;
                                      }
                                      if (valid16) {
                                        if (data1.members !== void 0) {
                                          let data57 = data1.members;
                                          const _errs109 = errors2;
                                          if (errors2 === _errs109) {
                                            if (Array.isArray(data57)) {
                                              if (data57.length > 5e3) {
                                                const err111 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                                if (vErrors === null) {
                                                  vErrors = [err111];
                                                } else {
                                                  vErrors.push(err111);
                                                }
                                                errors2++;
                                              } else {
                                                var valid17 = true;
                                                const len5 = data57.length;
                                                for (let i5 = 0; i5 < len5; i5++) {
                                                  let data58 = data57[i5];
                                                  const _errs111 = errors2;
                                                  if (errors2 === _errs111) {
                                                    if (typeof data58 === "string") {
                                                      if (func2(data58) > 500) {
                                                        const err112 = { instancePath: instancePath + "/inspection/members/" + i5, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err112];
                                                        } else {
                                                          vErrors.push(err112);
                                                        }
                                                        errors2++;
                                                      }
                                                    } else {
                                                      const err113 = { instancePath: instancePath + "/inspection/members/" + i5, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                      if (vErrors === null) {
                                                        vErrors = [err113];
                                                      } else {
                                                        vErrors.push(err113);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                  var valid17 = _errs111 === errors2;
                                                  if (!valid17) {
                                                    break;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err114 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                              if (vErrors === null) {
                                                vErrors = [err114];
                                              } else {
                                                vErrors.push(err114);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid16 = _errs109 === errors2;
                                        } else {
                                          var valid16 = true;
                                        }
                                        if (valid16) {
                                          if (data1.details !== void 0) {
                                            let data59 = data1.details;
                                            const _errs113 = errors2;
                                            if (errors2 === _errs113) {
                                              if (data59 && typeof data59 == "object" && !Array.isArray(data59)) {
                                                let missing10;
                                                if (data59.rows === void 0 && (missing10 = "rows") || data59.columns === void 0 && (missing10 = "columns") || data59.chart === void 0 && (missing10 = "chart")) {
                                                  const err115 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                                                  if (vErrors === null) {
                                                    vErrors = [err115];
                                                  } else {
                                                    vErrors.push(err115);
                                                  }
                                                  errors2++;
                                                } else {
                                                  const _errs115 = errors2;
                                                  for (const key10 in data59) {
                                                    if (!(key10 === "rows" || key10 === "columns" || key10 === "chart")) {
                                                      const err116 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                                      if (vErrors === null) {
                                                        vErrors = [err116];
                                                      } else {
                                                        vErrors.push(err116);
                                                      }
                                                      errors2++;
                                                      break;
                                                    }
                                                  }
                                                  if (_errs115 === errors2) {
                                                    if (data59.rows !== void 0) {
                                                      let data60 = data59.rows;
                                                      const _errs116 = errors2;
                                                      if (!(typeof data60 == "number" && (!(data60 % 1) && !isNaN(data60)) && isFinite(data60))) {
                                                        const err117 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/rows/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                        if (vErrors === null) {
                                                          vErrors = [err117];
                                                        } else {
                                                          vErrors.push(err117);
                                                        }
                                                        errors2++;
                                                      }
                                                      if (errors2 === _errs116) {
                                                        if (typeof data60 == "number" && isFinite(data60)) {
                                                          if (data60 > 9007199254740991 || isNaN(data60)) {
                                                            const err118 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/rows/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                            if (vErrors === null) {
                                                              vErrors = [err118];
                                                            } else {
                                                              vErrors.push(err118);
                                                            }
                                                            errors2++;
                                                          } else {
                                                            if (data60 < 0 || isNaN(data60)) {
                                                              const err119 = { instancePath: instancePath + "/inspection/details/rows", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/rows/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                              if (vErrors === null) {
                                                                vErrors = [err119];
                                                              } else {
                                                                vErrors.push(err119);
                                                              }
                                                              errors2++;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid18 = _errs116 === errors2;
                                                    } else {
                                                      var valid18 = true;
                                                    }
                                                    if (valid18) {
                                                      if (data59.columns !== void 0) {
                                                        let data61 = data59.columns;
                                                        const _errs118 = errors2;
                                                        if (errors2 === _errs118) {
                                                          if (Array.isArray(data61)) {
                                                            if (data61.length > 200) {
                                                              const err120 = { instancePath: instancePath + "/inspection/details/columns", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/columns/maxItems", keyword: "maxItems", params: { limit: 200 }, message: "must NOT have more than 200 items" };
                                                              if (vErrors === null) {
                                                                vErrors = [err120];
                                                              } else {
                                                                vErrors.push(err120);
                                                              }
                                                              errors2++;
                                                            } else {
                                                              var valid19 = true;
                                                              const len6 = data61.length;
                                                              for (let i6 = 0; i6 < len6; i6++) {
                                                                const _errs120 = errors2;
                                                                if (typeof data61[i6] !== "string") {
                                                                  const err121 = { instancePath: instancePath + "/inspection/details/columns/" + i6, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/columns/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err121];
                                                                  } else {
                                                                    vErrors.push(err121);
                                                                  }
                                                                  errors2++;
                                                                }
                                                                var valid19 = _errs120 === errors2;
                                                                if (!valid19) {
                                                                  break;
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            const err122 = { instancePath: instancePath + "/inspection/details/columns", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/columns/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                            if (vErrors === null) {
                                                              vErrors = [err122];
                                                            } else {
                                                              vErrors.push(err122);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                        var valid18 = _errs118 === errors2;
                                                      } else {
                                                        var valid18 = true;
                                                      }
                                                      if (valid18) {
                                                        if (data59.chart !== void 0) {
                                                          const _errs122 = errors2;
                                                          if (typeof data59.chart !== "boolean") {
                                                            const err123 = { instancePath: instancePath + "/inspection/details/chart", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/properties/chart/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                                            if (vErrors === null) {
                                                              vErrors = [err123];
                                                            } else {
                                                              vErrors.push(err123);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid18 = _errs122 === errors2;
                                                        } else {
                                                          var valid18 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                const err124 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                                if (vErrors === null) {
                                                  vErrors = [err124];
                                                } else {
                                                  vErrors.push(err124);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid16 = _errs113 === errors2;
                                          } else {
                                            var valid16 = true;
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
                        const err125 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err125];
                        } else {
                          vErrors.push(err125);
                        }
                        errors2++;
                      }
                    }
                    var _valid0 = _errs98 === errors2;
                    if (_valid0 && valid2) {
                      valid2 = false;
                      passing0 = [passing0, 4];
                    } else {
                      if (_valid0) {
                        valid2 = true;
                        passing0 = 4;
                        if (props1 !== true) {
                          props1 = true;
                        }
                      }
                      const _errs124 = errors2;
                      if (errors2 === _errs124) {
                        if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                          let missing11;
                          if (data1.sha256 === void 0 && (missing11 = "sha256") || data1.bytes === void 0 && (missing11 = "bytes") || data1.format === void 0 && (missing11 = "format") || data1.nativeOpened === void 0 && (missing11 = "nativeOpened") || data1.rendered === void 0 && (missing11 = "rendered") || data1.recalculated === void 0 && (missing11 = "recalculated") || data1.members === void 0 && (missing11 = "members") || data1.details === void 0 && (missing11 = "details")) {
                            const err126 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" };
                            if (vErrors === null) {
                              vErrors = [err126];
                            } else {
                              vErrors.push(err126);
                            }
                            errors2++;
                          } else {
                            const _errs126 = errors2;
                            for (const key11 in data1) {
                              if (!(key11 === "sha256" || key11 === "bytes" || key11 === "format" || key11 === "nativeOpened" || key11 === "rendered" || key11 === "recalculated" || key11 === "members" || key11 === "details")) {
                                const err127 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err127];
                                } else {
                                  vErrors.push(err127);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs126 === errors2) {
                              if (data1.sha256 !== void 0) {
                                let data64 = data1.sha256;
                                const _errs127 = errors2;
                                if (errors2 === _errs127) {
                                  if (typeof data64 === "string") {
                                    if (!pattern4.test(data64)) {
                                      const err128 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                      if (vErrors === null) {
                                        vErrors = [err128];
                                      } else {
                                        vErrors.push(err128);
                                      }
                                      errors2++;
                                    }
                                  } else {
                                    const err129 = { instancePath: instancePath + "/inspection/sha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err129];
                                    } else {
                                      vErrors.push(err129);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid20 = _errs127 === errors2;
                              } else {
                                var valid20 = true;
                              }
                              if (valid20) {
                                if (data1.bytes !== void 0) {
                                  let data65 = data1.bytes;
                                  const _errs129 = errors2;
                                  if (!(typeof data65 == "number" && (!(data65 % 1) && !isNaN(data65)) && isFinite(data65))) {
                                    const err130 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/bytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err130];
                                    } else {
                                      vErrors.push(err130);
                                    }
                                    errors2++;
                                  }
                                  if (errors2 === _errs129) {
                                    if (typeof data65 == "number" && isFinite(data65)) {
                                      if (data65 > 9007199254740991 || isNaN(data65)) {
                                        const err131 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/bytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                        if (vErrors === null) {
                                          vErrors = [err131];
                                        } else {
                                          vErrors.push(err131);
                                        }
                                        errors2++;
                                      } else {
                                        if (data65 < 0 || isNaN(data65)) {
                                          const err132 = { instancePath: instancePath + "/inspection/bytes", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/bytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                          if (vErrors === null) {
                                            vErrors = [err132];
                                          } else {
                                            vErrors.push(err132);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                  var valid20 = _errs129 === errors2;
                                } else {
                                  var valid20 = true;
                                }
                                if (valid20) {
                                  if (data1.format !== void 0) {
                                    const _errs131 = errors2;
                                    if ("pdf" !== data1.format) {
                                      const err133 = { instancePath: instancePath + "/inspection/format", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/format/const", keyword: "const", params: { allowedValue: "pdf" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err133];
                                      } else {
                                        vErrors.push(err133);
                                      }
                                      errors2++;
                                    }
                                    var valid20 = _errs131 === errors2;
                                  } else {
                                    var valid20 = true;
                                  }
                                  if (valid20) {
                                    if (data1.nativeOpened !== void 0) {
                                      const _errs132 = errors2;
                                      if (false !== data1.nativeOpened) {
                                        const err134 = { instancePath: instancePath + "/inspection/nativeOpened", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/nativeOpened/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err134];
                                        } else {
                                          vErrors.push(err134);
                                        }
                                        errors2++;
                                      }
                                      var valid20 = _errs132 === errors2;
                                    } else {
                                      var valid20 = true;
                                    }
                                    if (valid20) {
                                      if (data1.rendered !== void 0) {
                                        const _errs133 = errors2;
                                        if (false !== data1.rendered) {
                                          const err135 = { instancePath: instancePath + "/inspection/rendered", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/rendered/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err135];
                                          } else {
                                            vErrors.push(err135);
                                          }
                                          errors2++;
                                        }
                                        var valid20 = _errs133 === errors2;
                                      } else {
                                        var valid20 = true;
                                      }
                                      if (valid20) {
                                        if (data1.recalculated !== void 0) {
                                          const _errs134 = errors2;
                                          if (false !== data1.recalculated) {
                                            const err136 = { instancePath: instancePath + "/inspection/recalculated", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/recalculated/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
                                            if (vErrors === null) {
                                              vErrors = [err136];
                                            } else {
                                              vErrors.push(err136);
                                            }
                                            errors2++;
                                          }
                                          var valid20 = _errs134 === errors2;
                                        } else {
                                          var valid20 = true;
                                        }
                                        if (valid20) {
                                          if (data1.members !== void 0) {
                                            let data70 = data1.members;
                                            const _errs135 = errors2;
                                            if (errors2 === _errs135) {
                                              if (Array.isArray(data70)) {
                                                if (data70.length > 5e3) {
                                                  const err137 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/members/maxItems", keyword: "maxItems", params: { limit: 5e3 }, message: "must NOT have more than 5000 items" };
                                                  if (vErrors === null) {
                                                    vErrors = [err137];
                                                  } else {
                                                    vErrors.push(err137);
                                                  }
                                                  errors2++;
                                                } else {
                                                  var valid21 = true;
                                                  const len7 = data70.length;
                                                  for (let i7 = 0; i7 < len7; i7++) {
                                                    let data71 = data70[i7];
                                                    const _errs137 = errors2;
                                                    if (errors2 === _errs137) {
                                                      if (typeof data71 === "string") {
                                                        if (func2(data71) > 500) {
                                                          const err138 = { instancePath: instancePath + "/inspection/members/" + i7, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/members/items/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
                                                          if (vErrors === null) {
                                                            vErrors = [err138];
                                                          } else {
                                                            vErrors.push(err138);
                                                          }
                                                          errors2++;
                                                        }
                                                      } else {
                                                        const err139 = { instancePath: instancePath + "/inspection/members/" + i7, schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/members/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                        if (vErrors === null) {
                                                          vErrors = [err139];
                                                        } else {
                                                          vErrors.push(err139);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                    var valid21 = _errs137 === errors2;
                                                    if (!valid21) {
                                                      break;
                                                    }
                                                  }
                                                }
                                              } else {
                                                const err140 = { instancePath: instancePath + "/inspection/members", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/members/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                                if (vErrors === null) {
                                                  vErrors = [err140];
                                                } else {
                                                  vErrors.push(err140);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid20 = _errs135 === errors2;
                                          } else {
                                            var valid20 = true;
                                          }
                                          if (valid20) {
                                            if (data1.details !== void 0) {
                                              let data72 = data1.details;
                                              const _errs139 = errors2;
                                              if (errors2 === _errs139) {
                                                if (data72 && typeof data72 == "object" && !Array.isArray(data72)) {
                                                  let missing12;
                                                  if (data72.conversionCompleted === void 0 && (missing12 = "conversionCompleted") || data72.renderInspection === void 0 && (missing12 = "renderInspection") || data72.sourceDocxSha256 === void 0 && (missing12 = "sourceDocxSha256")) {
                                                    const err141 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" };
                                                    if (vErrors === null) {
                                                      vErrors = [err141];
                                                    } else {
                                                      vErrors.push(err141);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    const _errs141 = errors2;
                                                    for (const key12 in data72) {
                                                      if (!(key12 === "conversionCompleted" || key12 === "renderInspection" || key12 === "sourceDocxSha256")) {
                                                        const err142 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" };
                                                        if (vErrors === null) {
                                                          vErrors = [err142];
                                                        } else {
                                                          vErrors.push(err142);
                                                        }
                                                        errors2++;
                                                        break;
                                                      }
                                                    }
                                                    if (_errs141 === errors2) {
                                                      if (data72.conversionCompleted !== void 0) {
                                                        const _errs142 = errors2;
                                                        if (true !== data72.conversionCompleted) {
                                                          const err143 = { instancePath: instancePath + "/inspection/details/conversionCompleted", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/properties/conversionCompleted/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
                                                          if (vErrors === null) {
                                                            vErrors = [err143];
                                                          } else {
                                                            vErrors.push(err143);
                                                          }
                                                          errors2++;
                                                        }
                                                        var valid22 = _errs142 === errors2;
                                                      } else {
                                                        var valid22 = true;
                                                      }
                                                      if (valid22) {
                                                        if (data72.renderInspection !== void 0) {
                                                          const _errs143 = errors2;
                                                          if ("pending" !== data72.renderInspection) {
                                                            const err144 = { instancePath: instancePath + "/inspection/details/renderInspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/properties/renderInspection/const", keyword: "const", params: { allowedValue: "pending" }, message: "must be equal to constant" };
                                                            if (vErrors === null) {
                                                              vErrors = [err144];
                                                            } else {
                                                              vErrors.push(err144);
                                                            }
                                                            errors2++;
                                                          }
                                                          var valid22 = _errs143 === errors2;
                                                        } else {
                                                          var valid22 = true;
                                                        }
                                                        if (valid22) {
                                                          if (data72.sourceDocxSha256 !== void 0) {
                                                            let data75 = data72.sourceDocxSha256;
                                                            const _errs144 = errors2;
                                                            if (errors2 === _errs144) {
                                                              if (typeof data75 === "string") {
                                                                if (!pattern4.test(data75)) {
                                                                  const err145 = { instancePath: instancePath + "/inspection/details/sourceDocxSha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/properties/sourceDocxSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err145];
                                                                  } else {
                                                                    vErrors.push(err145);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              } else {
                                                                const err146 = { instancePath: instancePath + "/inspection/details/sourceDocxSha256", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/properties/sourceDocxSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                if (vErrors === null) {
                                                                  vErrors = [err146];
                                                                } else {
                                                                  vErrors.push(err146);
                                                                }
                                                                errors2++;
                                                              }
                                                            }
                                                            var valid22 = _errs144 === errors2;
                                                          } else {
                                                            var valid22 = true;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                } else {
                                                  const err147 = { instancePath: instancePath + "/inspection/details", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                                  if (vErrors === null) {
                                                    vErrors = [err147];
                                                  } else {
                                                    vErrors.push(err147);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid20 = _errs139 === errors2;
                                            } else {
                                              var valid20 = true;
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
                          const err148 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err148];
                          } else {
                            vErrors.push(err148);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs124 === errors2;
                      if (_valid0 && valid2) {
                        valid2 = false;
                        passing0 = [passing0, 5];
                      } else {
                        if (_valid0) {
                          valid2 = true;
                          passing0 = 5;
                          if (props1 !== true) {
                            props1 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
              if (!valid2) {
                const err149 = { instancePath: instancePath + "/inspection", schemaPath: "#/$defs/ArtifactInspection_3ae45145/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                if (vErrors === null) {
                  vErrors = [err149];
                } else {
                  vErrors.push(err149);
                }
                errors2++;
                validate60.errors = vErrors;
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
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.execution !== void 0) {
                const _errs146 = errors2;
                if (!validate62(data.execution, { instancePath: instancePath + "/execution", parentData: data, parentDataProperty: "execution", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate62.errors : vErrors.concat(validate62.errors);
                  errors2 = vErrors.length;
                }
                var valid0 = _errs146 === errors2;
              } else {
                var valid0 = true;
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
function validate77(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate77.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.schema === void 0 && (missing0 = "schema") || data.sourceArtifact === void 0 && (missing0 = "sourceArtifact") || data.revisionSha256 === void 0 && (missing0 = "revisionSha256") || data.output === void 0 && (missing0 = "output") || data.review === void 0 && (missing0 = "review") || data.publication === void 0 && (missing0 = "publication")) {
        validate77.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schema" || key0 === "sourceArtifact" || key0 === "revisionSha256" || key0 === "output" || key0 === "review" || key0 === "publication")) {
            validate77.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schema !== void 0) {
            const _errs2 = errors2;
            if ("meri.federal-review.v1" !== data.schema) {
              validate77.errors = [{ instancePath: instancePath + "/schema", schemaPath: "#/properties/schema/const", keyword: "const", params: { allowedValue: "meri.federal-review.v1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.sourceArtifact !== void 0) {
              let data1 = data.sourceArtifact;
              const _errs3 = errors2;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.versionId === void 0 && (missing1 = "versionId") || data1.sha256 === void 0 && (missing1 = "sha256") || data1.specSha256 === void 0 && (missing1 = "specSha256")) {
                    validate77.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs6 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "versionId" || key1 === "sha256" || key1 === "specSha256")) {
                        validate77.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors2) {
                      if (data1.versionId !== void 0) {
                        let data2 = data1.versionId;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (errors2 === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats2.test(data2)) {
                                validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/versionId", schemaPath: "#/$defs/FederalSourceArtifact/properties/versionId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                return false;
                              }
                            } else {
                              validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/versionId", schemaPath: "#/$defs/FederalSourceArtifact/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.sha256 !== void 0) {
                          let data3 = data1.sha256;
                          const _errs9 = errors2;
                          if (errors2 === _errs9) {
                            if (typeof data3 === "string") {
                              if (!pattern4.test(data3)) {
                                validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/sha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                return false;
                              }
                            } else {
                              validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/sha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs9 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.specSha256 !== void 0) {
                            let data4 = data1.specSha256;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (typeof data4 === "string") {
                                if (!pattern4.test(data4)) {
                                  validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/specSha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/specSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                  return false;
                                }
                              } else {
                                validate77.errors = [{ instancePath: instancePath + "/sourceArtifact/specSha256", schemaPath: "#/$defs/FederalSourceArtifact/properties/specSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                } else {
                  validate77.errors = [{ instancePath: instancePath + "/sourceArtifact", schemaPath: "#/$defs/FederalSourceArtifact/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.revisionSha256 !== void 0) {
                let data5 = data.revisionSha256;
                const _errs13 = errors2;
                if (errors2 === _errs13) {
                  if (typeof data5 === "string") {
                    if (!pattern4.test(data5)) {
                      validate77.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate77.errors = [{ instancePath: instancePath + "/revisionSha256", schemaPath: "#/properties/revisionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs13 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.output !== void 0) {
                  let data6 = data.output;
                  const _errs15 = errors2;
                  if (!(data6 === "draft" || data6 === "operative" || data6 === "consolidated" || data6 === "redline")) {
                    validate77.errors = [{ instancePath: instancePath + "/output", schemaPath: "#/properties/output/enum", keyword: "enum", params: { allowedValues: schema84.properties.output.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs15 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.review !== void 0) {
                    let data7 = data.review;
                    const _errs16 = errors2;
                    if (!(data7 === "unapproved" || data7 === "confirmed-for-export")) {
                      validate77.errors = [{ instancePath: instancePath + "/review", schemaPath: "#/properties/review/enum", keyword: "enum", params: { allowedValues: schema84.properties.review.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs16 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.publication !== void 0) {
                      const _errs17 = errors2;
                      if (!validate60(data.publication, { instancePath: instancePath + "/publication", parentData: data, parentDataProperty: "publication", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate60.errors : vErrors.concat(validate60.errors);
                        errors2 = vErrors.length;
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
      validate77.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate77.errors = vErrors;
  return errors2 === 0;
}
validate77.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateError = validate79;
var schema92 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "type": "string", "pattern": "^[A-Z_]{1,80}$" }, "outcome": { "enum": ["NOT_DISPATCHED", "READ_UNAVAILABLE", "UNKNOWN", "RESULT_NOT_RELEASED"] } }, "required": ["code", "outcome"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
var pattern57 = new RegExp("^[A-Z_]{1,80}$", "u");
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
      if (data.error === void 0 && (missing0 = "error")) {
        validate79.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate79.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate79.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code" || key1 === "outcome")) {
                      validate79.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      const _errs5 = errors2;
                      if (errors2 === _errs5) {
                        if (typeof data1 === "string") {
                          if (!pattern57.test(data1)) {
                            validate79.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/pattern", keyword: "pattern", params: { pattern: "^[A-Z_]{1,80}$" }, message: 'must match pattern "^[A-Z_]{1,80}$"' }];
                            return false;
                          }
                        } else {
                          validate79.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                      var valid1 = _errs5 === errors2;
                    } else {
                      var valid1 = true;
                    }
                    if (valid1) {
                      if (data0.outcome !== void 0) {
                        let data2 = data0.outcome;
                        const _errs7 = errors2;
                        if (!(data2 === "NOT_DISPATCHED" || data2 === "READ_UNAVAILABLE" || data2 === "UNKNOWN" || data2 === "RESULT_NOT_RELEASED")) {
                          validate79.errors = [{ instancePath: instancePath + "/error/outcome", schemaPath: "#/properties/error/properties/outcome/enum", keyword: "enum", params: { allowedValues: schema92.properties.error.properties.outcome.enum }, message: "must be equal to one of the allowed values" }];
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
                validate79.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
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

// artifacts-0.2/artifact-formats.mjs
var ARTIFACT_MIME_TYPES = Object.freeze({ docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", zip: "application/zip" });
var artifactFilename = (request) => (request.title.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim().slice(0, 120) || "artifact") + "." + request.format;
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

// federal-workbench/receive.mjs
var requests = /* @__PURE__ */ new WeakMap();
var reviews = /* @__PURE__ */ new WeakSet();
var same = (a, b) => canonicalize(a) === canonicalize(b);
var hash = (value) => digest(new TextEncoder().encode(canonicalize(value)));
var textHash = (value) => digest(new TextEncoder().encode(value));
var validators = { "federal-prepare": validatePrepare, "federal-load": validateLoad, "federal-publish": validatePublish };
var federalWorkbenchVersion = "1.0.0";
async function receiveFederalSource(bytes) {
  const source = parseBytes(bytes, 1048576);
  if (!validateSource(source) || await textHash(source.text) !== source.sha256) fail("SOURCE_MISMATCH");
  for (const scope of source.scopes) if (scope.start >= scope.end || scope.end > source.text.length || await textHash(source.text.slice(scope.start, scope.end)) !== scope.sha256) fail("SOURCE_MISMATCH");
  return source;
}
function receiveFederalRequest(route, bytes) {
  const request = parseBytes(bytes, 2 * 1024 * 1024);
  if (!Object.hasOwn(validators, route) || !validators[route](request)) fail("INVALID_REQUEST");
  if (route === "federal-publish" && (request.baseVersionId === null ? request.baseRevisionSha256 !== null : request.baseRevisionSha256 === null || request.output !== "draft")) fail("INVALID_REQUEST");
  requests.set(request, route);
  return request;
}
function version(v) {
  try {
    assertNativeArtifactEvidenceBinding(v.binding, v.evidence);
  } catch {
    fail("EVIDENCE_BINDING");
  }
  const scopes = new Set(v.scopes.map(canonicalize));
  if (v.mimeType !== ARTIFACT_MIME_TYPES.txt || !same(v.scopes, v.object.scopes) || v.scopes.some((s) => s.tenantId !== v.binding.tenantId) || v.evidence.some((e) => e.scopes.some((s) => !scopes.has(canonicalize(s)))) || v.object.bytes > 1048576 || v.generationStatus !== "draft" || !v.filename.endsWith(".txt")) fail("VERSION_MISMATCH");
}
async function preparation(p) {
  const { revisionSha256, approval, ...material } = p.draft;
  if (await hash(material) !== revisionSha256 || await hash({ sourceArtifact: p.sourceArtifact, draftSha256: revisionSha256 }) !== p.revisionSha256 || await textHash(p.draft.source.text) !== p.draft.source.sha256) fail("REVISION_MISMATCH");
  for (const kind of ["operative", "consolidated", "redline"]) if (await textHash(p.draft.outputs[kind]) !== p.draft.outputHashes[kind]) fail("OUTPUT_MISMATCH");
  for (const s of p.draft.source.scopes) if (s.end > p.draft.source.text.length || s.end <= s.start || await textHash(p.draft.source.text.slice(s.start, s.end)) !== s.sha256) fail("SOURCE_MISMATCH");
}
async function receiveFederalResponse(route, status, bytes, request, review) {
  if (requests.get(request) !== route) fail("UNADMITTED_REQUEST");
  const result = parseBytes(bytes, 2 * 1024 * 1024);
  if (status !== 200) {
    if (!Number.isInteger(status) || status < 400 || status > 599 || !validateError(result)) fail("INVALID_ERROR_RESPONSE");
    return result;
  }
  if (route !== "federal-publish") {
    if (!validateReview(result)) fail("INVALID_RESPONSE");
    await preparation(result.prepared);
    const p = result.prepared;
    if (!same(result.selection.operations, p.draft.operations) || result.selection.versionId !== p.sourceArtifact.versionId || result.selection.expectedArtifactSha256 !== p.sourceArtifact.sha256) fail("SELECTION_MISMATCH");
    if (route === "federal-prepare" && (!same(result.selection, request.selection) || result.savedDraft !== null)) fail("SELECTION_MISMATCH");
    if (route === "federal-load") {
      if (!result.savedDraft || result.savedDraft.versionId !== request.versionId || result.savedDraft.object.sha256 !== request.expectedArtifactSha256) fail("VERSION_MISMATCH");
      version(result.savedDraft);
      if (await textHash(JSON.stringify({ schema: result.schema, prepared: p })) !== result.savedDraft.object.sha256) fail("REVIEW_MISMATCH");
    }
    reviews.add(result);
    return result;
  }
  if (!reviews.has(review) || !validatePublication(result) || !same(request.selection, review.selection) || request.revisionSha256 !== review.prepared.revisionSha256 || result.revisionSha256 !== request.revisionSha256 || !same(result.sourceArtifact, review.prepared.sourceArtifact) || result.output !== request.output || result.review !== (request.output === "draft" ? "unapproved" : "confirmed-for-export")) fail("REVIEW_MISMATCH");
  const { version: v, inspection, execution } = result.publication;
  version(v);
  const content = request.output === "draft" ? JSON.stringify({ schema: review.schema, prepared: review.prepared }) : review.prepared.draft.outputs[request.output];
  const titles = { draft: "Federal review", operative: "Operative amendment", consolidated: "Consolidated text", redline: "Legal redline" };
  const title = (titles[request.output] + " [" + request.revisionSha256 + "]: " + review.prepared.draft.source.documentId).slice(0, 160);
  if (v.parentVersionId !== request.baseVersionId || v.object.sha256 !== await textHash(content) || v.object.bytes !== new TextEncoder().encode(content).length || inspection.sha256 !== v.object.sha256 || inspection.bytes !== v.object.bytes || inspection.format !== "txt" || execution.kind !== "native-document" || v.filename !== artifactFilename({ title, format: "txt" })) fail("PUBLICATION_MISMATCH");
  return result;
}
export {
  federalWorkbenchVersion,
  receiveFederalRequest,
  receiveFederalResponse,
  receiveFederalSource
};
