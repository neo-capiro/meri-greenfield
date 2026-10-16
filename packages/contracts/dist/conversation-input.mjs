// Generated additive browser boundary; shares canonical request/view provenance. No authority.
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
  const bytes2 = copyBytes(value, cap);
  let text, data;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes2);
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

// conversation-input/conversation-input-receiver.mjs
import { receiveConversationRequest as receiveConversationRequest2, receiveConversationResponse as receiveConversationResponse2 } from "./conversation-application.mjs";

// input-generated:./generated-validator.mjs
var schema34 = { "oneOf": [{ "type": "object", "properties": { "basis": { "const": "calendar-week" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 }, "weekStartsOn": { "type": "string", "enum": ["monday", "sunday"] } }, "required": ["basis", "offset", "timezone", "weekStartsOn"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "calendar-month" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "offset", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "calendar-year" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "offset", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "relative-duration" }, "days": { "type": "integer", "minimum": 1, "maximum": 3660 }, "anchorAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "days", "anchorAt", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "explicit" }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "startInclusive", "endExclusive", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "fiscal-year" }, "year": { "type": "integer", "minimum": 1900, "maximum": 3e3 }, "calendarId": { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[a-z][a-z0-9_.-]*$" }, "stage": { "type": "string", "enum": ["requested", "authorized", "appropriated", "obligated", "actual", "outlay"] }, "revisionId": { "type": "string", "minLength": 1, "maxLength": 256 }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "year", "calendarId", "stage", "revisionId", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "unbounded" } }, "required": ["basis"], "additionalProperties": false }] };
var schema35 = { "type": "string", "enum": ["quick_skill.research_company", "quick_skill.relationship_brief", "quick_skill.client_changes", "quick_skill.portfolio_changes", "quick_skill.portfolio_overlap", "quick_skill.mail_history", "quick_skill.meeting_prep", "quick_skill.commitments_audit", "quick_skill.funding_opportunity_match", "quick_skill.pe_deep_dive", "quick_skill.bill_watch", "quick_skill.hearing_watch", "quick_skill.representation_lookup", "quick_skill.regulatory_docket_brief"] };
var pattern4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var pattern5 = new RegExp("\\S", "u");
var pattern6 = new RegExp("Z$", "u");
var pattern9 = new RegExp("^[a-z][a-z0-9_.-]*$", "u");
var pattern10 = new RegExp("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$", "u");
var func1 = require_ucs2length().default;
var formats0 = require_formats().fullFormats["date-time"];
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
      if (data.requestId === void 0 && (missing0 = "requestId") || data.prompt === void 0 && (missing0 = "prompt")) {
        validate39.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "requestId" || key0 === "prompt" || key0 === "windowRequest" || key0 === "skill")) {
            validate39.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.requestId !== void 0) {
            let data0 = data.requestId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate39.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate39.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.prompt !== void 0) {
              let data1 = data.prompt;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 1e5) {
                    validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data1)) {
                        validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                        return false;
                      }
                    }
                  }
                } else {
                  validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.windowRequest !== void 0) {
                let data2 = data.windowRequest;
                const _errs6 = errors2;
                const _errs8 = errors2;
                let valid2 = false;
                let passing0 = null;
                const _errs9 = errors2;
                if (errors2 === _errs9) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.basis === void 0 && (missing1 = "basis") || data2.offset === void 0 && (missing1 = "offset") || data2.timezone === void 0 && (missing1 = "timezone") || data2.weekStartsOn === void 0 && (missing1 = "weekStartsOn")) {
                      const err0 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    } else {
                      const _errs11 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "basis" || key1 === "offset" || key1 === "timezone" || key1 === "weekStartsOn")) {
                          const err1 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs11 === errors2) {
                        if (data2.basis !== void 0) {
                          const _errs12 = errors2;
                          if ("calendar-week" !== data2.basis) {
                            const err2 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err2];
                            } else {
                              vErrors.push(err2);
                            }
                            errors2++;
                          }
                          var valid3 = _errs12 === errors2;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.offset !== void 0) {
                            let data4 = data2.offset;
                            const _errs13 = errors2;
                            if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
                              const err3 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err3];
                              } else {
                                vErrors.push(err3);
                              }
                              errors2++;
                            }
                            if (!(data4 === -1 || data4 === 0)) {
                              const err4 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            }
                            var valid3 = _errs13 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data2.timezone !== void 0) {
                              let data5 = data2.timezone;
                              const _errs15 = errors2;
                              if (errors2 === _errs15) {
                                if (typeof data5 === "string") {
                                  if (func1(data5) > 100) {
                                    const err5 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err5];
                                    } else {
                                      vErrors.push(err5);
                                    }
                                    errors2++;
                                  } else {
                                    if (func1(data5) < 1) {
                                      const err6 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    }
                                  }
                                } else {
                                  const err7 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err7];
                                  } else {
                                    vErrors.push(err7);
                                  }
                                  errors2++;
                                }
                              }
                              var valid3 = _errs15 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data2.weekStartsOn !== void 0) {
                                let data6 = data2.weekStartsOn;
                                const _errs17 = errors2;
                                if (typeof data6 !== "string") {
                                  const err8 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err8];
                                  } else {
                                    vErrors.push(err8);
                                  }
                                  errors2++;
                                }
                                if (!(data6 === "monday" || data6 === "sunday")) {
                                  const err9 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err9];
                                  } else {
                                    vErrors.push(err9);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs17 === errors2;
                              } else {
                                var valid3 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err10 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err10];
                    } else {
                      vErrors.push(err10);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs9 === errors2;
                if (_valid0) {
                  valid2 = true;
                  passing0 = 0;
                  var props0 = true;
                }
                const _errs19 = errors2;
                if (errors2 === _errs19) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing2;
                    if (data2.basis === void 0 && (missing2 = "basis") || data2.offset === void 0 && (missing2 = "offset") || data2.timezone === void 0 && (missing2 = "timezone")) {
                      const err11 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                      if (vErrors === null) {
                        vErrors = [err11];
                      } else {
                        vErrors.push(err11);
                      }
                      errors2++;
                    } else {
                      const _errs21 = errors2;
                      for (const key2 in data2) {
                        if (!(key2 === "basis" || key2 === "offset" || key2 === "timezone")) {
                          const err12 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err12];
                          } else {
                            vErrors.push(err12);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs21 === errors2) {
                        if (data2.basis !== void 0) {
                          const _errs22 = errors2;
                          if ("calendar-month" !== data2.basis) {
                            const err13 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err13];
                            } else {
                              vErrors.push(err13);
                            }
                            errors2++;
                          }
                          var valid4 = _errs22 === errors2;
                        } else {
                          var valid4 = true;
                        }
                        if (valid4) {
                          if (data2.offset !== void 0) {
                            let data8 = data2.offset;
                            const _errs23 = errors2;
                            if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                              const err14 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err14];
                              } else {
                                vErrors.push(err14);
                              }
                              errors2++;
                            }
                            if (!(data8 === -1 || data8 === 0)) {
                              const err15 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err15];
                              } else {
                                vErrors.push(err15);
                              }
                              errors2++;
                            }
                            var valid4 = _errs23 === errors2;
                          } else {
                            var valid4 = true;
                          }
                          if (valid4) {
                            if (data2.timezone !== void 0) {
                              let data9 = data2.timezone;
                              const _errs25 = errors2;
                              if (errors2 === _errs25) {
                                if (typeof data9 === "string") {
                                  if (func1(data9) > 100) {
                                    const err16 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err16];
                                    } else {
                                      vErrors.push(err16);
                                    }
                                    errors2++;
                                  } else {
                                    if (func1(data9) < 1) {
                                      const err17 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err17];
                                      } else {
                                        vErrors.push(err17);
                                      }
                                      errors2++;
                                    }
                                  }
                                } else {
                                  const err18 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err18];
                                  } else {
                                    vErrors.push(err18);
                                  }
                                  errors2++;
                                }
                              }
                              var valid4 = _errs25 === errors2;
                            } else {
                              var valid4 = true;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err19 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors2++;
                  }
                }
                var _valid0 = _errs19 === errors2;
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
                  const _errs27 = errors2;
                  if (errors2 === _errs27) {
                    if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                      let missing3;
                      if (data2.basis === void 0 && (missing3 = "basis") || data2.offset === void 0 && (missing3 = "offset") || data2.timezone === void 0 && (missing3 = "timezone")) {
                        const err20 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                        if (vErrors === null) {
                          vErrors = [err20];
                        } else {
                          vErrors.push(err20);
                        }
                        errors2++;
                      } else {
                        const _errs29 = errors2;
                        for (const key3 in data2) {
                          if (!(key3 === "basis" || key3 === "offset" || key3 === "timezone")) {
                            const err21 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err21];
                            } else {
                              vErrors.push(err21);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs29 === errors2) {
                          if (data2.basis !== void 0) {
                            const _errs30 = errors2;
                            if ("calendar-year" !== data2.basis) {
                              const err22 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err22];
                              } else {
                                vErrors.push(err22);
                              }
                              errors2++;
                            }
                            var valid5 = _errs30 === errors2;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data2.offset !== void 0) {
                              let data11 = data2.offset;
                              const _errs31 = errors2;
                              if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                const err23 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err23];
                                } else {
                                  vErrors.push(err23);
                                }
                                errors2++;
                              }
                              if (!(data11 === -1 || data11 === 0)) {
                                const err24 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err24];
                                } else {
                                  vErrors.push(err24);
                                }
                                errors2++;
                              }
                              var valid5 = _errs31 === errors2;
                            } else {
                              var valid5 = true;
                            }
                            if (valid5) {
                              if (data2.timezone !== void 0) {
                                let data12 = data2.timezone;
                                const _errs33 = errors2;
                                if (errors2 === _errs33) {
                                  if (typeof data12 === "string") {
                                    if (func1(data12) > 100) {
                                      const err25 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err25];
                                      } else {
                                        vErrors.push(err25);
                                      }
                                      errors2++;
                                    } else {
                                      if (func1(data12) < 1) {
                                        const err26 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err26];
                                        } else {
                                          vErrors.push(err26);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err27 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err27];
                                    } else {
                                      vErrors.push(err27);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid5 = _errs33 === errors2;
                              } else {
                                var valid5 = true;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err28 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err28];
                      } else {
                        vErrors.push(err28);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs27 === errors2;
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
                    const _errs35 = errors2;
                    if (errors2 === _errs35) {
                      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                        let missing4;
                        if (data2.basis === void 0 && (missing4 = "basis") || data2.days === void 0 && (missing4 = "days") || data2.anchorAt === void 0 && (missing4 = "anchorAt") || data2.timezone === void 0 && (missing4 = "timezone")) {
                          const err29 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                          if (vErrors === null) {
                            vErrors = [err29];
                          } else {
                            vErrors.push(err29);
                          }
                          errors2++;
                        } else {
                          const _errs37 = errors2;
                          for (const key4 in data2) {
                            if (!(key4 === "basis" || key4 === "days" || key4 === "anchorAt" || key4 === "timezone")) {
                              const err30 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err30];
                              } else {
                                vErrors.push(err30);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs37 === errors2) {
                            if (data2.basis !== void 0) {
                              const _errs38 = errors2;
                              if ("relative-duration" !== data2.basis) {
                                const err31 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err31];
                                } else {
                                  vErrors.push(err31);
                                }
                                errors2++;
                              }
                              var valid6 = _errs38 === errors2;
                            } else {
                              var valid6 = true;
                            }
                            if (valid6) {
                              if (data2.days !== void 0) {
                                let data14 = data2.days;
                                const _errs39 = errors2;
                                if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                                  const err32 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err32];
                                  } else {
                                    vErrors.push(err32);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs39) {
                                  if (typeof data14 == "number" && isFinite(data14)) {
                                    if (data14 > 3660 || isNaN(data14)) {
                                      const err33 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                      if (vErrors === null) {
                                        vErrors = [err33];
                                      } else {
                                        vErrors.push(err33);
                                      }
                                      errors2++;
                                    } else {
                                      if (data14 < 1 || isNaN(data14)) {
                                        const err34 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                        if (vErrors === null) {
                                          vErrors = [err34];
                                        } else {
                                          vErrors.push(err34);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                }
                                var valid6 = _errs39 === errors2;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data2.anchorAt !== void 0) {
                                  let data15 = data2.anchorAt;
                                  const _errs41 = errors2;
                                  if (errors2 === _errs41) {
                                    if (errors2 === _errs41) {
                                      if (typeof data15 === "string") {
                                        if (!pattern6.test(data15)) {
                                          const err35 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                          if (vErrors === null) {
                                            vErrors = [err35];
                                          } else {
                                            vErrors.push(err35);
                                          }
                                          errors2++;
                                        } else {
                                          if (!formats0.validate(data15)) {
                                            const err36 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                            if (vErrors === null) {
                                              vErrors = [err36];
                                            } else {
                                              vErrors.push(err36);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err37 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err37];
                                        } else {
                                          vErrors.push(err37);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                  var valid6 = _errs41 === errors2;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data2.timezone !== void 0) {
                                    let data16 = data2.timezone;
                                    const _errs43 = errors2;
                                    if (errors2 === _errs43) {
                                      if (typeof data16 === "string") {
                                        if (func1(data16) > 100) {
                                          const err38 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err38];
                                          } else {
                                            vErrors.push(err38);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data16) < 1) {
                                            const err39 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err39];
                                            } else {
                                              vErrors.push(err39);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err40 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err40];
                                        } else {
                                          vErrors.push(err40);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid6 = _errs43 === errors2;
                                  } else {
                                    var valid6 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err41 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err41];
                        } else {
                          vErrors.push(err41);
                        }
                        errors2++;
                      }
                    }
                    var _valid0 = _errs35 === errors2;
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
                      const _errs45 = errors2;
                      if (errors2 === _errs45) {
                        if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                          let missing5;
                          if (data2.basis === void 0 && (missing5 = "basis") || data2.startInclusive === void 0 && (missing5 = "startInclusive") || data2.endExclusive === void 0 && (missing5 = "endExclusive") || data2.timezone === void 0 && (missing5 = "timezone")) {
                            const err42 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                            if (vErrors === null) {
                              vErrors = [err42];
                            } else {
                              vErrors.push(err42);
                            }
                            errors2++;
                          } else {
                            const _errs47 = errors2;
                            for (const key5 in data2) {
                              if (!(key5 === "basis" || key5 === "startInclusive" || key5 === "endExclusive" || key5 === "timezone")) {
                                const err43 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err43];
                                } else {
                                  vErrors.push(err43);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs47 === errors2) {
                              if (data2.basis !== void 0) {
                                const _errs48 = errors2;
                                if ("explicit" !== data2.basis) {
                                  const err44 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err44];
                                  } else {
                                    vErrors.push(err44);
                                  }
                                  errors2++;
                                }
                                var valid7 = _errs48 === errors2;
                              } else {
                                var valid7 = true;
                              }
                              if (valid7) {
                                if (data2.startInclusive !== void 0) {
                                  let data18 = data2.startInclusive;
                                  const _errs49 = errors2;
                                  if (errors2 === _errs49) {
                                    if (errors2 === _errs49) {
                                      if (typeof data18 === "string") {
                                        if (!pattern6.test(data18)) {
                                          const err45 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                          if (vErrors === null) {
                                            vErrors = [err45];
                                          } else {
                                            vErrors.push(err45);
                                          }
                                          errors2++;
                                        } else {
                                          if (!formats0.validate(data18)) {
                                            const err46 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                            if (vErrors === null) {
                                              vErrors = [err46];
                                            } else {
                                              vErrors.push(err46);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err47 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err47];
                                        } else {
                                          vErrors.push(err47);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                  var valid7 = _errs49 === errors2;
                                } else {
                                  var valid7 = true;
                                }
                                if (valid7) {
                                  if (data2.endExclusive !== void 0) {
                                    let data19 = data2.endExclusive;
                                    const _errs51 = errors2;
                                    if (errors2 === _errs51) {
                                      if (errors2 === _errs51) {
                                        if (typeof data19 === "string") {
                                          if (!pattern6.test(data19)) {
                                            const err48 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors2++;
                                          } else {
                                            if (!formats0.validate(data19)) {
                                              const err49 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                              if (vErrors === null) {
                                                vErrors = [err49];
                                              } else {
                                                vErrors.push(err49);
                                              }
                                              errors2++;
                                            }
                                          }
                                        } else {
                                          const err50 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err50];
                                          } else {
                                            vErrors.push(err50);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                    var valid7 = _errs51 === errors2;
                                  } else {
                                    var valid7 = true;
                                  }
                                  if (valid7) {
                                    if (data2.timezone !== void 0) {
                                      let data20 = data2.timezone;
                                      const _errs53 = errors2;
                                      if (errors2 === _errs53) {
                                        if (typeof data20 === "string") {
                                          if (func1(data20) > 100) {
                                            const err51 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err51];
                                            } else {
                                              vErrors.push(err51);
                                            }
                                            errors2++;
                                          } else {
                                            if (func1(data20) < 1) {
                                              const err52 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err52];
                                              } else {
                                                vErrors.push(err52);
                                              }
                                              errors2++;
                                            }
                                          }
                                        } else {
                                          const err53 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err53];
                                          } else {
                                            vErrors.push(err53);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid7 = _errs53 === errors2;
                                    } else {
                                      var valid7 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err54 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err54];
                          } else {
                            vErrors.push(err54);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs45 === errors2;
                      if (_valid0 && valid2) {
                        valid2 = false;
                        passing0 = [passing0, 4];
                      } else {
                        if (_valid0) {
                          valid2 = true;
                          passing0 = 4;
                          if (props0 !== true) {
                            props0 = true;
                          }
                        }
                        const _errs55 = errors2;
                        if (errors2 === _errs55) {
                          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                            let missing6;
                            if (data2.basis === void 0 && (missing6 = "basis") || data2.year === void 0 && (missing6 = "year") || data2.calendarId === void 0 && (missing6 = "calendarId") || data2.stage === void 0 && (missing6 = "stage") || data2.revisionId === void 0 && (missing6 = "revisionId") || data2.timezone === void 0 && (missing6 = "timezone")) {
                              const err55 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                              if (vErrors === null) {
                                vErrors = [err55];
                              } else {
                                vErrors.push(err55);
                              }
                              errors2++;
                            } else {
                              const _errs57 = errors2;
                              for (const key6 in data2) {
                                if (!(key6 === "basis" || key6 === "year" || key6 === "calendarId" || key6 === "stage" || key6 === "revisionId" || key6 === "timezone")) {
                                  const err56 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err56];
                                  } else {
                                    vErrors.push(err56);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs57 === errors2) {
                                if (data2.basis !== void 0) {
                                  const _errs58 = errors2;
                                  if ("fiscal-year" !== data2.basis) {
                                    const err57 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err57];
                                    } else {
                                      vErrors.push(err57);
                                    }
                                    errors2++;
                                  }
                                  var valid8 = _errs58 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data2.year !== void 0) {
                                    let data22 = data2.year;
                                    const _errs59 = errors2;
                                    if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                      const err58 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err58];
                                      } else {
                                        vErrors.push(err58);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs59) {
                                      if (typeof data22 == "number" && isFinite(data22)) {
                                        if (data22 > 3e3 || isNaN(data22)) {
                                          const err59 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                          if (vErrors === null) {
                                            vErrors = [err59];
                                          } else {
                                            vErrors.push(err59);
                                          }
                                          errors2++;
                                        } else {
                                          if (data22 < 1900 || isNaN(data22)) {
                                            const err60 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                            if (vErrors === null) {
                                              vErrors = [err60];
                                            } else {
                                              vErrors.push(err60);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid8 = _errs59 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data2.calendarId !== void 0) {
                                      let data23 = data2.calendarId;
                                      const _errs61 = errors2;
                                      if (errors2 === _errs61) {
                                        if (typeof data23 === "string") {
                                          if (func1(data23) > 128) {
                                            const err61 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err61];
                                            } else {
                                              vErrors.push(err61);
                                            }
                                            errors2++;
                                          } else {
                                            if (func1(data23) < 1) {
                                              const err62 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err62];
                                              } else {
                                                vErrors.push(err62);
                                              }
                                              errors2++;
                                            } else {
                                              if (!pattern9.test(data23)) {
                                                const err63 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err63];
                                                } else {
                                                  vErrors.push(err63);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        } else {
                                          const err64 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err64];
                                          } else {
                                            vErrors.push(err64);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid8 = _errs61 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data2.stage !== void 0) {
                                        let data24 = data2.stage;
                                        const _errs63 = errors2;
                                        if (typeof data24 !== "string") {
                                          const err65 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err65];
                                          } else {
                                            vErrors.push(err65);
                                          }
                                          errors2++;
                                        }
                                        if (!(data24 === "requested" || data24 === "authorized" || data24 === "appropriated" || data24 === "obligated" || data24 === "actual" || data24 === "outlay")) {
                                          const err66 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err66];
                                          } else {
                                            vErrors.push(err66);
                                          }
                                          errors2++;
                                        }
                                        var valid8 = _errs63 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data2.revisionId !== void 0) {
                                          let data25 = data2.revisionId;
                                          const _errs65 = errors2;
                                          if (errors2 === _errs65) {
                                            if (typeof data25 === "string") {
                                              if (func1(data25) > 256) {
                                                const err67 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err67];
                                                } else {
                                                  vErrors.push(err67);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data25) < 1) {
                                                  const err68 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err68];
                                                  } else {
                                                    vErrors.push(err68);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err69 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err69];
                                              } else {
                                                vErrors.push(err69);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid8 = _errs65 === errors2;
                                        } else {
                                          var valid8 = true;
                                        }
                                        if (valid8) {
                                          if (data2.timezone !== void 0) {
                                            let data26 = data2.timezone;
                                            const _errs67 = errors2;
                                            if (errors2 === _errs67) {
                                              if (typeof data26 === "string") {
                                                if (func1(data26) > 100) {
                                                  const err70 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err70];
                                                  } else {
                                                    vErrors.push(err70);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (func1(data26) < 1) {
                                                    const err71 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err71];
                                                    } else {
                                                      vErrors.push(err71);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              } else {
                                                const err72 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err72];
                                                } else {
                                                  vErrors.push(err72);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid8 = _errs67 === errors2;
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
                          } else {
                            const err73 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err73];
                            } else {
                              vErrors.push(err73);
                            }
                            errors2++;
                          }
                        }
                        var _valid0 = _errs55 === errors2;
                        if (_valid0 && valid2) {
                          valid2 = false;
                          passing0 = [passing0, 5];
                        } else {
                          if (_valid0) {
                            valid2 = true;
                            passing0 = 5;
                            if (props0 !== true) {
                              props0 = true;
                            }
                          }
                          const _errs69 = errors2;
                          if (errors2 === _errs69) {
                            if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                              let missing7;
                              if (data2.basis === void 0 && (missing7 = "basis")) {
                                const err74 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err74];
                                } else {
                                  vErrors.push(err74);
                                }
                                errors2++;
                              } else {
                                const _errs71 = errors2;
                                for (const key7 in data2) {
                                  if (!(key7 === "basis")) {
                                    const err75 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err75];
                                    } else {
                                      vErrors.push(err75);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs71 === errors2) {
                                  if (data2.basis !== void 0) {
                                    if ("unbounded" !== data2.basis) {
                                      const err76 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err76];
                                      } else {
                                        vErrors.push(err76);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                            } else {
                              const err77 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err77];
                              } else {
                                vErrors.push(err77);
                              }
                              errors2++;
                            }
                          }
                          var _valid0 = _errs69 === errors2;
                          if (_valid0 && valid2) {
                            valid2 = false;
                            passing0 = [passing0, 6];
                          } else {
                            if (_valid0) {
                              valid2 = true;
                              passing0 = 6;
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
                if (!valid2) {
                  const err78 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                  if (vErrors === null) {
                    vErrors = [err78];
                  } else {
                    vErrors.push(err78);
                  }
                  errors2++;
                  validate39.errors = vErrors;
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
                var valid0 = _errs6 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.skill !== void 0) {
                  let data28 = data.skill;
                  const _errs73 = errors2;
                  if (errors2 === _errs73) {
                    if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
                      let missing8;
                      if (data28.skillId === void 0 && (missing8 = "skillId") || data28.skillVersion === void 0 && (missing8 = "skillVersion")) {
                        validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                        return false;
                      } else {
                        const _errs75 = errors2;
                        for (const key8 in data28) {
                          if (!(key8 === "skillId" || key8 === "skillVersion")) {
                            validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                            return false;
                            break;
                          }
                        }
                        if (_errs75 === errors2) {
                          if (data28.skillId !== void 0) {
                            let data29 = data28.skillId;
                            const _errs76 = errors2;
                            if (typeof data29 !== "string") {
                              validate39.errors = [{ instancePath: instancePath + "/skill/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_cae56271/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                            if (!(data29 === "quick_skill.research_company" || data29 === "quick_skill.relationship_brief" || data29 === "quick_skill.client_changes" || data29 === "quick_skill.portfolio_changes" || data29 === "quick_skill.portfolio_overlap" || data29 === "quick_skill.mail_history" || data29 === "quick_skill.meeting_prep" || data29 === "quick_skill.commitments_audit" || data29 === "quick_skill.funding_opportunity_match" || data29 === "quick_skill.pe_deep_dive" || data29 === "quick_skill.bill_watch" || data29 === "quick_skill.hearing_watch" || data29 === "quick_skill.representation_lookup" || data29 === "quick_skill.regulatory_docket_brief")) {
                              validate39.errors = [{ instancePath: instancePath + "/skill/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_cae56271/enum", keyword: "enum", params: { allowedValues: schema35.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid10 = _errs76 === errors2;
                          } else {
                            var valid10 = true;
                          }
                          if (valid10) {
                            if (data28.skillVersion !== void 0) {
                              let data30 = data28.skillVersion;
                              const _errs79 = errors2;
                              const _errs80 = errors2;
                              if (errors2 === _errs80) {
                                if (typeof data30 === "string") {
                                  if (!pattern10.test(data30)) {
                                    validate39.errors = [{ instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7f0f4343/pattern", keyword: "pattern", params: { pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$"' }];
                                    return false;
                                  }
                                } else {
                                  validate39.errors = [{ instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7f0f4343/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid10 = _errs79 === errors2;
                            } else {
                              var valid10 = true;
                            }
                          }
                        }
                      }
                    } else {
                      validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid0 = _errs73 === errors2;
                } else {
                  var valid0 = true;
                }
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
var schema42 = { "oneOf": [{ "type": "object", "properties": { "basis": { "type": "string", "enum": ["calendar-week", "calendar-month", "calendar-year", "relative-duration", "explicit"] }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 }, "weekStartsOn": { "anyOf": [{ "type": "string", "enum": ["monday", "sunday"] }, { "type": "null" }] } }, "required": ["basis", "startInclusive", "endExclusive", "timezone", "weekStartsOn"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "fiscal-year" }, "year": { "type": "integer", "minimum": 1900, "maximum": 3e3 }, "calendarId": { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[a-z][a-z0-9_.-]*$" }, "stage": { "type": "string", "enum": ["requested", "authorized", "appropriated", "obligated", "actual", "outlay"] }, "revisionId": { "type": "string", "minLength": 1, "maxLength": 256 }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "year", "calendarId", "stage", "revisionId", "startInclusive", "endExclusive", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "unbounded" } }, "required": ["basis"], "additionalProperties": false }] };
var pattern14 = new RegExp("^[a-f0-9]{64}$", "u");
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
      if (data.skillId === void 0 && (missing0 = "skillId") || data.skillVersion === void 0 && (missing0 = "skillVersion") || data.manifestSha256 === void 0 && (missing0 = "manifestSha256") || data.proseSha256 === void 0 && (missing0 = "proseSha256") || data.catalogSha256 === void 0 && (missing0 = "catalogSha256")) {
        validate26.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "skillId" || key0 === "skillVersion" || key0 === "manifestSha256" || key0 === "proseSha256" || key0 === "catalogSha256")) {
            validate26.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.skillId !== void 0) {
            let data0 = data.skillId;
            const _errs2 = errors2;
            if (typeof data0 !== "string") {
              validate26.errors = [{ instancePath: instancePath + "/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_cae56271/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            if (!(data0 === "quick_skill.research_company" || data0 === "quick_skill.relationship_brief" || data0 === "quick_skill.client_changes" || data0 === "quick_skill.portfolio_changes" || data0 === "quick_skill.portfolio_overlap" || data0 === "quick_skill.mail_history" || data0 === "quick_skill.meeting_prep" || data0 === "quick_skill.commitments_audit" || data0 === "quick_skill.funding_opportunity_match" || data0 === "quick_skill.pe_deep_dive" || data0 === "quick_skill.bill_watch" || data0 === "quick_skill.hearing_watch" || data0 === "quick_skill.representation_lookup" || data0 === "quick_skill.regulatory_docket_brief")) {
              validate26.errors = [{ instancePath: instancePath + "/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_cae56271/enum", keyword: "enum", params: { allowedValues: schema35.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.skillVersion !== void 0) {
              let data1 = data.skillVersion;
              const _errs5 = errors2;
              const _errs6 = errors2;
              if (errors2 === _errs6) {
                if (typeof data1 === "string") {
                  if (!pattern10.test(data1)) {
                    validate26.errors = [{ instancePath: instancePath + "/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7f0f4343/pattern", keyword: "pattern", params: { pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$"' }];
                    return false;
                  }
                } else {
                  validate26.errors = [{ instancePath: instancePath + "/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7f0f4343/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs5 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.manifestSha256 !== void 0) {
                let data2 = data.manifestSha256;
                const _errs8 = errors2;
                if (errors2 === _errs8) {
                  if (typeof data2 === "string") {
                    if (!pattern14.test(data2)) {
                      validate26.errors = [{ instancePath: instancePath + "/manifestSha256", schemaPath: "#/properties/manifestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate26.errors = [{ instancePath: instancePath + "/manifestSha256", schemaPath: "#/properties/manifestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.proseSha256 !== void 0) {
                  let data3 = data.proseSha256;
                  const _errs10 = errors2;
                  if (errors2 === _errs10) {
                    if (typeof data3 === "string") {
                      if (!pattern14.test(data3)) {
                        validate26.errors = [{ instancePath: instancePath + "/proseSha256", schemaPath: "#/properties/proseSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                        return false;
                      }
                    } else {
                      validate26.errors = [{ instancePath: instancePath + "/proseSha256", schemaPath: "#/properties/proseSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs10 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.catalogSha256 !== void 0) {
                    let data4 = data.catalogSha256;
                    const _errs12 = errors2;
                    if (errors2 === _errs12) {
                      if (typeof data4 === "string") {
                        if (!pattern14.test(data4)) {
                          validate26.errors = [{ instancePath: instancePath + "/catalogSha256", schemaPath: "#/properties/catalogSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                          return false;
                        }
                      } else {
                        validate26.errors = [{ instancePath: instancePath + "/catalogSha256", schemaPath: "#/properties/catalogSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid0 = _errs12 === errors2;
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
      validate26.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate26.errors = vErrors;
  return errors2 === 0;
}
validate26.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.requestId === void 0 && (missing0 = "requestId") || data.prompt === void 0 && (missing0 = "prompt") || data.skill === void 0 && (missing0 = "skill") || data.window === void 0 && (missing0 = "window") || data.windowRequest === void 0 && (missing0 = "windowRequest")) {
        validate40.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "requestId" || key0 === "prompt" || key0 === "skill" || key0 === "window" || key0 === "windowRequest")) {
            validate40.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.requestId !== void 0) {
            let data0 = data.requestId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate40.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate40.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.prompt !== void 0) {
              let data1 = data.prompt;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 1e5) {
                    validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data1)) {
                        validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                        return false;
                      }
                    }
                  }
                } else {
                  validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.skill !== void 0) {
                let data2 = data.skill;
                const _errs6 = errors2;
                const _errs7 = errors2;
                let valid1 = false;
                const _errs8 = errors2;
                if (!validate26(data2, { instancePath: instancePath + "/skill", parentData: data, parentDataProperty: "skill", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
                  errors2 = vErrors.length;
                }
                var _valid0 = _errs8 === errors2;
                valid1 = valid1 || _valid0;
                const _errs9 = errors2;
                if (data2 !== null) {
                  const err0 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors2++;
                }
                var _valid0 = _errs9 === errors2;
                valid1 = valid1 || _valid0;
                if (!valid1) {
                  const err1 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors2++;
                  validate40.errors = vErrors;
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
                if (data.window !== void 0) {
                  let data3 = data.window;
                  const _errs11 = errors2;
                  const _errs12 = errors2;
                  let valid2 = false;
                  const _errs13 = errors2;
                  const _errs15 = errors2;
                  let valid4 = false;
                  let passing0 = null;
                  const _errs16 = errors2;
                  if (errors2 === _errs16) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing1;
                      if (data3.basis === void 0 && (missing1 = "basis") || data3.startInclusive === void 0 && (missing1 = "startInclusive") || data3.endExclusive === void 0 && (missing1 = "endExclusive") || data3.timezone === void 0 && (missing1 = "timezone") || data3.weekStartsOn === void 0 && (missing1 = "weekStartsOn")) {
                        const err2 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      } else {
                        const _errs18 = errors2;
                        for (const key1 in data3) {
                          if (!(key1 === "basis" || key1 === "startInclusive" || key1 === "endExclusive" || key1 === "timezone" || key1 === "weekStartsOn")) {
                            const err3 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs18 === errors2) {
                          if (data3.basis !== void 0) {
                            let data4 = data3.basis;
                            const _errs19 = errors2;
                            if (typeof data4 !== "string") {
                              const err4 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/basis/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            }
                            if (!(data4 === "calendar-week" || data4 === "calendar-month" || data4 === "calendar-year" || data4 === "relative-duration" || data4 === "explicit")) {
                              const err5 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/basis/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.basis.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err5];
                              } else {
                                vErrors.push(err5);
                              }
                              errors2++;
                            }
                            var valid5 = _errs19 === errors2;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data3.startInclusive !== void 0) {
                              let data5 = data3.startInclusive;
                              const _errs21 = errors2;
                              if (errors2 === _errs21) {
                                if (errors2 === _errs21) {
                                  if (typeof data5 === "string") {
                                    if (!pattern6.test(data5)) {
                                      const err6 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats0.validate(data5)) {
                                        const err7 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err7];
                                        } else {
                                          vErrors.push(err7);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err8 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err8];
                                    } else {
                                      vErrors.push(err8);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var valid5 = _errs21 === errors2;
                            } else {
                              var valid5 = true;
                            }
                            if (valid5) {
                              if (data3.endExclusive !== void 0) {
                                let data6 = data3.endExclusive;
                                const _errs23 = errors2;
                                if (errors2 === _errs23) {
                                  if (errors2 === _errs23) {
                                    if (typeof data6 === "string") {
                                      if (!pattern6.test(data6)) {
                                        const err9 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                        if (vErrors === null) {
                                          vErrors = [err9];
                                        } else {
                                          vErrors.push(err9);
                                        }
                                        errors2++;
                                      } else {
                                        if (!formats0.validate(data6)) {
                                          const err10 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                          if (vErrors === null) {
                                            vErrors = [err10];
                                          } else {
                                            vErrors.push(err10);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err11 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err11];
                                      } else {
                                        vErrors.push(err11);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var valid5 = _errs23 === errors2;
                              } else {
                                var valid5 = true;
                              }
                              if (valid5) {
                                if (data3.timezone !== void 0) {
                                  let data7 = data3.timezone;
                                  const _errs25 = errors2;
                                  if (errors2 === _errs25) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 100) {
                                        const err12 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err12];
                                        } else {
                                          vErrors.push(err12);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data7) < 1) {
                                          const err13 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err13];
                                          } else {
                                            vErrors.push(err13);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err14 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err14];
                                      } else {
                                        vErrors.push(err14);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid5 = _errs25 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data3.weekStartsOn !== void 0) {
                                    let data8 = data3.weekStartsOn;
                                    const _errs27 = errors2;
                                    const _errs28 = errors2;
                                    let valid6 = false;
                                    const _errs29 = errors2;
                                    if (typeof data8 !== "string") {
                                      const err15 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err15];
                                      } else {
                                        vErrors.push(err15);
                                      }
                                      errors2++;
                                    }
                                    if (!(data8 === "monday" || data8 === "sunday")) {
                                      const err16 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.weekStartsOn.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err16];
                                      } else {
                                        vErrors.push(err16);
                                      }
                                      errors2++;
                                    }
                                    var _valid3 = _errs29 === errors2;
                                    valid6 = valid6 || _valid3;
                                    const _errs31 = errors2;
                                    if (data8 !== null) {
                                      const err17 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err17];
                                      } else {
                                        vErrors.push(err17);
                                      }
                                      errors2++;
                                    }
                                    var _valid3 = _errs31 === errors2;
                                    valid6 = valid6 || _valid3;
                                    if (!valid6) {
                                      const err18 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err18];
                                      } else {
                                        vErrors.push(err18);
                                      }
                                      errors2++;
                                    } else {
                                      errors2 = _errs28;
                                      if (vErrors !== null) {
                                        if (_errs28) {
                                          vErrors.length = _errs28;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid5 = _errs27 === errors2;
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
                      const err19 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err19];
                      } else {
                        vErrors.push(err19);
                      }
                      errors2++;
                    }
                  }
                  var _valid2 = _errs16 === errors2;
                  if (_valid2) {
                    valid4 = true;
                    passing0 = 0;
                    var props1 = true;
                  }
                  const _errs33 = errors2;
                  if (errors2 === _errs33) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing2;
                      if (data3.basis === void 0 && (missing2 = "basis") || data3.year === void 0 && (missing2 = "year") || data3.calendarId === void 0 && (missing2 = "calendarId") || data3.stage === void 0 && (missing2 = "stage") || data3.revisionId === void 0 && (missing2 = "revisionId") || data3.startInclusive === void 0 && (missing2 = "startInclusive") || data3.endExclusive === void 0 && (missing2 = "endExclusive") || data3.timezone === void 0 && (missing2 = "timezone")) {
                        const err20 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                        if (vErrors === null) {
                          vErrors = [err20];
                        } else {
                          vErrors.push(err20);
                        }
                        errors2++;
                      } else {
                        const _errs35 = errors2;
                        for (const key2 in data3) {
                          if (!(key2 === "basis" || key2 === "year" || key2 === "calendarId" || key2 === "stage" || key2 === "revisionId" || key2 === "startInclusive" || key2 === "endExclusive" || key2 === "timezone")) {
                            const err21 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err21];
                            } else {
                              vErrors.push(err21);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs35 === errors2) {
                          if (data3.basis !== void 0) {
                            const _errs36 = errors2;
                            if ("fiscal-year" !== data3.basis) {
                              const err22 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err22];
                              } else {
                                vErrors.push(err22);
                              }
                              errors2++;
                            }
                            var valid7 = _errs36 === errors2;
                          } else {
                            var valid7 = true;
                          }
                          if (valid7) {
                            if (data3.year !== void 0) {
                              let data10 = data3.year;
                              const _errs37 = errors2;
                              if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                const err23 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err23];
                                } else {
                                  vErrors.push(err23);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs37) {
                                if (typeof data10 == "number" && isFinite(data10)) {
                                  if (data10 > 3e3 || isNaN(data10)) {
                                    const err24 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                    if (vErrors === null) {
                                      vErrors = [err24];
                                    } else {
                                      vErrors.push(err24);
                                    }
                                    errors2++;
                                  } else {
                                    if (data10 < 1900 || isNaN(data10)) {
                                      const err25 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                      if (vErrors === null) {
                                        vErrors = [err25];
                                      } else {
                                        vErrors.push(err25);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid7 = _errs37 === errors2;
                            } else {
                              var valid7 = true;
                            }
                            if (valid7) {
                              if (data3.calendarId !== void 0) {
                                let data11 = data3.calendarId;
                                const _errs39 = errors2;
                                if (errors2 === _errs39) {
                                  if (typeof data11 === "string") {
                                    if (func1(data11) > 128) {
                                      const err26 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err26];
                                      } else {
                                        vErrors.push(err26);
                                      }
                                      errors2++;
                                    } else {
                                      if (func1(data11) < 1) {
                                        const err27 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err27];
                                        } else {
                                          vErrors.push(err27);
                                        }
                                        errors2++;
                                      } else {
                                        if (!pattern9.test(data11)) {
                                          const err28 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                          if (vErrors === null) {
                                            vErrors = [err28];
                                          } else {
                                            vErrors.push(err28);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  } else {
                                    const err29 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid7 = _errs39 === errors2;
                              } else {
                                var valid7 = true;
                              }
                              if (valid7) {
                                if (data3.stage !== void 0) {
                                  let data12 = data3.stage;
                                  const _errs41 = errors2;
                                  if (typeof data12 !== "string") {
                                    const err30 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err30];
                                    } else {
                                      vErrors.push(err30);
                                    }
                                    errors2++;
                                  }
                                  if (!(data12 === "requested" || data12 === "authorized" || data12 === "appropriated" || data12 === "obligated" || data12 === "actual" || data12 === "outlay")) {
                                    const err31 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/stage/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[1].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err31];
                                    } else {
                                      vErrors.push(err31);
                                    }
                                    errors2++;
                                  }
                                  var valid7 = _errs41 === errors2;
                                } else {
                                  var valid7 = true;
                                }
                                if (valid7) {
                                  if (data3.revisionId !== void 0) {
                                    let data13 = data3.revisionId;
                                    const _errs43 = errors2;
                                    if (errors2 === _errs43) {
                                      if (typeof data13 === "string") {
                                        if (func1(data13) > 256) {
                                          const err32 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data13) < 1) {
                                            const err33 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err33];
                                            } else {
                                              vErrors.push(err33);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err34 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err34];
                                        } else {
                                          vErrors.push(err34);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid7 = _errs43 === errors2;
                                  } else {
                                    var valid7 = true;
                                  }
                                  if (valid7) {
                                    if (data3.startInclusive !== void 0) {
                                      let data14 = data3.startInclusive;
                                      const _errs45 = errors2;
                                      if (errors2 === _errs45) {
                                        if (errors2 === _errs45) {
                                          if (typeof data14 === "string") {
                                            if (!pattern6.test(data14)) {
                                              const err35 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err35];
                                              } else {
                                                vErrors.push(err35);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data14)) {
                                                const err36 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err36];
                                                } else {
                                                  vErrors.push(err36);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err37 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err37];
                                            } else {
                                              vErrors.push(err37);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid7 = _errs45 === errors2;
                                    } else {
                                      var valid7 = true;
                                    }
                                    if (valid7) {
                                      if (data3.endExclusive !== void 0) {
                                        let data15 = data3.endExclusive;
                                        const _errs47 = errors2;
                                        if (errors2 === _errs47) {
                                          if (errors2 === _errs47) {
                                            if (typeof data15 === "string") {
                                              if (!pattern6.test(data15)) {
                                                const err38 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err38];
                                                } else {
                                                  vErrors.push(err38);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data15)) {
                                                  const err39 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err39];
                                                  } else {
                                                    vErrors.push(err39);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err40 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err40];
                                              } else {
                                                vErrors.push(err40);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid7 = _errs47 === errors2;
                                      } else {
                                        var valid7 = true;
                                      }
                                      if (valid7) {
                                        if (data3.timezone !== void 0) {
                                          let data16 = data3.timezone;
                                          const _errs49 = errors2;
                                          if (errors2 === _errs49) {
                                            if (typeof data16 === "string") {
                                              if (func1(data16) > 100) {
                                                const err41 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err41];
                                                } else {
                                                  vErrors.push(err41);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data16) < 1) {
                                                  const err42 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err42];
                                                  } else {
                                                    vErrors.push(err42);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err43 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err43];
                                              } else {
                                                vErrors.push(err43);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid7 = _errs49 === errors2;
                                        } else {
                                          var valid7 = true;
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
                      const err44 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err44];
                      } else {
                        vErrors.push(err44);
                      }
                      errors2++;
                    }
                  }
                  var _valid2 = _errs33 === errors2;
                  if (_valid2 && valid4) {
                    valid4 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid2) {
                      valid4 = true;
                      passing0 = 1;
                      if (props1 !== true) {
                        props1 = true;
                      }
                    }
                    const _errs51 = errors2;
                    if (errors2 === _errs51) {
                      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                        let missing3;
                        if (data3.basis === void 0 && (missing3 = "basis")) {
                          const err45 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                          if (vErrors === null) {
                            vErrors = [err45];
                          } else {
                            vErrors.push(err45);
                          }
                          errors2++;
                        } else {
                          const _errs53 = errors2;
                          for (const key3 in data3) {
                            if (!(key3 === "basis")) {
                              const err46 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err46];
                              } else {
                                vErrors.push(err46);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs53 === errors2) {
                            if (data3.basis !== void 0) {
                              if ("unbounded" !== data3.basis) {
                                const err47 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
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
                      } else {
                        const err48 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err48];
                        } else {
                          vErrors.push(err48);
                        }
                        errors2++;
                      }
                    }
                    var _valid2 = _errs51 === errors2;
                    if (_valid2 && valid4) {
                      valid4 = false;
                      passing0 = [passing0, 2];
                    } else {
                      if (_valid2) {
                        valid4 = true;
                        passing0 = 2;
                        if (props1 !== true) {
                          props1 = true;
                        }
                      }
                    }
                  }
                  if (!valid4) {
                    const err49 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err49];
                    } else {
                      vErrors.push(err49);
                    }
                    errors2++;
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
                  var _valid1 = _errs13 === errors2;
                  valid2 = valid2 || _valid1;
                  const _errs55 = errors2;
                  if (data3 !== null) {
                    const err50 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err50];
                    } else {
                      vErrors.push(err50);
                    }
                    errors2++;
                  }
                  var _valid1 = _errs55 === errors2;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err51 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err51];
                    } else {
                      vErrors.push(err51);
                    }
                    errors2++;
                    validate40.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs12;
                    if (vErrors !== null) {
                      if (_errs12) {
                        vErrors.length = _errs12;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs11 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.windowRequest !== void 0) {
                    let data18 = data.windowRequest;
                    const _errs57 = errors2;
                    const _errs58 = errors2;
                    let valid9 = false;
                    const _errs59 = errors2;
                    const _errs61 = errors2;
                    let valid11 = false;
                    let passing1 = null;
                    const _errs62 = errors2;
                    if (errors2 === _errs62) {
                      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                        let missing4;
                        if (data18.basis === void 0 && (missing4 = "basis") || data18.offset === void 0 && (missing4 = "offset") || data18.timezone === void 0 && (missing4 = "timezone") || data18.weekStartsOn === void 0 && (missing4 = "weekStartsOn")) {
                          const err52 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                          if (vErrors === null) {
                            vErrors = [err52];
                          } else {
                            vErrors.push(err52);
                          }
                          errors2++;
                        } else {
                          const _errs64 = errors2;
                          for (const key4 in data18) {
                            if (!(key4 === "basis" || key4 === "offset" || key4 === "timezone" || key4 === "weekStartsOn")) {
                              const err53 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err53];
                              } else {
                                vErrors.push(err53);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs64 === errors2) {
                            if (data18.basis !== void 0) {
                              const _errs65 = errors2;
                              if ("calendar-week" !== data18.basis) {
                                const err54 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err54];
                                } else {
                                  vErrors.push(err54);
                                }
                                errors2++;
                              }
                              var valid12 = _errs65 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data18.offset !== void 0) {
                                let data20 = data18.offset;
                                const _errs66 = errors2;
                                if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
                                  const err55 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err55];
                                  } else {
                                    vErrors.push(err55);
                                  }
                                  errors2++;
                                }
                                if (!(data20 === -1 || data20 === 0)) {
                                  const err56 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err56];
                                  } else {
                                    vErrors.push(err56);
                                  }
                                  errors2++;
                                }
                                var valid12 = _errs66 === errors2;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data18.timezone !== void 0) {
                                  let data21 = data18.timezone;
                                  const _errs68 = errors2;
                                  if (errors2 === _errs68) {
                                    if (typeof data21 === "string") {
                                      if (func1(data21) > 100) {
                                        const err57 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err57];
                                        } else {
                                          vErrors.push(err57);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data21) < 1) {
                                          const err58 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err58];
                                          } else {
                                            vErrors.push(err58);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err59 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err59];
                                      } else {
                                        vErrors.push(err59);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid12 = _errs68 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                                if (valid12) {
                                  if (data18.weekStartsOn !== void 0) {
                                    let data22 = data18.weekStartsOn;
                                    const _errs70 = errors2;
                                    if (typeof data22 !== "string") {
                                      const err60 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err60];
                                      } else {
                                        vErrors.push(err60);
                                      }
                                      errors2++;
                                    }
                                    if (!(data22 === "monday" || data22 === "sunday")) {
                                      const err61 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err61];
                                      } else {
                                        vErrors.push(err61);
                                      }
                                      errors2++;
                                    }
                                    var valid12 = _errs70 === errors2;
                                  } else {
                                    var valid12 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err62 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err62];
                        } else {
                          vErrors.push(err62);
                        }
                        errors2++;
                      }
                    }
                    var _valid5 = _errs62 === errors2;
                    if (_valid5) {
                      valid11 = true;
                      passing1 = 0;
                      var props2 = true;
                    }
                    const _errs72 = errors2;
                    if (errors2 === _errs72) {
                      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                        let missing5;
                        if (data18.basis === void 0 && (missing5 = "basis") || data18.offset === void 0 && (missing5 = "offset") || data18.timezone === void 0 && (missing5 = "timezone")) {
                          const err63 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                          if (vErrors === null) {
                            vErrors = [err63];
                          } else {
                            vErrors.push(err63);
                          }
                          errors2++;
                        } else {
                          const _errs74 = errors2;
                          for (const key5 in data18) {
                            if (!(key5 === "basis" || key5 === "offset" || key5 === "timezone")) {
                              const err64 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err64];
                              } else {
                                vErrors.push(err64);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs74 === errors2) {
                            if (data18.basis !== void 0) {
                              const _errs75 = errors2;
                              if ("calendar-month" !== data18.basis) {
                                const err65 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
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
                              if (data18.offset !== void 0) {
                                let data24 = data18.offset;
                                const _errs76 = errors2;
                                if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                  const err66 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err66];
                                  } else {
                                    vErrors.push(err66);
                                  }
                                  errors2++;
                                }
                                if (!(data24 === -1 || data24 === 0)) {
                                  const err67 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err67];
                                  } else {
                                    vErrors.push(err67);
                                  }
                                  errors2++;
                                }
                                var valid13 = _errs76 === errors2;
                              } else {
                                var valid13 = true;
                              }
                              if (valid13) {
                                if (data18.timezone !== void 0) {
                                  let data25 = data18.timezone;
                                  const _errs78 = errors2;
                                  if (errors2 === _errs78) {
                                    if (typeof data25 === "string") {
                                      if (func1(data25) > 100) {
                                        const err68 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err68];
                                        } else {
                                          vErrors.push(err68);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data25) < 1) {
                                          const err69 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err69];
                                          } else {
                                            vErrors.push(err69);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err70 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err70];
                                      } else {
                                        vErrors.push(err70);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid13 = _errs78 === errors2;
                                } else {
                                  var valid13 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err71 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err71];
                        } else {
                          vErrors.push(err71);
                        }
                        errors2++;
                      }
                    }
                    var _valid5 = _errs72 === errors2;
                    if (_valid5 && valid11) {
                      valid11 = false;
                      passing1 = [passing1, 1];
                    } else {
                      if (_valid5) {
                        valid11 = true;
                        passing1 = 1;
                        if (props2 !== true) {
                          props2 = true;
                        }
                      }
                      const _errs80 = errors2;
                      if (errors2 === _errs80) {
                        if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                          let missing6;
                          if (data18.basis === void 0 && (missing6 = "basis") || data18.offset === void 0 && (missing6 = "offset") || data18.timezone === void 0 && (missing6 = "timezone")) {
                            const err72 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                            if (vErrors === null) {
                              vErrors = [err72];
                            } else {
                              vErrors.push(err72);
                            }
                            errors2++;
                          } else {
                            const _errs82 = errors2;
                            for (const key6 in data18) {
                              if (!(key6 === "basis" || key6 === "offset" || key6 === "timezone")) {
                                const err73 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err73];
                                } else {
                                  vErrors.push(err73);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs82 === errors2) {
                              if (data18.basis !== void 0) {
                                const _errs83 = errors2;
                                if ("calendar-year" !== data18.basis) {
                                  const err74 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err74];
                                  } else {
                                    vErrors.push(err74);
                                  }
                                  errors2++;
                                }
                                var valid14 = _errs83 === errors2;
                              } else {
                                var valid14 = true;
                              }
                              if (valid14) {
                                if (data18.offset !== void 0) {
                                  let data27 = data18.offset;
                                  const _errs84 = errors2;
                                  if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                    const err75 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err75];
                                    } else {
                                      vErrors.push(err75);
                                    }
                                    errors2++;
                                  }
                                  if (!(data27 === -1 || data27 === 0)) {
                                    const err76 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err76];
                                    } else {
                                      vErrors.push(err76);
                                    }
                                    errors2++;
                                  }
                                  var valid14 = _errs84 === errors2;
                                } else {
                                  var valid14 = true;
                                }
                                if (valid14) {
                                  if (data18.timezone !== void 0) {
                                    let data28 = data18.timezone;
                                    const _errs86 = errors2;
                                    if (errors2 === _errs86) {
                                      if (typeof data28 === "string") {
                                        if (func1(data28) > 100) {
                                          const err77 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err77];
                                          } else {
                                            vErrors.push(err77);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data28) < 1) {
                                            const err78 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err78];
                                            } else {
                                              vErrors.push(err78);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err79 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err79];
                                        } else {
                                          vErrors.push(err79);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid14 = _errs86 === errors2;
                                  } else {
                                    var valid14 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err80 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err80];
                          } else {
                            vErrors.push(err80);
                          }
                          errors2++;
                        }
                      }
                      var _valid5 = _errs80 === errors2;
                      if (_valid5 && valid11) {
                        valid11 = false;
                        passing1 = [passing1, 2];
                      } else {
                        if (_valid5) {
                          valid11 = true;
                          passing1 = 2;
                          if (props2 !== true) {
                            props2 = true;
                          }
                        }
                        const _errs88 = errors2;
                        if (errors2 === _errs88) {
                          if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                            let missing7;
                            if (data18.basis === void 0 && (missing7 = "basis") || data18.days === void 0 && (missing7 = "days") || data18.anchorAt === void 0 && (missing7 = "anchorAt") || data18.timezone === void 0 && (missing7 = "timezone")) {
                              const err81 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                              if (vErrors === null) {
                                vErrors = [err81];
                              } else {
                                vErrors.push(err81);
                              }
                              errors2++;
                            } else {
                              const _errs90 = errors2;
                              for (const key7 in data18) {
                                if (!(key7 === "basis" || key7 === "days" || key7 === "anchorAt" || key7 === "timezone")) {
                                  const err82 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err82];
                                  } else {
                                    vErrors.push(err82);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs90 === errors2) {
                                if (data18.basis !== void 0) {
                                  const _errs91 = errors2;
                                  if ("relative-duration" !== data18.basis) {
                                    const err83 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err83];
                                    } else {
                                      vErrors.push(err83);
                                    }
                                    errors2++;
                                  }
                                  var valid15 = _errs91 === errors2;
                                } else {
                                  var valid15 = true;
                                }
                                if (valid15) {
                                  if (data18.days !== void 0) {
                                    let data30 = data18.days;
                                    const _errs92 = errors2;
                                    if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                      const err84 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err84];
                                      } else {
                                        vErrors.push(err84);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs92) {
                                      if (typeof data30 == "number" && isFinite(data30)) {
                                        if (data30 > 3660 || isNaN(data30)) {
                                          const err85 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                          if (vErrors === null) {
                                            vErrors = [err85];
                                          } else {
                                            vErrors.push(err85);
                                          }
                                          errors2++;
                                        } else {
                                          if (data30 < 1 || isNaN(data30)) {
                                            const err86 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err86];
                                            } else {
                                              vErrors.push(err86);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid15 = _errs92 === errors2;
                                  } else {
                                    var valid15 = true;
                                  }
                                  if (valid15) {
                                    if (data18.anchorAt !== void 0) {
                                      let data31 = data18.anchorAt;
                                      const _errs94 = errors2;
                                      if (errors2 === _errs94) {
                                        if (errors2 === _errs94) {
                                          if (typeof data31 === "string") {
                                            if (!pattern6.test(data31)) {
                                              const err87 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err87];
                                              } else {
                                                vErrors.push(err87);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data31)) {
                                                const err88 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err88];
                                                } else {
                                                  vErrors.push(err88);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err89 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err89];
                                            } else {
                                              vErrors.push(err89);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid15 = _errs94 === errors2;
                                    } else {
                                      var valid15 = true;
                                    }
                                    if (valid15) {
                                      if (data18.timezone !== void 0) {
                                        let data32 = data18.timezone;
                                        const _errs96 = errors2;
                                        if (errors2 === _errs96) {
                                          if (typeof data32 === "string") {
                                            if (func1(data32) > 100) {
                                              const err90 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err90];
                                              } else {
                                                vErrors.push(err90);
                                              }
                                              errors2++;
                                            } else {
                                              if (func1(data32) < 1) {
                                                const err91 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err91];
                                                } else {
                                                  vErrors.push(err91);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err92 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err92];
                                            } else {
                                              vErrors.push(err92);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid15 = _errs96 === errors2;
                                      } else {
                                        var valid15 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err93 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err93];
                            } else {
                              vErrors.push(err93);
                            }
                            errors2++;
                          }
                        }
                        var _valid5 = _errs88 === errors2;
                        if (_valid5 && valid11) {
                          valid11 = false;
                          passing1 = [passing1, 3];
                        } else {
                          if (_valid5) {
                            valid11 = true;
                            passing1 = 3;
                            if (props2 !== true) {
                              props2 = true;
                            }
                          }
                          const _errs98 = errors2;
                          if (errors2 === _errs98) {
                            if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                              let missing8;
                              if (data18.basis === void 0 && (missing8 = "basis") || data18.startInclusive === void 0 && (missing8 = "startInclusive") || data18.endExclusive === void 0 && (missing8 = "endExclusive") || data18.timezone === void 0 && (missing8 = "timezone")) {
                                const err94 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err94];
                                } else {
                                  vErrors.push(err94);
                                }
                                errors2++;
                              } else {
                                const _errs100 = errors2;
                                for (const key8 in data18) {
                                  if (!(key8 === "basis" || key8 === "startInclusive" || key8 === "endExclusive" || key8 === "timezone")) {
                                    const err95 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err95];
                                    } else {
                                      vErrors.push(err95);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs100 === errors2) {
                                  if (data18.basis !== void 0) {
                                    const _errs101 = errors2;
                                    if ("explicit" !== data18.basis) {
                                      const err96 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err96];
                                      } else {
                                        vErrors.push(err96);
                                      }
                                      errors2++;
                                    }
                                    var valid16 = _errs101 === errors2;
                                  } else {
                                    var valid16 = true;
                                  }
                                  if (valid16) {
                                    if (data18.startInclusive !== void 0) {
                                      let data34 = data18.startInclusive;
                                      const _errs102 = errors2;
                                      if (errors2 === _errs102) {
                                        if (errors2 === _errs102) {
                                          if (typeof data34 === "string") {
                                            if (!pattern6.test(data34)) {
                                              const err97 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err97];
                                              } else {
                                                vErrors.push(err97);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data34)) {
                                                const err98 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err98];
                                                } else {
                                                  vErrors.push(err98);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err99 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err99];
                                            } else {
                                              vErrors.push(err99);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid16 = _errs102 === errors2;
                                    } else {
                                      var valid16 = true;
                                    }
                                    if (valid16) {
                                      if (data18.endExclusive !== void 0) {
                                        let data35 = data18.endExclusive;
                                        const _errs104 = errors2;
                                        if (errors2 === _errs104) {
                                          if (errors2 === _errs104) {
                                            if (typeof data35 === "string") {
                                              if (!pattern6.test(data35)) {
                                                const err100 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err100];
                                                } else {
                                                  vErrors.push(err100);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data35)) {
                                                  const err101 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err101];
                                                  } else {
                                                    vErrors.push(err101);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err102 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid16 = _errs104 === errors2;
                                      } else {
                                        var valid16 = true;
                                      }
                                      if (valid16) {
                                        if (data18.timezone !== void 0) {
                                          let data36 = data18.timezone;
                                          const _errs106 = errors2;
                                          if (errors2 === _errs106) {
                                            if (typeof data36 === "string") {
                                              if (func1(data36) > 100) {
                                                const err103 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err103];
                                                } else {
                                                  vErrors.push(err103);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data36) < 1) {
                                                  const err104 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err104];
                                                  } else {
                                                    vErrors.push(err104);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err105 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err105];
                                              } else {
                                                vErrors.push(err105);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid16 = _errs106 === errors2;
                                        } else {
                                          var valid16 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err106 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err106];
                              } else {
                                vErrors.push(err106);
                              }
                              errors2++;
                            }
                          }
                          var _valid5 = _errs98 === errors2;
                          if (_valid5 && valid11) {
                            valid11 = false;
                            passing1 = [passing1, 4];
                          } else {
                            if (_valid5) {
                              valid11 = true;
                              passing1 = 4;
                              if (props2 !== true) {
                                props2 = true;
                              }
                            }
                            const _errs108 = errors2;
                            if (errors2 === _errs108) {
                              if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                let missing9;
                                if (data18.basis === void 0 && (missing9 = "basis") || data18.year === void 0 && (missing9 = "year") || data18.calendarId === void 0 && (missing9 = "calendarId") || data18.stage === void 0 && (missing9 = "stage") || data18.revisionId === void 0 && (missing9 = "revisionId") || data18.timezone === void 0 && (missing9 = "timezone")) {
                                  const err107 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err107];
                                  } else {
                                    vErrors.push(err107);
                                  }
                                  errors2++;
                                } else {
                                  const _errs110 = errors2;
                                  for (const key9 in data18) {
                                    if (!(key9 === "basis" || key9 === "year" || key9 === "calendarId" || key9 === "stage" || key9 === "revisionId" || key9 === "timezone")) {
                                      const err108 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err108];
                                      } else {
                                        vErrors.push(err108);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs110 === errors2) {
                                    if (data18.basis !== void 0) {
                                      const _errs111 = errors2;
                                      if ("fiscal-year" !== data18.basis) {
                                        const err109 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err109];
                                        } else {
                                          vErrors.push(err109);
                                        }
                                        errors2++;
                                      }
                                      var valid17 = _errs111 === errors2;
                                    } else {
                                      var valid17 = true;
                                    }
                                    if (valid17) {
                                      if (data18.year !== void 0) {
                                        let data38 = data18.year;
                                        const _errs112 = errors2;
                                        if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                          const err110 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err110];
                                          } else {
                                            vErrors.push(err110);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs112) {
                                          if (typeof data38 == "number" && isFinite(data38)) {
                                            if (data38 > 3e3 || isNaN(data38)) {
                                              const err111 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                              if (vErrors === null) {
                                                vErrors = [err111];
                                              } else {
                                                vErrors.push(err111);
                                              }
                                              errors2++;
                                            } else {
                                              if (data38 < 1900 || isNaN(data38)) {
                                                const err112 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                                if (vErrors === null) {
                                                  vErrors = [err112];
                                                } else {
                                                  vErrors.push(err112);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid17 = _errs112 === errors2;
                                      } else {
                                        var valid17 = true;
                                      }
                                      if (valid17) {
                                        if (data18.calendarId !== void 0) {
                                          let data39 = data18.calendarId;
                                          const _errs114 = errors2;
                                          if (errors2 === _errs114) {
                                            if (typeof data39 === "string") {
                                              if (func1(data39) > 128) {
                                                const err113 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err113];
                                                } else {
                                                  vErrors.push(err113);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data39) < 1) {
                                                  const err114 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err114];
                                                  } else {
                                                    vErrors.push(err114);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!pattern9.test(data39)) {
                                                    const err115 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err115];
                                                    } else {
                                                      vErrors.push(err115);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err116 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err116];
                                              } else {
                                                vErrors.push(err116);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid17 = _errs114 === errors2;
                                        } else {
                                          var valid17 = true;
                                        }
                                        if (valid17) {
                                          if (data18.stage !== void 0) {
                                            let data40 = data18.stage;
                                            const _errs116 = errors2;
                                            if (typeof data40 !== "string") {
                                              const err117 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err117];
                                              } else {
                                                vErrors.push(err117);
                                              }
                                              errors2++;
                                            }
                                            if (!(data40 === "requested" || data40 === "authorized" || data40 === "appropriated" || data40 === "obligated" || data40 === "actual" || data40 === "outlay")) {
                                              const err118 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                              if (vErrors === null) {
                                                vErrors = [err118];
                                              } else {
                                                vErrors.push(err118);
                                              }
                                              errors2++;
                                            }
                                            var valid17 = _errs116 === errors2;
                                          } else {
                                            var valid17 = true;
                                          }
                                          if (valid17) {
                                            if (data18.revisionId !== void 0) {
                                              let data41 = data18.revisionId;
                                              const _errs118 = errors2;
                                              if (errors2 === _errs118) {
                                                if (typeof data41 === "string") {
                                                  if (func1(data41) > 256) {
                                                    const err119 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err119];
                                                    } else {
                                                      vErrors.push(err119);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    if (func1(data41) < 1) {
                                                      const err120 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err120];
                                                      } else {
                                                        vErrors.push(err120);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                } else {
                                                  const err121 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err121];
                                                  } else {
                                                    vErrors.push(err121);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid17 = _errs118 === errors2;
                                            } else {
                                              var valid17 = true;
                                            }
                                            if (valid17) {
                                              if (data18.timezone !== void 0) {
                                                let data42 = data18.timezone;
                                                const _errs120 = errors2;
                                                if (errors2 === _errs120) {
                                                  if (typeof data42 === "string") {
                                                    if (func1(data42) > 100) {
                                                      const err122 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err122];
                                                      } else {
                                                        vErrors.push(err122);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (func1(data42) < 1) {
                                                        const err123 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err123];
                                                        } else {
                                                          vErrors.push(err123);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err124 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err124];
                                                    } else {
                                                      vErrors.push(err124);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid17 = _errs120 === errors2;
                                              } else {
                                                var valid17 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err125 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err125];
                                } else {
                                  vErrors.push(err125);
                                }
                                errors2++;
                              }
                            }
                            var _valid5 = _errs108 === errors2;
                            if (_valid5 && valid11) {
                              valid11 = false;
                              passing1 = [passing1, 5];
                            } else {
                              if (_valid5) {
                                valid11 = true;
                                passing1 = 5;
                                if (props2 !== true) {
                                  props2 = true;
                                }
                              }
                              const _errs122 = errors2;
                              if (errors2 === _errs122) {
                                if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                  let missing10;
                                  if (data18.basis === void 0 && (missing10 = "basis")) {
                                    const err126 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                                    if (vErrors === null) {
                                      vErrors = [err126];
                                    } else {
                                      vErrors.push(err126);
                                    }
                                    errors2++;
                                  } else {
                                    const _errs124 = errors2;
                                    for (const key10 in data18) {
                                      if (!(key10 === "basis")) {
                                        const err127 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                        if (vErrors === null) {
                                          vErrors = [err127];
                                        } else {
                                          vErrors.push(err127);
                                        }
                                        errors2++;
                                        break;
                                      }
                                    }
                                    if (_errs124 === errors2) {
                                      if (data18.basis !== void 0) {
                                        if ("unbounded" !== data18.basis) {
                                          const err128 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err128];
                                          } else {
                                            vErrors.push(err128);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const err129 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                  if (vErrors === null) {
                                    vErrors = [err129];
                                  } else {
                                    vErrors.push(err129);
                                  }
                                  errors2++;
                                }
                              }
                              var _valid5 = _errs122 === errors2;
                              if (_valid5 && valid11) {
                                valid11 = false;
                                passing1 = [passing1, 6];
                              } else {
                                if (_valid5) {
                                  valid11 = true;
                                  passing1 = 6;
                                  if (props2 !== true) {
                                    props2 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    if (!valid11) {
                      const err130 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                      if (vErrors === null) {
                        vErrors = [err130];
                      } else {
                        vErrors.push(err130);
                      }
                      errors2++;
                    } else {
                      errors2 = _errs61;
                      if (vErrors !== null) {
                        if (_errs61) {
                          vErrors.length = _errs61;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var _valid4 = _errs59 === errors2;
                    valid9 = valid9 || _valid4;
                    const _errs126 = errors2;
                    if (data18 !== null) {
                      const err131 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err131];
                      } else {
                        vErrors.push(err131);
                      }
                      errors2++;
                    }
                    var _valid4 = _errs126 === errors2;
                    valid9 = valid9 || _valid4;
                    if (!valid9) {
                      const err132 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err132];
                      } else {
                        vErrors.push(err132);
                      }
                      errors2++;
                      validate40.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs58;
                      if (vErrors !== null) {
                        if (_errs58) {
                          vErrors.length = _errs58;
                        } else {
                          vErrors = null;
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
    } else {
      validate40.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate40.errors = vErrors;
  return errors2 === 0;
}
validate40.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateAdmittedResponse = validate42;
var schema46 = { "type": "object", "properties": { "binding": { "$ref": "#/$defs/Canonical_RunBinding_84f2304c" }, "state": { "type": "string", "enum": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"] }, "scopes": { "type": "array", "items": { "$ref": "#/$defs/Canonical_Scope_f882edb5" }, "minItems": 1, "uniqueItems": true }, "createdAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "policyRevision": { "type": "string", "minLength": 1 }, "versions": { "$ref": "#/$defs/Canonical_RuntimeVersions_7edb8efc" } }, "required": ["binding", "state", "scopes", "createdAt", "policyRevision", "versions"], "additionalProperties": false };
var schema48 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var func0 = require_equal().default;
var formats20 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var pattern27 = new RegExp("^sha256:[a-f0-9]{64}$", "u");
var pattern28 = new RegExp("^[0-9]+\\.[0-9]+\\.[0-9]+$", "u");
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
      if (data.binding === void 0 && (missing0 = "binding") || data.state === void 0 && (missing0 = "state") || data.scopes === void 0 && (missing0 = "scopes") || data.createdAt === void 0 && (missing0 = "createdAt") || data.policyRevision === void 0 && (missing0 = "policyRevision") || data.versions === void 0 && (missing0 = "versions")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "binding" || key0 === "state" || key0 === "scopes" || key0 === "createdAt" || key0 === "policyRevision" || key0 === "versions")) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.binding !== void 0) {
            let data0 = data.binding;
            const _errs2 = errors2;
            const _errs3 = errors2;
            if (errors2 === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.tenantId === void 0 && (missing1 = "tenantId") || data0.actorId === void 0 && (missing1 = "actorId") || data0.conversationId === void 0 && (missing1 = "conversationId") || data0.runId === void 0 && (missing1 = "runId") || data0.attemptId === void 0 && (missing1 = "attemptId") || data0.workerId === void 0 && (missing1 = "workerId") || data0.writerFence === void 0 && (missing1 = "writerFence")) {
                  validate31.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs5 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                      validate31.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                            validate31.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                            return false;
                          } else {
                            if (func1(data1) < 1) {
                              validate31.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                              return false;
                            }
                          }
                        } else {
                          validate31.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                              validate31.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func1(data2) < 1) {
                                validate31.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                return false;
                              }
                            }
                          } else {
                            validate31.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                if (!formats20.test(data3)) {
                                  validate31.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                  return false;
                                }
                              } else {
                                validate31.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  if (!formats20.test(data4)) {
                                    validate31.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                    return false;
                                  }
                                } else {
                                  validate31.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    if (!formats20.test(data5)) {
                                      validate31.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate31.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      if (!formats20.test(data6)) {
                                        validate31.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                    validate31.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors2 === _errs18) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 9007199254740991 || isNaN(data7)) {
                                        validate31.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          validate31.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                validate31.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.state !== void 0) {
              let data8 = data.state;
              const _errs20 = errors2;
              if (typeof data8 !== "string") {
                validate31.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              if (!(data8 === "queued" || data8 === "starting" || data8 === "running" || data8 === "waiting-for-approval" || data8 === "paused" || data8 === "completed" || data8 === "failed" || data8 === "cancelled")) {
                validate31.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/properties/state/enum", keyword: "enum", params: { allowedValues: schema46.properties.state.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs20 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.scopes !== void 0) {
                let data9 = data.scopes;
                const _errs22 = errors2;
                if (errors2 === _errs22) {
                  if (Array.isArray(data9)) {
                    if (data9.length < 1) {
                      validate31.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                      return false;
                    } else {
                      var valid3 = true;
                      const len0 = data9.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data10 = data9[i0];
                        const _errs24 = errors2;
                        const _errs25 = errors2;
                        if (errors2 === _errs25) {
                          if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
                            let missing2;
                            if (data10.tenantId === void 0 && (missing2 = "tenantId") || data10.kind === void 0 && (missing2 = "kind") || data10.resourceId === void 0 && (missing2 = "resourceId") || data10.policyRevision === void 0 && (missing2 = "policyRevision")) {
                              validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                              return false;
                            } else {
                              const _errs27 = errors2;
                              for (const key2 in data10) {
                                if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                  validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs27 === errors2) {
                                if (data10.tenantId !== void 0) {
                                  let data11 = data10.tenantId;
                                  const _errs28 = errors2;
                                  if (errors2 === _errs28) {
                                    if (typeof data11 === "string") {
                                      if (func1(data11) > 128) {
                                        validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func1(data11) < 1) {
                                          validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid5 = _errs28 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data10.kind !== void 0) {
                                    let data12 = data10.kind;
                                    const _errs30 = errors2;
                                    if (typeof data12 !== "string") {
                                      validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                    if (!(data12 === "tenant" || data12 === "client" || data12 === "mailbox" || data12 === "memory" || data12 === "document" || data12 === "private-user" || data12 === "public")) {
                                      validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema48.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                      return false;
                                    }
                                    var valid5 = _errs30 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data10.resourceId !== void 0) {
                                      let data13 = data10.resourceId;
                                      const _errs32 = errors2;
                                      if (errors2 === _errs32) {
                                        if (typeof data13 === "string") {
                                          if (func1(data13) > 256) {
                                            validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                            return false;
                                          } else {
                                            if (func1(data13) < 1) {
                                              validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid5 = _errs32 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data10.policyRevision !== void 0) {
                                        let data14 = data10.policyRevision;
                                        const _errs34 = errors2;
                                        if (errors2 === _errs34) {
                                          if (typeof data14 === "string") {
                                            if (func1(data14) > 128) {
                                              validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func1(data14) < 1) {
                                                validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid5 = _errs34 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid3 = _errs24 === errors2;
                        if (!valid3) {
                          break;
                        }
                      }
                      if (valid3) {
                        let i1 = data9.length;
                        let j0;
                        if (i1 > 1) {
                          outer0: for (; i1--; ) {
                            for (j0 = i1; j0--; ) {
                              if (func0(data9[i1], data9[j0])) {
                                validate31.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                return false;
                                break outer0;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate31.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs22 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.createdAt !== void 0) {
                  let data15 = data.createdAt;
                  const _errs36 = errors2;
                  if (errors2 === _errs36) {
                    if (errors2 === _errs36) {
                      if (typeof data15 === "string") {
                        if (!pattern6.test(data15)) {
                          validate31.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                          return false;
                        } else {
                          if (!formats0.validate(data15)) {
                            validate31.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                            return false;
                          }
                        }
                      } else {
                        validate31.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs36 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.policyRevision !== void 0) {
                    let data16 = data.policyRevision;
                    const _errs38 = errors2;
                    if (errors2 === _errs38) {
                      if (typeof data16 === "string") {
                        if (func1(data16) < 1) {
                          validate31.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                          return false;
                        }
                      } else {
                        validate31.errors = [{ instancePath: instancePath + "/policyRevision", schemaPath: "#/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                    }
                    var valid0 = _errs38 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.versions !== void 0) {
                      let data17 = data.versions;
                      const _errs40 = errors2;
                      const _errs41 = errors2;
                      if (errors2 === _errs41) {
                        if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                          let missing3;
                          if (data17.imageDigest === void 0 && (missing3 = "imageDigest") || data17.sdk === void 0 && (missing3 = "sdk") || data17.cli === void 0 && (missing3 = "cli") || data17.contracts === void 0 && (missing3 = "contracts") || data17.skillsDigest === void 0 && (missing3 = "skillsDigest") || data17.checkpointFormat === void 0 && (missing3 = "checkpointFormat")) {
                            validate31.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                            return false;
                          } else {
                            const _errs43 = errors2;
                            for (const key3 in data17) {
                              if (!(key3 === "imageDigest" || key3 === "sdk" || key3 === "cli" || key3 === "contracts" || key3 === "skillsDigest" || key3 === "checkpointFormat")) {
                                validate31.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs43 === errors2) {
                              if (data17.imageDigest !== void 0) {
                                let data18 = data17.imageDigest;
                                const _errs44 = errors2;
                                if (errors2 === _errs44) {
                                  if (typeof data18 === "string") {
                                    if (func1(data18) < 1) {
                                      validate31.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    } else {
                                      if (!pattern27.test(data18)) {
                                        validate31.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/pattern", keyword: "pattern", params: { pattern: "^sha256:[a-f0-9]{64}$" }, message: 'must match pattern "^sha256:[a-f0-9]{64}$"' }];
                                        return false;
                                      }
                                    }
                                  } else {
                                    validate31.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid8 = _errs44 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data17.sdk !== void 0) {
                                  let data19 = data17.sdk;
                                  const _errs46 = errors2;
                                  if (errors2 === _errs46) {
                                    if (typeof data19 === "string") {
                                      if (!pattern28.test(data19)) {
                                        validate31.errors = [{ instancePath: instancePath + "/versions/sdk", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/sdk/pattern", keyword: "pattern", params: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }, message: 'must match pattern "^[0-9]+\\.[0-9]+\\.[0-9]+$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/versions/sdk", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/sdk/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid8 = _errs46 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data17.cli !== void 0) {
                                    let data20 = data17.cli;
                                    const _errs48 = errors2;
                                    if (errors2 === _errs48) {
                                      if (typeof data20 === "string") {
                                        if (!pattern28.test(data20)) {
                                          validate31.errors = [{ instancePath: instancePath + "/versions/cli", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/cli/pattern", keyword: "pattern", params: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }, message: 'must match pattern "^[0-9]+\\.[0-9]+\\.[0-9]+$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate31.errors = [{ instancePath: instancePath + "/versions/cli", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/cli/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid8 = _errs48 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data17.contracts !== void 0) {
                                      const _errs50 = errors2;
                                      if ("0.1.0" !== data17.contracts) {
                                        validate31.errors = [{ instancePath: instancePath + "/versions/contracts", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/contracts/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
                                        return false;
                                      }
                                      var valid8 = _errs50 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data17.skillsDigest !== void 0) {
                                        let data22 = data17.skillsDigest;
                                        const _errs51 = errors2;
                                        if (errors2 === _errs51) {
                                          if (typeof data22 === "string") {
                                            if (!pattern14.test(data22)) {
                                              validate31.errors = [{ instancePath: instancePath + "/versions/skillsDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/skillsDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate31.errors = [{ instancePath: instancePath + "/versions/skillsDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/skillsDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid8 = _errs51 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data17.checkpointFormat !== void 0) {
                                          const _errs53 = errors2;
                                          if ("0.1.0" !== data17.checkpointFormat) {
                                            validate31.errors = [{ instancePath: instancePath + "/versions/checkpointFormat", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/checkpointFormat/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
                                            return false;
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
                            }
                          }
                        } else {
                          validate31.errors = [{ instancePath: instancePath + "/versions", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs40 === errors2;
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
      if (data.requestId === void 0 && (missing0 = "requestId") || data.prompt === void 0 && (missing0 = "prompt") || data.skill === void 0 && (missing0 = "skill") || data.window === void 0 && (missing0 = "window") || data.windowRequest === void 0 && (missing0 = "windowRequest")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "requestId" || key0 === "prompt" || key0 === "skill" || key0 === "window" || key0 === "windowRequest")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.requestId !== void 0) {
            let data0 = data.requestId;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern4.test(data0)) {
                  validate33.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate33.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.prompt !== void 0) {
              let data1 = data.prompt;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (typeof data1 === "string") {
                  if (func1(data1) > 1e5) {
                    validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data1)) {
                        validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                        return false;
                      }
                    }
                  }
                } else {
                  validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.skill !== void 0) {
                let data2 = data.skill;
                const _errs6 = errors2;
                const _errs7 = errors2;
                let valid1 = false;
                const _errs8 = errors2;
                if (!validate26(data2, { instancePath: instancePath + "/skill", parentData: data, parentDataProperty: "skill", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
                  errors2 = vErrors.length;
                }
                var _valid0 = _errs8 === errors2;
                valid1 = valid1 || _valid0;
                const _errs9 = errors2;
                if (data2 !== null) {
                  const err0 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors2++;
                }
                var _valid0 = _errs9 === errors2;
                valid1 = valid1 || _valid0;
                if (!valid1) {
                  const err1 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors2++;
                  validate33.errors = vErrors;
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
                if (data.window !== void 0) {
                  let data3 = data.window;
                  const _errs11 = errors2;
                  const _errs12 = errors2;
                  let valid2 = false;
                  const _errs13 = errors2;
                  const _errs15 = errors2;
                  let valid4 = false;
                  let passing0 = null;
                  const _errs16 = errors2;
                  if (errors2 === _errs16) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing1;
                      if (data3.basis === void 0 && (missing1 = "basis") || data3.startInclusive === void 0 && (missing1 = "startInclusive") || data3.endExclusive === void 0 && (missing1 = "endExclusive") || data3.timezone === void 0 && (missing1 = "timezone") || data3.weekStartsOn === void 0 && (missing1 = "weekStartsOn")) {
                        const err2 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      } else {
                        const _errs18 = errors2;
                        for (const key1 in data3) {
                          if (!(key1 === "basis" || key1 === "startInclusive" || key1 === "endExclusive" || key1 === "timezone" || key1 === "weekStartsOn")) {
                            const err3 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs18 === errors2) {
                          if (data3.basis !== void 0) {
                            let data4 = data3.basis;
                            const _errs19 = errors2;
                            if (typeof data4 !== "string") {
                              const err4 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/basis/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors2++;
                            }
                            if (!(data4 === "calendar-week" || data4 === "calendar-month" || data4 === "calendar-year" || data4 === "relative-duration" || data4 === "explicit")) {
                              const err5 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/basis/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.basis.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err5];
                              } else {
                                vErrors.push(err5);
                              }
                              errors2++;
                            }
                            var valid5 = _errs19 === errors2;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data3.startInclusive !== void 0) {
                              let data5 = data3.startInclusive;
                              const _errs21 = errors2;
                              if (errors2 === _errs21) {
                                if (errors2 === _errs21) {
                                  if (typeof data5 === "string") {
                                    if (!pattern6.test(data5)) {
                                      const err6 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats0.validate(data5)) {
                                        const err7 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err7];
                                        } else {
                                          vErrors.push(err7);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err8 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err8];
                                    } else {
                                      vErrors.push(err8);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var valid5 = _errs21 === errors2;
                            } else {
                              var valid5 = true;
                            }
                            if (valid5) {
                              if (data3.endExclusive !== void 0) {
                                let data6 = data3.endExclusive;
                                const _errs23 = errors2;
                                if (errors2 === _errs23) {
                                  if (errors2 === _errs23) {
                                    if (typeof data6 === "string") {
                                      if (!pattern6.test(data6)) {
                                        const err9 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                        if (vErrors === null) {
                                          vErrors = [err9];
                                        } else {
                                          vErrors.push(err9);
                                        }
                                        errors2++;
                                      } else {
                                        if (!formats0.validate(data6)) {
                                          const err10 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                          if (vErrors === null) {
                                            vErrors = [err10];
                                          } else {
                                            vErrors.push(err10);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err11 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err11];
                                      } else {
                                        vErrors.push(err11);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var valid5 = _errs23 === errors2;
                              } else {
                                var valid5 = true;
                              }
                              if (valid5) {
                                if (data3.timezone !== void 0) {
                                  let data7 = data3.timezone;
                                  const _errs25 = errors2;
                                  if (errors2 === _errs25) {
                                    if (typeof data7 === "string") {
                                      if (func1(data7) > 100) {
                                        const err12 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err12];
                                        } else {
                                          vErrors.push(err12);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data7) < 1) {
                                          const err13 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err13];
                                          } else {
                                            vErrors.push(err13);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err14 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err14];
                                      } else {
                                        vErrors.push(err14);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid5 = _errs25 === errors2;
                                } else {
                                  var valid5 = true;
                                }
                                if (valid5) {
                                  if (data3.weekStartsOn !== void 0) {
                                    let data8 = data3.weekStartsOn;
                                    const _errs27 = errors2;
                                    const _errs28 = errors2;
                                    let valid6 = false;
                                    const _errs29 = errors2;
                                    if (typeof data8 !== "string") {
                                      const err15 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err15];
                                      } else {
                                        vErrors.push(err15);
                                      }
                                      errors2++;
                                    }
                                    if (!(data8 === "monday" || data8 === "sunday")) {
                                      const err16 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.weekStartsOn.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err16];
                                      } else {
                                        vErrors.push(err16);
                                      }
                                      errors2++;
                                    }
                                    var _valid3 = _errs29 === errors2;
                                    valid6 = valid6 || _valid3;
                                    const _errs31 = errors2;
                                    if (data8 !== null) {
                                      const err17 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err17];
                                      } else {
                                        vErrors.push(err17);
                                      }
                                      errors2++;
                                    }
                                    var _valid3 = _errs31 === errors2;
                                    valid6 = valid6 || _valid3;
                                    if (!valid6) {
                                      const err18 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/properties/weekStartsOn/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err18];
                                      } else {
                                        vErrors.push(err18);
                                      }
                                      errors2++;
                                    } else {
                                      errors2 = _errs28;
                                      if (vErrors !== null) {
                                        if (_errs28) {
                                          vErrors.length = _errs28;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid5 = _errs27 === errors2;
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
                      const err19 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err19];
                      } else {
                        vErrors.push(err19);
                      }
                      errors2++;
                    }
                  }
                  var _valid2 = _errs16 === errors2;
                  if (_valid2) {
                    valid4 = true;
                    passing0 = 0;
                    var props1 = true;
                  }
                  const _errs33 = errors2;
                  if (errors2 === _errs33) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing2;
                      if (data3.basis === void 0 && (missing2 = "basis") || data3.year === void 0 && (missing2 = "year") || data3.calendarId === void 0 && (missing2 = "calendarId") || data3.stage === void 0 && (missing2 = "stage") || data3.revisionId === void 0 && (missing2 = "revisionId") || data3.startInclusive === void 0 && (missing2 = "startInclusive") || data3.endExclusive === void 0 && (missing2 = "endExclusive") || data3.timezone === void 0 && (missing2 = "timezone")) {
                        const err20 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                        if (vErrors === null) {
                          vErrors = [err20];
                        } else {
                          vErrors.push(err20);
                        }
                        errors2++;
                      } else {
                        const _errs35 = errors2;
                        for (const key2 in data3) {
                          if (!(key2 === "basis" || key2 === "year" || key2 === "calendarId" || key2 === "stage" || key2 === "revisionId" || key2 === "startInclusive" || key2 === "endExclusive" || key2 === "timezone")) {
                            const err21 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err21];
                            } else {
                              vErrors.push(err21);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs35 === errors2) {
                          if (data3.basis !== void 0) {
                            const _errs36 = errors2;
                            if ("fiscal-year" !== data3.basis) {
                              const err22 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err22];
                              } else {
                                vErrors.push(err22);
                              }
                              errors2++;
                            }
                            var valid7 = _errs36 === errors2;
                          } else {
                            var valid7 = true;
                          }
                          if (valid7) {
                            if (data3.year !== void 0) {
                              let data10 = data3.year;
                              const _errs37 = errors2;
                              if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                const err23 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err23];
                                } else {
                                  vErrors.push(err23);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs37) {
                                if (typeof data10 == "number" && isFinite(data10)) {
                                  if (data10 > 3e3 || isNaN(data10)) {
                                    const err24 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                    if (vErrors === null) {
                                      vErrors = [err24];
                                    } else {
                                      vErrors.push(err24);
                                    }
                                    errors2++;
                                  } else {
                                    if (data10 < 1900 || isNaN(data10)) {
                                      const err25 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                      if (vErrors === null) {
                                        vErrors = [err25];
                                      } else {
                                        vErrors.push(err25);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid7 = _errs37 === errors2;
                            } else {
                              var valid7 = true;
                            }
                            if (valid7) {
                              if (data3.calendarId !== void 0) {
                                let data11 = data3.calendarId;
                                const _errs39 = errors2;
                                if (errors2 === _errs39) {
                                  if (typeof data11 === "string") {
                                    if (func1(data11) > 128) {
                                      const err26 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err26];
                                      } else {
                                        vErrors.push(err26);
                                      }
                                      errors2++;
                                    } else {
                                      if (func1(data11) < 1) {
                                        const err27 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err27];
                                        } else {
                                          vErrors.push(err27);
                                        }
                                        errors2++;
                                      } else {
                                        if (!pattern9.test(data11)) {
                                          const err28 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                          if (vErrors === null) {
                                            vErrors = [err28];
                                          } else {
                                            vErrors.push(err28);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  } else {
                                    const err29 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid7 = _errs39 === errors2;
                              } else {
                                var valid7 = true;
                              }
                              if (valid7) {
                                if (data3.stage !== void 0) {
                                  let data12 = data3.stage;
                                  const _errs41 = errors2;
                                  if (typeof data12 !== "string") {
                                    const err30 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err30];
                                    } else {
                                      vErrors.push(err30);
                                    }
                                    errors2++;
                                  }
                                  if (!(data12 === "requested" || data12 === "authorized" || data12 === "appropriated" || data12 === "obligated" || data12 === "actual" || data12 === "outlay")) {
                                    const err31 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/stage/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[1].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err31];
                                    } else {
                                      vErrors.push(err31);
                                    }
                                    errors2++;
                                  }
                                  var valid7 = _errs41 === errors2;
                                } else {
                                  var valid7 = true;
                                }
                                if (valid7) {
                                  if (data3.revisionId !== void 0) {
                                    let data13 = data3.revisionId;
                                    const _errs43 = errors2;
                                    if (errors2 === _errs43) {
                                      if (typeof data13 === "string") {
                                        if (func1(data13) > 256) {
                                          const err32 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data13) < 1) {
                                            const err33 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err33];
                                            } else {
                                              vErrors.push(err33);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err34 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err34];
                                        } else {
                                          vErrors.push(err34);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid7 = _errs43 === errors2;
                                  } else {
                                    var valid7 = true;
                                  }
                                  if (valid7) {
                                    if (data3.startInclusive !== void 0) {
                                      let data14 = data3.startInclusive;
                                      const _errs45 = errors2;
                                      if (errors2 === _errs45) {
                                        if (errors2 === _errs45) {
                                          if (typeof data14 === "string") {
                                            if (!pattern6.test(data14)) {
                                              const err35 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err35];
                                              } else {
                                                vErrors.push(err35);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data14)) {
                                                const err36 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err36];
                                                } else {
                                                  vErrors.push(err36);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err37 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err37];
                                            } else {
                                              vErrors.push(err37);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid7 = _errs45 === errors2;
                                    } else {
                                      var valid7 = true;
                                    }
                                    if (valid7) {
                                      if (data3.endExclusive !== void 0) {
                                        let data15 = data3.endExclusive;
                                        const _errs47 = errors2;
                                        if (errors2 === _errs47) {
                                          if (errors2 === _errs47) {
                                            if (typeof data15 === "string") {
                                              if (!pattern6.test(data15)) {
                                                const err38 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err38];
                                                } else {
                                                  vErrors.push(err38);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data15)) {
                                                  const err39 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err39];
                                                  } else {
                                                    vErrors.push(err39);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err40 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err40];
                                              } else {
                                                vErrors.push(err40);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid7 = _errs47 === errors2;
                                      } else {
                                        var valid7 = true;
                                      }
                                      if (valid7) {
                                        if (data3.timezone !== void 0) {
                                          let data16 = data3.timezone;
                                          const _errs49 = errors2;
                                          if (errors2 === _errs49) {
                                            if (typeof data16 === "string") {
                                              if (func1(data16) > 100) {
                                                const err41 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err41];
                                                } else {
                                                  vErrors.push(err41);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data16) < 1) {
                                                  const err42 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err42];
                                                  } else {
                                                    vErrors.push(err42);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err43 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err43];
                                              } else {
                                                vErrors.push(err43);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid7 = _errs49 === errors2;
                                        } else {
                                          var valid7 = true;
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
                      const err44 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err44];
                      } else {
                        vErrors.push(err44);
                      }
                      errors2++;
                    }
                  }
                  var _valid2 = _errs33 === errors2;
                  if (_valid2 && valid4) {
                    valid4 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid2) {
                      valid4 = true;
                      passing0 = 1;
                      if (props1 !== true) {
                        props1 = true;
                      }
                    }
                    const _errs51 = errors2;
                    if (errors2 === _errs51) {
                      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                        let missing3;
                        if (data3.basis === void 0 && (missing3 = "basis")) {
                          const err45 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                          if (vErrors === null) {
                            vErrors = [err45];
                          } else {
                            vErrors.push(err45);
                          }
                          errors2++;
                        } else {
                          const _errs53 = errors2;
                          for (const key3 in data3) {
                            if (!(key3 === "basis")) {
                              const err46 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err46];
                              } else {
                                vErrors.push(err46);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs53 === errors2) {
                            if (data3.basis !== void 0) {
                              if ("unbounded" !== data3.basis) {
                                const err47 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
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
                      } else {
                        const err48 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err48];
                        } else {
                          vErrors.push(err48);
                        }
                        errors2++;
                      }
                    }
                    var _valid2 = _errs51 === errors2;
                    if (_valid2 && valid4) {
                      valid4 = false;
                      passing0 = [passing0, 2];
                    } else {
                      if (_valid2) {
                        valid4 = true;
                        passing0 = 2;
                        if (props1 !== true) {
                          props1 = true;
                        }
                      }
                    }
                  }
                  if (!valid4) {
                    const err49 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_8a69a7e3/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err49];
                    } else {
                      vErrors.push(err49);
                    }
                    errors2++;
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
                  var _valid1 = _errs13 === errors2;
                  valid2 = valid2 || _valid1;
                  const _errs55 = errors2;
                  if (data3 !== null) {
                    const err50 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err50];
                    } else {
                      vErrors.push(err50);
                    }
                    errors2++;
                  }
                  var _valid1 = _errs55 === errors2;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err51 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err51];
                    } else {
                      vErrors.push(err51);
                    }
                    errors2++;
                    validate33.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs12;
                    if (vErrors !== null) {
                      if (_errs12) {
                        vErrors.length = _errs12;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs11 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.windowRequest !== void 0) {
                    let data18 = data.windowRequest;
                    const _errs57 = errors2;
                    const _errs58 = errors2;
                    let valid9 = false;
                    const _errs59 = errors2;
                    const _errs61 = errors2;
                    let valid11 = false;
                    let passing1 = null;
                    const _errs62 = errors2;
                    if (errors2 === _errs62) {
                      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                        let missing4;
                        if (data18.basis === void 0 && (missing4 = "basis") || data18.offset === void 0 && (missing4 = "offset") || data18.timezone === void 0 && (missing4 = "timezone") || data18.weekStartsOn === void 0 && (missing4 = "weekStartsOn")) {
                          const err52 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                          if (vErrors === null) {
                            vErrors = [err52];
                          } else {
                            vErrors.push(err52);
                          }
                          errors2++;
                        } else {
                          const _errs64 = errors2;
                          for (const key4 in data18) {
                            if (!(key4 === "basis" || key4 === "offset" || key4 === "timezone" || key4 === "weekStartsOn")) {
                              const err53 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err53];
                              } else {
                                vErrors.push(err53);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs64 === errors2) {
                            if (data18.basis !== void 0) {
                              const _errs65 = errors2;
                              if ("calendar-week" !== data18.basis) {
                                const err54 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err54];
                                } else {
                                  vErrors.push(err54);
                                }
                                errors2++;
                              }
                              var valid12 = _errs65 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data18.offset !== void 0) {
                                let data20 = data18.offset;
                                const _errs66 = errors2;
                                if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
                                  const err55 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err55];
                                  } else {
                                    vErrors.push(err55);
                                  }
                                  errors2++;
                                }
                                if (!(data20 === -1 || data20 === 0)) {
                                  const err56 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err56];
                                  } else {
                                    vErrors.push(err56);
                                  }
                                  errors2++;
                                }
                                var valid12 = _errs66 === errors2;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data18.timezone !== void 0) {
                                  let data21 = data18.timezone;
                                  const _errs68 = errors2;
                                  if (errors2 === _errs68) {
                                    if (typeof data21 === "string") {
                                      if (func1(data21) > 100) {
                                        const err57 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err57];
                                        } else {
                                          vErrors.push(err57);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data21) < 1) {
                                          const err58 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err58];
                                          } else {
                                            vErrors.push(err58);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err59 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err59];
                                      } else {
                                        vErrors.push(err59);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid12 = _errs68 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                                if (valid12) {
                                  if (data18.weekStartsOn !== void 0) {
                                    let data22 = data18.weekStartsOn;
                                    const _errs70 = errors2;
                                    if (typeof data22 !== "string") {
                                      const err60 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err60];
                                      } else {
                                        vErrors.push(err60);
                                      }
                                      errors2++;
                                    }
                                    if (!(data22 === "monday" || data22 === "sunday")) {
                                      const err61 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err61];
                                      } else {
                                        vErrors.push(err61);
                                      }
                                      errors2++;
                                    }
                                    var valid12 = _errs70 === errors2;
                                  } else {
                                    var valid12 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err62 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err62];
                        } else {
                          vErrors.push(err62);
                        }
                        errors2++;
                      }
                    }
                    var _valid5 = _errs62 === errors2;
                    if (_valid5) {
                      valid11 = true;
                      passing1 = 0;
                      var props2 = true;
                    }
                    const _errs72 = errors2;
                    if (errors2 === _errs72) {
                      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                        let missing5;
                        if (data18.basis === void 0 && (missing5 = "basis") || data18.offset === void 0 && (missing5 = "offset") || data18.timezone === void 0 && (missing5 = "timezone")) {
                          const err63 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                          if (vErrors === null) {
                            vErrors = [err63];
                          } else {
                            vErrors.push(err63);
                          }
                          errors2++;
                        } else {
                          const _errs74 = errors2;
                          for (const key5 in data18) {
                            if (!(key5 === "basis" || key5 === "offset" || key5 === "timezone")) {
                              const err64 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err64];
                              } else {
                                vErrors.push(err64);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs74 === errors2) {
                            if (data18.basis !== void 0) {
                              const _errs75 = errors2;
                              if ("calendar-month" !== data18.basis) {
                                const err65 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
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
                              if (data18.offset !== void 0) {
                                let data24 = data18.offset;
                                const _errs76 = errors2;
                                if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                  const err66 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err66];
                                  } else {
                                    vErrors.push(err66);
                                  }
                                  errors2++;
                                }
                                if (!(data24 === -1 || data24 === 0)) {
                                  const err67 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err67];
                                  } else {
                                    vErrors.push(err67);
                                  }
                                  errors2++;
                                }
                                var valid13 = _errs76 === errors2;
                              } else {
                                var valid13 = true;
                              }
                              if (valid13) {
                                if (data18.timezone !== void 0) {
                                  let data25 = data18.timezone;
                                  const _errs78 = errors2;
                                  if (errors2 === _errs78) {
                                    if (typeof data25 === "string") {
                                      if (func1(data25) > 100) {
                                        const err68 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err68];
                                        } else {
                                          vErrors.push(err68);
                                        }
                                        errors2++;
                                      } else {
                                        if (func1(data25) < 1) {
                                          const err69 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err69];
                                          } else {
                                            vErrors.push(err69);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err70 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err70];
                                      } else {
                                        vErrors.push(err70);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid13 = _errs78 === errors2;
                                } else {
                                  var valid13 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err71 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err71];
                        } else {
                          vErrors.push(err71);
                        }
                        errors2++;
                      }
                    }
                    var _valid5 = _errs72 === errors2;
                    if (_valid5 && valid11) {
                      valid11 = false;
                      passing1 = [passing1, 1];
                    } else {
                      if (_valid5) {
                        valid11 = true;
                        passing1 = 1;
                        if (props2 !== true) {
                          props2 = true;
                        }
                      }
                      const _errs80 = errors2;
                      if (errors2 === _errs80) {
                        if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                          let missing6;
                          if (data18.basis === void 0 && (missing6 = "basis") || data18.offset === void 0 && (missing6 = "offset") || data18.timezone === void 0 && (missing6 = "timezone")) {
                            const err72 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                            if (vErrors === null) {
                              vErrors = [err72];
                            } else {
                              vErrors.push(err72);
                            }
                            errors2++;
                          } else {
                            const _errs82 = errors2;
                            for (const key6 in data18) {
                              if (!(key6 === "basis" || key6 === "offset" || key6 === "timezone")) {
                                const err73 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err73];
                                } else {
                                  vErrors.push(err73);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs82 === errors2) {
                              if (data18.basis !== void 0) {
                                const _errs83 = errors2;
                                if ("calendar-year" !== data18.basis) {
                                  const err74 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err74];
                                  } else {
                                    vErrors.push(err74);
                                  }
                                  errors2++;
                                }
                                var valid14 = _errs83 === errors2;
                              } else {
                                var valid14 = true;
                              }
                              if (valid14) {
                                if (data18.offset !== void 0) {
                                  let data27 = data18.offset;
                                  const _errs84 = errors2;
                                  if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                    const err75 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err75];
                                    } else {
                                      vErrors.push(err75);
                                    }
                                    errors2++;
                                  }
                                  if (!(data27 === -1 || data27 === 0)) {
                                    const err76 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err76];
                                    } else {
                                      vErrors.push(err76);
                                    }
                                    errors2++;
                                  }
                                  var valid14 = _errs84 === errors2;
                                } else {
                                  var valid14 = true;
                                }
                                if (valid14) {
                                  if (data18.timezone !== void 0) {
                                    let data28 = data18.timezone;
                                    const _errs86 = errors2;
                                    if (errors2 === _errs86) {
                                      if (typeof data28 === "string") {
                                        if (func1(data28) > 100) {
                                          const err77 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err77];
                                          } else {
                                            vErrors.push(err77);
                                          }
                                          errors2++;
                                        } else {
                                          if (func1(data28) < 1) {
                                            const err78 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err78];
                                            } else {
                                              vErrors.push(err78);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err79 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err79];
                                        } else {
                                          vErrors.push(err79);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid14 = _errs86 === errors2;
                                  } else {
                                    var valid14 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err80 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err80];
                          } else {
                            vErrors.push(err80);
                          }
                          errors2++;
                        }
                      }
                      var _valid5 = _errs80 === errors2;
                      if (_valid5 && valid11) {
                        valid11 = false;
                        passing1 = [passing1, 2];
                      } else {
                        if (_valid5) {
                          valid11 = true;
                          passing1 = 2;
                          if (props2 !== true) {
                            props2 = true;
                          }
                        }
                        const _errs88 = errors2;
                        if (errors2 === _errs88) {
                          if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                            let missing7;
                            if (data18.basis === void 0 && (missing7 = "basis") || data18.days === void 0 && (missing7 = "days") || data18.anchorAt === void 0 && (missing7 = "anchorAt") || data18.timezone === void 0 && (missing7 = "timezone")) {
                              const err81 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                              if (vErrors === null) {
                                vErrors = [err81];
                              } else {
                                vErrors.push(err81);
                              }
                              errors2++;
                            } else {
                              const _errs90 = errors2;
                              for (const key7 in data18) {
                                if (!(key7 === "basis" || key7 === "days" || key7 === "anchorAt" || key7 === "timezone")) {
                                  const err82 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err82];
                                  } else {
                                    vErrors.push(err82);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs90 === errors2) {
                                if (data18.basis !== void 0) {
                                  const _errs91 = errors2;
                                  if ("relative-duration" !== data18.basis) {
                                    const err83 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err83];
                                    } else {
                                      vErrors.push(err83);
                                    }
                                    errors2++;
                                  }
                                  var valid15 = _errs91 === errors2;
                                } else {
                                  var valid15 = true;
                                }
                                if (valid15) {
                                  if (data18.days !== void 0) {
                                    let data30 = data18.days;
                                    const _errs92 = errors2;
                                    if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                      const err84 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err84];
                                      } else {
                                        vErrors.push(err84);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs92) {
                                      if (typeof data30 == "number" && isFinite(data30)) {
                                        if (data30 > 3660 || isNaN(data30)) {
                                          const err85 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                          if (vErrors === null) {
                                            vErrors = [err85];
                                          } else {
                                            vErrors.push(err85);
                                          }
                                          errors2++;
                                        } else {
                                          if (data30 < 1 || isNaN(data30)) {
                                            const err86 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err86];
                                            } else {
                                              vErrors.push(err86);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid15 = _errs92 === errors2;
                                  } else {
                                    var valid15 = true;
                                  }
                                  if (valid15) {
                                    if (data18.anchorAt !== void 0) {
                                      let data31 = data18.anchorAt;
                                      const _errs94 = errors2;
                                      if (errors2 === _errs94) {
                                        if (errors2 === _errs94) {
                                          if (typeof data31 === "string") {
                                            if (!pattern6.test(data31)) {
                                              const err87 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err87];
                                              } else {
                                                vErrors.push(err87);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data31)) {
                                                const err88 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err88];
                                                } else {
                                                  vErrors.push(err88);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err89 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err89];
                                            } else {
                                              vErrors.push(err89);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid15 = _errs94 === errors2;
                                    } else {
                                      var valid15 = true;
                                    }
                                    if (valid15) {
                                      if (data18.timezone !== void 0) {
                                        let data32 = data18.timezone;
                                        const _errs96 = errors2;
                                        if (errors2 === _errs96) {
                                          if (typeof data32 === "string") {
                                            if (func1(data32) > 100) {
                                              const err90 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err90];
                                              } else {
                                                vErrors.push(err90);
                                              }
                                              errors2++;
                                            } else {
                                              if (func1(data32) < 1) {
                                                const err91 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err91];
                                                } else {
                                                  vErrors.push(err91);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err92 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err92];
                                            } else {
                                              vErrors.push(err92);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid15 = _errs96 === errors2;
                                      } else {
                                        var valid15 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err93 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err93];
                            } else {
                              vErrors.push(err93);
                            }
                            errors2++;
                          }
                        }
                        var _valid5 = _errs88 === errors2;
                        if (_valid5 && valid11) {
                          valid11 = false;
                          passing1 = [passing1, 3];
                        } else {
                          if (_valid5) {
                            valid11 = true;
                            passing1 = 3;
                            if (props2 !== true) {
                              props2 = true;
                            }
                          }
                          const _errs98 = errors2;
                          if (errors2 === _errs98) {
                            if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                              let missing8;
                              if (data18.basis === void 0 && (missing8 = "basis") || data18.startInclusive === void 0 && (missing8 = "startInclusive") || data18.endExclusive === void 0 && (missing8 = "endExclusive") || data18.timezone === void 0 && (missing8 = "timezone")) {
                                const err94 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err94];
                                } else {
                                  vErrors.push(err94);
                                }
                                errors2++;
                              } else {
                                const _errs100 = errors2;
                                for (const key8 in data18) {
                                  if (!(key8 === "basis" || key8 === "startInclusive" || key8 === "endExclusive" || key8 === "timezone")) {
                                    const err95 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err95];
                                    } else {
                                      vErrors.push(err95);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs100 === errors2) {
                                  if (data18.basis !== void 0) {
                                    const _errs101 = errors2;
                                    if ("explicit" !== data18.basis) {
                                      const err96 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err96];
                                      } else {
                                        vErrors.push(err96);
                                      }
                                      errors2++;
                                    }
                                    var valid16 = _errs101 === errors2;
                                  } else {
                                    var valid16 = true;
                                  }
                                  if (valid16) {
                                    if (data18.startInclusive !== void 0) {
                                      let data34 = data18.startInclusive;
                                      const _errs102 = errors2;
                                      if (errors2 === _errs102) {
                                        if (errors2 === _errs102) {
                                          if (typeof data34 === "string") {
                                            if (!pattern6.test(data34)) {
                                              const err97 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err97];
                                              } else {
                                                vErrors.push(err97);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data34)) {
                                                const err98 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err98];
                                                } else {
                                                  vErrors.push(err98);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err99 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err99];
                                            } else {
                                              vErrors.push(err99);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid16 = _errs102 === errors2;
                                    } else {
                                      var valid16 = true;
                                    }
                                    if (valid16) {
                                      if (data18.endExclusive !== void 0) {
                                        let data35 = data18.endExclusive;
                                        const _errs104 = errors2;
                                        if (errors2 === _errs104) {
                                          if (errors2 === _errs104) {
                                            if (typeof data35 === "string") {
                                              if (!pattern6.test(data35)) {
                                                const err100 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err100];
                                                } else {
                                                  vErrors.push(err100);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data35)) {
                                                  const err101 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err101];
                                                  } else {
                                                    vErrors.push(err101);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err102 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid16 = _errs104 === errors2;
                                      } else {
                                        var valid16 = true;
                                      }
                                      if (valid16) {
                                        if (data18.timezone !== void 0) {
                                          let data36 = data18.timezone;
                                          const _errs106 = errors2;
                                          if (errors2 === _errs106) {
                                            if (typeof data36 === "string") {
                                              if (func1(data36) > 100) {
                                                const err103 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err103];
                                                } else {
                                                  vErrors.push(err103);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data36) < 1) {
                                                  const err104 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err104];
                                                  } else {
                                                    vErrors.push(err104);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err105 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err105];
                                              } else {
                                                vErrors.push(err105);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid16 = _errs106 === errors2;
                                        } else {
                                          var valid16 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err106 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err106];
                              } else {
                                vErrors.push(err106);
                              }
                              errors2++;
                            }
                          }
                          var _valid5 = _errs98 === errors2;
                          if (_valid5 && valid11) {
                            valid11 = false;
                            passing1 = [passing1, 4];
                          } else {
                            if (_valid5) {
                              valid11 = true;
                              passing1 = 4;
                              if (props2 !== true) {
                                props2 = true;
                              }
                            }
                            const _errs108 = errors2;
                            if (errors2 === _errs108) {
                              if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                let missing9;
                                if (data18.basis === void 0 && (missing9 = "basis") || data18.year === void 0 && (missing9 = "year") || data18.calendarId === void 0 && (missing9 = "calendarId") || data18.stage === void 0 && (missing9 = "stage") || data18.revisionId === void 0 && (missing9 = "revisionId") || data18.timezone === void 0 && (missing9 = "timezone")) {
                                  const err107 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err107];
                                  } else {
                                    vErrors.push(err107);
                                  }
                                  errors2++;
                                } else {
                                  const _errs110 = errors2;
                                  for (const key9 in data18) {
                                    if (!(key9 === "basis" || key9 === "year" || key9 === "calendarId" || key9 === "stage" || key9 === "revisionId" || key9 === "timezone")) {
                                      const err108 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err108];
                                      } else {
                                        vErrors.push(err108);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs110 === errors2) {
                                    if (data18.basis !== void 0) {
                                      const _errs111 = errors2;
                                      if ("fiscal-year" !== data18.basis) {
                                        const err109 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err109];
                                        } else {
                                          vErrors.push(err109);
                                        }
                                        errors2++;
                                      }
                                      var valid17 = _errs111 === errors2;
                                    } else {
                                      var valid17 = true;
                                    }
                                    if (valid17) {
                                      if (data18.year !== void 0) {
                                        let data38 = data18.year;
                                        const _errs112 = errors2;
                                        if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                          const err110 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err110];
                                          } else {
                                            vErrors.push(err110);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs112) {
                                          if (typeof data38 == "number" && isFinite(data38)) {
                                            if (data38 > 3e3 || isNaN(data38)) {
                                              const err111 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                              if (vErrors === null) {
                                                vErrors = [err111];
                                              } else {
                                                vErrors.push(err111);
                                              }
                                              errors2++;
                                            } else {
                                              if (data38 < 1900 || isNaN(data38)) {
                                                const err112 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                                if (vErrors === null) {
                                                  vErrors = [err112];
                                                } else {
                                                  vErrors.push(err112);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid17 = _errs112 === errors2;
                                      } else {
                                        var valid17 = true;
                                      }
                                      if (valid17) {
                                        if (data18.calendarId !== void 0) {
                                          let data39 = data18.calendarId;
                                          const _errs114 = errors2;
                                          if (errors2 === _errs114) {
                                            if (typeof data39 === "string") {
                                              if (func1(data39) > 128) {
                                                const err113 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err113];
                                                } else {
                                                  vErrors.push(err113);
                                                }
                                                errors2++;
                                              } else {
                                                if (func1(data39) < 1) {
                                                  const err114 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err114];
                                                  } else {
                                                    vErrors.push(err114);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!pattern9.test(data39)) {
                                                    const err115 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err115];
                                                    } else {
                                                      vErrors.push(err115);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err116 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err116];
                                              } else {
                                                vErrors.push(err116);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid17 = _errs114 === errors2;
                                        } else {
                                          var valid17 = true;
                                        }
                                        if (valid17) {
                                          if (data18.stage !== void 0) {
                                            let data40 = data18.stage;
                                            const _errs116 = errors2;
                                            if (typeof data40 !== "string") {
                                              const err117 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err117];
                                              } else {
                                                vErrors.push(err117);
                                              }
                                              errors2++;
                                            }
                                            if (!(data40 === "requested" || data40 === "authorized" || data40 === "appropriated" || data40 === "obligated" || data40 === "actual" || data40 === "outlay")) {
                                              const err118 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                              if (vErrors === null) {
                                                vErrors = [err118];
                                              } else {
                                                vErrors.push(err118);
                                              }
                                              errors2++;
                                            }
                                            var valid17 = _errs116 === errors2;
                                          } else {
                                            var valid17 = true;
                                          }
                                          if (valid17) {
                                            if (data18.revisionId !== void 0) {
                                              let data41 = data18.revisionId;
                                              const _errs118 = errors2;
                                              if (errors2 === _errs118) {
                                                if (typeof data41 === "string") {
                                                  if (func1(data41) > 256) {
                                                    const err119 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err119];
                                                    } else {
                                                      vErrors.push(err119);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    if (func1(data41) < 1) {
                                                      const err120 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err120];
                                                      } else {
                                                        vErrors.push(err120);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                } else {
                                                  const err121 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err121];
                                                  } else {
                                                    vErrors.push(err121);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid17 = _errs118 === errors2;
                                            } else {
                                              var valid17 = true;
                                            }
                                            if (valid17) {
                                              if (data18.timezone !== void 0) {
                                                let data42 = data18.timezone;
                                                const _errs120 = errors2;
                                                if (errors2 === _errs120) {
                                                  if (typeof data42 === "string") {
                                                    if (func1(data42) > 100) {
                                                      const err122 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err122];
                                                      } else {
                                                        vErrors.push(err122);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (func1(data42) < 1) {
                                                        const err123 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err123];
                                                        } else {
                                                          vErrors.push(err123);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err124 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err124];
                                                    } else {
                                                      vErrors.push(err124);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid17 = _errs120 === errors2;
                                              } else {
                                                var valid17 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err125 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err125];
                                } else {
                                  vErrors.push(err125);
                                }
                                errors2++;
                              }
                            }
                            var _valid5 = _errs108 === errors2;
                            if (_valid5 && valid11) {
                              valid11 = false;
                              passing1 = [passing1, 5];
                            } else {
                              if (_valid5) {
                                valid11 = true;
                                passing1 = 5;
                                if (props2 !== true) {
                                  props2 = true;
                                }
                              }
                              const _errs122 = errors2;
                              if (errors2 === _errs122) {
                                if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                  let missing10;
                                  if (data18.basis === void 0 && (missing10 = "basis")) {
                                    const err126 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                                    if (vErrors === null) {
                                      vErrors = [err126];
                                    } else {
                                      vErrors.push(err126);
                                    }
                                    errors2++;
                                  } else {
                                    const _errs124 = errors2;
                                    for (const key10 in data18) {
                                      if (!(key10 === "basis")) {
                                        const err127 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                        if (vErrors === null) {
                                          vErrors = [err127];
                                        } else {
                                          vErrors.push(err127);
                                        }
                                        errors2++;
                                        break;
                                      }
                                    }
                                    if (_errs124 === errors2) {
                                      if (data18.basis !== void 0) {
                                        if ("unbounded" !== data18.basis) {
                                          const err128 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err128];
                                          } else {
                                            vErrors.push(err128);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const err129 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                  if (vErrors === null) {
                                    vErrors = [err129];
                                  } else {
                                    vErrors.push(err129);
                                  }
                                  errors2++;
                                }
                              }
                              var _valid5 = _errs122 === errors2;
                              if (_valid5 && valid11) {
                                valid11 = false;
                                passing1 = [passing1, 6];
                              } else {
                                if (_valid5) {
                                  valid11 = true;
                                  passing1 = 6;
                                  if (props2 !== true) {
                                    props2 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    if (!valid11) {
                      const err130 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6bb8c023/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                      if (vErrors === null) {
                        vErrors = [err130];
                      } else {
                        vErrors.push(err130);
                      }
                      errors2++;
                    } else {
                      errors2 = _errs61;
                      if (vErrors !== null) {
                        if (_errs61) {
                          vErrors.length = _errs61;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var _valid4 = _errs59 === errors2;
                    valid9 = valid9 || _valid4;
                    const _errs126 = errors2;
                    if (data18 !== null) {
                      const err131 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err131];
                      } else {
                        vErrors.push(err131);
                      }
                      errors2++;
                    }
                    var _valid4 = _errs126 === errors2;
                    valid9 = valid9 || _valid4;
                    if (!valid9) {
                      const err132 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err132];
                      } else {
                        vErrors.push(err132);
                      }
                      errors2++;
                      validate33.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs58;
                      if (vErrors !== null) {
                        if (_errs58) {
                          vErrors.length = _errs58;
                        } else {
                          vErrors = null;
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
    } else {
      validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors2 === 0;
}
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.run === void 0 && (missing0 = "run") || data.request === void 0 && (missing0 = "request") || data.lastSequence === void 0 && (missing0 = "lastSequence") || data.replayed === void 0 && (missing0 = "replayed")) {
        validate42.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "run" || key0 === "request" || key0 === "lastSequence" || key0 === "replayed")) {
            validate42.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.run !== void 0) {
            const _errs2 = errors2;
            if (!validate31(data.run, { instancePath: instancePath + "/run", parentData: data, parentDataProperty: "run", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
              errors2 = vErrors.length;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.request !== void 0) {
              const _errs3 = errors2;
              if (!validate33(data.request, { instancePath: instancePath + "/request", parentData: data, parentDataProperty: "request", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate33.errors : vErrors.concat(validate33.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.lastSequence !== void 0) {
                let data2 = data.lastSequence;
                const _errs4 = errors2;
                if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                  validate42.errors = [{ instancePath: instancePath + "/lastSequence", schemaPath: "#/properties/lastSequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors2 === _errs4) {
                  if (typeof data2 == "number" && isFinite(data2)) {
                    if (data2 > 9007199254740991 || isNaN(data2)) {
                      validate42.errors = [{ instancePath: instancePath + "/lastSequence", schemaPath: "#/properties/lastSequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                      return false;
                    } else {
                      if (data2 < 1 || isNaN(data2)) {
                        validate42.errors = [{ instancePath: instancePath + "/lastSequence", schemaPath: "#/properties/lastSequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                if (data.replayed !== void 0) {
                  const _errs6 = errors2;
                  if (typeof data.replayed !== "boolean") {
                    validate42.errors = [{ instancePath: instancePath + "/replayed", schemaPath: "#/properties/replayed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs6 === errors2;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate42.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate42.errors = vErrors;
  return errors2 === 0;
}
validate42.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.tenantId === void 0 && (missing0 = "tenantId") || data.actorId === void 0 && (missing0 = "actorId") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.clientId === void 0 && (missing0 = "clientId")) {
        validate45.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "tenantId" || key0 === "actorId" || key0 === "conversationId" || key0 === "runId" || key0 === "clientId")) {
            validate45.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate45.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                  return false;
                } else {
                  if (func1(data0) < 1) {
                    validate45.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                    return false;
                  }
                }
              } else {
                validate45.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                    validate45.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                    return false;
                  } else {
                    if (func1(data1) < 1) {
                      validate45.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    }
                  }
                } else {
                  validate45.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                  if (typeof data2 === "string") {
                    if (!pattern4.test(data2)) {
                      validate45.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                      return false;
                    }
                  } else {
                    validate45.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
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
                    if (typeof data3 === "string") {
                      if (!pattern4.test(data3)) {
                        validate45.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                        return false;
                      }
                    } else {
                      validate45.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.clientId !== void 0) {
                    let data4 = data.clientId;
                    const _errs10 = errors2;
                    if (errors2 === _errs10) {
                      if (typeof data4 === "string") {
                        if (!pattern4.test(data4)) {
                          validate45.errors = [{ instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                          return false;
                        }
                      } else {
                        validate45.errors = [{ instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
      validate45.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate45.errors = vErrors;
  return errors2 === 0;
}
validate45.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema56 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["NOT_FOUND", "METHOD_NOT_ALLOWED", "SESSION_REFUSED", "UNSUPPORTED_MEDIA_TYPE", "INVALID_REQUEST", "INVALID_CURSOR", "REQUEST_REPLAY_REFUSED", "SCOPE_REFUSED", "SESSION_CHANGED", "STALE_WRITER", "CONVERSATION_SELECTOR_REFUSED", "DEADLINE", "CANCELLED", "REQUEST_TOO_LARGE", "CONVERSATION_UNAVAILABLE"] } }, "required": ["code"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
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
      if (data.error === void 0 && (missing0 = "error")) {
        validate46.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "error")) {
            validate46.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
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
                  validate46.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  const _errs4 = errors2;
                  for (const key1 in data0) {
                    if (!(key1 === "code")) {
                      validate46.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                      return false;
                      break;
                    }
                  }
                  if (_errs4 === errors2) {
                    if (data0.code !== void 0) {
                      let data1 = data0.code;
                      if (!(data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "SESSION_REFUSED" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "INVALID_REQUEST" || data1 === "INVALID_CURSOR" || data1 === "REQUEST_REPLAY_REFUSED" || data1 === "SCOPE_REFUSED" || data1 === "SESSION_CHANGED" || data1 === "STALE_WRITER" || data1 === "CONVERSATION_SELECTOR_REFUSED" || data1 === "DEADLINE" || data1 === "CANCELLED" || data1 === "REQUEST_TOO_LARGE" || data1 === "CONVERSATION_UNAVAILABLE")) {
                        validate46.errors = [{ instancePath: instancePath + "/error/code", schemaPath: "#/properties/error/properties/code/enum", keyword: "enum", params: { allowedValues: schema56.properties.error.properties.code.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                    }
                  }
                }
              } else {
                validate46.errors = [{ instancePath: instancePath + "/error", schemaPath: "#/properties/error/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
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

// conversation-input/semantics.mjs
import { receiveConversationRequest, receiveConversationResponse, ConversationResponseError } from "./conversation-application.mjs";
var fail2 = (code) => {
  throw new ConversationResponseError(code);
};
var bytes = (value) => new TextEncoder().encode(JSON.stringify(value));
var contextKeys = ["tenantId", "actorId", "conversationId", "runId", "clientId"];
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
function expectedContext(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail2("INPUT_CONTEXT_INVALID");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length !== contextKeys.length || keys.some((key) => typeof key !== "string" || !contextKeys.includes(key))) fail2("INPUT_CONTEXT_INVALID");
    const context = {};
    for (const key of contextKeys) {
      const d = descriptors[key];
      if (!d || !Object.hasOwn(d, "value") || !d.enumerable || typeof d.value !== "string") fail2("INPUT_CONTEXT_INVALID");
      context[key] = d.value;
    }
    if (["tenantId", "actorId"].some((key) => !context[key] || context[key].length > 128) || ["conversationId", "runId", "clientId"].some((key) => !uuid.test(context[key]))) fail2("INPUT_CONTEXT_INVALID");
    return Object.freeze(context);
  } catch (error) {
    if (error instanceof ConversationResponseError) throw error;
    fail2("INPUT_CONTEXT_INVALID");
  }
}
function assertInputContext(receipt, context) {
  const b = receipt.run.binding;
  if (["tenantId", "actorId", "conversationId", "runId"].some((key) => b[key] !== context[key]) || !receipt.run.scopes.some((scope) => scope.kind === "client" && scope.tenantId === context.tenantId && scope.resourceId === context.clientId)) fail2("INPUT_CONTEXT_MISMATCH");
}
async function correlateInputReceipt(receipt, request, currentView) {
  const submitted = await receiveConversationResponse("submit", 200, bytes({ run: receipt.run, requestId: receipt.request.requestId, lastSequence: receipt.lastSequence, replayed: receipt.replayed }), request, currentView);
  const cursor = receiveConversationRequest("history", bytes({ after: receipt.lastSequence, limit: 1 }));
  return receiveConversationResponse("history", 200, bytes({ run: receipt.run, request: receipt.request, events: [], nextSequence: receipt.lastSequence, lastSequence: receipt.lastSequence, hasMore: false }), cursor, submitted);
}

// conversation-input/protocol.mjs
import { conversationApplicationMetadata } from "./conversation-application.mjs";
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationInputVersion = "1.0.0";
var conversationInputPath = "/api/conversations/input/admit";
var inputErrorStatuses = conversationApplicationMetadata.errorStatuses;
var conversationInputMetadata = freeze({
  packageVersion: "0.1.7",
  inputVersion: conversationInputVersion,
  schemaId: "urn:meri:conversation-input:1.0.0",
  routes: { admit: { method: "POST", path: conversationInputPath, response: "json" } },
  authentication: { ...conversationApplicationMetadata.authentication, expectedContext: "independently authenticated tenant, actor, conversation, run and selected client" },
  limits: { requestBytes: conversationApplicationMetadata.limits.requestBytes, responseBytes: conversationApplicationMetadata.limits.responseBytes },
  receipt: "durable immutable input; queued is not evidence of provider execution",
  recovery: "positive stored request only; errors, absent history and RESERVED mappings grant no input or dispatch authority",
  errorStatuses: inputErrorStatuses
});

// conversation-input/conversation-input-receiver.mjs
var views = /* @__PURE__ */ new WeakMap();
var parse = (bytes2) => {
  try {
    return parseBytes(bytes2, conversationInputMetadata.limits.responseBytes);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
};
var receiveConversationInputRequest = (utf8Bytes) => receiveConversationRequest2("submit", utf8Bytes);
async function receiveConversationInputResponse(httpStatus, utf8Bytes, request, context, currentView) {
  const admittedContext = expectedContext(context), prior = views.get(currentView) ?? currentView;
  if (httpStatus !== 200) return receiveConversationResponse2("submit", httpStatus, utf8Bytes, request, prior);
  const receipt = parse(utf8Bytes);
  if (!validateAdmittedResponse(receipt)) fail2("INVALID_RESPONSE");
  const view = await correlateInputReceipt(receipt, request, prior);
  assertInputContext(receipt, admittedContext);
  views.set(receipt, view);
  return receipt;
}
function conversationInputView(receipt) {
  const view = views.get(receipt);
  if (!view) fail2("UNADMITTED_VIEW");
  return view;
}
export {
  ConversationResponseError as ConversationInputResponseError,
  conversationInputMetadata,
  conversationInputPath,
  conversationInputVersion,
  conversationInputView,
  receiveConversationInputRequest,
  receiveConversationInputResponse
};
